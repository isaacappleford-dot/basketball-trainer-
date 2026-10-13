"use client";

import { useState } from "react";
import type { Intensity, OpenGymSession, OpenGymStatus } from "@/lib/types";
import { useAppState } from "@/lib/store";
import { saveOpenGym } from "@/lib/actions";
import { currentWeekOccurrences, isBlockedDay } from "@/lib/schedule";
import { cn, formatDate, nowISO, todayISO, uid } from "@/lib/utils";
import { INTENSITY_OPTIONS, OPEN_GYM_SKILLS, OPEN_GYM_STATUS_LABELS } from "./labels";
import { Alert, Button, Checkbox, ConfirmDialog, Field, Input, Modal, Rating, Segmented, Select, Textarea, useToast, useUnsavedWarning } from "./ui";

export function newOpenGym(date: string, status: OpenGymStatus = "attended"): OpenGymSession {
  return {
    id: uid("og"),
    date,
    status,
    replacedWith: "",
    durationMin: status === "attended" ? 90 : null,
    intensity: null,
    effort: null,
    format: null,
    skills: [],
    hardRunning: false,
    countsFor: null,
    notes: "",
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
}

export function OpenGymForm({ initial, onClose, onSaved }: { initial: OpenGymSession; onClose: () => void; onSaved?: (s: OpenGymSession) => void }) {
  const state = useAppState();
  const toast = useToast();
  const [o, setO] = useState(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [strengthConfirm, setStrengthConfirm] = useState(!!initial.countsFor);
  useUnsavedWarning(dirty);
  const up = (patch: Partial<OpenGymSession>) => {
    setDirty(true);
    setO((x) => ({ ...x, ...patch }));
  };
  const isNew = !state.openGymSessions.some((x) => x.id === initial.id);
  const today = todayISO();

  // Planned workouts this week that this open gym could stand in for.
  const slots = currentWeekOccurrences(state, o.date).filter(
    (x) => (!x.session && !x.fulfilledBy) || (x.fulfilledBy?.type === "open-gym" && x.fulfilledBy.id === o.id),
  );
  const linkKey = o.countsFor ? `${o.countsFor.plannedWorkoutId}@${o.countsFor.originalDate}` : "";
  const linked = slots.find((x) => x.key === linkKey);
  const linkedIsStrength = linked?.workout.kind === "strength";

  const save = () => {
    const errs: string[] = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.date)) errs.push("Choose a valid date.");
    if (o.status === "attended") {
      if (o.date > today) errs.push("You can't mark a future open gym as attended — mark it planned instead.");
      if (!o.durationMin || o.durationMin <= 0 || o.durationMin > 360) errs.push("Enter a duration between 1 and 360 minutes.");
      if (!o.intensity) errs.push("Choose light, moderate or hard.");
      if (!o.format) errs.push("Choose full-court, half-court or drills.");
      if (linkedIsStrength && !strengthConfirm) errs.push("Confirm that you want to replace a strength workout with open gym, or pick a different link.");
    }
    if (o.status === "planned" && isBlockedDay(state, o.date)) errs.push("That day is marked unavailable — open gym can't be planned on it.");
    if (o.status === "replaced" && !o.replacedWith.trim()) errs.push("Say what you did instead (e.g. home shooting, recovery).");
    setErrors(errs);
    if (errs.length) return;
    const clean: OpenGymSession = {
      ...o,
      countsFor: o.status === "attended" ? o.countsFor : null,
      notes: o.notes.trim(),
      replacedWith: o.status === "replaced" ? o.replacedWith.trim() : "",
    };
    saveOpenGym(clean);
    toast(
      clean.status === "attended"
        ? `Open gym saved${clean.intensity === "hard" ? " — check the dashboard for recovery suggestions" : ""}.`
        : `Open gym marked ${OPEN_GYM_STATUS_LABELS[clean.status].toLowerCase()}.`,
    );
    onSaved?.(clean);
    onClose();
  };

  return (
    <>
      <Modal
        open
        size="lg"
        onClose={() => (dirty ? setConfirmClose(true) : onClose())}
        title={isNew ? "Open gym" : "Edit open gym"}
        footer={
          <>
            <Button variant="secondary" onClick={() => (dirty ? setConfirmClose(true) : onClose())}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </>
        }
      >
        <div className="space-y-5">
          {errors.length > 0 && (
            <Alert tone="bad" title="Please fix the following">
              <ul className="list-disc pl-4">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Alert>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date" htmlFor="og-date">
              <Input id="og-date" type="date" value={o.date} onChange={(e) => up({ date: e.target.value, countsFor: null })} />
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Status</span>
              <Segmented
                label="Open gym status"
                size="sm"
                value={o.status}
                onChange={(v) => up({ status: v, durationMin: v === "attended" ? o.durationMin ?? 90 : o.durationMin })}
                options={(Object.keys(OPEN_GYM_STATUS_LABELS) as OpenGymStatus[]).map((k) => ({ value: k, label: OPEN_GYM_STATUS_LABELS[k] }))}
              />
            </div>
          </div>

          {o.status === "planned" && <p className="text-sm text-muted">Planning to go is just a note to yourself. Nothing else is scheduled around it, and skipping it is fine.</p>}
          {o.status === "skipped" && <p className="text-sm text-muted">Skipped — no problem. Open gym is always optional.</p>}
          {o.status === "replaced" && (
            <Field label="What did you do instead?" htmlFor="og-repl">
              <Input id="og-repl" value={o.replacedWith} onChange={(e) => up({ replacedWith: e.target.value })} placeholder="e.g. Home Court shooting, recovery, rest" />
            </Field>
          )}

          {o.status === "attended" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Duration (minutes)" htmlFor="og-dur">
                  <Input id="og-dur" type="number" inputMode="numeric" value={o.durationMin ?? ""} onChange={(e) => up({ durationMin: e.target.value === "" ? null : Number(e.target.value) })} />
                </Field>
                <Field label="What did you play?" htmlFor="og-format">
                  <Select id="og-format" value={o.format ?? ""} onChange={(e) => up({ format: (e.target.value || null) as OpenGymSession["format"] })}>
                    <option value="">Choose…</option>
                    <option value="full-court">Full-court games</option>
                    <option value="half-court">Half-court games</option>
                    <option value="drills">Practiced drills</option>
                  </Select>
                </Field>
              </div>
              <div>
                <p className="mb-1.5 text-sm font-medium">Session intensity</p>
                <Segmented label="Open gym intensity" value={o.intensity} onChange={(v: Intensity) => up({ intensity: v })} options={INTENSITY_OPTIONS} />
              </div>
              <div>
                <p className="mb-1.5 text-sm font-medium">Perceived effort (optional)</p>
                <Rating label="Open gym perceived effort" max={10} value={o.effort} onChange={(v) => up({ effort: v })} onClear={() => up({ effort: null })} lowLabel="Very easy" highLabel="Max" />
              </div>
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Skills practiced</legend>
                <div className="flex flex-wrap gap-2">
                  {OPEN_GYM_SKILLS.map((k) => {
                    const on = o.skills.includes(k);
                    return (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={on}
                        onClick={() => up({ skills: on ? o.skills.filter((x) => x !== k) : [...o.skills, k] })}
                        className={cn("h-10 rounded-full border px-4 text-sm", on ? "border-accent bg-accent-soft text-accent" : "border-line-strong text-muted hover:text-text")}
                      >
                        {k}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <Checkbox
                checked={o.hardRunning}
                onChange={(v) => up({ hardRunning: v })}
                label="Lots of hard running"
                description="Lets the app suggest trimming extra conditioning this week."
              />
              <div className="rounded-xl border border-line p-3">
                <Field
                  label="Count this toward a planned session? (optional)"
                  htmlFor="og-link"
                  hint="Open gym can stand in for a basketball session. It never counts as a gym strength workout."
                >
                  <Select
                    id="og-link"
                    value={linkKey}
                    onChange={(e) => {
                      const sel = slots.find((x) => x.key === e.target.value);
                      setStrengthConfirm(false);
                      up({ countsFor: sel ? { plannedWorkoutId: sel.plannedId, originalDate: sel.originalDate } : null });
                    }}
                  >
                    <option value="">No — just log it</option>
                    {slots.map((x) => (
                      <option key={x.key} value={x.key}>
                        {x.workout.kind === "strength" ? "Replace" : "Counts as"} {x.workout.label} — {x.workout.name} ({formatDate(x.date, { weekday: "short", month: "short", day: "numeric" })})
                      </option>
                    ))}
                  </Select>
                </Field>
                {linkedIsStrength && (
                  <div className="mt-2">
                    <Checkbox
                      checked={strengthConfirm}
                      onChange={setStrengthConfirm}
                      label={`Yes, replace ${linked!.workout.label} with open gym this week`}
                      description="It will show as “replaced”, not completed — your strength count stays honest."
                    />
                  </div>
                )}
              </div>
            </>
          )}

          <Field label="Notes (optional)" htmlFor="og-notes">
            <Textarea id="og-notes" value={o.notes} onChange={(e) => up({ notes: e.target.value })} placeholder="Matchups, what worked, what to practice next…" />
          </Field>
        </div>
      </Modal>
      <ConfirmDialog open={confirmClose} onClose={() => setConfirmClose(false)} danger title="Discard changes?" message="This open gym entry hasn't been saved." confirmLabel="Discard" onConfirm={onClose} />
    </>
  );
}

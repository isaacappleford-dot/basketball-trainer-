"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { ConditioningModality, PlannedExercise, PlannedWorkout } from "@/lib/types";
import { useAppState } from "@/lib/store";
import { updatePlannedWorkout } from "@/lib/actions";
import { blockedWeekdays } from "@/lib/schedule";
import { uid, WEEKDAYS } from "@/lib/utils";
import { MODALITY_LABELS } from "./ProfileForm";
import { LOCATION_LABELS } from "./labels";
import { ExercisePicker } from "./ExercisePicker";
import { Alert, Button, ConfirmDialog, Field, IconButton, Input, Modal, Select, Textarea, useToast } from "./ui";

function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function WorkoutEditor({ workout, onClose }: { workout: PlannedWorkout; onClose: () => void }) {
  const state = useAppState();
  const toast = useToast();
  const [draft, setDraft] = useState<PlannedWorkout>(() => structuredClone(workout));
  const [dirty, setDirty] = useState(false);
  const [picker, setPicker] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const set = (patch: Partial<PlannedWorkout>) => {
    setDirty(true);
    setDraft((d) => ({ ...d, ...patch }));
  };
  const setEx = (i: number, patch: Partial<PlannedExercise>) => set({ exercises: draft.exercises.map((e, k) => (k === i ? { ...e, ...patch } : e)) });
  const name = (id: string) => state.exercises.find((e) => e.id === id)?.name ?? id;

  const save = () => {
    const errs: string[] = [];
    if (!draft.name.trim()) errs.push("Workout name is required.");
    if (!draft.label.trim()) errs.push("Short label is required.");
    if (draft.weekday !== null && blockedWeekdays(state).includes(draft.weekday)) errs.push(`${WEEKDAYS[draft.weekday]} is marked unavailable — pick another day.`);
    draft.exercises.forEach((e) => {
      if (!(e.sets >= 1 && e.sets <= 10)) errs.push(`${name(e.exerciseId)}: sets must be 1–10.`);
      if (!(e.repMin >= 0 && e.repMax >= e.repMin)) errs.push(`${name(e.exerciseId)}: rep range minimum must not exceed maximum.`);
      if (!(e.restSec >= 0 && e.restSec <= 600)) errs.push(`${name(e.exerciseId)}: rest must be 0–600 seconds.`);
    });
    draft.conditioning.forEach((c) => {
      if (!(c.rounds >= 1 && c.workSec >= 5)) errs.push(`${c.label || "Conditioning option"}: needs at least 1 round and a 5 s work interval.`);
    });
    setErrors(errs);
    if (errs.length) return;
    updatePlannedWorkout({
      ...draft,
      name: draft.name.trim(),
      label: draft.label.trim(),
      warmup: draft.warmup.filter((w) => w.text.trim()),
      exercises: draft.exercises.map((e) => ({ ...e, repsLabel: e.repsLabel.trim() || (e.repMin === e.repMax ? String(e.repMin) : `${e.repMin}–${e.repMax}`) })),
    });
    toast("Workout plan updated.");
    onClose();
  };

  const requestClose = () => (dirty ? setConfirmClose(true) : onClose());
  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <>
      <Modal
        open
        size="lg"
        onClose={requestClose}
        title={`Edit ${draft.label}`}
        footer={
          <>
            <Button variant="secondary" onClick={requestClose}>
              Cancel
            </Button>
            <Button onClick={save}>Save changes</Button>
          </>
        }
      >
        <div className="space-y-6">
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
            <Field label="Workout name" htmlFor="we-name">
              <Input id="we-name" value={draft.name} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label="Scheduled day" htmlFor="we-day">
              <Select id="we-day" value={draft.weekday ?? ""} onChange={(e) => set({ weekday: e.target.value === "" ? null : Number(e.target.value) })}>
                <option value="">Not scheduled (optional)</option>
                {WEEKDAYS.map((d, i) => (
                  <option key={d} value={i} disabled={blockedWeekdays(state).includes(i)}>
                    {d}
                    {blockedWeekdays(state).includes(i) ? " (unavailable)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Short label" htmlFor="we-label">
              <Input id="we-label" value={draft.label} onChange={(e) => set({ label: e.target.value })} maxLength={16} />
            </Field>
            <Field label="Session type" htmlFor="we-kind" hint="Strength days count toward 2 gym sessions; basketball days toward 2 basketball sessions.">
              <Select id="we-kind" value={draft.kind} onChange={(e) => set({ kind: e.target.value as PlannedWorkout["kind"] })}>
                <option value="strength">Strength (gym)</option>
                <option value="basketball">Basketball-focused</option>
              </Select>
            </Field>
            <Field label="Location" htmlFor="we-loc">
              <Select id="we-loc" value={draft.location} onChange={(e) => set({ location: e.target.value as PlannedWorkout["location"] })}>
                {(Object.keys(LOCATION_LABELS) as PlannedWorkout["location"][]).map((l) => (
                  <option key={l} value={l}>
                    {LOCATION_LABELS[l]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Emphasis" htmlFor="we-emph" hint="Used to avoid stacking hard leg days before basketball.">
              <Select id="we-emph" value={draft.emphasis} onChange={(e) => set({ emphasis: e.target.value as PlannedWorkout["emphasis"] })}>
                <option value="lower">Lower body</option>
                <option value="upper">Upper body</option>
                <option value="skills">Skills</option>
                <option value="speed">Speed & conditioning</option>
              </Select>
            </Field>
            <Field label="Focus" htmlFor="we-focus" className="sm:col-span-2">
              <Input id="we-focus" value={draft.focus} onChange={(e) => set({ focus: e.target.value })} />
            </Field>
          </div>

          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">Warm-up</h3>
            <ul className="space-y-2">
              {draft.warmup.map((w, i) => (
                <li key={w.id} className="flex gap-2">
                  <Input aria-label={`Warm-up item ${i + 1}`} value={w.text} onChange={(e) => set({ warmup: draft.warmup.map((x) => (x.id === w.id ? { ...x, text: e.target.value } : x)) })} />
                  <IconButton label="Remove warm-up item" onClick={() => set({ warmup: draft.warmup.filter((x) => x.id !== w.id) })}>
                    <Trash2 size={16} />
                  </IconButton>
                </li>
              ))}
            </ul>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => set({ warmup: [...draft.warmup, { id: uid("wu"), text: "" }] })}>
              <Plus size={14} /> Add warm-up item
            </Button>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">Exercises</h3>
            <ul className="space-y-3">
              {draft.exercises.map((e, i) => (
                <li key={e.id} className="rounded-xl border border-line p-3">
                  <div className="mb-3 flex items-center gap-1">
                    <p className="min-w-0 flex-1 truncate font-medium">
                      {i + 1}. {name(e.exerciseId)}
                    </p>
                    <IconButton label="Move up" onClick={() => set({ exercises: move(draft.exercises, i, -1) })} disabled={i === 0}>
                      <ArrowUp size={16} />
                    </IconButton>
                    <IconButton label="Move down" onClick={() => set({ exercises: move(draft.exercises, i, 1) })} disabled={i === draft.exercises.length - 1}>
                      <ArrowDown size={16} />
                    </IconButton>
                    <IconButton label={`Remove ${name(e.exerciseId)}`} onClick={() => set({ exercises: draft.exercises.filter((x) => x.id !== e.id) })}>
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                    <Field label="Sets" htmlFor={`${e.id}-sets`}>
                      <Input id={`${e.id}-sets`} type="number" inputMode="numeric" value={e.sets} onChange={(ev) => setEx(i, { sets: num(ev.target.value) })} />
                    </Field>
                    <Field label="Rep min" htmlFor={`${e.id}-min`}>
                      <Input id={`${e.id}-min`} type="number" inputMode="numeric" value={e.repMin} onChange={(ev) => setEx(i, { repMin: num(ev.target.value) })} />
                    </Field>
                    <Field label="Rep max" htmlFor={`${e.id}-max`}>
                      <Input id={`${e.id}-max`} type="number" inputMode="numeric" value={e.repMax} onChange={(ev) => setEx(i, { repMax: num(ev.target.value) })} />
                    </Field>
                    <Field label="Rest (s)" htmlFor={`${e.id}-rest`}>
                      <Input id={`${e.id}-rest`} type="number" inputMode="numeric" value={e.restSec} onChange={(ev) => setEx(i, { restSec: num(ev.target.value) })} />
                    </Field>
                    <Field label={`Ref. weight (${state.profile.units})`} htmlFor={`${e.id}-wt`} hint="Optional starting weight">
                      <Input
                        id={`${e.id}-wt`}
                        type="number"
                        inputMode="decimal"
                        value={e.targetWeight ?? ""}
                        onChange={(ev) => setEx(i, { targetWeight: ev.target.value === "" ? null : Math.max(0, Number(ev.target.value)) })}
                      />
                    </Field>
                    <Field label="Type" htmlFor={`${e.id}-role`}>
                      <Select id={`${e.id}-role`} value={e.role} onChange={(ev) => setEx(i, { role: ev.target.value as PlannedExercise["role"] })}>
                        <option value="main">Main</option>
                        <option value="accessory">Accessory</option>
                        <option value="movement">Movement</option>
                        <option value="skill">Skill</option>
                      </Select>
                    </Field>
                    <Field label="Reps label" htmlFor={`${e.id}-label`} className="col-span-2">
                      <Input id={`${e.id}-label`} value={e.repsLabel} onChange={(ev) => setEx(i, { repsLabel: ev.target.value })} placeholder="e.g. 6–10, 5 per side" />
                    </Field>
                    <Field label="Notes" htmlFor={`${e.id}-notes`} className="col-span-2 sm:col-span-3">
                      <Input id={`${e.id}-notes`} value={e.notes} onChange={(ev) => setEx(i, { notes: ev.target.value })} />
                    </Field>
                    <label className="col-span-2 flex items-center gap-2 self-end pb-3 text-sm sm:col-span-1">
                      <input type="checkbox" checked={!!e.optional} onChange={(ev) => setEx(i, { optional: ev.target.checked })} className="h-5 w-5 accent-[var(--accent)]" />
                      Optional
                    </label>
                  </div>
                </li>
              ))}
            </ul>
            <Button variant="outline" className="mt-3" onClick={() => setPicker(true)}>
              <Plus size={16} /> Add exercise
            </Button>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">Conditioning options</h3>
            {draft.conditioning.length === 0 && <p className="mb-2 text-sm text-subtle">No conditioning finisher on this day.</p>}
            <ul className="space-y-3">
              {draft.conditioning.map((c) => (
                <li key={c.id} className="grid grid-cols-2 gap-2 rounded-xl border border-line p-3 sm:grid-cols-6">
                  <Field label="Label" htmlFor={`${c.id}-l`} className="col-span-2">
                    <Input id={`${c.id}-l`} value={c.label} onChange={(e) => set({ conditioning: draft.conditioning.map((x) => (x.id === c.id ? { ...x, label: e.target.value } : x)) })} />
                  </Field>
                  <Field label="Modality" htmlFor={`${c.id}-m`}>
                    <Select
                      id={`${c.id}-m`}
                      value={c.modality}
                      onChange={(e) => set({ conditioning: draft.conditioning.map((x) => (x.id === c.id ? { ...x, modality: e.target.value as ConditioningModality } : x)) })}
                    >
                      {(Object.keys(MODALITY_LABELS) as ConditioningModality[]).map((m) => (
                        <option key={m} value={m}>
                          {MODALITY_LABELS[m]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {(["rounds", "workSec", "recoverySec"] as const).map((k) => (
                    <Field key={k} label={k === "rounds" ? "Rounds" : k === "workSec" ? "Work (s)" : "Easy (s)"} htmlFor={`${c.id}-${k}`}>
                      <Input
                        id={`${c.id}-${k}`}
                        type="number"
                        inputMode="numeric"
                        value={c[k]}
                        onChange={(e) => set({ conditioning: draft.conditioning.map((x) => (x.id === c.id ? { ...x, [k]: num(e.target.value) } : x)) })}
                      />
                    </Field>
                  ))}
                  <div className="col-span-2 flex justify-end sm:col-span-6">
                    <Button variant="ghost" size="sm" onClick={() => set({ conditioning: draft.conditioning.filter((x) => x.id !== c.id) })}>
                      <Trash2 size={14} /> Remove option
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => set({ conditioning: [...draft.conditioning, { id: uid("co"), label: "Bike intervals", modality: "bike", rounds: 8, workSec: 30, recoverySec: 60, note: "" }] })}
            >
              <Plus size={14} /> Add conditioning option
            </Button>
          </section>

          <Field label="Coaching notes (one per line)" htmlFor="we-guidance">
            <Textarea
              id="we-guidance"
              value={draft.guidance.join("\n")}
              onChange={(e) => set({ guidance: e.target.value.split("\n") })}
              onBlur={() => set({ guidance: draft.guidance.map((g) => g.trim()).filter(Boolean) })}
            />
          </Field>
        </div>
      </Modal>

      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        title="Add exercise to plan"
        onPick={(id) =>
          set({
            exercises: [...draft.exercises, { id: uid("pe"), exerciseId: id, sets: 3, repMin: 8, repMax: 12, repsLabel: "8–12", restSec: 90, role: "accessory", notes: "" }],
          })
        }
      />
      <ConfirmDialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        title="Discard unsaved changes?"
        message="Your edits to this workout haven't been saved."
        confirmLabel="Discard changes"
        danger
        onConfirm={onClose}
      />
    </>
  );
}

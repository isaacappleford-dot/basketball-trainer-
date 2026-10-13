"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Intensity, LoggedSet, SessionExercise, SessionLocation, WorkoutSession } from "@/lib/types";
import { emptySet, updateCompletedSession } from "@/lib/actions";
import { todayISO } from "@/lib/utils";
import { INTENSITY_OPTIONS, LOCATION_LABELS } from "./labels";
import { Alert, Button, ConfirmDialog, Field, IconButton, Input, Modal, Segmented, Select, Textarea, useToast } from "./ui";

type NumKey = "weight" | "reps" | "makes" | "attempts" | "durationSec" | "distance" | "effort";

function fieldsFor(t: SessionExercise["trackingType"]): { key: NumKey; label: string }[] {
  const effort = { key: "effort" as const, label: "Effort" };
  switch (t) {
    case "weighted":
      return [{ key: "weight", label: "Weight" }, { key: "reps", label: "Reps" }, effort];
    case "shooting":
      return [{ key: "makes", label: "Makes" }, { key: "attempts", label: "Att." }];
    case "timed":
      return [{ key: "durationSec", label: "Sec" }, effort];
    case "distance":
      return [{ key: "reps", label: "Reps" }, { key: "distance", label: "Dist." }];
    default:
      return [{ key: "reps", label: "Reps" }, effort];
  }
}

/** Edit a saved workout: sets, date, duration, intensity, location and notes. */
export function SessionEditor({ session, onClose }: { session: WorkoutSession; onClose: () => void }) {
  const toast = useToast();
  const [s, setS] = useState<WorkoutSession>(() => structuredClone(session));
  const [minutes, setMinutes] = useState(String(Math.round(session.durationSec / 60)));
  const [errors, setErrors] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const up = (patch: Partial<WorkoutSession>) => {
    setDirty(true);
    setS((x) => ({ ...x, ...patch }));
  };
  const setSet = (exId: string, setId: string, patch: Partial<LoggedSet>) =>
    up({ exercises: s.exercises.map((e) => (e.id === exId ? { ...e, sets: e.sets.map((x) => (x.id === setId ? { ...x, ...patch } : x)) } : e)) });

  const save = () => {
    const errs: string[] = [];
    const m = Number(minutes);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date) || s.date > todayISO()) errs.push("Choose a valid date (not in the future).");
    if (!Number.isFinite(m) || m <= 0 || m > 600) errs.push("Duration must be 1–600 minutes.");
    s.exercises.forEach((e) =>
      e.sets.forEach((x, i) => {
        if ([x.weight, x.reps, x.makes, x.attempts, x.durationSec, x.distance].some((v) => v !== null && v < 0)) errs.push(`${e.name} set ${i + 1}: values can't be negative.`);
        if (x.makes !== null && x.attempts !== null && x.makes > x.attempts) errs.push(`${e.name} set ${i + 1}: makes can't exceed attempts.`);
        if (x.effort !== null && (x.effort < 1 || x.effort > 10)) errs.push(`${e.name} set ${i + 1}: effort must be 1–10.`);
      }),
    );
    setErrors(errs);
    if (errs.length) return;
    const exercises = s.exercises.map((e) => ({
      ...e,
      status: (e.status === "skipped" && !e.sets.length ? "skipped" : e.sets.length ? "done" : "pending") as SessionExercise["status"],
    }));
    updateCompletedSession({
      ...s,
      exercises,
      durationSec: Math.round(m * 60),
      notes: s.notes.trim(),
      completion: exercises.every((e) => e.status !== "pending") ? "complete" : "partial",
    });
    toast("Session updated. Charts and records recalculated.");
    onClose();
  };

  return (
    <>
      <Modal
        open
        size="lg"
        title={`Edit ${session.workoutName}`}
        onClose={() => (dirty ? setConfirmClose(true) : onClose())}
        footer={
          <>
            <Button variant="secondary" onClick={() => (dirty ? setConfirmClose(true) : onClose())}>
              Cancel
            </Button>
            <Button onClick={save}>Save changes</Button>
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
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Date" htmlFor="se-date">
              <Input id="se-date" type="date" max={todayISO()} value={s.date} onChange={(e) => up({ date: e.target.value })} />
            </Field>
            <Field label="Duration (min)" htmlFor="se-min">
              <Input
                id="se-min"
                type="number"
                inputMode="numeric"
                value={minutes}
                onChange={(e) => {
                  setDirty(true);
                  setMinutes(e.target.value);
                }}
              />
            </Field>
            <Field label="Location" htmlFor="se-loc">
              <Select id="se-loc" value={s.location} onChange={(e) => up({ location: e.target.value as SessionLocation })}>
                {(Object.keys(LOCATION_LABELS) as SessionLocation[]).map((l) => (
                  <option key={l} value={l}>
                    {LOCATION_LABELS[l]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">Intensity</p>
            <Segmented label="Session intensity" value={s.intensity} onChange={(v: Intensity) => up({ intensity: v })} options={INTENSITY_OPTIONS} />
          </div>

          <ul className="space-y-3">
            {s.exercises.map((e) => {
              const fields = fieldsFor(e.trackingType);
              return (
                <li key={e.id} className="rounded-xl border border-line p-3">
                  <p className="mb-2 font-semibold">{e.name}</p>
                  {e.sets.length === 0 && <p className="text-sm text-subtle">No sets.</p>}
                  <ol className="space-y-2">
                    {e.sets.map((x, i) => (
                      <li key={x.id} className="flex items-end gap-2">
                        <span className="w-6 pb-3 text-xs text-subtle">{i + 1}</span>
                        <div className="grid flex-1 grid-cols-3 gap-2">
                          {fields.map((f) => (
                            <label key={f.key} className="text-[11px] text-muted">
                              {f.key === "weight" ? `${f.label} (${x.unit})` : f.label}
                              <input
                                type="number"
                                inputMode="decimal"
                                aria-label={`${e.name} set ${i + 1} ${f.label}`}
                                value={x[f.key] ?? ""}
                                onChange={(ev) => setSet(e.id, x.id, { [f.key]: ev.target.value === "" ? null : Number(ev.target.value) })}
                                className="mt-0.5 h-10 w-full rounded-lg border border-line-strong bg-surface-2 px-2 text-sm text-text"
                              />
                            </label>
                          ))}
                        </div>
                        <IconButton
                          label={`Delete ${e.name} set ${i + 1}`}
                          onClick={() => up({ exercises: s.exercises.map((y) => (y.id === e.id ? { ...y, sets: y.sets.filter((z) => z.id !== x.id) } : y)) })}
                        >
                          <Trash2 size={15} />
                        </IconButton>
                      </li>
                    ))}
                  </ol>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      const last = e.sets[e.sets.length - 1];
                      const copy = last ? { ...last, id: undefined } : {};
                      delete (copy as Partial<LoggedSet>).id;
                      up({
                        exercises: s.exercises.map((y) =>
                          y.id === e.id ? { ...y, sets: [...y.sets, emptySet(s.unit, { ...(copy as Partial<LoggedSet>), completed: true, loggedAt: new Date().toISOString() })] } : y,
                        ),
                      });
                    }}
                  >
                    <Plus size={14} /> Add set
                  </Button>
                </li>
              );
            })}
          </ul>

          <Field label="Notes" htmlFor="se-notes">
            <Textarea id="se-notes" value={s.notes} onChange={(e) => up({ notes: e.target.value })} />
          </Field>
        </div>
      </Modal>
      <ConfirmDialog open={confirmClose} onClose={() => setConfirmClose(false)} danger title="Discard changes?" message="Your edits haven't been saved." confirmLabel="Discard" onConfirm={onClose} />
    </>
  );
}

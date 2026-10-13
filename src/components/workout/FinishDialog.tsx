"use client";

import { useState } from "react";
import type { ModificationReason, WorkoutSession } from "@/lib/types";
import { finishWorkout } from "@/lib/actions";
import { formatDuration } from "@/lib/utils";
import { Alert, Button, Checkbox, Field, Modal, NumberStepper, Select, Textarea, useToast } from "../ui";

export const MOD_REASONS: { value: ModificationReason; label: string }[] = [
  { value: "fatigue", label: "Fatigue" },
  { value: "pain", label: "Pain or discomfort" },
  { value: "professional-guidance", label: "Professional guidance" },
  { value: "other", label: "Other" },
];

export function FinishDialog({
  open,
  onClose,
  session,
  elapsedSec,
  onFinished,
}: {
  open: boolean;
  onClose: () => void;
  session: WorkoutSession;
  elapsedSec: number;
  onFinished: (id: string) => void;
}) {
  return open ? <FinishDialogInner onClose={onClose} session={session} elapsedSec={elapsedSec} onFinished={onFinished} /> : null;
}

function FinishDialogInner({ onClose, session, elapsedSec, onFinished }: { onClose: () => void; session: WorkoutSession; elapsedSec: number; onFinished: (id: string) => void }) {
  const toast = useToast();
  const [notes, setNotes] = useState(session.notes);
  const [minutes, setMinutes] = useState<number | null>(Math.max(1, Math.round(elapsedSec / 60)));
  const [modified, setModified] = useState(!!session.modified);
  const [reason, setReason] = useState<ModificationReason>(session.modified?.reason ?? "fatigue");
  const [modNote, setModNote] = useState(session.modified?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  const done = session.exercises.filter((e) => e.status !== "skipped" && e.sets.some((s) => s.completed));
  const skipped = session.exercises.filter((e) => e.status === "skipped");
  const notStarted = session.exercises.filter((e) => e.status !== "skipped" && !e.sets.some((s) => s.completed));
  const totalSets = session.exercises.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0);
  const cond = session.conditioning;

  const save = () => {
    if (minutes === null || minutes <= 0 || minutes > 600) {
      setError("Enter a session duration between 1 and 600 minutes.");
      return;
    }
    const saved = finishWorkout({
      durationSec: Math.round(minutes * 60),
      notes: notes.trim(),
      modified: modified ? { reason, note: modNote.trim() } : null,
    });
    if (saved) {
      toast("Workout saved to your history.");
      onFinished(saved.id);
    } else {
      toast("Could not save — no active workout found.", "bad");
    }
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Finish workout"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep training
          </Button>
          <Button onClick={save}>Save workout</Button>
        </>
      }
    >
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-surface-2 p-3">
          <dt className="text-[11px] uppercase tracking-wider text-subtle">Exercises</dt>
          <dd className="font-display text-2xl font-bold tabular">
            {done.length}
            <span className="text-sm text-subtle">/{session.exercises.length}</span>
          </dd>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <dt className="text-[11px] uppercase tracking-wider text-subtle">Sets</dt>
          <dd className="font-display text-2xl font-bold tabular">{totalSets}</dd>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <dt className="text-[11px] uppercase tracking-wider text-subtle">Duration</dt>
          <dd className="font-display text-2xl font-bold tabular">{formatDuration(elapsedSec)}</dd>
        </div>
      </dl>

      <div className="mt-4 space-y-2 text-sm">
        {skipped.length > 0 && <p className="text-muted">Skipped: {skipped.map((e) => e.name).join(", ")}</p>}
        {notStarted.length > 0 && <p className="text-muted">Not logged: {notStarted.map((e) => e.name).join(", ")}</p>}
        {cond && (
          <p className="text-muted">
            Conditioning: {cond.enabled ? `${cond.completedRounds}/${cond.plannedRounds} rounds` : `skipped${cond.skippedReason ? ` (${cond.skippedReason.toLowerCase()})` : ""}`}
          </p>
        )}
      </div>

      {totalSets === 0 && (
        <div className="mt-4">
          <Alert tone="warn" title="No completed sets">
            Tick the check button on each set you finish. You can still save this session (for example, if you only did conditioning).
          </Alert>
        </div>
      )}

      <div className="mt-5 space-y-4">
        <Field label="Session duration (minutes)" htmlFor="fin-min" error={error} hint="Adjust if you left the session open after training.">
          <NumberStepper id="fin-min" label="Session duration in minutes" value={minutes} onChange={setMinutes} min={0} max={600} step={5} suffix="min" />
        </Field>
        <Field label="Session notes" htmlFor="fin-notes">
          <Textarea id="fin-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How did it go? Anything to remember next time?" />
        </Field>
        <div className="rounded-xl border border-line p-2">
          <Checkbox
            checked={modified}
            onChange={setModified}
            label="Mark this workout as modified"
            description="Record that you adjusted the session because of fatigue, pain or professional guidance."
          />
          {modified && (
            <div className="grid gap-3 px-2 pb-2 pt-1 sm:grid-cols-2">
              <Field label="Reason" htmlFor="fin-reason">
                <Select id="fin-reason" value={reason} onChange={(e) => setReason(e.target.value as ModificationReason)}>
                  {MOD_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Details (optional)" htmlFor="fin-modnote">
                <Textarea id="fin-modnote" value={modNote} onChange={(e) => setModNote(e.target.value)} className="min-h-[44px]" />
              </Field>
              {reason === "pain" && (
                <p className="text-xs text-warn sm:col-span-2">If pain persists or affects how you move, check in with a qualified professional before training it again.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

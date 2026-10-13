"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Circle,
  HeartPulse,
  History,
  Info,
  ListChecks,
  Pause,
  Play,
  Plus,
  SkipForward,
  Trash2,
  Undo2,
} from "lucide-react";
import type { ConditioningDraft, LoggedSet, SessionExercise, WorkoutSession } from "@/lib/types";
import { useAppState } from "@/lib/store";
import { buildSessionExercise, discardActive, emptySet, pauseActive, resumeActive, toggleActiveSet, updateActive } from "@/lib/actions";
import { previousPerformance } from "@/lib/metrics";
import { useNow } from "@/lib/hooks";
import { cn, elapsedSec, formatDate, formatDuration, formatWeight } from "@/lib/utils";
import { Badge, Button, Card, Checkbox, ConfirmDialog, ProgressBar, Textarea } from "../ui";
import { ExercisePicker } from "../ExercisePicker";
import { RestTimer } from "./RestTimer";
import { SetRow } from "./SetRow";
import { ConditioningBlock } from "./ConditioningBlock";
import { FinishDialog } from "./FinishDialog";

function describeSet(s: LoggedSet, t: SessionExercise["trackingType"]): string {
  const side = s.side === "left" ? " L" : s.side === "right" ? " R" : "";
  switch (t) {
    case "weighted":
      return `${s.weight !== null ? formatWeight(s.weight, s.unit).replace(" ", "") : "BW"}×${s.reps ?? "—"}`;
    case "shooting":
      return `${s.makes ?? 0}/${s.attempts ?? 0}${side}`;
    case "timed":
      return `${s.durationSec ?? 0}s`;
    case "distance":
      return `${s.reps ?? 0}×${s.distance ?? "—"}${s.distanceUnit}`;
    default:
      return `${s.reps ?? 0}${side}`;
  }
}

function restLabel(sec: number) {
  if (!sec) return "as needed";
  return sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")} min` : `${sec} s`;
}

export function ActiveWorkout({ session, onFinished }: { session: WorkoutSession; onFinished: (id: string) => void }) {
  const state = useAppState();
  const now = useNow(1000);
  const [picker, setPicker] = useState<null | "add" | "substitute">(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [warmupOpen, setWarmupOpen] = useState(session.warmupDone.length < session.warmupItems.length && session.exercises.every((e) => e.sets.every((s) => !s.completed)));

  const hasConditioning = !!session.conditioning;
  const totalSteps = session.exercises.length + (hasConditioning ? 1 : 0);
  const idx = Math.min(session.currentIndex, Math.max(0, totalSteps - 1));
  const onConditioning = hasConditioning && idx === session.exercises.length;
  const ex = onConditioning ? null : session.exercises[idx] ?? null;
  const libEx = ex ? state.exercises.find((e) => e.id === ex.exerciseId) : null;
  const planned = state.plan.workouts.find((w) => w.id === session.plannedWorkoutId);

  const prev = useMemo(() => (ex ? previousPerformance(state, ex.exerciseId) : null), [state, ex]);
  const elapsed = elapsedSec(session.startedAt, session.pausedAt, session.pausedSec, now);
  const paused = session.pausedAt !== null;

  const doneCount = session.exercises.filter((e) => e.status !== "pending").length + (hasConditioning && (session.conditioning!.completedRounds > 0 || !session.conditioning!.enabled) ? 1 : 0);
  const completedSets = session.exercises.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0);

  const patchExercise = (exId: string, fn: (e: SessionExercise) => SessionExercise) =>
    updateActive((w) => ({ ...w, exercises: w.exercises.map((e) => (e.id === exId ? fn(e) : e)) }));

  const goTo = (i: number) => {
    updateActive((w) => {
      const next = w.exercises[i];
      return { ...w, currentIndex: i, restTimer: next && w.restTimer.endsAt === null ? { ...w.restTimer, durationSec: next.restSec || w.restTimer.durationSec, remainingSec: null } : w.restTimer };
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleSet = (setId: string) => {
    if (ex) toggleActiveSet(ex.id, setId);
  };

  const addSet = () => {
    if (!ex) return;
    const last = ex.sets[ex.sets.length - 1];
    const copy: Partial<LoggedSet> = last
      ? { weight: last.weight, reps: last.reps, durationSec: last.durationSec, distance: last.distance, attempts: last.attempts, side: last.side, distanceUnit: last.distanceUnit }
      : { weight: ex.targetWeight, reps: ex.repMin };
    patchExercise(ex.id, (e) => ({ ...e, sets: [...e.sets, emptySet(session.unit, copy)], status: e.status === "done" ? "pending" : e.status }));
  };

  const substitute = (newId: string) => {
    if (!ex) return;
    const original = ex.substitutedFrom ?? { exerciseId: ex.exerciseId, name: ex.name };
    const replacement = buildSessionExercise(
      state,
      newId,
      { sets: ex.targetSets, repMin: ex.repMin, repMax: ex.repMax, repsLabel: ex.targetReps, restSec: ex.restSec },
      { unit: session.unit, substitutedFrom: newId === original.exerciseId ? null : original },
    );
    updateActive((w) => ({ ...w, exercises: w.exercises.map((e) => (e.id === ex.id ? { ...replacement, id: e.id, notes: e.notes } : e)) }));
  };

  const addExtra = (newId: string) => {
    const lib = state.exercises.find((e) => e.id === newId);
    const sx = buildSessionExercise(state, newId, { sets: 3, repMin: 8, repMax: 12, repsLabel: lib?.setsReps ?? "3 sets", restSec: 90 }, { unit: session.unit, isExtra: true });
    updateActive((w) => {
      const exercises = [...w.exercises, sx];
      return { ...w, exercises, currentIndex: exercises.length - 1 };
    });
  };

  const onConditioningChange = useCallback(
    (patch: Partial<ConditioningDraft>) => updateActive((w) => (w.conditioning ? { ...w, conditioning: { ...w.conditioning, ...patch } } : w)),
    [],
  );

  const isLast = idx >= totalSteps - 1;

  return (
    <div className="pb-32">
      {/* Session header */}
      <div className="mb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              Week {session.planWeek} · {formatDate(session.date, { weekday: "short", month: "short", day: "numeric" })}
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold uppercase leading-tight sm:text-3xl">{session.workoutName}</h1>
          </div>
          <div className="shrink-0 text-right">
            <p className={cn("font-display text-2xl font-bold tabular", paused && "text-warn")} aria-label={`Session duration ${formatDuration(elapsed)}`}>
              {formatDuration(elapsed)}
            </p>
            <button
              type="button"
              onClick={() => (paused ? resumeActive() : pauseActive())}
              className={cn("mt-1 inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold", paused ? "bg-accent text-accent-ink" : "bg-surface-3 text-text")}
            >
              {paused ? <Play size={13} /> : <Pause size={13} />} {paused ? "Resume" : "Pause"}
            </button>
            <p className="mt-1 text-[11px] text-good">● Saved automatically</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <ProgressBar value={doneCount} max={totalSteps || 1} label="Workout progress" />
          <span className="shrink-0 text-xs text-muted tabular">
            {doneCount}/{totalSteps} · {completedSets} sets
          </span>
        </div>
        {paused && (
          <p className="mt-3 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn" role="status">
            Paused — the session clock is stopped. Your sets are saved; resume whenever you&apos;re ready.
          </p>
        )}
        {(session.reducedVolume || session.modified) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {session.reducedVolume && <Badge tone="warn">Reduced volume</Badge>}
            {session.modified && <Badge tone="warn">Modified · {session.modified.reason.replace("-", " ")}</Badge>}
          </div>
        )}
      </div>

      {/* Warm-up */}
      {session.warmupItems.length > 0 && (
        <Card className="mb-4 p-0 sm:p-0">
          <button onClick={() => setWarmupOpen((o) => !o)} aria-expanded={warmupOpen} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left sm:px-5">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <ListChecks size={18} className="text-accent" /> Warm-up
            </span>
            <span className="text-xs text-muted">
              {session.warmupDone.length}/{session.warmupItems.length} done
            </span>
          </button>
          {warmupOpen && (
            <div className="border-t border-line px-2 py-2 sm:px-3">
              {session.warmupItems.map((w) => (
                <Checkbox
                  key={w.id}
                  label={w.text}
                  checked={session.warmupDone.includes(w.id)}
                  onChange={(on) => updateActive((s) => ({ ...s, warmupDone: on ? [...s.warmupDone, w.id] : s.warmupDone.filter((x) => x !== w.id) }))}
                />
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Exercise navigator */}
      <nav aria-label="Exercises in this workout" className="scrollbar-none -mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ol className="flex gap-2">
          {session.exercises.map((e, i) => (
            <li key={e.id}>
              <button
                onClick={() => goTo(i)}
                aria-current={i === idx ? "step" : undefined}
                className={cn(
                  "flex h-11 max-w-[200px] items-center gap-2 rounded-xl border px-3 text-xs font-medium",
                  i === idx ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-muted hover:text-text",
                )}
              >
                {e.status === "done" ? <CircleCheck size={15} className="shrink-0 text-good" /> : e.status === "skipped" ? <SkipForward size={15} className="shrink-0" /> : <Circle size={15} className="shrink-0" />}
                <span className="truncate">{e.name}</span>
              </button>
            </li>
          ))}
          {hasConditioning && (
            <li>
              <button
                onClick={() => goTo(session.exercises.length)}
                aria-current={onConditioning ? "step" : undefined}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-xl border px-3 text-xs font-medium whitespace-nowrap",
                  onConditioning ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-muted hover:text-text",
                )}
              >
                <HeartPulse size={15} /> Conditioning
              </button>
            </li>
          )}
          <li>
            <button onClick={() => setPicker("add")} className="flex h-11 items-center gap-1.5 whitespace-nowrap rounded-xl border border-dashed border-line-strong px-3 text-xs font-medium text-muted hover:text-text">
              <Plus size={15} /> Add exercise
            </button>
          </li>
        </ol>
      </nav>

      {/* Current exercise */}
      {ex && (
        <Card className={cn("p-3", ex.status === "skipped" && "opacity-70")}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-subtle">
                Exercise {idx + 1} of {session.exercises.length}
                {libEx ? ` · ${libEx.category}` : ""}
              </p>
              <h2 className="mt-0.5 text-xl font-bold sm:text-2xl">{ex.name}</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ex.substitutedFrom && <Badge tone="accent">Substituted for {ex.substitutedFrom.name}</Badge>}
                {ex.isExtra && <Badge>Extra exercise</Badge>}
                {ex.status === "skipped" && <Badge tone="warn">Skipped</Badge>}
                {ex.status === "done" && <Badge tone="good">Complete</Badge>}
              </div>
            </div>
            <button onClick={() => setShowInfo((s) => !s)} aria-expanded={showInfo} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2" aria-label="Exercise instructions">
              <Info size={20} />
            </button>
          </div>

          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-surface-2 p-2.5">
              <dt className="text-[11px] uppercase tracking-wider text-subtle">Target</dt>
              <dd className="mt-0.5 text-sm font-semibold">
                {ex.targetSets} × {ex.targetReps}
              </dd>
            </div>
            <div className="rounded-xl bg-surface-2 p-2.5">
              <dt className="text-[11px] uppercase tracking-wider text-subtle">Rest</dt>
              <dd className="mt-0.5 text-sm font-semibold">{restLabel(ex.restSec)}</dd>
            </div>
            <div className="rounded-xl bg-surface-2 p-2.5">
              <dt className="text-[11px] uppercase tracking-wider text-subtle">{ex.trackingType === "weighted" ? "Load" : "Type"}</dt>
              <dd className="mt-0.5 truncate text-sm font-semibold">
                {ex.trackingType === "weighted" ? (ex.targetWeight !== null ? formatWeight(ex.targetWeight, session.unit) : "Choose") : ex.trackingType === "shooting" ? "Makes/att" : ex.trackingType === "timed" ? "Timed" : "Reps"}
              </dd>
            </div>
          </dl>

          {showInfo && libEx && (
            <div className="mt-4 rounded-xl border border-line bg-surface-2 p-4 text-sm">
              <ol className="list-decimal space-y-1 pl-5 text-muted">
                {libEx.instructions.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ol>
              {libEx.safety && <p className="mt-2 text-xs text-warn">Safety: {libEx.safety}</p>}
              {libEx.notes && <p className="mt-1 text-xs text-subtle">{libEx.notes}</p>}
            </div>
          )}

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-line px-3 py-2.5 text-sm">
            <History size={16} className="mt-0.5 shrink-0 text-subtle" />
            {prev ? (
              <p className="min-w-0 text-muted">
                <span className="text-text">Last time</span> ({formatDate(prev.session.date)}): {prev.sets.map((s) => describeSet(s, ex.trackingType)).join(", ")}
              </p>
            ) : (
              <p className="text-muted">No previous log — today sets your baseline.</p>
            )}
          </div>

          {ex.status !== "skipped" && (
            <>
              <ol className="mt-4 space-y-2.5">
                {ex.sets.map((s, i) => (
                  <SetRow
                    key={s.id}
                    index={i}
                    set={s}
                    exercise={ex}
                    onChange={(patch) => patchExercise(ex.id, (e) => ({ ...e, sets: e.sets.map((x) => (x.id === s.id ? { ...x, ...patch } : x)) }))}
                    onToggle={() => toggleSet(s.id)}
                    onDelete={() =>
                      patchExercise(ex.id, (e) => {
                        const sets = e.sets.filter((x) => x.id !== s.id);
                        return { ...e, sets, status: sets.length && sets.every((x) => x.completed) ? "done" : e.status === "done" ? "pending" : e.status };
                      })
                    }
                  />
                ))}
              </ol>
              {ex.sets.length === 0 && <p className="mt-4 text-center text-sm text-muted">No sets yet.</p>}
              <Button variant="outline" size="lg" className="mt-3 w-full" onClick={addSet}>
                <Plus size={18} /> Add set
              </Button>
            </>
          )}

          <div className="mt-4">
            <label htmlFor={`notes-${ex.id}`} className="text-sm font-medium">
              Exercise notes
            </label>
            <Textarea
              id={`notes-${ex.id}`}
              value={ex.notes}
              onChange={(e) => patchExercise(ex.id, (x) => ({ ...x, notes: e.target.value }))}
              placeholder="Technique cues, how it felt, equipment settings…"
              className="mt-1.5 min-h-[64px]"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {ex.status === "skipped" ? (
              <Button variant="secondary" onClick={() => patchExercise(ex.id, (e) => ({ ...e, status: "pending" }))}>
                <Undo2 size={16} /> Unskip
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => {
                  patchExercise(ex.id, (e) => ({ ...e, status: "skipped", sets: e.sets.filter((s) => s.completed) }));
                  if (!isLast) goTo(idx + 1);
                }}
              >
                <SkipForward size={16} /> Skip
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => setPicker("substitute")}
              disabled={ex.sets.some((s) => s.completed)}
              title={ex.sets.some((s) => s.completed) ? "Sets already logged — add an extra exercise instead" : undefined}
            >
              <ArrowLeftRight size={16} /> Substitute
            </Button>
            {ex.isExtra && (
              <Button
                variant="danger"
                onClick={() => updateActive((w) => ({ ...w, exercises: w.exercises.filter((e) => e.id !== ex.id), currentIndex: Math.max(0, idx - 1) }))}
              >
                <Trash2 size={16} /> Remove
              </Button>
            )}
          </div>
        </Card>
      )}

      {onConditioning && session.conditioning && (
        <Card>
          <h2 className="mb-1 flex items-center gap-2 text-xl font-bold">
            <HeartPulse size={20} className="text-accent" /> Conditioning
          </h2>
          <p className="mb-5 text-sm text-muted">{planned?.guidance.find((g) => /round/i.test(g)) ?? "Controlled intervals — moderately hard, not all-out."}</p>
          <ConditioningBlock draft={session.conditioning} options={planned?.conditioning ?? []} onChange={onConditioningChange} now={now} />
        </Card>
      )}

      {!ex && !onConditioning && (
        <Card>
          <p className="text-sm text-muted">This workout has no exercises yet.</p>
          <Button className="mt-3" onClick={() => setPicker("add")}>
            <Plus size={16} /> Add exercise
          </Button>
        </Card>
      )}

      {/* Step navigation */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button variant="secondary" size="xl" onClick={() => goTo(idx - 1)} disabled={idx === 0}>
          <ChevronLeft size={20} /> Previous
        </Button>
        {isLast ? (
          <Button size="xl" onClick={() => setFinishOpen(true)}>
            <Check size={20} /> Finish
          </Button>
        ) : (
          <Button size="xl" onClick={() => goTo(idx + 1)}>
            Next <ChevronRight size={20} />
          </Button>
        )}
      </div>

      <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-line pt-5">
        <Button variant="ghost" onClick={() => setConfirmDiscard(true)} className="text-bad hover:text-bad">
          <Trash2 size={16} /> Discard workout
        </Button>
        <Button variant="outline" onClick={() => setFinishOpen(true)}>
          <Check size={16} /> Finish workout
        </Button>
      </div>

      {/* Sticky rest timer */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 px-3 pb-2 lg:bottom-0 lg:left-64 lg:pb-4">
        <div className="mx-auto max-w-3xl">
          <RestTimer
            timer={session.restTimer}
            now={now}
            recommendation={ex ? restLabel(ex.restSec) : "as needed"}
            onChange={(t) => updateActive((w) => ({ ...w, restTimer: t }))}
          />
        </div>
      </div>

      <ExercisePicker
        open={picker !== null}
        onClose={() => setPicker(null)}
        title={picker === "substitute" ? `Substitute ${ex?.name ?? ""}` : "Add an exercise"}
        suggestedIds={picker === "substitute" && libEx ? libEx.substitutions : []}
        excludeIds={picker === "substitute" && ex ? [ex.exerciseId] : []}
        onPick={(id) => (picker === "substitute" ? substitute(id) : addExtra(id))}
      />

      <ConfirmDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        danger
        title="Discard this workout?"
        confirmLabel="Discard workout"
        message={
          completedSets > 0
            ? `You have ${completedSets} completed set${completedSets === 1 ? "" : "s"} in this session. Discarding permanently deletes them — this can't be undone.`
            : "Nothing has been logged yet. The session will be closed without saving."
        }
        onConfirm={() => discardActive()}
      />

      <FinishDialog open={finishOpen} onClose={() => setFinishOpen(false)} session={session} elapsedSec={elapsed} onFinished={onFinished} />
    </div>
  );
}

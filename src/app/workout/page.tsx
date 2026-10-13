"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, CheckCircle2, Dumbbell, HeartPulse, Play, Plus, Sparkles, TrendingUp } from "lucide-react";
import type { ModificationReason, PlannedWorkout } from "@/lib/types";
import { useAppState } from "@/lib/store";
import { startWorkout } from "@/lib/actions";
import { latestRecovery, recoveryAdvice } from "@/lib/metrics";
import { matchOccurrence, nextOccurrence, occurrencesOn, weekInfo } from "@/lib/schedule";
import { daysBetween, formatDate, formatLongDate, todayISO, WEEKDAYS } from "@/lib/utils";
import { ActiveWorkout } from "@/components/workout/ActiveWorkout";
import { MOD_REASONS } from "@/components/workout/FinishDialog";
import { SessionDetail } from "@/components/SessionDetail";
import { RecoveryAdvice } from "@/components/RecoveryAdvice";
import { Badge, Button, Card, Checkbox, Field, Input, LinkButton, LoadingScreen, Modal, PageHeader, Select, Textarea } from "@/components/ui";

export default function WorkoutPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <WorkoutScreen />
    </Suspense>
  );
}

function WorkoutScreen() {
  const state = useAppState();
  const [finishedId, setFinishedId] = useState<string | null>(null);
  const active = state.activeWorkout;

  if (active) return <ActiveWorkout session={active} onFinished={setFinishedId} />;
  if (finishedId) {
    const s = state.workoutSessions.find((w) => w.id === finishedId);
    if (s) return <Completed sessionId={s.id} onDone={() => setFinishedId(null)} />;
  }
  return <StartScreen />;
}

function Completed({ sessionId, onDone }: { sessionId: string; onDone: () => void }) {
  const state = useAppState();
  const s = state.workoutSessions.find((w) => w.id === sessionId)!;
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-good-soft text-good">
          <CheckCircle2 size={26} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-good">Workout saved</p>
          <h1 className="font-display text-2xl font-bold uppercase sm:text-3xl">{s.workoutName}</h1>
        </div>
      </div>
      <Card>
        <SessionDetail session={s} />
      </Card>
      <div className="mt-5 flex flex-wrap gap-2">
        <LinkButton href="/" size="lg">
          Back to dashboard
        </LinkButton>
        <LinkButton href="/progress" variant="secondary" size="lg">
          <TrendingUp size={18} /> View progress
        </LinkButton>
        <Button variant="ghost" size="lg" onClick={onDone}>
          Start another
        </Button>
      </div>
    </div>
  );
}

interface Pending {
  workout: PlannedWorkout | null;
  date: string;
  scheduledDate: string | null | undefined;
}

function StartScreen() {
  const state = useAppState();
  const params = useSearchParams();
  const router = useRouter();
  const today = todayISO();
  const info = weekInfo(state);
  const todays = occurrencesOn(state, today);
  const next = todays.find((o) => o.status === "planned") ? null : nextOccurrence(state, today);
  const recovery = latestRecovery(state);
  const advice = recovery && daysBetween(recovery.date, today) <= 1 ? recoveryAdvice(recovery) : null;

  const [pending, setPending] = useState<Pending | null>(() => {
    const planId = params.get("plan");
    if (!planId) return null;
    const w = state.plan.workouts.find((x) => x.id === planId) ?? null;
    if (!w) return null;
    const date = params.get("date") ?? today;
    return { workout: w, date: date > today ? today : date, scheduledDate: params.get("scheduled") ?? undefined };
  });

  const workouts = [...state.plan.workouts].sort((a, b) => a.dayNumber - b.dayNumber);

  return (
    <div>
      <PageHeader
        eyebrow={info.status === "active" ? `Week ${info.planWeek} of ${info.totalWeeks}${info.phase ? ` · ${info.phase.title}` : ""}` : undefined}
        title="Start Workout"
        subtitle={formatLongDate(today)}
      />

      <div className="mb-6">
        <RecoveryAdvice entry={recovery} showStale={false} />
      </div>

      {todays.length > 0 ? (
        <div className="mb-8 space-y-3">
          {todays.map((o) => (
            <Card key={o.key} className="border-accent/40">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Planned today{o.moved ? " · moved" : ""}</p>
                  <h2 className="mt-1 font-display text-2xl font-bold uppercase">
                    Day {o.workout.dayNumber} — {o.workout.name}
                  </h2>
                  <p className="mt-1 text-sm text-muted">{o.workout.focus}</p>
                </div>
                {o.session ? (
                  <Badge tone="good">
                    <CheckCircle2 size={14} /> Completed
                  </Badge>
                ) : (
                  <Button size="xl" onClick={() => setPending({ workout: o.workout, date: today, scheduledDate: o.originalDate })}>
                    <Play size={20} /> Start workout
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-subtle">Today</p>
          <h2 className="mt-1 text-lg font-semibold">
            {info.status === "not-started"
              ? `Your plan starts ${formatDate(state.profile.planStartDate, { weekday: "long", month: "short", day: "numeric" })}`
              : info.status === "finished"
                ? "You've completed the 8-week plan window"
                : state.plan.restDays.find((r) => r.weekday === new Date().getDay())?.label ?? "No workout planned today"}
          </h2>
          {next && (
            <p className="mt-1 text-sm text-muted">
              Next up: Day {next.workout.dayNumber} — {next.workout.name} on {formatDate(next.date, { weekday: "long", month: "short", day: "numeric" })}
            </p>
          )}
          <p className="mt-2 text-sm text-muted">You can still start any session below — it will count toward the matching workout this week.</p>
        </Card>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">All workouts</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {workouts.map((w) => {
          const occ = matchOccurrence(state, w.id, today);
          return (
            <li key={w.id}>
              <Card className="flex h-full flex-col">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft font-display text-xl font-bold text-accent">{w.dayNumber}</span>
                  <div className="min-w-0">
                    <p className="text-xs text-subtle">{WEEKDAYS[w.weekday]}</p>
                    <h3 className="font-semibold leading-snug">{w.name}</h3>
                    <p className="mt-1 text-xs text-muted">
                      {w.exercises.length} exercises{w.conditioning.length ? " + conditioning" : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-1 items-end gap-2">
                  <Button className="flex-1" size="lg" onClick={() => setPending({ workout: w, date: today, scheduledDate: occ?.originalDate ?? null })}>
                    <Play size={18} /> Start
                  </Button>
                  <LinkButton href="/plan" variant="ghost" size="lg">
                    View
                  </LinkButton>
                </div>
              </Card>
            </li>
          );
        })}
        <li>
          <Card className="flex h-full flex-col justify-between border-dashed">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-3 text-muted">
                <Plus size={20} />
              </span>
              <div>
                <h3 className="font-semibold">Custom workout</h3>
                <p className="mt-1 text-xs text-muted">Start empty and add exercises from the library.</p>
              </div>
            </div>
            <Button variant="secondary" size="lg" className="mt-4" onClick={() => setPending({ workout: null, date: today, scheduledDate: null })}>
              <Dumbbell size={18} /> Start custom
            </Button>
          </Card>
        </li>
      </ul>

      <div className="mt-8 flex flex-wrap gap-2 text-sm">
        <Link href="/conditioning" className="inline-flex items-center gap-1.5 text-muted hover:text-text">
          <HeartPulse size={16} /> Log standalone conditioning
        </Link>
        <span className="text-subtle">·</span>
        <Link href="/skills" className="inline-flex items-center gap-1.5 text-muted hover:text-text">
          <Sparkles size={16} /> Log a skills session
        </Link>
        <span className="text-subtle">·</span>
        <Link href="/calendar" className="inline-flex items-center gap-1.5 text-muted hover:text-text">
          <CalendarDays size={16} /> Calendar
        </Link>
      </div>

      {pending && (
        <StartOptions
          pending={pending}
          defaultReduce={advice?.level === "low"}
          deload={info.deload}
          onClose={() => {
            setPending(null);
            if (params.get("plan")) router.replace("/workout");
          }}
        />
      )}
    </div>
  );
}

function StartOptions({ pending, onClose, defaultReduce, deload }: { pending: Pending; onClose: () => void; defaultReduce: boolean; deload: boolean }) {
  const state = useAppState();
  const today = todayISO();
  const w = pending.workout;
  const [date, setDate] = useState(pending.date);
  const [reduced, setReduced] = useState(defaultReduce);
  const [lowImpact, setLowImpact] = useState(false);
  const [modReason, setModReason] = useState<ModificationReason | "">("");
  const [modNote, setModNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const hasMovement = !!w && (w.exercises.some((e) => e.role === "movement") || w.conditioning.some((c) => c.modality === "court"));

  const start = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError("Choose a valid date.");
    if (date > today) return setError("You can't log a workout in the future. Move it on the calendar instead.");
    startWorkout({
      plannedWorkoutId: w?.id ?? null,
      date,
      scheduledDate: date === pending.date ? pending.scheduledDate : undefined,
      reducedVolume: reduced,
      lowImpact,
      modified: modReason ? { reason: modReason, note: modNote.trim() } : reduced ? { reason: "fatigue", note: "Reduced volume" } : null,
    });
    onClose();
    window.scrollTo({ top: 0 });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={w ? `Day ${w.dayNumber} — ${w.name}` : "Custom workout"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={start} size="lg">
            <Play size={18} /> Start now
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {w && (
          <ul className="space-y-1 text-sm text-muted">
            {w.exercises.map((e) => (
              <li key={e.id}>
                • {state.exercises.find((x) => x.id === e.exerciseId)?.name ?? e.exerciseId} — {e.sets} × {e.repsLabel}
              </li>
            ))}
          </ul>
        )}
        <Field label="Workout date" htmlFor="start-date" error={error} hint="Defaults to today. Pick an earlier date to log a session you already did.">
          <Input id="start-date" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!!error} />
        </Field>
        {deload && <p className="rounded-xl bg-warn-soft p-3 text-sm text-warn">This is a deload week — sets are reduced by one automatically.</p>}
        <div className="rounded-xl border border-line p-1">
          <Checkbox checked={reduced} onChange={setReduced} label="Reduced volume" description="One fewer set per exercise and fewer conditioning rounds. Recommended when tired or sore." />
          {hasMovement && (
            <Checkbox
              checked={lowImpact}
              onChange={setLowImpact}
              label="Lower-impact alternatives"
              description="Swap sprints and cutting for brisk walking, bike work or controlled lateral steps."
            />
          )}
        </div>
        <Field label="Modified because of… (optional)" htmlFor="start-mod">
          <Select id="start-mod" value={modReason} onChange={(e) => setModReason(e.target.value as ModificationReason | "")}>
            <option value="">Not modified</option>
            {MOD_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
        {modReason && (
          <Field label="Details" htmlFor="start-modnote">
            <Textarea id="start-modnote" value={modNote} onChange={(e) => setModNote(e.target.value)} className="min-h-[56px]" />
          </Field>
        )}
      </div>
    </Modal>
  );
}

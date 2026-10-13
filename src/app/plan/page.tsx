"use client";

import { useState } from "react";
import { Check, Clock, HeartPulse, Pencil, Play, Repeat, RotateCcw, Sparkles, TrendingDown, Undo2, X } from "lucide-react";
import type { PlannedWorkout } from "@/lib/types";
import { useAppState } from "@/lib/store";
import { addWeekAdjustment, decideSuggestion, removeWeekAdjustment, resetPlanWorkouts, setWorkoutWeekday, undoDecision } from "@/lib/actions";
import { progressionReport } from "@/lib/progression";
import { weekInfo } from "@/lib/schedule";
import { addDays, cn, formatDate, WEEK_ORDER, WEEKDAYS } from "@/lib/utils";
import { WorkoutEditor } from "@/components/WorkoutEditor";
import { Alert, Badge, Button, Card, CardTitle, ConfirmDialog, LinkButton, PageHeader, Select, useToast } from "@/components/ui";

function restLabel(sec: number) {
  if (!sec) return "as needed";
  return sec % 60 === 0 ? `${sec / 60} min` : sec > 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` : `${sec}s`;
}

export default function PlanPage() {
  const state = useAppState();
  const toast = useToast();
  const info = weekInfo(state);
  const report = progressionReport(state);
  const [editing, setEditing] = useState<PlannedWorkout | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const workouts = [...state.plan.workouts].sort((a, b) => WEEK_ORDER.indexOf(a.weekday) - WEEK_ORDER.indexOf(b.weekday));
  const cw = info.calendarWeek;
  const adjustments = [...state.plan.weekAdjustments].sort((a, b) => a.calendarWeek - b.calendarWeek);
  const repeatNext = adjustments.find((a) => a.type === "repeat" && a.calendarWeek === cw + 1);
  const deloadNow = adjustments.find((a) => a.type === "deload" && a.calendarWeek === cw);

  const lib = (id: string) => state.exercises.find((e) => e.id === id);
  const schedule = WEEK_ORDER.map((d) => ({
    day: d,
    workout: state.plan.workouts.filter((w) => w.weekday === d),
    rest: state.plan.restDays.find((r) => r.weekday === d),
  }));

  return (
    <div>
      <PageHeader
        eyebrow={state.plan.name}
        title="Workout Plan"
        subtitle="Four training days per week for 8 weeks. Edit any day, change the weekday it's scheduled on, and review progression suggestions."
        actions={
          <Button variant="ghost" onClick={() => setConfirmReset(true)}>
            <RotateCcw size={16} /> Restore default plan
          </Button>
        }
      />

      {/* 8-week timeline */}
      <Card>
        <CardTitle
          sub={
            info.status === "active"
              ? `Calendar week ${cw} · plan week ${info.planWeek}${info.repeat ? " (repeat)" : ""}${info.deload ? " · deload" : ""}`
              : info.status === "not-started"
                ? `Starts ${formatDate(state.profile.planStartDate, { weekday: "long", month: "long", day: "numeric" })} — change in Settings`
                : "All 8 weeks completed"
          }
        >
          8-week progression
        </CardTitle>
        <ol className="grid grid-cols-8 gap-1.5" aria-label="Plan weeks">
          {Array.from({ length: state.plan.weeks }, (_, i) => i + 1).map((w) => {
            const current = info.status === "active" && w === info.planWeek;
            const past = info.status === "finished" || (info.status === "active" && w < info.planWeek);
            return (
              <li
                key={w}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "flex h-12 flex-col items-center justify-center rounded-xl text-xs font-semibold",
                  current ? "bg-accent text-accent-ink" : past ? "bg-accent-soft text-accent" : "bg-surface-2 text-subtle",
                )}
              >
                <span className="text-[10px] font-normal opacity-80">Wk</span>
                {w}
              </li>
            );
          })}
        </ol>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {state.plan.phases.map((p) => {
            const on = info.status === "active" && info.planWeek >= p.startWeek && info.planWeek <= p.endWeek;
            return (
              <div key={p.id} className={cn("rounded-xl border p-3.5", on ? "border-accent/50 bg-accent-soft" : "border-line")}>
                <p className={cn("text-xs font-semibold uppercase tracking-wider", on ? "text-accent" : "text-subtle")}>
                  Weeks {p.startWeek}–{p.endWeek}
                </p>
                <p className="mt-1 font-semibold">{p.title}</p>
                <p className="mt-1 text-xs text-muted">{p.focus}</p>
                <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-subtle">
                  {p.guidance.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {info.status === "active" && (
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            {repeatNext ? (
              <Button variant="secondary" onClick={() => removeWeekAdjustment(repeatNext.id)}>
                <Undo2 size={16} /> Undo: repeat week {info.planWeek} next week
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  addWeekAdjustment("repeat", cw + 1, `Repeat plan week ${info.planWeek}`);
                  toast(`Next week will repeat plan week ${info.planWeek}.`);
                }}
              >
                <Repeat size={16} /> Repeat this week next week
              </Button>
            )}
            {deloadNow ? (
              <Button variant="secondary" onClick={() => removeWeekAdjustment(deloadNow.id)}>
                <Undo2 size={16} /> Cancel deload this week
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  addWeekAdjustment("deload", cw, "Manual deload");
                  toast("Deload set: one fewer set per exercise this week.");
                }}
              >
                <TrendingDown size={16} /> Deload this week
              </Button>
            )}
            <p className="w-full text-xs text-subtle">Missed sessions are never crammed into later days. Repeat a week instead if you need more time.</p>
          </div>
        )}
        {adjustments.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {adjustments.map((a) => (
              <li key={a.id}>
                <Badge tone={a.type === "deload" ? "warn" : "accent"}>
                  {a.type === "deload" ? "Deload" : "Repeat"} · week of {formatDate(addDays(state.profile.planStartDate, (a.calendarWeek - 1) * 7))}
                  <button onClick={() => removeWeekAdjustment(a.id)} aria-label={`Remove ${a.type} adjustment`} className="ml-1 hover:text-text">
                    <X size={12} />
                  </button>
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Progression suggestions */}
      <Card className="mt-4">
        <CardTitle icon={<Sparkles size={16} />} sub={report.headline}>
          Progression suggestions
        </CardTitle>
        {report.holdReason && (
          <div className="mb-3">
            <Alert tone="warn" title="Holding steady">
              {report.holdReason}
            </Alert>
          </div>
        )}
        {report.suggestions.length > 0 ? (
          <ul className="space-y-3">
            {report.suggestions.map((s) => (
              <li key={s.id} className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{s.targetName}</p>
                    <p className="mt-0.5 text-sm text-accent">
                      {s.kind === "load" && `${s.from} → ${s.to} ${s.unit}`}
                      {s.kind === "reps" && `${s.from} → ${s.to} reps per set`}
                      {s.kind === "rounds" && `${s.from} → ${s.to} rounds`}
                      {s.kind === "volume" && "One fewer set per exercise"}
                    </p>
                    <p className="mt-1.5 text-sm text-muted">
                      <span className="font-medium text-text">Why: </span>
                      {s.reason}
                    </p>
                  </div>
                  {s.decision ? (
                    <div className="flex items-center gap-2">
                      <Badge tone={s.decision.status === "accepted" ? "good" : "neutral"}>{s.decision.status}</Badge>
                      <Button variant="ghost" size="sm" onClick={() => undoDecision(s.decision!.id)}>
                        Undo
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          decideSuggestion(s, "accepted", cw);
                          toast(s.kind === "load" ? `Target set to ${s.to} ${s.unit} for ${s.targetName}.` : "Suggestion accepted.");
                        }}
                      >
                        <Check size={14} /> Accept
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => decideSuggestion(s, "dismissed", cw)}>
                        Not now
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          !report.holdReason && <p className="text-sm text-muted">No progressions suggested right now. Keep logging sets, reps and effort — suggestions appear when your logs support them.</p>
        )}
        {report.notes.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-subtle">
            {report.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-subtle">Weight is never increased automatically, and lifting load, sprint intensity and conditioning volume are never progressed in the same week.</p>
      </Card>

      {/* Weekly schedule */}
      <Card className="mt-4">
        <CardTitle sub="Change the day for any workout — the calendar updates automatically.">Weekly schedule</CardTitle>
        <ul className="grid gap-2 sm:grid-cols-7">
          {schedule.map(({ day, workout, rest }) => (
            <li key={day} className={cn("rounded-xl p-3 text-sm", workout.length ? "bg-accent-soft" : "bg-surface-2")}>
              <p className="text-xs font-semibold uppercase tracking-wider text-subtle">{WEEKDAYS[day].slice(0, 3)}</p>
              {workout.length ? (
                workout.map((w) => (
                  <p key={w.id} className="mt-1 font-medium text-accent">
                    Day {w.dayNumber}
                  </p>
                ))
              ) : (
                <p className="mt-1 text-muted">{rest?.weekday === 0 ? "Rest" : "Recovery"}</p>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {/* Training days */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {workouts.map((w) => (
          <Card key={w.id} as="article">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Day {w.dayNumber}</p>
                <h2 className="mt-1 font-display text-2xl font-bold uppercase leading-tight">{w.name}</h2>
                <p className="mt-1 text-sm text-muted">{w.focus}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setEditing(w)}>
                <Pencil size={14} /> Edit
              </Button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <label htmlFor={`day-${w.id}`} className="text-xs text-subtle">
                Scheduled on
              </label>
              <Select
                id={`day-${w.id}`}
                value={w.weekday}
                onChange={(e) => {
                  setWorkoutWeekday(w.id, Number(e.target.value));
                  toast(`Day ${w.dayNumber} moved to ${WEEKDAYS[Number(e.target.value)]}.`);
                }}
                className="h-9 w-40 text-sm"
              >
                {WEEKDAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </Select>
            </div>

            <details className="group mt-4 rounded-xl bg-surface-2 p-3">
              <summary className="cursor-pointer text-sm font-semibold">Warm-up ({w.warmup.length})</summary>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-muted">
                {w.warmup.map((x) => (
                  <li key={x.id}>{x.text}</li>
                ))}
              </ul>
            </details>

            <ol className="mt-3 divide-y divide-line">
              {w.exercises.map((e, i) => (
                <li key={e.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-5 shrink-0 text-xs text-subtle tabular">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{lib(e.exerciseId)?.name ?? e.exerciseId}</span>
                    {e.notes && <span className="block truncate text-xs text-subtle">{e.notes}</span>}
                  </span>
                  <span className="shrink-0 text-right text-sm tabular">
                    {e.sets > 1 || e.role !== "skill" ? `${e.sets} × ` : ""}
                    {e.repsLabel}
                    <span className="flex items-center justify-end gap-1 text-[11px] text-subtle">
                      <Clock size={10} /> {restLabel(e.restSec)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>

            {w.conditioning.length > 0 && (
              <div className="mt-3 rounded-xl border border-line p-3">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <HeartPulse size={15} className="text-accent" /> Conditioning
                </p>
                <ul className="mt-1.5 space-y-0.5 text-sm text-muted">
                  {w.conditioning.map((c) => (
                    <li key={c.id}>
                      {c.label}: {c.rounds} × {c.workSec}s / {c.recoverySec}s
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {w.guidance.length > 0 && (
              <ul className="mt-3 list-disc space-y-0.5 pl-5 text-xs text-subtle">
                {w.guidance.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            )}

            <LinkButton href={`/workout?plan=${w.id}`} className="mt-4 w-full" size="lg">
              <Play size={18} /> Start Day {w.dayNumber}
            </LinkButton>
          </Card>
        ))}
      </div>

      {editing && <WorkoutEditor workout={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Restore the default plan?"
        message="All four training days return to their original exercises, warm-ups and weekdays. Your workout history is not affected."
        confirmLabel="Restore defaults"
        onConfirm={() => {
          resetPlanWorkouts();
          toast("Default plan restored.");
        }}
      />
    </div>
  );
}

"use client";

import Link from "next/link";
import { Activity, BedDouble, CalendarDays, CheckCircle2, ChevronRight, Dumbbell, Flame, HeartPulse, Play, Target, TrendingUp, Trophy } from "lucide-react";
import { useAppState } from "@/lib/store";
import {
  allSkillPoints,
  completedSessions,
  countStrengthSets,
  exerciseMap,
  hasAnyHistory,
  latestRecovery,
  personalRecords,
  recentActivity,
  recoveryAverages,
  recoverySorted,
  shotTotals,
  strengthImprovements,
  weeklyBuckets,
  workoutsThisWeek,
} from "@/lib/metrics";
import { currentWeekOccurrences, nextOccurrence, occurrencesOn, weekInfo } from "@/lib/schedule";
import { addDays, formatDate, formatLongDate, formatPct, sum, todayISO } from "@/lib/utils";
import { Badge, Card, CardTitle, EmptyState, LinkButton, PageHeader, ProgressBar, Stat } from "@/components/ui";
import { SimpleBarChart } from "@/components/charts";
import { RecoveryAdvice } from "@/components/RecoveryAdvice";

const KIND_ICON = { workout: Dumbbell, skills: Target, conditioning: HeartPulse, recovery: BedDouble };

export default function Dashboard() {
  const state = useAppState();
  const today = todayISO();
  const info = weekInfo(state);
  const todays = occurrencesOn(state, today);
  const todayPlanned = todays.find((o) => !o.session && o.status !== "skipped") ?? null;
  const next = todayPlanned ? null : nextOccurrence(state, addDays(today, 1));
  const goal = state.profile.daysPerWeek;
  const thisWeek = workoutsThisWeek(state);
  const sessions = completedSessions(state);
  const lib = exerciseMap(state);
  const strengthSets = countStrengthSets(sessions, lib);
  const improvements = strengthImprovements(state).slice(0, 4);
  const prs = personalRecords(state).slice(0, 4);
  const buckets = weeklyBuckets(state, 8);
  const activity = recentActivity(state, 6);
  const weekOcc = currentWeekOccurrences(state);
  const recovery = latestRecovery(state);
  const rec7 = recoveryAverages(recoverySorted(state).filter((r) => r.date >= addDays(today, -6)));

  const points = allSkillPoints(state).filter((p) => p.date >= addDays(today, -29));
  const shootingDrills = [
    { id: "drill-free-throws", label: "Free throws" },
    { id: "drill-mikan", label: "Mikan" },
    { id: "drill-jump-hooks", label: "Jump hooks" },
    { id: "drill-midrange", label: "Midrange" },
  ]
    .map((d) => ({ ...d, t: shotTotals(points.filter((p) => p.drillId === d.id).map((p) => p.values)) }))
    .filter((d) => d.t.attempts > 0);

  const condTotal = state.conditioningSessions.length;
  const intervals = sum(state.conditioningSessions.map((c) => c.completedRounds ?? 0));
  const consistentWeeks = buckets.filter((b) => b.workouts >= goal).length;
  const history = hasAnyHistory(state);

  return (
    <div>
      <PageHeader
        eyebrow={
          info.status === "active"
            ? `Week ${info.planWeek} of ${info.totalWeeks}${info.phase ? ` · ${info.phase.title}` : ""}${info.deload ? " · Deload" : ""}`
            : info.status === "not-started"
              ? "Plan not started"
              : "Plan complete"
        }
        title={state.profile.name ? `Let's work, ${state.profile.name}` : "Dashboard"}
        subtitle={formatLongDate(today)}
      />

      {/* Today */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="relative overflow-hidden border-accent/30 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Today&apos;s plan</p>
          {todayPlanned ? (
            <>
              <h2 className="mt-2 font-display text-3xl font-bold uppercase leading-tight sm:text-4xl">
                Day {todayPlanned.workout.dayNumber}
                <span className="block text-text">{todayPlanned.workout.name}</span>
              </h2>
              <p className="mt-2 text-sm text-muted">{todayPlanned.workout.focus}</p>
              <p className="mt-1 text-xs text-subtle">
                {todayPlanned.workout.exercises.length} exercises{todayPlanned.workout.conditioning.length ? " · conditioning finisher" : ""}
                {todayPlanned.moved ? " · moved from " + formatDate(todayPlanned.originalDate) : ""}
              </p>
            </>
          ) : todays.some((o) => o.session) ? (
            <>
              <h2 className="mt-2 font-display text-3xl font-bold uppercase">Done for today</h2>
              <p className="mt-2 flex items-center gap-2 text-sm text-good">
                <CheckCircle2 size={16} /> {todays.find((o) => o.session)!.workout.name} completed
              </p>
            </>
          ) : (
            <>
              <h2 className="mt-2 font-display text-3xl font-bold uppercase">
                {info.status === "not-started" ? "Plan starts soon" : state.plan.restDays.find((r) => r.weekday === new Date().getDay())?.label ?? "Recovery day"}
              </h2>
              {info.status === "not-started" && <p className="mt-2 text-sm text-muted">Week 1 begins {formatDate(state.profile.planStartDate, { weekday: "long", month: "long", day: "numeric" })}.</p>}
              {next && (
                <p className="mt-2 text-sm text-muted">
                  Next: Day {next.workout.dayNumber} — {next.workout.name}, {formatDate(next.date, { weekday: "long" })}
                </p>
              )}
            </>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            {todayPlanned ? (
              <LinkButton href={`/workout?plan=${todayPlanned.workout.id}&date=${today}&scheduled=${todayPlanned.originalDate}`} size="xl">
                <Play size={20} /> Start workout
              </LinkButton>
            ) : (
              <LinkButton href="/workout" size="xl">
                <Play size={20} /> Start workout
              </LinkButton>
            )}
            <LinkButton href="/plan" variant="secondary" size="xl">
              View plan
            </LinkButton>
          </div>
        </Card>

        <Card>
          <CardTitle icon={<CalendarDays size={16} />}>This week</CardTitle>
          <p className="font-display text-5xl font-bold tabular">
            {thisWeek}
            <span className="text-2xl text-subtle">/{goal}</span>
          </p>
          <p className="mb-3 text-sm text-muted">workouts completed</p>
          <ProgressBar value={thisWeek} max={goal} label="Workouts completed this week" />
          <ul className="mt-4 space-y-1.5">
            {weekOcc.map((o) => (
              <li key={o.key} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-muted">
                  {formatDate(o.date, { weekday: "short" })} · {o.workout.name}
                </span>
                <Badge tone={o.status === "completed" ? "good" : o.status === "modified" ? "warn" : o.status === "skipped" || o.status === "missed" ? "neutral" : "accent"}>
                  {o.status}
                </Badge>
              </li>
            ))}
            {weekOcc.length === 0 && <li className="text-sm text-subtle">No planned workouts this week.</li>}
          </ul>
        </Card>
      </div>

      {!history ? (
        <div className="mt-6">
          <EmptyState
            icon={<Activity size={22} />}
            title="Your training history starts with your first session"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <LinkButton href="/workout" size="lg">
                  <Play size={18} /> Start first workout
                </LinkButton>
                <LinkButton href="/recovery" variant="secondary" size="lg">
                  Log a check-in
                </LinkButton>
              </div>
            }
          >
            Stats, charts and personal records appear here once you log real workouts, skills sessions, conditioning or recovery check-ins. Nothing is
            pre-filled.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Training sessions" value={sessions.length} sub="workouts completed" />
            <Stat label="Strength sets" value={strengthSets} sub="logged and completed" />
            <Stat label="Conditioning" value={condTotal} sub={`${intervals} intervals completed`} />
            <Stat label="Consistent weeks" value={`${consistentWeeks}/8`} sub={`weeks with ${goal}+ workouts`} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardTitle icon={<Activity size={16} />} sub="Sessions logged per week (last 8 weeks)">
                Weekly activity
              </CardTitle>
              <SimpleBarChart
                data={buckets}
                xKey="label"
                stacked
                label="Weekly activity: workouts, skills sessions and conditioning sessions per week"
                series={[
                  { key: "workouts", name: "Workouts" },
                  { key: "skillSessions", name: "Skills" },
                  { key: "conditioning", name: "Conditioning" },
                ]}
              />
            </Card>
            <Card>
              <CardTitle icon={<BedDouble size={16} />} action={<Link href="/recovery" className="text-xs text-accent hover:underline">Check in</Link>}>
                Recovery
              </CardTitle>
              {recovery ? (
                <>
                  <dl className="grid grid-cols-3 gap-2 text-center">
                    {[
                      ["Readiness", rec7.readiness],
                      ["Energy", rec7.energy],
                      ["Soreness", rec7.soreness],
                    ].map(([k, v]) => (
                      <div key={k as string} className="rounded-xl bg-surface-2 p-2">
                        <dt className="text-[11px] text-subtle">{k}</dt>
                        <dd className="font-display text-xl font-bold tabular">{v === null ? "—" : (v as number).toFixed(1)}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mb-3 mt-1.5 text-[11px] text-subtle">7-day averages (1–5){rec7.sleepHours !== null ? ` · sleep ${rec7.sleepHours.toFixed(1)} h` : ""}</p>
                  <RecoveryAdvice entry={recovery} />
                </>
              ) : (
                <RecoveryAdvice entry={null} />
              )}
            </Card>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardTitle icon={<TrendingUp size={16} />}>Strength improvements</CardTitle>
              {improvements.length ? (
                <ul className="space-y-2.5">
                  {improvements.map((i) => (
                    <li key={i.exerciseId}>
                      <Link href={`/progress?exercise=${i.exerciseId}`} className="flex items-center justify-between gap-2 rounded-xl p-1 hover:bg-surface-2">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{i.name}</span>
                          <span className="block text-xs text-subtle">
                            {formatDate(i.fromDate)} → {formatDate(i.toDate)}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm tabular">
                          {i.from} → <span className="font-semibold text-accent">{i.to}</span> {state.profile.units}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Log the same lift in at least two sessions to see changes in your top working weight.</p>
              )}
            </Card>

            <Card>
              <CardTitle icon={<Target size={16} />} sub="Last 30 days" action={<Link href="/skills" className="text-xs text-accent hover:underline">Log</Link>}>
                Shooting
              </CardTitle>
              {shootingDrills.length ? (
                <ul className="space-y-3">
                  {shootingDrills.map((d) => (
                    <li key={d.id}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>{d.label}</span>
                        <span className="tabular text-muted">
                          {d.t.makes}/{d.t.attempts} · <span className="font-semibold text-text">{formatPct(d.t.pct)}</span>
                        </span>
                      </div>
                      <ProgressBar value={d.t.pct ?? 0} max={100} label={`${d.label} percentage`} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No shooting attempts logged in the last 30 days.</p>
              )}
            </Card>

            <Card>
              <CardTitle icon={<Trophy size={16} />}>Recent personal records</CardTitle>
              {prs.length ? (
                <ul className="space-y-2.5">
                  {prs.map((p) => (
                    <li key={p.id} className="flex items-start justify-between gap-2 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{p.exerciseName}</span>
                        <span className="block text-xs text-subtle">
                          {formatDate(p.date)} · previous best {p.kind === "best-percentage" ? `${p.previous}%` : p.kind === "most-reps" ? `${p.previous} reps` : `${Math.round(p.previous * 10) / 10} ${state.profile.units}`}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold text-accent tabular">{p.label}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Records appear only when a logged session beats an earlier logged session. Your first logs set the baseline.</p>
              )}
            </Card>
          </div>

          <Card className="mt-4">
            <CardTitle icon={<Flame size={16} />} action={<Link href="/progress" className="flex items-center gap-1 text-xs text-accent hover:underline">Progress <ChevronRight size={14} /></Link>}>
              Recent activity
            </CardTitle>
            <ul className="divide-y divide-line">
              {activity.map((a) => {
                const Icon = KIND_ICON[a.kind];
                return (
                  <li key={a.id}>
                    <Link href={a.href} className="flex items-center gap-3 py-3 hover:bg-surface-2 sm:rounded-xl sm:px-2">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-accent">
                        <Icon size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{a.title}</span>
                        <span className="block truncate text-xs text-subtle">{a.detail}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted">{formatDate(a.date)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}

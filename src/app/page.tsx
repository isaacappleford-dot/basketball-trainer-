"use client";

import Link from "next/link";
import {
  Activity,
  Ban,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Dumbbell,
  Flame,
  HeartPulse,
  House,
  Lightbulb,
  Play,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { useAppState } from "@/lib/store";
import {
  allSkillPoints,
  centerSkillTotals,
  completedSessions,
  conditioningSorted,
  hasAnyHistory,
  latestRecovery,
  personalRecords,
  recentActivity,
  recoveryAverages,
  recoverySorted,
  shotTotals,
  strengthImprovements,
  weeklyBuckets,
  weekSummary,
} from "@/lib/metrics";
import { currentWeekOccurrences, daySlotFor, isOpenGymDay, nextOccurrence, occurrencesOn, weekInfo } from "@/lib/schedule";
import { addDays, formatDate, formatLongDate, formatPct, todayISO } from "@/lib/utils";
import { Badge, Card, CardTitle, EmptyState, LinkButton, PageHeader, ProgressBar, Stat } from "@/components/ui";
import { SimpleBarChart } from "@/components/charts";
import { RecoveryAdvice } from "@/components/RecoveryAdvice";
import { AdviceList } from "@/components/AdviceList";
import { MODALITY_LABELS } from "@/components/ProfileForm";
import { STATUS_TONE } from "@/components/labels";

const KIND_ICON = { workout: Dumbbell, skills: Target, home: House, "open-gym": Users, conditioning: HeartPulse, recovery: BedDouble };

export default function Dashboard() {
  const state = useAppState();
  const today = todayISO();
  const info = weekInfo(state);
  const todays = occurrencesOn(state, today);
  const todayPlanned = todays.find((o) => !o.session && !o.fulfilledBy && o.status !== "skipped") ?? null;
  const next = nextOccurrence(state, addDays(today, 1));
  const week = weekSummary(state);
  const sessions = completedSessions(state);
  const improvements = strengthImprovements(state).slice(0, 4);
  const prs = personalRecords(state).slice(0, 4);
  const buckets = weeklyBuckets(state, 8);
  const activity = recentActivity(state, 6);
  const weekOcc = currentWeekOccurrences(state);
  const recovery = latestRecovery(state);
  const recEntries = recoverySorted(state);
  const rec7 = recoveryAverages(recEntries.filter((r) => r.date >= addDays(today, -6)));
  const recNotes = [...recEntries].reverse().filter((r) => r.notes).slice(0, 3);
  const slot = daySlotFor(state, today);
  const blockedToday = slot?.kind === "unavailable";
  const openGymToday = isOpenGymDay(state, today);
  const plannedOpenGymToday = state.openGymSessions.find((o) => o.date === today);

  const points = allSkillPoints(state).filter((p) => p.date >= addDays(today, -29));
  const center = centerSkillTotals(points, state);
  const shootingDrills = [
    { id: "drill-free-throws", label: "Free throws" },
    { id: "drill-mikan", label: "Mikan" },
    { id: "drill-jump-hooks", label: "Jump hooks" },
    { id: "drill-midrange", label: "Midrange" },
    { id: "drill-form-shooting", label: "Form shooting" },
  ]
    .map((d) => ({ ...d, t: shotTotals(points.filter((p) => p.drillId === d.id).map((p) => p.values)) }))
    .filter((d) => d.t.attempts > 0);

  const conditioning = conditioningSorted(state).slice(-3).reverse();
  const attendedTotal = state.openGymSessions.filter((o) => o.status === "attended").length;
  const homeTotal = state.skillSessions.filter((s) => s.kind === "home-court").length;
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

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Today */}
        <Card className="relative overflow-hidden border-accent/30 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Today</p>
          {todayPlanned ? (
            <>
              <h2 className="mt-2 font-display text-3xl font-bold uppercase leading-tight sm:text-4xl">
                {todayPlanned.workout.label}
                <span className="block text-text">{todayPlanned.workout.name}</span>
              </h2>
              <p className="mt-2 text-sm text-muted">{todayPlanned.workout.focus}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge>{todayPlanned.workout.kind === "strength" ? "Gym strength" : "Basketball"}</Badge>
                {todayPlanned.moved && <Badge>Moved from {formatDate(todayPlanned.originalDate)}</Badge>}
                {todayPlanned.swapped && <Badge>Swapped</Badge>}
                {todayPlanned.override?.reduce && <Badge tone="warn">Lighter version</Badge>}
              </div>
            </>
          ) : todays.some((o) => o.session || o.fulfilledBy) ? (
            <>
              <h2 className="mt-2 font-display text-3xl font-bold uppercase">Done for today</h2>
              {todays
                .filter((o) => o.session || o.fulfilledBy)
                .map((o) => (
                  <p key={o.key} className="mt-2 flex items-center gap-2 text-sm text-good">
                    <CheckCircle2 size={16} /> {o.workout.label} {o.fulfilledBy ? `${o.status === "completed" ? "done" : "replaced"} via ${o.fulfilledBy.label.toLowerCase()}` : "completed"}
                  </p>
                ))}
            </>
          ) : (
            <>
              <h2 className="mt-2 font-display text-3xl font-bold uppercase">
                {info.status === "not-started" ? "Plan starts soon" : slot?.label ?? (openGymToday ? "Open gym available" : "No session planned")}
              </h2>
              <p className="mt-2 text-sm text-muted">
                {info.status === "not-started"
                  ? `Week 1 begins ${formatDate(state.profile.planStartDate, { weekday: "long", month: "long", day: "numeric" })}.`
                  : slot?.description ?? "Nothing is required today."}
              </p>
              {openGymToday && slot?.kind !== "rest" && (
                <p className="mt-1 text-sm text-muted">
                  Open gym is available today{plannedOpenGymToday ? ` — marked ${plannedOpenGymToday.status}` : " (optional)"}.
                </p>
              )}
            </>
          )}
          {next && (
            <p className="mt-3 text-sm text-muted">
              <span className="text-subtle">Next session:</span> {next.workout.label} — {next.workout.name}, {formatDate(next.date, { weekday: "long", month: "short", day: "numeric" })}
            </p>
          )}
          {blockedToday ? (
            <p className="mt-5 flex items-center gap-2 rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">
              <Ban size={16} className="shrink-0" /> Blocked day — no workouts or reminders today. Enjoy the rest.
            </p>
          ) : (
          <div className="mt-5 flex flex-wrap gap-2">
            {todayPlanned ? (
              <LinkButton href={`/workout?plan=${todayPlanned.workout.id}&date=${today}&scheduled=${todayPlanned.originalDate}`} size="xl">
                <Play size={20} /> Start {todayPlanned.workout.label}
              </LinkButton>
            ) : (
              <LinkButton href="/workout" size="xl">
                <Play size={20} /> Start workout
              </LinkButton>
            )}
            {openGymToday && slot?.kind !== "rest" && (
              <LinkButton href="/open-gym" variant="secondary" size="xl">
                <Users size={18} /> Open gym
              </LinkButton>
            )}
            {(!todayPlanned || todayPlanned.workout.kind === "basketball") && slot?.kind !== "rest" && (
              <LinkButton href={slot?.kind === "recovery" ? "/home-court?template=light" : "/home-court"} variant="secondary" size="xl">
                <House size={18} /> Home Court
              </LinkButton>
            )}
          </div>
          )}
        </Card>

        {/* Week balance */}
        <Card>
          <CardTitle icon={<CalendarDays size={16} />}>This week</CardTitle>
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span>Gym strength</span>
                <span className="tabular text-muted">
                  <span className="font-semibold text-text">{week.strengthDone}</span>/{state.profile.strengthPerWeek}
                </span>
              </div>
              <ProgressBar value={week.strengthDone} max={state.profile.strengthPerWeek} label="Strength sessions this week" />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span>Basketball-focused</span>
                <span className="tabular text-muted">
                  <span className="font-semibold text-text">{week.basketballDone}</span>/{state.profile.basketballPerWeek}
                </span>
              </div>
              <ProgressBar value={week.basketballDone} max={state.profile.basketballPerWeek} label="Basketball sessions this week" />
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-surface-2 p-2">
              <dt className="text-[11px] text-subtle">Open gym</dt>
              <dd className="font-display text-xl font-bold tabular">{week.openGymAttended}</dd>
            </div>
            <div className="rounded-xl bg-surface-2 p-2">
              <dt className="text-[11px] text-subtle">Home Court</dt>
              <dd className="font-display text-xl font-bold tabular">{week.homeSessions}</dd>
            </div>
            <div className="rounded-xl bg-surface-2 p-2">
              <dt className="text-[11px] text-subtle">Hoops min</dt>
              <dd className="font-display text-xl font-bold tabular">{week.basketballMinutes}</dd>
            </div>
          </dl>
          {week.lightHomeSessions > 0 && <p className="mt-2 text-[11px] text-subtle">{week.lightHomeSessions} light shooting session(s) counted as practice only.</p>}
          <ul className="mt-4 space-y-1.5">
            {weekOcc.map((o) => (
              <li key={o.key} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-muted">
                  {formatDate(o.date, { weekday: "short" })} · {o.workout.label}
                </span>
                <Badge tone={STATUS_TONE[o.status]}>{o.fulfilledBy && o.status === "completed" ? `via ${o.fulfilledBy.type === "open-gym" ? "open gym" : "home"}` : o.status}</Badge>
              </li>
            ))}
            {weekOcc.length === 0 && <li className="text-sm text-subtle">No planned workouts this week.</li>}
          </ul>
        </Card>
      </div>

      <div className="mt-4">
        <AdviceList
          limit={3}
          empty={
            history ? (
              <p className="flex items-center gap-2 rounded-2xl border border-line px-4 py-3 text-sm text-muted">
                <Lightbulb size={16} className="text-accent" /> No scheduling changes suggested — your week looks balanced.
              </p>
            ) : null
          }
        />
      </div>

      {!history ? (
        <div className="mt-6">
          <EmptyState
            icon={<Activity size={22} />}
            title="Your training history starts with your first session"
            action={
              blockedToday ? undefined : (
              <div className="flex flex-wrap justify-center gap-2">
                <LinkButton href="/workout" size="lg">
                  <Play size={18} /> Start first workout
                </LinkButton>
                <LinkButton href="/open-gym" variant="secondary" size="lg">
                  Log open gym
                </LinkButton>
                <LinkButton href="/recovery" variant="secondary" size="lg">
                  Log a check-in
                </LinkButton>
              </div>
              )
            }
          >
            Stats, charts and personal records appear once you log real workouts, open gym, Home Court sessions, conditioning or recovery check-ins.
            Nothing is pre-filled.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Gym & court workouts" value={sessions.length} sub="logged workouts" />
            <Stat label="Open gym" value={attendedTotal} sub="sessions attended" />
            <Stat label="Home Court" value={homeTotal} sub="driveway sessions" />
            <Stat label="Conditioning" value={state.conditioningSessions.length} sub="sessions logged" />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardTitle icon={<Activity size={16} />} sub="Sessions per week by type (last 8 weeks)">
                Weekly activity
              </CardTitle>
              <SimpleBarChart
                data={buckets}
                xKey="label"
                stacked
                label="Weekly sessions: gym strength, basketball workouts, open gym and home court"
                series={[
                  { key: "strength", name: "Gym strength" },
                  { key: "courtWorkouts", name: "Basketball workouts" },
                  { key: "openGym", name: "Open gym" },
                  { key: "homeSessions", name: "Home Court" },
                ]}
              />
            </Card>
            <Card>
              <CardTitle icon={<BedDouble size={16} />} action={<Link href="/recovery" className="text-xs text-accent hover:underline">Check in</Link>}>
                Recovery & fatigue
              </CardTitle>
              {recovery ? (
                <>
                  <dl className="grid grid-cols-4 gap-1.5 text-center">
                    {(
                      [
                        ["Ready", rec7.readiness],
                        ["Energy", rec7.energy],
                        ["Sore", rec7.soreness],
                        ["Fatigue", rec7.fatigue],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k} className="rounded-xl bg-surface-2 p-2">
                        <dt className="text-[11px] text-subtle">{k}</dt>
                        <dd className="font-display text-lg font-bold tabular">{v === null ? "—" : v.toFixed(1)}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mb-3 mt-1.5 text-[11px] text-subtle">7-day averages (1–5){rec7.sleepHours !== null ? ` · sleep ${rec7.sleepHours.toFixed(1)} h` : ""}</p>
                  <RecoveryAdvice entry={recovery} />
                  {recNotes.length > 0 && (
                    <ul className="mt-3 space-y-1.5 text-sm">
                      {recNotes.map((r) => (
                        <li key={r.id} className="text-muted">
                          <span className="text-xs text-subtle">{formatDate(r.date)}:</span> {r.notes}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <RecoveryAdvice entry={null} />
              )}
            </Card>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardTitle icon={<TrendingUp size={16} />}>Strength progression</CardTitle>
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
              <CardTitle icon={<Target size={16} />} sub="Last 30 days · workouts + Home Court" action={<Link href="/home-court" className="text-xs text-accent hover:underline">Shoot</Link>}>
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
              <CardTitle icon={<Flame size={16} />} sub="Last 30 days">
                Center-skill practice
              </CardTitle>
              {points.length ? (
                <dl className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["Drop steps", `${center.dropStepReps}`, center.dropStepLeft || center.dropStepRight ? `L ${center.dropStepLeft} · R ${center.dropStepRight}` : "reps"],
                      ["Jump hooks", `${center.hooks.makes}/${center.hooks.attempts}`, formatPct(center.hooks.pct)],
                      ["Mikan (all)", `${center.mikan.makes}/${center.mikan.attempts}`, formatPct(center.mikan.pct)],
                      ["Rebounds", `${center.reboundReps}`, "reps"],
                      ["Footwork", `${center.footworkReps}`, "reps"],
                      ["Drills done", `${center.drillsCompleted}`, "Home Court"],
                    ] as const
                  ).map(([k, v, sub]) => (
                    <div key={k} className="rounded-xl bg-surface-2 p-2.5">
                      <dt className="text-[11px] text-subtle">{k}</dt>
                      <dd className="font-display text-xl font-bold tabular">{v}</dd>
                      <dd className="text-[11px] text-muted">{sub}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-muted">Log a center-skills workout or Home Court session to see your practice totals.</p>
              )}
            </Card>

            <Card>
              <CardTitle icon={<Users size={16} />} sub="Sessions attended, last 8 weeks" action={<Link href="/open-gym" className="text-xs text-accent hover:underline">Open gym</Link>}>
                Open-gym attendance
              </CardTitle>
              <p className="font-display text-4xl font-bold tabular">{buckets.reduce((n, b) => n + b.openGym, 0)}</p>
              <p className="text-xs text-subtle">{buckets.reduce((n, b) => n + b.openGymMin, 0)} minutes total</p>
              <ol className="mt-3 flex items-end gap-1" aria-label="Open gym sessions per week">
                {buckets.map((b) => (
                  <li key={b.weekStart} className="flex flex-1 flex-col items-center gap-1" title={`Week of ${b.label}: ${b.openGym}`}>
                    <span className="w-full rounded-sm bg-[var(--chart-3)]" style={{ height: `${Math.max(2, b.openGym * 12)}px`, opacity: b.openGym ? 1 : 0.25 }} />
                    <span className="text-[9px] text-subtle">{b.label}</span>
                  </li>
                ))}
              </ol>
            </Card>

            <Card>
              <CardTitle icon={<HeartPulse size={16} />} action={<Link href="/conditioning" className="text-xs text-accent hover:underline">All</Link>}>
                Conditioning history
              </CardTitle>
              {conditioning.length ? (
                <ul className="space-y-2 text-sm">
                  {conditioning.map((c) => (
                    <li key={c.id} className="flex justify-between gap-2">
                      <span className="truncate">
                        {c.activityType === "custom" ? c.customName || "Custom" : MODALITY_LABELS[c.activityType]}
                        <span className="text-xs text-subtle"> · {formatDate(c.date)}</span>
                      </span>
                      <span className="shrink-0 tabular text-muted">
                        {c.completedRounds !== null ? `${c.completedRounds}/${c.plannedRounds ?? c.completedRounds} · ` : ""}
                        {c.totalDurationMin} min
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No conditioning logged yet.</p>
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
                          {formatDate(p.date)} · previous best{" "}
                          {p.kind === "best-percentage" ? `${p.previous}%` : p.kind === "most-reps" ? `${p.previous} reps` : `${Math.round(p.previous * 10) / 10} ${state.profile.units}`}
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

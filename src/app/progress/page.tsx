"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BarChart3, Dumbbell, HeartPulse, House, ListChecks, Pencil, Target, Trash2, Trophy, Users } from "lucide-react";
import type { ISODate } from "@/lib/types";
import { useAppState } from "@/lib/store";
import { deleteWorkoutSession } from "@/lib/actions";
import {
  allSkillPoints,
  centerSkillTotals,
  completedSessions,
  exerciseHistory,
  exerciseMap,
  inRange,
  loggedExercises,
  personalRecords,
  RANGE_LABELS,
  type RangeKey,
  sessionTotals,
  shotTotals,
  weeklyBuckets,
} from "@/lib/metrics";
import { daysBetween, formatDate, formatPct, startOfWeek, sum, todayISO } from "@/lib/utils";
import { SimpleBarChart, SimpleLineChart } from "@/components/charts";
import { SessionDetail } from "@/components/SessionDetail";
import { SessionEditor } from "@/components/SessionEditor";
import { Badge, Button, Card, CardTitle, ConfirmDialog, EmptyState, LinkButton, LoadingScreen, Modal, PageHeader, Segmented, Select, Stat, useToast } from "@/components/ui";

export default function ProgressPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Progress />
    </Suspense>
  );
}

function weeksForRange(range: RangeKey, firstDate: ISODate | null): number {
  if (range === "7d") return 2;
  if (range === "30d") return 5;
  if (range === "8w") return 8;
  if (!firstDate) return 8;
  return Math.min(52, Math.max(8, Math.ceil(daysBetween(startOfWeek(firstDate), todayISO()) / 7) + 1));
}

function Progress() {
  const state = useAppState();
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const [range, setRange] = useState<RangeKey>("8w");
  const exercises = loggedExercises(state);
  const [exerciseId, setExerciseId] = useState<string>(() => params.get("exercise") ?? exercises[0]?.id ?? "");
  const [sessionId, setSessionId] = useState<string | null>(() => params.get("session"));
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const lib = exerciseMap(state);
  const unit = state.profile.units;

  const sessions = completedSessions(state).filter((s) => inRange(s.date, range));
  const allDates = [
    ...completedSessions(state).map((s) => s.date),
    ...state.skillSessions.map((s) => s.date),
    ...state.conditioningSessions.map((c) => c.date),
  ].sort();
  const buckets = weeklyBuckets(state, weeksForRange(range, allDates[0] ?? null));
  const hist = exerciseId ? exerciseHistory(state, exerciseId, unit).filter((h) => inRange(h.date, range)) : [];
  const ex = lib.get(exerciseId);
  const weighted = hist.some((h) => h.topWeight !== null);
  const histData = hist.map((h) => ({ ...h, label: formatDate(h.date), topWeight: h.topWeight === null ? null : Math.round(h.topWeight * 10) / 10 }));

  const prs = personalRecords(state).filter((p) => inRange(p.date, range));
  const skillPoints = allSkillPoints(state).filter((p) => inRange(p.date, range));
  const drills = state.skillDrills.filter((d) => skillPoints.some((p) => p.drillId === d.id && shotTotals([p.values]).attempts > 0));
  const shootingByDrill = drills.map((d) => ({ drill: d, t: shotTotals(skillPoints.filter((p) => p.drillId === d.id).map((p) => p.values)) }));
  const [drillId, setDrillId] = useState<string>("");
  const activeDrill = drillId || drills[0]?.id || "";
  const drillSeries = (() => {
    const byDate = new Map<string, ReturnType<typeof shotTotals>>();
    const dates = [...new Set(skillPoints.filter((p) => p.drillId === activeDrill).map((p) => p.date))].sort();
    for (const d of dates) byDate.set(d, shotTotals(skillPoints.filter((p) => p.drillId === activeDrill && p.date === d).map((p) => p.values)));
    return dates.map((d) => ({ label: formatDate(d), pct: byDate.get(d)!.pct, attempts: byDate.get(d)!.attempts })).filter((x) => x.pct !== null);
  })();

  const conditioning = state.conditioningSessions.filter((c) => inRange(c.date, range));
  const openGym = state.openGymSessions.filter((o) => o.status === "attended" && inRange(o.date, range));
  const center = centerSkillTotals(skillPoints, state);
  const [editing, setEditing] = useState<string | null>(null);
  const editSession = editing ? state.workoutSessions.find((w) => w.id === editing) : null;
  const totalSets = sum(sessions.map((s) => sessionTotals(s).totalSets));
  const openSession = sessionId ? state.workoutSessions.find((s) => s.id === sessionId && s.status === "completed") : null;

  const closeSession = () => {
    setSessionId(null);
    if (params.get("session")) router.replace("/progress");
  };

  const nothing =
    completedSessions(state).length === 0 &&
    state.skillSessions.length === 0 &&
    state.conditioningSessions.length === 0 &&
    !state.openGymSessions.some((o) => o.status === "attended");

  return (
    <div>
      <PageHeader
        title="Progress"
        subtitle="Every number on this page is calculated from your saved logs."
        actions={
          <Segmented
            label="Date range"
            value={range}
            onChange={setRange}
            size="sm"
            className="w-full sm:w-auto"
            options={(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => ({ value: k, label: RANGE_LABELS[k] }))}
          />
        }
      />

      {nothing ? (
        <EmptyState icon={<BarChart3 size={22} />} title="No progress data yet" action={<LinkButton href="/workout">Start a workout</LinkButton>}>
          Complete a workout, skills session or conditioning session and your charts will appear here.
        </EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Workouts" value={sessions.length} sub={RANGE_LABELS[range].toLowerCase()} />
            <Stat label="Completed sets" value={totalSets} />
            <Stat label="Conditioning" value={`${sum(conditioning.map((c) => c.totalDurationMin))} min`} sub={`${sum(conditioning.map((c) => c.completedRounds ?? 0))} intervals`} />
            <Stat label="Personal records" value={prs.length} />
          </div>

          {/* Exercise history */}
          <Card className="mt-4">
            <CardTitle icon={<Dumbbell size={16} />} sub="Select an exercise. Tap a point or row to see the full session.">
              Exercise history
            </CardTitle>
            {exercises.length === 0 ? (
              <p className="text-sm text-muted">No exercises logged yet.</p>
            ) : (
              <>
                <Select aria-label="Exercise" value={exerciseId} onChange={(e) => setExerciseId(e.target.value)} className="mb-4 sm:max-w-sm">
                  {exercises.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.sessions})
                    </option>
                  ))}
                </Select>
                {hist.length === 0 ? (
                  <p className="text-sm text-muted">No sessions for {ex?.name ?? "this exercise"} in this range.</p>
                ) : (
                  <div className="grid gap-6 lg:grid-cols-2">
                    {weighted ? (
                      <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-subtle">Top working weight ({unit})</p>
                        <SimpleLineChart
                          data={histData}
                          xKey="label"
                          series={[{ key: "topWeight", name: `Top weight (${unit})` }]}
                          label={`Top working weight for ${ex?.name}`}
                          onPointClick={(r) => setSessionId(r.sessionId)}
                          valueSuffix={` ${unit}`}
                        />
                      </div>
                    ) : null}
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-subtle">{weighted ? "Reps at top weight" : "Best set (reps)"}</p>
                      <SimpleLineChart
                        data={histData}
                        xKey="label"
                        series={[{ key: weighted ? "repsAtTop" : "bestReps", name: "Reps", color: "var(--chart-2)" }]}
                        label={`Rep trend for ${ex?.name}`}
                        onPointClick={(r) => setSessionId(r.sessionId)}
                        domain={[0, "auto"]}
                      />
                    </div>
                  </div>
                )}
                {hist.length > 0 && (
                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full min-w-[480px] text-sm">
                      <thead>
                        <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-subtle">
                          <th className="py-2 font-medium">Date</th>
                          <th className="py-2 font-medium">Sets</th>
                          <th className="py-2 font-medium">{weighted ? "Top set" : "Best set"}</th>
                          <th className="py-2 font-medium">Total reps</th>
                          {weighted && <th className="py-2 font-medium">Volume</th>}
                          <th className="py-2 font-medium">Avg effort</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...hist].reverse().map((h) => (
                          <tr key={h.sessionId} className="cursor-pointer border-b border-line hover:bg-surface-2" onClick={() => setSessionId(h.sessionId)}>
                            <td className="py-2.5">
                              <button className="text-left text-accent hover:underline" onClick={() => setSessionId(h.sessionId)}>
                                {formatDate(h.date, { month: "short", day: "numeric", year: "2-digit" })}
                              </button>
                            </td>
                            <td className="tabular">{h.sets}</td>
                            <td className="tabular">{weighted ? `${h.topWeight !== null ? Math.round(h.topWeight * 10) / 10 : "—"} × ${h.repsAtTop ?? "—"}` : h.bestReps ?? "—"}</td>
                            <td className="tabular">{h.totalReps}</td>
                            {weighted && <td className="tabular">{Math.round(h.volume).toLocaleString()}</td>}
                            <td className="tabular">{h.avgEffort !== null ? h.avgEffort.toFixed(1) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </Card>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardTitle sub={`Strength + basketball-focused sessions per week vs your goal of ${state.profile.strengthPerWeek + state.profile.basketballPerWeek}`}>
                Consistency
              </CardTitle>
              <SimpleBarChart
                data={buckets}
                xKey="label"
                stacked
                series={[
                  { key: "strength", name: "Gym strength" },
                  { key: "basketball", name: "Basketball-focused" },
                ]}
                goal={state.profile.strengthPerWeek + state.profile.basketballPerWeek}
                label="Strength and basketball sessions per week"
              />
              <p className="mt-2 text-xs text-subtle">Light open gym and light driveway shooting count as practice, not as basketball-focused sessions.</p>
            </Card>
            <Card>
              <CardTitle sub="Completed sets per week, all exercises">Completed sets by week</CardTitle>
              <SimpleBarChart data={buckets} xKey="label" series={[{ key: "sets", name: "Sets", color: "var(--chart-2)" }]} label="Completed sets by week" />
            </Card>
            <Card>
              <CardTitle sub={`Weight × reps on strength exercises (${unit})`}>Weekly training volume</CardTitle>
              <SimpleBarChart data={buckets} xKey="label" series={[{ key: "volume", name: `Volume (${unit})` }]} label="Weekly training volume" valueSuffix={` ${unit}`} />
            </Card>
            <Card>
              <CardTitle icon={<HeartPulse size={16} />} sub="Minutes logged per week">
                Conditioning duration
              </CardTitle>
              <SimpleBarChart data={buckets} xKey="label" series={[{ key: "conditioningMin", name: "Minutes", color: "var(--chart-3)" }]} label="Conditioning minutes per week" valueSuffix=" min" />
              <p className="mt-3 text-xs text-subtle">
                Intervals completed:{" "}
                {buckets
                  .filter((b) => b.intervals > 0)
                  .map((b) => `${b.label}: ${b.intervals}`)
                  .join(" · ") || "none in this range"}
              </p>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardTitle icon={<Users size={16} />} sub="Open gym sessions attended per week">
                Open gym
              </CardTitle>
              {openGym.length === 0 ? (
                <p className="text-sm text-muted">No open gym attended in this range.</p>
              ) : (
                <>
                  <SimpleBarChart data={buckets} xKey="label" series={[{ key: "openGym", name: "Open gym", color: "var(--chart-3)" }]} label="Open gym sessions per week" />
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                    {(["light", "moderate", "hard"] as const).map((k) => (
                      <div key={k} className="rounded-xl bg-surface-2 p-2">
                        <dt className="text-[11px] capitalize text-subtle">{k}</dt>
                        <dd className="font-semibold tabular">{openGym.filter((o) => o.intensity === k).length}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-2 text-xs text-subtle">
                    {sum(openGym.map((o) => o.durationMin ?? 0))} min total · {openGym.filter((o) => o.format === "full-court").length} full-court ·{" "}
                    {openGym.filter((o) => o.format === "half-court").length} half-court · {openGym.filter((o) => o.format === "drills").length} drills
                  </p>
                </>
              )}
            </Card>
            <Card>
              <CardTitle icon={<House size={16} />} sub="From center-skills workouts and Home Court sessions">
                Center-skill practice totals
              </CardTitle>
              {skillPoints.length === 0 ? (
                <p className="text-sm text-muted">No skill work logged in this range.</p>
              ) : (
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(
                    [
                      ["Drop-step reps", `${center.dropStepReps}`, `L ${center.dropStepLeft} · R ${center.dropStepRight}`],
                      ["Jump hooks", `${center.hooks.makes}/${center.hooks.attempts}`, `L ${formatPct(center.hooks.left.pct)} · R ${formatPct(center.hooks.right.pct)}`],
                      ["Mikan / reverse", `${center.mikan.makes}/${center.mikan.attempts}`, formatPct(center.mikan.pct)],
                      ["Rebounding reps", `${center.reboundReps}`, ""],
                      ["Footwork reps", `${center.footworkReps}`, "pivots, slides, closeouts"],
                      ["Home drills done", `${center.drillsCompleted}`, "completion checkboxes"],
                    ] as const
                  ).map(([k, v, sub]) => (
                    <div key={k} className="rounded-xl bg-surface-2 p-2.5">
                      <dt className="text-[11px] text-subtle">{k}</dt>
                      <dd className="font-display text-xl font-bold tabular">{v}</dd>
                      {sub && <dd className="text-[11px] text-muted">{sub}</dd>}
                    </div>
                  ))}
                </dl>
              )}
            </Card>
          </div>

          {/* Shooting */}
          <Card className="mt-4">
            <CardTitle icon={<Target size={16} />} sub="Makes ÷ attempts × 100, from skills sessions and Day 4 workouts">
              Shooting percentages
            </CardTitle>
            {shootingByDrill.length === 0 ? (
              <p className="text-sm text-muted">No shooting attempts logged in this range.</p>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                <ul className="space-y-2.5">
                  {shootingByDrill.map(({ drill, t }) => (
                    <li key={drill.id}>
                      <button
                        onClick={() => setDrillId(drill.id)}
                        aria-pressed={activeDrill === drill.id}
                        className="flex w-full items-center justify-between gap-2 rounded-xl border border-line px-3 py-2.5 text-left text-sm hover:bg-surface-2 aria-pressed:border-accent/50 aria-pressed:bg-accent-soft"
                      >
                        <span className="font-medium">{drill.name}</span>
                        <span className="text-right tabular text-muted">
                          {t.makes}/{t.attempts} · <span className="font-semibold text-text">{formatPct(t.pct)}</span>
                          {(t.left.attempts > 0 || t.right.attempts > 0) && (
                            <span className="block text-[11px]">
                              L {formatPct(t.left.pct)} · R {formatPct(t.right.pct)}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-subtle">{state.skillDrills.find((d) => d.id === activeDrill)?.name} — % by day</p>
                  <SimpleLineChart data={drillSeries} xKey="label" series={[{ key: "pct", name: "Percentage" }]} domain={[0, 100]} label="Shooting percentage by day" valueSuffix="%" />
                </div>
              </div>
            )}
          </Card>

          {/* PRs */}
          <Card className="mt-4">
            <CardTitle icon={<Trophy size={16} />} sub="Recorded only when a session beats an earlier logged session. No estimated maxes.">
              Personal records
            </CardTitle>
            {prs.length === 0 ? (
              <p className="text-sm text-muted">No personal records in this range yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {prs.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.exerciseName}</span>
                      <span className="block text-xs text-subtle">
                        {formatDate(p.date)} ·{" "}
                        {p.kind === "heaviest-weight" ? "Heaviest working weight" : p.kind === "most-reps" ? "Most reps in a set" : "Best shooting %"}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold text-accent tabular">{p.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Sessions */}
          <Card className="mt-4">
            <CardTitle icon={<ListChecks size={16} />}>Workout history</CardTitle>
            {sessions.length === 0 ? (
              <p className="text-sm text-muted">No workouts in this range.</p>
            ) : (
              <ul className="divide-y divide-line">
                {[...sessions].reverse().map((s) => {
                  const t = sessionTotals(s);
                  return (
                    <li key={s.id}>
                      <button onClick={() => setSessionId(s.id)} className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-surface-2 sm:rounded-xl sm:px-2">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{s.workoutName}</span>
                          <span className="block text-xs text-subtle">
                            {formatDate(s.date, { weekday: "short", month: "short", day: "numeric" })} · {t.totalSets} sets · {Math.round(s.durationSec / 60)} min
                          </span>
                        </span>
                        {s.modified && <Badge tone="warn">Modified</Badge>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}

      <Modal
        open={!!openSession}
        onClose={closeSession}
        title={openSession?.workoutName ?? "Session"}
        size="lg"
        footer={
          openSession && (
            <>
              <Button variant="danger" onClick={() => setConfirmDelete(openSession.id)}>
                <Trash2 size={16} /> Delete session
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(openSession.id);
                  closeSession();
                }}
              >
                <Pencil size={16} /> Edit
              </Button>
              <Button variant="secondary" onClick={closeSession}>
                Close
              </Button>
            </>
          )
        }
      >
        {openSession && <SessionDetail session={openSession} />}
      </Modal>
      {editSession && <SessionEditor session={editSession} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        danger
        title="Delete this workout?"
        message="The session, its sets and any linked conditioning log will be permanently removed. Charts and records will update."
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmDelete) deleteWorkoutSession(confirmDelete);
          closeSession();
          toast("Workout deleted.");
        }}
      />
    </div>
  );
}

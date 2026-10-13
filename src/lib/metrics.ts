/**
 * Derived analytics. Everything here is computed from saved records — nothing
 * is stored, so dashboard numbers can never drift from the underlying logs.
 */
import type {
  AppState,
  ConditioningSession,
  Exercise,
  ISODate,
  LoggedSet,
  PersonalRecord,
  RecoveryEntry,
  SessionExercise,
  SkillMetricKey,
  WeightUnit,
  WorkoutSession,
} from "./types";
import { addDays, average, convertWeight, percentage, startOfWeek, sum, todayISO } from "./utils";

export type RangeKey = "7d" | "30d" | "8w" | "all";
export const RANGE_LABELS: Record<RangeKey, string> = { "7d": "7 days", "30d": "30 days", "8w": "8 weeks", all: "All time" };

export function rangeStart(range: RangeKey, today: ISODate = todayISO()): ISODate | null {
  if (range === "7d") return addDays(today, -6);
  if (range === "30d") return addDays(today, -29);
  if (range === "8w") return addDays(today, -55);
  return null;
}

export function inRange(date: ISODate, range: RangeKey): boolean {
  const start = rangeStart(range);
  return start === null || date >= start;
}

export function completedSessions(state: AppState): WorkoutSession[] {
  return state.workoutSessions
    .filter((s) => s.status === "completed")
    .sort((a, b) => (a.date === b.date ? a.startedAt.localeCompare(b.startedAt) : a.date.localeCompare(b.date)));
}

const STRENGTH_CATEGORIES = new Set(["Lower-body strength", "Upper-body strength", "Core", "Power and movement"]);

export function exerciseMap(state: AppState): Map<string, Exercise> {
  return new Map(state.exercises.map((e) => [e.id, e]));
}

export function isStrengthExercise(se: SessionExercise, lib: Map<string, Exercise>): boolean {
  const ex = lib.get(se.exerciseId);
  if (ex) return STRENGTH_CATEGORIES.has(ex.category);
  return se.trackingType === "weighted";
}

export function doneSets(se: SessionExercise): LoggedSet[] {
  return se.sets.filter((s) => s.completed);
}

export function countStrengthSets(sessions: WorkoutSession[], lib: Map<string, Exercise>): number {
  return sum(sessions.flatMap((s) => s.exercises.filter((e) => isStrengthExercise(e, lib)).map((e) => doneSets(e).length)));
}

export function sessionTotals(s: WorkoutSession) {
  const exercisesCompleted = s.exercises.filter((e) => e.status !== "skipped" && doneSets(e).length > 0).length;
  const totalSets = sum(s.exercises.map((e) => doneSets(e).length));
  return { exercisesCompleted, totalSets, skipped: s.exercises.filter((e) => e.status === "skipped").length };
}

function setWeightIn(set: LoggedSet, unit: WeightUnit): number | null {
  return set.weight === null ? null : convertWeight(set.weight, set.unit, unit);
}

/* ------------------------------ Exercise history ----------------------------- */

export interface ExerciseHistoryPoint {
  sessionId: string;
  date: ISODate;
  workoutName: string;
  sets: number;
  totalReps: number;
  topWeight: number | null;
  repsAtTop: number | null;
  bestReps: number | null;
  volume: number;
  avgEffort: number | null;
  setDetails: LoggedSet[];
}

export function exerciseHistory(state: AppState, exerciseId: string, unit: WeightUnit): ExerciseHistoryPoint[] {
  const out: ExerciseHistoryPoint[] = [];
  for (const s of completedSessions(state)) {
    for (const e of s.exercises) {
      if (e.exerciseId !== exerciseId) continue;
      const sets = doneSets(e);
      if (!sets.length) continue;
      let topWeight: number | null = null;
      let repsAtTop: number | null = null;
      for (const set of sets) {
        const w = setWeightIn(set, unit);
        if (w !== null && w > 0 && (topWeight === null || w > topWeight || (w === topWeight && (set.reps ?? 0) > (repsAtTop ?? 0)))) {
          topWeight = w;
          repsAtTop = set.reps;
        }
      }
      const reps = sets.map((x) => x.reps ?? 0);
      out.push({
        sessionId: s.id,
        date: s.date,
        workoutName: s.workoutName,
        sets: sets.length,
        totalReps: sum(reps),
        topWeight,
        repsAtTop,
        bestReps: reps.length ? Math.max(...reps) : null,
        volume: sum(sets.map((x) => (setWeightIn(x, unit) ?? 0) * (x.reps ?? 0))),
        avgEffort: average(sets.filter((x) => x.effort !== null).map((x) => x.effort!)),
        setDetails: sets,
      });
    }
  }
  return out;
}

/** Most recent completed performance of an exercise, for the active logger. */
export function previousPerformance(state: AppState, exerciseId: string, excludeSessionId?: string) {
  const sessions = completedSessions(state).filter((s) => s.id !== excludeSessionId);
  for (let i = sessions.length - 1; i >= 0; i--) {
    const e = sessions[i].exercises.find((x) => x.exerciseId === exerciseId && doneSets(x).length > 0);
    if (e) return { session: sessions[i], exercise: e, sets: doneSets(e) };
  }
  return null;
}

/** Exercises that have at least one completed set, most-logged first. */
export function loggedExercises(state: AppState): { id: string; name: string; sessions: number }[] {
  const counts = new Map<string, { name: string; sessions: number }>();
  for (const s of completedSessions(state)) {
    for (const e of s.exercises) {
      if (!doneSets(e).length) continue;
      const c = counts.get(e.exerciseId) ?? { name: e.name, sessions: 0 };
      c.sessions += 1;
      c.name = e.name;
      counts.set(e.exerciseId, c);
    }
  }
  return [...counts.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.sessions - a.sessions);
}

/* ------------------------------- Skill results ------------------------------- */

export interface SkillPoint {
  date: ISODate;
  drillId: string;
  drillName: string;
  values: Partial<Record<SkillMetricKey, number>>;
  source: "skill-session" | "workout";
  sourceId: string;
}

function add(values: Partial<Record<SkillMetricKey, number>>, key: SkillMetricKey, n: number | null) {
  if (n === null || !Number.isFinite(n)) return;
  values[key] = (values[key] ?? 0) + n;
}

/** Converts a workout's skill exercise sets into drill metric values. */
function workoutSkillValues(e: SessionExercise, drillMetrics: SkillMetricKey[]) {
  const values: Partial<Record<SkillMetricKey, number>> = {};
  for (const set of doneSets(e)) {
    if (drillMetrics.includes("accurate")) {
      add(values, "accurate", set.makes);
      add(values, "total", set.attempts);
      continue;
    }
    if (drillMetrics.includes("leftReps")) {
      const key: SkillMetricKey = set.side === "left" ? "leftReps" : set.side === "right" ? "rightReps" : "reps";
      add(values, key, set.reps);
      continue;
    }
    const byHand = drillMetrics.includes("leftMakes");
    const prefix = byHand && set.side === "left" ? "left" : byHand && set.side === "right" ? "right" : "";
    add(values, (prefix ? `${prefix}Makes` : "makes") as SkillMetricKey, set.makes);
    add(values, (prefix ? `${prefix}Attempts` : "attempts") as SkillMetricKey, set.attempts);
  }
  return values;
}

export function allSkillPoints(state: AppState): SkillPoint[] {
  const drills = new Map(state.skillDrills.map((d) => [d.id, d]));
  const points: SkillPoint[] = [];
  for (const s of state.skillSessions) {
    for (const r of s.results) {
      points.push({ date: s.date, drillId: r.drillId, drillName: r.drillName, values: r.values, source: "skill-session", sourceId: s.id });
    }
  }
  for (const s of completedSessions(state)) {
    for (const e of s.exercises) {
      if (!e.skillDrillId || !doneSets(e).length) continue;
      const drill = drills.get(e.skillDrillId);
      if (!drill) continue;
      const values = workoutSkillValues(e, drill.metrics);
      points.push({ date: s.date, drillId: drill.id, drillName: drill.name, values, source: "workout", sourceId: s.id });
      if (drill.id === "drill-outlet" && values.total) {
        points.push({
          date: s.date,
          drillId: "drill-rebounding",
          drillName: drills.get("drill-rebounding")?.name ?? "Rebounding drills",
          values: { reps: values.total },
          source: "workout",
          sourceId: s.id,
        });
      }
    }
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

export interface ShotTotals {
  makes: number;
  attempts: number;
  pct: number | null;
  left: { makes: number; attempts: number; pct: number | null };
  right: { makes: number; attempts: number; pct: number | null };
}

export function shotTotals(values: Partial<Record<SkillMetricKey, number>>[]): ShotTotals {
  const g = (k: SkillMetricKey) => sum(values.map((v) => v[k] ?? 0));
  const lm = g("leftMakes"),
    la = g("leftAttempts"),
    rm = g("rightMakes"),
    ra = g("rightAttempts");
  const makes = g("makes") + lm + rm + g("accurate");
  const attempts = g("attempts") + la + ra + g("total");
  return {
    makes,
    attempts,
    pct: percentage(makes, attempts),
    left: { makes: lm, attempts: la, pct: percentage(lm, la) },
    right: { makes: rm, attempts: ra, pct: percentage(rm, ra) },
  };
}

export function hasShotMetrics(metrics: SkillMetricKey[]) {
  return metrics.some((m) => ["makes", "attempts", "leftMakes", "rightMakes", "accurate"].includes(m));
}

/* ------------------------------- Personal records ---------------------------- */

const MIN_ATTEMPTS_FOR_PCT_PR = 10;

/**
 * A personal record is only recognised when a session beats at least one
 * earlier logged session of the same exercise/drill. A first-ever log is a
 * baseline, not a record. No estimated maxes are calculated.
 */
export function personalRecords(state: AppState): PersonalRecord[] {
  const unit = state.profile.units;
  const lib = exerciseMap(state);
  const records: PersonalRecord[] = [];
  for (const { id } of loggedExercises(state)) {
    const hist = exerciseHistory(state, id, unit);
    if (hist.length < 2) continue;
    const ex = lib.get(id);
    const name = hist[hist.length - 1] ? ex?.name ?? id : id;
    const tracking = ex?.trackingType ?? "weighted";
    if (tracking === "shooting" || tracking === "timed" || tracking === "distance") continue;
    let bestW: number | null = null;
    let bestReps: number | null = null;
    hist.forEach((h, i) => {
      if (h.topWeight !== null) {
        if (i > 0 && bestW !== null && h.topWeight > bestW) {
          records.push({
            id: `pr-w-${h.sessionId}-${id}`,
            exerciseId: id,
            exerciseName: name,
            kind: "heaviest-weight",
            value: h.topWeight,
            previous: bestW,
            label: `${round1(h.topWeight)} ${unit} × ${h.repsAtTop ?? "—"}`,
            date: h.date,
            sourceId: h.sessionId,
          });
        }
        bestW = bestW === null ? h.topWeight : Math.max(bestW, h.topWeight);
      } else if (h.bestReps !== null) {
        if (i > 0 && bestReps !== null && h.bestReps > bestReps) {
          records.push({
            id: `pr-r-${h.sessionId}-${id}`,
            exerciseId: id,
            exerciseName: name,
            kind: "most-reps",
            value: h.bestReps,
            previous: bestReps,
            label: `${h.bestReps} reps in a set`,
            date: h.date,
            sourceId: h.sessionId,
          });
        }
        bestReps = bestReps === null ? h.bestReps : Math.max(bestReps, h.bestReps);
      }
    });
  }

  // Shooting percentage records per drill, per day, with a minimum sample size.
  const byDrillDay = new Map<string, { drillName: string; date: ISODate; values: SkillPoint["values"][]; sourceId: string }>();
  for (const p of allSkillPoints(state)) {
    const key = `${p.drillId}|${p.date}`;
    const entry = byDrillDay.get(key) ?? { drillName: p.drillName, date: p.date, values: [], sourceId: p.sourceId };
    entry.values.push(p.values);
    byDrillDay.set(key, entry);
  }
  const perDrill = new Map<string, { drillName: string; date: ISODate; pct: number; sourceId: string; attempts: number; makes: number }[]>();
  for (const [key, entry] of byDrillDay) {
    const drillId = key.split("|")[0];
    const t = shotTotals(entry.values);
    if (t.pct === null || t.attempts < MIN_ATTEMPTS_FOR_PCT_PR) continue;
    const list = perDrill.get(drillId) ?? [];
    list.push({ drillName: entry.drillName, date: entry.date, pct: t.pct, sourceId: entry.sourceId, attempts: t.attempts, makes: t.makes });
    perDrill.set(drillId, list);
  }
  for (const [drillId, list] of perDrill) {
    list.sort((a, b) => a.date.localeCompare(b.date));
    let best: number | null = null;
    list.forEach((d, i) => {
      if (i > 0 && best !== null && d.pct > best) {
        records.push({
          id: `pr-p-${drillId}-${d.date}`,
          exerciseId: drillId,
          exerciseName: d.drillName,
          kind: "best-percentage",
          value: d.pct,
          previous: best,
          label: `${d.makes}/${d.attempts} (${d.pct}%)`,
          date: d.date,
          sourceId: d.sourceId,
        });
      }
      best = best === null ? d.pct : Math.max(best, d.pct);
    });
  }
  return records.sort((a, b) => b.date.localeCompare(a.date));
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/** Exercises whose latest top working weight is above their first logged one. */
export function strengthImprovements(state: AppState) {
  const unit = state.profile.units;
  const out: { exerciseId: string; name: string; from: number; to: number; fromDate: ISODate; toDate: ISODate }[] = [];
  for (const { id, name } of loggedExercises(state)) {
    const hist = exerciseHistory(state, id, unit).filter((h) => h.topWeight !== null);
    if (hist.length < 2) continue;
    const first = hist[0];
    const last = hist[hist.length - 1];
    if (last.topWeight! > first.topWeight!) {
      out.push({ exerciseId: id, name, from: round1(first.topWeight!), to: round1(last.topWeight!), fromDate: first.date, toDate: last.date });
    }
  }
  return out.sort((a, b) => b.toDate.localeCompare(a.toDate));
}

/* ----------------------------------- Weekly ---------------------------------- */

export interface WeekBucket {
  weekStart: ISODate;
  label: string;
  workouts: number;
  /** Gym strength workouts. */
  strength: number;
  /** Planned basketball workouts (center skills, speed & defense). */
  courtWorkouts: number;
  openGym: number;
  openGymMin: number;
  homeSessions: number;
  /** Basketball-focused sessions (light open gym / light home shooting excluded). */
  basketball: number;
  skillSessions: number;
  conditioning: number;
  sets: number;
  volume: number;
  conditioningMin: number;
  intervals: number;
}

export function weeklyBuckets(state: AppState, weeks: number, today: ISODate = todayISO()): WeekBucket[] {
  const lib = exerciseMap(state);
  const unit = state.profile.units;
  const first = addDays(startOfWeek(today), -7 * (weeks - 1));
  const buckets: WeekBucket[] = Array.from({ length: weeks }, (_, i) => {
    const ws = addDays(first, i * 7);
    const [, m, d] = ws.split("-");
    return { weekStart: ws, label: `${Number(m)}/${Number(d)}`, workouts: 0, strength: 0, courtWorkouts: 0, openGym: 0, openGymMin: 0, homeSessions: 0, basketball: 0, skillSessions: 0, conditioning: 0, sets: 0, volume: 0, conditioningMin: 0, intervals: 0 };
  });
  const find = (date: ISODate) => buckets.find((b) => date >= b.weekStart && date <= addDays(b.weekStart, 6));
  for (const s of completedSessions(state)) {
    const b = find(s.date);
    if (!b) continue;
    b.workouts += 1;
    if (s.kind === "strength") b.strength += 1;
    else if (s.kind === "basketball") b.courtWorkouts += 1;
    else if (s.exercises.some((e) => isStrengthExercise(e, lib))) b.strength += 1;
    else b.courtWorkouts += 1;
    if (s.kind === "basketball" || (s.kind === "custom" && !s.exercises.some((e) => isStrengthExercise(e, lib)))) b.basketball += 1;
    b.sets += sum(s.exercises.map((e) => doneSets(e).length));
    for (const e of s.exercises) {
      if (!isStrengthExercise(e, lib)) continue;
      b.volume += sum(doneSets(e).map((x) => (setWeightIn(x, unit) ?? 0) * (x.reps ?? 0)));
    }
  }
  for (const s of state.skillSessions) {
    const b = find(s.date);
    if (!b) continue;
    if (s.kind === "home-court") {
      b.homeSessions += 1;
      if (s.intensity !== "light") b.basketball += 1;
    } else b.skillSessions += 1;
  }
  for (const o of state.openGymSessions ?? []) {
    if (o.status !== "attended") continue;
    const b = find(o.date);
    if (!b) continue;
    b.openGym += 1;
    b.openGymMin += o.durationMin ?? 0;
    if (o.intensity !== "light") b.basketball += 1;
  }
  for (const c of state.conditioningSessions) {
    const b = find(c.date);
    if (!b) continue;
    b.conditioning += 1;
    b.conditioningMin += c.totalDurationMin;
    b.intervals += c.completedRounds ?? 0;
  }
  buckets.forEach((b) => (b.volume = Math.round(b.volume)));
  return buckets;
}

export function workoutsThisWeek(state: AppState, today: ISODate = todayISO()): number {
  const ws = startOfWeek(today);
  const we = addDays(ws, 6);
  return completedSessions(state).filter((s) => s.date >= ws && s.date <= we).length;
}

/* -------------------------------- Conditioning ------------------------------- */

export function conditioningSorted(state: AppState): ConditioningSession[] {
  return [...state.conditioningSessions].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

/* ---------------------------------- Recovery --------------------------------- */

export function recoverySorted(state: AppState): RecoveryEntry[] {
  return [...state.recoveryEntries].sort((a, b) => a.date.localeCompare(b.date));
}

export function latestRecovery(state: AppState): RecoveryEntry | null {
  const list = recoverySorted(state);
  return list.length ? list[list.length - 1] : null;
}

function avgOf(entries: RecoveryEntry[], key: "sleepHours" | "sleepQuality" | "energy" | "soreness" | "readiness" | "fatigue") {
  return average(entries.map((e) => e[key]).filter((v): v is number => v !== null && v !== undefined));
}

export function recoveryAverages(entries: RecoveryEntry[]) {
  return {
    sleepHours: avgOf(entries, "sleepHours"),
    sleepQuality: avgOf(entries, "sleepQuality"),
    energy: avgOf(entries, "energy"),
    soreness: avgOf(entries, "soreness"),
    readiness: avgOf(entries, "readiness"),
    fatigue: avgOf(entries, "fatigue"),
  };
}

export type AdviceLevel = "good" | "caution" | "low";

/**
 * Conservative, non-medical training suggestions from a check-in. Never
 * diagnoses — only suggests reducing load or choosing lower-impact options.
 */
export function recoveryAdvice(entry: RecoveryEntry | null): { level: AdviceLevel; title: string; tips: string[] } | null {
  if (!entry) return null;
  const tips: string[] = [];
  let score = 0;
  const has = (v: number | null | undefined): v is number => v !== null && v !== undefined;
  if (has(entry.readiness) && entry.readiness <= 2) score += 2;
  if (has(entry.energy) && entry.energy <= 2) score += 1;
  if (has(entry.soreness) && entry.soreness >= 4) score += 2;
  if (has(entry.fatigue) && entry.fatigue >= 4) score += 2;
  if (has(entry.sleepQuality) && entry.sleepQuality <= 2) score += 1;
  if (has(entry.sleepHours) && entry.sleepHours < 6) score += 1;

  if (score >= 4) {
    tips.push("Consider reducing session volume — drop one set from each exercise.");
    tips.push("Choose the low-impact conditioning option (bike or elliptical) or skip the finisher.");
    tips.push("Keep effort controlled; it's fine to make today an active-recovery day.");
    if ((entry.soreness ?? 0) >= 4) tips.push("If any soreness feels like pain rather than normal training soreness, check with a qualified professional before training it.");
    return { level: "low", title: "Take it easier today", tips };
  }
  if (score >= 2) {
    tips.push("Train as planned but keep about three reps in reserve rather than two.");
    tips.push("Hold off on any progression (load, sprint intensity or extra rounds) today.");
    if ((entry.soreness ?? 0) >= 4) tips.push("Favor low-impact movement for conditioning.");
    return { level: "caution", title: "Train, but stay conservative", tips };
  }
  tips.push("Recovery looks good — train as planned with good technique.");
  return { level: "good", title: "Ready to train", tips };
}

/* ------------------------------- Recent activity ----------------------------- */

export interface ActivityItem {
  id: string;
  date: ISODate;
  sortKey: string;
  kind: "workout" | "skills" | "home" | "open-gym" | "conditioning" | "recovery";
  title: string;
  detail: string;
  href: string;
}

export function recentActivity(state: AppState, limit = 8): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const s of completedSessions(state)) {
    const t = sessionTotals(s);
    items.push({
      id: s.id,
      date: s.date,
      sortKey: s.endedAt ?? s.startedAt,
      kind: "workout",
      title: s.workoutName,
      detail: `${t.exercisesCompleted} exercises · ${t.totalSets} sets · ${Math.round(s.durationSec / 60)} min${s.modified ? " · modified" : ""}`,
      href: `/progress?session=${s.id}`,
    });
  }
  for (const s of state.skillSessions) {
    const t = shotTotals(s.results.map((r) => r.values));
    const isHome = s.kind === "home-court";
    items.push({
      id: s.id,
      date: s.date,
      sortKey: s.createdAt,
      kind: isHome ? "home" : "skills",
      title: isHome ? "Home Court session" : "Skills session",
      detail: [
        `${s.results.length} drill${s.results.length === 1 ? "" : "s"}`,
        t.attempts ? `${t.makes}/${t.attempts} shots` : null,
        s.durationMin ? `${s.durationMin} min` : null,
        s.intensity ?? null,
      ]
        .filter(Boolean)
        .join(" · "),
      href: isHome ? "/home-court" : "/skills",
    });
  }
  for (const o of state.openGymSessions ?? []) {
    if (o.status !== "attended") continue;
    items.push({
      id: o.id,
      date: o.date,
      sortKey: o.createdAt,
      kind: "open-gym",
      title: "Open gym",
      detail: [o.format?.replace("-", " "), o.durationMin ? `${o.durationMin} min` : null, o.intensity].filter(Boolean).join(" · "),
      href: "/open-gym",
    });
  }
  for (const c of state.conditioningSessions) {
    if (c.workoutSessionId) continue;
    items.push({
      id: c.id,
      date: c.date,
      sortKey: c.createdAt,
      kind: "conditioning",
      title: `${c.activityType === "custom" ? c.customName || "Custom" : capitalize(c.activityType)} conditioning`,
      detail: `${c.totalDurationMin} min${c.completedRounds !== null ? ` · ${c.completedRounds} rounds` : ""} · effort ${c.effort}/10`,
      href: "/conditioning",
    });
  }
  for (const r of state.recoveryEntries) {
    items.push({
      id: r.id,
      date: r.date,
      sortKey: r.updatedAt,
      kind: "recovery",
      title: "Recovery check-in",
      detail:
        [
          r.readiness !== null ? `readiness ${r.readiness}/5` : null,
          r.energy !== null ? `energy ${r.energy}/5` : null,
          r.soreness !== null ? `soreness ${r.soreness}/5` : null,
          r.fatigue != null ? `fatigue ${r.fatigue}/5` : null,
          r.sleepHours !== null ? `${r.sleepHours} h sleep` : null,
        ]
          .filter(Boolean)
          .join(" · ") || (r.dayType === "rest" ? "Rest day" : "Check-in"),
      href: "/recovery",
    });
  }
  return items.sort((a, b) => b.date.localeCompare(a.date) || b.sortKey.localeCompare(a.sortKey)).slice(0, limit);
}

export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function hasAnyHistory(state: AppState) {
  return (
    state.workoutSessions.some((s) => s.status === "completed") ||
    state.skillSessions.length > 0 ||
    state.conditioningSessions.length > 0 ||
    (state.openGymSessions ?? []).some((o) => o.status === "attended") ||
    state.recoveryEntries.length > 0
  );
}

/* ------------------------------- Weekly balance ------------------------------ */

export interface WeekSummary {
  weekStart: ISODate;
  strengthDone: number;
  basketballDone: number;
  openGymAttended: number;
  openGymPlanned: number;
  homeSessions: number;
  lightHomeSessions: number;
  /** Minutes of basketball (open gym + skills workouts + home sessions). */
  basketballMinutes: number;
  hardSessions: number;
  hardRunning: boolean;
}

/**
 * How the week is actually going. Basketball-focused sessions are basketball
 * workouts, attended open gym (not light), and Home Court sessions that
 * weren't light. Light driveway shooting counts as practice only.
 */
export function weekSummary(state: AppState, date: ISODate = todayISO()): WeekSummary {
  const ws = startOfWeek(date);
  const we = addDays(ws, 6);
  const inWeek = (d: ISODate) => d >= ws && d <= we;
  const sessions = completedSessions(state).filter((s) => inWeek(s.date));
  const lib = exerciseMap(state);
  const og = (state.openGymSessions ?? []).filter((o) => inWeek(o.date));
  const attended = og.filter((o) => o.status === "attended");
  const homes = state.skillSessions.filter((s) => s.kind === "home-court" && inWeek(s.date));
  const isStrength = (s: WorkoutSession) => s.kind === "strength" || (s.kind === "custom" && s.exercises.some((e) => isStrengthExercise(e, lib)));
  const bbWorkouts = sessions.filter((s) => !isStrength(s));
  return {
    weekStart: ws,
    strengthDone: sessions.filter(isStrength).length,
    basketballDone: bbWorkouts.length + attended.filter((o) => o.intensity !== "light").length + homes.filter((h) => h.intensity !== "light").length,
    openGymAttended: attended.length,
    openGymPlanned: og.filter((o) => o.status === "planned").length,
    homeSessions: homes.length,
    lightHomeSessions: homes.filter((h) => h.intensity === "light").length,
    basketballMinutes:
      sum(attended.map((o) => o.durationMin ?? 0)) + sum(homes.map((h) => h.durationMin ?? 0)) + sum(bbWorkouts.map((s) => Math.round(s.durationSec / 60))),
    hardSessions: hardSessionDates(state, ws, we).length,
    hardRunning: attended.some((o) => o.hardRunning || (o.format === "full-court" && o.intensity === "hard")),
  };
}

/** Dates of hard sessions in a range — used to spot accumulated fatigue. */
export function hardSessionDates(state: AppState, from: ISODate, to: ISODate): ISODate[] {
  const inR = (d: ISODate) => d >= from && d <= to;
  const dates: ISODate[] = [];
  for (const o of state.openGymSessions ?? []) {
    if (o.status === "attended" && inR(o.date) && (o.intensity === "hard" || (o.effort ?? 0) >= 8)) dates.push(o.date);
  }
  for (const s of completedSessions(state)) if (inR(s.date) && s.intensity === "hard") dates.push(s.date);
  for (const h of state.skillSessions) if (inR(h.date) && h.intensity === "hard") dates.push(h.date);
  for (const c of state.conditioningSessions) if (inR(c.date) && !c.workoutSessionId && c.effort >= 8) dates.push(c.date);
  return dates.sort();
}

/* ---------------------------- Center-skill totals ---------------------------- */

export function centerSkillTotals(points: SkillPoint[], state: AppState) {
  const by = (id: string) => points.filter((p) => p.drillId === id).map((p) => p.values);
  const g = (vals: SkillPoint["values"][], k: SkillMetricKey) => sum(vals.map((v) => v[k] ?? 0));
  const drop = by("drill-drop-steps");
  const hooks = shotTotals(by("drill-jump-hooks"));
  const mikan = shotTotals([...by("drill-mikan"), ...by("drill-reverse-mikan")]);
  const outlet = by("drill-outlet");
  const homeCompletions = state.skillSessions
    .filter((s) => s.kind === "home-court" && points.some((p) => p.sourceId === s.id))
    .flatMap((s) => s.results)
    .filter((r) => r.completed).length;
  return {
    dropStepReps: g(drop, "leftReps") + g(drop, "rightReps") + g(drop, "reps"),
    dropStepLeft: g(drop, "leftReps"),
    dropStepRight: g(drop, "rightReps"),
    hooks,
    mikan,
    reboundReps: g(outlet, "total") + g(by("drill-rebounding"), "reps"),
    footworkReps: sum(["drill-pivots", "drill-def-footwork", "drill-closeouts"].map((id) => g(by(id), "reps"))),
    drillsCompleted: homeCompletions,
  };
}

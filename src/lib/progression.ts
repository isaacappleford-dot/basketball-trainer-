/**
 * Conservative 8-week progression engine.
 *
 * Rules:
 * - Weeks 1–2: establish baselines; no progressions.
 * - Weeks 3–4: add reps within the range; optionally 8 → 10 conditioning rounds when recovery is good.
 * - Weeks 5–6: smallest load increase only when every prescribed rep was completed with ≈2 reps in reserve (effort ≤ 8).
 * - Weeks 7–8: consolidate; suggest reduced volume if recovery trends down.
 * - Never applied automatically — the athlete confirms each suggestion.
 * - Lifting load and conditioning volume are never progressed in the same week,
 *   and nothing progresses while recent check-ins suggest low recovery.
 */
import type { AppState, PlannedExercise, ProgressionDecision, WeightUnit } from "./types";
import { exerciseMap, latestRecovery, previousPerformance, recoveryAdvice, recoveryAverages, recoverySorted, conditioningSorted } from "./metrics";
import { weekInfo, type WeekInfo } from "./schedule";
import { convertWeight, daysBetween, roundWeight, todayISO } from "./utils";

export interface Suggestion {
  id: string;
  targetId: string;
  targetName: string;
  kind: "load" | "reps" | "rounds" | "volume";
  from: number;
  to: number;
  unit: string;
  reason: string;
  decision: ProgressionDecision | null;
}

export interface ProgressionReport {
  week: WeekInfo;
  headline: string;
  holdReason: string | null;
  suggestions: Suggestion[];
  notes: string[];
}

function smallestIncrement(lb: number | undefined, unit: WeightUnit): number {
  if (unit === "kg") return lb && lb >= 10 ? 5 : 2.5;
  return lb ?? 5;
}

function decisionFor(state: AppState, targetId: string, kind: ProgressionDecision["kind"], calendarWeek: number) {
  return state.progressionDecisions.find((d) => d.targetId === targetId && d.kind === kind && d.calendarWeek === calendarWeek) ?? null;
}

/** Latest accepted load target for an exercise, converted to `unit`. */
export function acceptedLoadTarget(state: AppState, exerciseId: string, unit: WeightUnit): number | null {
  const d = [...state.progressionDecisions]
    .filter((x) => x.targetId === exerciseId && x.kind === "load" && x.status === "accepted")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!d) return null;
  return roundWeight(convertWeight(d.to, d.unit as WeightUnit, unit), unit);
}

/** Planned conditioning rounds after accepted progressions and deloads. */
export function plannedRounds(state: AppState, baseRounds: number, reduced: boolean): number {
  const accepted = [...state.progressionDecisions]
    .filter((x) => x.targetId === "conditioning" && x.kind === "rounds" && x.status === "accepted")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const rounds = accepted ? Math.max(baseRounds, accepted.to) : baseRounds;
  return reduced ? Math.max(4, rounds - 2) : rounds;
}

function recentRecoveryLevel(state: AppState) {
  const latest = latestRecovery(state);
  if (!latest || daysBetween(latest.date, todayISO()) > 2) return null;
  return recoveryAdvice(latest)?.level ?? null;
}

function evaluateExercise(state: AppState, pe: PlannedExercise, unit: WeightUnit) {
  const prev = previousPerformance(state, pe.exerciseId);
  if (!prev) return null;
  const sets = prev.sets;
  const allSetsDone = sets.length >= pe.sets;
  const minReps = Math.min(...sets.map((s) => s.reps ?? 0));
  const efforts = sets.map((s) => s.effort);
  const effortLogged = efforts.every((e) => e !== null);
  const maxEffort = effortLogged ? Math.max(...(efforts as number[])) : null;
  const weights = sets.map((s) => (s.weight === null ? null : convertWeight(s.weight, s.unit, unit)));
  const topWeight = weights.every((w) => w !== null) ? Math.min(...(weights as number[])) : null;
  return { prev, allSetsDone, minReps, maxEffort, effortLogged, topWeight };
}

export function progressionReport(state: AppState): ProgressionReport {
  const week = weekInfo(state);
  const unit = state.profile.units;
  const lib = exerciseMap(state);
  const suggestions: Suggestion[] = [];
  const notes: string[] = [];
  const cw = week.calendarWeek;

  if (week.status === "not-started") {
    return { week, headline: "Your plan hasn't started yet.", holdReason: "Progressions begin once you have logged baseline sessions.", suggestions, notes };
  }

  const recovery = recentRecoveryLevel(state);
  const weekDecisions = state.progressionDecisions.filter((d) => d.calendarWeek === cw && d.status === "accepted");
  const loadAcceptedThisWeek = weekDecisions.some((d) => d.kind === "load");
  const roundsAcceptedThisWeek = weekDecisions.some((d) => d.kind === "rounds");

  let holdReason: string | null = null;
  if (week.deload) holdReason = "This is a deload week — volume is reduced and no progressions are suggested.";
  else if (recovery === "low" || recovery === "caution")
    holdReason = "Your latest recovery check-in suggests holding steady. Progressions resume when readiness improves.";

  const pw = week.planWeek;
  let headline = week.phase ? week.phase.focus : "";

  if (!holdReason) {
    const exercises = state.plan.workouts.flatMap((w) => w.exercises.filter((e) => e.role === "main" || e.role === "accessory"));
    if (pw <= 2) {
      headline = "Baseline weeks: learn the movements and log honest numbers. No progressions yet.";
    } else if (pw <= 4) {
      for (const pe of exercises) {
        const ex = lib.get(pe.exerciseId);
        if (!ex || (ex.trackingType !== "weighted" && ex.trackingType !== "bodyweight" && ex.trackingType !== "reps-side")) continue;
        const ev = evaluateExercise(state, pe, unit);
        if (!ev || !ev.allSetsDone) continue;
        if (ev.minReps >= pe.repMin && ev.minReps < pe.repMax && (ev.maxEffort === null || ev.maxEffort <= 8)) {
          const to = Math.min(pe.repMax, ev.minReps + 1);
          suggestions.push({
            id: `reps-${pe.exerciseId}-${cw}`,
            targetId: pe.exerciseId,
            targetName: ex.name,
            kind: "reps",
            from: ev.minReps,
            to,
            unit: "reps",
            reason: `Last session you completed all ${ev.prev.sets.length} sets with at least ${ev.minReps} reps${ev.maxEffort !== null ? ` at effort ≤ ${ev.maxEffort}/10` : ""}. Aim for ${to} reps per set at the same weight before adding load.`,
            decision: decisionFor(state, pe.exerciseId, "reps", cw),
          });
        }
      }
      if (!loadAcceptedThisWeek) {
        const lastCond = conditioningSorted(state).slice(-1)[0];
        const base = 8;
        const current = plannedRounds(state, base, false);
        const recent = recoverySorted(state).slice(-3);
        const avgReady = recoveryAverages(recent).readiness;
        if (current < 10 && lastCond && (lastCond.completedRounds ?? 0) >= (lastCond.plannedRounds ?? base) && lastCond.effort <= 7 && avgReady !== null && avgReady >= 3.5) {
          suggestions.push({
            id: `rounds-${cw}`,
            targetId: "conditioning",
            targetName: "Interval conditioning",
            kind: "rounds",
            from: current,
            to: 10,
            unit: "rounds",
            reason: `You completed all ${lastCond.plannedRounds ?? base} rounds last time at effort ${lastCond.effort}/10 and your recent readiness averages ${avgReady.toFixed(1)}/5. Optionally progress to 10 rounds while keeping effort controlled.`,
            decision: decisionFor(state, "conditioning", "rounds", cw),
          });
        } else if (current < 10) {
          notes.push(
            "Conditioning stays at 8 rounds until you complete all rounds at effort ≤ 7/10 with recent readiness averaging 3.5/5 or better (log recovery check-ins to unlock this).",
          );
        }
      }
    } else if (pw <= 6) {
      if (roundsAcceptedThisWeek) {
        holdReason = "You progressed conditioning this week, so lifting loads stay the same until next week.";
      } else {
        for (const pe of exercises) {
          const ex = lib.get(pe.exerciseId);
          if (!ex || ex.trackingType !== "weighted") continue;
          const ev = evaluateExercise(state, pe, unit);
          if (!ev || ev.topWeight === null || ev.topWeight <= 0) continue;
          if (!ev.allSetsDone || ev.minReps < pe.repMax) continue;
          if (!ev.effortLogged) {
            notes.push(`${ex.name}: log effort on each set to unlock load suggestions (needed to confirm about two reps in reserve).`);
            continue;
          }
          if (ev.maxEffort! > 8) continue;
          const inc = smallestIncrement(ex.incrementLb, unit);
          const from = roundWeight(ev.topWeight, unit);
          const already = acceptedLoadTarget(state, pe.exerciseId, unit);
          if (already !== null && already > from) continue; // already progressed, not yet performed
          suggestions.push({
            id: `load-${pe.exerciseId}-${cw}`,
            targetId: pe.exerciseId,
            targetName: ex.name,
            kind: "load",
            from,
            to: from + inc,
            unit,
            reason: `All ${pe.sets} sets reached the top of the ${pe.repsLabel} range at effort ≤ ${ev.maxEffort}/10 (about two reps in reserve). Add the smallest increment (${inc} ${unit}) and drop back toward ${pe.repMin} reps.`,
            decision: decisionFor(state, pe.exerciseId, "load", cw),
          });
        }
        notes.push("Conditioning volume and sprint intensity are held steady while lifting loads progress.");
      }
    } else {
      headline = "Consolidation weeks: repeat your best working loads with great technique and review your progress.";
      const avg = recoveryAverages(recoverySorted(state).slice(-5));
      if (avg.readiness !== null && avg.readiness < 3) {
        suggestions.push({
          id: `volume-${cw}`,
          targetId: "volume",
          targetName: "Session volume",
          kind: "volume",
          from: 0,
          to: -1,
          unit: "set per exercise",
          reason: `Your last check-ins average ${avg.readiness.toFixed(1)}/5 readiness. Consider a deload — one fewer set per exercise this week.`,
          decision: null,
        });
      }
    }
  }

  return { week, headline, holdReason, suggestions, notes };
}

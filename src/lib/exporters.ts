import type { AppState } from "./types";
import { allSkillPoints } from "./metrics";
import { percentage } from "./utils";

type Row = Record<string, string | number | boolean | null | undefined>;

function escape(v: Row[string]): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(rows: Row[]): string {
  if (!rows.length) return "";
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

export const CSV_DATASETS = {
  "workout-sets": {
    label: "Workout sets",
    rows: (s: AppState): Row[] =>
      s.workoutSessions
        .filter((w) => w.status === "completed")
        .flatMap((w) =>
          w.exercises.flatMap((e) =>
            (e.sets.length ? e.sets : [null]).map((set, i) => ({
              session_id: w.id,
              date: w.date,
              workout: w.workoutName,
              plan_week: w.planWeek,
              exercise: e.name,
              exercise_id: e.exerciseId,
              exercise_status: e.status,
              substituted_for: e.substitutedFrom?.name ?? "",
              set_number: set ? i + 1 : "",
              weight: set?.weight ?? "",
              unit: set?.unit ?? "",
              reps: set?.reps ?? "",
              duration_sec: set?.durationSec ?? "",
              distance: set?.distance ?? "",
              makes: set?.makes ?? "",
              attempts: set?.attempts ?? "",
              side: set?.side ?? "",
              effort: set?.effort ?? "",
              rest_sec: set?.restSec ?? "",
              set_notes: set?.notes ?? "",
              exercise_notes: e.notes,
              modified_reason: w.modified?.reason ?? "",
            })),
          ),
        ),
  },
  sessions: {
    label: "Workout sessions",
    rows: (s: AppState): Row[] =>
      s.workoutSessions
        .filter((w) => w.status === "completed")
        .map((w) => ({
          session_id: w.id,
          date: w.date,
          workout: w.workoutName,
          plan_week: w.planWeek,
          duration_min: Math.round(w.durationSec / 60),
          completed_sets: w.exercises.reduce((n, e) => n + e.sets.filter((x) => x.completed).length, 0),
          modified_reason: w.modified?.reason ?? "",
          notes: w.notes,
        })),
  },
  skills: {
    label: "Skills results",
    rows: (s: AppState): Row[] =>
      allSkillPoints(s).map((p) => {
        const v = p.values;
        const makes = (v.makes ?? 0) + (v.leftMakes ?? 0) + (v.rightMakes ?? 0) + (v.accurate ?? 0);
        const attempts = (v.attempts ?? 0) + (v.leftAttempts ?? 0) + (v.rightAttempts ?? 0) + (v.total ?? 0);
        return {
          date: p.date,
          drill: p.drillName,
          source: p.source,
          ...v,
          percentage: percentage(makes, attempts) ?? "",
        };
      }),
  },
  conditioning: {
    label: "Conditioning",
    rows: (s: AppState): Row[] =>
      s.conditioningSessions.map((c) => ({
        date: c.date,
        activity: c.activityType === "custom" ? c.customName : c.activityType,
        total_duration_min: c.totalDurationMin,
        work_sec: c.workSec,
        recovery_sec: c.recoverySec,
        planned_rounds: c.plannedRounds,
        completed_rounds: c.completedRounds,
        effort: c.effort,
        distance: c.distance,
        distance_unit: c.distance !== null ? c.distanceUnit : "",
        from_workout: !!c.workoutSessionId,
        notes: c.notes,
      })),
  },
  recovery: {
    label: "Recovery check-ins",
    rows: (s: AppState): Row[] =>
      s.recoveryEntries.map((r) => ({
        date: r.date,
        sleep_hours: r.sleepHours,
        sleep_quality: r.sleepQuality,
        energy: r.energy,
        soreness: r.soreness,
        readiness: r.readiness,
        day_type: r.dayType,
        notes: r.notes,
      })),
  },
} as const;

export type CsvDataset = keyof typeof CSV_DATASETS;

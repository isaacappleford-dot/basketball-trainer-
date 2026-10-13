import type { AppState, CalendarEvent, ISODate, PlanPhase, PlannedWorkout, WorkoutSession } from "./types";
import { addDays, daysBetween, startOfWeek, todayISO, weekdayOf } from "./utils";

/** Calendar week since the plan start date (1-based; ≤0 before the plan starts). */
export function calendarWeekOf(startDate: ISODate, date: ISODate): number {
  return Math.floor(daysBetween(startDate, date) / 7) + 1;
}

/** Plan week for a calendar week, accounting for repeated weeks. */
export function planWeekFor(state: AppState, calendarWeek: number): number {
  const repeats = state.plan.weekAdjustments.filter((a) => a.type === "repeat" && a.calendarWeek <= calendarWeek).length;
  return Math.max(1, calendarWeek - repeats);
}

export function isDeloadWeek(state: AppState, calendarWeek: number): boolean {
  return state.plan.weekAdjustments.some((a) => a.type === "deload" && a.calendarWeek === calendarWeek);
}

export function isRepeatWeek(state: AppState, calendarWeek: number): boolean {
  return state.plan.weekAdjustments.some((a) => a.type === "repeat" && a.calendarWeek === calendarWeek);
}

export function phaseFor(state: AppState, planWeek: number): PlanPhase | null {
  return state.plan.phases.find((p) => planWeek >= p.startWeek && planWeek <= p.endWeek) ?? null;
}

export interface WeekInfo {
  calendarWeek: number;
  planWeek: number;
  totalWeeks: number;
  phase: PlanPhase | null;
  deload: boolean;
  repeat: boolean;
  status: "not-started" | "active" | "finished";
  weekStart: ISODate;
}

export function weekInfo(state: AppState, date: ISODate = todayISO()): WeekInfo {
  const start = state.profile.planStartDate;
  const cw = calendarWeekOf(start, date);
  const pw = planWeekFor(state, cw);
  const weekStart = addDays(start, (cw - 1) * 7);
  const status = cw < 1 ? "not-started" : pw > state.plan.weeks ? "finished" : "active";
  return {
    calendarWeek: cw,
    planWeek: Math.min(Math.max(pw, 1), state.plan.weeks),
    totalWeeks: state.plan.weeks,
    phase: phaseFor(state, Math.min(Math.max(pw, 1), state.plan.weeks)),
    deload: isDeloadWeek(state, cw),
    repeat: isRepeatWeek(state, cw),
    status,
    weekStart,
  };
}

/* -------------------------------- Occurrences -------------------------------- */

export type OccurrenceStatus = "planned" | "completed" | "skipped" | "modified" | "missed";

export interface Occurrence {
  key: string;
  workout: PlannedWorkout;
  originalDate: ISODate;
  date: ISODate;
  moved: boolean;
  override: CalendarEvent | null;
  session: WorkoutSession | null;
  status: OccurrenceStatus;
}

export function occurrenceKey(plannedWorkoutId: string, originalDate: ISODate) {
  return `${plannedWorkoutId}@${originalDate}`;
}

function isWithinPlan(state: AppState, date: ISODate): boolean {
  const cw = calendarWeekOf(state.profile.planStartDate, date);
  return cw >= 1 && planWeekFor(state, cw) <= state.plan.weeks;
}

/** Planned workout occurrences between `from` and `to` (inclusive). */
export function occurrencesBetween(state: AppState, from: ISODate, to: ISODate): Occurrence[] {
  const overrides = state.calendarEvents.filter((e) => e.type === "workout" && e.plannedWorkoutId && e.originalDate);
  const overrideByKey = new Map(overrides.map((e) => [occurrenceKey(e.plannedWorkoutId!, e.originalDate!), e]));
  const workouts = new Map(state.plan.workouts.map((w) => [w.id, w]));
  const completed = state.workoutSessions.filter((s) => s.status === "completed");
  const today = todayISO();
  const result: Occurrence[] = [];

  const build = (workout: PlannedWorkout, originalDate: ISODate, override: CalendarEvent | null): Occurrence => {
    const date = override?.date ?? originalDate;
    const session =
      completed.find((s) => s.plannedWorkoutId === workout.id && s.scheduledDate === originalDate) ??
      completed.find((s) => s.plannedWorkoutId === workout.id && !s.scheduledDate && s.date === date) ??
      null;
    let status: OccurrenceStatus = "planned";
    if (session) status = session.modified ? "modified" : "completed";
    else if (override?.status === "skipped") status = "skipped";
    else if (override?.status === "modified") status = "modified";
    else if (date < today) status = "missed";
    return {
      key: occurrenceKey(workout.id, originalDate),
      workout,
      originalDate,
      date,
      moved: !!override && override.date !== originalDate,
      override,
      session,
      status,
    };
  };

  const span = daysBetween(from, to);
  for (let i = 0; i <= span; i++) {
    const date = addDays(from, i);
    if (!isWithinPlan(state, date)) continue;
    const dow = weekdayOf(date);
    for (const w of state.plan.workouts) {
      if (w.weekday !== dow) continue;
      const ov = overrideByKey.get(occurrenceKey(w.id, date)) ?? null;
      if (ov && ov.date !== date) continue; // moved elsewhere
      result.push(build(w, date, ov));
    }
  }
  // Occurrences moved into this range from outside it.
  for (const ov of overrides) {
    if (ov.date < from || ov.date > to || ov.date === ov.originalDate) continue;
    const w = workouts.get(ov.plannedWorkoutId!);
    if (!w) continue;
    result.push(build(w, ov.originalDate!, ov));
  }
  return result.sort((a, b) => (a.date === b.date ? a.workout.dayNumber - b.workout.dayNumber : a.date < b.date ? -1 : 1));
}

export function occurrencesOn(state: AppState, date: ISODate): Occurrence[] {
  return occurrencesBetween(state, date, date);
}

export function currentWeekOccurrences(state: AppState, date: ISODate = todayISO()): Occurrence[] {
  const ws = startOfWeek(date);
  return occurrencesBetween(state, ws, addDays(ws, 6));
}

/** The next planned (not completed/skipped) occurrence today or later. */
export function nextOccurrence(state: AppState, from: ISODate = todayISO()): Occurrence | null {
  const list = occurrencesBetween(state, from, addDays(from, 21));
  return list.find((o) => o.status === "planned") ?? null;
}

/**
 * Finds the occurrence a newly started session should fulfil: an explicit
 * date wins; otherwise the not-yet-completed occurrence of that workout this week.
 */
export function matchOccurrence(state: AppState, plannedWorkoutId: string, date: ISODate): Occurrence | null {
  const week = currentWeekOccurrences(state, date).filter(
    (o) => o.workout.id === plannedWorkoutId && !o.session,
  );
  return week.find((o) => o.date === date) ?? week[0] ?? null;
}

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

export type OccurrenceStatus = "planned" | "completed" | "replaced" | "skipped" | "modified" | "missed";

export interface Occurrence {
  key: string;
  /** Id of the workout originally planned in this slot (used for overrides). */
  plannedId: string;
  /** The workout to do — the planned one, or a swapped-in alternative. */
  workout: PlannedWorkout;
  swapped: boolean;
  originalDate: ISODate;
  date: ISODate;
  moved: boolean;
  override: CalendarEvent | null;
  session: WorkoutSession | null;
  /** Open gym or Home Court session explicitly linked to this slot. */
  fulfilledBy: { type: "open-gym" | "home"; id: string; label: string } | null;
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
  const openGym = (state.openGymSessions ?? []).filter((o) => o.status === "attended" && o.countsFor);
  const home = state.skillSessions.filter((s) => s.countsFor);
  const today = todayISO();
  const result: Occurrence[] = [];

  const build = (planned: PlannedWorkout, originalDate: ISODate, override: CalendarEvent | null): Occurrence => {
    const date = override?.date ?? originalDate;
    const workout = (override?.swapWorkoutId && workouts.get(override.swapWorkoutId)) || planned;
    const ids = new Set([planned.id, workout.id]);
    const key = occurrenceKey(planned.id, originalDate);
    const session =
      completed.find((s) => s.plannedWorkoutId && ids.has(s.plannedWorkoutId) && s.scheduledDate === originalDate) ??
      completed.find((s) => s.plannedWorkoutId && ids.has(s.plannedWorkoutId) && !s.scheduledDate && s.date === date) ??
      null;
    const og = openGym.find((o) => occurrenceKey(o.countsFor!.plannedWorkoutId, o.countsFor!.originalDate) === key);
    const hs = home.find((h) => occurrenceKey(h.countsFor!.plannedWorkoutId, h.countsFor!.originalDate) === key);
    const fulfilledBy = og
      ? { type: "open-gym" as const, id: og.id, label: "Open gym" }
      : hs
        ? { type: "home" as const, id: hs.id, label: "Home Court session" }
        : null;
    let status: OccurrenceStatus = "planned";
    if (session) status = session.modified ? "modified" : "completed";
    // Open gym / home work completes a basketball slot, but only "replaces" a strength slot.
    else if (fulfilledBy) status = workout.kind === "basketball" ? "completed" : "replaced";
    else if (override?.status === "skipped") status = "skipped";
    else if (override?.status === "modified") status = "modified";
    else if (date < today) status = "missed";
    return {
      key,
      plannedId: planned.id,
      workout,
      swapped: workout.id !== planned.id,
      originalDate,
      date,
      moved: !!override && override.date !== originalDate,
      override,
      session,
      fulfilledBy,
      status,
    };
  };

  const span = daysBetween(from, to);
  for (let i = 0; i <= span; i++) {
    const date = addDays(from, i);
    if (!isWithinPlan(state, date)) continue;
    const dow = weekdayOf(date);
    for (const w of state.plan.workouts) {
      if (w.weekday === null || w.weekday !== dow) continue;
      const ov = overrideByKey.get(occurrenceKey(w.id, date)) ?? null;
      if (ov && ov.date !== date) continue; // moved elsewhere
      result.push(build(w, date, ov));
    }
  }
  // Occurrences moved into this range from outside it.
  for (const ov of overrides) {
    if (ov.date < from || ov.date > to || ov.date === ov.originalDate) continue;
    if (ov.originalDate! >= from && ov.originalDate! <= to && result.some((r) => r.key === occurrenceKey(ov.plannedWorkoutId!, ov.originalDate!))) continue;
    const w = workouts.get(ov.plannedWorkoutId!);
    if (!w) continue;
    result.push(build(w, ov.originalDate!, ov));
  }
  return result.sort((a, b) => (a.date === b.date ? a.workout.dayNumber - b.workout.dayNumber : a.date < b.date ? -1 : 1));
}

/** Counts toward the weekly target (completed via a logged session or explicit substitution). */
export function isDone(o: Occurrence) {
  return o.status === "completed" || (o.status === "modified" && !!o.session);
}

export function daySlotFor(state: AppState, date: ISODate) {
  return state.plan.daySlots.find((d) => d.weekday === weekdayOf(date)) ?? null;
}

export function isOpenGymDay(state: AppState, date: ISODate) {
  return state.profile.openGymDays.includes(weekdayOf(date));
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
    (o) => (o.workout.id === plannedWorkoutId || o.plannedId === plannedWorkoutId) && !o.session && !o.fulfilledBy,
  );
  return week.find((o) => o.date === date) ?? week[0] ?? null;
}

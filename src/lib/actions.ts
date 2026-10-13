"use client";

/** All state mutations. Components call these; they never write storage directly. */
import type {
  AppState,
  CalendarEvent,
  ConditioningDraft,
  ConditioningSession,
  DaySlot,
  HomeSessionDraft,
  Intensity,
  OccurrenceRef,
  OpenGymSession,
  SessionLocation,
  Exercise,
  ISODate,
  LoggedSet,
  ModificationReason,
  PlannedWorkout,
  ProgressionDecision,
  RecoveryEntry,
  SessionExercise,
  SkillDrill,
  SkillSession,
  UserProfile,
  WeekAdjustment,
  WorkoutSession,
} from "./types";
import { getState, replaceState, setState } from "./store";
import { createInitialState, seedPlan } from "./seed";
import { previousPerformance } from "./metrics";
import { acceptedLoadTarget, plannedRounds } from "./progression";
import { matchOccurrence, weekInfo } from "./schedule";
import { convertWeight, nowISO, roundWeight, todayISO, uid } from "./utils";
import type { Suggestion } from "./progression";
import type { AdviceAction } from "./advice";

/* ---------------------------------- Profile ---------------------------------- */

export function updateProfile(patch: Partial<UserProfile>) {
  setState((s) => ({ ...s, profile: { ...s.profile, ...patch, updatedAt: nowISO() } }));
}

export function completeOnboarding(patch: Partial<UserProfile>) {
  updateProfile({ ...patch, onboarded: true });
}

/* ----------------------------------- Plan ------------------------------------ */

export function updatePlannedWorkout(workout: PlannedWorkout) {
  setState((s) => ({
    ...s,
    plan: {
      ...s.plan,
      workouts: s.plan.workouts.map((w) => (w.id === workout.id ? { ...workout, updatedAt: nowISO() } : w)),
      updatedAt: nowISO(),
    },
  }));
}

export function updateDaySlot(slot: DaySlot) {
  setState((s) => ({
    ...s,
    plan: { ...s.plan, daySlots: [...s.plan.daySlots.filter((d) => d.weekday !== slot.weekday), slot].sort((a, b) => a.weekday - b.weekday) },
  }));
}

export function removeDaySlot(weekday: number) {
  setState((s) => ({ ...s, plan: { ...s.plan, daySlots: s.plan.daySlots.filter((d) => d.weekday !== weekday) } }));
}

export function setWorkoutWeekday(workoutId: string, weekday: number | null) {
  const w = getState().plan.workouts.find((x) => x.id === workoutId);
  if (w) updatePlannedWorkout({ ...w, weekday });
}

export function addWeekAdjustment(type: WeekAdjustment["type"], calendarWeek: number, note = "") {
  setState((s) => ({
    ...s,
    plan: {
      ...s.plan,
      weekAdjustments: [
        ...s.plan.weekAdjustments.filter((a) => !(a.type === type && a.calendarWeek === calendarWeek)),
        { id: uid("adj"), type, calendarWeek, note, createdAt: nowISO() },
      ],
    },
  }));
}

export function removeWeekAdjustment(id: string) {
  setState((s) => ({ ...s, plan: { ...s.plan, weekAdjustments: s.plan.weekAdjustments.filter((a) => a.id !== id) } }));
}

/** Restores the four seeded workouts. History is unaffected (sessions keep snapshots). */
export function resetPlanWorkouts() {
  const seed = seedPlan();
  setState((s) => ({ ...s, plan: { ...s.plan, workouts: seed.workouts, daySlots: seed.daySlots, updatedAt: nowISO() } }));
}

/* --------------------------------- Exercises --------------------------------- */

export function saveExercise(ex: Exercise) {
  setState((s) => {
    const exists = s.exercises.some((e) => e.id === ex.id);
    const next = { ...ex, updatedAt: nowISO() };
    return { ...s, exercises: exists ? s.exercises.map((e) => (e.id === ex.id ? next : e)) : [...s.exercises, next] };
  });
}

export function deleteCustomExercise(id: string) {
  setState((s) => ({ ...s, exercises: s.exercises.filter((e) => !(e.id === id && e.isCustom)) }));
}

export function toggleFavorite(id: string) {
  setState((s) => ({ ...s, exercises: s.exercises.map((e) => (e.id === id ? { ...e, isFavorite: !e.isFavorite } : e)) }));
}

/* ---------------------------------- Workouts --------------------------------- */

export function emptySet(unit: WorkoutSession["unit"], patch: Partial<LoggedSet> = {}): LoggedSet {
  return {
    id: uid("set"),
    weight: null,
    unit,
    reps: null,
    durationSec: null,
    distance: null,
    distanceUnit: "yd",
    makes: null,
    attempts: null,
    side: null,
    effort: null,
    restSec: null,
    completed: false,
    notes: "",
    loggedAt: null,
    ...patch,
  };
}

const LOW_IMPACT_IDS = new Set(["brisk-walk", "lateral-steps", "bike-intervals"]);

export function buildSessionExercise(
  state: AppState,
  exerciseId: string,
  target: { sets: number; repMin: number; repMax: number; repsLabel: string; restSec: number; targetWeight?: number | null },
  opts: { isExtra?: boolean; substitutedFrom?: SessionExercise["substitutedFrom"]; unit: WorkoutSession["unit"] },
): SessionExercise {
  const ex = state.exercises.find((e) => e.id === exerciseId);
  const unit = opts.unit;
  const prev = previousPerformance(state, exerciseId);
  const accepted = acceptedLoadTarget(state, exerciseId, unit);
  const prevTop = prev?.sets.reduce<number | null>((m, s) => {
    if (s.weight === null) return m;
    const w = convertWeight(s.weight, s.unit, unit);
    return m === null || w > m ? w : m;
  }, null);
  const planned = target.targetWeight != null ? convertWeight(target.targetWeight, state.profile.units, unit) : null;
  const targetWeight = accepted ?? (planned != null ? roundWeight(planned, unit) : prevTop != null ? roundWeight(prevTop, unit) : null);
  const tracking = ex?.trackingType ?? "weighted";
  const drill = ex?.skillDrillId ? state.skillDrills.find((d) => d.id === ex.skillDrillId) : undefined;
  const sided = !!drill && (drill.metrics.includes("leftMakes") || drill.metrics.includes("leftReps"));

  const sets: LoggedSet[] = [];
  const rows = sided ? target.sets * 2 : target.sets;
  for (let i = 0; i < rows; i++) {
    const p = prev?.sets[i];
    const side = sided ? (i % 2 === 0 ? "right" : "left") : null;
    const base: Partial<LoggedSet> = { side };
    switch (tracking) {
      case "weighted":
        base.weight = targetWeight;
        base.reps = p?.reps ?? target.repMin;
        break;
      case "bodyweight":
      case "reps-side":
        base.reps = p?.reps ?? target.repMin;
        break;
      case "timed":
        base.durationSec = p?.durationSec ?? target.repMin;
        break;
      case "distance":
        base.reps = p?.reps ?? target.repMin;
        base.distance = p?.distance ?? 10;
        break;
      case "shooting":
        base.attempts = p?.attempts ?? target.repMax;
        break;
    }
    sets.push(emptySet(unit, base));
  }

  return {
    id: uid("sx"),
    exerciseId,
    name: ex?.name ?? "Exercise",
    trackingType: tracking,
    skillDrillId: ex?.skillDrillId,
    targetSets: target.sets,
    targetReps: target.repsLabel,
    repMin: target.repMin,
    repMax: target.repMax,
    restSec: target.restSec,
    targetWeight: tracking === "weighted" ? targetWeight : null,
    status: "pending",
    substitutedFrom: opts.substitutedFrom ?? null,
    isExtra: !!opts.isExtra,
    sets,
    notes: "",
  };
}

export interface StartOptions {
  plannedWorkoutId: string | null;
  date?: ISODate;
  scheduledDate?: ISODate | null;
  reducedVolume?: boolean;
  lowImpact?: boolean;
  /** Shorter conditioning finisher (e.g. after hard open gym). */
  shortConditioning?: boolean;
  /** Skip the conditioning finisher entirely. */
  skipConditioning?: boolean;
  modified?: { reason: ModificationReason; note: string } | null;
}

export function startWorkout(opts: StartOptions): WorkoutSession {
  const state = getState();
  if (state.activeWorkout) return state.activeWorkout;
  const unit = state.profile.units;
  const date = opts.date ?? todayISO();
  const planned = state.plan.workouts.find((w) => w.id === opts.plannedWorkoutId) ?? null;
  const info = weekInfo(state, date);
  const reduce = !!opts.reducedVolume || info.deload;

  const exercises: SessionExercise[] = [];
  for (const pe of planned?.exercises ?? []) {
    const lib = state.exercises.find((e) => e.id === pe.exerciseId);
    let exerciseId = pe.exerciseId;
    let substitutedFrom: SessionExercise["substitutedFrom"] = null;
    if (opts.lowImpact && pe.role === "movement" && lib) {
      const alt = lib.substitutions.find((id) => LOW_IMPACT_IDS.has(id));
      if (alt) {
        substitutedFrom = { exerciseId: lib.id, name: lib.name };
        exerciseId = alt;
      }
    }
    const sets = reduce && pe.sets > 1 ? pe.sets - 1 : pe.sets;
    exercises.push(buildSessionExercise(state, exerciseId, { ...pe, sets }, { unit, substitutedFrom }));
  }

  let conditioning: ConditioningDraft | null = null;
  if (planned?.conditioning.length) {
    const preferred = opts.lowImpact
      ? planned.conditioning.find((c) => c.modality !== "court") ?? planned.conditioning[0]
      : planned.conditioning.find((c) => c.modality === state.profile.preferredConditioning) ?? planned.conditioning[0];
    const base = plannedRounds(state, preferred.rounds, reduce);
    conditioning = {
      enabled: !opts.skipConditioning,
      optionId: preferred.id,
      modality: preferred.modality,
      customName: "",
      plannedRounds: opts.shortConditioning ? Math.max(3, Math.round(base / 2)) : base,
      completedRounds: 0,
      workSec: preferred.workSec,
      recoverySec: preferred.recoverySec,
      totalDurationMin: null,
      effort: null,
      distance: null,
      distanceUnit: "mi",
      notes: "",
      skippedReason: opts.skipConditioning ? "Already did plenty of basketball this week" : "",
    };
  }

  const scheduledDate =
    opts.scheduledDate !== undefined
      ? opts.scheduledDate
      : planned
        ? matchOccurrence(state, planned.id, date)?.originalDate ?? null
        : null;

  const now = nowISO();
  const session: WorkoutSession = {
    id: uid("ws"),
    plannedWorkoutId: planned?.id ?? null,
    workoutName: planned ? `${planned.label} — ${planned.name}` : "Custom workout",
    planWeek: info.planWeek,
    scheduledDate,
    date,
    status: "active",
    startedAt: now,
    endedAt: null,
    durationSec: 0,
    unit,
    warmupDone: [],
    warmupItems: planned?.warmup ?? [],
    exercises,
    currentIndex: 0,
    conditioning,
    conditioningSessionId: null,
    restTimer: { durationSec: exercises[0]?.restSec || 90, endsAt: null, remainingSec: null },
    lastSetCompletedAt: null,
    reducedVolume: reduce,
    modified: opts.modified ?? (opts.reducedVolume ? { reason: "fatigue", note: "Reduced volume" } : null),
    notes: "",
    kind: planned?.kind ?? "custom",
    location: planned?.location ?? "gym",
    intensity: null,
    completion: null,
    pausedAt: null,
    pausedSec: 0,
    createdAt: now,
    updatedAt: now,
  };
  setState((s) => ({ ...s, activeWorkout: session }));
  return session;
}

/** Autosaving update of the active session. */
export function updateActive(fn: (w: WorkoutSession) => WorkoutSession) {
  setState((s) => (s.activeWorkout ? { ...s, activeWorkout: { ...fn(s.activeWorkout), updatedAt: nowISO() } } : s));
}

/** Completes or un-completes a set; completing records rest taken and starts the rest timer. */
export function toggleActiveSet(exerciseRowId: string, setId: string) {
  const nowMs = Date.now();
  updateActive((w) => {
    let completedNow = false;
    let restSec = 0;
    const exercises = w.exercises.map((e) => {
      if (e.id !== exerciseRowId) return e;
      restSec = e.restSec;
      const sets = e.sets.map((s) => {
        if (s.id !== setId) return s;
        if (s.completed) return { ...s, completed: false, loggedAt: null };
        completedNow = true;
        const rest = w.lastSetCompletedAt ? Math.round((nowMs - w.lastSetCompletedAt) / 1000) : null;
        return { ...s, completed: true, loggedAt: new Date(nowMs).toISOString(), restSec: s.restSec ?? (rest !== null && rest <= 1800 ? rest : null) };
      });
      const allDone = sets.length > 0 && sets.every((s) => s.completed);
      const status: SessionExercise["status"] = allDone ? "done" : e.status === "done" ? "pending" : e.status;
      return { ...e, sets, status };
    });
    if (!completedNow) return { ...w, exercises };
    return {
      ...w,
      exercises,
      lastSetCompletedAt: nowMs,
      restTimer: restSec > 0 ? { durationSec: restSec, endsAt: nowMs + restSec * 1000, remainingSec: null } : w.restTimer,
    };
  });
}

/** Pause / resume the session clock (the rest timer keeps its own state). */
export function pauseActive() {
  updateActive((w) => (w.pausedAt ? w : { ...w, pausedAt: Date.now() }));
}

export function resumeActive() {
  updateActive((w) => (w.pausedAt ? { ...w, pausedSec: w.pausedSec + Math.round((Date.now() - w.pausedAt) / 1000), pausedAt: null } : w));
}

export function discardActive() {
  setState((s) => ({ ...s, activeWorkout: null }));
}

export function finishWorkout(final: {
  durationSec: number;
  notes: string;
  modified: WorkoutSession["modified"];
  intensity: Intensity | null;
  location: SessionLocation;
}): WorkoutSession | null {
  const state = getState();
  const active = state.activeWorkout;
  if (!active) return null;
  const now = nowISO();
  const exercises = active.exercises.map((e) => {
    const sets = e.sets.filter((x) => x.completed);
    const status: SessionExercise["status"] = e.status === "skipped" ? "skipped" : sets.length ? "done" : "pending";
    return { ...e, sets, status };
  });

  let conditioningSession: ConditioningSession | null = null;
  const c = active.conditioning;
  if (c && c.enabled && (c.completedRounds > 0 || (c.totalDurationMin ?? 0) > 0)) {
    const estimatedMin = Math.round((c.completedRounds * (c.workSec + c.recoverySec)) / 60);
    conditioningSession = {
      id: uid("cs"),
      date: active.date,
      activityType: c.modality,
      customName: c.customName,
      totalDurationMin: c.totalDurationMin ?? estimatedMin,
      workSec: c.workSec,
      recoverySec: c.recoverySec,
      plannedRounds: c.plannedRounds,
      completedRounds: c.completedRounds,
      effort: c.effort ?? 5,
      distance: c.distance,
      distanceUnit: c.distanceUnit,
      notes: c.notes,
      workoutSessionId: active.id,
      createdAt: now,
      updatedAt: now,
    };
  }

  const done: WorkoutSession = {
    ...active,
    exercises,
    status: "completed",
    endedAt: now,
    durationSec: final.durationSec,
    notes: final.notes,
    modified: final.modified,
    intensity: final.intensity,
    location: final.location,
    completion: exercises.length > 0 && exercises.every((e) => e.status !== "pending") ? "complete" : "partial",
    pausedAt: null,
    conditioningSessionId: conditioningSession?.id ?? null,
    restTimer: { ...active.restTimer, endsAt: null, remainingSec: null },
    updatedAt: now,
  };
  setState((s) => ({
    ...s,
    activeWorkout: null,
    workoutSessions: [...s.workoutSessions, done],
    conditioningSessions: conditioningSession ? [...s.conditioningSessions, conditioningSession] : s.conditioningSessions,
  }));
  return done;
}

export function deleteWorkoutSession(id: string) {
  setState((s) => ({
    ...s,
    workoutSessions: s.workoutSessions.filter((w) => w.id !== id),
    conditioningSessions: s.conditioningSessions.filter((c) => c.workoutSessionId !== id),
  }));
}

/** Saves edits to a completed session (sets, date, duration, intensity, notes). */
export function updateCompletedSession(session: WorkoutSession) {
  setState((s) => ({
    ...s,
    workoutSessions: s.workoutSessions.map((w) => (w.id === session.id ? { ...session, updatedAt: nowISO() } : w)),
    conditioningSessions: s.conditioningSessions.map((c) => (c.workoutSessionId === session.id ? { ...c, date: session.date } : c)),
  }));
}

export function updateWorkoutSessionNotes(id: string, notes: string) {
  setState((s) => ({ ...s, workoutSessions: s.workoutSessions.map((w) => (w.id === id ? { ...w, notes, updatedAt: nowISO() } : w)) }));
}

/* ----------------------------------- Skills ---------------------------------- */

export function saveSkillSession(session: SkillSession) {
  setState((s) => {
    const exists = s.skillSessions.some((x) => x.id === session.id);
    const next = { ...session, updatedAt: nowISO() };
    return { ...s, skillSessions: exists ? s.skillSessions.map((x) => (x.id === session.id ? next : x)) : [...s.skillSessions, next] };
  });
}

export function deleteSkillSession(id: string) {
  setState((s) => ({ ...s, skillSessions: s.skillSessions.filter((x) => x.id !== id) }));
}

export function saveDrill(drill: SkillDrill) {
  setState((s) => {
    const exists = s.skillDrills.some((d) => d.id === drill.id);
    return { ...s, skillDrills: exists ? s.skillDrills.map((d) => (d.id === drill.id ? drill : d)) : [...s.skillDrills, drill] };
  });
}

export function deleteCustomDrill(id: string) {
  setState((s) => ({ ...s, skillDrills: s.skillDrills.filter((d) => !(d.id === id && d.isCustom)) }));
}

/* -------------------------------- Conditioning ------------------------------- */

export function saveConditioning(session: ConditioningSession) {
  setState((s) => {
    const exists = s.conditioningSessions.some((x) => x.id === session.id);
    const next = { ...session, updatedAt: nowISO() };
    return {
      ...s,
      conditioningSessions: exists ? s.conditioningSessions.map((x) => (x.id === session.id ? next : x)) : [...s.conditioningSessions, next],
    };
  });
}

export function deleteConditioning(id: string) {
  setState((s) => ({
    ...s,
    conditioningSessions: s.conditioningSessions.filter((x) => x.id !== id),
    workoutSessions: s.workoutSessions.map((w) => (w.conditioningSessionId === id ? { ...w, conditioningSessionId: null } : w)),
  }));
}

/* ---------------------------------- Recovery --------------------------------- */

/** One check-in per day: saving for an existing date replaces it. */
export function saveRecovery(entry: RecoveryEntry) {
  setState((s) => {
    const others = s.recoveryEntries.filter((r) => r.id !== entry.id && r.date !== entry.date);
    return { ...s, recoveryEntries: [...others, { ...entry, updatedAt: nowISO() }] };
  });
}

export function deleteRecovery(id: string) {
  setState((s) => ({ ...s, recoveryEntries: s.recoveryEntries.filter((r) => r.id !== id) }));
}

/* ---------------------------------- Calendar --------------------------------- */

export function saveCalendarEvent(ev: CalendarEvent) {
  setState((s) => {
    const exists = s.calendarEvents.some((e) => e.id === ev.id);
    const next = { ...ev, updatedAt: nowISO() };
    return { ...s, calendarEvents: exists ? s.calendarEvents.map((e) => (e.id === ev.id ? next : e)) : [...s.calendarEvents, next] };
  });
}

export function deleteCalendarEvent(id: string) {
  setState((s) => ({ ...s, calendarEvents: s.calendarEvents.filter((e) => e.id !== id) }));
}

/** Moves / skips / marks-modified a planned occurrence via an override record. */
export function overrideOccurrence(
  plannedWorkoutId: string,
  originalDate: ISODate,
  patch: Partial<Pick<CalendarEvent, "date" | "status" | "modifiedReason" | "notes" | "swapWorkoutId" | "reduce">>,
) {
  const state = getState();
  const existing = state.calendarEvents.find(
    (e) => e.type === "workout" && e.plannedWorkoutId === plannedWorkoutId && e.originalDate === originalDate,
  );
  const w = state.plan.workouts.find((x) => x.id === plannedWorkoutId);
  const now = nowISO();
  const base: CalendarEvent = existing ?? {
    id: uid("ev"),
    type: "workout",
    date: originalDate,
    title: w?.name ?? "Workout",
    plannedWorkoutId,
    originalDate,
    status: "scheduled",
    modifiedReason: null,
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
  saveCalendarEvent({ ...base, ...patch });
}

export function clearOverride(plannedWorkoutId: string, originalDate: ISODate) {
  setState((s) => ({
    ...s,
    calendarEvents: s.calendarEvents.filter(
      (e) => !(e.type === "workout" && e.plannedWorkoutId === plannedWorkoutId && e.originalDate === originalDate),
    ),
  }));
}

/* ---------------------------------- Open gym --------------------------------- */

export function saveOpenGym(session: OpenGymSession) {
  setState((s) => {
    const exists = s.openGymSessions.some((x) => x.id === session.id);
    const next = { ...session, updatedAt: nowISO() };
    return { ...s, openGymSessions: exists ? s.openGymSessions.map((x) => (x.id === session.id ? next : x)) : [...s.openGymSessions, next] };
  });
}

export function deleteOpenGym(id: string) {
  setState((s) => ({ ...s, openGymSessions: s.openGymSessions.filter((x) => x.id !== id) }));
}

export function setOpenGymDays(days: number[]) {
  updateProfile({ openGymDays: [...new Set(days)].sort() });
}

/* --------------------------------- Home Court -------------------------------- */

export function startHomeSession(draft: HomeSessionDraft) {
  setState((s) => (s.activeHomeSession ? s : { ...s, activeHomeSession: draft }));
}

export function updateHome(fn: (d: HomeSessionDraft) => HomeSessionDraft) {
  setState((s) => (s.activeHomeSession ? { ...s, activeHomeSession: fn(s.activeHomeSession) } : s));
}

export function pauseHome() {
  updateHome((d) => (d.pausedAt ? d : { ...d, pausedAt: Date.now() }));
}

export function resumeHome() {
  updateHome((d) => (d.pausedAt ? { ...d, pausedSec: d.pausedSec + Math.round((Date.now() - d.pausedAt) / 1000), pausedAt: null } : d));
}

export function discardHome() {
  setState((s) => ({ ...s, activeHomeSession: null }));
}

/** Saves the Home Court draft as a skills session (feeds shooting %, skill totals). */
export function finishHome(final: { durationMin: number; intensity: Intensity; notes: string; countsFor: OccurrenceRef | null; date: ISODate }): SkillSession | null {
  const draft = getState().activeHomeSession;
  if (!draft) return null;
  const now = nowISO();
  const session: SkillSession = {
    id: draft.id,
    date: final.date,
    kind: "home-court",
    location: "home",
    durationMin: final.durationMin,
    intensity: final.intensity,
    countsFor: final.countsFor,
    gameNotes: "",
    notes: final.notes,
    results: draft.items
      // Only real work: done, or with a logged result beyond an untouched attempt count.
      .filter((i) => i.completed || Object.keys(i.values).some((k) => !/attempts|total/i.test(k)) || i.notes.trim())
      .map((i) => ({ id: i.id, drillId: i.drillId, drillName: i.drillName, values: i.values, completed: i.completed, notes: i.notes.trim() })),
    createdAt: now,
    updatedAt: now,
  };
  setState((s) => ({ ...s, activeHomeSession: null, skillSessions: [...s.skillSessions, session] }));
  return session;
}

/* ---------------------------------- Advice ----------------------------------- */

export function dismissAdvice(id: string) {
  setState((s) => ({ ...s, dismissedAdvice: [...s.dismissedAdvice.filter((x) => x !== id), id] }));
}

/** Applies a suggestion the athlete chose. Nothing here runs automatically. */
export function applyAdvice(a: AdviceAction) {
  if (a.kind === "reduce") overrideOccurrence(a.plannedId, a.originalDate, { reduce: true, status: "modified", modifiedReason: "fatigue" });
  else if (a.kind === "move") overrideOccurrence(a.plannedId, a.originalDate, { date: a.date });
  else if (a.kind === "skip") overrideOccurrence(a.plannedId, a.originalDate, { status: "skipped", notes: a.note });
}

/* -------------------------------- Progression -------------------------------- */

export function decideSuggestion(sg: Suggestion, status: ProgressionDecision["status"], calendarWeek: number) {
  if (sg.kind === "volume") {
    if (status === "accepted") addWeekAdjustment("deload", calendarWeek, "Accepted reduced-volume suggestion");
    return;
  }
  setState((s) => ({
    ...s,
    progressionDecisions: [
      ...s.progressionDecisions.filter((d) => !(d.targetId === sg.targetId && d.kind === sg.kind && d.calendarWeek === calendarWeek)),
      {
        id: uid("pd"),
        targetId: sg.targetId,
        kind: sg.kind as ProgressionDecision["kind"],
        calendarWeek,
        from: sg.from,
        to: sg.to,
        unit: sg.unit,
        status,
        createdAt: nowISO(),
      },
    ],
  }));
}

export function undoDecision(id: string) {
  setState((s) => ({ ...s, progressionDecisions: s.progressionDecisions.filter((d) => d.id !== id) }));
}

/* ------------------------------------ Data ----------------------------------- */

export function importState(next: AppState) {
  replaceState(next);
}

export function resetAllData() {
  replaceState(createInitialState());
}

/**
 * Persistence layer. The rest of the app only talks to `loadState`, `saveState`
 * and `validateBackup`, so swapping localStorage for a database later means
 * replacing this file (and making the store's writes async).
 */
import type { AppState, DaySlot, PlannedWorkout, TrainingPlan, WorkoutSession } from "./types";
import { createInitialState, SCHEMA_VERSION } from "./seed";

export const STORAGE_KEY = "center-performance:v1";
const CORRUPT_KEY = "center-performance:corrupt-backup";

export type LoadResult = { state: AppState; error: string | null };

export function loadState(): LoadResult {
  if (typeof window === "undefined") return { state: createInitialState(), error: null };
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return {
      state: createInitialState(),
      error: "Browser storage is unavailable (private mode or blocked site data). Changes will not be saved.",
    };
  }
  if (!raw) return { state: createInitialState(), error: null };
  try {
    const parsed = JSON.parse(raw);
    const check = validateBackup(parsed);
    if (!check.ok) throw new Error(check.errors.join("; "));
    const fromVersion = typeof parsed?.schemaVersion === "number" ? parsed.schemaVersion : 1;
    if (fromVersion < SCHEMA_VERSION) {
      // Keep a copy of the pre-upgrade data, then persist the migrated state.
      try {
        window.localStorage.setItem(`${STORAGE_KEY}:pre-v${SCHEMA_VERSION}`, raw);
      } catch {
        /* ignore — the migrated state is still saved below if possible */
      }
      saveState(check.state);
    }
    return { state: check.state, error: null };
  } catch (e) {
    try {
      window.localStorage.setItem(CORRUPT_KEY, raw);
    } catch {
      /* ignore */
    }
    return {
      state: createInitialState(),
      error: `Saved data could not be read and was set aside (${(e as Error).message}). A fresh profile was loaded.`,
    };
  }
}

export function saveState(state: AppState): string | null {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return null;
  } catch (e) {
    const name = (e as Error).name;
    return name === "QuotaExceededError"
      ? "Storage is full — export a backup and remove old data."
      : "Could not save to browser storage.";
  }
}

/** v1 defaults, used to tell untouched seed values from the athlete's own edits. */
const V1_WEEKDAYS: Record<string, number> = { "pw-day1": 1, "pw-day2": 2, "pw-day3": 4, "pw-day4": 6 };
/** v2 default weekdays that changed in v3 (Day B moved Wednesday → Friday). */
const V2_WEEKDAYS: Record<string, number> = { "pw-day3": 3 };
const V2_FRIDAY_LABEL = "Recovery or light shooting";
const V1_ENVIRONMENT = "Full gym and basketball court";
const V1_GOAL = "Become a more complete basketball center";

/**
 * Upgrades older saves (and imported backups) to the current schema. Logged
 * history is never touched; only defaults the athlete hasn't edited change.
 */
export function migrate(state: AppState): AppState {
  const fresh = createInitialState();
  const version = state.schemaVersion ?? 1;
  const seedWorkouts = new Map(fresh.plan.workouts.map((w) => [w.id, w]));

  // Plan workouts: add new metadata; move to the v2 week only if the weekday is still the v1 default.
  const workouts = (state.plan?.workouts ?? fresh.plan.workouts).map((w) => {
    const seed = seedWorkouts.get(w.id);
    const legacy = w as Partial<PlannedWorkout>;
    const untouchedDay =
      (version < 2 && seed && V1_WEEKDAYS[w.id] === w.weekday) || (version < 3 && seed && V2_WEEKDAYS[w.id] === w.weekday);
    return {
      ...w,
      label: legacy.label ?? seed?.label ?? `Day ${w.dayNumber}`,
      kind: legacy.kind ?? seed?.kind ?? "strength",
      emphasis: legacy.emphasis ?? seed?.emphasis ?? "upper",
      location: legacy.location ?? seed?.location ?? "gym",
      weekday: untouchedDay ? seed.weekday : w.weekday,
      dayNumber: version < 2 && seed ? seed.dayNumber : w.dayNumber,
      focus: version < 2 && seed && w.focus !== seed.focus && untouchedDay ? seed.focus : w.focus,
    } as PlannedWorkout;
  });

  // Drills: v1 → v2 refreshes built-in definitions (names, instructions, home metadata); custom drills are kept.
  // From v2 on, keep the athlete's edits to built-in drills and only add missing ones.
  const existing = state.skillDrills ?? [];
  const custom = existing.filter((d) => d.isCustom);
  const skillDrills =
    version < 2
      ? [...fresh.skillDrills, ...custom.filter((c) => !fresh.skillDrills.some((f) => f.id === c.id))]
      : [...existing, ...fresh.skillDrills.filter((f) => !existing.some((e) => e.id === f.id))];

  // Exercises: add any new built-ins, keep favorites and custom exercises.
  const exercises = [...(state.exercises ?? [])];
  for (const e of fresh.exercises) if (!exercises.some((x) => x.id === e.id)) exercises.push(e);

  const profile = { ...fresh.profile, ...state.profile };
  if (version < 2) {
    if (profile.trainingEnvironment === V1_ENVIRONMENT) profile.trainingEnvironment = fresh.profile.trainingEnvironment;
    if (profile.mainGoal === V1_GOAL) profile.mainGoal = fresh.profile.mainGoal;
    if (profile.position === "Center") profile.position = fresh.profile.position;
  }

  const legacyPlan = state.plan as TrainingPlan & { restDays?: unknown };
  const { restDays: _legacyRest, ...plan } = legacyPlan ?? ({} as typeof legacyPlan);
  void _legacyRest;

  return {
    ...fresh,
    ...state,
    profile,
    plan: {
      ...fresh.plan,
      ...plan,
      workouts,
      daySlots: plan.daySlots ? migrateDaySlots(plan.daySlots, workouts, version, fresh.plan.daySlots) : fresh.plan.daySlots,
      weekAdjustments: plan.weekAdjustments ?? [],
    },
    exercises,
    skillDrills,
    recoveryEntries: (state.recoveryEntries ?? []).map((r) => ({ ...r, fatigue: r.fatigue ?? null })),
    workoutSessions: (state.workoutSessions ?? []).map(migrateSession),
    activeWorkout: state.activeWorkout ? migrateSession(state.activeWorkout) : null,
    progressionDecisions: state.progressionDecisions ?? [],
    calendarEvents: state.calendarEvents ?? [],
    openGymSessions: state.openGymSessions ?? [],
    activeHomeSession: state.activeHomeSession ?? null,
    dismissedAdvice: state.dismissedAdvice ?? [],
    schemaVersion: SCHEMA_VERSION,
  };
}

/**
 * v2 → v3: Wednesday becomes a blocked (unavailable) day and Friday becomes Day B.
 * Only default slots are changed; anything the athlete customised is kept.
 */
function migrateDaySlots(slots: DaySlot[], workouts: PlannedWorkout[], version: number, defaults: DaySlot[]): DaySlot[] {
  if (version >= 3) return slots;
  const hasWorkout = (d: number) => workouts.some((w) => w.weekday === d);
  let next = slots.filter((d) => !(d.weekday === 5 && d.kind === "recovery" && d.label === V2_FRIDAY_LABEL && hasWorkout(5)));
  const wed = defaults.find((d) => d.weekday === 3)!;
  if (!hasWorkout(3) && !next.some((d) => d.weekday === 3)) next = [...next, wed];
  const thu = defaults.find((d) => d.weekday === 4)!;
  next = next.map((d) => (d.weekday === 4 && d.kind === "flex" && d.label === thu.label ? { ...d, description: thu.description } : d));
  return next.sort((a, b) => a.weekday - b.weekday);
}

function migrateSession(s: WorkoutSession): WorkoutSession {
  const kind = s.kind ?? (s.plannedWorkoutId === "pw-day1" || s.plannedWorkoutId === "pw-day3" ? "strength" : s.plannedWorkoutId ? "basketball" : "custom");
  return {
    ...s,
    kind,
    location: s.location ?? (s.plannedWorkoutId === "pw-day4" || s.plannedWorkoutId === "pw-day2" ? "court" : "gym"),
    intensity: s.intensity ?? null,
    completion: s.completion ?? (s.status === "completed" ? "complete" : null),
    pausedAt: s.pausedAt ?? null,
    pausedSec: s.pausedSec ?? 0,
  };
}

/* --------------------------------- Validation -------------------------------- */

type Check = { ok: true; state: AppState } | { ok: false; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isDate = (v: unknown) => isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v);

function checkArray(
  obj: Record<string, unknown>,
  key: string,
  errors: string[],
  itemCheck: (item: Record<string, unknown>) => string | null,
) {
  const arr = obj[key];
  if (arr === undefined) return;
  if (!Array.isArray(arr)) {
    errors.push(`"${key}" must be a list`);
    return;
  }
  arr.forEach((item, i) => {
    if (!isObj(item) || !isStr(item.id)) {
      errors.push(`${key}[${i}] is missing an id`);
      return;
    }
    const msg = itemCheck(item);
    if (msg) errors.push(`${key}[${i}]: ${msg}`);
  });
}

/** Validates an imported backup (or the stored state) and returns typed data. */
export function validateBackup(input: unknown): Check {
  const errors: string[] = [];
  if (!isObj(input)) return { ok: false, errors: ["File is not a CENTER PERFORMANCE backup (expected a JSON object)."] };
  const data = isObj(input.data) && input.app === "center-performance" ? input.data : input;

  if (!isNum(data.schemaVersion)) errors.push("Missing schemaVersion");
  else if (data.schemaVersion > SCHEMA_VERSION) errors.push("Backup was made by a newer version of the app");

  if (!isObj(data.profile)) errors.push("Missing profile");
  else {
    if (!isDate(data.profile.planStartDate)) errors.push("profile.planStartDate must be YYYY-MM-DD");
    if (data.profile.units !== "lb" && data.profile.units !== "kg") errors.push("profile.units must be lb or kg");
  }
  if (!isObj(data.plan) || !Array.isArray(data.plan.workouts)) errors.push("Missing training plan");
  if (!Array.isArray(data.exercises)) errors.push("Missing exercise library");

  checkArray(data, "exercises", errors, (e) => (isStr(e.name) ? null : "missing name"));
  checkArray(data, "workoutSessions", errors, (s) =>
    !isDate(s.date) ? "invalid date" : !Array.isArray(s.exercises) ? "missing exercises" : null,
  );
  checkArray(data, "skillSessions", errors, (s) => (!isDate(s.date) ? "invalid date" : !Array.isArray(s.results) ? "missing results" : null));
  checkArray(data, "conditioningSessions", errors, (s) =>
    !isDate(s.date) ? "invalid date" : !isNum(s.totalDurationMin) ? "invalid duration" : null,
  );
  checkArray(data, "recoveryEntries", errors, (r) => (!isDate(r.date) ? "invalid date" : null));
  checkArray(data, "calendarEvents", errors, (c) => (!isDate(c.date) ? "invalid date" : null));
  checkArray(data, "openGymSessions", errors, (o) => (!isDate(o.date) ? "invalid date" : !isStr(o.status) ? "missing status" : null));

  for (const key of ["workoutSessions", "skillSessions", "conditioningSessions", "recoveryEntries"]) {
    if (!Array.isArray(data[key])) errors.push(`Missing ${key}`);
  }

  if (errors.length) return { ok: false, errors: errors.slice(0, 8) };
  return { ok: true, state: migrate(data as unknown as AppState) };
}

export function makeBackup(state: AppState) {
  return {
    app: "center-performance",
    exportedAt: new Date().toISOString(),
    data: state,
  };
}

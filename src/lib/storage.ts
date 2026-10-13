/**
 * Persistence layer. The rest of the app only talks to `loadState`, `saveState`
 * and `validateBackup`, so swapping localStorage for a database later means
 * replacing this file (and making the store's writes async).
 */
import type { AppState } from "./types";
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
    return { state: migrate(check.state), error: null };
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

/** Fill in fields added in later versions so older saves keep working. */
function migrate(state: AppState): AppState {
  const fresh = createInitialState();
  return {
    ...fresh,
    ...state,
    profile: { ...fresh.profile, ...state.profile },
    plan: { ...fresh.plan, ...state.plan, weekAdjustments: state.plan.weekAdjustments ?? [] },
    progressionDecisions: state.progressionDecisions ?? [],
    calendarEvents: state.calendarEvents ?? [],
    skillDrills: state.skillDrills?.length ? state.skillDrills : fresh.skillDrills,
    schemaVersion: SCHEMA_VERSION,
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
  checkArray(data, "recoveryEntries", errors, (r) => (!isDate(r.date) ? "invalid date" : !isNum(r.readiness) ? "invalid readiness" : null));
  checkArray(data, "calendarEvents", errors, (c) => (!isDate(c.date) ? "invalid date" : null));

  for (const key of ["workoutSessions", "skillSessions", "conditioningSessions", "recoveryEntries"]) {
    if (!Array.isArray(data[key])) errors.push(`Missing ${key}`);
  }

  if (errors.length) return { ok: false, errors: errors.slice(0, 8) };
  return { ok: true, state: data as unknown as AppState };
}

export function makeBackup(state: AppState) {
  return {
    app: "center-performance",
    exportedAt: new Date().toISOString(),
    data: state,
  };
}

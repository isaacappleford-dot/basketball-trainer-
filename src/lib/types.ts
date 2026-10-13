/**
 * CENTER PERFORMANCE — core data model.
 *
 * Every persisted record has a stable `id`. Logged records (sessions, sets,
 * check-ins) snapshot the names/targets they were created with so history is
 * preserved when the training plan or exercise library changes later.
 *
 * Derived values (dashboard metrics, personal records, percentages) are never
 * stored — they are computed from these records in `metrics.ts`.
 */

export type ID = string;
/** Calendar date in local time, formatted YYYY-MM-DD. */
export type ISODate = string;
/** Full timestamp, ISO 8601. */
export type Timestamp = string;

export type WeightUnit = "lb" | "kg";
export type DistanceUnit = "yd" | "m" | "mi" | "km";
export type ThemePreference = "dark" | "light" | "system";
export type ConditioningModality =
  | "bike"
  | "elliptical"
  | "treadmill"
  | "court"
  | "walking"
  | "custom";

export interface UserProfile {
  id: ID;
  name: string;
  heightIn: number;
  /** Optional and private. Never used as a measure of success. */
  bodyWeight: number | null;
  showBodyWeight: boolean;
  experience: "Beginner" | "Intermediate" | "Experienced";
  daysPerWeek: number;
  /** Weekly targets: two strength sessions and two basketball-focused sessions by default. */
  strengthPerWeek: number;
  basketballPerWeek: number;
  /** Weekdays (0–6) when open gym is available. Availability is never a commitment. */
  openGymDays: number[];
  trainingEnvironment: string;
  position: string;
  mainGoal: string;
  priorities: string[];
  planWeeks: number;
  units: WeightUnit;
  /** First day of week 1 of the plan. */
  planStartDate: ISODate;
  preferredConditioning: ConditioningModality;
  theme: ThemePreference;
  onboarded: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ExerciseCategory =
  | "Lower-body strength"
  | "Upper-body strength"
  | "Core"
  | "Power and movement"
  | "Speed and defense"
  | "Basketball finishing"
  | "Post moves"
  | "Rebounding"
  | "Shooting"
  | "Conditioning"
  | "Warm-ups and mobility";

/**
 * How sets of an exercise are logged.
 * - weighted: weight + reps (weight optional)
 * - bodyweight: reps only (optional added load)
 * - timed: seconds per set
 * - reps-side: reps, with a side (left/right)
 * - shooting: makes / attempts, with a hand
 * - distance: reps over a distance (sprints, accelerations)
 */
export type TrackingType =
  | "weighted"
  | "bodyweight"
  | "timed"
  | "reps-side"
  | "shooting"
  | "distance";

export interface Exercise {
  id: ID;
  name: string;
  category: ExerciseCategory;
  primaryAreas: string[];
  equipment: string[];
  instructions: string[];
  setsReps: string;
  rest: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  substitutions: ID[];
  notes: string;
  safety: string;
  trackingType: TrackingType;
  /** Smallest sensible load increase, in lb. */
  incrementLb?: number;
  /** Links a workout exercise to a skill drill for shooting analytics. */
  skillDrillId?: ID;
  isCustom: boolean;
  isFavorite: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface WarmupItem {
  id: ID;
  text: string;
}

export interface PlannedExercise {
  id: ID;
  exerciseId: ID;
  sets: number;
  repMin: number;
  repMax: number;
  /** Display string, e.g. "6–10", "5 per side", "10–15 s". */
  repsLabel: string;
  restSec: number;
  role: "main" | "accessory" | "skill" | "movement";
  /** Optional working weight set by you in the plan editor (profile units). */
  targetWeight?: number | null;
  notes: string;
}

export interface ConditioningOption {
  id: ID;
  label: string;
  modality: ConditioningModality;
  rounds: number;
  workSec: number;
  recoverySec: number;
  note: string;
}

export type WorkoutKind = "strength" | "basketball";
export type SessionLocation = "gym" | "home" | "open-gym" | "court";
export type Intensity = "light" | "moderate" | "hard";

export interface PlannedWorkout {
  id: ID;
  /** Sort order only. */
  dayNumber: number;
  /** Short display label, e.g. "Day A". */
  label: string;
  name: string;
  focus: string;
  kind: WorkoutKind;
  /** Body emphasis, used to avoid stacking intense lower-body work before hard sessions. */
  emphasis: "lower" | "upper" | "skills" | "speed";
  location: SessionLocation;
  /** 0 = Sunday … 6 = Saturday; null = optional, not scheduled by default. */
  weekday: number | null;
  warmup: WarmupItem[];
  exercises: PlannedExercise[];
  conditioning: ConditioningOption[];
  guidance: string[];
  updatedAt: Timestamp;
}

export interface PlanPhase {
  id: ID;
  startWeek: number;
  endWeek: number;
  title: string;
  focus: string;
  guidance: string[];
}

export type DaySlotKind = "open-gym" | "flex" | "recovery" | "rest";

export interface DaySlot {
  weekday: number;
  kind: DaySlotKind;
  label: string;
  description: string;
}

export interface WeekAdjustment {
  id: ID;
  /** Calendar week (since plan start) the adjustment applies to. */
  calendarWeek: number;
  type: "repeat" | "deload";
  note: string;
  createdAt: Timestamp;
}

export interface TrainingPlan {
  id: ID;
  name: string;
  weeks: number;
  phases: PlanPhase[];
  workouts: PlannedWorkout[];
  /** What non-workout weekdays are for. Defaults, never obligations. */
  daySlots: DaySlot[];
  weekAdjustments: WeekAdjustment[];
  updatedAt: Timestamp;
}

export type ModificationReason = "fatigue" | "pain" | "professional-guidance" | "other";

export interface LoggedSet {
  id: ID;
  weight: number | null;
  unit: WeightUnit;
  reps: number | null;
  durationSec: number | null;
  distance: number | null;
  distanceUnit: DistanceUnit;
  makes: number | null;
  attempts: number | null;
  side: "left" | "right" | "both" | null;
  /** Perceived effort 1–10 (RPE). 8 ≈ two reps in reserve. */
  effort: number | null;
  /** Rest taken before this set, in seconds. */
  restSec: number | null;
  completed: boolean;
  notes: string;
  loggedAt: Timestamp | null;
}

export interface SessionExercise {
  id: ID;
  exerciseId: ID;
  /** Snapshot of the exercise name at the time it was logged. */
  name: string;
  trackingType: TrackingType;
  skillDrillId?: ID;
  targetSets: number;
  targetReps: string;
  repMin: number;
  repMax: number;
  restSec: number;
  targetWeight: number | null;
  status: "pending" | "done" | "skipped";
  substitutedFrom: { exerciseId: ID; name: string } | null;
  isExtra: boolean;
  sets: LoggedSet[];
  notes: string;
}

export interface RestTimerState {
  durationSec: number;
  /** When running, the epoch ms the timer will hit zero. */
  endsAt: number | null;
  /** When paused, seconds left. */
  remainingSec: number | null;
}

export interface ConditioningDraft {
  enabled: boolean;
  optionId: ID | null;
  modality: ConditioningModality;
  customName: string;
  plannedRounds: number;
  completedRounds: number;
  workSec: number;
  recoverySec: number;
  totalDurationMin: number | null;
  effort: number | null;
  distance: number | null;
  distanceUnit: DistanceUnit;
  notes: string;
  skippedReason: string;
}

export interface WorkoutSession {
  id: ID;
  plannedWorkoutId: ID | null;
  /** Snapshot of planned workout name. */
  workoutName: string;
  planWeek: number;
  /** Date of the planned occurrence this session fulfils (for calendar). */
  scheduledDate: ISODate | null;
  date: ISODate;
  status: "active" | "completed";
  startedAt: Timestamp;
  endedAt: Timestamp | null;
  durationSec: number;
  unit: WeightUnit;
  warmupDone: ID[];
  warmupItems: WarmupItem[];
  exercises: SessionExercise[];
  currentIndex: number;
  conditioning: ConditioningDraft | null;
  /** Set on completion when a conditioning block was logged. */
  conditioningSessionId: ID | null;
  restTimer: RestTimerState;
  lastSetCompletedAt: number | null;
  reducedVolume: boolean;
  modified: { reason: ModificationReason; note: string } | null;
  notes: string;
  /** Snapshot of the planned workout kind at start. */
  kind: WorkoutKind | "custom";
  location: SessionLocation;
  intensity: Intensity | null;
  /** "complete" when every planned exercise was done or deliberately skipped. */
  completion: "complete" | "partial" | null;
  /** Pause tracking: epoch ms paused at, and total paused seconds. */
  pausedAt: number | null;
  pausedSec: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type SkillMetricKey =
  | "makes"
  | "attempts"
  | "leftMakes"
  | "leftAttempts"
  | "rightMakes"
  | "rightAttempts"
  | "leftReps"
  | "rightReps"
  | "reps"
  | "accurate"
  | "total"
  | "minutes";

export type HomeDrillCategory = "Shooting" | "Center skills" | "Footwork & defense";

export interface SkillDrill {
  id: ID;
  name: string;
  description: string;
  /** Empty = simple completion tracking. */
  metrics: SkillMetricKey[];
  defaultAttempts?: number;
  isCustom: boolean;
  createdAt: Timestamp;
  /** Home Court metadata (driveway-friendly drills). */
  homeCourt?: boolean;
  category?: HomeDrillCategory;
  instructions?: string[];
  target?: string;
  partner?: "none" | "optional" | "required";
  safety?: string;
}

export interface SkillResult {
  id: ID;
  drillId: ID;
  /** Snapshot of drill name. */
  drillName: string;
  values: Partial<Record<SkillMetricKey, number>>;
  /** Completion checkbox (Home Court sessions). */
  completed?: boolean;
  notes: string;
}

/** Links a session to the planned occurrence it fulfils or replaces. */
export interface OccurrenceRef {
  plannedWorkoutId: ID;
  originalDate: ISODate;
}

export interface SkillSession {
  id: ID;
  date: ISODate;
  results: SkillResult[];
  gameNotes: string;
  notes: string;
  /** "home-court" sessions come from the guided Home Court flow. */
  kind?: "skills" | "home-court";
  location?: SessionLocation;
  durationMin?: number | null;
  intensity?: Intensity | null;
  countsFor?: OccurrenceRef | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ConditioningSession {
  id: ID;
  date: ISODate;
  activityType: ConditioningModality;
  customName: string;
  totalDurationMin: number;
  workSec: number | null;
  recoverySec: number | null;
  plannedRounds: number | null;
  completedRounds: number | null;
  effort: number;
  distance: number | null;
  distanceUnit: DistanceUnit;
  notes: string;
  /** Present when logged as part of a workout. */
  workoutSessionId: ID | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface RecoveryEntry {
  id: ID;
  date: ISODate;
  sleepHours: number | null;
  /** All ratings 1–5 and optional. */
  sleepQuality: number | null;
  energy: number | null;
  soreness: number | null;
  readiness: number | null;
  /** Perceived fatigue 1 (fresh) – 5 (exhausted). */
  fatigue: number | null;
  dayType: "training" | "rest" | "active-recovery";
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Derived — computed from logged sets, never stored. */
export interface PersonalRecord {
  id: string;
  exerciseId: ID;
  exerciseName: string;
  kind: "heaviest-weight" | "most-reps" | "best-set-volume" | "best-percentage";
  value: number;
  label: string;
  previous: number;
  date: ISODate;
  sourceId: ID;
}

export type CalendarEventType = "workout" | "game" | "practice" | "rest" | "recovery" | "other";

/**
 * Calendar records. For `workout` events these are schedule overrides of a
 * planned occurrence (moved, skipped or marked modified) — completion is
 * never stored here; it is derived from saved workout sessions.
 */
export interface CalendarEvent {
  id: ID;
  type: CalendarEventType;
  date: ISODate;
  title: string;
  plannedWorkoutId: ID | null;
  originalDate: ISODate | null;
  status: "scheduled" | "skipped" | "modified";
  modifiedReason: ModificationReason | null;
  /** Workout override: do a different planned workout in this slot. */
  swapWorkoutId?: ID | null;
  /** Workout override: start with reduced volume (from a fatigue suggestion). */
  reduce?: boolean;
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ProgressionDecision {
  id: ID;
  /** Exercise id or "conditioning". */
  targetId: ID;
  kind: "load" | "reps" | "rounds";
  calendarWeek: number;
  from: number;
  to: number;
  unit: string;
  status: "accepted" | "dismissed";
  createdAt: Timestamp;
}

export type OpenGymStatus = "planned" | "attended" | "skipped" | "replaced";

export interface OpenGymSession {
  id: ID;
  date: ISODate;
  status: OpenGymStatus;
  /** What was done instead, when status is "replaced". */
  replacedWith: string;
  durationMin: number | null;
  intensity: Intensity | null;
  /** Perceived effort 1–10, optional. */
  effort: number | null;
  format: "full-court" | "half-court" | "drills" | null;
  skills: string[];
  /** Lots of hard running — used to trim extra conditioning that week. */
  hardRunning: boolean;
  /**
   * Explicit link to a planned workout this open gym stands in for. Basketball
   * workouts count as completed; strength workouts are only marked "replaced".
   */
  countsFor: OccurrenceRef | null;
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface HomeSessionItem {
  id: ID;
  drillId: ID;
  drillName: string;
  completed: boolean;
  values: Partial<Record<SkillMetricKey, number>>;
  notes: string;
}

/** In-progress Home Court session (persisted so closing the app loses nothing). */
export interface HomeSessionDraft {
  id: ID;
  date: ISODate;
  title: string;
  startedAt: Timestamp;
  pausedAt: number | null;
  pausedSec: number;
  partner: boolean;
  items: HomeSessionItem[];
  countsFor: OccurrenceRef | null;
  notes: string;
}

export interface AppState {
  schemaVersion: number;
  profile: UserProfile;
  plan: TrainingPlan;
  exercises: Exercise[];
  skillDrills: SkillDrill[];
  workoutSessions: WorkoutSession[];
  activeWorkout: WorkoutSession | null;
  skillSessions: SkillSession[];
  conditioningSessions: ConditioningSession[];
  recoveryEntries: RecoveryEntry[];
  calendarEvents: CalendarEvent[];
  progressionDecisions: ProgressionDecision[];
  openGymSessions: OpenGymSession[];
  activeHomeSession: HomeSessionDraft | null;
  /** Ids of scheduling suggestions the athlete dismissed. */
  dismissedAdvice: string[];
  updatedAt: Timestamp;
}

import type { DaySlotKind, Intensity, OpenGymStatus, SessionLocation, WorkoutKind } from "@/lib/types";

export const INTENSITY_LABELS: Record<Intensity, string> = { light: "Light", moderate: "Moderate", hard: "Hard" };
export const INTENSITY_OPTIONS = (Object.keys(INTENSITY_LABELS) as Intensity[]).map((v) => ({ value: v, label: INTENSITY_LABELS[v] }));

export const LOCATION_LABELS: Record<SessionLocation, string> = {
  gym: "Gym",
  home: "Home driveway",
  "open-gym": "Open gym",
  court: "Court",
};

export const KIND_LABELS: Record<WorkoutKind, string> = { strength: "Strength (gym)", basketball: "Basketball-focused" };

export const SLOT_LABELS: Record<DaySlotKind, string> = {
  "open-gym": "Optional open gym",
  flex: "Your choice",
  recovery: "Recovery / light shooting",
  rest: "Rest",
};

export const OPEN_GYM_STATUS_LABELS: Record<OpenGymStatus, string> = {
  planned: "Planned",
  attended: "Attended",
  skipped: "Skipped",
  replaced: "Replaced",
};

export const OPEN_GYM_SKILLS = ["Defense", "Rebounding", "Finishing", "Shooting", "Passing", "Post moves", "Screening", "Transition"];

/** Badge tone per occurrence status. */
export const STATUS_TONE = {
  planned: "accent",
  completed: "good",
  replaced: "neutral",
  modified: "warn",
  skipped: "neutral",
  missed: "bad",
} as const;

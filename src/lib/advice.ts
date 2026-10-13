/**
 * Smart weekly scheduling — suggestions only.
 *
 * Everything here proposes an adjustment with a reason; nothing is applied
 * until the athlete taps an action, and every suggestion can be dismissed.
 * Recovery data is used to suggest lighter training, never to diagnose.
 */
import type { AppState, ISODate } from "./types";
import { hardSessionDates, latestRecovery, weekSummary } from "./metrics";
import { currentWeekOccurrences, daySlotFor, occurrencesBetween, occurrencesOn, type Occurrence } from "./schedule";
import { addDays, daysBetween, formatDate, startOfWeek, todayISO } from "./utils";

export type AdviceAction =
  | { kind: "reduce"; label: string; plannedId: string; originalDate: ISODate }
  | { kind: "move"; label: string; plannedId: string; originalDate: ISODate; date: ISODate }
  | { kind: "skip"; label: string; plannedId: string; originalDate: ISODate; note: string }
  | { kind: "link"; label: string; href: string };

export interface Advice {
  id: string;
  level: "info" | "caution";
  title: string;
  reason: string;
  actions: AdviceAction[];
}

const dayName = (d: ISODate) => formatDate(d, { weekday: "long" });

/** A day with no planned workout that isn't the rest day — never suggests Sunday. */
function freeDay(state: AppState, from: ISODate, to: ISODate, avoid: ISODate[] = []): ISODate | null {
  const span = daysBetween(from, to);
  for (let i = 0; i <= span; i++) {
    const d = addDays(from, i);
    if (avoid.includes(d)) continue;
    if (daySlotFor(state, d)?.kind === "rest") continue;
    if (occurrencesOn(state, d).some((o) => o.status !== "skipped")) continue;
    return d;
  }
  return null;
}

function isIntense(o: Occurrence) {
  return o.workout.kind === "basketball" || o.workout.emphasis === "lower" || o.workout.emphasis === "speed";
}

export function weeklyAdvice(state: AppState, today: ISODate = todayISO()): Advice[] {
  const out: Advice[] = [];
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const upcoming = occurrencesBetween(state, today, addDays(today, 7)).filter((o) => o.status === "planned" || o.status === "modified");
  const summary = weekSummary(state, today);

  /* 1. Accumulated fatigue → reduce or replace the next intense session. */
  const latest = latestRecovery(state);
  const freshCheckIn = latest && daysBetween(latest.date, today) <= 1 ? latest : null;
  const hardRecent = hardSessionDates(state, addDays(today, -2), today);
  const fatigueReasons: string[] = [];
  if (freshCheckIn?.fatigue != null && freshCheckIn.fatigue >= 4) fatigueReasons.push(`fatigue ${freshCheckIn.fatigue}/5`);
  if (freshCheckIn?.soreness != null && freshCheckIn.soreness >= 4) fatigueReasons.push(`soreness ${freshCheckIn.soreness}/5`);
  if (freshCheckIn?.readiness != null && freshCheckIn.readiness <= 2) fatigueReasons.push(`readiness ${freshCheckIn.readiness}/5`);
  if (hardRecent.length >= 2) fatigueReasons.push(`${hardRecent.length} hard sessions in the last 3 days`);
  if (fatigueReasons.length) {
    const next = upcoming.find((o) => !o.session && !o.fulfilledBy && !o.override?.reduce && daysBetween(today, o.date) <= 4 && isIntense(o));
    if (next) {
      const later = freeDay(state, addDays(next.date, 1), addDays(next.date, 3));
      out.push({
        id: `fatigue:${next.key}`,
        level: "caution",
        title: `Go lighter on ${next.workout.label} (${dayName(next.date)})`,
        reason: `You've reported ${fatigueReasons.join(", ")}. Reducing volume or swapping in recovery protects your progress. This is a training suggestion, not a medical assessment.`,
        actions: [
          { kind: "reduce", label: "Use reduced volume", plannedId: next.plannedId, originalDate: next.originalDate },
          ...(later ? [{ kind: "move" as const, label: `Move to ${dayName(later)}`, plannedId: next.plannedId, originalDate: next.originalDate, date: later }] : []),
          { kind: "skip", label: "Make it a recovery day", plannedId: next.plannedId, originalDate: next.originalDate, note: "Replaced with recovery (fatigue)" },
        ],
      });
    }
  }

  /* 2. Avoid intense lower-body work right before another high-intensity day. */
  for (const o of upcoming) {
    if (o.workout.emphasis !== "lower" || o.session || o.override?.reduce) continue;
    const nextDay = addDays(o.date, 1);
    const prevDay = addDays(o.date, -1);
    const plannedOpenGym = (state.openGymSessions ?? []).some((g) => g.date === nextDay && g.status === "planned");
    const intenseNext = occurrencesOn(state, nextDay).some((x) => x.status === "planned" && x.workout.emphasis !== "upper" && x.workout.kind === "basketball");
    const hardBefore = (state.openGymSessions ?? []).some((g) => g.date === prevDay && g.status === "attended" && g.intensity === "hard");
    if (!plannedOpenGym && !intenseNext && !hardBefore) continue;
    const swapTo = freeDay(state, today, addDays(o.date, 3), [prevDay, o.date]);
    out.push({
      id: `lower:${o.key}`,
      level: "caution",
      title: `${o.workout.label} is ${hardBefore ? "right after a hard open gym" : `right before ${plannedOpenGym ? "open gym" : "a basketball session"}`}`,
      reason: hardBefore
        ? "Heavy leg work the day after hard basketball adds up. Keep it controlled, or move it."
        : `Hard lower-body work the day before ${plannedOpenGym ? "open gym" : "basketball"} can leave your legs flat. Keep it moderate, or move it to a day with recovery after.`,
      actions: [
        { kind: "reduce", label: "Keep it moderate (reduced volume)", plannedId: o.plannedId, originalDate: o.originalDate },
        ...(swapTo ? [{ kind: "move" as const, label: `Move to ${dayName(swapTo)}`, plannedId: o.plannedId, originalDate: o.originalDate, date: swapTo }] : []),
      ],
    });
  }

  /* 3. Hard running at open gym → trim extra conditioning this week. */
  const condLeft = currentWeekOccurrences(state, today).filter((o) => (o.status === "planned" || (o.status === "modified" && !o.session)) && o.date >= today && o.workout.conditioning.length > 0);
  if (summary.hardRunning && condLeft.length) {
    out.push({
      id: `conditioning:${weekStart}`,
      level: "info",
      title: "Trim extra conditioning this week",
      reason: `Open gym already gave you plenty of hard running. When you start ${condLeft[0].workout.label}, the conditioning finisher will be pre-set shorter — you can still change it.`,
      actions: [],
    });
  }

  /* 4. Lots of basketball already → shorter center-skills session. */
  const skillsLeft = currentWeekOccurrences(state, today).find((o) => o.status === "planned" && o.date >= today && o.workout.emphasis === "skills" && !o.override?.reduce);
  if (skillsLeft && (summary.basketballMinutes >= 180 || summary.basketballDone >= state.profile.basketballPerWeek)) {
    out.push({
      id: `bb-volume:${skillsLeft.key}`,
      level: "info",
      title: `Consider a shorter ${skillsLeft.workout.label} session`,
      reason: `You've logged ${summary.basketballMinutes} min of basketball across ${summary.basketballDone} session${summary.basketballDone === 1 ? "" : "s"} this week. A shorter session keeps the skill work without piling on volume.`,
      actions: [{ kind: "reduce", label: "Use the short version", plannedId: skillsLeft.plannedId, originalDate: skillsLeft.originalDate }],
    });
  }

  /* 5. Missed sessions → skip or reschedule. Never onto the rest day, never automatically. */
  for (const o of currentWeekOccurrences(state, today)) {
    if (o.status !== "missed") continue;
    const target = freeDay(state, today, weekEnd);
    out.push({
      id: `missed:${o.key}`,
      level: "info",
      title: `Missed ${o.workout.label} on ${dayName(o.date)}`,
      reason: target
        ? `No problem — skip it, or move it to ${dayName(target)}, which is free. It won't be made up on a rest day.`
        : "There's no free non-rest day left this week, so skipping it is the sensible call. Don't cram it in.",
      actions: [
        { kind: "skip", label: "Skip it", plannedId: o.plannedId, originalDate: o.originalDate, note: "Missed — skipped" },
        ...(target ? [{ kind: "move" as const, label: `Reschedule to ${dayName(target)}`, plannedId: o.plannedId, originalDate: o.originalDate, date: target }] : []),
      ],
    });
  }

  return out.filter((a) => !state.dismissedAdvice.includes(a.id));
}

/** Whether to pre-shorten conditioning for a session on `date`. */
export function shouldShortenConditioning(state: AppState, date: ISODate): boolean {
  return weekSummary(state, date).hardRunning;
}

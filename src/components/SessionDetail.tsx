"use client";

import type { LoggedSet, SessionExercise, WorkoutSession } from "@/lib/types";
import { useAppState } from "@/lib/store";
import { sessionTotals } from "@/lib/metrics";
import { MODALITY_LABELS } from "./ProfileForm";
import { formatLongDate, formatPct, formatWeight, percentage } from "@/lib/utils";
import { Badge } from "./ui";
import { INTENSITY_LABELS, LOCATION_LABELS } from "./labels";

function setText(s: LoggedSet, e: SessionExercise) {
  const side = s.side && s.side !== "both" ? ` (${s.side})` : "";
  let main: string;
  switch (e.trackingType) {
    case "weighted":
      main = `${s.weight !== null ? formatWeight(s.weight, s.unit) : "Bodyweight"} × ${s.reps ?? "—"}`;
      break;
    case "shooting":
      main = `${s.makes ?? 0}/${s.attempts ?? 0} · ${formatPct(percentage(s.makes ?? 0, s.attempts ?? 0))}`;
      break;
    case "timed":
      main = `${s.durationSec ?? 0} s`;
      break;
    case "cardio":
      main = `${Math.round(((s.durationSec ?? 0) / 60) * 10) / 10} min${s.distance ? ` · ${s.distance} ${s.distanceUnit}` : ""}`;
      break;
    case "distance":
      main = `${s.reps ?? 0} × ${s.distance ?? "—"} ${s.distanceUnit}`;
      break;
    default:
      main = `${s.reps ?? 0} reps`;
  }
  const extras = [s.effort !== null ? `effort ${s.effort}/10` : null, s.restSec !== null ? `rest ${s.restSec}s` : null, s.notes || null].filter(Boolean);
  return `${main}${side}${extras.length ? ` — ${extras.join(" · ")}` : ""}`;
}

export function SessionDetail({ session }: { session: WorkoutSession }) {
  const state = useAppState();
  const t = sessionTotals(session);
  const cond = session.conditioningSessionId ? state.conditioningSessions.find((c) => c.id === session.conditioningSessionId) : null;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted">{formatLongDate(session.date)}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge>Week {session.planWeek}</Badge>
          <Badge>{Math.round(session.durationSec / 60)} min</Badge>
          <Badge>
            {t.exercisesCompleted} exercises · {t.totalSets} sets
          </Badge>
          <Badge>{LOCATION_LABELS[session.location ?? "gym"]}</Badge>
          {session.intensity && <Badge tone={session.intensity === "hard" ? "warn" : "neutral"}>{INTENSITY_LABELS[session.intensity]}</Badge>}
          {session.completion && <Badge tone={session.completion === "complete" ? "good" : "neutral"}>{session.completion === "complete" ? "Completed" : "Partially completed"}</Badge>}
          {session.modified && <Badge tone="warn">Modified · {session.modified.reason.replace("-", " ")}</Badge>}
        </div>
        {session.modified?.note && <p className="mt-2 text-sm text-muted">{session.modified.note}</p>}
      </div>
      <ul className="space-y-3">
        {session.exercises.map((e) => (
          <li key={e.id} className="rounded-xl border border-line p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{e.name}</p>
              {e.status === "skipped" && <Badge tone="warn">Skipped</Badge>}
              {e.substitutedFrom && <Badge tone="accent">for {e.substitutedFrom.name}</Badge>}
              {e.isExtra && <Badge>Extra</Badge>}
            </div>
            {e.sets.length ? (
              <ol className="mt-1.5 space-y-0.5 text-sm text-muted">
                {e.sets.map((s, i) => (
                  <li key={s.id} className="tabular">
                    {i + 1}. {setText(s, e)}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-1 text-sm text-subtle">No sets logged.</p>
            )}
            {e.notes && <p className="mt-1.5 text-sm italic text-muted">“{e.notes}”</p>}
          </li>
        ))}
      </ul>
      {cond && (
        <div className="rounded-xl border border-line p-3 text-sm">
          <p className="font-semibold">Conditioning — {cond.activityType === "custom" ? cond.customName || "Custom" : MODALITY_LABELS[cond.activityType]}</p>
          <p className="text-muted">
            {cond.completedRounds}/{cond.plannedRounds} rounds · {cond.workSec}s on / {cond.recoverySec}s off · {cond.totalDurationMin} min · effort {cond.effort}/10
            {cond.distance !== null ? ` · ${cond.distance} ${cond.distanceUnit}` : ""}
          </p>
        </div>
      )}
      {session.conditioning && !session.conditioning.enabled && (
        <p className="text-sm text-muted">Conditioning skipped{session.conditioning.skippedReason ? ` — ${session.conditioning.skippedReason}` : ""}.</p>
      )}
      {session.notes && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{session.notes}</p>
        </div>
      )}
    </div>
  );
}

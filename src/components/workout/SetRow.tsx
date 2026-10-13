"use client";

import { useState } from "react";
import { Check, ChevronDown, Trash2 } from "lucide-react";
import type { LoggedSet, SessionExercise } from "@/lib/types";
import { cn, formatPct, percentage } from "@/lib/utils";
import { NumberStepper } from "../ui";

export function validateSet(set: LoggedSet, ex: SessionExercise): string | null {
  switch (ex.trackingType) {
    case "shooting":
      if (set.attempts === null || set.attempts <= 0) return "Enter attempts.";
      if (set.makes === null) return "Enter makes (0 is fine).";
      if (set.makes > set.attempts) return "Makes can't exceed attempts.";
      return null;
    case "timed":
      return set.durationSec && set.durationSec > 0 ? null : "Enter a duration.";
    default:
      return set.reps !== null && set.reps > 0 ? null : "Enter reps.";
  }
}

export function SetRow({
  index,
  set,
  exercise,
  onChange,
  onToggle,
  onDelete,
}: {
  index: number;
  set: LoggedSet;
  exercise: SessionExercise;
  onChange: (patch: Partial<LoggedSet>) => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState(false);
  const t = exercise.trackingType;
  const isOutlet = exercise.skillDrillId === "drill-outlet";
  const sided = set.side === "left" || set.side === "right";
  const unitStep = set.unit === "kg" ? 2.5 : 5;
  const label = `set ${index + 1}`;

  const toggle = () => {
    if (!set.completed) {
      const err = validateSet(set, exercise);
      setError(err);
      if (err) return;
    }
    setError(null);
    onToggle();
  };

  let fields: React.ReactNode;
  if (t === "weighted") {
    fields = (
      <>
        <NumberStepper label={`Weight for ${label}`} value={set.weight} onChange={(v) => onChange({ weight: v })} step={unitStep} suffix={set.unit} placeholder="BW" />
        <NumberStepper label={`Reps for ${label}`} value={set.reps} onChange={(v) => onChange({ reps: v })} suffix="reps" />
      </>
    );
  } else if (t === "shooting") {
    fields = (
      <>
        <NumberStepper label={`${isOutlet ? "Accurate outlets" : "Makes"} for ${label}`} value={set.makes} onChange={(v) => onChange({ makes: v })} suffix={isOutlet ? "acc" : "made"} />
        <NumberStepper label={`${isOutlet ? "Reps" : "Attempts"} for ${label}`} value={set.attempts} onChange={(v) => onChange({ attempts: v })} suffix={isOutlet ? "reps" : "att"} />
      </>
    );
  } else if (t === "timed") {
    fields = (
      <div className="col-span-2">
        <NumberStepper label={`Seconds for ${label}`} value={set.durationSec} onChange={(v) => onChange({ durationSec: v })} step={5} suffix="sec" />
      </div>
    );
  } else if (t === "distance") {
    fields = (
      <>
        <NumberStepper label={`Reps for ${label}`} value={set.reps} onChange={(v) => onChange({ reps: v })} suffix="reps" />
        <NumberStepper label={`Distance for ${label}`} value={set.distance} onChange={(v) => onChange({ distance: v })} suffix={set.distanceUnit} />
      </>
    );
  } else {
    fields = (
      <div className="col-span-2">
        <NumberStepper label={`Reps for ${label}`} value={set.reps} onChange={(v) => onChange({ reps: v })} suffix={t === "reps-side" && !sided ? "reps/side" : "reps"} />
      </div>
    );
  }

  const pct = t === "shooting" && set.makes !== null && set.attempts ? percentage(set.makes, set.attempts) : null;

  return (
    <li className={cn("rounded-2xl border p-2.5 transition-colors sm:p-3", set.completed ? "border-good/30 bg-good-soft" : "border-line bg-surface-2")}>
      <div className="mb-2 flex items-center gap-1.5 text-xs sm:gap-2">
        <span className="whitespace-nowrap font-semibold uppercase tracking-wider text-muted">Set {index + 1}</span>
        {sided && (
          <button
            type="button"
            onClick={() => onChange({ side: set.side === "left" ? "right" : "left" })}
            className="rounded-full bg-surface-3 px-2.5 py-1 font-medium text-text"
            aria-label={`Side: ${set.side}. Tap to switch.`}
          >
            {set.side === "left" ? "Left" : "Right"}
          </button>
        )}
        {pct !== null && <span className="font-semibold text-accent tabular">{formatPct(pct)}</span>}
                <label className="sr-only" htmlFor={`effort-${set.id}`}>
          Effort for {label}
        </label>
        <select
          id={`effort-${set.id}`}
          value={set.effort ?? ""}
          onChange={(e) => onChange({ effort: e.target.value ? Number(e.target.value) : null })}
          className="ml-auto h-8 w-24 min-w-0 rounded-lg border border-line-strong bg-surface px-2 text-xs text-text sm:w-auto"
        >
          <option value="">Effort —</option>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              Effort {n}/10{n === 8 ? " (~2 RIR)" : ""}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => setDetails((d) => !d)} aria-expanded={details} aria-label={`More details for ${label}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-3">
          <ChevronDown size={16} className={cn("transition-transform", details && "rotate-180")} />
        </button>
        <button type="button" onClick={onDelete} aria-label={`Delete ${label}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-bad-soft hover:text-bad">
          <Trash2 size={15} />
        </button>
      </div>
      <div className="grid grid-cols-[1fr_1fr_52px] gap-1.5 sm:grid-cols-[1fr_1fr_56px] sm:gap-2">
        {fields}
        <button
          type="button"
          onClick={toggle}
          aria-pressed={set.completed}
          aria-label={set.completed ? `Mark ${label} not completed` : `Complete ${label}`}
          className={cn(
            "flex h-12 items-center justify-center rounded-xl border-2 transition-colors",
            set.completed ? "border-good bg-good text-black" : "border-line-strong text-muted hover:border-accent hover:text-accent",
          )}
        >
          <Check size={22} strokeWidth={3} />
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-bad" role="alert">
          {error}
        </p>
      )}
      {details && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-muted">
            Rest before this set (sec)
            <input
              type="number"
              inputMode="numeric"
              value={set.restSec ?? ""}
              onChange={(e) => onChange({ restSec: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
              className="mt-1 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-text"
            />
          </label>
          {(t === "shooting" || t === "reps-side") && !sided && (
            <label className="text-xs text-muted">
              Hand / side
              <select
                value={set.side ?? ""}
                onChange={(e) => onChange({ side: (e.target.value || null) as LoggedSet["side"] })}
                className="mt-1 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-text"
              >
                <option value="">Not specified</option>
                <option value="right">Right</option>
                <option value="left">Left</option>
                <option value="both">Both</option>
              </select>
            </label>
          )}
          <label className="text-xs text-muted sm:col-span-2">
            Set notes
            <input
              value={set.notes}
              onChange={(e) => onChange({ notes: e.target.value })}
              className="mt-1 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-text"
              placeholder="e.g. felt strong, form cue"
            />
          </label>
        </div>
      )}
    </li>
  );
}

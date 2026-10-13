"use client";

import { useEffect, useRef } from "react";
import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import type { RestTimerState } from "@/lib/types";
import { cn, formatDuration } from "@/lib/utils";

export function restRemaining(t: RestTimerState, now: number): number {
  if (t.endsAt !== null) return Math.max(0, Math.ceil((t.endsAt - now) / 1000));
  if (t.remainingSec !== null) return t.remainingSec;
  return t.durationSec;
}

export function RestTimer({
  timer,
  now,
  onChange,
  recommendation,
}: {
  timer: RestTimerState;
  now: number;
  onChange: (t: RestTimerState) => void;
  recommendation: string;
}) {
  const remaining = Math.min(restRemaining(timer, now), Math.max(timer.durationSec, timer.remainingSec ?? 0));
  const running = timer.endsAt !== null && remaining > 0;
  const finished = timer.endsAt !== null && remaining === 0;
  const paused = timer.endsAt === null && timer.remainingSec !== null;
  const notified = useRef(false);

  useEffect(() => {
    if (finished && !notified.current) {
      notified.current = true;
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([200, 100, 200]);
    }
    if (!finished) notified.current = false;
  }, [finished]);

  const start = () => onChange({ ...timer, endsAt: Date.now() + timer.durationSec * 1000, remainingSec: null });
  const pause = () => onChange({ ...timer, endsAt: null, remainingSec: remaining });
  const resume = () => onChange({ ...timer, endsAt: Date.now() + (timer.remainingSec ?? timer.durationSec) * 1000, remainingSec: null });
  const reset = () => onChange({ ...timer, endsAt: null, remainingSec: null });
  const adjust = (delta: number) => {
    const durationSec = Math.max(15, timer.durationSec + delta);
    if (timer.endsAt !== null) onChange({ ...timer, durationSec, endsAt: Math.max(Date.now(), timer.endsAt + delta * 1000) });
    else if (timer.remainingSec !== null) onChange({ ...timer, durationSec, remainingSec: Math.max(0, timer.remainingSec + delta) });
    else onChange({ ...timer, durationSec });
  };

  const pct = timer.durationSec > 0 ? (remaining / timer.durationSec) * 100 : 0;

  return (
    <div className={cn("rounded-2xl border bg-surface p-3 shadow-2xl", finished ? "border-good/50" : "border-line-strong")} aria-label="Rest timer">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Timer size={18} className={finished ? "text-good" : "text-accent"} aria-hidden />
          <div className="min-w-0">
            <p className={cn("font-display text-3xl font-bold leading-none tabular", finished && "text-good")} aria-live="polite" aria-atomic="true">
              {finished ? "Go!" : formatDuration(remaining)}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-subtle">{finished ? "Rest complete" : `Rest · ${recommendation}`}</p>
          </div>
        </div>
        <button onClick={() => adjust(-15)} className="h-11 w-11 rounded-xl text-xs font-semibold text-muted hover:bg-surface-2" aria-label="Subtract 15 seconds">
          −15
        </button>
        <button onClick={() => adjust(15)} className="h-11 w-11 rounded-xl text-xs font-semibold text-muted hover:bg-surface-2" aria-label="Add 15 seconds">
          +15
        </button>
        <button onClick={reset} className="flex h-11 w-11 items-center justify-center rounded-xl text-muted hover:bg-surface-2" aria-label="Reset rest timer">
          <RotateCcw size={18} />
        </button>
        {running ? (
          <button onClick={pause} className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-3 text-text" aria-label="Pause rest timer">
            <Pause size={20} />
          </button>
        ) : paused ? (
          <button onClick={resume} className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-ink" aria-label="Resume rest timer">
            <Play size={20} />
          </button>
        ) : (
          <button onClick={start} className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-ink" aria-label="Start rest timer">
            <Play size={20} />
          </button>
        )}
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3" aria-hidden>
        <div className={cn("h-full rounded-full", finished ? "bg-good" : "bg-accent")} style={{ width: `${finished ? 100 : pct}%` }} />
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import type { ConditioningDraft, ConditioningModality, ConditioningOption } from "@/lib/types";
import { cn, formatDuration } from "@/lib/utils";
import { MODALITY_LABELS } from "../ProfileForm";
import { Button, Field, Input, NumberStepper, Rating, Select, Textarea } from "../ui";

type Phase = "work" | "recover";
interface IntervalState {
  phase: Phase;
  endsAt: number | null;
  pausedRemaining: number | null;
}

const SKIP_REASONS = ["Played a game", "Fatigued", "Short on time", "Professional guidance", "Other"];

export function ConditioningBlock({
  draft,
  options,
  onChange,
  now,
}: {
  draft: ConditioningDraft;
  options: ConditioningOption[];
  onChange: (patch: Partial<ConditioningDraft>) => void;
  now: number;
}) {
  const [iv, setIv] = useState<IntervalState>({ phase: "work", endsAt: null, pausedRemaining: null });
  const remaining = iv.endsAt !== null ? Math.max(0, Math.ceil((iv.endsAt - now) / 1000)) : iv.pausedRemaining ?? draft.workSec;
  const running = iv.endsAt !== null;

  // Advance phases when a countdown reaches zero.
  useEffect(() => {
    if (iv.endsAt === null) return;
    const t = setTimeout(() => {
      if (iv.phase === "work") {
        navigator.vibrate?.(150);
        setIv({ phase: "recover", endsAt: Date.now() + draft.recoverySec * 1000, pausedRemaining: null });
      } else {
        const done = draft.completedRounds + 1;
        onChange({ completedRounds: done });
        navigator.vibrate?.([150, 80, 150]);
        if (done >= draft.plannedRounds) setIv({ phase: "work", endsAt: null, pausedRemaining: null });
        else setIv({ phase: "work", endsAt: Date.now() + draft.workSec * 1000, pausedRemaining: null });
      }
    }, Math.max(0, iv.endsAt - Date.now()));
    return () => clearTimeout(t);
  }, [iv, draft.recoverySec, draft.workSec, draft.completedRounds, draft.plannedRounds, onChange]);

  if (!draft.enabled) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Conditioning finisher skipped{draft.skippedReason ? ` — ${draft.skippedReason.toLowerCase()}` : ""}. That&apos;s a sensible call after a game or when
          fatigued.
        </p>
        <Button variant="secondary" onClick={() => onChange({ enabled: true, skippedReason: "" })}>
          Do conditioning after all
        </Button>
      </div>
    );
  }

  const chooseOption = (id: string) => {
    if (id === "custom") return onChange({ optionId: null, modality: "custom" });
    const o = options.find((x) => x.id === id);
    if (!o) return;
    onChange({ optionId: o.id, modality: o.modality, workSec: o.workSec, recoverySec: o.recoverySec });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Option" htmlFor="cond-option">
          <Select id="cond-option" value={draft.optionId ?? "custom"} onChange={(e) => chooseOption(e.target.value)}>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label} — {o.workSec}s / {o.recoverySec}s
              </option>
            ))}
            <option value="custom">Replace with something else…</option>
          </Select>
        </Field>
        <Field label="Modality" htmlFor="cond-mod">
          <Select id="cond-mod" value={draft.modality} onChange={(e) => onChange({ modality: e.target.value as ConditioningModality })}>
            {(Object.keys(MODALITY_LABELS) as ConditioningModality[]).map((m) => (
              <option key={m} value={m}>
                {MODALITY_LABELS[m]}
              </option>
            ))}
          </Select>
        </Field>
        {draft.modality === "custom" && (
          <Field label="Custom activity name" htmlFor="cond-custom" className="sm:col-span-2">
            <Input id="cond-custom" value={draft.customName} onChange={(e) => onChange({ customName: e.target.value })} placeholder="e.g. Rower, pool intervals" />
          </Field>
        )}
      </div>

      {/* Interval timer */}
      <div className="rounded-2xl border border-line bg-surface-2 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className={cn("text-xs font-semibold uppercase tracking-wider", iv.phase === "work" ? "text-accent" : "text-good")}>
              {iv.phase === "work" ? "Work — moderately hard" : "Recover — easy"}
            </p>
            <p className="font-display text-5xl font-bold tabular" aria-live="polite">
              {formatDuration(iv.phase === "recover" && iv.endsAt === null && iv.pausedRemaining === null ? draft.recoverySec : remaining)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-subtle">Rounds</p>
            <p className="font-display text-4xl font-bold tabular">
              {draft.completedRounds}
              <span className="text-xl text-subtle">/{draft.plannedRounds}</span>
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {running ? (
            <Button variant="secondary" size="lg" onClick={() => setIv({ ...iv, endsAt: null, pausedRemaining: remaining })}>
              <Pause size={18} /> Pause
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={() => setIv({ ...iv, endsAt: Date.now() + (iv.pausedRemaining ?? (iv.phase === "work" ? draft.workSec : draft.recoverySec)) * 1000, pausedRemaining: null })}
            >
              <Play size={18} /> {iv.pausedRemaining !== null ? "Resume" : "Start intervals"}
            </Button>
          )}
          <Button variant="ghost" size="lg" onClick={() => setIv({ phase: "work", endsAt: null, pausedRemaining: null })}>
            <RotateCcw size={18} /> Reset
          </Button>
        </div>
        <p className="mt-3 text-xs text-subtle">Keep effort controlled rather than all-out. The timer counts a round after each recovery interval — you can also adjust rounds manually.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Completed rounds" htmlFor="cond-done">
          <NumberStepper id="cond-done" label="Completed rounds" value={draft.completedRounds} onChange={(v) => onChange({ completedRounds: v ?? 0 })} max={50} size="lg" />
        </Field>
        <Field label="Planned rounds" htmlFor="cond-planned">
          <NumberStepper id="cond-planned" label="Planned rounds" value={draft.plannedRounds} onChange={(v) => onChange({ plannedRounds: Math.max(1, v ?? 1) })} min={1} max={50} size="lg" />
        </Field>
        <Field label="Work interval" htmlFor="cond-work">
          <NumberStepper id="cond-work" label="Work interval seconds" value={draft.workSec} onChange={(v) => onChange({ workSec: Math.max(5, v ?? 5) })} step={5} suffix="sec" />
        </Field>
        <Field label="Recovery interval" htmlFor="cond-rec">
          <NumberStepper id="cond-rec" label="Recovery interval seconds" value={draft.recoverySec} onChange={(v) => onChange({ recoverySec: Math.max(0, v ?? 0) })} step={5} suffix="sec" />
        </Field>
        <Field label="Total duration (optional)" htmlFor="cond-dur" hint={`If blank, saved as ${Math.round((draft.completedRounds * (draft.workSec + draft.recoverySec)) / 60)} min from rounds × interval length.`}>
          <NumberStepper id="cond-dur" label="Total duration minutes" value={draft.totalDurationMin} onChange={(v) => onChange({ totalDurationMin: v })} suffix="min" />
        </Field>
        <Field label="Distance (optional)" htmlFor="cond-dist">
          <div className="flex gap-2">
            <Input
              id="cond-dist"
              type="number"
              inputMode="decimal"
              value={draft.distance ?? ""}
              onChange={(e) => onChange({ distance: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
            />
            <Select aria-label="Distance unit" value={draft.distanceUnit} onChange={(e) => onChange({ distanceUnit: e.target.value as ConditioningDraft["distanceUnit"] })} className="w-24">
              <option value="mi">mi</option>
              <option value="km">km</option>
              <option value="yd">yd</option>
              <option value="m">m</option>
            </Select>
          </div>
        </Field>
      </div>
      <div>
        <p className="mb-1.5 text-sm font-medium">Perceived effort (1–10)</p>
        <Rating label="Conditioning perceived effort" max={10} value={draft.effort} onChange={(v) => onChange({ effort: v })} lowLabel="Very easy" highLabel="Max" />
      </div>
      <Field label="Conditioning notes" htmlFor="cond-notes">
        <Textarea id="cond-notes" value={draft.notes} onChange={(e) => onChange({ notes: e.target.value })} className="min-h-[64px]" />
      </Field>

      <div className="border-t border-line pt-4">
        <p className="mb-2 text-sm font-medium">Skip the finisher</p>
        <div className="flex flex-wrap gap-2">
          {SKIP_REASONS.map((r) => (
            <Button key={r} variant="outline" size="sm" onClick={() => onChange({ enabled: false, skippedReason: r })}>
              {r}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

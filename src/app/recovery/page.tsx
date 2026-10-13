"use client";

import { useState } from "react";
import { BedDouble, Pencil, Trash2 } from "lucide-react";
import type { RecoveryEntry } from "@/lib/types";
import { useAppState } from "@/lib/store";
import { deleteRecovery, saveRecovery } from "@/lib/actions";
import { completedSessions, latestRecovery, recoveryAverages, recoverySorted } from "@/lib/metrics";
import { addDays, cn, formatDate, nowISO, todayISO, uid } from "@/lib/utils";
import { SimpleBarChart, SimpleLineChart } from "@/components/charts";
import { RecoveryAdvice } from "@/components/RecoveryAdvice";
import { Badge, Button, Card, CardTitle, ConfirmDialog, EmptyState, Field, IconButton, Input, PageHeader, Rating, Segmented, Stat, Textarea, useToast, useUnsavedWarning } from "@/components/ui";

const DAY_TYPES: { value: RecoveryEntry["dayType"]; label: string }[] = [
  { value: "training", label: "Training day" },
  { value: "active-recovery", label: "Active recovery" },
  { value: "rest", label: "Rest day" },
];

export default function RecoveryPage() {
  const state = useAppState();
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const entries = recoverySorted(state);
  const existing = entries.find((e) => e.date === date) ?? null;
  const latest = latestRecovery(state);
  const avg7 = recoveryAverages(entries.filter((e) => e.date >= addDays(todayISO(), -6)));

  const today = todayISO();
  const days = Array.from({ length: 21 }, (_, i) => addDays(today, i - 20));
  const sessions = completedSessions(state);
  const chart = days.map((d) => {
    const e = entries.find((x) => x.date === d);
    return {
      label: formatDate(d),
      readiness: e?.readiness ?? null,
      energy: e?.energy ?? null,
      soreness: e?.soreness ?? null,
      sleep: e?.sleepHours ?? null,
    };
  });
  const recentDays = days.slice(-14).reverse();

  return (
    <div>
      <PageHeader title="Recovery" subtitle="A quick daily check-in. Suggestions are conservative training adjustments — never a diagnosis." />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardTitle icon={<BedDouble size={16} />} sub={existing ? "Editing the saved check-in for this date" : "One check-in per day"}>
            Daily check-in
          </CardTitle>
          <Field label="Date" htmlFor="rc-date" className="mb-4">
            <Input id="rc-date" type="date" max={today} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </Field>
          <CheckInForm
            key={`${date}-${existing?.id ?? "new"}`}
            date={date}
            existing={existing}
            onSaved={() => toast(existing ? "Check-in updated." : "Check-in saved.")}
          />
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <RecoveryAdvice entry={latest} />
          {entries.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Readiness (7d)" value={avg7.readiness?.toFixed(1) ?? "—"} sub="average, 1–5" />
              <Stat label="Sleep (7d)" value={avg7.sleepHours !== null ? `${avg7.sleepHours.toFixed(1)} h` : "—"} sub="average per night" />
              <Stat label="Energy (7d)" value={avg7.energy?.toFixed(1) ?? "—"} sub="average, 1–5" />
              <Stat label="Soreness (7d)" value={avg7.soreness?.toFixed(1) ?? "—"} sub="1 none – 5 very" />
            </div>
          )}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={<BedDouble size={22} />} title="No check-ins yet">
            Your recovery trends will appear here alongside your training once you&apos;ve logged a few days.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardTitle sub="Last 21 days, 1–5 scale">Readiness, energy & soreness</CardTitle>
              <SimpleLineChart
                data={chart}
                xKey="label"
                domain={[1, 5]}
                label="Readiness, energy and soreness over the last 21 days"
                series={[
                  { key: "readiness", name: "Readiness" },
                  { key: "energy", name: "Energy" },
                  { key: "soreness", name: "Soreness" },
                ]}
              />
            </Card>
            <Card>
              <CardTitle sub="Last 21 days">Sleep (hours)</CardTitle>
              <SimpleBarChart data={chart} xKey="label" series={[{ key: "sleep", name: "Sleep", color: "var(--chart-2)" }]} label="Sleep hours over the last 21 days" valueSuffix=" h" />
            </Card>
          </div>

          <Card className="mt-4">
            <CardTitle sub="Last 14 days — check-ins next to the training you logged">Recovery alongside training</CardTitle>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-subtle">
                    <th className="py-2 font-medium">Date</th>
                    <th className="py-2 font-medium">Sleep</th>
                    <th className="py-2 font-medium">Readiness</th>
                    <th className="py-2 font-medium">Soreness</th>
                    <th className="py-2 font-medium">Training</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {recentDays.map((d) => {
                    const e = entries.find((x) => x.date === d);
                    const trained = sessions.filter((s) => s.date === d);
                    const cond = state.conditioningSessions.filter((c) => c.date === d && !c.workoutSessionId);
                    const skills = state.skillSessions.filter((s) => s.date === d);
                    const activity = [...trained.map((s) => s.workoutName.replace(/^Day \d — /, "")), ...cond.map(() => "Conditioning"), ...skills.map(() => "Skills")];
                    return (
                      <tr key={d} className="border-b border-line">
                        <td className="py-2.5 whitespace-nowrap">{formatDate(d, { weekday: "short", month: "short", day: "numeric" })}</td>
                        <td className="tabular">{e?.sleepHours != null ? `${e.sleepHours} h` : "—"}</td>
                        <td>{e ? <ScoreDot value={e.readiness} /> : <span className="text-subtle">—</span>}</td>
                        <td>{e ? <ScoreDot value={e.soreness} invert /> : <span className="text-subtle">—</span>}</td>
                        <td className="text-muted">
                          {activity.length ? activity.join(", ") : e?.dayType === "rest" ? "Rest" : e?.dayType === "active-recovery" ? "Active recovery" : <span className="text-subtle">—</span>}
                        </td>
                        <td className="text-right">
                          {e && (
                            <span className="inline-flex">
                              <IconButton label={`Edit check-in for ${formatDate(d)}`} onClick={() => setDate(d)}>
                                <Pencil size={15} />
                              </IconButton>
                              <IconButton label={`Delete check-in for ${formatDate(d)}`} onClick={() => setConfirmId(e.id)}>
                                <Trash2 size={15} />
                              </IconButton>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        danger
        title="Delete this check-in?"
        message="It will be removed from your recovery trends."
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmId) deleteRecovery(confirmId);
          toast("Check-in deleted.");
        }}
      />
    </div>
  );
}

function ScoreDot({ value, invert }: { value: number; invert?: boolean }) {
  const good = invert ? value <= 2 : value >= 4;
  const bad = invert ? value >= 4 : value <= 2;
  return (
    <Badge tone={good ? "good" : bad ? "warn" : "neutral"} className="tabular">
      {value}/5
    </Badge>
  );
}

function CheckInForm({ date, existing, onSaved }: { date: string; existing: RecoveryEntry | null; onSaved: () => void }) {
  const [sleepHours, setSleepHours] = useState(existing?.sleepHours != null ? String(existing.sleepHours) : "");
  const [sleepQuality, setSleepQuality] = useState<number | null>(existing?.sleepQuality ?? null);
  const [energy, setEnergy] = useState<number | null>(existing?.energy ?? null);
  const [soreness, setSoreness] = useState<number | null>(existing?.soreness ?? null);
  const [readiness, setReadiness] = useState<number | null>(existing?.readiness ?? null);
  const [dayType, setDayType] = useState<RecoveryEntry["dayType"]>(existing?.dayType ?? "training");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  useUnsavedWarning(dirty);
  const d =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      setDirty(true);
      fn(v);
    };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const sh = sleepHours.trim() === "" ? null : Number(sleepHours);
    if (sh !== null && (!Number.isFinite(sh) || sh < 0 || sh > 24)) errs.sleepHours = "Enter hours between 0 and 24.";
    if (!sleepQuality) errs.sleepQuality = "Rate your sleep quality.";
    if (!energy) errs.energy = "Rate your energy.";
    if (!soreness) errs.soreness = "Rate your muscle soreness.";
    if (!readiness) errs.readiness = "Rate your readiness.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    saveRecovery({
      id: existing?.id ?? uid("rc"),
      date,
      sleepHours: sh,
      sleepQuality: sleepQuality!,
      energy: energy!,
      soreness: soreness!,
      readiness: readiness!,
      dayType,
      notes: notes.trim(),
      createdAt: existing?.createdAt ?? nowISO(),
      updatedAt: nowISO(),
    });
    setDirty(false);
    onSaved();
  };

  const err = (k: string) =>
    errors[k] ? (
      <p className="mt-1 text-xs text-bad" role="alert">
        {errors[k]}
      </p>
    ) : null;

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Field label="Sleep duration (hours)" htmlFor="rc-sleep" error={errors.sleepHours}>
        <Input id="rc-sleep" type="number" inputMode="decimal" step="0.5" value={sleepHours} onChange={(e) => d(setSleepHours)(e.target.value)} placeholder="e.g. 8" aria-invalid={!!errors.sleepHours} />
      </Field>
      <div>
        <p className="mb-1.5 text-sm font-medium">Sleep quality</p>
        <Rating label="Sleep quality" value={sleepQuality} onChange={d(setSleepQuality)} lowLabel="Poor" highLabel="Great" />
        {err("sleepQuality")}
      </div>
      <div>
        <p className="mb-1.5 text-sm font-medium">Energy</p>
        <Rating label="Energy" value={energy} onChange={d(setEnergy)} lowLabel="Drained" highLabel="Energized" />
        {err("energy")}
      </div>
      <div>
        <p className="mb-1.5 text-sm font-medium">Muscle soreness</p>
        <Rating label="Muscle soreness" value={soreness} onChange={d(setSoreness)} lowLabel="None" highLabel="Very sore" />
        {err("soreness")}
      </div>
      <div>
        <p className="mb-1.5 text-sm font-medium">General readiness to train</p>
        <Rating label="Readiness" value={readiness} onChange={d(setReadiness)} lowLabel="Not ready" highLabel="Ready" />
        {err("readiness")}
      </div>
      <div>
        <p className="mb-1.5 text-sm font-medium">Today is a…</p>
        <Segmented label="Day type" value={dayType} onChange={d(setDayType)} options={DAY_TYPES} size="sm" />
      </div>
      <Field label="Notes (optional)" htmlFor="rc-notes">
        <Textarea id="rc-notes" value={notes} onChange={(e) => d(setNotes)(e.target.value)} placeholder="Anything affecting recovery — schedule, stress, a game yesterday…" />
      </Field>
      <div className={cn("flex justify-end")}>
        <Button type="submit" size="lg" className="w-full sm:w-auto">
          {existing ? "Update check-in" : "Save check-in"}
        </Button>
      </div>
    </form>
  );
}

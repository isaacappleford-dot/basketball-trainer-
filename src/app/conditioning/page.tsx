"use client";

import { useState } from "react";
import { HeartPulse, Pencil, Plus, Trash2 } from "lucide-react";
import type { ConditioningModality, ConditioningSession } from "@/lib/types";
import { useAppState } from "@/lib/store";
import { deleteConditioning, saveConditioning } from "@/lib/actions";
import { conditioningSorted } from "@/lib/metrics";
import { average, formatDate, nowISO, sum, todayISO, uid } from "@/lib/utils";
import { MODALITY_LABELS } from "@/components/ProfileForm";
import { SimpleBarChart, SimpleLineChart } from "@/components/charts";
import { Alert, Badge, Button, Card, CardTitle, ConfirmDialog, EmptyState, Field, IconButton, Input, Modal, PageHeader, Rating, Select, Stat, Textarea, useToast, useUnsavedWarning } from "@/components/ui";

const PRESETS: { label: string; modality: ConditioningModality; rounds: number; work: number; rec: number }[] = [
  { label: "Bike intervals 8 × 30/60", modality: "bike", rounds: 8, work: 30, rec: 60 },
  { label: "Elliptical intervals 8 × 30/60", modality: "elliptical", rounds: 8, work: 30, rec: 60 },
  { label: "Court conditioning 8 × 20/40", modality: "court", rounds: 8, work: 20, rec: 40 },
  { label: "Treadmill session", modality: "treadmill", rounds: 0, work: 0, rec: 0 },
  { label: "Walking session", modality: "walking", rounds: 0, work: 0, rec: 0 },
];

function label(c: ConditioningSession) {
  return c.activityType === "custom" ? c.customName || "Custom" : MODALITY_LABELS[c.activityType];
}

export default function ConditioningPage() {
  const state = useAppState();
  const toast = useToast();
  const [editing, setEditing] = useState<ConditioningSession | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ConditioningModality | "">("");
  const all = conditioningSorted(state);
  const list = all.filter((c) => !filter || c.activityType === filter);

  const blank = (preset?: (typeof PRESETS)[number]): ConditioningSession => ({
    id: uid("cs"),
    date: todayISO(),
    activityType: preset?.modality ?? state.profile.preferredConditioning,
    customName: "",
    totalDurationMin: preset && preset.rounds ? Math.round((preset.rounds * (preset.work + preset.rec)) / 60) : 20,
    workSec: preset?.work || null,
    recoverySec: preset?.rec || null,
    plannedRounds: preset?.rounds || null,
    completedRounds: preset?.rounds || null,
    effort: 6,
    distance: null,
    distanceUnit: "mi",
    notes: "",
    workoutSessionId: null,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  });

  const chart = list.map((c) => ({ label: formatDate(c.date), minutes: c.totalDurationMin, rounds: c.completedRounds ?? 0, effort: c.effort }));

  return (
    <div>
      <PageHeader
        title="Conditioning"
        subtitle="Bike, elliptical, treadmill, court, walking and custom sessions. Workout finishers are saved here automatically."
        actions={
          <Button onClick={() => setEditing(blank())}>
            <Plus size={16} /> Log session
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button key={p.label} variant="outline" size="sm" onClick={() => setEditing(blank(p))}>
            <Plus size={14} /> {p.label}
          </Button>
        ))}
      </div>

      {all.length === 0 ? (
        <EmptyState icon={<HeartPulse size={22} />} title="No conditioning logged yet" action={<Button onClick={() => setEditing(blank())}>Log a session</Button>}>
          Log intervals with planned and completed rounds, work and recovery durations, and perceived effort. Trends appear once you have sessions saved.
        </EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Sessions" value={list.length} />
            <Stat label="Total time" value={`${sum(list.map((c) => c.totalDurationMin))}`} sub="minutes" />
            <Stat label="Intervals" value={sum(list.map((c) => c.completedRounds ?? 0))} sub={`of ${sum(list.map((c) => c.plannedRounds ?? 0))} planned`} />
            <Stat label="Avg effort" value={average(list.map((c) => c.effort))?.toFixed(1) ?? "—"} sub="out of 10" />
          </div>

          <div className="mt-4">
            <Select aria-label="Filter by activity" value={filter} onChange={(e) => setFilter(e.target.value as ConditioningModality | "")} className="sm:max-w-xs">
              <option value="">All activities</option>
              {(Object.keys(MODALITY_LABELS) as ConditioningModality[]).map((m) => (
                <option key={m} value={m}>
                  {MODALITY_LABELS[m]}
                </option>
              ))}
            </Select>
          </div>

          {list.length > 0 && (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card>
                <CardTitle sub="Total duration per session">Duration</CardTitle>
                <SimpleBarChart data={chart} xKey="label" series={[{ key: "minutes", name: "Minutes", color: "var(--chart-3)" }]} label="Conditioning duration per session" valueSuffix=" min" />
              </Card>
              <Card>
                <CardTitle sub="Completed intervals per session">Intervals</CardTitle>
                <SimpleBarChart data={chart} xKey="label" series={[{ key: "rounds", name: "Rounds" }]} label="Completed intervals per session" />
              </Card>
              <Card className="lg:col-span-2">
                <CardTitle sub="Perceived effort, 1–10 (self-reported)">Effort</CardTitle>
                <SimpleLineChart data={chart} xKey="label" series={[{ key: "effort", name: "Effort", color: "var(--chart-2)" }]} domain={[0, 10]} label="Perceived effort per session" />
              </Card>
            </div>
          )}

          <Card className="mt-4">
            <CardTitle>History</CardTitle>
            {list.length === 0 ? (
              <p className="text-sm text-muted">No sessions for this activity.</p>
            ) : (
              <ul className="divide-y divide-line">
                {[...list].reverse().map((c) => (
                  <li key={c.id} className="flex items-start gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {label(c)} {c.workoutSessionId && <Badge>From workout</Badge>}
                      </p>
                      <p className="text-xs text-subtle">
                        {formatDate(c.date, { weekday: "short", month: "short", day: "numeric" })} · {c.totalDurationMin} min
                        {c.completedRounds !== null ? ` · ${c.completedRounds}/${c.plannedRounds ?? c.completedRounds} rounds` : ""}
                        {c.workSec ? ` · ${c.workSec}s/${c.recoverySec ?? 0}s` : ""} · effort {c.effort}/10
                        {c.distance !== null ? ` · ${c.distance} ${c.distanceUnit}` : ""}
                      </p>
                      {c.notes && <p className="mt-1 text-xs text-muted">{c.notes}</p>}
                    </div>
                    <IconButton label="Edit session" onClick={() => setEditing({ ...c })}>
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton label="Delete session" onClick={() => setConfirmId(c.id)}>
                      <Trash2 size={16} />
                    </IconButton>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {editing && (
        <ConditioningForm
          initial={editing}
          isNew={!state.conditioningSessions.some((c) => c.id === editing.id)}
          onClose={() => setEditing(null)}
          onSave={(c) => {
            saveConditioning(c);
            setEditing(null);
            toast("Conditioning session saved.");
          }}
        />
      )}
      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        danger
        title="Delete this session?"
        message="It will be removed from your conditioning history and charts."
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmId) deleteConditioning(confirmId);
          toast("Session deleted.");
        }}
      />
    </div>
  );
}

function ConditioningForm({ initial, isNew, onClose, onSave }: { initial: ConditioningSession; isNew: boolean; onClose: () => void; onSave: (c: ConditioningSession) => void }) {
  const [c, setC] = useState(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  useUnsavedWarning(dirty);
  const up = (patch: Partial<ConditioningSession>) => {
    setDirty(true);
    setC((x) => ({ ...x, ...patch }));
  };
  const n = (v: string) => (v === "" ? null : Number(v));

  const save = () => {
    const errs: string[] = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date) || c.date > todayISO()) errs.push("Choose a valid date (not in the future).");
    if (!(c.totalDurationMin > 0 && c.totalDurationMin <= 600)) errs.push("Total duration must be between 1 and 600 minutes.");
    if (!(c.effort >= 1 && c.effort <= 10)) errs.push("Choose a perceived effort from 1 to 10.");
    if (c.activityType === "custom" && !c.customName.trim()) errs.push("Name your custom activity.");
    if (c.completedRounds !== null && c.plannedRounds !== null && c.completedRounds > c.plannedRounds * 3) errs.push("Completed rounds look too high — check the numbers.");
    if ([c.workSec, c.recoverySec, c.plannedRounds, c.completedRounds, c.distance].some((v) => v !== null && (!Number.isFinite(v) || v < 0))) errs.push("Numbers can't be negative.");
    setErrors(errs);
    if (!errs.length) onSave({ ...c, customName: c.customName.trim(), notes: c.notes.trim() });
  };

  return (
    <>
      <Modal
        open
        onClose={() => (dirty ? setConfirmClose(true) : onClose())}
        title={isNew ? "Log conditioning" : "Edit conditioning"}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => (dirty ? setConfirmClose(true) : onClose())}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          {errors.length > 0 && (
            <Alert tone="bad" title="Please fix the following">
              <ul className="list-disc pl-4">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Alert>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date" htmlFor="c-date">
              <Input id="c-date" type="date" max={todayISO()} value={c.date} onChange={(e) => up({ date: e.target.value })} />
            </Field>
            <Field label="Activity type" htmlFor="c-type">
              <Select id="c-type" value={c.activityType} onChange={(e) => up({ activityType: e.target.value as ConditioningModality })}>
                {(Object.keys(MODALITY_LABELS) as ConditioningModality[]).map((m) => (
                  <option key={m} value={m}>
                    {MODALITY_LABELS[m]}
                  </option>
                ))}
              </Select>
            </Field>
            {c.activityType === "custom" && (
              <Field label="Custom activity name" htmlFor="c-custom" className="sm:col-span-2">
                <Input id="c-custom" value={c.customName} onChange={(e) => up({ customName: e.target.value })} />
              </Field>
            )}
            <Field label="Total duration (min)" htmlFor="c-dur">
              <Input id="c-dur" type="number" inputMode="decimal" value={c.totalDurationMin || ""} onChange={(e) => up({ totalDurationMin: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="Distance (optional)" htmlFor="c-dist" hint="Only if measured by your equipment.">
              <div className="flex gap-2">
                <Input id="c-dist" type="number" inputMode="decimal" value={c.distance ?? ""} onChange={(e) => up({ distance: n(e.target.value) })} />
                <Select aria-label="Distance unit" value={c.distanceUnit} onChange={(e) => up({ distanceUnit: e.target.value as ConditioningSession["distanceUnit"] })} className="w-24">
                  <option value="mi">mi</option>
                  <option value="km">km</option>
                  <option value="yd">yd</option>
                  <option value="m">m</option>
                </Select>
              </div>
            </Field>
            <Field label="Work interval (sec)" htmlFor="c-work">
              <Input id="c-work" type="number" inputMode="numeric" value={c.workSec ?? ""} onChange={(e) => up({ workSec: n(e.target.value) })} placeholder="Continuous" />
            </Field>
            <Field label="Recovery interval (sec)" htmlFor="c-rec">
              <Input id="c-rec" type="number" inputMode="numeric" value={c.recoverySec ?? ""} onChange={(e) => up({ recoverySec: n(e.target.value) })} />
            </Field>
            <Field label="Planned rounds" htmlFor="c-planned">
              <Input id="c-planned" type="number" inputMode="numeric" value={c.plannedRounds ?? ""} onChange={(e) => up({ plannedRounds: n(e.target.value) })} />
            </Field>
            <Field label="Completed rounds" htmlFor="c-done">
              <Input id="c-done" type="number" inputMode="numeric" value={c.completedRounds ?? ""} onChange={(e) => up({ completedRounds: n(e.target.value) })} />
            </Field>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">Perceived effort</p>
            <Rating label="Perceived effort" max={10} value={c.effort} onChange={(v) => up({ effort: v })} lowLabel="Very easy" highLabel="Max" />
          </div>
          <Field label="Notes" htmlFor="c-notes">
            <Textarea id="c-notes" value={c.notes} onChange={(e) => up({ notes: e.target.value })} />
          </Field>
        </div>
      </Modal>
      <ConfirmDialog open={confirmClose} onClose={() => setConfirmClose(false)} danger title="Discard changes?" message="This session hasn't been saved." confirmLabel="Discard" onConfirm={onClose} />
    </>
  );
}

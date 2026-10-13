"use client";

import { useState } from "react";
import { Pencil, Plus, Target, Trash2, Trophy } from "lucide-react";
import type { SkillDrill, SkillMetricKey, SkillResult, SkillSession } from "@/lib/types";
import { useAppState } from "@/lib/store";
import { deleteCustomDrill, deleteSkillSession, saveDrill, saveSkillSession } from "@/lib/actions";
import { allSkillPoints, hasShotMetrics, shotTotals } from "@/lib/metrics";
import { formatDate, formatPct, nowISO, percentage, sum, todayISO, uid } from "@/lib/utils";
import { SimpleBarChart, SimpleLineChart } from "@/components/charts";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardTitle,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
  useToast,
  useUnsavedWarning,
} from "@/components/ui";

const METRIC_LABELS: Record<SkillMetricKey, string> = {
  makes: "Makes",
  attempts: "Attempts",
  leftMakes: "Left-hand makes",
  leftAttempts: "Left-hand attempts",
  rightMakes: "Right-hand makes",
  rightAttempts: "Right-hand attempts",
  leftReps: "Left-side reps",
  rightReps: "Right-side reps",
  reps: "Reps completed",
  accurate: "Accurate",
  total: "Total",
  minutes: "Minutes",
};

const METRIC_GROUPS: { label: string; keys: SkillMetricKey[] }[] = [
  { label: "Makes & attempts", keys: ["makes", "attempts"] },
  { label: "Makes & attempts by hand", keys: ["leftMakes", "leftAttempts", "rightMakes", "rightAttempts"] },
  { label: "Reps by side", keys: ["leftReps", "rightReps"] },
  { label: "Reps completed", keys: ["reps"] },
  { label: "Accuracy (accurate / total)", keys: ["accurate", "total"] },
  { label: "Minutes", keys: ["minutes"] },
];

const PAIRS: [SkillMetricKey, SkillMetricKey][] = [
  ["makes", "attempts"],
  ["leftMakes", "leftAttempts"],
  ["rightMakes", "rightAttempts"],
  ["accurate", "total"],
];

function validateResult(r: SkillResult): string | null {
  const vals = Object.values(r.values).filter((v) => v !== undefined);
  if (!vals.length) return `${r.drillName}: enter at least one value.`;
  if (vals.some((v) => !Number.isFinite(v) || (v as number) < 0)) return `${r.drillName}: values can't be negative.`;
  for (const [m, a] of PAIRS) {
    const mv = r.values[m];
    const av = r.values[a];
    if (mv !== undefined && av !== undefined && mv > av) return `${r.drillName}: ${METRIC_LABELS[m].toLowerCase()} can't exceed ${METRIC_LABELS[a].toLowerCase()}.`;
    if (mv !== undefined && av === undefined) return `${r.drillName}: enter ${METRIC_LABELS[a].toLowerCase()} too.`;
  }
  return null;
}

export default function SkillsPage() {
  const state = useAppState();
  const toast = useToast();
  const [editing, setEditing] = useState<SkillSession | null>(null);
  const [drillForm, setDrillForm] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "session" | "drill"; id: string } | null>(null);
  const points = allSkillPoints(state);
  const [chartDrill, setChartDrill] = useState("");
  const drillsWithData = state.skillDrills.filter((d) => points.some((p) => p.drillId === d.id));
  const activeDrill = state.skillDrills.find((d) => d.id === (chartDrill || drillsWithData[0]?.id));

  const series = (() => {
    if (!activeDrill) return [];
    const dates = [...new Set(points.filter((p) => p.drillId === activeDrill.id).map((p) => p.date))].sort();
    return dates.map((date) => {
      const vals = points.filter((p) => p.drillId === activeDrill.id && p.date === date).map((p) => p.values);
      const t = shotTotals(vals);
      const reps = sum(vals.map((v) => (v.reps ?? 0) + (v.leftReps ?? 0) + (v.rightReps ?? 0)));
      const minutes = sum(vals.map((v) => v.minutes ?? 0));
      return { label: formatDate(date), pct: t.pct, reps, minutes, attempts: t.attempts };
    });
  })();

  const newSession = (): SkillSession => ({
    id: uid("ss"),
    date: todayISO(),
    results: [],
    gameNotes: "",
    notes: "",
    createdAt: nowISO(),
    updatedAt: nowISO(),
  });

  const sessions = [...state.skillSessions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  return (
    <div>
      <PageHeader
        title="Basketball Skills"
        subtitle="Record finishing, post moves, shooting, rebounding and defensive footwork. Day 4 workout logs count here too."
        actions={
          <>
            <Button variant="secondary" onClick={() => setDrillForm(true)}>
              <Plus size={16} /> Custom drill
            </Button>
            <Button onClick={() => setEditing(newSession())}>
              <Plus size={16} /> Log skills session
            </Button>
          </>
        }
      />

      {points.length === 0 ? (
        <EmptyState
          icon={<Target size={22} />}
          title="No skills logged yet"
          action={
            <Button onClick={() => setEditing(newSession())}>
              <Plus size={16} /> Log your first session
            </Button>
          }
        >
          Track Mikan drill makes, jump hooks by hand, free throws out of 20, drop steps, outlet accuracy and more. Percentages are calculated as makes ÷ attempts × 100.
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {drillsWithData.map((d) => {
              const vals = points.filter((p) => p.drillId === d.id);
              const t = shotTotals(vals.map((p) => p.values));
              const reps = sum(vals.map((p) => (p.values.reps ?? 0) + (p.values.leftReps ?? 0) + (p.values.rightReps ?? 0)));
              const lr = sum(vals.map((p) => p.values.leftReps ?? 0));
              const rr = sum(vals.map((p) => p.values.rightReps ?? 0));
              const minutes = sum(vals.map((p) => p.values.minutes ?? 0));
              // Personal best: best single-day % with at least 5 attempts.
              const byDay = new Map<string, typeof vals>();
              vals.forEach((p) => byDay.set(p.date, [...(byDay.get(p.date) ?? []), p]));
              let best: { pct: number; date: string; label: string } | null = null;
              let bestReps: { reps: number; date: string } | null = null;
              for (const [date, ps] of byDay) {
                const dt = shotTotals(ps.map((p) => p.values));
                if (dt.pct !== null && dt.attempts >= 5 && (!best || dt.pct > best.pct)) best = { pct: dt.pct, date, label: `${dt.makes}/${dt.attempts}` };
                const r = sum(ps.map((p) => (p.values.reps ?? 0) + (p.values.leftReps ?? 0) + (p.values.rightReps ?? 0)));
                if (r > 0 && (!bestReps || r > bestReps.reps)) bestReps = { reps: r, date };
              }
              return (
                <button
                  key={d.id}
                  onClick={() => setChartDrill(d.id)}
                  aria-pressed={activeDrill?.id === d.id}
                  className="rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-line-strong aria-pressed:border-accent/60"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{d.name}</p>
                    {d.isCustom && <Badge>Custom</Badge>}
                  </div>
                  {t.attempts > 0 ? (
                    <p className="mt-2 font-display text-3xl font-bold tabular">
                      {formatPct(t.pct)} <span className="text-sm font-normal text-subtle">{t.makes}/{t.attempts}</span>
                    </p>
                  ) : reps > 0 ? (
                    <p className="mt-2 font-display text-3xl font-bold tabular">
                      {reps} <span className="text-sm font-normal text-subtle">reps</span>
                    </p>
                  ) : (
                    <p className="mt-2 font-display text-3xl font-bold tabular">
                      {minutes} <span className="text-sm font-normal text-subtle">min</span>
                    </p>
                  )}
                  {(t.left.attempts > 0 || t.right.attempts > 0) && (
                    <p className="mt-1 text-xs text-muted">
                      Left {formatPct(t.left.pct)} ({t.left.makes}/{t.left.attempts}) · Right {formatPct(t.right.pct)} ({t.right.makes}/{t.right.attempts})
                    </p>
                  )}
                  {(lr > 0 || rr > 0) && (
                    <p className="mt-1 text-xs text-muted">
                      Left {lr} · Right {rr} reps
                    </p>
                  )}
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-subtle">
                    <Trophy size={12} className="text-accent" />
                    {best ? `Best day ${best.pct}% (${best.label}) · ${formatDate(best.date)}` : bestReps ? `Best day ${bestReps.reps} reps · ${formatDate(bestReps.date)}` : "Personal best appears after 5+ attempts in a day"}
                  </p>
                  <p className="mt-1 text-[11px] text-subtle">{byDay.size} day{byDay.size === 1 ? "" : "s"} logged</p>
                </button>
              );
            })}
          </div>

          {activeDrill && series.length > 0 && (
            <Card className="mt-4">
              <CardTitle sub="Tap a drill card above to switch">{activeDrill.name} history</CardTitle>
              {hasShotMetrics(activeDrill.metrics) && series.some((s) => s.pct !== null) ? (
                <SimpleLineChart data={series} xKey="label" series={[{ key: "pct", name: "Percentage" }]} domain={[0, 100]} label={`${activeDrill.name} percentage by day`} valueSuffix="%" />
              ) : series.some((s) => s.reps > 0) ? (
                <SimpleBarChart data={series} xKey="label" series={[{ key: "reps", name: "Reps", color: "var(--chart-2)" }]} label={`${activeDrill.name} reps by day`} />
              ) : (
                <SimpleBarChart data={series} xKey="label" series={[{ key: "minutes", name: "Minutes", color: "var(--chart-3)" }]} label={`${activeDrill.name} minutes by day`} valueSuffix=" min" />
              )}
            </Card>
          )}
        </>
      )}

      <Card className="mt-4">
        <CardTitle>Skills sessions</CardTitle>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted">No standalone skills sessions yet. {points.length > 0 ? "Results above come from Day 4 workouts." : ""}</p>
        ) : (
          <ul className="divide-y divide-line">
            {sessions.map((s) => {
              const t = shotTotals(s.results.map((r) => r.values));
              return (
                <li key={s.id} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{formatDate(s.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</p>
                    <p className="text-xs text-subtle">
                      {s.results.map((r) => r.drillName).join(", ")}
                      {t.attempts ? ` · ${t.makes}/${t.attempts} (${formatPct(t.pct)})` : ""}
                    </p>
                    {s.gameNotes && <p className="mt-1 text-xs text-muted">Game: {s.gameNotes}</p>}
                  </div>
                  <IconButton label="Edit session" onClick={() => setEditing(structuredClone(s))}>
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton label="Delete session" onClick={() => setConfirm({ kind: "session", id: s.id })}>
                    <Trash2 size={16} />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="mt-4">
        <CardTitle sub="Built-in drills plus any you create">Drills</CardTitle>
        <ul className="grid gap-2 sm:grid-cols-2">
          {state.skillDrills.map((d) => (
            <li key={d.id} className="flex items-start gap-2 rounded-xl bg-surface-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {d.name} {d.isCustom && <Badge className="ml-1">Custom</Badge>}
                </p>
                <p className="text-xs text-subtle">{d.metrics.map((m) => METRIC_LABELS[m]).join(" · ")}</p>
              </div>
              {d.isCustom && (
                <IconButton label={`Delete ${d.name}`} onClick={() => setConfirm({ kind: "drill", id: d.id })}>
                  <Trash2 size={16} />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {editing && (
        <SkillSessionForm
          initial={editing}
          drills={state.skillDrills}
          onClose={() => setEditing(null)}
          onSave={(s) => {
            saveSkillSession(s);
            setEditing(null);
            toast("Skills session saved.");
          }}
        />
      )}
      {drillForm && (
        <DrillForm
          onClose={() => setDrillForm(false)}
          onSave={(d) => {
            saveDrill(d);
            setDrillForm(false);
            toast(`${d.name} added.`);
          }}
        />
      )}
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        danger
        title={confirm?.kind === "drill" ? "Delete custom drill?" : "Delete skills session?"}
        message={confirm?.kind === "drill" ? "Past sessions keep their recorded results." : "This session's results will be removed from your history and charts."}
        confirmLabel="Delete"
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.kind === "drill") deleteCustomDrill(confirm.id);
          else deleteSkillSession(confirm.id);
          toast("Deleted.");
        }}
      />
    </div>
  );
}

function SkillSessionForm({ initial, drills, onClose, onSave }: { initial: SkillSession; drills: SkillDrill[]; onClose: () => void; onSave: (s: SkillSession) => void }) {
  const [s, setS] = useState(initial);
  const [addId, setAddId] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  useUnsavedWarning(dirty);

  const update = (patch: Partial<SkillSession>) => {
    setDirty(true);
    setS((x) => ({ ...x, ...patch }));
  };

  const addDrill = (id: string) => {
    const d = drills.find((x) => x.id === id);
    if (!d) return;
    const values: SkillResult["values"] = {};
    if (d.defaultAttempts) values.attempts = d.defaultAttempts;
    update({ results: [...s.results, { id: uid("sr"), drillId: d.id, drillName: d.name, values, notes: "" }] });
    setAddId("");
  };

  const setValue = (rid: string, key: SkillMetricKey, raw: string) => {
    update({
      results: s.results.map((r) => {
        if (r.id !== rid) return r;
        const values = { ...r.values };
        if (raw === "") delete values[key];
        else values[key] = Number(raw);
        return { ...r, values };
      }),
    });
  };

  const save = () => {
    const errs: string[] = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) errs.push("Choose a valid date.");
    if (s.date > todayISO()) errs.push("Date can't be in the future.");
    if (!s.results.length) errs.push("Add at least one drill.");
    s.results.forEach((r) => {
      const e = validateResult(r);
      if (e) errs.push(e);
    });
    setErrors(errs);
    if (!errs.length) onSave(s);
  };

  return (
    <>
      <Modal
        open
        size="lg"
        onClose={() => (dirty ? setConfirmClose(true) : onClose())}
        title={initial.results.length ? "Edit skills session" : "Log skills session"}
        footer={
          <>
            <Button variant="secondary" onClick={() => (dirty ? setConfirmClose(true) : onClose())}>
              Cancel
            </Button>
            <Button onClick={save}>Save session</Button>
          </>
        }
      >
        <div className="space-y-5">
          {errors.length > 0 && (
            <Alert tone="bad" title="Please fix the following">
              <ul className="list-disc pl-4">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Alert>
          )}
          <Field label="Date" htmlFor="sk-date">
            <Input id="sk-date" type="date" max={todayISO()} value={s.date} onChange={(e) => update({ date: e.target.value })} />
          </Field>

          <ul className="space-y-3">
            {s.results.map((r) => {
              const d = drills.find((x) => x.id === r.drillId);
              const metrics = d?.metrics ?? (Object.keys(r.values) as SkillMetricKey[]);
              return (
                <li key={r.id} className="rounded-xl border border-line p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="font-semibold">{r.drillName}</p>
                    <IconButton label={`Remove ${r.drillName}`} onClick={() => update({ results: s.results.filter((x) => x.id !== r.id) })}>
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {metrics.map((m) => (
                      <Field key={m} label={METRIC_LABELS[m]} htmlFor={`${r.id}-${m}`}>
                        <Input
                          id={`${r.id}-${m}`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={r.values[m] ?? ""}
                          onChange={(e) => setValue(r.id, m, e.target.value)}
                          className="h-12 text-center text-lg font-semibold"
                        />
                      </Field>
                    ))}
                  </div>
                  {PAIRS.some(([, a]) => r.values[a]) && (
                    <p className="mt-2 text-sm text-accent tabular">
                      {PAIRS.filter(([, a]) => r.values[a])
                        .map(([m, a]) => `${METRIC_LABELS[m].replace(" makes", "").replace("Makes", "Overall").replace("Accurate", "Accuracy")}: ${formatPct(percentage(r.values[m] ?? 0, r.values[a] ?? 0))}`)
                        .join(" · ")}
                    </p>
                  )}
                  <Input
                    aria-label={`${r.drillName} notes`}
                    placeholder="Notes (optional)"
                    value={r.notes}
                    onChange={(e) => update({ results: s.results.map((x) => (x.id === r.id ? { ...x, notes: e.target.value } : x)) })}
                    className="mt-3"
                  />
                </li>
              );
            })}
          </ul>

          <div className="flex gap-2">
            <Select aria-label="Add a drill" value={addId} onChange={(e) => setAddId(e.target.value)}>
              <option value="">Add a drill…</option>
              {drills.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            <Button variant="secondary" onClick={() => addDrill(addId)} disabled={!addId}>
              <Plus size={16} /> Add
            </Button>
          </div>

          <Field label="Game performance notes (optional)" htmlFor="sk-game">
            <Textarea id="sk-game" value={s.gameNotes} onChange={(e) => update({ gameNotes: e.target.value })} placeholder="e.g. 6 rebounds, finished well with the left hand" />
          </Field>
          <Field label="Session notes (optional)" htmlFor="sk-notes">
            <Textarea id="sk-notes" value={s.notes} onChange={(e) => update({ notes: e.target.value })} />
          </Field>
        </div>
      </Modal>
      <ConfirmDialog open={confirmClose} onClose={() => setConfirmClose(false)} danger title="Discard this session?" message="Your entries haven't been saved." confirmLabel="Discard" onConfirm={onClose} />
    </>
  );
}

function DrillForm({ onClose, onSave }: { onClose: () => void; onSave: (d: SkillDrill) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [groups, setGroups] = useState<number[]>([0]);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (!name.trim()) return setError("Give the drill a name.");
    if (!groups.length) return setError("Choose at least one metric to track.");
    const metrics = [...new Set(groups.flatMap((g) => METRIC_GROUPS[g].keys))];
    onSave({ id: uid("drill"), name: name.trim(), description: description.trim(), metrics, isCustom: true, createdAt: nowISO() });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Create custom drill"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Create drill</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Drill name" htmlFor="dr-name" error={error}>
          <Input id="dr-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!error && !name.trim()} placeholder="e.g. Baby hooks from the short corner" />
        </Field>
        <Field label="Description (optional)" htmlFor="dr-desc">
          <Input id="dr-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <fieldset>
          <legend className="mb-1 text-sm font-medium">Metrics to track</legend>
          {METRIC_GROUPS.map((g, i) => (
            <Checkbox key={g.label} label={g.label} checked={groups.includes(i)} onChange={(on) => setGroups(on ? [...groups, i] : groups.filter((x) => x !== i))} />
          ))}
        </fieldset>
      </div>
    </Modal>
  );
}

"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, House, Pause, Pencil, Play, Plus, Trash2, UserRound, X } from "lucide-react";
import type { HomeDrillCategory, HomeSessionItem, Intensity, OccurrenceRef, SkillDrill, SkillMetricKey } from "@/lib/types";
import { useAppState } from "@/lib/store";
import { deleteSkillSession, discardHome, finishHome, pauseHome, resumeHome, saveDrill, startHomeSession, updateHome } from "@/lib/actions";
import { shotTotals } from "@/lib/metrics";
import { currentWeekOccurrences } from "@/lib/schedule";
import { useNow } from "@/lib/hooks";
import { cn, elapsedSec, formatDate, formatDuration, formatPct, nowISO, percentage, todayISO, uid } from "@/lib/utils";
import { INTENSITY_LABELS, INTENSITY_OPTIONS } from "@/components/labels";
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
  LoadingScreen,
  Modal,
  NumberStepper,
  PageHeader,
  ProgressBar,
  Segmented,
  Select,
  Textarea,
  useToast,
} from "@/components/ui";

const CATEGORIES: HomeDrillCategory[] = ["Shooting", "Center skills", "Footwork & defense"];

const TEMPLATES: { id: string; title: string; description: string; drills: string[]; intensity: Intensity }[] = [
  {
    id: "center",
    title: "Center skills (driveway)",
    description: "Mikan, drop steps, jump hooks, pivots, rebounding and free throws — can replace the Saturday session.",
    drills: ["drill-mikan", "drill-reverse-mikan", "drill-drop-steps", "drill-jump-hooks", "drill-pivot-finish", "drill-outlet", "drill-free-throws"],
    intensity: "moderate",
  },
  {
    id: "shooting",
    title: "Shooting session",
    description: "Form, midrange, movement shooting and free throws.",
    drills: ["drill-form-shooting", "drill-midrange", "drill-move-shoot", "drill-catch-shoot", "drill-free-throws"],
    intensity: "moderate",
  },
  {
    id: "footwork",
    title: "Footwork & defense",
    description: "Pivots, short slides, closeouts, balance and short accelerations.",
    drills: ["drill-pivots", "drill-def-footwork", "drill-closeouts", "drill-balance", "drill-accelerations"],
    intensity: "moderate",
  },
  {
    id: "light",
    title: "Light shooting (recovery day)",
    description: "Easy form shooting and free throws. Counts as skill practice, not a hard workout.",
    drills: ["drill-form-shooting", "drill-free-throws"],
    intensity: "light",
  },
];

const METRIC_LABEL: Record<SkillMetricKey, string> = {
  makes: "Makes",
  attempts: "Attempts",
  leftMakes: "Left makes",
  leftAttempts: "Left att.",
  rightMakes: "Right makes",
  rightAttempts: "Right att.",
  leftReps: "Left reps",
  rightReps: "Right reps",
  reps: "Successful reps",
  accurate: "Accurate",
  total: "Total reps",
  minutes: "Minutes",
};

const TRACKING_MODES: { id: string; label: string; metrics: SkillMetricKey[] }[] = [
  { id: "shots", label: "Makes / attempts", metrics: ["makes", "attempts"] },
  { id: "hands", label: "Makes / attempts by hand", metrics: ["leftMakes", "leftAttempts", "rightMakes", "rightAttempts"] },
  { id: "reps", label: "Successful reps", metrics: ["reps"] },
  { id: "sides", label: "Reps per side", metrics: ["leftReps", "rightReps"] },
  { id: "accuracy", label: "Accurate / total", metrics: ["accurate", "total"] },
  { id: "completion", label: "Completion only", metrics: [] },
];

function modeOf(metrics: SkillMetricKey[]) {
  return TRACKING_MODES.find((m) => m.metrics.length === metrics.length && m.metrics.every((k) => metrics.includes(k)))?.id ?? "shots";
}

export default function HomeCourtPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <HomeCourt />
    </Suspense>
  );
}

function HomeCourt() {
  const state = useAppState();
  return state.activeHomeSession ? <ActiveHome /> : <Setup />;
}

/* ----------------------------------- Setup ----------------------------------- */

function Setup() {
  const state = useAppState();
  const toast = useToast();
  const params = useSearchParams();
  const router = useRouter();
  const homeDrills = state.skillDrills.filter((d) => d.homeCourt);
  const forParam = params.get("for");
  const countsFor: OccurrenceRef | null = forParam && forParam.includes("@") ? { plannedWorkoutId: forParam.split("@")[0], originalDate: forParam.split("@")[1] } : null;
  const forOcc = countsFor ? currentWeekOccurrences(state, countsFor.originalDate).find((o) => o.key === forParam) : undefined;
  const initialTemplate = params.get("template") === "light" ? "light" : forOcc ? "center" : null;
  const [partner, setPartner] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(initialTemplate);
  const [selected, setSelected] = useState<string[]>(() => TEMPLATES.find((t) => t.id === initialTemplate)?.drills ?? []);
  const [drillForm, setDrillForm] = useState<SkillDrill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const sessions = state.skillSessions.filter((s) => s.kind === "home-court").sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  const usable = (id: string) => {
    const d = homeDrills.find((x) => x.id === id);
    return !!d && (partner || d.partner !== "required");
  };

  const pickTemplate = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id)!;
    setTemplateId(id);
    setSelected(t.drills);
    setError(null);
  };

  const start = () => {
    const ids = selected.filter(usable);
    if (!ids.length) return setError("Pick at least one drill (drills needing a partner are hidden unless “Partner available” is on).");
    const title = TEMPLATES.find((t) => t.id === templateId)?.title ?? "Home Court session";
    startHomeSession({
      id: uid("hs"),
      date: todayISO(),
      title,
      startedAt: nowISO(),
      pausedAt: null,
      pausedSec: 0,
      partner,
      countsFor: forOcc && !forOcc.session && !forOcc.fulfilledBy ? countsFor : null,
      notes: "",
      items: ids.map((id) => {
        const d = homeDrills.find((x) => x.id === id)!;
        return { id: uid("hi"), drillId: d.id, drillName: d.name, completed: false, values: {} as HomeSessionItem["values"], notes: "" };
      }),
    });
    if (forParam || params.get("template")) router.replace("/home-court");
    toast("Home Court session started — progress saves automatically.");
  };

  return (
    <div>
      <PageHeader
        title="Home Court"
        subtitle="Driveway workouts with just a ball and a hoop. Pick a template or build your own."
        actions={
          <Button variant="secondary" onClick={() => setDrillForm(newDrill())}>
            <Plus size={16} /> Custom drill
          </Button>
        }
      />

      {forOcc && (
        <div className="mb-4">
          <Alert tone="info" title={`This session will count for ${forOcc.workout.label} — ${forOcc.workout.name}`}>
            Planned {formatDate(forOcc.date, { weekday: "long", month: "short", day: "numeric" })}. You can change this when you finish.
          </Alert>
        </div>
      )}

      <Card>
        <CardTitle sub="Templates are starting points — add or remove any drill below">Choose a session</CardTitle>
        <div className="grid gap-2 sm:grid-cols-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => pickTemplate(t.id)}
              aria-pressed={templateId === t.id}
              className={cn("rounded-2xl border p-4 text-left transition-colors", templateId === t.id ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong")}
            >
              <p className="font-semibold">{t.title}</p>
              <p className="mt-1 text-xs text-muted">{t.description}</p>
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-line p-1">
          <Checkbox
            checked={partner}
            onChange={setPartner}
            label="Partner available today"
            description="Drills that need a partner (like catch-and-shoot) are hidden unless this is on. Everything else works solo."
          />
        </div>

        <div className="mt-5 space-y-5">
          {CATEGORIES.map((c) => (
            <fieldset key={c}>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">{c}</legend>
              <div className="grid gap-1 sm:grid-cols-2">
                {homeDrills
                  .filter((d) => d.category === c)
                  .map((d) => {
                    const disabled = d.partner === "required" && !partner;
                    return (
                      <div key={d.id} className="flex items-center gap-1">
                        <div className={cn("min-w-0 flex-1", disabled && "opacity-50")}>
                          <Checkbox
                            checked={selected.includes(d.id) && !disabled}
                            onChange={(on) => {
                              if (disabled) return;
                              setTemplateId(null);
                              setSelected(on ? [...selected, d.id] : selected.filter((x) => x !== d.id));
                            }}
                            label={
                              <span className="flex flex-wrap items-center gap-1.5">
                                {d.name}
                                {d.partner === "required" && <Badge>Partner needed</Badge>}
                                {d.partner === "optional" && <Badge>Partner optional</Badge>}
                                {d.isCustom && <Badge>Custom</Badge>}
                              </span>
                            }
                            description={d.target}
                          />
                        </div>
                        <IconButton label={`Edit ${d.name}`} onClick={() => setDrillForm({ ...d })}>
                          <Pencil size={15} />
                        </IconButton>
                      </div>
                    );
                  })}
              </div>
            </fieldset>
          ))}
        </div>

        {error && (
          <p className="mt-4 text-sm text-bad" role="alert">
            {error}
          </p>
        )}
        <Button size="xl" className="mt-5 w-full sm:w-auto" onClick={start}>
          <Play size={20} /> Start session ({selected.filter(usable).length} drills)
        </Button>
      </Card>

      <Card className="mt-4">
        <CardTitle icon={<House size={16} />}>Home Court history</CardTitle>
        {sessions.length === 0 ? (
          <EmptyState icon={<House size={22} />} title="No driveway sessions yet">
            Finished sessions appear here. Shooting drills feed your shooting percentages; light sessions count as skill practice without counting as a hard workout.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {sessions.map((s) => {
              const t = shotTotals(s.results.map((r) => r.values));
              const done = s.results.filter((r) => r.completed).length;
              return (
                <li key={s.id} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {formatDate(s.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                      {s.intensity && <Badge tone={s.intensity === "light" ? "neutral" : s.intensity === "hard" ? "warn" : "accent"}>{INTENSITY_LABELS[s.intensity]}</Badge>}
                      {s.countsFor && <Badge tone="good">Counted for plan</Badge>}
                    </p>
                    <p className="text-xs text-subtle">
                      {done}/{s.results.length} drills completed{s.durationMin ? ` · ${s.durationMin} min` : ""}
                      {t.attempts ? ` · ${t.makes}/${t.attempts} shots (${formatPct(t.pct)})` : ""}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted">{s.results.map((r) => r.drillName).join(", ")}</p>
                  </div>
                  <IconButton label="Delete session" onClick={() => setConfirmDelete(s.id)}>
                    <Trash2 size={16} />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {drillForm && (
        <HomeDrillForm
          initial={drillForm}
          isNew={!state.skillDrills.some((d) => d.id === drillForm.id)}
          onClose={() => setDrillForm(null)}
          onSave={(d) => {
            saveDrill(d);
            setDrillForm(null);
            toast(`${d.name} saved.`);
          }}
        />
      )}
      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        danger
        title="Delete this session?"
        message="Its drills and shooting numbers will be removed from your history and stats."
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmDelete) deleteSkillSession(confirmDelete);
          toast("Session deleted.");
        }}
      />
    </div>
  );
}

function newDrill(): SkillDrill {
  return {
    id: uid("drill"),
    name: "",
    description: "",
    metrics: ["makes", "attempts"],
    isCustom: true,
    createdAt: nowISO(),
    homeCourt: true,
    category: "Shooting",
    instructions: [],
    target: "3 × 10 attempts",
    partner: "none",
  };
}

/* ---------------------------------- Active ---------------------------------- */

function ActiveHome() {
  const state = useAppState();
  const toast = useToast();
  const draft = state.activeHomeSession!;
  const now = useNow(1000);
  const [addId, setAddId] = useState("");
  const [finishOpen, setFinishOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [openInfo, setOpenInfo] = useState<string | null>(null);
  const elapsed = elapsedSec(draft.startedAt, draft.pausedAt, draft.pausedSec, now);
  const paused = draft.pausedAt !== null;
  const done = draft.items.filter((i) => i.completed).length;
  const drills = new Map(state.skillDrills.map((d) => [d.id, d]));

  const patchItem = (id: string, patch: Partial<HomeSessionItem>) => updateHome((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));

  return (
    <div className="pb-10">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Home Court · {formatDate(draft.date, { weekday: "short", month: "short", day: "numeric" })}</p>
          <h1 className="mt-1 font-display text-2xl font-bold uppercase leading-tight sm:text-3xl">{draft.title}</h1>
        </div>
        <div className="shrink-0 text-right">
          <p className={cn("font-display text-2xl font-bold tabular", paused && "text-warn")} aria-label={`Session duration ${formatDuration(elapsed)}`}>
            {formatDuration(elapsed)}
          </p>
          <button
            type="button"
            onClick={() => (paused ? resumeHome() : pauseHome())}
            className={cn("mt-1 inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold", paused ? "bg-accent text-accent-ink" : "bg-surface-3 text-text")}
          >
            {paused ? <Play size={13} /> : <Pause size={13} />} {paused ? "Resume" : "Pause"}
          </button>
          <p className="mt-1 text-[11px] text-good">● Saved automatically</p>
        </div>
      </div>
      <div className="mb-4 flex items-center gap-3">
        <ProgressBar value={done} max={draft.items.length || 1} label="Drills completed" />
        <span className="shrink-0 text-xs text-muted tabular">
          {done}/{draft.items.length} drills
        </span>
      </div>
      {paused && (
        <p className="mb-4 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn" role="status">
          Paused. Everything is saved — close the app if you need to and resume later.
        </p>
      )}

      <ol className="space-y-3">
        {draft.items.map((item) => {
          const d = drills.get(item.drillId);
          const metrics = d?.metrics ?? [];
          const v = item.values;
          const t = shotTotals([v]);
          return (
            <li key={item.id}>
              <Card className={cn("p-3 sm:p-4", item.completed && "border-good/40 bg-good-soft")}>
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => patchItem(item.id, { completed: !item.completed })}
                    aria-pressed={item.completed}
                    aria-label={item.completed ? `Mark ${item.drillName} not done` : `Mark ${item.drillName} done`}
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2",
                      item.completed ? "border-good bg-good text-black" : "border-line-strong text-muted hover:border-accent hover:text-accent",
                    )}
                  >
                    <Check size={22} strokeWidth={3} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{item.drillName}</p>
                    <p className="text-xs text-subtle">
                      {d?.target ?? ""}
                      {d?.partner === "optional" && !draft.partner ? " · solo version" : ""}
                    </p>
                  </div>
                  <IconButton label={`Instructions for ${item.drillName}`} onClick={() => setOpenInfo(openInfo === item.id ? null : item.id)} aria-expanded={openInfo === item.id}>
                    <ChevronDown size={18} className={cn("transition-transform", openInfo === item.id && "rotate-180")} />
                  </IconButton>
                  <IconButton label={`Remove ${item.drillName}`} onClick={() => updateHome((x) => ({ ...x, items: x.items.filter((i) => i.id !== item.id) }))}>
                    <X size={18} />
                  </IconButton>
                </div>
                {openInfo === item.id && d && (
                  <div className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">
                    <ol className="list-decimal space-y-1 pl-5 text-muted">
                      {(d.instructions ?? [d.description]).map((i) => (
                        <li key={i}>{i}</li>
                      ))}
                    </ol>
                    {d.safety && <p className="mt-2 text-xs text-warn">Safety: {d.safety}</p>}
                  </div>
                )}
                {metrics.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-xs text-subtle">Performance log (optional)</p>
                    <div className="grid grid-cols-2 gap-2">
                      {metrics.map((m) => (
                        <div key={m}>
                          <p className="mb-1 text-[11px] text-muted">{METRIC_LABEL[m]}</p>
                          <NumberStepper
                            label={`${METRIC_LABEL[m]} for ${item.drillName}`}
                            value={v[m] ?? null}
                            onChange={(n) => {
                              const values = { ...v };
                              if (n === null) delete values[m];
                              else values[m] = n;
                              patchItem(item.id, { values });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    {t.attempts > 0 && (
                      <p className="mt-2 text-sm font-semibold text-accent tabular">
                        {t.makes}/{t.attempts} · {formatPct(t.pct)}
                        {t.left.attempts > 0 && t.right.attempts > 0 ? ` (L ${formatPct(t.left.pct)} · R ${formatPct(t.right.pct)})` : ""}
                      </p>
                    )}
                    {t.makes > t.attempts && <p className="mt-1 text-xs text-bad">Makes can&apos;t be higher than attempts.</p>}
                  </div>
                )}
                <Input aria-label={`Notes for ${item.drillName}`} placeholder="Notes (optional)" value={item.notes} onChange={(e) => patchItem(item.id, { notes: e.target.value })} className="mt-3" />
              </Card>
            </li>
          );
        })}
      </ol>
      {draft.items.length === 0 && <p className="py-6 text-center text-sm text-muted">No drills — add one below.</p>}

      <div className="mt-4 flex gap-2">
        <Select aria-label="Add a drill" value={addId} onChange={(e) => setAddId(e.target.value)}>
          <option value="">Add a drill…</option>
          {state.skillDrills
            .filter((d) => d.homeCourt && (draft.partner || d.partner !== "required"))
            .map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
        </Select>
        <Button
          variant="secondary"
          disabled={!addId}
          onClick={() => {
            const d = drills.get(addId);
            if (!d) return;
            updateHome((x) => ({ ...x, items: [...x.items, { id: uid("hi"), drillId: d.id, drillName: d.name, completed: false, values: {}, notes: "" }] }));
            setAddId("");
          }}
        >
          <Plus size={16} /> Add
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="ghost" size="xl" className="text-bad hover:text-bad" onClick={() => setConfirmDiscard(true)}>
          <Trash2 size={18} /> Discard
        </Button>
        <Button size="xl" onClick={() => setFinishOpen(true)}>
          <Check size={20} /> Finish
        </Button>
      </div>

      {finishOpen && <FinishHome elapsed={elapsed} onClose={() => setFinishOpen(false)} />}
      <ConfirmDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        danger
        title="Discard this session?"
        message={done ? `${done} completed drill${done === 1 ? "" : "s"} will be lost.` : "Nothing will be saved."}
        confirmLabel="Discard"
        onConfirm={() => {
          discardHome();
          toast("Session discarded.", "info");
        }}
      />
    </div>
  );
}

function FinishHome({ elapsed, onClose }: { elapsed: number; onClose: () => void }) {
  const state = useAppState();
  const toast = useToast();
  const draft = state.activeHomeSession!;
  const [date, setDate] = useState(draft.date);
  const [minutes, setMinutes] = useState<number | null>(Math.max(1, Math.round(elapsed / 60)));
  const [intensity, setIntensity] = useState<Intensity | null>(draft.title.startsWith("Light") ? "light" : null);
  const [notes, setNotes] = useState(draft.notes);
  const [errors, setErrors] = useState<string[]>([]);
  const slots = currentWeekOccurrences(state, date).filter((o) => o.workout.kind === "basketball" && !o.session && (!o.fulfilledBy || o.fulfilledBy.id === draft.id));
  const [link, setLink] = useState(draft.countsFor ? `${draft.countsFor.plannedWorkoutId}@${draft.countsFor.originalDate}` : "");
  const done = draft.items.filter((i) => i.completed).length;
  const logged = draft.items.filter((i) => Object.keys(i.values).length > 0).length;

  const save = () => {
    const errs: string[] = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > todayISO()) errs.push("Choose a valid date (not in the future).");
    if (!minutes || minutes <= 0 || minutes > 360) errs.push("Enter a duration between 1 and 360 minutes.");
    if (!intensity) errs.push("Choose light, moderate or hard.");
    if (!done && !logged) errs.push("Tick at least one drill as done or log a result before saving.");
    for (const i of draft.items) {
      const t = shotTotals([i.values]);
      if (t.makes > t.attempts) errs.push(`${i.drillName}: makes can't be higher than attempts.`);
      if (percentage(i.values.makes ?? 0, i.values.attempts ?? 0) === null && i.values.makes && !i.values.attempts) errs.push(`${i.drillName}: add attempts.`);
      for (const [m, a] of [["makes", "attempts"], ["leftMakes", "leftAttempts"], ["rightMakes", "rightAttempts"], ["accurate", "total"]] as const) {
        if (i.values[a] !== undefined && i.values[m] === undefined) errs.push(`${i.drillName}: enter ${m === "accurate" ? "accurate reps" : "makes"} too (0 is fine).`);
      }
    }
    setErrors(errs);
    if (errs.length) return;
    const sel = slots.find((o) => o.key === link);
    finishHome({ date, durationMin: minutes!, intensity: intensity!, notes: notes.trim(), countsFor: sel ? { plannedWorkoutId: sel.plannedId, originalDate: sel.originalDate } : null });
    toast(intensity === "light" ? "Light session saved as skill practice." : "Home Court session saved.");
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Finish Home Court session"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep going
          </Button>
          <Button onClick={save}>Save session</Button>
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
        <p className="text-sm text-muted">
          {done}/{draft.items.length} drills completed · {logged} with results logged
        </p>
        <Field label="Date" htmlFor="hf-date">
          <Input id="hf-date" type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Duration (minutes)" htmlFor="hf-min">
          <NumberStepper id="hf-min" label="Duration in minutes" value={minutes} onChange={setMinutes} step={5} min={0} max={360} suffix="min" />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium">How hard was it?</p>
          <Segmented label="Session intensity" value={intensity} onChange={setIntensity} options={INTENSITY_OPTIONS} />
          <p className="mt-1.5 text-xs text-subtle">Light sessions count as skill practice but not as a basketball-focused session or a hard day.</p>
        </div>
        {slots.length > 0 && (
          <Field label="Count this for a planned basketball session? (optional)" htmlFor="hf-link">
            <Select id="hf-link" value={link} onChange={(e) => setLink(e.target.value)}>
              <option value="">No</option>
              {slots.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.workout.label} — {o.workout.name} ({formatDate(o.date, { weekday: "short", month: "short", day: "numeric" })})
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Notes (optional)" htmlFor="hf-notes">
          <Textarea id="hf-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

/* -------------------------------- Drill form -------------------------------- */

function HomeDrillForm({ initial, isNew, onClose, onSave }: { initial: SkillDrill; isNew: boolean; onClose: () => void; onSave: (d: SkillDrill) => void }) {
  const [d, setD] = useState(initial);
  const [instructions, setInstructions] = useState((initial.instructions ?? []).join("\n"));
  const [error, setError] = useState<string | null>(null);
  const up = (patch: Partial<SkillDrill>) => setD((x) => ({ ...x, ...patch }));

  const save = () => {
    if (!d.name.trim()) return setError("Give the drill a name.");
    onSave({
      ...d,
      name: d.name.trim(),
      target: d.target?.trim(),
      instructions: instructions
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean),
    });
  };

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={isNew ? "New Home Court drill" : `Edit ${initial.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save drill</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="hd-name" error={error} className="sm:col-span-2">
          <Input id="hd-name" value={d.name} onChange={(e) => up({ name: e.target.value })} aria-invalid={!!error} />
        </Field>
        <Field label="Category" htmlFor="hd-cat">
          <Select id="hd-cat" value={d.category ?? "Shooting"} onChange={(e) => up({ category: e.target.value as HomeDrillCategory })}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Sets / attempts" htmlFor="hd-target">
          <Input id="hd-target" value={d.target ?? ""} onChange={(e) => up({ target: e.target.value })} placeholder="e.g. 3 × 10 attempts" />
        </Field>
        <Field label="Track" htmlFor="hd-track" hint={isNew ? undefined : "Changing this affects future logs only."}>
          <Select id="hd-track" value={modeOf(d.metrics)} onChange={(e) => up({ metrics: TRACKING_MODES.find((m) => m.id === e.target.value)!.metrics })}>
            {TRACKING_MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Partner" htmlFor="hd-partner">
          <Select id="hd-partner" value={d.partner ?? "none"} onChange={(e) => up({ partner: e.target.value as SkillDrill["partner"] })}>
            <option value="none">Solo</option>
            <option value="optional">Partner optional</option>
            <option value="required">Partner required</option>
          </Select>
        </Field>
        <Field label="Instructions (one step per line)" htmlFor="hd-ins" className="sm:col-span-2">
          <Textarea id="hd-ins" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        </Field>
        <Field label="Safety note (optional)" htmlFor="hd-safety" className="sm:col-span-2">
          <Input id="hd-safety" value={d.safety ?? ""} onChange={(e) => up({ safety: e.target.value })} placeholder="e.g. Only on a dry surface" />
        </Field>
        {!isNew && !initial.isCustom && (
          <p className="flex items-center gap-1.5 text-xs text-subtle sm:col-span-2">
            <UserRound size={12} /> Built-in drill — your edits are kept. Restoring the default plan doesn&apos;t change drills.
          </p>
        )}
      </div>
    </Modal>
  );
}

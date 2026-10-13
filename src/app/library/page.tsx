"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, History, Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import type { Exercise, ExerciseCategory, TrackingType } from "@/lib/types";
import { useAppState } from "@/lib/store";
import { deleteCustomExercise, saveExercise, toggleFavorite } from "@/lib/actions";
import { loggedExercises } from "@/lib/metrics";
import { ALL_CATEGORIES } from "@/lib/seed";
import { cn, nowISO, uid } from "@/lib/utils";
import { Alert, Badge, Button, ConfirmDialog, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea, useToast, useUnsavedWarning } from "@/components/ui";

const TRACKING_LABELS: Record<TrackingType, string> = {
  weighted: "Weight × reps",
  bodyweight: "Reps (no weight)",
  "reps-side": "Reps per side",
  timed: "Time (seconds)",
  distance: "Reps × distance",
  shooting: "Makes / attempts",
};

export default function LibraryPage() {
  const state = useAppState();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<ExerciseCategory | "">("");
  const [favOnly, setFavOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<Exercise | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const logged = new Set(loggedExercises(state).map((e) => e.id));
  const inPlan = new Set(state.plan.workouts.flatMap((w) => w.exercises.map((e) => e.exerciseId)));

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return state.exercises
      .filter((e) => (!cat || e.category === cat) && (!favOnly || e.isFavorite))
      .filter(
        (e) =>
          !needle ||
          e.name.toLowerCase().includes(needle) ||
          e.primaryAreas.some((a) => a.toLowerCase().includes(needle)) ||
          e.equipment.some((a) => a.toLowerCase().includes(needle)) ||
          e.category.toLowerCase().includes(needle),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state.exercises, q, cat, favOnly]);

  const grouped = ALL_CATEGORIES.map((c) => ({ category: c, items: list.filter((e) => e.category === c) })).filter((g) => g.items.length);
  const open = openId ? state.exercises.find((e) => e.id === openId) ?? null : null;

  const blank = (): Exercise => ({
    id: uid("ex"),
    name: "",
    category: "Lower-body strength",
    primaryAreas: [],
    equipment: [],
    instructions: [],
    setsReps: "3 × 8–12",
    rest: "60–90 s",
    difficulty: "Beginner",
    substitutions: [],
    notes: "",
    safety: "",
    trackingType: "weighted",
    incrementLb: 5,
    isCustom: true,
    isFavorite: false,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  });

  return (
    <div>
      <PageHeader
        title="Exercise Library"
        subtitle={`${state.exercises.length} exercises covering strength, movement, post skills, shooting, conditioning and warm-ups.`}
        actions={
          <Button onClick={() => setForm(blank())}>
            <Plus size={16} /> Custom exercise
          </Button>
        }
      />

      <div className="mb-6 grid gap-2 sm:grid-cols-[1fr_220px_auto]">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <Input aria-label="Search exercises" placeholder="Search by name, muscle, skill or equipment" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value as ExerciseCategory | "")}>
          <option value="">All categories</option>
          {ALL_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Button variant={favOnly ? "primary" : "outline"} onClick={() => setFavOnly((f) => !f)} aria-pressed={favOnly}>
          <Star size={16} className={favOnly ? "fill-current" : ""} /> Favorites
        </Button>
      </div>

      {grouped.length === 0 ? (
        <EmptyState icon={<BookOpen size={22} />} title={favOnly && !q ? "No favorites yet" : "No exercises found"}>
          {favOnly && !q ? "Tap the star on any exercise to save it here." : "Try a different search or category, or add a custom exercise."}
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {grouped.map((g) => (
            <section key={g.category}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
                {g.category} <span className="text-subtle">({g.items.length})</span>
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((e) => (
                  <li key={e.id} className="flex items-stretch rounded-2xl border border-line bg-surface">
                    <button onClick={() => setOpenId(e.id)} className="min-w-0 flex-1 rounded-l-2xl p-4 text-left hover:bg-surface-2">
                      <p className="truncate font-semibold">{e.name}</p>
                      <p className="mt-0.5 truncate text-xs text-subtle">{e.primaryAreas.join(", ")}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge>{e.setsReps}</Badge>
                        {inPlan.has(e.id) && <Badge tone="accent">In plan</Badge>}
                        {e.isCustom && <Badge>Custom</Badge>}
                      </div>
                    </button>
                    <button
                      onClick={() => toggleFavorite(e.id)}
                      aria-pressed={e.isFavorite}
                      aria-label={e.isFavorite ? `Remove ${e.name} from favorites` : `Add ${e.name} to favorites`}
                      className="flex w-12 shrink-0 items-start justify-center rounded-r-2xl pt-4 text-subtle hover:text-accent"
                    >
                      <Star size={18} className={cn(e.isFavorite && "fill-accent text-accent")} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Modal
        open={!!open}
        onClose={() => setOpenId(null)}
        title={open?.name ?? ""}
        size="lg"
        footer={
          open && (
            <>
              {open.isCustom && (
                <>
                  <Button variant="danger" onClick={() => setConfirmDelete(open.id)}>
                    <Trash2 size={16} /> Delete
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setForm({ ...open });
                      setOpenId(null);
                    }}
                  >
                    <Pencil size={16} /> Edit
                  </Button>
                </>
              )}
              <Button variant={open.isFavorite ? "secondary" : "outline"} onClick={() => toggleFavorite(open.id)}>
                <Star size={16} className={cn(open.isFavorite && "fill-accent text-accent")} /> {open.isFavorite ? "Favorited" : "Favorite"}
              </Button>
            </>
          )
        }
      >
        {open && (
          <ExerciseDetail
            exercise={open}
            hasHistory={logged.has(open.id)}
            nameOf={(id) => state.exercises.find((e) => e.id === id)?.name}
            onOpen={(id) => setOpenId(id)}
          />
        )}
      </Modal>

      {form && (
        <ExerciseForm
          initial={form}
          all={state.exercises}
          onClose={() => setForm(null)}
          onSave={(e) => {
            saveExercise(e);
            setForm(null);
            toast(`${e.name} saved to your library.`);
          }}
        />
      )}
      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        danger
        title="Delete custom exercise?"
        message="Logged sessions keep their history. If this exercise is in your plan, remove it there too."
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmDelete) deleteCustomExercise(confirmDelete);
          setOpenId(null);
          toast("Exercise deleted.");
        }}
      />
    </div>
  );
}

function ExerciseDetail({ exercise: e, hasHistory, nameOf, onOpen }: { exercise: Exercise; hasHistory: boolean; nameOf: (id: string) => string | undefined; onOpen: (id: string) => void }) {
  return (
    <div className="space-y-5 text-sm">
      <div className="flex flex-wrap gap-1.5">
        <Badge tone="accent">{e.category}</Badge>
        <Badge>{e.difficulty}</Badge>
        <Badge>{TRACKING_LABELS[e.trackingType]}</Badge>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Sets & reps", e.setsReps],
          ["Rest", e.rest],
          ["Primary", e.primaryAreas.join(", ") || "—"],
          ["Equipment", e.equipment.join(", ") || "—"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-surface-2 p-3">
            <dt className="text-[11px] uppercase tracking-wider text-subtle">{k}</dt>
            <dd className="mt-0.5 font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {e.instructions.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-subtle">How to do it</h3>
          <ol className="list-decimal space-y-1.5 pl-5 text-muted">
            {e.instructions.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ol>
        </div>
      )}
      {e.notes && (
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-subtle">Notes</h3>
          <p className="text-muted">{e.notes}</p>
        </div>
      )}
      {e.safety && <Alert tone="warn" title="Safety">{e.safety}</Alert>}
      <div>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-subtle">Suitable substitutions</h3>
        {e.substitutions.length ? (
          <ul className="flex flex-wrap gap-2">
            {e.substitutions.map((id) =>
              nameOf(id) ? (
                <li key={id}>
                  <button onClick={() => onOpen(id)} className="rounded-full border border-line-strong px-3 py-1.5 text-xs hover:border-accent hover:text-accent">
                    {nameOf(id)}
                  </button>
                </li>
              ) : null,
            )}
          </ul>
        ) : (
          <p className="text-subtle">None listed.</p>
        )}
      </div>
      {hasHistory && (
        <Link href={`/progress?exercise=${e.id}`} className="inline-flex items-center gap-1.5 text-accent hover:underline">
          <History size={15} /> View your logged history
        </Link>
      )}
    </div>
  );
}

function ExerciseForm({ initial, all, onClose, onSave }: { initial: Exercise; all: Exercise[]; onClose: () => void; onSave: (e: Exercise) => void }) {
  const [e, setE] = useState(initial);
  const [areas, setAreas] = useState(initial.primaryAreas.join(", "));
  const [equipment, setEquipment] = useState(initial.equipment.join(", "));
  const [instructions, setInstructions] = useState(initial.instructions.join("\n"));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  useUnsavedWarning(dirty);
  const up = (patch: Partial<Exercise>) => {
    setDirty(true);
    setE((x) => ({ ...x, ...patch }));
  };
  const split = (s: string, sep: RegExp) =>
    s
      .split(sep)
      .map((x) => x.trim())
      .filter(Boolean);

  const save = () => {
    const errs: Record<string, string> = {};
    if (!e.name.trim()) errs.name = "Name is required.";
    else if (all.some((x) => x.id !== e.id && x.name.toLowerCase() === e.name.trim().toLowerCase())) errs.name = "An exercise with this name already exists.";
    if (!e.setsReps.trim()) errs.setsReps = "Add a set and rep range.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSave({ ...e, name: e.name.trim(), primaryAreas: split(areas, /,/), equipment: split(equipment, /,/), instructions: split(instructions, /\n/) });
  };

  return (
    <>
      <Modal
        open
        size="lg"
        onClose={() => (dirty ? setConfirmClose(true) : onClose())}
        title={all.some((x) => x.id === initial.id) ? "Edit exercise" : "New custom exercise"}
        footer={
          <>
            <Button variant="secondary" onClick={() => (dirty ? setConfirmClose(true) : onClose())}>
              Cancel
            </Button>
            <Button onClick={save}>Save exercise</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="ef-name" error={errors.name} className="sm:col-span-2">
            <Input id="ef-name" value={e.name} onChange={(x) => up({ name: x.target.value })} aria-invalid={!!errors.name} />
          </Field>
          <Field label="Category" htmlFor="ef-cat">
            <Select id="ef-cat" value={e.category} onChange={(x) => up({ category: x.target.value as ExerciseCategory })}>
              {ALL_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="How it's logged" htmlFor="ef-track" hint="Weight is never required for bodyweight or skill work.">
            <Select id="ef-track" value={e.trackingType} onChange={(x) => up({ trackingType: x.target.value as TrackingType })}>
              {(Object.keys(TRACKING_LABELS) as TrackingType[]).map((t) => (
                <option key={t} value={t}>
                  {TRACKING_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Primary muscles or skill area" htmlFor="ef-areas" hint="Comma-separated">
            <Input id="ef-areas" value={areas} onChange={(x) => { setDirty(true); setAreas(x.target.value); }} />
          </Field>
          <Field label="Equipment" htmlFor="ef-eq" hint="Comma-separated">
            <Input id="ef-eq" value={equipment} onChange={(x) => { setDirty(true); setEquipment(x.target.value); }} />
          </Field>
          <Field label="Sets & reps" htmlFor="ef-sr" error={errors.setsReps}>
            <Input id="ef-sr" value={e.setsReps} onChange={(x) => up({ setsReps: x.target.value })} />
          </Field>
          <Field label="Recommended rest" htmlFor="ef-rest">
            <Input id="ef-rest" value={e.rest} onChange={(x) => up({ rest: x.target.value })} />
          </Field>
          <Field label="Difficulty" htmlFor="ef-diff">
            <Select id="ef-diff" value={e.difficulty} onChange={(x) => up({ difficulty: x.target.value as Exercise["difficulty"] })}>
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
            </Select>
          </Field>
          <Field label="Substitutions" htmlFor="ef-subs" hint="Hold Ctrl/⌘ to select several">
            <select
              id="ef-subs"
              multiple
              value={e.substitutions}
              onChange={(x) => up({ substitutions: Array.from(x.target.selectedOptions).map((o) => o.value) })}
              className="h-28 w-full rounded-xl border border-line-strong bg-surface-2 p-2 text-sm text-text"
            >
              {all
                .filter((x) => x.id !== e.id)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Instructions (one step per line)" htmlFor="ef-ins" className="sm:col-span-2">
            <Textarea id="ef-ins" value={instructions} onChange={(x) => { setDirty(true); setInstructions(x.target.value); }} />
          </Field>
          <Field label="Notes" htmlFor="ef-notes">
            <Textarea id="ef-notes" value={e.notes} onChange={(x) => up({ notes: x.target.value })} className="min-h-[64px]" />
          </Field>
          <Field label="Safety reminders" htmlFor="ef-safety">
            <Textarea id="ef-safety" value={e.safety} onChange={(x) => up({ safety: x.target.value })} className="min-h-[64px]" />
          </Field>
        </div>
      </Modal>
      <ConfirmDialog open={confirmClose} onClose={() => setConfirmClose(false)} danger title="Discard changes?" message="This exercise hasn't been saved." confirmLabel="Discard" onConfirm={onClose} />
    </>
  );
}


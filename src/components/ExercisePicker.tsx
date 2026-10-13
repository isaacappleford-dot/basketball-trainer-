"use client";

import { useMemo, useState } from "react";
import { Search, Star } from "lucide-react";
import { useAppState } from "@/lib/store";
import { ALL_CATEGORIES } from "@/lib/seed";
import { Input, Modal, Select } from "./ui";

export function ExercisePicker({
  open,
  onClose,
  onPick,
  title,
  suggestedIds = [],
  excludeIds = [],
}: {
  open: boolean;
  onClose: () => void;
  onPick: (exerciseId: string) => void;
  title: string;
  suggestedIds?: string[];
  excludeIds?: string[];
}) {
  const state = useAppState();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return state.exercises
      .filter((e) => !excludeIds.includes(e.id))
      .filter((e) => !cat || e.category === cat)
      .filter((e) => !needle || e.name.toLowerCase().includes(needle) || e.primaryAreas.some((a) => a.toLowerCase().includes(needle)))
      .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite) || a.name.localeCompare(b.name));
  }, [state.exercises, q, cat, excludeIds]);

  const suggested = state.exercises.filter((e) => suggestedIds.includes(e.id) && !excludeIds.includes(e.id));

  const pick = (id: string) => {
    onPick(id);
    onClose();
    setQ("");
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      {suggested.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">Suggested substitutions</p>
          <ul className="space-y-1.5">
            {suggested.map((e) => (
              <li key={e.id}>
                <button onClick={() => pick(e.id)} className="flex w-full items-center justify-between rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-left hover:border-accent">
                  <span>
                    <span className="block text-sm font-medium">{e.name}</span>
                    <span className="block text-xs text-muted">{e.category}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_180px]">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <Input aria-label="Search exercises" placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select aria-label="Filter by category" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>
          {ALL_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </div>
      {list.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">No exercises match. Add a custom exercise in the Exercise Library.</p>
      ) : (
        <ul className="space-y-1">
          {list.map((e) => (
            <li key={e.id}>
              <button onClick={() => pick(e.id)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-surface-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{e.name}</span>
                  <span className="block truncate text-xs text-subtle">
                    {e.category} · {e.setsReps}
                  </span>
                </span>
                {e.isFavorite && <Star size={14} className="shrink-0 fill-accent text-accent" aria-label="Favorite" />}
                {e.isCustom && <span className="shrink-0 text-[10px] uppercase text-subtle">Custom</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

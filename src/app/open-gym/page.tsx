"use client";

import { useState } from "react";
import { CalendarCheck, Pencil, Plus, Trash2, Users } from "lucide-react";
import type { OpenGymSession } from "@/lib/types";
import { useAppState } from "@/lib/store";
import { deleteOpenGym, saveOpenGym, setOpenGymDays } from "@/lib/actions";
import { weeklyBuckets, weekSummary } from "@/lib/metrics";
import { addDays, cn, formatDate, nowISO, startOfWeek, sum, todayISO, weekdayOf, WEEK_ORDER, WEEKDAYS, WEEKDAYS_SHORT } from "@/lib/utils";
import { INTENSITY_LABELS, OPEN_GYM_STATUS_LABELS } from "@/components/labels";
import { newOpenGym, OpenGymForm } from "@/components/OpenGymForm";
import { AdviceList } from "@/components/AdviceList";
import { SimpleBarChart } from "@/components/charts";
import { Badge, Button, Card, CardTitle, ConfirmDialog, EmptyState, IconButton, PageHeader, Stat, useToast } from "@/components/ui";

const STATUS_TONE = { planned: "accent", attended: "good", skipped: "neutral", replaced: "warn" } as const;

export default function OpenGymPage() {
  const state = useAppState();
  const toast = useToast();
  const today = todayISO();
  const [form, setForm] = useState<OpenGymSession | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const ws = startOfWeek(today);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(ws, i)).filter((d) => state.profile.openGymDays.includes(weekdayOf(d)));
  const all = [...state.openGymSessions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const attended = all.filter((o) => o.status === "attended");
  const week = weekSummary(state);
  const buckets = weeklyBuckets(state, 8);
  const last4 = attended.filter((o) => o.date >= addDays(today, -27));

  const quick = (date: string, status: OpenGymSession["status"]) => {
    const existing = all.find((o) => o.date === date);
    saveOpenGym({ ...(existing ?? newOpenGym(date, status)), status, updatedAt: nowISO() });
    toast(status === "planned" ? `Noted: planning to go ${formatDate(date, { weekday: "long" })}.` : "Marked as skipped. Open gym is always optional.");
  };

  return (
    <div>
      <PageHeader
        title="Open Gym"
        subtitle="Available on the days you choose. Go when you want — the app never schedules you for every day."
        actions={
          <Button onClick={() => setForm(newOpenGym(today))}>
            <Plus size={16} /> Log open gym
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle icon={<CalendarCheck size={16} />} sub="Plan, log, skip or replace — one tap each">
            This week
          </CardTitle>
          {weekDays.length === 0 ? (
            <p className="text-sm text-muted">No open-gym days selected. Turn some on below.</p>
          ) : (
            <ul className="space-y-2">
              {weekDays.map((d) => {
                const rec = all.find((o) => o.date === d);
                const past = d < today;
                return (
                  <li key={d} className={cn("rounded-2xl border p-3 sm:p-4", d === today ? "border-accent/50 bg-accent-soft" : "border-line")}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {formatDate(d, { weekday: "long", month: "short", day: "numeric" })}
                          {d === today && <span className="ml-2 text-xs font-medium text-accent">Today</span>}
                        </p>
                        <p className="text-xs text-subtle">
                          {rec
                            ? rec.status === "attended"
                              ? [rec.format?.replace("-", " "), rec.durationMin ? `${rec.durationMin} min` : null, rec.intensity ? INTENSITY_LABELS[rec.intensity] : null]
                                  .filter(Boolean)
                                  .join(" · ")
                              : rec.status === "replaced"
                                ? `Did instead: ${rec.replacedWith}`
                                : rec.status === "planned"
                                  ? "You plan to go"
                                  : "Not going"
                            : "Available · optional"}
                        </p>
                      </div>
                      {rec && <Badge tone={STATUS_TONE[rec.status]}>{OPEN_GYM_STATUS_LABELS[rec.status]}</Badge>}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {rec?.status !== "attended" && d <= today && (
                        <Button size="sm" onClick={() => setForm(rec ? { ...rec, status: "attended", durationMin: rec.durationMin ?? 90 } : newOpenGym(d))}>
                          Log attended
                        </Button>
                      )}
                      {!rec && !past && (
                        <Button size="sm" variant="outline" onClick={() => quick(d, "planned")}>
                          Plan to go
                        </Button>
                      )}
                      {rec?.status !== "skipped" && rec?.status !== "attended" && (
                        <Button size="sm" variant="outline" onClick={() => quick(d, "skipped")}>
                          Skip
                        </Button>
                      )}
                      {rec?.status !== "attended" && rec?.status !== "replaced" && (
                        <Button size="sm" variant="outline" onClick={() => setForm({ ...(rec ?? newOpenGym(d, "replaced")), status: "replaced" })}>
                          Replaced…
                        </Button>
                      )}
                      {rec && (
                        <Button size="sm" variant="ghost" onClick={() => setForm({ ...rec })}>
                          <Pencil size={14} /> Edit
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="This week" value={week.openGymAttended} sub="sessions attended" />
            <Stat label="Last 4 weeks" value={last4.length} sub={`${sum(last4.map((o) => o.durationMin ?? 0))} min`} />
          </div>
          <Card>
            <CardTitle icon={<Users size={16} />} sub="Tap to toggle. Availability isn't a commitment.">
              Open gym days
            </CardTitle>
            <div className="grid grid-cols-7 gap-1" role="group" aria-label="Open gym days">
              {WEEK_ORDER.map((d) => {
                const on = state.profile.openGymDays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    aria-label={`${WEEKDAYS[d]} ${on ? "available" : "not available"}`}
                    onClick={() => setOpenGymDays(on ? state.profile.openGymDays.filter((x) => x !== d) : [...state.profile.openGymDays, d])}
                    className={cn("h-11 rounded-xl text-xs font-semibold", on ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted hover:text-text")}
                  >
                    {WEEKDAYS_SHORT[d]}
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-4">
        <AdviceList />
      </div>

      {attended.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={<Users size={22} />} title="No open gym logged yet" action={<Button onClick={() => setForm(newOpenGym(today))}>Log a session</Button>}>
            Record duration, intensity, full-court or half-court, and the skills you worked on. It counts as basketball practice — never as a gym strength workout.
          </EmptyState>
        </div>
      ) : (
        <Card className="mt-4">
          <CardTitle sub="Sessions attended per week (last 8 weeks)">Attendance</CardTitle>
          <SimpleBarChart data={buckets} xKey="label" series={[{ key: "openGym", name: "Open gym" }]} label="Open gym sessions per week" />
        </Card>
      )}

      {all.length > 0 && (
        <Card className="mt-4">
          <CardTitle>History</CardTitle>
          <ul className="divide-y divide-line">
            {all.map((o) => (
              <li key={o.id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {formatDate(o.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                    <Badge tone={STATUS_TONE[o.status]}>{OPEN_GYM_STATUS_LABELS[o.status]}</Badge>
                    {o.countsFor && <Badge tone="accent">Linked to plan</Badge>}
                  </p>
                  <p className="text-xs text-subtle">
                    {o.status === "attended"
                      ? [
                          o.format?.replace("-", " "),
                          o.durationMin ? `${o.durationMin} min` : null,
                          o.intensity ? INTENSITY_LABELS[o.intensity] : null,
                          o.effort ? `effort ${o.effort}/10` : null,
                          o.skills.length ? o.skills.join(", ") : null,
                          o.hardRunning ? "hard running" : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : o.status === "replaced"
                        ? `Did instead: ${o.replacedWith}`
                        : ""}
                  </p>
                  {o.notes && <p className="mt-1 text-xs text-muted">{o.notes}</p>}
                </div>
                <IconButton label="Edit open gym" onClick={() => setForm({ ...o })}>
                  <Pencil size={16} />
                </IconButton>
                <IconButton label="Delete open gym" onClick={() => setConfirmId(o.id)}>
                  <Trash2 size={16} />
                </IconButton>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {form && <OpenGymForm initial={form} onClose={() => setForm(null)} />}
      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        danger
        title="Delete this entry?"
        message="It will be removed from your open-gym history and weekly counts."
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmId) deleteOpenGym(confirmId);
          toast("Deleted.");
        }}
      />
    </div>
  );
}

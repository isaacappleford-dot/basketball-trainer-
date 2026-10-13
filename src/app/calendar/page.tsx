"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BedDouble, CalendarPlus, ChevronLeft, ChevronRight, Dumbbell, HeartPulse, House, Pencil, Play, Target, Trash2, Trophy, Undo2, Users } from "lucide-react";
import type { AppState, CalendarEvent, CalendarEventType, DaySlot, ISODate, ModificationReason, OpenGymSession } from "@/lib/types";
import { useAppState } from "@/lib/store";
import { clearOverride, deleteCalendarEvent, overrideOccurrence, saveCalendarEvent } from "@/lib/actions";
import { completedSessions, weekSummary } from "@/lib/metrics";
import { saveOpenGym } from "@/lib/actions";
import { STATUS_TONE, OPEN_GYM_STATUS_LABELS } from "@/components/labels";
import { newOpenGym, OpenGymForm } from "@/components/OpenGymForm";
import { calendarWeekOf, occurrencesBetween, planWeekFor, type Occurrence } from "@/lib/schedule";
import { addDays, cn, daysBetween, formatDate, formatLongDate, nowISO, parseISODate, startOfWeek, toISODate, todayISO, uid, weekdayOf, WEEKDAYS_SHORT } from "@/lib/utils";
import { MOD_REASONS } from "@/components/workout/FinishDialog";
import { Badge, Button, Card, CardTitle, ConfirmDialog, Field, IconButton, Input, LinkButton, Modal, PageHeader, Segmented, Select, Textarea, useToast } from "@/components/ui";

const EVENT_LABELS: Record<Exclude<CalendarEventType, "workout">, string> = {
  game: "Basketball game",
  practice: "Practice session",
  rest: "Rest day",
  recovery: "Recovery day",
  other: "Other",
};

const OG_TONE = { planned: "accent", attended: "good", skipped: "neutral", replaced: "warn" } as const;

interface DayData {
  date: ISODate;
  occurrences: Occurrence[];
  events: CalendarEvent[];
  extras: { id: string; label: string; kind: "skills" | "home" | "conditioning" | "workout"; href: string }[];
  openGym: OpenGymSession[];
  openGymAvailable: boolean;
  slot: DaySlot | null;
  restLabel: string | null;
}

function buildDays(state: AppState, from: ISODate, to: ISODate): Map<ISODate, DayData> {
  const occ = occurrencesBetween(state, from, to);
  const linked = new Set(occ.filter((o) => o.session).map((o) => o.session!.id));
  const map = new Map<ISODate, DayData>();
  const span = daysBetween(from, to);
  for (let i = 0; i <= span; i++) {
    const d = addDays(from, i);
    const cw = calendarWeekOf(state.profile.planStartDate, d);
    const inPlan = cw >= 1 && planWeekFor(state, cw) <= state.plan.weeks;
    const slot = inPlan ? state.plan.daySlots.find((r) => r.weekday === weekdayOf(d)) ?? null : null;
    map.set(d, {
      date: d,
      occurrences: [],
      events: [],
      extras: [],
      openGym: [],
      openGymAvailable: state.profile.openGymDays.includes(weekdayOf(d)),
      slot,
      restLabel: slot?.label ?? null,
    });
  }
  occ.forEach((o) => map.get(o.date)?.occurrences.push(o));
  state.calendarEvents.filter((e) => e.type !== "workout").forEach((e) => map.get(e.date)?.events.push(e));
  completedSessions(state)
    .filter((s) => !linked.has(s.id))
    .forEach((s) => map.get(s.date)?.extras.push({ id: s.id, label: s.workoutName, kind: "workout", href: `/progress?session=${s.id}` }));
  state.skillSessions.forEach((s) =>
    map.get(s.date)?.extras.push(
      s.kind === "home-court"
        ? { id: s.id, label: `Home Court${s.intensity ? ` (${s.intensity})` : ""}`, kind: "home", href: "/home-court" }
        : { id: s.id, label: "Skills session", kind: "skills", href: "/skills" },
    ),
  );
  state.openGymSessions.forEach((o) => map.get(o.date)?.openGym.push(o));
  state.conditioningSessions
    .filter((c) => !c.workoutSessionId)
    .forEach((c) => map.get(c.date)?.extras.push({ id: c.id, label: "Conditioning", kind: "conditioning", href: "/conditioning" }));
  return map;
}

export default function CalendarPage() {
  const state = useAppState();
  const today = todayISO();
  const [view, setView] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState<ISODate | null>(null);

  let from: ISODate, to: ISODate;
  if (view === "week") {
    from = startOfWeek(anchor);
    to = addDays(from, 6);
  } else {
    const a = parseISODate(anchor);
    const first = toISODate(new Date(a.getFullYear(), a.getMonth(), 1));
    const last = toISODate(new Date(a.getFullYear(), a.getMonth() + 1, 0));
    from = startOfWeek(first);
    to = addDays(startOfWeek(last), 6);
  }
  const days = buildDays(state, from, to);
  const month = parseISODate(anchor).getMonth();

  const summaryFrom = view === "week" ? from : startOfWeek(today);
  const summary = occurrencesBetween(state, summaryFrom, addDays(summaryFrom, 6));
  const count = (s: Occurrence["status"]) => summary.filter((o) => o.status === s).length;
  const balance = weekSummary(state, summaryFrom);

  const shift = (dir: 1 | -1) => {
    if (view === "week") setAnchor(addDays(anchor, dir * 7));
    else {
      const a = parseISODate(anchor);
      setAnchor(toISODate(new Date(a.getFullYear(), a.getMonth() + dir, 1)));
    }
  };

  const title =
    view === "week" ? `${formatDate(from)} – ${formatDate(to, { month: "short", day: "numeric", year: "numeric" })}` : parseISODate(anchor).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle="Planned workouts, games, practices and rest days. A workout only counts as completed once you finish and save a session."
        actions={<Segmented label="Calendar view" value={view} onChange={setView} size="sm" options={[{ value: "week", label: "Week" }, { value: "month", label: "Month" }]} />}
      />

      <Card className="mb-4">
        <CardTitle sub={view === "week" ? "This view's week" : "Current week"}>Weekly completion</CardTitle>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <p className="font-display text-4xl font-bold tabular">
            {count("completed") + summary.filter((o) => o.status === "modified" && o.session).length}
            <span className="text-xl text-subtle">/{summary.length}</span>
          </p>
          <div className="flex flex-wrap gap-2 pb-1 text-xs">
            <Badge tone="accent">
              Strength {balance.strengthDone}/{state.profile.strengthPerWeek}
            </Badge>
            <Badge tone="accent">
              Basketball {balance.basketballDone}/{state.profile.basketballPerWeek}
            </Badge>
            <Badge>{balance.openGymAttended} open gym</Badge>
            <Badge tone="good">{count("completed")} completed</Badge>
            {count("replaced") > 0 && <Badge>{count("replaced")} replaced</Badge>}
            <Badge tone="warn">{count("modified")} modified</Badge>
            <Badge>{count("skipped")} skipped</Badge>
            <Badge tone="bad">{count("missed")} missed</Badge>
            <Badge tone="accent">{count("planned")} upcoming</Badge>
          </div>
        </div>
      </Card>

      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <IconButton label={view === "week" ? "Previous week" : "Previous month"} onClick={() => shift(-1)}>
            <ChevronLeft size={20} />
          </IconButton>
          <IconButton label={view === "week" ? "Next week" : "Next month"} onClick={() => shift(1)}>
            <ChevronRight size={20} />
          </IconButton>
          <h2 className="ml-1 text-base font-semibold sm:text-lg">{title}</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setAnchor(today)}>
          Today
        </Button>
      </div>

      {view === "week" ? (
        <ol className="grid gap-2 lg:grid-cols-7">
          {[...days.values()].map((d) => (
            <li key={d.date}>
              <button
                onClick={() => setSelected(d.date)}
                className={cn(
                  "flex h-full min-h-[88px] w-full flex-col gap-1.5 rounded-2xl border p-3 text-left transition-colors hover:border-line-strong lg:min-h-[180px]",
                  d.date === today ? "border-accent/60 bg-accent-soft" : "border-line bg-surface",
                )}
                aria-label={`${formatLongDate(d.date)}: ${d.occurrences.length + d.events.length + d.extras.length} items`}
              >
                <span className="flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wider text-subtle">
                  {WEEKDAYS_SHORT[weekdayOf(d.date)]} <span className={cn("text-base", d.date === today ? "text-accent" : "text-text")}>{parseISODate(d.date).getDate()}</span>
                </span>
                <DayItems d={d} />
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <div>
          <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[11px] font-semibold uppercase tracking-wider text-subtle">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <ol className="grid grid-cols-7 gap-1">
            {[...days.values()].map((d) => {
              const other = parseISODate(d.date).getMonth() !== month;
              return (
                <li key={d.date}>
                  <button
                    onClick={() => setSelected(d.date)}
                    aria-label={`${formatLongDate(d.date)}: ${d.occurrences.length + d.events.length + d.extras.length} items`}
                    className={cn(
                      "flex h-16 w-full flex-col items-start gap-1 overflow-hidden rounded-xl border p-1.5 text-left sm:h-24 sm:p-2",
                      d.date === today ? "border-accent/60 bg-accent-soft" : "border-line bg-surface hover:border-line-strong",
                      other && "opacity-40",
                    )}
                  >
                    <span className={cn("text-xs font-semibold", d.date === today && "text-accent")}>{parseISODate(d.date).getDate()}</span>
                    <span className="flex flex-wrap gap-1 sm:hidden">
                      {d.occurrences.map((o) => (
                        <span key={o.key} className={cn("h-2 w-2 rounded-full", o.status === "completed" ? "bg-good" : o.status === "modified" ? "bg-warn" : o.status === "missed" ? "bg-bad" : o.status === "skipped" ? "bg-subtle" : "bg-accent")} />
                      ))}
                      {d.events.map((e) => (
                        <span key={e.id} className="h-2 w-2 rounded-full bg-[var(--chart-2)]" />
                      ))}
                      {d.extras.map((x) => (
                        <span key={x.id} className="h-2 w-2 rounded-full bg-[var(--chart-3)]" />
                      ))}
                      {d.openGym
                        .filter((o) => o.status === "attended" || o.status === "planned")
                        .map((o) => (
                          <span key={o.id} className="h-2 w-2 rounded-full bg-[var(--chart-4)]" />
                        ))}
                    </span>
                    <span className="hidden w-full flex-col gap-0.5 sm:flex">
                      {d.occurrences.map((o) => (
                        <span key={o.key} className={cn("truncate rounded px-1 text-[10px]", o.status === "completed" ? "bg-good-soft text-good" : o.status === "missed" ? "bg-bad-soft text-bad" : o.status === "modified" ? "bg-warn-soft text-warn" : o.status === "skipped" ? "bg-surface-3 text-subtle line-through" : "bg-accent-soft text-accent")}>
                          {o.workout.label}
                        </span>
                      ))}
                      {d.events.map((e) => (
                        <span key={e.id} className="truncate rounded bg-surface-3 px-1 text-[10px] text-text">
                          {e.title}
                        </span>
                      ))}
                      {d.extras.map((x) => (
                        <span key={x.id} className="truncate rounded bg-surface-3 px-1 text-[10px] text-muted">
                          {x.label}
                        </span>
                      ))}
                      {d.openGym.map((o) => (
                        <span key={o.id} className="truncate rounded bg-surface-3 px-1 text-[10px] text-muted">
                          Open gym · {OPEN_GYM_STATUS_LABELS[o.status].toLowerCase()}
                        </span>
                      ))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-subtle sm:hidden">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent" /> Planned</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-good" /> Completed</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-bad" /> Missed</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--chart-2)]" /> Event</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--chart-3)]" /> Other training</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--chart-4)]" /> Open gym</span>
          </p>
        </div>
      )}

      {selected && days.get(selected) && <DayPanel day={days.get(selected)!} onClose={() => setSelected(null)} />}
      {selected && !days.get(selected) && <DayPanel day={buildDays(state, selected, selected).get(selected)!} onClose={() => setSelected(null)} />}
    </div>
  );
}

function DayItems({ d }: { d: DayData }) {
  return (
    <span className="flex flex-col gap-1">
      {d.occurrences.map((o) => (
        <span key={o.key} className="flex flex-col">
          <span className={cn("text-sm font-medium", o.status === "skipped" && "line-through text-subtle")}>
            {o.workout.name.startsWith(o.workout.label) ? o.workout.name : `${o.workout.label} · ${o.workout.name}`}
          </span>
          <span className="flex gap-1">
            <Badge tone={STATUS_TONE[o.status]}>{o.status}</Badge>
            {o.moved && <Badge>moved</Badge>}
          </span>
        </span>
      ))}
      {d.events.map((e) => (
        <span key={e.id} className="flex items-center gap-1.5 text-sm">
          {e.type === "game" ? <Trophy size={13} className="text-[var(--chart-2)]" /> : <CalendarPlus size={13} className="text-[var(--chart-2)]" />}
          {e.title}
        </span>
      ))}
      {d.openGym.map((o) => (
        <span key={o.id} className="flex items-center gap-1.5 text-xs">
          <Users size={12} className="text-[var(--chart-3)]" /> Open gym
          <Badge tone={OG_TONE[o.status]}>{OPEN_GYM_STATUS_LABELS[o.status].toLowerCase()}</Badge>
        </span>
      ))}
      {d.extras.map((x) => (
        <span key={x.id} className="flex items-center gap-1.5 text-xs text-muted">
          {x.kind === "skills" ? <Target size={12} /> : x.kind === "home" ? <House size={12} /> : x.kind === "conditioning" ? <HeartPulse size={12} /> : <Dumbbell size={12} />} {x.label}
        </span>
      ))}
      {!d.occurrences.length && !d.events.length && !d.extras.length && !d.openGym.length && <span className="text-xs text-subtle">{d.restLabel ?? "—"}</span>}
      {d.openGymAvailable && !d.openGym.length && d.slot?.kind !== "rest" && <span className="text-[11px] text-subtle">Open gym available</span>}
    </span>
  );
}

function DayPanel({ day, onClose }: { day: DayData; onClose: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const today = todayISO();
  const [moving, setMoving] = useState<Occurrence | null>(null);
  const [moveDate, setMoveDate] = useState(day.date);
  const [modifying, setModifying] = useState<Occurrence | null>(null);
  const [modReason, setModReason] = useState<ModificationReason>("fatigue");
  const [modNote, setModNote] = useState("");
  const [eventForm, setEventForm] = useState<CalendarEvent | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ogForm, setOgForm] = useState<OpenGymSession | null>(null);
  const state = useAppState();
  const swapChoices = state.plan.workouts;

  const markDay = (type: "rest" | "recovery") => {
    saveCalendarEvent({ ...newEvent(), type, title: EVENT_LABELS[type] });
    toast(`${formatDate(day.date, { weekday: "long" })} marked as a ${type} day.`);
  };

  const newEvent = (): CalendarEvent => ({
    id: uid("ev"),
    type: "game",
    date: day.date,
    title: EVENT_LABELS.game,
    plannedWorkoutId: null,
    originalDate: null,
    status: "scheduled",
    modifiedReason: null,
    notes: "",
    createdAt: nowISO(),
    updatedAt: nowISO(),
  });

  return (
    <>
      <Modal open onClose={onClose} title={formatLongDate(day.date)} size="lg">
        <div className="space-y-4">
          {(day.slot || day.openGymAvailable) && (
            <div className="rounded-2xl border border-line bg-surface-2 p-4">
              {day.slot && (
                <>
                  <p className="font-semibold">{day.slot.label}</p>
                  <p className="mt-0.5 text-sm text-muted">{day.slot.description}</p>
                </>
              )}
              {day.slot?.kind !== "rest" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {day.openGymAvailable && !day.openGym.length && (
                    <>
                      {day.date >= today && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            saveOpenGym(newOpenGym(day.date, "planned"));
                            toast("Noted: planning to go to open gym.");
                          }}
                        >
                          <Users size={14} /> Plan open gym
                        </Button>
                      )}
                      {day.date <= today && (
                        <Button size="sm" variant="outline" onClick={() => setOgForm(newOpenGym(day.date))}>
                          <Users size={14} /> Log open gym
                        </Button>
                      )}
                    </>
                  )}
                  {(day.slot?.kind === "flex" || day.slot?.kind === "recovery" || day.slot?.kind === "open-gym") && day.date === today && (
                    <LinkButton href={day.slot.kind === "recovery" ? "/home-court?template=light" : "/home-court"} size="sm" variant="outline">
                      <House size={14} /> {day.slot.kind === "recovery" ? "Light shooting" : "Home Court workout"}
                    </LinkButton>
                  )}
                  {!day.events.some((e) => e.type === "recovery" || e.type === "rest") && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => markDay("recovery")}>
                        <BedDouble size={14} /> Recovery day
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => markDay("rest")}>
                        Rest day
                      </Button>
                    </>
                  )}
                </div>
              )}
              {day.openGymAvailable && <p className="mt-2 text-xs text-subtle">Open gym is available — completely optional.</p>}
            </div>
          )}

          {day.openGym.map((o) => (
            <div key={o.id} className="flex items-start gap-3 rounded-2xl border border-line p-4">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  Open gym <Badge tone={OG_TONE[o.status]}>{OPEN_GYM_STATUS_LABELS[o.status]}</Badge>
                </p>
                <p className="text-xs text-subtle">
                  {o.status === "attended"
                    ? [o.format?.replace("-", " "), o.durationMin ? `${o.durationMin} min` : null, o.intensity].filter(Boolean).join(" · ")
                    : o.status === "replaced"
                      ? `Did instead: ${o.replacedWith}`
                      : ""}
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setOgForm({ ...o, status: o.status === "planned" && day.date <= today ? "attended" : o.status, durationMin: o.durationMin ?? 90 })}>
                {o.status === "planned" && day.date <= today ? "Log it" : "Edit"}
              </Button>
            </div>
          ))}

          {day.occurrences.length === 0 && day.events.length === 0 && day.extras.length === 0 && !day.slot && !day.openGymAvailable && (
            <p className="text-sm text-muted">Nothing scheduled.</p>
          )}

          {day.occurrences.map((o) => (
            <div key={o.key} className="rounded-2xl border border-line p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {o.workout.label} — {o.workout.name}
                  </p>
                  <p className="mt-0.5 text-xs text-subtle">
                    {o.moved ? `Moved from ${formatDate(o.originalDate, { weekday: "short", month: "short", day: "numeric" })}` : "As planned"}
                    {o.swapped ? " · swapped workout" : ""}
                    {o.override?.reduce ? " · lighter version" : ""}
                    {o.fulfilledBy ? ` · ${o.status === "completed" ? "done" : "replaced"} via ${o.fulfilledBy.label.toLowerCase()}` : ""}
                    {o.override?.modifiedReason ? ` · modified (${o.override.modifiedReason.replace("-", " ")})` : ""}
                  </p>
                </div>
                <Badge tone={STATUS_TONE[o.status]}>{o.status}</Badge>
              </div>

              {moving?.key === o.key ? (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <Field label="Move to" htmlFor="move-date" error={error}>
                    <Input id="move-date" type="date" value={moveDate} onChange={(e) => setMoveDate(e.target.value)} />
                  </Field>
                  <Button
                    onClick={() => {
                      if (!/^\d{4}-\d{2}-\d{2}$/.test(moveDate)) return setError("Pick a date.");
                      setError(null);
                      if (moveDate === o.originalDate && !o.override?.status) clearOverride(o.plannedId, o.originalDate);
                      else overrideOccurrence(o.plannedId, o.originalDate, { date: moveDate, status: o.override?.status ?? "scheduled" });
                      toast(`Moved to ${formatDate(moveDate, { weekday: "long", month: "short", day: "numeric" })}.`);
                      setMoving(null);
                      onClose();
                    }}
                  >
                    Save
                  </Button>
                  <Button variant="ghost" onClick={() => setMoving(null)}>
                    Cancel
                  </Button>
                </div>
              ) : modifying?.key === o.key ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Field label="Reason" htmlFor="mod-reason">
                    <Select id="mod-reason" value={modReason} onChange={(e) => setModReason(e.target.value as ModificationReason)}>
                      {MOD_REASONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Note (optional)" htmlFor="mod-note">
                    <Input id="mod-note" value={modNote} onChange={(e) => setModNote(e.target.value)} />
                  </Field>
                  <div className="flex gap-2 sm:col-span-2">
                    <Button
                      onClick={() => {
                        overrideOccurrence(o.plannedId, o.originalDate, { status: "modified", modifiedReason: modReason, notes: modNote });
                        toast("Marked as modified. It will count as completed once you log the session.");
                        setModifying(null);
                      }}
                    >
                      Save
                    </Button>
                    <Button variant="ghost" onClick={() => setModifying(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {o.session ? (
                    <LinkButton href={`/progress?session=${o.session.id}`} variant="secondary" size="sm">
                      View logged session
                    </LinkButton>
                  ) : o.fulfilledBy ? (
                    <LinkButton href={o.fulfilledBy.type === "open-gym" ? "/open-gym" : "/home-court"} variant="secondary" size="sm">
                      View {o.fulfilledBy.label.toLowerCase()}
                    </LinkButton>
                  ) : (
                    <>
                      {o.date <= today && (
                        <Button
                          size="sm"
                          onClick={() => router.push(`/workout?plan=${o.workout.id}&date=${o.date}&scheduled=${o.originalDate}`)}
                        >
                          <Play size={14} /> {o.date === today ? "Start workout" : "Log as completed"}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setMoveDate(o.date);
                          setMoving(o);
                        }}
                      >
                        Move
                      </Button>
                      {o.status === "skipped" ? (
                        <Button variant="outline" size="sm" onClick={() => overrideOccurrence(o.plannedId, o.originalDate, { status: "scheduled" })}>
                          <Undo2 size={14} /> Unskip
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            overrideOccurrence(o.plannedId, o.originalDate, { status: "skipped" });
                            toast("Marked as skipped. Nothing is rescheduled automatically.");
                          }}
                        >
                          Skip
                        </Button>
                      )}
                      {o.override?.status !== "modified" && (
                        <Button variant="outline" size="sm" onClick={() => setModifying(o)}>
                          Mark modified
                        </Button>
                      )}
                      {o.workout.kind === "basketball" && o.date <= today && (
                        <LinkButton href={`/home-court?for=${o.key}`} variant="outline" size="sm">
                          <House size={14} /> Home Court instead
                        </LinkButton>
                      )}
                      <label className="sr-only" htmlFor={`swap-${o.key}`}>
                        Change workout type
                      </label>
                      <Select
                        id={`swap-${o.key}`}
                        value={o.workout.id}
                        onChange={(e) => {
                          const id = e.target.value;
                          overrideOccurrence(o.plannedId, o.originalDate, { swapWorkoutId: id === o.plannedId ? null : id });
                          toast("Workout changed for this day only.");
                        }}
                        className="h-9 w-auto px-2 text-xs"
                      >
                        {swapChoices.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.id === o.plannedId ? `${w.label} (planned)` : `Swap to ${w.label} — ${w.name}`}
                          </option>
                        ))}
                      </Select>
                      {o.override && (
                        <Button variant="ghost" size="sm" onClick={() => clearOverride(o.plannedId, o.originalDate)}>
                          <Undo2 size={14} /> Reset to plan
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
              {!o.session && !o.fulfilledBy && o.date <= today && (
                <p className="mt-2 text-xs text-subtle">
                  Completion is recorded only when you finish and save the workout{o.workout.kind === "basketball" ? ", or link an open gym / Home Court session to it" : ""}. Open gym never counts as a strength workout.
                </p>
              )}
            </div>
          ))}

          {day.events.map((e) => (
            <div key={e.id} className="flex items-start gap-3 rounded-2xl border border-line p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{e.title}</p>
                <p className="text-xs text-subtle">{EVENT_LABELS[e.type as Exclude<CalendarEventType, "workout">]}</p>
                {e.notes && <p className="mt-1 text-sm text-muted">{e.notes}</p>}
              </div>
              <IconButton label={`Edit ${e.title}`} onClick={() => setEventForm({ ...e })}>
                <Pencil size={16} />
              </IconButton>
              <IconButton label={`Delete ${e.title}`} onClick={() => setConfirmDelete(e.id)}>
                <Trash2 size={16} />
              </IconButton>
            </div>
          ))}

          {day.extras.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">Other training logged</p>
              <ul className="space-y-1">
                {day.extras.map((x) => (
                  <li key={x.id}>
                    <button onClick={() => router.push(x.href)} className="text-sm text-accent hover:underline">
                      {x.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {eventForm ? (
            <EventForm
              initial={eventForm}
              onCancel={() => setEventForm(null)}
              onSave={(ev) => {
                saveCalendarEvent(ev);
                setEventForm(null);
                toast(`${ev.title} saved.`);
              }}
            />
          ) : (
            <Button variant="outline" onClick={() => setEventForm(newEvent())}>
              <CalendarPlus size={16} /> Add game, practice or rest day
            </Button>
          )}
        </div>
      </Modal>
      {ogForm && <OpenGymForm initial={ogForm} onClose={() => setOgForm(null)} />}
      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        danger
        title="Delete this event?"
        message="It will be removed from your calendar."
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmDelete) deleteCalendarEvent(confirmDelete);
          toast("Event deleted.");
        }}
      />
    </>
  );
}

function EventForm({ initial, onSave, onCancel }: { initial: CalendarEvent; onSave: (e: CalendarEvent) => void; onCancel: () => void }) {
  const [e, setE] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-3 rounded-2xl border border-line-strong p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type" htmlFor="ev-type">
          <Select
            id="ev-type"
            value={e.type}
            onChange={(x) => {
              const type = x.target.value as Exclude<CalendarEventType, "workout">;
              setE({ ...e, type, title: Object.values(EVENT_LABELS).includes(e.title) || !e.title ? EVENT_LABELS[type] : e.title });
            }}
          >
            {(Object.keys(EVENT_LABELS) as Exclude<CalendarEventType, "workout">[]).map((t) => (
              <option key={t} value={t}>
                {EVENT_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date" htmlFor="ev-date">
          <Input id="ev-date" type="date" value={e.date} onChange={(x) => setE({ ...e, date: x.target.value })} />
        </Field>
        <Field label="Title" htmlFor="ev-title" error={error} className="sm:col-span-2">
          <Input id="ev-title" value={e.title} onChange={(x) => setE({ ...e, title: x.target.value })} aria-invalid={!!error} placeholder="e.g. vs. Central High" />
        </Field>
        <Field label="Notes" htmlFor="ev-notes" className="sm:col-span-2">
          <Textarea id="ev-notes" value={e.notes} onChange={(x) => setE({ ...e, notes: x.target.value })} className="min-h-[56px]" />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() => {
            if (!e.title.trim()) return setError("Add a title.");
            if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return setError("Pick a valid date.");
            onSave({ ...e, title: e.title.trim() });
          }}
        >
          Save event
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Database, Download, Monitor, Moon, Palette, RotateCcw, Sun, Upload, User, Users } from "lucide-react";
import type { AppState } from "@/lib/types";
import { useAppState } from "@/lib/store";
import { blockedWeekdays } from "@/lib/schedule";
import { importState, resetAllData, setOpenGymDays, setWorkoutWeekday, updateProfile } from "@/lib/actions";
import { makeBackup, validateBackup } from "@/lib/storage";
import { CSV_DATASETS, toCSV, type CsvDataset } from "@/lib/exporters";
import { cn, downloadFile, formatDate, todayISO, WEEK_ORDER, WEEKDAYS, WEEKDAYS_SHORT } from "@/lib/utils";
import { ProfileForm } from "@/components/ProfileForm";
import { Alert, Button, Card, CardTitle, Field, Input, Modal, NumberStepper, PageHeader, Segmented, Select, useToast } from "@/components/ui";

export default function SettingsPage() {
  const state = useAppState();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<{ state: AppState; name: string } | null>(null);
  const [importError, setImportError] = useState<string[] | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState("");
  const [formKey, setFormKey] = useState(0);

  const exportJSON = () => {
    downloadFile(`center-performance-backup-${todayISO()}.json`, JSON.stringify(makeBackup(state), null, 2), "application/json");
    toast("Backup downloaded.");
  };

  const exportCSV = (key: CsvDataset) => {
    const rows = CSV_DATASETS[key].rows(state);
    if (!rows.length) {
      toast(`No ${CSV_DATASETS[key].label.toLowerCase()} to export yet.`, "info");
      return;
    }
    downloadFile(`center-performance-${key}-${todayISO()}.csv`, toCSV(rows), "text/csv");
    toast(`${CSV_DATASETS[key].label} exported (${rows.length} rows).`);
  };

  const onFile = async (file: File | undefined) => {
    setImportError(null);
    setImportPreview(null);
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) return setImportError(["File is larger than 20 MB — that doesn't look like a backup."]);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = validateBackup(parsed);
      if (!res.ok) return setImportError(res.errors);
      setImportPreview({ state: res.state, name: file.name });
    } catch {
      setImportError(["The file isn't valid JSON. Choose a backup exported from CENTER PERFORMANCE."]);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const counts = (s: AppState) => [
    ["Workouts", s.workoutSessions.filter((w) => w.status === "completed").length],
    ["Skills sessions", s.skillSessions.length],
    ["Conditioning", s.conditioningSessions.length],
    ["Check-ins", s.recoveryEntries.length],
    ["Open gym", (s.openGymSessions ?? []).length],
    ["Calendar events", s.calendarEvents.length],
    ["Exercises", s.exercises.length],
  ];

  const themeOptions = [
    { value: "dark" as const, label: (<span className="inline-flex items-center gap-1.5"><Moon size={14} /> Dark</span>) },
    { value: "light" as const, label: (<span className="inline-flex items-center gap-1.5"><Sun size={14} /> Light</span>) },
    { value: "system" as const, label: (<span className="inline-flex items-center gap-1.5"><Monitor size={14} /> System</span>) },
  ];

  return (
    <div>
      <PageHeader title="Settings" subtitle="Profile, goals, schedule, units and your data." />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle icon={<User size={16} />} sub="Height, goals, priorities, units, plan start date and conditioning equipment">
            Profile & goals
          </CardTitle>
          <ProfileForm
            key={formKey}
            compact
            initial={state.profile}
            submitLabel="Save profile"
            onSubmit={(patch) => {
              updateProfile(patch);
              toast("Profile saved.");
            }}
          />
        </Card>

        <div className="space-y-4">
          <Card>
            <CardTitle icon={<Palette size={16} />}>Appearance</CardTitle>
            <Segmented label="Theme" value={state.profile.theme} onChange={(t) => updateProfile({ theme: t })} options={themeOptions} size="sm" />
          </Card>

          <Card>
            <CardTitle sub="Move any training day to a different weekday">Weekly schedule</CardTitle>
            <ul className="space-y-2">
              {[...state.plan.workouts]
                .sort((a, b) => a.dayNumber - b.dayNumber)
                .map((w) => (
                  <li key={w.id}>
                    <Field label={`${w.label} — ${w.name}`} htmlFor={`set-day-${w.id}`}>
                      <Select
                        id={`set-day-${w.id}`}
                        value={w.weekday ?? ""}
                        onChange={(e) => {
                          const v = e.target.value === "" ? null : Number(e.target.value);
                          setWorkoutWeekday(w.id, v);
                          toast(v === null ? `${w.label} is now optional (not scheduled).` : `${w.label} now on ${WEEKDAYS[v]}.`);
                        }}
                      >
                        <option value="">Not scheduled (optional)</option>
                        {WEEKDAYS.map((d, i) => (
                          <option key={d} value={i} disabled={blockedWeekdays(state).includes(i)}>
                            {d}
                            {blockedWeekdays(state).includes(i) ? " (unavailable)" : ""}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </li>
                ))}
            </ul>
            <Link href="/plan" className="mt-3 inline-block text-sm text-accent hover:underline">
              Edit exercises, sets and rest in Workout Plan →
            </Link>
          </Card>

          <Card>
            <CardTitle icon={<Users size={16} />} sub="Days open gym is available. Availability is never a commitment — you choose when to go.">
              Open gym days
            </CardTitle>
            <div className="grid grid-cols-7 gap-1" role="group" aria-label="Open gym days">
              {WEEK_ORDER.map((d) => {
                const blocked = blockedWeekdays(state).includes(d);
                const on = state.profile.openGymDays.includes(d) && !blocked;
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    disabled={blocked}
                    title={blocked ? "Unavailable day — open gym is never offered" : undefined}
                    onClick={() => setOpenGymDays(on ? state.profile.openGymDays.filter((x) => x !== d) : [...state.profile.openGymDays, d])}
                    className={cn("h-11 rounded-xl text-xs font-semibold", on ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted hover:text-text", blocked && "cursor-not-allowed line-through opacity-50")}
                  >
                    {WEEKDAYS_SHORT[d]}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardTitle sub="Defaults: two strength and two basketball-focused sessions">Weekly targets</CardTitle>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Strength sessions" htmlFor="tg-str">
                <NumberStepper id="tg-str" label="Strength sessions per week" value={state.profile.strengthPerWeek} min={0} max={5} onChange={(v) => updateProfile({ strengthPerWeek: v ?? 0 })} />
              </Field>
              <Field label="Basketball sessions" htmlFor="tg-bb">
                <NumberStepper id="tg-bb" label="Basketball sessions per week" value={state.profile.basketballPerWeek} min={0} max={6} onChange={(v) => updateProfile({ basketballPerWeek: v ?? 0 })} />
              </Field>
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <CardTitle icon={<Database size={16} />} sub="Data is stored in this browser only. Export regularly to keep a backup.">
          Data management
        </CardTitle>
        <dl className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {counts(state).map(([k, v]) => (
            <div key={k as string} className="rounded-xl bg-surface-2 p-3">
              <dt className="text-[11px] text-subtle">{k}</dt>
              <dd className="font-display text-xl font-bold tabular">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="grid gap-6 lg:grid-cols-3">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Export</h3>
            <Button onClick={exportJSON} className="w-full">
              <Download size={16} /> Full backup (JSON)
            </Button>
            <p className="mt-2 text-xs text-subtle">Includes everything and can be restored with Import.</p>
            <div className="mt-4 grid grid-cols-1 gap-2">
              {(Object.keys(CSV_DATASETS) as CsvDataset[]).map((k) => (
                <Button key={k} variant="outline" size="sm" onClick={() => exportCSV(k)}>
                  <Download size={14} /> {CSV_DATASETS[k].label} (CSV)
                </Button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Import backup</h3>
            <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong px-4 text-sm text-muted hover:border-accent hover:text-text focus-within:ring-2 focus-within:ring-accent">
              <Upload size={16} /> Choose JSON backup
              <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            <p className="mt-2 text-xs text-subtle">The file is validated before anything changes. Importing replaces all current data.</p>
            {importError && (
              <div className="mt-3">
                <Alert tone="bad" title="This file can't be imported" onDismiss={() => setImportError(null)}>
                  <ul className="list-disc pl-4">
                    {importError.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </Alert>
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Reset</h3>
            <Button variant="danger" className="w-full" onClick={() => setResetOpen(true)}>
              <RotateCcw size={16} /> Reset all data
            </Button>
            <p className="mt-2 text-xs text-subtle">Deletes all history, custom exercises and settings. Export a backup first.</p>
          </div>
        </div>
      </Card>

      <Modal
        open={!!importPreview}
        onClose={() => setImportPreview(null)}
        title="Restore this backup?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setImportPreview(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!importPreview) return;
                importState(importPreview.state);
                setImportPreview(null);
                setFormKey((k) => k + 1);
                toast("Backup restored.");
              }}
            >
              Replace my data
            </Button>
          </>
        }
      >
        {importPreview && (
          <div className="space-y-3 text-sm">
            <p className="text-muted">
              <span className="text-text">{importPreview.name}</span> is a valid backup
              {importPreview.state.updatedAt ? ` last updated ${formatDate(importPreview.state.updatedAt.slice(0, 10), { month: "short", day: "numeric", year: "numeric" })}` : ""}. It
              contains:
            </p>
            <dl className="grid grid-cols-3 gap-2">
              {counts(importPreview.state).map(([k, v]) => (
                <div key={k as string} className="rounded-xl bg-surface-2 p-2.5">
                  <dt className="text-[11px] text-subtle">{k}</dt>
                  <dd className="font-semibold tabular">{v}</dd>
                </div>
              ))}
            </dl>
            <Alert tone="warn">Your current data will be replaced. Export a backup first if you want to keep it.</Alert>
          </div>
        )}
      </Modal>

      <Modal
        open={resetOpen}
        onClose={() => {
          setResetOpen(false);
          setResetText("");
        }}
        title="Reset all data?"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setResetOpen(false);
                setResetText("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={resetText !== "RESET"}
              onClick={() => {
                resetAllData();
                setResetOpen(false);
                setResetText("");
              }}
            >
              Delete everything
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p className="text-muted">This permanently deletes every workout, skills session, conditioning log, recovery check-in, calendar event and custom exercise, and returns you to onboarding.</p>
          <Field label='Type "RESET" to confirm' htmlFor="reset-confirm">
            <Input id="reset-confirm" value={resetText} onChange={(e) => setResetText(e.target.value)} autoComplete="off" />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

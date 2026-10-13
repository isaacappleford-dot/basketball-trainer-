"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import type { ConditioningModality, UserProfile } from "@/lib/types";
import { Button, Field, Input, Segmented, Select, Textarea, useUnsavedWarning } from "./ui";
import { cn } from "@/lib/utils";

export const PRIORITY_OPTIONS = [
  "Strength",
  "Speed",
  "Conditioning",
  "Athletic fitness",
  "Post skills",
  "Rebounding",
  "Defense",
  "Supporting healthy growth",
  "Shooting",
  "Mobility",
];

export const MODALITY_LABELS: Record<ConditioningModality, string> = {
  bike: "Bike",
  elliptical: "Elliptical",
  treadmill: "Treadmill",
  court: "Court",
  walking: "Walking",
  custom: "Custom",
};

type Errors = Partial<Record<"heightFt" | "heightIn" | "bodyWeight" | "daysPerWeek" | "planStartDate" | "mainGoal" | "planWeeks", string>>;

export function ProfileForm({
  initial,
  submitLabel,
  onSubmit,
  compact,
}: {
  initial: UserProfile;
  submitLabel: string;
  onSubmit: (patch: Partial<UserProfile>) => void;
  compact?: boolean;
}) {
  const [name, setName] = useState(initial.name);
  const [heightFt, setHeightFt] = useState(String(Math.floor(initial.heightIn / 12)));
  const [heightIn, setHeightIn] = useState(String(initial.heightIn % 12));
  const [bodyWeight, setBodyWeight] = useState(initial.bodyWeight === null ? "" : String(initial.bodyWeight));
  const [experience, setExperience] = useState(initial.experience);
  const [daysPerWeek, setDaysPerWeek] = useState(String(initial.daysPerWeek));
  const [environment, setEnvironment] = useState(initial.trainingEnvironment);
  const [position, setPosition] = useState(initial.position);
  const [mainGoal, setMainGoal] = useState(initial.mainGoal);
  const [priorities, setPriorities] = useState<string[]>(initial.priorities);
  const [planWeeks] = useState(String(initial.planWeeks));
  const [units, setUnits] = useState(initial.units);
  const [startDate, setStartDate] = useState(initial.planStartDate);
  const [conditioning, setConditioning] = useState<ConditioningModality>(initial.preferredConditioning);
  const [errors, setErrors] = useState<Errors>({});
  const [dirty, setDirty] = useState(false);
  useUnsavedWarning(dirty && !!compact);

  const touch = <T,>(fn: (v: T) => void) => (v: T) => {
    setDirty(true);
    fn(v);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Errors = {};
    const ft = Number(heightFt);
    const inch = Number(heightIn);
    if (!Number.isInteger(ft) || ft < 4 || ft > 8) errs.heightFt = "Enter feet between 4 and 8.";
    if (!Number.isFinite(inch) || inch < 0 || inch >= 12) errs.heightIn = "Inches must be 0–11.";
    const bw = bodyWeight.trim() === "" ? null : Number(bodyWeight);
    if (bw !== null && (!Number.isFinite(bw) || bw <= 0 || bw > 1000)) errs.bodyWeight = "Enter a positive number or leave blank.";
    const days = Number(daysPerWeek);
    if (!Number.isInteger(days) || days < 1 || days > 7) errs.daysPerWeek = "Choose 1–7 days.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) errs.planStartDate = "Choose a valid start date.";
    if (!mainGoal.trim()) errs.mainGoal = "Add a main goal.";
    setErrors(errs);
    if (Object.keys(errs).length) {
      const first = document.querySelector<HTMLElement>("[aria-invalid=true]");
      first?.focus();
      return;
    }
    setDirty(false);
    onSubmit({
      name: name.trim(),
      heightIn: ft * 12 + inch,
      bodyWeight: bw,
      experience,
      daysPerWeek: days,
      trainingEnvironment: environment.trim(),
      position: position.trim() || "Center",
      mainGoal: mainGoal.trim(),
      priorities,
      planWeeks: Number(planWeeks),
      units,
      planStartDate: startDate,
      preferredConditioning: conditioning,
    });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name (optional)" htmlFor="pf-name">
          <Input id="pf-name" value={name} onChange={(e) => touch(setName)(e.target.value)} autoComplete="given-name" />
        </Field>
        <Field label="Position" htmlFor="pf-pos">
          <Input id="pf-pos" value={position} onChange={(e) => touch(setPosition)(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Height (ft)" htmlFor="pf-ft" error={errors.heightFt}>
            <Input id="pf-ft" type="number" inputMode="numeric" value={heightFt} aria-invalid={!!errors.heightFt} onChange={(e) => touch(setHeightFt)(e.target.value)} />
          </Field>
          <Field label="Height (in)" htmlFor="pf-in" error={errors.heightIn}>
            <Input id="pf-in" type="number" inputMode="numeric" value={heightIn} aria-invalid={!!errors.heightIn} onChange={(e) => touch(setHeightIn)(e.target.value)} />
          </Field>
        </div>
        <Field
          label={`Body weight (${units}, optional)`}
          htmlFor="pf-bw"
          error={errors.bodyWeight}
          hint="Private and optional. Progress here is measured by performance and well-being, not the scale."
        >
          <Input id="pf-bw" type="number" inputMode="decimal" value={bodyWeight} aria-invalid={!!errors.bodyWeight} onChange={(e) => touch(setBodyWeight)(e.target.value)} />
        </Field>
        <Field label="Experience" htmlFor="pf-exp">
          <Select id="pf-exp" value={experience} onChange={(e) => touch(setExperience)(e.target.value as UserProfile["experience"])}>
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Experienced</option>
          </Select>
        </Field>
        <Field label="Training days per week" htmlFor="pf-days" error={errors.daysPerWeek}>
          <Input id="pf-days" type="number" inputMode="numeric" min={1} max={7} value={daysPerWeek} aria-invalid={!!errors.daysPerWeek} onChange={(e) => touch(setDaysPerWeek)(e.target.value)} />
        </Field>
        <Field label="Training environment" htmlFor="pf-env" className="sm:col-span-2">
          <Input id="pf-env" value={environment} onChange={(e) => touch(setEnvironment)(e.target.value)} />
        </Field>
        <Field label="Main goal" htmlFor="pf-goal" error={errors.mainGoal} className="sm:col-span-2">
          <Textarea id="pf-goal" value={mainGoal} aria-invalid={!!errors.mainGoal} onChange={(e) => touch(setMainGoal)(e.target.value)} className="min-h-[64px]" />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Priorities</legend>
        <div className="flex flex-wrap gap-2">
          {PRIORITY_OPTIONS.map((p) => {
            const on = priorities.includes(p);
            return (
              <button
                key={p}
                type="button"
                aria-pressed={on}
                onClick={() => touch(setPriorities)(on ? priorities.filter((x) => x !== p) : [...priorities, p])}
                className={cn(
                  "h-10 rounded-full border px-4 text-sm transition-colors",
                  on ? "border-accent bg-accent-soft text-accent" : "border-line-strong text-muted hover:text-text",
                )}
              >
                {p}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Plan start date (week 1)" htmlFor="pf-start" error={errors.planStartDate} hint="Your current training week is calculated from this date.">
          <Input id="pf-start" type="date" value={startDate} aria-invalid={!!errors.planStartDate} onChange={(e) => touch(setStartDate)(e.target.value)} />
        </Field>
        <Field label="Training plan length" htmlFor="pf-weeks" hint="The preloaded progression covers 8 weeks.">
          <Input id="pf-weeks" value={`${planWeeks} weeks`} readOnly disabled />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Weight units</span>
          <Segmented label="Weight units" value={units} onChange={touch(setUnits)} options={[{ value: "lb", label: "Pounds (lb)" }, { value: "kg", label: "Kilograms (kg)" }]} />
        </div>
        <Field label="Preferred conditioning equipment" htmlFor="pf-cond">
          <Select id="pf-cond" value={conditioning} onChange={(e) => touch(setConditioning)(e.target.value as ConditioningModality)}>
            {(["bike", "elliptical", "treadmill", "court", "walking"] as ConditioningModality[]).map((m) => (
              <option key={m} value={m}>
                {MODALITY_LABELS[m]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="lg" className="w-full sm:w-auto">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useAppState } from "@/lib/store";
import { completeOnboarding } from "@/lib/actions";
import { WEEKDAYS } from "@/lib/utils";
import { ProfileForm } from "./ProfileForm";
import { Card, useToast } from "./ui";

export function Onboarding() {
  const state = useAppState();
  const toast = useToast();
  const days = [...state.plan.workouts].sort((a, b) => a.dayNumber - b.dayNumber);

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Welcome</p>
      <h1 className="mt-2 font-display text-4xl font-bold uppercase leading-none tracking-tight sm:text-5xl">
        Center <span className="text-accent">Performance</span>
      </h1>
      <p className="mt-4 max-w-xl text-muted">
        An 8-week, four-day plan to become a more complete basketball center — strength, speed, conditioning, post skills, rebounding and
        defense. Confirm your profile to get started. Everything stays on this device.
      </p>

      <Card className="mt-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">Your four-day week</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {days.map((w) => (
            <li key={w.id} className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft font-display text-lg font-bold text-accent">
                {w.dayNumber}
              </span>
              <span className="min-w-0">
                <span className="block text-xs text-subtle">{WEEKDAYS[w.weekday]}</span>
                <span className="block truncate text-sm font-medium">{w.name}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-subtle">Wednesday and Friday are recovery or easy-movement days. Sunday is rest.</p>
      </Card>

      <Card className="mt-6">
        <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-muted">Profile & goals</h2>
        <ProfileForm
          initial={state.profile}
          submitLabel="Start my plan"
          onSubmit={(patch) => {
            completeOnboarding(patch);
            toast("Profile saved. Let's get to work.");
          }}
        />
      </Card>
    </div>
  );
}

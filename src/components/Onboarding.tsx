"use client";

import { useAppState } from "@/lib/store";
import { completeOnboarding } from "@/lib/actions";
import { WEEKDAYS } from "@/lib/utils";
import { ProfileForm } from "./ProfileForm";
import { Card, useToast } from "./ui";

export function Onboarding() {
  const state = useAppState();
  const toast = useToast();
  const days = [...state.plan.workouts].filter((w) => w.weekday !== null).sort((a, b) => ((a.weekday! + 6) % 7) - ((b.weekday! + 6) % 7));

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Welcome</p>
      <h1 className="mt-2 font-display text-4xl font-bold uppercase leading-none tracking-tight sm:text-5xl">
        Center <span className="text-accent">Performance</span>
      </h1>
      <p className="mt-4 max-w-xl text-muted">
        A flexible plan for a center: lift twice a week, hit open gym on the days you pick, and use your driveway for extra skill work —
        without stacking too many hard days together. Confirm your profile to get started. Everything stays on this device.
      </p>

      <Card className="mt-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">Your flexible week</h2>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {days.map((w) => (
            <li key={w.id} className="flex min-w-0 items-center gap-3 rounded-xl bg-surface-2 p-3">
              <span className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft px-2 font-display text-xs font-bold uppercase text-accent">
                {w.label.replace("Day ", "")}
              </span>
              <span className="min-w-0">
                <span className="block text-xs text-subtle">{WEEKDAYS[w.weekday!]}</span>
                <span className="block truncate text-sm font-medium">{w.name}</span>
              </span>
            </li>
          ))}
        </ul>
        <ul className="mt-3 space-y-1 text-xs text-subtle">
          {state.plan.daySlots.map((d) => (
            <li key={d.weekday}>
              <span className="text-muted">{WEEKDAYS[d.weekday]}:</span> {d.label} — {d.description}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-subtle">
          Two gym strength days (Monday and Friday) and two basketball-focused sessions per week. Open gym is available Monday–Thursday, but you choose when to go — never every day. Wednesday is blocked: nothing is scheduled. Everything else can be moved, skipped or swapped.
        </p>
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

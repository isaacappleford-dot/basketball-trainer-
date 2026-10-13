"use client";

import Link from "next/link";
import type { RecoveryEntry } from "@/lib/types";
import { recoveryAdvice } from "@/lib/metrics";
import { daysBetween, formatDate, todayISO } from "@/lib/utils";
import { Alert } from "./ui";

/** Conservative recovery-based suggestions. Never diagnostic. */
export function RecoveryAdvice({ entry, showStale = true }: { entry: RecoveryEntry | null; showStale?: boolean }) {
  if (!entry) {
    return (
      <Alert tone="info" title="No recovery check-in yet">
        <Link href="/recovery" className="text-accent underline-offset-2 hover:underline">
          Log a quick check-in
        </Link>{" "}
        to get suggestions for adjusting today&apos;s session.
      </Alert>
    );
  }
  const age = daysBetween(entry.date, todayISO());
  if (age > 2) {
    return showStale ? (
      <Alert tone="info" title={`Last check-in: ${formatDate(entry.date)}`}>
        <Link href="/recovery" className="text-accent underline-offset-2 hover:underline">
          Check in today
        </Link>{" "}
        for up-to-date training suggestions.
      </Alert>
    ) : null;
  }
  const advice = recoveryAdvice(entry)!;
  return (
    <Alert tone={advice.level === "good" ? "good" : "warn"} title={`${advice.title} · check-in ${age === 0 ? "today" : formatDate(entry.date)}`}>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {advice.tips.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </Alert>
  );
}

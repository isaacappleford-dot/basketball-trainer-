"use client";

import Link from "next/link";
import { Lightbulb, TriangleAlert, X } from "lucide-react";
import { useAppState } from "@/lib/store";
import { weeklyAdvice } from "@/lib/advice";
import { applyAdvice, dismissAdvice } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { Button, useToast } from "./ui";

/** Scheduling suggestions. Each one only changes anything if you tap an action. */
export function AdviceList({ limit, empty }: { limit?: number; empty?: React.ReactNode }) {
  const state = useAppState();
  const toast = useToast();
  const list = weeklyAdvice(state).slice(0, limit ?? 99);
  if (!list.length) return empty ? <>{empty}</> : null;
  return (
    <ul className="space-y-3" aria-label="Scheduling suggestions">
      {list.map((a) => (
        <li key={a.id} className={cn("rounded-2xl border p-4", a.level === "caution" ? "border-warn/30 bg-warn-soft" : "border-line bg-surface-2")}>
          <div className="flex items-start gap-3">
            <span className={cn("mt-0.5 shrink-0", a.level === "caution" ? "text-warn" : "text-accent")}>
              {a.level === "caution" ? <TriangleAlert size={18} /> : <Lightbulb size={18} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{a.title}</p>
              <p className="mt-1 text-sm text-muted">{a.reason}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {a.actions.map((act) =>
                  act.kind === "link" ? (
                    <Link key={act.label} href={act.href} className="inline-flex h-9 items-center rounded-lg bg-surface-3 px-3 text-sm">
                      {act.label}
                    </Link>
                  ) : (
                    <Button
                      key={act.label}
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        applyAdvice(act);
                        dismissAdvice(a.id);
                        toast("Plan adjusted. You can undo it from the calendar.");
                      }}
                    >
                      {act.label}
                    </Button>
                  ),
                )}
                <Button size="sm" variant="ghost" onClick={() => dismissAdvice(a.id)}>
                  Keep my plan
                </Button>
              </div>
            </div>
            <button onClick={() => dismissAdvice(a.id)} aria-label={`Dismiss suggestion: ${a.title}`} className="shrink-0 text-muted hover:text-text">
              <X size={16} />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

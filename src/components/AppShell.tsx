"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  BedDouble,
  BookOpen,
  CalendarDays,
  ClipboardList,
  HeartPulse,
  LayoutDashboard,
  MoreHorizontal,
  Play,
  Settings,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import { dismissLoadError, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Alert, LoadingScreen, ToastProvider } from "./ui";
import { Onboarding } from "./Onboarding";

export const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/plan", label: "Workout Plan", icon: ClipboardList },
  { href: "/workout", label: "Start Workout", icon: Play },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/skills", label: "Basketball Skills", icon: Target },
  { href: "/conditioning", label: "Conditioning", icon: HeartPulse },
  { href: "/recovery", label: "Recovery", icon: BedDouble },
  { href: "/library", label: "Exercise Library", icon: BookOpen },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

const MOBILE_PRIMARY = ["/", "/plan", "/workout", "/progress"];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="CENTER PERFORMANCE home">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="14" fill="none" stroke="var(--accent)" strokeWidth="2.5" />
        <path d="M2 16h28M16 2v28M6 6c5 4 5 16 0 20M26 6c-5 4-5 16 0 20" fill="none" stroke="var(--accent)" strokeWidth="1.8" />
      </svg>
      <span className="font-display text-[15px] font-bold leading-none tracking-[0.12em]">
        CENTER
        <br />
        <span className="text-accent">PERFORMANCE</span>
      </span>
    </Link>
  );
}

function useThemeSync(theme: "dark" | "light" | "system" | undefined) {
  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement;
    const apply = () => {
      const resolved = theme === "system" ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : theme;
      root.dataset.theme = resolved;
    };
    apply();
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
}

export function AppShell({ children }: { children: ReactNode }) {
  const snap = useStore();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  useThemeSync(snap?.state.profile.theme);

  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setMoreOpen(false);
  }

  if (!snap) {
    return (
      <div className="min-h-dvh">
        <LoadingScreen />
      </div>
    );
  }

  if (!snap.state.profile.onboarded) {
    return (
      <ToastProvider>
        <Onboarding />
      </ToastProvider>
    );
  }

  const active = snap.state.activeWorkout;
  const onWorkout = pathname.startsWith("/workout");

  return (
    <ToastProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink">
        Skip to content
      </a>
      <div className="flex min-h-dvh">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
          <div className="px-6 pb-6 pt-7">
            <Logo />
          </div>
          <nav aria-label="Main" className="flex-1 overflow-y-auto px-3">
            <ul className="space-y-0.5">
              {NAV.map(({ href, label, icon: Icon }) => {
                const on = isActive(pathname, href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={on ? "page" : undefined}
                      className={cn(
                        "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                        on ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-text",
                      )}
                    >
                      <Icon size={18} aria-hidden />
                      {label}
                      {href === "/workout" && active && <span className="ml-auto h-2 w-2 rounded-full bg-accent" aria-label="Workout in progress" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="border-t border-line px-6 py-4 text-xs text-subtle">
            {snap.state.profile.name ? `${snap.state.profile.name} · ` : ""}
            {snap.state.profile.position}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar */}
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-bg/90 px-4 backdrop-blur lg:hidden">
            <Logo />
            <Link href="/settings" aria-label="Settings" className="flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-surface-2">
              <Settings size={20} />
            </Link>
          </header>

          {active && !onWorkout && (
            <div className="border-b border-accent/30 bg-accent-soft px-4 py-2.5 text-sm">
              <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
                <span className="truncate">
                  <span className="font-semibold text-accent">Workout in progress</span> · {active.workoutName}
                </span>
                <Link href="/workout" className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink">
                  Resume
                </Link>
              </div>
            </div>
          )}

          <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
            <div className="mb-4 space-y-2 empty:hidden">
              {snap.loadError && (
                <Alert tone="bad" title="Data problem" onDismiss={dismissLoadError}>
                  {snap.loadError}
                </Alert>
              )}
              {snap.saveError && (
                <Alert tone="bad" title="Not saved">
                  {snap.saveError}
                </Alert>
              )}
            </div>
            {children}
          </main>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <nav aria-label="Main" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur lg:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.filter((n) => MOBILE_PRIMARY.includes(n.href)).map(({ href, label, icon: Icon }) => {
            const on = isActive(pathname, href);
            const isStart = href === "/workout";
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={on ? "page" : undefined}
                  className={cn("flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium", on ? "text-accent" : "text-muted")}
                >
                  {isStart ? (
                    <span className={cn("flex h-9 w-9 items-center justify-center rounded-full", on || active ? "bg-accent text-accent-ink" : "bg-surface-3 text-text")}>
                      <Icon size={18} aria-hidden />
                    </span>
                  ) : (
                    <Icon size={20} aria-hidden />
                  )}
                  <span className="truncate">{isStart ? (active ? "Resume" : "Start") : label.split(" ")[0] === "Workout" ? "Plan" : label.split(" ")[0]}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              aria-controls="more-sheet"
              className={cn(
                "flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium",
                NAV.some((n) => !MOBILE_PRIMARY.includes(n.href) && isActive(pathname, n.href)) ? "text-accent" : "text-muted",
              )}
            >
              <MoreHorizontal size={20} aria-hidden />
              More
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="More sections" id="more-sheet">
          <button className="absolute inset-0 bg-black/60" aria-label="Close menu" onClick={() => setMoreOpen(false)} />
          <div className="safe-bottom absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-line-strong bg-surface p-4">
            <div className="mb-3 flex items-center justify-between px-1">
              <p className="text-sm font-semibold uppercase tracking-wider text-muted">More</p>
              <button onClick={() => setMoreOpen(false)} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-surface-2">
                <X size={20} />
              </button>
            </div>
            <ul className="grid grid-cols-3 gap-2">
              {NAV.filter((n) => !MOBILE_PRIMARY.includes(n.href)).map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex h-20 flex-col items-center justify-center gap-2 rounded-2xl border text-center text-xs font-medium",
                      isActive(pathname, href) ? "border-accent/40 bg-accent-soft text-accent" : "border-line bg-surface-2 text-text",
                    )}
                  >
                    <Icon size={20} aria-hidden />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </ToastProvider>
  );
}

import type { ISODate, WeightUnit } from "./types";

export function uid(prefix = "id"): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : Math.random().toString(36).slice(2, 18);
  return `${prefix}_${rand}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ---------------------------- Dates (local time) ---------------------------- */

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = parseISODate(date);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function daysBetween(a: ISODate, b: ISODate): number {
  const ms = parseISODate(b).getTime() - parseISODate(a).getTime();
  return Math.round(ms / 86400000);
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: ISODate): ISODate {
  const d = parseISODate(date);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return toISODate(d);
}

export function weekdayOf(date: ISODate): number {
  return parseISODate(date).getDay();
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Monday-first ordering of weekday indexes. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function formatDate(date: ISODate, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }): string {
  return parseISODate(date).toLocaleDateString(undefined, opts);
}

export function formatLongDate(date: ISODate): string {
  return formatDate(date, { weekday: "long", month: "long", day: "numeric" });
}

export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function formatMinutes(totalSec: number): string {
  const m = Math.round(totalSec / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

/* --------------------------------- Numbers --------------------------------- */

/** Shooting percentage: makes / attempts × 100. Returns null for zero attempts. */
export function percentage(makes: number, attempts: number): number | null {
  if (!Number.isFinite(makes) || !Number.isFinite(attempts) || attempts <= 0) return null;
  return Math.round((makes / attempts) * 1000) / 10;
}

export function formatPct(p: number | null): string {
  return p === null ? "—" : `${p.toFixed(p % 1 === 0 ? 0 : 1)}%`;
}

const LB_PER_KG = 2.20462;

export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  return from === "kg" ? value * LB_PER_KG : value / LB_PER_KG;
}

export function roundWeight(value: number, unit: WeightUnit): number {
  const step = unit === "kg" ? 0.5 : 0.5;
  return Math.round(value / step) * step;
}

export function formatWeight(value: number | null, unit: WeightUnit): string {
  if (value === null) return "—";
  const r = roundWeight(value, unit);
  return `${Number.isInteger(r) ? r : r.toFixed(1)} ${unit}`;
}

export function formatHeight(inches: number): string {
  const ft = Math.floor(inches / 12);
  const inch = Math.round(inches % 12);
  return `${ft}′${inch}″`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export function average(values: number[]): number | null {
  return values.length ? sum(values) / values.length : null;
}

export function parseNumber(input: string): number | null {
  if (input.trim() === "") return null;
  const n = Number(input);
  return Number.isFinite(n) ? n : null;
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Elapsed seconds for a pausable session clock. */
export function elapsedSec(startedAt: string, pausedAt: number | null, pausedSec: number, now: number): number {
  const end = pausedAt ?? now;
  return Math.max(0, Math.floor((end - new Date(startedAt).getTime()) / 1000) - (pausedSec || 0));
}

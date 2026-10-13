"use client";

import { useSyncExternalStore } from "react";
import type { AppState } from "./types";
import { loadState, saveState, STORAGE_KEY } from "./storage";

export interface StoreSnapshot {
  state: AppState;
  loadError: string | null;
  saveError: string | null;
  lastSavedAt: number | null;
}

let snapshot: StoreSnapshot | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function ensureLoaded(): StoreSnapshot {
  if (!snapshot) {
    const { state, error } = loadState();
    snapshot = { state, loadError: error, saveError: null, lastSavedAt: null };
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (e) => {
        if (e.key !== STORAGE_KEY) return;
        const next = loadState();
        snapshot = { ...snapshot!, state: next.state, loadError: next.error };
        emit();
      });
    }
  }
  return snapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getServerSnapshot = () => null;

/** Returns null during server render / before hydration (loading state). */
export function useStore(): StoreSnapshot | null {
  return useSyncExternalStore(subscribe, ensureLoaded, getServerSnapshot);
}

export function getState(): AppState {
  return ensureLoaded().state;
}

/** Applies an immutable update and persists it immediately. */
export function setState(updater: (s: AppState) => AppState) {
  const current = ensureLoaded();
  const next = { ...updater(current.state), updatedAt: new Date().toISOString() };
  const saveError = saveState(next);
  snapshot = { ...current, state: next, saveError, lastSavedAt: saveError ? current.lastSavedAt : Date.now() };
  emit();
}

export function replaceState(next: AppState) {
  setState(() => next);
}

export function dismissLoadError() {
  const current = ensureLoaded();
  snapshot = { ...current, loadError: null };
  emit();
}

/** For components rendered inside <AppShell>, which only mounts pages once data has loaded. */
export function useAppState() {
  const snap = useStore();
  if (!snap) throw new Error("useAppState must be used inside a loaded AppShell");
  return snap.state;
}

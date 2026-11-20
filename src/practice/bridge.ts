"use client";

// The bridge between a running session and the tool pages. A session ("run")
// is a list of questions; each question opens on its tool's page with a
// "#practice&try=…&level=…&seed=…" address. The tool reports the answer
// with practiceCheck(); the practice bar (PracticeBar.tsx) shows hints and
// the way to the next question.
//
// The run lives in localStorage so a reload keeps it; the answers go to
// IndexedDB (db.ts).

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ToolAdapter } from "./adapter";
import { db, newId } from "./db";
import { answer } from "./record";
import type { SessionItem } from "./session";
import { skillKey, type Attempt } from "./types";

export type RunKind = "practice" | "daily" | "exam" | "assignment";

export interface Run {
  id: string;
  childId: string;
  kind: RunKind;
  items: SessionItem[];
  index: number;
  startedAt: number;
  /** When the current question appeared. */
  itemStartedAt: number;
  /** Hints shown for the current question (0 … 3). */
  hints: number;
  /** One per item once answered. */
  results: (Attempt | null)[];
  /** Wrong answers in a row; at 3 the next question gets easier. */
  wrongStreak: number;
  /** Mock exam: when time is up. */
  endsAt?: number;
  /** Assignment from a teacher. */
  assignmentId?: string;
  finished?: boolean;
  finishedAt?: number;
}

const KEY = "tizhooshan-run";
let run: Run | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    run = raw ? (JSON.parse(raw) as Run) : null;
  } catch {
    run = null;
  }
}

function save(next: Run | null) {
  run = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode or full storage: the run still works until a reload.
  }
  listeners.forEach((fn) => fn());
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const getRun = () => {
  load();
  return run;
};

/** The current run, or null. */
export const useRun = () => useSyncExternalStore(subscribe, getRun, () => null);

export function startRun(r: Omit<Run, "id" | "index" | "startedAt" | "itemStartedAt" | "hints" | "results" | "wrongStreak">): Run {
  const now = Date.now();
  const next: Run = { ...r, id: newId(), index: 0, startedAt: now, itemStartedAt: now, hints: 0, results: r.items.map(() => null), wrongStreak: 0 };
  save(next);
  return next;
}

export const endRun = () => save(null);

export function updateRun(patch: Partial<Run>) {
  const r = getRun();
  if (r) save({ ...r, ...patch });
}

/** Is this page showing a question of the run? Read from the address. */
export function practiceParams(): { type: string; level: number; seed: number } | null {
  if (typeof window === "undefined") return null;
  const p = new URLSearchParams(window.location.hash.slice(1));
  if (!p.has("practice")) return null;
  return { type: p.get("try") ?? "", level: Number(p.get("level")), seed: Number(p.get("seed")) };
}

const current = () => {
  const r = getRun();
  return r && !r.finished ? r.items[r.index] : undefined;
};

/**
 * The address hash. The router may add the hash after the new page renders,
 * so it is read again after every navigation and on every hash change.
 */
export function useHash(pathname?: string) {
  const [hash, setHash] = useState("");
  useEffect(() => {
    const read = () => setHash(window.location.hash);
    read();
    const t = setTimeout(read, 50);
    window.addEventListener("hashchange", read);
    window.addEventListener("popstate", read);
    return () => {
      clearTimeout(t);
      window.removeEventListener("hashchange", read);
      window.removeEventListener("popstate", read);
    };
  }, [pathname]);
  return hash;
}

/** The adapter of the tool on screen, for the practice bar's hints. */
let screenAdapter: ToolAdapter | null = null;
export const getScreenAdapter = () => screenAdapter;

/**
 * For a tool page. Registers the tool's adapter while the page is open and,
 * when the address changes to another question of the same tool, calls
 * `onQuestion` so the tool can show it without reloading the page.
 *
 * Returns whether a practice question is on screen and whether it is a mock
 * exam (no feedback until the end).
 */
export function usePractice(adapter: ToolAdapter, onQuestion?: (type: string, level: number, seed: number) => void) {
  const r = useRun();
  const hash = useHash();
  const latest = useRef(onQuestion);
  useEffect(() => {
    latest.current = onQuestion;
  });
  useEffect(() => {
    screenAdapter = adapter;
    listeners.forEach((fn) => fn());
    const onHash = () => {
      const p = practiceParams();
      if (p) latest.current?.(p.type, p.level, p.seed);
    };
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener("hashchange", onHash);
      if (screenAdapter === adapter) screenAdapter = null;
    };
  }, [adapter]);
  const item = r && !r.finished ? r.items[r.index] : undefined;
  const active = !!item && item.tool === adapter.tool && new URLSearchParams(hash.slice(1)).has("practice");
  return { active, exam: active && r?.kind === "exam" };
}

/**
 * Called by a tool when the child presses «بررسی» on a practice question.
 * Grades with the adapter, records the answer, and returns the tag. Does
 * nothing (returns null) when no practice question of this tool is on
 * screen, or this one is already answered.
 */
export async function practiceCheck(adapter: ToolAdapter, response: unknown): Promise<string | null> {
  const r = getRun();
  const item = current();
  if (!r || !item || item.tool !== adapter.tool || r.results[r.index] || !practiceParams()) return null;
  const now = Date.now();
  const key = skillKey(item.tool, item.type);
  const [skills, reviews] = await Promise.all([db.skills(r.childId), item.reviewOf ? db.reviews(r.childId) : Promise.resolve([])]);
  const res = answer({
    adapter,
    item,
    response: JSON.parse(JSON.stringify(response ?? null)),
    hintsUsed: r.hints,
    durationMs: now - r.itemStartedAt,
    childId: r.childId,
    id: newId(),
    now,
    skill: skills.find((s) => s.skill === key),
    review: reviews.find((x) => x.attemptId === item.reviewOf),
  });
  await db.putAttempt(res.attempt);
  await db.putSkill(res.skill);
  if (res.putReview) await db.putReview(res.putReview);
  if (res.doneReview) await db.deleteReview(res.doneReview);
  const latest = getRun();
  if (latest?.id === r.id) {
    const results = [...latest.results];
    results[latest.index] = res.attempt;
    save({ ...latest, results, wrongStreak: res.attempt.tag === "right" ? 0 : latest.wrongStreak + 1 });
  }
  return res.attempt.tag;
}

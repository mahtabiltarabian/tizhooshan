"use client";

// Starting and moving through a placement test or a staged exam on the
// device (planning is in exam.ts, the run in bridge.ts).

import { getRun, startRun, updateRun, type Run } from "./bridge";
import { SKILLS, toolArea } from "./catalog";
import { db } from "./db";
import {
  ANALYTIC_STAGES,
  byArea,
  examHistoryKey,
  nextLevels,
  placementKey,
  placementStates,
  planPlacementRound,
  planSpeedStage,
  planStage,
  routeAfter,
  secondsFor,
  startLevels,
  type AreaLevels,
  type ExamMode,
  type ExamRecord,
  type PlacementRecord,
} from "./exam";
import { openItem } from "./PracticeBar";
import type { SessionItem } from "./session";
import type { SkillKey, SkillState } from "./types";

const seed = () => Math.floor(Math.random() * 1e9);
const statesOf = async (childId: string) => new Map<SkillKey, SkillState>((await db.skills(childId)).map((s) => [s.skill, s]));
const usedOf = (r: Pick<Run, "items">) => new Set(r.items.map((i) => `${i.tool}:${i.type}`));

/** Seconds for a real-exam stage: the test's time per question. */
const stageEnd = (items: readonly SessionItem[]) => Date.now() + items.reduce((s, it) => s + secondsFor(it), 0) * 1000;

/** The current stage's items and whether each was answered right. */
export function stageResults(r: Run) {
  const from = r.exam?.stageStart ?? 0;
  const items = r.items.slice(from);
  const results = r.results.slice(from);
  return { items, results, rights: results.map((a) => a?.tag === "right") };
}

export function startPlacement(childId: string, push: (href: string) => void) {
  const levels = startLevels();
  const items = planPlacementRound({ catalog: SKILLS, areaOf: toolArea, levels, seed: seed() });
  const r = startRun({ childId, kind: "placement", items, exam: { kind: "placement", stage: 0, stageStart: 0, starts: [0], between: false, levels } });
  openItem(r, 0, push);
}

export async function startExam(childId: string, mode: ExamMode, push: (href: string) => void) {
  const items = planStage({ catalog: SKILLS, areaOf: toolArea, states: await statesOf(childId), route: "same", seed: seed() });
  const r = startRun({
    childId,
    kind: "exam",
    items,
    endsAt: mode === "real" ? stageEnd(items) : undefined,
    exam: { kind: mode, stage: 0, stageStart: 0, starts: [0], between: false },
  });
  openItem(r, 0, push);
}

/** From the stage screen: plan the next stage on what the child just showed, and open its first question. */
export async function nextStage(push: (href: string) => void) {
  const r = getRun();
  if (!r?.exam?.between) return;
  const { items: done, rights } = stageResults(r);
  const stage = r.exam.stage + 1;
  let items: SessionItem[];
  let levels: AreaLevels | undefined = r.exam.levels;
  if (r.exam.kind === "placement") {
    levels = nextLevels(levels ?? startLevels(), done.map((it, i) => ({ area: toolArea(it.tool), right: rights[i] })));
    items = planPlacementRound({ catalog: SKILLS, areaOf: toolArea, levels, seed: seed(), used: usedOf(r) });
  } else {
    const route = routeAfter(rights.filter(Boolean).length, done.length);
    const states = await statesOf(r.childId);
    items =
      stage < ANALYTIC_STAGES
        ? planStage({ catalog: SKILLS, areaOf: toolArea, states, route, seed: seed(), used: usedOf(r) })
        : planSpeedStage({ catalog: SKILLS, states, route, seed: seed() });
  }
  const stageStart = r.items.length;
  const next: Partial<Run> = {
    items: [...r.items, ...items],
    results: [...r.results, ...items.map(() => null)],
    exam: { ...r.exam, stage, stageStart, starts: [...r.exam.starts, stageStart], between: false, levels },
    endsAt: r.exam.kind === "real" ? stageEnd(items) : r.endsAt,
    wrongStreak: 0,
  };
  updateRun(next);
  openItem({ ...r, ...next } as Run, stageStart, push);
}

/**
 * After the last placement round: the levels it ends on, kept for the
 * home page, and the starting ability of every skill not practiced yet.
 * Safe to call twice.
 */
export async function finishPlacement(r: Run): Promise<AreaLevels> {
  const { items, rights } = stageResults(r);
  const levels = nextLevels(r.exam?.levels ?? startLevels(), items.map((it, i) => ({ area: toolArea(it.tool), right: rights[i] })));
  const record: PlacementRecord & { run: string } = { at: r.finishedAt ?? Date.now(), levels, run: r.id };
  const old = await db.getMeta<PlacementRecord & { run?: string }>(placementKey(r.childId));
  if (old?.run === r.id) return old.levels;
  await db.setMeta(placementKey(r.childId), record);
  const states = await statesOf(r.childId);
  for (const s of placementStates({ catalog: SKILLS, areaOf: toolArea, levels, states, childId: r.childId, now: Date.now() })) await db.putSkill(s);
  return levels;
}

/** Stage by stage: right answers, questions and the most common level. */
export function stagesOf(r: Run) {
  const starts = r.exam?.starts ?? [0];
  return starts.map((from, k) => {
    const to = starts[k + 1] ?? r.items.length;
    const items = r.items.slice(from, to);
    const levels = items.map((i) => i.level).sort((a, b) => a - b);
    return { right: r.results.slice(from, to).filter((a) => a?.tag === "right").length, total: items.length, level: levels[Math.floor(levels.length / 2)] ?? 1 };
  });
}

/** Keeps the finished exam for the progress chart (once per run). Returns every exam so far, oldest first. */
export async function saveExam(r: Run): Promise<ExamRecord[]> {
  const key = examHistoryKey(r.childId);
  const list = (await db.getMeta<ExamRecord[]>(key)) ?? [];
  if (list.some((e) => e.id === r.id)) return list;
  const answered = r.results.filter((a) => a !== null);
  const areas = Object.fromEntries(byArea(r.items, r.results.map((a) => a?.tag === "right"), toolArea));
  const record: ExamRecord = {
    id: r.id,
    at: r.finishedAt ?? Date.now(),
    mode: r.exam?.kind === "learn" ? "learn" : "real",
    right: answered.filter((a) => a!.tag === "right").length,
    wrong: answered.filter((a) => a!.tag !== "right").length,
    total: r.items.length,
    minutes: Math.max(1, Math.round(((r.finishedAt ?? Date.now()) - r.startedAt) / 60_000)),
    areas,
    stages: stagesOf(r),
  };
  const next = [...list, record].slice(-20);
  await db.setMeta(key, next);
  return next;
}

// The interactive exam: a placement test first, then an exam in stages.
// Pure planning code; the run itself lives in bridge.ts.
//
// Placement (تعیین سطح): three short rounds, one question per area each.
// Every area starts at level 2 and moves a level up after a right answer,
// down after a wrong one. The level an area ends on becomes the starting
// ability of every skill in that area the child has not practiced yet, so
// practice and the exam start at the right height.
//
// Exam: like the test's two booklets (sample papers 1404–1406: booklet 1,
// analytical aptitude and intelligence, about 75 seconds a question;
// booklet 2, speed and accuracy, short questions in blocks of one kind).
// Three analytical stages (warm-up, main, challenge) mix the areas; a
// stage's level follows the stage before: most right, a step harder; few
// right, a step easier; otherwise the comfortable level (about 75% right).
// A fourth stage is speed and accuracy (tool 21).
//
// Two kinds, chosen by the parent: "learn" gives kind feedback and the
// right answer after every question; "real" gives none until the stage
// ends, has a countdown per stage, lets a question be left blank, and
// scores like the test: +3 right, −1 wrong, 0 blank.

import { challengeLevel, easierLevel, pickLevel } from "./adaptive";
import type { SessionItem, SkillInfo } from "./session";
import type { SkillKey, SkillState } from "./types";
import { mulberry32, randInt, shuffle, type Rng } from "@/generators/random";
import type { Area } from "@/tools/registry";

export type ExamMode = "learn" | "real";
export type Route = "easier" | "same" | "harder";

/** The areas the exam measures (speed has its own tool and is practiced, not examined). */
export const EXAM_AREAS: Area[] = ["visual", "computational", "logical"];

export const PLACEMENT_ROUNDS = 3;
export const PLACEMENT_START = 2;

export const EXAM_STAGES = [
  { title: "گرم کردن", note: "سؤال‌هایی در اندازه خودت، برای شروع آرام." },
  { title: "مرحله اصلی", note: "سطح این مرحله از نتیجه مرحله قبل می‌آید." },
  { title: "چالش", note: "چند سؤال سخت‌تر؛ هر کدام را حل کنی، یک قدم جلو رفته‌ای." },
  { title: "سرعت و دقت", note: "مثل دفترچه دوم آزمون: سؤال‌های کوتاه، با دقت و بی‌عجله." },
] as const;
export const ANALYTIC_STAGES = 3;
export const SPEED_TOOL = "speed";
/** The speed stage: one question of each kind of tool 21. */
export const SPEED_TYPES = ["find", "differ", "count", "mental"] as const;

/** Questions of each area in one stage: 8 a stage, like the test's mix of intelligence and maths. */
export const STAGE_MIX: Partial<Record<Area, number>> = { visual: 3, computational: 3, logical: 2 };
export const STAGE_SIZE = EXAM_AREAS.reduce((s, a) => s + (STAGE_MIX[a] ?? 0), 0);

/**
 * Real-exam practice: seconds for a question, as in the test (75 s in the
 * analytical booklet). Tool 21's questions are bigger than one test item
 * (a grid of shapes, a card of six sums), so they get more.
 */
export function secondsFor(item: Pick<SessionItem, "tool" | "type">): number {
  if (item.tool !== SPEED_TOOL) return 75;
  return item.type === "mental" ? 150 : 45;
}

/** Test scoring: +3 right, −1 wrong, 0 blank; and as a share of the best score. */
export function testScore(right: number, wrong: number, total: number) {
  const raw = 3 * right - wrong;
  return { raw, max: 3 * total, percent: total ? Math.round((100 * Math.max(0, raw)) / (3 * total)) : 0 };
}

const freshSeed = (rng: Rng) => randInt(rng, 1_000_000);
const clampLevel = (level: number, levels: readonly number[]) => {
  const sorted = [...levels].sort((a, b) => a - b);
  return sorted.reduce((best, l) => (Math.abs(l - level) < Math.abs(best - level) ? l : best), sorted[0]);
};

/**
 * Picks `n` skills of one area, different tools first, avoiding skills
 * already asked in this sitting while others are left.
 */
function pickSkills(rng: Rng, pool: readonly SkillInfo[], n: number, used: ReadonlySet<SkillKey>): SkillInfo[] {
  const fresh = pool.filter((s) => !used.has(s.key));
  const source = shuffle(rng, fresh.length >= n ? fresh : pool);
  const out: SkillInfo[] = [];
  const tools = new Set<string>();
  for (const s of source)
    if (out.length < n && !tools.has(s.tool)) {
      out.push(s);
      tools.add(s.tool);
    }
  for (const s of source) if (out.length < n && !out.includes(s)) out.push(s);
  return out;
}

// ---------------------------------------------------------------------------
// Placement

export type AreaLevels = Partial<Record<Area, number>>;

export function startLevels(): AreaLevels {
  return Object.fromEntries(EXAM_AREAS.map((a) => [a, PLACEMENT_START]));
}

/** One placement round: a question from each area at that area's current level. */
export function planPlacementRound(opts: {
  catalog: readonly SkillInfo[];
  areaOf: (tool: string) => Area;
  levels: AreaLevels;
  seed: number;
  used?: ReadonlySet<SkillKey>;
}): SessionItem[] {
  const rng = mulberry32(opts.seed);
  return EXAM_AREAS.flatMap((area) => {
    const pool = opts.catalog.filter((s) => opts.areaOf(s.tool) === area);
    const [s] = pickSkills(rng, pool, 1, opts.used ?? new Set());
    if (!s) return [];
    return [{ tool: s.tool, type: s.type, level: clampLevel(opts.levels[area] ?? PLACEMENT_START, s.levels), seed: freshSeed(rng), mode: "placement" as const }];
  });
}

/** Up a level after a right answer, down after a wrong one (1 … 3). */
export function nextLevels(levels: AreaLevels, results: readonly { area: Area; right: boolean }[]): AreaLevels {
  const out = { ...levels };
  for (const r of results) out[r.area] = Math.max(1, Math.min(3, (out[r.area] ?? PLACEMENT_START) + (r.right ? 1 : -1)));
  return out;
}

/** θ at which `level` is about 75% right: the level the planner then picks. */
export const placementTheta = (level: number) => level - 2 + Math.log(3);

/**
 * Starting abilities from a placement: every skill of a placed area that
 * has no answers yet. Skills already practiced keep what the child showed.
 */
export function placementStates(opts: {
  catalog: readonly SkillInfo[];
  areaOf: (tool: string) => Area;
  levels: AreaLevels;
  states: ReadonlyMap<SkillKey, SkillState>;
  childId: string;
  now: number;
}): SkillState[] {
  return opts.catalog.flatMap((s) => {
    const level = opts.levels[opts.areaOf(s.tool)];
    const st = opts.states.get(s.key);
    if (level === undefined || (st && st.n > 0)) return [];
    return [{ childId: opts.childId, skill: s.key, theta: placementTheta(level), n: 0, updatedAt: opts.now }];
  });
}

// ---------------------------------------------------------------------------
// Exam stages

/** How the next stage's level follows from this one's right answers. */
export function routeAfter(right: number, total: number): Route {
  if (!total) return "same";
  const share = right / total;
  return share >= 0.7 ? "harder" : share < 0.4 ? "easier" : "same";
}

export function stageLevel(theta: number, levels: readonly number[], route: Route): number {
  if (route === "harder") return challengeLevel(theta, levels);
  const comfortable = pickLevel(theta, levels);
  return route === "easier" ? easierLevel(comfortable, levels) : comfortable;
}

/** One stage: the areas mixed as STAGE_MIX says, easy-to-hard inside the stage. */
export function planStage(opts: {
  catalog: readonly SkillInfo[];
  areaOf: (tool: string) => Area;
  states: ReadonlyMap<SkillKey, SkillState>;
  route: Route;
  seed: number;
  used?: ReadonlySet<SkillKey>;
}): SessionItem[] {
  const rng = mulberry32(opts.seed);
  const items = EXAM_AREAS.flatMap((area) => {
    const pool = opts.catalog.filter((s) => opts.areaOf(s.tool) === area);
    return pickSkills(rng, pool, STAGE_MIX[area] ?? 0, opts.used ?? new Set()).map((s) => ({
      tool: s.tool,
      type: s.type,
      level: stageLevel(opts.states.get(s.key)?.theta ?? 0, s.levels, opts.route),
      seed: freshSeed(rng),
      mode: "exam" as const,
    }));
  });
  // Areas take turns, and inside the stage the easier questions come first.
  const mixed = shuffle(rng, items);
  return mixed.sort((a, b) => a.level - b.level);
}

/** The speed stage: tool 21's four kinds at the comfortable level (or a step off, by route). */
export function planSpeedStage(opts: { catalog: readonly SkillInfo[]; states: ReadonlyMap<SkillKey, SkillState>; route: Route; seed: number }): SessionItem[] {
  const rng = mulberry32(opts.seed);
  return SPEED_TYPES.flatMap((type) => {
    const s = opts.catalog.find((x) => x.tool === SPEED_TOOL && x.type === type);
    if (!s) return [];
    return [{ tool: s.tool, type: s.type, level: stageLevel(opts.states.get(s.key)?.theta ?? 0, s.levels, opts.route), seed: freshSeed(rng), mode: "exam" as const }];
  });
}

/** Right answers and questions of each area, for the stage screen and the report card. */
export function byArea(items: readonly SessionItem[], rights: readonly boolean[], areaOf: (tool: string) => Area) {
  const out = new Map<Area, { right: number; total: number }>();
  items.forEach((it, i) => {
    const a = areaOf(it.tool);
    const cur = out.get(a) ?? { right: 0, total: 0 };
    out.set(a, { right: cur.right + (rights[i] ? 1 : 0), total: cur.total + 1 });
  });
  return out;
}

/** A finished exam, kept on the device for the progress chart. */
export interface ExamRecord {
  id: string;
  at: number;
  mode: ExamMode;
  right: number;
  /** Answered but not right. */
  wrong: number;
  total: number;
  minutes: number;
  areas: Partial<Record<Area, { right: number; total: number }>>;
  stages: { right: number; total: number; level: number }[];
}

export const examHistoryKey = (childId: string) => `exams:${childId}`;
export const placementKey = (childId: string) => `placement:${childId}`;

export interface PlacementRecord {
  at: number;
  levels: AreaLevels;
}

/**
 * Kind words for a stage (or, with `final`, the whole exam), from how it
 * went. Never discouraging. `answered` defaults to `total`.
 */
export function cheer(right: number, total: number, opts: { final?: boolean; answered?: number } = {}): string {
  const answered = opts.answered ?? total;
  const after = opts.final ? "" : " مرحله بعد کمی آسان‌تر است.";
  if (!total) return "آماده‌ای؟ شروع کنیم!";
  if (!answered) return opts.final ? "این بار به سؤالی جواب ندادی؛ اشکالی ندارد. جواب درست همه سؤال‌ها پایین آمده؛ هر وقت آماده بودی دوباره امتحان کن." : `به سؤال‌های این مرحله جواب ندادی؛ اشکالی ندارد.${after}`;
  const share = right / total;
  if (share === 1) return "همه را درست جواب دادی! فوق‌العاده بود.";
  if (share >= 0.7) return "عالی پیش رفتی! بیشتر سؤال‌ها را درست جواب دادی.";
  if (share >= 0.4) return "خوب بود! نصف راه را محکم رفتی؛ با جواب‌های درست پایین، بقیه را هم یاد می‌گیری.";
  if (right > 0) return `${right === 1 ? "یک" : "چند"} سؤال را درست جواب دادی و این یعنی شروع خوب.${opts.final ? " با جواب‌های درست پایین، بقیه را هم یاد می‌گیری." : ` این مرحله سخت بود؛${after}`}`;
  return `${opts.final ? "این آزمون سخت بود" : "این مرحله سخت بود"} و اشکالی ندارد؛ هر آزمون یعنی یک قدم یادگرفتن.${after || " جواب‌های درست پایین آمده‌اند."}`;
}

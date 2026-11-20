// Tool 21: speed and accuracy (هوش سرعتی). A grid of small shapes; find
// every copy of a target, count them, or find the one that differs. The
// look-alikes are what the exam uses: at level 2 the same shape turned, at
// level 3 also its mirror image. Time is measured, never pressed.

import { mulberry32, randInt, shuffle, type Rng } from "./random";

export type Level = 1 | 2 | 3;
export type SpeedQuestionType = "find" | "count" | "differ";

/**
 * A shape on the grid. Shapes 0 … 6 are symmetric (circle, square,
 * triangle, star, plus, diamond, ring), so `rot` and `flip` do not change
 * them. Shape 7 is a flag, different under every turn and mirror.
 */
export interface Glyph {
  shape: number;
  /** Quarter turns clockwise, 0 … 3. */
  rot: number;
  /** Mirrored left to right. */
  flip: boolean;
}

export const SIMPLE_SHAPES = 7;
export const FLAG = 7;

export const sameGlyph = (a: Glyph, b: Glyph) => a.shape === b.shape && (a.shape !== FLAG || (a.rot === b.rot && a.flip === b.flip));

/** How a glyph relates to the target: the same, its mirror, turned, or another shape. */
export function relation(g: Glyph, target: Glyph): "same" | "mirror" | "rotated" | "other" {
  if (sameGlyph(g, target)) return "same";
  if (g.shape !== target.shape) return "other";
  return g.flip !== target.flip ? "mirror" : "rotated";
}

export interface SpeedQuestion {
  type: SpeedQuestionType;
  level: Level;
  seed: number;
  cols: number;
  rows: number;
  grid: Glyph[];
  target: Glyph;
  /** find: the indices of every copy; count: their number; differ: the odd one's index. */
  answer: number[] | number;
}

const SIZE: Record<Level, [number, number]> = { 1: [5, 4], 2: [6, 5], 3: [7, 6] };
const TARGETS: Record<Level, [number, number]> = { 1: [4, 6], 2: [5, 8], 3: [6, 9] };

const between = (rng: Rng, [lo, hi]: [number, number]) => lo + randInt(rng, hi - lo + 1);

function flagVariants(level: Level): Glyph[] {
  const out: Glyph[] = [];
  for (const flip of level === 3 ? [false, true] : [false]) for (let rot = 0; rot < 4; rot++) out.push({ shape: FLAG, rot, flip });
  return out;
}

/** A target and look-alikes for the level. */
function cast(rng: Rng, level: Level): { target: Glyph; others: Glyph[] } {
  if (level === 1) {
    const shapes = shuffle(rng, Array.from({ length: SIMPLE_SHAPES }, (_, i) => i));
    return { target: { shape: shapes[0], rot: 0, flip: false }, others: shapes.slice(1, 5).map((shape) => ({ shape, rot: 0, flip: false })) };
  }
  const variants = shuffle(rng, flagVariants(level));
  const target = variants[0];
  // Level 3 always includes the target's mirror image: that is the trap to learn.
  const others = variants.slice(1);
  if (level === 3) {
    const mirror = others.findIndex((g) => g.flip !== target.flip && g.rot === target.rot);
    others.unshift(...others.splice(mirror, 1));
  }
  return { target, others: others.slice(0, level === 2 ? 3 : 5) };
}

export function makeSpeedQuestion(type: SpeedQuestionType, level: Level, seed: number): SpeedQuestion {
  const rng = mulberry32(seed * 31 + level * 7 + type.length * 101);
  const [cols, rows] = SIZE[level];
  const n = cols * rows;
  const { target, others } = cast(rng, level);

  if (type === "differ") {
    // Everything is the target except one look-alike.
    const odd = level === 1 ? others[0] : level === 2 ? others[randInt(rng, others.length)] : others[0];
    const at = randInt(rng, n);
    const grid = Array.from({ length: n }, (_, i) => (i === at ? odd : target));
    return { type, level, seed, cols, rows, grid, target, answer: at };
  }

  const k = between(rng, TARGETS[level]);
  // At least two of the closest look-alike, so the trap is really there.
  const fill: Glyph[] = [...Array(k).fill(target), others[0], others[0]];
  while (fill.length < n) fill.push(others[randInt(rng, others.length)]);
  const grid = shuffle(rng, fill);
  const where = grid.flatMap((g, i) => (sameGlyph(g, target) ? [i] : []));
  return { type, level, seed, cols, rows, grid, target, answer: type === "find" ? where : where.length };
}

export type SpeedTag = "right" | "mirror" | "rotated" | "missed" | "careless" | "offByOne" | "other";

/** Grades taps (find), a number (count) or one tap (differ). */
export function speedMistake(q: SpeedQuestion, response: unknown): SpeedTag {
  if (q.type === "find") {
    if (!Array.isArray(response) || !response.every((x) => Number.isInteger(x))) return "other";
    const tapped = new Set(response as number[]);
    const want = new Set(q.answer as number[]);
    const extra = [...tapped].filter((i) => !want.has(i) && i >= 0 && i < q.grid.length);
    const missed = [...want].filter((i) => !tapped.has(i));
    if (!extra.length && !missed.length) return "right";
    const kinds = extra.map((i) => relation(q.grid[i], q.target));
    if (kinds.includes("mirror")) return "mirror";
    if (kinds.includes("rotated")) return "rotated";
    if (extra.length) return "careless";
    return "missed";
  }
  if (q.type === "count") {
    if (typeof response !== "number") return "other";
    return countSlips(q).find(([, v]) => v === response)?.[0] ?? "other";
  }
  if (typeof response !== "number") return "other";
  return response === q.answer ? "right" : "other";
}

/** Counts a child might give, in the order they are checked. */
export function countSlips(q: SpeedQuestion): [SpeedTag, number][] {
  const answer = q.answer as number;
  const kinds = q.grid.map((g) => relation(g, q.target));
  const mirrors = kinds.filter((k) => k === "mirror").length;
  const turned = kinds.filter((k) => k === "rotated").length;
  const out: [SpeedTag, number][] = [["right", answer]];
  if (mirrors) out.push(["mirror", answer + mirrors], ["mirror", answer + mirrors + turned]);
  if (turned) out.push(["rotated", answer + turned]);
  out.push(["offByOne", answer - 1], ["offByOne", answer + 1]);
  // A slip value equal to an earlier one keeps the earlier tag.
  return out.filter(([, v], i) => out.findIndex(([, w]) => w === v) === i);
}

/** Copies of the target in one row (the first step of a hint). */
export const inRow = (q: SpeedQuestion, row: number) => q.grid.slice(row * q.cols, (row + 1) * q.cols).filter((g) => sameGlyph(g, q.target)).length;

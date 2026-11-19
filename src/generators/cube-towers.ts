// Cube towers (tool 6): stacks of unit cubes on a grid board. Pure TypeScript.
//
// Coordinates match the cube-nets model and the 3D camera: x to the right,
// y away from the viewer (row y = 0 is the front row), z up. The camera and
// the isometric pictures look from the front-right corner (+x, -y, +z).
//   front view  = seen from -y (the "روبرو" side); columns left to right = x
//   side view   = seen from +x (the right side); columns left to right = y
//   top view    = seen from above; the front row at the bottom of the picture

import { mulberry32, randInt, shuffle, type Rng } from "./random";

export type Level = 1 | 2 | 3;

/** Column heights, indexed [y][x]. Every cube stands on the board or on another cube. */
export interface Tower {
  w: number;
  d: number;
  h: number[][];
}

export const emptyTower = (w: number, d: number): Tower => ({ w, d, h: Array.from({ length: d }, () => Array(w).fill(0)) });

export const heightAt = (t: Tower, x: number, y: number) => (x >= 0 && y >= 0 && x < t.w && y < t.d ? t.h[y][x] : 0);

export const countCubes = (t: Tower) => t.h.flat().reduce((a, b) => a + b, 0);

export const maxHeight = (t: Tower) => Math.max(0, ...t.h.flat());

export const frontView = (t: Tower): number[] => Array.from({ length: t.w }, (_, x) => Math.max(...t.h.map((row) => row[x])));

export const sideView = (t: Tower): number[] => t.h.map((row) => Math.max(...row));

export const topView = (t: Tower): boolean[][] => t.h.map((row) => row.map((v) => v > 0));

/** Cubes per layer, bottom first. */
export const layerCounts = (t: Tower): number[] =>
  Array.from({ length: maxHeight(t) }, (_, z) => t.h.flat().filter((v) => v > z).length);

/**
 * A cube is hidden when it cannot be seen from any side or from above: the
 * cube above it exists and all four neighbouring columns reach its level.
 * Such cubes are only known to exist because cubes cannot float.
 */
export function isHidden(t: Tower, x: number, y: number, z: number): boolean {
  if (z >= t.h[y][x] - 1) return false;
  return [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].every(([dx, dy]) => heightAt(t, x + dx, y + dy) > z);
}

export const hiddenCount = (t: Tower) => {
  let n = 0;
  for (let y = 0; y < t.d; y++) for (let x = 0; x < t.w; x++) for (let z = 0; z < t.h[y][x]; z++) if (isHidden(t, x, y, z)) n++;
  return n;
};

const footprintConnected = (t: Tower) => {
  const cells: [number, number][] = [];
  t.h.forEach((row, y) => row.forEach((v, x) => v > 0 && cells.push([x, y])));
  if (!cells.length) return false;
  const seen = new Set([cells[0].join(",")]);
  const queue = [cells[0]];
  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const k = `${x + dx},${y + dy}`;
      if (heightAt(t, x + dx, y + dy) > 0 && !seen.has(k)) {
        seen.add(k);
        queue.push([x + dx, y + dy]);
      }
    }
  }
  return seen.size === cells.length;
};

interface TowerSpec {
  w: number;
  d: number;
  maxH: number;
  cubes: [number, number];
  hidden: "none" | "some";
}

/** A connected tower with a cube count in range; "some" asks for at least one hidden cube. */
export function randomTower(rng: Rng, spec: TowerSpec): Tower {
  for (let attempt = 0; attempt < 500; attempt++) {
    const t = emptyTower(spec.w, spec.d);
    const target = spec.cubes[0] + randInt(rng, spec.cubes[1] - spec.cubes[0] + 1);
    t.h[randInt(rng, spec.d)][randInt(rng, spec.w)] = 1;
    let n = 1;
    let guard = 0;
    while (n < target && guard++ < 400) {
      const x = randInt(rng, spec.w);
      const y = randInt(rng, spec.d);
      const v = t.h[y][x];
      const touches = v > 0 || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => heightAt(t, x + dx, y + dy) > 0);
      // Grow sideways more often than up, so towers look like buildings, not poles.
      if (!touches || v >= spec.maxH || (v > 0 && rng() < 0.45)) continue;
      t.h[y][x] = v + 1;
      n++;
    }
    if (n !== target || !footprintConnected(t)) continue;
    const hidden = hiddenCount(t);
    if (spec.hidden === "none" && hidden > 0) continue;
    if (spec.hidden === "some" && hidden === 0) continue;
    return t;
  }
  throw new Error("could not build a tower for this spec");
}

// ---------------------------------------------------------------------------
// Painted big cube cut into n×n×n small cubes.

/** Small cubes with exactly k painted faces, when an n×n×n cube is painted outside and cut. */
export function paintedCount(n: number, k: number): number {
  if (n === 1) return k === 6 ? 1 : 0;
  const m = n - 2;
  return [m ** 3, 6 * m ** 2, 12 * m, 8][k] ?? 0;
}

/** Number of painted faces of the small cube at (x, y, z) in an n×n×n cube. */
export const paintedFaces = (n: number, x: number, y: number, z: number) =>
  [x, y, z].reduce((a, c) => a + (c === 0 ? 1 : 0) + (c === n - 1 ? 1 : 0), 0);

// ---------------------------------------------------------------------------
// Building a tower from its views: every tower that matches, fewest and most cubes.

export interface Views {
  top?: boolean[][];
  front: number[];
  side: number[];
}

export function matchesViews(t: Tower, v: Views): boolean {
  const f = frontView(t);
  const s = sideView(t);
  if (f.some((h, i) => h !== v.front[i]) || s.some((h, i) => h !== v.side[i])) return false;
  if (v.top) return t.h.every((row, y) => row.every((h, x) => h > 0 === v.top![y][x]));
  return true;
}

/** Fewest and most cubes of any tower on a w×d board with these views (exhaustive; boards up to 3×3). */
export function cubeRange(w: number, d: number, v: Views): { min: number; max: number; solutions: number } {
  const cells: { x: number; y: number; lo: number; hi: number }[] = [];
  for (let y = 0; y < d; y++)
    for (let x = 0; x < w; x++) {
      const hi = Math.min(v.front[x], v.side[y]);
      const lo = v.top ? (v.top[y][x] ? 1 : 0) : 0;
      cells.push({ x, y, lo, hi: v.top && !v.top[y][x] ? 0 : hi });
    }
  let min = Infinity;
  let max = -Infinity;
  let solutions = 0;
  const t = emptyTower(w, d);
  const walk = (i: number, sum: number) => {
    if (i === cells.length) {
      if (matchesViews(t, v)) {
        solutions++;
        min = Math.min(min, sum);
        max = Math.max(max, sum);
      }
      return;
    }
    const c = cells[i];
    for (let h = c.lo; h <= c.hi; h++) {
      t.h[c.y][c.x] = h;
      walk(i + 1, sum + h);
    }
    t.h[c.y][c.x] = 0;
  };
  walk(0, 0);
  return { min, max, solutions };
}

// ---------------------------------------------------------------------------
// Questions.

export type TowerQuestionType = "count" | "top" | "front" | "side" | "build" | "complete" | "paint";

export type NumberMistake = "visibleOnly" | "offByOne" | "counted" | "otherK";
export type ViewMistake = "mirrored" | "otherView" | "changed";

export type ViewPicture = { kind: "top"; cells: boolean[][] } | { kind: "cols"; heights: number[] };

interface Base {
  seed: number;
  level: Level;
}

export type TowerQuestion =
  | (Base & { type: "count"; tower: Tower; hidden: number; options: number[]; mistakes: (NumberMistake | null)[]; answer: number })
  | (Base & {
      type: "top" | "front" | "side";
      tower: Tower;
      options: ViewPicture[];
      mistakes: (ViewMistake | null)[];
      answer: number;
    })
  | (Base & { type: "build"; tower: Tower; views: Views; min: number; max: number; solutions: number })
  | (Base & { type: "complete"; tower: Tower; n: number; options: number[]; mistakes: (NumberMistake | null)[]; answer: number })
  | (Base & { type: "paint"; n: number; k: number; options: number[]; mistakes: (NumberMistake | null)[]; answer: number });

const SPECS: Record<Level, TowerSpec> = {
  1: { w: 3, d: 3, maxH: 2, cubes: [4, 8], hidden: "none" },
  2: { w: 4, d: 4, maxH: 3, cubes: [8, 15], hidden: "some" },
  3: { w: 4, d: 4, maxH: 4, cubes: [12, 20], hidden: "some" },
};

/** Four different positive numbers: the answer, typical mistakes, then neighbours. */
function numberOptions(rng: Rng, answer: number, special: { value: number; mistake: NumberMistake }[]) {
  const values: number[] = [answer];
  const mistakes: (NumberMistake | null)[] = [null];
  const add = (v: number, m: NumberMistake) => {
    if (v >= 0 && values.length < 4 && !values.includes(v)) {
      values.push(v);
      mistakes.push(m);
    }
  };
  for (const s of special) add(s.value, s.mistake);
  for (const d of shuffle(rng, [1, -1, 2, -2, 3, -3, 4])) add(answer + d, "offByOne");
  const order = shuffle(rng, [0, 1, 2, 3]);
  return { options: order.map((i) => values[i]), mistakes: order.map((i) => mistakes[i]), answer: order.indexOf(0) };
}

const sameCols = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
const sameTop = (a: boolean[][], b: boolean[][]) => a.length === b.length && a.every((r, y) => r.length === b[y].length && r.every((v, x) => v === b[y][x]));
const samePicture = (a: ViewPicture, b: ViewPicture) =>
  a.kind === b.kind && (a.kind === "top" ? sameTop(a.cells, (b as typeof a).cells) : sameCols(a.heights, (b as typeof a).heights));

function viewOptions(rng: Rng, type: "top" | "front" | "side", t: Tower) {
  const f = frontView(t);
  const s = sideView(t);
  const top = topView(t);
  const correct: ViewPicture = type === "top" ? { kind: "top", cells: top } : { kind: "cols", heights: type === "front" ? f : s };

  const candidates: { pic: ViewPicture; mistake: ViewMistake }[] = [];
  if (type === "top") {
    candidates.push({ pic: { kind: "top", cells: top.map((r) => [...r].reverse()) }, mistake: "mirrored" });
    candidates.push({ pic: { kind: "top", cells: [...top].reverse() }, mistake: "mirrored" });
    for (let i = 0; i < 12; i++) {
      const cells = top.map((r) => [...r]);
      const y = randInt(rng, t.d);
      const x = randInt(rng, t.w);
      cells[y][x] = !cells[y][x];
      candidates.push({ pic: { kind: "top", cells }, mistake: "changed" });
    }
  } else {
    const mine = type === "front" ? f : s;
    const other = type === "front" ? s : f;
    candidates.push({ pic: { kind: "cols", heights: [...mine].reverse() }, mistake: "mirrored" });
    if (other.length === mine.length) candidates.push({ pic: { kind: "cols", heights: other }, mistake: "otherView" });
    for (let i = 0; i < 12; i++) {
      const heights = [...mine];
      const j = randInt(rng, heights.length);
      heights[j] = Math.max(0, heights[j] + (rng() < 0.5 ? 1 : -1));
      if (heights.every((h) => h === 0)) continue;
      candidates.push({ pic: { kind: "cols", heights }, mistake: "changed" });
    }
  }

  const chosen: { pic: ViewPicture; mistake: ViewMistake | null }[] = [{ pic: correct, mistake: null }];
  for (const c of candidates) {
    if (chosen.length === 4) break;
    if (!chosen.some((o) => samePicture(o.pic, c.pic))) chosen.push(c);
  }
  const order = shuffle(rng, chosen.map((_, i) => i));
  return {
    options: order.map((i) => chosen[i].pic),
    mistakes: order.map((i) => chosen[i].mistake),
    answer: order.indexOf(0),
  };
}

export function makeTowerQuestion(type: TowerQuestionType, level: Level, seed: number): TowerQuestion {
  const rng = mulberry32(seed);

  if (type === "paint") {
    const n = level === 3 ? 4 : 3;
    const k = level === 1 ? 3 : randInt(rng, 4);
    const answer = paintedCount(n, k);
    const special = [0, 1, 2, 3].filter((j) => j !== k).map((j) => ({ value: paintedCount(n, j), mistake: "otherK" as const }));
    return { type, seed, level, n, k, ...numberOptions(rng, answer, special) };
  }

  if (type === "complete") {
    const n = level === 1 ? 2 : 3;
    const tower = randomTower(rng, { w: n, d: n, maxH: n, cubes: [Math.max(2, n ** 3 - 6), n ** 3 - 1], hidden: "none" });
    const have = countCubes(tower);
    return { type, seed, level, tower, n, ...numberOptions(rng, n ** 3 - have, [{ value: have, mistake: "counted" }]) };
  }

  if (type === "build") {
    const spec: TowerSpec = { w: 3, d: 3, maxH: level === 1 ? 2 : 3, cubes: level === 1 ? [3, 6] : [5, 10], hidden: "none" };
    const tower = randomTower(rng, spec);
    const views: Views = { front: frontView(tower), side: sideView(tower), ...(level < 3 ? { top: topView(tower) } : {}) };
    const range = cubeRange(3, 3, views);
    return { type, seed, level, tower, views, ...range };
  }

  const tower = randomTower(rng, SPECS[level]);

  if (type === "count") {
    const hidden = hiddenCount(tower);
    const total = countCubes(tower);
    const special = hidden > 0 ? [{ value: total - hidden, mistake: "visibleOnly" as const }] : [];
    return { type, seed, level, tower, hidden, ...numberOptions(rng, total, special) };
  }

  return { type, seed, level, tower, ...viewOptions(rng, type, tower) };
}

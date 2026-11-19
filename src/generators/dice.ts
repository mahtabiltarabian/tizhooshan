// Dice (tool 7): the standard die, whose opposite faces add up to 7, and
// rolling a die along a path of cells. Pure TypeScript, seeded.
//
// Directions on the board are seen from above, with the viewer at the
// bottom edge: E = right (+x), W = left, N = away from the viewer (+y),
// S = toward the viewer. The die's "front" faces the viewer (S).
// Each question keeps its answer and the usual slips, so the feedback can
// say which slip a wrong answer was.

import { CUBE_NETS, oppositePairs, type Cell } from "./cube-nets";
import { EASY_NETS } from "./cube-questions";
import { mulberry32, pick, randInt, shuffle, type Rng } from "./random";

export type Level = 1 | 2 | 3;
export type DiceQuestionType = "die" | "roll";
export type Dir = "E" | "W" | "N" | "S";
export const DIRS: Dir[] = ["E", "W", "N", "S"];
export const DIR_STEP: Record<Dir, [number, number]> = { E: [1, 0], W: [-1, 0], N: [0, 1], S: [0, -1] };
const REVERSE: Record<Dir, Dir> = { E: "W", W: "E", N: "S", S: "N" };

/** Which number is on each side of the die. */
export interface DieState {
  top: number;
  bottom: number;
  /** Away from the viewer. */
  north: number;
  /** Toward the viewer: the front. */
  south: number;
  east: number;
  west: number;
}
export type Side = keyof DieState;

/** A standard die: 1, 2 and 3 meet at the top-front-right corner. */
export const STANDARD: DieState = { top: 1, bottom: 6, south: 2, north: 5, east: 3, west: 4 };

/** Tip the die over one bottom edge, onto the next cell in `dir`. */
export function roll(d: DieState, dir: Dir): DieState {
  switch (dir) {
    case "E":
      return { ...d, top: d.west, east: d.top, bottom: d.east, west: d.bottom };
    case "W":
      return { ...d, top: d.east, west: d.top, bottom: d.west, east: d.bottom };
    case "N":
      return { ...d, top: d.south, north: d.top, bottom: d.north, south: d.bottom };
    case "S":
      return { ...d, top: d.north, south: d.top, bottom: d.south, north: d.bottom };
  }
}

export const rollAll = (d: DieState, path: readonly Dir[]) => path.reduce(roll, d);

/** Every state along the path, the start included. */
export function rollStates(d: DieState, path: readonly Dir[]): DieState[] {
  const out = [d];
  for (const dir of path) out.push(roll(out[out.length - 1], dir));
  return out;
}

const stateKey = (d: DieState) => `${d.top}${d.bottom}${d.north}${d.south}${d.east}${d.west}`;

/** The 24 ways a standard die can stand. */
export const ORIENTATIONS: DieState[] = (() => {
  const seen = new Map([[stateKey(STANDARD), STANDARD]]);
  const queue = [STANDARD];
  while (queue.length) {
    const d = queue.shift()!;
    for (const dir of DIRS) {
      const e = roll(d, dir);
      if (!seen.has(stateKey(e))) {
        seen.set(stateKey(e), e);
        queue.push(e);
      }
    }
  }
  return [...seen.values()];
})();

// ---------------------------------------------------------------------------
// Questions

export type DiceTag =
  | "right"
  // die
  | "sameFace"
  | "visible"
  | "nextNumber"
  | "sumSix"
  | "otherBlank"
  | "shown"
  // roll
  | "noRoll"
  | "wrongWay"
  | "mirror"
  | "flipNS"
  | "topBottom"
  | "frontBack"
  | "oneShort"
  | "other";

/** The three faces a picture of the die shows. */
export type ShownSide = "top" | "south" | "east";
/** The hidden side opposite each shown side. */
export const HIDDEN_OF: Record<ShownSide, Side> = { top: "bottom", south: "north", east: "west" };

/** A net with one number per cell (0 = empty cell). */
export interface DieNet {
  netIndex: number;
  cells: readonly Cell[];
  values: number[];
}

/** A net option that is not a standard die: these two numbers add to 7 but share a side. */
export interface NetFault {
  pair: [number, number];
}

interface Base {
  seed: number;
  level: Level;
}

export type DiceQuestion =
  /** Level 1: a pictured die; the number on the hidden face opposite a shown one. */
  | (Base & { type: "die"; kind: "opposite"; die: DieState; shown: ShownSide; answer: number })
  /** Level 2: a standard die's net with two empty cells; the number for the one marked «؟». */
  | (Base & { type: "die"; kind: "missing"; net: DieNet; ask: number; blank: number; answer: number })
  /** Level 3: which of four nets folds into a die whose opposite faces add up to 7? */
  | (Base & { type: "die"; kind: "validNet"; nets: DieNet[]; faults: (NetFault | null)[]; answer: number })
  /** Roll the pictured die along the path; which number ends up on `ask`? */
  | (Base & { type: "roll"; start: DieState; path: Dir[]; from: Cell; w: number; d: number; ask: "top" | "bottom" | "south"; answer: number });

const oppositeOf = (cells: readonly Cell[], i: number) => {
  const p = oppositePairs(cells).find((q) => q.includes(i))!;
  return p[0] === i ? p[1] : p[0];
};

const sharesSide = (a: Cell, b: Cell) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;

/** Numbers 1–6 on a net shape so that opposite faces add up to 7. */
function standardNet(rng: Rng, netIndex: number): DieNet {
  const cells = CUBE_NETS[netIndex];
  const values = Array(6).fill(0);
  const pairs = shuffle(rng, [[1, 6], [2, 5], [3, 4]]);
  oppositePairs(cells).forEach(([a, b], k) => {
    const [x, y] = rng() < 0.5 ? pairs[k] : [pairs[k][1], pairs[k][0]];
    values[a] = x;
    values[b] = y;
  });
  return { netIndex, cells, values };
}

/** True when every pair of opposite faces adds up to 7. */
export const isStandardNet = (net: DieNet) => oppositePairs(net.cells).every(([a, b]) => net.values[a] + net.values[b] === 7);

/** For a net that is not standard: two numbers adding to 7 that are not opposite (they always exist). */
export function netFault(net: DieNet): NetFault | null {
  if (isStandardNet(net)) return null;
  for (let i = 0; i < 6; i++)
    for (let j = i + 1; j < 6; j++)
      if (net.values[i] + net.values[j] === 7 && oppositeOf(net.cells, i) !== j) {
        // Prefer a pair that touches on the flat net: easiest to see.
        if (sharesSide(net.cells[i], net.cells[j])) return { pair: [net.values[i], net.values[j]] };
      }
  for (let i = 0; i < 6; i++)
    for (let j = i + 1; j < 6; j++) if (net.values[i] + net.values[j] === 7 && oppositeOf(net.cells, i) !== j) return { pair: [net.values[i], net.values[j]] };
  return null;
}

function rollPath(rng: Rng, level: Level): Dir[] {
  if (level === 1) {
    const dir = pick(rng, DIRS);
    return Array(1 + randInt(rng, 2)).fill(dir);
  }
  const [lo, hi] = level === 2 ? [3, 5] : [5, 8];
  for (;;) {
    const len = lo + randInt(rng, hi - lo + 1);
    const path: Dir[] = [pick(rng, DIRS)];
    while (path.length < len) {
      const last = path[path.length - 1];
      // Never straight back: rolling back undoes the step and only confuses.
      const next = rng() < 0.55 ? last : pick(rng, DIRS.filter((d) => d !== last && d !== REVERSE[last]));
      path.push(next);
    }
    if (new Set(path).size >= 2) return path;
  }
}

export function makeDiceQuestion(type: DiceQuestionType, level: Level, seed: number): DiceQuestion {
  const rng = mulberry32(seed * 31 + level * 7919 + (type === "die" ? 3 : 11));

  if (type === "roll") {
    const start = pick(rng, ORIENTATIONS);
    const path = rollPath(rng, level);
    // Lay the path on the smallest board with one free cell around it.
    let x = 0;
    let y = 0;
    const xs = [0];
    const ys = [0];
    for (const dir of path) {
      x += DIR_STEP[dir][0];
      y += DIR_STEP[dir][1];
      xs.push(x);
      ys.push(y);
    }
    const from: Cell = [1 - Math.min(...xs), 1 - Math.min(...ys)];
    const w = Math.max(3, Math.max(...xs) - Math.min(...xs) + 3);
    const d = Math.max(3, Math.max(...ys) - Math.min(...ys) + 3);
    const ask = level < 3 ? "top" : pick(rng, ["top", "top", "bottom", "south"] as const);
    return { type, seed, level, start, path, from, w, d, ask, answer: rollAll(start, path)[ask] };
  }

  if (level === 1) {
    const die = pick(rng, ORIENTATIONS);
    const shown = pick(rng, ["top", "south", "east"] as const);
    return { type, seed, level, kind: "opposite", die, shown, answer: die[HIDDEN_OF[shown]] };
  }

  if (level === 2) {
    const net = standardNet(rng, pick(rng, EASY_NETS));
    const ask = randInt(rng, 6);
    const opp = oppositeOf(net.cells, ask);
    const blank = pick(rng, [0, 1, 2, 3, 4, 5].filter((i) => i !== ask && i !== opp));
    const answer = net.values[ask];
    const values = [...net.values];
    values[ask] = 0;
    values[blank] = 0;
    return { type, seed, level, kind: "missing", net: { ...net, values }, ask, blank, answer };
  }

  // Level 3: four different net shapes, one standard.
  const shapes = shuffle(rng, CUBE_NETS.map((_, i) => i)).slice(0, 4);
  const nets = shapes.map((ni, k) => {
    const net = standardNet(rng, ni);
    if (k === 0) return net;
    // Swap two numbers from different opposite pairs: the die is no longer standard.
    const pairs = shuffle(rng, oppositePairs(net.cells));
    const a = pick(rng, pairs[0]);
    const b = pick(rng, pairs[1]);
    const values = [...net.values];
    [values[a], values[b]] = [values[b], values[a]];
    return { ...net, values };
  });
  const order = shuffle(rng, [0, 1, 2, 3]);
  const shuffled = order.map((i) => nets[i]);
  return { type: "die", seed, level, kind: "validNet", nets: shuffled, faults: shuffled.map(netFault), answer: order.indexOf(0) };
}

/** What the die looks like at the end of the path, and on the way. */
export const rollEnd = (q: Extract<DiceQuestion, { type: "roll" }>) => rollAll(q.start, q.path);

/** Wrong answers (numbers 1–6) with a known cause, in the order they are checked. */
export function diceSlips(q: DiceQuestion): [DiceTag, number][] {
  if (q.type === "roll") {
    const end = rollEnd(q);
    const swap = (m: Partial<Record<Dir, Dir>>) => q.path.map((d) => m[d] ?? d);
    // Rolling backwards comes first: after one roll it gives the same number
    // as swapping top and bottom, and "the right face comes up" is the slip.
    return [
      ["wrongWay", rollAll(q.start, swap(REVERSE))[q.ask]],
      [q.ask === "south" ? "frontBack" : "topBottom", 7 - end[q.ask]],
      ["mirror", rollAll(q.start, swap({ E: "W", W: "E" }))[q.ask]],
      ["flipNS", rollAll(q.start, swap({ N: "S", S: "N" }))[q.ask]],
      ["oneShort", rollAll(q.start, q.path.slice(0, -1))[q.ask]],
      ["noRoll", q.start[q.ask]],
    ];
  }
  switch (q.kind) {
    case "opposite": {
      const v = q.die[q.shown];
      const out: [DiceTag, number][] = [["sameFace", v]];
      for (const s of ["top", "south", "east"] as const) if (s !== q.shown) out.push(["visible", q.die[s]]);
      out.push(["nextNumber", v + 1], ["nextNumber", v - 1], ["sumSix", 6 - v]);
      return out;
    }
    case "missing": {
      const missing = [1, 2, 3, 4, 5, 6].filter((n) => !q.net.values.includes(n));
      return [
        ["otherBlank", missing.find((n) => n !== q.answer)!],
        ...q.net.values.filter((n) => n > 0).map((n): [DiceTag, number] => ["shown", n]),
      ];
    }
    case "validNet":
      return [];
  }
}

/** Which slip an answer is, if any. For "validNet" the value is the option index. */
export function diceMistake(q: DiceQuestion, v: number): DiceTag {
  if (v === q.answer) return "right";
  for (const [tag, x] of diceSlips(q)) if (x !== q.answer && x === v) return tag;
  return "other";
}

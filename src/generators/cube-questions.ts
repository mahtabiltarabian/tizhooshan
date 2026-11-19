// Question generator for tool 7 (cube nets). Pure TypeScript, seeded.
//
// Physical model: the net is printed on its top side and folds downward,
// so the root face ends up on top (+z) and the printed side faces out.
// That is the up-fold model of cube-nets.ts mirrored in z.

import { CUBE_NETS, foldNet, oppositePairs, pairReason, pickRoot, symbolUp, type Cell, type Vec3 } from "./cube-nets";
import { mulberry32, pick, randInt, shuffle, type Rng } from "./random";

export type Level = 1 | 2 | 3;
export type QuestionType =
  | "opposite"
  | "touch"
  | "hidden"
  | "missing"
  | "makes"
  | "cannot"
  | "netMakes"
  | "netCannot"
  | "place";

/** Symbols that look the same after any quarter turn: their direction never matters. */
export const ROUND_SYMBOLS = ["●", "■", "✚", "◆", "○", "✖"];
/**
 * Symbols with a direction: a quarter turn makes them look different. Not «۷»:
 * turned upside down it reads as the digit «۸», which would mislead a child.
 */
export const DIRECTED_SYMBOLS = ["↑", "F", "ب", "▲", "۴", "L"];
const DIRECTED = new Set(DIRECTED_SYMBOLS);
export const isDirected = (s: string) => DIRECTED.has(s);

/** The six "1-4-1" nets (a row of four), easiest to picture: used at level 1. */
export const EASY_NETS = CUBE_NETS.map((_, i) => i).filter((i) => {
  const rows = new Map<number, number>();
  for (const [, y] of CUBE_NETS[i]) rows.set(y, (rows.get(y) ?? 0) + 1);
  return [...rows.values()].includes(4);
});

export interface DecoratedNet {
  netIndex: number;
  cells: readonly Cell[];
  /** One symbol per cell, all different. */
  symbols: string[];
  /** Counter-clockwise quarter turns of each symbol on the flat net. */
  turns: number[];
}

export function decorate(level: Level, rng: Rng): DecoratedNet {
  const netIndex = level === 1 ? pick(rng, EASY_NETS) : randInt(rng, CUBE_NETS.length);
  const directedCount = level === 1 ? 0 : level === 2 ? 2 : 4 + randInt(rng, 3);
  const symbols = shuffle(rng, [
    ...shuffle(rng, DIRECTED_SYMBOLS).slice(0, directedCount),
    ...shuffle(rng, ROUND_SYMBOLS).slice(0, 6 - directedCount),
  ]);
  const turns = symbols.map((s) => (isDirected(s) ? randInt(rng, 4) : 0));
  return { netIndex, cells: CUBE_NETS[netIndex], symbols, turns };
}

// ---------------------------------------------------------------------------
// Folded cube and its 24 rotations.

export interface CubeFace {
  symbol: string;
  /** Outward normal on the folded cube. */
  normal: Vec3;
  /** Direction the top of the symbol points to. */
  up: Vec3;
}

const fix = (v: number[]): Vec3 => [v[0] || 0, v[1] || 0, v[2] || 0];
const mirrorZ = (v: Vec3): Vec3 => fix([v[0], v[1], -v[2]]);
const same = (a: Vec3, b: Vec3) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => fix([a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]);
const neg = (v: Vec3): Vec3 => fix([-v[0], -v[1], -v[2]]);

/**
 * The six faces of the cube folded from `net`, in `net.cells` order. Uses the
 * same root as the 3D animation, so the unrotated view is exactly what the
 * stage camera shows (top, +x, -y).
 */
export function cubeFaces(net: DecoratedNet): CubeFace[] {
  const fold = foldNet(net.cells, pickRoot(net.cells));
  return net.cells.map((c, i) => {
    const f = fold.faces.find((g) => g.cell[0] === c[0] && g.cell[1] === c[1])!;
    return { symbol: net.symbols[i], normal: mirrorZ(f.normal), up: mirrorZ(symbolUp(f, net.turns[i])) };
  });
}

type Mat = readonly number[]; // 3×3, row-major
const apply = (m: Mat, v: Vec3): Vec3 =>
  fix([m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]);
const mul = (a: Mat, b: Mat): Mat =>
  [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]));

/** The 24 rotations of a cube, generated from quarter turns about x and z. */
export const ROTATIONS: Mat[] = (() => {
  const gens: Mat[] = [
    [1, 0, 0, 0, 0, -1, 0, 1, 0],
    [0, -1, 0, 1, 0, 0, 0, 0, 1],
  ];
  const seen = new Map<string, Mat>([["1,0,0,0,1,0,0,0,1", [1, 0, 0, 0, 1, 0, 0, 0, 1]]]);
  const queue = [...seen.values()];
  while (queue.length) {
    const m = queue.shift()!;
    for (const g of gens) {
      const n = mul(g, m).map((x) => x || 0);
      const k = n.join(",");
      if (!seen.has(k)) {
        seen.set(k, n);
        queue.push(n);
      }
    }
  }
  return [...seen.values()];
})();

// ---------------------------------------------------------------------------
// What a picture of the cube shows: the top, front-right and front-left faces.

export type Slot = "top" | "right" | "left";
export const SLOTS: Slot[] = ["top", "right", "left"];
export const SLOT_NORMALS: Record<Slot, Vec3> = { top: [0, 0, 1], right: [1, 0, 0], left: [0, -1, 0] };

export interface ViewFace {
  symbol: string;
  up: Vec3;
}
export type CubeView = Record<Slot, ViewFace>;

export function viewOf(faces: readonly CubeFace[], m: Mat): CubeView {
  const view = {} as CubeView;
  for (const slot of SLOTS) {
    const f = faces.find((g) => same(apply(m, g.normal), SLOT_NORMALS[slot]))!;
    view[slot] = { symbol: f.symbol, up: apply(m, f.up) };
  }
  return view;
}

/** Two views look identical when every slot shows the same symbol pointing the same way. */
export function viewKey(v: CubeView): string {
  return SLOTS.map((s) => (isDirected(v[s].symbol) ? `${v[s].symbol}@${v[s].up.join(",")}` : v[s].symbol)).join("|");
}

// ---------------------------------------------------------------------------
// Wrong pictures, each built from one typical mistake.

export type Mistake = "opposite" | "turned" | "swapped";

export interface Option {
  view: CubeView;
  /** Set for impossible pictures: which mistake and the symbols involved. */
  mistake?: Mistake;
  symbols?: [string, string] | [string];
}

/** Turn an up vector by `q` counter-clockwise quarter turns, seen from outside the face. */
function turnUp(up: Vec3, normal: Vec3, q: number): Vec3 {
  let u = up;
  for (let i = 0; i < q; i++) u = cross(normal, u);
  return u;
}

function wrongView(base: CubeView, faces: readonly CubeFace[], mistake: Mistake, rng: Rng): Option | null {
  const view: CubeView = { top: { ...base.top }, right: { ...base.right }, left: { ...base.left } };
  const [j, k] = shuffle(rng, SLOTS);
  switch (mistake) {
    case "opposite": {
      // Show the face opposite slot j in slot k: two opposite faces side by side.
      const fj = faces.find((f) => f.symbol === base[j].symbol)!;
      const opp = faces.find((f) => same(f.normal, neg(fj.normal)))!;
      view[k] = { symbol: opp.symbol, up: base[k].up };
      return { view, mistake, symbols: [base[j].symbol, opp.symbol] };
    }
    case "turned": {
      const slot = shuffle(rng, SLOTS).find((s) => isDirected(base[s].symbol));
      if (!slot) return null;
      view[slot] = { symbol: base[slot].symbol, up: turnUp(base[slot].up, SLOT_NORMALS[slot], 1 + randInt(rng, 3)) };
      return { view, mistake, symbols: [base[slot].symbol] };
    }
    case "swapped": {
      view[j] = { symbol: base[k].symbol, up: base[j].up };
      view[k] = { symbol: base[j].symbol, up: base[k].up };
      return { view, mistake, symbols: [base[j].symbol, base[k].symbol] };
    }
  }
}

/**
 * `count` different impossible pictures. Each is checked against all 24
 * rotations of the real cube, so it can never be a correct answer.
 */
function wrongOptions(faces: readonly CubeFace[], valid: Set<string>, level: Level, count: number, rng: Rng): Option[] {
  const views = ROTATIONS.map((m) => viewOf(faces, m));
  // Level 2+ always includes a "turned" picture, the case of right symbol, wrong direction.
  const plan: Mistake[] = level === 1 ? ["opposite", "swapped", "opposite"] : ["turned", "opposite", "swapped"];
  const out: Option[] = [];
  const used = new Set<string>();
  for (let attempt = 0; out.length < count && attempt < 400; attempt++) {
    const mistake = attempt < 60 ? plan[out.length % plan.length] : pick(rng, ["opposite", "swapped", "turned"] as Mistake[]);
    const opt = wrongView(pick(rng, views), faces, mistake, rng);
    if (!opt) continue;
    const key = viewKey(opt.view);
    if (valid.has(key) || used.has(key)) continue;
    used.add(key);
    out.push(opt);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Questions.

// ---------------------------------------------------------------------------
// Laying a cube's symbols out on any net shape.

/** Symbols and turns that make `shape` fold into `faces` turned by rotation `m`. */
export function solveNet(shape: readonly Cell[], faces: readonly CubeFace[], m: Mat, netIndex = -1): DecoratedNet {
  const fold = foldNet(shape, pickRoot(shape));
  const symbols: string[] = [];
  const turns: number[] = [];
  shape.forEach((c, i) => {
    const f = fold.faces.find((g) => g.cell[0] === c[0] && g.cell[1] === c[1])!;
    const g = faces.find((h) => same(apply(m, h.normal), mirrorZ(f.normal)))!;
    const target = apply(m, g.up);
    symbols[i] = g.symbol;
    turns[i] = isDirected(g.symbol) ? [0, 1, 2, 3].find((k) => same(mirrorZ(symbolUp(f, k)), target))! : 0;
  });
  return { netIndex, cells: shape, symbols, turns };
}

const NORMALS6: Vec3[] = [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]];

function cubeKey(faces: readonly CubeFace[], m: Mat): string {
  return NORMALS6.map((n) => {
    const f = faces.find((g) => same(apply(m, g.normal), n))!;
    return isDirected(f.symbol) ? `${f.symbol}@${apply(m, f.up).join(",")}` : f.symbol;
  }).join("|");
}

/** True when two folded cubes are the same cube, possibly turned. */
export function sameCube(a: readonly CubeFace[], b: readonly CubeFace[]): boolean {
  const k = cubeKey(a, ROTATIONS[0]);
  return ROTATIONS.some((m) => cubeKey(b, m) === k);
}

export type CellStatus = "correct" | "turned" | "wrong";

export interface Placement {
  symbols: (string | null)[];
  turns: number[];
}

/**
 * Compare a child's placement on `shape` with the closest of the 24 ways the
 * target cube can be laid out on it. "turned" = right symbol, wrong direction.
 */
export function scorePlacement(
  shape: readonly Cell[],
  faces: readonly CubeFace[],
  placement: Placement,
): { status: CellStatus[]; solved: boolean; best: DecoratedNet } {
  let best = solveNet(shape, faces, ROTATIONS[0]);
  let bestStatus: CellStatus[] = [];
  let bestScore = -1;
  for (const m of ROTATIONS) {
    const sol = solveNet(shape, faces, m);
    const status = sol.symbols.map((s, i): CellStatus =>
      placement.symbols[i] !== s ? "wrong" : !isDirected(s) || placement.turns[i] === sol.turns[i] ? "correct" : "turned",
    );
    const score = status.reduce((a, st) => a + (st === "correct" ? 2 : st === "turned" ? 1 : 0), 0);
    if (score > bestScore) [best, bestStatus, bestScore] = [sol, status, score];
  }
  return { status: bestStatus, solved: bestStatus.every((s) => s === "correct"), best };
}

// ---------------------------------------------------------------------------
// Net options: which net makes (or cannot make) the pictured cube.

export type NetMistake = "swapped" | "turned";

export interface NetOption {
  net: DecoratedNet;
  mistake?: NetMistake;
  symbols?: [string, string] | [string];
}

function corruptNet(net: DecoratedNet, mistake: NetMistake, rng: Rng): NetOption | null {
  const symbols = [...net.symbols];
  const turns = [...net.turns];
  if (mistake === "turned") {
    const directed = symbols.map((s, i) => i).filter((i) => isDirected(symbols[i]));
    if (!directed.length) return null;
    const i = pick(rng, directed);
    turns[i] = (turns[i] + 1 + randInt(rng, 3)) % 4;
    return { net: { ...net, turns }, mistake, symbols: [symbols[i]] };
  }
  const [i, j] = shuffle(rng, [0, 1, 2, 3, 4, 5]);
  [symbols[i], symbols[j]] = [symbols[j], symbols[i]];
  return { net: { ...net, symbols }, mistake, symbols: [symbols[j], symbols[i]] };
}

/** Nets of different shapes: `good` that fold into the pictured cube, `bad` that cannot. */
function netOptions(faces: readonly CubeFace[], view: CubeView, level: Level, good: number, bad: number, rng: Rng): NetOption[] {
  const pool = level === 1 ? EASY_NETS : CUBE_NETS.map((_, i) => i);
  const shapes = shuffle(rng, pool).slice(0, good + bad);
  return shapes.map((ni, k) => {
    const sol = solveNet(CUBE_NETS[ni], faces, pick(rng, ROTATIONS), ni);
    if (k < good) return { net: sol };
    for (let attempt = 0; attempt < 80; attempt++) {
      const mistake: NetMistake = level > 1 && attempt % 2 === 0 ? "turned" : "swapped";
      const opt = corruptNet(sol, mistake, rng);
      if (opt && !isPossible(opt.net, view)) return opt;
    }
    throw new Error("could not build an impossible net");
  });
}

// ---------------------------------------------------------------------------
// Questions.

interface Base {
  seed: number;
  level: Level;
  net: DecoratedNet;
}

export type Question =
  | (Base & { type: "opposite"; target: number; answer: number; reason: "row" | "fold" })
  | (Base & { type: "touch"; target: number; answers: number[] })
  | (Base & { type: "hidden"; view: CubeView; slot: Slot; answer: number })
  | (Base & { type: "missing"; view: CubeView; blank: number; answer: number })
  | (Base & { type: "makes" | "cannot"; options: Option[]; answer: number })
  | (Base & { type: "netMakes" | "netCannot"; view: CubeView; nets: NetOption[]; answer: number })
  | (Base & { type: "place"; views: [CubeView, CubeView]; faces: CubeFace[] });

/** 180° turn about the (1,1,0) axis: shows the three faces a view hides. */
const BACK_TURN: Mat = [0, 1, 0, 1, 0, 0, 0, 0, -1];

const oppositeOf = (cells: readonly Cell[], i: number) => {
  const pair = oppositePairs(cells).find((p) => p.includes(i))!;
  return pair[0] === i ? pair[1] : pair[0];
};

export function makeQuestion(type: QuestionType, level: Level, seed: number): Question {
  const rng = mulberry32(seed);
  let net = decorate(level, rng);

  if (type === "opposite") {
    const target = randInt(rng, 6);
    const answer = oppositeOf(net.cells, target);
    return { type, seed, level, net, target, answer, reason: pairReason(net.cells, target, answer) };
  }

  if (type === "touch") {
    const target = randInt(rng, 6);
    const opp = oppositeOf(net.cells, target);
    const answers = [0, 1, 2, 3, 4, 5].filter((i) => i !== target && i !== opp);
    return { type, seed, level, net, target, answers };
  }

  if (type === "missing") {
    // The blank face always carries a directed symbol, so its direction is the question.
    const blank = randInt(rng, 6);
    if (!isDirected(net.symbols[blank])) {
      const spare = DIRECTED_SYMBOLS.filter((s) => !net.symbols.includes(s));
      const symbols = [...net.symbols];
      const turns = [...net.turns];
      symbols[blank] = pick(rng, spare);
      turns[blank] = randInt(rng, 4);
      net = { ...net, symbols, turns };
    }
    const faces = cubeFaces(net);
    const slotNormals = Object.values(SLOT_NORMALS);
    const m = shuffle(rng, ROTATIONS).find((r) => slotNormals.some((n) => same(apply(r, faces[blank].normal), n)))!;
    return { type, seed, level, net, view: viewOf(faces, m), blank, answer: net.turns[blank] };
  }

  const faces = cubeFaces(net);

  if (type === "hidden") {
    const view = viewOf(faces, pick(rng, ROTATIONS));
    const slot = pick(rng, SLOTS);
    const shown = net.symbols.indexOf(view[slot].symbol);
    return { type, seed, level, net, view, slot, answer: oppositeOf(net.cells, shown) };
  }

  if (type === "place") {
    const m = pick(rng, ROTATIONS);
    return { type, seed, level, net, views: [viewOf(faces, m), viewOf(faces, mul(BACK_TURN, m))], faces };
  }

  if (type === "netMakes" || type === "netCannot") {
    const view = viewOf(faces, pick(rng, ROTATIONS));
    const [good, bad] = type === "netMakes" ? [1, 3] : [3, 1];
    const nets = shuffle(rng, netOptions(faces, view, level, good, bad, rng));
    const answer = nets.findIndex((o) => (type === "netMakes" ? !o.mistake : !!o.mistake));
    return { type, seed, level, net, view, nets, answer };
  }

  const views = shuffle(rng, ROTATIONS.map((m) => viewOf(faces, m)));
  const valid = new Set(views.map(viewKey));

  let options: Option[];
  if (type === "makes") {
    options = [{ view: views[0] }, ...wrongOptions(faces, valid, level, 3, rng)];
  } else {
    const distinct: Option[] = [];
    const keys = new Set<string>();
    for (const v of views) {
      const k = viewKey(v);
      if (keys.has(k)) continue;
      keys.add(k);
      distinct.push({ view: v });
      if (distinct.length === 3) break;
    }
    options = [...distinct, ...wrongOptions(faces, valid, level, 1, rng)];
  }

  const order = shuffle(rng, options.map((_, i) => i));
  const shuffled = order.map((i) => options[i]);
  const answer = shuffled.findIndex((o) => (type === "makes" ? !o.mistake : !!o.mistake));
  return { type, seed, level, net, options: shuffled, answer };
}

/** True when `view` is a picture of the cube folded from `net` (used by tests and checks). */
export function isPossible(net: DecoratedNet, view: CubeView): boolean {
  const faces = cubeFaces(net);
  const key = viewKey(view);
  return ROTATIONS.some((m) => viewKey(viewOf(faces, m)) === key);
}

// Transformations (tool 1). Pure TypeScript.
//
// A figure is a set of grid cells (stored by their centres, x right, y up)
// and, from level 2, one cell carrying a letter whose orientation is a 2×2
// matrix. Every move used here (mirror, water, quarter turns, shifts) maps
// cell centres onto cell centres, so pictures can be compared exactly.

import { mulberry32, pick, randInt, shuffle, type Rng } from "./random";

export type Level = 1 | 2 | 3;
export type Pt = [number, number];
/** [a, b, c, d]: x' = a·x + b·y, y' = c·x + d·y */
export type Mat = [number, number, number, number];

export interface Mark {
  /** Centre of the cell that carries the letter. */
  at: Pt;
  symbol: string;
  m: Mat;
}
export interface Figure {
  cells: Pt[];
  mark?: Mark;
}

/** Letters with no mirror or turn symmetry, so every image of them looks different. */
export const SYMBOLS = ["F", "L", "۴"];

export const IDENTITY: Mat = [1, 0, 0, 1];
const clean = (v: number) => Math.round(v * 1e6) / 1e6 || 0;
export const mul = (p: Mat, q: Mat): Mat => [p[0] * q[0] + p[1] * q[2], p[0] * q[1] + p[1] * q[3], p[2] * q[0] + p[3] * q[2], p[2] * q[1] + p[3] * q[3]].map(clean) as Mat;
const applyMat = (m: Mat, [x, y]: Pt): Pt => [clean(m[0] * x + m[1] * y), clean(m[2] * x + m[3] * y)];

// ---------------------------------------------------------------------------
// Moves on the board.

/** v: x = c · h: y = c · d: y − x = c · a: x + y = c */
export type LineKind = "v" | "h" | "d" | "a";
export interface Line {
  kind: LineKind;
  c: number;
}

export type Op =
  | { kind: "reflect"; line: Line }
  /** Positive degrees turn clockwise. */
  | { kind: "rotate"; deg: number; about: Pt }
  | { kind: "shift"; by: Pt };

const R2 = Math.SQRT1_2;
function lineNormal(l: Line): { n: Pt; o: number } {
  switch (l.kind) {
    case "v":
      return { n: [1, 0], o: l.c };
    case "h":
      return { n: [0, 1], o: l.c };
    case "d":
      return { n: [-R2, R2], o: l.c * R2 };
    case "a":
      return { n: [R2, R2], o: l.c * R2 };
  }
}

/**
 * The move done a fraction `t` of the way: p ↦ M·p + v. A reflection is
 * shown as the figure flipping over the line (squashed flat half-way).
 */
export function opAt(op: Op, t = 1): { m: Mat; v: Pt } {
  if (op.kind === "shift") return { m: IDENTITY, v: [op.by[0] * t, op.by[1] * t] };
  if (op.kind === "reflect") {
    const { n, o } = lineNormal(op.line);
    const k = 2 * t;
    const m: Mat = [1 - k * n[0] * n[0], -k * n[0] * n[1], -k * n[0] * n[1], 1 - k * n[1] * n[1]];
    return { m, v: [k * o * n[0], k * o * n[1]] };
  }
  const th = (op.deg * t * Math.PI) / 180;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const m: Mat = [c, s, -s, c];
  const [px, py] = op.about;
  return { m, v: [px - (c * px + s * py), py - (-s * px + c * py)] };
}

export const applyOp = (op: Op, p: Pt, t = 1): Pt => {
  const { m, v } = opAt(op, t);
  const q = applyMat(m, p);
  return [clean(q[0] + v[0]), clean(q[1] + v[1])];
};

export function moveFigure(f: Figure, op: Op): Figure {
  const { m } = opAt(op);
  return {
    cells: f.cells.map((p) => applyOp(op, p)),
    mark: f.mark && { ...f.mark, at: applyOp(op, f.mark.at), m: mul(m, f.mark.m) },
  };
}

export const moveAll = (f: Figure, ops: Op[]) => ops.reduce(moveFigure, f);

// ---------------------------------------------------------------------------
// Comparing pictures.

export function bounds(f: Figure): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs = f.cells.map((p) => p[0]);
  const ys = f.cells.map((p) => p[1]);
  return { minX: Math.min(...xs) - 0.5, minY: Math.min(...ys) - 0.5, maxX: Math.max(...xs) + 0.5, maxY: Math.max(...ys) + 0.5 };
}

/** Moved so its bounding box starts at (0, 0). */
export function normalize(f: Figure): Figure {
  const { minX, minY } = bounds(f);
  return moveFigure(f, { kind: "shift", by: [-minX, -minY] });
}

export const cellKey = ([x, y]: Pt) => `${Math.floor(x)},${Math.floor(y)}`;

/** Same picture wherever it is (position does not count). */
export function shapeKey(f: Figure): string {
  const n = normalize(f);
  const cells = n.cells.map(cellKey).sort().join(";");
  return n.mark ? `${cells}|${cellKey(n.mark.at)}|${n.mark.m.join(",")}` : cells;
}

/** Same picture in the same place. */
export const placeKey = (f: Figure) => f.cells.map(cellKey).sort().join(";") + (f.mark ? `|${cellKey(f.mark.at)}|${f.mark.m.join(",")}` : "");

// ---------------------------------------------------------------------------
// Named moves for multiple-choice pictures (position does not matter).

export type MoveName = "mirror" | "water" | "cw90" | "r180" | "ccw90";
export const MOVES: MoveName[] = ["mirror", "water", "cw90", "r180", "ccw90"];

export function namedOp(name: MoveName): Op {
  switch (name) {
    case "mirror":
      return { kind: "reflect", line: { kind: "v", c: 0 } };
    case "water":
      return { kind: "reflect", line: { kind: "h", c: 0 } };
    case "cw90":
      return { kind: "rotate", deg: 90, about: [0, 0] };
    case "r180":
      return { kind: "rotate", deg: 180, about: [0, 0] };
    case "ccw90":
      return { kind: "rotate", deg: -90, about: [0, 0] };
  }
}

export const applyNamed = (f: Figure, names: MoveName[]) => normalize(moveAll(f, names.map(namedOp)));

/**
 * Board moves that show named moves happening next to the figure: the
 * mirror stands to its right, the water below it, and a turned copy slides
 * to the right and turns there.
 */
export function stagedOps(f: Figure, names: MoveName[]): Op[] {
  const ops: Op[] = [];
  let cur = f;
  for (const name of names) {
    const b = bounds(cur);
    let step: Op[];
    if (name === "mirror") step = [{ kind: "reflect", line: { kind: "v", c: b.maxX + 1 } }];
    else if (name === "water") step = [{ kind: "reflect", line: { kind: "h", c: b.minY - 1 } }];
    else {
      const w = b.maxX - b.minX;
      const h = b.maxY - b.minY;
      const dx = Math.max(w, h) + 2;
      const deg = name === "cw90" ? 90 : name === "r180" ? 180 : -90;
      // Turn about a grid point near the centre, so cells land on cells.
      const about: Pt = [Math.round((b.minX + b.maxX) / 2) + dx, Math.round((b.minY + b.maxY) / 2)];
      step = [
        { kind: "shift", by: [dx, 0] },
        { kind: "rotate", deg, about },
      ];
    }
    ops.push(...step);
    cur = moveAll(cur, step);
  }
  return ops;
}

// ---------------------------------------------------------------------------
// Random figures.

const NEIGHBOURS: Pt[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** A connected figure of n cells inside a box×box square. */
export function randomFigure(rng: Rng, n: number, box: number, withMark: boolean): Figure {
  const cells: Pt[] = [[randInt(rng, box) + 0.5, randInt(rng, box) + 0.5]];
  const has = (p: Pt) => cells.some((q) => q[0] === p[0] && q[1] === p[1]);
  while (cells.length < n) {
    const from = pick(rng, cells);
    const [dx, dy] = pick(rng, NEIGHBOURS);
    const p: Pt = [from[0] + dx, from[1] + dy];
    if (p[0] > 0 && p[1] > 0 && p[0] < box && p[1] < box && !has(p)) cells.push(p);
  }
  const f: Figure = { cells };
  if (withMark) f.mark = { at: pick(rng, cells), symbol: pick(rng, SYMBOLS), m: IDENTITY };
  return normalize(f);
}

/** Pictures of the figure under all five moves are all different (and differ from it). */
function allDifferent(f: Figure): boolean {
  const keys = [shapeKey(f), ...MOVES.map((m) => shapeKey(applyNamed(f, [m])))];
  return new Set(keys).size === keys.length;
}

// ---------------------------------------------------------------------------
// Questions.

export type TransformQuestionType = "mirror" | "water" | "rotate" | "draw" | "sequence" | "combo" | "which";
export type TransformMistake = "otherReflection" | "otherTurn" | "turnForFlip" | "flipForTurn" | "wrongOrder" | "oneStep" | "unchanged";

interface Base {
  seed: number;
  level: Level;
  figure: Figure;
}

export type TransformQuestion =
  | (Base & { type: "mirror" | "water" | "rotate" | "combo"; moves: MoveName[]; options: Figure[]; mistakes: (TransformMistake | null)[]; answer: number })
  | (Base & { type: "which"; image: Figure; options: MoveName[]; answer: number })
  | (Base & { type: "draw"; op: Op; w: number; h: number; answer: string[] })
  | (Base & { type: "sequence"; step: MoveName; frames: (Figure | null)[]; options: Figure[]; mistakes: (TransformMistake | null)[]; answer: number });

const SETUP: Record<Level, { cells: [number, number]; box: number; mark: boolean }> = {
  1: { cells: [4, 5], box: 3, mark: false },
  2: { cells: [5, 6], box: 4, mark: true },
  3: { cells: [6, 8], box: 4, mark: true },
};

const isFlip = (m: MoveName) => m === "mirror" || m === "water";

/** The usual mix-up for a move. */
function mixUp(m: MoveName): { name: MoveName; mistake: TransformMistake }[] {
  switch (m) {
    case "mirror":
      return [{ name: "water", mistake: "otherReflection" }, { name: "r180", mistake: "turnForFlip" }, { name: "cw90", mistake: "turnForFlip" }];
    case "water":
      return [{ name: "mirror", mistake: "otherReflection" }, { name: "r180", mistake: "turnForFlip" }, { name: "ccw90", mistake: "turnForFlip" }];
    case "cw90":
      return [{ name: "ccw90", mistake: "otherTurn" }, { name: "r180", mistake: "otherTurn" }, { name: "mirror", mistake: "flipForTurn" }];
    case "ccw90":
      return [{ name: "cw90", mistake: "otherTurn" }, { name: "r180", mistake: "otherTurn" }, { name: "water", mistake: "flipForTurn" }];
    case "r180":
      return [{ name: "cw90", mistake: "otherTurn" }, { name: "mirror", mistake: "flipForTurn" }, { name: "water", mistake: "flipForTurn" }];
  }
}

function choose(rng: Rng, correct: Figure, candidates: { value: Figure; mistake: TransformMistake }[]) {
  const chosen: { value: Figure; mistake: TransformMistake | null }[] = [{ value: correct, mistake: null }];
  const keys = new Set([shapeKey(correct)]);
  for (const c of candidates) {
    if (chosen.length === 4) break;
    const k = shapeKey(c.value);
    if (!keys.has(k)) {
      keys.add(k);
      chosen.push(c);
    }
  }
  const order = shuffle(rng, chosen.map((_, i) => i));
  return { options: order.map((i) => normalize(chosen[i].value)), mistakes: order.map((i) => chosen[i].mistake), answer: order.indexOf(0) };
}

/** Bounds of a list of cell keys' cells, for the "draw" board. */
const insideBoard = (f: Figure, w: number, h: number) => f.cells.every(([x, y]) => x > 0 && y > 0 && x < w && y < h);

export function makeTransformQuestion(type: TransformQuestionType, level: Level, seed: number): TransformQuestion {
  const rng = mulberry32(seed);
  const setup = SETUP[level];
  for (let attempt = 0; attempt < 400; attempt++) {
    const n = setup.cells[0] + randInt(rng, setup.cells[1] - setup.cells[0] + 1);
    const figure = randomFigure(rng, n, setup.box, setup.mark);
    if (!allDifferent(figure)) continue;

    if (type === "mirror" || type === "water" || type === "rotate") {
      const name: MoveName = type === "rotate" ? pick(rng, level === 1 ? (["cw90", "r180"] as MoveName[]) : (["cw90", "r180", "ccw90"] as MoveName[])) : type;
      const correct = applyNamed(figure, [name]);
      const cands = [
        ...mixUp(name).map((c) => ({ value: applyNamed(figure, [c.name]), mistake: c.mistake })),
        { value: figure, mistake: "unchanged" as const },
        ...shuffle(rng, MOVES).map((m) => ({ value: applyNamed(figure, [m]), mistake: (isFlip(m) === isFlip(name) ? "otherTurn" : "turnForFlip") as TransformMistake })),
      ];
      const c = choose(rng, correct, cands);
      if (c.options.length < 4) continue;
      return { type, seed, level, figure, moves: [name], ...c };
    }

    if (type === "combo") {
      const k = level === 3 ? 2 + randInt(rng, 2) : 2;
      const names: MoveName[] = [];
      while (names.length < k) {
        const m = pick(rng, MOVES);
        if (m !== names[names.length - 1]) names.push(m);
      }
      const correct = applyNamed(figure, names);
      if (shapeKey(correct) === shapeKey(figure)) continue;
      const reversed = [...names].reverse();
      const cands = [
        { value: applyNamed(figure, reversed), mistake: "wrongOrder" as const },
        { value: applyNamed(figure, [names[0]]), mistake: "oneStep" as const },
        { value: applyNamed(figure, [names[names.length - 1]]), mistake: "oneStep" as const },
        ...shuffle(rng, MOVES).map((m) => ({ value: applyNamed(figure, [...names.slice(0, -1), m]), mistake: "oneStep" as const })),
        { value: figure, mistake: "unchanged" as const },
      ];
      const c = choose(rng, correct, cands);
      if (c.options.length < 4) continue;
      return { type, seed, level, figure, moves: names, ...c };
    }

    if (type === "which") {
      const pool: MoveName[] = level === 1 ? ["mirror", "water", "r180", "cw90"] : MOVES;
      const name = pick(rng, pool);
      const others = shuffle(rng, pool.filter((m) => m !== name)).slice(0, 3);
      const options = shuffle(rng, [name, ...others]);
      return { type, seed, level, figure, image: applyNamed(figure, [name]), options, answer: options.indexOf(name) };
    }

    if (type === "sequence") {
      const step: MoveName = level === 1 ? "cw90" : pick(rng, ["cw90", "ccw90"] as MoveName[]);
      const all = [0, 1, 2, 3].map((i) => applyNamed(figure, Array(i).fill(step)));
      const missing = level === 3 ? 2 : 3;
      const frames = level === 3 ? [all[0], all[1], null, all[3]] : [all[0], all[1], all[2], null];
      const correct = all[missing];
      const cands = [
        { value: applyNamed(all[missing - 1], [step === "cw90" ? "ccw90" : "cw90"]), mistake: "otherTurn" as const },
        { value: applyNamed(all[missing - 1], ["mirror"]), mistake: "flipForTurn" as const },
        { value: applyNamed(all[missing - 1], ["water"]), mistake: "flipForTurn" as const },
        { value: all[missing - 1], mistake: "unchanged" as const },
        { value: applyNamed(correct, ["mirror"]), mistake: "flipForTurn" as const },
      ];
      const c = choose(rng, correct, cands);
      if (c.options.length < 4) continue;
      return { type, seed, level, figure, step, frames, ...c };
    }

    // Draw the image on the grid.
    const w = level === 1 ? 10 : 12;
    const h = level === 1 ? 6 : level === 2 ? 8 : 10;
    let op: Op;
    let placed: Figure;
    if (level === 1 || (level === 2 && rng() < 0.6)) {
      const vertical = rng() < 0.6;
      const b = bounds(figure);
      const gap = level === 1 ? 0 : randInt(rng, 2);
      if (vertical) {
        placed = moveFigure(figure, { kind: "shift", by: [w / 2 - gap - b.maxX, Math.floor((h - b.maxY) / 2)] });
        op = { kind: "reflect", line: { kind: "v", c: w / 2 } };
      } else {
        placed = moveFigure(figure, { kind: "shift", by: [Math.floor((w - b.maxX) / 2), h / 2 + gap] });
        op = { kind: "reflect", line: { kind: "h", c: h / 2 } };
      }
    } else if (level === 2) {
      // Half turn about a marked point.
      const about: Pt = [w / 2, h / 2];
      placed = moveFigure(figure, { kind: "shift", by: [w / 2 - bounds(figure).maxX, h / 2 - randInt(rng, 2)] });
      op = { kind: "rotate", deg: 180, about };
    } else if (rng() < 0.5) {
      // A slanted mirror: the diagonal of the board's square part.
      const s = Math.min(w, h);
      const ox = (w - s) / 2;
      placed = moveFigure(figure, { kind: "shift", by: [ox + 1 + randInt(rng, 2), s - bounds(figure).maxY - 1 - randInt(rng, 2)] });
      op = { kind: "reflect", line: { kind: "d", c: -ox } };
    } else {
      const about: Pt = [w / 2, h / 2];
      placed = moveFigure(figure, { kind: "shift", by: [w / 2 - bounds(figure).maxX, h / 2] });
      op = { kind: "rotate", deg: pick(rng, [90, -90]), about };
    }
    const image = moveFigure(placed, op);
    if (!insideBoard(placed, w, h) || !insideBoard(image, w, h)) continue;
    // The image must not overlap the figure, so both can be seen.
    const own = new Set(placed.cells.map(cellKey));
    if (image.cells.some((p) => own.has(cellKey(p)))) continue;
    return { type, seed, level, figure: { cells: placed.cells }, op, w, h, answer: image.cells.map(cellKey).sort() };
  }
  throw new Error("no question");
}

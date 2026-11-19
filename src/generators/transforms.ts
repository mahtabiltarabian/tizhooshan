// Transformations (tool 1). Pure TypeScript.
//
// A figure is a set of grid cells (stored by their centres, x right, y up)
// and, from level 2, one cell carrying a letter whose orientation is a 2×2
// matrix. Every move used here (mirror, water, quarter turns, shifts) maps
// cell centres onto cell centres, so pictures can be compared exactly.
//
// Questions where the child colours cells ("draw", and "shift" when drawn)
// use figures whose cells alone have no symmetry, so all eight turned and
// flipped pictures differ and a wrong picture tells which move was made.

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

// ---------------------------------------------------------------------------
// Orientation: the eight ways to turn or flip a picture on the grid.

/** Identity, quarter turn clockwise, half turn, quarter turn anticlockwise, mirror, water, and the two diagonal flips. */
export const ORIENTS: Mat[] = [
  [1, 0, 0, 1],
  [0, 1, -1, 0],
  [-1, 0, 0, -1],
  [0, -1, 1, 0],
  [-1, 0, 0, 1],
  [1, 0, 0, -1],
  [0, 1, 1, 0],
  [0, -1, -1, 0],
];
export const isFlipMat = (m: Mat) => m[0] * m[3] - m[1] * m[2] < 0;
const sameMat = (p: Mat, q: Mat) => p.every((v, i) => v === q[i]);
/** Picture of some cells turned or flipped by m (position does not count). */
const orientedKey = (cells: Pt[], m: Mat) => shapeKey({ cells: cells.map((p) => applyMat(m, p)) });

/** The cells alone look different under each of the eight orientations (no symmetry at all). */
export const chiralCells = (cells: Pt[]) => new Set(ORIENTS.map((m) => orientedKey(cells, m))).size === 8;

/** Pictures of the figure under all five moves are all different (and differ from it). */
function allDifferent(f: Figure): boolean {
  const keys = [shapeKey(f), ...MOVES.map((m) => shapeKey(applyNamed(f, [m])))];
  return new Set(keys).size === keys.length;
}

// ---------------------------------------------------------------------------
// Questions.

export type TransformQuestionType = "mirror" | "water" | "rotate" | "shift" | "draw" | "sequence" | "combo" | "which";
export type TransformMistake = "otherReflection" | "otherTurn" | "turnForFlip" | "flipForTurn" | "wrongOrder" | "oneStep" | "unchanged";
/**
 * Slips in a slide. wrongWay: the opposite direction (one or both parts).
 * offByOne: one part a cell short or long. gap: counted the empty cells
 * between the figure and its image instead of how far each cell moves.
 * swapped: the two numbers swapped between the directions. oneDirection:
 * only one of the two parts done. onlyMoved / onlyReflected / wrongOrder:
 * a slide and a reflection, one left out or done in the other order.
 */
export type ShiftMistake = "wrongWay" | "offByOne" | "gap" | "swapped" | "oneDirection" | "onlyMoved" | "onlyReflected" | "wrongOrder";

interface Base {
  seed: number;
  level: Level;
  figure: Figure;
}

export type TransformQuestion =
  | (Base & { type: "mirror" | "water" | "rotate" | "combo"; moves: MoveName[]; options: Figure[]; mistakes: (TransformMistake | null)[]; answer: number })
  | (Base & { type: "which"; image: Figure; options: MoveName[]; answer: number })
  | (Base & { type: "draw"; op: Op; w: number; h: number; answer: string[] })
  /**
   * Slide drawn on the grid: `vec` is the slide; `ops` the board moves (the
   * slide in its parts, then a reflection at level 3). `slips` are the
   * pictures of known slips, first match wins.
   */
  | (Base & { type: "shift"; form: "draw"; vec: Pt; ops: Op[]; w: number; h: number; answer: string[]; slips: { cells: string[]; mistake: ShiftMistake }[] })
  /** Which slide took the figure onto the image? */
  | (Base & { type: "shift"; form: "vector"; vec: Pt; image: Figure; w: number; h: number; options: Pt[]; mistakes: (ShiftMistake | null)[]; answer: number })
  | (Base & { type: "sequence"; step: MoveName; frames: (Figure | null)[]; options: Figure[]; mistakes: (TransformMistake | null)[]; answer: number });
export type PaintQuestion = Extract<TransformQuestion, { type: "draw" }> | Extract<TransformQuestion, { type: "shift"; form: "draw" }>;

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

const sgn = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0);
const keysOf = (f: Figure) => f.cells.map(cellKey).sort();
const shiftBy = (f: Figure, by: Pt) => moveFigure(f, { kind: "shift", by });
/** A slide as board moves: across first, then up or down. */
export const shiftLegs = ([dx, dy]: Pt): Op[] => [...(dx ? [{ kind: "shift" as const, by: [dx, 0] as Pt }] : []), ...(dy ? [{ kind: "shift" as const, by: [0, dy] as Pt }] : [])];

/** The board moves of a question the child colours. */
export const paintOps = (q: PaintQuestion): Op[] => (q.type === "draw" ? [q.op] : q.ops);

/** Slides a child might do instead of `vec` (figure of extent fw × fh). */
function slideSlips(vec: Pt, fw: number, fh: number): { by: Pt; mistake: ShiftMistake }[] {
  const [dx, dy] = vec;
  const sx = sgn(dx);
  const sy = sgn(dy);
  const out: { by: Pt; mistake: ShiftMistake }[] = [];
  out.push({ by: [-dx, -dy], mistake: "wrongWay" });
  if (dx && dy) {
    out.push({ by: [dx, 0], mistake: "oneDirection" }, { by: [0, dy], mistake: "oneDirection" });
    out.push({ by: [-dx, dy], mistake: "wrongWay" }, { by: [dx, -dy], mistake: "wrongWay" });
    if (Math.abs(dx) !== Math.abs(dy)) out.push({ by: [sx * Math.abs(dy), sy * Math.abs(dx)], mistake: "swapped" });
  }
  if (dx) out.push({ by: [dx + sx, dy], mistake: "offByOne" }, { by: [dx - sx, dy], mistake: "offByOne" });
  if (dy) out.push({ by: [dx, dy + sy], mistake: "offByOne" }, { by: [dx, dy - sy], mistake: "offByOne" });
  // Left `|dx|` empty cells between the figure and its image.
  if (dx) out.push({ by: [dx + sx * fw, dy], mistake: "gap" });
  if (dy) out.push({ by: [dx, dy + sy * fh], mistake: "gap" });
  if (dx && dy) out.push({ by: [dx + sx * fw, dy + sy * fh], mistake: "gap" });
  return out;
}

/** Keep the first slip for each picture, on the board and not the answer. */
function slipPictures(answer: string[], cands: { f: Figure; mistake: ShiftMistake }[], w: number, h: number) {
  const seen = new Set([answer.join(";")]);
  const out: { cells: string[]; mistake: ShiftMistake }[] = [];
  for (const c of cands) {
    if (!insideBoard(c.f, w, h)) continue;
    const cells = keysOf(c.f);
    const k = cells.join(";");
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ cells, mistake: c.mistake });
  }
  return out;
}

const between = (rng: Rng, lo: number, hi: number) => lo + randInt(rng, hi - lo + 1);

/** A place on a w × h board for a figure of size fw × fh so that it and its slide by `vec` both fit, or null. */
function placeFor(rng: Rng, fw: number, fh: number, [dx, dy]: Pt, w: number, h: number): Pt | null {
  const x0 = Math.max(0, -dx);
  const x1 = w - fw - Math.max(0, dx);
  const y0 = Math.max(0, -dy);
  const y1 = h - fh - Math.max(0, dy);
  if (x1 < x0 || y1 < y0) return null;
  return [between(rng, x0, x1), between(rng, y0, y1)];
}

/** A slide question, or null to try another figure. */
function shiftQuestion(rng: Rng, level: Level, seed: number, figure: Figure): TransformQuestion | null {
  const w = 12;
  const h = 8;
  const b = bounds(figure);
  const fw = b.maxX - b.minX;
  const fh = b.maxY - b.minY;
  const apart = (a: Figure, c: Figure) => {
    const own = new Set(a.cells.map(cellKey));
    return !c.cells.some((p) => own.has(cellKey(p)));
  };

  if (level === 3 && rng() < 0.5) {
    // Which slide? Both parts, read off the picture.
    const vec: Pt = [pick(rng, [-1, 1]) * between(rng, 2, 6), pick(rng, [-1, 1]) * between(rng, 1, 4)];
    const at = placeFor(rng, fw, fh, vec, w, h);
    if (!at) return null;
    const placed = shiftBy(figure, at);
    const image = shiftBy(placed, vec);
    if (!apart(placed, image)) return null;
    const correct = { by: vec, mistake: null };
    const cands = shuffle(rng, slideSlips(vec, fw, fh).filter((s) => s.mistake !== "oneDirection" && s.mistake !== "gap"));
    // Counting only the empty cells between the two pictures.
    const [dx, dy] = vec;
    if (Math.abs(dx) > fw) cands.unshift({ by: [dx - sgn(dx) * fw, dy], mistake: "gap" });
    const chosen: { by: Pt; mistake: ShiftMistake | null }[] = [correct];
    for (const c of cands) {
      if (chosen.length === 4) break;
      if (!c.by[0] && !c.by[1]) continue;
      if (!chosen.some((o) => o.by[0] === c.by[0] && o.by[1] === c.by[1])) chosen.push(c);
    }
    if (chosen.length < 4) return null;
    const order = shuffle(rng, [0, 1, 2, 3]);
    return {
      type: "shift",
      form: "vector",
      seed,
      level,
      figure: placed,
      vec,
      image,
      w,
      h,
      options: order.map((i) => chosen[i].by),
      mistakes: order.map((i) => chosen[i].mistake),
      answer: order.indexOf(0),
    };
  }

  if (level === 3) {
    // Slide, then reflect in a line across the slide.
    const across = rng() < 0.5;
    const k = between(rng, 2, 4) * pick(rng, [-1, 1]);
    const vec: Pt = across ? [k, 0] : [0, k];
    const line: Line = across ? { kind: "v", c: w / 2 } : { kind: "h", c: h / 2 };
    const reflect: Op = { kind: "reflect", line };
    const at: Pt = [between(rng, 0, w - fw), between(rng, 0, h - fh)];
    const placed = shiftBy(figure, at);
    const ops = [...shiftLegs(vec), reflect];
    const end = moveAll(placed, ops);
    if (!insideBoard(placed, w, h) || !insideBoard(end, w, h) || !apart(placed, end)) return null;
    const answer = keysOf(end);
    const back: Pt = [-vec[0], -vec[1]];
    const step = across ? ([sgn(k), 0] as Pt) : ([0, sgn(k)] as Pt);
    const slips = slipPictures(
      answer,
      [
        { f: shiftBy(placed, vec), mistake: "onlyMoved" },
        { f: moveFigure(placed, reflect), mistake: "onlyReflected" },
        { f: shiftBy(moveFigure(placed, reflect), vec), mistake: "wrongOrder" },
        { f: moveFigure(shiftBy(placed, back), reflect), mistake: "wrongWay" },
        { f: moveFigure(shiftBy(placed, [vec[0] + step[0], vec[1] + step[1]]), reflect), mistake: "offByOne" },
        { f: moveFigure(shiftBy(placed, [vec[0] - step[0], vec[1] - step[1]]), reflect), mistake: "offByOne" },
      ],
      w,
      h,
    );
    return { type: "shift", form: "draw", seed, level, figure: placed, vec, ops, w, h, answer, slips };
  }

  // Draw the slide: one direction (level 1) or two (level 2).
  let vec: Pt;
  if (level === 1) {
    const axisX = rng() < 0.55;
    const k = between(rng, Math.max(2, axisX ? fw : fh), axisX ? 6 : 4) * pick(rng, [-1, 1]);
    vec = axisX ? [k, 0] : [0, k];
  } else vec = [pick(rng, [-1, 1]) * between(rng, 1, 5), pick(rng, [-1, 1]) * between(rng, 1, 4)];
  const at = placeFor(rng, fw, fh, vec, w, h);
  if (!at) return null;
  const placed = shiftBy(figure, at);
  const end = shiftBy(placed, vec);
  if (!apart(placed, end)) return null;
  const answer = keysOf(end);
  const slips = slipPictures(
    answer,
    slideSlips(vec, fw, fh).map((s) => ({ f: shiftBy(placed, s.by), mistake: s.mistake })),
    w,
    h,
  );
  return { type: "shift", form: "draw", seed, level, figure: placed, vec, ops: shiftLegs(vec), w, h, answer, slips };
}

export function makeTransformQuestion(type: TransformQuestionType, level: Level, seed: number): TransformQuestion {
  const rng = mulberry32(seed);
  const setup = SETUP[level];
  for (let attempt = 0; attempt < 400; attempt++) {
    const n = setup.cells[0] + randInt(rng, setup.cells[1] - setup.cells[0] + 1);
    const figure = randomFigure(rng, n, setup.box, setup.mark);
    if (!allDifferent(figure)) continue;
    // Coloured answers need figures whose cells alone show every turn and flip.
    if ((type === "shift" || (type === "draw" && level > 1)) && !chiralCells(figure.cells)) continue;

    if (type === "shift") {
      const q = shiftQuestion(rng, level, seed, figure);
      if (q) return q;
      continue;
    }

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
    // From level 2 the letter stays on the figure, so the image's orientation can be seen after checking.
    return { type, seed, level, figure: level === 1 ? { cells: placed.cells } : placed, op, w, h, answer: image.cells.map(cellKey).sort() };
  }
  throw new Error("no question");
}

// ---------------------------------------------------------------------------
// Checking a coloured answer.

export type PaintMistake =
  | "right"
  /** Not as many cells as the image. */
  | "count"
  | ShiftMistake
  /** Right picture, wrong place. */
  | "place"
  /** Only moved: not flipped or turned at all. */
  | "unchanged"
  | "turnForFlip"
  | "flipForTurn"
  | "otherTurn"
  | "otherReflection"
  /** A slide that turned or flipped the shape. */
  | "notSlid"
  /** Not the figure's shape in any orientation. */
  | "shape";

const cellsOfKeys = (keys: readonly string[]): Pt[] => keys.map((k) => k.split(",").map((v) => Number(v) + 0.5) as Pt);

/** What a coloured answer is: right, a known slip, or which move it looks like. */
export function paintMistake(q: PaintQuestion, painted: readonly string[]): PaintMistake {
  const sorted = [...painted].sort();
  if (sorted.join(";") === q.answer.join(";")) return "right";
  if (sorted.length !== q.answer.length) return "count";
  if (q.type === "shift") {
    const slip = q.slips.find((s) => s.cells.join(";") === sorted.join(";"));
    if (slip) return slip.mistake;
  }
  const key = shapeKey({ cells: cellsOfKeys(sorted) });
  const ops = paintOps(q);
  const right = ops.reduce<Mat>((m, op) => mul(opAt(op).m.map((v) => Math.round(v)) as Mat, m), IDENTITY);
  if (orientedKey(q.figure.cells, right) === key) return "place";
  const m = ORIENTS.find((o) => orientedKey(q.figure.cells, o) === key);
  if (!m) return "shape";
  if (sameMat(m, IDENTITY)) return q.type === "shift" && !isFlipMat(right) ? "place" : "unchanged";
  if (sameMat(right, IDENTITY)) return "notSlid";
  if (isFlipMat(right) !== isFlipMat(m)) return isFlipMat(right) ? "turnForFlip" : "flipForTurn";
  return isFlipMat(right) ? "otherReflection" : "otherTurn";
}

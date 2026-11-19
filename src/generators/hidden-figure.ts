// Tool 5, "hidden figure": a small shape is hidden in one of four line
// drawings, at the same size and turned the same way, with every side lying
// on the drawing's lines. Lines run sideways, up or at 45°, between points of
// a lattice; coordinates here are doubled (one drawing unit = 2), so the
// crossing of two diagonals of a cell is a lattice point too. A side is on
// the drawing when every unit step of it is part of a drawn line, which makes
// the search exact.

import { mulberry32, pick, randInt, shuffle, type Rng } from "./random";

export type HPt = [number, number];
export type HSeg = [HPt, HPt];
export type Level = 1 | 2 | 3;

/** Unit steps of a straight line (sideways, up or 45°), as keys. */
function stepsOf([p, q]: HSeg): string[] {
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const n = Math.max(Math.abs(dx), Math.abs(dy));
  if (n === 0) return [];
  if (!(dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))) throw new Error("line must be straight or 45°");
  const [ux, uy] = [dx / n, dy / n];
  const out: string[] = [];
  for (let k = 0; k < n; k++) {
    const a: HPt = [p[0] + ux * k, p[1] + uy * k];
    const b: HPt = [a[0] + ux, a[1] + uy];
    // Same key whichever way the step is walked.
    out.push(a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]) ? `${a[0]},${a[1]},${b[0]},${b[1]}` : `${b[0]},${b[1]},${a[0]},${a[1]}`);
  }
  return out;
}

export const sidesOf = (poly: HPt[]): HSeg[] => poly.map((p, i) => [p, poly[(i + 1) % poly.length]]);

/** All unit steps of a drawing. */
export const stepSet = (segs: HSeg[]) => new Set(segs.flatMap(stepsOf));

const bbox = (pts: HPt[]) => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
};

const shift = (poly: HPt[], [dx, dy]: HPt): HPt[] => poly.map(([x, y]) => [x + dx, y + dy]);

/** A drawing ready for searching: its unit steps and box. */
interface Prepared {
  have: Set<string>;
  box: ReturnType<typeof bbox>;
}
const prepare = (drawing: HSeg[]): Prepared => ({ have: stepSet(drawing), box: bbox(drawing.flat()) });

function placementsIn({ have, box: d }: Prepared, shape: HPt[]): HPt[] {
  const s = bbox(shape);
  const out: HPt[] = [];
  for (let dy = d.y0 - s.y0; dy + s.y1 <= d.y1; dy++)
    for (let dx = d.x0 - s.x0; dx + s.x1 <= d.x1; dx++) {
      const sides = sidesOf(shift(shape, [dx, dy]));
      if (sides.every((side) => stepsOf(side).every((k) => have.has(k)))) out.push([dx, dy]);
    }
  return out;
}

/** Every shift that puts the whole shape on the drawing's lines. */
export const placements = (drawing: HSeg[], shape: HPt[]): HPt[] => placementsIn(prepare(drawing), shape);

/** Shifts where all sides but one are on the lines (the missing one is returned). */
export function nearPlacements(drawing: HSeg[], shape: HPt[]): { at: HPt; missing: number }[] {
  const have = stepSet(drawing);
  const d = bbox(drawing.flat());
  const s = bbox(shape);
  const out: { at: HPt; missing: number }[] = [];
  for (let dy = d.y0 - s.y0; dy + s.y1 <= d.y1; dy++)
    for (let dx = d.x0 - s.x0; dx + s.x1 <= d.x1; dx++) {
      const sides = sidesOf(shift(shape, [dx, dy]));
      const off = sides.map((side, i) => (stepsOf(side).every((k) => have.has(k)) ? -1 : i)).filter((i) => i >= 0);
      if (off.length === 1) out.push({ at: [dx, dy], missing: off[0] });
    }
  return out;
}

// --- Turning, flipping and resizing a shape ---

export type Change = "rot90" | "rot180" | "rot270" | "flip" | "flipRot90" | "flipRot180" | "flipRot270" | "double";

const MAP: Record<Change, (p: HPt) => HPt> = {
  rot90: ([x, y]) => [-y, x],
  rot180: ([x, y]) => [-x, -y],
  rot270: ([x, y]) => [y, -x],
  flip: ([x, y]) => [-x, y],
  flipRot90: ([x, y]) => [-y, -x],
  flipRot180: ([x, y]) => [x, -y],
  flipRot270: ([x, y]) => [y, x],
  double: ([x, y]) => [2 * x, 2 * y],
};

/** The shape moved so its box starts at 0, 0. */
export const normal = (poly: HPt[]): HPt[] => {
  const b = bbox(poly);
  return shift(poly, [-b.x0, -b.y0]);
};

export const changed = (poly: HPt[], c: Change) => normal(poly.map(MAP[c]));

/** Same outline (as a set of unit steps), wherever it is. */
const outlineKey = (poly: HPt[]) => [...stepSet(sidesOf(normal(poly)))].sort().join(";");
export const sameShape = (a: HPt[], b: HPt[]) => outlineKey(a) === outlineKey(b);

const ROTATIONS: Change[] = ["rot90", "rot180", "rot270"];
const FLIPS: Change[] = ["flip", "flipRot90", "flipRot180", "flipRot270"];

/** Turns and flips that give a different-looking shape; a flip that equals a turn counts as a turn. */
const changesCache = new Map<string, { rotated: Change[]; flipped: Change[] }>();

export function distinctChanges(shape: HPt[]): { rotated: Change[]; flipped: Change[] } {
  const key = JSON.stringify(shape);
  const hit = changesCache.get(key);
  if (hit) return hit;
  const found = findChanges(shape);
  changesCache.set(key, found);
  return found;
}

function findChanges(shape: HPt[]): { rotated: Change[]; flipped: Change[] } {
  const rotated = ROTATIONS.filter((c) => !sameShape(changed(shape, c), shape));
  const flipped = FLIPS.filter((c) => {
    const f = changed(shape, c);
    return !sameShape(f, shape) && !ROTATIONS.some((r) => sameShape(f, changed(shape, r)));
  });
  return { rotated, flipped };
}

// --- The shapes (in drawing units; doubled when used) ---

export type ShapeName = "corner" | "wedge" | "roof" | "house" | "step" | "chevron" | "slant" | "trapezoid" | "ell" | "flag";

const SHAPES: Record<ShapeName, HPt[]> = {
  corner: [[0, 0], [1, 0], [0, 1]],
  roof: [[0, 0], [2, 0], [1, 1]],
  house: [[0, 0], [2, 0], [2, 1], [1, 2], [0, 1]],
  step: [[0, 0], [2, 0], [2, 1], [1, 1]],
  wedge: [[0, 0], [2, 0], [2, 2]],
  chevron: [[0, 0], [1, 1], [2, 0], [2, 1], [1, 2], [0, 1]],
  slant: [[0, 0], [2, 0], [3, 1], [1, 1]],
  trapezoid: [[0, 0], [3, 0], [2, 1], [1, 1]],
  ell: [[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2]],
  flag: [[0, 0], [1, 0], [2, 1], [1, 2], [0, 2]],
};

export const SHAPE_NAME: Record<ShapeName, string> = {
  corner: "مثلث قائم کوچک",
  wedge: "مثلث قائم",
  roof: "مثلث سقف",
  house: "خانه",
  step: "پله",
  chevron: "پیکان",
  slant: "متوازی‌الاضلاع",
  trapezoid: "ذوزنقه",
  ell: "شکل L",
  flag: "پرچم",
};

export const shapeOf = (name: ShapeName): HPt[] => SHAPES[name].map(([x, y]) => [2 * x, 2 * y]);

// --- Drawings ---

const inFrame = (p: HPt, n: number) => p[0] >= 0 && p[1] >= 0 && p[0] <= 2 * n && p[1] <= 2 * n;

const DIRS: HPt[] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

/** A random line: a full chord across the frame, or a short piece. Ends on drawing points. */
function randomLine(rng: Rng, n: number): HSeg | null {
  const p: HPt = [2 * randInt(rng, n + 1), 2 * randInt(rng, n + 1)];
  const [ux, uy] = pick(rng, DIRS).map((v) => 2 * v) as HPt;
  const long = rng() < 0.4;
  const len = long ? 2 * n : 1 + randInt(rng, 2);
  const walk = (sgn: number, max: number) => {
    let k = 0;
    while (k < max && inFrame([p[0] + sgn * ux * (k + 1), p[1] + sgn * uy * (k + 1)], n)) k++;
    return k;
  };
  const fwd = walk(1, len);
  const back = long ? walk(-1, len) : 0;
  if (fwd + back === 0) return null;
  return [
    [p[0] - back * ux, p[1] - back * uy],
    [p[0] + fwd * ux, p[1] + fwd * uy],
  ];
}

/** A random spot for a shape inside the frame (on drawing points). */
function place(rng: Rng, shape: HPt[], n: number): HPt[] | null {
  const b = bbox(shape);
  const fx = 2 * n - b.x1;
  const fy = 2 * n - b.y1;
  if (fx < 0 || fy < 0) return null;
  return shift(shape, [2 * randInt(rng, fx / 2 + 1), 2 * randInt(rng, fy / 2 + 1)]);
}

const frameLines = (n: number): HSeg[] => sidesOf([[0, 0], [2 * n, 0], [2 * n, 2 * n], [0, 2 * n]]);

/** A drawing built around `embed` (closed shape, or open path when `open`), with extra lines. */
function drawingAround(rng: Rng, embed: HPt[], n: number, extras: number, frame: boolean, open = -1): HSeg[] | null {
  const at = place(rng, embed, n);
  if (!at) return null;
  const segs: HSeg[] = sidesOf(at).filter((_, i) => i !== open);
  if (frame) segs.push(...frameLines(n));
  for (let k = 0, guard = 0; k < extras && guard < 50; guard++) {
    const l = randomLine(rng, n);
    if (l) {
      segs.push(l);
      k++;
    }
  }
  return segs;
}

// --- Questions ---

export type HiddenTag = "rotated" | "flipped" | "size" | "nearMiss";

export interface HiddenQuestion {
  type: "hidden";
  level: Level;
  seed: number;
  shapeName: ShapeName;
  /** The shape to find (doubled units, box from 0, 0). */
  shape: HPt[];
  /** Drawing frame size, in drawing units. */
  n: number;
  options: HSeg[][];
  mistakes: (HiddenTag | null)[];
  answer: number;
}

/** What a wrong drawing does have instead, and where (for showing it). */
export function slipOf(drawing: HSeg[], shape: HPt[]): { tag: HiddenTag; poly: HPt[]; missing?: number } | null {
  const { rotated, flipped } = distinctChanges(shape);
  const prepared = prepare(drawing);
  for (const [tag, list] of [
    ["rotated", rotated],
    ["flipped", flipped],
    ["size", ["double"] as Change[]],
  ] as const) {
    for (const c of list) {
      const s = changed(shape, c);
      const at = placementsIn(prepared, s)[0];
      if (at) return { tag, poly: shift(s, at) };
    }
  }
  const near = nearPlacements(drawing, shape)[0];
  if (near) return { tag: "nearMiss", poly: shift(shape, near.at), missing: near.missing };
  return null;
}

const LEVEL_SHAPES: Record<Level, ShapeName[]> = {
  1: ["corner", "roof", "step", "house"],
  2: ["wedge", "chevron", "step", "slant", "house", "trapezoid"],
  3: ["chevron", "slant", "ell", "flag", "trapezoid", "step"],
};

const SETUP: Record<Level, { n: number; extras: [number, number]; frame: boolean }> = {
  1: { n: 4, extras: [2, 3], frame: false },
  2: { n: 4, extras: [4, 5], frame: true },
  3: { n: 4, extras: [5, 7], frame: true },
};

/** The kinds of wrong drawing, by level; each wrong drawing has one of these hidden in it. */
function wrongPlan(rng: Rng, level: Level, shape: HPt[], n: number): HiddenTag[] {
  const { rotated, flipped } = distinctChanges(shape);
  const fitsDouble = bbox(changed(shape, "double")).x1 <= 2 * n && bbox(changed(shape, "double")).y1 <= 2 * n;
  const can: HiddenTag[] = [...(rotated.length ? ["rotated" as const] : []), ...(flipped.length ? ["flipped" as const] : []), ...(fitsDouble ? ["size" as const] : []), "nearMiss"];
  if (level === 1) return shuffle(rng, [can[0], fitsDouble ? "size" : can[0], "nearMiss"]);
  if (level === 2) return shuffle(rng, [rotated.length ? "rotated" : can[0], fitsDouble ? "size" : "nearMiss", "nearMiss"]);
  // Level 3: turned and flipped near-misses.
  return shuffle(rng, [rotated.length ? "rotated" : can[0], flipped.length ? "flipped" : rotated.length ? "rotated" : "nearMiss", "nearMiss"]);
}

export function makeHiddenQuestion(level: Level, seed: number): HiddenQuestion {
  const rng = mulberry32(seed * 17 + level * 389 + 11);
  const setup = SETUP[level];
  const n = setup.n;
  const extrasCount = () => setup.extras[0] + randInt(rng, setup.extras[1] - setup.extras[0] + 1);
  for (let attempt = 0; ; attempt++) {
    if (attempt > 50) throw new Error("no hidden-figure question");
    const shapeName = pick(rng, LEVEL_SHAPES[level]);
    const shape = shapeOf(shapeName);
    const { rotated, flipped } = distinctChanges(shape);

    let right: HSeg[] | null = null;
    for (let t = 0; t < 30 && !right; t++) {
      const d = drawingAround(rng, shape, n, extrasCount(), setup.frame);
      // Hidden once, so the showing is clear.
      if (d && placements(d, shape).length === 1) right = d;
    }
    if (!right) continue;

    const wrong: { d: HSeg[]; tag: HiddenTag }[] = [];
    for (const tag of wrongPlan(rng, level, shape, n)) {
      let made: HSeg[] | null = null;
      for (let t = 0; t < 40 && !made; t++) {
        let d: HSeg[] | null = null;
        if (tag === "nearMiss") d = drawingAround(rng, shape, n, extrasCount(), setup.frame, randInt(rng, shape.length));
        else {
          const c: Change = tag === "rotated" ? pick(rng, rotated) : tag === "flipped" ? pick(rng, flipped) : "double";
          d = drawingAround(rng, changed(shape, c), n, extrasCount(), setup.frame);
        }
        // Not hidden there, and the slip it is meant for is what a child would find.
        if (d && placements(d, shape).length === 0 && slipOf(d, shape)?.tag === tag) made = d;
      }
      if (!made) break;
      wrong.push({ d: made, tag });
    }
    if (wrong.length < 3) continue;

    const all = [{ d: right, tag: null }, ...wrong];
    const order = shuffle(rng, [0, 1, 2, 3]);
    return {
      type: "hidden",
      level,
      seed,
      shapeName,
      shape,
      n,
      options: order.map((i) => all[i].d),
      mistakes: order.map((i) => all[i].tag),
      answer: order.indexOf(0),
    };
  }
}

/** Where the shape is in the right drawing (for showing it). */
export const hiddenAt = (q: HiddenQuestion): HPt[] => shift(q.shape, placements(q.options[q.answer], q.shape)[0]);

/** For exploring: a shape on tracing paper, moved to `at` and maybe turned/flipped. */
export function traced(shape: HPt[], at: HPt, change: Change | null): HPt[] {
  return shift(change ? changed(shape, change) : normal(shape), at);
}

/** Which sides of a placed shape are not on the drawing. */
export function missingSides(drawing: HSeg[], poly: HPt[]): number[] {
  const have = stepSet(drawing);
  return sidesOf(poly)
    .map((side, i) => (stepsOf(side).every((k) => have.has(k)) ? -1 : i))
    .filter((i) => i >= 0);
}

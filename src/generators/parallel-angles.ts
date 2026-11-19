// Tool 16, «خطوط موازی و زاویه»: angles where a slanted line (مورب) cuts
// parallel lines, together with the straight-line (۱۸۰°), around-a-point
// (۳۶۰°) and triangle-sum (۱۸۰°) facts.
//
// Level 1: one transversal across two parallel lines; one angle given, find
//          another with one fact (opposite, side by side on a straight line,
//          same place at the other crossing, or a «Z» pair).
// Level 2: two facts in a row (parallel then straight line or opposite),
//          parallel + triangle sum, or three lines of which only two are
//          marked parallel (the third one's angle is a trap).
// Level 3: a zig-zag between the parallels (the bend is the sum of the two
//          end angles, its outside is 360° minus that), or two transversals
//          meeting on one line and forming a triangle (three facts).
//
// Every figure is real geometry (y grows downwards): each angle's value can
// be recomputed from its corner and arms, and the "show me" chain only uses
// the printed angles and the parallel marks. Angles are whole degrees.

import { mulberry32, pick, randInt, type Rng } from "./random";

export type Level = 1 | 2 | 3;
export type XY = [number, number];

export type ParallelVariant =
  // level 1
  | "vertical"
  | "linear"
  | "corresponding"
  | "alternate"
  // level 2
  | "crossSupp"
  | "crossEqual"
  | "triApex"
  | "triBase"
  | "decoy"
  // level 3
  | "zigzag"
  | "zigzagArm"
  | "zigzagOut"
  | "twoTransBase"
  | "twoTransApex";

export const PARALLEL_VARIANTS: Record<Level, ParallelVariant[]> = {
  1: ["vertical", "linear", "corresponding", "alternate"],
  2: ["crossSupp", "crossEqual", "triApex", "triBase", "decoy"],
  3: ["zigzag", "zigzagArm", "zigzagOut", "twoTransBase", "twoTransApex"],
};

/**
 * par: one of the parallel lines (marked with `arrows` chevrons); trans: a
 * slanted line (or a side of the zig-zag); plain: a line NOT parallel to the
 * others (no marks); helper: the dashed parallel that "show me" draws.
 */
export interface PLine {
  a: XY;
  b: XY;
  kind: "par" | "trans" | "plain" | "helper";
  arrows: number;
}

/** A named point (a crossing, a corner); `off` is the unit direction to its letter. */
export interface PPoint {
  name: string;
  at: XY;
  off: XY;
}

/**
 * An angle at corner v between the arms v→p and v→q (p, q one unit away).
 * reflex: the big angle (more than 180°) outside the two arms.
 * given: printed; ask: «؟»; hidden: shown only when "show me" finds it.
 */
export interface PAngle {
  id: string;
  at: string;
  v: XY;
  p: XY;
  q: XY;
  deg: number;
  reflex: boolean;
  role: "given" | "ask" | "hidden";
}

export interface ParallelFigure {
  lines: PLine[];
  points: PPoint[];
  angles: PAngle[];
}

/**
 * vertical: opposite angles at a crossing; linear: side by side on a straight
 * line (sum 180); corresponding: the same place at the other crossing;
 * alternate: the «Z» pair between the parallels; triangle: the third angle;
 * helper: draw a parallel through the bend; parts: an angle made of two
 * parts (sum, or the whole minus a part); point: round a point (sum 360).
 */
export type Fact = "vertical" | "linear" | "corresponding" | "alternate" | "triangle" | "helper" | "parts" | "point";

export interface PStep {
  fact: Fact;
  from: string[];
  /** The angle found (null for "helper"). */
  to: string | null;
  value: number;
}

export type ParallelTag =
  | "equalNotSupp"
  | "suppNotEqual"
  | "notParallel"
  | "added"
  | "sum360"
  | "subtracted"
  | "asTriangle"
  | "insideBend"
  | "pointAs180";

export interface ParallelSlip {
  tag: ParallelTag;
  value: number;
}

export interface ParallelQuestion {
  type: "parallel";
  level: Level;
  seed: number;
  variant: ParallelVariant;
  fig: ParallelFigure;
  steps: PStep[];
  /** The angle marked «؟». */
  ask: string;
  answer: number;
  slips: ParallelSlip[];
}

// ── Geometry ─────────────────────────────────────────────────────────────

const rad = (d: number) => (d * Math.PI) / 180;
const dirOf = (deg: number): XY => [Math.cos(rad(deg)), Math.sin(rad(deg))];
const add = (a: XY, b: XY, k = 1): XY => [a[0] + b[0] * k, a[1] + b[1] * k];
const neg = (a: XY): XY => [-a[0], -a[1]];
export const unitOf = (a: XY): XY => {
  const l = Math.hypot(a[0], a[1]) || 1;
  return [a[0] / l, a[1] / l];
};

/** The angle at v between v→p and v→q, in degrees (the big one when reflex). */
export function angleOf(v: XY, p: XY, q: XY, reflex = false): number {
  const u = [p[0] - v[0], p[1] - v[1]];
  const w = [q[0] - v[0], q[1] - v[1]];
  const d = (Math.atan2(Math.abs(u[0] * w[1] - u[1] * w[0]), u[0] * w[0] + u[1] * w[1]) * 180) / Math.PI;
  return reflex ? 360 - d : d;
}

/** An angle mark with arms along directions u and w from v. */
function mark(id: string, at: string, v: XY, u: XY, w: XY, role: PAngle["role"] = "hidden", reflex = false): PAngle {
  const p = add(v, unitOf(u));
  const q = add(v, unitOf(w));
  return { id, at, v, p, q, deg: Math.round(angleOf(v, p, q, reflex)), reflex, role };
}

/**
 * The four angles at a crossing of a line (direction d) and a transversal
 * (direction t, from the first line towards the next): 0 between +d and +t,
 * then round: 1 (+t, −d), 2 (−d, −t), 3 (−t, +d). 0 and 2 are opposite.
 */
function crossingAngles(name: string, X: XY, d: XY, t: XY): PAngle[] {
  const rays: [XY, XY][] = [
    [d, t],
    [t, neg(d)],
    [neg(d), neg(t)],
    [neg(t), d],
  ];
  return rays.map(([u, w], i) => mark(`${name}${i}`, name, X, u, w));
}

/** Turn and mirror the whole figure (angle values do not change). */
function transform(fig: ParallelFigure, mirror: boolean, turn: number): ParallelFigure {
  const [c, s] = [Math.cos(rad(turn)), Math.sin(rad(turn))];
  const pt = ([x, y]: XY): XY => {
    const mx = mirror ? -x : x;
    return [c * mx - s * y, s * mx + c * y];
  };
  return {
    lines: fig.lines.map((l) => ({ ...l, a: pt(l.a), b: pt(l.b) })),
    points: fig.points.map((p) => ({ ...p, at: pt(p.at) })),
    angles: fig.angles.map((a) => ({ ...a, v: pt(a.v), p: pt(a.p), q: pt(a.q) })),
  };
}

/** Put each point's letter in the widest gap between the lines and angle marks there. */
function placeLetters(fig: ParallelFigure): ParallelFigure {
  const points = fig.points.map((P) => {
    const taken: number[] = [];
    for (const l of fig.lines) {
      for (const [e, o] of [
        [l.a, l.b],
        [l.b, l.a],
      ] as [XY, XY][]) {
        // A line through P (not just ending there) leaves in both directions.
        const along = Math.hypot(e[0] - P.at[0], e[1] - P.at[1]);
        if (along < 1e-6) continue;
        const cross = Math.abs((o[0] - e[0]) * (P.at[1] - e[1]) - (o[1] - e[1]) * (P.at[0] - e[0])) / (Math.hypot(o[0] - e[0], o[1] - e[1]) || 1);
        const within = (P.at[0] - e[0]) * (o[0] - e[0]) + (P.at[1] - e[1]) * (o[1] - e[1]) >= -1e-6;
        if (cross < 1e-6 && within) taken.push(Math.atan2(e[1] - P.at[1], e[0] - P.at[0]));
      }
    }
    for (const a of fig.angles) {
      if (a.at !== P.name) continue;
      const u = unitOf([a.p[0] - a.v[0], a.p[1] - a.v[1]]);
      const w = unitOf([a.q[0] - a.v[0], a.q[1] - a.v[1]]);
      let b: XY = unitOf([u[0] + w[0], u[1] + w[1]]);
      if (a.reflex) b = neg(b);
      taken.push(Math.atan2(b[1], b[0]));
    }
    let best = 0;
    let bestGap = -1;
    for (let k = 0; k < 72; k++) {
      const t = (k * Math.PI) / 36;
      const gap = Math.min(...taken.map((x) => Math.abs(Math.atan2(Math.sin(t - x), Math.cos(t - x)))));
      if (gap > bestGap + 1e-9) {
        bestGap = gap;
        best = t;
      }
    }
    return { ...P, off: [Math.cos(best), Math.sin(best)] as XY };
  });
  return { ...fig, points };
}

/** Whole-degree angle in a range, not near a right angle (so x and 180 − x look different). */
function slant(rng: Rng, lo: number, hi: number): number {
  for (;;) {
    const v = lo + randInt(rng, hi - lo + 1);
    if (Math.abs(v - 90) >= 12) return v;
  }
}

const between = (rng: Rng, lo: number, hi: number) => lo + randInt(rng, hi - lo + 1);

/** Keep slips that are whole, between 1 and 359, not the answer, and not repeated. */
function cleanSlips(answer: number, list: [ParallelTag, number][]): ParallelSlip[] {
  const out: ParallelSlip[] = [];
  for (const [tag, value] of list) {
    if (!Number.isInteger(value) || value <= 0 || value >= 360 || value === answer || out.some((s) => s.value === value)) continue;
    out.push({ tag, value });
  }
  return out;
}

// ── Lines cut by one transversal (levels 1 and 2) ────────────────────────

const GAP = 3.6;
const OVER = 2.4;
const NAMES = ["A", "B", "C"];

/**
 * Lines k = 0 … count−1, each GAP apart along the transversal's normal, with
 * the transversal at `phi` to them. `odd`: that line is turned by `tilt`
 * degrees about its crossing (not parallel, no marks).
 */
function transversalFigure(count: number, phi: number, odd = -1, tilt = 0) {
  const t = dirOf(phi);
  const d: XY = [1, 0];
  const X: XY[] = Array.from({ length: count }, (_, k) => add([0, 0], t, (k * GAP) / Math.sin(rad(phi))));
  const xs = X.map((p) => p[0]);
  const [lo, hi] = [Math.min(...xs) - OVER, Math.max(...xs) + OVER];
  const lines: PLine[] = [];
  const angles: PAngle[] = [];
  X.forEach((p, k) => {
    if (k === odd) {
      const dd = dirOf(tilt);
      lines.push({ a: add(p, dd, lo - p[0]), b: add(p, dd, hi - p[0]), kind: "plain", arrows: 0 });
      angles.push(...crossingAngles(NAMES[k], p, dd, t));
    } else {
      lines.push({ a: [lo, p[1]], b: [hi, p[1]], kind: "par", arrows: 1 });
      angles.push(...crossingAngles(NAMES[k], p, d, t));
    }
  });
  lines.push({ a: add(X[0], t, -1.8), b: add(X[count - 1], t, 1.8), kind: "trans", arrows: 0 });
  const points: PPoint[] = X.map((p, k) => ({ name: NAMES[k], at: p, off: [0, -1] }));
  return { lines, angles, points };
}

const id = (k: number, i: number) => `${NAMES[k]}${((i % 4) + 4) % 4}`;

interface Built {
  fig: ParallelFigure;
  steps: PStep[];
  ask: string;
  answer: number;
  slips: [ParallelTag, number][];
}

function withRoles(angles: PAngle[], given: string[], ask: string): PAngle[] {
  return angles.map((a) => ({ ...a, role: given.includes(a.id) ? "given" : a.id === ask ? "ask" : "hidden" }));
}

/** Only the angles a figure mentions are kept (the rest of the 8 stay unmarked). */
function keep(angles: PAngle[], steps: PStep[], given: string[], ask: string) {
  const used = new Set([...given, ask, ...steps.flatMap((s) => [...s.from, ...(s.to ? [s.to] : [])])]);
  return angles.filter((a) => used.has(a.id));
}

function level1(rng: Rng, variant: ParallelVariant): Built {
  const phi = slant(rng, 35, 145);
  const { lines, angles, points } = transversalFigure(2, phi);
  const val = (k: number, i: number) => angles.find((a) => a.id === id(k, i))!.deg;
  let g = randInt(rng, 2);
  let i = randInt(rng, 4);
  let k = g;
  let j = i;
  let fact: Fact;
  switch (variant) {
    case "vertical":
      j = i + 2;
      fact = "vertical";
      break;
    case "linear":
      j = i + (rng() < 0.5 ? 1 : 3);
      fact = "linear";
      break;
    case "corresponding":
      k = 1 - g;
      fact = "corresponding";
      break;
    default:
      // «Z»: the angles between the lines (below the top crossing, above the bottom one).
      g = randInt(rng, 2);
      i = g === 0 ? randInt(rng, 2) : 2 + randInt(rng, 2);
      k = 1 - g;
      j = i + 2;
      fact = "alternate";
  }
  const given = id(g, i);
  const ask = id(k, j);
  const x = val(g, i);
  const answer = val(k, j);
  const steps: PStep[] = [{ fact, from: [given], to: ask, value: answer }];
  const slips: [ParallelTag, number][] = answer === x ? [["suppNotEqual", 180 - x]] : [["equalNotSupp", x], ["added", 180 + x]];
  return { fig: { lines, points, angles: withRoles(keep(angles, steps, [given], ask), [given], ask) }, steps, ask, answer, slips };
}

/** Parallel to the other crossing (same place), then a second fact there. */
function chain(k: number, i: number, other: number, j: number, val: (k: number, i: number) => number): PStep[] {
  const steps: PStep[] = [{ fact: "corresponding", from: [id(k, i)], to: id(other, i), value: val(other, i) }];
  if ((j - i + 4) % 4 === 2) steps.push({ fact: "vertical", from: [id(other, i)], to: id(other, j), value: val(other, j) });
  else if (j !== i) steps.push({ fact: "linear", from: [id(other, i)], to: id(other, j), value: val(other, j) });
  return steps;
}

function crossChain(rng: Rng, variant: "crossSupp" | "crossEqual"): Built {
  const phi = slant(rng, 35, 145);
  const { lines, angles, points } = transversalFigure(2, phi);
  const val = (k: number, i: number) => angles.find((a) => a.id === id(k, i))!.deg;
  const g = randInt(rng, 2);
  const i = randInt(rng, 4);
  const j = variant === "crossEqual" ? i + 2 : i + (rng() < 0.5 ? 1 : 3);
  const given = id(g, i);
  const ask = id(1 - g, j);
  const steps = chain(g, i, 1 - g, ((j % 4) + 4) % 4, val);
  const x = val(g, i);
  const answer = val(1 - g, j);
  const slips: [ParallelTag, number][] = answer === x ? [["suppNotEqual", 180 - x]] : [["equalNotSupp", x], ["added", 180 + x]];
  return { fig: { lines, points, angles: withRoles(keep(angles, steps, [given], ask), [given], ask) }, steps, ask, answer, slips };
}

function decoy(rng: Rng): Built | null {
  const phi = slant(rng, 50, 130);
  const tilt = (rng() < 0.5 ? 1 : -1) * between(rng, 10, 14);
  const odd = randInt(rng, 3);
  const { lines, angles, points } = transversalFigure(3, phi, odd, tilt);
  const val = (k: number, i: number) => angles.find((a) => a.id === id(k, i))!.deg;
  const pair = [0, 1, 2].filter((k) => k !== odd);
  const [g, k] = rng() < 0.5 ? pair : [pair[1], pair[0]];
  const i = randInt(rng, 4);
  const j = (i + randInt(rng, 4)) % 4;
  const given = id(g, i);
  const ask = id(k, j);
  const trap = id(odd, j);
  const steps = chain(g, i, k, j, val);
  const x = val(g, i);
  const answer = val(k, j);
  const w = val(odd, j);
  // The trap must not also be another slip (or the answer), or the feedback could not tell them apart.
  if (w === answer || w === 180 - answer || w === x || Math.min(w, x, answer) < 25 || Math.max(w, x, answer) > 155) return null;
  const slips: [ParallelTag, number][] = [["notParallel", w], answer === x ? ["suppNotEqual", 180 - x] : ["equalNotSupp", x]];
  const shown = keep(angles, steps, [given, trap], ask);
  return { fig: { lines, points, angles: withRoles(shown, [given, trap], ask) }, steps, ask, answer, slips };
}

// ── A triangle between the parallels (levels 2 and 3) ────────────────────

/**
 * P on the top line, A and B on the bottom line; base angles al (at A) and
 * be (at B). Angles: P_l (top line to the left, and PA) = al, P_r = be,
 * P_t (the corner of the triangle), A_i, B_i inside, A_o, B_o outside on the line.
 */
function triangleFigure(al: number, be: number) {
  const H = 4;
  const P: XY = [0, 0];
  const A: XY = [-H / Math.tan(rad(al)), H];
  const B: XY = [H / Math.tan(rad(be)), H];
  const lo = Math.min(A[0], P[0]) - OVER;
  const hi = Math.max(B[0], P[0]) + OVER;
  const d: XY = [1, 0];
  const lines: PLine[] = [
    { a: [lo, 0], b: [hi, 0], kind: "par", arrows: 1 },
    { a: [lo, H], b: [hi, H], kind: "par", arrows: 1 },
    { a: add(P, unitOf([P[0] - A[0], P[1] - A[1]]), 1.4), b: add(A, unitOf([A[0] - P[0], A[1] - P[1]]), 1.4), kind: "trans", arrows: 0 },
    { a: add(P, unitOf([P[0] - B[0], P[1] - B[1]]), 1.4), b: add(B, unitOf([B[0] - P[0], B[1] - P[1]]), 1.4), kind: "trans", arrows: 0 },
  ];
  const to = (a: XY, b: XY): XY => [b[0] - a[0], b[1] - a[1]];
  const angles: PAngle[] = [
    mark("Pl", "P", P, neg(d), to(P, A)),
    mark("Pr", "P", P, d, to(P, B)),
    mark("Pt", "P", P, to(P, A), to(P, B)),
    mark("Ai", "A", A, d, to(A, P)),
    mark("Bi", "B", B, neg(d), to(B, P)),
    mark("Ao", "A", A, neg(d), to(A, P)),
    mark("Bo", "B", B, d, to(B, P)),
  ];
  const points: PPoint[] = [
    { name: "P", at: P, off: [0, -1] },
    { name: "A", at: A, off: [0, 1] },
    { name: "B", at: B, off: [0, 1] },
  ];
  return { lines, angles, points };
}

function triangle(rng: Rng, variant: ParallelVariant): Built | null {
  const al = between(rng, 35, 100);
  const be = between(rng, 35, 100);
  const ga = 180 - al - be;
  if (ga < 25 || Math.abs(al - be) < 4) return null;
  // A base wide enough for the two base-angle numbers side by side, but not a flat sliver.
  const base = 4 / Math.tan((al * Math.PI) / 180) + 4 / Math.tan((be * Math.PI) / 180);
  if (base < 3.8 || base > 9) return null;
  const { lines, angles, points } = triangleFigure(al, be);
  let given: string[];
  let ask: string;
  let steps: PStep[];
  let answer: number;
  let slips: [ParallelTag, number][];
  switch (variant) {
    case "triApex":
      given = ["Pl", "Bi"];
      ask = "Pt";
      answer = ga;
      steps = [
        { fact: "alternate", from: ["Pl"], to: "Ai", value: al },
        { fact: "triangle", from: ["Ai", "Bi"], to: "Pt", value: ga },
      ];
      slips = [
        ["added", al + be],
        ["sum360", 360 - al - be],
        ["suppNotEqual", 180 - (180 - al) - be],
      ];
      break;
    case "triBase":
      given = ["Pl", "Pt"];
      ask = "Bi";
      answer = be;
      steps = [
        { fact: "alternate", from: ["Pl"], to: "Ai", value: al },
        { fact: "triangle", from: ["Ai", "Pt"], to: "Bi", value: be },
      ];
      slips = [
        ["added", al + ga],
        ["sum360", 360 - al - ga],
        ["suppNotEqual", 180 - (180 - al) - ga],
      ];
      break;
    case "twoTransBase": {
      // Outside angle at A and the corner at P given; the top-right angle asked.
      const e = 180 - al;
      given = ["Ao", "Pt"];
      ask = "Pr";
      answer = be;
      steps = [
        { fact: "linear", from: ["Ao"], to: "Ai", value: al },
        { fact: "triangle", from: ["Ai", "Pt"], to: "Bi", value: be },
        { fact: "alternate", from: ["Bi"], to: "Pr", value: be },
      ];
      slips = [
        ["equalNotSupp", 180 - e - ga],
        ["added", e + ga],
        ["sum360", 360 - al - ga],
        ["suppNotEqual", 180 - be],
      ];
      break;
    }
    default: {
      // twoTransApex: outside angle at A and the top-right angle given; the corner at P asked.
      const e = 180 - al;
      given = ["Ao", "Pr"];
      ask = "Pt";
      answer = ga;
      steps = [
        { fact: "linear", from: ["Ao"], to: "Ai", value: al },
        { fact: "alternate", from: ["Pr"], to: "Bi", value: be },
        { fact: "triangle", from: ["Ai", "Bi"], to: "Pt", value: ga },
      ];
      slips = [
        ["equalNotSupp", 180 - e - be],
        ["added", e + be],
        ["sum360", 360 - al - be],
        ["suppNotEqual", 180 - al - (180 - be)],
      ];
    }
  }
  return { fig: { lines, points, angles: withRoles(keep(angles, steps, given, ask), given, ask) }, steps, ask, answer, slips };
}

// ── Zig-zag between the parallels (level 3) ──────────────────────────────

/**
 * U on the top line, the bend M between the lines, D on the bottom line; the
 * bend opens towards +x. Ua: top line to the left and U→M (= a); Db: bottom
 * line to the left and D→M (= b); Mb: the bend (= a + b); Mo: its outside;
 * Mu, Md: the two parts of the bend cut by the helper parallel through M.
 */
function zigzagFigure(rng: Rng, a: number, b: number) {
  const H = 5;
  const my = H * (0.4 + 0.2 * rng());
  const M: XY = [0, my];
  const U: XY = [my / Math.tan(rad(a)), 0];
  const D: XY = [(H - my) / Math.tan(rad(b)), H];
  const lo = M[0] - OVER;
  const hi = Math.max(U[0], D[0]) + OVER;
  const d: XY = [1, 0];
  const to = (p: XY, q: XY): XY => [q[0] - p[0], q[1] - p[1]];
  const lines: PLine[] = [
    { a: [lo, 0], b: [hi, 0], kind: "par", arrows: 1 },
    { a: [lo, H], b: [hi, H], kind: "par", arrows: 1 },
    { a: U, b: M, kind: "trans", arrows: 0 },
    { a: M, b: D, kind: "trans", arrows: 0 },
    { a: [lo + 0.6, my], b: [hi - 0.6, my], kind: "helper", arrows: 1 },
  ];
  const angles: PAngle[] = [
    mark("Ua", "A", U, neg(d), to(U, M)),
    mark("Db", "C", D, neg(d), to(D, M)),
    mark("Mb", "B", M, to(M, U), to(M, D)),
    mark("Mo", "B", M, to(M, U), to(M, D), "hidden", true),
    mark("Mu", "B", M, d, to(M, U)),
    mark("Md", "B", M, d, to(M, D)),
  ];
  const points: PPoint[] = [
    { name: "A", at: U, off: [0, -1] },
    { name: "B", at: M, off: [-1, 0] },
    { name: "C", at: D, off: [0, 1] },
  ];
  return { lines, angles, points };
}

function zigzag(rng: Rng, variant: ParallelVariant): Built | null {
  const a = between(rng, 25, 75);
  const b = between(rng, 25, 75);
  if (a + b < 60 || a + b > 150 || Math.abs(a - b) < 6) return null;
  const { lines, angles, points } = zigzagFigure(rng, a, b);
  const helper: PStep = { fact: "helper", from: [], to: null, value: 0 };
  let given: string[];
  let ask: string;
  let steps: PStep[];
  let answer: number;
  let slips: [ParallelTag, number][];
  if (variant === "zigzagArm") {
    given = ["Ua", "Mb"];
    ask = "Db";
    answer = b;
    steps = [helper, { fact: "alternate", from: ["Ua"], to: "Mu", value: a }, { fact: "parts", from: ["Mb", "Mu"], to: "Md", value: b }, { fact: "alternate", from: ["Md"], to: "Db", value: b }];
    slips = [
      ["added", a + b + a],
      ["asTriangle", 180 - (a + b) - a],
      ["suppNotEqual", 180 - b],
    ];
  } else {
    given = ["Ua", "Db"];
    steps = [helper, { fact: "alternate", from: ["Ua"], to: "Mu", value: a }, { fact: "alternate", from: ["Db"], to: "Md", value: b }, { fact: "parts", from: ["Mu", "Md"], to: "Mb", value: a + b }];
    if (variant === "zigzagOut") {
      ask = "Mo";
      answer = 360 - a - b;
      steps.push({ fact: "point", from: ["Mb"], to: "Mo", value: answer });
      slips = [
        ["insideBend", a + b],
        ["pointAs180", 180 - a - b],
      ];
    } else {
      ask = "Mb";
      answer = a + b;
      slips = [
        ["subtracted", Math.abs(a - b)],
        ["asTriangle", 180 - a - b],
      ];
    }
  }
  // The bend's outside is only drawn when it is asked.
  const shown = keep(angles, steps, given, ask);
  return { fig: { lines, points, angles: withRoles(shown, given, ask) }, steps, ask, answer, slips };
}

// ── Questions ────────────────────────────────────────────────────────────

function once(rng: Rng, level: Level, seed: number): ParallelQuestion | null {
  const variant = pick(rng, PARALLEL_VARIANTS[level]);
  let built: Built | null;
  if (level === 1) built = level1(rng, variant);
  else if (variant === "crossSupp" || variant === "crossEqual") built = crossChain(rng, variant);
  else if (variant === "decoy") built = decoy(rng);
  else if (variant.startsWith("zigzag")) built = zigzag(rng, variant);
  else built = triangle(rng, variant);
  if (!built) return null;
  const slips = cleanSlips(built.answer, built.slips);
  if (!slips.length) return null;
  // Every printed or found angle readable: not too thin.
  if (built.fig.angles.some((a) => a.deg < 20)) return null;
  // Turn the figure a little (and the triangle sometimes upside down), and mirror it half the time.
  const big = variant.startsWith("tri") || variant.startsWith("twoTrans") ? (rng() < 0.3 ? 180 : 0) : 0;
  const turn = big + (level === 1 ? 0 : between(rng, -12, 12));
  const fig = placeLetters(transform(built.fig, rng() < 0.5, turn));
  return { type: "parallel", level, seed, variant, fig, steps: built.steps, ask: built.ask, answer: built.answer, slips };
}

export function makeParallelQuestion(level: Level, seed: number): ParallelQuestion {
  const rng = mulberry32(seed * 53 + level * 1031 + 180);
  for (;;) {
    const q = once(rng, level, seed);
    if (q) return q;
  }
}

/** Which slip an answer is, if any. */
export function parallelMistake(q: ParallelQuestion, value: number): ParallelTag | "right" | "other" {
  if (value === q.answer) return "right";
  return q.slips.find((s) => s.value === value)?.tag ?? "other";
}

export const angleById = (q: { fig: ParallelFigure }, id: string) => q.fig.angles.find((a) => a.id === id)!;

// ── Explore: one transversal, all eight angles ───────────────────────────

/** The explore board: two lines (the bottom one optionally turned) and a transversal at phi. */
export function exploreFigure(phi: number, tilt: number): ParallelFigure {
  const t = dirOf(phi);
  const M: XY = [0, 0];
  const A = add(M, t, -GAP / 2 / Math.sin(rad(phi)));
  const B = add(M, t, GAP / 2 / Math.sin(rad(phi)));
  const d: XY = [1, 0];
  const dd = dirOf(tilt);
  const W = 5.2;
  const lines: PLine[] = [
    { a: [-W, A[1]], b: [W, A[1]], kind: "par", arrows: tilt ? 0 : 1 },
    { a: add(B, dd, -W - B[0]), b: add(B, dd, W - B[0]), kind: tilt ? "plain" : "par", arrows: tilt ? 0 : 1 },
    { a: add(M, t, -4.6), b: add(M, t, 4.6), kind: "trans", arrows: 0 },
  ];
  const angles = [...crossingAngles("A", A, d, t), ...crossingAngles("B", B, dd, t)];
  return { lines, angles, points: [] };
}

// Tool 16, «دایره»: circumference and area with π taken as 3.14 (as in the
// grade 6 book), radius against diameter, half and quarter circles, and the
// perimeter of a semicircle (the curve and the straight edge). This file also
// holds the figure model shared with «مساحت ترکیبی» (composite-area.ts):
// a figure is signed parts (rectangles, triangles, circle sectors) whose
// signed areas add up to the shaded region, the edges that are drawn, and the
// lengths written on it.
//
// Level 1: a whole circle, radius or diameter given: circumference or area.
// Level 2: half and quarter circles (area, semicircle perimeter), or the
//          radius / diameter from the circumference.
// Level 3: perimeter of a quarter circle, area from the circumference, and
//          the ring between two circles.
//
// Every measure is kept exactly as lin + pi·π, so tests can check it against
// the true π, and the answer with 3.14 is worked out in hundredths: a question
// is only kept when its answer and every slip need at most two decimals.

import { mulberry32, pick, randInt, type Rng } from "./random";

export type Level = 1 | 2 | 3;
export type XY = [number, number];
export type Sign = 1 | -1;

/** y grows downwards; angles in degrees, 0 = right, 90 = down. */
export type Part =
  | { kind: "rect"; x: number; y: number; w: number; h: number; sign: Sign }
  | { kind: "tri"; pts: [XY, XY, XY]; sign: Sign }
  | { kind: "sector"; c: XY; r: number; from: number; sweep: number; sign: Sign };

export type Edge = { kind: "line"; a: XY; b: XY } | { kind: "arc"; c: XY; r: number; from: number; sweep: number };

/**
 * A length on the figure: the segment a–b and its value. `off` is the unit
 * direction from the segment to its number. `given`: written on the question;
 * `ask`: marked «؟»; otherwise hidden until "show me" works it out. `line`:
 * the segment itself is drawn (a radius, a diameter, a frame's width). `at`:
 * where along the segment the number sits (default the middle).
 */
export interface Dim {
  name: string;
  a: XY;
  b: XY;
  value: number;
  off: XY;
  given: boolean;
  ask?: boolean;
  line?: boolean;
  at?: number;
}

export interface Figure {
  parts: Part[];
  edges: Edge[];
  dims: Dim[];
}

/** A length or area as lin + pi × π. */
export interface Measure {
  lin: number;
  pi: number;
}

export type MeasureTag =
  // circles
  | "dAsR"
  | "rAsD"
  | "squaredD"
  | "circForArea"
  | "areaForCirc"
  | "noStraight"
  | "oneRadius"
  | "wholeCircle"
  | "wrongFraction"
  | "rForD"
  | "dForR"
  | "forgotPi"
  | "subtractRadii"
  // shaded and composite regions
  | "added"
  | "bigOnly"
  | "holeOnly"
  | "overlapTwice"
  | "missingLength"
  | "noCut"
  | "perimeter"
  | "noHalf"
  | "wrongSign";

export interface MeasureSlip {
  tag: MeasureTag;
  value: number;
}

const M = (lin: number, pi = 0): Measure => ({ lin, pi });

/** lin + pi × 3.14 in hundredths, or null when that needs more than two decimals. */
export function hundredths(m: Measure): number | null {
  const h = m.lin * 100 + m.pi * 314;
  const r = Math.round(h);
  return Math.abs(h - r) < 1e-6 ? r : null;
}

/** The value with π = 3.14 (null if it needs more than two decimals). */
export function withPi(m: Measure): number | null {
  const h = hundredths(m);
  return h === null ? null : h / 100;
}

export const addM = (...ms: Measure[]): Measure => ms.reduce((s, m) => ({ lin: s.lin + m.lin, pi: s.pi + m.pi }), M(0));

/** A part's area, with its sign. */
export function partArea(p: Part): Measure {
  switch (p.kind) {
    case "rect":
      return M(p.sign * p.w * p.h);
    case "tri": {
      const [a, b, c] = p.pts;
      return M((p.sign * Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]))) / 2);
    }
    case "sector":
      return M(0, (p.sign * p.r * p.r * p.sweep) / 360);
  }
}

export const figureArea = (f: Figure): Measure => addM(...f.parts.map(partArea));

export function edgeLength(e: Edge): Measure {
  return e.kind === "line" ? M(Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1])) : M(0, (2 * e.r * e.sweep) / 360);
}

/** Drop slips that are not whole hundredths, not positive, the answer, too big, or repeated. */
export function cleanSlips(answer: number, list: [MeasureTag, Measure][]): MeasureSlip[] {
  const out: MeasureSlip[] = [];
  const ans = Math.round(answer * 100);
  for (const [tag, m] of list) {
    const h = hundredths(m);
    if (h === null || h <= 0 || h === ans || h >= 100_000 || out.some((s) => Math.round(s.value * 100) === h)) continue;
    out.push({ tag, value: h / 100 });
  }
  return out;
}

const norm = (a: number) => ((a % 360) + 360) % 360;

/** Mirror a figure inside its w × h box: left–right and/or top–bottom. */
export function mirrorFigure(f: Figure, w: number, h: number, fx: boolean, fy: boolean): Figure {
  const pt = ([x, y]: XY): XY => [fx ? w - x : x, fy ? h - y : y];
  const dir = ([x, y]: XY): XY => [fx ? -x : x, fy ? -y : y];
  // An arc from θ1 sweeping to θ2: a flip turns θ into 180 − θ (left–right) or −θ (top–bottom).
  const arc = (from: number, sweep: number) => {
    let a = from;
    if (fx) a = 180 - a - sweep;
    if (fy) a = -a - sweep;
    return sweep >= 360 ? 0 : norm(a);
  };
  return {
    parts: f.parts.map((p): Part => {
      switch (p.kind) {
        case "rect": {
          const [x0, y0] = pt([p.x, p.y]);
          const [x1, y1] = pt([p.x + p.w, p.y + p.h]);
          return { ...p, x: Math.min(x0, x1), y: Math.min(y0, y1) };
        }
        case "tri":
          return { ...p, pts: [pt(p.pts[0]), pt(p.pts[1]), pt(p.pts[2])] };
        case "sector":
          return { ...p, c: pt(p.c), from: arc(p.from, p.sweep) };
      }
    }),
    edges: f.edges.map((e): Edge => (e.kind === "line" ? { ...e, a: pt(e.a), b: pt(e.b) } : { ...e, c: pt(e.c), from: arc(e.from, e.sweep) })),
    dims: f.dims.map((d) => ({ ...d, a: pt(d.a), b: pt(d.b), off: dir(d.off) })),
  };
}

/** A point on a circle. */
export const onCircle = (c: XY, r: number, deg: number): XY => [c[0] + r * Math.cos((deg * Math.PI) / 180), c[1] + r * Math.sin((deg * Math.PI) / 180)];

/** The box round a figure's edges: [x, y, w, h]. */
export function figureBox(f: Figure): [number, number, number, number] {
  const pts: XY[] = [];
  for (const e of f.edges) {
    if (e.kind === "line") pts.push(e.a, e.b);
    else for (let k = 0; k <= 36; k++) pts.push(onCircle(e.c, e.r, e.from + (e.sweep * k) / 36));
  }
  for (const d of f.dims) pts.push(d.a, d.b);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
  return [x0, y0, Math.max(...xs) - x0, Math.max(...ys) - y0];
}

// ── Circle questions ─────────────────────────────────────────────────────

export type CircleVariant = "circC" | "circA" | "semiA" | "semiP" | "quarterA" | "fromC" | "quarterP" | "fromCtoA" | "ring";

export const CIRCLE_VARIANTS: Record<Level, CircleVariant[]> = {
  1: ["circC", "circA"],
  2: ["semiA", "semiP", "quarterA", "fromC"],
  3: ["quarterP", "fromCtoA", "ring"],
};

export interface CircleQuestion {
  type: "circle";
  level: Level;
  seed: number;
  variant: CircleVariant;
  /** Radius (the outer one for a ring). */
  r: number;
  /** Ring: the inner radius; otherwise 0. */
  inner: number;
  /** What the question tells: radius, diameter, or circumference. */
  given: "r" | "d" | "C";
  /** The number told (for a ring, the outer radius; the inner one is on the figure). */
  givenValue: number;
  /** What is asked: circumference, area, perimeter of the part, radius or diameter. */
  asks: "C" | "A" | "P" | "r" | "d";
  fig: Figure;
  /** The answer as lin + pi·π. */
  measure: Measure;
  /** With π = 3.14. */
  answer: number;
  slips: MeasureSlip[];
}

const O: XY = [0, 0];

function circleFigure(variant: CircleVariant, r: number, inner: number, given: "r" | "d" | "C", asks: CircleQuestion["asks"]): Figure {
  const dimOf = (name: "r" | "d", a: XY, b: XY, off: XY, line: boolean): Dim => ({ name, a, b, value: name === "r" ? r : 2 * r, off, given: given === name, ask: asks === name, line });
  switch (variant) {
    case "semiA":
    case "semiP": {
      // The diameter is the straight edge; a radius goes up and right from the centre.
      const dims = [dimOf("d", [-r, 0], [r, 0], [0, 1], false), dimOf("r", O, onCircle(O, r, -60), [-0.866, -0.5], true)];
      return {
        parts: [{ kind: "sector", c: O, r, from: 180, sweep: 180, sign: 1 }],
        edges: [
          { kind: "arc", c: O, r, from: 180, sweep: 180 },
          { kind: "line", a: [-r, 0], b: [r, 0] },
        ],
        dims,
      };
    }
    case "quarterA":
    case "quarterP":
      return {
        parts: [{ kind: "sector", c: O, r, from: 270, sweep: 90, sign: 1 }],
        edges: [
          { kind: "arc", c: O, r, from: 270, sweep: 90 },
          { kind: "line", a: O, b: [r, 0] },
          { kind: "line", a: O, b: [0, -r] },
        ],
        dims: [dimOf("r", O, [r, 0], [0, 1], false)],
      };
    case "ring":
      return {
        parts: [
          { kind: "sector", c: O, r, from: 0, sweep: 360, sign: 1 },
          { kind: "sector", c: O, r: inner, from: 0, sweep: 360, sign: -1 },
        ],
        edges: [
          { kind: "arc", c: O, r, from: 0, sweep: 360 },
          { kind: "arc", c: O, r: inner, from: 0, sweep: 360 },
        ],
        dims: [
          { name: "R", a: O, b: [r, 0], value: r, off: [0, -1], given: true, line: true, at: (inner + r) / (2 * r) },
          { name: "r", a: O, b: onCircle(O, inner, 180), value: inner, off: [0, -1], given: true, line: true },
        ],
      };
    default: {
      // Both are on every circle; the one not told stays hidden until "show me" works it out.
      // The diameter's number sits under the centre, the radius's above its middle.
      const dims = [dimOf("d", [-r, 0], [r, 0], [0, 1], true), dimOf("r", O, [r, 0], [0, -1], true)];
      return { parts: [{ kind: "sector", c: O, r, from: 0, sweep: 360, sign: 1 }], edges: [{ kind: "arc", c: O, r, from: 0, sweep: 360 }], dims };
    }
  }
}

function circleOnce(rng: Rng, level: Level, seed: number): CircleQuestion | null {
  const variant = pick(rng, CIRCLE_VARIANTS[level]);
  let r = 1 + randInt(rng, 10);
  let inner = 0;
  let given: CircleQuestion["given"] = rng() < 0.5 ? "r" : "d";
  let asks: CircleQuestion["asks"];
  let measure: Measure;
  const list: [MeasureTag, Measure][] = [];
  switch (variant) {
    case "circC":
      asks = "C";
      measure = M(0, 2 * r);
      if (given === "r") list.push(["rAsD", M(0, r)]);
      else list.push(["dAsR", M(0, 4 * r)]);
      list.push(["areaForCirc", M(0, r * r)]);
      break;
    case "circA":
      asks = "A";
      measure = M(0, r * r);
      if (given === "d") list.push(["dAsR", M(0, 4 * r * r)]);
      list.push(["circForArea", M(0, 2 * r)]);
      if (given === "r") list.push(["squaredD", M(0, 4 * r * r)]);
      break;
    case "semiA":
      asks = "A";
      measure = M(0, (r * r) / 2);
      if (given === "d") list.push(["dAsR", M(0, 2 * r * r)]);
      list.push(["wholeCircle", M(0, r * r)], ["circForArea", M(0, r)]);
      break;
    case "semiP":
      asks = "P";
      measure = M(2 * r, r);
      list.push(["noStraight", M(0, r)]);
      if (given === "d") list.push(["dAsR", M(4 * r, 2 * r)]);
      else list.push(["oneRadius", M(r, r)]);
      list.push(["wholeCircle", M(2 * r, 2 * r)]);
      break;
    case "quarterA":
      given = "r";
      r = 2 * (1 + randInt(rng, 5));
      asks = "A";
      measure = M(0, (r * r) / 4);
      list.push(["wholeCircle", M(0, r * r)], ["wrongFraction", M(0, (r * r) / 2)], ["circForArea", M(0, r / 2)]);
      break;
    case "fromC":
      given = "C";
      asks = rng() < 0.5 ? "r" : "d";
      measure = M(asks === "r" ? r : 2 * r);
      list.push(asks === "r" ? ["dForR", M(2 * r)] : ["rForD", M(r)], ["forgotPi", M(0, r)]);
      break;
    case "quarterP":
      given = "r";
      asks = "P";
      measure = M(2 * r, r / 2);
      list.push(["noStraight", M(0, r / 2)], ["oneRadius", M(r, r / 2)], ["wrongFraction", M(2 * r, r)], ["wholeCircle", M(2 * r, 2 * r)]);
      break;
    case "fromCtoA":
      given = "C";
      asks = "A";
      measure = M(0, r * r);
      list.push(["dAsR", M(0, 4 * r * r)], ["circForArea", M(0, 2 * r)]);
      break;
    case "ring":
      given = "r";
      r = 3 + randInt(rng, 8);
      inner = 1 + randInt(rng, r - 1);
      asks = "A";
      measure = M(0, r * r - inner * inner);
      list.push(["subtractRadii", M(0, (r - inner) ** 2)], ["added", M(0, r * r + inner * inner)], ["bigOnly", M(0, r * r)], ["holeOnly", M(0, inner * inner)]);
      break;
  }
  const answer = withPi(measure);
  if (answer === null || answer >= 1000) return null;
  const givenValue = given === "C" ? withPi(M(0, 2 * r)) : given === "d" ? 2 * r : r;
  if (givenValue === null) return null;
  const slips = cleanSlips(answer, list);
  if (!slips.length) return null;
  return { type: "circle", level, seed, variant, r, inner, given, givenValue, asks, fig: circleFigure(variant, r, inner, given, asks), measure, answer, slips };
}

export function makeCircleQuestion(level: Level, seed: number): CircleQuestion {
  const rng = mulberry32(seed * 31 + level * 977 + 314);
  for (;;) {
    const q = circleOnce(rng, level, seed);
    if (q) return q;
  }
}

/** Which slip a value is, if any. */
export function measureMistake(q: { answer: number; slips: MeasureSlip[] }, value: number): MeasureTag | "right" | "other" {
  const h = Math.round(value * 100);
  if (h === Math.round(q.answer * 100)) return "right";
  return q.slips.find((s) => Math.round(s.value * 100) === h)?.tag ?? "other";
}

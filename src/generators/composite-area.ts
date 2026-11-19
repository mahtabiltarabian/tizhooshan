// Tool 16, «مساحت ترکیبی»: the area of a figure made of simple pieces, with
// lengths in centimetres written on it. The figure is the signed parts of
// circle.ts: the shaded region is the + parts minus the − parts, which never
// overlap each other (− parts sit inside + parts).
//
// Level 1: an L shape, split into two rectangles. Four of its six sides are
//          labelled; one or two others must be worked out from them.
// Level 2: a big rectangle minus a hole, a frame of even width, or a corner
//          triangle cut off (shaded = big − small).
// Level 3: with circle parts: a square with four quarter circles at its
//          corners, a circle in a square, a quarter circle in a square, or a
//          rectangle with a semicircle on top (π = 3.14).
//
// Each question keeps the slips the topic is about (an overlap added twice,
// added instead of subtracted, a missing length used wrongly) and the others
// a child is likely to make, all different from the answer.

import { cleanSlips, figureArea, mirrorFigure, withPi, type Dim, type Edge, type Figure, type Level, type Measure, type MeasureSlip, type MeasureTag, type XY } from "./circle";
import { mulberry32, pick, randInt, type Rng } from "./random";

export type CompositeVariant = "L" | "hole" | "frame" | "triCut" | "squareQuarters" | "squareCircle" | "cornerQuarter" | "rectSemi";

export const COMPOSITE_VARIANTS: Record<Level, CompositeVariant[]> = {
  1: ["L"],
  2: ["hole", "frame", "triCut"],
  3: ["squareQuarters", "squareCircle", "cornerQuarter", "rectSemi"],
};

/**
 * L shapes: which four sides are labelled. W bottom, H left, a top, b right,
 * iv the inner upright side (H − b), ih the inner flat side (W − a).
 * "outer": W H a b (both inner sides missing); "sum": a ih H b (W = a + ih);
 * "diff": W H a iv (b = H − iv).
 */
export type LabelSet = "outer" | "sum" | "diff";

export interface CompositeQuestion {
  type: "composite";
  level: Level;
  seed: number;
  variant: CompositeVariant;
  /** L shapes only (otherwise "outer"). */
  labels: LabelSet;
  fig: Figure;
  measure: Measure;
  answer: number;
  slips: MeasureSlip[];
}

const M = (lin: number, pi = 0): Measure => ({ lin, pi });
const between = (rng: Rng, lo: number, hi: number) => lo + randInt(rng, hi - lo + 1);
const dim = (name: string, a: XY, b: XY, off: XY, given: boolean, line = false): Dim => ({ name, a, b, value: Math.hypot(b[0] - a[0], b[1] - a[1]), off, given, line });
const lines = (pts: XY[], closed = true): Edge[] => pts.slice(0, closed ? pts.length : pts.length - 1).map((a, i) => ({ kind: "line", a, b: pts[(i + 1) % pts.length] }));
const box = (x: number, y: number, w: number, h: number): XY[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

/** Dims of a w × h rectangle at the origin: width under it, height to its left. */
const outerDims = (w: number, h: number, given = true): Dim[] => [dim("W", [0, h], [w, h], [0, 1], given), dim("H", [0, 0], [0, h], [-1, 0], given)];

interface Built {
  variant: CompositeVariant;
  labels: LabelSet;
  fig: Figure;
  w: number;
  h: number;
  measure: Measure;
  list: [MeasureTag, Measure][];
  mirror: boolean;
}

function lShape(rng: Rng): Built {
  const W = between(rng, 5, 12);
  const H = between(rng, 4, 10);
  const a = between(rng, 2, W - 2);
  const b = between(rng, 2, H - 2);
  const [iv, ih] = [H - b, W - a];
  const labels = pick(rng, ["outer", "sum", "diff"] as LabelSet[]);
  const given = labels === "outer" ? ["W", "H", "a", "b"] : labels === "sum" ? ["a", "ih", "H", "b"] : ["W", "H", "a", "iv"];
  const g = (n: string) => given.includes(n);
  const fig: Figure = {
    // The bottom bar and the arm above it.
    parts: [
      { kind: "rect", x: 0, y: iv, w: W, h: b, sign: 1 },
      { kind: "rect", x: 0, y: 0, w: a, h: iv, sign: 1 },
    ],
    edges: lines([
      [0, 0],
      [a, 0],
      [a, iv],
      [W, iv],
      [W, H],
      [0, H],
    ]),
    dims: [
      dim("W", [0, H], [W, H], [0, 1], g("W")),
      dim("H", [0, 0], [0, H], [-1, 0], g("H")),
      dim("a", [0, 0], [a, 0], [0, -1], g("a")),
      dim("b", [W, iv], [W, H], [1, 0], g("b")),
      dim("iv", [a, 0], [a, iv], [1, 0], g("iv")),
      dim("ih", [a, iv], [W, iv], [0, -1], g("ih")),
    ],
  };
  // Missing length: the unlabelled side read as the labelled number next to it.
  const missing = labels === "outer" ? M(W * b + a * b) : labels === "sum" ? M(ih * b + a * iv) : M(W * iv + a * iv);
  return {
    variant: "L",
    labels,
    fig,
    w: W,
    h: H,
    measure: M(W * b + a * iv),
    list: [
      ["overlapTwice", M(W * b + a * H)],
      ["missingLength", missing],
      ["noCut", M(W * H)],
      ["perimeter", M(2 * (W + H))],
    ],
    mirror: true,
  };
}

function hole(rng: Rng): Built {
  const W = between(rng, 6, 12);
  const H = between(rng, 5, 10);
  const w = between(rng, 2, W - 3);
  const h = between(rng, 2, H - 3);
  const x = between(rng, 1, W - w - 1);
  const y = between(rng, 1, H - h - 1);
  const fig: Figure = {
    parts: [
      { kind: "rect", x: 0, y: 0, w: W, h: H, sign: 1 },
      { kind: "rect", x, y, w, h, sign: -1 },
    ],
    edges: [...lines(box(0, 0, W, H)), ...lines(box(x, y, w, h))],
    dims: [...outerDims(W, H), dim("w", [x, y], [x + w, y], [0, 1], true), dim("h", [x + w, y], [x + w, y + h], [-1, 0], true)],
  };
  return {
    variant: "hole",
    labels: "outer",
    fig,
    w: W,
    h: H,
    measure: M(W * H - w * h),
    list: [
      ["added", M(W * H + w * h)],
      ["bigOnly", M(W * H)],
      ["holeOnly", M(w * h)],
    ],
    mirror: false,
  };
}

function frame(rng: Rng): Built {
  const t = between(rng, 1, 2);
  const W = between(rng, 2 * t + 2, 12);
  const H = between(rng, 2 * t + 2, 10);
  const [iw, ih] = [W - 2 * t, H - 2 * t];
  const fig: Figure = {
    parts: [
      { kind: "rect", x: 0, y: 0, w: W, h: H, sign: 1 },
      { kind: "rect", x: t, y: t, w: iw, h: ih, sign: -1 },
    ],
    edges: [...lines(box(0, 0, W, H)), ...lines(box(t, t, iw, ih))],
    dims: [
      ...outerDims(W, H),
      dim("t", [W - t, H / 2], [W, H / 2], [0, -1], true, true),
      dim("iw", [t, t], [t + iw, t], [0, 1], false),
      dim("ih", [t, t], [t, t + ih], [1, 0], false),
    ],
  };
  return {
    variant: "frame",
    labels: "outer",
    fig,
    w: W,
    h: H,
    measure: M(W * H - iw * ih),
    list: [
      ["missingLength", M(W * H - (W - t) * (H - t))],
      ["added", M(W * H + iw * ih)],
      ["bigOnly", M(W * H)],
      ["holeOnly", M(iw * ih)],
    ],
    mirror: false,
  };
}

function triCut(rng: Rng): Built {
  const W = between(rng, 5, 12);
  const H = between(rng, 4, 10);
  const p = between(rng, 2, W - 1);
  const q = between(rng, 2, H - 1);
  const fig: Figure = {
    // The rectangle, and the corner triangle (top right) left white.
    parts: [
      { kind: "rect", x: 0, y: 0, w: W, h: H, sign: 1 },
      {
        kind: "tri",
        pts: [
          [W - p, 0],
          [W, 0],
          [W, q],
        ],
        sign: -1,
      },
    ],
    edges: [...lines(box(0, 0, W, H)), { kind: "line", a: [W - p, 0], b: [W, q] }],
    dims: [...outerDims(W, H), dim("p", [W - p, 0], [W, 0], [0, -1], true), dim("q", [W, 0], [W, q], [1, 0], true)],
  };
  return {
    variant: "triCut",
    labels: "outer",
    fig,
    w: W,
    h: H,
    measure: M(W * H - (p * q) / 2),
    list: [
      ["noHalf", M(W * H - p * q)],
      ["added", M(W * H + (p * q) / 2)],
      ["bigOnly", M(W * H)],
      ["holeOnly", M((p * q) / 2)],
    ],
    mirror: true,
  };
}

function squareQuarters(rng: Rng): Built {
  const r = between(rng, 1, 6);
  const s = 2 * r;
  const corners: [XY, number][] = [
    [[0, 0], 0],
    [[s, 0], 90],
    [[s, s], 180],
    [[0, s], 270],
  ];
  const fig: Figure = {
    parts: [{ kind: "rect", x: 0, y: 0, w: s, h: s, sign: 1 }, ...corners.map(([c, from]) => ({ kind: "sector" as const, c, r, from, sweep: 90, sign: -1 as const }))],
    edges: [...lines(box(0, 0, s, s)), ...corners.map(([c, from]): Edge => ({ kind: "arc", c, r, from, sweep: 90 }))],
    dims: [dim("s", [0, s], [s, s], [0, 1], true), dim("r", [0, 0], [r, 0], [0, -1], true)],
  };
  return {
    variant: "squareQuarters",
    labels: "outer",
    fig,
    w: s,
    h: s,
    measure: M(s * s, -r * r),
    list: [
      ["added", M(s * s, r * r)],
      ["bigOnly", M(s * s)],
      ["holeOnly", M(0, r * r)],
      ["circForArea", M(s * s, -2 * r)],
      ["wholeCircle", M(s * s, -4 * r * r)],
    ],
    mirror: false,
  };
}

function squareCircle(rng: Rng): Built {
  const r = between(rng, 1, 6);
  const s = 2 * r;
  const c: XY = [r, r];
  const fig: Figure = {
    parts: [
      { kind: "rect", x: 0, y: 0, w: s, h: s, sign: 1 },
      { kind: "sector", c, r, from: 0, sweep: 360, sign: -1 },
    ],
    edges: [...lines(box(0, 0, s, s)), { kind: "arc", c, r, from: 0, sweep: 360 }],
    dims: [dim("s", [0, s], [s, s], [0, 1], true), dim("r", c, [s, r], [0, -1], false, true)],
  };
  return {
    variant: "squareCircle",
    labels: "outer",
    fig,
    w: s,
    h: s,
    measure: M(s * s, -r * r),
    list: [
      ["dAsR", M(s * s, -s * s)],
      ["added", M(s * s, r * r)],
      ["circForArea", M(s * s, -2 * r)],
      ["holeOnly", M(0, r * r)],
      ["bigOnly", M(s * s)],
    ],
    mirror: false,
  };
}

function cornerQuarter(rng: Rng): Built {
  const s = 2 * between(rng, 1, 6);
  const c: XY = [0, s];
  const fig: Figure = {
    // A quarter circle centred at the bottom-left corner fills most of the square; the rest is shaded.
    parts: [
      { kind: "rect", x: 0, y: 0, w: s, h: s, sign: 1 },
      { kind: "sector", c, r: s, from: 270, sweep: 90, sign: -1 },
    ],
    edges: [...lines(box(0, 0, s, s)), { kind: "arc", c, r: s, from: 270, sweep: 90 }],
    dims: [dim("s", [0, s], [s, s], [0, 1], true), dim("r", c, [0, 0], [-1, 0], false)],
  };
  return {
    variant: "cornerQuarter",
    labels: "outer",
    fig,
    w: s,
    h: s,
    measure: M(s * s, -(s * s) / 4),
    list: [
      ["added", M(s * s, (s * s) / 4)],
      ["holeOnly", M(0, (s * s) / 4)],
      ["bigOnly", M(s * s)],
      ["circForArea", M(s * s, -s / 2)],
      ["wrongFraction", M(s * s, -(s * s) / 2)],
    ],
    mirror: true,
  };
}

function rectSemi(rng: Rng): Built {
  const r = between(rng, 1, 5);
  const W = 2 * r;
  const H = between(rng, 2, 9);
  const c: XY = [r, 0];
  const fig: Figure = {
    parts: [
      { kind: "rect", x: 0, y: 0, w: W, h: H, sign: 1 },
      { kind: "sector", c, r, from: 180, sweep: 180, sign: 1 },
    ],
    edges: [
      { kind: "arc", c, r, from: 180, sweep: 180 },
      ...lines(
        [
          [W, 0],
          [W, H],
          [0, H],
          [0, 0],
        ],
        false,
      ),
    ],
    dims: [dim("W", [0, H], [W, H], [0, 1], true), dim("H", [W, 0], [W, H], [1, 0], true), dim("r", c, [W, 0], [0, -1], false, true)],
  };
  return {
    variant: "rectSemi",
    labels: "outer",
    fig,
    w: W,
    h: H,
    measure: M(W * H, (r * r) / 2),
    list: [
      ["dAsR", M(W * H, (W * W) / 2)],
      ["wholeCircle", M(W * H, r * r)],
      ["wrongSign", M(W * H, -(r * r) / 2)],
      ["bigOnly", M(W * H)],
    ],
    mirror: false,
  };
}

const BUILD: Record<CompositeVariant, (rng: Rng) => Built> = { L: lShape, hole, frame, triCut, squareQuarters, squareCircle, cornerQuarter, rectSemi };

export function makeCompositeQuestion(level: Level, seed: number): CompositeQuestion {
  const rng = mulberry32(seed * 53 + level * 1201 + 77);
  for (;;) {
    const b = BUILD[pick(rng, COMPOSITE_VARIANTS[level])](rng);
    const answer = withPi(b.measure);
    if (answer === null || answer <= 0 || answer >= 1000) continue;
    const slips = cleanSlips(answer, b.list);
    if (!slips.length) continue;
    let fig = b.fig;
    if (b.mirror) {
      const [fx, fy] = [rng() < 0.5, rng() < 0.5];
      fig = mirrorFigure(fig, b.w, b.h, fx, fy);
    }
    // The figure's own area is the answer: parts and measure agree.
    const own = figureArea(fig);
    if (Math.abs(own.lin - b.measure.lin) > 1e-9 || Math.abs(own.pi - b.measure.pi) > 1e-9) throw new Error(`composite ${b.variant}: parts disagree`);
    return { type: "composite", level, seed, variant: b.variant, labels: b.labels, fig, measure: b.measure, answer, slips };
  }
}

/** A labelled length by name. */
export const dimValue = (q: { fig: Figure }, name: string) => q.fig.dims.find((d) => d.name === name)?.value ?? 0;

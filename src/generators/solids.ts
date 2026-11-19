// Faces, edges and vertices of solids (tool 6): prisms (cube and cuboid
// included) and pyramids. Pure TypeScript, seeded.
//
// Model coordinates match cube-towers.ts: x to the right, y away from the
// viewer, z up; the base sits on z = 0. Every solid has an explicit model
// (vertex list, edge list, face list), so the tests can count the real
// geometry and check it against the formulas the questions use:
//   prism with an n-gon base:   n + 2 faces, 3n edges, 2n vertices
//   pyramid with an n-gon base: n + 1 faces, 2n edges, n + 1 vertices
// Each question keeps its answer and the usual slips, so the feedback can
// say which slip a wrong answer was.

import { mulberry32, pick, randInt, shuffle, type Rng } from "./random";

export type Level = 1 | 2 | 3;
export type Family = "prism" | "pyramid";
export type Part = "faces" | "edges" | "vertices";
export const PARTS: Part[] = ["faces", "edges", "vertices"];

export interface Solid {
  family: Family;
  /** Sides of the base polygon. */
  n: number;
  /** Square prisms drawn as a cube or as a box with a rectangular base. */
  shape?: "cube" | "cuboid";
}

/** The solids children meet first, in the order the explore chips show them. */
export const BASIC_SOLIDS: Solid[] = [
  { family: "prism", n: 4, shape: "cube" },
  { family: "prism", n: 4, shape: "cuboid" },
  { family: "prism", n: 3 },
  { family: "prism", n: 5 },
  { family: "prism", n: 6 },
  { family: "pyramid", n: 3 },
  { family: "pyramid", n: 4 },
];

const POLY = ["", "", "", "مثلثی", "چهارضلعی", "پنج‌ضلعی", "شش‌ضلعی", "هفت‌ضلعی", "هشت‌ضلعی", "نه‌ضلعی", "ده‌ضلعی", "یازده‌ضلعی", "دوازده‌ضلعی"];

export function solidName(s: Solid): string {
  if (s.shape === "cube") return "مکعب";
  if (s.shape === "cuboid") return "مکعب‌مستطیل";
  if (s.family === "pyramid") return `هرم ${s.n === 4 ? "مربعی" : POLY[s.n]}`;
  return `منشور ${POLY[s.n]}`;
}

export const solidKey = (s: Solid) => `${s.family}${s.n}${s.shape ?? ""}`;

export function counts(s: Solid): Record<Part, number> {
  return s.family === "prism"
    ? { faces: s.n + 2, edges: 3 * s.n, vertices: 2 * s.n }
    : { faces: s.n + 1, edges: 2 * s.n, vertices: s.n + 1 };
}

// ---------------------------------------------------------------------------
// Geometry

export type Vec3 = [number, number, number];
export type FaceGroup = "bottom" | "top" | "side";
export type EdgeGroup = "bottom" | "top" | "side";
export type VertexGroup = "bottom" | "top" | "apex";

export interface SolidModel {
  vertices: Vec3[];
  vertexGroups: VertexGroup[];
  edges: [number, number][];
  edgeGroups: EdgeGroup[];
  /** Vertex indices, counter-clockwise seen from outside. */
  faces: number[][];
  faceGroups: FaceGroup[];
  normals: Vec3[];
  height: number;
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v: Vec3): Vec3 => {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
};

/** Base polygon (counter-clockwise from above) and height, sized to sit well on the stage. */
function baseOf(s: Solid): { base: [number, number][]; h: number } {
  if (s.shape === "cube") return { base: [[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]], h: 1.6 };
  if (s.shape === "cuboid") return { base: [[-1.1, -0.65], [1.1, -0.65], [1.1, 0.65], [-1.1, 0.65]], h: 1.1 };
  const r = s.n <= 4 ? 1.05 : 1.15;
  // Turned so that no face is seen exactly edge-on in the picture.
  const a0 = s.family === "pyramid" ? -Math.PI / 2 + 0.35 : s.n === 3 ? -Math.PI / 2 + 0.25 : 0.2;
  const base = Array.from({ length: s.n }, (_, k): [number, number] => {
    const a = a0 + (2 * Math.PI * k) / s.n;
    return [r * Math.cos(a), r * Math.sin(a)];
  });
  return { base, h: s.family === "pyramid" ? 1.7 : 1.6 };
}

export function solidModel(s: Solid): SolidModel {
  const { base, h } = baseOf(s);
  const n = base.length;
  const vertices: Vec3[] = base.map(([x, y]) => [x, y, 0]);
  const vertexGroups: VertexGroup[] = base.map(() => "bottom");
  const edges: [number, number][] = base.map((_, k) => [k, (k + 1) % n]);
  const edgeGroups: EdgeGroup[] = base.map(() => "bottom");
  const faces: number[][] = [base.map((_, k) => n - 1 - k)];
  const faceGroups: FaceGroup[] = ["bottom"];

  if (s.family === "prism") {
    base.forEach(([x, y]) => vertices.push([x, y, h]));
    base.forEach(() => vertexGroups.push("top"));
    base.forEach((_, k) => edges.push([n + k, n + ((k + 1) % n)]));
    base.forEach(() => edgeGroups.push("top"));
    base.forEach((_, k) => edges.push([k, n + k]));
    base.forEach(() => edgeGroups.push("side"));
    faces.push(base.map((_, k) => n + k));
    faceGroups.push("top");
    base.forEach((_, k) => faces.push([k, (k + 1) % n, n + ((k + 1) % n), n + k]));
    base.forEach(() => faceGroups.push("side"));
  } else {
    vertices.push([0, 0, h]);
    vertexGroups.push("apex");
    base.forEach((_, k) => edges.push([k, n]));
    base.forEach(() => edgeGroups.push("side"));
    base.forEach((_, k) => faces.push([k, (k + 1) % n, n]));
    base.forEach(() => faceGroups.push("side"));
  }

  const normals = faces.map((f) => unit(cross(sub(vertices[f[1]], vertices[f[0]]), sub(vertices[f[2]], vertices[f[0]]))));
  return { vertices, vertexGroups, edges, edgeGroups, faces, faceGroups, normals, height: h };
}

// ---------------------------------------------------------------------------
// The picture on paper: seen from the front, a little to the right and above.
// Edges behind the solid are dashed, as in exam pictures.

/** Unit vector from the solid toward the viewer of the picture. */
export const PICTURE_VIEW: Vec3 = unit([0.42, -1, 0.62]);

export interface SolidPicture {
  /** Screen points (x right, y up), one per vertex. */
  points: [number, number][];
  edges: { a: number; b: number; hidden: boolean }[];
  vertexHidden: boolean[];
  visible: Record<Part, number>;
}

export function solidPicture(s: Solid, view: Vec3 = PICTURE_VIEW): SolidPicture {
  const m = solidModel(s);
  const right = unit(cross([0, 0, 1], view));
  const up = cross(view, right);
  const faceSeen = m.normals.map((nv) => dot(nv, view) > 0);
  const touches = (v: number) => m.faces.some((f, i) => faceSeen[i] && f.includes(v));
  const edgeSeen = m.edges.map(([a, b]) => m.faces.some((f, i) => faceSeen[i] && f.includes(a) && f.includes(b)));
  const vertexHidden = m.vertices.map((_, v) => !touches(v));
  return {
    points: m.vertices.map((p) => [dot(p, right), dot(p, up)]),
    edges: m.edges.map(([a, b], i) => ({ a, b, hidden: !edgeSeen[i] })),
    vertexHidden,
    visible: {
      faces: faceSeen.filter(Boolean).length,
      edges: edgeSeen.filter(Boolean).length,
      vertices: vertexHidden.filter((h) => !h).length,
    },
  };
}

// ---------------------------------------------------------------------------
// Questions

export type SolidTag =
  | "right"
  | "visibleOnly"
  | "hiddenTwice"
  | "noBases"
  | "oneBase"
  | "noBase"
  | "noVertical"
  | "baseSides"
  | "baseOnly"
  | "noApex"
  | "asFaces"
  | "asEdges"
  | "asVertices"
  | "added"
  | "wrongFamily"
  | "nIsGiven"
  | "wrongDivide"
  | "justN"
  | "euler0"
  | "eulerSign"
  | "other";

const AS: Record<Part, SolidTag> = { faces: "asFaces", edges: "asEdges", vertices: "asVertices" };

interface Base {
  type: "solid";
  seed: number;
  level: Level;
  /** The part asked for. */
  part: Part;
  /** The correct number. */
  value: number;
}

interface Choices {
  options: number[];
  /** Slip of each option (null for the right one and for plain neighbours). */
  mistakes: (SolidTag | null)[];
  /** Index of the right option. */
  answer: number;
}

export type SolidCore =
  /** Level 1: count one part of a pictured solid. */
  | (Base & { kind: "count"; solid: Solid })
  /** Level 2: total or difference for two named solids. */
  | (Base & { kind: "combine"; solids: [Solid, Solid]; op: "sum" | "diff" })
  /** Level 3: the family and one count are given; find another count. */
  | (Base & { kind: "reverse"; solid: Solid; given: Part; givenValue: number })
  /** Level 3: two counts of a solid are given; Euler's V − E + F = 2 gives the third. */
  | (Base & { kind: "euler"; solid: Solid; given: [Part, number][] });

export type SolidQuestion = SolidCore & Choices;

const familyOf = (f: Family, n: number): Solid => ({ family: f, n });

/** Counts with the other family's formula: a pyramid counted like a prism and the other way round. */
const swapped = (s: Solid) => counts({ family: s.family === "prism" ? "pyramid" : "prism", n: s.n });

/** Wrong answers with a known cause, in the order they are checked. */
export function solidSlips(q: SolidCore): [SolidTag, number][] {
  const others = PARTS.filter((p) => p !== q.part);
  switch (q.kind) {
    case "count": {
      const s = q.solid;
      const c = counts(s);
      const seen = solidPicture(s).visible;
      const out: [SolidTag, number][] = [["visibleOnly", seen[q.part]]];
      if (q.part === "faces") {
        if (s.family === "prism") out.push(["noBases", s.n], ["oneBase", s.n + 1]);
        else out.push(["noBase", s.n]);
      } else if (q.part === "edges") {
        out.push(["hiddenTwice", c.edges + (c.edges - seen.edges)]);
        if (s.family === "prism") out.push(["noVertical", 2 * s.n]);
        out.push(["baseSides", s.n]);
      } else {
        out.push([s.family === "prism" ? "baseOnly" : "noApex", s.n]);
      }
      for (const p of others) out.push([AS[p], c[p]]);
      return out;
    }
    case "combine": {
      const [a, b] = q.solids;
      const op = (x: number, y: number) => (q.op === "sum" ? x + y : Math.abs(x - y));
      const out: [SolidTag, number][] = [];
      if (q.op === "diff") out.push(["added", counts(a)[q.part] + counts(b)[q.part]]);
      if (q.part === "edges") out.push(["baseSides", op(a.n, b.n)]);
      if (a.family !== b.family) out.push(["wrongFamily", op(swapped(a)[q.part], counts(b)[q.part])], ["wrongFamily", op(counts(a)[q.part], swapped(b)[q.part])]);
      for (const p of others) out.push([AS[p], op(counts(a)[p], counts(b)[p])]);
      return out;
    }
    case "reverse": {
      const s = q.solid;
      const out: [SolidTag, number][] = [["justN", s.n]];
      // Took the given number itself as the number of base sides.
      out.push(["nIsGiven", counts(familyOf(s.family, q.givenValue))[q.part]]);
      // Divided the edges by the other family's factor (2 for a prism, 3 for a pyramid).
      if (q.given === "edges") {
        const k = s.family === "prism" ? 2 : 3;
        if (q.givenValue % k === 0 && q.givenValue / k >= 3) out.push(["wrongDivide", counts(familyOf(s.family, q.givenValue / k))[q.part]]);
      }
      const third = PARTS.find((p) => p !== q.part && p !== q.given)!;
      out.push([AS[third], counts(s)[third]]);
      return out;
    }
    case "euler": {
      const g = Object.fromEntries(q.given) as Partial<Record<Part, number>>;
      // V − E + F = 2 solved with 0 (forgot the 2) or with −2 (wrong sign).
      if (q.part === "faces") return [["euler0", g.edges! - g.vertices!], ["eulerSign", g.edges! - g.vertices! - 2]];
      if (q.part === "vertices") return [["euler0", g.edges! - g.faces!], ["eulerSign", g.edges! - g.faces! - 2]];
      return [["euler0", g.vertices! + g.faces!], ["eulerSign", g.vertices! + g.faces! + 2]];
    }
  }
}

/** Which slip an answer is, if any. */
export function solidMistake(q: SolidQuestion, v: number): SolidTag {
  if (v === q.value) return "right";
  for (const [tag, x] of solidSlips(q)) if (x !== q.value && x === v) return tag;
  return "other";
}

/** Four different positive numbers: the answer, the first slips, then neighbours. */
function withOptions<Q extends SolidCore>(rng: Rng, q: Q): Q & Choices {
  const values = [q.value];
  const tags: (SolidTag | null)[] = [null];
  const add = (v: number, t: SolidTag | null) => {
    if (v > 0 && values.length < 4 && !values.includes(v)) {
      values.push(v);
      tags.push(t);
    }
  };
  // Keep at most three slips, so a neighbour of the answer is sometimes an option too.
  for (const [t, v] of solidSlips(q)) add(v, t);
  for (const d of shuffle(rng, [1, -1, 2, -2, 3])) add(q.value + d, null);
  const order = shuffle(rng, [0, 1, 2, 3]);
  return { ...q, options: order.map((i) => values[i]), mistakes: order.map((i) => tags[i]), answer: order.indexOf(0) };
}

export function makeSolidQuestion(level: Level, seed: number): SolidQuestion {
  const rng = mulberry32(seed * 13 + level * 977 + 5);
  const base = { type: "solid" as const, seed, level };

  if (level === 1) {
    const solid = pick(rng, BASIC_SOLIDS);
    const part = pick(rng, PARTS);
    return withOptions(rng, { ...base, kind: "count" as const, solid, part, value: counts(solid)[part] });
  }

  if (level === 2) {
    const [a, b] = shuffle(rng, BASIC_SOLIDS).slice(0, 2);
    const part = pick(rng, PARTS);
    const op = rng() < 0.5 ? "sum" : "diff";
    const ca = counts(a)[part];
    const cb = counts(b)[part];
    if (op === "diff" && ca === cb) return makeSolidQuestion(level, seed + 100_003);
    // The solid with more comes first, so "how many more" reads naturally.
    const solids: [Solid, Solid] = op === "diff" && cb > ca ? [b, a] : [a, b];
    return withOptions(rng, { ...base, kind: "combine" as const, solids, op, part, value: op === "sum" ? ca + cb : Math.abs(ca - cb) });
  }

  const family: Family = rng() < 0.6 ? "prism" : "pyramid";
  const solid = familyOf(family, 3 + randInt(rng, 8));
  const c = counts(solid);
  if (rng() < 0.6) {
    // A pyramid has as many faces as vertices: never ask one from the other.
    const pairs: [Part, Part][] =
      family === "prism"
        ? [["edges", "faces"], ["edges", "vertices"], ["faces", "edges"], ["vertices", "edges"], ["faces", "vertices"], ["vertices", "faces"]]
        : [["edges", "faces"], ["edges", "vertices"], ["faces", "edges"], ["vertices", "edges"]];
    const [given, part] = pick(rng, pairs);
    return withOptions(rng, { ...base, kind: "reverse" as const, solid, given, givenValue: c[given], part, value: c[part] });
  }
  const part = pick(rng, PARTS);
  const given = PARTS.filter((p) => p !== part).map((p): [Part, number] => [p, c[p]]);
  return withOptions(rng, { ...base, kind: "euler" as const, solid, given, part, value: c[part] });
}

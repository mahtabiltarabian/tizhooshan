import { describe, expect, it } from "vitest";
import { angleOf, exploreFigure, makeParallelQuestion, PARALLEL_VARIANTS, parallelMistake, unitOf, type Level, type PAngle, type ParallelQuestion, type PLine, type XY } from "./parallel-angles";
import { geometryMistake, makeGeometryQuestion } from "./geometry";

const LEVELS: Level[] = [1, 2, 3];
const EPS = 1e-6;

const sub = (a: XY, b: XY): XY => [a[0] - b[0], a[1] - b[1]];
const same = (a: XY, b: XY, eps = 1e-6) => Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps;
const opp = (a: XY, b: XY) => same(a, [-b[0], -b[1]]);
const cross = (a: XY, b: XY) => a[0] * b[1] - a[1] * b[0];
const arms = (a: PAngle): [XY, XY] => [unitOf(sub(a.p, a.v)), unitOf(sub(a.q, a.v))];
const lineDir = (l: PLine) => unitOf(sub(l.b, l.a));

/** Is p on the segment l (within eps)? */
function onLine(l: PLine, p: XY, eps = 1e-6) {
  const d = sub(l.b, l.a);
  const len = Math.hypot(d[0], d[1]);
  const t = ((p[0] - l.a[0]) * d[0] + (p[1] - l.a[1]) * d[1]) / (len * len);
  return Math.abs(cross(d, sub(p, l.a))) / len < eps && t > -eps && t < 1 + eps;
}

/** The marked-parallel line (par or helper) through v along direction u, if any. */
const markedLine = (q: ParallelQuestion, v: XY, u: XY) => q.fig.lines.find((l) => (l.kind === "par" || l.kind === "helper") && l.arrows > 0 && onLine(l, v) && Math.abs(cross(lineDir(l), u)) < EPS);

/**
 * Work the question out from the printed angles only, checking that each step
 * is a true fact of the drawn figure: the same rays where it says so, and
 * "parallel" only along lines that carry the parallel marks.
 */
function solve(q: ParallelQuestion): string[] {
  const bad: string[] = [];
  const A = (id: string) => q.fig.angles.find((a) => a.id === id)!;
  const known = new Map<string, number>(q.fig.angles.filter((a) => a.role === "given").map((a) => [a.id, a.deg]));
  let helper = false;
  for (const s of q.steps) {
    if (s.fact === "helper") {
      helper = q.fig.lines.some((l) => l.kind === "helper" && l.arrows > 0);
      if (!helper) bad.push("no helper line");
      continue;
    }
    if (!s.to) {
      bad.push(`${s.fact}: nothing found`);
      continue;
    }
    if (!s.from.every((f) => known.has(f))) {
      bad.push(`${s.fact} → ${s.to}: uses an angle not yet known (${s.from.join(",")})`);
      continue;
    }
    const v = s.from.map((f) => known.get(f)!);
    const to = A(s.to);
    const fr = s.from.map(A);
    const [u2, w2] = arms(to);
    let value = NaN;
    switch (s.fact) {
      case "vertical": {
        const [u1, w1] = arms(fr[0]);
        if (!same(fr[0].v, to.v) || !((opp(u1, u2) && opp(w1, w2)) || (opp(u1, w2) && opp(w1, u2)))) bad.push(`vertical ${s.to}: not opposite`);
        value = v[0];
        break;
      }
      case "linear": {
        const [u1, w1] = arms(fr[0]);
        const ok = same(fr[0].v, to.v) && [[u1, w1], [w1, u1]].some(([sh, ot]) => [[u2, w2], [w2, u2]].some(([sh2, ot2]) => same(sh, sh2) && opp(ot, ot2)));
        if (!ok) bad.push(`linear ${s.to}: not side by side on a line`);
        value = 180 - v[0];
        break;
      }
      case "corresponding":
      case "alternate": {
        const [u1, w1] = arms(fr[0]);
        const k = s.fact === "corresponding" ? 1 : -1;
        const eq = (a: XY, b: XY) => (k === 1 ? same(a, b) : opp(a, b));
        const pairs: [XY, XY, XY, XY][] = [
          [u1, w1, u2, w2],
          [u1, w1, w2, u2],
        ];
        const along = unitOf(sub(to.v, fr[0].v));
        const ok = pairs.some(([a, b, c, d]) => {
          if (!eq(a, c) || !eq(b, d)) return false;
          // One arm pair runs along the transversal joining the two corners; the other along marked parallels.
          const [tr, par1, par2] = Math.abs(cross(a, along)) < EPS ? [a, b, d] : [b, a, c];
          return Math.abs(cross(tr, along)) < EPS && !!markedLine(q, fr[0].v, par1) && !!markedLine(q, to.v, par2);
        });
        if (same(fr[0].v, to.v) || !ok) bad.push(`${s.fact} ${s.from[0]} → ${s.to}: not a parallel pair`);
        value = v[0];
        break;
      }
      case "triangle": {
        const corners = [...fr, to].map((a) => a.v);
        const ok =
          !same(corners[0], corners[1]) &&
          !same(corners[1], corners[2]) &&
          !same(corners[0], corners[2]) &&
          [...fr, to].every((a, i) => {
            const others = corners.filter((_, j) => j !== i).map((c) => unitOf(sub(c, a.v)));
            const [x, y] = arms(a);
            return (same(x, others[0]) && same(y, others[1])) || (same(x, others[1]) && same(y, others[0]));
          });
        if (!ok) bad.push(`triangle ${s.to}: not the three corners of a triangle`);
        value = 180 - v[0] - v[1];
        break;
      }
      case "parts": {
        if (!helper) bad.push("parts before the helper line");
        if (!fr.every((a) => same(a.v, to.v))) bad.push("parts: not one corner");
        // Either to = from0 + from1 (sharing an arm), or to = from0 − from1 (from1 inside from0).
        value = to.deg > Math.max(v[0], v[1]) ? v[0] + v[1] : v[0] - v[1];
        break;
      }
      case "point": {
        if (!same(fr[0].v, to.v) || !to.reflex) bad.push("point: not the outside of the same corner");
        value = 360 - v[0];
        break;
      }
    }
    if (Math.abs(value - to.deg) > EPS) bad.push(`${s.fact} → ${s.to}: gives ${value}, drawn ${to.deg}`);
    if (value !== s.value) bad.push(`${s.fact} → ${s.to}: step says ${s.value}`);
    known.set(s.to, value);
  }
  if (known.get(q.ask) !== q.answer) bad.push(`chain ends at ${known.get(q.ask)}, answer ${q.answer}`);
  return bad;
}

/** Everything wrong with a question. */
function problems(q: ParallelQuestion): string[] {
  const bad: string[] = [];
  // Every angle recomputed from the drawing, whole degrees, readable.
  for (const a of q.fig.angles) {
    const g = angleOf(a.v, a.p, a.q, a.reflex);
    if (Math.abs(g - a.deg) > 1e-6) bad.push(`${a.id}: drawn ${g}, stored ${a.deg}`);
    if (a.deg < 20) bad.push(`${a.id}: ${a.deg}° is too thin`);
    // Both arms lie along drawn lines through the corner.
    for (const u of arms(a)) if (!q.fig.lines.some((l) => onLine(l, a.v) && Math.abs(cross(lineDir(l), u)) < EPS)) bad.push(`${a.id}: an arm is not on a line`);
  }
  const ask = q.fig.angles.filter((a) => a.role === "ask");
  if (ask.length !== 1 || ask[0].id !== q.ask || ask[0].deg !== q.answer) bad.push("ask mark");
  if (!Number.isInteger(q.answer) || q.answer <= 0 || q.answer >= 360) bad.push(`answer ${q.answer}`);
  // Marked lines are parallel; an unmarked straight line is clearly not.
  const par = q.fig.lines.filter((l) => l.kind === "par" || l.kind === "helper");
  for (const l of par) if (Math.abs(cross(lineDir(l), lineDir(par[0]))) > EPS) bad.push("marked lines not parallel");
  for (const l of q.fig.lines.filter((l) => l.kind === "plain")) if (Math.asin(Math.min(1, Math.abs(cross(lineDir(l), lineDir(par[0]))))) < (8 * Math.PI) / 180) bad.push("plain line looks parallel");
  // Drawn lines meet only at named points (the helper is drawn only in "show me").
  const drawn = q.fig.lines.filter((l) => l.kind !== "helper");
  for (let i = 0; i < drawn.length; i++)
    for (let j = i + 1; j < drawn.length; j++) {
      const [a, b] = [drawn[i], drawn[j]];
      const r = sub(a.b, a.a);
      const s = sub(b.b, b.a);
      const den = cross(r, s);
      if (Math.abs(den) < EPS) continue;
      const t = cross(sub(b.a, a.a), s) / den;
      const u = cross(sub(b.a, a.a), r) / den;
      if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) continue;
      const p: XY = [a.a[0] + r[0] * t, a.a[1] + r[1] * t];
      if (!q.fig.points.some((P) => same(P.at, p, 1e-6))) bad.push(`lines meet at an unnamed point (${p.map((x) => x.toFixed(2))})`);
    }
  // Triangles: a base wide enough for the two base-angle numbers.
  if (q.variant.startsWith("tri") || q.variant.startsWith("twoTrans")) {
    const [A, B] = ["A", "B"].map((n) => q.fig.points.find((p) => p.name === n)!.at);
    if (Math.hypot(A[0] - B[0], A[1] - B[1]) < 3.8 - 1e-9) bad.push("triangle base too narrow");
  }
  // Letters: unit directions, one per point, names unique.
  if (new Set(q.fig.points.map((p) => p.name)).size !== q.fig.points.length) bad.push("repeated point names");
  for (const p of q.fig.points) if (Math.abs(Math.hypot(p.off[0], p.off[1]) - 1) > 1e-6) bad.push(`letter ${p.name}`);
  bad.push(...solve(q));
  // Slips: whole, distinct, not the answer, and not another angle of the figure that is printed.
  const vals = q.slips.map((s) => s.value);
  if (new Set(vals).size !== vals.length) bad.push("repeated slip");
  for (const s of q.slips) {
    if (s.value === q.answer || !Number.isInteger(s.value) || s.value <= 0 || s.value >= 360) bad.push(`slip ${s.tag} ${s.value}`);
    if (parallelMistake(q, s.value) !== s.tag) bad.push(`slip ${s.tag} not found back`);
  }
  if (!q.slips.length) bad.push("no slips");
  return bad;
}

describe("parallel lines and angles", () => {
  it("is the same for the same seed", () => {
    for (const l of LEVELS) expect(makeParallelQuestion(l, 42)).toEqual(makeParallelQuestion(l, 42));
    expect(makeGeometryQuestion("parallel", 2, 7)).toEqual(makeParallelQuestion(2, 7));
  });

  it("gives a sound question with one right answer for 10,000 seeds of every level", () => {
    const fails: string[] = [];
    for (const level of LEVELS) {
      const answers = new Set<number>();
      const variants = new Set<string>();
      const tags = new Set<string>();
      for (let seed = 0; seed < 10_000; seed++) {
        const q = makeParallelQuestion(level, seed);
        if (q.level !== level || q.seed !== seed) fails.push(`${level}/${seed}: header`);
        answers.add(q.answer);
        variants.add(q.variant);
        q.slips.forEach((s) => tags.add(s.tag));
        for (const p of problems(q)) if (fails.length < 30) fails.push(`${level}/${seed} ${q.variant}: ${p}`);
      }
      if (answers.size < 30) fails.push(`${level}: only ${answers.size} answers`);
      for (const v of PARALLEL_VARIANTS[level]) if (!variants.has(v)) fails.push(`${level}: never ${v}`);
      const want = { 1: ["equalNotSupp", "suppNotEqual", "added"], 2: ["equalNotSupp", "suppNotEqual", "notParallel", "added", "sum360"], 3: ["equalNotSupp", "suppNotEqual", "added", "sum360", "subtracted", "asTriangle", "insideBend", "pointAs180"] }[level];
      for (const t of want) if (!tags.has(t)) fails.push(`${level}: slip ${t} never comes up`);
    }
    expect(fails).toEqual([]);
  }, 240_000);

  it("names the slips through geometryMistake", () => {
    for (let seed = 0; seed < 300; seed++) {
      const q = makeParallelQuestion(2, seed);
      expect(geometryMistake(q, q.answer)).toBe("right");
      for (const s of q.slips) expect(geometryMistake(q, s.value)).toBe(s.tag);
      expect(geometryMistake(q, 999)).toBe("other");
    }
  });

  it("explore: parallel lines make four equal acute and four equal obtuse angles; a turned line breaks it", () => {
    for (let phi = 20; phi <= 160; phi++) {
      const f = exploreFigure(phi, 0);
      for (const a of f.angles) expect(Math.abs(angleOf(a.v, a.p, a.q) - a.deg)).toBeLessThan(1e-6);
      const values = new Set(f.angles.map((a) => a.deg));
      expect([...values].sort((x, y) => x - y)).toEqual(phi === 90 ? [90] : [Math.min(phi, 180 - phi), Math.max(phi, 180 - phi)]);
      // Round each crossing: 360.
      expect(f.angles.slice(0, 4).reduce((s, a) => s + a.deg, 0)).toBe(360);
      const g = exploreFigure(phi, 12);
      const top = g.angles.slice(0, 4).map((a) => a.deg);
      const bottom = g.angles.slice(4).map((a) => a.deg);
      expect(top).not.toEqual(bottom);
      expect(bottom.reduce((s, a) => s + a, 0)).toBe(360);
    }
  });
});

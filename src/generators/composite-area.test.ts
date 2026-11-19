import { describe, expect, it } from "vitest";
import { figureArea, measureMistake, type Edge, type Level, type XY } from "./circle";
import { COMPOSITE_VARIANTS, makeCompositeQuestion, type CompositeQuestion } from "./composite-area";
import { sampledArea } from "./figure-check";

const LEVELS: Level[] = [1, 2, 3];

/** The answer in hundredths, from the labelled lengths only, the way a child works it (π = 3.14). */
function expected(q: CompositeQuestion): number {
  const given = Object.fromEntries(q.fig.dims.filter((d) => d.given).map((d) => [d.name, d.value]));
  const v = (n: string) => {
    if (!(n in given)) throw new Error(`${q.variant}: ${n} is not labelled`);
    return given[n];
  };
  switch (q.variant) {
    case "L": {
      // Split into the bottom bar and the arm above it; work out the missing sides first.
      if (q.labels === "outer") return 100 * (v("W") * v("b") + v("a") * (v("H") - v("b")));
      if (q.labels === "sum") return 100 * ((v("a") + v("ih")) * v("b") + v("a") * (v("H") - v("b")));
      return 100 * (v("W") * (v("H") - v("iv")) + v("a") * v("iv"));
    }
    case "hole":
      return 100 * (v("W") * v("H") - v("w") * v("h"));
    case "frame":
      return 100 * (v("W") * v("H") - (v("W") - 2 * v("t")) * (v("H") - 2 * v("t")));
    case "triCut":
      return 50 * (2 * v("W") * v("H") - v("p") * v("q"));
    case "squareQuarters":
      return 100 * v("s") * v("s") - 314 * v("r") * v("r");
    case "squareCircle":
      return 100 * v("s") * v("s") - (314 * v("s") * v("s")) / 4;
    case "cornerQuarter":
      return 100 * v("s") * v("s") - (314 * v("s") * v("s")) / 4;
    case "rectSemi":
      return 100 * v("W") * v("H") + (314 * (v("W") / 2) ** 2) / 2;
  }
}

/** Is p on one of the drawn edges? */
function onEdges(edges: Edge[], p: XY) {
  return edges.some((e) => {
    if (e.kind === "arc") return Math.abs(Math.hypot(p[0] - e.c[0], p[1] - e.c[1]) - e.r) < 1e-9;
    const [ax, ay, bx, by] = [e.a[0], e.a[1], e.b[0], e.b[1]];
    const cross = (bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax);
    return Math.abs(cross) < 1e-9 && p[0] >= Math.min(ax, bx) - 1e-9 && p[0] <= Math.max(ax, bx) + 1e-9 && p[1] >= Math.min(ay, by) - 1e-9 && p[1] <= Math.max(ay, by) + 1e-9;
  });
}

describe("composite area questions", () => {
  it("is the same for the same seed", () => {
    for (const l of LEVELS) expect(makeCompositeQuestion(l, 42)).toEqual(makeCompositeQuestion(l, 42));
  });

  it("gives one right answer and named slips for 10,000 seeds of every level", () => {
    const fails: string[] = [];
    const tags: Record<string, number> = {};
    const kinds: Record<string, number> = {};
    for (const level of LEVELS)
      for (let seed = 0; seed < 10_000; seed++) {
        const q = makeCompositeQuestion(level, seed);
        const fail = (why: string) => fails.length < 20 && fails.push(`L${level} seed ${seed} ${q.variant}: ${why}`);
        if (q.level !== level || q.seed !== seed || !COMPOSITE_VARIANTS[level].includes(q.variant)) fail("header");
        // Only the labelled lengths fix the answer.
        let want = NaN;
        try {
          want = expected(q);
        } catch (e) {
          fail(String(e));
        }
        if (Math.round(q.answer * 100) !== want) fail(`answer ${q.answer} ≠ ${want / 100}`);
        if (q.answer <= 0 || q.answer >= 1000 || Math.abs(q.answer * 100 - Math.round(q.answer * 100)) > 1e-6) fail("answer size");
        // The parts add up to the measure, and π = 3.14 is close to the real area.
        const own = figureArea(q.fig);
        if (Math.abs(own.lin - q.measure.lin) > 1e-9 || Math.abs(own.pi - q.measure.pi) > 1e-9) fail("parts");
        const exact = q.measure.lin + q.measure.pi * Math.PI;
        if (Math.abs(exact - q.answer) > Math.abs(q.measure.pi) * 0.0017 + 1e-9) fail("measure");
        if (level === 3 && !q.measure.pi) fail("level 3 without a circle");
        if (level < 3 && q.measure.pi) fail("circle below level 3");
        // A sample: the drawn parts, measured by sampling, have that area and do not overlap.
        if (seed < 120) {
          const s = sampledArea(q.fig);
          if (s.clash > 0.05 || Math.abs(s.area - exact) > 0.01 * exact + 0.1) fail(`sampled area ${s.area} ≠ ${exact} (clash ${s.clash})`);
        }
        // Lengths: their numbers are their lengths, and the labelled sides lie on the drawn outline.
        for (const d of q.fig.dims) {
          if (Math.abs(Math.hypot(d.b[0] - d.a[0], d.b[1] - d.a[1]) - d.value) > 1e-9 || d.value <= 0) fail(`dim ${d.name}`);
          if (!d.line && !(onEdges(q.fig.edges, d.a) && onEdges(q.fig.edges, d.b))) fail(`dim ${d.name} off the figure`);
        }
        if (q.variant === "L" && q.fig.dims.filter((d) => d.given).length !== 4) fail("L labels");
        // Slips: positive, all different, never the answer, each named.
        const hs = q.slips.map((s) => Math.round(s.value * 100));
        if (!q.slips.length) fail("no slip");
        if (new Set(hs).size !== hs.length || hs.includes(Math.round(q.answer * 100)) || q.slips.some((s) => s.value <= 0)) fail("slips");
        if (measureMistake(q, Number(String(q.answer))) !== "right") fail("right");
        for (const s of q.slips) if (measureMistake(q, Number(String(s.value))) !== s.tag) fail("slip tag");
        q.slips.forEach((s) => (tags[s.tag] = (tags[s.tag] ?? 0) + 1));
        const k = `${level}:${q.variant}${q.variant === "L" ? `:${q.labels}` : ""}`;
        kinds[k] = (kinds[k] ?? 0) + 1;
      }
    expect(fails).toEqual([]);
    // The three slips the topic is about turn up often.
    for (const t of ["overlapTwice", "added", "missingLength"]) expect(tags[t] ?? 0).toBeGreaterThan(2000);
    for (const k of ["1:L:outer", "1:L:sum", "1:L:diff", "2:hole", "2:frame", "2:triCut", "3:squareQuarters", "3:squareCircle", "3:cornerQuarter", "3:rectSemi"]) expect(kinds[k] ?? 0).toBeGreaterThan(1500);
  }, 240_000);

  it("names the classic slips", () => {
    // An L: 8 wide, 6 tall, arm 3 wide, bar 2 tall: 16 + 12 = 28.
    let q = makeCompositeQuestion(1, 0);
    const val = (n: string) => q.fig.dims.find((d) => d.name === n)!.value;
    for (let s = 0; !(q.labels === "outer" && val("W") === 8 && val("H") === 6 && val("a") === 3 && val("b") === 2); s++) q = makeCompositeQuestion(1, s);
    expect(q.answer).toBe(28);
    expect(measureMistake(q, 34)).toBe("overlapTwice");
    expect(measureMistake(q, 48)).toBe("noCut");
    expect(measureMistake(q, 22)).toBe("missingLength");
    // Four quarter circles of radius 5 in a 10 × 10 square: 100 − 78.5.
    let c = makeCompositeQuestion(3, 0);
    for (let s = 0; !(c.variant === "squareQuarters" && c.fig.dims[0].value === 10); s++) c = makeCompositeQuestion(3, s);
    expect(c.answer).toBe(21.5);
    expect(measureMistake(c, 178.5)).toBe("added");
  });
});

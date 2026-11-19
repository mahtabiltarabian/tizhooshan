import { describe, expect, it } from "vitest";
import { CIRCLE_VARIANTS, cleanSlips, edgeLength, figureArea, hundredths, makeCircleQuestion, measureMistake, mirrorFigure, withPi, type CircleQuestion, type Edge, type Figure, type Level } from "./circle";
import { chordLength, sampledArea } from "./figure-check";

const LEVELS: Level[] = [1, 2, 3];

/** The answer in hundredths, from only what the question tells, the way a child works it. */
function expected(q: CircleQuestion): number {
  // Radius from what is told (circumference = diameter × 3.14).
  const r = q.given === "r" ? q.givenValue : q.given === "d" ? q.givenValue / 2 : Math.round((q.givenValue * 100) / 628);
  if (q.given === "C") expect(Math.round(q.givenValue * 100)).toBe(628 * r);
  const P = 314;
  switch (q.variant) {
    case "circC":
      return 2 * r * P;
    case "circA":
    case "fromCtoA":
      return r * r * P;
    case "semiA":
      return (r * r * P) / 2;
    case "semiP":
      return (r * P) + 2 * r * 100;
    case "quarterA":
      return (r * r * P) / 4;
    case "quarterP":
      return (r * P) / 2 + 2 * r * 100;
    case "fromC":
      return (q.asks === "r" ? r : 2 * r) * 100;
    case "ring": {
      const inner = q.fig.dims.find((d) => d.name === "r" && d.given)!.value;
      return (r * r - inner * inner) * P;
    }
  }
}

describe("measures with π = 3.14", () => {
  it("works in hundredths", () => {
    expect(withPi({ lin: 0, pi: 25 })).toBe(78.5);
    expect(withPi({ lin: 10, pi: 5 })).toBe(25.7);
    expect(withPi({ lin: 0, pi: 9 })).toBe(28.26);
    expect(hundredths({ lin: 0, pi: 0.25 })).toBeNull();
    expect(cleanSlips(78.5, [["dAsR", { lin: 0, pi: 25 }], ["added", { lin: 0, pi: 4 }], ["bigOnly", { lin: 0, pi: 4 }], ["holeOnly", { lin: 0, pi: -1 }]])).toEqual([{ tag: "added", value: 12.56 }]);
  });

  it("mirrors figures without changing their area or edges", () => {
    const f: Figure = {
      parts: [
        { kind: "rect", x: 0, y: 0, w: 4, h: 4, sign: 1 },
        { kind: "sector", c: [0, 4], r: 4, from: 270, sweep: 90, sign: -1 },
      ],
      edges: [{ kind: "arc", c: [0, 4], r: 4, from: 270, sweep: 90 }],
      dims: [],
    };
    for (const [fx, fy] of [
      [true, false],
      [false, true],
      [true, true],
    ]) {
      const g = mirrorFigure(f, 4, 4, fx, fy);
      const s = sampledArea(g, 0.02);
      expect(s.clash).toBeLessThan(0.05);
      expect(Math.abs(s.area - (16 - 4 * Math.PI))).toBeLessThan(0.05);
      // The arc still runs between two corners of the square.
      const e = g.edges[0] as Extract<Edge, { kind: "arc" }>;
      for (const t of [e.from, e.from + 90]) {
        const p = [e.c[0] + 4 * Math.cos((t * Math.PI) / 180), e.c[1] + 4 * Math.sin((t * Math.PI) / 180)];
        expect(p.every((v) => Math.abs(v) < 1e-9 || Math.abs(v - 4) < 1e-9)).toBe(true);
      }
    }
  });
});

describe("circle questions", () => {
  it("is the same for the same seed", () => {
    for (const l of LEVELS) expect(makeCircleQuestion(l, 42)).toEqual(makeCircleQuestion(l, 42));
  });

  it("gives one right answer and named slips for 10,000 seeds of every level", () => {
    const fails: string[] = [];
    const tags: Record<string, number> = {};
    const kinds: Record<string, number> = {};
    for (const level of LEVELS)
      for (let seed = 0; seed < 10_000; seed++) {
        const q = makeCircleQuestion(level, seed);
        const fail = (why: string) => fails.length < 20 && fails.push(`L${level} seed ${seed} ${q.variant}: ${why}`);
        if (q.level !== level || q.seed !== seed || !CIRCLE_VARIANTS[level].includes(q.variant)) fail("header");
        // The answer, from what the question tells only.
        if (Math.round(q.answer * 100) !== expected(q)) fail(`answer ${q.answer} ≠ ${expected(q) / 100}`);
        if (Math.abs(q.answer * 100 - Math.round(q.answer * 100)) > 1e-6) fail("more than two decimals");
        if (q.answer <= 0 || q.answer >= 1000) fail("answer size");
        // The kept measure is the true one: π = 3.14 against the real π is only 0.0016 per π.
        const exact = q.measure.lin + q.measure.pi * Math.PI;
        if (Math.abs(exact - q.answer) > Math.abs(q.measure.pi) * 0.0017 + 1e-9) fail("measure");
        // The figure: area and perimeter questions match its parts and edges.
        if (q.asks === "A" && Math.abs(figureArea(q.fig).pi - q.measure.pi) > 1e-9) fail("figure area");
        if (q.asks === "P") {
          const per = q.fig.edges.reduce((s, e) => ({ lin: s.lin + edgeLength(e).lin, pi: s.pi + edgeLength(e).pi }), { lin: 0, pi: 0 });
          if (Math.abs(per.lin - q.measure.lin) > 1e-9 || Math.abs(per.pi - q.measure.pi) > 1e-9) fail("figure perimeter");
          if (seed < 100) {
            const chords = q.fig.edges.reduce((s, e) => s + chordLength(e), 0);
            if (Math.abs(chords - exact) > 1e-3) fail(`chords ${chords} ≠ ${exact}`);
          }
        }
        if (q.asks === "A" && seed < 60) {
          const s = sampledArea(q.fig);
          if (s.clash > 0.05 || Math.abs(s.area - exact) > 0.01 * exact + 0.1) fail(`sampled area ${s.area} ≠ ${exact}`);
        }
        // The told length is on the figure (a circumference is told in words), and the asked one is «؟».
        for (const d of q.fig.dims) if (Math.abs(Math.hypot(d.b[0] - d.a[0], d.b[1] - d.a[1]) - d.value) > 1e-9) fail(`dim ${d.name}`);
        if (q.given !== "C" && !q.fig.dims.some((d) => d.given && d.name === (q.variant === "ring" ? "R" : q.given) && d.value === q.givenValue)) fail("told length not drawn");
        if ((q.asks === "r" || q.asks === "d") !== q.fig.dims.some((d) => d.ask)) fail("asked length");
        if (q.fig.dims.some((d) => d.given && d.ask)) fail("given and asked");
        // Slips: positive, two decimals, all different, never the answer, each named.
        const hs = q.slips.map((s) => Math.round(s.value * 100));
        if (!q.slips.length) fail("no slip");
        if (new Set(hs).size !== hs.length || hs.includes(Math.round(q.answer * 100)) || q.slips.some((s) => s.value <= 0 || Math.abs(s.value * 100 - Math.round(s.value * 100)) > 1e-6)) fail("slips");
        if (measureMistake(q, q.answer) !== "right") fail("right");
        // Typed the way a child types it.
        if (measureMistake(q, Number(String(q.answer))) !== "right") fail("typed right");
        for (const s of q.slips) if (measureMistake(q, Number(String(s.value))) !== s.tag) fail("slip tag");
        q.slips.forEach((s) => (tags[s.tag] = (tags[s.tag] ?? 0) + 1));
        kinds[`${level}:${q.variant}:${q.given}`] = (kinds[`${level}:${q.variant}:${q.given}`] ?? 0) + 1;
      }
    expect(fails).toEqual([]);
    // The slips the topic is about turn up often.
    for (const t of ["dAsR", "noStraight", "squaredD", "circForArea", "wholeCircle"]) expect(tags[t] ?? 0).toBeGreaterThan(500);
    // Every form turns up, with a radius and with a diameter.
    for (const k of ["1:circC:r", "1:circC:d", "1:circA:r", "1:circA:d", "2:semiA:r", "2:semiA:d", "2:semiP:r", "2:semiP:d", "2:quarterA:r", "2:fromC:C", "3:quarterP:r", "3:fromCtoA:C", "3:ring:r"])
      expect(kinds[k] ?? 0).toBeGreaterThan(400);
  }, 240_000);

  it("names the classic slips", () => {
    // A semicircle with diameter 10: perimeter 15.7 + 10.
    let q = makeCircleQuestion(2, 0);
    for (let s = 0; !(q.variant === "semiP" && q.given === "d" && q.givenValue === 10); s++) q = makeCircleQuestion(2, s);
    expect(q.answer).toBe(25.7);
    expect(measureMistake(q, 15.7)).toBe("noStraight");
    expect(measureMistake(q, 51.4)).toBe("dAsR");
    expect(measureMistake(q, 25.7)).toBe("right");
    // A circle with radius 3: area 28.26; 2πr is 18.84; (2r)² is 113.04.
    let a = makeCircleQuestion(1, 0);
    for (let s = 0; !(a.variant === "circA" && a.given === "r" && a.r === 3); s++) a = makeCircleQuestion(1, s);
    expect(a.answer).toBe(28.26);
    expect(measureMistake(a, 18.84)).toBe("circForArea");
    expect(measureMistake(a, 113.04)).toBe("squaredD");
  });
});

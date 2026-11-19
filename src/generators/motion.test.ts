import { describe, expect, it } from "vitest";
import {
  answerKind,
  CCW,
  CW,
  dirOf,
  faceAfter,
  makeMotionQuestion,
  motionMistake,
  positionAt,
  routes,
  slips,
  STEP,
  validMachine,
  walkGrid,
  wheelTurns,
  wrap4,
  type Machine,
  type MotionQuestion,
  type MotionQuestionType,
  type Level,
  type Pt,
} from "./motion";

const TYPES: MotionQuestionType[] = ["gearDir", "gearTurns", "trip", "chase", "orient", "grid", "spacing"];
const LEVELS: Level[] = [1, 2, 3];
const gears = (...teeth: number[]): Machine => ({ wheels: teeth.map((size) => ({ kind: "gear", size })), links: teeth.slice(1).map(() => "mesh") });

/** Turn wheel 0 a full turn tooth by tooth (or centimetre by centimetre of belt) and read off every wheel. */
function countTurns(m: Machine, turns: number) {
  const out = [turns];
  m.links.forEach((l, i) => {
    // Teeth (or belt) passing the contact point: the same count on both wheels.
    const passed = l === "axle" ? null : Math.abs(out[i]) * m.wheels[i].size;
    const next = passed === null ? Math.abs(out[i]) : passed / m.wheels[i + 1].size;
    const sameWay = l === "axle" || l === "belt";
    out.push((Math.sign(out[i]) || 1) * (sameWay ? 1 : -1) * next);
  });
  return out;
}

/** Brute force: walk every shortest route, one block at a time. */
function countRoutes(w: number, h: number): number {
  if (w === 0 || h === 0) return 1;
  return countRoutes(w - 1, h) + countRoutes(w, h - 1);
}

describe("gear and belt arithmetic", () => {
  it("alternates direction along a chain of gears", () => {
    const m = gears(12, 24, 18, 30);
    expect([0, 1, 2, 3].map((i) => dirOf(m, i, CW))).toEqual([CW, CCW, CW, CCW]);
    expect(dirOf(m, 3, CCW)).toBe(CW);
  });

  it("scales turns by the teeth ratio, and the gears in between do not matter", () => {
    expect(wheelTurns(gears(24, 12), 3)).toEqual([3, -6]);
    expect(wheelTurns(gears(12, 36), 6)).toEqual([6, -2]);
    expect(wheelTurns(gears(30, 17, 10), 2)[2]).toBe(6);
    expect(wheelTurns(gears(30, 40, 10), 2)[2]).toBe(6);
  });

  it("keeps the direction on a straight belt and reverses it on a crossed belt", () => {
    const p = (a: number, b: number, link: "belt" | "cross"): Machine => ({ wheels: [{ kind: "pulley", size: a }, { kind: "pulley", size: b }], links: [link] });
    expect(wheelTurns(p(30, 20, "belt"), 4)).toEqual([4, 6]);
    expect(wheelTurns(p(30, 20, "cross"), 4)).toEqual([4, -6]);
    // Gear, then a pulley on its axle, then a crossed belt.
    const mixed: Machine = {
      wheels: [
        { kind: "gear", size: 20 },
        { kind: "gear", size: 40 },
        { kind: "pulley", size: 10 },
        { kind: "pulley", size: 30 },
      ],
      links: ["mesh", "axle", "cross"],
    };
    expect(validMachine(mixed)).toBe(true);
    expect(wheelTurns(mixed, 6)).toEqual([6, -3, -3, 1]);
    expect(validMachine({ ...mixed, links: ["mesh", "belt", "cross"] })).toBe(false);
  });
});

describe("motion, facing and grid arithmetic", () => {
  it("moves along the track and stops at its ends", () => {
    const a = { start: 0, speed: 60, dir: 1 as const, delay: 0 };
    const b = { start: 300, speed: 40, dir: -1 as const, delay: 1 };
    expect(positionAt(a, 2)).toBe(120);
    expect(positionAt(b, 1)).toBe(300);
    expect(positionAt(b, 3)).toBe(220);
    expect(positionAt(a, 10, 300)).toBe(300);
  });

  it("turns on the spot", () => {
    expect(faceAfter(0, [{ side: "R", quarter: 1 }])).toBe(1);
    expect(faceAfter(1, [{ side: "L", quarter: 1 }, { side: "L", quarter: 1 }])).toBe(3);
    expect(faceAfter(2, [{ side: "R", quarter: 3 }])).toBe(1);
    expect(wrap4(-1)).toBe(3);
  });

  it("walks the grid with map moves and with forward and turn", () => {
    const go = walkGrid({ x: 1, y: 1 }, 0, [
      { kind: "go", dir: 0, n: 2 },
      { kind: "go", dir: 1, n: 3 },
    ]);
    expect(go.path.at(-1)).toEqual({ x: 4, y: 3 });
    const turtle = walkGrid({ x: 0, y: 0 }, 1, [{ kind: "fwd", n: 2 }, { kind: "turn", side: "L" }, { kind: "fwd", n: 1 }]);
    expect(turtle.path.at(-1)).toEqual({ x: 2, y: 1 });
    expect(turtle.facing).toBe(0);
  });

  it("counts shortest routes", () => {
    expect(routes(2, 2)).toBe(6);
    expect(routes(3, 2)).toBe(10);
    expect(routes(4, 3)).toBe(35);
    for (let w = 1; w <= 5; w++) for (let h = 1; h <= 4; h++) expect(routes(w, h)).toBe(countRoutes(w, h));
  });
});

/**
 * Plants every thing of a spacing question one by one (metre marks along the
 * path) and counts; independent of the formulas the generator uses.
 */
function plant(q: Extract<MotionQuestion, { type: "spacing" }>) {
  const marks = (from: number, to: number, step: number) => {
    const out: number[] = [];
    for (let x = from; x <= to; x += step) out.push(x);
    return out;
  };
  switch (q.variant) {
    case "row":
      return marks(0, q.length, q.gap).length;
    case "ends":
      return marks(q.gap, q.length - q.gap, q.gap).length;
    case "sides":
      return 2 * marks(0, q.length, q.gap).length;
    case "loop":
      // Round the loop the last mark would land on the first again.
      return marks(0, q.length, q.gap).filter((x) => x < q.length).length;
    case "rect": {
      // Walk round the field and collect the corner points hit, without repeats.
      const pts = new Set<string>();
      const [w, h] = [q.length, q.width];
      for (let x = 0; x <= w; x += q.gap) pts.add(`${x},0`).add(`${x},${h}`);
      for (let y = 0; y <= h; y += q.gap) pts.add(`0,${y}`).add(`${w},${y}`);
      return pts.size;
    }
    case "cut":
      // Cuts at every piece length inside the log.
      return marks(q.gap, q.length - q.gap, q.gap).length;
    case "floors":
      return q.width - 1;
  }
}

/** A cheap check for the big sweep: `expect` is too slow for millions of calls. */
function ok(cond: boolean, what: string) {
  if (!cond) throw new Error(what);
}
const whole = (...vs: number[]) => vs.every((v) => Number.isInteger(v));

/** Checks a question by simulation, independently of how it was built. */
function check(q: MotionQuestion) {
  switch (q.type) {
    case "gearDir": {
      ok(validMachine(q.machine), "machine can be built");
      const turns = countTurns(q.machine, 1);
      const last = turns[turns.length - 1];
      ok(q.answer === ((last > 0) === (q.driver === CW) ? CW : CCW), "direction by counting");
      if (q.level === 1) ok(q.machine.wheels.length === 2, "two gears");
      if (q.level === 2) ok(q.machine.links.every((l) => l === "mesh") && q.machine.wheels.length >= 3, "a chain of gears");
      if (q.level === 3) ok(q.machine.links.includes("cross"), "a crossed belt");
      break;
    }
    case "gearTurns": {
      ok(validMachine(q.machine), "machine can be built");
      const turns = countTurns(q.machine, q.turns);
      ok(Math.abs(Math.abs(turns[turns.length - 1]) - q.answer) < 1e-9, "turns by counting teeth");
      ok(whole(q.answer, q.turns) && q.answer > 0 && q.answer !== q.turns, "whole, and not the driver's turns");
      ok(q.machine.wheels.every((w) => w.kind === (q.level === 3 ? "pulley" : "gear")), "gears, or pulleys at level 3");
      if (q.level < 3) ok(q.machine.wheels.length === q.level + 1, "two or three gears");
      break;
    }
    case "trip": {
      ok(whole(q.length, q.v1, q.v2, q.delay, q.time), "whole numbers");
      const a = { start: 0, speed: q.v1, dir: 1 as const, delay: 0 };
      if (q.level === 1) {
        ok(positionAt(a, q.time) === q.length, "arrives at the end");
        ok(q.answer === (q.ask === "time" ? q.time : q.ask === "dist" ? q.length : q.v1), "answer is the unknown");
      } else {
        const b = { start: q.length, speed: q.v2, dir: -1 as const, delay: q.delay };
        // They meet exactly at `time`, not before.
        ok(positionAt(a, q.time) === positionAt(b, q.time), "meet at time");
        ok(positionAt(a, q.time - 0.5) < positionAt(b, q.time - 0.5), "not before");
        ok(q.answer === (q.ask === "time" ? q.time : positionAt(a, q.time)), "answer");
        if (q.level === 2) ok(q.delay === 0, "both leave at once");
        if (q.level === 3) ok(q.delay > 0 && q.v1 * q.delay < q.length, "B leaves later, before A arrives");
      }
      break;
    }
    case "chase": {
      ok(whole(q.v1, q.v2, q.gap, q.lead, q.answer) && q.v1 > q.v2, "whole numbers, A faster");
      if (q.level === 2) ok(q.gap === q.v2 * q.delay, "B's head start");
      const gapAt = (t: number) => q.gap + q.v2 * t - q.v1 * t;
      ok(gapAt(q.answer) + q.lead === 0, "caught up (or ahead by the lead) at the answer");
      ok(gapAt(q.answer - 0.5) > -q.lead, "not before");
      ok(q.level < 3 ? q.lead === 0 : q.lead > 0, "a lead only at level 3");
      break;
    }
    case "orient": {
      let f = q.start as number;
      for (const t of q.turns) for (let i = 0; i < t.quarter; i++) f = (f + (t.side === "R" ? 1 : 3)) % 4;
      ok(q.answer === f, "facing by quarter turns");
      if (q.level === 1) ok(q.turns.every((t) => t.quarter === 1), "quarter turns only");
      else ok(q.turns.some((t) => t.quarter === 2), "an about-turn");
      if (q.level === 3) ok(q.turns.some((t) => t.quarter === 3), "a three-quarter turn");
      ok(q.turns[q.turns.length - 1].quarter !== 2, "about-turn not last");
      break;
    }
    case "spacing": {
      ok(whole(q.count, q.gap, q.length, q.width, q.per) && q.gap > 0, "whole numbers");
      const n = plant(q);
      switch (q.variant) {
        case "row":
          ok(n === q.count, "trees in the row");
          ok(q.answer === (q.ask === "length" ? q.length : q.ask === "count" ? q.count : q.gap), "row answer");
          ok(q.level === 1 ? q.ask !== "gap" : q.level === 3 && q.ask === "gap", "reverse row only at level 3");
          break;
        case "loop":
          ok(n === q.count && q.level === 2, "posts round the loop");
          ok(q.answer === (q.ask === "count" ? q.count : q.length), "loop answer");
          break;
        case "rect":
        case "ends":
        case "sides":
          ok(n === q.answer && q.ask === "count" && q.level === 3, "things counted one by one");
          if (q.variant === "rect") ok(q.length !== q.width && q.length % q.gap === 0 && q.width % q.gap === 0, "a post at each corner");
          break;
        case "cut":
          ok(n === q.count - 1, "cuts inside the log");
          if (q.ask === "cuts") ok(q.answer === n, "cuts");
          if (q.ask === "time") ok(q.answer === n * q.per, "time for the cuts");
          if (q.ask === "pieces") ok(q.per === n && q.answer === q.count, "pieces from cuts");
          if (q.ask === "length") ok(q.per === n && q.answer === q.length && q.level === 3, "log length from cuts, level 3");
          else ok(q.level === 2, "cutting at level 2");
          break;
        case "floors":
          ok(q.level === 3 && q.per === q.gap * (q.count - 1) && q.answer === q.gap * n && q.width > q.count, "flights, not floors");
          break;
      }
      // Each slip must be its own answer, so the feedback names it.
      const vals = slips(q).map(([, v]) => v);
      ok(vals.every((v) => v !== q.answer), "no slip is the right answer");
      break;
    }
    case "grid": {
      if (q.variant === "routes") {
        ok(q.answer === countRoutes(q.cols, q.rows), "routes by brute force");
        break;
      }
      ok(q.variant === (q.level === 1 ? "walk" : "turtle"), "variant by level");
      const key = (p: Pt) => `${p.x},${p.y}`;
      ok(q.points.length === 4 && new Set(q.points.map(key)).size === 4, "four different points");
      let p = { ...q.start };
      let f = q.facing as number;
      for (const c of q.cmds) {
        if (c.kind === "turn") f = (f + (c.side === "R" ? 1 : 3)) % 4;
        else
          for (let i = 0; i < c.n; i++) {
            const d = STEP[c.kind === "go" ? c.dir : f];
            p = { x: p.x + d.x, y: p.y + d.y };
            ok(p.x >= 0 && p.y >= 0 && p.x <= q.cols && p.y <= q.rows, "stays on the grid");
          }
      }
      ok(key(q.points[q.answer]) === key(p), "answer point is where the walk ends");
      for (const pt of q.points) ok(pt.x >= 0 && pt.y >= 0 && pt.x <= q.cols && pt.y <= q.rows && key(pt) !== key(q.start), "points on the grid, not the start");
      break;
    }
  }
}

describe("motion questions", () => {
  it("is the same for the same seed", () => {
    for (const t of TYPES) for (const l of LEVELS) expect(makeMotionQuestion(t, l, 42)).toEqual(makeMotionQuestion(t, l, 42));
  });

  it.each(TYPES)("gives a sound %s question for 10,000 seeds of every level", (type) => {
    for (const level of LEVELS)
      for (let seed = 0; seed < 10_000; seed++) {
        const q = makeMotionQuestion(type, level, seed);
        try {
          ok(q.type === type && q.level === level, "type and level");
          ok(motionMistake(q, q.answer) === "right", "answer is right");
          const kind = answerKind(q);
          if (kind === "number") ok(whole(q.answer) && q.answer > 0 && q.answer < 10_000, "a whole number that fits the pad");
          if (kind === "rot") ok(q.answer === 0 || q.answer === 1, "a direction");
          if (kind === "compass" || kind === "point") ok([0, 1, 2, 3].includes(q.answer), "one of four");
          // No slip may be the right answer and still count as a slip.
          for (const [, v] of slips(q)) if (v !== q.answer) ok(motionMistake(q, v) !== "other", "slip is named");
          check(q);
        } catch (e) {
          throw new Error(`${type} level ${level} seed ${seed}: ${(e as Error).message}\n${JSON.stringify(q)}`);
        }
      }
  }, 240_000);

  it("names the usual slips", () => {
    const two = { type: "gearDir", level: 1, seed: 0, machine: gears(12, 24), driver: CW, answer: CCW } as const;
    expect(motionMistake(two, CW)).toBe("allSame");
    const three = { type: "gearDir", level: 2, seed: 0, machine: gears(12, 24, 18), driver: CW, answer: CW } as const;
    expect(motionMistake(three, CCW)).toBe("alwaysOpposite");
    const crossed: MotionQuestion = {
      type: "gearDir",
      level: 3,
      seed: 0,
      machine: { wheels: [{ kind: "pulley", size: 20 }, { kind: "pulley", size: 30 }], links: ["cross"] },
      driver: CW,
      answer: CCW,
    };
    expect(motionMistake(crossed, CW)).toBe("crossIgnored");

    const turns = { type: "gearTurns", level: 2, seed: 0, machine: gears(36, 24, 12), turns: 2, answer: 6 } as const;
    expect(motionMistake(turns, 6)).toBe("right");
    expect(motionMistake(turns, 3)).toBe("middleOnly");
    expect(motionMistake(turns, 2)).toBe("sameTurns");
    const inv = { type: "gearTurns", level: 1, seed: 0, machine: gears(12, 36), turns: 6, answer: 2 } as const;
    expect(motionMistake(inv, 18)).toBe("inverted");

    // 300 km apart, 60 and 40 km/h towards each other: 3 hours, 180 km from A.
    const meet = { type: "trip", level: 2, seed: 0, unit: "km", ask: "time", length: 300, v1: 60, v2: 40, delay: 0, time: 3, answer: 3 } as const;
    expect(motionMistake(meet, 15)).toBe("subtractedSpeeds");
    expect(motionMistake(meet, 5)).toBe("oneSpeed");
    expect(motionMistake({ ...meet, ask: "dist", answer: 180 }, 150)).toBe("half");
    expect(motionMistake({ ...meet, ask: "dist", answer: 180 }, 120)).toBe("otherSide");

    // A at 60 chases B at 40, 60 km ahead: 3 hours; adding the speeds gives 60 ÷ 100.
    const chase = { type: "chase", level: 1, seed: 0, unit: "km", v1: 60, v2: 40, gap: 100, delay: 0, lead: 0, answer: 5 } as const;
    expect(motionMistake(chase, 1)).toBe("addedSpeeds");
    const overtake = { type: "chase", level: 3, seed: 0, unit: "km", v1: 60, v2: 40, gap: 40, delay: 0, lead: 20, answer: 3 } as const;
    expect(motionMistake(overtake, 2)).toBe("gapOnly");
    expect(motionMistake(overtake, 1)).toBe("leadOnly");
    const late = { type: "chase", level: 2, seed: 0, unit: "km", v1: 60, v2: 40, gap: 80, delay: 2, lead: 0, answer: 4 } as const;
    expect(motionMistake(late, 6)).toBe("fromStart");

    // Facing east: turn around, then right. Right of west is north, not south.
    const around: MotionQuestion = { type: "orient", level: 2, seed: 0, start: 1, turns: [{ side: "R", quarter: 2 }, { side: "R", quarter: 1 }], answer: 0 };
    expect(motionMistake(around, 2)).toBe("aroundSwap");
    // Facing south, turn right: west. Turning left instead gives east.
    const one: MotionQuestion = { type: "orient", level: 1, seed: 0, start: 2, turns: [{ side: "R", quarter: 1 }], answer: 3 };
    expect(motionMistake(one, 1)).toBe("swapped");
    // Facing west and turning 270° right is facing south; reading it as 90° right gives north.
    const big: MotionQuestion = { type: "orient", level: 3, seed: 0, start: 3, turns: [{ side: "R", quarter: 3 }], answer: 2 };
    expect(motionMistake(big, 0)).toBe("threeQuarter");

    // 10 trees 3 m apart: 9 gaps, 27 m; 10 × 3 = 30 counts the trees as gaps.
    const row: MotionQuestion = { type: "spacing", level: 1, seed: 0, variant: "row", ask: "length", thing: "tree", count: 10, gap: 3, length: 27, width: 0, per: 0, answer: 27 };
    expect(motionMistake(row, 30)).toBe("postsAsGaps");
    // 60 m round a pond, a post every 5 m: 12 posts, not 13.
    const loop: MotionQuestion = { type: "spacing", level: 2, seed: 0, variant: "loop", ask: "count", thing: "post", count: 12, gap: 5, length: 60, width: 0, per: 0, answer: 12 };
    expect(motionMistake(loop, 13)).toBe("loopOpen");
    // A 12 m log in 3 m pieces: 4 pieces, 3 cuts.
    const cut: MotionQuestion = { type: "spacing", level: 2, seed: 0, variant: "cut", ask: "cuts", thing: "tree", count: 4, gap: 3, length: 12, width: 0, per: 0, answer: 3 };
    expect(motionMistake(cut, 4)).toBe("cutsAsPieces");
    // A 40 m road, trees every 10 m on both sides: 5 + 5.
    const sides: MotionQuestion = { type: "spacing", level: 3, seed: 0, variant: "sides", ask: "count", thing: "tree", count: 10, gap: 10, length: 40, width: 0, per: 0, answer: 10 };
    expect(motionMistake(sides, 5)).toBe("oneSide");
    expect(motionMistake(sides, 8)).toBe("postsAsGaps");
    // A 6 m × 4 m field, a post every 2 m: 10 posts; four sides of 4 and 3 posts each make 14.
    const rect: MotionQuestion = { type: "spacing", level: 3, seed: 0, variant: "rect", ask: "count", thing: "post", count: 10, gap: 2, length: 6, width: 4, per: 0, answer: 10 };
    expect(motionMistake(rect, 14)).toBe("cornersTwice");
    // Floor 1 to 4 in 30 s (3 flights, 10 s each); to floor 7: 60 s, not 30 ÷ 4 × 7.
    const floors: MotionQuestion = { type: "spacing", level: 3, seed: 0, variant: "floors", ask: "time", thing: "tree", count: 4, gap: 10, length: 0, width: 7, per: 30, answer: 60 };
    expect(motionMistake(floors, 70)).toBe("floorsAsGaps");

    const grid = makeMotionQuestion("grid", 3, 5);
    expect(motionMistake(grid, 2)).toBe("edgesOnly");
  });
});

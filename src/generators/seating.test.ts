import { describe, expect, it } from "vitest";
import {
  askMistake,
  askSeat,
  askSlips,
  candidates,
  checkCond,
  condPeople,
  ezafe,
  holds,
  layoutOf,
  makeArrangement,
  makeSeatingQuestion,
  permsOf,
  placeMistake,
  rebuild,
  relation,
  SEAT_KINDS,
  SIZES,
  survivors,
  totalOf,
  treeOf,
  wordSlips,
  type Arrangement,
  type Cond,
  type FamilyQuestion,
  type Level,
  type SeatKind,
  type SeatQuestion,
  type Tree,
} from "./seating";

const LEVELS: Level[] = [1, 2, 3];

describe("layouts", () => {
  it("has n! arrangements", () => {
    expect(permsOf(4).length / 4).toBe(24);
    expect(permsOf(7).length / 7).toBe(5040);
  });

  it("keeps left and right, across and mirror consistent", () => {
    for (const kind of SEAT_KINDS)
      for (const n of SIZES[kind]) {
        const lay = layoutOf(kind, n);
        for (let s = 0; s < n; s++) {
          if (lay.R[s] >= 0) expect(lay.L[lay.R[s]]).toBe(s);
          if (lay.O[s] >= 0) expect(lay.O[lay.O[s]]).toBe(s);
          expect(lay.mirror[lay.mirror[s]]).toBe(s);
          // A mirror swaps right and left and keeps "across".
          if (lay.R[s] >= 0) expect(lay.L[lay.mirror[s]]).toBe(lay.mirror[lay.R[s]]);
          if (lay.O[s] >= 0) expect(lay.O[lay.mirror[s]]).toBe(lay.mirror[lay.O[s]]);
        }
      }
  });

  it("seats a round table clockwise, everyone facing the middle", () => {
    // Seat 0 at the top faces down: the right hand points to the drawing's left,
    // which is the seat before 0 going clockwise.
    const lay = layoutOf("round", 6);
    expect(lay.R[0]).toBe(5);
    expect(lay.L[0]).toBe(1);
    expect(lay.O[0]).toBe(3);
    expect(layoutOf("round", 5).O[0]).toBe(-1);
  });

  it("seats a rectangular table: window 0 1, door 3 2 across", () => {
    const four = layoutOf("rect", 4);
    // Window side faces the door side; 0 (left) is across from 3 (left).
    expect(four.O[0]).toBe(3);
    expect(four.R[1]).toBe(0);
    expect(four.R[0]).toBe(-1);
    const six = layoutOf("rect", 6);
    expect(six.side).toEqual([0, 0, 2, 1, 1, 2]);
    expect(six.O[2]).toBe(5);
  });
});

describe("conditions", () => {
  const queue = layoutOf("queue", 5);
  // Queue front to back: 2, 0, 4, 1, 3 (person → place).
  const seat = [1, 3, 0, 4, 2];
  const t = (c: Cond) => holds(c, seat, 0, queue);

  it("reads a queue from the front", () => {
    expect(t({ k: "at", a: 2, p: 0 })).toBe(true);
    expect(t({ k: "justAhead", a: 2, b: 0 })).toBe(true);
    expect(t({ k: "justAhead", a: 0, b: 2 })).toBe(false);
    expect(t({ k: "ahead", a: 0, b: 3 })).toBe(true);
    expect(t({ k: "adjacent", a: 4, b: 1 })).toBe(true);
    expect(t({ k: "notAdjacent", a: 2, b: 3 })).toBe(true);
    // Two people (0 and 4) stand between 2 and 1: three places apart.
    expect(t({ k: "apart", a: 2, b: 1, d: 3 })).toBe(true);
    expect(t({ k: "between", a: 4, b: 2, c: 3 })).toBe(true);
    expect(t({ k: "notEnd", a: 3 })).toBe(false);
  });

  it("reads right and left at a round table", () => {
    const lay = layoutOf("round", 4);
    // Person p in seat p.
    const s = [0, 1, 2, 3];
    expect(holds({ k: "right", a: 3, b: 0 }, s, 0, lay)).toBe(true);
    expect(holds({ k: "left", a: 1, b: 0 }, s, 0, lay)).toBe(true);
    expect(holds({ k: "opposite", a: 2, b: 0 }, s, 0, lay)).toBe(true);
    expect(holds({ k: "between", a: 0, b: 1, c: 3 }, s, 0, lay)).toBe(true);
    expect(holds({ k: "right2", a: 2, b: 0 }, s, 0, lay)).toBe(true);
  });

  it("waits for everyone in a condition to be placed", () => {
    const lay = layoutOf("round", 4);
    expect(checkCond({ k: "right", a: 3, b: 0 }, [0, -1, -1, -1], lay)).toBe(null);
    expect(checkCond({ k: "right", a: 3, b: 0 }, [0, -1, -1, 3], lay)).toBe(true);
    expect(condPeople({ k: "between", a: 1, b: 2, c: 3 })).toEqual([1, 2, 3]);
  });
});

/** Brute force: arrangements (person → seat) left by all the conditions, rotations fixed by the fixed person. */
function allLeft(q: Arrangement): number[][] {
  const lay = layoutOf(q.kind, q.n);
  const perms = permsOf(q.n);
  let offs: number[] = [];
  for (let off = 0; off < perms.length; off += q.n) if (q.fixed === null || perms[off + q.fixed] === 0) offs.push(off);
  // One condition at a time over the arrangements still left.
  for (const c of q.conds) offs = offs.filter((off) => holds(c, perms, off, lay));
  return offs.map((off) => Array.from(perms.subarray(off, off + q.n)));
}

describe("seating questions", () => {
  it("is the same for the same seed", () => {
    for (const t of [...SEAT_KINDS, "family"] as const) for (const l of LEVELS) expect(makeSeatingQuestion(t, l, 42)).toEqual(makeSeatingQuestion(t, l, 42));
  });

  it.each(SEAT_KINDS)("has exactly one answer for 10,000 seeds of each level: %s", (type: SeatKind) => {
    const problems: string[] = [];
    const fail = (q: SeatQuestion, why: string) => problems.length < 20 && problems.push(`${q.type} L${q.level} seed ${q.seed}: ${why}`);
    let maxConds = 0;
    for (const level of LEVELS)
        for (let seed = 0; seed < 10_000; seed++) {
          const q = makeSeatingQuestion(type, level, seed) as SeatQuestion;
          const lay = layoutOf(q.kind, q.n);
          if (!SIZES[type].includes(q.n)) fail(q, "size");
          if (level === 1 && q.n !== 4) fail(q, "level 1 has four people");
          if (level === 3 && type !== "rect" && q.n !== 7) fail(q, "level 3 has seven people");
          if (new Set(q.names).size !== q.n) fail(q, "names repeat");
          if ((q.fixed !== null) !== (type === "round")) fail(q, "fixed seat");
          if (q.fixed !== null && q.solution[q.fixed] !== 0) fail(q, "fixed person not in seat 0");
          maxConds = Math.max(maxConds, q.conds.length);
          if (q.conds.length > 11) fail(q, `${q.conds.length} conditions`);
          if (q.conds.some((c) => !holds(c, q.solution, 0, lay))) fail(q, "a condition is false");
          const left = allLeft(q);
          if (q.variant === "place") {
            if (left.length !== 1 || left[0].join() !== q.solution.join()) fail(q, `${left.length} arrangements`);
            if (placeMistake(q, q.solution).tag !== "right") fail(q, "solution not right");
          } else {
            const ask = q.ask!;
            if (q.answer < 0) fail(q, "no answer");
            for (const s of left) {
              const t = askSeat(ask, s, 0, lay);
              if (t < 0 || s[q.answer] !== t) {
                fail(q, "answer not unique");
                break;
              }
            }
            if (askMistake(q, q.answer) !== "right") fail(q, "answer not right");
            for (const [tag, p] of askSlips(q)) if (p === q.answer || tag === "right") fail(q, "slip is the answer");
            // No condition names the answer directly.
            for (const c of q.conds) {
              const ps = condPeople(c);
              if (ask.rel === "at" ? c.k === "at" && (c.p === ask.p || c.a === q.answer) : ps.includes(q.answer) && ps.includes(ask.of)) fail(q, "condition gives the answer away");
            }
          }
          // None of the conditions is implied by the others.
          if (q.variant === "place" && q.conds.length > 1 && seed % 50 === 0)
            for (let i = 0; i < q.conds.length; i++) {
              const fewer = { ...q, conds: q.conds.filter((_, j) => j !== i) };
              if (allLeft(fewer).length === 1) fail(q, `condition ${i} is redundant`);
            }
        }
    expect(problems).toEqual([]);
    expect(maxConds).toBeLessThanOrEqual(11);
  }, 240_000);

  it("builds explore and show-me puzzles with one arrangement and about the asked number of conditions", () => {
    const problems: string[] = [];
    for (const kind of SEAT_KINDS)
      for (const n of SIZES[kind])
        for (let seed = 0; seed < 150; seed++) {
          const q = makeArrangement(kind, n, seed, 5);
          const left = allLeft(q);
          if (left.length !== 1 || left[0].join() !== q.solution.join()) problems.push(`${kind} ${n} ${seed}`);
          // Each condition in show-me order rules something out.
          let prev = totalOf(q);
          for (let k = 1; k <= q.conds.length; k++) {
            const now = survivors(q, k).length;
            if (now >= prev) problems.push(`${kind} ${n} ${seed}: step ${k} rules nothing out`);
            prev = now;
          }
          const cand = candidates(q.n, survivors(q, q.conds.length));
          if (cand.some((c, s) => c.size !== 1 || q.solution[[...c][0]] !== s)) problems.push(`${kind} ${n} ${seed}: candidates`);
        }
    expect(problems).toEqual([]);
  }, 240_000);

  it("names the usual slips in an arrangement", () => {
    const q = makeSeatingQuestion("round", 2, 3) as SeatQuestion;
    const lay = layoutOf(q.kind, q.n);
    const mirrored = q.solution.map((s) => lay.mirror[s]);
    expect(placeMistake(q, mirrored).tag).toBe(q.solution.join() === mirrored.join() ? "right" : "flipped");

    // Four at a round table: A in 0, B at A's right (3), C across (2), D at A's left (1).
    const base: Arrangement = { kind: "round", n: 4, names: ["A", "B", "C", "D"], attr: "height", fixed: 0, solution: [0, 3, 2, 1], conds: [{ k: "right", a: 1, b: 0 }, { k: "opposite", a: 2, b: 0 }] };
    expect(placeMistake(base, [0, 3, 2, 1]).tag).toBe("right");
    // B and D swapped: the mirror image.
    expect(placeMistake(base, [0, 1, 2, 3]).tag).toBe("flipped");
    // B at A's left, and C not across: left and right mixed up.
    expect(placeMistake(base, [0, 1, 3, 2]).tag).toBe("sideFlip");
    // C next to the seat across.
    expect(placeMistake({ ...base, conds: [{ k: "opposite", a: 2, b: 0 }] }, [0, 2, 1, 3]).tag).toBe("opposite");

    const line: Arrangement = { kind: "queue", n: 5, names: ["A", "B", "C", "D", "E"], attr: "height", fixed: null, solution: [0, 3, 1, 2, 4], conds: [{ k: "apart", a: 0, b: 1, d: 3 }, { k: "justAhead", a: 2, b: 3 }] };
    // Two people between A and B read as "two places apart".
    expect(placeMistake(line, [0, 2, 1, 3, 4]).tag).toBe("apartCount");
    // "C right in front of D" read the other way round.
    expect(placeMistake(line, [0, 3, 2, 1, 4]).tag).toBe("frontBack");
  });

  it("names the usual slips in a one-person question", () => {
    // Person p in seat p at a round table of six; who is opposite 0? 3.
    const q: SeatQuestion = { kind: "round", type: "round", n: 6, level: 2, seed: 0, names: ["A", "B", "C", "D", "E", "F"], attr: "height", fixed: 0, solution: [0, 1, 2, 3, 4, 5], conds: [], variant: "ask", ask: { rel: "opposite", of: 0 }, answer: 3 };
    expect(askMistake(q, 3)).toBe("right");
    expect(askMistake(q, 2)).toBe("opposite");
    expect(askMistake(q, 4)).toBe("opposite");
    // At 0's right is 5; the left-hand neighbour 1 is the flip.
    const right = { ...q, ask: { rel: "right", of: 0 } as const, answer: 5 };
    expect(askMistake(right, 1)).toBe("flipped");
    expect(askMistake(right, 4)).toBe("offByOne");
    const third = { ...q, kind: "queue", type: "queue", fixed: null, ask: { rel: "at", p: 2 } as const, answer: 2 } as SeatQuestion;
    expect(askMistake(third, 3)).toBe("flipped");
    expect(askMistake(third, 1)).toBe("offByOne");
  });
});

describe("family trees", () => {
  // Grandparents 0 1; their son 2 (married to 3) and daughter 4; 3's brother 7; 2 and 3's son 5, 4's son 6 (husband 8).
  const t: Tree = {
    male: [true, false, true, false, false, true, true, true, true],
    father: [-1, -1, 0, -1, 0, 2, 8, -1, -1],
    mother: [-1, -1, 1, -1, 1, 3, 4, -1, -1],
    spouse: [1, 0, 3, 2, 8, -1, -1, -1, 4],
  };

  it("names relations in Persian", () => {
    const w = (x: number, y: number) => relation(t, x, y)?.word;
    expect(w(0, 5)).toBe("پدربزرگ");
    expect(w(5, 1)).toBe("نوه");
    expect(w(4, 5)).toBe("عمه");
    expect(w(2, 6)).toBe("دایی");
    expect(w(5, 6)).toBe("پسردایی");
    expect(w(6, 5)).toBe("پسرعمه");
    expect(w(5, 4)).toBe("برادرزاده");
    expect(w(6, 2)).toBe("خواهرزاده");
    expect(w(3, 0)).toBe("عروس");
    expect(w(8, 5)).toBe("شوهرعمه");
    expect(w(3, 6)).toBe("زن‌دایی");
    expect(w(7, 5)).toBe(undefined);
    expect(ezafe("عمو")).toBe("عموی");
    expect(ezafe("خاله")).toBe("خاله‌ی");
  });

  it("knows the slips of a relation word", () => {
    const s = Object.fromEntries(wordSlips("عمو", "برادرزاده").map(([tag, w]) => [tag, w]));
    expect(s).toEqual({ side: "دایی", inverse: "برادرزاده", generation: "پسرعمو", gender: "عمه" });
  });

  it("gives a tree the sentences pin down and one right option, for 10,000 seeds of each level", () => {
    const problems: string[] = [];
    const fail = (q: FamilyQuestion, why: string) => problems.length < 20 && problems.push(`L${q.level} seed ${q.seed}: ${why}`);
    for (const level of LEVELS)
      for (let seed = 0; seed < 10_000; seed++) {
        const q = makeSeatingQuestion("family", level, seed) as FamilyQuestion;
        const real = treeOf(q.people);
        const built = rebuild(real.male, q.facts);
        if (JSON.stringify(built) !== JSON.stringify(real)) fail(q, "sentences do not pin the tree down");
        if (new Set(q.people.map((p) => p.name)).size !== q.people.length) fail(q, "names repeat");
        const gens = new Set(q.people.map((p) => p.gen)).size;
        if (gens !== (level === 1 ? 2 : 3)) fail(q, `${gens} generations`);
        if (level === 3 && !q.people.some((p) => p.role === "gf2")) fail(q, "level 3 has both sides");
        if (q.options.length !== 4 || new Set(q.options.map((o) => o.text)).size !== 4) fail(q, "four different options");
        if (q.options.filter((o) => o.tag === "right").length !== 1 || q.options[q.answer].tag !== "right") fail(q, "one right option");
        // Every sentence after the first names someone already met.
        const met = new Set([q.facts[0].a, q.facts[0].b]);
        for (const f of q.facts.slice(1)) {
          if (!met.has(f.a) && !met.has(f.b)) fail(q, "sentence order");
          met.add(f.a);
          met.add(f.b);
        }
        if (met.size !== q.people.length) fail(q, "someone is never mentioned");
        if (q.ask.k === "rel") {
          const { x, y } = q.ask;
          const word = relation(built, x, y)?.word;
          if (q.options[q.answer].text !== word) fail(q, "wrong answer");
          if (q.facts.some((f) => (f.a === x && f.b === y) || (f.a === y && f.b === x))) fail(q, "asked pair is a sentence");
        } else {
          const { word, y } = q.ask;
          const holders = q.people.map((_, z) => z).filter((z) => relation(built, z, y)?.word === word);
          if (holders.length !== 1 || q.options[q.answer].person !== holders[0]) fail(q, "who: not unique");
          if (q.options.some((o) => o.person === y)) fail(q, "asks about y among the options");
        }
      }
    expect(problems).toEqual([]);
  }, 240_000);
});

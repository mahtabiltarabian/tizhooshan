// Tool 19, «نمودار ون با عدد»: how many people are in each part of a Venn
// diagram. Counts per region are drawn first, then the question shows some
// sums of regions (a circle's total, "only", "both", the class) and asks for
// another. Region r (0 … 2^k − 1) is the part inside exactly the circles whose
// bits are set in r; region 0 is outside every circle.
//
// Level 1: two circles, no class total: "only A", "both" or "at least one".
// Level 2: two circles and the class: "neither", "both" from the class and
//          "neither" (the reverse), "only A" through the outside.
// Level 3: three circles with some regions given, or the smallest / largest
//          possible overlap of two circles in a class.
//
// "Show me" fills the diagram as a child would: the middle first, then each
// "only" region by subtraction, then the outside. The step solver only uses
// sound rules (a given region; a sum with one unknown region; for two circles
// A + B − (A or B) = both), so whatever it finds is forced. Every wrong answer
// a named slip would give is worked out, so feedback can name it.

import { mulberry32, pick, randInt, shuffle, type Rng } from "./random";

export type Level = 1 | 2 | 3;
export type K = 2 | 3;

/** A count the question can give or ask. s, t: circles. */
export type Ref =
  | { kind: "set"; s: number }
  | { kind: "only"; s: number }
  /** Two circles: in both. */
  | { kind: "both" }
  /** Three circles: in s and t but not the third. */
  | { kind: "pairOnly"; s: number; t: number }
  /** Three circles: in s and t, with or without the third. */
  | { kind: "pair"; s: number; t: number }
  | { kind: "all3" }
  | { kind: "union" }
  | { kind: "neither" }
  | { kind: "total" };

export interface Fact {
  ref: Ref;
  value: number;
}

/** Min / max questions: the smallest or largest "both", or the largest "neither". */
export type Extreme = "minBoth" | "maxBoth" | "maxNeither";

export type SlipTag =
  /** A + B, the overlap not taken away. */
  | "addedNoOverlap"
  /** A circle's total read as its "only" part. */
  | "totalAsOnly"
  /** The outside region left out. */
  | "forgotOutside"
  /** The overlap (or the middle) taken away twice. */
  | "doubleSubtract"
  /** Three circles: the middle not taken away at all. */
  | "forgotMiddle"
  /** Three circles: «هم X هم Y» (with the middle) read as "only X and Y". */
  | "pairAsOnly"
  /** Asked for the outside, gave the inside. */
  | "insideNotOutside"
  /** Asked for "only A", gave "only B". */
  | "otherPart"
  /** Asked for "both", gave an "only" part or the inside. */
  | "partNotBoth"
  /** Min / max: gave the other extreme. */
  | "minMax"
  /** Min "both": forgot the class has only N seats (said 0). */
  | "forgotTotal"
  /** Max: a part cannot be bigger than the smaller circle. */
  | "biggerSet";

export interface Slip {
  tag: SlipTag;
  value: number;
}

export interface VennCountQuestion {
  type: "vennNum";
  level: Level;
  seed: number;
  k: K;
  /** Index into COUNT_THEMES; circles are its first k items. */
  theme: number;
  /** Order of the theme's items on the circles. */
  items: number[];
  /** People in each region (min / max: one arrangement that reaches the answer). */
  counts: number[];
  /** What the question tells, in order. */
  facts: Fact[];
  ask: Ref;
  extreme: Extreme | null;
  answer: number;
  /** Wrong answers a named slip gives, first slip first, values all different. */
  slips: Slip[];
}

/** Words for each theme live with the tool; here only how many items there are. */
export const COUNT_THEME_COUNT = 3;

const bitCount = (r: number) => (r & 1) + ((r >> 1) & 1) + ((r >> 2) & 1);

/** The regions a count adds up, as a bit mask over regions. */
export function refMask(k: K, ref: Ref): number {
  let m = 0;
  for (let r = 0; r < 1 << k; r++) {
    let inside: boolean;
    switch (ref.kind) {
      case "set":
        inside = !!((r >> ref.s) & 1);
        break;
      case "only":
        inside = r === 1 << ref.s;
        break;
      case "both":
        inside = r === 3;
        break;
      case "pairOnly":
        inside = r === ((1 << ref.s) | (1 << ref.t));
        break;
      case "pair": {
        const p = (1 << ref.s) | (1 << ref.t);
        inside = (r & p) === p;
        break;
      }
      case "all3":
        inside = r === 7;
        break;
      case "union":
        inside = r > 0;
        break;
      case "neither":
        inside = r === 0;
        break;
      case "total":
        inside = true;
        break;
    }
    if (inside) m |= 1 << r;
  }
  return m;
}

export const regionsOf = (mask: number) => Array.from({ length: 8 }, (_, r) => r).filter((r) => (mask >> r) & 1);

export const sumOf = (counts: readonly number[], mask: number) => regionsOf(mask).reduce((s, r) => s + (counts[r] ?? 0), 0);

export const valueOf = (k: K, counts: readonly number[], ref: Ref) => sumOf(counts, refMask(k, ref));

// ───────────────────────── show me ─────────────────────────

/**
 * given:   a region the question tells straight away.
 * sub:     a count the question tells, minus its regions already known.
 * inside:  the class minus the outside: everyone in a circle (two circles).
 * overlap: A + B counts the middle twice; minus everyone in a circle, it is the middle.
 * spread:  min / max: how the circles must sit (no one outside, or the small circle inside the big one).
 * answer:  read the asked count off the diagram.
 */
export type CountStep =
  | { kind: "given"; region: number; fact: number; value: number }
  | { kind: "sub"; region: number; fact: number; minus: number[]; value: number }
  | { kind: "inside"; fact: number; outside: number; value: number }
  | { kind: "overlap"; a: number; b: number; inside: number; value: number }
  | { kind: "spread"; extreme: Extreme; region: number; value: number }
  | { kind: "answer"; value: number };

/** The region a step writes, if any. */
export const stepRegion = (s: CountStep): number | null => (s.kind === "given" || s.kind === "sub" || s.kind === "spread" ? s.region : s.kind === "overlap" ? 3 : null);

/** Fills the diagram from the facts; `solved` when the asked count is known. */
export function countSteps(q: Pick<VennCountQuestion, "k" | "facts" | "ask" | "extreme" | "counts">): { steps: CountStep[]; known: (number | null)[]; solved: boolean } {
  const { k, facts } = q;
  if (q.extreme) return extremeSteps(q as VennCountQuestion);
  const n = 1 << k;
  const known: (number | null)[] = Array(n).fill(null);
  const masks = facts.map((f) => refMask(k, f.ref));
  const steps: CountStep[] = [];
  const unknownIn = (m: number) => regionsOf(m).filter((r) => known[r] === null);
  const set = (s: number) => facts.findIndex((f) => f.ref.kind === "set" && f.ref.s === s);
  let inside: number | null = null;

  for (;;) {
    // 1. A region the question gives, the middle first (the outside waits till last).
    const given = facts
      .map((_, i) => i)
      .filter((i) => regionsOf(masks[i]).length === 1 && regionsOf(masks[i])[0] !== 0 && known[regionsOf(masks[i])[0]] === null)
      .sort((x, y) => bitCount(regionsOf(masks[y])[0]) - bitCount(regionsOf(masks[x])[0]));
    if (given.length) {
      const i = given[0];
      const region = regionsOf(masks[i])[0];
      known[region] = facts[i].value;
      steps.push({ kind: "given", region, fact: i, value: facts[i].value });
      continue;
    }
    // 2. Two circles, middle unknown: A + B − inside.
    if (k === 2 && known[3] === null) {
      const [a, b] = [set(0), set(1)];
      if (a >= 0 && b >= 0) {
        if (inside === null) {
          const u = facts.findIndex((f) => f.ref.kind === "union");
          if (u >= 0) inside = facts[u].value;
        }
        if (inside === null) {
          const t = facts.findIndex((f) => f.ref.kind === "total");
          const o = facts.findIndex((f) => f.ref.kind === "neither");
          if (t >= 0 && o >= 0) {
            inside = facts[t].value - facts[o].value;
            steps.push({ kind: "inside", fact: t, outside: facts[o].value, value: inside });
            continue;
          }
        }
        if (inside !== null) {
          known[3] = facts[a].value + facts[b].value - inside;
          steps.push({ kind: "overlap", a, b, inside, value: known[3] });
          continue;
        }
      }
    }
    // 3. A count with one region unknown: subtract. Deeper regions first, the outside last.
    const subs = facts
      .map((_, i) => i)
      .filter((i) => unknownIn(masks[i]).length === 1)
      .sort((x, y) => bitCount(unknownIn(masks[y])[0]) - bitCount(unknownIn(masks[x])[0]) || regionsOf(masks[x]).length - regionsOf(masks[y]).length);
    const outsideGiven = facts.some((f) => f.ref.kind === "neither");
    const sub = subs.find((i) => unknownIn(masks[i])[0] !== 0) ?? (outsideGiven ? undefined : subs.find((i) => regionsOf(masks[i]).length > 1));
    if (sub !== undefined) {
      const region = unknownIn(masks[sub])[0];
      const minus = regionsOf(masks[sub]).filter((r) => r !== region);
      const value = facts[sub].value - minus.reduce((s, r) => s + known[r]!, 0);
      known[region] = value;
      steps.push({ kind: "sub", region, fact: sub, minus, value });
      continue;
    }
    // 4. The outside, when the question gives it.
    const out = facts.findIndex((f) => f.ref.kind === "neither");
    if (out >= 0 && known[0] === null) {
      known[0] = facts[out].value;
      steps.push({ kind: "given", region: 0, fact: out, value: facts[out].value });
      continue;
    }
    break;
  }
  const askRegions = regionsOf(refMask(k, q.ask));
  const solved = askRegions.every((r) => known[r] !== null);
  if (solved) steps.push({ kind: "answer", value: askRegions.reduce((s, r) => s + known[r]!, 0) });
  return { steps, known, solved };
}

/** Min / max: place the circles as the extreme needs, then fill the rest by subtraction. */
function extremeSteps(q: VennCountQuestion): { steps: CountStep[]; known: (number | null)[]; solved: boolean } {
  const [N, A, B] = [q.facts[0].value, q.facts[1].value, q.facts[2].value];
  const known: (number | null)[] = [null, null, null, null];
  const steps: CountStep[] = [];
  const put = (s: Extract<CountStep, { kind: "spread" | "sub" }>) => {
    known[s.region] = s.value;
    steps.push(s);
  };
  if (q.extreme === "minBoth") {
    // Nobody outside: then the circles overlap as little as they can.
    put({ kind: "spread", extreme: "minBoth", region: 0, value: 0 });
    steps.push({ kind: "inside", fact: 0, outside: 0, value: N });
    known[3] = A + B - N;
    steps.push({ kind: "overlap", a: 1, b: 2, inside: N, value: known[3] });
    put({ kind: "sub", region: 1, fact: 1, minus: [3], value: A - known[3] });
    put({ kind: "sub", region: 2, fact: 2, minus: [3], value: B - known[3] });
  } else {
    // The smaller circle sits wholly inside the bigger one.
    const small = A <= B ? 0 : 1;
    const big = 1 - small;
    put({ kind: "spread", extreme: q.extreme!, region: 3, value: Math.min(A, B) });
    put({ kind: "sub", region: 1 << small, fact: 1 + small, minus: [3], value: 0 });
    put({ kind: "sub", region: 1 << big, fact: 1 + big, minus: [3], value: Math.max(A, B) - Math.min(A, B) });
    put({ kind: "sub", region: 0, fact: 0, minus: [1, 2, 3], value: N - Math.max(A, B) });
  }
  steps.push({ kind: "answer", value: q.answer });
  return { steps, known, solved: true };
}

/** The diagram after the first n steps. */
export function countsAfter(k: K, steps: readonly CountStep[], n: number): (number | null)[] {
  const out: (number | null)[] = Array(1 << k).fill(null);
  for (const s of steps.slice(0, n)) {
    const r = stepRegion(s);
    if (r !== null && s.kind !== "answer") out[r] = s.value;
  }
  return out;
}

// ───────────────────────── building questions ─────────────────────────

const between = (rng: Rng, lo: number, hi: number) => lo + randInt(rng, hi - lo + 1);

/** Keeps the first slip for each value, and only values a child could write (whole, ≥ 0, not the answer). */
function cleanSlips(answer: number, list: Slip[]): Slip[] {
  const out: Slip[] = [];
  for (const s of list) if (Number.isInteger(s.value) && s.value >= 0 && s.value !== answer && !out.some((o) => o.value === s.value)) out.push(s);
  return out;
}

function twoCircles(rng: Rng, level: Level, seed: number): VennCountQuestion {
  for (;;) {
    const lvl1 = level === 1;
    const a = between(rng, 3, lvl1 ? 16 : 15);
    const b = between(rng, 3, lvl1 ? 16 : 15);
    const c = between(rng, 2, lvl1 ? 9 : 10);
    const d = lvl1 ? 0 : between(rng, 2, 10);
    const [A, B, U, N] = [a + c, b + c, a + b + c, a + b + c + d];
    if (lvl1 ? A > 30 || B > 30 : N > 45) continue;
    // Two equal circles make "only A" and "only B" slips the same: still fine, cleanSlips keeps one.
    const counts = [d, a, b, c];
    const setF = (s: number): Fact => ({ ref: { kind: "set", s }, value: s === 0 ? A : B });
    const s = randInt(rng, 2);
    const [X, Y] = s === 0 ? [A, B] : [B, A];
    let facts: Fact[];
    let ask: Ref;
    let answer: number;
    let slips: Slip[];
    if (lvl1) {
      const form = pick(rng, ["only", "only", "both", "union"] as const);
      if (form === "only") {
        facts = [setF(0), setF(1), { ref: { kind: "both" }, value: c }];
        ask = { kind: "only", s };
        answer = X - c;
        slips = [
          { tag: "totalAsOnly", value: X },
          { tag: "doubleSubtract", value: X - 2 * c },
          { tag: "otherPart", value: Y - c },
        ];
      } else if (form === "both") {
        facts = [setF(0), setF(1), { ref: { kind: "union" }, value: U }];
        ask = { kind: "both" };
        answer = c;
        slips = [
          { tag: "partNotBoth", value: U - B },
          { tag: "partNotBoth", value: U - A },
        ];
      } else {
        facts = [setF(0), setF(1), { ref: { kind: "both" }, value: c }];
        ask = { kind: "union" };
        answer = U;
        slips = [
          { tag: "addedNoOverlap", value: A + B },
          { tag: "doubleSubtract", value: A + B - 2 * c },
          { tag: "totalAsOnly", value: A + B + c },
        ];
      }
    } else {
      const form = pick(rng, ["neither", "both", "only"] as const);
      const total: Fact = { ref: { kind: "total" }, value: N };
      if (form === "neither") {
        facts = [total, setF(0), setF(1), { ref: { kind: "both" }, value: c }];
        ask = { kind: "neither" };
        answer = d;
        slips = [
          { tag: "addedNoOverlap", value: N - A - B },
          { tag: "doubleSubtract", value: N - A - B + 2 * c },
          { tag: "totalAsOnly", value: N - A - B - c },
          { tag: "insideNotOutside", value: U },
        ];
      } else if (form === "both") {
        facts = [total, setF(0), setF(1), { ref: { kind: "neither" }, value: d }];
        ask = { kind: "both" };
        answer = c;
        slips = [
          { tag: "forgotOutside", value: A + B - N },
          { tag: "partNotBoth", value: U - B },
          { tag: "partNotBoth", value: U - A },
          { tag: "partNotBoth", value: U },
        ];
      } else {
        facts = [total, setF(0), setF(1), { ref: { kind: "neither" }, value: d }];
        ask = { kind: "only", s };
        answer = U - (s === 0 ? B : A);
        slips = [
          { tag: "forgotOutside", value: N - (s === 0 ? B : A) },
          { tag: "totalAsOnly", value: X },
          { tag: "otherPart", value: U - X },
        ];
      }
    }
    const q: VennCountQuestion = { type: "vennNum", level, seed, k: 2, theme: randInt(rng, COUNT_THEME_COUNT), items: shuffle(rng, [0, 1, 2]).slice(0, 2), counts, facts, ask, extreme: null, answer, slips: cleanSlips(answer, slips) };
    if (!q.slips.length || !countSteps(q).solved) continue;
    return q;
  }
}

function threeCircles(rng: Rng, seed: number): VennCountQuestion {
  for (;;) {
    // Every region at least 2, so no sentence says "1 people".
    const t = between(rng, 2, 4);
    const pairs = [3, 5, 6].map(() => between(rng, 2, 6));
    const singles = [0, 1, 2].map(() => between(rng, 2, 12));
    const out = between(rng, 2, 8);
    // counts[r]: r = 1, 2, 4 singles; 3, 5, 6 pairs; 7 the middle.
    const counts = [out, singles[0], singles[1], pairs[0], singles[2], pairs[1], pairs[2], t];
    const N = counts.reduce((s, v) => s + v, 0);
    if (N > 70) continue;
    const setV = (s: number) => valueOf(3, counts, { kind: "set", s });
    const pairList: [number, number][] = [
      [0, 1],
      [0, 2],
      [1, 2],
    ];
    const inclusive = pairList.map(() => rng() < 0.5);
    const pairFacts: Fact[] = pairList.map(([s, u], j) => {
      const ref: Ref = inclusive[j] ? { kind: "pair", s, t: u } : { kind: "pairOnly", s, t: u };
      return { ref, value: valueOf(3, counts, ref) };
    });
    const facts: Fact[] = [{ ref: { kind: "total" }, value: N }, ...[0, 1, 2].map((s) => ({ ref: { kind: "set", s } as Ref, value: setV(s) })), ...pairFacts, { ref: { kind: "all3" }, value: t }];
    const form = pick(rng, ["neither", "neither", "only", "only", "union"] as const);
    const S = setV(0) + setV(1) + setV(2);
    const exactSum = pairs.reduce((s, v) => s + v, 0);
    const U = N - out;
    const ask: Ref = form === "only" ? { kind: "only", s: randInt(rng, 3) } : { kind: form };
    const answer = valueOf(3, counts, ask);
    /**
     * The diagram a child fills with one slip: middle first, then the
     * two-circle parts, then the "only" parts, then the outside.
     * pairAsOnly: «هم X هم Y» written in "only X and Y" without taking the middle away.
     * middle: how many times the middle is taken from each circle (1 is right).
     */
    const filled = (pairAsOnly: boolean, middle: number) => {
      const c = Array(8).fill(0);
      c[7] = t;
      pairFacts.forEach((f, j) => (c[[3, 5, 6][j]] = f.value - (inclusive[j] && !pairAsOnly ? t : 0)));
      [0, 1, 2].forEach((x) => (c[1 << x] = setV(x) - [3, 5, 6].filter((r) => (r >> x) & 1).reduce((sum, r) => sum + c[r], 0) - middle * t));
      c[0] = N - c.slice(1).reduce((sum, v) => sum + v, 0);
      return valueOf(3, c, ask);
    };
    const slips: Slip[] = [
      { tag: "totalAsOnly", value: form === "only" ? setV((ask as { s: number }).s) : form === "union" ? S + exactSum + t : N - S - exactSum - t },
      ...(form === "only" ? [] : [{ tag: "addedNoOverlap" as const, value: form === "union" ? S : N - S }]),
      { tag: "forgotMiddle", value: filled(false, 0) },
      { tag: "doubleSubtract", value: filled(false, 2) },
      ...(inclusive.some(Boolean) ? [{ tag: "pairAsOnly" as const, value: filled(true, 1) }] : []),
      ...(form === "neither" ? [{ tag: "insideNotOutside" as const, value: U }] : []),
    ];
    const q: VennCountQuestion = { type: "vennNum", level: 3, seed, k: 3, theme: randInt(rng, COUNT_THEME_COUNT), items: shuffle(rng, [0, 1, 2]), counts, facts, ask, extreme: null, answer, slips: cleanSlips(answer, slips) };
    if (!q.slips.length || !countSteps(q).solved) continue;
    return q;
  }
}

function minMax(rng: Rng, seed: number): VennCountQuestion {
  for (;;) {
    const N = between(rng, 20, 40);
    const A = between(rng, 8, N - 3);
    const B = between(rng, 8, N - 3);
    const extreme = pick(rng, ["minBoth", "minBoth", "maxBoth", "maxNeither"] as Extreme[]);
    if (extreme === "minBoth" && A + B - N < 2) continue;
    if (extreme !== "minBoth" && A === B) continue;
    let answer: number;
    let counts: number[];
    let slips: Slip[];
    const [lo, hi] = [Math.min(A, B), Math.max(A, B)];
    if (extreme === "minBoth") {
      const c = A + B - N;
      answer = c;
      counts = [0, A - c, B - c, c];
      slips = [
        { tag: "minMax", value: lo },
        { tag: "forgotTotal", value: 0 },
      ];
    } else {
      counts = A <= B ? [N - hi, 0, hi - lo, lo] : [N - hi, hi - lo, 0, lo];
      if (extreme === "maxBoth") {
        answer = lo;
        slips = [
          { tag: "minMax", value: Math.max(0, A + B - N) },
          { tag: "biggerSet", value: hi },
        ];
      } else {
        answer = N - hi;
        slips = [
          { tag: "minMax", value: N - A - B },
          { tag: "biggerSet", value: N - lo },
        ];
      }
    }
    const facts: Fact[] = [
      { ref: { kind: "total" }, value: N },
      { ref: { kind: "set", s: 0 }, value: A },
      { ref: { kind: "set", s: 1 }, value: B },
    ];
    const ask: Ref = extreme === "maxNeither" ? { kind: "neither" } : { kind: "both" };
    return { type: "vennNum", level: 3, seed, k: 2, theme: randInt(rng, COUNT_THEME_COUNT), items: shuffle(rng, [0, 1, 2]).slice(0, 2), counts, facts, ask, extreme, answer, slips: cleanSlips(answer, slips) };
  }
}

export function makeVennCountQuestion(level: Level, seed: number): VennCountQuestion {
  const rng = mulberry32(seed * 11 + level * 211 + 977);
  if (level < 3) return twoCircles(rng, level, seed);
  return rng() < 0.55 ? threeCircles(rng, seed) : minMax(rng, seed);
}

export type CountTag = "right" | SlipTag | "other";

/** What a typed answer is: right, a named slip, or something else. */
export function countMistake(q: VennCountQuestion, value: number): CountTag {
  if (value === q.answer) return "right";
  return q.slips.find((s) => s.value === value)?.tag ?? "other";
}

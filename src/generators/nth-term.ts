// Tool 9: the nth term of a sequence with a fixed step (an arithmetic
// sequence) and of growing matchstick or tile patterns. Term n is the first
// term plus (n − 1) jumps of the step: n wagons have only n − 1 gaps between
// them. Level 1 asks for a far term; level 2 asks the reverse ("which term is
// 95?") or counts the sticks of a far shape; level 3 asks for the rule
// "term n = □ × n + □" or where two sequences meet. Every question keeps the
// usual slips, and the generator makes sure no two slips (and no slip and the
// answer) give the same number, so the feedback can always say which slip a
// wrong answer was.

import { mulberry32, pick, type Rng } from "./random";

export type Level = 1 | 2 | 3;
/** far: term n; which: the place of a value; pattern: sticks or tiles of shape n; rule: □ × n + □; meet: where two sequences are equal. */
export type NthVariant = "far" | "which" | "pattern" | "rule" | "meet";
/** Growing patterns: matchstick squares, triangles or houses in a row; tile crosses or L shapes. */
export type PatternKind = "squares" | "triangles" | "houses" | "cross" | "corner";

/** First shape and how much each shape adds. */
export const PATTERNS: Record<PatternKind, { first: number; step: number; tiles: boolean }> = {
  squares: { first: 4, step: 3, tiles: false },
  triangles: { first: 3, step: 2, tiles: false },
  houses: { first: 6, step: 5, tiles: false },
  cross: { first: 5, step: 4, tiles: true },
  corner: { first: 3, step: 2, tiles: true },
};

export interface NthQuestion {
  type: "nth";
  level: Level;
  seed: number;
  variant: NthVariant;
  /** First term and step (sequence ● for meet). */
  first: number;
  step: number;
  /** Sequence ▲ (meet only; 0 otherwise). */
  first2: number;
  step2: number;
  /** Pattern questions only. */
  pattern: PatternKind | null;
  /** How many terms (or shapes) the question shows. */
  shown: number;
  /** far / pattern: the place asked; which: the place of `value`; meet: the place they meet; rule: 0. */
  n: number;
  /** which: the value whose place is asked; meet: the common value; otherwise 0. */
  value: number;
  /** A number, or for rule questions ruleValue(coefficient, constant). */
  answer: number;
}

/** Term n (1 = the first) of first, first + step, … */
export const termAt = (first: number, step: number, n: number) => first + (n - 1) * step;

/** The two boxes of "□ × n + □" as one number, so a check fits the same state and link as the others. */
export const ruleValue = (coef: number, constant: number) => coef * 1000 + constant;
export const ruleParts = (v: number) => ({ coef: Math.floor(v / 1000), constant: v % 1000 });

/** The answer is a pair of boxes. */
export const nthIsRule = (q: NthQuestion) => q.variant === "rule";

/** The first `count` terms of sequence ● (or ▲). */
export const termsOf = (q: Pick<NthQuestion, "first" | "step" | "first2" | "step2">, count: number, second = false) =>
  Array.from({ length: count }, (_, k) => termAt(second ? q.first2 : q.first, second ? q.step2 : q.step, k + 1));

// ── Pattern geometry ────────────────────────────────────────────────────

export type Stick = [number, number, number, number];
export type Tile = [number, number];

/**
 * Shape k of a pattern, in units of one stick (or one tile), y downwards,
 * x from 0 to `width` (drawn right to left by the board). The sticks or
 * tiles here are what a pupil would count, so the tests check the count.
 */
export function patternShape(kind: PatternKind, k: number): { sticks: Stick[]; tiles: Tile[]; width: number; height: number } {
  const sticks: Stick[] = [];
  const tiles: Tile[] = [];
  const add = (s: Stick) => {
    const key = (a: Stick) => a.map((v) => Math.round(v * 1000)).join(",");
    const rev: Stick = [s[2], s[3], s[0], s[1]];
    if (!sticks.some((t) => key(t) === key(s) || key(t) === key(rev))) sticks.push(s);
  };
  const H = Math.round((Math.sqrt(3) / 2) * 1000) / 1000;
  switch (kind) {
    case "squares":
    case "houses": {
      const roof = kind === "houses" ? 0.75 : 0;
      for (let i = 0; i < k; i++) {
        add([i, roof, i + 1, roof]);
        add([i, roof + 1, i + 1, roof + 1]);
        add([i, roof, i, roof + 1]);
        add([i + 1, roof, i + 1, roof + 1]);
        if (roof) {
          add([i, roof, i + 0.5, 0]);
          add([i + 0.5, 0, i + 1, roof]);
        }
      }
      return { sticks, tiles, width: k, height: 1 + roof };
    }
    case "triangles": {
      // Up and down in turn along a strip: bottom points at 0, 1, 2 …; top points at 0.5, 1.5 …
      for (let i = 0; i < k; i++) {
        const j = Math.floor(i / 2);
        if (i % 2 === 0) {
          add([j, H, j + 1, H]);
          add([j, H, j + 0.5, 0]);
          add([j + 0.5, 0, j + 1, H]);
        } else {
          add([j + 0.5, 0, j + 1.5, 0]);
          add([j + 0.5, 0, j + 1, H]);
          add([j + 1, H, j + 1.5, 0]);
        }
      }
      return { sticks, tiles, width: (k + 1) / 2, height: H };
    }
    case "cross": {
      // A centre tile and four arms of k tiles.
      tiles.push([k, k]);
      for (let a = 1; a <= k; a++) tiles.push([k + a, k], [k - a, k], [k, k + a], [k, k - a]);
      return { sticks, tiles, width: 2 * k + 1, height: 2 * k + 1 };
    }
    case "corner": {
      // A corner tile, k tiles up and k tiles along.
      tiles.push([0, k]);
      for (let a = 1; a <= k; a++) tiles.push([0, k - a], [a, k]);
      return { sticks, tiles, width: k + 1, height: k + 1 };
    }
  }
}

/** How many sticks or tiles shape k has, by counting the drawing. */
export const patternCount = (kind: PatternKind, k: number) => {
  const s = patternShape(kind, k);
  return s.sticks.length + s.tiles.length;
};

// ── Building questions ──────────────────────────────────────────────────

const between = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

const blank = (level: Level, seed: number, variant: NthVariant): NthQuestion => ({
  type: "nth",
  level,
  seed,
  variant,
  first: 0,
  step: 0,
  first2: 0,
  step2: 0,
  pattern: null,
  shown: 4,
  n: 0,
  value: 0,
  answer: 0,
});

/** Every slip is its own number, none is the answer. */
const clean = (q: NthQuestion) => {
  const vs = nthSlips(q).map(([, v]) => v);
  return vs.every((v, i) => v !== q.answer && vs.indexOf(v) === i);
};

function farQuestion(rng: Rng, seed: number): NthQuestion {
  for (;;) {
    const q = blank(1, seed, "far");
    q.first = between(rng, 1, 15);
    q.step = between(rng, 2, 9);
    q.n = pick(rng, [10, 12, 15, 20, 20, 25, 30, between(rng, 10, 30)]);
    q.shown = 4;
    q.answer = termAt(q.first, q.step, q.n);
    if (q.first !== q.step && clean(q)) return q;
  }
}

function whichQuestion(rng: Rng, seed: number): NthQuestion {
  for (;;) {
    const q = blank(2, seed, "which");
    q.first = between(rng, 1, 20);
    q.step = between(rng, 2, 9);
    q.n = between(rng, 12, 40);
    q.value = termAt(q.first, q.step, q.n);
    q.answer = q.n;
    if (q.value <= 400 && clean(q)) return q;
  }
}

function patternQuestion(rng: Rng, seed: number): NthQuestion {
  for (;;) {
    const q = blank(2, seed, "pattern");
    q.pattern = pick(rng, Object.keys(PATTERNS) as PatternKind[]);
    q.first = PATTERNS[q.pattern].first;
    q.step = PATTERNS[q.pattern].step;
    q.shown = 3;
    q.n = between(rng, 10, 25);
    q.answer = termAt(q.first, q.step, q.n);
    if (clean(q)) return q;
  }
}

function ruleQuestion(rng: Rng, seed: number): NthQuestion {
  for (;;) {
    const q = blank(3, seed, "rule");
    q.step = between(rng, 2, 9);
    const c = between(rng, 1, 12);
    q.first = q.step + c;
    q.answer = ruleValue(q.step, c);
    if (c !== q.step && clean(q)) return q;
  }
}

function meetQuestion(rng: Rng, seed: number): NthQuestion {
  for (;;) {
    const q = blank(3, seed, "meet");
    q.shown = 3;
    q.first = between(rng, 1, 12);
    q.step = between(rng, 3, 9);
    q.step2 = between(rng, 1, q.step - 1);
    q.n = between(rng, 5, 10);
    q.first2 = q.first + (q.step - q.step2) * (q.n - 1);
    q.value = termAt(q.first, q.step, q.n);
    q.answer = q.n;
    if (q.first2 <= 60 && clean(q)) return q;
  }
}

export function makeNthQuestion(level: Level, seed: number): NthQuestion {
  const rng = mulberry32(seed * 13 + level * 211 + 4241);
  if (level === 1) return farQuestion(rng, seed);
  if (level === 2) return rng() < 0.5 ? whichQuestion(rng, seed) : patternQuestion(rng, seed);
  return rng() < 0.5 ? ruleQuestion(rng, seed) : meetQuestion(rng, seed);
}

// ── Slips ───────────────────────────────────────────────────────────────

export type NthTag =
  | "right"
  /** n jumps instead of n − 1 (one term too far). */
  | "nJumps"
  /** One jump too few, or one place off. */
  | "offByOne"
  /** n × the first term. */
  | "timesFirst"
  /** n × the step, the first term left out. */
  | "timesStep"
  /** Only the jumps, (n − 1) × step, the first term left out. */
  | "noStart"
  /** Reverse question: the jumps, not the place (one less). */
  | "reverseOff"
  /** The two boxes of the rule swapped. */
  | "swapped"
  /** Meet: the common value, not its place. */
  | "value"
  /** Rule: the step is right, the number added is not. */
  | "constant"
  | "other";

/** Wrong answers with a known cause, in the order they are checked. */
export function nthSlips(q: NthQuestion): [NthTag, number][] {
  const { first: a, step: d, n } = q;
  switch (q.variant) {
    case "far":
    case "pattern":
      return [
        ["nJumps", a + n * d],
        ["offByOne", a + (n - 2) * d],
        ["timesFirst", n * a],
        ["timesStep", n * d],
        ["noStart", (n - 1) * d],
      ];
    case "which": {
      const out: [NthTag, number][] = [
        ["reverseOff", n - 1],
        ["offByOne", n + 1],
      ];
      // Dividing the value by the step without taking off the first term.
      if (q.value % d === 0) out.push(["noStart", q.value / d]);
      return out;
    }
    case "meet":
      return [
        ["reverseOff", n - 1],
        ["offByOne", n + 1],
        ["value", q.value],
      ];
    case "rule": {
      const c = a - d;
      return [
        ["nJumps", ruleValue(d, a)],
        ["noStart", ruleValue(d, 0)],
        ["timesFirst", ruleValue(a, 0)],
        ["swapped", ruleValue(c, d)],
      ];
    }
  }
}

/** Which slip an answer is, if any. */
export function nthMistake(q: NthQuestion, value: number): NthTag {
  if (value === q.answer) return "right";
  for (const [tag, v] of nthSlips(q)) if (v === value) return tag;
  if (q.variant === "rule") {
    const { coef } = ruleParts(value);
    if (coef === q.first) return "timesFirst";
    if (coef === q.step) return "constant";
  }
  return "other";
}

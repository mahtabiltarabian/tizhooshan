// The rule a pupil builds from cards in "explore", and its shareable link:
// #show=add&s=2&d=3&n=6, with any field left out taking its default.

import type { Rule } from "@/generators/sequence";

export type BuildKind = "add" | "mul" | "grow" | "sum2" | "alt";

export interface Build {
  kind: BuildKind;
  /** First term (strand ● in a woven sequence). */
  start: number;
  /** "+" card: step, may be below zero. */
  step: number;
  /** "×" card: factor. */
  factor: number;
  /** Growing differences: the first difference and how much it grows. */
  first: number;
  growth: number;
  /** Sum of the two before: the second term. */
  second: number;
  /** Woven: strand ●'s card ("+" uses step, "×" factor) and strand ▲'s. */
  opA: "+" | "×";
  opB: "+" | "×";
  start2: number;
  step2: number;
  factor2: number;
  letters: boolean;
  /** Wagons. */
  n: number;
}

export const DEFAULT_BUILD: Build = {
  kind: "add",
  start: 2,
  step: 3,
  factor: 2,
  first: 1,
  growth: 1,
  second: 1,
  opA: "+",
  opB: "+",
  start2: 20,
  step2: -2,
  factor2: 2,
  letters: false,
  n: 6,
};

/** Handy starting points for each card. */
export const PRESETS: Record<BuildKind, Partial<Build>> = {
  add: { kind: "add", start: 2, step: 3 },
  mul: { kind: "mul", start: 1, factor: 2 },
  grow: { kind: "grow", start: 1, first: 1, growth: 1 },
  sum2: { kind: "sum2", start: 1, second: 1 },
  alt: { kind: "alt", start: 1, opA: "+", step: 2, start2: 20, opB: "+", step2: -2, n: 8 },
};

export const LIMITS = {
  start: [-20, 99],
  step: [-20, 20],
  factor: [2, 5],
  first: [-10, 10],
  growth: [-5, 5],
  second: [-20, 99],
  start2: [-20, 99],
  step2: [-20, 20],
  factor2: [2, 5],
  n: [4, 9],
} as const satisfies Partial<Record<keyof Build, readonly [number, number]>>;

export function ruleOf(b: Build): Rule {
  switch (b.kind) {
    case "add":
      return { kind: "step", start: b.start, op: "+", by: b.step };
    case "mul":
      return { kind: "step", start: b.start, op: "×", by: b.factor };
    case "grow":
      return { kind: "grow", start: b.start, first: b.first, growth: b.growth };
    case "sum2":
      return { kind: "sum2", a: b.start, b: b.second };
    case "alt":
      return {
        kind: "alt",
        a: { start: b.start, op: b.opA, by: b.opA === "+" ? b.step : b.factor },
        b: { start: b.start2, op: b.opB, by: b.opB === "+" ? b.step2 : b.factor2 },
      };
  }
}

const KEYS: [keyof typeof LIMITS, string][] = [
  ["start", "s"],
  ["step", "d"],
  ["factor", "f"],
  ["first", "g1"],
  ["growth", "g"],
  ["second", "b"],
  ["start2", "s2"],
  ["step2", "d2"],
  ["factor2", "f2"],
  ["n", "n"],
];

/** "add&s=2&d=3&…" for #show=. */
export function encodeBuild(b: Build): string {
  const parts = [b.kind, ...KEYS.map(([k, key]) => `${key}=${b[k]}`), `oa=${b.opA === "+" ? "p" : "m"}`, `ob=${b.opB === "+" ? "p" : "m"}`];
  if (b.letters) parts.push("L=1");
  return parts.join("&");
}

export function decodeBuild(kind: string, params: URLSearchParams): Build | null {
  if (!(kind in PRESETS)) return null;
  const b: Build = { ...DEFAULT_BUILD, ...PRESETS[kind as BuildKind] };
  for (const [k, key] of KEYS) {
    const v = Number(params.get(key));
    if (params.has(key) && Number.isInteger(v)) b[k] = Math.min(LIMITS[k][1], Math.max(LIMITS[k][0], v));
  }
  if (params.get("oa") === "m") b.opA = "×";
  if (params.get("ob") === "m") b.opB = "×";
  b.letters = params.get("L") === "1";
  return b;
}

/** Terms past this size are not drawn; the train stops there. */
export const TOO_BIG = 99_999;

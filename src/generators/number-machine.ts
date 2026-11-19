// Tool 11: number machine. A machine is a row of steps (+3, ×2, …) that a
// number passes through, input on the left and output on the right; or a
// defined operator a ★ b = r·ab + p·a + q·b + c. Every value along the way is
// a whole number 0 … MAX, so the machine never needs fractions or negatives.
// Each question keeps its answer and the usual slips, so the feedback can say
// which slip a wrong answer was.
//
// Uniqueness: every step is x → ax + b, so a machine is a straight-line rule
// and two examples with different inputs fix it. Any machine of the family
// that fits the examples is therefore the same rule (perhaps written another
// way, like ×2 → +6 and +3 → ×2), and the tool accepts it and says so. For
// operators the family is not settled by the examples alone, so the generator
// enumerates it and keeps only examples that leave exactly one operator.

import { mulberry32, pick, randInt, shuffle, type Rng } from "./random";

export type Level = 1 | 2 | 3;
export type MachineQuestionType = "run" | "reverse" | "guess" | "build" | "operator";

export type Op = "+" | "-" | "×" | "÷";
export interface Step {
  op: Op;
  n: number;
}
export type Rule = Step[];

/** Largest value anywhere in a question (the number pad has three digits). */
export const MAX = 999;

export const isMult = (op: Op) => op === "×" || op === "÷";

export function applyStep(x: number, s: Step): number {
  switch (s.op) {
    case "+":
      return x + s.n;
    case "-":
      return x - s.n;
    case "×":
      return x * s.n;
    case "÷":
      return s.n === 0 ? NaN : x / s.n;
  }
}

const INVERSE: Record<Op, Op> = { "+": "-", "-": "+", "×": "÷", "÷": "×" };
export const inverse = (s: Step): Step => ({ op: INVERSE[s.op], n: s.n });

/** The input and the value after each step. */
export function trace(x: number, rule: Rule): number[] {
  const out = [x];
  for (const s of rule) out.push(applyStep(out[out.length - 1], s));
  return out;
}

export const runRule = (x: number, rule: Rule) => trace(x, rule)[rule.length];

/** The machine run backwards: inverse steps, last step first. */
export const backRule = (rule: Rule): Rule => [...rule].reverse().map(inverse);

const whole = (v: number) => Number.isInteger(v) && v >= 0 && v <= MAX;

/** The trace if every value is a whole number 0 … MAX, otherwise null. */
export function cleanTrace(x: number, rule: Rule): number[] | null {
  const t = trace(x, rule);
  return t.every(whole) ? t : null;
}

/** Equal up to rounding (machines may pass through fractions in explore mode). */
export const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

// ── Operators ────────────────────────────────────────────────────────────

/**
 * a ★ b = r·a·b + p·a + q·b + c. `form` only says how to write it:
 * lin "2a + b", sumTimes "(a + b) × p", diffTimes "(a − b) × p", prod "a × b + a".
 */
export type OpForm = "lin" | "sumTimes" | "diffTimes" | "prod";
export interface OpDef {
  form: OpForm;
  r: 0 | 1;
  p: number;
  q: number;
  c: number;
}

export const lin = (p: number, q: number, c = 0): OpDef => ({ form: "lin", r: 0, p, q, c });
export const sumTimes = (p: number): OpDef => ({ form: "sumTimes", r: 0, p, q: p, c: 0 });
export const diffTimes = (p: number): OpDef => ({ form: "diffTimes", r: 0, p, q: -p, c: 0 });
export const prod = (p: number, q: number, c: number): OpDef => ({ form: "prod", r: 1, p, q, c });

export const opValue = (d: OpDef, a: number, b: number) => d.r * a * b + d.p * a + d.q * b + d.c;

/** Two operators are the same rule when their numbers agree (the form is only how it is written). */
export const sameOp = (x: OpDef, y: OpDef) => x.r === y.r && x.p === y.p && x.q === y.q && x.c === y.c;

/** The operators a child might guess: r ∈ {0, 1}, p and q −5 … 5, c −10 … 10. */
export const OP_FAMILY: OpDef[] = (() => {
  const out: OpDef[] = [];
  for (const r of [0, 1] as const)
    for (let p = -5; p <= 5; p++)
      for (let q = -5; q <= 5; q++) for (let c = -10; c <= 10; c++) out.push(r ? prod(p, q, c) : lin(p, q, c));
  return out;
})();

// ── Machines and examples ────────────────────────────────────────────────

/** A hidden rule (and also a built answer). */
export type Machine = { kind: "machine"; rule: Rule } | { kind: "op"; op: OpDef };

export interface Example {
  /** One number into a machine, or a and b into an operator. */
  input: number[];
  output: number;
}

export function machineValue(m: Machine, input: number[]): number {
  return m.kind === "machine" ? runRule(input[0], m.rule) : opValue(m.op, input[0], input[1] ?? 0);
}

export const fits = (m: Machine, e: Example) => near(machineValue(m, e.input), e.output);

/** Two machines give the same output for every input (checked on a spread of inputs). */
export function sameFunction(x: Machine, y: Machine): boolean {
  if (x.kind !== y.kind) return false;
  if (x.kind === "op" && y.kind === "op") return sameOp(x.op, y.op);
  for (let i = 0; i <= 40; i++) if (!near(machineValue(x, [i]), machineValue(y, [i]))) return false;
  return true;
}

/** Written the same way, step for step. */
export function sameRule(x: Machine, y: Machine): boolean {
  if (x.kind === "op" && y.kind === "op") return sameOp(x.op, y.op);
  if (x.kind === "machine" && y.kind === "machine") return x.rule.length === y.rule.length && x.rule.every((s, i) => s.op === y.rule[i].op && s.n === y.rule[i].n);
  return false;
}

// ── Questions ────────────────────────────────────────────────────────────

interface Base {
  level: Level;
  seed: number;
}

/** The machine is shown; what comes out? */
export interface RunQuestion extends Base {
  type: "run";
  rule: Rule;
  input: number;
  answer: number;
}

/** The machine is shown and what came out; what went in? */
export interface ReverseQuestion extends Base {
  type: "reverse";
  rule: Rule;
  output: number;
  answer: number;
}

/** A hidden machine and some examples; what comes out for a new input? */
export interface GuessQuestion extends Base {
  type: "guess";
  machine: Machine;
  examples: Example[];
  query: number[];
  answer: number;
}

/** A hidden machine and some examples; build the machine. */
export interface BuildQuestion extends Base {
  type: "build";
  machine: Machine;
  examples: Example[];
  answer: Machine;
}

/**
 * plain: a ★ b. nested: (a ★ b) ★ c. unknown: □ ★ b = c, find □ (the answer is a).
 */
export interface OperatorQuestion extends Base {
  type: "operator";
  op: OpDef;
  variant: "plain" | "nested" | "unknown";
  a: number;
  b: number;
  c: number;
  answer: number;
}

export type MachineQuestion = RunQuestion | ReverseQuestion | GuessQuestion | BuildQuestion | OperatorQuestion;
export type NumberQuestion = Exclude<MachineQuestion, BuildQuestion>;

/** What kind of answer a question wants. */
export const answerKind = (type: MachineQuestionType): "number" | "machine" => (type === "build" ? "machine" : "number");

/** Knobs of "new example". */
export interface MachineOptions {
  /** How many examples a hidden machine shows (operators need at least 3). */
  examples?: 2 | 3 | 4;
  /** Allow ÷ steps. */
  division?: boolean;
}

/** Steps in a machine at each level (run and reverse; guess and build use two at level 3 too, or an operator). */
export const stepsFor = (level: Level) => level;

const addStep = (rng: Rng, lo: number, hi: number): Step => ({ op: rng() < 0.55 ? "+" : "-", n: lo + randInt(rng, hi - lo + 1) });
const multStep = (rng: Rng, hi: number, division: boolean): Step => ({ op: division && rng() < 0.35 ? "÷" : "×", n: 2 + randInt(rng, hi - 1) });

/**
 * A machine of 1 … 3 steps. Adding and multiplying steps take turns: two
 * adding steps in a row are really one step (+3 then −1 is +2).
 */
function makeRule(rng: Rng, steps: number, division: boolean): Rule {
  if (steps === 1) return [rng() < 0.5 ? addStep(rng, 2, 15) : multStep(rng, 9, division)];
  const multFirst = rng() < 0.5;
  return Array.from({ length: steps }, (_, i) =>
    (i % 2 === 0) === multFirst ? multStep(rng, steps === 2 ? 6 : 5, division) : addStep(rng, 1, steps === 2 ? 12 : 9),
  );
}

/** Largest output and input at each level. */
const CAP: Record<Level, number> = { 1: 150, 2: 200, 3: 400 };
const IN_HI: Record<Level, number> = { 1: 40, 2: 30, 3: 20 };

/** Inputs 1 … hi whose whole trace stays whole, 0 … cap. */
function goodInputs(rule: Rule, hi: number, cap: number) {
  const out: number[] = [];
  for (let x = 1; x <= hi; x++) {
    const t = cleanTrace(x, rule);
    if (t && t[rule.length] <= cap) out.push(x);
  }
  return out;
}

/** A rule with at least `need` good inputs. */
function ruleWithInputs(rng: Rng, level: Level, steps: number, division: boolean, need: number) {
  for (;;) {
    const rule = makeRule(rng, steps, division);
    const inputs = goodInputs(rule, IN_HI[level], CAP[level]);
    if (inputs.length >= need) return { rule, inputs };
  }
}

function runQuestion(rng: Rng, level: Level, seed: number, division: boolean): RunQuestion {
  const { rule, inputs } = ruleWithInputs(rng, level, stepsFor(level), division, 2);
  const input = pick(rng, inputs);
  return { type: "run", level, seed, rule, input, answer: runRule(input, rule) };
}

function reverseQuestion(rng: Rng, level: Level, seed: number, division: boolean): ReverseQuestion {
  for (;;) {
    const { rule, inputs } = ruleWithInputs(rng, level, stepsFor(level), division, 2);
    const answer = pick(rng, inputs);
    const output = runRule(answer, rule);
    // The output should not give the input away.
    if (output === answer) continue;
    return { type: "reverse", level, seed, rule, output, answer };
  }
}

/** Examples of a hidden machine, inputs in increasing order, and a different input to ask about. */
function machineExamples(rng: Rng, level: 1 | 2, division: boolean, count: number) {
  const { rule, inputs } = ruleWithInputs(rng, level, level, division, count + 1);
  const chosen = shuffle(rng, inputs).slice(0, count + 1);
  const query = chosen[count];
  const examples = chosen
    .slice(0, count)
    .sort((x, y) => x - y)
    .map((x) => ({ input: [x], output: runRule(x, rule) }));
  const machine: Machine = { kind: "machine", rule };
  return { machine, examples, query };
}

/** Operators that fit all the examples. */
export const fittingOps = (examples: Example[], family: OpDef[] = OP_FAMILY) => family.filter((d) => examples.every((e) => opValue(d, e.input[0], e.input[1]) === e.output));

/** A hidden operator a child can find: 2a + b, a × b + a, (a + b) × 2 and the like. */
function hiddenOp(rng: Rng): OpDef {
  const k = randInt(rng, 5);
  if (k <= 1) {
    for (;;) {
      const p = 1 + randInt(rng, 4);
      const q = 1 + randInt(rng, 4);
      if (p !== 1 || q !== 1) return lin(p, q);
    }
  }
  if (k === 2) return pick(rng, [lin(2, -1), lin(3, -1), lin(3, -2), lin(2, 1, 1), lin(1, 2, -1)]);
  if (k === 3) return sumTimes(2 + randInt(rng, 3));
  return pick(rng, [prod(1, 0, 0), prod(0, 1, 0), prod(-1, 0, 0), prod(0, 0, 1), prod(0, 0, 2), prod(0, 0, -1), prod(1, 1, 0)]);
}

/** Examples of a hidden operator that leave exactly one operator of OP_FAMILY. */
function opExamples(rng: Rng, count: number) {
  for (;;) {
    const op = hiddenOp(rng);
    const pairs: [number, number][] = [];
    while (pairs.length < count + 1) {
      const a = 1 + randInt(rng, 9);
      const b = 1 + randInt(rng, 9);
      if (pairs.some(([x, y]) => x === a && y === b)) continue;
      pairs.push([a, b]);
    }
    const examples = pairs.slice(0, count).map(([a, b]) => ({ input: [a, b], output: opValue(op, a, b) }));
    const [qa, qb] = pairs[count];
    const answer = opValue(op, qa, qb);
    if (![...examples.map((e) => e.output), answer].every(whole) || answer > CAP[3]) continue;
    // The question should tell a from b.
    if (qa === qb || pairs.every(([a, b]) => a === b)) continue;
    const fit = fittingOps(examples);
    if (fit.length !== 1 || !sameOp(fit[0], op)) continue;
    return { machine: { kind: "op", op } as Machine, examples, query: [qa, qb], answer };
  }
}

function guessQuestion(rng: Rng, level: Level, seed: number, o: Required<MachineOptions>): GuessQuestion {
  if (level === 3) {
    const { machine, examples, query, answer } = opExamples(rng, Math.max(3, o.examples));
    return { type: "guess", level, seed, machine, examples, query, answer };
  }
  const { machine, examples, query } = machineExamples(rng, level, o.division, o.examples);
  return { type: "guess", level, seed, machine, examples, query: [query], answer: machineValue(machine, [query]) };
}

/** Coefficients a child may write in "a ★ b = □a ± □b". */
export const TEMPLATE_MAX = 20;
export const TEMPLATE_FAMILY: OpDef[] = (() => {
  const out: OpDef[] = [];
  for (let p = 0; p <= TEMPLATE_MAX; p++) for (let q = -TEMPLATE_MAX; q <= TEMPLATE_MAX; q++) out.push(lin(p, q));
  return out;
})();

function buildQuestion(rng: Rng, level: Level, seed: number, o: Required<MachineOptions>): BuildQuestion {
  if (level !== 3) {
    const { machine, examples } = machineExamples(rng, level, o.division, o.examples);
    return { type: "build", level, seed, machine, examples, answer: machine };
  }
  // Level 3: fill in the operator a ★ b = □a ± □b.
  const count = Math.max(3, o.examples);
  for (;;) {
    const p = 1 + randInt(rng, 5);
    const q = (1 + randInt(rng, 5)) * (rng() < 0.35 ? -1 : 1);
    if (p === Math.abs(q) && q > 0 && rng() < 0.7) continue;
    const op = lin(p, q);
    const pairs: [number, number][] = [];
    while (pairs.length < count) {
      const a = 1 + randInt(rng, 9);
      const b = 1 + randInt(rng, 9);
      if (!pairs.some(([x, y]) => x === a && y === b)) pairs.push([a, b]);
    }
    const examples = pairs.map(([a, b]) => ({ input: [a, b], output: opValue(op, a, b) }));
    if (!examples.every((e) => whole(e.output))) continue;
    const fit = fittingOps(examples, TEMPLATE_FAMILY);
    if (fit.length !== 1) continue;
    const machine: Machine = { kind: "op", op };
    return { type: "build", level, seed, machine, examples, answer: machine };
  }
}

function operatorQuestion(rng: Rng, level: Level, seed: number): OperatorQuestion {
  const small = () => 2 + randInt(rng, 8);
  for (;;) {
    if (level === 1) {
      const p = 1 + randInt(rng, 4);
      const q = 1 + randInt(rng, 4);
      const [a, b] = [small(), small()];
      if (p === q || a === b) continue;
      const op = lin(p, q);
      return { type: "operator", level, seed, op, variant: "plain", a, b, c: 0, answer: opValue(op, a, b) };
    }
    if (level === 2) {
      const k = randInt(rng, 4);
      const op = k === 0 ? sumTimes(2 + randInt(rng, 4)) : k === 1 ? diffTimes(2 + randInt(rng, 4)) : k === 2 ? pick(rng, [prod(1, 0, 0), prod(0, -1, 0), prod(0, 1, 0)]) : prod(0, 0, pick(rng, [1, 2, 3, -1, -2]));
      const [a, b] = [small(), small()];
      if (a === b) continue;
      const answer = opValue(op, a, b);
      if (!whole(answer) || answer === 0) continue;
      return { type: "operator", level, seed, op, variant: "plain", a, b, c: 0, answer };
    }
    // Level 3: two operators in a row, or the operator backwards.
    const p = 1 + randInt(rng, 3);
    const q = 1 + randInt(rng, 3);
    if (p === q) continue;
    const op = lin(p, q);
    if (rng() < 0.5) {
      const [a, b, c] = [1 + randInt(rng, 6), 1 + randInt(rng, 6), 1 + randInt(rng, 6)];
      const answer = opValue(op, opValue(op, a, b), c);
      // a ★ (b ★ c) must differ, so the brackets matter.
      if (answer > MAX || answer === opValue(op, a, opValue(op, b, c))) continue;
      return { type: "operator", level, seed, op, variant: "nested", a, b, c, answer };
    }
    const bigP = lin(2 + randInt(rng, 3), q);
    const a = 2 + randInt(rng, 11);
    const b = 1 + randInt(rng, 9);
    return { type: "operator", level, seed, op: bigP, variant: "unknown", a, b, c: opValue(bigP, a, b), answer: a };
  }
}

const DEFAULTS: Required<MachineOptions> = { examples: 3, division: true };

export function makeMachineQuestion(type: MachineQuestionType, level: Level, seed: number, options: MachineOptions = {}): MachineQuestion {
  const o = { ...DEFAULTS, ...options };
  const rng = mulberry32(seed * 11 + level * 131 + type.length * 17 + (o.division ? 0 : 7) + o.examples * 3);
  switch (type) {
    case "run":
      return runQuestion(rng, level, seed, o.division);
    case "reverse":
      return reverseQuestion(rng, level, seed, o.division);
    case "guess":
      return guessQuestion(rng, level, seed, o);
    case "build":
      return buildQuestion(rng, level, seed, o);
    case "operator":
      return operatorQuestion(rng, level, seed);
  }
}

// ── Slips ────────────────────────────────────────────────────────────────

export type MachineTag =
  | "right"
  /** Ran the steps in the wrong order (or built them so). */
  | "order"
  /** Left out the last step. */
  | "stopEarly"
  /** One step: read + as × or × as +. */
  | "wrongOp"
  /** Reverse machine: ran it forwards on the output. */
  | "noInvert"
  /** Reverse machine: went from the last step back but did not undo the steps. */
  | "sameOps"
  /** Reverse machine: undid the steps but in the forward order. */
  | "keepOrder"
  /** Guess: took the difference of one example as the rule. */
  | "addOnly"
  /** Guess: took the ratio of one example as the rule. */
  | "timesOnly"
  /** Guess: continued the outputs like a sequence. */
  | "sequence"
  /** Operator: swapped a and b. */
  | "swapped"
  /** Operator: dropped the numbers in front of a and b. */
  | "noCoef"
  /** Operator: multiplied before the bracket. */
  | "precedence"
  /** Operator: (a ★ b) ★ c worked as a ★ (b ★ c). */
  | "nestOrder"
  /** Operator backwards: subtracted but did not divide. */
  | "noDivide"
  /** Build: the machine fits some examples but not all. */
  | "fitsSome"
  | "other";

/** The steps of a rule taken in another order: order[i] is the step done i-th. */
export const reorder = (rule: Rule, order: number[]): Rule => order.map((i) => rule[i]);

/** A single pair of steps swapped: their places (0-based, i < j), or null. */
export function swappedPair(order: number[]): [number, number] | null {
  const moved = order.flatMap((k, i) => (k === i ? [] : [i]));
  return moved.length === 2 && order[moved[0]] === moved[1] ? [moved[0], moved[1]] : null;
}

/**
 * Every wrong order of n steps, in the order they are checked: backwards
 * first (the usual slip), then one pair swapped, then any other reorder.
 */
export function wrongOrders(n: number): number[][] {
  const all: number[][] = [];
  const grow = (prefix: number[]) => {
    if (prefix.length === n) {
      if (prefix.some((k, i) => k !== i)) all.push(prefix);
      return;
    }
    for (let k = 0; k < n; k++) if (!prefix.includes(k)) grow([...prefix, k]);
  };
  grow([]);
  const rank = (o: number[]) => (o.every((k, i) => k === n - 1 - i) ? 0 : swappedPair(o) ? 1 : 2);
  return all.sort((x, y) => rank(x) - rank(y));
}

/** The wrong order of the steps that gives this answer to a run question, if any. */
export function orderUsed(q: RunQuestion, value: number): number[] | null {
  if (value === q.answer || q.rule.length < 2) return null;
  return wrongOrders(q.rule.length).find((o) => near(runRule(q.input, reorder(q.rule, o)), value)) ?? null;
}

/** Wrong answers with a known cause, in the order they are checked. */
export function slips(q: NumberQuestion): [MachineTag, number][] {
  const out: [MachineTag, number][] = [];
  const add = (tag: MachineTag, v: number) => {
    if (whole(v)) out.push([tag, v]);
  };
  switch (q.type) {
    case "run": {
      const t = trace(q.input, q.rule);
      if (q.rule.length === 1) {
        const s = q.rule[0];
        if (s.op === "+") add("wrongOp", q.input * s.n);
        if (s.op === "×") add("wrongOp", q.input + s.n);
      } else {
        for (const order of wrongOrders(q.rule.length)) add("order", runRule(q.input, reorder(q.rule, order)));
        add("stopEarly", t[q.rule.length - 1]);
      }
      break;
    }
    case "reverse":
      add("noInvert", runRule(q.output, q.rule));
      if (q.rule.length > 1) {
        add("sameOps", runRule(q.output, [...q.rule].reverse()));
        add("keepOrder", runRule(q.output, q.rule.map(inverse)));
      }
      break;
    case "guess": {
      if (q.machine.kind === "machine") {
        const [e1] = q.examples;
        const x = q.query[0];
        add("addOnly", x + e1.output - e1.input[0]);
        if (e1.input[0] > 0 && e1.output % e1.input[0] === 0) add("timesOnly", (x * e1.output) / e1.input[0]);
        const n = q.examples.length;
        if (n >= 2) add("sequence", 2 * q.examples[n - 1].output - q.examples[n - 2].output);
      } else {
        add("swapped", opValue(q.machine.op, q.query[1], q.query[0]));
      }
      break;
    }
    case "operator": {
      const { op, a, b, c } = q;
      if (q.variant === "plain") {
        if (op.form === "sumTimes") add("precedence", a + b * op.p);
        else if (op.form === "diffTimes") add("precedence", a - b * op.p);
        add("swapped", opValue(op, b, a));
        if (op.form === "lin") add("noCoef", a + Math.sign(op.q) * b);
      } else if (q.variant === "nested") {
        add("nestOrder", opValue(op, a, opValue(op, b, c)));
        add("stopEarly", opValue(op, a, b));
        add("swapped", opValue(op, c, opValue(op, a, b)));
      } else {
        add("noDivide", c - op.q * b);
        const s = (c - op.p * b) / op.q;
        add("swapped", s);
      }
      break;
    }
  }
  return out;
}

/** Which slip an answer is, if any. */
export function machineMistake(q: NumberQuestion, value: number): MachineTag {
  if (value === q.answer) return "right";
  for (const [tag, v] of slips(q)) if (v !== q.answer && v === value) return tag;
  return "other";
}

/** Which slip a built machine is, if any. Any machine that fits every example is right. */
export function buildMistake(q: BuildQuestion, m: Machine): MachineTag {
  if (q.examples.every((e) => fits(m, e))) return "right";
  if (m.kind === "machine" && q.machine.kind === "machine") {
    const rev: Machine = { kind: "machine", rule: [...q.machine.rule].reverse() };
    if (m.rule.length > 1 && sameRule(m, rev)) return "order";
  }
  if (m.kind === "op" && q.machine.kind === "op" && m.op.p === q.machine.op.q && m.op.q === q.machine.op.p) return "swapped";
  if (q.examples.some((e) => fits(m, e))) return "fitsSome";
  return "other";
}

// ── Links ────────────────────────────────────────────────────────────────

const LETTER: Record<Op, string> = { "+": "a", "-": "s", "×": "m", "÷": "d" };
const OP_OF: Record<string, Op> = { a: "+", s: "-", m: "×", d: "÷" };

/** "m2.a3" for ×2 → +3; "o2_-1" for a ★ b = 2a − b. */
export function encodeMachine(m: Machine): string {
  if (m.kind === "op") return `o${m.op.p}_${m.op.q}`;
  return m.rule.map((s) => `${LETTER[s.op]}${s.n}`).join(".");
}

export function decodeMachine(s: string): Machine | null {
  const o = /^o(-?\d+)_(-?\d+)$/.exec(s);
  if (o) return { kind: "op", op: lin(Number(o[1]), Number(o[2])) };
  const rule = decodeRule(s);
  return rule ? { kind: "machine", rule } : null;
}

export function decodeRule(s: string): Rule | null {
  const parts = s.split(".");
  if (!parts.length || parts.length > 4) return null;
  const rule: Rule = [];
  for (const p of parts) {
    const m = /^([asmd])(\d{1,3})$/.exec(p);
    if (!m) return null;
    rule.push({ op: OP_OF[m[1]], n: Number(m[2]) });
  }
  return rule;
}

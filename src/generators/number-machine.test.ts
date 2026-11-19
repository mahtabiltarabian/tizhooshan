import { describe, expect, it } from "vitest";
import {
  applyStep,
  backRule,
  buildMistake,
  cleanTrace,
  decodeMachine,
  encodeMachine,
  inverse,
  lin,
  machineMistake,
  machineValue,
  makeMachineQuestion,
  MAX,
  opValue,
  orderUsed,
  prod,
  runRule,
  sameFunction,
  slips,
  sumTimes,
  swappedPair,
  trace,
  type Level,
  type Machine,
  type MachineQuestion,
  type MachineQuestionType,
  type Op,
  type Rule,
  type Step,
  wrongOrders,
} from "./number-machine";

const TYPES: MachineQuestionType[] = ["run", "reverse", "guess", "build", "operator"];
const LEVELS: Level[] = [1, 2, 3];
const whole = (v: number) => Number.isInteger(v) && v >= 0 && v <= MAX;

// The family a child may build or guess: one or two steps of +1 … +12, −1 … −12, ×2 … ×10, ÷2 … ÷10.
const STEPS: Step[] = [
  ...Array.from({ length: 12 }, (_, i) => ({ op: "+" as Op, n: i + 1 })),
  ...Array.from({ length: 12 }, (_, i) => ({ op: "-" as Op, n: i + 1 })),
  ...Array.from({ length: 9 }, (_, i) => ({ op: "×" as Op, n: i + 2 })),
  ...Array.from({ length: 9 }, (_, i) => ({ op: "÷" as Op, n: i + 2 })),
];
const FAMILY: Rule[] = [...STEPS.map((s) => [s]), ...STEPS.flatMap((s) => STEPS.map((t) => [s, t]))];
// Each rule's output for inputs 0 … 40 (examples and questions stay in that range).
const TABLE = FAMILY.map((r) => Array.from({ length: 41 }, (_, x) => runRule(x, r)));
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/** Every rule of the family that fits the examples gives the same output for every input 0 … 40. */
function machineUnique(q: MachineQuestion & { examples: { input: number[]; output: number }[]; machine: Machine }) {
  const hidden = Array.from({ length: 41 }, (_, x) => machineValue(q.machine, [x]));
  let fitting = 0;
  TABLE.forEach((row) => {
    if (!q.examples.every((e) => close(row[e.input[0]], e.output))) return;
    fitting++;
    for (let x = 0; x <= 40; x++) if (!close(row[x], hidden[x])) throw new Error(`seed ${q.seed}: another rule fits ${JSON.stringify(q.examples)}`);
  });
  return fitting;
}

/** Operators r·ab + p·a + q·b + c (r 0 or 1, p and q −5 … 5, c −10 … 10) that fit the examples. */
function opsFitting(examples: { input: number[]; output: number }[]) {
  const out: number[][] = [];
  for (let r = 0; r <= 1; r++)
    for (let p = -5; p <= 5; p++)
      for (let q = -5; q <= 5; q++)
        for (let c = -10; c <= 10; c++)
          if (examples.every(({ input: [a, b], output }) => r * a * b + p * a + q * b + c === output)) out.push([r, p, q, c]);
  return out;
}

describe("machine arithmetic", () => {
  it("runs steps and undoes them", () => {
    expect(applyStep(5, { op: "+", n: 3 })).toBe(8);
    expect(applyStep(5, { op: "-", n: 3 })).toBe(2);
    expect(applyStep(5, { op: "×", n: 3 })).toBe(15);
    expect(applyStep(15, { op: "÷", n: 3 })).toBe(5);
    const rule: Rule = [
      { op: "+", n: 3 },
      { op: "×", n: 2 },
    ];
    expect(trace(5, rule)).toEqual([5, 8, 16]);
    expect(backRule(rule)).toEqual([
      { op: "÷", n: 2 },
      { op: "-", n: 3 },
    ]);
    expect(runRule(16, backRule(rule))).toBe(5);
    for (const s of STEPS) expect(inverse(inverse(s))).toEqual(s);
    for (const r of FAMILY.slice(0, 400)) for (let x = 0; x < 20; x++) expect(close(runRule(runRule(x, r), backRule(r)), x)).toBe(true);
  });

  it("only keeps whole numbers", () => {
    expect(cleanTrace(7, [{ op: "÷", n: 2 }])).toBeNull();
    expect(cleanTrace(2, [{ op: "-", n: 3 }])).toBeNull();
    expect(cleanTrace(8, [{ op: "÷", n: 2 }])).toEqual([8, 4]);
  });

  it("works defined operators", () => {
    expect(opValue(lin(2, 1), 3, 5)).toBe(11);
    expect(opValue(lin(2, 1), 5, 3)).toBe(13);
    expect(opValue(sumTimes(2), 3, 5)).toBe(16);
    expect(opValue(prod(1, 0, 0), 3, 5)).toBe(18);
  });

  it("writes machines into links and back", () => {
    const m: Machine = { kind: "machine", rule: [{ op: "×", n: 2 }, { op: "-", n: 13 }] };
    expect(encodeMachine(m)).toBe("m2.s13");
    expect(decodeMachine("m2.s13")).toEqual(m);
    const o: Machine = { kind: "op", op: lin(2, -3) };
    expect(decodeMachine(encodeMachine(o))).toEqual(o);
    expect(decodeMachine("x2")).toBeNull();
  });
});

describe("number machine questions", () => {
  it("is the same for the same seed", () => {
    for (const t of TYPES) for (const l of LEVELS) expect(makeMachineQuestion(t, l, 42)).toEqual(makeMachineQuestion(t, l, 42));
  });

  it("gives a sound question for 10,000 seeds of every type and level", () => {
    // Plain checks in the loop (an expect per check is slow over 150,000 questions); failures are listed at the end.
    const bad: string[] = [];
    for (const type of TYPES)
      for (const level of LEVELS)
        for (let seed = 0; seed < 10_000; seed++) {
          const q = makeMachineQuestion(type, level, seed);
          const need = (ok: boolean, what: string) => {
            if (!ok && bad.length < 20) bad.push(`${type} ${level} ${seed}: ${what}`);
          };
          need(q.type === type, "type");
          if (q.type === "build") need(buildMistake(q, q.answer) === "right", "answer is right");
          else {
            need(whole(q.answer), "whole answer");
            need(machineMistake(q, q.answer) === "right", "answer is right");
            // A slip that happens to be the answer is not reported as a slip.
            for (const [, v] of slips(q)) if (v !== q.answer) need(machineMistake(q, v) !== "other", "slip is named");
            // An order slip can always say which steps were taken in which order.
            if (q.type === "run") for (const [tag, v] of slips(q)) if (tag === "order" && v !== q.answer) need(machineMistake(q, v) === "order" && orderUsed(q, v) !== null, "order is named");
          }

          switch (q.type) {
            case "run":
            case "reverse": {
              need(q.rule.length === level, "steps = level");
              const input = q.type === "run" ? q.input : q.answer;
              // Whole numbers all the way through, no negatives.
              const t = cleanTrace(input, q.rule);
              need(t !== null && input >= 1, "whole trace");
              if (q.type === "run") need(t?.[level] === q.answer, "output");
              else {
                need(t?.[level] === q.output, "output");
                // The machine backwards, from the output, lands on the input with whole numbers.
                need(cleanTrace(q.output, backRule(q.rule))?.[level] === q.answer, "backwards");
              }
              // Adding and multiplying steps take turns, so no step is wasted.
              const mult = (s: Step) => s.op === "×" || s.op === "÷";
              for (let i = 1; i < q.rule.length; i++) need(mult(q.rule[i]) !== mult(q.rule[i - 1]), "kinds take turns");
              break;
            }
            case "guess":
            case "build": {
              need(q.examples.length === 3, "three examples");
              for (const e of q.examples) need(whole(e.output) && close(machineValue(q.machine, e.input), e.output), "example fits");
              if (q.machine.kind === "machine") {
                need(level < 3 && q.machine.rule.length === level, "steps = level");
                for (const e of q.examples) need(cleanTrace(e.input[0], q.machine.rule) !== null, "whole example trace");
                if (q.type === "guess") {
                  need(!q.examples.some((e) => e.input[0] === q.query[0]), "new input");
                  need(cleanTrace(q.query[0], q.machine.rule) !== null, "whole question trace");
                }
                // Within the family only one rule fits (up to how it is written); machineUnique throws otherwise.
                need(machineUnique(q) >= 1, "unique rule");
              } else {
                need(level === 3, "operator only at level 3");
                for (const e of q.examples) need(e.input.every((v) => v >= 1 && v <= 9), "small a and b");
                if (q.type === "guess") {
                  const fit = opsFitting(q.examples);
                  need(fit.length === 1, "one operator fits");
                  const [r, p, qq, c] = fit[0];
                  const [a, b] = q.query;
                  need(r * a * b + p * a + qq * b + c === q.answer && a !== b, "answer of the one operator");
                } else {
                  // a ★ b = □a ± □b: one pair of numbers fits.
                  let n = 0;
                  for (let p = 0; p <= 20; p++)
                    for (let s = -20; s <= 20; s++) if (q.examples.every(({ input: [a, b], output }) => p * a + s * b === output)) n++;
                  need(n === 1, "one template fits");
                }
              }
              break;
            }
            case "operator": {
              need(level < 3 ? q.variant === "plain" : q.variant !== "plain", "variant by level");
              if (q.variant === "plain") need(opValue(q.op, q.a, q.b) === q.answer && q.a !== q.b, "plain");
              if (q.variant === "nested")
                need(opValue(q.op, opValue(q.op, q.a, q.b), q.c) === q.answer && opValue(q.op, q.a, opValue(q.op, q.b, q.c)) !== q.answer, "brackets matter");
              if (q.variant === "unknown") {
                // Only one whole number fits the box.
                let n = 0;
                for (let x = 0; x <= MAX; x++) if (opValue(q.op, x, q.b) === q.c) n += x === q.answer ? 1 : 100;
                need(n === 1, "one number fits the box");
              }
              break;
            }
          }
        }
    expect(bad).toEqual([]);
  }, 120_000);

  it("honours the knobs: number of examples and no division", () => {
    for (const examples of [2, 4] as const)
      for (const type of ["guess", "build"] as const)
        for (const level of LEVELS)
          for (let seed = 0; seed < 1000; seed++) {
            const q = makeMachineQuestion(type, level, seed, { examples });
            if (q.type !== "guess" && q.type !== "build") throw new Error("type");
            expect(q.examples.length).toBe(level === 3 ? Math.max(3, examples) : examples);
            if (q.machine.kind === "machine") expect(machineUnique(q)).toBeGreaterThanOrEqual(1);
            else if (q.type === "guess") expect(opsFitting(q.examples).length).toBe(1);
          }
    for (const type of ["run", "reverse", "guess", "build"] as const)
      for (const level of LEVELS)
        for (let seed = 0; seed < 1000; seed++) {
          const q = makeMachineQuestion(type, level, seed, { division: false });
          const rule = "rule" in q ? q.rule : q.type === "guess" || q.type === "build" ? (q.machine.kind === "machine" ? q.machine.rule : []) : [];
          expect(rule.some((s) => s.op === "÷")).toBe(false);
        }
  }, 120_000);

  it("names the usual slips", () => {
    const base = { level: 2 as Level, seed: 0 };
    const run = { ...base, type: "run" as const, rule: [{ op: "+" as Op, n: 3 }, { op: "×" as Op, n: 2 }], input: 5, answer: 16 };
    expect(machineMistake(run, 13)).toBe("order");
    expect(machineMistake(run, 8)).toBe("stopEarly");
    expect(machineMistake(run, 17)).toBe("other");
    expect(machineMistake({ ...run, level: 1, rule: [{ op: "×", n: 4 }], input: 6, answer: 24 }, 10)).toBe("wrongOp");

    const rev = { ...base, type: "reverse" as const, rule: [{ op: "×" as Op, n: 3 }, { op: "+" as Op, n: 4 }], output: 19, answer: 5 };
    expect(machineMistake(rev, 61)).toBe("noInvert"); // 19 × 3 + 4
    expect(machineMistake(rev, 69)).toBe("sameOps"); // (19 + 4) × 3
    expect(machineMistake(rev, 2)).toBe("other"); // 19 ÷ 3 is not whole, so "keepOrder" cannot happen here
    const rev2 = { ...rev, rule: [{ op: "×" as Op, n: 2 }, { op: "+" as Op, n: 4 }], output: 14, answer: 5 };
    expect(machineMistake(rev2, 3)).toBe("keepOrder"); // 14 ÷ 2 − 4
    expect(machineMistake(rev2, 5)).toBe("right"); // (14 − 4) ÷ 2

    const guess = { ...base, type: "guess" as const, machine: { kind: "machine", rule: [{ op: "×" as Op, n: 3 }] } as Machine, examples: [2, 4, 5].map((x) => ({ input: [x], output: 3 * x })), query: [8], answer: 24 };
    expect(machineMistake(guess, 12)).toBe("addOnly"); // 8 + (6 − 2)
    expect(machineMistake(guess, 18)).toBe("sequence"); // 15 + (15 − 12)

    const op = { ...base, type: "operator" as const, op: lin(2, 1), variant: "plain" as const, a: 3, b: 5, c: 0, answer: 11 };
    expect(machineMistake(op, 13)).toBe("swapped");
    expect(machineMistake(op, 8)).toBe("noCoef");
    expect(machineMistake({ ...op, op: sumTimes(2), answer: 16 }, 13)).toBe("precedence");
    const nested = { ...op, level: 3 as Level, variant: "nested" as const, a: 2, b: 3, c: 4, answer: 18 }; // (2★3)★4 = 7★4
    expect(machineMistake(nested, 14)).toBe("nestOrder"); // 2★(3★4) = 2★10
    expect(machineMistake(nested, 15)).toBe("swapped"); // 4★7
    expect(machineMistake(nested, 7)).toBe("stopEarly");
    const unknown = { ...op, level: 3 as Level, variant: "unknown" as const, op: lin(3, 2), a: 5, b: 4, c: 23, answer: 5 }; // 3□ + 8 = 23
    expect(machineMistake(unknown, 15)).toBe("noDivide");

    const build = { ...base, type: "build" as const, machine: { kind: "machine", rule: [{ op: "×" as Op, n: 2 }, { op: "+" as Op, n: 3 }] } as Machine, examples: [1, 4, 6].map((x) => ({ input: [x], output: 2 * x + 3 })) };
    const b = { ...build, answer: build.machine };
    expect(buildMistake(b, { kind: "machine", rule: [{ op: "+", n: 3 }, { op: "×", n: 2 }] })).toBe("order");
    expect(buildMistake(b, { kind: "machine", rule: [{ op: "+", n: 4 }] })).toBe("fitsSome"); // 1 → 5 fits, 4 → 11 does not
    expect(buildMistake(b, { kind: "machine", rule: [{ op: "+", n: 20 }] })).toBe("other");
    // An equal rule written another way is right.
    const b2 = { ...b, machine: { kind: "machine", rule: [{ op: "×", n: 2 }, { op: "+", n: 6 }] } as Machine, examples: [1, 4, 6].map((x) => ({ input: [x], output: 2 * x + 6 })) };
    const other: Machine = { kind: "machine", rule: [{ op: "+", n: 3 }, { op: "×", n: 2 }] };
    expect(buildMistake(b2, other)).toBe("right");
    expect(sameFunction(b2.machine, other)).toBe(true);
    const opBuild = { ...b, level: 3 as Level, machine: { kind: "op", op: lin(3, 1) } as Machine, examples: [[2, 5], [4, 1], [3, 3]].map(([x, y]) => ({ input: [x, y], output: 3 * x + y })) };
    expect(buildMistake(opBuild, { kind: "op", op: lin(1, 3) })).toBe("swapped");
  });

  it("names which steps a three-step order slip moved", () => {
    expect(wrongOrders(2)).toEqual([[1, 0]]);
    const orders = wrongOrders(3);
    expect(orders).toHaveLength(5);
    expect(orders[0]).toEqual([2, 1, 0]); // backwards first
    expect(orders.slice(1, 3)).toEqual(expect.arrayContaining([[1, 0, 2], [0, 2, 1]]));
    expect(swappedPair([1, 0, 2])).toEqual([0, 1]);
    expect(swappedPair([0, 2, 1])).toEqual([1, 2]);
    expect(swappedPair([1, 2, 0])).toBeNull();

    // 4 →[×2]→ 8 →[+3]→ 11 →[×3]→ 33
    const run = { level: 3 as Level, seed: 0, type: "run" as const, rule: [{ op: "×" as Op, n: 2 }, { op: "+" as Op, n: 3 }, { op: "×" as Op, n: 3 }], input: 4, answer: 33 };
    expect(machineMistake(run, 30)).toBe("order"); // ×3, +3, ×2
    expect(orderUsed(run, 30)).toEqual([2, 1, 0]);
    expect(machineMistake(run, 42)).toBe("order"); // +3, ×2, ×3: steps 1 and 2 swapped
    expect(orderUsed(run, 42)).toEqual([1, 0, 2]);
    expect(machineMistake(run, 27)).toBe("order"); // ×2, ×3, +3: steps 2 and 3 swapped
    expect(orderUsed(run, 27)).toEqual([0, 2, 1]);
    expect(machineMistake(run, 11)).toBe("stopEarly");
    expect(orderUsed(run, 33)).toBeNull();
    expect(orderUsed(run, 11)).toBeNull();

    // A reorder that is neither backwards nor one swap: 4 →[+2]→ 6 →[×3]→ 18 →[+1]→ 19.
    const odd = { ...run, rule: [{ op: "+" as Op, n: 1 }, { op: "+" as Op, n: 2 }, { op: "×" as Op, n: 3 }], answer: 21 };
    expect(machineMistake(odd, 19)).toBe("order");
    expect(orderUsed(odd, 19)).toEqual([1, 2, 0]);
  });
});

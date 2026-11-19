import { describe, expect, it } from "vitest";
import { IF_STORIES, ifOptionTag, ifStateAfter, ifSteps, makeIfThenQuestion, type IfThenQuestion, type Level, type Lit, type Rule, type Truth } from "./if-then";

const LEVELS: Level[] = [1, 2, 3];

/** Truth table written out again, independent of the generator: what is known about the target. */
function brute(rules: readonly Rule[], fact: Lit, target: number): Truth | null {
  const atoms = [...new Set([...rules.flat(), fact.atom, target])];
  const seen = new Set<boolean>();
  for (let m = 0; m < 1 << atoms.length; m++) {
    const val = (a: number) => !!((m >> atoms.indexOf(a)) & 1);
    // "If A then B" is broken only when A is true and B is not.
    if (rules.some(([a, b]) => val(a) && !val(b))) continue;
    if (val(fact.atom) !== fact.value) continue;
    seen.add(val(target));
  }
  if (!seen.size) return null;
  return seen.size === 2 ? "unknown" : seen.has(true) ? "yes" : "no";
}

/** Shortest number of arrows between two atoms, ignoring direction. */
function hops(rules: readonly Rule[], a: number, b: number): number {
  let frontier = new Set([a]);
  const seen = new Set([a]);
  for (let d = 0; frontier.size; d++) {
    if (frontier.has(b)) return d;
    const next = new Set<number>();
    for (const x of frontier)
      for (const [p, q] of rules) {
        if (p === x && !seen.has(q)) next.add(q);
        if (q === x && !seen.has(p)) next.add(p);
      }
    next.forEach((v) => seen.add(v));
    frontier = next;
  }
  return Infinity;
}

describe("if–then stories", () => {
  it("are well formed, and every prefix of arrows is connected", () => {
    for (const s of IF_STORIES) {
      for (const a of s.atoms) for (const w of [a.short, a.cond, a.yes, a.no]) expect(w.length).toBeGreaterThan(1);
      for (const [a, b] of s.edges) expect(a !== b && a < s.atoms.length && b < s.atoms.length).toBe(true);
      for (let n = 1; n <= s.edges.length; n++) {
        const pre = s.edges.slice(0, n);
        const atoms = [...new Set(pre.flat())];
        for (const t of atoms) expect(hops(pre, atoms[0], t)).toBeLessThan(Infinity);
      }
    }
  });

  it("tags the classic slips on rain → wet ground", () => {
    const r: Rule[] = [[0, 1]];
    expect(ifOptionTag(r, { atom: 1, value: true }, 0, "yes").tag).toBe("affirmConsequent");
    expect(ifOptionTag(r, { atom: 0, value: false }, 1, "no").tag).toBe("denyAntecedent");
    expect(ifOptionTag(r, { atom: 1, value: false }, 0, "unknown").tag).toBe("missedTollens");
    expect(ifOptionTag(r, { atom: 0, value: true }, 1, "unknown").tag).toBe("missedPonens");
    expect(ifOptionTag(r, { atom: 1, value: false }, 0, "yes").tag).toBe("opposite");
    expect(ifOptionTag(r, { atom: 1, value: true }, 0, "no").tag).toBe("unsupported");
    // Rain → wet ← sprinkler: it rains, so the sprinkler is on? The second arrow read backwards.
    const join: Rule[] = [
      [0, 1],
      [3, 1],
    ];
    expect(ifOptionTag(join, { atom: 0, value: true }, 3, "yes")).toEqual({ tag: "reversedChain", flipped: 1 });
    expect(ifOptionTag(join, { atom: 0, value: true }, 3, "unknown").tag).toBe("right");
  });
});

describe("if–then questions", () => {
  it("is the same for the same seed", () => {
    for (const l of LEVELS) expect(makeIfThenQuestion(l, 42)).toEqual(makeIfThenQuestion(l, 42));
  });

  it("has exactly one right option for 10,000 seeds of every level, and names every slip", () => {
    const fails: string[] = [];
    const tagCount: Record<string, number> = {};
    const answers: Record<string, number> = {};
    for (const level of LEVELS)
      for (let seed = 0; seed < 10_000; seed++) {
        const q: IfThenQuestion = makeIfThenQuestion(level, seed);
        const fail = (why: string) => fails.length < 20 && fails.push(`L${level} seed ${seed}: ${why}`);
        const story = IF_STORIES[q.story];
        // The arrows are the story's own.
        if (!q.rules.every(([a, b]) => story.edges.some(([x, y]) => x === a && y === b))) fail("rule not in story");
        if (new Set(q.rules.map((r) => r.join())).size !== q.rules.length) fail("repeated rule");
        if (q.fact.atom === q.target) fail("asks the fact");
        const truth = brute(q.rules, q.fact, q.target);
        if (truth === null) fail("no world fits");
        // Three options, all different, «نمی‌توان فهمید» last, and only one right by the truth table.
        if (q.options.length !== 3 || new Set(q.options).size !== 3 || q.options[2] !== "unknown") fail("options");
        if (q.options.filter((o) => o === truth).length !== 1 || q.options[q.answer] !== truth) fail("answer");
        if (q.tags[q.answer] !== "right" || q.tags.filter((t) => t === "right").length !== 1) fail("tags");
        // Levels.
        const d = hops(q.rules, q.fact.atom, q.target);
        if (level < 3 && (q.rules.length !== 1 || d !== 1)) fail("one arrow");
        if (level === 1 && !(q.fact.value && (truth === "yes" || truth === "unknown"))) fail("level 1 case");
        if (level === 2 && !(truth === "no" || truth === "unknown")) fail("level 2 case");
        if (level === 3 && (q.rules.length < 2 || q.rules.length > 3 || d < 2 || d === Infinity)) fail("chain");
        // "Can't tell" always has a tempting slip: the fact's own value.
        if (truth === "unknown") {
          const i = q.options.indexOf(q.fact.value ? "yes" : "no");
          const want = level < 3 ? (q.fact.value ? "affirmConsequent" : "denyAntecedent") : "reversedChain";
          if (q.tags[i] !== want || q.flipped[i] === null) fail(`slip ${q.tags[i]}`);
        }
        q.tags.forEach((t, i) => {
          tagCount[t] = (tagCount[t] ?? 0) + 1;
          if ((t === "affirmConsequent" || t === "denyAntecedent" || t === "reversedChain") !== (q.flipped[i] !== null)) fail("flipped");
        });
        answers[`${level}${truth}`] = (answers[`${level}${truth}`] ?? 0) + 1;
        // Show me: only sound moves, ending on the answer.
        const steps = ifSteps(q);
        const st = ifStateAfter(q, steps, steps.length);
        for (const s of steps)
          if (s.kind === "move") {
            const [a, b] = q.rules[s.move.rule];
            const ok =
              (s.move.kind === "ponens" && s.move.from.atom === a && s.move.from.value && s.move.to.atom === b && s.move.to.value) ||
              (s.move.kind === "tollens" && s.move.from.atom === b && !s.move.from.value && s.move.to.atom === a && !s.move.to.value);
            if (!ok) fail("unsound step");
            if (brute(q.rules, q.fact, s.move.to.atom) !== (s.move.to.value ? "yes" : "no")) fail("step not forced");
          }
        const last = steps[steps.length - 1];
        if (last.kind !== "end" || last.truth !== truth) fail("last step");
        if (st.arrows.size !== q.rules.length) fail("arrows");
        const shown = st.values.get(q.target);
        if (truth === "unknown" ? shown !== undefined : shown !== (truth === "yes")) fail("target on diagram");
      }
    expect(fails).toEqual([]);
    for (const t of ["affirmConsequent", "denyAntecedent", "reversedChain", "missedTollens", "missedPonens", "opposite", "unsupported"]) expect(tagCount[t]).toBeGreaterThan(100);
    // Every level mixes its answers.
    for (const k of ["1yes", "1unknown", "2no", "2unknown", "3yes", "3no", "3unknown"]) expect(answers[k]).toBeGreaterThan(1500);
  }, 240_000);
});

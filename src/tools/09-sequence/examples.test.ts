import { describe, expect, it } from "vitest";
import { cycleSlips, divide, makeCycleQuestion } from "@/generators/cycle";
import { makeNthQuestion, nthMistake, PATTERNS } from "@/generators/nth-term";
import { makeSequenceQuestion, sequenceMistake, type Level, type SequenceTag } from "@/generators/sequence";
import { decodeBuild } from "./build";
import { SEQUENCE_GUIDE } from "./guide";
import { SEQ_TYPE_LABEL, type SeqTryType } from "./SequenceTryPanel";

// Rebuilds every hand-picked example the way the tool's hash reader does.
const examples = SEQUENCE_GUIDE.examples ?? [];
const params = (hash: string) => new URLSearchParams(hash);
const build = (hash: string) => {
  const p = params(hash);
  const type = p.get("try") as SeqTryType;
  expect(type in SEQ_TYPE_LABEL).toBe(true);
  const level = Number(p.get("level")) as Level;
  expect([1, 2, 3]).toContain(level);
  const seed = Number(p.get("seed"));
  if (type === "cycle") return makeCycleQuestion(level, seed);
  if (type === "nth") return makeNthQuestion(level, seed);
  return makeSequenceQuestion(type, level, seed, { blank: "auto", big: p.get("big") === "1" });
};
const byFor = (i: number) => build(examples.find((ex) => ex.for === i)!.hash);

/** Some wrong number on the pad carries this slip. */
const hasSlip = (q: ReturnType<typeof build>, tag: SequenceTag) => {
  if (q.type === "cycle" || q.type === "nth") return false;
  const lo = q.letters ? 1 : -200;
  const hi = q.letters ? 32 : 10_000;
  for (let v = lo; v <= hi; v++) if (sequenceMistake(q, v) === tag) return true;
  return false;
};

describe("sequence hand-picked examples", () => {
  it("every try link builds its question", () => {
    for (const ex of examples.filter((e) => e.hash.startsWith("try="))) expect(build(ex.hash)).toBeTruthy();
  });

  it("show and explore links parse", () => {
    for (const ex of examples.filter((e) => !e.hash.startsWith("try="))) {
      const p = params(ex.hash);
      const show = p.get("show") ?? p.get("build");
      if (show === null || show === "nth" || show === "cycle") continue;
      expect(decodeBuild(show, p)).not.toBeNull();
    }
  });

  it("the picked scenes carry the targeted slip", () => {
    const geo = byFor(0);
    expect(geo.type === "geometric" && hasSlip(geo, "sameDiff")).toBe(true);
    const alt = byFor(1);
    expect(alt.type === "alternate" && hasSlip(alt, "wrongStrand")).toBe(true);
    const sum2 = byFor(2);
    expect(sum2.type === "additive" && hasSlip(sum2, "double")).toBe(true);
    const letters = byFor(3);
    expect(letters.type === "letters" && hasSlip(letters, "offByOne")).toBe(true);
    // The answer is گ, one of the letters most often skipped.
    if (letters.type === "letters") expect(letters.answer).toBe(26);

    const zero = byFor(4);
    if (zero.type !== "cycle") throw new Error("expected a cycle question");
    expect(divide(zero).rem).toBe(0);
    expect(cycleSlips(zero).some(([t, v]) => t === "zeroFirst" && v !== zero.answer)).toBe(true);
    const prefix = byFor(5);
    if (prefix.type !== "cycle") throw new Error("expected a cycle question");
    expect(prefix.variant).toBe("prefix");
    expect(cycleSlips(prefix).some(([t, v]) => t === "prefix" && v !== prefix.answer)).toBe(true);

    const far = byFor(6);
    if (far.type !== "nth") throw new Error("expected an nth question");
    expect(far.variant).toBe("far");
    expect(nthMistake(far, far.first + far.n * far.step)).toBe("nJumps");
    const which = byFor(7);
    if (which.type !== "nth") throw new Error("expected an nth question");
    expect(which.variant).toBe("which");
    expect(nthMistake(which, which.n - 1)).toBe("reverseOff");
  });

  it("the matchstick scene is the squares pattern", () => {
    const q = build("try=nth&level=2&seed=6");
    expect(q.type === "nth" && q.pattern === "squares" && q.first === PATTERNS.squares.first).toBe(true);
  });
});

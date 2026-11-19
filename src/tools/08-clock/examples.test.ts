import { describe, expect, it } from "vitest";
import { isLeapYear, makeClockQuestion, slips, wrap, wrap7, type ClockQuestionType, type ClockTag, type Level } from "@/generators/clock";
import { CLOCK_GUIDE } from "./guide";
import { CLOCK_TYPE_LABEL } from "./ClockTryPanel";

// Rebuilds every hand-picked example the way the tool's hash reader does.
const examples = CLOCK_GUIDE.examples ?? [];
const build = (hash: string) => {
  const p = new URLSearchParams(hash);
  const type = p.get("try") as ClockQuestionType;
  expect(type in CLOCK_TYPE_LABEL).toBe(true);
  const level = Number(p.get("level")) as Level;
  expect([1, 2, 3]).toContain(level);
  return makeClockQuestion(type, level, Number(p.get("seed")));
};
const byFor = (i: number) => build(examples.find((ex) => ex.for === i)!.hash);

/** The slip's value, when it differs from the right answer (so the trap is a real wrong answer). */
const trap = (q: ReturnType<typeof build>, tag: ClockTag) => {
  const norm = (v: number) => (q.type === "weekday" || q.type === "month" ? wrap7(v) : q.type === "angle" ? v : wrap(v));
  return slips(q).find(([t, v]) => t === tag && norm(v) !== norm(q.answer));
};

describe("clock hand-picked examples", () => {
  it("every try link builds its question", () => {
    for (const ex of examples.filter((e) => e.hash.startsWith("try="))) expect(build(ex.hash)).toBeTruthy();
  });

  it("show links name the clock or the calendar", () => {
    for (const ex of examples.filter((e) => e.hash.startsWith("show="))) {
      const [kind, ...rest] = new URLSearchParams(ex.hash).get("show")!.split("-");
      expect(["clock", "cal"]).toContain(kind);
      for (const x of rest) expect(Number.isInteger(Number(x))).toBe(true);
    }
  });

  it("the picked scenes carry the targeted slip", () => {
    expect(trap(byFor(0), "hourStill")).toBeTruthy();
    const mirror = byFor(1);
    expect(trap(mirror, "hourOnly") && trap(mirror, "minuteOnly")).toBeTruthy();
    expect(trap(byFor(2), "noCarry")).toBeTruthy();
    const month = byFor(3);
    expect(trap(month, "assume30") && trap(month, "offByOne")).toBeTruthy();
    const esfand = byFor(4);
    expect(esfand.type === "month" && esfand.year !== undefined && isLeapYear(esfand.year)).toBe(true);
    expect(trap(esfand, "esfand")).toBeTruthy();
  });
});

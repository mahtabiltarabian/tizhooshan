import { describe, expect, it } from "vitest";
import {
  angleBetween,
  answerKind,
  clockMistake,
  dateOf,
  dayOfYear,
  handAngles,
  hm,
  makeClockQuestion,
  mirrorOf,
  MONTHS,
  slips,
  wrap,
  type ClockQuestionType,
  type Level,
} from "./clock";

const TYPES: ClockQuestionType[] = ["angle", "mirror", "elapsed", "drift", "weekday", "month"];
const LEVELS: Level[] = [1, 2, 3];
const at = (h: number, m: number) => (h % 12) * 60 + m;

describe("clock arithmetic", () => {
  it("moves the minute hand 6° and the hour hand 0.5° a minute", () => {
    expect(handAngles(at(3, 0))).toEqual({ hour: 90, minute: 0 });
    expect(handAngles(at(3, 30))).toEqual({ hour: 105, minute: 180 });
    expect(handAngles(at(12, 59)).minute).toBe(354);
  });

  it("knows the angle between the hands", () => {
    expect(angleBetween(at(3, 0))).toBe(90);
    expect(angleBetween(at(3, 30))).toBe(75);
    expect(angleBetween(at(9, 0))).toBe(90);
    expect(angleBetween(at(6, 0))).toBe(180);
    expect(angleBetween(at(2, 20))).toBe(50);
    expect(angleBetween(at(10, 10))).toBe(115);
  });

  it("reads a clock in a mirror", () => {
    expect(hm(mirrorOf(at(3, 0)))).toEqual({ h: 9, m: 0 });
    expect(hm(mirrorOf(at(4, 20)))).toEqual({ h: 7, m: 40 });
    expect(hm(mirrorOf(at(12, 0)))).toEqual({ h: 12, m: 0 });
    // A mirror twice gives the time back.
    for (let t = 0; t < 720; t++) expect(mirrorOf(mirrorOf(t))).toBe(t);
  });

  it("has a 365-day year and finds dates", () => {
    expect(MONTHS.reduce((s, m) => s + m.days, 0)).toBe(365);
    expect(dayOfYear(0, 1)).toBe(0);
    expect(dayOfYear(6, 1)).toBe(186);
    for (let doy = 0; doy < 365; doy++) {
      const { m, d } = dateOf(doy);
      expect(dayOfYear(m, d)).toBe(doy);
    }
  });
});

describe("clock questions", () => {
  it("is the same for the same seed", () => {
    for (const t of TYPES) for (const l of LEVELS) expect(makeClockQuestion(t, l, 42)).toEqual(makeClockQuestion(t, l, 42));
  });

  it("gives a sound question for 10,000 seeds of every type and level", () => {
    for (const type of TYPES)
      for (const level of LEVELS)
        for (let seed = 0; seed < 10_000; seed++) {
          const q = makeClockQuestion(type, level, seed);
          expect(clockMistake(q, q.answer)).toBe("right");
          const kind = answerKind(type);
          if (kind === "time") expect(q.answer).toBe(wrap(q.answer));
          if (kind === "day") expect(q.answer >= 0 && q.answer < 7).toBe(true);
          // No slip may be the right answer and still count as a slip.
          for (const [, v] of slips(q)) if (clockMistake(q, v) !== "right") expect(clockMistake(q, v)).not.toBe("other");

          switch (q.type) {
            case "angle": {
              const { m } = hm(q.time);
              expect(Number.isInteger(q.answer)).toBe(true);
              expect(q.answer).toBeGreaterThan(0);
              expect(q.answer).toBeLessThanOrEqual(180);
              if (level === 1) expect([0, 30]).toContain(m);
              if (level === 2) expect(m % 10).toBe(0);
              break;
            }
            case "mirror":
              expect(q.answer).not.toBe(q.shown);
              expect(mirrorOf(q.answer)).toBe(q.shown);
              if (level === 1) expect(q.shown % 30).toBe(0);
              if (level === 2) expect(q.shown % 5).toBe(0);
              break;
            case "elapsed": {
              expect(q.minutes).toBeGreaterThan(0);
              if (level === 1) expect(q.back).toBe(false);
              // Step minute by minute and land on the answer.
              let t = q.start;
              for (let i = 0; i < q.minutes; i++) t += q.back ? -1 : 1;
              expect(wrap(t)).toBe(q.answer);
              break;
            }
            case "drift":
              expect(q.variant).toBe(level === 1 ? "offset" : level === 2 ? "perDay" : "perHour");
              break;
            case "weekday": {
              let d = q.start;
              for (let i = 0; i < q.days; i++) d = (d + (q.back ? 6 : 1)) % 7;
              expect(d).toBe(q.answer);
              if (level === 3) expect(q.days).toBeGreaterThanOrEqual(100);
              break;
            }
            case "month": {
              expect(q.days).toBeGreaterThan(0);
              expect(q.to.d).toBeLessThanOrEqual(MONTHS[q.to.m].days);
              expect(q.to.m - q.from.m).toBe(level === 1 ? 0 : level === 2 ? 1 : q.to.m - q.from.m);
              if (level === 3) expect(q.to.m - q.from.m).toBeGreaterThanOrEqual(2);
              // Walk the calendar day by day.
              let w = q.weekday;
              let { m, d } = q.from;
              while (m !== q.to.m || d !== q.to.d) {
                d++;
                if (d > MONTHS[m].days) [m, d] = [m + 1, 1];
                w = (w + 1) % 7;
              }
              expect(w).toBe(q.answer);
              break;
            }
          }
        }
  }, 240_000);

  it("names the usual slips", () => {
    const angle = { type: "angle", level: 1, seed: 0, time: 0, answer: 0 } as const;
    expect(clockMistake({ ...angle, time: at(3, 30), answer: 75 }, 90)).toBe("hourStill");
    expect(clockMistake({ ...angle, time: at(3, 30), answer: 75 }, 285)).toBe("reflex");

    const mirror = { ...makeClockQuestion("mirror", 2, 1), shown: at(4, 20), answer: at(7, 40) } as const;
    expect(clockMistake(mirror, at(4, 20))).toBe("same");
    expect(clockMistake(mirror, at(8, 20))).toBe("hourOnly");
    expect(clockMistake(mirror, at(4, 40))).toBe("minuteOnly");

    const elapsed = { type: "elapsed", level: 2, seed: 0, start: at(8, 45), minutes: 95, back: false, answer: at(10, 20) } as const;
    expect(clockMistake(elapsed, at(9, 20))).toBe("noCarry");
    expect(clockMistake(elapsed, at(7, 10))).toBe("wrongWay");

    const week = { type: "weekday", level: 3, seed: 0, start: 3, days: 100, back: false, answer: 5 } as const;
    expect(clockMistake(week, 4)).toBe("offByOne");
    expect(clockMistake(week, 1)).toBe("wrongWay");

    // 10 Farvardin to 5 Ordibehesht: 26 days, not 25.
    const month = { type: "month", level: 2, seed: 0, from: { m: 0, d: 10 }, to: { m: 1, d: 5 }, weekday: 0, days: 26, answer: 5 } as const;
    expect(clockMistake(month, 4)).toBe("assume30");
  });
});

import { describe, expect, it } from "vitest";
import { CATALOG } from "./catalog";
import {
  buckets,
  dateText,
  durationText,
  highlights,
  persianDate,
  rangeOf,
  toolRows,
  totals,
} from "./profile";
import { dayNumber } from "./rewards";
import { DAY, type Attempt } from "./types";

// Noon local time, so the local day never depends on the time zone.
const at = (y: number, m: number, d: number) =>
  new Date(y, m - 1, d, 12).getTime();
const NOW = at(2026, 11, 22); // 1 Azar 1405, a Sunday

let n = 0;
const attempt = (over: Partial<Attempt> = {}): Attempt => ({
  id: `a${n++}`,
  childId: "c1",
  tool: "clock",
  type: "angle",
  level: 1,
  seed: 1,
  generatorVersion: "clock@1",
  response: 0,
  tag: "right",
  score: 1,
  hintsUsed: 0,
  durationMs: 60_000,
  mode: "practice",
  createdAt: NOW,
  ...over,
});

describe("Persian calendar", () => {
  it("converts local days", () => {
    expect(persianDate(dayNumber(at(2026, 3, 21)))).toEqual({
      y: 1405,
      m: 1,
      d: 1,
    });
    expect(persianDate(dayNumber(NOW))).toEqual({ y: 1405, m: 9, d: 1 });
    expect(dateText(dayNumber(NOW))).toBe("۱ آذر ۱۴۰۵");
  });
});

describe("buckets", () => {
  const list = [
    attempt({ createdAt: NOW }),
    attempt({ createdAt: NOW, tag: "wrongWay", durationMs: 30 * 60_000 }), // counted as 10 minutes
    attempt({ createdAt: NOW - DAY }),
    attempt({ createdAt: NOW - 40 * DAY }),
    attempt({ createdAt: NOW - 400 * DAY }),
  ];
  const start = NOW - 400 * DAY;

  it("by day: the last 14 days, today last", () => {
    const b = buckets(list, "day", NOW, start);
    expect(b).toHaveLength(14);
    expect(b[13]).toMatchObject({
      label: "۱",
      sub: "آذر",
      right: 1,
      wrong: 1,
      minutes: 11,
      days: 1,
    });
    expect(b[12]).toMatchObject({ label: "۳۰", right: 1, minutes: 1 });
    expect(b[0].sub).toBe("آبان");
    expect(b.reduce((s, x) => s + x.right + x.wrong, 0)).toBe(3);
  });

  it("by week: Saturday to Friday", () => {
    const b = buckets(list, "week", NOW, start);
    expect(b).toHaveLength(12);
    // 22 Nov 2026 is a Sunday: its week began on Saturday 21 Nov (30 Aban), and 21 Nov is in it too.
    expect(b[11]).toMatchObject({ label: "۳۰", right: 2, wrong: 1, days: 2 });
  });

  it("by month and by year, in the Persian calendar", () => {
    const m = buckets(list, "month", NOW, start);
    expect(m).toHaveLength(12);
    expect(m[11]).toMatchObject({ label: "آذر", right: 1, wrong: 1 });
    expect(m[10]).toMatchObject({ label: "آبان", right: 1 });
    expect(m[9]).toMatchObject({ label: "مهر", right: 1 });
    const y = buckets(list, "year", NOW, start);
    expect(y.map((b) => b.label)).toEqual(["۱۴۰۴", "۱۴۰۵"]);
    expect(y.map((b) => b.right + b.wrong)).toEqual([1, 4]);
  });

  it("the range keeps only the days its chart shows", () => {
    const inRange = rangeOf("day", buckets(list, "day", NOW, start));
    expect(inRange(dayNumber(NOW))).toBe(true);
    expect(inRange(dayNumber(NOW - 40 * DAY))).toBe(false);
  });
});

describe("totals", () => {
  it("counts since the first answer or the profile, whichever is first", () => {
    const t = totals(
      [
        attempt({ createdAt: NOW - 2 * DAY }),
        attempt({ hintsUsed: 2 }),
        attempt({ tag: "other" }),
      ],
      NOW - DAY,
      NOW,
    );
    expect(t).toMatchObject({
      sinceDays: 3,
      daysPracticed: 2,
      questions: 3,
      right: 2,
      rightAlone: 1,
      hintsUsed: 1,
      minutes: 3,
    });
    expect(t.bestDay).toEqual({ day: dayNumber(NOW), minutes: 2 });
    expect(t.favouriteHour).toBeNull(); // fewer than 5 answers
  });
});

describe("tools and parts", () => {
  const clock = CATALOG.find((t) => t.tool === "clock")!;
  const list = [
    attempt({ type: clock.types[0].key }),
    attempt({ type: clock.types[0].key, tag: "wrongWay" }),
    attempt({ type: clock.types[1].key, createdAt: NOW - 60 * DAY }),
  ];

  it("shows every tool, the parts tried ever and the counts in the range", () => {
    const rows = toolRows(list, [], (d) => d > dayNumber(NOW) - 14);
    expect(rows).toHaveLength(CATALOG.length);
    const c = rows.find((r) => r.tool === "clock")!;
    expect(c).toMatchObject({ right: 1, wrong: 1, tried: 2 });
    expect(c.parts[0]).toMatchObject({ right: 1, wrong: 1 });
    expect(c.parts[1]).toMatchObject({
      right: 0,
      wrong: 0,
      lastDay: dayNumber(NOW - 60 * DAY),
    });
    expect(c.parts[1].stage).not.toBeNull();
    expect(c.parts.slice(2).every((p) => p.stage === null)).toBe(true);
  });

  it("names strong parts and parts to practise, with at least 3 answers", () => {
    const many = [
      ...Array.from({ length: 4 }, () => attempt({ type: clock.types[0].key })),
      ...Array.from({ length: 3 }, () =>
        attempt({ type: clock.types[1].key, tag: "wrongWay" }),
      ),
      attempt({ type: clock.types[2].key, tag: "wrongWay" }),
    ];
    const h = highlights(toolRows(many, [], () => true));
    expect(h.strong).toHaveLength(1);
    expect(h.strong[0]).toMatchObject({ right: 4, total: 4 });
    expect(h.practice).toHaveLength(1);
    expect(h.practice[0]).toMatchObject({ right: 0, total: 3 });
  });
});

describe("durationText", () => {
  it("reads as words", () => {
    expect(durationText(45)).toBe("۴۵ دقیقه");
    expect(durationText(120)).toBe("۲ ساعت");
    expect(durationText(135.4)).toBe("۲ ساعت و ۱۵ دقیقه");
  });
});

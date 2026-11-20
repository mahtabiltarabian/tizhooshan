// The parent report (plan v2, section 7.4): for each skill one of five
// stages, the weekly trend, and the two most frequent mistakes in plain
// words. No IQ, no pass rate, no ability numbers.

import { stageOf, type Stage } from "./adaptive";
import { catalogTool, tagText, toolArea, toolTitle, typeLabel } from "./catalog";
import { dayNumber } from "./rewards";
import { splitSkill, type Attempt, type SkillState } from "./types";
import type { Area } from "@/tools/registry";

export type Trend = "up" | "same" | "down" | "new";

export interface SkillRow {
  skill: string;
  tool: string;
  title: string;
  stage: Stage;
  answers: number;
  trend: Trend;
}

export interface ReportData {
  areas: { area: Area; skills: SkillRow[] }[];
  /** The two most frequent mistakes of the last 4 weeks, in plain words. */
  mistakes: { text: string; tool: string; count: number }[];
  /** Minutes on each of the last 7 days, oldest first. */
  week: { day: number; minutes: number }[];
  answersThisWeek: number;
  rightThisWeek: number;
}

const AREAS: Area[] = ["visual", "computational", "logical", "speed"];

/** Average score this week against the week before; small differences count as the same. */
function trendOf(list: readonly Attempt[], today: number): Trend {
  const avg = (from: number, to: number) => {
    const xs = list.filter((a) => {
      const d = dayNumber(a.createdAt);
      return d > today - to && d <= today - from;
    });
    return xs.length >= 3 ? xs.reduce((s, a) => s + a.score, 0) / xs.length : null;
  };
  const now = avg(0, 7);
  const before = avg(7, 14);
  if (now === null || before === null) return "new";
  return now - before > 0.1 ? "up" : before - now > 0.1 ? "down" : "same";
}

export function buildReport(attempts: readonly Attempt[], skills: readonly SkillState[], now: number): ReportData {
  const today = dayNumber(now);
  const practiced = attempts;
  const rows: SkillRow[] = skills
    .filter((s) => catalogTool(splitSkill(s.skill).tool))
    .map((s) => {
      const { tool, type } = splitSkill(s.skill);
      const mine = practiced.filter((a) => a.tool === tool && a.type === type);
      return { skill: s.skill, tool, title: `${toolTitle(tool)} · ${typeLabel(tool, type)}`, stage: stageOf(s.theta, s.n), answers: mine.length, trend: trendOf(mine, today) };
    })
    .sort((a, b) => b.answers - a.answers);

  const recent = practiced.filter((a) => dayNumber(a.createdAt) > today - 28 && a.tag !== "right" && a.tag !== "other");
  const counts = new Map<string, { tool: string; tag: string; count: number }>();
  for (const a of recent) {
    const key = `${a.tool}:${a.tag}`;
    const cur = counts.get(key) ?? { tool: a.tool, tag: a.tag, count: 0 };
    counts.set(key, { ...cur, count: cur.count + 1 });
  }
  const mistakes = [...counts.values()]
    .filter((m) => m.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
    .map((m) => ({ text: tagText(m.tool, m.tag), tool: toolTitle(m.tool), count: m.count }));

  const week = Array.from({ length: 7 }, (_, i) => {
    const day = today - 6 + i;
    const ms = attempts.filter((a) => dayNumber(a.createdAt) === day).reduce((s, a) => s + Math.min(a.durationMs, 10 * 60_000), 0);
    return { day, minutes: Math.round(ms / 60_000) };
  });
  const thisWeek = practiced.filter((a) => dayNumber(a.createdAt) > today - 7);

  return {
    areas: AREAS.map((area) => ({ area, skills: rows.filter((r) => toolArea(r.tool) === area) })).filter((a) => a.skills.length),
    mistakes,
    week,
    answersThisWeek: thisWeek.length,
    rightThisWeek: thisWeek.filter((a) => a.tag === "right").length,
  };
}

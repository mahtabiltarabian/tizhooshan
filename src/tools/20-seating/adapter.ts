// Tool 20 in practice sessions: grading and three-step hints (the light
// data, types and tag words, is in practice.ts).
// The response is what the panel checks: for a whole arrangement, the seat
// of each person ([seat of person 0, seat of person 1, …], seats from 0 as
// in the generator); for a one-person question, that person's index in the
// names; for a family tree, the chosen option's index (the seed fixes the
// order).

import { askMistake, condPeople, makeSeatingQuestion, placeMistake, type Level, type SeatingQuestion, type SeatingType } from "@/generators/seating";
import type { ToolAdapter } from "@/practice/adapter";
import { SEATING_PRACTICE } from "./practice";
import { condText, factText } from "./text";

const make = (type: string, level: number, seed: number) => makeSeatingQuestion(type as SeatingType, level as Level, seed);

const index = (r: unknown, n: number): r is number => typeof r === "number" && Number.isInteger(r) && r >= 0 && r < n;

function grade(type: string, level: number, seed: number, response: unknown): string {
  const q = make(type, level, seed);
  if (q.type === "family") return index(response, q.options.length) ? q.options[response].tag : "other";
  if (q.variant === "ask") return index(response, q.n) ? askMistake(q, response) : "other";
  // A whole arrangement: every person in a different seat.
  if (!Array.isArray(response) || response.length !== q.n || !response.every((s) => index(s, q.n)) || new Set(response).size !== q.n) return "other";
  return placeMistake(q, response).tag;
}

const NUDGE: Record<SeatingType, string> = {
  queue: "صف را روی کاغذ بکش: از اول صف تا آخر.",
  rank: "یک ردیف بکش، از بیشترین تا کمترین.",
  floors: "ساختمان را بکش، از طبقه پایین تا بالا.",
  round: "میز گرد را بکش؛ همه رو به وسط میز نشسته‌اند.",
  rect: "میز را با دو ردیف صندلی روبه‌روی هم بکش.",
  family: "شکل خانواده را بکش: هر نسل در یک ردیف، زن و شوهر کنار هم.",
};

const SEATS_RULE = "اول شرط‌هایی را به کار ببر که جای یک نفر را دقیق می‌گویند، بعد «کنار هم» و «فاصله» را؛ هر حالتی را که با یک شرط جور نیست خط بزن.";
const RULE: Record<SeatingType, string> = {
  queue: SEATS_RULE,
  rank: SEATS_RULE,
  floors: `${SEATS_RULE} طبقه‌ها از پایین شمرده می‌شوند.`,
  round: `${SEATS_RULE} راست و چپ هر کس از نگاه خود اوست، رو به میز.`,
  rect: `${SEATS_RULE} راست و چپ هر کس از نگاه خود اوست، رو به میز.`,
  family: "عمو و عمه از طرف پدرند و دایی و خاله از طرف مادر؛ «الف چه نسبتی با ب دارد؟» یعنی الف برای ب چه کسی است.",
};

function firstStep(q: SeatingQuestion): string {
  const s = "گام اول: ";
  if (q.type === "family") {
    // A fact that is not about the asked pair and does not say the answer's word, so the step cannot be read as the answer.
    const pair = q.ask.k === "rel" ? [q.ask.x, q.ask.y] : [q.options[q.answer].person, q.ask.y];
    const answer = ` ${q.options[q.answer].text} `;
    const f = q.facts.find((x) => !(pair.includes(x.a) && pair.includes(x.b)) && !` ${factText(q, x).replace(/[.،«»]/g, " ")} `.includes(answer));
    return f ? `${s}از این جمله شروع کن: «${factText(q, f)}» این دو نفر را روی شکل بگذار.` : `${s}هر جمله را روی شکل خانواده بگذار: هر نسل در یک ردیف.`;
  }
  // The "show me" order; for a one-person question, a condition not about that person.
  const c = q.variant === "ask" ? q.conds.find((x) => !condPeople(x).includes(q.answer)) : q.conds[0];
  return c ? `${s}از این شرط شروع کن: «${condText(q, c)}» حالت‌هایی را که با آن جور نیستند خط بزن.` : `${s}شرط‌ها را یکی‌یکی روی شکل امتحان کن.`;
}

export const SEATING_ADAPTER: ToolAdapter = {
  ...SEATING_PRACTICE,
  version: "seating@1",
  grade,
  hints: (type, level, seed) => [NUDGE[type as SeatingType], RULE[type as SeatingType], firstStep(make(type, level, seed))],
};

// Tool 19 in practice sessions: grading and three-step hints (the light
// data, types and tag words, is in practice.ts).
// The response is what the panel checks:
//  - grid: the marks, one per cell row by row (1 ✓, -1 ✗, 0 empty);
//  - liars: one boolean per person, true for a liar;
//  - venn, ifThen: the index of the chosen option (the seed fixes the order);
//  - vennNum: the number typed.
// The grid is the page's default: the level's own size, no extra clues.

import { IF_STORIES } from "@/generators/if-then";
import { CREATURES, gridCheck, liarSteps, liarsMistake, makeLogicQuestion, type LogicQuestion, type LogicType, type Level } from "@/generators/logic";
import { countMistake } from "@/generators/venn-count";
import type { ToolAdapter } from "@/practice/adapter";
import { fa } from "@/tools/registry";
import { LOGIC_PRACTICE } from "./practice";

const make = (type: string, level: number, seed: number) => makeLogicQuestion(type as LogicType, level as Level, seed);

function grade(type: string, level: number, seed: number, response: unknown): string {
  const q = make(type, level, seed);
  const r = response;
  switch (q.type) {
    case "grid":
      return Array.isArray(r) && r.length === q.size * q.size && r.every((m) => m === 1 || m === -1 || m === 0) ? gridCheck(q, r).tag : "other";
    case "liars":
      return Array.isArray(r) && r.length === q.people.length && r.every((x) => typeof x === "boolean") ? liarsMistake(q, r).tag : "other";
    case "vennNum":
      return typeof r === "number" && Number.isFinite(r) ? countMistake(q, r) : "other";
    case "venn":
    case "ifThen":
      return typeof r === "number" && Number.isInteger(r) && r >= 0 && r < q.tags.length ? q.tags[r] : "other";
  }
}

const NUDGE: Record<LogicType, string> = {
  grid: "هر نفر دقیقاً یک چیز دارد و هر چیز مال دقیقاً یک نفر است.",
  liars: "فرض کن یک نفر راستگو است و ببین حرفش درباره بقیه چه می‌گوید.",
  venn: "هر جمله را روی نمودار ون بکش: بخش‌های خالی را هاشور بزن.",
  vennNum: "از بخشی شروع کن که عددش را مستقیم می‌دانی.",
  ifThen: "هر جمله «اگر… آنگاه» یک پیکان یک‌طرفه است.",
};

const RULE: Record<LogicType, string> = {
  grid: "سرنخ‌های «نه» را با ✗ بزن؛ وقتی در یک سطر فقط یک خانه خالی ماند، همان ✓ است و بقیه ستونش ✗.",
  liars: "راستگو همیشه راست می‌گوید و دروغگو همیشه دروغ؛ اگر یک فرض به تناقض رسید، برعکس آن درست است.",
  venn: "«همه» یعنی بخشی خالی است و «بعضی» یعنی دست‌کم یکی هست؛ نتیجه‌ای درست است که در هر شکلِ جور با جمله‌ها درست باشد.",
  vennNum: "کسی که در دو دایره است در جمع دو دایره دو بار شمرده می‌شود؛ کل کلاس = داخل دایره‌ها + بیرون آن‌ها.",
  ifThen: "«درست» در جهت پیکان جلو می‌رود و «نادرست» برعکس پیکان برمی‌گردد؛ بقیه حالت‌ها را نمی‌توان فهمید.",
};

function firstStep(q: LogicQuestion): string {
  const s = "گام اول: ";
  switch (q.type) {
    case "grid": {
      // A "no" first: it only crosses out, so it is the safest start.
      let k = q.clues.findIndex((c) => c.kind === "no" || c.kind === "nor");
      if (k < 0) k = 0;
      const c = q.clues[k];
      const n = fa(k + 1);
      if (c.kind === "yes") return `${s}سرنخ ${n} یک خانه را حتماً ✓ می‌کند؛ بعد بقیه سطر و ستون آن خانه ✗ می‌شوند.`;
      if (c.kind === "or" || c.kind === "either") return `${s}سرنخ ${n} می‌گوید جواب یکی از دو خانه است؛ بقیه خانه‌های آن ستون یا سطر را ✗ بزن.`;
      return `${s}سرنخ ${n} یک «نه» دارد؛ خانه‌ای را که می‌گوید با ✗ بزن.`;
    }
    case "liars": {
      const st = liarSteps(q)[0];
      if (st?.kind === "assume") return `${s}فرض کن ${q.people[st.who]} ${st.liar ? "دروغگو" : "راستگو"} است و ببین حرفش درباره بقیه چه می‌گوید.`;
      if (st?.kind === "force") return `${s}از حرف ${q.people[st.by]} شروع کن: آیا یک راستگو می‌تواند این را بگوید؟ یک دروغگو چطور؟`;
      return `${s}از اولین کسی شروع کن که درباره دیگران حرف زده.`;
    }
    case "venn": {
      const p = q.premises[0];
      const names = [p.a, p.b].map((i) => `«${CREATURES[q.terms[i]]}»`).join(" و ");
      return q.level === 3
        ? `${s}اول دو جمله‌ای را که گروه مشترک دارند با هم روی نمودار بکش؛ مثلاً جمله ${names}.`
        : `${s}جمله درباره ${names} را روی نمودار بکش و ببین کدام بخش خالی می‌شود.`;
    }
    case "vennNum":
      if (q.extreme === "minBoth") return `${s}اگر دو گروه هیچ اشتراکی نداشتند، چند نفر لازم بود؟ با تعداد کل کلاس مقایسه کن.`;
      if (q.extreme) return `${s}بخش مشترک نمی‌تواند از دایره کوچک‌تر بزرگ‌تر باشد؛ از همین شروع کن.`;
      return q.k === 3 ? `${s}عدد بخش وسط (هر سه) را اول بنویس و از آنجا به بیرون برو.` : `${s}اول عدد بخش مشترک دو دایره را پیدا کن؛ اگر معلوم نیست، از کل و بیرون دایره‌ها شروع کن.`;
    case "ifThen": {
      const a = IF_STORIES[q.story].atoms;
      const fact = q.fact.value ? a[q.fact.atom].yes : a[q.fact.atom].no;
      return `${s}از «${fact}» شروع کن و ${q.fact.value ? "در جهت پیکان‌ها جلو برو" : "برعکس پیکان‌ها برگرد"}؛ ببین به «${a[q.target].short}» می‌رسی یا نه.`;
    }
  }
}

/** Number tokens of a text. */
const tokens = (t: string): string[] => t.match(/[0-9۰-۹]+/g) ?? [];

function hints(type: string, level: number, seed: number): [string, string, string] {
  const q = make(type, level, seed);
  const step = firstStep(q);
  // Only "vennNum" has a number answer; a clue number could equal it.
  const safe = q.type === "vennNum" && tokens(step).includes(fa(q.answer)) ? "گام اول: عددهای سؤال را روی بخش‌های نمودار بنویس." : step;
  return [NUDGE[type as LogicType], RULE[type as LogicType], safe];
}

export const LOGIC_ADAPTER: ToolAdapter = {
  ...LOGIC_PRACTICE,
  version: "logic@1",
  grade,
  hints,
};

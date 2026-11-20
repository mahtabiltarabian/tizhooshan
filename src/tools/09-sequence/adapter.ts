// Tool 9 in practice sessions: grading and three-step hints (the light
// data, types and tag words, is in practice.ts).
// The response is the number the panel checks: the missing term (for letter
// sequences its place in the alphabet, ا = 1), for "cycle" a symbol id or a
// count, for "nth" a number or, for a rule, ruleValue(coefficient, constant).
// Practice questions use the default gap and small numbers (blank "auto").

import { cycleMistake, divide, makeCycleQuestion, type CycleQuestion } from "@/generators/cycle";
import { makeNthQuestion, nthMistake, termsOf as nthTerms, type NthQuestion } from "@/generators/nth-term";
import { letterAt, makeSequenceQuestion, sequenceMistake, type Level, type SequenceKind, type SequenceQuestion, type SequenceQuestionType } from "@/generators/sequence";
import { cycleAnswerFa, cycleHow } from "./CycleTryPanel";
import { unitOf } from "./Nth";
import { nthAnswerFa, nthHow } from "./NthTryPanel";
import type { ToolAdapter } from "@/practice/adapter";
import { ltr } from "@/practice/text";
import { fa } from "@/tools/registry";
import { SEQUENCE_PRACTICE } from "./practice";
import { answerFa, sequenceHow } from "./SequenceTryPanel";

type Q = { kind: "seq"; q: SequenceQuestion } | { kind: "cycle"; q: CycleQuestion } | { kind: "nth"; q: NthQuestion };

function make(type: string, level: number, seed: number): Q {
  const l = level as Level;
  if (type === "cycle") return { kind: "cycle", q: makeCycleQuestion(l, seed) };
  if (type === "nth") return { kind: "nth", q: makeNthQuestion(l, seed) };
  return { kind: "seq", q: makeSequenceQuestion(type as SequenceQuestionType, l, seed) };
}

function grade(type: string, level: number, seed: number, response: unknown): string {
  if (typeof response !== "number" || !Number.isFinite(response)) return "other";
  const m = make(type, level, seed);
  if (m.kind === "cycle") return cycleMistake(m.q, response);
  if (m.kind === "nth") return nthMistake(m.q, response);
  return sequenceMistake(m.q, response);
}

// "mixed" questions take the words of the family they turn out to be.
const NUDGE: Record<SequenceKind | "cycle" | "nth", string> = {
  arithmetic: "اختلاف هر دو جمله پشت سر هم را زیرشان بنویس.",
  geometric: "ببین هر جمله چند برابر جمله قبلی است.",
  alternate: "جمله‌ها را یکی‌درمیان نگاه کن؛ شاید دو دنباله درهم باشند.",
  second: "اختلاف‌ها را بنویس؛ اگر ثابت نیستند، اختلافِ اختلاف‌ها را هم بنویس.",
  additive: "هر جمله را با دو جمله قبل از آن مقایسه کن.",
  letters: "زیر هر حرف، شماره‌اش را در الفبا بنویس.",
  cycle: "همه خانه‌ها را نشمار؛ ببین هر دور چند خانه است.",
  nth: "همه جمله‌ها را ننویس؛ جهش‌ها را بشمار.",
};

const RULE: Record<SequenceKind | "cycle" | "nth", string> = {
  arithmetic: "در دنباله حسابی، هر جمله با یک عدد ثابت از جمله قبلی بیشتر یا کمتر است.",
  geometric: "در دنباله هندسی، هر جمله یک عدد ثابت برابر جمله قبلی است، یا بر آن تقسیم می‌شود.",
  alternate: "جمله‌های اول، سوم، پنجم و … یک دنباله‌اند و جمله‌های دوم، چهارم، ششم و … دنباله‌ای دیگر؛ هر کدام قانون خودش را دارد.",
  second: "وقتی اختلاف‌ها خودشان با گام ثابتی عوض می‌شوند، اختلاف بعدی را از روی همان گام پیدا کن.",
  additive: "در این دنباله هر جمله جمع دو جمله قبل از آن است.",
  letters: "با شماره حرف‌ها مثل عدد حساب کن، بعد شماره را دوباره به حرف برگردان.",
  cycle: "شماره خانه را بر طول دور تقسیم کن: باقیمانده جای خانه را در دور می‌گوید، و باقیمانده صفر یعنی خانه آخر دور.",
  nth: "از جمله اول تا جمله nام، n منهای یک جهش است: جمله nام = جمله اول + (n منهای یک) × گام.",
};

const family = (m: Q): SequenceKind | "cycle" | "nth" => (m.kind === "seq" ? m.q.type : m.kind);

/** Two neighbouring terms the question shows (neither is the gap), from the start. */
function knownPair(q: SequenceQuestion, gap = 1): [number, number] | null {
  for (let k = 0; k + gap < q.terms.length; k++) if (k !== q.blank && k + gap !== q.blank) return [k, k + gap];
  return null;
}

function seqStep(q: SequenceQuestion): string | null {
  const t = (k: number) => (q.letters ? `«${letterAt(q.terms[k])}»` : fa(q.terms[k]));
  const r = q.rule;
  if (q.letters) {
    const p = knownPair(q);
    return p ? `گام اول: شماره ${t(p[0])} و ${t(p[1])} را در الفبا پیدا کن و ببین چند خانه فاصله دارند.` : null;
  }
  switch (r.kind) {
    case "step": {
      const p = knownPair(q);
      if (!p) return null;
      return r.op === "+" ? `گام اول: ${t(p[1])} را با ${t(p[0])} مقایسه کن: چقدر بیشتر یا کمتر است؟` : `گام اول: ببین ${t(p[1])} چند برابر ${t(p[0])} است، یا ${t(p[0])} چند برابر ${t(p[1])}.`;
    }
    case "grow":
      return "گام اول: زیر هر دو جمله پشت سر هم، اختلافشان را بنویس.";
    case "sum2":
      for (let k = 2; k < q.terms.length; k++)
        if (![k - 2, k - 1, k].includes(q.blank)) return `گام اول: ${t(k - 2)} و ${t(k - 1)} را با هم جمع کن و با ${t(k)} مقایسه کن.`;
      return null;
    case "alt": {
      const p = knownPair(q, 2);
      return p ? `گام اول: فقط جمله‌های یکی‌درمیان را ببین، مثلاً ${t(p[0])} و ${t(p[1])}: از یکی به دیگری چه شده؟` : null;
    }
  }
}

function cycleStep(q: CycleQuestion): string {
  const { L, m } = divide(q);
  switch (q.variant) {
    case "prefix":
      return `گام اول: ${fa(q.prefix.length)} خانه اول تکرار نمی‌شوند؛ آن‌ها را از ${fa(q.n)} کم کن.`;
    case "week":
      return `گام اول: هفته ۷ روز است؛ ${fa(q.n)} را بر ۷ تقسیم کن و باقیمانده را پیدا کن.`;
    default:
      return `گام اول: دور تکرار ${fa(L)} خانه است؛ ${fa(m)} را بر ${fa(L)} تقسیم کن.`;
  }
}

function nthStep(q: NthQuestion): string {
  const [a, b] = nthTerms(q, 2);
  switch (q.variant) {
    case "which":
      return `گام اول: گام را پیدا کن (${fa(b)} منهای ${fa(a)})، بعد ببین از ${fa(a)} تا ${fa(q.value)} چقدر راه است.`;
    case "meet":
      return `گام اول: فاصله جمله‌های اول دو دنباله را پیدا کن (${fa(Math.max(a, q.first2))} منهای ${fa(Math.min(a, q.first2))}) و ببین در هر جهش چقدر کم می‌شود.`;
    case "pattern":
      return "گام اول: ببین هر شکل چند تا بیشتر از شکل قبلی دارد؛ این گام است.";
    default:
      return `گام اول: گام دنباله را پیدا کن: ${fa(b)} منهای ${fa(a)}.`;
  }
}

/** The answer when it is one number a hint must not show, else null (symbols, letters' places count). */
function numberAnswer(m: Q): number | null {
  if (m.kind === "cycle") return m.q.variant === "count" ? m.q.answer : null;
  if (m.kind === "nth") return m.q.variant === "rule" ? null : m.q.answer;
  return m.q.answer;
}

/** Used when a number of this question's first step happens to equal the answer. */
const PLAIN_STEP: Record<SequenceKind | "cycle" | "nth", string> = {
  arithmetic: "گام اول: دو جمله پشت سر هم را که هر دو پیدا هستند پیدا کن و اختلافشان را حساب کن.",
  geometric: "گام اول: دو جمله پشت سر هم را که هر دو پیدا هستند پیدا کن و ببین یکی چند برابر دیگری است.",
  alternate: "گام اول: جمله‌های اول، سوم و پنجم را جدا بنویس و قانونشان را پیدا کن.",
  second: "گام اول: زیر هر دو جمله پشت سر هم، اختلافشان را بنویس.",
  additive: "گام اول: دو جمله پشت سر هم را جمع کن و با جمله بعدی مقایسه کن.",
  letters: "گام اول: زیر هر حرف، شماره‌اش را در الفبا بنویس.",
  cycle: "گام اول: دور تکرار را پیدا کن و بشمار چند خانه است.",
  nth: "گام اول: گام دنباله را پیدا کن: جمله دوم منهای جمله اول.",
};

const showsNumber = (s: string, v: number) => (s.match(/[۰-۹]+/g) ?? ([] as string[])).includes(fa(Math.abs(v)));

function hints(type: string, level: number, seed: number): [string, string, string] {
  const m = make(type, level, seed);
  const f = family(m);
  const step = (m.kind === "seq" ? seqStep(m.q) : m.kind === "cycle" ? cycleStep(m.q) : nthStep(m.q)) ?? PLAIN_STEP[f];
  const answer = numberAnswer(m);
  return [NUDGE[f], RULE[f], answer !== null && showsNumber(step, answer) ? PLAIN_STEP[f] : step];
}

/** The panels' own working, with its equations kept on one line (their ltr() does not join the spaces). */
const oneLine = (s: string) => s.replace(/⁦([^⁩]*)⁩/g, (_, x: string) => ltr(x));

/** The answer, named so it reads without the question beside it. */
function answerLine(m: Q): string {
  if (m.kind === "seq") return `جواب: جای خالی ${m.q.letters ? `حرف «${answerFa(m.q)}»` : ltr(answerFa(m.q))} است.`;
  if (m.kind === "cycle") {
    const q = m.q;
    if (q.variant === "count") return `جواب: ${fa(q.answer)} تا.`;
    if (q.variant === "week") return `جواب: روز ${fa(q.n)}ام سال ${cycleAnswerFa(q)} است.`;
    return `جواب: خانه شماره ${fa(q.n)}، ${cycleAnswerFa(q)} است.`;
  }
  const q = m.q;
  switch (q.variant) {
    case "far":
      return `جواب: جمله ${fa(q.n)}ام ${fa(q.answer)} است.`;
    case "pattern":
      return `جواب: شکل ${fa(q.n)} با ${fa(q.answer)} ${unitOf(q.pattern!)} ساخته می‌شود.`;
    case "which":
      return `جواب: ${fa(q.value)} جمله ${fa(q.answer)}ام است.`;
    case "meet":
      return `جواب: جمله ${fa(q.answer)}ام؛ هر دو دنباله آنجا ${fa(q.value)} هستند.`;
    case "rule":
      return `جواب: ${nthAnswerFa(q)}.`;
  }
}

/** The answer and the working of the panel's feedback; only the answer when that is too long for the report card. */
function solution(type: string, level: number, seed: number): string {
  const m = make(type, level, seed);
  const head = answerLine(m);
  const how = m.kind === "seq" ? sequenceHow(m.q) : m.kind === "cycle" ? cycleHow(m.q) : nthHow(m.q);
  const full = `${head} ${oneLine(how)}`;
  return full.length <= 300 ? full : head;
}

export const SEQUENCE_ADAPTER: ToolAdapter = {
  ...SEQUENCE_PRACTICE,
  version: "sequence@1",
  grade,
  hints,
  solution,
};

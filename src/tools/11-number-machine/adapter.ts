// Tool 11 in practice sessions: grading and three-step hints (the light
// data, types and tag words, is in practice.ts).
// The response is what the panel checks: a number for run, reverse, guess
// and operator questions; the machine the child built for "build"
// ({kind: "machine", rule} or {kind: "op", op}); and for "sort" a number,
// or the index of the chosen option in pass and program questions.
// Practice questions use the tool's default knobs (3 examples, ÷ allowed).

import { buildMistake, inverse, machineMistake, makeMachineQuestion, type Level, type Machine, type MachineQuestionType, type Op, type OpForm } from "@/generators/number-machine";
import { isChoice, makeSortQuestion, sortMistake } from "@/generators/sorting";
import type { ToolAdapter } from "@/practice/adapter";
import { fa } from "@/tools/registry";
import { ltr, stepFa } from "./format";
import { NUMBER_MACHINE_PRACTICE } from "./practice";

type Type = MachineQuestionType | "sort";

const OPS: readonly Op[] = ["+", "-", "×", "÷"];
const FORMS: readonly OpForm[] = ["lin", "sumTimes", "diffTimes", "prod"];
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** The built machine from JSON, or null when it is not one. */
function asMachine(r: unknown): Machine | null {
  if (!r || typeof r !== "object") return null;
  const m = r as { kind?: unknown; rule?: unknown; op?: unknown };
  if (m.kind === "machine" && Array.isArray(m.rule) && m.rule.length > 0) {
    const ok = m.rule.every((s: { op?: unknown; n?: unknown }) => !!s && OPS.includes(s.op as Op) && num(s.n));
    return ok ? { kind: "machine", rule: m.rule.map((s: { op: Op; n: number }) => ({ op: s.op, n: s.n })) } : null;
  }
  if (m.kind === "op" && m.op && typeof m.op === "object") {
    const o = m.op as Record<string, unknown>;
    if (!FORMS.includes(o.form as OpForm) || (o.r !== 0 && o.r !== 1) || ![o.p, o.q, o.c].every(num)) return null;
    return { kind: "op", op: { form: o.form as OpForm, r: o.r, p: o.p as number, q: o.q as number, c: o.c as number } };
  }
  return null;
}

function grade(type: string, level: number, seed: number, response: unknown): string {
  if (type === "sort") return num(response) ? sortMistake(makeSortQuestion(level as Level, seed), response) : "other";
  const q = makeMachineQuestion(type as MachineQuestionType, level as Level, seed);
  if (q.type === "build") {
    const m = asMachine(response);
    return m ? buildMistake(q, m) : "other";
  }
  return num(response) ? machineMistake(q, response) : "other";
}

const NUDGE: Record<Type, string> = {
  run: "عدد را مرحله به مرحله، از چپ به راست، از ماشین رد کن.",
  reverse: "برای پیدا کردن ورودی، ماشین را برعکس راه بینداز.",
  guess: "قانون باید با همه مثال‌های جدول جور باشد، نه فقط با یکی.",
  build: "قانون باید با همه مثال‌های جدول جور باشد، نه فقط با یکی.",
  operator: "★ فقط یک قانون است؛ عددها را جای a و b در آن بگذار.",
  sort: "کار را گام‌به‌گام روی کاغذ انجام بده، بی‌عجله.",
};

const RULE: Record<Type, string> = {
  run: "ترتیب مرحله‌ها مهم است: اول مرحله اول، بعد دومی، و همین‌طور تا آخر.",
  reverse: "از آخرین مرحله شروع کن و هر کار را برعکس کن: جمع با تفریق، ضرب با تقسیم.",
  guess: "مثال‌ها را با هم مقایسه کن: اگر خروجی به اندازه ورودی زیاد شود، ماشین فقط جمع یا تفریق دارد؛ اگر بیشتر، ضرب هم دارد.",
  build: "مثال‌ها را با هم مقایسه کن: اگر خروجی به اندازه ورودی زیاد شود، ماشین فقط جمع یا تفریق دارد؛ اگر بیشتر، ضرب هم دارد. ماشینت را روی همه مثال‌ها امتحان کن.",
  operator: "a عدد سمت چپ ★ است و b عدد سمت راست؛ اگر پرانتز هست، اول داخل آن را حساب کن.",
  sort: "در یک دور، از چپ به راست هر دو جعبه همسایه را مقایسه کن و اگر چپی بزرگ‌تر بود جایشان را عوض کن. در برنامه، دستورهای داخل تکرار را هر بار به همان ترتیب انجام بده.",
};

function firstStep(type: string, level: number, seed: number): string {
  if (type === "sort") {
    const q = makeSortQuestion(level as Level, seed);
    switch (q.variant) {
      case "loop":
        return q.theme === "robot"
          ? `گام اول: یک دور برنامه را انجام بده؛ ربات چند خانه جلو و چند خانه عقب می‌رود؟ از خانه ${fa(q.start)} شروع کن.`
          : `گام اول: دستورهای دور اول را یکی‌یکی روی ${fa(q.start)} انجام بده.`;
      case "pass":
      case "swaps":
        return `گام اول: دو جعبه اول (${fa(q.row[0])} و ${fa(q.row[1])}) را مقایسه کن: جابه‌جا می‌شوند یا نه؟`;
      case "passes":
        return "گام اول: یک دور کامل را انجام بده و ردیف تازه را بنویس؛ بعد ببین مرتب شده یا نه.";
      case "minSwaps":
        return "گام اول: جفت‌هایی را پیدا کن که عدد بزرگ‌تر سمت چپ عدد کوچک‌تر است.";
      case "program":
        return `گام اول: برنامه ۱ را روی ${fa(q.start)} اجرا کن و ببین به ${fa(q.target)} می‌رسد یا نه.`;
    }
  }
  const q = makeMachineQuestion(type as MachineQuestionType, level as Level, seed);
  switch (q.type) {
    case "run":
      return `گام اول: ${fa(q.input)} را به مرحله اول (${ltr(stepFa(q.rule[0]))}) بده.`;
    case "reverse": {
      const last = q.rule[q.rule.length - 1];
      return `گام اول: از خروجی ${fa(q.output)} شروع کن و برعکسِ مرحله آخر را انجام بده: ${ltr(stepFa(inverse(last)))}.`;
    }
    case "guess":
    case "build":
      if (q.machine.kind === "op") return "گام اول: در مثال اول، خروجی را با a + b و با a × b مقایسه کن؛ کدام نزدیک‌تر است؟";
      return q.examples.length > 1
        ? "گام اول: مثال اول و دوم را کنار هم بگذار: ورودی چقدر بیشتر شد و خروجی چقدر؟"
        : "گام اول: ببین خروجی مثال اول از ورودی‌اش چقدر بیشتر یا چند برابر است.";
    case "operator":
      if (q.variant === "nested") return "گام اول: فقط داخل پرانتز را حساب کن؛ عدد اول جای a و عدد دوم جای b.";
      if (q.variant === "unknown") return "گام اول: □ را جای a بگذار و عدد داده‌شده را جای b؛ حالا یک معادله ساده داری.";
      return "گام اول: در قانون، عدد سمت چپ ★ را جای a و عدد سمت راست را جای b بگذار.";
  }
}

/** The answer when it is one number (a hint must not show it), else null. */
function numberAnswer(type: string, level: number, seed: number): number | null {
  if (type === "sort") {
    const q = makeSortQuestion(level as Level, seed);
    return isChoice(q) ? null : q.answer;
  }
  const q = makeMachineQuestion(type as MachineQuestionType, level as Level, seed);
  return q.type === "build" ? null : q.answer;
}

/** Used when a number of this question's first step happens to equal the answer. */
const PLAIN_STEP: Record<Type, string> = {
  run: "گام اول: ورودی را به مرحله اول بده و جوابش را زیر آن بنویس.",
  reverse: "گام اول: از خروجی شروع کن و برعکسِ مرحله آخر را روی آن انجام بده.",
  guess: "گام اول: مثال اول و دوم را کنار هم بگذار: ورودی چقدر بیشتر شد و خروجی چقدر؟",
  build: "گام اول: مثال اول و دوم را کنار هم بگذار: ورودی چقدر بیشتر شد و خروجی چقدر؟",
  operator: "گام اول: در قانون، عدد سمت چپ ★ را جای a و عدد سمت راست را جای b بگذار.",
  sort: "گام اول: فقط اولین کار را انجام بده و نتیجه را بنویس؛ بعد سراغ کار بعدی برو.",
};

const showsNumber = (s: string, v: number) => (s.match(/[۰-۹]+/g) ?? ([] as string[])).includes(fa(Math.abs(v)));

export const NUMBER_MACHINE_ADAPTER: ToolAdapter = {
  ...NUMBER_MACHINE_PRACTICE,
  version: "number-machine@1",
  grade,
  hints: (type, level, seed) => {
    const step = firstStep(type, level, seed);
    const answer = numberAnswer(type, level, seed);
    return [NUDGE[type as Type], RULE[type as Type], answer !== null && showsNumber(step, answer) ? PLAIN_STEP[type as Type] : step];
  },
};

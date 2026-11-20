// Tool 3 in practice sessions: grading and three-step hints (the light
// data, types and tag words, is in practice.ts).
// The response is the index of the picked option (for «شکل متفاوت», of the
// picked figure in the row).

import { makePatternQuestion, type Level, type PatternQuestion, type PatternQuestionType, type RuleKind } from "@/generators/patterns";
import type { ToolAdapter } from "@/practice/adapter";
import { PATTERNS_PRACTICE } from "./practice";

const make = (type: string, level: number, seed: number) => makePatternQuestion(type as PatternQuestionType, level as Level, seed);

function grade(type: string, level: number, seed: number, response: unknown): string {
  const q = make(type, level, seed);
  const n = q.type === "odd" ? q.tiles.length : q.options.length;
  if (typeof response !== "number" || !Number.isInteger(response) || response < 0 || response >= n) return "other";
  if (response === q.answer) return "right";
  // The panel's feedback reads the option's tag; an odd-one-out has only one way to be wrong.
  return q.type === "odd" ? "notOdd" : (q.tags[response] ?? "other");
}

const NUDGE: Record<PatternQuestionType, string> = {
  matrix2: "یک چیز را در نظر بگیر و ببین در سطر و ستون چطور عوض می‌شود.",
  matrix3: "سطرهای کامل را از راست به چپ بخوان؛ سطر آخر هم همان‌طور است.",
  sequence: "خانه‌ها را از راست به چپ یکی‌یکی با هم مقایسه کن: چه چیزی عوض می‌شود؟",
  rotation: "هر نشانه را جدا دنبال کن؛ نه همه را با هم.",
  combine: "خط‌های دو شکل را یکی‌یکی با هم مقایسه کن.",
  sides: "در هر خانه، ضلع‌ها و نقطه‌ها را جدا بشمار.",
  missing: "به خانه‌های دور جای خالی نگاه کن؛ تکه باید با آن‌ها جور شود.",
  odd: "شکل‌ها را دوبه‌دو مقایسه کن؛ چهار تا در یک چیز شبیه‌اند.",
};

const RULE: Record<PatternQuestionType, string> = {
  matrix2: "هر قانون (چرخش، تعداد، شکل، رنگ) جدا کار می‌کند؛ جواب باید همه قانون‌ها را با هم داشته باشد.",
  matrix3: "هر قانون (چرخش، تعداد، شکل، رنگ، خط‌ها) جدا کار می‌کند؛ جواب باید همه قانون‌ها را با هم داشته باشد.",
  sequence: "هر چیزی که عوض می‌شود، هر بار به یک اندازه یا به یک ترتیب عوض می‌شود.",
  rotation: "هر نشانه هر بار به یک اندازه و یک جهت دور قاب جلو می‌رود.",
  combine: "روی‌هم‌گذاشتن: همه خط‌ها می‌مانند. پاک کردن مشترک‌ها: فقط خط‌هایی می‌مانند که در یکی هستند.",
  sides: "تعداد ضلع‌ها و تعداد نقطه‌ها هر کدام قانون خودشان را دارند.",
  missing: "هر سطر به ترتیبی تکرار می‌شود؛ ترتیب را از سطرهای کامل پیدا کن.",
  odd: "ویژگی‌ها را یکی‌یکی بسنج: شکل، رنگ، تعداد، برعکس شدن، ضلع و نقطه.",
};

const KIND_NAME: Record<RuleKind, string> = { turn: "چرخش", count: "تعداد", shape: "شکل", fill: "رنگ و نقش", lines: "خط‌ها" };

function firstStep(q: PatternQuestion): string {
  switch (q.type) {
    case "odd":
      return q.level === 1
        ? "گام اول: اول فقط شکل‌ها را مقایسه کن، بعد فقط رنگ‌ها، بعد فقط تعدادها؛ کدام ویژگی در چهار تا یکی است؟"
        : q.level === 2
          ? "گام اول: هر شکل را در ذهنت بچرخان تا با شکل کناری‌اش هم‌جهت شود؛ کدام با هیچ چرخاندنی جور نمی‌شود؟"
          : "گام اول: در هر شکل، اول ضلع‌ها را بشمار، بعد نقطه‌ها را.";
    case "missing":
      return "گام اول: سطر بالای جای خالی را بخوان و ببین خانه‌هایش به چه ترتیبی می‌آیند؛ سطر جای خالی هم همان ترتیب را دارد.";
    case "rotation":
    case "sides": {
      // "نقطه سیاه هر بار …": name what to follow, not how far it goes.
      const what = q.why.map((w) => w.text.split(/ هر بار| به ترتیب/)[0]).filter((w) => w.length < 30);
      return what.length > 1
        ? `گام اول: در این الگو ${what.length === 2 ? "دو" : "سه"} چیز عوض می‌شود: ${what.join("، ")}. اول فقط «${what[0]}» را از خانه اول تا آخر دنبال کن.`
        : `گام اول: فقط «${what[0] ?? "نشانه‌ها"}» را از خانه اول تا آخر دنبال کن.`;
    }
    case "combine":
      if (q.level < 3) return "گام اول: هر خط شکل اول را پیدا کن و ببین در شکل دوم هم هست یا نه.";
      return "گام اول: در سطر اول، خانه سوم را با دو خانه اول مقایسه کن: خط‌های مشترک مانده‌اند یا پاک شده‌اند؟";
    default: {
      const kinds = (q.rules ?? []).map((r) => KIND_NAME[r.kind]);
      if (!kinds.length) return "گام اول: سطر اول را از راست به چپ بخوان و ببین چه چیزی عوض می‌شود.";
      const where = q.rows > 1 ? "سطر اول" : "دنباله";
      return kinds.length > 1
        ? `گام اول: در این الگو ${kinds.length === 2 ? "دو" : "سه"} چیز عوض می‌شود: ${kinds.join("، ")}. اول فقط «${kinds[0]}» را در ${where} دنبال کن.`
        : `گام اول: فقط «${kinds[0]}» عوض می‌شود؛ ببین در ${where} از هر خانه به خانه بعد چطور عوض می‌شود.`;
    }
  }
}

export const PATTERNS_ADAPTER: ToolAdapter = {
  ...PATTERNS_PRACTICE,
  version: "patterns@1",
  grade,
  hints: (type, level, seed) => [NUDGE[type as PatternQuestionType], RULE[type as PatternQuestionType], firstStep(make(type, level, seed))],
};

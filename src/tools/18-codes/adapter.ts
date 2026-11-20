// Tool 18 in practice sessions: grading and three-step hints (the light
// data, types and tag words, is in practice.ts).
// The response is what the panel checks. Letter, number and shape codes:
// one token per slot (letter place, number or shape index; -1 for a space
// between words). «کد دودویی»: a number (read, howMany, largest), the lamps
// as a number whose bits are the cards (show, next), or the letter places
// of the word (word); which one the seed decides, as on the page.

import { binaryMistake, makeBinaryQuestion, wordMistake, type BinaryQuestion, type Level } from "@/generators/binary-code";
import { ALPHABET, codeMistake, makeCodeQuestion, outKind, SHAPE_FA, SHAPES, signedShift, SPACE, type CodeQuestion, type CodeQuestionType, type TokenKind } from "@/generators/codes";
import type { ToolAdapter } from "@/practice/adapter";
import { fa } from "@/tools/registry";
import { CODES_PRACTICE } from "./practice";

type Type = CodeQuestionType | "binary";

/** The question as the page builds it: any word length, two examples (the page's defaults). */
export const makeCodes = (type: string, level: number, seed: number): CodeQuestion | BinaryQuestion =>
  type === "binary" ? makeBinaryQuestion(level as Level, seed) : makeCodeQuestion(type as CodeQuestionType, level as Level, seed, { length: 0, examples: 2 });

const isTokens = (v: unknown): v is (number | null)[] => Array.isArray(v) && v.every((x) => x === null || (typeof x === "number" && Number.isInteger(x)));

function grade(type: string, level: number, seed: number, response: unknown): string {
  const q = makeCodes(type, level, seed);
  if (q.type === "binary") {
    if (q.kind === "word") return isTokens(response) ? wordMistake(q, response) : "other";
    return typeof response === "number" && Number.isFinite(response) ? binaryMistake(q, response) : "other";
  }
  return isTokens(response) ? codeMistake(q, response) : "other";
}

const NUDGE: Record<Type, string> = {
  shift: "الفبا را مثل یک چرخ تصور کن: بعد از ی دوباره ا می‌آید.",
  number: "هر حرف یک عدد دارد؛ اول ببین حرف ا چه عددی گرفته.",
  shape: "هر حرف شکل خودش را دارد و حرف‌های یکسان شکل یکسان.",
  sentence: "فاصله‌ها سر جایشان می‌مانند؛ کلمه‌ها را یکی‌یکی بخوان.",
  binary: "کارت‌ها از چپ به راست خوانده می‌شوند و هر کارت دو برابر کارت سمت راستش می‌ارزد.",
};

const RULE: Record<Type, string> = {
  shift: "هر حرف به اندازه قانون جلو یا عقب می‌رود؛ برای رمزگشایی، برعکس قانون برو. الفبای فارسی پ، چ، ژ، گ را هم دارد.",
  number: "عدد هر حرف از جای آن در الفبا ساخته می‌شود؛ پ، چ، ژ، گ را هم بشمار.",
  shape: "جفت حرف و شکل را از جدول یا از مثال‌ها پیدا کن؛ هر حرفی که در مثال‌ها آمده شکلش معلوم است.",
  sentence: "اول قانون رمز را پیدا کن، بعد آن را برعکس روی هر حرف اجرا کن.",
  binary: "عدد = جمع ارزش کارت‌های روشن (●)؛ کارت خاموش (○) هیچ نمی‌ارزد.",
};

const tokenFa = (kind: TokenKind, t: number) => (kind === "number" ? fa(t) : kind === "shape" ? SHAPE_FA[SHAPES[t]] : ALPHABET[t]);
const word = (xs: readonly number[]) => xs.map((x) => (x === SPACE ? " " : ALPHABET[x])).join("");

function codeStep(q: CodeQuestion): string {
  const s = "گام اول: ";
  const r = q.rule;
  const gk: TokenKind = q.dir === "encode" ? "letter" : outKind(r);
  const g = tokenFa(gk, q.given[0]);
  const thing = gk === "letter" ? "حرف" : gk === "number" ? "عدد" : "شکل";
  if (q.show === "key") return `${s}${thing} اول، «${g}»، را در جدول رمز پیدا کن و ببین جفتش چیست.`;
  if (q.show === "examples") {
    const e = q.examples[0];
    const k = outKind(r);
    return `${s}در مثال «${word(e.plain)}»، حرف «${ALPHABET[e.plain[0]]}» شده «${tokenFa(k, e.coded[0])}»؛ ببین این قانون با مثال‌های دیگر هم جور است.`;
  }
  switch (r.kind) {
    case "shift": {
      const d = signedShift(q.dir === "encode" ? r.n : -r.n);
      return `${s}از «${g}» ${fa(Math.abs(d))} حرف ${d > 0 ? "جلو" : "عقب"} برو؛ حرف «${g}» خودش شمرده نمی‌شود.`;
    }
    case "mirror":
      return `${s}«${g}» در الفبای وارونه جای چندم است؟ از ی شروع کن و به عقب بشمار.`;
    case "number":
      return q.dir === "encode" ? `${s}«${g}» حرف چندم الفباست${r.rev ? " (از آخر)" : ""}؟ بشمار.` : `${s}عدد اول «${g}» است؛ ببین مال حرف چندم الفباست${r.rev ? " (از آخر)" : ""}.`;
    default:
      return `${s}${thing} اول، «${g}»، را پیدا کن.`;
  }
}

function binaryStep(q: BinaryQuestion): string {
  const s = "گام اول: ";
  switch (q.kind) {
    case "read":
      return `${s}از چپ شروع کن: کارت ۱۶ ${q.n & 16 ? "روشن" : "خاموش"} است. بعد کارت‌های روشن دیگر را پیدا کن.`;
    case "show":
      return `${s}از بزرگ‌ترین کارت شروع کن: آیا ۱۶ در ${fa(q.n)} جا می‌شود؟`;
    case "howMany":
      return `${s}با سه کارت بزرگ‌ترین عدد هفت است؛ آیا به ${fa(q.n)} می‌رسد؟ یکی‌یکی کارت اضافه کن.`;
    case "next":
      return `${s}از سمت راست شروع کن: کارت ۱ روشن است؛ یکی اضافه کنی چه می‌شود؟`;
    case "largest":
      return `${s}همه ${fa(q.n)} کارت را روشن کن و ارزش هر کارت را زیرش بنویس.`;
    case "word":
      return `${s}ردیف اول را بخوان: ارزش کارت‌های روشن را جمع کن، بعد ببین حرف چندم الفباست (ا = ۱).`;
  }
}

/** The answer as one token a hint must not print: a number, or a whole word. */
export function codesAnswerToken(q: CodeQuestion | BinaryQuestion): string | null {
  if (q.type === "binary") return q.kind === "read" || q.kind === "howMany" || q.kind === "largest" || q.kind === "next" ? fa(q.answer) : null;
  return outKind(q.rule) === "letter" || q.dir === "decode" ? word(q.answer) : null;
}

/** Number tokens and words of a text. */
const tokens = (t: string) => t.split(/[\s«»،؛:.؟?()]+/).filter(Boolean);

function hints(type: string, level: number, seed: number): [string, string, string] {
  const t = type as Type;
  const q = makeCodes(type, level, seed);
  const step = q.type === "binary" ? binaryStep(q) : codeStep(q);
  const ans = codesAnswerToken(q);
  // A step can happen to name the answer (a given number equal to it); then it goes without numbers.
  const safe = ans && ans.split(" ").some((w) => tokens(step).includes(w)) ? "گام اول: قانون را روی اولین حرف یا کارت امتحان کن." : step;
  return [NUDGE[t], RULE[t], safe];
}

export const CODES_ADAPTER: ToolAdapter = {
  ...CODES_PRACTICE,
  version: "codes@1",
  grade,
  hints,
};

// Words for «کد دودویی» (tool 18): prompts, the working and the answer.
// Plain code (no React): Binary.tsx and the practice adapter share it.

import { ALPHABET } from "@/generators/codes";
import { answerKindOf, binaryString, CARDS, cardValues, greedySteps, maskOfLetter, onValues, type BinaryQuestion } from "@/generators/binary-code";
import { fa } from "@/tools/registry";
import { ltr } from "./text";

// ───────────── words ─────────────

/** A row as 0s and 1s in Persian digits, kept left to right: ⁦۰۱۱۰۱⁩. */
export const binFa = (mask: number, cards = CARDS) => ltr(fa(binaryString(mask, cards)));
/** "۸ + ۴ + ۱ = ۱۳", left to right; "۰" when no card is up. */
export function sumFa(mask: number, cards = CARDS) {
  const vs = onValues(mask, cards);
  if (vs.length === 0) return ltr("۰");
  if (vs.length === 1) return ltr(`${fa(vs[0])} = ${fa(mask)}`);
  return ltr(`${vs.map((v) => fa(v)).join(" + ")} = ${fa(mask)}`);
}
export const cardsFa = (cards: number) =>
  cardValues(cards)
    .map((v) => fa(v))
    .join(" ");
/** "۱، ۲، ۴ … ۶۴": the card values, smallest first. */
export const cardListFa = (k: number) =>
  k <= 4
    ? cardValues(k)
        .reverse()
        .map((v) => fa(v))
        .join("، ")
    : `۱، ۲، ۴ … ${fa(2 ** (k - 1))}`;
export const allOnFa = (k: number) =>
  ltr(
    `${cardValues(k)
      .map((v) => fa(v))
      .join(" + ")} = ${fa(2 ** k - 1)}`,
  );

export const LTR_NOTE = "کد دودویی، مثل عددها، از چپ به راست خوانده می‌شود، حتی وسط متن فارسی: کارت بزرگ (۱۶) سمت چپ است و کارت ۱ سمت راست.";

export function binaryPrompt(q: BinaryQuestion, paper = false): string {
  switch (q.kind) {
    case "read":
      return `کارت‌ها ${ltr(cardsFa(CARDS))} هستند. هر کارت رو (لامپ روشن ●) به اندازه نقطه‌هایش می‌ارزد و کارت پشت‌ورو (لامپ خاموش ○) هیچ. این لامپ‌ها چه عددی را نشان می‌دهند؟`;
    case "show":
      return paper
        ? `عدد ${fa(q.n)} را با کارت‌های ${ltr(cardsFa(CARDS))} نشان بده: زیر هر کارت روشن ● و زیر هر کارت خاموش ○ بکش.`
        : `عدد ${fa(q.n)} را با کارت‌ها نشان بده: روی هر کارت بزنی، برمی‌گردد (روشن ● یا خاموش ○).`;
    case "howMany":
      return `کارت‌ها ${cardListFa(4)} … هستند؛ هر کارت دو برابر کارت قبلی. دست‌کم چند کارت (لامپ) لازم است تا همه عددهای ۱ تا ${fa(q.n)} را بشود نشان داد؟`;
    case "word":
      return `هر حرف کلمه با جایش در الفبا رمز شده (ا = ۱، ب = ۲، پ = ۳ …) و آن عدد با لامپ‌های ${ltr(cardsFa(CARDS))} نوشته شده؛ ردیف اول، حرف اول کلمه است. کلمه چیست؟`;
    case "next":
      return paper
        ? "این لامپ‌ها یک عدد را نشان می‌دهند. لامپ‌های عدد بعدی (یکی بیشتر) را بکش: زیر هر کارت ● یا ○."
        : "این لامپ‌ها یک عدد را نشان می‌دهند. کارت‌ها را طوری برگردان که عدد بعدی (یکی بیشتر) را نشان دهند.";
    case "largest":
      return `با ${fa(q.n)} کارت ${cardListFa(q.n)} (هر کارت دو برابر قبلی)، بزرگ‌ترین عددی که می‌شود نشان داد چند است؟`;
  }
}

/** Show me, one card: "۸ ≤ ۱۳: روشن؛ مانده ۵". */
export function greedyStepFa(s: { value: number; before: number; on: boolean; after: number }) {
  return s.on
    ? `${fa(s.value)} در ${fa(s.before)} جا می‌شود: کارت ${fa(s.value)} روشن ●؛ مانده ${ltr(`${fa(s.before)} − ${fa(s.value)} = ${fa(s.after)}`)}`
    : `${fa(s.value)} از ${fa(s.before)} بزرگ‌تر است: کارت ${fa(s.value)} خاموش ○`;
}

/** The working, in a few sentences. */
export function binaryHow(q: BinaryQuestion): string {
  switch (q.kind) {
    case "read":
      return `کارت‌های روشن: ${onValues(q.n)
        .map((v) => fa(v))
        .join("، ")}؛ ${sumFa(q.n)}. (کد ${binFa(q.n)} از چپ به راست.) جواب ${fa(q.n)} است.`;
    case "show":
      return `از بزرگ‌ترین کارت شروع کن: ${greedySteps(q.n).map(greedyStepFa).join("؛ ")}. پس ${binFa(q.n)}: ${sumFa(q.n)}.`;
    case "next": {
      const flipped = cardValues().filter((v) => (q.n & v) !== (q.answer & v));
      const off = flipped.filter((v) => q.n & v);
      const on = flipped.find((v) => q.answer & v)!;
      return `این لامپ‌ها ${sumFa(q.n)} را نشان می‌دهند؛ عدد بعدی ${fa(q.answer)} است. از راست: کارت‌های روشن ${off.map((v) => fa(v)).join("، ")} خاموش می‌شوند و اولین کارت خاموش (${fa(on)}) روشن می‌شود، مثل ${ltr("۹ + ۱ = ۱۰")}. پس ${binFa(q.answer)}: ${sumFa(q.answer)}.`;
    }
    case "howMany": {
      const k = q.answer;
      const less = k - 1;
      return `با ${fa(less)} کارت، بزرگ‌ترین عدد ${allOnFa(less)} است که از ${fa(q.n)} کمتر است؛ با ${fa(k)} کارت تا ${fa(2 ** k - 1)} می‌رسیم. پس ${fa(k)} کارت لازم است.`;
    }
    case "largest":
      return `همه ${fa(q.n)} کارت روشن: ${allOnFa(q.n)}. این یکی کمتر از کارت بعدی (${fa(2 ** q.n)}) است. جواب ${fa(q.answer)} است.`;
    case "word":
      return `${q.word.map((l) => `${binFa(maskOfLetter(l))} = ${fa(maskOfLetter(l))} ← ${ALPHABET[l]}`).join("، ")}. پس کلمه «${q.word.map((l) => ALPHABET[l]).join("")}» است.`;
  }
}

/** The answer in words. */
export function binaryAnswerFa(q: BinaryQuestion): string {
  const k = answerKindOf(q.kind);
  if (k === "letters") return `«${q.word.map((l) => ALPHABET[l]).join("")}»`;
  if (k === "lamps") return `${binFa(q.answer)} (${fa(q.answer)})`;
  return fa(q.answer);
}

"use client";

import { useState } from "react";
import {
  answerKind,
  digitsMistake,
  digitsOf,
  extremes,
  placeCounts,
  readEquation,
  RULES,
  stickDiff,
  type Cond,
  type DigitsQuestion,
  type DigitsQuestionType,
  type Level,
  type MatchQuestion,
} from "@/generators/digits";
import { NumberPad } from "@/toolkit/NumberPad";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/TryPanel.module.css";

export const DIGITS_TYPE_LABEL: Record<DigitsQuestionType, string> = {
  extreme: "بزرگ‌ترین و کوچک‌ترین",
  condition: "عدد با شرط",
  count: "شمارش رقم",
  digitSum: "مجموع ارقام",
  divisible: "رقم گمشده",
  match: "چوب‌کبریت",
};

/** Keeps a number or an equation left to right inside a Persian sentence. */
export const ltr = (s: string) => `⁦${s}⁩`;

/** A number in Persian digits that reads left to right, leading zeros kept. */
export const numFa = (s: string | number) => ltr(fa(s));

export const COND_FA: Record<Cond, string> = {
  even: "زوج",
  odd: "فرد",
  div3: "بخش‌پذیر بر ۳",
  div4: "بخش‌پذیر بر ۴",
  div5: "بخش‌پذیر بر ۵",
  div6: "بخش‌پذیر بر ۶",
  div9: "بخش‌پذیر بر ۹",
};

/** The rule that decides a condition, in words. */
export const COND_RULE: Record<Cond, string> = {
  even: "رقم یکان باید زوج باشد (۰، ۲، ۴، ۶ یا ۸)",
  odd: "رقم یکان باید فرد باشد (۱، ۳، ۵، ۷ یا ۹)",
  div3: "مجموع رقم‌ها باید بر ۳ بخش‌پذیر باشد",
  div4: "عدد دو رقم آخر باید بر ۴ بخش‌پذیر باشد",
  div5: "رقم یکان باید ۰ یا ۵ باشد",
  div6: "عدد باید زوج باشد و مجموع رقم‌هایش بر ۳ بخش‌پذیر",
  div9: "مجموع رقم‌ها باید بر ۹ بخش‌پذیر باشد",
};

const RULE_FA: Record<number, string> = {
  2: "زوج بودن (رقم یکان زوج)",
  3: "بخش‌پذیری بر ۳ (مجموع رقم‌ها بر ۳)",
  4: "بخش‌پذیری بر ۴ (دو رقم آخر بر ۴)",
  5: "بخش‌پذیری بر ۵ (یکان ۰ یا ۵)",
  9: "بخش‌پذیری بر ۹ (مجموع رقم‌ها بر ۹)",
};

const cardsFa = (cards: number[]) => cards.map((d) => fa(d)).join("، ");
const wantFa = (w: "max" | "min") => (w === "max" ? "بزرگ‌ترین" : "کوچک‌ترین");
const lenFa = (k: number) => ["", "یک", "دو", "سه", "چهار", "پنج"][k] ?? fa(k);

/** A number with its box: "۴□۵". */
export const holeFa = (digits: (number | null)[]) => ltr(digits.map((d) => (d === null ? "□" : fa(d))).join(""));

/** An equation of sticks, read: "۶ + ۴ = ۹", or null if some sticks are no digit. */
export function equationFa(q: Pick<MatchQuestion, "lens">, masks: number[]) {
  const eq = readEquation(q.lens, masks);
  return eq ? ltr(`${fa(eq.a)} ${eq.sign} ${fa(eq.b)} = ${fa(eq.c)}`) : null;
}

export function digitsPrompt(q: DigitsQuestion, paper = false): string {
  switch (q.type) {
    case "extreme":
      if (q.want === "diff") return `با کارت‌های ${cardsFa(q.cards)}، بزرگ‌ترین و کوچک‌ترین عدد ${lenFa(q.cards.length)}رقمی را بساز. تفاضل آن‌ها چند است؟`;
      return `با کارت‌های ${cardsFa(q.cards)} (هر کارت یک بار)، ${wantFa(q.want)} عدد ${lenFa(q.cards.length)}رقمی را ${paper ? "بنویس" : "بچین"}.`;
    case "condition":
      return `با ${q.use === q.cards.length ? "همه" : `${fa(q.use)} تا از`} کارت‌های ${cardsFa(q.cards)}، ${wantFa(q.want)} عدد ${lenFa(q.use)}رقمی ${COND_FA[q.cond]} را ${paper ? "بنویس" : "بساز"}.`;
    case "count":
      return `عددهای ۱ تا ${fa(q.n)} را پشت سر هم می‌نویسیم. رقم ${fa(q.digit)} چند بار نوشته می‌شود؟`;
    case "digitSum":
      switch (q.variant) {
        case "min":
          return `کوچک‌ترین عددی که مجموع رقم‌هایش ${fa(q.sum)} باشد چیست؟`;
        case "min4":
          return `کوچک‌ترین عدد چهاررقمی که مجموع رقم‌هایش ${fa(q.sum)} باشد چیست؟`;
        case "max4distinct":
          return `بزرگ‌ترین عدد چهاررقمی با رقم‌های متفاوت که مجموع رقم‌هایش ${fa(q.sum)} باشد چیست؟`;
        case "minDistinct":
          return `کوچک‌ترین عددی که هیچ رقمش تکرار نشده و مجموع رقم‌هایش ${fa(q.sum)} است چیست؟`;
      }
      break;
    case "divisible":
      return `در عدد ${holeFa(q.digits)}، به جای □ ${q.want === "only" ? "چه رقمی" : `${wantFa(q.want)} رقمی را`} بگذاریم تا عدد بر ${fa(q.divisor)} بخش‌پذیر شود؟`;
    case "match":
      return `${q.moves === 1 ? "فقط یک" : "دو"} چوب‌کبریت را جابه‌جا کن تا تساوی درست شود.${paper ? " چوب برداشته را خط بزن و جای تازه را بکش." : ""} (علامت = ثابت است؛ هیچ رقمی حذف نمی‌شود.)`;
  }
  return "";
}

/** The working, in one or two sentences. */
export function digitsHow(q: DigitsQuestion): string {
  switch (q.type) {
    case "extreme": {
      const e = extremes(q.cards);
      const zero = q.cards.includes(0) ? " صفر نمی‌تواند اول بیاید؛ پس کوچک‌ترین رقم غیرصفر اول می‌آید و بعد صفر." : "";
      const maxT = `بزرگ‌ترین: رقم‌ها از بزرگ به کوچک، ${numFa(e.max)}.`;
      const minT = `کوچک‌ترین: رقم‌ها از کوچک به بزرگ.${zero} ${numFa(e.min)}.`;
      if (q.want === "max") return maxT;
      if (q.want === "min") return minT;
      return `${maxT} ${minT} تفاضل: ${ltr(`${fa(e.max)} − ${fa(e.min)} = ${fa(q.answer)}`)}.`;
    }
    case "condition": {
      const left = q.use < q.cards.length ? ` کارتی که کنار می‌ماند: ${fa(q.cards.find((c) => !String(q.answer).includes(String(c)))!)}.` : "";
      return `${COND_RULE[q.cond]}. از عددهایی که این شرط را دارند، ${wantFa(q.want)} ${numFa(q.answer)} است.${left}`;
    }
    case "count": {
      const [o, t, h, th] = placeCounts(q.digit, q.n);
      const parts = [`یکان ${fa(o)} بار`, `دهگان ${fa(t)} بار`, ...(h ? [`صدگان ${fa(h)} بار`] : []), ...(th ? [`هزارگان (در ۱۰۰۰) ${fa(th)} بار`] : [])];
      const dd = q.n >= 11 * q.digit ? ` عددی مثل ${fa(11 * q.digit)} دو بار حساب می‌شود.` : "";
      return `جدا جدا بشمار: ${parts.join("، ")}؛ جمع ${fa(q.answer)}.${dd}`;
    }
    case "digitSum": {
      const ds = digitsOf(q.answer);
      const sum = ltr(`${ds.map((d) => fa(d)).join(" + ")} = ${fa(q.sum)}`);
      switch (q.variant) {
        case "min":
          return `کمترین تعداد رقم را بگیر: هرچه بیشتر ۹ بگذار و ۹ها را آخر بنویس؛ رقم اول باقی‌مانده است: ${sum}، پس ${numFa(q.answer)}.`;
        case "min4":
          return `رقم اول را تا جای ممکن کوچک بگیر (اما نه صفر)، بعد صفرها، و ۹ها در آخر: ${sum}، پس ${numFa(q.answer)}.`;
        case "max4distinct":
          return `از چپ، هر رقم را تا جای ممکن بزرگ بگیر، طوری که با رقم‌های تکراری‌نشده باقی جمع درست دربیاید: ${sum}، پس ${numFa(q.answer)}.`;
        case "minDistinct":
          return `اول کمترین تعداد رقم (با رقم‌های بزرگ و متفاوت)، بعد رقم‌ها از کوچک به بزرگ: ${sum}، پس ${numFa(q.answer)}.`;
      }
      break;
    }
    case "divisible": {
      const rules = RULES[q.divisor].map((r) => RULE_FA[r]).join(" و ");
      const many = q.valid.length > 1 ? ` رقم‌هایی که درست‌اند: ${q.valid.map((d) => fa(d)).join("، ")}؛ ${q.want === "max" ? "بزرگ‌ترین" : "کوچک‌ترین"}: ${fa(q.answer)}.` : ` فقط ${fa(q.answer)} درست است.`;
      const zero = q.digits[0] === null ? " (صفر اول عدد نمی‌آید.)" : "";
      return `بر ${fa(q.divisor)} یعنی ${rules}.${many}${zero} عدد: ${numFa(q.digits.map((d) => d ?? q.answer).join(""))}.`;
    }
    case "match":
      return `تساوی درست: ${equationFa(q, q.answer)}. ${q.moves === 1 ? "چوب جابه‌جاشده" : "چوب‌های جابه‌جاشده"} روی صفحه حرکت می‌کنند.`;
  }
  return "";
}

/** The answer in words. */
export function answerFa(q: DigitsQuestion) {
  return q.type === "match" ? (equationFa(q, q.answer) ?? "") : numFa(q.answer);
}

type Tone = "good" | "turned" | "bad";
const ICON: Record<Tone, string> = { good: "✓", turned: "↻", bad: "✗" };

function feedback(q: DigitsQuestion, v: string): { tone: Tone; text: string } {
  const how = digitsHow(q);
  const right = `جواب ${answerFa(q)} است. ${how}`;
  switch (digitsMistake(q, v)) {
    case "right":
      return { tone: "good", text: `درست است! ${how}` };
    case "leadingZero":
      return {
        tone: "turned",
        text:
          q.type === "divisible"
            ? `نزدیک بود! با صفر در اول، عدد یک رقم کمتر می‌شود؛ صفر نمی‌تواند رقم اول باشد. ${right}`
            : q.type === "match"
              ? `عدد دورقمی با صفر شروع نمی‌شود. ${right}`
              : `نزدیک بود! عددی که با صفر شروع شود، ${q.type === "extreme" && q.want === "diff" ? "یک رقم کمتر دارد؛ کوچک‌ترین عدد با کوچک‌ترین رقم غیرصفر شروع می‌شود" : "دیگر همان تعداد رقم را ندارد"}. ${right}`,
      };
    case "wrongWay":
      if (q.type !== "condition" && q.type !== "extreme") return { tone: "bad", text: right };
      return { tone: "turned", text: `برعکس شد: این ${q.want === "max" ? "کوچک‌ترین" : "بزرگ‌ترین"} عدد${q.type === "condition" ? ` ${COND_FA[q.cond]}` : ""} است، اما پرسش ${wantFa(q.want as "max" | "min")} را می‌خواهد. ${right}` };
    case "order":
      return { tone: "bad", text: `ترتیب رقم‌ها را دوباره نگاه کن. ${right}` };
    case "noCondition":
      return { tone: "turned", text: `نزدیک بود! شرط را فراموش نکن: عدد تو ${q.type === "condition" ? COND_FA[q.cond] : ""} نیست. ${right}` };
    case "notBest":
      return { tone: "turned", text: q.type === "digitSum" ? `مجموع رقم‌هایش درست است، اما ${q.variant === "max4distinct" ? "بزرگ‌ترین" : "کوچک‌ترین"} نیست. ${right}` : `شرط را دارد، اما ${q.type === "condition" ? wantFa(q.want) : ""} نیست. ${right}` };
    case "numbersOnly":
      return { tone: "turned", text: `نزدیک بود! تو عددهایی را شمردی که ${fa((q as { digit: number }).digit)} دارند؛ اما عددی مثل ${fa(11 * (q as { digit: number }).digit)} دو تا ${fa((q as { digit: number }).digit)} دارد و دو بار حساب می‌شود. ${right}` };
    case "onesOnly":
      return { tone: "turned", text: `فقط رقم یکان را شمردی؛ در دهگان${q.type === "count" && q.n >= 100 ? " و صدگان" : ""} هم بشمار. ${right}` };
    case "noHundreds":
      return { tone: "turned", text: `نزدیک بود! یکان و دهگان درست، اما صدگان را جا انداختی. ${right}` };
    case "wrongSum":
      return { tone: "bad", text: `مجموع رقم‌های عدد تو ${fa(String(v).split("").reduce((s, d) => s + Number(d), 0))} است، نه ${fa((q as { sum: number }).sum)}. ${right}` };
    case "reversed":
      return { tone: "turned", text: `رقم‌ها درست‌اند، اما ترتیب برعکس است: برای کوچک‌ترین عدد، رقم کوچک‌تر اول می‌آید. ${right}` };
    case "repeated":
      return { tone: "turned", text: `نزدیک بود! شرط «رقم‌های متفاوت» را فراموش کردی: در عدد تو رقم تکراری هست. ${right}` };
    case "notFour":
      return { tone: "turned", text: `مجموع درست است، اما عدد باید چهاررقمی باشد. ${right}` };
    case "otherValid":
      return { tone: "turned", text: `با ${fa(v)} هم عدد بخش‌پذیر می‌شود، اما ${q.type === "divisible" && q.want === "min" ? "کوچک‌ترین" : "بزرگ‌ترین"} رقم ممکن نیست. ${right}` };
    case "only3":
      return { tone: "turned", text: `نزدیک بود! با ${fa(v)} مجموع رقم‌ها بر ۳ بخش‌پذیر است، اما بر ۹ نه. ${right}` };
    case "partial": {
      if (q.type !== "divisible") return { tone: "bad", text: right };
      const n = Number(q.digits.map((x) => x ?? Number(v)).join(""));
      const failed = RULES[q.divisor].filter((r) => n % r !== 0).map((r) => RULE_FA[r]);
      return { tone: "turned", text: `نیمی از کار درست است؛ اما با ${fa(v)} شرط ${failed.join(" و ")} برقرار نیست. ${right}` };
    }
    case "unreadable":
      return { tone: "bad", text: `با این جابه‌جایی، یکی از شکل‌ها رقم یا علامت درستی نیست. ${right}` };
    case "notTrue": {
      const masks = v.split(".").map(Number);
      const eq = q.type === "match" ? readEquation(q.lens, masks) : null;
      return { tone: "bad", text: eq ? `تو ${equationFa(q as MatchQuestion, masks)} ساختی؛ اما ${ltr(`${fa(eq.a)} ${eq.sign} ${fa(eq.b)} = ${fa(eq.value)}`)}. ${right}` : right };
    }
    case "moves":
      return { tone: "bad", text: `باید دقیقاً ${q.type === "match" ? fa(q.moves) : ""} چوب جابه‌جا شود. ${right}` };
    default:
      return { tone: "bad", text: right };
  }
}

interface Props {
  question: DigitsQuestion;
  type: DigitsQuestionType;
  level: Level;
  /** The answer being built on the board (cards: digits; matchsticks: masks). */
  built: string;
  /** Matchsticks: sticks at the moment. */
  sticks: number[];
  onClear: () => void;
  checked: string | null;
  onCheck: (v: string) => void;
  onType: (t: DigitsQuestionType) => void;
  onLevel: (l: Level) => void;
  onNew: () => void;
}

const padDigits = (q: DigitsQuestion) => (q.type === "divisible" ? 1 : String(q.answer).length + 1);

export function DigitsTryPanel(p: Props) {
  const { question: q, checked } = p;
  const kind = answerKind(q);
  const [num, setNum] = useState(kind === "number" && checked !== null ? checked : "");
  const fb = checked !== null ? feedback(q, checked) : null;
  const done = checked !== null;
  const moved = q.type === "match" ? stickDiff(q.start, p.sticks) : null;
  const need = kind === "cards" ? (q.type === "condition" ? q.use : (q as { cards: number[] }).cards.length) : 0;

  const value = kind === "number" ? num : kind === "cards" ? p.built : p.sticks.join(".");
  const ready = kind === "number" ? !!num : kind === "cards" ? p.built.length === need : moved !== null && moved.removed === moved.added && moved.removed === (q as MatchQuestion).moves;

  return (
    <div className={styles.panel}>
      <div className={styles.types} role="radiogroup" aria-label="نوع پرسش">
        {(Object.keys(DIGITS_TYPE_LABEL) as DigitsQuestionType[]).map((t) => (
          <button key={t} role="radio" aria-checked={p.type === t} onClick={() => p.onType(t)}>
            {DIGITS_TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      <div className={styles.chips} role="radiogroup" aria-label="سطح">
        {([1, 2, 3] as Level[]).map((l) => (
          <button key={l} role="radio" aria-checked={p.level === l} onClick={() => p.onLevel(l)}>
            سطح {fa(l)}
          </button>
        ))}
      </div>

      <p className={styles.prompt}>{digitsPrompt(q)}</p>

      {kind === "number" && <NumberPad value={num} onChange={setNum} disabled={done} maxDigits={padDigits(q)} />}

      {kind === "cards" && (
        <>
          <output className={styles.bigNumber} aria-live="polite" dir="ltr" style={{ textAlign: "center" }}>
            {p.built ? fa(p.built) : "؟"}
          </output>
          {!done && (
            <>
              <p className={styles.hint}>روی کارت‌های پایین صفحه بزن تا به ترتیب در خانه‌ها بنشینند؛ برای برگرداندن، روی کارت بالا بزن.</p>
              <button className={styles.secondary} onClick={p.onClear} disabled={!p.built}>
                برگرداندن همه کارت‌ها
              </button>
            </>
          )}
        </>
      )}

      {kind === "match" && q.type === "match" && (
        <>
          <p className={styles.bigNumber} dir="ltr" style={{ textAlign: "center", margin: 0 }}>
            {equationFa(q, p.sticks) ?? "؟"}
          </p>
          {!done && (
            <>
              <p className={styles.hint}>
                روی یک چوب بزن تا بلند شود، بعد روی یک جای خالی (خط‌چین) بزن. جابه‌جایی: {fa(moved!.removed)} از {fa(q.moves)}.
              </p>
              <button className={styles.secondary} onClick={p.onClear} disabled={moved!.removed === 0 && moved!.added === 0}>
                از نو
              </button>
            </>
          )}
        </>
      )}

      {!done && (
        <button className={styles.secondary} disabled={!ready} onClick={() => p.onCheck(value)}>
          بررسی
        </button>
      )}

      {fb && (
        <p className={`${styles.feedback} ${styles[fb.tone]}`} role="status" aria-live="polite">
          <span className={styles.icon}>{ICON[fb.tone]}</span> {fb.text}
        </p>
      )}
      {done && q.type === "count" && <p className={styles.hint}>روی صفحه: یکان با مربع، دهگان با خط زیر، صدگان با دایره. با نوار پایین، دسته‌ها یکی‌یکی نشان داده می‌شوند.</p>}
      {done && q.type === "match" && <p className={styles.hint}>روی صفحه، {q.moves === 1 ? "چوب" : "چوب‌ها"} از جای قبلی به جای درست می‌روند؛ با نوار پایین جلو و عقب ببر.</p>}

      <button className={styles.next} onClick={p.onNew}>
        نمونه تازه
      </button>
    </div>
  );
}


"use client";

// «کد دودویی» for tool 18, taught with cards (Bebras style): a row of cards
// worth ۱۶ ۸ ۴ ۲ ۱, each face up (lamp on ●, dots showing) or face down (lamp
// off ○, hatched back). The row is always drawn and written left to right,
// the biggest card on the left, even inside Persian text. Here: the words
// (prompts, working, feedback naming the slip), the card pictures, explore,
// show me (greedy, from the biggest card) and the try-it panel.
// Nothing relies on colour: a face-up card has dots and its number, a face-down
// card is hatched and empty, and each card has ● / ○ and ۱ / ۰ under it.

import { useEffect, useId, useState } from "react";
import { ALPHABET } from "@/generators/codes";
import {
  answerKindOf,
  binaryMistake,
  binaryString,
  bitsOf,
  CARDS,
  cardValues,
  greedySteps,
  isOn,
  letterMarks,
  MAX,
  maskOfLetter,
  onValues,
  wordMistake,
  type BinaryQuestion,
  type BinaryTag,
  type Level,
} from "@/generators/binary-code";
import { NumberPad } from "@/toolkit/NumberPad";
import { fa } from "@/tools/registry";
import layout from "@/toolkit/ToolLayout.module.css";
import styles from "@/toolkit/TryPanel.module.css";
import { ltr, TRY_TYPE_LABEL, type TryType } from "./CodesTryPanel";
import { AnswerSlots, LetterKeyboard } from "./Inputs";

const INK = "#1f2430";
const SOFT = "#5b6170";
const ACCENT = "#3d7bf7";
const BACK = "#d5dae4";
const LIT = "#ffd84d";

const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
function useSvgId(prefix: string) {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

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
const cardsFa = (cards: number) =>
  cardValues(cards)
    .map((v) => fa(v))
    .join(" ");
/** "۱، ۲، ۴ … ۶۴": the card values, smallest first. */
const cardListFa = (k: number) =>
  k <= 4
    ? cardValues(k)
        .reverse()
        .map((v) => fa(v))
        .join("، ")
    : `۱، ۲، ۴ … ${fa(2 ** (k - 1))}`;
const allOnFa = (k: number) =>
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

type Tone = "good" | "turned" | "bad";
const ICON: Record<Tone, string> = { good: "✓", turned: "↻", bad: "✗" };

/** What the pupil gave: a number (read, howMany, largest), a mask (show, next) or letters (word). */
export type BinaryValue = number | (number | null)[];

export function binaryFeedback(q: BinaryQuestion, v: BinaryValue): { tone: Tone; text: string } {
  const how = binaryHow(q);
  const tag: BinaryTag = Array.isArray(v) ? wordMistake(q, v) : binaryMistake(q, v);
  const num = typeof v === "number" ? v : 0;
  const k = q.n;
  const slip = (text: string) => ({
    tone: "turned" as const,
    text: `نزدیک بود! ${text} ${how}`,
  });
  switch (tag) {
    case "right":
      return { tone: "good", text: `درست است! ${how}` };
    case "rtl":
      return slip(
        q.kind === "next"
          ? "از سمت چپ شمردی، انگار کارت ۱ سمت چپ است. کارت ۱ سمت راست است؛ یکی اضافه کردن از راست شروع می‌شود."
          : q.kind === "word"
            ? "لامپ‌ها را از راست به چپ خواندی، مثل متن فارسی. کد دودویی از چپ به راست است: کارت ۱۶ سمت چپ، کارت ۱ سمت راست."
            : `ردیف را از راست به چپ ${q.kind === "show" ? "چیدی" : "خواندی"}، مثل متن فارسی. کد دودویی مثل عددها از چپ به راست است: کارت ۱۶ سمت چپ، کارت ۱ سمت راست.`,
      );
    case "positions":
      return slip(
        q.kind === "largest"
          ? `شماره جای کارت‌ها را جمع زدی (${ltr(Array.from({ length: k }, (_, i) => fa(i + 1)).join(" + "))})، نه ارزششان. ارزش کارت‌ها ${cardListFa(k)} است.`
          : "شماره جای کارت‌ها (۱، ۲، ۳، ۴، ۵ از راست) را جمع زدی، نه ارزششان. هر کارت به اندازه نقطه‌هایش می‌ارزد: ۱، ۲، ۴، ۸، ۱۶.",
      );
    case "pow10":
      return slip(
        q.kind === "read"
          ? `${fa(num)} یعنی صفر و یک‌ها را مثل عدد معمولی (یکان، دهگان، صدگان …) خواندی. ارزش کارت‌ها ده‌برابر نمی‌شود، دوبرابر می‌شود: ۱، ۲، ۴، ۸، ۱۶.`
          : q.kind === "howMany"
            ? `${fa(num)} تعداد رقم‌های ${fa(q.n)} است. ولی هر لامپ مثل یک رقم ۰ تا ۹ نیست؛ فقط دو حالت دارد (روشن یا خاموش)، پس لامپ بیشتری لازم است.`
            : `${fa(num)} بزرگ‌ترین عدد ${fa(k)} رقمی معمولی است. ولی کارت‌ها ۱، ۲، ۴ … هستند، نه ۱، ۱۰، ۱۰۰ ….`,
      );
    case "pow2":
      return slip(
        q.kind === "largest"
          ? `${fa(num)} ارزش کارت بعدی است که نداریم. وقتی همه ${fa(k)} کارت روشن‌اند، جمعشان یکی کمتر از آن است.`
          : `با ${fa(num)} کارت بزرگ‌ترین عدد ${fa(2 ** num - 1)} است، نه ${fa(2 ** num)}؛ پس ${fa(q.n)} یک کارت دیگر لازم دارد.`,
      );
    case "count":
      return slip(
        q.kind === "largest" ? "تعداد کارت‌ها را گفتی، نه بزرگ‌ترین عدد. همه کارت‌ها را روشن کن و ارزششان را جمع بزن." : `${fa(num)} تعداد کارت‌های روشن است. باید ارزش کارت‌های روشن را جمع بزنی.`,
      );
    case "biggest":
      return slip("فقط ارزش بزرگ‌ترین کارت را گفتی. وقتی همه کارت‌ها روشن‌اند، ارزش همه با هم جمع می‌شود.");
    case "perNumber":
      return slip("برای هر عدد یک لامپ جدا لازم نیست. با روشن و خاموش کردن چند لامپ با هم، عددهای زیادی ساخته می‌شود.");
    case "noCarry":
      return slip("یک کارت را روشن کردی ولی کارت‌های روشنِ سمت راستش را خاموش نکردی. وقتی کارتی برای «یکی بیشتر» روشن می‌شود، همه کارت‌های کوچک‌تر خاموش می‌شوند.");
    case "zeroBased":
      return slip("ا را ۰ گرفتی؛ اینجا ا = ۱ است، پس حرف‌هایت یکی جلوتر افتاده‌اند.");
    default: {
      if (q.kind === "show" || q.kind === "next") {
        const target = q.answer;
        const diff = num > target ? "بیشتر" : "کمتر";
        return {
          tone: "bad",
          text: `کارت‌های روشن تو ${sumFa(num)} را نشان می‌دهند که ${fa(Math.abs(num - target))} تا ${diff} از ${fa(target)} است. ${how}`,
        };
      }
      if (q.kind === "word" && Array.isArray(v)) {
        const right = letterMarks(q, v).filter(Boolean).length;
        return {
          tone: "bad",
          text: `${fa(right)} حرف از ${fa(q.word.length)} حرف درست است. ${how}`,
        };
      }
      return { tone: "bad", text: `هنوز نه. ${how}` };
    }
  }
}

// ───────────── pictures ─────────────

/** Where the dots of a card sit, in a box w × h. */
function dotGrid(v: number, w: number, h: number) {
  const cols = v <= 2 ? v : v <= 4 ? 2 : v <= 9 ? 3 : v <= 16 ? 4 : 8;
  const rows = Math.ceil(v / cols);
  const cw = w / cols;
  const ch = h / rows;
  const r = r4(Math.min(cw, ch) * 0.3);
  return Array.from({ length: v }, (_, i) => ({
    x: r4(cw * ((i % cols) + 0.5)),
    y: r4(ch * (Math.floor(i / cols) + 0.5)),
    r,
  }));
}

export interface CardRowProps {
  cards?: number;
  mask: number;
  /** Centre of the row and the top of the cards. */
  cx: number;
  y: number;
  /** Card width (height is 1.3 ×). */
  w?: number;
  gap?: number;
  onFlip?: (bit: number) => void;
  /** ✓ / ✗ under each card (bit → right?). */
  marks?: boolean[];
  /** The card being worked on: thick dashed frame and ▼. */
  focus?: number | null;
  /** Show me: cards from this bit down are not decided yet (drawn as «؟»). */
  undecidedBelow?: number;
  /** After +1: cards that changed, with «روشن شد» / «خاموش شد». */
  changed?: number;
  /** No ۱/۰ digit under the lamps. */
  noDigits?: boolean;
  label?: string;
}

export const cardRowWidth = (cards: number, w: number, gap: number) => r4(cards * w + (cards - 1) * gap);

/** A row of cards, biggest on the left: value on top, the card, then the lamp ● / ○ and ۱ / ۰. */
export function CardRow({ cards = CARDS, mask, cx, y, w = 2.4, gap = 0.4, onFlip, marks, focus = null, undecidedBelow = -1, changed = 0, noDigits = false, label }: CardRowProps) {
  const id = useSvgId("bin");
  const h = r4(w * 1.3);
  const x0 = r4(cx - cardRowWidth(cards, w, gap) / 2);
  const fs = r4(Math.min(0.55, w * 0.26));
  const lampR = r4(Math.min(0.34, w * 0.14));
  return (
    <g>
      <defs>
        <pattern id={`${id}h`} width={0.22} height={0.22} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={0.22} stroke={SOFT} strokeWidth={0.05} />
        </pattern>
      </defs>
      {label && (
        <text x={r4(x0 + cardRowWidth(cards, w, gap) + 0.25)} y={r4(y + h / 2)} fontSize={0.38} fontWeight={700} textAnchor="start" dominantBaseline="central" fill={SOFT}>
          {label}
        </text>
      )}
      {cardValues(cards).map((value, i) => {
        const bit = cards - 1 - i;
        const x = r4(x0 + i * (w + gap));
        const on = isOn(mask, bit);
        const undecided = bit <= undecidedBelow;
        const lampY = r4(y + h + lampR + 0.2);
        const digitY = r4(lampY + lampR + fs * 0.75);
        const markY = r4((noDigits ? lampY + lampR : digitY + fs * 0.6) + fs * 0.8);
        const pad = r4(w * 0.12);
        const dots = value <= 64 ? dotGrid(value, w - 2 * pad, h - 2 * pad - fs * 1.1) : [];
        const flip = onFlip ? () => onFlip(bit) : undefined;
        return (
          <g key={bit} onClick={flip} style={flip ? { cursor: "pointer" } : undefined} role={flip ? "button" : undefined} aria-label={flip ? `کارت ${fa(value)}، ${on ? "روشن" : "خاموش"}` : undefined}>
            {/* value over the card */}
            <text x={r4(x + w / 2)} y={r4(y - fs * 0.75)} fontSize={fs} fontWeight={800} textAnchor="middle" dominantBaseline="central" fill={INK}>
              {fa(value)}
            </text>
            {undecided ? (
              <>
                <rect x={x} y={y} width={w} height={h} rx={0.18} fill="#fff" stroke={SOFT} strokeWidth={0.05} strokeDasharray="0.18 0.14" />
                <text x={r4(x + w / 2)} y={r4(y + h / 2)} fontSize={r4(fs * 1.4)} fontWeight={800} textAnchor="middle" dominantBaseline="central" fill={SOFT}>
                  ؟
                </text>
              </>
            ) : on ? (
              <>
                <rect x={x} y={y} width={w} height={h} rx={0.18} fill="#fff" stroke={INK} strokeWidth={0.07} />
                <text x={r4(x + pad)} y={r4(y + pad + fs * 0.45)} fontSize={r4(fs * 0.8)} fontWeight={800} textAnchor="start" dominantBaseline="central" fill={INK}>
                  {fa(value)}
                </text>
                {dots.length > 0 ? (
                  <g transform={`translate(${x + pad} ${r4(y + pad + fs * 1.1)})`}>
                    {dots.map((d, k) => (
                      <circle key={k} cx={d.x} cy={d.y} r={d.r} fill={INK} />
                    ))}
                  </g>
                ) : null}
              </>
            ) : (
              <>
                <rect x={x} y={y} width={w} height={h} rx={0.18} fill={BACK} stroke={INK} strokeWidth={0.05} />
                <rect x={r4(x + pad)} y={r4(y + pad)} width={r4(w - 2 * pad)} height={r4(h - 2 * pad)} rx={0.1} fill={`url(#${id}h)`} stroke={SOFT} strokeWidth={0.03} />
              </>
            )}
            {focus === bit && <rect x={r4(x - 0.12)} y={r4(y - 0.12)} width={r4(w + 0.24)} height={r4(h + 0.24)} rx={0.26} fill="none" stroke={ACCENT} strokeWidth={0.09} strokeDasharray="0.3 0.15" />}
            {/* the lamp: rays when on, an empty ring when off */}
            {!undecided && (
              <g>
                {on &&
                  Array.from({ length: 8 }, (_, k) => {
                    const a = (k * Math.PI) / 4;
                    const c = Math.cos(a);
                    const s = Math.sin(a);
                    return (
                      <line
                        key={k}
                        x1={r4(x + w / 2 + c * lampR * 1.25)}
                        y1={r4(lampY + s * lampR * 1.25)}
                        x2={r4(x + w / 2 + c * lampR * 1.7)}
                        y2={r4(lampY + s * lampR * 1.7)}
                        stroke={INK}
                        strokeWidth={0.04}
                      />
                    );
                  })}
                <circle cx={r4(x + w / 2)} cy={lampY} r={lampR} fill={on ? LIT : "#fff"} stroke={INK} strokeWidth={on ? 0.07 : 0.05} />
                {on && <circle cx={r4(x + w / 2)} cy={lampY} r={r4(lampR * 0.45)} fill={INK} />}
                {!noDigits && (
                  <text x={r4(x + w / 2)} y={digitY} fontSize={fs} fontWeight={800} textAnchor="middle" dominantBaseline="central" fill={INK}>
                    {on ? "۱" : "۰"}
                  </text>
                )}
              </g>
            )}
            {(changed >> bit) & 1 ? (
              <text x={r4(x + w / 2)} y={markY} fontSize={r4(fs * 0.62)} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={ACCENT}>
                {on ? "↑ روشن شد" : "↓ خاموش شد"}
              </text>
            ) : null}
            {marks && (
              <text x={r4(x + w / 2)} y={markY} fontSize={fs} fontWeight={800} textAnchor="middle" dominantBaseline="central" fill={INK}>
                {marks[i] ? "✓" : "✗"}
              </text>
            )}
            {/* a bigger, invisible tap target */}
            {flip && <rect x={r4(x - gap / 2)} y={r4(y - fs * 1.5)} width={r4(w + gap)} height={r4(h + fs * 1.5 + lampR * 2 + 0.3)} fill="transparent" />}
          </g>
        );
      })}
    </g>
  );
}

/** A small row of lamps for one letter of a word: ● ○ circles, left to right. */
function LampRow({ mask, x, y, r = 0.32, gap = 0.18 }: { mask: number; x: number; y: number; r?: number; gap?: number }) {
  return (
    <g>
      {bitsOf(mask).map((on, i) => {
        const cx = r4(x + r + i * (2 * r + gap));
        return (
          <g key={i}>
            <circle cx={cx} cy={y} r={r} fill={on ? LIT : "#fff"} stroke={INK} strokeWidth={on ? 0.07 : 0.05} />
            {on && <circle cx={cx} cy={y} r={r4(r * 0.45)} fill={INK} />}
          </g>
        );
      })}
    </g>
  );
}
const lampRowWidth = (r = 0.32, gap = 0.18) => r4(CARDS * 2 * r + (CARDS - 1) * gap);

/** Word question: one lamp row per letter, top to bottom, with the card values over them and a letter box at the right. */
function WordRows({ q, letters, marks, active, onSlot }: { q: BinaryQuestion; letters: (number | null)[]; marks?: boolean[]; active?: number; onSlot?: (i: number) => void }) {
  const r = 0.36;
  const gap = 0.22;
  const width = lampRowWidth(r, gap);
  const x = r4(8 - (width + 2.2) / 2);
  const rowH = q.word.length > 3 ? 1.55 : 1.8;
  const y0 = 2.2;
  return (
    <g>
      {cardValues().map((v, i) => (
        <text key={v} x={r4(x + r + i * (2 * r + gap))} y={1.25} fontSize={0.42} fontWeight={800} textAnchor="middle" dominantBaseline="central" fill={INK}>
          {fa(v)}
        </text>
      ))}
      {q.word.map((l, k) => {
        const y = r4(y0 + k * rowH);
        const bx = r4(x + width + 0.6);
        const v = letters[k];
        return (
          <g key={k} onClick={onSlot ? () => onSlot(k) : undefined} style={onSlot ? { cursor: "pointer" } : undefined}>
            <LampRow mask={maskOfLetter(l)} x={x} y={y} r={r} gap={gap} />
            <text x={r4(bx - 0.3)} y={y} fontSize={0.5} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={SOFT}>
              →
            </text>
            <rect
              x={bx}
              y={r4(y - 0.55)}
              width={1.1}
              height={1.1}
              rx={0.15}
              fill="#fff"
              stroke={active === k ? ACCENT : INK}
              strokeWidth={active === k ? 0.1 : 0.05}
              strokeDasharray={active === k ? "0.2 0.12" : undefined}
            />
            <text x={r4(bx + 0.55)} y={y} fontSize={0.65} fontWeight={800} textAnchor="middle" dominantBaseline="central" fill={INK}>
              {v === null || v === undefined ? "" : ALPHABET[v]}
            </text>
            {marks && (
              <text x={r4(bx + 1.5)} y={y} fontSize={0.5} fontWeight={800} textAnchor="middle" dominantBaseline="central" fill={INK}>
                {marks[k] ? "✓" : "✗"}
              </text>
            )}
            <text x={r4(x - 0.35)} y={y} fontSize={0.36} fontWeight={700} textAnchor="end" dominantBaseline="central" fill={SOFT}>
              {fa(k + 1)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

const Caption = ({ y, children, size = 0.5 }: { y: number; children: string; size?: number }) => (
  <text x={8} y={y} fontSize={size} fontWeight={800} textAnchor="middle" dominantBaseline="central" fill={INK}>
    {children}
  </text>
);

// ───────────── explore and show me ─────────────

/** Explore: flip cards, +1 to count; the cards a +1 changed are labelled. */
export function useBinaryExplore() {
  // One state, so a +1 and the cards it changed always go together.
  const [state, setState] = useState({ mask: 13, changed: 0 });
  const [auto, setAuto] = useState(false);
  const { mask, changed } = state;
  const setMask = (m: number) => setState({ mask: m & MAX, changed: 0 });
  const plusOne = (m: number) => ({ mask: (m + 1) & MAX, changed: m ^ ((m + 1) & MAX) });
  const step = () => setState((st) => plusOne(st.mask));
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setState((st) => plusOne(st.mask)), 1100);
    return () => clearInterval(t);
  }, [auto]);
  return {
    mask,
    setMask,
    flip: (bit: number) => setMask(mask ^ (1 << bit)),
    step,
    changed,
    auto,
    setAuto,
  };
}
export type BinaryExplore = ReturnType<typeof useBinaryExplore>;

export function BinaryExploreBoard({ ex }: { ex: BinaryExplore }) {
  return (
    <>
      <CardRow mask={ex.mask} cx={8} y={1.2} onFlip={ex.flip} changed={ex.changed} />
      <Caption y={7.35} size={0.6}>{`${sumFa(ex.mask)}`}</Caption>
      <Caption y={8.3} size={0.42}>{`کد: ${binFa(ex.mask)} (از چپ به راست)`}</Caption>
    </>
  );
}

/** Buttons for the cards, left to right (also the try-it input on phones). */
export function CardToggles({ mask, onFlip, disabled }: { mask: number; onFlip: (bit: number) => void; disabled?: boolean }) {
  return (
    <div className={layout.row} dir="ltr" role="group" aria-label="کارت‌ها، از چپ به راست" style={{ gap: 4 }}>
      {cardValues().map((v, i) => {
        const bit = CARDS - 1 - i;
        const on = isOn(mask, bit);
        return (
          <button
            key={v}
            className={layout.toggle}
            aria-pressed={on}
            onClick={() => onFlip(bit)}
            disabled={disabled}
            style={{
              flex: 1,
              minHeight: 44,
              minWidth: 0,
              padding: "2px 0",
              fontWeight: 800,
            }}
            aria-label={`کارت ${fa(v)}: ${on ? "روشن" : "خاموش"}`}
          >
            {fa(v)}
            <br />
            {on ? "●" : "○"}
          </button>
        );
      })}
    </div>
  );
}

export function BinaryExplorePanel({ ex }: { ex: BinaryExplore }) {
  const wrapped = ex.mask === 0 && ex.changed === MAX;
  return (
    <>
      <p className={layout.note}>{LTR_NOTE}</p>
      <h2 className={layout.progress}>روی کارت‌ها بزن تا برگردند</h2>
      <CardToggles mask={ex.mask} onFlip={ex.flip} />
      <p className={`${layout.status} ${layout.info}`} aria-live="polite">
        {sumFa(ex.mask)} · کد {binFa(ex.mask)}
      </p>
      <h2 className={layout.progress}>شمردن: یکی‌یکی بیشتر</h2>
      <div className={layout.row}>
        <button className={layout.clear} onClick={ex.step}>
          {ltr("+۱")}
        </button>
        <button className={layout.toggle} aria-pressed={ex.auto} onClick={() => ex.setAuto(!ex.auto)}>
          {ex.auto ? "⏸ توقف" : "▶ شمردن خودکار"}
        </button>
        <button className={layout.clear} onClick={() => ex.setMask(0)}>
          صفر
        </button>
      </div>
      <p className={layout.note}>
        {wrapped
          ? "۳۱ بزرگ‌ترین عدد با پنج کارت است (همه روشن). یکی بیشتر، همه را خاموش می‌کند؛ برای ۳۲ کارت ششم لازم است."
          : "بعد از «+۱» ببین کدام کارت‌ها برگشتند: از راست، کارت‌های روشن خاموش می‌شوند تا به اولین کارت خاموش برسی؛ آن روشن می‌شود. مثل ۹ + ۱ = ۱۰ در عددهای معمولی."}
      </p>
      <p className={layout.note}>کارت ۱ در هر «+۱» برمی‌گردد، کارت ۲ هر دو بار، کارت ۴ هر چهار بار… الگو را دنبال کن.</p>
    </>
  );
}

/** Show me after k cards decided (0 … 5). */
export const greedyDecided = (f: number) => Math.min(CARDS, Math.floor(f * (CARDS + 1)));

export function BinaryShowBoard({ n, f }: { n: number; f: number }) {
  const k = greedyDecided(f);
  const steps = greedySteps(n);
  const mask = steps.slice(0, k).reduce((m, s) => (s.on ? m | s.value : m), 0);
  const rest = k === 0 ? n : steps[k - 1].after;
  return (
    <>
      <Caption y={0.45} size={0.45}>{`عدد ${fa(n)} را بساز، از بزرگ‌ترین کارت`}</Caption>
      <CardRow mask={mask} cx={8} y={1.6} undecidedBelow={CARDS - 1 - k} focus={k < CARDS ? CARDS - 1 - k : null} />
      <Caption y={7.6} size={0.5}>
        {k < CARDS ? `مانده: ${fa(rest)}` : sumFa(n)}
      </Caption>
      {k > 0 && k < CARDS && (
        <Caption y={8.45} size={0.42}>
          {`کارت ${fa(steps[k - 1].value)}: ${steps[k - 1].on ? "روشن ●" : "خاموش ○"}`}
        </Caption>
      )}
      {k === CARDS && <Caption y={8.45} size={0.42}>{`کد: ${binFa(n)}`}</Caption>}
    </>
  );
}

export function BinaryShowPanel({ n, f, onN }: { n: number; f: number; onN: (n: number) => void }) {
  const k = greedyDecided(f);
  const steps = greedySteps(n);
  return (
    <>
      <h2>ساختن عدد با کارت‌ها</h2>
      <div className={layout.row} style={{ flex: 1 }}>
        <button className={layout.clear} onClick={() => onN(n - 1)} disabled={n <= 1} aria-label="کمتر">
          −
        </button>
        <span className={layout.stepperLabel}>عدد {fa(n)}</span>
        <button className={layout.clear} onClick={() => onN(n + 1)} disabled={n >= MAX} aria-label="بیشتر">
          +
        </button>
      </div>
      <p className={layout.note}>از بزرگ‌ترین کارت شروع کن: اگر در «مانده» جا می‌شود روشنش کن و از مانده کم کن؛ اگر نه، خاموش بماند. {LTR_NOTE}</p>
      <table className={layout.countTable}>
        <thead>
          <tr>
            <th>کارت</th>
            <th>مانده</th>
            <th>روشن؟</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((s, i) => (
            <tr key={s.value} aria-current={i === k - 1 ? "step" : undefined}>
              <td>{fa(s.value)}</td>
              <td>{i < k ? fa(s.before) : "…"}</td>
              <td>{i < k ? (s.on ? `● بله؛ مانده ${fa(s.after)}` : "○ نه") : "؟"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

// ───────────── try it ─────────────

export interface BinaryEntry {
  key: string;
  num: string;
  lamps: number;
  letters: (number | null)[];
  active: number;
  /** The checked answer, or null. */
  checked: BinaryValue | null;
}

export const binaryKey = (q: BinaryQuestion) => `${q.level}-${q.seed}`;
export const blankBinary = (q: BinaryQuestion): BinaryEntry => ({
  key: binaryKey(q),
  num: "",
  lamps: q.kind === "next" ? q.n : 0,
  letters: q.word.map(() => null),
  active: 0,
  checked: null,
});

/** The answer in a link: a number, the lamps as 0s and 1s, or letter places joined by ".". */
export function binaryFromLink(q: BinaryQuestion, a: string): BinaryEntry | null {
  const e = blankBinary(q);
  const kind = answerKindOf(q.kind);
  if (kind === "number" && /^[0-9]{1,6}$/.test(a)) return { ...e, num: String(Number(a)), checked: Number(a) };
  if (kind === "lamps" && /^[01]{5}$/.test(a)) {
    const m = parseInt(a, 2);
    return { ...e, lamps: m, checked: m };
  }
  if (kind === "letters") {
    const ls = a.split(".").map(Number);
    if (ls.length === q.word.length && ls.every((x) => Number.isInteger(x) && x >= 0 && x < ALPHABET.length)) return { ...e, letters: ls, checked: ls };
  }
  return null;
}

/** The board of a binary question, before or after the check. */
export function BinaryTryBoard({ q, entry, onEntry }: { q: BinaryQuestion; entry: BinaryEntry; onEntry: (e: BinaryEntry) => void }) {
  const done = entry.checked !== null;
  switch (q.kind) {
    case "read":
      return (
        <>
          <CardRow mask={q.n} cx={8} y={1.2} />
          <Caption y={7.4} size={0.55}>
            {done ? sumFa(q.n) : "این لامپ‌ها چه عددی را نشان می‌دهند؟"}
          </Caption>
          {done && <Caption y={8.35} size={0.42}>{`جواب تو: ${fa(entry.checked as number)} ${entry.checked === q.answer ? "✓" : "✗"}`}</Caption>}
        </>
      );
    case "show":
    case "next": {
      const flip = (bit: number) => onEntry({ ...entry, lamps: entry.lamps ^ (1 << bit) });
      if (!done)
        return q.kind === "show" ? (
          <>
            <Caption y={0.45} size={0.5}>{`عدد ${fa(q.n)} را نشان بده`}</Caption>
            <CardRow mask={entry.lamps} cx={8} y={1.6} onFlip={flip} />
            <Caption y={7.75} size={0.4}>
              روی کارت‌ها بزن تا برگردند
            </Caption>
          </>
        ) : (
          <>
            <CardRow mask={q.n} cx={8} y={0.75} w={1.15} gap={0.25} label="این عدد" noDigits />
            <CardRow mask={entry.lamps} cx={8} y={3.5} w={1.9} gap={0.35} onFlip={flip} label="عدد بعدی" />
          </>
        );
      const mine = entry.checked as number;
      const marks = bitsOf(mine).map((b, i) => b === bitsOf(q.answer)[i]);
      return (
        <>
          <CardRow mask={mine} cx={8} y={0.75} w={1.5} gap={0.3} marks={marks} label="جواب تو" />
          <CardRow mask={q.answer} cx={8} y={5.0} w={1.5} gap={0.3} label="درست" />
          <Caption y={8.75} size={0.42}>{sumFa(q.answer)}</Caption>
        </>
      );
    }
    case "howMany": {
      const k = q.answer;
      return done ? (
        <>
          <CardRow cards={k} mask={2 ** k - 1} cx={8} y={1.2} w={Math.min(2.2, 13 / k - 0.3)} gap={0.3} />
          <Caption y={7.4} size={0.5}>{allOnFa(k)}</Caption>
          <Caption y={8.35} size={0.42}>{`${fa(k)} کارت تا ${fa(2 ** k - 1)} می‌رسد · جواب تو: ${fa(entry.checked as number)} ${entry.checked === q.answer ? "✓" : "✗"}`}</Caption>
        </>
      ) : (
        <>
          <CardRow cards={4} mask={0} cx={7} y={1.4} w={2} gap={0.4} />
          <text x={1.8} y={2.7} fontSize={0.8} fontWeight={800} textAnchor="middle" dominantBaseline="central" fill={INK}>
            …
          </text>
          <Caption y={7.6} size={0.5}>{`همه عددهای ۱ تا ${fa(q.n)}: چند کارت؟`}</Caption>
        </>
      );
    }
    case "largest": {
      const k = q.n;
      const w = Math.min(2.2, 13 / k - 0.3);
      return (
        <>
          <CardRow cards={k} mask={done ? 2 ** k - 1 : 0} cx={8} y={1.2} w={w} gap={0.3} />
          <Caption y={7.4} size={0.5}>
            {done ? allOnFa(k) : `بزرگ‌ترین عدد با ${fa(k)} کارت؟`}
          </Caption>
          {done && <Caption y={8.35} size={0.42}>{`جواب تو: ${fa(entry.checked as number)} ${entry.checked === q.answer ? "✓" : "✗"}`}</Caption>}
        </>
      );
    }
    case "word": {
      const letters = done ? (entry.checked as (number | null)[]) : entry.letters;
      return (
        <WordRows
          q={q}
          letters={letters}
          marks={done ? letterMarks(q, letters) : undefined}
          active={done ? undefined : entry.active}
          onSlot={done ? undefined : (i) => onEntry({ ...entry, active: i })}
        />
      );
    }
  }
}

interface PanelProps {
  q: BinaryQuestion;
  level: Level;
  entry: BinaryEntry;
  onEntry: (e: BinaryEntry) => void;
  onType: (t: TryType) => void;
  onLevel: (l: Level) => void;
  onNew: () => void;
}

export function BinaryTryPanel({ q, level, entry, onEntry, onType, onLevel, onNew }: PanelProps) {
  const kind = answerKindOf(q.kind);
  const done = entry.checked !== null;
  const fb = done ? binaryFeedback(q, entry.checked!) : null;
  const full = kind === "number" ? entry.num !== "" : kind === "letters" ? entry.letters.every((x) => x !== null) : true;
  const value: BinaryValue = kind === "number" ? Number(entry.num) : kind === "lamps" ? entry.lamps : entry.letters;

  const putLetter = (l: number | null, advance: boolean) => {
    const letters = [...entry.letters];
    letters[entry.active] = l;
    const next = advance ? Math.min(letters.length - 1, entry.active + 1) : entry.active;
    onEntry({ ...entry, letters, active: next });
  };
  const back = () => {
    if (entry.letters[entry.active] !== null) return putLetter(null, false);
    if (entry.active === 0) return;
    const letters = [...entry.letters];
    letters[entry.active - 1] = null;
    onEntry({ ...entry, letters, active: entry.active - 1 });
  };

  return (
    <div className={styles.panel}>
      <div className={styles.types} role="radiogroup" aria-label="نوع رمز" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        {(Object.keys(TRY_TYPE_LABEL) as TryType[]).map((t) => (
          <button key={t} role="radio" aria-checked={t === "binary"} onClick={() => onType(t)}>
            {TRY_TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      <div className={styles.chips} role="radiogroup" aria-label="سطح">
        {([1, 2, 3] as Level[]).map((l) => (
          <button key={l} role="radio" aria-checked={level === l} onClick={() => onLevel(l)}>
            سطح {fa(l)}
          </button>
        ))}
      </div>

      <p className={styles.prompt}>{binaryPrompt(q)}</p>

      {kind === "number" && !done && <NumberPad value={entry.num} onChange={(v) => onEntry({ ...entry, num: v })} maxDigits={5} />}
      {kind === "lamps" && (
        <>
          <CardToggles mask={done ? (entry.checked as number) : entry.lamps} onFlip={(bit) => onEntry({ ...entry, lamps: entry.lamps ^ (1 << bit) })} disabled={done} />
          <p className={styles.hint}>روی کارت‌های صفحه یا این دکمه‌ها بزن. {LTR_NOTE}</p>
        </>
      )}
      {kind === "letters" && (
        <>
          <AnswerSlots
            tokens={done ? (entry.checked as (number | null)[]) : entry.letters}
            kind="letter"
            active={entry.active}
            onSlot={(i) => onEntry({ ...entry, active: i })}
            marks={done ? letterMarks(q, entry.checked as (number | null)[]) : undefined}
          />
          {!done && <LetterKeyboard onKey={(i) => putLetter(i, true)} onBack={back} />}
        </>
      )}

      {!done && (
        <button
          className={styles.secondary}
          disabled={!full}
          onClick={() =>
            onEntry({
              ...entry,
              checked: kind === "letters" ? [...entry.letters] : value,
            })
          }
        >
          بررسی
        </button>
      )}
      {!done && !full && <p className={styles.hint}>{kind === "letters" ? "همه خانه‌ها را پر کن. روی هر خانه بزنی، نشانگر به آن می‌رود." : "جواب را با دکمه‌ها بنویس."}</p>}

      {fb && (
        <p className={`${styles.feedback} ${styles[fb.tone]}`} role="status" aria-live="polite">
          <span className={styles.icon}>{ICON[fb.tone]}</span> {fb.text}
        </p>
      )}
      {done && fb?.tone !== "good" && (
        <button className={styles.secondary} onClick={() => onEntry({ ...blankBinary(q) })}>
          دوباره امتحان کن
        </button>
      )}

      <button className={styles.next} onClick={onNew}>
        نمونه تازه
      </button>
    </div>
  );
}

// ───────────── paper ─────────────

/** A row of cards for the worksheet (blank: every card a dashed «؟» box to mark ● or ○). */
export function CardRowSvg({ mask, cards = CARDS, blank = false, width = 220 }: { mask: number; cards?: number; blank?: boolean; width?: number }) {
  const w = 2;
  const gap = 0.35;
  const rw = cardRowWidth(cards, w, gap);
  const vb: [number, number, number, number] = [-0.3, -0.9, r4(rw + 0.6), 4.8];
  return (
    <svg
      viewBox={vb.join(" ")}
      width={width}
      height={Math.round((width * vb[3]) / vb[2])}
      style={{ direction: "ltr" }}
      role="img"
      aria-label={blank ? "کارت‌های خالی" : `کارت‌ها: ${binaryString(mask, cards)}`}
    >
      <CardRow cards={cards} mask={mask} cx={r4(rw / 2)} y={0} w={w} gap={gap} undecidedBelow={blank ? cards - 1 : -1} />
    </svg>
  );
}

/** Worksheet: the letters of a word question, each as a row of lamps with an empty box. */
export function WordLampsSvg({ q, width = 200 }: { q: BinaryQuestion; width?: number }) {
  const rowH = 1.2;
  const vb: [number, number, number, number] = [0, 0, 6.4, r4(0.9 + q.word.length * rowH)];
  const r = 0.3;
  const gap = 0.15;
  return (
    <svg viewBox={vb.join(" ")} width={width} height={Math.round((width * vb[3]) / vb[2])} style={{ direction: "ltr" }} role="img" aria-label="لامپ‌های هر حرف">
      {cardValues().map((v, i) => (
        <text key={v} x={r4(0.2 + r + i * (2 * r + gap))} y={0.4} fontSize={0.34} fontWeight={800} textAnchor="middle" dominantBaseline="central" fill={INK}>
          {fa(v)}
        </text>
      ))}
      {q.word.map((l, k) => {
        const y = r4(1.1 + k * rowH);
        return (
          <g key={k}>
            <LampRow mask={maskOfLetter(l)} x={0.2} y={y} r={r} gap={gap} />
            <text x={4.25} y={y} fontSize={0.4} textAnchor="middle" dominantBaseline="central" fill={SOFT}>
              →
            </text>
            <rect x={4.7} y={r4(y - 0.45)} width={0.9} height={0.9} rx={0.1} fill="none" stroke={INK} strokeWidth={0.04} strokeDasharray="0.12 0.08" />
          </g>
        );
      })}
    </svg>
  );
}

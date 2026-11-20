"use client";

import { useState } from "react";
import { countMistake, countOf, GROW, type CountQuestion, type Kind, type Level, type Shape, type ShapeQuestionType, TAPS } from "@/generators/shape-count";
import { NumberPad } from "@/toolkit/NumberPad";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/TryPanel.module.css";

export const COUNT_TYPE_LABEL: Record<ShapeQuestionType, string> = {
  triangle: "شمارش مثلث",
  square: "شمارش مربع",
  rectangle: "شمارش مستطیل",
  segment: "شمارش پاره‌خط",
  angle: "شمارش زاویه",
  growing: "الگوی رشدکننده",
  hidden: "شکل پنهان",
  stroke: "رسم با یک خط",
};

export const KIND_NAME: Record<Kind, string> = { triangle: "مثلث", square: "مربع", rectangle: "مستطیل", segment: "پاره‌خط", angle: "زاویه" };

/** What a shape's smallest parts are called. */
export const PIECE_WORD: Record<Kind, string> = { triangle: "قطعه", square: "خانه", rectangle: "خانه", segment: "تکه", angle: "زاویه کوچک" };

/** Shapes grouped by how many pieces they cover, smallest first. */
export function groupsOf(shapes: Shape[]): { pieces: number; count: number }[] {
  const m = new Map<number, number>();
  for (const s of shapes) m.set(s.pieces, (m.get(s.pieces) ?? 0) + 1);
  return [...m].sort((a, b) => a[0] - b[0]).map(([pieces, count]) => ({ pieces, count }));
}

/** "6 + 4 + 2 + 1 = 13" for the groups. */
export const groupSum = (groups: { count: number }[]) => `${groups.map((g) => fa(g.count)).join(" + ")} = ${fa(groups.reduce((s, g) => s + g.count, 0))}`;

/** How a growing pattern adds up: 1 + 2 + … or 1×1 + 2×2 + … */
export function growRule(q: Extract<CountQuestion, { type: "growing" }>): string {
  const ns = Array.from({ length: q.ask }, (_, i) => i + 1);
  if (q.pattern === "gridSquares") return `هر مرحله، مرحله قبل به‌اضافه n×n: ${ns.map((n) => `${fa(n)}×${fa(n)}`).join(" + ")} = ${fa(q.answer)}`;
  if (q.pattern === "triGridTriangles") {
    const all = ns.map((n) => countOf(GROW.triGridTriangles.stage(n), "triangle"));
    return `تعدادها: ${all.map(fa).join("، ")}. اختلاف‌ها: ${all.slice(1).map((c, i) => fa(c - all[i])).join("، ")}؛ هر مرحله مثلث‌های تازه رو به بالا و رو به پایین اضافه می‌شود.`;
  }
  return `هر مرحله n تا بیشتر از مرحله قبل: ${ns.map(fa).join(" + ")} = ${fa(q.answer)}`;
}

export function countPrompt(q: CountQuestion): string {
  const name = KIND_NAME[q.kind];
  if (q.type === "growing")
    return `در مرحله ۱، ${fa(q.counts[0])}، در مرحله ۲، ${fa(q.counts[1])} و در مرحله ۳، ${fa(q.counts[2])} ${name} هست. در مرحله ${fa(q.ask)} چند ${name} هست؟`;
  switch (q.kind) {
    case "rectangle":
      return "در این شکل چند مستطیل هست؟ (هر مربع هم یک مستطیل است.)";
    case "angle":
      return "چند زاویه با رأس O هست؟ (فقط زاویه‌های کمتر از ۱۸۰ درجه)";
    case "segment":
      return "در این شکل چند پاره‌خط هست؟ (هر پاره‌خط دو سر دارد که روی شکل نقطه‌اند.)";
    default:
      return `در این شکل چند ${name} هست؟`;
  }
}

type Tone = "good" | "turned" | "bad";
const ICON: Record<Tone, string> = { good: "✓", turned: "↻", bad: "✗" };

function feedback(q: CountQuestion, n: number, shapes: Shape[]): { tone: Tone; text: string } {
  const name = KIND_NAME[q.kind];
  const how = q.type === "growing" ? growRule(q) : `شمارش نظام‌مند: ${groupSum(groupsOf(shapes))}.`;
  const mistake = countMistake(q, n);
  if (q.type === "growing" && (mistake === "under" || mistake === "over")) return { tone: "bad", text: `جواب ${fa(q.answer)} است. ${how}` };
  switch (mistake) {
    case "right":
      return { tone: "good", text: `درست است! ${fa(q.answer)} ${name}. ${how}` };
    case "singles":
      return { tone: "turned", text: `نزدیک بود! فقط ${name}‌های کوچک را شمردی؛ ${name}‌هایی که از چند ${PIECE_WORD[q.kind]} ساخته شده‌اند هم هست. جواب ${fa(q.answer)} است. ${how}` };
    case "noSquares":
      return { tone: "turned", text: `نزدیک بود! مربع‌ها را جا انداختی؛ هر مربع هم یک مستطیل است. جواب ${fa(q.answer)} است. ${how}` };
    case "straight":
      return { tone: "turned", text: `نزدیک بود! دو پرتویی که روی یک خط راست‌اند (۱۸۰ درجه) زاویه حساب نمی‌شوند. جواب ${fa(q.answer)} است. ${how}` };
    case "linear":
      return { tone: "turned", text: `نزدیک بود! الگو هر بار به یک اندازه زیاد نمی‌شود؛ هر مرحله بیشتر از قبل اضافه می‌شود. جواب ${fa(q.answer)} است. ${how}` };
    case "fewMissed":
      return { tone: "turned", text: `نزدیک بود! ${fa(q.answer - n)} تا جا افتاد؛ جواب ${fa(q.answer)} است. ${how}` };
    case "under":
      return { tone: "bad", text: `کمتر شمردی؛ جواب ${fa(q.answer)} است. اول کوچک‌ها را بشمار، بعد آن‌هایی که از ۲ ${PIECE_WORD[q.kind]} ساخته شده‌اند و همین‌طور تا آخر. ${how}` };
    case "over":
      return { tone: "bad", text: `بیشتر شمردی؛ جواب ${fa(q.answer)} است. شاید شکلی را دو بار شمردی؛ با شمارش نظام‌مند هر شکل یک بار شمرده می‌شود. ${how}` };
  }
}

interface Props {
  question: CountQuestion;
  type: ShapeQuestionType;
  level: Level;
  /** Every shape in the figure, in showing order. */
  shapes: Shape[];
  /** Shapes the child marked on the board. */
  marked: Shape[];
  initialAnswer?: number;
  onType: (t: ShapeQuestionType) => void;
  onLevel: (l: Level) => void;
  onNew: () => void;
  /** «بررسی» pressed: the number typed in. */
  onAnswered: (n: number) => void;
  /** Mock exam: record the answer, show nothing about it. */
  exam?: boolean;
}

export function CounterTryPanel(p: Props) {
  const { question: q, exam } = p;
  const [value, setValue] = useState(p.initialAnswer !== undefined ? String(p.initialAnswer) : "");
  const [checked, setChecked] = useState(p.initialAnswer !== undefined);
  // In a mock exam a checked answer shows nothing about itself.
  const shown = checked && !exam;
  const fb = shown && value ? feedback(q, Number(value), p.shapes) : null;
  const ids = new Set(p.marked.map((s) => s.pts.join()));
  const missedMarks = p.marked.length ? p.shapes.filter((s) => !ids.has(s.pts.join())).length : 0;

  return (
    <div className={styles.panel}>
      <div className={styles.types} role="radiogroup" aria-label="نوع پرسش" data-practice-hide>
        {(Object.keys(COUNT_TYPE_LABEL) as ShapeQuestionType[]).map((t) => (
          <button key={t} role="radio" aria-checked={p.type === t} onClick={() => p.onType(t)}>
            {COUNT_TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      <div className={styles.chips} role="radiogroup" aria-label="سطح" data-practice-hide>
        {([1, 2, 3] as Level[]).map((l) => (
          <button key={l} role="radio" aria-checked={p.level === l} onClick={() => p.onLevel(l)}>
            سطح {fa(l)}
          </button>
        ))}
      </div>

      <p className={styles.prompt}>{countPrompt(q)}</p>
      {q.type !== "growing" && !checked && (
        <p className={styles.hint}>
          کمک: روی {fa(TAPS[q.kind])} نقطه بزن تا یک {KIND_NAME[q.kind]} علامت بخورد و شماره بگیرد
          {p.marked.length ? ` (${fa(p.marked.length)} تا علامت زدی).` : "."}
        </p>
      )}

      <NumberPad value={value} onChange={setValue} disabled={checked} />
      {!checked && (
        <button
          className={styles.secondary}
          disabled={!value}
          onClick={() => {
            setChecked(true);
            p.onAnswered(Number(value));
          }}
        >
          بررسی
        </button>
      )}

      {fb && (
        <p className={`${styles.feedback} ${styles[fb.tone]}`} role="status" aria-live="polite">
          <span className={styles.icon}>{ICON[fb.tone]}</span> {fb.text}
        </p>
      )}
      {checked && exam && <p className={styles.hint}>جوابت ثبت شد.</p>}
      {shown && missedMarks > 0 && (
        <p className={styles.hint}>
          تو {fa(p.marked.length)} تا را علامت زده بودی؛ {fa(missedMarks)} تای دیگر روی صفحه با خط‌چین قرمز می‌آیند.
        </p>
      )}
      {shown && <p className={styles.hint}>روی صفحه همه {KIND_NAME[q.kind]}‌ها یکی‌یکی می‌آیند، اول کوچک‌ها؛ با نوار پایین جلو و عقب ببر.</p>}

      <button className={styles.next} onClick={p.onNew}>
        نمونه تازه
      </button>
    </div>
  );
}

"use client";

// «مرتب‌سازی و الگوریتم» for tool 11: the words (questions, working, feedback
// that names the slip), the row of boxes on the board (tap two neighbours to
// swap; a pass is shown comparison by comparison), the robot's number line,
// the explore panel and the try panel.
// Nothing relies on colour: the pair being compared has a bracket and the
// comparison written over it, the decision is written under it («جابه‌جا ⇄»
// or «بمان»), and a chosen box has a thick frame and a ▼ over it.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Step } from "@/generators/number-machine";
import {
  exploreRow,
  inversions,
  isChoice,
  isSorted,
  onePass,
  passSteps,
  programResult,
  programRounds,
  sortMistake,
  sortPasses,
  type Compare,
  type Level,
  type LoopQuestion,
  type PassQuestion,
  type Program,
  type ProgramQuestion,
  type SortQuestion,
  type SortTag,
} from "@/generators/sorting";
import { newSeed } from "@/generators/random";
import { NumberPad } from "@/toolkit/NumberPad";
import { fa } from "@/tools/registry";
import layout from "@/toolkit/ToolLayout.module.css";
import tryStyles from "@/toolkit/TryPanel.module.css";
import { ltr, stepFa } from "./format";
import { TypeLevelChips, type TryType } from "./MachineTryPanel";
import { INK } from "./Pictures";

const SOFT = "#5b6170";
const BOX = "#fff8e6";
const PAIR = "#dcebff";
const round = (v: number) => Math.round(v * 1e4) / 1e4;
/** "؟" inside left-to-right working: the mark after it keeps the next number on its right. */
const ASK = "؟‎";

// ───────────── words ─────────────

/** Left to right inside a Persian sentence, never broken across lines (no-break spaces). */
const ltrNb = (s: string) => ltr(s.replace(/ /g, " "));

/** "۳، ۷، ۱" left to right, as the boxes stand. */
export const rowFa = (row: readonly number[]) => ltrNb(row.map((v) => fa(v)).join("، "));

const RULE = "از چپ به راست، هر دو جعبه همسایه را مقایسه کن؛ اگر عدد چپی بزرگ‌تر است، جایشان را عوض کن";

/** "۳ بار تکرار کن: ‎+۲‎، بعد ‎×۲‎" */
export const programFa = (p: Program) => `${fa(p.times)} بار تکرار کن: ${p.body.map((s, i) => (i ? `بعد ${ltr(stepFa(s))}` : ltr(stepFa(s)))).join("، ")}`;

const robotFa = (q: LoopQuestion) => `«${fa(q.program.times)} بار تکرار کن: ${fa(q.program.body[0].n)} خانه جلو برو، بعد ${fa(q.program.body[1].n)} خانه عقب برو»`;

export function sortPrompt(q: SortQuestion): string {
  switch (q.variant) {
    case "loop":
      return q.theme === "robot"
        ? `رباتی روی خانه ${fa(q.start)} خط عددی ایستاده. برنامه‌اش: ${robotFa(q)}. در پایان ربات روی کدام خانه است؟`
        : `عدد ${fa(q.start)} را بردار و این برنامه را اجرا کن: «${programFa(q.program)}». در پایان چه عددی داری؟`;
    case "pass":
      return `قانون یک دور: ${RULE}. ردیف ${rowFa(q.row)} است. بعد از یک دور، ردیف چه شکلی می‌شود؟`;
    case "swaps":
      return `قانون یک دور: ${RULE}. ردیف ${rowFa(q.row)} است. در یک دور چند بار جابه‌جایی انجام می‌شود؟`;
    case "passes":
      return `قانون یک دور: ${RULE}. ردیف ${rowFa(q.row)} است و دورها را پشت سر هم تکرار می‌کنیم. بعد از چند دور، ردیف برای اولین بار از کوچک به بزرگ مرتب می‌شود؟`;
    case "minSwaps":
      return `در هر حرکت فقط جای دو جعبه همسایه عوض می‌شود. کمترین تعداد حرکت برای اینکه ردیف ${rowFa(q.row)} از کوچک به بزرگ (از چپ به راست) مرتب شود چند است؟`;
    case "program":
      return `کدام برنامه عدد ${fa(q.start)} را به ${fa(q.target)} می‌رساند؟`;
  }
}

/** "دور ۱: ۳ → ۵ → ۱۰" for each round. */
function roundsFa(start: number, p: Program): string {
  const rounds = programRounds(start, p);
  return rounds.map((r, k) => `دور ${fa(k + 1)}: ${ltrNb([k ? rounds[k - 1].at(-1)! : start, ...r].map((v) => fa(v)).join(" → "))}`).join("؛ ");
}

/** "۷ و ۳ جابه‌جا، ۷ و ۹ بمان، …" */
function comparesFa(row: readonly number[], st: Compare[]): string {
  return st
    .map((c, k) => {
      const before = k ? st[k - 1].row : row;
      return `${fa(before[c.i])} و ${fa(before[c.i + 1])} ${c.swap ? "جابه‌جا" : "بمان"}`;
    })
    .join("، ");
}

export function sortHow(q: SortQuestion): string {
  switch (q.variant) {
    case "loop":
      if (q.theme === "robot") {
        const [a, b] = q.program.body.map((s) => s.n);
        return `هر دور ربات ${fa(a)} خانه جلو و ${fa(b)} خانه عقب می‌رود، یعنی ${fa(a - b)} خانه جلو. ${roundsFa(q.start, q.program)}.`;
      }
      return `${roundsFa(q.start, q.program)}.`;
    case "pass":
    case "swaps": {
      const st = passSteps(q.row);
      const { row, swaps } = onePass(q.row);
      return `${comparesFa(q.row, st)}. بعد از یک دور: ${rowFa(row)} با ${fa(swaps)} جابه‌جایی؛ بزرگ‌ترین عدد به آخر ردیف رسید.`;
    }
    case "passes": {
      const passes = sortPasses(q.row);
      return `${passes.map((p, k) => `دور ${fa(k + 1)}: ${rowFa(p.at(-1)!.row)}`).join("؛ ")}. بعد از دور ${fa(passes.length)} ردیف مرتب است.`;
    }
    case "minSwaps": {
      const pairs: string[] = [];
      q.row.forEach((a, i) => q.row.slice(i + 1).forEach((b) => a > b && pairs.push(ltrNb(`${fa(a)}، ${fa(b)}`))));
      return `جفت‌هایی را بشمار که عدد بزرگ‌تر سمت چپ است: ${pairs.map((p) => `(${p})`).join(" ")} یعنی ${fa(pairs.length)} جفت. هر جابه‌جایی دو همسایه فقط یک جفت را درست می‌کند، پس کمتر از ${fa(pairs.length)} حرکت نمی‌شود؛ و با دورهای پشت سر هم دقیقاً ${fa(pairs.length)} حرکت کافی است.`;
    }
    case "program":
      return `برنامه درست: «${programFa(q.options[q.answer])}». ${roundsFa(q.start, q.options[q.answer])}.`;
  }
}

/** The answer in words. */
export function sortAnswerFa(q: SortQuestion): string {
  if (q.variant === "pass") return `گزینه ${fa(q.answer + 1)}: ${rowFa(q.options[q.answer])}`;
  if (q.variant === "program") return `گزینه ${fa(q.answer + 1)}`;
  return fa(q.answer);
}

type Tone = "good" | "turned" | "bad";
const ICON: Record<Tone, string> = { good: "✓", turned: "↻", bad: "✗" };

const two = (q: { program: Program }) => q.program.body as [Step, Step];

/** What a wrong choice of program does. */
function programSlip(q: ProgramQuestion, i: number, tag: SortTag): string {
  const p = q.options[i];
  const got = `این برنامه به ${fa(programResult(q.start, p))} می‌رسد، نه ${fa(q.target)}.`;
  switch (tag) {
    case "loopMore":
      return `این برنامه یک دور بیشتر از برنامه درست می‌چرخد. ${got}`;
    case "loopLess":
      return `این برنامه یک دور کمتر از برنامه درست می‌چرخد. ${got}`;
    case "order":
      return `کارهای این برنامه درست‌اند ولی ترتیبشان برعکس است؛ ترتیب کارها مهم است. ${got}`;
    case "otherStep":
      return `یکی از عددهای این برنامه فرق دارد. ${got}`;
    default:
      return got;
  }
}

function slipText(q: SortQuestion, v: number, tag: SortTag): string {
  if (q.variant === "program") return programSlip(q, v, tag);
  const n = "row" in q ? q.row.length : 0;
  switch (tag) {
    case "fullSort":
      return q.variant === "swaps"
        ? `این تعداد جابه‌جایی‌های مرتب کردن کل ردیف است (همه دورها). پرسش فقط یک دور را می‌خواهد: از چپ تا راست، یک بار.`
        : `تو کل ردیف را مرتب کردی؛ ولی پرسش فقط یک دور را می‌خواهد: هر جفت همسایه از چپ تا راست یک بار مقایسه می‌شود و دور تمام می‌شود.`;
    case "nonNeighbour":
      return q.variant === "minSwaps"
        ? `اگر هر دو جعبه‌ای را می‌شد جابه‌جا کرد، ${fa(v)} حرکت بس بود؛ ولی اینجا فقط دو جعبه همسایه جابه‌جا می‌شوند. هر حرکت فقط یک جفت نامرتب را درست می‌کند.`
        : `تو بزرگ‌ترین عدد را یک‌جا با جعبه آخر عوض کردی؛ ولی آن دو جعبه همسایه نیستند. در یک دور فقط همسایه‌ها جابه‌جا می‌شوند، پس بزرگ‌ترین عدد قدم‌به‌قدم جلو می‌رود و عددهای سر راهش یکی‌یکی عقب می‌آیند.`;
    case "direction":
      return `تو وقتی عدد چپی کوچک‌تر بود جابه‌جا کردی (برای همین کوچک‌ترین عدد به آخر رفت). قانون می‌گوید: وقتی چپی بزرگ‌تر است.`;
    case "stopFirst":
      return `تو بعد از اولین جابه‌جایی ایستادی؛ ولی دور تا آخرین جفت همسایه ادامه دارد.`;
    case "comparisons":
      return q.variant === "swaps"
        ? `تو مقایسه‌ها را شمردی: در ردیف ${fa(n)} جعبه‌ای هر دور ${fa(n - 1)} مقایسه دارد. ولی پرسش جابه‌جایی‌ها را می‌خواهد: فقط جاهایی که چپی بزرگ‌تر بود.`
        : `تو همه مقایسه‌های همه دورها را شمردی؛ ولی فقط جابه‌جایی‌ها حرکت حساب می‌شوند.`;
    case "loopMore":
      return q.variant === "loop" ? `حلقه را یک بار بیشتر چرخاندی: «${fa(q.program.times)} بار تکرار کن» یعنی درست ${fa(q.program.times)} دور.` : "";
    case "loopLess":
      return q.variant === "loop" ? `حلقه را یک بار کمتر چرخاندی: «${fa(q.program.times)} بار تکرار کن» یعنی درست ${fa(q.program.times)} دور؛ دورها را روی کاغذ بشمار.` : "";
    case "order":
      return q.variant === "loop" ? `در هر دور ترتیب کارها را برعکس کردی. در هر دور اول ${ltr(stepFa(two(q)[0]))}، بعد ${ltr(stepFa(two(q)[1]))}؛ ترتیب مهم است.` : "";
    case "grouped":
      return q.variant === "loop"
        ? `تو اول همه ${ltr(stepFa(two(q)[0]))}ها را انجام دادی و بعد همه ${ltr(stepFa(two(q)[1]))}ها. ولی هر دور یعنی اول ${ltr(stepFa(two(q)[0]))}، بعد ${ltr(stepFa(two(q)[1]))}؛ و بعد دور بعدی.`
        : "";
    case "skipStep":
      return q.variant === "loop" ? `یک دستور جا ماند: در هر دور ربات هم ${fa(two(q)[0].n)} خانه جلو می‌رود، هم ${fa(two(q)[1].n)} خانه عقب.` : "";
    case "extraPass":
      return `تو دور آخری را هم شمردی که فقط نگاه می‌کند و جابه‌جایی ندارد. پرسش می‌گوید بعد از چند دور ردیف برای اولین بار مرتب می‌شود.`;
    case "swapsNotPasses":
      return `تو جابه‌جایی‌ها را شمردی، نه دورها. هر دور یعنی یک بار رفتن از چپ تا راست ردیف، که خودش چند جابه‌جایی دارد.`;
    case "onePass":
      return `تو فقط جابه‌جایی‌های دور اول را شمردی؛ ولی بعد از یک دور ردیف هنوز مرتب نیست و دورهای بعد هم جابه‌جایی دارند.`;
    default:
      return "";
  }
}

export function sortFeedback(q: SortQuestion, v: number): { tone: Tone; text: string } {
  const how = sortHow(q);
  const tag = sortMistake(q, v);
  if (tag === "right") return { tone: "good", text: `درست است! ${how}` };
  const slip = slipText(q, v, tag);
  const right = `جواب ${sortAnswerFa(q)} است. ${how}`;
  return slip ? { tone: "turned", text: `${slip} ${right}` } : { tone: "bad", text: right };
}

// ───────────── the row of boxes ─────────────

/** x of box i in a row of n, centred on cx. */
export function rowLayout(n: number, cx: number, width: number) {
  const pitch = Math.min(2.2, width / n);
  return { pitch, box: round(pitch * 0.82), x: (i: number) => round(cx + (i - (n - 1) / 2) * pitch) };
}

interface RowProps {
  /** The row before the comparison in progress. */
  row: readonly number[];
  /** A comparison in progress: the pair (i, i + 1), its phase u 0 … 1 (look, then decide and move) and whether it swaps. */
  cmp?: { i: number; u: number; swap: boolean } | null;
  sel?: number | null;
  onTap?: (i: number) => void;
  cx: number;
  cy: number;
  width: number;
}

const ease = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));

export function SortRowG({ row, cmp, sel, onTap, cx, cy, width }: RowProps) {
  const n = row.length;
  const { x, box } = rowLayout(n, cx, width);
  const decided = cmp ? cmp.u >= 0.35 : false;
  const m = cmp && cmp.swap ? ease((cmp.u - 0.35) / 0.5) : 0;
  const font = round(box * 0.5);
  return (
    <g>
      {cmp && (
        <g>
          {/* Bracket over the pair and the comparison written over it. */}
          <path
            d={`M${x(cmp.i) - box / 2} ${round(cy - box / 2 - 0.25)} V${round(cy - box / 2 - 0.6)} H${x(cmp.i + 1) + box / 2} V${round(cy - box / 2 - 0.25)}`}
            fill="none"
            stroke={INK}
            strokeWidth={0.07}
          />
          <text x={round((x(cmp.i) + x(cmp.i + 1)) / 2)} y={round(cy - box / 2 - 1.05)} fontSize={0.62} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} direction="ltr">
            {`${fa(row[cmp.i])} ${decided ? (row[cmp.i] > row[cmp.i + 1] ? ">" : "<") : ASK} ${fa(row[cmp.i + 1])}`}
          </text>
          {decided && (
            <text x={round((x(cmp.i) + x(cmp.i + 1)) / 2)} y={round(cy + box / 2 + 0.95)} fontSize={0.6} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
              {cmp.swap ? "⇄ جابه‌جا" : "= بمان"}
            </text>
          )}
        </g>
      )}
      {row.map((v, i) => {
        // The pair being swapped moves along two arcs (one over, one under) so they never cover each other.
        let bx = x(i);
        let by = cy;
        if (cmp && cmp.swap && (i === cmp.i || i === cmp.i + 1)) {
          const dir = i === cmp.i ? 1 : -1;
          bx = round(x(i) + dir * m * (x(1) - x(0)));
          by = round(cy - dir * Math.sin(Math.PI * m) * box * 0.55);
        }
        const inPair = !!cmp && (i === cmp.i || i === cmp.i + 1);
        const chosen = sel === i;
        const label = `جعبه ${fa(i + 1)} از چپ، عدد ${fa(v)}${chosen ? "، انتخاب شده" : ""}`;
        return (
          <g
            key={v}
            onClick={onTap ? () => onTap(i) : undefined}
            onKeyDown={
              onTap
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onTap(i);
                    }
                  }
                : undefined
            }
            role={onTap ? "button" : undefined}
            tabIndex={onTap ? 0 : undefined}
            aria-label={onTap ? label : undefined}
            aria-pressed={onTap ? chosen : undefined}
            style={onTap ? { cursor: "pointer" } : undefined}
          >
            <rect x={round(bx - box / 2)} y={round(by - box / 2)} width={box} height={box} rx={0.2} fill={inPair ? PAIR : BOX} stroke={INK} strokeWidth={chosen ? 0.18 : 0.07} strokeDasharray={chosen ? "0.3 0.15" : undefined} />
            <text x={bx} y={by} fontSize={font} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} direction="ltr">
              {fa(v)}
            </text>
            {chosen && (
              <text x={bx} y={round(by - box / 2 - 0.4)} fontSize={0.55} textAnchor="middle" dominantBaseline="central" fill={INK}>
                ▼
              </text>
            )}
          </g>
        );
      })}
      <text x={round(x(0))} y={round(cy + box / 2 + 0.95)} fontSize={0.45} textAnchor="middle" dominantBaseline="central" fill={SOFT} opacity={cmp?.i === 0 && decided ? 0 : 1}>
        چپ
      </text>
      <text x={round(x(n - 1))} y={round(cy + box / 2 + 0.95)} fontSize={0.45} textAnchor="middle" dominantBaseline="central" fill={SOFT} opacity={cmp?.i === n - 2 && decided ? 0 : 1}>
        راست
      </text>
    </g>
  );
}

/** Where a list of comparisons stands at t (0 … number of comparisons): the row before the current one and the comparison. */
export function compareAt(row: readonly number[], st: Compare[], t: number): { row: readonly number[]; cmp: RowProps["cmp"]; k: number } {
  const k = Math.min(st.length, Math.max(0, Math.floor(t)));
  const before = k ? st[k - 1].row : row;
  if (k >= st.length) return { row: before, cmp: null, k };
  return { row: before, cmp: { i: st[k].i, u: t - k, swap: st[k].swap }, k };
}

/** A line of text on the board: a Persian label at the right and the working left to right. */
function LineG({ label, text, y, size = 0.55 }: { label?: string; text: string; y: number; size?: number }) {
  return (
    <g>
      {label && (
        <text x={15.6} y={y} fontSize={size} fontWeight={700} textAnchor="end" dominantBaseline="central" fill={SOFT}>
          {label}
        </text>
      )}
      <text x={label ? 7.3 : 8} y={y} fontSize={size} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} direction="ltr">
        {text}
      </text>
    </g>
  );
}

/** The robot on its number line, at position `pos` (between squares while it walks). */
function NumberLineG({ hi, pos, cy }: { hi: number; pos: number; cy: number }) {
  const x0 = 0.8;
  const step = round(14.4 / hi);
  const x = (v: number) => round(x0 + v * step);
  const every = hi > 12 ? 2 : 1;
  return (
    <g>
      <line x1={x(0)} y1={cy} x2={x(hi)} y2={cy} stroke={INK} strokeWidth={0.07} />
      {Array.from({ length: hi + 1 }, (_, v) => (
        <g key={v}>
          <line x1={x(v)} y1={cy - 0.15} x2={x(v)} y2={cy + 0.15} stroke={INK} strokeWidth={0.05} />
          {v % every === 0 && (
            <text x={x(v)} y={cy + 0.6} fontSize={0.5} textAnchor="middle" dominantBaseline="central" fill={INK} direction="ltr">
              {fa(v)}
            </text>
          )}
        </g>
      ))}
      <g transform={`translate(${x(pos)} ${cy - 0.75})`} aria-hidden="true">
        <rect x={-0.42} y={-0.45} width={0.84} height={0.7} rx={0.15} fill="#ffc93d" stroke={INK} strokeWidth={0.06} />
        <circle cx={-0.17} cy={-0.15} r={0.08} fill={INK} />
        <circle cx={0.17} cy={-0.15} r={0.08} fill={INK} />
        <line x1={0} y1={-0.45} x2={0} y2={-0.7} stroke={INK} strokeWidth={0.06} />
        <path d="M0 0.25 L0 0.45" stroke={INK} strokeWidth={0.06} />
      </g>
    </g>
  );
}

/** Comparisons a row question shows once answered: one pass, or every pass until sorted. */
export function questionCompares(q: SortQuestion): { st: Compare[]; passOf: number[] } {
  if (q.variant === "pass" || q.variant === "swaps") {
    const st = passSteps(q.row);
    return { st, passOf: st.map(() => 1) };
  }
  if (q.variant === "passes" || q.variant === "minSwaps") {
    const passes = sortPasses(q.row);
    return { st: passes.flat(), passOf: passes.flatMap((p, k) => p.map(() => k + 1)) };
  }
  return { st: [], passOf: [] };
}

/** Units of animation a question has once answered (comparisons, or program steps). */
export const sortSteps = (q: SortQuestion) => ("row" in q ? questionCompares(q).st.length : q.variant === "loop" ? q.program.times * 2 : q.options[q.answer].times * 2);

/** The board of a sort question; `f` 0 … 1 plays the working once answered. */
export function SortQuestionG({ q, done, f }: { q: SortQuestion; done: boolean; f: number }) {
  if ("row" in q) {
    const { st, passOf } = questionCompares(q);
    const t = done ? f * st.length : 0;
    const at = compareAt(q.row, st, t);
    const swaps = st.slice(0, Math.min(st.length, Math.floor(t + 0.65))).filter((c) => c.swap).length;
    const pass = passOf[Math.min(at.k, passOf.length - 1)] ?? 1;
    return (
      <g>
        <SortRowG row={at.row} cmp={done ? at.cmp : null} cx={8} cy={3.6} width={14} />
        {done && (
          <text x={8} y={6.9} fontSize={0.55} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
            {at.k < st.length
              ? `دور ${fa(pass)} · مقایسه ${fa(at.k + 1)} · تا اینجا ${fa(swaps)} جابه‌جایی`
              : q.variant === "pass" || q.variant === "swaps"
                ? `پایان یک دور · ${fa(swaps)} جابه‌جایی`
                : `مرتب شد · ${fa(passOf.at(-1) ?? 0)} دور · ${fa(swaps)} جابه‌جایی`}
          </text>
        )}
      </g>
    );
  }
  const p = q.variant === "loop" ? q.program : q.options[q.answer];
  const start = q.start;
  const rounds = programRounds(start, p);
  const steps = p.times * p.body.length;
  const t = done ? f * steps : 0;
  const shownSteps = Math.floor(t + 0.5);
  if (q.variant === "loop" && q.theme === "robot") {
    const trace = [start, ...rounds.flat()];
    const hi = Math.max(10, Math.max(...trace) + 1);
    const k = Math.min(steps, Math.floor(t));
    const pos = k >= steps ? trace[steps] : trace[k] + (trace[k + 1] - trace[k]) * ease((t - k) / 0.8);
    return (
      <g>
        <LineG text={`${fa(p.times)} × ( +${fa(p.body[0].n)} , −${fa(p.body[1].n)} )`} label="برنامه" y={1.1} />
        <NumberLineG hi={hi} pos={pos} cy={4} />
        {rounds.map((r, i) =>
          i * 2 < shownSteps ? <LineG key={i} label={`دور ${fa(i + 1)}`} text={[i ? rounds[i - 1][1] : start, ...r.slice(0, Math.min(2, shownSteps - i * 2))].map((v) => fa(v)).join(" → ")} y={round(5.6 + i * 0.85)} size={0.6} /> : null,
        )}
      </g>
    );
  }
  const end = done && shownSteps >= steps ? fa(programResult(start, p)) : ASK;
  const head = q.variant === "program" ? `${fa(start)} → ${ASK} → ${fa(q.target)}` : `${fa(start)} → ${end}`;
  return (
    <g>
      <LineG text={done && q.variant === "program" ? `${fa(p.times)} × ( ${p.body.map(stepFa).join(" , ")} )` : head} label={done && q.variant === "program" ? "برنامه درست" : q.variant === "program" ? "شروع و هدف" : "شروع"} y={1.2} size={0.62} />
      {!done && q.variant === "loop" && <LineG text={`${fa(p.times)} × ( ${p.body.map(stepFa).join(" , ")} )`} label="برنامه" y={2.3} size={0.62} />}
      {done &&
        rounds.map((r, i) =>
          i * 2 < shownSteps ? (
            <LineG key={i} label={`دور ${fa(i + 1)}`} text={[i ? rounds[i - 1][1] : start, ...r.slice(0, Math.min(2, shownSteps - i * 2))].map((v, k) => (k ? `[${stepFa(p.body[k - 1])}]→ ${fa(v)}` : fa(v))).join(" ")} y={round(2.6 + i * 1)} />
          ) : null,
        )}
    </g>
  );
}

// ───────────── explore ─────────────

export interface SortExplore {
  n: number;
  start: number[];
  row: number[];
  sel: number | null;
  swaps: number;
  passes: number;
  msg: string | null;
  /** A pass being played: the row it started from, its comparisons and t. */
  anim: { from: number[]; st: Compare[]; t: number } | null;
  setN: (n: number) => void;
  fresh: () => void;
  reset: () => void;
  tap: (i: number) => void;
  pass: () => void;
  /** Sets the row (from a link, or after the show-me pass). */
  load: (row: number[]) => void;
}

const MS_PER_COMPARE = 900;

export function useSortExplore(): SortExplore {
  const [start, setStart] = useState<number[]>([7, 3, 9, 1, 5]);
  const [row, setRow] = useState<number[]>([7, 3, 9, 1, 5]);
  const [sel, setSel] = useState<number | null>(null);
  const [swaps, setSwaps] = useState(0);
  const [passes, setPasses] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [anim, setAnim] = useState<SortExplore["anim"]>(null);
  const playing = useRef(false);

  useEffect(() => {
    if (!anim || anim.t >= anim.st.length) return;
    let frame = 0;
    let begin = -1;
    const t0 = anim.t;
    const total = anim.st.length;
    const tick = (now: number) => {
      if (begin < 0) begin = now;
      const t = Math.min(total, t0 + (now - begin) / MS_PER_COMPARE);
      if (t >= total) {
        const st = anim.st;
        setRow(st[st.length - 1].row);
        setSwaps((s) => s + st.filter((c) => c.swap).length);
        setPasses((p) => p + 1);
        setAnim(null);
        playing.current = false;
        return;
      }
      setAnim((a) => (a ? { ...a, t } : a));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // Restart only when a new pass begins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anim?.st]);

  const load = useCallback((r: number[]) => {
    setStart(r);
    setRow(r);
    setSel(null);
    setSwaps(0);
    setPasses(0);
    setMsg(null);
    setAnim(null);
    playing.current = false;
  }, []);

  return {
    n: row.length,
    start,
    row,
    sel,
    swaps,
    passes,
    msg,
    anim,
    load,
    setN: (n) => load(exploreRow(n, newSeed())),
    fresh: () => load(exploreRow(row.length, newSeed())),
    reset: () => load(start),
    tap: (i) => {
      if (playing.current) return;
      if (sel === null) {
        setSel(i);
        setMsg(null);
      } else if (sel === i) setSel(null);
      else if (Math.abs(sel - i) === 1) {
        const r = [...row];
        [r[sel], r[i]] = [r[i], r[sel]];
        setRow(r);
        setSwaps(swaps + 1);
        setSel(null);
        setMsg(null);
      } else {
        setMsg(`جعبه ${fa(sel + 1)} و جعبه ${fa(i + 1)} همسایه نیستند؛ فقط دو جعبه کنار هم جابه‌جا می‌شوند. حالا جعبه ${fa(i + 1)} انتخاب شد؛ یکی از همسایه‌هایش را بزن.`);
        setSel(i);
      }
    },
    pass: () => {
      if (playing.current) return;
      playing.current = true;
      setSel(null);
      setMsg(null);
      setAnim({ from: row, st: passSteps(row), t: 0 });
    },
  };
}

/** The explore board: the row (tap two neighbours) or a pass being played. */
export function SortExploreG({ ex }: { ex: SortExplore }) {
  const at = ex.anim ? compareAt(ex.anim.from, ex.anim.st, ex.anim.t) : null;
  return (
    <g>
      <SortRowG row={at ? at.row : ex.row} cmp={at?.cmp} sel={at ? null : ex.sel} onTap={at ? undefined : ex.tap} cx={8} cy={3.6} width={14.4} />
      <text x={8} y={6.9} fontSize={0.55} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
        {at && at.cmp ? `دور ${fa(ex.passes + 1)} · مقایسه ${fa(at.k + 1)} از ${fa(ex.anim!.st.length)}` : isSorted(ex.row) ? `✓ مرتب شد · ${fa(ex.swaps)} جابه‌جایی` : `جابه‌جایی‌ها: ${fa(ex.swaps)} · دورها: ${fa(ex.passes)}`}
      </text>
    </g>
  );
}

export function SortExplorePanel({ ex, onShow }: { ex: SortExplore; onShow: () => void }) {
  const sorted = isSorted(ex.row);
  const least = inversions(ex.start);
  const busy = ex.anim !== null;
  return (
    <>
      <h2 className={layout.progress}>۱. ردیف جعبه‌ها</h2>
      <div className={layout.chipsRow} role="radiogroup" aria-label="تعداد جعبه‌ها">
        {[4, 5, 6, 7].map((n) => (
          <button key={n} role="radio" aria-checked={ex.n === n} onClick={() => ex.setN(n)} disabled={busy}>
            {fa(n)} جعبه
          </button>
        ))}
      </div>
      <div className={layout.row} style={{ marginTop: 8 }}>
        <button className={layout.clear} onClick={ex.fresh} disabled={busy}>
          ردیف تازه
        </button>
        <button className={layout.clear} onClick={ex.reset} disabled={busy}>
          از اول
        </button>
      </div>

      <h2 className={layout.progress}>۲. با دست مرتب کن</h2>
      <p className={layout.note}>یک جعبه را بزن، بعد یکی از همسایه‌هایش را؛ جای آن دو عوض می‌شود. با کمترین جابه‌جایی، ردیف را از کوچک به بزرگ (از چپ به راست) مرتب کن.</p>
      {ex.msg && (
        <p className={`${layout.status} ${layout.warn}`} aria-live="polite">
          ⚠ {ex.msg}
        </p>
      )}
      <p className={`${layout.status} ${layout.info}`} aria-live="polite">
        جابه‌جایی‌ها: {fa(ex.swaps)} · دورها: {fa(ex.passes)}
        {sorted && (
          <>
            <br />✓ ردیف مرتب است. {ex.swaps === least ? `${fa(ex.swaps)} جابه‌جایی؛ کمتر از این نمی‌شود!` : ex.swaps > least ? `کمترین تعداد برای این ردیف ${fa(least)} است؛ دوباره «از اول» امتحان کن.` : ""}
          </>
        )}
      </p>

      <h2 className={layout.progress}>۳. یک دور خودکار</h2>
      <p className={layout.note}>قانون یک دور: {RULE}.</p>
      <div className={layout.row}>
        <button className={layout.clear} onClick={ex.pass} disabled={busy}>
          {busy ? "در حال اجرا…" : "یک دور ▶"}
        </button>
      </div>
      <button className={layout.clear} onClick={onShow} disabled={busy} style={{ marginTop: 8, width: "100%" }}>
        نشانم بده یک دور، مقایسه‌به‌مقایسه
      </button>
    </>
  );
}

/** Show me: one pass of the explore row, comparison by comparison. */
export function SortShowPanel({ row, t, onNext }: { row: number[]; t: number; onNext: () => void }) {
  const st = passSteps(row);
  const after = st.at(-1)?.row ?? row;
  const swaps = st.filter((c) => c.swap).length;
  return (
    <>
      <h2>یک دور: مقایسه همسایه‌ها</h2>
      <p className={layout.note}>{RULE}. هر جفت فقط یک بار مقایسه می‌شود.</p>
      <table className={layout.countTable}>
        <tbody>
          {st.map((c, k) => {
            const before = k ? st[k - 1].row : row;
            const decided = t >= k + 0.35;
            return (
              <tr key={k} aria-current={Math.floor(t) === k ? "step" : undefined}>
                <td>
                  {fa(k + 1)}. <bdi dir="ltr">{`${fa(before[c.i])} ${decided ? (c.swap ? ">" : "<") : ASK} ${fa(before[c.i + 1])}`}</bdi>
                </td>
                <td>{decided ? (c.swap ? "⇄ جابه‌جا" : "= بمان") : "…"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {t >= st.length - 0.01 && (
        <p className={`${layout.status} ${layout.info}`}>
          {swaps ? `بعد از این دور: ${rowFa(after)} با ${fa(swaps)} جابه‌جایی. بزرگ‌ترین عدد به آخر ردیف رسید و دیگر تکان نمی‌خورد.` : "در این دور هیچ جابه‌جایی نشد: ردیف مرتب است."}
        </p>
      )}
      {!isSorted(row) && (
        <button className={layout.clear} onClick={onNext} style={{ width: "100%" }}>
          دور بعد ▶
        </button>
      )}
      <p className={layout.note}>ردیف را در «کشف» عوض کن.</p>
    </>
  );
}

// ───────────── try it ─────────────

/** A row as small boxes (for choices). */
export function MiniRow({ row }: { row: readonly number[] }) {
  return (
    <span dir="ltr" style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
      {row.map((v, i) => (
        <span key={i} style={{ minWidth: "1.9em", padding: "2px 4px", border: "2px solid var(--ink)", borderRadius: 6, textAlign: "center", fontWeight: 700, background: "var(--surface)" }}>
          {fa(v)}
        </span>
      ))}
    </span>
  );
}

export function SortAnswer({ q, checked, onCheck }: { q: SortQuestion; checked: number | null; onCheck: (v: number) => void }) {
  const done = checked !== null;
  const [num, setNum] = useState(done && !isChoice(q) ? String(checked) : "");
  const [pick, setPick] = useState<number | null>(done && isChoice(q) ? checked : null);
  const fb = done ? sortFeedback(q, checked) : null;
  return (
    <>
      <p className={tryStyles.prompt}>{sortPrompt(q)}</p>
      {isChoice(q) ? (
        <ul className={tryStyles.options} style={{ gridTemplateColumns: "1fr" }}>
          {(q.variant === "pass" ? (q as PassQuestion).options : (q as ProgramQuestion).options).map((o, i) => {
            const mark = done ? (i === q.answer ? "good" : i === checked ? (q.tags[i] === "other" ? "bad" : "turned") : null) : null;
            return (
              <li key={i}>
                <button
                  className={`${tryStyles.option} ${mark ? tryStyles[mark] : ""}`}
                  style={{ flexDirection: "row", gap: 8, color: "var(--ink)", justifyContent: "flex-start", padding: "8px 10px", textAlign: "start", minHeight: 44, outline: !done && pick === i ? "3px solid var(--accent)" : undefined }}
                  onClick={() => setPick(i)}
                  disabled={done}
                  aria-pressed={pick === i}
                >
                  <span className={tryStyles.optionNum}>
                    {mark === "good" ? "✓ " : mark ? "✗ " : pick === i ? "● " : ""}
                    {fa(i + 1)}.
                  </span>
                  {q.variant === "pass" ? <MiniRow row={o as number[]} /> : <span>{programFa(o as Program)}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <NumberPad value={num} onChange={setNum} disabled={done} maxDigits={3} />
      )}
      {!done && (
        <button className={tryStyles.secondary} disabled={isChoice(q) ? pick === null : !num} onClick={() => onCheck(isChoice(q) ? pick! : Number(num))}>
          بررسی
        </button>
      )}
      {fb && (
        <p className={`${tryStyles.feedback} ${tryStyles[fb.tone]}`} role="status" aria-live="polite">
          <span className={tryStyles.icon}>{ICON[fb.tone]}</span> {fb.text}
        </p>
      )}
      {done && <p className={tryStyles.hint}>{"row" in q ? "روی صفحه، مقایسه‌ها یکی‌یکی پخش می‌شوند؛ با نوار پایین جلو و عقب ببر." : "روی صفحه، برنامه دوربه‌دور اجرا می‌شود؛ با نوار پایین جلو و عقب ببر."}</p>}
    </>
  );
}

/** The try panel for «مرتب‌سازی و الگوریتم»: the same type and level chips, the question and its answer. */
export function SortTryPanel(p: { q: SortQuestion; level: Level; checked: number | null; onCheck: (v: number) => void; onType: (t: TryType) => void; onLevel: (l: Level) => void; onNew: () => void }) {
  return (
    <div className={tryStyles.panel}>
      <TypeLevelChips type="sort" level={p.level} onType={p.onType} onLevel={p.onLevel} />
      <SortAnswer q={p.q} checked={p.checked} onCheck={p.onCheck} />
      <button className={tryStyles.next} onClick={p.onNew}>
        نمونه تازه
      </button>
    </div>
  );
}

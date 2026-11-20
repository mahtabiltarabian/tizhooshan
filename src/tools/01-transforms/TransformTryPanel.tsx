"use client";

import { useEffect, useMemo, useState } from "react";
import {
  bounds,
  moveAll,
  paintMistake,
  shiftLegs,
  stagedOps,
  type Figure,
  type Level,
  type MoveName,
  type Op,
  type PaintQuestion,
  type Pt,
  type TransformQuestion,
  type TransformQuestionType,
} from "@/generators/transforms";
import { fa } from "@/tools/registry";
import { boxFor, countFrom, FigureSvg } from "./Pictures";
import type { Rect } from "./Scene";
import styles from "@/toolkit/TryPanel.module.css";

export const TRANSFORM_TYPE_LABEL: Record<TransformQuestionType, string> = {
  mirror: "تصویر در آینه",
  water: "تصویر در آب",
  rotate: "دوران",
  shift: "انتقال",
  draw: "رسم روی شبکه",
  sequence: "دنباله چرخشی",
  combo: "چند تبدیل پشت‌سرهم",
  which: "کدام تبدیل؟",
};

export const MOVE_NAME: Record<MoveName, string> = {
  mirror: "قرینه در آینه",
  water: "تصویر در آب",
  cw90: "۹۰ درجه ساعتگرد ↻",
  r180: "۱۸۰ درجه (نیم‌دور)",
  ccw90: "۹۰ درجه پادساعتگرد ↺",
};

/** The move as a step in a sentence ("first … then …"). */
const MOVE_STEP: Record<MoveName, string> = {
  mirror: "در آینه برود",
  water: "در آب برود",
  cw90: "۹۰ درجه ساعتگرد بچرخد",
  r180: "۱۸۰ درجه بچرخد",
  ccw90: "۹۰ درجه پادساعتگرد بچرخد",
};

const MOVE_WHY: Record<MoveName, string> = {
  mirror: "در آینه، چپ و راست جابه‌جا می‌شود و بالا و پایین همان می‌ماند.",
  water: "در آب، بالا و پایین جابه‌جا می‌شود و چپ و راست همان می‌ماند.",
  cw90: "در چرخش ۹۰ درجه ساعتگرد، بالای شکل به سمت راست می‌رود و شکل برعکس نمی‌شود.",
  r180: "در نیم‌دور، شکل سر و ته می‌شود ولی برعکس نمی‌شود.",
  ccw90: "در چرخش ۹۰ درجه پادساعتگرد، بالای شکل به سمت چپ می‌رود و شکل برعکس نمی‌شود.",
};

/** A slide in words, with arrows: «۳ خانه به راست → و ۲ خانه به بالا ↑». */
export function vecText([dx, dy]: Pt, arrows = true): string {
  const parts: string[] = [];
  if (dx) parts.push(`${fa(Math.abs(dx))} خانه به ${dx > 0 ? "راست" : "چپ"}${arrows ? (dx > 0 ? " →" : " ←") : ""}`);
  if (dy) parts.push(`${fa(Math.abs(dy))} خانه به ${dy > 0 ? "بالا" : "پایین"}${arrows ? (dy > 0 ? " ↑" : " ↓") : ""}`);
  return parts.join(" و ");
}

/** Questions answered by colouring cells. */
export const isPaint = (q: TransformQuestion): q is PaintQuestion => q.type === "draw" || (q.type === "shift" && q.form === "draw");

type Tone = "good" | "turned" | "bad";
const ICON: Record<Tone, string> = { good: "✓", turned: "↻", bad: "✗" };

/** What the board shows for a question (everything but the playback value). */
export interface SceneSetup {
  figure: Figure;
  ops: Op[];
  copy: boolean;
  given?: Op[];
  guides?: boolean;
  links?: boolean;
  plainLines?: boolean;
  grid?: Rect;
  others?: Figure[];
  blanks?: Rect[];
  rightCells?: string[];
  /** Taps on the board colour cells. */
  paint?: boolean;
  images?: Figure[];
  count?: { from: Pt; legs: Pt[] };
}

const rectOf = (f: Figure): Rect => {
  const b = bounds(f);
  return { x0: b.minX, y0: b.minY, x1: b.maxX, y1: b.maxY };
};

/** Frames of a sequence laid out in a row, each turned once more. */
export function sequenceFrames(q: Extract<TransformQuestion, { type: "sequence" }>): Figure[] {
  const out = [q.figure];
  for (let i = 1; i < q.frames.length; i++) out.push(moveAll(out[i - 1], stagedOps(out[i - 1], [q.step])));
  return out;
}

export function sceneFor(q: TransformQuestion, answered: boolean): SceneSetup {
  switch (q.type) {
    case "mirror":
    case "water":
    case "rotate":
    case "combo": {
      const ops = stagedOps(q.figure, q.moves);
      const end = moveAll(q.figure, ops);
      return {
        figure: q.figure,
        ops,
        copy: answered,
        given: q.type === "mirror" || q.type === "water" ? [ops[0]] : [],
        guides: true,
        links: true,
        blanks: answered ? [] : [rectOf(end)],
      };
    }
    case "which": {
      const name = q.options[q.answer];
      const ops = stagedOps(q.figure, [name]);
      return { figure: q.figure, ops, copy: answered, guides: true, links: true, others: [moveAll(q.figure, ops)] };
    }
    case "sequence": {
      const frames = sequenceFrames(q);
      const missing = q.frames.indexOf(null);
      return {
        figure: frames[missing - 1],
        ops: stagedOps(frames[missing - 1], [q.step]),
        copy: answered,
        guides: true,
        others: frames.filter((_, i) => i !== missing && i !== missing - 1),
        blanks: answered ? [] : [rectOf(frames[missing])],
      };
    }
    case "shift": {
      const grid = { x0: 0, y0: 0, x1: q.w, y1: q.h };
      const legs = shiftLegs(q.vec);
      const count = answered ? { from: countFrom(q.figure), legs: legs.map((o) => (o.kind === "shift" ? o.by : ([0, 0] as Pt))) } : undefined;
      if (q.form === "vector") return { figure: q.figure, ops: legs, copy: answered, links: true, grid, images: [q.image], count };
      return {
        figure: q.figure,
        ops: q.ops,
        copy: answered,
        given: q.ops.filter((o) => o.kind === "reflect"),
        links: true,
        plainLines: true,
        grid,
        rightCells: answered ? q.answer : undefined,
        paint: !answered,
        count,
      };
    }
    case "draw":
      return {
        figure: q.figure,
        ops: [q.op],
        copy: answered,
        given: [q.op],
        links: true,
        plainLines: true,
        grid: { x0: 0, y0: 0, x1: q.w, y1: q.h },
        rightCells: answered ? q.answer : undefined,
        paint: !answered,
      };
  }
}

function drawPrompt(q: Extract<TransformQuestion, { type: "draw" }>): string {
  if (q.op.kind === "reflect") return "قرینه شکل را نسبت به خط‌چین روی شبکه رنگ کن.";
  if (q.op.kind === "rotate")
    return `شکل را حول نقطه قرمز ${Math.abs(q.op.deg) === 180 ? "۱۸۰ درجه (نیم‌دور)" : q.op.deg > 0 ? "۹۰ درجه ساعتگرد" : "۹۰ درجه پادساعتگرد"} بچرخان و تصویرش را روی شبکه رنگ کن.`;
  return "";
}

/** The question text; `paper` words it for a printed worksheet. */
export function transformPrompt(q: TransformQuestion, paper = false): string {
  switch (q.type) {
    case "mirror":
      return "آینه کنار شکل ایستاده. تصویر شکل در آینه کدام است؟";
    case "water":
      return "شکل لب آب است. تصویرش در آب کدام است؟";
    case "rotate":
      return `اگر شکل ${MOVE_NAME[q.moves[0]].replace(/ [↻↺]/, "")} بچرخد، کدام می‌شود؟`;
    case "combo":
      return `شکل اول ${q.moves.map((m) => MOVE_STEP[m]).join("، بعد ")}. در آخر کدام می‌شود؟`;
    case "sequence":
      return "شکل در هر مرحله به یک اندازه و یک جهت می‌چرخد. جای «؟» کدام است؟";
    case "which":
      return paper ? "شکل ۱ با کدام تبدیل، شکل ۲ شده است؟" : "شکل زرد با کدام تبدیل، شکل کناری شده است؟";
    case "draw":
      return drawPrompt(q);
    case "shift":
      if (q.form === "vector")
        return paper
          ? "شکل بی‌هاشور با یک انتقال به جای شکل راه‌راه رفته است. هر خانه چند خانه و به کدام طرف رفته؟"
          : "شکل زرد با یک انتقال به جای شکل راه‌راه رفته است. هر خانه چند خانه و به کدام طرف رفته؟ خانه‌ها را بشمار.";
      if (q.ops.some((o) => o.kind === "reflect"))
        return `اول شکل را ${vecText(q.vec)} ببر؛ بعد قرینه‌اش را نسبت به خط‌چین پیدا کن. فقط تصویر آخر را روی شبکه رنگ کن.`;
      return `شکل را ${vecText(q.vec)} ببر و جای تازه‌اش را روی شبکه رنگ کن.`;
  }
}

const SHIFT_WHY = "در انتقال هر خانه شکل به یک اندازه و یک جهت می‌رود؛ شکل نه می‌چرخد و نه برعکس می‌شود.";

/** Feedback on a picked slide (which slide took the figure there?). */
function vectorFeedback(q: Extract<TransformQuestion, { type: "shift"; form: "vector" }>, picked: number): { tone: Tone; text: string } {
  const right = `جواب: ${vecText(q.vec)}.`;
  if (picked === q.answer) return { tone: "good", text: `درست است! هر خانه ${vecText(q.vec)} رفته است. شمارش روی صفحه را ببین.` };
  switch (q.mistakes[picked]) {
    case "wrongWay":
      return { tone: "turned", text: `نزدیک بود! جهت برعکس است: از شکل زرد به طرف شکل راه‌راه بشمار، نه برعکس. ${right}` };
    case "offByOne":
      return { tone: "turned", text: `نزدیک بود! یک خانه کم یا زیاد شمردی. از یک خانه شکل زرد شروع کن و پرش‌ها را بشمار تا همان خانه در شکل راه‌راه؛ خود خانه شروع را نشمار. ${right}` };
    case "gap":
      return { tone: "turned", text: `فقط خانه‌های خالی بین دو شکل را شمردی. ولی باید ببینی هر خانه چقدر رفته: از یک خانه شکل زرد تا همان خانه در شکل راه‌راه. ${right}` };
    case "swapped":
      return { tone: "turned", text: `نزدیک بود! عددها جابه‌جا شده‌اند: چپ و راست را جدا بشمار، بالا و پایین را جدا. ${right}` };
    default:
      return { tone: "bad", text: `نه. ${right} ${SHIFT_WHY}` };
  }
}

function choiceFeedback(q: TransformQuestion, picked: number): { tone: Tone; text: string } {
  if (q.type === "draw") return { tone: "bad", text: "" };
  if (q.type === "shift") return q.form === "vector" ? vectorFeedback(q, picked) : { tone: "bad", text: "" };
  if (q.type === "which") {
    const right = q.options[q.answer];
    if (picked === q.answer) return { tone: "good", text: `درست است! ${MOVE_WHY[right]}` };
    const chosen = q.options[picked];
    const close = (chosen === "mirror" && right === "water") || (chosen === "water" && right === "mirror") || (!["mirror", "water"].includes(chosen) && !["mirror", "water"].includes(right));
    return { tone: close ? "turned" : "bad", text: `${close ? "نزدیک بود! " : ""}این ${MOVE_NAME[right]} است. ${MOVE_WHY[right]}` };
  }
  const mistake = q.mistakes[picked];
  const symbol = q.figure.mark ? `حرف «${q.figure.mark.symbol}» را ببین: ` : "";
  if (picked === q.answer) {
    if (q.type === "combo") return { tone: "good", text: "درست است! تبدیل‌ها را یکی‌یکی و به ترتیب انجام دادی. مراحل را روی صفحه ببین." };
    if (q.type === "sequence") return { tone: "good", text: `درست است! هر بار ${MOVE_NAME[q.step]} می‌چرخد.` };
    return { tone: "good", text: `درست است! ${MOVE_WHY[q.moves[0]]}` };
  }
  switch (mistake) {
    case "otherReflection":
      return { tone: "turned", text: `نزدیک بود! قرینه است، ولی ${q.type !== "sequence" && q.moves.includes("mirror") ? "در آب (بالا و پایین جابه‌جا)، نه در آینه" : "در آینه (چپ و راست جابه‌جا)، نه در آب"}.` };
    case "otherTurn":
      return { tone: "turned", text: `نزدیک بود! چرخیده، ولی نه به این اندازه یا این جهت. ${q.type === "sequence" ? `هر بار ${MOVE_NAME[q.step]}.` : MOVE_WHY[q.moves[q.moves.length - 1]]}` };
    case "turnForFlip":
      return { tone: "bad", text: `این شکل فقط چرخیده؛ در قرینه، شکل برعکس می‌شود. ${symbol}` };
    case "flipForTurn":
      return { tone: "bad", text: `این شکل برعکس (قرینه) شده؛ در چرخش، شکل برعکس نمی‌شود. ${symbol}` };
    case "wrongOrder":
      return { tone: "turned", text: "نزدیک بود! همه تبدیل‌ها هست ولی به ترتیب دیگر. ترتیب مهم است؛ مراحل را روی صفحه ببین." };
    case "oneStep":
      return { tone: "turned", text: "نزدیک بود! یکی از تبدیل‌ها جا افتاده یا عوض شده. مراحل را روی صفحه ببین." };
    case "unchanged":
      return { tone: "bad", text: "این همان شکل قبلی است؛ تغییری نکرده." };
    default:
      return { tone: "bad", text: "نه؛ مراحل را روی صفحه ببین." };
  }
}

/** Feedback on coloured cells: names the slip or the move the picture really shows. */
function paintFeedback(q: PaintQuestion, painted: string[]): { tone: Tone; text: string } {
  const green = " مربع‌های سبز جای درست‌اند.";
  const slide = q.type === "shift";
  const both = slide && q.ops.some((o) => o.kind === "reflect");
  const reflect = q.type === "draw" ? q.op.kind === "reflect" : both;
  const vec: Pt = q.type === "shift" ? q.vec : [0, 0];
  const letter = q.figure.mark ? ` حرف «${q.figure.mark.symbol}» روی تصویر را ببین.` : "";
  switch (paintMistake(q, painted)) {
    case "right":
      if (both) return { tone: "good", text: "آفرین! اول انتقال، بعد قرینه؛ هر دو را به ترتیب انجام دادی." };
      if (slide) return { tone: "good", text: `آفرین! هر خانه ${vecText(vec)} رفته است؛ شکل نه چرخیده نه برعکس شده.` };
      return { tone: "good", text: "آفرین! هر خانه به همان فاصله، آن طرف رفته است. خط‌چین‌های آبی هر خانه را به تصویرش وصل می‌کنند." };
    case "count":
      return { tone: "bad", text: `تصویر ${fa(q.answer.length)} خانه دارد؛ تو ${fa(painted.length)} خانه رنگ کردی.${green}` };
    case "wrongWay":
      return { tone: "turned", text: `نزدیک بود! جهت را برعکس رفتی؛ شکل باید ${vecText(vec)} برود.${green}` };
    case "offByOne":
      return { tone: "turned", text: `نزدیک بود! یک خانه کم یا زیاد شمردی. از یک خانه شکل شروع کن و پرش‌ها را بشمار؛ خود خانه شروع را نشمار.${green}` };
    case "gap":
      return { tone: "turned", text: `بین دو شکل ${vecText(vec, false)} جای خالی گذاشتی؛ ولی در انتقال، هر خانه شکل این‌قدر جلو می‌رود. از یک خانه شکل تا همان خانه در تصویر را بشمار.${green}` };
    case "swapped":
      return { tone: "turned", text: `نزدیک بود! عددها را جابه‌جا کردی: شکل باید ${vecText(vec)} برود.${green}` };
    case "oneDirection":
      return { tone: "turned", text: `نزدیک بود! فقط یکی از دو حرکت را انجام دادی؛ شکل باید ${vecText(vec)} برود.${green}` };
    case "onlyMoved":
      return { tone: "turned", text: `شکل را درست بردی ولی قرینه نکردی؛ بعد از انتقال، تصویرش را نسبت به خط‌چین پیدا کن.${green}` };
    case "onlyReflected":
      return { tone: "turned", text: `فقط قرینه کردی؛ اول باید شکل ${vecText(vec)} برود، بعد قرینه شود.${green}` };
    case "wrongOrder":
      return { tone: "turned", text: `نزدیک بود! اول قرینه کردی، بعد بردی. ترتیب مهم است: اینجا اول انتقال است، بعد قرینه؛ جای تصویر فرق می‌کند.${green}` };
    case "place":
      return {
        tone: "turned",
        text: slide && !both ? `نزدیک بود! شکل درست است ولی جایش نه؛ هر خانه باید ${vecText(vec)} برود.${green}` : `نزدیک بود! شکل درست است ولی جایش نه. فاصله هر خانه تا خط (یا نقطه) باید همان فاصله شکل اصلی باشد.${green}`,
      };
    case "notSlid":
      return { tone: "bad", text: `شکل تو چرخیده یا برعکس شده. ${SHIFT_WHY}${green}` };
    case "unchanged":
      return { tone: "bad", text: reflect ? `شکل را فقط جابه‌جا کردی؛ قرینه باید برعکس باشد.${green}` : `شکل را فقط جابه‌جا کردی؛ باید بچرخد.${green}` };
    case "turnForFlip":
      return { tone: "bad", text: `شکل تو چرخیده؛ ولی در قرینه، شکل برعکس می‌شود.${letter}${green}` };
    case "flipForTurn":
      return { tone: "bad", text: `شکل تو برعکس (قرینه) شده؛ ولی در چرخش، شکل برعکس نمی‌شود.${letter}${green}` };
    case "otherTurn":
      return { tone: "turned", text: `نزدیک بود! شکل چرخیده، ولی نه به این اندازه یا این جهت. فلش قرمز کنار نقطه را ببین.${letter}${green}` };
    case "otherReflection":
      return { tone: "turned", text: `نزدیک بود! شکل برعکس شده، ولی نه نسبت به این خط. هر خانه باید عمود بر خط‌چین، به همان فاصله آن طرف برود.${green}` };
    default:
      return { tone: "bad", text: `شکلی که رنگ کردی با شکل اصلی فرق دارد؛ خانه‌ها را یکی‌یکی ببر.${green}` };
  }
}

interface Props {
  question: TransformQuestion;
  type: TransformQuestionType;
  level: Level;
  initialPick?: number;
  painted: string[];
  onClearPaint: () => void;
  onType: (t: TransformQuestionType) => void;
  onLevel: (l: Level) => void;
  onNew: () => void;
  /** The child answered: the picked option's index, or the coloured cells. */
  onAnswered: (response: number | string[]) => void;
  onScene: (s: SceneSetup) => void;
  /** Mock exam: record the answer, show nothing about it. */
  exam?: boolean;
}

export function TransformTryPanel(p: Props) {
  const { question: q } = p;
  const [picked, setPicked] = useState<number | null>(isPaint(q) ? null : (p.initialPick ?? null));
  const [checked, setChecked] = useState(false);
  const answered = picked !== null || checked;

  // In a mock exam the board keeps the question as it was (no solution, no
  // green cells), only the colouring stops.
  const { exam } = p;
  const scene = useMemo(() => {
    const s = sceneFor(q, answered && !exam);
    return exam && answered ? { ...s, paint: false } : s;
  }, [q, answered, exam]);
  const { onScene } = p;
  useEffect(() => onScene(scene), [scene, onScene]);

  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    p.onAnswered(i);
  };

  let fb = picked !== null && !exam ? choiceFeedback(q, picked) : null;
  if (isPaint(q) && checked && !exam) fb = paintFeedback(q, p.painted);

  const mark = (i: number): Tone | null => {
    if (picked === null || isPaint(q) || exam) return null;
    if (i === q.answer) return "good";
    return i === picked ? choiceFeedback(q, i).tone : null;
  };

  const figs = q.type === "draw" || q.type === "shift" ? [] : q.type === "which" ? [q.figure, q.image] : [q.figure, ...q.options];
  const box = boxFor(figs);

  return (
    <div className={styles.panel}>
      <div className={styles.types} role="radiogroup" aria-label="نوع پرسش" data-practice-hide>
        {(Object.keys(TRANSFORM_TYPE_LABEL) as TransformQuestionType[]).map((t) => (
          <button key={t} role="radio" aria-checked={p.type === t} onClick={() => p.onType(t)}>
            {TRANSFORM_TYPE_LABEL[t]}
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

      <p className={styles.prompt}>{transformPrompt(q)}</p>

      {(q.type === "mirror" || q.type === "water" || q.type === "rotate" || q.type === "combo" || q.type === "sequence") && (
        <ul className={styles.options}>
          {q.options.map((fig, i) => {
            const m = mark(i);
            return (
              <li key={i}>
                <button className={`${styles.option} ${m ? styles[m] : ""}`} onClick={() => pick(i)} disabled={picked !== null} aria-label={`گزینه ${fa(i + 1)}`}>
                  <FigureSvg fig={fig} box={box} size={104} />
                  <span className={styles.optionNum}>
                    {fa(i + 1)} {m && ICON[m]}{exam && i === picked && " · انتخاب تو"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {q.type === "which" && (
        <ul className={styles.options}>
          {q.options.map((name, i) => {
            const m = mark(i);
            return (
              <li key={i}>
                <button className={`${styles.option} ${m ? styles[m] : ""}`} onClick={() => pick(i)} disabled={picked !== null}>
                  <span className={styles.optionNum}>
                    {MOVE_NAME[name]} {m && ICON[m]}{exam && i === picked && " · انتخاب تو"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {q.type === "shift" && q.form === "vector" && (
        <ul className={styles.options}>
          {q.options.map((v, i) => {
            const m = mark(i);
            return (
              <li key={i}>
                <button className={`${styles.option} ${m ? styles[m] : ""}`} onClick={() => pick(i)} disabled={picked !== null}>
                  <span className={styles.optionNum}>
                    {vecText(v)} {m && ICON[m]}{exam && i === picked && " · انتخاب تو"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {isPaint(q) && (
        <>
          <p className={styles.hint}>
            {checked && exam ? "جوابت ثبت شد." : checked ? "خانه راه‌راه: رنگ تو · مربع سبز: جای درست · ✗: اشتباه" : `روی خانه‌های صفحه بزن تا رنگ شوند (${fa(p.painted.length)} خانه). دوباره بزنی، پاک می‌شود.`}
          </p>
          {!checked && (
            <div className={styles.chips}>
              <button
                className={styles.secondary}
                disabled={!p.painted.length}
                onClick={() => {
                  setChecked(true);
                  p.onAnswered(p.painted);
                }}
              >
                بررسی
              </button>
              <button onClick={p.onClearPaint} disabled={!p.painted.length}>
                پاک کن
              </button>
            </div>
          )}
        </>
      )}

      {fb && (
        <p className={`${styles.feedback} ${styles[fb.tone]}`} role="status" aria-live="polite">
          <span className={styles.icon}>{ICON[fb.tone]}</span> {fb.text}
        </p>
      )}
      {answered && !exam && <p className={styles.hint}>روی صفحه، تبدیل انجام می‌شود؛ با نوار پایین صفحه جلو و عقب ببر.</p>}

      <button className={styles.next} onClick={p.onNew}>
        نمونه تازه
      </button>
    </div>
  );
}

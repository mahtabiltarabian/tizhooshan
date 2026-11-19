"use client";

import { useEffect, useMemo, useState } from "react";
import {
  bounds,
  moveAll,
  shapeKey,
  stagedOps,
  type Figure,
  type Level,
  type MoveName,
  type Op,
  type TransformQuestion,
  type TransformQuestionType,
} from "@/generators/transforms";
import { fa } from "@/tools/registry";
import { boxFor, FigureSvg } from "./Pictures";
import type { Rect } from "./Scene";
import styles from "@/toolkit/TryPanel.module.css";

export const TRANSFORM_TYPE_LABEL: Record<TransformQuestionType, string> = {
  mirror: "تصویر در آینه",
  water: "تصویر در آب",
  rotate: "دوران",
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
  }
}

function choiceFeedback(q: TransformQuestion, picked: number): { tone: Tone; text: string } {
  if (q.type === "draw") return { tone: "bad", text: "" };
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

function drawFeedback(q: Extract<TransformQuestion, { type: "draw" }>, painted: string[]): { tone: Tone; text: string } {
  const sorted = [...painted].sort();
  if (sorted.join(";") === q.answer.join(";")) return { tone: "good", text: "آفرین! هر خانه به همان فاصله، آن طرف رفته است. خط‌چین‌های آبی هر خانه را به تصویرش وصل می‌کنند." };
  const asFigure = (keys: string[]): Figure => ({ cells: keys.map((k) => k.split(",").map((v) => Number(v) + 0.5) as [number, number]) });
  if (painted.length === q.answer.length) {
    if (shapeKey(asFigure(sorted)) === shapeKey(asFigure(q.answer)))
      return { tone: "turned", text: "نزدیک بود! شکل درست است ولی جایش نه. فاصله هر خانه تا خط (یا نقطه) باید همان فاصله شکل اصلی باشد." };
    if (shapeKey(asFigure(sorted)) === shapeKey(q.figure))
      return { tone: "bad", text: q.op.kind === "reflect" ? "شکل را فقط جابه‌جا کردی؛ قرینه باید برعکس باشد." : "شکل را فقط جابه‌جا کردی؛ باید بچرخد." };
  }
  return { tone: "bad", text: `${painted.length !== q.answer.length ? `تصویر ${fa(q.answer.length)} خانه دارد؛ تو ${fa(painted.length)} خانه رنگ کردی. ` : ""}مربع‌های سبز جای درست‌اند.` };
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
  onAnswered: () => void;
  onScene: (s: SceneSetup) => void;
}

export function TransformTryPanel(p: Props) {
  const { question: q } = p;
  const [picked, setPicked] = useState<number | null>(q.type === "draw" ? null : (p.initialPick ?? null));
  const [checked, setChecked] = useState(false);
  const answered = picked !== null || checked;

  const scene = useMemo(() => sceneFor(q, answered), [q, answered]);
  const { onScene } = p;
  useEffect(() => onScene(scene), [scene, onScene]);

  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    p.onAnswered();
  };

  let fb = picked !== null ? choiceFeedback(q, picked) : null;
  if (q.type === "draw" && checked) fb = drawFeedback(q, p.painted);

  const mark = (i: number): Tone | null => {
    if (picked === null || q.type === "draw") return null;
    if (i === q.answer) return "good";
    return i === picked ? choiceFeedback(q, i).tone : null;
  };

  const figs = q.type === "draw" ? [] : q.type === "which" ? [q.figure, q.image] : [q.figure, ...q.options];
  const box = boxFor(figs);

  return (
    <div className={styles.panel}>
      <div className={styles.types} role="radiogroup" aria-label="نوع پرسش">
        {(Object.keys(TRANSFORM_TYPE_LABEL) as TransformQuestionType[]).map((t) => (
          <button key={t} role="radio" aria-checked={p.type === t} onClick={() => p.onType(t)}>
            {TRANSFORM_TYPE_LABEL[t]}
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
                    {fa(i + 1)} {m && ICON[m]}
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
                    {MOVE_NAME[name]} {m && ICON[m]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {q.type === "draw" && (
        <>
          <p className={styles.hint}>
            {checked ? "خانه راه‌راه: رنگ تو · مربع سبز: جای درست · ✗: اشتباه" : `روی خانه‌های صفحه بزن تا رنگ شوند (${fa(p.painted.length)} خانه). دوباره بزنی، پاک می‌شود.`}
          </p>
          {!checked && (
            <div className={styles.chips}>
              <button
                className={styles.secondary}
                disabled={!p.painted.length}
                onClick={() => {
                  setChecked(true);
                  p.onAnswered();
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
      {answered && <p className={styles.hint}>روی صفحه، تبدیل انجام می‌شود؛ با نوار پایین صفحه جلو و عقب ببر.</p>}

      <button className={styles.next} onClick={p.onNew}>
        نمونه تازه
      </button>
    </div>
  );
}

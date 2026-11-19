"use client";

import { useState } from "react";
import { FILL_NAME, SHAPE_NAME, type Level, type PatternQuestion, type PatternQuestionType, type Tag, type Tile } from "@/generators/patterns";
import { fa } from "@/tools/registry";
import { PatchSvg, TileSvg } from "./Pictures";
import styles from "@/toolkit/TryPanel.module.css";

export const PATTERN_TYPE_LABEL: Record<PatternQuestionType, string> = {
  matrix2: "ماتریس ۲×۲",
  matrix3: "ماتریس ۳×۳",
  sequence: "دنباله تصویری",
  rotation: "الگوی چرخشی",
  combine: "جمع و تفریق شکل",
  sides: "ضلع و نقطه",
  missing: "قطعه گمشده",
  odd: "شکل متفاوت",
};

/** The one thing a wrong option got wrong, in words. */
const TAG_NAME: Partial<Record<Tag, string>> = {
  turn: "چرخش",
  count: "تعداد",
  shape: "شکل",
  fill: "رنگ",
  lines: "خط‌ها",
  marks: "جای نشانه‌ها",
  arrow: "جهت پیکان",
  sides: "تعداد ضلع‌ها",
  dots: "تعداد نقطه‌ها",
};

export function patternPrompt(q: PatternQuestion, paper = false): string {
  switch (q.type) {
    case "matrix2":
    case "matrix3":
      return "کدام گزینه جای «؟» را پر می‌کند؟ سطرها را از راست به چپ بخوان.";
    case "sequence":
      return "دنباله از راست به چپ است. خانه بعدی کدام است؟";
    case "rotation":
      return "نشانه‌ها دور قاب حرکت می‌کنند. خانه بعدی کدام است؟";
    case "sides":
      return "ضلع‌ها و نقطه‌ها را بشمار. خانه بعدی کدام است؟";
    case "combine":
      return q.level === 1
        ? "دو شکل را روی هم بگذار. کدام می‌شود؟"
        : q.level === 2
          ? "دو شکل را روی هم بگذار و خط‌های مشترک را پاک کن. کدام می‌شود؟"
          : "در هر سطر، خانه سوم از روی‌هم‌گذاشتن دو خانه اول ساخته شده. جای «؟» کدام است؟";
    case "missing":
      return "کدام تکه جای خالی تصویر را پر می‌کند؟";
    case "odd":
      return paper ? "کدام شکل با بقیه فرق دارد؟" : "کدام شکل با بقیه فرق دارد؟ روی آن بزن (روی صفحه یا این‌جا).";
  }
}

/** A tile in words, when it is made of shapes. */
export function tileWords(t: Tile): string {
  if (!t.shape) return "";
  const turn = t.turn ? `، ${fa(t.turn * 45)} درجه چرخیده` : "";
  return `${fa(t.count ?? 1)} ${SHAPE_NAME[t.shape]} ${FILL_NAME[t.fill ?? "white"]}${turn}`;
}

type Tone = "good" | "turned" | "bad";
const ICON: Record<Tone, string> = { good: "✓", turned: "↻", bad: "✗" };

function feedback(q: PatternQuestion, picked: number): { tone: Tone; text: string } {
  if (q.type === "odd") return picked === q.answer ? { tone: "good", text: `درست است! ${q.why}` } : { tone: "bad", text: `این نه. شکل ${fa(q.answer + 1)} فرق دارد: ${q.why}` };
  if (picked === q.answer) return { tone: "good", text: "درست است! قانون‌ها را روی صفحه یکی‌یکی ببین." };
  const tag = q.tags[picked];
  switch (tag) {
    case "copy":
      return { tone: "bad", text: "این همان خانه کناری است؛ ولی الگو در هر خانه تغییر می‌کند." };
    case "otherOp":
      return {
        tone: "turned",
        text: q.type === "combine" && q.level === 1 ? "نزدیک بود! روی‌هم‌گذاشتن یعنی همه خط‌ها می‌مانند؛ هیچ خطی پاک نمی‌شود." : "نزدیک بود! خط‌ها درست انتخاب شده‌اند، ولی قانون این‌جا فرق دارد: ببین خط‌های مشترک می‌مانند یا پاک می‌شوند.",
      };
    case "patchShift":
      return { tone: "bad", text: "این تکه از جای دیگری از همین تصویر است؛ به خانه‌های دور جای خالی نگاه کن." };
    case "patchMirror":
      return { tone: "turned", text: "نزدیک بود! همین خانه‌هاست ولی جابه‌جا چیده شده؛ ترتیب را با خانه‌های کناری بسنج." };
    case "patchTile":
      return { tone: "turned", text: "نزدیک بود! فقط یکی از چهار خانه اشتباه است." };
    default:
      return { tone: "turned", text: `نزدیک بود! همه‌چیز درست است جز «${TAG_NAME[tag] ?? "یک چیز"}».` };
  }
}

interface Props {
  question: PatternQuestion;
  type: PatternQuestionType;
  level: Level;
  picked: number | null;
  onPick: (i: number) => void;
  onType: (t: PatternQuestionType) => void;
  onLevel: (l: Level) => void;
  onNew: () => void;
}

export function PatternTryPanel(p: Props) {
  const { question: q, picked } = p;
  const [rulesOpen, setRulesOpen] = useState(false);
  const fb = picked !== null ? feedback(q, picked) : null;
  const mark = (i: number): Tone | null => {
    if (picked === null) return null;
    if (i === q.answer) return "good";
    return i === picked ? feedback(q, i).tone : null;
  };
  // Rule sentences: the general ones if there are any, else the step-by-step ones.
  const whys = q.type === "odd" ? [] : q.why;
  const summaries = whys.some((w) => !w.cells.length) ? whys.filter((w) => !w.cells.length) : whys;

  return (
    <div className={styles.panel}>
      <div className={styles.types} role="radiogroup" aria-label="نوع پرسش">
        {(Object.keys(PATTERN_TYPE_LABEL) as PatternQuestionType[]).map((t) => (
          <button key={t} role="radio" aria-checked={p.type === t} onClick={() => p.onType(t)}>
            {PATTERN_TYPE_LABEL[t]}
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

      <p className={styles.prompt}>{patternPrompt(q)}</p>

      <ul className={styles.options} style={q.type === "odd" ? { gridTemplateColumns: "repeat(5, minmax(0, 1fr))" } : q.options.length === 6 ? { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" } : undefined}>
        {(q.type === "odd" ? q.tiles : q.options).map((o, i) => {
          const m = mark(i);
          return (
            <li key={i}>
              <button className={`${styles.option} ${m ? styles[m] : ""}`} onClick={() => p.onPick(i)} disabled={picked !== null} aria-label={`گزینه ${fa(i + 1)}`}>
                {q.type === "missing" ? <PatchSvg tiles={o as Tile[]} size={84} /> : <TileSvg tile={o as Tile} size={q.type === "odd" ? 48 : 72} />}
                <span className={styles.optionNum}>
                  {fa(i + 1)} {m && ICON[m]}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {fb && (
        <p className={`${styles.feedback} ${styles[fb.tone]}`} role="status" aria-live="polite">
          <span className={styles.icon}>{ICON[fb.tone]}</span> {fb.text}
        </p>
      )}
      {picked !== null && summaries.length > 0 && (
        <>
          <button className={styles.secondary} onClick={() => setRulesOpen((o) => !o)} aria-expanded={rulesOpen}>
            {rulesOpen ? "پنهان کردن قانون‌ها" : "قانون‌ها چه بود؟"}
          </button>
          {rulesOpen && (
            <ul className={styles.hint} style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.9 }}>
              {summaries.map((w, i) => (
                <li key={i}>{w.text}</li>
              ))}
            </ul>
          )}
        </>
      )}
      {picked !== null && q.type !== "odd" && <p className={styles.hint}>روی صفحه، قانون هر سطر و ستون جداگانه برجسته می‌شود؛ با نوار پایین جلو و عقب ببر.</p>}

      <button className={styles.next} onClick={p.onNew}>
        نمونه تازه
      </button>
    </div>
  );
}

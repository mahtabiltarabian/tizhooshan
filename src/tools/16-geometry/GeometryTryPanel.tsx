"use client";

import { useState } from "react";
import { answerKind, checkBuild, checkCut, geometryMistake, type BuildQuestion, type DivideQuestion, type GeometryQuestion, type GeometryQuestionType, type Level, type Pt } from "@/generators/geometry";
import { NumberPad } from "@/toolkit/NumberPad";
import { fa } from "@/tools/registry";
import { ltr, num } from "./frames";
import { answerFa, buildHow, choicesOf, divideHow, GEOMETRY_TYPE_LABEL, geometryHow, geometryPrompt, isMeasure, LEVEL_LABEL, POLY_NAME } from "./GeometryText";
import { DecimalPad } from "./MeasurePictures";
import { measureSlipText } from "./MeasureText";
import { parallelSlipText } from "./ParallelText";
import styles from "@/toolkit/TryPanel.module.css";

export { answerFa, choicesOf, GEOMETRY_TYPE_LABEL, geometryHow, geometryPrompt, isMeasure, LEVEL_LABEL } from "./GeometryText";

type Tone = "good" | "turned" | "bad";
const ICON: Record<Tone, string> = { good: "✓", turned: "↻", bad: "✗" };

function numberFeedback(q: GeometryQuestion, v: number): { tone: Tone; text: string } {
  const how = geometryHow(q);
  const right = `جواب ${answerFa(q)} است. ${how}`;
  const t = (text: string) => ({ tone: "turned" as Tone, text: `${text} ${right}` });
  const a = q.type === "angle" ? q.angles : [];
  if (q.type === "circle" || q.type === "composite") {
    const tag = geometryMistake(q, v);
    if (tag === "right") return { tone: "good", text: `درست است! ${how}` };
    if (tag === "other") return { tone: "bad", text: right };
    return t(measureSlipText(q, tag as Parameters<typeof measureSlipText>[1]));
  }
  if (q.type === "parallel") {
    const tag = geometryMistake(q, v);
    if (tag === "right") return { tone: "good", text: `درست است! ${how}` };
    if (tag === "other") return { tone: "bad", text: right };
    return t(parallelSlipText(q, tag as Parameters<typeof parallelSlipText>[1]));
  }
  switch (geometryMistake(q, v)) {
    case "right":
      return { tone: "good", text: `درست است! ${how}` };
    case "perimeter":
      return t("این محیط شکل است، نه مساحت. مساحت یعنی چند مربع درون شکل جا می‌شود.");
    case "halfAsWhole":
      return t("نیم‌مربع‌ها را کامل شمردی. هر دو نیم‌مربع با هم یک مربع می‌شوند.");
    case "noHalves":
      return t("نیم‌مربع‌ها را جا انداختی؛ هر دو تا با هم یک مربع کامل است.");
    case "noHalf":
      return q.type === "angle"
        ? t(q.ask === 1 ? "باقی‌مانده بین دو زاویه پایه تقسیم می‌شود؛ ÷ ۲ یادت رفت." : "دو زاویه پایه داریم، نه یکی؛ هر دو را از ۱۸۰ کم کن.")
        : t(q.type === "area" && q.poly.length === 3 ? "مساحت مثلث نصف مستطیل دورش است؛ «÷ ۲» یادت رفت." : "هر تکه گوشه یک مثلث است، یعنی نصف یک مستطیل؛ «÷ ۲» یادت رفت.");
    case "box":
      return q.type === "perimeter" ? t("دو ضلع داخل فرورفتگی را جا انداختی؛ آن‌ها هم جزء دور شکل‌اند.") : t("این مساحت مستطیل دور شکل است؛ تکه‌های گوشه را باید از آن کم کنی.");
    case "dots":
      return q.type === "area" ? t("میخ‌ها را شمردی، نه مربع‌ها. مساحت را با مربع‌های بین میخ‌ها می‌شمارند.") : t("میخ‌ها را شمردی و گوشه‌ها دو بار شمرده شدند. فاصله‌های بین میخ‌ها را بشمار، نه خود میخ‌ها را.");
    case "area":
      return t("این مساحت شکل است، نه محیط. محیط یعنی طول دور شکل.");
    case "cells":
      return t("مربع‌های کنار لبه را شمردی؛ مربع گوشه دو ضلع روی لبه دارد ولی یک بار شمرده شد. ضلع‌ها را بشمار.");
    case "halfP":
      return t("فقط نیمی از دور شکل را شمردی؛ همه ضلع‌ها را دور تا دور جمع کن.");
    case "supplement":
      return t(`این زاویه کنار آن روی خط صاف است: ${ltr(`۱۸۰ − ${fa(q.answer)} = ${fa(v)}`)}. خوب نگاه کن کدام زاویه بین دو کش است.`);
    case "reflex":
      return t("این زاویه بیرونی و بزرگ است؛ زاویه بین دو کش، قسمت کوچک‌تر است.");
    case "sum360":
      return t(q.type === "angle" && a.length > 4 ? `جمع زاویه‌های ${POLY_NAME[a.length]} ۳۶۰° نیست.` : "جمع زاویه‌های مثلث ۱۸۰° است، نه ۳۶۰°.");
    case "noSubtract":
      return t("دو زاویه معلوم را جمع کردی؛ حالا جمعشان را از ۱۸۰ کم کن.");
    case "interior":
      return t("این زاویه داخلی گوشه سوم است. زاویه بیرونی کنار آن است: با هم ۱۸۰°.");
    case "nTimes180":
      return t(`جمع زاویه‌ها ${ltr(`${fa(a.length)} × ۱۸۰`)} نیست: هر ${POLY_NAME[a.length] ?? "چندضلعی"} به ${fa(a.length - 2)} مثلث تقسیم می‌شود.`);
    case "total":
      return t(q.type === "angle" && q.variant === "regular" ? `این جمع همه زاویه‌هاست؛ بین ${fa(a.length)} زاویه برابر تقسیمش کن.` : "این جمع همه زاویه‌هاست؛ زاویه‌های معلوم را از آن کم کن.");
    case "exterior":
      return t(`این زاویه بیرونی است (${ltr(`۳۶۰ ÷ ${fa(a.length)}`)})؛ زاویه داخلی با آن ۱۸۰° می‌شود.`);
    case "slantRight":
      return t("زاویه قائمه می‌تواند کج باشد!");
    case "nearRight":
      return t("نزدیک ۹۰° است ولی دقیقاً نه. با گوشه یک مربع شبکه مقایسه کن.");
    case "smallAngle":
      return t("هر مثلثی دست‌کم دو زاویه تند دارد؛ نوع مثلث را بزرگ‌ترین زاویه‌اش تعیین می‌کند.");
    case "swap":
      return t("تند یعنی کمتر از ۹۰° و باز یعنی بیشتر از ۹۰°.");
    default:
      return { tone: "bad", text: right };
  }
}

function buildFeedback(q: BuildQuestion, band: Pt[]): { tone: Tone; text: string } {
  const r = checkBuild(q, band);
  const stats = r.tag === "few" || r.tag === "crossing" ? "" : ` شکل تو: مساحت ${num(r.area)}${r.perimeter === null ? "، با ضلع کج" : `، محیط ${fa(r.perimeter)}`}.`;
  const t = (text: string) => ({ tone: "turned" as Tone, text: `${text}${stats} ${buildHow(q)}` });
  switch (r.tag) {
    case "right":
      return { tone: "good", text: `درست است!${stats} شکل‌های دیگری هم درست‌اند؛ هر شکلی با این شرط پذیرفته می‌شود. ${buildHow(q)}` };
    case "few":
      return { tone: "bad", text: "کش دست‌کم باید دور سه میخ بپیچد." };
    case "crossing":
      return { tone: "bad", text: "کش از روی خودش رد شده یا همه میخ‌ها روی یک خط‌اند؛ این شکل نیست. میخ‌ها را به ترتیب دور شکل لمس کن." };
    case "notRect":
      return t("این مستطیل نیست: مستطیل چهار گوشه قائمه و ضلع‌های روی خطوط شبکه دارد.");
    case "notTri":
      return t(`این مثلث نیست؛ شکل تو ${fa(band.length)} گوشه دارد.`);
    case "notSquare":
      return t("این مربع نیست: هر چهار ضلع باید هم‌اندازه و گوشه‌ها قائمه باشند.");
    case "notSlanted":
      return t("مربع درستی است ولی صاف است؛ مربعی بساز که ضلع‌هایش کج باشند.");
    case "notGrid":
      return t("یک ضلع کج است؛ همه ضلع‌ها باید روی خطوط شبکه باشند تا محیط را بشود شمرد.");
    case "isRect":
      return t("محیطش درست است ولی مستطیل است؛ شکل دیگری بساز، مثلاً یک گوشه را تو ببر.");
    case "confused":
      return t("مساحت و محیط جابه‌جا شدند.");
    case "noHalf":
      return t("مساحت این مثلث دو برابر خواسته است: یادت باشد «قاعده × ارتفاع ÷ ۲».");
    case "areaOnly":
      return t("مساحت درست است ولی محیط نه.");
    case "perimOnly":
      return t("محیط درست است ولی مساحت نه.");
    default:
      return t("هنوز به عدد خواسته‌شده نرسیده.");
  }
}

function cutFeedback(q: DivideQuestion, band: Pt[]): { tone: Tone; text: string } {
  const r = checkCut(q, band[0], band[1]);
  switch (r.tag) {
    case "right":
      return { tone: "good", text: `درست است! هر قسمت ${num(r.parts![0])} واحد مربع. ${divideHow(q)} هر کدام پذیرفته می‌شود.` };
    case "few":
      return { tone: "bad", text: "دو میخ مختلف لازم است." };
    case "notEdge":
      return { tone: "bad", text: `هر دو سر کش باید روی لبه شکل باشند. ${divideHow(q)}` };
    case "alongEdge":
      return { tone: "bad", text: `کش روی لبه شکل افتاده؛ باید از درون شکل رد شود. ${divideHow(q)}` };
    default:
      return { tone: "turned", text: `دو قسمت ${num(r.parts![0])} و ${num(r.parts![1])} واحد مربع‌اند؛ برابر نیستند. ${divideHow(q)}` };
  }
}

interface Props {
  question: GeometryQuestion;
  type: GeometryQuestionType;
  level: Level;
  checked: number | null;
  onCheck: (v: number) => void;
  /** Mock exam: record the answer, show nothing about it. */
  exam?: boolean;
  /** Build: pegs of the band so far. Divide: the chosen pegs. */
  band: Pt[];
  onUndo: () => void;
  onClear: () => void;
  onType: (t: GeometryQuestionType) => void;
  onLevel: (l: Level) => void;
  onNew: () => void;
}

export function GeometryTryPanel(p: Props) {
  const { question: q, checked } = p;
  const kind = answerKind(q.type);
  const decimal = isMeasure(q.type);
  const [num0, setNum] = useState(kind === "number" && checked !== null ? String(decimal ? checked : Math.floor(checked)) : "");
  const [half, setHalf] = useState(kind === "number" && checked !== null && checked % 1 !== 0);
  const [choice, setChoice] = useState<number | null>(kind === "choice" ? checked : null);
  const done = checked !== null;

  // In a mock exam nothing tells right from wrong until the end.
  const shown = done && !p.exam;
  let fb: { tone: Tone; text: string } | null = null;
  if (shown) {
    if (q.type === "build") fb = buildFeedback(q, p.band);
    else if (q.type === "divide") fb = p.band.length === 2 ? cutFeedback(q, p.band) : null;
    else fb = numberFeedback(q, checked);
  }

  const ready = kind === "number" ? (decimal ? num0 !== "" && num0 !== "0." : num0 !== "" || half) : kind === "choice" ? choice !== null : kind === "shape" ? p.band.length >= 3 : p.band.length === 2;
  const value = kind === "number" ? Number(num0 || 0) + (half ? 0.5 : 0) : kind === "choice" ? choice! : 0;

  return (
    <div className={styles.panel}>
      <div className={styles.types} role="radiogroup" aria-label="نوع پرسش" data-practice-hide>
        {(Object.keys(GEOMETRY_TYPE_LABEL) as GeometryQuestionType[]).map((t) => (
          <button key={t} role="radio" aria-checked={p.type === t} onClick={() => p.onType(t)}>
            {GEOMETRY_TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      <div className={styles.chips} role="radiogroup" aria-label="سطح" data-practice-hide>
        {([1, 2, 3] as Level[]).map((l) => (
          <button key={l} role="radio" aria-checked={p.level === l} onClick={() => p.onLevel(l)} style={{ fontSize: "0.8rem" }}>
            {fa(l)}. {LEVEL_LABEL[p.type][l - 1]}
          </button>
        ))}
      </div>

      <p className={styles.prompt}>{geometryPrompt(q)}</p>

      {kind === "number" && (
        <>
          {decimal ? <DecimalPad value={num0} onChange={setNum} disabled={done} /> : <NumberPad value={num0} onChange={setNum} disabled={done} />}
          {q.type === "area" && (
            <div className={styles.chips}>
              <button aria-pressed={half} onClick={() => setHalf(!half)} disabled={done}>
                {half ? "✓ " : ""}و نیم (½)
              </button>
            </div>
          )}
          {q.type === "area" && (num0 || half) && (
            <output className={styles.hint} aria-live="polite">
              جواب تو: {num(value)} واحد مربع
            </output>
          )}
        </>
      )}

      {kind === "choice" && (
        <ul className={styles.options} style={{ gridTemplateColumns: "1fr" }}>
          {choicesOf(q.level).map((label, i) => {
            const mark = shown ? (i === q.answer ? "good" : i === checked ? "bad" : null) : choice === i ? "turned" : null;
            return (
              <li key={i}>
                <button className={`${styles.option} ${mark ? styles[mark] : ""}`} onClick={() => setChoice(i)} disabled={done} aria-pressed={choice === i}>
                  <span className={styles.optionNum}>
                    {shown && i === q.answer ? "✓ " : shown && i === checked ? "✗ " : choice === i ? "● " : ""}
                    {label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {(kind === "shape" || kind === "cut") && (
        <>
          <p className={styles.hint}>
            {kind === "shape"
              ? `میخ‌های لمس‌شده: ${fa(p.band.length)}. برای برداشتن آخرین میخ دوباره لمسش کن؛ گوشه‌ها را می‌توانی بکشی و جابه‌جا کنی.`
              : `میخ‌های انتخاب‌شده: ${fa(p.band.length)} از ۲. میخ انتخاب‌شده را دوباره لمس کنی برداشته می‌شود.`}
          </p>
          {!done && (
            <div className={styles.chips}>
              <button onClick={p.onUndo} disabled={!p.band.length}>
                ↶ برداشتن آخرین میخ
              </button>
              <button onClick={p.onClear} disabled={!p.band.length}>
                پاک کردن کش
              </button>
            </div>
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
      {shown && (q.type === "area" || q.type === "perimeter" || q.type === "parallel" || decimal) && <p className={styles.hint}>روی صفحه، {decimal || q.type === "parallel" ? "راه‌حل" : "شمارش"} قدم‌به‌قدم نشان داده می‌شود؛ با نوار پایین جلو و عقب ببر.</p>}
      {shown && (q.type === "build" || q.type === "divide") && fb?.tone !== "good" && <p className={styles.hint}>روی صفحه، کش تو نارنجی و پررنگ است و یک جواب درست سبز و خط‌چین.</p>}

      <button className={styles.next} onClick={p.onNew}>
        نمونه تازه
      </button>
    </div>
  );
}

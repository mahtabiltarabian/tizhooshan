"use client";

import { useState } from "react";
import {
  ALPHABET,
  diffsOf,
  letterAt,
  sequenceMistake,
  type BlankChoice,
  type Level,
  type Op,
  type SequenceQuestion,
  type SequenceQuestionType,
  type Strand,
} from "@/generators/sequence";
import { NumberPad } from "@/toolkit/NumberPad";
import { fa } from "@/tools/registry";
import { ltr, rowsHint, signedFa, stepFa, termFa } from "./Train";
import styles from "@/toolkit/TryPanel.module.css";

/** The try-it types: the rule families, plus repeating patterns and the nth term (each with its own generator). */
export type SeqTryType = SequenceQuestionType | "cycle" | "nth";

export const SEQ_TYPE_LABEL: Record<SeqTryType, string> = {
  mixed: "به ترتیب سطح",
  arithmetic: "حسابی",
  geometric: "هندسی",
  alternate: "یکی‌درمیان",
  second: "اختلاف دوم",
  additive: "جمع دو قبلی",
  letters: "حرفی",
  cycle: "تکرار و باقیمانده",
  nth: "جمله nام",
};

export const BLANK_LABEL: Record<BlankChoice, string> = { auto: "خالی هرجا", last: "خالی آخر", mid: "خالی وسط" };

/** "۲، ۵، ۸، ؟، ۱۴" — Persian commas keep the terms in reading order. */
export function seqFa(q: SequenceQuestion, withGap = true) {
  return q.terms.map((v, k) => (withGap && k === q.blank ? "؟" : termFa(v, q.letters))).join("، ");
}

export function sequencePrompt(q: SequenceQuestion, paper = false): string {
  const what = q.letters ? "کدام حرف" : "کدام عدد";
  if (paper) return `${what} جای خالی است؟${q.letters ? " (ترتیب الفبای فارسی)" : ""}`;
  return `${seqFa(q)} — ${what} جای «؟» است؟`;
}

/** "۱۴ + ۳ = ۱۷" or "۵۴ × ۳ = ۱۶۲", left to right. */
const eqFa = (a: number, op: Op, by: number, c: number) => ltr(`${fa(a)} ${op === "+" ? (by < 0 ? "−" : "+") : op} ${fa(op === "+" ? Math.abs(by) : by)} = ${fa(c)}`);

/** One step back along a strand, for a gap at the start of it. */
function backFa(next: number, s: Strand, c: number) {
  const sym = s.op === "+" ? (s.by > 0 ? "−" : "+") : s.op === "×" ? "÷" : "×";
  return ltr(`${fa(next)} ${sym} ${fa(Math.abs(s.by))} = ${fa(c)}`);
}

/** The working, in one line. */
export function sequenceHow(q: SequenceQuestion): string {
  const t = q.terms;
  const i = q.blank;
  const x = q.answer;
  const r = q.rule;
  const tail = q.letters ? `؛ حرف شماره ${fa(x)} در الفبا «${letterAt(x)}» است` : "";
  switch (r.kind) {
    case "step":
      if (r.op === "+")
        return q.letters
          ? `هر حرف ${fa(Math.abs(r.by))} خانه ${r.by > 0 ? "جلوتر" : "عقب‌تر"} از حرف قبلی در الفباست: ${eqFa(t[i - 1], "+", r.by, x)}${tail}.`
          : `هر جمله ${fa(Math.abs(r.by))} تا ${r.by > 0 ? "بیشتر" : "کمتر"} از جمله قبلی است: ${eqFa(t[i - 1], "+", r.by, x)}.`;
      if (r.op === "×") return `هر جمله ${fa(r.by)} برابر جمله قبلی است: ${eqFa(t[i - 1], "×", r.by, x)}.`;
      return `هر جمله تقسیم بر ${fa(r.by)} می‌شود: ${eqFa(t[i - 1], "÷", r.by, x)}.`;
    case "grow": {
      const d = diffsOf(t);
      return `اختلاف‌ها ${d.map((v) => ltr(signedFa(v))).join("، ")} هستند و هر بار ${fa(r.growth)} تا بیشتر می‌شوند (اختلاف دوم ثابت است). جای خالی: ${eqFa(t[i - 1], "+", d[i - 1], x)}${tail}.`;
    }
    case "sum2":
      if (i >= 2) return `هر جمله جمع دو جمله قبلی است: ${ltr(`${fa(t[i - 2])} + ${fa(t[i - 1])} = ${fa(x)}`)}.`;
      return `هر جمله جمع دو جمله قبلی است؛ پس ${ltr(`${fa(t[0])} + ؟ = ${fa(t[2])}`)} و جای خالی ${ltr(`${fa(t[2])} − ${fa(t[0])} = ${fa(x)}`)} است.`;
    case "alt": {
      const own = i % 2 === 0 ? r.a : r.b;
      const which = i % 2 === 0 ? "● (جمله‌های اول، سوم، پنجم، …)" : "▲ (جمله‌های دوم، چهارم، ششم، …)";
      const eq = i >= 2 ? eqFa(t[i - 2], own.op, own.by, x) : `یک گام به عقب: ${backFa(t[i + 2], own, x)}`;
      return `دو دنباله درهم‌اند: دنباله ● با گام ${ltr(stepFa(r.a.op, r.a.by))} و دنباله ▲ با گام ${ltr(stepFa(r.b.op, r.b.by))}. جای خالی در دنباله ${which} است: ${eq}${tail}.`;
    }
  }
}

/** The answer in words. */
export const answerFa = (q: SequenceQuestion, v = q.answer) => termFa(v, q.letters);

type Tone = "good" | "turned" | "bad";
const ICON: Record<Tone, string> = { good: "✓", turned: "↻", bad: "✗" };

function sameDiffText(q: SequenceQuestion) {
  switch (q.rule.kind) {
    case "step":
      return "اختلاف‌ها اینجا ثابت نیستند. نسبت هر جمله به جمله قبلی را ببین.";
    case "grow":
      return "اختلاف‌ها خودشان هر بار تغییر می‌کنند؛ زیر اختلاف‌ها، ردیف اختلاف دوم را بساز.";
    case "sum2":
      return "اختلاف ثابت نیست؛ دو جمله پشت سر هم را با هم جمع کن و با جمله بعدی مقایسه کن.";
    case "alt":
      return "همه جمله‌ها یک دنباله نیستند؛ یکی‌درمیان نگاه کن، دو دنباله درهم‌اند.";
  }
}

function feedback(q: SequenceQuestion, v: number): { tone: Tone; text: string } {
  const how = sequenceHow(q);
  const right = `جواب ${answerFa(q)} است. ${how}`;
  const r = q.rule;
  switch (sequenceMistake(q, v)) {
    case "right":
      return { tone: "good", text: `درست است! ${how}` };
    case "offByOne":
      return { tone: "turned", text: `نزدیک بود! یک حرف جابه‌جا شد. حرف‌ها را با شماره‌شان در الفبا بشمار (ا = ۱، ب = ۲، پ = ۳، …). ${right}` };
    case "wrongWay":
      return { tone: "turned", text: `نزدیک بود! جهت برعکس شد: این دنباله ${r.kind === "step" && r.by < 0 ? "کم" : "زیاد"} می‌شود. ${right}` };
    case "extraStep":
      return { tone: "turned", text: `نزدیک بود! یک گام زیادی رفتی؛ از جمله درست قبل از جای خالی شروع کن. ${right}` };
    case "addFactor":
      return {
        tone: "turned",
        text: `نزدیک بود! ${r.kind === "step" && r.op === "÷" ? `به‌جای تقسیم بر ${fa(r.by)}، ${fa(r.by)} تا کم کردی` : `به‌جای ضرب در ${fa(r.kind === "step" ? r.by : 0)}، آن را جمع کردی`}. ${right}`,
      };
    case "wrongStrand":
      return { tone: "turned", text: `نزدیک بود! این ادامه دنباله کناری است. جای خالی مال آن یکی دنباله است؛ یکی‌درمیان نگاه کن. ${right}` };
    case "double":
      return { tone: "turned", text: `نزدیک بود! جمله قبلی را دو برابر کردی؛ باید جمله قبلی را با جمله قبل از آن جمع کنی. ${right}` };
    case "secondOff":
      return { tone: "turned", text: `نزدیک بود! اختلاف‌ها را درست دیدی ولی اختلاف بعدی را یک گام اشتباه گرفتی. ${right}` };
    case "sameDiff":
      return { tone: "turned", text: `${sameDiffText(q)} ${right}` };
    default:
      return { tone: "bad", text: right };
  }
}

interface Props {
  question: SequenceQuestion;
  type: SequenceQuestionType;
  level: Level;
  blank: BlankChoice;
  big: boolean;
  checked: number | null;
  onCheck: (v: number) => void;
  onType: (t: SeqTryType) => void;
  onLevel: (l: Level) => void;
  onBlank: (b: BlankChoice) => void;
  onBig: (big: boolean) => void;
  onNew: () => void;
  /** Mock exam: record the answer, show nothing about it. */
  exam?: boolean;
}

export function SequenceTryPanel(p: Props) {
  const { question: q, checked } = p;
  const [num, setNum] = useState(!q.letters && checked !== null ? String(checked) : "");
  const [letter, setLetter] = useState<number | null>(q.letters ? checked : null);
  const fb = checked !== null && !p.exam ? feedback(q, checked) : null;
  const done = checked !== null;

  return (
    <div className={styles.panel}>
      <div className={styles.types} role="radiogroup" aria-label="نوع دنباله" data-practice-hide>
        {(Object.keys(SEQ_TYPE_LABEL) as SeqTryType[]).map((t) => (
          <button key={t} role="radio" aria-checked={p.type === t} onClick={() => p.onType(t)}>
            {SEQ_TYPE_LABEL[t]}
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
      <div className={styles.chips} role="radiogroup" aria-label="جای جمله خالی" data-practice-hide>
        {(Object.keys(BLANK_LABEL) as BlankChoice[]).map((b) => (
          <button key={b} role="radio" aria-checked={p.blank === b} onClick={() => p.onBlank(b)}>
            {BLANK_LABEL[b]}
          </button>
        ))}
      </div>
      {!q.letters && (
        <div className={styles.chips} role="radiogroup" aria-label="اندازه عددها" data-practice-hide>
          <button role="radio" aria-checked={!p.big} onClick={() => p.onBig(false)}>
            عددهای کوچک
          </button>
          <button role="radio" aria-checked={p.big} onClick={() => p.onBig(true)}>
            عددهای بزرگ
          </button>
        </div>
      )}

      <p className={styles.prompt}>{sequencePrompt(q)}</p>

      {/* After checking, the pad folds away so the feedback is in view; the board shows the answer. */}
      {!q.letters && !done && <NumberPad value={num} onChange={setNum} maxDigits={4} />}

      {q.letters && !done && (
        <div className={styles.types} role="radiogroup" aria-label="حرف‌های الفبا" style={{ gridTemplateColumns: "repeat(8, minmax(0, 1fr))" }}>
          {ALPHABET.map((ch, k) => {
            const pos = k + 1;
            return (
              <button key={ch} role="radio" aria-checked={letter === pos} onClick={() => setLetter(pos)} style={{ fontSize: "1.05rem", minHeight: 40 }}>
                {ch}
              </button>
            );
          })}
        </div>
      )}

      {done && (
        <output className={styles.bigNumber} aria-live="polite">
          {p.exam ? "" : checked === q.answer ? "✓" : "✗"} {answerFa(q, checked)}
        </output>
      )}

      {!done && (
        <button className={styles.secondary} disabled={q.letters ? letter === null : !num} onClick={() => p.onCheck(q.letters ? letter! : Number(num))}>
          بررسی
        </button>
      )}

      {fb && (
        <p className={`${styles.feedback} ${styles[fb.tone]}`} role="status" aria-live="polite">
          <span className={styles.icon}>{ICON[fb.tone]}</span> {fb.text}
        </p>
      )}
      {done && !p.exam && <p className={styles.hint}>{rowsHint(q.rule)} با نوار پایین جلو و عقب ببر.</p>}
      {!done && <p className={styles.hint}>یک قانون باید با همه جمله‌ها جور باشد؛ پس فقط یک جواب درست است.</p>}

      <button className={styles.next} onClick={p.onNew}>
        نمونه تازه
      </button>
    </div>
  );
}

"use client";

// "Try it" for the nth term: a far term, the place of a value, the sticks of
// a far shape, the rule "term n = □ × n + □" (two boxes, one pad), or where
// two sequences meet. Wrong answers name the slip.

import { useState } from "react";
import { nthIsRule, nthMistake, ruleParts, ruleValue, termAt, termsOf, type Level, type NthQuestion } from "@/generators/nth-term";
import { NumberPad } from "@/toolkit/NumberPad";
import { fa } from "@/tools/registry";
import { PATTERN_NAME, unitOf } from "./Nth";
import { SEQ_TYPE_LABEL, type SeqTryType } from "./SequenceTryPanel";
import { ltr } from "./Train";
import styles from "@/toolkit/TryPanel.module.css";

const list = (xs: number[]) => xs.map((v) => fa(v)).join("، ");

/** The rule template with its two boxes, kept left to right and on one line. */
export const RULE_TEMPLATE = ltr("□ × n + □");

export function nthPrompt(q: NthQuestion): string {
  const terms = list(termsOf(q, q.shown));
  const steady = `این دنباله با گام ثابت جلو می‌رود: ${terms}، …`;
  switch (q.variant) {
    case "far":
      return `${steady} — جمله ${fa(q.n)}ام چند است؟`;
    case "which":
      return `${steady} — عدد ${fa(q.value)} جمله چندم است؟`;
    case "pattern": {
      const kind = q.pattern!;
      const unit = unitOf(kind);
      const [a, b, c] = termsOf(q, 3);
      return `${PATTERN_NAME[kind]} همین‌طور بزرگ می‌شوند: شکل ۱ با ${fa(a)} ${unit}، شکل ۲ با ${fa(b)} و شکل ۳ با ${fa(c)} ${unit} ساخته شده. شکل ${fa(q.n)} چند ${unit} دارد؟`;
    }
    case "rule":
      return `${steady} — قانونش را کامل کن: جمله nام = ${RULE_TEMPLATE}`;
    case "meet":
      return `دو دنباله با گام ثابت: دنباله ●: ${list(termsOf(q, q.shown))}، … و دنباله ▲: ${list(termsOf(q, q.shown, true))}، … — جمله چندمِ این دو دنباله با هم برابر است؟`;
  }
}

/** The answer in words. */
export function nthAnswerFa(q: NthQuestion, v = q.answer) {
  if (!nthIsRule(q)) return fa(v);
  const { coef, constant } = ruleParts(v);
  return `جمله nام = ${ltr(`${fa(coef)} × n + ${fa(constant)}`)}`;
}

/** The working, in one paragraph. */
export function nthHow(q: NthQuestion): string {
  const { first: a, step: d, n } = q;
  const jumps = (n - 1) * d;
  switch (q.variant) {
    case "far":
    case "pattern": {
      const what = q.variant === "pattern" ? `شکل ۱ ${fa(a)} ${unitOf(q.pattern!)} دارد و هر شکل ${fa(d)} تا بیشتر از قبلی دارد` : `جمله اول ${fa(a)} است و هر جهش ${fa(d)} تا اضافه می‌کند`;
      return `${what}. از ${q.variant === "pattern" ? "شکل" : "جمله"} ۱ تا ${fa(n)}، ${fa(n - 1)} جهش است (نه ${fa(n)}): ${ltr(`${fa(n - 1)} × ${fa(d)} = ${fa(jumps)}`)}؛ با اولی: ${ltr(`${fa(a)} + ${fa(jumps)} = ${fa(q.answer)}`)}.`;
    }
    case "which":
      return `از جمله اول (${fa(a)}) تا ${fa(q.value)}، ${ltr(`${fa(q.value)} − ${fa(a)} = ${fa(q.value - a)}`)} راه است و هر جهش ${fa(d)}: ${ltr(`${fa(q.value - a)} ÷ ${fa(d)} = ${fa(n - 1)}`)} جهش. ${fa(n - 1)} جهش بعد از جمله اول یعنی جمله ${ltr(`${fa(n - 1)} + ۱ = ${fa(n)}`)}.`;
    case "rule": {
      const { coef, constant } = ruleParts(q.answer);
      return `گام ${fa(d)} است، پس هر جمله ${ltr(`${fa(d)} × n`)} به‌علاوه یک عدد ثابت است. برای جمله اول ${ltr(`${fa(d)} × ۱ = ${fa(d)}`)} ولی جمله اول ${fa(a)} است، پس ${ltr(`${fa(a)} − ${fa(d)} = ${fa(constant)}`)} اضافه می‌شود: ${nthAnswerFa(q)}. امتحان با جمله دوم: ${ltr(`${fa(coef)} × ۲ + ${fa(constant)} = ${fa(termAt(a, d, 2))}`)}.`;
    }
    case "meet": {
      const g = q.first2 - q.first;
      const s = q.step - q.step2;
      return `اول فاصله دو دنباله ${ltr(`${fa(q.first2)} − ${fa(q.first)} = ${fa(g)}`)} است و در هر جهش ${ltr(`${fa(q.step)} − ${fa(q.step2)} = ${fa(s)}`)} کم می‌شود. ${ltr(`${fa(g)} ÷ ${fa(s)} = ${fa(n - 1)}`)} جهش تا فاصله صفر شود؛ ${fa(n - 1)} جهش بعد از جمله اول یعنی جمله ${fa(n)}: هر دو ${fa(q.value)} می‌شوند.`;
    }
  }
}

type Tone = "good" | "turned" | "bad";
const ICON: Record<Tone, string> = { good: "✓", turned: "↻", bad: "✗" };

function feedback(q: NthQuestion, v: number): { tone: Tone; text: string } {
  const how = nthHow(q);
  const right = `جواب ${nthAnswerFa(q)} است. ${how}`;
  const near = (s: string) => ({ tone: "turned" as Tone, text: `نزدیک بود! ${s} ${right}` });
  const { first: a, step: d, n } = q;
  const place = q.variant === "pattern" ? "شکل" : "جمله";
  const rule = nthIsRule(q);
  switch (nthMistake(q, v)) {
    case "right":
      return { tone: "good", text: `درست است! ${how}` };
    case "nJumps":
      if (rule) return near(`عدد دوم را خود جمله اول (${fa(a)}) گرفتی؛ ولی با آن، جمله اول می‌شود ${ltr(`${fa(d)} × ۱ + ${fa(a)} = ${fa(d + a)}`)}: یک گام زیادی.`);
      return near(`${fa(n)} جهش رفتی؛ ولی از ${place} ۱ تا ${place} ${fa(n)} فقط ${fa(n - 1)} جهش است. جهش‌ها بین واگن‌ها هستند: ${fa(n)} واگن، ${fa(n - 1)} فاصله.`);
    case "offByOne":
      if (q.variant === "which" || q.variant === "meet") return near("یکی زیادی شمردی: جهش‌ها را بشمار و فقط یکی (برای جمله اول) اضافه کن.");
      return near(`یک جهش کم آمد: از ${place} ۱ تا ${place} ${fa(n)}، ${fa(n - 1)} جهش است، نه ${fa(n - 2)}.`);
    case "timesFirst":
      if (rule) return near(`عدد کنار n گام دنباله است (هر بار چند تا اضافه می‌شود)، نه جمله اول (${fa(a)}).`);
      if (q.variant === "pattern") return near(`${fa(n)} را در ${fa(a)} ضرب کردی، انگار هر شکل جدا ساخته می‌شود؛ ولی شکل‌ها ${unitOf(q.pattern!)} مشترک دارند و هر شکل فقط ${fa(d)} تا اضافه می‌کند.`);
      return near(`${fa(n)} را در جمله اول (${fa(a)}) ضرب کردی؛ ولی هر جمله فقط ${fa(d)} تا بیشتر از قبلی است.`);
    case "timesStep":
      return near(`${ltr(`${fa(n)} × ${fa(d)}`)} یعنی ${fa(n)} جهش از صفر؛ ولی از ${fa(a)} شروع می‌کنیم و ${fa(n - 1)} جهش می‌رویم.`);
    case "noStart":
      if (rule) return near(`با ${ltr(`${fa(d)} × n`)} تنها، جمله اول می‌شود ${fa(d)}، نه ${fa(a)}؛ عدد دوم را جا انداختی.`);
      if (q.variant === "which") return near(`${fa(q.value)} را مستقیم بر ${fa(d)} تقسیم کردی؛ اول جمله اول (${fa(a)}) را کم کن، چون دنباله از ${fa(a)} شروع می‌شود نه از صفر.`);
      return near(`${fa(n - 1)} جهش را درست حساب کردی (${fa(jumpsOf(q))}) ولی ${place} اول (${fa(a)}) را اضافه نکردی.`);
    case "reverseOff":
      if (q.variant === "meet") return near(`${fa(n - 1)} تعداد جهش‌هاست تا فاصله صفر شود؛ بعد از ${fa(n - 1)} جهش از جمله اول، به جمله ${fa(n)} می‌رسیم.`);
      return near(`${fa(n - 1)} تعداد جهش‌هاست، نه شماره جمله؛ جمله اول را هم بشمار: ${ltr(`${fa(n - 1)} + ۱`)}.`);
    case "value":
      return near(`${fa(q.value)} عددی است که هر دو به آن می‌رسند؛ پرسش شماره جمله است.`);
    case "swapped":
      return near(`جای دو عدد عوض شد: عدد کنار n گام است (${fa(d)}) و عدد دوم آنچه اضافه می‌شود.`);
    case "constant":
      return near(`${ltr(`${fa(d)} × n`)} درست است؛ عدد دوم را دوباره حساب کن: جمله اول ${fa(a)} است و ${ltr(`${fa(d)} × ۱ = ${fa(d)}`)}.`);
    default:
      return { tone: "bad", text: right };
  }
}

const jumpsOf = (q: NthQuestion) => (q.n - 1) * q.step;

interface Props {
  question: NthQuestion;
  level: Level;
  checked: number | null;
  onCheck: (v: number) => void;
  onType: (t: SeqTryType) => void;
  onLevel: (l: Level) => void;
  onNew: () => void;
}

const BOX: React.CSSProperties = {
  minWidth: 52,
  minHeight: 48,
  padding: "0 8px",
  borderRadius: 10,
  border: "2px dashed var(--line)",
  background: "var(--surface)",
  fontSize: "1.3rem",
  fontWeight: 700,
};
const BOX_ON: React.CSSProperties = { ...BOX, border: "3px solid var(--accent)", boxShadow: "inset 0 0 0 2px var(--accent-soft)" };

export function NthTryPanel(p: Props) {
  const { question: q, checked } = p;
  const rule = nthIsRule(q);
  const done = checked !== null;
  const start = done && rule ? ruleParts(checked) : null;
  const [num, setNum] = useState(done && !rule ? String(checked) : "");
  const [boxes, setBoxes] = useState<[string, string]>(start ? [String(start.coef), String(start.constant)] : ["", ""]);
  const [active, setActive] = useState<0 | 1>(0);
  const fb = done ? feedback(q, checked) : null;

  const setBox = (v: string) => setBoxes((b) => (active === 0 ? [v, b[1]] : [b[0], v]));
  const ready = rule ? boxes[0] !== "" && boxes[1] !== "" : num !== "";
  const value = () => (rule ? ruleValue(Number(boxes[0]), Number(boxes[1])) : Number(num));

  return (
    <div className={styles.panel}>
      <div className={styles.types} role="radiogroup" aria-label="نوع دنباله">
        {(Object.keys(SEQ_TYPE_LABEL) as SeqTryType[]).map((t) => (
          <button key={t} role="radio" aria-checked={t === "nth"} onClick={() => p.onType(t)}>
            {SEQ_TYPE_LABEL[t]}
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

      <p className={styles.prompt}>{nthPrompt(q)}</p>

      {rule && (
        <div role="group" aria-label="قانون جمله nام" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flexWrap: "wrap", fontWeight: 700, fontSize: "1.1rem" }}>
          <span>جمله nام =</span>
          <span dir="ltr" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {([0, 1] as const).map((i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <button
                  aria-pressed={active === i}
                  aria-label={i === 0 ? `عدد ضرب در n: ${boxes[0] ? fa(boxes[0]) : "خالی"}` : `عدد اضافه: ${boxes[1] ? fa(boxes[1]) : "خالی"}`}
                  onClick={() => setActive(i)}
                  disabled={done}
                  style={active === i && !done ? BOX_ON : BOX}
                >
                  {boxes[i] ? fa(boxes[i]) : "□"}
                </button>
                <span>{i === 0 ? "× n +" : ""}</span>
              </span>
            ))}
          </span>
        </div>
      )}
      {rule && !done && <p className={styles.hint}>روی یک خانه بزن، بعد عددش را با صفحه‌کلید بنویس.</p>}

      {!done && <NumberPad value={rule ? boxes[active] : num} onChange={rule ? setBox : setNum} maxDigits={rule ? 2 : 3} />}

      {done && (
        <output className={styles.bigNumber} aria-live="polite">
          {checked === q.answer ? "✓" : "✗"} {rule ? ltr(`${fa(ruleParts(checked).coef)} × n + ${fa(ruleParts(checked).constant)}`) : fa(checked)}
        </output>
      )}

      {!done && (
        <button className={styles.secondary} disabled={!ready} onClick={() => p.onCheck(value())}>
          بررسی
        </button>
      )}

      {fb && (
        <p className={`${styles.feedback} ${styles[fb.tone]}`} role="status" aria-live="polite">
          <span className={styles.icon}>{ICON[fb.tone]}</span> {fb.text}
        </p>
      )}
      {done && (
        <p className={styles.hint}>
          {q.variant === "meet"
            ? "روی صفحه، فاصله دو دنباله زیر هر جمله نوشته می‌شود تا صفر شود؛ با نوار پایین جلو و عقب ببر."
            : q.variant === "rule"
              ? "روی صفحه، زیر هر جمله نوشته می‌شود که از قانون چطور درمی‌آید."
              : "روی صفحه، جهش‌ها یکی‌یکی شماره می‌خورند؛ با نوار پایین جلو و عقب ببر."}
        </p>
      )}
      {!done && <p className={styles.hint}>همه جمله‌ها را ننویس: جهش‌ها را بشمار (از جمله ۱ تا جمله n، n − ۱ جهش)، بعد ضرب کن.</p>}

      <button className={styles.next} onClick={p.onNew}>
        نمونه تازه
      </button>
    </div>
  );
}

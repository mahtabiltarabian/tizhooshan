"use client";

import { useState } from "react";
import {
  answerKind,
  balanceMistake,
  BLOCKS,
  stagesOf,
  SYMBOLS,
  type BalanceQ,
  type BalanceQuestionType,
  type FillQuestion,
  type Level,
} from "@/generators/balance";
import { NumberPad } from "@/toolkit/NumberPad";
import { fa } from "@/tools/registry";
import { answerUnit, glyph, ltr, panFa, powerFa, stepNote } from "./frames";
import styles from "@/toolkit/TryPanel.module.css";

export const BALANCE_TYPE_LABEL: Record<BalanceQuestionType, string> = {
  balance: "ترازوی نمادین",
  fill: "کفه خالی",
  coin: "سکه تقلبی",
  age: "سن با نوار",
};

/** What each level means, per type (the "new example" knobs). */
export const LEVEL_LABEL: Record<BalanceQuestionType, [string, string, string]> = {
  balance: ["۱ ترازو، ۱ شکل", "۲ ترازو، ۲ شکل", "۳ ترازو، ۳ شکل"],
  fill: ["۱ شکل", "۲ شکل", "۳ شکل"],
  coin: ["تا ۹ سکه", "تا ۳۰ سکه", "تا ۱۲۰ سکه"],
  age: ["جمع و تفاضل", "چند برابر", "چند سال بعد"],
};

const symName = (j: number) => `${SYMBOLS[j].name} (${glyph(j)})`;
const fakeWord = (heavy: boolean) => (heavy ? "سنگین‌تر" : "سبک‌تر");

export function balancePrompt(q: BalanceQ, paper = false): string {
  switch (q.type) {
    case "balance":
      return `${q.n === 1 ? "ترازو متعادل است" : `هر ${fa(q.n)} ترازو متعادل‌اند`}. هر ${symName(q.ask)} چند کیلو است؟`;
    case "fill":
      return q.fillWith === null
        ? `ترازوهای متعادل وزن شکل‌ها را می‌گویند. در کفه‌ی خالیِ ترازوی پرسش چند کیلو وزنه بگذاریم تا متعادل شود؟${paper ? "" : " وزنه‌ها را به کفه‌ی خالی بکش."}`
        : `ترازوهای متعادل را ببین. چند ${symName(q.fillWith)} در کفه‌ی خالی بگذاریم تا ترازوی پرسش متعادل شود؟${paper ? "" : ` ${glyph(q.fillWith)}ها را به کفه‌ی خالی بکش.`}`;
    case "coin":
      return q.variant === "min"
        ? `${fa(q.n)} سکه داریم؛ دقیقاً یکی تقلبی و از بقیه ${fakeWord(q.heavy)} است و بقیه هم‌وزن‌اند. با ترازوی دوکفه‌ای بدون وزنه، دست‌کم چند بار وزن‌کشی لازم است تا حتماً (حتی در بدترین حالت) سکه‌ی تقلبی پیدا شود؟`
        : `در میان چند سکه، دقیقاً یکی تقلبی و از بقیه ${fakeWord(q.heavy)} است. با ترازوی دوکفه‌ای بدون وزنه و فقط ${fa(q.k)} بار وزن‌کشی، حداکثر از میان چند سکه می‌توان حتماً سکه‌ی تقلبی را پیدا کرد؟`;
    case "age": {
      const who = q.askOlder ? q.older : q.younger;
      switch (q.variant) {
        case "sumDiff":
          return `مجموع سن ${q.older} و ${q.younger} ${fa(q.old + q.young)} سال است و ${q.older} ${fa(q.old - q.young)} سال از ${q.younger} بزرگ‌تر است. ${who} چند سال دارد؟`;
        case "timesSum":
          return `سن ${q.older} ${fa(q.times)} برابر سن ${q.younger} است و مجموع سن آن‌ها ${fa(q.old + q.young)} سال است. ${who} چند سال دارد؟`;
        case "timesDiff":
          return `سن ${q.older} ${fa(q.times)} برابر سن ${q.younger} است و ${q.older} ${fa(q.old - q.young)} سال از ${q.younger} بزرگ‌تر است. ${who} چند سال دارد؟`;
        case "later":
          return `اکنون سن ${q.older} ${fa(q.times)} برابر سن ${q.younger} است. ${fa(q.years)} سال بعد، سن ${q.older} ${fa(q.laterTimes)} برابر سن ${q.younger} می‌شود. ${who} اکنون چند سال دارد؟`;
      }
    }
  }
}

/** The working, briefly. */
export function balanceHow(q: BalanceQ): string {
  switch (q.type) {
    case "balance":
      return stagesOf(q)
        .stages.map((s) => stepNote(s.step, s.before))
        .join(" ");
    case "fill": {
      if (q.fillWith === null) {
        const vals = q.weights.map((v, j) => ltr(`${glyph(j)} = ${fa(v)}`)).join("، ");
        const terms = q.target.s.flatMap((c, j) => Array<string>(c).fill(fa(q.weights[j])));
        if (q.target.k) terms.push(fa(q.target.k));
        return `${vals}؛ پس ${ltr(`${panFa(q.target)} = ${terms.join(" + ")} = ${fa(q.answer)}`)}.`;
      }
      const g = glyph(q.fillWith);
      const each = q.weights.map((v, j) => (j === q.fillWith ? "" : `هر ${glyph(j)} برابر ${fa(v)} تا ${g}`)).filter(Boolean);
      const terms = q.target.s.flatMap((c, j) => Array<string>(c).fill(fa(q.weights[j])));
      return `${each.join("، ")}؛ پس ${ltr(`${panFa(q.target)}`)} برابر ${ltr(`${terms.join(" + ")} = ${fa(q.answer)}`)} تا ${g}.`;
    }
    case "coin": {
      if (q.variant === "max") return `هر وزن‌کشی سه جواب دارد (کفه چپ پایین، کفه راست پایین، تعادل)، پس هر بار گروه مشکوک یک‌سوم می‌شود: ${ltr(powerFa(q.k))} سکه.`;
      const k = q.answer;
      return `سکه‌ها را سه گروه تقریباً برابر کن و دو گروه را وزن کن؛ هر بار گروه مشکوک یک‌سوم می‌شود. با ${fa(k)} وزن‌کشی تا ${ltr(powerFa(k))} سکه${k > 1 ? `، ولی با ${fa(k - 1)} وزن‌کشی فقط تا ${fa(3 ** (k - 1))} سکه` : ""}؛ ${fa(q.n)} سکه پس ${fa(k)} وزن‌کشی می‌خواهد.`;
    }
    case "age": {
      const { young: y, old: o, times: m } = q;
      switch (q.variant) {
        case "sumDiff":
          return `دو تکه‌ی برابر: ${ltr(`(${fa(o + y)} − ${fa(o - y)}) ÷ ۲ = ${fa(y)}`)}؛ ${q.older}: ${ltr(`${fa(y)} + ${fa(o - y)} = ${fa(o)}`)}.`;
        case "timesSum":
          return `${fa(m + 1)} تکه‌ی برابر: ${ltr(`${fa(o + y)} ÷ ${fa(m + 1)} = ${fa(y)}`)}؛ ${q.older}: ${ltr(`${fa(m)} × ${fa(y)} = ${fa(o)}`)}.`;
        case "timesDiff":
          return `اختلاف ${fa(m - 1)} تکه است: ${ltr(`${fa(o - y)} ÷ ${fa(m - 1)} = ${fa(y)}`)}؛ ${q.older}: ${ltr(`${fa(m)} × ${fa(y)} = ${fa(o)}`)}.`;
        case "later": {
          const b = q.laterTimes;
          return `${fa(m)} تکه و ${fa(q.years)} سال برابر است با ${fa(b)} بار (یک تکه و ${fa(q.years)} سال)؛ از دو طرف ${fa(b)} تکه و ${fa(q.years)} سال برمی‌داریم: ${fa(m - b)} تکه برابر ${ltr(`${fa(b - 1)} × ${fa(q.years)} = ${fa((b - 1) * q.years)}`)} سال، پس هر تکه ${fa(y)}؛ ${q.older} ${fa(o)} سال.`;
        }
      }
    }
  }
}

export function answerFa(q: BalanceQ, v = q.answer): string {
  switch (q.type) {
    case "balance":
      return `${ltr(`${glyph(q.ask)} = ${fa(v)}`)} کیلو`;
    case "fill":
      return answerUnit(q, v);
    case "coin":
      return q.variant === "min" ? `${fa(v)} وزن‌کشی` : `${fa(v)} سکه`;
    case "age":
      return `${fa(v)} سال`;
  }
}

type Tone = "good" | "turned" | "bad";
const ICON: Record<Tone, string> = { good: "✓", turned: "↻", bad: "✗" };

function feedback(q: BalanceQ, v: number): { tone: Tone; text: string } {
  const how = balanceHow(q);
  const right = `جواب ${answerFa(q)} است. ${how}`;
  const near = (s: string) => ({ tone: "turned" as const, text: `نزدیک بود! ${s} ${right}` });
  switch (balanceMistake(q, v)) {
    case "right":
      return { tone: "good", text: q.type === "fill" && q.fillWith === null ? `درست است! هر ترکیبی از وزنه‌ها که جمعش ${fa(q.answer)} باشد درست است. ${how}` : `درست است! ${how}` };
    case "oneSide":
      return near(`روی کفه‌ی دیگر هم ${glyph(0)} هست؛ اول از هر دو کفه ${glyph(0)}های یکسان را بردار.`);
    case "noSubtract":
      return near(`وزنه‌ی کنار ${glyph(0)}ها را هم باید از هر دو کفه برداری.`);
    case "noDivide":
      return near(`این وزن همه‌ی ${q.type === "balance" ? glyph(q.ask) : ""}های باقی‌مانده با هم است؛ آن را بر تعدادشان تقسیم کن.`);
    case "otherSymbol":
      return { tone: "turned", text: `این وزن یک شکل دیگر است${q.type === "balance" ? `؛ پرسش درباره‌ی ${symName(q.ask)} است` : ""}. ${right}` };
    case "noWeight":
      return near("وزنه‌ای را که از اول روی کفه‌ی پرسش بود هم حساب کن.");
    case "count":
      return { tone: "turned", text: `شکل‌ها هم‌وزن نیستند؛ تعداد شکل‌ها کافی نیست، وزن هر شکل را حساب کن. ${right}` };
    case "forgotOnes":
      return near(`${q.type === "fill" && q.fillWith !== null ? glyph(q.fillWith) : ""}هایی که از اول روی کفه‌ی پرسش بودند را فراموش کردی.`);
    case "lucky":
      return { tone: "turned", text: `با شانس شاید یک بار کافی باشد، ولی پرسش «حتماً» می‌خواهد: بدترین حالت را حساب کن. ${right}` };
    case "halves":
      return near("دو گروه کردن کافی نیست: هر وزن‌کشی سه جواب دارد (چپ، راست، تعادل)، پس سکه‌ها را سه گروه کن.");
    case "boundary":
      return near(`${fa(q.type === "coin" ? q.n : 0)} سکه دقیقاً ${ltr(powerFa(q.answer))} است؛ همین تعداد وزن‌کشی کافی است.`);
    case "pairs":
    case "allButOne":
      return { tone: "bad", text: `یکی‌یکی یا دوتا‌دوتا وزن کردن خیلی طول می‌کشد؛ گروه‌های بزرگ را با هم وزن کن. ${right}` };
    case "times":
      return near("هر وزن‌کشی تعداد سکه‌ها را سه برابر می‌کند، نه این‌که سه تا اضافه کند.");
    case "otherPerson":
      return { tone: "turned", text: `این سن ${q.type === "age" ? (q.askOlder ? q.younger : q.older) : ""} است؛ پرسش سن ${q.type === "age" ? (q.askOlder ? q.older : q.younger) : ""} را می‌خواهد. ${right}` };
    case "half":
      return near("نصف جمع فقط وقتی درست است که هم‌سن باشند؛ اول اختلاف را کنار بگذار.");
    case "noHalf":
      return near("جمع منهای اختلاف، دو تکه‌ی برابر است؛ آن را نصف کن.");
    case "wrongParts":
      return near("تکه‌ها را درست بشمار: سن بزرگ‌تر چند تکه است و سن کوچک‌تر یک تکه.");
    case "later":
      return near(`این سن ${q.type === "age" ? fa(q.years) : ""} سال بعد است؛ سن اکنون را می‌خواهیم.`);
    default:
      return { tone: "bad", text: right };
  }
}

interface Props {
  question: BalanceQ;
  type: BalanceQuestionType;
  level: Level;
  /** Fill: what is on the empty pan (in the answer's unit) and the controls for it. */
  onPan: number;
  onAdd: (block: number) => void;
  onUndo: () => void;
  onEmpty: () => void;
  checked: number | null;
  onCheck: (v: number) => void;
  onType: (t: BalanceQuestionType) => void;
  onLevel: (l: Level) => void;
  onNew: () => void;
}

export function BalanceTryPanel(p: Props) {
  const { question: q, checked } = p;
  const kind = answerKind(q.type);
  const [num, setNum] = useState(kind === "number" && checked !== null ? String(checked) : "");
  const fb = checked !== null ? feedback(q, checked) : null;
  const done = checked !== null;
  const fillQ = q.type === "fill" ? (q as FillQuestion) : null;

  return (
    <div className={styles.panel}>
      <div className={styles.types} role="radiogroup" aria-label="نوع پرسش" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        {(Object.keys(BALANCE_TYPE_LABEL) as BalanceQuestionType[]).map((t) => (
          <button key={t} role="radio" aria-checked={p.type === t} onClick={() => p.onType(t)}>
            {BALANCE_TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      <div className={styles.chips} role="radiogroup" aria-label="سطح">
        {([1, 2, 3] as Level[]).map((l) => (
          <button key={l} role="radio" aria-checked={p.level === l} onClick={() => p.onLevel(l)} title={LEVEL_LABEL[p.type][l - 1]}>
            سطح {fa(l)}
          </button>
        ))}
      </div>
      <p className={styles.hint}>{LEVEL_LABEL[p.type][p.level - 1]}</p>

      <p className={styles.prompt}>{balancePrompt(q)}</p>

      {kind === "number" && <NumberPad value={num} onChange={setNum} disabled={done} />}

      {fillQ && (
        <>
          <output className={styles.bigNumber} aria-live="polite">
            روی کفه: {fillQ.fillWith === null ? `${fa(p.onPan)} کیلو` : `${fa(p.onPan)} تا ${glyph(fillQ.fillWith)}`}
          </output>
          <div className={styles.chips} aria-label="افزودن به کفه خالی">
            {fillQ.fillWith === null ? (
              BLOCKS.map((b) => (
                <button key={b} onClick={() => p.onAdd(b)} disabled={done}>
                  +{fa(b)}
                </button>
              ))
            ) : (
              <button onClick={() => p.onAdd(0)} disabled={done}>
                + {glyph(fillQ.fillWith)}
              </button>
            )}
            <button onClick={p.onUndo} disabled={done || p.onPan === 0} aria-label="برداشتن آخری">
              ↶
            </button>
            <button onClick={p.onEmpty} disabled={done || p.onPan === 0}>
              خالی
            </button>
          </div>
          {!done && <p className={styles.hint}>از ردیف پایین صفحه به کفه‌ی خالی بکش یا لمس کن؛ هر چیز روی کفه را لمس کنی برداشته می‌شود. ترازو قفل است تا «بررسی» را بزنی.</p>}
        </>
      )}

      {!done && (
        <button className={styles.secondary} disabled={kind === "number" ? !num : p.onPan === 0} onClick={() => p.onCheck(kind === "number" ? Number(num) : p.onPan)}>
          {kind === "pan" ? "بررسی: ترازو را رها کن" : "بررسی"}
        </button>
      )}

      {fb && (
        <p className={`${styles.feedback} ${styles[fb.tone]}`} role="status" aria-live="polite">
          <span className={styles.icon}>{ICON[fb.tone]}</span> {fb.text}
        </p>
      )}
      {done && <p className={styles.hint}>روی صفحه، راه‌حل قدم‌به‌قدم پخش می‌شود؛ با نوار پایین جلو و عقب ببر.</p>}

      <button className={styles.next} onClick={p.onNew}>
        نمونه تازه
      </button>
    </div>
  );
}

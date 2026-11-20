"use client";

// "Try it" for repeating patterns: item N, how many of one symbol among the
// first N, a cycle after a start that does not repeat, or the day of the week.
// A symbol answer is picked from the items of the row; a count goes on the
// number pad. Wrong answers name the slip.

import { useState } from "react";
import { cycleAnswerIsCount, cycleChoices, cycleMistake, divide, SYMBOL_NAMES, type CycleQuestion, type Level } from "@/generators/cycle";
import { NumberPad } from "@/toolkit/NumberPad";
import { fa } from "@/tools/registry";
import { ltr, noun, rowWords, SymbolIcon, symbolWord } from "./Cycle";
import { SEQ_TYPE_LABEL, type SeqTryType } from "./SequenceTryPanel";
import styles from "@/toolkit/TryPanel.module.css";

/** The row as the question gives it. */
export const cycleRowFa = (q: CycleQuestion) => rowWords(q.set, Array.from({ length: q.shown }, (_, k) => (k < q.prefix.length ? q.prefix[k] : q.cycle[(k - q.prefix.length) % q.cycle.length])));

export function cyclePrompt(q: CycleQuestion): string {
  const row = cycleRowFa(q);
  switch (q.variant) {
    case "nth":
      return `این ردیف همین‌طور تکرار می‌شود: ${row}، … — در خانه شماره ${fa(q.n)} چه ${noun(q.set)} است؟`;
    case "prefix":
      return `این ردیف از جایی به بعد همین‌طور تکرار می‌شود: ${row}، … — در خانه شماره ${fa(q.n)} چه ${noun(q.set)} است؟`;
    case "count":
      return `این ردیف همین‌طور تکرار می‌شود: ${row}، … — در ${fa(q.n)} خانه اول، چند ${q.set === "beads" ? `مهره ${SYMBOL_NAMES.beads[q.target]}` : symbolWord(q.set, q.target)} هست؟`;
    case "week":
      return `روز اول سال ${SYMBOL_NAMES.days[q.cycle[0]]} است. روز ${fa(q.n)}ام سال چه روزی از هفته است؟`;
  }
}

/** The answer in words. */
export const cycleAnswerFa = (q: CycleQuestion, v = q.answer) => (cycleAnswerIsCount(q) ? fa(v) : symbolWord(q.set, v));

/** The working, in one line. */
export function cycleHow(q: CycleQuestion): string {
  const { cycles, rem, L, m } = divide(q);
  const p = q.prefix.length;
  const cyc = rowWords(q.set, q.cycle);
  const div = ltr(`${fa(m)} = ${fa(cycles)} × ${fa(L)} + ${fa(rem)}`);
  const land = rem
    ? `${fa(cycles)} دور کامل و ${fa(rem)} خانه دیگر؛ خانه ${fa(rem)}ام دور: ${cycleAnswerFa(q)}`
    : `باقیمانده ۰ یعنی خانه ${fa(q.n)} درست آخرین خانه دور ${fa(cycles)}ام است: ${cycleAnswerFa(q)}`;
  switch (q.variant) {
    case "nth":
      return `دور تکرار ${fa(L)} تایی است (${cyc}). ${div}: ${land}.`;
    case "week":
      return `هفته ${fa(7)} روز است و دور از ${SYMBOL_NAMES.days[q.cycle[0]]} شروع می‌شود. ${div}: ${land}.`;
    case "prefix":
      return `${fa(p)} خانه اول (${rowWords(q.set, q.prefix)}) تکرار نمی‌شوند؛ بعد دور ${fa(L)} تایی (${cyc}) می‌آید. پس اول آن‌ها را کم کن: ${ltr(`${fa(q.n)} − ${fa(p)} = ${fa(m)}`)} و ${div}: ${land}.`;
    case "count": {
      const per = q.cycle.filter((s) => s === q.target).length;
      const part = q.cycle.slice(0, rem).filter((s) => s === q.target).length;
      return `در هر دور ${fa(L)} تایی (${cyc}) ${fa(per)} تا هست. ${div}: ${fa(cycles)} دور کامل ${ltr(`${fa(cycles)} × ${fa(per)} = ${fa(cycles * per)}`)}، و در ${fa(rem)} خانه باقیمانده ${fa(part)} تا؛ روی هم ${ltr(`${fa(cycles * per)} + ${fa(part)} = ${fa(q.answer)}`)}.`;
    }
  }
}

type Tone = "good" | "turned" | "bad";
const ICON: Record<Tone, string> = { good: "✓", turned: "↻", bad: "✗" };

function feedback(q: CycleQuestion, v: number): { tone: Tone; text: string } {
  const how = cycleHow(q);
  const right = `جواب ${cycleAnswerFa(q)} است. ${how}`;
  const near = (s: string) => ({ tone: "turned" as Tone, text: `نزدیک بود! ${s} ${right}` });
  const { rem, L } = divide(q);
  switch (cycleMistake(q, v)) {
    case "right":
      return { tone: "good", text: `درست است! ${how}` };
    case "zeroFirst":
      return near("باقیمانده ۰ یعنی خانه آخر یک دور کامل، نه خانه اول دور بعد.");
    case "prefix":
      return near(`خانه‌های اول که تکرار نمی‌شوند (${fa(q.prefix.length)} تا) را فراموش کردی؛ اول آن‌ها را از ${fa(q.n)} کم کن، بعد تقسیم کن.`);
    case "offByOne":
      if (cycleAnswerIsCount(q)) return near(`در دور آخر یک خانه جابه‌جا شمردی: فقط ${fa(rem)} خانه از آن هست.`);
      return near(`یک خانه جابه‌جا شد: باقیمانده ${fa(rem)} یعنی خانه ${fa(rem || L)}ام دور؛ از خانه اول دور بشمار.`);
    case "quotient":
      return near("به‌جای باقیمانده، خارج‌قسمت را به کار بردی. خارج‌قسمت می‌گوید چند دور کامل گذشته؛ باقیمانده می‌گوید در دور آخر کجا هستیم.");
    case "cycles":
      return near("تعداد دورها را گفتی، نه تعداد خانه‌ها؛ در هر دور بیش از یکی هست.");
    case "noRemainder":
      return near(`خانه‌های باقیمانده را جا انداختی؛ در ${fa(rem)} خانه آخر هم باید بشماری.`);
    case "wholeCycle":
      return near(`دور آخر کامل نیست؛ فقط ${fa(rem)} خانه از آن در ${fa(q.n)} خانه اول هست.`);
    default:
      return { tone: "bad", text: right };
  }
}

interface Props {
  question: CycleQuestion;
  level: Level;
  checked: number | null;
  onCheck: (v: number) => void;
  onType: (t: SeqTryType) => void;
  onLevel: (l: Level) => void;
  onNew: () => void;
  /** Mock exam: record the answer, show nothing about it. */
  exam?: boolean;
}

export function CycleTryPanel(p: Props) {
  const { question: q, checked } = p;
  const isCount = cycleAnswerIsCount(q);
  const [num, setNum] = useState(isCount && checked !== null ? String(checked) : "");
  const [choice, setChoice] = useState<number | null>(!isCount ? checked : null);
  const fb = checked !== null && !p.exam ? feedback(q, checked) : null;
  const done = checked !== null;
  const choices = cycleChoices(q);

  return (
    <div className={styles.panel}>
      <div className={styles.types} role="radiogroup" aria-label="نوع دنباله" data-practice-hide>
        {(Object.keys(SEQ_TYPE_LABEL) as SeqTryType[]).map((t) => (
          <button key={t} role="radio" aria-checked={t === "cycle"} onClick={() => p.onType(t)}>
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

      <p className={styles.prompt}>{cyclePrompt(q)}</p>

      {isCount && !done && <NumberPad value={num} onChange={setNum} maxDigits={3} />}

      {!isCount && (
        <div className={styles.types} role="radiogroup" aria-label="جواب" style={{ gridTemplateColumns: `repeat(${Math.min(4, choices.length)}, minmax(0, 1fr))` }}>
          {choices.map((id) => (
            <button
              key={id}
              role="radio"
              aria-checked={choice === id}
              aria-label={symbolWord(q.set, id)}
              onClick={() => setChoice(id)}
              disabled={done}
              style={{ minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: "0.85rem" }}
            >
              {done && !p.exam && id === q.answer ? "✓ " : done && !p.exam && id === checked ? "✗ " : ""}
              <SymbolIcon set={q.set} id={id} />
              {q.set === "days" ? SYMBOL_NAMES.days[id] : q.set === "letters" ? "" : SYMBOL_NAMES[q.set][id]}
            </button>
          ))}
        </div>
      )}

      {done && isCount && (
        <output className={styles.bigNumber} aria-live="polite">
          {p.exam ? "" : checked === q.answer ? "✓" : "✗"} {fa(checked)}
        </output>
      )}

      {!done && (
        <button className={styles.secondary} disabled={isCount ? !num : choice === null} onClick={() => p.onCheck(isCount ? Number(num) : choice!)}>
          بررسی
        </button>
      )}

      {fb && (
        <p className={`${styles.feedback} ${styles[fb.tone]}`} role="status" aria-live="polite">
          <span className={styles.icon}>{ICON[fb.tone]}</span> {fb.text}
        </p>
      )}
      {done && !p.exam && <p className={styles.hint}>روی صفحه، هر دور در یک قاب است؛ با نوار پایین ببین خانه {fa(q.n)} در کدام دور و کجای آن است.</p>}
      {!done && <p className={styles.hint}>همه خانه‌ها را نشمار: ببین هر دور چند خانه است و {fa(q.n)} را بر آن تقسیم کن.</p>}

      <button className={styles.next} onClick={p.onNew}>
        نمونه تازه
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { answerKind, clockMistake, daysIn, hm, isLeapYear, MONTHS, WEEKDAYS, type ClockQuestion, type ClockQuestionType, type Level } from "@/generators/clock";
import { NumberPad } from "@/toolkit/NumberPad";
import { fa } from "@/tools/registry";
import { durationFa, timeFa } from "./Pictures";
import styles from "@/toolkit/TryPanel.module.css";

export const CLOCK_TYPE_LABEL: Record<ClockQuestionType, string> = {
  angle: "زاویه عقربه‌ها",
  mirror: "ساعت در آینه",
  elapsed: "بعد و قبل",
  drift: "ساعت جلو و عقب",
  weekday: "روز هفته",
  month: "ماه‌های شمسی",
};

/** Keeps an equation left to right inside a Persian sentence. */
export const ltr = (s: string) => `⁦${s}⁩`;

const dateFa = (d: { m: number; d: number }) => `${fa(d.d)} ${MONTHS[d.m].name}`;
/** "سال ۱۴۰۳ کبیسه است" or "… کبیسه نیست". */
const leapFa = (year: number) => `سال ${fa(year)} کبیسه ${isLeapYear(year) ? "است" : "نیست"}`;
const sideWord = (fast: boolean) => (fast ? "جلو" : "عقب");

export function clockPrompt(q: ClockQuestion, paper = false): string {
  switch (q.type) {
    case "angle":
      return `ساعت ${timeFa(q.time)} است. زاویه بین دو عقربه چند درجه است؟ (زاویه کوچک‌تر)`;
    case "mirror":
      return `این ساعت در آینه دیده می‌شود. ساعت واقعی چند است؟${paper ? "" : " عقربه‌های ساعت چپ را تنظیم کن."}`;
    case "elapsed":
      return `ساعت ${timeFa(q.start)} است. ${durationFa(q.minutes)} ${q.back ? "پیش، ساعت چند بود" : "بعد، ساعت چند می‌شود"}؟`;
    case "drift":
      if (q.variant === "offset") return `این ساعت ${fa(q.rate)} دقیقه ${sideWord(q.fast)} است و ${timeFa(q.start)} را نشان می‌دهد. ساعت واقعی چند است؟`;
      if (q.variant === "perDay")
        return `ساعتی هر روز ${fa(q.rate)} دقیقه ${sideWord(q.fast)} می‌رود. آن را ساعت ${timeFa(q.start)} درست تنظیم کردیم. ${fa(q.span)} روز بعد، وقتی ساعت واقعی ${timeFa(q.start)} است، این ساعت چه نشان می‌دهد؟`;
      return `ساعتی هر ساعت ${fa(q.rate)} دقیقه ${sideWord(q.fast)} می‌رود. آن را ساعت ${timeFa(q.start)} درست تنظیم کردیم. ${fa(q.span)} ساعت بعد چه نشان می‌دهد؟`;
    case "weekday":
      return `امروز ${WEEKDAYS[q.start]} است. ${fa(q.days)} روز ${q.back ? "پیش چه روزی بود" : "بعد چه روزی است"}؟`;
    case "month":
      if (q.year !== undefined)
        return `${dateFa(q.from)} ${fa(q.year)} ${WEEKDAYS[q.weekday]} است. ${dateFa(q.to)} ${fa(q.year + 1)} چه روزی است؟ (${leapFa(q.year)}.)`;
      return `${dateFa(q.from)} ${WEEKDAYS[q.weekday]} است. ${dateFa(q.to)} همان سال چه روزی است؟`;
  }
}

/** Weeks and days: "۱۰۰ = ۷ × ۱۴ + ۲". */
const weeksFa = (n: number) => ltr(`${fa(n)} = ۷ × ${fa(Math.floor(n / 7))} + ${fa(n % 7)}`);

/** The working, in one line. */
export function clockHow(q: ClockQuestion): string {
  switch (q.type) {
    case "angle": {
      const { h, m } = hm(q.time);
      const hour = 30 * (h % 12) + m / 2;
      return `عقربه دقیقه: ${ltr(`۶ × ${fa(m)} = ${fa(6 * m)}°`)}. عقربه ساعت: ${ltr(`۳۰ × ${fa(h % 12)} + ۰٫۵ × ${fa(m)} = ${fa(hour)}°`)}. فاصله: ${fa(q.answer)}°.`;
    }
    case "mirror":
      return `ساعت واقعی = ۱۲:۰۰ منهای ساعت در آینه: ${ltr(`۱۲:۰۰ − ${timeFa(q.shown)} = ${timeFa(q.answer)}`)}.`;
    case "elapsed": {
      const lap = q.minutes >= 720 ? ` (هر ۱۲ ساعت عقربه‌ها یک دور کامل می‌زنند؛ پس فقط ${durationFa(q.minutes % 720)} می‌ماند)` : "";
      return `${timeFa(q.start)} ${q.back ? "منهای" : "به‌علاوه"} ${durationFa(q.minutes)} می‌شود ${timeFa(q.answer)}${lap}.`;
    }
    case "drift": {
      const s = q.fast ? "+" : "−";
      if (q.variant === "offset") return `ساعت ${q.fast ? "جلو است، پس ساعت واقعی کمتر است" : "عقب است، پس ساعت واقعی بیشتر است"}: ${ltr(`${timeFa(q.start)} ${q.fast ? "−" : "+"} ${fa(q.rate)}′ = ${timeFa(q.answer)}`)}.`;
      if (q.variant === "perDay") return `در ${fa(q.span)} روز، ${ltr(`${fa(q.span)} × ${fa(q.rate)} = ${fa(q.span * q.rate)}`)} دقیقه ${sideWord(q.fast)} می‌رود: ${ltr(`${timeFa(q.start)} ${s} ${fa(q.span * q.rate)}′ = ${timeFa(q.answer)}`)}.`;
      return `${fa(q.span)} ساعت گذشته و ساعت ${ltr(`${fa(q.span)} × ${fa(q.rate)} = ${fa(q.span * q.rate)}`)} دقیقه ${sideWord(q.fast)} رفته: ${ltr(`${timeFa(q.start)} + ${fa(q.span)} ساعت ${s} ${fa(q.span * q.rate)} دقیقه = ${timeFa(q.answer)}`)}.`;
    }
    case "weekday":
      return `${weeksFa(q.days)}: ${fa(Math.floor(q.days / 7))} هفته کامل باز ${WEEKDAYS[q.start]} می‌شود، بعد ${fa(q.days % 7)} روز ${q.back ? "عقب" : "جلو"}: ${WEEKDAYS[q.answer]}.`;
    case "month": {
      if (q.from.m === q.to.m) return `${ltr(`${fa(q.to.d)} − ${fa(q.from.d)} = ${fa(q.days)}`)} روز؛ ${weeksFa(q.days)}، پس ${fa(q.days % 7)} روز بعد از ${WEEKDAYS[q.weekday]}: ${WEEKDAYS[q.answer]}.`;
      // Months after `from` up to `to`, counted past Esfand into the next year when the question names a year.
      const last = q.to.m + (q.year !== undefined ? 12 : 0);
      const len = (k: number) => daysIn(k % 12, q.year);
      const parts = [`باقی ${MONTHS[q.from.m].name} ${ltr(`${len(q.from.m)} − ${q.from.d} = ${len(q.from.m) - q.from.d}`)}`];
      for (let k = q.from.m + 1; k < last; k++) parts.push(`${MONTHS[k % 12].name} ${len(k)}`);
      parts.push(`${MONTHS[q.to.m].name} ${q.to.d}`);
      const leap = q.year !== undefined ? `${leapFa(q.year)}، پس اسفندش ${fa(daysIn(11, q.year))} روز دارد. ` : "";
      return `${leap}${MONTHS[q.from.m].name} ${fa(len(q.from.m))} روز دارد. روزها: ${fa(parts.join("، "))}؛ جمع ${fa(q.days)} روز. ${weeksFa(q.days)}، پس ${fa(q.days % 7)} روز بعد از ${WEEKDAYS[q.weekday]}: ${WEEKDAYS[q.answer]}.`;
    }
  }
}

/** The answer in words. */
export function answerFa(q: ClockQuestion, v = q.answer) {
  const kind = answerKind(q.type);
  return kind === "number" ? `${fa(v)}°` : kind === "time" ? timeFa(v) : WEEKDAYS[v];
}

type Tone = "good" | "turned" | "bad";
const ICON: Record<Tone, string> = { good: "✓", turned: "↻", bad: "✗" };

function feedback(q: ClockQuestion, v: number): { tone: Tone; text: string } {
  const how = clockHow(q);
  const right = `جواب ${answerFa(q)} است. ${how}`;
  switch (clockMistake(q, v)) {
    case "right":
      return { tone: "good", text: `درست است! ${how}` };
    case "hourStill": {
      const { m } = hm((q as { time: number }).time);
      return { tone: "turned", text: `نزدیک بود! عقربه ساعت سر جایش نمی‌ماند: در ${fa(m)} دقیقه، ${fa(m / 2)}° جلو می‌رود. ${right}` };
    }
    case "reflex":
      return { tone: "turned", text: `این زاویه بزرگ (بیرونی) است. زاویه بین عقربه‌ها کوچک‌تر است: ${ltr(`۳۶۰ − ${fa(v)} = ${fa(q.answer)}`)}. ${how}` };
    case "same":
      return { tone: "bad", text: `این همان چیزی است که در آینه دیده می‌شود. آینه چپ و راست را جابه‌جا می‌کند. ${right}` };
    case "hourOnly":
      return { tone: "turned", text: `نزدیک بود! ساعت را قرینه کردی ولی دقیقه‌ها هم در آینه برعکس می‌شوند. ${right}` };
    case "minuteOnly":
      return { tone: "turned", text: `نزدیک بود! دقیقه‌ها را قرینه کردی ولی عقربه ساعت هم برعکس می‌شود. ${right}` };
    case "wrongWay":
      return {
        tone: "turned",
        text:
          q.type === "drift"
            ? `نزدیک بود! جهت برعکس شد: ساعتی که ${sideWord(q.fast)} ${q.variant === "offset" ? "است" : "می‌رود"}، ${q.fast ? "بیشتر" : "کمتر"} از وقت واقعی نشان می‌دهد. ${right}`
            : `نزدیک بود! جهت برعکس شد: «${"back" in q && q.back ? "پیش" : "بعد"}» یعنی ${"back" in q && q.back ? "عقب" : "جلو"} برو. ${right}`,
      };
    case "noCarry":
      return {
        tone: "turned",
        text: `نزدیک بود! دقیقه‌ها از ${q.type === "elapsed" && q.back ? "صفر کمتر شدند؛ یک ساعت قرض بگیر" : "۶۰ گذشتند؛ یک ساعت به ساعت‌ها اضافه می‌شود"}. ${right}`,
      };
    case "oneUnit":
      return { tone: "turned", text: `نزدیک بود! ${fa((q as { rate: number }).rate)} دقیقه برای هر ${q.type === "drift" && q.variant === "perDay" ? "روز" : "ساعت"} است؛ برای ${fa((q as { span: number }).span)} تا، چند برابر می‌شود. ${right}` };
    case "noRun":
      return { tone: "turned", text: `نزدیک بود! خود ساعت هم ${fa((q as { span: number }).span)} ساعت جلو رفته. ${right}` };
    case "offByOne":
      return { tone: "turned", text: `نزدیک بود! یک روز اختلاف دارد: روز شروع را نشمار؛ از روز بعدش بشمار. ${right}` };
    case "assume30":
      return { tone: "turned", text: `نزدیک بود! همه ماه‌ها ۳۰ روز نیستند: شش ماه اول ۳۱ روز دارند. ${right}` };
    case "esfand": {
      const year = (q as { year: number }).year;
      return {
        tone: "turned",
        text: isLeapYear(year)
          ? `نزدیک بود! ${leapFa(year)}؛ پس اسفندش ۳۰ روز دارد، نه ۲۹. ${right}`
          : `نزدیک بود! ${leapFa(year)}؛ پس اسفندش ۲۹ روز دارد. اسفند فقط در سال کبیسه ۳۰ روز است. ${right}`,
      };
    }
    default:
      return { tone: "bad", text: right };
  }
}

interface Props {
  question: ClockQuestion;
  type: ClockQuestionType;
  level: Level;
  /** The time on the answer clock (time questions). */
  time: number;
  onTime: (t: number) => void;
  checked: number | null;
  onCheck: (v: number) => void;
  onType: (t: ClockQuestionType) => void;
  onLevel: (l: Level) => void;
  onNew: () => void;
}

export function ClockTryPanel(p: Props) {
  const { question: q, checked } = p;
  const kind = answerKind(q.type);
  const [num, setNum] = useState(kind === "number" && checked !== null ? String(checked) : "");
  const [day, setDay] = useState<number | null>(kind === "day" ? checked : null);
  const fb = checked !== null ? feedback(q, checked) : null;
  const done = checked !== null;

  const nudge = (d: number) => p.onTime(((p.time + d) % 720 + 720) % 720);

  return (
    <div className={styles.panel}>
      <div className={styles.types} role="radiogroup" aria-label="نوع پرسش">
        {(Object.keys(CLOCK_TYPE_LABEL) as ClockQuestionType[]).map((t) => (
          <button key={t} role="radio" aria-checked={p.type === t} onClick={() => p.onType(t)}>
            {CLOCK_TYPE_LABEL[t]}
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

      <p className={styles.prompt}>{clockPrompt(q)}</p>

      {kind === "number" && <NumberPad value={num} onChange={setNum} disabled={done} />}

      {kind === "time" && (
        <>
          <output className={styles.bigNumber} aria-live="polite" style={{ direction: "ltr" }}>
            {timeFa(p.time)}
          </output>
          <div className={styles.chips} aria-label="تنظیم ساعت">
            <button onClick={() => nudge(60)} disabled={done}>+۱ ساعت</button>
            <button onClick={() => nudge(5)} disabled={done}>+۵ دقیقه</button>
            <button onClick={() => nudge(1)} disabled={done}>+۱ دقیقه</button>
          </div>
          <div className={styles.chips}>
            <button onClick={() => nudge(-60)} disabled={done}>−۱ ساعت</button>
            <button onClick={() => nudge(-5)} disabled={done}>−۵ دقیقه</button>
            <button onClick={() => nudge(-1)} disabled={done}>−۱ دقیقه</button>
          </div>
          {!done && <p className={styles.hint}>می‌توانی عقربه‌ها را روی صفحه هم بکشی؛ با عقربه بلند، عقربه کوتاه هم آهسته می‌چرخد.</p>}
        </>
      )}

      {kind === "day" && (
        <div className={styles.types} role="radiogroup" aria-label="روز هفته" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
          {WEEKDAYS.map((name, i) => (
            <button key={name} role="radio" aria-checked={day === i} onClick={() => setDay(i)} disabled={done}>
              {done && i === q.answer ? "✓ " : done && i === checked ? "✗ " : ""}
              {name}
            </button>
          ))}
        </div>
      )}

      {!done && (
        <button
          className={styles.secondary}
          disabled={kind === "number" ? !num : kind === "day" ? day === null : false}
          onClick={() => p.onCheck(kind === "number" ? Number(num) : kind === "day" ? day! : p.time)}
        >
          بررسی
        </button>
      )}

      {fb && (
        <p className={`${styles.feedback} ${styles[fb.tone]}`} role="status" aria-live="polite">
          <span className={styles.icon}>{ICON[fb.tone]}</span> {fb.text}
        </p>
      )}
      {done && kind === "time" && <p className={styles.hint}>روی صفحه، ساعت درست کار می‌کند تا به جواب برسد؛ با نوار پایین جلو و عقب ببر.</p>}
      {done && kind === "day" && <p className={styles.hint}>روی تقویم: پرش‌های آبی هفته‌های کامل‌اند (همان روز هفته)، پرش‌های خط‌چین قرمز روزهای باقی‌مانده.</p>}

      <button className={styles.next} onClick={p.onNew}>
        نمونه تازه
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { answerKind, ratioMistake, simplest, type Answer, type Level, type RatioQuestion, type RatioQuestionType } from "@/generators/ratio";
import { NumberPad } from "@/toolkit/NumberPad";
import { fa } from "@/tools/registry";
import { FracH, Rich } from "./Frac";
import { answerSegs, percentParts, RATIO_THINGS, RATIO_TYPE_LABEL, ratioHow, ratioPrompt, tankOf, type Seg } from "./text";
import styles from "@/toolkit/TryPanel.module.css";
import own from "./ratio.module.css";

type Tone = "good" | "turned" | "bad";
const ICON: Record<Tone, string> = { good: "✓", turned: "↻", bad: "✗" };

/** Why a wrong answer is wrong, for each named slip. */
function slipText(q: RatioQuestion, tag: ReturnType<typeof ratioMistake>): Seg[] | null {
  switch (tag) {
    case "numeratorOnly":
      return [`صورت را رنگ کردی، ولی این شکل ${fa((q as { parts: number }).parts)} قسمت دارد، نه ${fa((q as { frac: { d: number } }).frac.d)}. هر `, { n: 1, d: (q as { frac: { d: number } }).frac.d }, " چند قسمتِ این شکل است؟"];
    case "denominator":
      return ["مخرج، تعداد همه قسمت‌های مساوی است، نه تعداد قسمت‌های رنگی."];
    case "complement":
      if (q.type === "shade") return ["این تعداد قسمت‌های رنگ‌نشده است؛ کسر می‌گوید چند قسمت رنگ شود."];
      if (q.type === "percent") return [`این باقی‌مانده است (${fa(100 - q.pct)} درصد)، نه ${fa(q.pct)} درصد.`];
      if (q.type === "work") return ["این، بخشِ پرنشده است؛ سؤال بخش پرشده را می‌خواهد."];
      return ["این، مانده است؛ سؤال خودِ کسر را می‌خواهد."];
    case "onePart":
      return ["این فقط یک بلوک (یک قسمت) است. حالا ببین چند بلوک لازم داری."];
    case "usedPart":
      if (q.type === "percent" && q.variant === "up") return ["این فقط مقدار افزایش است؛ آن را به عدد اول اضافه کن."];
      return ["این همان قسمتی است که برداشته شد؛ سؤال مانده را می‌خواهد."];
    case "forward":
      return [`برعکس شد: ${fa((q as { part: number }).part)} خودش تکه‌ای از عدد است، پس آن عدد از ${fa((q as { part: number }).part)} بزرگ‌تر است.`];
    case "restOnly":
      return q.type === "percent" ? ["این، باقیِ عدد است؛ سؤال همه آن را می‌خواهد."] : ["این، قسمت‌های دیگرِ نوار است؛ سؤال کل نوار را می‌خواهد."];
    case "notEqual":
      return ["این دو کسر برابرند! هم‌مخرجشان کن تا ببینی."];
    case "biggerDenominator":
      return ["مخرجِ بزرگ‌تر یعنی قسمت‌های کوچک‌تر، نه کسر بزرگ‌تر."];
    case "biggerNumerator":
      return ["صورتِ بزرگ‌تر به‌تنهایی کافی نیست؛ اندازه قسمت‌ها (مخرج) هم مهم است. هم‌مخرج کن."];
    case "gap":
      return ["«چند قسمت کم دارد» را مقایسه کردی؛ اما قسمت‌های دو کسر هم‌اندازه نیستند. هم‌مخرج کن."];
    case "addDifference":
      return ["به‌جای ضرب، اختلاف را اضافه کردی. در نسبت همه بلوک‌ها هم‌اندازه‌اند: اول ببین یک بلوک چند است."];
    case "swapped":
      if (q.type === "percent") return ["برعکس تقسیم کردی: جزء را بر کل تقسیم کن، نه کل را بر جزء."];
      return ["نسبت را برعکس خواندی: عدد اول نسبت مال چیزِ اول است."];
    case "otherPart":
      if (q.type === "divide") return ["این سهمِ یک نفرِ دیگر است."];
      if (q.type === "ratio" && q.variant === "total") return [`این فقط ${RATIO_THINGS[q.things].b} است؛ سؤال جمع هر دو را می‌خواهد.`];
      return q.type === "ratio" ? [`این ${RATIO_THINGS[q.things].b} است؛ سؤال ${RATIO_THINGS[q.things].a} را می‌خواهد.`] : null;
    case "givenPart":
      return ["این همان عددی است که در سؤال داده شده بود."];
    case "total":
      return q.type === "ratio" ? [`این جمع هر دو است؛ سؤال فقط ${RATIO_THINGS[q.things].a} را می‌خواهد.`] : null;
    case "usedDifference":
      return ["این اختلاف است؛ اختلاف چند بلوک است؟ اول یک بلوک را پیدا کن."];
    case "equalSplit":
      return ["سهم‌ها مساوی نیستند؛ به نسبت تقسیم کن: هر نفر به اندازه عددش بلوک دارد."];
    case "dividedByPart":
      return q.type === "divide" ? [`کل را بر عدد نسبت تقسیم کردی؛ باید بر جمع همه بلوک‌ها (${fa(q.ratio.reduce((s, r) => s + r, 0))}) تقسیم کنی.`] : null;
    case "percentAsNumber":
      return ["عدد درصد خودش جواب نیست؛ مثلاً ۲۰ درصد یعنی ۲۰ از هر ۱۰۰."];
    case "subtractedPercent":
      return q.type === "percent" ? [`عدد درصد را مستقیم کم کردی؛ اول ببین ${fa(q.pct)} درصدِ ${fa(q.whole)} چند است.`] : null;
    case "addedPercent":
      return q.type === "percent" ? [`عدد درصد را مستقیم اضافه کردی؛ اول ببین ${fa(q.pct)} درصدِ ${fa(q.whole)} چند است.`] : null;
    case "partAsPercent":
      return q.type === "percent" ? [`${fa(q.part)} خودش درصد نیست؛ ببین ${fa(q.part)} چند بلوکِ نوار است.`] : null;
    case "oneUnit":
      return ["این کارِ فقط یک واحد زمان است؛ در زمانِ گفته‌شده چند برابر می‌شود؟"];
    case "inverted":
      return ["کسر برعکس شد: صورت، کارِ انجام‌شده است و مخرج، کل کار."];
    case "addedParts":
      return ["صورت‌ها را با هم و مخرج‌ها را با هم جمع کردی؛ کسرها این‌طور جمع نمی‌شوند. اول هم‌مخرج کن."];
    case "addedTimes":
      return ["زمان‌ها را جمع کردی؛ ولی با هم کار کردن، کار را تندتر می‌کند نه کندتر. کارِ هر ساعت (یا هر روز) را جمع کن."];
    case "averaged":
      return ["میانگین زمان‌ها نیست؛ با هم، حتی از تندترین هم زودتر تمام می‌شود."];
    case "addedRates":
      return ["سوراخ آب را خالی می‌کند؛ کارش را باید از کار شیر کم کنی، نه اضافه."];
    case "subtractedTimes":
      return ["زمان‌ها را از هم کم کردی؛ باید کارِ هر ساعت را کم کنی، نه خود زمان‌ها را."];
    case "direct":
      return ["کارگرِ بیشتر یعنی روزِ کمتر! کل کار ثابت می‌ماند (تناسب معکوس)."];
    case "additive":
      return ["کارگر و روز یکی‌یکی کم و زیاد نمی‌شوند؛ کل کار را حساب کن (کارگر × روز)."];
    default:
      return null;
  }
}

function feedback(q: RatioQuestion, v: Answer): { tone: Tone; segs: Seg[] } {
  const how = ratioHow(q);
  const right: Seg[] = ["جواب ", ...answerSegs(q), " است. ", ...how];
  const tag = ratioMistake(q, v);
  if (tag === "right") {
    // A right fraction that is not in simplest form: say so, kindly.
    const extra: Seg[] = [];
    if (typeof v === "object") {
      const s = simplest(v);
      if (s.d !== v.d) extra.push(" ساده‌ترین شکلش ", { n: fa(s.n), d: fa(s.d) }, " است.");
    }
    return { tone: "good", segs: ["درست است! ", ...how, ...extra] };
  }
  const why = slipText(q, tag);
  if (!why) return { tone: "bad", segs: right };
  return { tone: q.type === "compare" && tag === "notEqual" ? "bad" : "turned", segs: ["نزدیک بود! ", ...why, " ", ...right] };
}

/** A hint before checking: how the picture helps. */
function hint(q: RatioQuestion): string {
  switch (q.type) {
    case "shade":
      return "روی قسمت‌های شکل بزن تا رنگ شوند (دوباره بزنی، پاک می‌شود). کدام قسمت‌ها مهم نیست؛ فقط تعدادشان.";
    case "compare":
      return "می‌توانی دو کسر را هم‌مخرج کنی، یا هر دو را روی نوارهای هم‌اندازه تصور کنی.";
    case "percent":
      return `نوار، ۱۰۰ درصد است و ${fa(percentParts(q).m)} بلوک دارد.`;
    case "work":
      return q.variant === "crew" ? "هر خانه، کار یک کارگر در یک روز است." : `${q.ctx === "tap" ? "مخزن" : "دیوار"} را ${fa(tankOf(q).cells)} ${q.ctx === "tap" ? "خانه" : "تکه"} گرفته‌ایم تا کار هر ${q.ctx === "tap" ? "ساعت" : "روز"} خانه‌های کامل باشد.`;
    default:
      return "همه بلوک‌ها هم‌اندازه‌اند. اول بپرس: یک بلوک چند است؟";
  }
}

interface Props {
  question: RatioQuestion;
  type: RatioQuestionType;
  level: Level;
  /** Parts shaded on the board (shade questions). */
  shadedCount: number;
  onClearShade: () => void;
  checked: Answer | null;
  onCheck: (v: Answer) => void;
  onType: (t: RatioQuestionType) => void;
  onLevel: (l: Level) => void;
  onNew: () => void;
}

export function RatioTryPanel(p: Props) {
  const { question: q, checked } = p;
  const kind = answerKind(q);
  const done = checked !== null;
  const [num, setNum] = useState(kind === "number" && done && typeof checked === "number" ? String(checked) : "");
  const [top, setTop] = useState(kind === "fraction" && done && typeof checked === "object" ? String(checked.n) : "");
  const [bottom, setBottom] = useState(kind === "fraction" && done && typeof checked === "object" ? String(checked.d) : "");
  const [slot, setSlot] = useState<"n" | "d">("n");
  const [choice, setChoice] = useState<number | null>(kind === "choice" && typeof checked === "number" ? checked : null);
  const fb = checked !== null ? feedback(q, checked) : null;

  const ready = kind === "number" ? !!num : kind === "fraction" ? !!top && !!bottom && Number(bottom) > 0 : kind === "choice" ? choice !== null : p.shadedCount > 0;
  const value = (): Answer => (kind === "number" ? Number(num) : kind === "fraction" ? { n: Number(top), d: Number(bottom) } : kind === "choice" ? choice! : p.shadedCount);

  return (
    <div className={styles.panel}>
      <div className={styles.types} role="radiogroup" aria-label="نوع پرسش">
        {(Object.keys(RATIO_TYPE_LABEL) as RatioQuestionType[]).map((t) => (
          <button key={t} role="radio" aria-checked={p.type === t} onClick={() => p.onType(t)}>
            {RATIO_TYPE_LABEL[t]}
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

      <p className={styles.prompt}>
        <Rich segs={ratioPrompt(q)} />
      </p>

      {kind === "number" && <NumberPad value={num} onChange={setNum} disabled={done} />}

      {kind === "fraction" && (
        <>
          <div className={own.fracEntry}>
            <div role="group" aria-label="کسر">
              <button className={own.slot} aria-pressed={slot === "n"} onClick={() => setSlot("n")} disabled={done} aria-label="صورت">
                {top ? fa(top) : "؟"}
              </button>
              <span className={own.bar} />
              <button className={own.slot} aria-pressed={slot === "d"} onClick={() => setSlot("d")} disabled={done} aria-label="مخرج">
                {bottom ? fa(bottom) : "؟"}
              </button>
            </div>
          </div>
          <NumberPad
            value={slot === "n" ? top : bottom}
            maxDigits={2}
            disabled={done}
            onChange={(v) => {
              if (slot === "n") {
                setTop(v);
                // Typing the top moves on to the bottom after a digit or two.
                if (v.length === 2) setSlot("d");
              } else setBottom(v);
            }}
          />
          {!done && <p className={styles.hint}>اول صورت، بعد مخرج (روی هر کدام بزن تا انتخاب شود). کسرهای مساوی هم درست‌اند؛ مثلاً <FracH f={{ n: 2, d: 4 }} /> همان <FracH f={{ n: 1, d: 2 }} /> است.</p>}
        </>
      )}

      {kind === "choice" && q.type === "compare" && (
        <div className={own.choice} role="radiogroup" aria-label="کدام بزرگ‌تر است؟">
          {[0, 1, 2].map((i) => (
            <button key={i} role="radio" aria-checked={choice === i} onClick={() => setChoice(i)} disabled={done} aria-label={i === 2 ? "برابرند" : `کسر ${fa(i + 1)}`}>
              {done && i === q.answer ? "✓ " : done && i === checked ? "✗ " : ""}
              {i === 2 ? "برابرند" : <FracH f={q.fracs[i]} big />}
            </button>
          ))}
        </div>
      )}

      {kind === "shade" && (
        <>
          <output className={styles.prompt} aria-live="polite">
            رنگ‌شده: {fa(p.shadedCount)} از {fa(q.type === "shade" ? q.parts : 0)} قسمت
          </output>
          {!done && (
            <button className={styles.secondary} onClick={p.onClearShade} disabled={p.shadedCount === 0}>
              پاک کردن رنگ‌ها
            </button>
          )}
        </>
      )}

      {!done && <p className={styles.hint}>{hint(q)}</p>}

      {!done && (
        <button className={styles.secondary} disabled={!ready} onClick={() => p.onCheck(value())}>
          بررسی
        </button>
      )}

      {fb && (
        <p className={`${styles.feedback} ${styles[fb.tone]}`} role="status" aria-live="polite">
          <span className={styles.icon}>{ICON[fb.tone]}</span> <Rich segs={fb.segs} />
        </p>
      )}
      {done && <p className={styles.hint}>روی صفحه، مدل نواری قدم‌به‌قدم کامل می‌شود؛ با نوار پایین جلو و عقب ببر.</p>}

      <button className={styles.next} onClick={p.onNew}>
        نمونه تازه
      </button>
    </div>
  );
}

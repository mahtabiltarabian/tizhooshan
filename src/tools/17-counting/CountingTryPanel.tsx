"use client";

import { useState } from "react";
import { answerKind, countingMistake, type Answer, type CountingQuestion, type CountingQuestionType, type Level } from "@/generators/counting";
import { NumberPad } from "@/toolkit/NumberPad";
import { fa } from "@/tools/registry";
import { answerText, COUNTING_TYPE_LABEL, countingHow, countingPrompt, fracText, gcd } from "./text";
import styles from "@/toolkit/TryPanel.module.css";
import own from "./counting.module.css";

type Tone = "good" | "turned" | "bad";
const ICON: Record<Tone, string> = { good: "✓", turned: "↻", bad: "✗" };

/** Why a wrong answer is wrong, for each named slip. */
function slipText(q: CountingQuestion, tag: ReturnType<typeof countingMistake>): string | null {
  switch (tag) {
    case "unordered":
      return q.type === "probability"
        ? `${q.variant === "dice2" ? "دو تاس" : "سکه‌ها"} با هم فرق دارند، پس ${q.variant === "dice2" ? "«۱ و ۶» با «۶ و ۱»" : "«شیر، خط» با «خط، شیر»"} دو حالت جداست. حالت‌ها را بی‌ترتیب شمردی.`
        : "این تعداد گروه‌هاست (بی‌ترتیب)؛ ولی اینجا ترتیب مهم است: «اول سارا بعد علی» با «اول علی بعد سارا» فرق دارد.";
    case "ordered":
      return `ترتیب را هم شمردی؛ ولی در ${q.type === "choose" && q.ctx === "fruit" ? "سبد" : "گروه"} ترتیب مهم نیست و هر گروه چند بار شمرده شده. بر تعداد ترتیب‌های هر گروه تقسیم کن.`;
    case "added":
      if (q.type === "grid") return "طول و عرض را جمع کردی؛ این طول هر مسیر است، نه تعداد مسیرها.";
      if (q.type === "tree" && q.variant === "roads") return "همه جاده‌ها را جمع کردی؛ ولی جاده‌های «الف» تا «ب» و «ب» تا «پ» پشت سر هم‌اند: آن‌ها را ضرب کن، بعد جاده‌های مستقیم را اضافه کن.";
      if (q.type === "tree") return "جمع کردی؛ ولی هر انتخاب از گروه اول با هر انتخاب از گروه بعدی جور می‌شود: ضرب کن.";
      return "انتخاب‌های هر جا را جمع کردی؛ ولی برای هر انتخابِ جای اول، همه انتخاب‌های جای دوم هست: ضرب کن.";
    case "multiplied":
      if (q.type === "grid") return "طول و عرض را ضرب کردی؛ این تعداد خانه‌هاست، نه تعداد مسیرها. عدد هر گره را از جمع دو همسایه‌اش بساز.";
      if (q.type === "tree" && q.variant === "roads") return "همه را ضرب کردی؛ جاده مستقیم از «ب» نمی‌گذرد، پس جدا اضافه می‌شود.";
      return "ضرب کردی؛ ولی علی یا اتوبوس سوار می‌شود یا قطار، هر دو با هم نه. «یا این یا آن» یعنی جمع.";
    case "repeated":
      return `این یعنی ${q.type === "arrange" && q.ctx === "digits" ? "یک رقم" : "یک نفر"} می‌توانست دوباره بیاید؛ ولی تکرار نداریم: هر جای بعدی یک انتخاب کمتر دارد.`;
    case "forgotCondition":
      return "این تعداد همه حالت‌هاست؛ شرط سؤال را فراموش کردی.";
    case "complement":
      return q.type === "probability" ? "این احتمالِ نیامدنِ آن است؛ حالت‌های خوب را بشمار." : "این حالت‌هایی است که شرط را ندارند؛ سؤال بقیه را می‌خواهد.";
    case "doubleCounted":
      return "هر دست‌دادن را دو بار شمردی (یک بار برای هر نفر). نصفش کن.";
    case "square":
      return "هیچ‌کس با خودش دست نمی‌دهد، و هر دست‌دادن را هم دو بار شمردی.";
    case "perPerson":
      return "این دست‌دادن‌های فقط یک نفر است؛ همه را بشمار.";
    case "addedParts":
      return q.type === "grid" && q.cond === "block"
        ? "برای راه‌هایی که از ✗ می‌گذرند، «تا ✗» و «از ✗» را جمع کردی؛ هر راهِ تکه اول با هر راهِ تکه دوم جور می‌شود: ضرب کن، بعد از همه کم کن."
        : "راه‌های دو تکه را جمع کردی؛ هر راهِ تکه اول با هر راهِ تکه دوم جور می‌شود: ضرب کن.";
    case "offByOne":
      if (q.type === "handshake") return "امتحانش کن: با این تعداد، دست‌دادن‌ها را بشمار و با عدد سؤال مقایسه کن.";
      return "این بدترین حالتی است که هنوز کار تمام نشده! یکی بیشتر بردار.";
    case "lucky":
      return "این خوش‌شانسی است. «مطمئن باشیم» یعنی حتی در بدترین حالت هم بشود.";
    case "tooMany":
      return q.type === "pigeonhole" ? `این بیش از لازم است: در بدترین حالت از هر رنگ ${fa(q.k - 1)} تا برمی‌داری و بعدی حتماً ${fa(q.k)}‌تایی می‌سازد.` : null;
    case "forgotLimit":
      return q.type === "pigeonhole" ? `رنگی که کمتر از ${fa(q.k - 1)} تا دارد، نمی‌تواند ${fa(q.k - 1)} تا بدهد! تعدادِ هر رنگ را نگاه کن.` : null;
    case "odds":
      return "خوب‌ها را بر بدها تقسیم کردی؛ مخرج باید همه حالت‌ها باشد.";
    default:
      return null;
  }
}

function feedback(q: CountingQuestion, v: Answer): { tone: Tone; text: string } {
  const how = countingHow(q);
  const right = `جواب ${answerText(q)} است. ${how}`;
  const tag = countingMistake(q, v);
  if (tag === "right") {
    // A right fraction that is not in simplest form (or not the cases' own fraction): say so, kindly.
    let extra = "";
    if (typeof v === "object" && q.type === "probability") {
      const g = gcd(v.n, v.d);
      if (g > 1) extra = ` ساده‌اش ${fracText({ n: v.n / g, d: v.d / g })} است.`;
    }
    return { tone: "good", text: `درست است! ${how}${extra}` };
  }
  const why = slipText(q, tag);
  if (!why) return { tone: "bad", text: right };
  return { tone: "turned", text: `نزدیک بود! ${why} ${right}` };
}

/** A hint before checking. */
function hint(q: CountingQuestion): string {
  switch (q.type) {
    case "tree":
      return q.variant === "either" ? "«یا این یا آن»: کدام را بشماریم؟" : "درخت بکش: هر شاخه دوباره شاخه می‌شود.";
    case "arrange":
      return "جای‌ها را یکی‌یکی پر کن: جای اول چند انتخاب دارد؟ بعدی؟";
    case "choose":
      return "اول فکر کن ترتیب مهم بود چند حالت می‌شد؛ هر گروه چند بار شمرده شده؟";
    case "handshake":
      return "نفر اول با چند نفر دست می‌دهد؟ دومی با چند نفرِ تازه؟";
    case "grid":
      return "روی هر گره بنویس چند راه به آن می‌رسد: از چپ یا از پایین.";
    case "pigeonhole":
      return "بدشانس‌ترین حالت را تصور کن: تا کجا می‌شود برداشت و هنوز نشده باشد؟";
    case "probability":
      return "همه حالت‌ها را بنویس (درخت یا جدول) و خوب‌ها را علامت بزن. کسرهای مساوی هم درست‌اند؛ مثلاً ۲ بر ۴ همان ۱ بر ۲ است.";
  }
}

interface Props {
  question: CountingQuestion;
  type: CountingQuestionType;
  level: Level;
  checked: Answer | null;
  onCheck: (v: Answer) => void;
  /** Mock exam: record the answer, show nothing about it. */
  exam?: boolean;
  onType: (t: CountingQuestionType) => void;
  onLevel: (l: Level) => void;
  onNew: () => void;
}

export function CountingTryPanel(p: Props) {
  const { question: q, checked } = p;
  const kind = answerKind(q.type);
  const done = checked !== null;
  const [num, setNum] = useState(done && typeof checked === "number" ? String(checked) : "");
  const [top, setTop] = useState(done && typeof checked === "object" ? String(checked.n) : "");
  const [bottom, setBottom] = useState(done && typeof checked === "object" ? String(checked.d) : "");
  const [slot, setSlot] = useState<"n" | "d">("n");
  const fb = checked !== null && !p.exam ? feedback(q, checked) : null;

  const ready = kind === "number" ? !!num : !!top && !!bottom && Number(bottom) > 0;
  const value = (): Answer => (kind === "number" ? Number(num) : { n: Number(top), d: Number(bottom) });

  return (
    <div className={styles.panel}>
      <div className={styles.types} role="radiogroup" aria-label="نوع پرسش" data-practice-hide>
        {(Object.keys(COUNTING_TYPE_LABEL) as CountingQuestionType[]).map((t) => (
          <button key={t} role="radio" aria-checked={p.type === t} onClick={() => p.onType(t)}>
            {COUNTING_TYPE_LABEL[t]}
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

      <p className={styles.prompt}>{countingPrompt(q)}</p>

      {kind === "number" && <NumberPad value={num} onChange={setNum} disabled={done} />}

      {kind === "fraction" && (
        <>
          <div className={own.fracEntry}>
            <div role="group" aria-label="کسر">
              <button className={own.slot} aria-pressed={slot === "n"} onClick={() => setSlot("n")} disabled={done} aria-label="صورت: حالت‌های خوب">
                {top ? fa(top) : "؟"}
              </button>
              <span className={own.bar} />
              <button className={own.slot} aria-pressed={slot === "d"} onClick={() => setSlot("d")} disabled={done} aria-label="مخرج: همه حالت‌ها">
                {bottom ? fa(bottom) : "؟"}
              </button>
            </div>
          </div>
          <NumberPad
            value={slot === "n" ? top : bottom}
            maxDigits={2}
            disabled={done}
            onChange={(v) => {
              if (slot === "n") setTop(v);
              else setBottom(v);
            }}
          />
          {!done && <p className={styles.hint}>بالا: تعداد حالت‌های خوب؛ پایین: تعداد همه حالت‌ها (روی هر کدام بزن تا انتخاب شود).</p>}
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
          <span className={styles.icon}>{ICON[fb.tone]}</span> {fb.text}
        </p>
      )}
      {done && !p.exam && (
        <p className={styles.hint}>
          {q.type === "pigeonhole"
            ? "روی صفحه، بدترین حالت رنگ‌به‌رنگ برداشته می‌شود؛ با نوار پایین جلو و عقب ببر."
            : `روی صفحه همه حالت‌ها یکی‌یکی می‌آیند${q.type === "grid" || q.type === "tree" || q.type === "arrange" || q.type === "choose" || (q.type === "handshake" && q.variant === "twins") ? "؛ آن‌هایی که شرط را ندارند ✗ و خط‌خورده‌اند" : ""}. با نوار پایین جلو و عقب ببر.`}
        </p>
      )}

      <button className={styles.next} onClick={p.onNew}>
        نمونه تازه
      </button>
    </div>
  );
}

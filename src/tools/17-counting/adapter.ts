// Tool 17 in practice sessions: grading and three-step hints (the light
// data, types and tag words, is in practice.ts).
// The response is what the panel checks: a whole number, or for
// "probability" a fraction { n, d } (not necessarily in simplest form).

import { COLOURS, countingMistake, FRUITS, makeCountingQuestion, PEOPLE, type Answer, type CountingQuestion, type CountingQuestionType, type Level } from "@/generators/counting";
import type { ToolAdapter } from "@/practice/adapter";
import { fa } from "@/tools/registry";
import { COUNTING_PRACTICE } from "./practice";

const make = (type: string, level: number, seed: number) => makeCountingQuestion(type as CountingQuestionType, level as Level, seed);

const isAnswer = (v: unknown): v is Answer => {
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v !== "object" || v === null) return false;
  const { n, d } = v as { n?: unknown; d?: unknown };
  return typeof n === "number" && typeof d === "number" && Number.isFinite(n) && d > 0;
};

const NUDGE: Record<CountingQuestionType, string> = {
  tree: "درخت حالت‌ها را بکش: هر شاخه دوباره شاخه می‌شود.",
  arrange: "جاها را یکی‌یکی پر کن: جای اول چند انتخاب دارد؟ بعدی؟",
  choose: "اینجا ترتیب مهم است یا نه؟ «سارا و علی» با «علی و سارا» فرق دارد؟",
  handshake: "با تعداد کم امتحان کن و دست‌دادن‌ها را یکی‌یکی بنویس.",
  grid: "فقط به راست یا بالا می‌شود رفت؛ از گوشه شروع کن.",
  pigeonhole: "بدشانس‌ترین حالت را تصور کن.",
  probability: "همه حالت‌ها را بنویس و حالت‌های خوب را علامت بزن.",
};

const RULE: Record<CountingQuestionType, string> = {
  tree: "«این و آن» یعنی ضرب؛ «یا این یا آن» یعنی جمع.",
  arrange: "تعداد انتخاب‌های جاها را در هم ضرب کن؛ بدون تکرار، هر جای بعدی یک انتخاب کمتر دارد.",
  choose: "اول با ترتیب بشمار، بعد بر تعداد ترتیب‌های هر گروه تقسیم کن.",
  handshake: "هر نفر با همه جز خودش دست می‌دهد، ولی هر دست‌دادن مال دو نفر است: نصفش کن.",
  grid: "عدد هر گره = جمع عدد گره چپ و گره پایینش؛ گره‌های لبه پایین و لبه چپ هر کدام فقط یک راه دارند.",
  pigeonhole: "«مطمئن باشیم» یعنی حتی در بدترین حالت؛ بدترین حالت را بشمار و یکی اضافه کن.",
  probability: "احتمال = تعداد حالت‌های خوب ÷ تعداد همه حالت‌ها (حالت‌ها باید هم‌شانس باشند).",
};

/** The name of the question's i-th item: a person, a fruit or a digit. */
const itemFa = (q: { ctx: string; items: number[] }, i: number) => (q.ctx === "fruit" ? FRUITS[q.items[i]] : q.ctx === "digits" ? fa(q.items[i]) : PEOPLE[q.items[i]]);

function firstStep(q: CountingQuestion): string {
  const s = "گام اول: ";
  switch (q.type) {
    case "tree": {
      const z = q.sizes.map((x) => fa(x));
      if (q.variant === "roads") return `${s}از «الف» به «ب» ${z[0]} جاده هست و از «ب» به «پ» ${z[1]} جاده؛ اول راه‌هایی را بشمار که از «ب» می‌گذرند.`;
      if (q.variant === "either") return `${s}یک گروه ${z[0]} انتخاب دارد و گروه دیگر ${z[1]}؛ هر بار فقط از یکی انتخاب می‌شود.`;
      if (q.variant === "forbid") return `${s}اول همه حالت‌ها را بدون شرط بشمار؛ بعد حالت‌هایی را که با هم نمی‌آیند کم کن.`;
      return `${s}گروه اول ${z[0]} انتخاب دارد؛ هر کدام با ${z[1]} انتخاب گروه دوم جور می‌شود.`;
    }
    case "arrange":
      if (q.cond === "none") return `${s}جای اول ${fa(q.n)} انتخاب دارد؛ جای دوم چند انتخاب دارد؟`;
      if (q.cond === "noLeadingZero") return `${s}رقم اول نمی‌تواند صفر باشد؛ پس جای اول را اول پر کن.`;
      if (q.cond === "even") return `${s}عدد زوج با رقم زوج تمام می‌شود؛ پس جای آخر را اول پر کن.`;
      if (q.cond === "together") return `${s}${itemFa(q, 0)} و ${itemFa(q, 1)} را یک بسته بگیر؛ حالا چند چیز در ردیف هست؟`;
      if (q.cond === "atEnd") return `${s}اول جای ${itemFa(q, 0)} را بگذار، بعد بقیه جاها را پر کن.`;
      return `${s}اول همه ترتیب‌ها را بشمار، بعد آن‌هایی را که ${itemFa(q, 0)} و ${itemFa(q, 1)} کنار هم‌اند کم کن.`;
    case "choose":
      // With one more to pick, "from the n − 1 others" would already be the answer; so no count of the others.
      if (q.cond === "must") return `${s}${itemFa(q, 0)} حتماً هست؛ پس فقط ${q.k === 2 ? "یکی" : `${fa(q.k - 1)} تا`} از بقیه را باید انتخاب کنی.`;
      if (q.cond === "notBoth") return `${s}اول همه گروه‌ها را بشمار؛ بعد گروه‌هایی را که ${itemFa(q, 0)} و ${itemFa(q, 1)} را با هم دارند کم کن.`;
      return `${s}اگر ترتیب مهم بود، جای اول ${fa(q.n)} انتخاب و جای دوم ${fa(q.n - 1)} انتخاب داشت.`;
    case "handshake": {
      if (q.variant === "inverse") return `${s}برای چند نفرِ کم حساب کن چند دست‌دادن می‌شود و تعداد نفرها را کم‌کم بالا ببر.`;
      if (q.variant === "twins") return `${s}هر نفر با همه جز خودش و دوقلویش دست می‌دهد: با ${fa(q.n - 2)} نفر.`;
      const who = q.ctx === "teams" ? "تیم" : "نفر";
      return `${s}${who} اول با ${fa(q.n - 1)} ${who} دیگر روبه‌رو می‌شود؛ دومی با چند تای تازه؟`;
    }
    case "grid":
      if (q.cond === "through") return `${s}راه‌های رسیدن به گره ★ را بشمار؛ بعد راه‌های از ★ تا آخر را.`;
      if (q.cond === "block") return `${s}روی هر گره عدد راه‌ها را بنویس و روی گره ✗ صفر بگذار.`;
      return `${s}روی گره‌های لبه پایین و لبه چپ ۱ بنویس؛ بعد گره‌های ردیف دوم را پر کن.`;
    case "pigeonhole": {
      const name = q.ctx === "socks" ? "جوراب" : "مهره";
      if (q.variant === "same") return `${s}بدترین حالت: تا جایی ${name} بردار که هنوز ${fa(q.k)} تا از یک رنگ نداری.`;
      if (q.variant === "one") return `${s}بدترین حالت: اول همه ${name}های غیر ${COLOURS[q.colours[q.target]]} بیرون می‌آیند.`;
      if (q.variant === "all") return `${s}بدترین حالت: رنگ‌های پرتعداد اول بیرون می‌آیند و یک رنگ تا آخر نمی‌آید.`;
      return `${s}بدترین حالت: ${name}های اول همه یک رنگ‌اند؛ کدام رنگ بیشترین تعداد را دارد؟`;
    }
    case "probability":
      switch (q.variant) {
        case "die":
          return `${s}یک تاس شش وجه دارد؛ وجه‌هایی را که شرط را دارند بشمار.`;
        case "bag":
          return `${s}همه مهره‌های کیسه را بشمار؛ هر مهره یک حالت است.`;
        case "dice2":
          return `${s}جدول شش در شش بکش: ردیف‌ها تاس اول، ستون‌ها تاس دوم.`;
        case "coinDie":
          return `${s}برای هر رو یا پشت سکه، شش حالت تاس هست؛ جدولش را بکش.`;
        default:
          return `${s}هر سکه دو حالت دارد (شیر یا خط)؛ درخت حالت‌ها را بکش.`;
      }
  }
}

/** Number tokens of a text. */
const tokens = (t: string): string[] => t.match(/[0-9۰-۹]+(?:[٫.][0-9۰-۹]+)?/g) ?? [];

function hints(type: string, level: number, seed: number): [string, string, string] {
  const t = type as CountingQuestionType;
  const q = make(type, level, seed);
  const step = firstStep(q);
  // A given number can equal the answer; then the step goes without numbers.
  const safe = typeof q.answer === "number" && tokens(step).includes(fa(q.answer)) ? "گام اول: عددهای سؤال را روی کاغذ بنویس و ببین کدام قاعده آن‌ها را به هم می‌رساند." : step;
  return [NUDGE[t], RULE[t], safe];
}

export const COUNTING_ADAPTER: ToolAdapter = {
  ...COUNTING_PRACTICE,
  version: "counting@1",
  grade: (type, level, seed, response) => (isAnswer(response) ? countingMistake(make(type, level, seed), response) : "other"),
  hints,
};

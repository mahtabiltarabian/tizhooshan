// Tool 13 in practice sessions: grading and three-step hints (the light
// data, types and tag words, is in practice.ts).
// The response is the string the panel checks (see answerKey in
// generators/digits): the digits of a number; stick masks joined by "." for a
// matchstick puzzle; one digit per letter for a cryptarithm; one sign per gap
// (1 + , 2 −, 3 ×, 4 ÷) for signs; prime factors joined by "."; or the choice
// (1 or 2) for yes/no and odd/even questions.

import { digitsMistake, makeDigitsQuestion, readEquation, type Cond, type DigitsQuestionType, type Level } from "@/generators/digits";
import { LETTER } from "@/generators/digits-more";
import type { ToolAdapter } from "@/practice/adapter";
import { fa } from "@/tools/registry";
import { DIGITS_PRACTICE } from "./practice";

// makeDigitsQuestion builds the rng from the seed and hands it to the
// digits-more and digits-numbers generators, as the page does.
const make = (type: string, level: number, seed: number) => makeDigitsQuestion(type as DigitsQuestionType, level as Level, seed);

const ltr = (s: string) => `⁦${s}⁩`;
const list = (xs: number[]) => xs.map((x) => fa(x)).join("، ");

const NUDGE: Record<DigitsQuestionType, string> = {
  extreme: "جای هر رقم مهم است: رقم سمت چپ بیشترین ارزش را دارد.",
  condition: "اول شرط را بفهم، بعد عدد را بساز.",
  count: "رقم را در هر جایگاه (یکان، دهگان، صدگان) جدا بشمار.",
  digitSum: "هرچه رقم‌ها کمتر باشند، عدد کوچک‌تر است؛ رقم‌های سمت چپ مهم‌ترند.",
  divisible: "قاعده‌ی بخش‌پذیری را به یاد بیاور؛ لازم نیست تقسیم کامل کنی.",
  match: "هر رقم از چند چوب ساخته شده؛ ببین با برداشتن یا گذاشتن یک چوب، کدام رقم به رقم دیگری تبدیل می‌شود.",
  lcm: "«دوباره با هم» یعنی مضرب مشترک؛ «تکه‌های برابر» یعنی شمارنده‌ی مشترک.",
  crypt: "هر حرف یک رقم است و حرف‌های متفاوت رقم‌های متفاوت دارند.",
  signs: "ترتیب حساب را فراموش نکن: ضرب و تقسیم پیش از جمع و تفریق.",
  pages: "صفحه‌ها را دسته کن: یک‌رقمی، دورقمی و سه‌رقمی.",
  units: "فقط رقم یکان مهم است؛ لازم نیست خود حاصل را حساب کنی.",
  prime: "عدد اول دقیقاً دو شمارنده دارد: ۱ و خودش.",
  parity: "هر عدد را جفت‌جفت تصور کن: عدد فرد یک تکه‌ی تنها دارد.",
};

const RULE: Record<DigitsQuestionType, string> = {
  extreme: "برای بزرگ‌ترین عدد، رقم‌ها از بزرگ به کوچک؛ برای کوچک‌ترین، از کوچک به بزرگ، اما صفر هیچ‌وقت اول نمی‌آید.",
  condition: "زوج و بخش‌پذیر بر ۵ را رقم یکان می‌گوید، بر ۴ را دو رقم آخر، و بر ۳ و ۹ را مجموع رقم‌ها.",
  count: "در هر ده عدد پشت سر هم، رقم یک بار در یکان می‌آید؛ در هر صد عدد، ده بار در دهگان.",
  digitSum: "برای کوچک‌ترین عدد، کمترین تعداد رقم را بگیر: تا جای ممکن ۹ بگذار و ۹ها را آخر بنویس.",
  divisible: "بر ۳ یا ۹: مجموع رقم‌ها بر ۳ یا ۹ بخش‌پذیر باشد؛ بر ۴: دو رقم آخر؛ بر ۶: هم زوج و هم بر ۳.",
  match: "علامت = ثابت است و هیچ رقمی حذف نمی‌شود؛ تعداد چوب‌ها همیشه همان می‌ماند.",
  lcm: "ک.م.م: کوچک‌ترین عددی که بر همه بخش‌پذیر است. ب.م.م: بزرگ‌ترین عددی که همه بر آن بخش‌پذیرند.",
  crypt: "ستون به ستون از یکان جلو برو و ده‌بر را به ستون بعد ببر؛ ستونی که فقط یک حرف ناشناخته دارد، آن حرف را معلوم می‌کند.",
  signs: "علامت‌ها را امتحان کن و هر بار حاصل را به ترتیب درست حساب کن؛ پرانتز همیشه اول حساب می‌شود.",
  pages: "صفحه‌های ۱ تا ۹ هر کدام یک رقم، ۱۰ تا ۹۹ هر کدام دو رقم، و از ۱۰۰ به بعد هر کدام سه رقم دارند.",
  units: "رقم یکان توان‌های پشت‌سرهم یک عدد چرخه دارد؛ باقی‌مانده‌ی توان بر طول چرخه، خانه‌ی چرخه را می‌گوید.",
  prime: "شمارنده‌ها جفت‌جفت‌اند؛ تا جایی امتحان کن که مربع عدد امتحانی از خود عدد بیشتر شود.",
  parity: "فرد + فرد = زوج، زوج + فرد = فرد؛ پس فقط تعداد عددهای فرد مهم است.",
};

/** Where a condition is decided, as the first thing to look at. */
const COND_STEP: Record<Cond, string> = {
  even: "اول رقم یکان را از میان کارت‌های زوج انتخاب کن",
  odd: "اول رقم یکان را از میان کارت‌های فرد انتخاب کن",
  div5: "اول رقم یکان را ۰ یا ۵ بگذار",
  div4: "اول ببین با کدام دو کارت، دو رقم آخر بر ۴ بخش‌پذیر می‌شود",
  div3: "اول ببین کدام کارت‌ها با هم مجموعی بخش‌پذیر بر ۳ دارند",
  div9: "اول ببین کدام کارت‌ها با هم مجموعی بخش‌پذیر بر ۹ دارند",
  div6: "عدد باید زوج باشد؛ اول ببین کدام کارت‌ها مجموعی بخش‌پذیر بر ۳ دارند و یکان زوج کدام است",
};

function firstStep(type: string, level: number, seed: number): string {
  const q = make(type, level, seed);
  switch (q.type) {
    case "extreme":
      if (q.want === "diff") return `گام اول: اول بزرگ‌ترین عدد را با کارت‌های ${list(q.cards)} بساز: رقم‌ها از بزرگ به کوچک.`;
      return q.want === "max"
        ? `گام اول: کارت‌های ${list(q.cards)} را از بزرگ به کوچک مرتب کن.`
        : `گام اول: کارت‌های ${list(q.cards)} را از کوچک به بزرگ مرتب کن${q.cards.includes(0) ? "؛ اما صفر نمی‌تواند رقم اول باشد" : ""}.`;
    case "condition":
      return `گام اول: ${COND_STEP[q.cond]}.`;
    case "count":
      return `گام اول: فقط جای یکان را بشمار: از ۱ تا ${fa(q.n)}، رقم ${fa(q.digit)} چند بار در یکان می‌آید؟`;
    case "digitSum":
      switch (q.variant) {
        case "min":
          return `گام اول: ببین مجموع ${fa(q.sum)} دست‌کم چند رقم لازم دارد؛ هر رقم حداکثر ۹ است.`;
        case "min4":
          return "گام اول: رقم اول را تا جای ممکن کوچک بگیر (اما نه صفر)؛ بقیه را تا جای ممکن در رقم‌های آخر بگذار.";
        case "max4distinct":
          return "گام اول: از چپ، رقم اول را تا جای ممکن بزرگ بگیر، طوری که با سه رقم متفاوتِ دیگر جمع هنوز درست دربیاید.";
        case "minDistinct":
          return `گام اول: ببین مجموع ${fa(q.sum)} با رقم‌های متفاوت دست‌کم چند رقم لازم دارد.`;
      }
      break;
    case "divisible":
      return `گام اول: قاعده‌ی بخش‌پذیری بر ${fa(q.divisor)} را بنویس و ببین رقم‌های معلوم عدد با آن چه می‌گویند؛ □ چه چیزی باید کم یا زیاد کند؟`;
    case "match": {
      const eq = readEquation(q.lens, q.start);
      return eq
        ? `گام اول: الان ${ltr(`${fa(eq.a)} ${eq.sign} ${fa(eq.b)}`)} برابر ${fa(eq.value)} است، نه ${fa(eq.c)}. کدام رقم با یک چوب کمتر یا بیشتر، رقم دیگری می‌شود؟`
        : "گام اول: هر شکل را بخوان؛ کدام رقم با یک چوب کمتر یا بیشتر، رقم دیگری می‌شود؟";
    }
    case "lcm": {
      const big = Math.max(...q.nums);
      const others = q.nums.filter((x) => x !== big);
      return q.ask === "lcm" || q.ask === "clock"
        ? `گام اول: مضرب‌های ${fa(big)} را به ترتیب بنویس و هر کدام را ببین که بر ${list(others.length ? others : [big])} بخش‌پذیر است یا نه.`
        : `گام اول: شمارنده‌های ${fa(Math.min(...q.nums))} را بنویس و ببین کدام‌ها ${list(q.nums.filter((x) => x !== Math.min(...q.nums)))} را هم می‌شمارند.`;
    }
    case "crypt":
      return q.sum.length > Math.max(q.top.length, q.bottom.length)
        ? "گام اول: حاصل یک رقم بیشتر از عددها دارد؛ رقم اولش فقط از ده‌برِ ستون آخر می‌آید. جمع دو رقم با ده‌بر حداکثر چند است؟"
        : q.sum[q.sum.length - 1] >= LETTER && q.top[q.top.length - 1] < LETTER && q.bottom[q.bottom.length - 1] < LETTER
          ? "گام اول: در ستون یکان دو رقم معلوم‌اند؛ جمعشان حرف یکان حاصل را معلوم می‌کند."
          : "گام اول: از ستون یکان شروع کن و ستونی را پیدا کن که فقط یک حرف ناشناخته دارد.";
    case "signs":
      return `گام اول: یک علامت را امتحان کن و حاصل را با ${fa(q.target)} مقایسه کن: خیلی بزرگ است یا خیلی کوچک؟${q.paren ? " اول داخل پرانتز را ببین." : ""}`;
    case "pages":
      switch (q.ask) {
        case "digits":
          return "گام اول: صفحه‌های ۱ تا ۹ را جدا کن؛ هر کدام یک رقم دارند.";
        case "pages":
          return `گام اول: صفحه‌های ۱ تا ۹ روی هم ۹ رقم دارند؛ آن را از ${fa(q.digits)} رقم کم کن و ببین با رقم‌های باقی‌مانده چند صفحه‌ی دورقمی می‌شود.`;
        case "ones":
          return "گام اول: اول فقط رقم ۱ در جای یکان را بشمار، بعد در دهگان و صدگان.";
      }
      break;
    case "units":
      if (q.kind === "product") return `گام اول: از ${list(q.factors)} فقط رقم یکان هر کدام را نگه دار و آن‌ها را یکی‌یکی در هم ضرب کن.`;
      return `گام اول: رقم یکان توان‌های پشت‌سرهم ${fa(q.powers[0][0])} را بنویس تا به تکرار برسی.`;
    case "prime":
      switch (q.ask) {
        case "isPrime":
          return `گام اول: ${fa(q.n)} را بر ۲، ۳، ۵، ۷ و عددهای اول بعدی امتحان کن.`;
        case "count":
        case "sum":
          return `گام اول: شمارنده‌های ${fa(q.n)} را جفت‌جفت بنویس: ۱ با خود ${fa(q.n)}، بعد ۲ اگر بخش‌پذیر باشد، و همین‌طور.`;
        case "smallest":
          return `گام اول: تعداد شمارنده = حاصل‌ضرب (توان + ۱)ها در تجزیه. ${fa(q.k)} را چطور می‌شود حاصل‌ضرب نوشت؟`;
        case "factor":
          return `گام اول: ${fa(q.n)} را بر کوچک‌ترین عدد اولی که آن را می‌شمارد تقسیم کن.`;
      }
      break;
    case "parity":
      switch (q.ask) {
        case "expr":
        case "rule":
          return "گام اول: کنار هر عدد بنویس زوج است یا فرد.";
        case "oddSum":
          return "گام اول: بشمار چند عدد فرد با هم جمع می‌شوند.";
        case "mixed":
        case "seq":
          return "گام اول: بشمار چند تا از عددها فردند.";
        case "handshake":
          return "گام اول: اگر شمارش همه را با هم جمع کنی، هر دست‌دادن (یا هر جاده) چند بار شمرده می‌شود؟";
        case "domino":
          return "گام اول: بشمار چند خانه باید پوشانده شود؛ هر دومینو دو خانه‌ی کنار هم را می‌پوشاند.";
        case "cups":
          return "گام اول: ببین هر حرکت تعداد لیوان‌های رو به بالا را چقدر کم یا زیاد می‌کند.";
        case "signs":
          return "گام اول: اگر همه‌ی علامت‌ها + باشند، حاصل زوج است یا فرد؟";
      }
      break;
  }
  return "گام اول: پرسش را دوباره بخوان و داده‌ها را بنویس.";
}

export const DIGITS_ADAPTER: ToolAdapter = {
  ...DIGITS_PRACTICE,
  version: "digits@1",
  grade: (type, level, seed, response) => (typeof response === "string" ? digitsMistake(make(type, level, seed), response) : "other"),
  hints: (type, level, seed) => [NUDGE[type as DigitsQuestionType], RULE[type as DigitsQuestionType], firstStep(type, level, seed)],
};

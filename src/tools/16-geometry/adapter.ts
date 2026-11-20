// Tool 16 in practice sessions: grading and three-step hints (the light
// data, types and tag words, is in practice.ts).
// The response is what the panel checks: a number (area, perimeter, angle,
// circle, composite, parallel), the chosen option's index for "classify"
// (0 acute, 1 right, 2 obtuse: the same three options for every seed), the
// band's pegs [[x, y], …] for "build", and the two pegs [[x, y], [x, y]] of
// the cut for "divide".

import { dimValue } from "@/generators/composite-area";
import {
  areaMethod,
  boxOf,
  checkBuild,
  checkCut,
  edgesOf,
  geometryMistake,
  isRectilinear,
  makeGeometryQuestion,
  squareCount,
  type GeometryQuestion,
  type GeometryQuestionType,
  type Level,
  type Pt,
} from "@/generators/geometry";
import { angleById } from "@/generators/parallel-angles";
import type { ToolAdapter } from "@/practice/adapter";
import { fa } from "@/tools/registry";
import { num } from "./frames";
import { GEOMETRY_PRACTICE } from "./practice";

const make = (type: string, level: number, seed: number) => makeGeometryQuestion(type as GeometryQuestionType, level as Level, seed);

const isPt = (p: unknown): p is Pt => Array.isArray(p) && p.length === 2 && p.every((v) => Number.isInteger(v));
const isPts = (v: unknown): v is Pt[] => Array.isArray(v) && v.every(isPt);

function grade(type: string, level: number, seed: number, response: unknown): string {
  const q = make(type, level, seed);
  if (q.type === "build") return isPts(response) ? checkBuild(q, response).tag : "other";
  if (q.type === "divide") return isPts(response) && response.length === 2 ? checkCut(q, response[0], response[1]).tag : "other";
  return typeof response === "number" && Number.isFinite(response) ? geometryMistake(q, response) : "other";
}

const NUDGE: Record<GeometryQuestionType, string> = {
  area: "مساحت یعنی چند مربع کوچک درون شکل جا می‌شود.",
  perimeter: "محیط یعنی طول دور شکل؛ دور تا دور برو.",
  angle: "اول ببین شکل چند گوشه دارد و کدام زاویه‌ها معلوم‌اند.",
  classify: "زاویه را با گوشه یک مربع شبکه مقایسه کن.",
  build: "اول اندازه‌های خواسته‌شده را با هم جور کن، بعد میخ‌ها را لمس کن.",
  divide: "دو قسمت باید هم‌اندازه باشند، نه لزوماً هم‌شکل.",
  circle: "ببین شعاع، قطر یا محیط داده شده و چه خواسته شده.",
  composite: "شکل را به تکه‌های ساده‌تر ببُر، یا تکه‌ای را از شکل بزرگ‌تر کم کن.",
  parallel: "خط‌های فلش‌دار موازی‌اند؛ زاویه‌ها از روی آن‌ها منتقل می‌شوند.",
};

const RULE: Record<GeometryQuestionType, string> = {
  area: "دو نیم‌مربع یک مربع کامل‌اند؛ مثلث نصف مستطیل دور خودش است.",
  perimeter: "طول همه ضلع‌ها را جمع کن؛ فاصله دو میخ کنار هم یک واحد است.",
  angle: "جمع زاویه‌های مثلث ۱۸۰ درجه است و هر ضلع بیشتر، یک مثلث (۱۸۰ درجه) به جمع اضافه می‌کند.",
  classify: "تند کوچک‌تر از قائمه است و باز بزرگ‌تر؛ نوع مثلث را بزرگ‌ترین زاویه‌اش تعیین می‌کند.",
  build: "مساحت مستطیل = طول × عرض، محیط = (طول + عرض) × ۲، مساحت مثلث = قاعده × ارتفاع ÷ ۲.",
  divide: "هر خط صافی که از مرکز مستطیل یا متوازی‌الاضلاع بگذرد آن را نصف می‌کند؛ میانه مثلث هم.",
  circle: "قطر دو برابر شعاع است؛ محیط = قطر × π و مساحت = شعاع × شعاع × π (عدد پی).",
  composite: "مساحت هر تکه را جدا حساب کن؛ تکه‌های جزء شکل جمع می‌شوند و جاهای خالی کم.",
  parallel: "زاویه‌های روبه‌رو برابرند، زاویه‌های کنار هم روی خط صاف با هم ۱۸۰ درجه‌اند و زاویه‌های هم‌جا یا Z بین دو خط موازی برابرند.",
};

const len = ([a, b]: [Pt, Pt]) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

/** The first step of this question, in words; `plain` when the step happens to say the answer. */
function firstStep(q: GeometryQuestion): string {
  const s = "گام اول: ";
  switch (q.type) {
    case "area": {
      const b = boxOf(q.poly);
      if (q.poly.length === 4 && isRectilinear(q.poly)) return `${s}یک ردیف شکل ${fa(b.w)} مربع دارد؛ چند ردیف این‌طوری هست؟`;
      if (areaMethod(q.poly) === "box") return `${s}مستطیل دور شکل را بکش: ${fa(b.w)} در ${fa(b.h)}. بعد تکه‌های گوشه را جدا کن.`;
      const { half } = squareCount(q.poly);
      return half.length ? `${s}نیم‌مربع‌ها را بشمار: ${fa(half.length)} تا هست. هر دو تا یک مربع کامل است.` : `${s}شکل را با یک خط به دو مستطیل ببُر و مربع‌های هر کدام را جدا بشمار.`;
    }
    case "perimeter": {
      const e = edgesOf(q.poly);
      return `${s}از یک گوشه شروع کن؛ شکل ${fa(e.length)} ضلع دارد و ضلع اول ${fa(len(e[0]))} واحد است.`;
    }
    case "angle": {
      const a = q.angles;
      const given = q.given.map((i) => fa(a[i]));
      switch (q.variant) {
        case "geo":
          return `${s}ببین زاویه از گوشه یک مربع شبکه بزرگ‌تر است یا کوچک‌تر، و قطر مربع کجای آن است.`;
        case "triangle":
          return `${s}دو زاویه معلوم را جمع کن: ${given.join(" + ")}.`;
        case "isosceles":
          return q.ask === 1 ? `${s}زاویه رأس را از ۱۸۰ کم کن؛ باقی‌مانده سهم دو زاویه پایه با هم است.` : `${s}دو زاویه پایه برابرند؛ اول آن دو را با هم جمع کن.`;
        case "exterior":
          return `${s}زاویه داخلی کنار «؟» با آن روی یک خط صاف است؛ اول آن زاویه داخلی را پیدا کن.`;
        case "polygon":
        case "regular":
          return `${s}این شکل ${fa(a.length)} ضلع دارد، پس از یک گوشه به ${fa(a.length - 2)} مثلث تقسیم می‌شود.`;
      }
      return `${s}زاویه‌های معلوم را پیدا کن.`;
    }
    case "classify":
      return q.level === 1 ? `${s}بازوهای زاویه را با ضلع‌های یک مربع شبکه مقایسه کن: خانه‌ها را افقی و عمودی بشمار.` : `${s}بزرگ‌ترین زاویه مثلث را پیدا کن؛ فقط همان نوع مثلث را تعیین می‌کند.`;
    case "build":
      switch (q.variant) {
        case "rectArea":
          return `${s}دو عدد پیدا کن که ضربشان ${num(q.area!)} شود: طول و عرض.`;
        case "rectPerim":
          return `${s}نصف محیط، یعنی ${fa(q.perimeter! / 2)}، جمع طول و عرض است.`;
        case "triArea":
          return `${s}قاعده × ارتفاع باید ${num(2 * q.area!)} شود؛ یک ضلع را روی خط شبکه بگذار.`;
        case "gridPerim":
          return `${s}مستطیلی با محیط ${fa(q.perimeter!)} بکش؛ بریدن یک گوشه‌اش محیط را عوض نمی‌کند.`;
        case "tiltSquare":
          return `${s}یک ضلع کج بکش، مثلاً چند خانه افقی و چند خانه عمودی، و سه ضلع دیگر را با همان پله‌ها بچرخان.`;
        case "areaPerim":
          return `${s}اول مستطیلی با محیط ${fa(q.perimeter!)} پیدا کن، بعد ببین مساحتش چقدر بیشتر از ${num(q.area!)} است.`;
      }
      return `${s}اندازه‌های خواسته‌شده را بخوان.`;
    case "divide":
      return q.level === 1
        ? `${s}مرکز مستطیل را پیدا کن: جایی که دو قطرش به هم می‌رسند.`
        : q.poly.length === 3
          ? `${s}وسط یکی از ضلع‌ها را پیدا کن.`
          : `${s}مرکز شکل را پیدا کن، یا مساحت کل را بشمار و نصفش را جدا کن.`;
    case "circle": {
      const given = q.given === "r" ? `شعاع ${num(q.givenValue)} است` : q.given === "d" ? `قطر ${num(q.givenValue)} است` : `محیط ${num(q.givenValue)} است`;
      const next = q.given === "C" ? "؛ آن را بر π (عدد پی) تقسیم کن تا قطر به دست بیاید." : q.given === "d" ? "؛ شعاع نصف آن است." : "؛ قطر دو برابر آن است.";
      return `${s}${given}${next}`;
    }
    case "composite": {
      const d = (n: string) => num(dimValue(q, n));
      switch (q.variant) {
        case "L":
          return `${s}شکل را با یک خط به دو مستطیل ببُر؛ طول ضلع‌های بی‌عدد را از ضلع‌های روبه‌رو پیدا کن.`;
        case "hole":
          return `${s}مساحت مستطیل بزرگ ${d("W")} در ${d("H")} را حساب کن؛ بعد قسمت سفید را کم کن.`;
        case "frame":
          return `${s}پهنای قاب از هر دو طرف کم می‌شود: داخل قاب ${d("W")} منهای دو تا ${d("t")} است.`;
        case "triCut":
          return `${s}مساحت مستطیل ${d("W")} در ${d("H")} را حساب کن؛ گوشه بریده مثلثی با ضلع‌های ${d("p")} و ${d("q")} است.`;
        case "rectSemi":
          return `${s}مستطیل ${d("W")} در ${d("H")} و نیم‌دایره را جدا حساب کن.`;
        default:
          return `${s}مساحت مربع با ضلع ${d("s")} را حساب کن؛ بعد تکه‌های دایره را جدا حساب کن.`;
      }
    }
    case "parallel": {
      const st = q.steps[0];
      if (st.fact === "helper") return `${s}از نقطه خم خطی موازی دو خط بکش تا زاویه خم دو تکه شود.`;
      const from = st.from.length ? angleById(q, st.from[0]).at : "";
      const target = st.to === q.ask ? "زاویه «؟»" : `زاویه‌ای در ${st.to ? angleById(q, st.to).at : ""}`;
      const how: Record<string, string> = {
        vertical: "روبه‌روی یک زاویه معلوم است",
        linear: "کنار یک زاویه معلوم روی خط صاف است",
        corresponding: "هم‌جای (متناظر) یک زاویه معلوم است",
        alternate: "با یک زاویه معلوم یک Z می‌سازد",
        triangle: "در مثلثی است که دو زاویه دیگرش را داری",
        parts: "از دو تکه ساخته شده",
        point: "با زاویه‌های دیگر دور یک نقطه است",
      };
      return `${s}${target} ${how[st.fact]}${from && st.fact !== "parts" ? ` (در ${from})` : ""}؛ از همین شروع کن.`;
    }
  }
}

/** Number tokens of a text, Persian digits and decimal sign. */
const tokens = (t: string): string[] => t.match(/[0-9۰-۹]+(?:[٫.][0-9۰-۹]+)?/g) ?? [];

/** Numeric answers that a hint must not print. */
export const geometryAnswerFa = (q: GeometryQuestion): string | null => (q.type === "build" || q.type === "divide" || q.type === "classify" ? null : num(q.answer));

function hints(type: string, level: number, seed: number): [string, string, string] {
  const t = type as GeometryQuestionType;
  const q = make(type, level, seed);
  const step = firstStep(q);
  const ans = geometryAnswerFa(q);
  // A given number can equal the answer (a 60-60-60 triangle); then the step goes without numbers.
  const safe = ans && tokens(step).includes(ans) ? `گام اول: اندازه‌های معلوم را روی شکل پیدا کن و ببین کدام قاعده آن‌ها را به «؟» می‌رساند.` : step;
  return [NUDGE[t], RULE[t], safe];
}

export const GEOMETRY_ADAPTER: ToolAdapter = {
  ...GEOMETRY_PRACTICE,
  version: "geometry@1",
  grade,
  hints,
};

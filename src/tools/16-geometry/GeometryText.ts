// Words for tool 16 that the panel and the worksheet share, and the practice
// adapter too: type and level names, the question, the working in a line or
// two, and the answer. Plain code (no React), so the server can import it.

import { cornerAngles, type BuildQuestion, type DivideQuestion, type GeometryQuestion, type GeometryQuestionType, type Level, type Pt } from "@/generators/geometry";
import { fa } from "@/tools/registry";
import { approxDeg, degFa, ltr, num, areaHow, perimeterHow } from "./frames";
import { measureAnswerFa, measureHow, measurePrompt } from "./MeasureText";
import { parallelHow, parallelPrompt } from "./ParallelText";

export const GEOMETRY_TYPE_LABEL: Record<GeometryQuestionType, string> = {
  area: "مساحت",
  perimeter: "محیط",
  angle: "اندازه زاویه",
  classify: "نوع زاویه",
  build: "ساختن شکل",
  divide: "دو نیمه کردن",
  circle: "دایره",
  composite: "مساحت ترکیبی",
  parallel: "خطوط موازی و زاویه",
};

/** What each level means, per type (the "new example" knobs). */
export const LEVEL_LABEL: Record<GeometryQuestionType, [string, string, string]> = {
  area: ["مستطیل", "مثلث و چندضلعی", "شکل کج"],
  perimeter: ["مستطیل", "شکل L و پله", "فرورفتگی"],
  angle: ["روی ژئوبرد", "مثلث", "چندضلعی"],
  classify: ["یک زاویه", "مثلث", "مثلث کج"],
  build: ["مستطیل", "مثلث و چندضلعی", "مربع کج یا L"],
  divide: ["مستطیل", "مثلث و ذوزنقه", "شکل کج"],
  circle: ["دایره کامل", "نیم و ربع دایره", "حلقه و از محیط"],
  composite: ["دو مستطیل", "منهای یک تکه", "با دایره"],
  parallel: ["یک مورب", "دو قدم", "خط شکسته و مثلث"],
};

/** Questions with lengths on a figure (π = 3.14) rather than on the geoboard. */
export const isMeasure = (t: GeometryQuestionType) => t === "circle" || t === "composite";

/** Choices for "classify": one angle (level 1) or a triangle by its largest angle. */
export const choicesOf = (level: Level, short = false) =>
  short ? (level === 1 ? ["تند", "قائمه", "باز"] : ["تندگوشه", "قائم‌الزاویه", "بازگوشه"]) : (level === 1 ? ["تند (کمتر از ۹۰°)", "قائمه (۹۰°)", "باز (بیشتر از ۹۰°)"] : ["تندگوشه (هر سه زاویه تند)", "قائم‌الزاویه (یک زاویه ۹۰°)", "بازگوشه (یک زاویه باز)"]);

export const POLY_NAME: Record<number, string> = { 3: "مثلث", 4: "چهارضلعی", 5: "پنج‌ضلعی", 6: "شش‌ضلعی", 8: "هشت‌ضلعی", 9: "نه‌ضلعی", 10: "ده‌ضلعی", 12: "دوازده‌ضلعی" };

const ANY = "هر شکلی که این شرط را داشته باشد درست است.";

export function geometryPrompt(q: GeometryQuestion, paper = false): string {
  switch (q.type) {
    case "circle":
    case "composite":
      return measurePrompt(q);
    case "parallel":
      return parallelPrompt(q);
    case "area":
      return "مساحت این شکل چند واحد مربع است؟ (هر مربع کوچک بین چهار میخ، یک واحد مربع است.)";
    case "perimeter":
      return "محیط این شکل چند واحد است؟ (فاصله دو میخ کنار هم یک واحد است.)";
    case "angle": {
      const a = q.angles;
      switch (q.variant) {
        case "geo":
          return "زاویه بین دو کش چند درجه است؟";
        case "triangle":
          return "در این مثلث دو زاویه معلوم است. زاویه «؟» چند درجه است؟";
        case "isosceles":
          return q.ask === 1
            ? `این مثلث متساوی‌الساقین است (دو ضلع خط‌دار برابرند) و زاویه رأس آن ${degFa(a[0])} است. هر زاویه پایه («؟») چند درجه است؟`
            : `این مثلث متساوی‌الساقین است (دو ضلع خط‌دار برابرند) و هر زاویه پایه ${degFa(a[1])} است. زاویه رأس («؟») چند درجه است؟`;
        case "exterior":
          return "یک ضلع مثلث ادامه داده شده (خط‌چین). زاویه بیرونی «؟» چند درجه است؟";
        case "polygon":
          return `در این ${POLY_NAME[a.length]} همه زاویه‌ها جز یکی معلوم‌اند. زاویه «؟» چند درجه است؟`;
        case "regular":
          return `در ${POLY_NAME[a.length]} منتظم همه ضلع‌ها و همه زاویه‌ها برابرند. هر زاویه داخلی آن چند درجه است؟`;
      }
      return "";
    }
    case "classify":
      return q.level === 1 ? "این زاویه از چه نوعی است؟" : "این مثلث از چه نوعی است؟";
    case "build": {
      const how = paper ? "روی نقطه‌ها بکش." : "میخ‌ها را به ترتیب لمس کن تا کش دورشان بپیچد.";
      const A = q.area === null ? "" : num(q.area);
      const P = q.perimeter === null ? "" : fa(q.perimeter);
      const ask: Record<BuildQuestion["variant"], string> = {
        rectArea: `یک مستطیل با مساحت ${A} واحد مربع بساز.`,
        rectPerim: `یک مستطیل با محیط ${P} واحد بساز.`,
        triArea: `یک مثلث با مساحت ${A} واحد مربع بساز.`,
        gridPerim: `شکلی بساز که مستطیل نباشد، ضلع‌هایش روی خطوط شبکه باشند و محیطش ${P} واحد باشد.`,
        tiltSquare: `یک مربع کج (ضلع‌هایش روی خطوط شبکه نباشند) با مساحت ${A} واحد مربع بساز.`,
        areaPerim: `شکلی با ضلع‌های روی خطوط شبکه بساز که مساحتش ${A} واحد مربع و محیطش ${P} واحد باشد.`,
      };
      return `${ask[q.variant]} ${how} ${ANY}`;
    }
    case "divide":
      return paper
        ? "با یک خط صاف از یک نقطه روی لبه شکل به نقطه دیگری روی لبه، شکل را به دو قسمت با مساحت برابر تقسیم کن. (چند راه دارد.)"
        : "با یک کش صاف، شکل را به دو قسمت با مساحت برابر تقسیم کن: دو میخ روی لبه شکل را لمس کن. چند راه درست هست و هر کدام پذیرفته می‌شود.";
  }
}

/** Steps of a slanted arm, in words: "۲ خانه افقی و ۱ خانه عمودی". */
const stepsFa = (u: Pt) => `${fa(Math.abs(u[0]))} خانه افقی و ${fa(Math.abs(u[1]))} خانه عمودی`;

/** The deciding angle of a classify question: degrees and its two arms. */
function classifyAngle(q: Extract<GeometryQuestion, { type: "classify" }>) {
  const v = q.poly[q.corner];
  const [p, r] = q.level === 1 ? [q.poly[0], q.poly[2]] : [q.poly[(q.corner + 2) % 3], q.poly[(q.corner + 1) % 3]];
  const u: Pt = [p[0] - v[0], p[1] - v[1]];
  const w: Pt = [r[0] - v[0], r[1] - v[1]];
  const deg = q.level === 1 ? (Math.atan2(Math.abs(u[0] * w[1] - u[1] * w[0]), u[0] * w[0] + u[1] * w[1]) * 180) / Math.PI : cornerAngles(q.poly)[q.corner].deg;
  return { deg, u, w };
}

/** The working, in a line or two. */
export function geometryHow(q: GeometryQuestion): string {
  switch (q.type) {
    case "circle":
    case "composite":
      return measureHow(q);
    case "parallel":
      return parallelHow(q);
    case "area":
      return areaHow(q.poly);
    case "perimeter":
      return perimeterHow(q.poly);
    case "angle": {
      const a = q.angles;
      const known = q.given.map((i) => fa(a[i]));
      switch (q.variant) {
        case "geo": {
          const k = q.answer / 45;
          return `گوشه هر مربع شبکه ۹۰° است و قطر مربع آن را نصف می‌کند (۴۵°). این زاویه ${fa(k)} تا ۴۵° است: ${ltr(`${fa(k)} × ۴۵ = ${fa(q.answer)}`)}.`;
        }
        case "triangle":
          return `جمع زاویه‌های مثلث ۱۸۰° است: ${ltr(`۱۸۰ − ${known.join(" − ")} = ${fa(q.answer)}`)}.`;
        case "isosceles":
          return q.ask === 1
            ? `دو زاویه پایه برابرند: ${ltr(`(۱۸۰ − ${fa(a[0])}) ÷ ۲ = ${fa(q.answer)}`)}.`
            : `دو زاویه پایه برابرند: ${ltr(`۱۸۰ − ۲ × ${fa(a[1])} = ${fa(q.answer)}`)}.`;
        case "exterior":
          return `زاویه بیرونی با زاویه داخلی کنارش ۱۸۰° می‌شود، پس برابر جمع دو زاویه دیگر است: ${ltr(`${fa(a[0])} + ${fa(a[1])} = ${fa(q.answer)}`)}.`;
        case "polygon": {
          const n = a.length;
          return `${POLY_NAME[n]} به ${fa(n - 2)} مثلث تقسیم می‌شود، پس جمع زاویه‌ها ${ltr(`(${fa(n)} − ۲) × ۱۸۰ = ${fa((n - 2) * 180)}`)} است: ${ltr(`${fa((n - 2) * 180)} − ${known.join(" − ")} = ${fa(q.answer)}`)}.`;
        }
        case "regular": {
          const n = a.length;
          return `جمع زاویه‌ها ${ltr(`(${fa(n)} − ۲) × ۱۸۰ = ${fa((n - 2) * 180)}`)} است و ${fa(n)} زاویه برابرند: ${ltr(`${fa((n - 2) * 180)} ÷ ${fa(n)} = ${fa(q.answer)}`)}.`;
        }
      }
      return "";
    }
    case "classify": {
      const { deg, u, w } = classifyAngle(q);
      const slanted = u[0] && u[1] && w[0] && w[1];
      const which = q.level === 1 ? "این زاویه" : "بزرگ‌ترین زاویه مثلث";
      if (q.answer === 1)
        return slanted
          ? `${which} قائمه است: یک بازو ${stepsFa(u)} می‌رود و دیگری ${stepsFa(w)}؛ همان پله است که یک‌چهارم دور چرخیده.`
          : `${which} قائمه است: بازوهایش روی خطوط شبکه، مثل گوشه یک مربع.`;
      const kind = q.answer === 0 ? "کمتر از ۹۰°، پس تند" : "بیشتر از ۹۰°، پس باز";
      return `${which} ${approxDeg(deg)} است: ${kind}.`;
    }
    case "build":
      return buildHow(q);
    case "divide":
      return divideHow(q);
  }
}

export function buildHow(q: BuildQuestion) {
  const e = q.example;
  const xs = e.map((p) => p[0]);
  const ys = e.map((p) => p[1]);
  const [w, h] = [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
  switch (q.variant) {
    case "rectArea":
      return `مثلاً مستطیل ${ltr(`${fa(w)} × ${fa(h)} = ${num(q.area!)}`)}؛ هر دو ضلعی که ضربشان ${num(q.area!)} شود درست است.`;
    case "rectPerim":
      return `مثلاً مستطیل ${fa(w)} در ${fa(h)}: ${ltr(`(${fa(w)} + ${fa(h)}) × ۲ = ${fa(q.perimeter!)}`)}؛ هر دو ضلعی که جمعشان ${fa(q.perimeter! / 2)} شود درست است.`;
    case "triArea":
      return `مساحت مثلث = قاعده × ارتفاع ÷ ۲. مثلاً ${ltr(`${fa(w)} × ${fa(h)} ÷ ۲ = ${num(q.area!)}`)}؛ رأس سوم را روی همان ردیف هر جا ببری مساحت عوض نمی‌شود.`;
    case "gridPerim":
      return `بریدن یک گوشه از مستطیل ${fa(w)} در ${fa(h)} محیط را عوض نمی‌کند: ${ltr(`(${fa(w)} + ${fa(h)}) × ۲ = ${fa(q.perimeter!)}`)}.`;
    case "tiltSquare": {
      const [p0, p1] = [e[0], e[1]];
      const [a, b] = [Math.abs(p1[0] - p0[0]), Math.abs(p1[1] - p0[1])];
      return `مثلاً ضلعی که ${fa(a)} خانه افقی و ${fa(b)} خانه عمودی برود: مستطیل دور ${ltr(`${fa(a + b)} × ${fa(a + b)} = ${fa((a + b) ** 2)}`)} منهای چهار مثلث ${ltr(`${fa(a)} × ${fa(b)} ÷ ۲`)}: ${ltr(`${fa((a + b) ** 2)} − ${fa(2 * a * b)} = ${num(q.area!)}`)}.`;
    }
    case "areaPerim":
      return `مثلاً از مستطیل ${fa(w)} در ${fa(h)} (محیط ${fa(q.perimeter!)}) یک گوشه ببُر تا مساحت ${num(q.area!)} شود؛ بریدن گوشه محیط را عوض نمی‌کند.`;
  }
}

export function divideHow(q: DivideQuestion) {
  const n = q.poly.length;
  const tip =
    q.level === 1
      ? "هر کش صافی که از مرکز مستطیل بگذرد آن را نصف می‌کند (مثلاً قطرها)."
      : n === 3
        ? "کش از یک رأس به وسط ضلع روبه‌رو (میانه) مثلث را نصف می‌کند: قاعده‌ها برابر و ارتفاع یکی است."
        : "کشی که از مرکز شکل (محل برخورد قطرها در متوازی‌الاضلاع) بگذرد، یا مساحت را حساب کن و نصفش را جدا کن.";
  return `${tip} روی این ژئوبرد ${fa(q.ways)} کش درست هست.`;
}

/** The answer, in words. */
export function answerFa(q: GeometryQuestion): string {
  switch (q.type) {
    case "circle":
    case "composite":
      return measureAnswerFa(q);
    case "parallel":
      return degFa(q.answer);
    case "area":
      return `${num(q.answer)} واحد مربع`;
    case "perimeter":
      return `${fa(q.answer)} واحد`;
    case "angle":
      return degFa(q.answer);
    case "classify":
      return choicesOf(q.level)[q.answer];
    case "build":
      return "یک نمونه در شکل";
    case "divide":
      return `${fa(q.ways)} راه؛ یکی در شکل`;
  }
}

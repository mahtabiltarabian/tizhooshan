// Tool 15 in practice sessions: grading and three-step hints (the light
// data, types and tag words, is in practice.ts).
// The response is the number the panel checks: a turning direction (0
// clockwise, 1 anticlockwise), a compass direction (0 north … 3 west), the
// index of a labelled point (0 … 3), the index of a road in the question's
// four options, or a number.

import { TOWN_NAMES } from "@/generators/motion-map";
import { COMPASS, makeMotionQuestion, motionMistake, UNIT, type GridCmd, type Level, type Link, type MotionQuestionType, type TurnCmd } from "@/generators/motion";
import type { ToolAdapter } from "@/practice/adapter";
import { fa } from "@/tools/registry";
import { MOTION_PRACTICE } from "./practice";

// makeMotionQuestion hands its rng to the motion-map generator, as the page does.
const make = (type: string, level: number, seed: number) => makeMotionQuestion(type as MotionQuestionType, level as Level, seed);

const NUDGE: Record<MotionQuestionType, string> = {
  gearDir: "چرخ‌ها را یکی‌یکی از الف تا آخر دنبال کن.",
  gearTurns: "چرخ کوچک‌تر تندتر می‌چرخد و چرخ بزرگ‌تر کندتر.",
  trip: "مسافت، سرعت و زمان را جدا بنویس و ببین کدام را می‌خواهی.",
  chase: "ببین در هر ساعت (یا هر دقیقه) فاصله‌ی دو نفر چقدر عوض می‌شود.",
  orient: "خودت بایست و بچرخ، یا روی قطب‌نما چرخش‌ها را یکی‌یکی دنبال کن.",
  grid: "دستورها را یکی‌یکی روی شبکه دنبال کن؛ شمال بالاست و شرق سمت راست.",
  spacing: "یک شکل کوچک بکش و چیزها و فاصله‌ها را بشمار.",
  map: "راه‌های مختلف را امتحان کن، نه فقط اولین جاده‌ی کوتاه را.",
};

const RULE: Record<MotionQuestionType, string> = {
  gearDir: "دو چرخ‌دنده‌ی درگیر و تسمه‌ی ضربدری جهت را برعکس می‌کنند؛ تسمه‌ی ساده و محور مشترک جهت را نگه می‌دارند.",
  gearTurns: "دو چرخ کنار هم به یک اندازه دندانه (یا تسمه) جابه‌جا می‌کنند: دور × اندازه برای هر دو یکی است. چرخ‌های روی یک محور هم‌دورند.",
  trip: "مسافت = سرعت × زمان. وقتی به طرف هم می‌روند، در هر واحد زمان به اندازه‌ی جمع سرعت‌ها به هم نزدیک می‌شوند.",
  chase: "وقتی هم‌جهت می‌روند، در هر واحد زمان به اندازه‌ی تفاضل سرعت‌ها به هم نزدیک می‌شوند: زمان = فاصله ÷ تفاضل سرعت‌ها.",
  orient: "هر ربع دور به راست، یک خانه در جهت عقربه‌های ساعت است: شمال ← شرق ← جنوب ← غرب. چپ برعکس است و عقب‌گرد دو ربع.",
  grid: "در «جلو برو» جهتی که رو به آن هستی مهم است. برای شمردن راه‌ها: راه‌های هر چهارراه = جمع راه‌های دو چهارراه پیش از آن.",
  spacing: "در ردیفی که دو سرش پر است، چیزها یکی بیشتر از فاصله‌ها هستند؛ دور یک مسیر بسته، هم‌اندازه‌ی فاصله‌ها؛ برش‌ها یکی کمتر از تکه‌ها.",
  map: "طول یک راه = جمع جاده‌هایش. از شهر شروع، کوتاه‌ترین فاصله تا هر شهر را یکی‌یکی پیدا کن.",
};

const ROT = ["در جهت عقربه‌های ساعت", "خلاف جهت عقربه‌های ساعت"];
const LINK: Record<Link, string> = {
  mesh: "دندانه‌به‌دندانه درگیرند",
  belt: "با تسمه‌ی ساده به هم وصل‌اند",
  cross: "با تسمه‌ی ضربدری به هم وصل‌اند",
  axle: "روی یک محورند",
};
const THING: Record<string, string> = { tree: "درخت", post: "تیرک", lamp: "چراغ", flag: "پرچم" };
const side = (s: "R" | "L") => (s === "R" ? "راست" : "چپ");
const turnFa = (t: TurnCmd) => (t.quarter === 2 ? "عقب‌گرد" : `${t.quarter === 1 ? "یک ربع" : "سه ربع"} دور به ${side(t.side)}`);
const cmdFa = (c: GridCmd) => (c.kind === "go" ? `${fa(c.n)} خانه به ${COMPASS[c.dir]}` : c.kind === "fwd" ? `${fa(c.n)} خانه جلو` : `به ${side(c.side)} بچرخ`);

function firstStep(type: string, level: number, seed: number): string {
  const q = make(type, level, seed);
  switch (q.type) {
    case "gearDir":
      return `گام اول: الف ${ROT[q.driver]} می‌چرخد و الف و ب ${LINK[q.machine.links[0]]}. این اتصال جهت را برعکس می‌کند یا نگه می‌دارد؟`;
    case "gearTurns": {
      const w = q.machine.wheels[0];
      if (q.machine.links[0] === "axle") return "گام اول: الف و ب روی یک محورند، پس با هم می‌چرخند؛ از ب به بعد را حساب کن.";
      return w.kind === "gear"
        ? `گام اول: وقتی الف ${fa(q.turns)} دور می‌زند، ${fa(q.turns)} × ${fa(w.size)} دندانه از کنار چرخ بعدی می‌گذرد.`
        : `گام اول: وقتی الف ${fa(q.turns)} دور می‌زند، تسمه به اندازه‌ی ${fa(q.turns)} دورِ قرقره‌ای به قطر ${fa(w.size)} جابه‌جا می‌شود.`;
    }
    case "trip": {
      const u = UNIT[q.unit];
      if (q.level === 1) {
        if (q.ask === "time") return `گام اول: در هر ${u.time} ${fa(q.v1)} ${u.dist} می‌رود؛ ${fa(q.length)} چند تا ${fa(q.v1)} است؟`;
        if (q.ask === "dist") return `گام اول: در هر ${u.time} ${fa(q.v1)} ${u.dist} می‌رود؛ این را برای ${fa(q.time)} ${u.time} تکرار کن.`;
        return `گام اول: ${fa(q.length)} ${u.dist} را به ${fa(q.time)} قسمت برابر تقسیم کن: هر ${u.time} یک قسمت.`;
      }
      if (q.level === 2) return `گام اول: در هر ${u.time}، دو نفر روی هم ${fa(q.v1)} + ${fa(q.v2)} ${u.dist} به هم نزدیک می‌شوند.`;
      return `گام اول: در ${fa(q.delay)} ${u.time} اول فقط الف راه می‌رود؛ حساب کن در این مدت چقدر می‌رود و چقدر از مسیر می‌ماند.`;
    }
    case "chase": {
      const u = UNIT[q.unit];
      if (q.level === 2) return `گام اول: در ${fa(q.delay)} ${u.time} که ب زودتر راه افتاد، ${fa(q.v2)} × ${fa(q.delay)} ${u.dist} جلو افتاد.`;
      return `گام اول: در هر ${u.time}، الف ${fa(q.v1)} − ${fa(q.v2)} ${u.dist} به ب نزدیک${q.level === 3 ? "، و پس از رسیدن از او دور" : ""} می‌شود.`;
    }
    case "orient":
      return `گام اول: رو به ${COMPASS[q.start]} هستی؛ بعد از چرخش اول (${turnFa(q.turns[0])}) رو به کدام جهت می‌شوی؟`;
    case "grid":
      if (q.variant === "routes") return "گام اول: به هر چهارراهِ لبه‌ی پایین و لبه‌ی چپ فقط یک راه می‌رسد؛ کنار هر کدام ۱ بنویس.";
      return `گام اول: از «شروع»${q.variant === "turtle" ? ` رو به ${COMPASS[q.facing]}` : ""}، دستور اول را برو: ${cmdFa(q.cmds[0])}.`;
    case "spacing": {
      const t = THING[q.thing] ?? "چیز";
      switch (q.variant) {
        case "row":
          return `گام اول: یک ردیف کوچک با چند ${t} بکش و فاصله‌ها را بشمار: فاصله‌ها از ${t}ها کمترند یا بیشتر؟`;
        case "loop":
          return `گام اول: دور مسیر بسته را بکش؛ وقتی دور تمام می‌شود، به ${t} اول برمی‌گردی. ${t}ها و فاصله‌ها را مقایسه کن.`;
        case "rect":
          return `گام اول: دور زمین را یکسره بشمار، نه ضلع به ضلع؛ ${t}های گوشه را فقط یک بار بشمار.`;
        case "ends":
          return "گام اول: دو سر دیوار خالی است؛ اول ببین طول دیوار چند فاصله‌ی برابر دارد.";
        case "sides":
          return "گام اول: اول فقط یک طرف جاده را حساب کن.";
        case "cut":
          return "گام اول: یک چوب بکش و چند برش بزن؛ برش‌ها و تکه‌ها را بشمار و با هم مقایسه کن.";
        case "floors":
          return `گام اول: از طبقه‌ی اول تا طبقه‌ی ${fa(q.count)} چند راه‌پله باید بالا رفت؟`;
      }
      break;
    }
    case "map": {
      const [A, B] = [TOWN_NAMES[q.from], TOWN_NAMES[q.to]];
      switch (q.variant) {
        case "short":
          return `گام اول: از ${A} شروع کن و کوتاه‌ترین فاصله تا هر شهرِ همسایه‌اش را کنار آن شهر بنویس.`;
        case "close":
          return `گام اول: اول بهترین راه از ${A} تا ${B} را پیدا کن؛ کدام جاده‌ها روی این راه‌اند؟`;
        case "via":
          return `گام اول: راه را دو تکه کن: کوتاه‌ترین راه از ${A} تا ${TOWN_NAMES[q.via]}، و از ${TOWN_NAMES[q.via]} تا ${B}.`;
        case "tour":
          return `گام اول: ترتیب‌های مختلف سر زدن به شهرها را بنویس؛ فراموش نکن آخر کار به ${A} برگردی.`;
        case "connect":
          return "گام اول: جاده‌ها را از کوتاه به بلند مرتب کن و از کوتاه‌ترین شروع کن؛ جاده‌ای که دور بسته می‌سازد لازم نیست.";
      }
    }
  }
  return "گام اول: داده‌های پرسش را روی صفحه پیدا کن.";
}

export const MOTION_ADAPTER: ToolAdapter = {
  ...MOTION_PRACTICE,
  version: "motion@1",
  grade: (type, level, seed, response) => (typeof response === "number" && Number.isFinite(response) ? motionMistake(make(type, level, seed), response) : "other"),
  hints: (type, level, seed) => [NUDGE[type as MotionQuestionType], RULE[type as MotionQuestionType], firstStep(type, level, seed)],
};

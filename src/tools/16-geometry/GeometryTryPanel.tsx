"use client";

import { useState } from "react";
import {
  answerKind,
  checkBuild,
  checkCut,
  cornerAngles,
  geometryMistake,
  type BuildQuestion,
  type DivideQuestion,
  type GeometryQuestion,
  type GeometryQuestionType,
  type Level,
  type Pt,
} from "@/generators/geometry";
import { NumberPad } from "@/toolkit/NumberPad";
import { fa } from "@/tools/registry";
import { approxDeg, areaHow, degFa, ltr, num, perimeterHow } from "./frames";
import { DecimalPad } from "./MeasurePictures";
import { measureAnswerFa, measureHow, measurePrompt, measureSlipText } from "./MeasureText";
import { parallelHow, parallelPrompt, parallelSlipText } from "./ParallelText";
import styles from "@/toolkit/TryPanel.module.css";

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

const POLY_NAME: Record<number, string> = { 3: "مثلث", 4: "چهارضلعی", 5: "پنج‌ضلعی", 6: "شش‌ضلعی", 8: "هشت‌ضلعی", 9: "نه‌ضلعی", 10: "ده‌ضلعی", 12: "دوازده‌ضلعی" };

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

function buildHow(q: BuildQuestion) {
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

function divideHow(q: DivideQuestion) {
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

type Tone = "good" | "turned" | "bad";
const ICON: Record<Tone, string> = { good: "✓", turned: "↻", bad: "✗" };

function numberFeedback(q: GeometryQuestion, v: number): { tone: Tone; text: string } {
  const how = geometryHow(q);
  const right = `جواب ${answerFa(q)} است. ${how}`;
  const t = (text: string) => ({ tone: "turned" as Tone, text: `${text} ${right}` });
  const a = q.type === "angle" ? q.angles : [];
  if (q.type === "circle" || q.type === "composite") {
    const tag = geometryMistake(q, v);
    if (tag === "right") return { tone: "good", text: `درست است! ${how}` };
    if (tag === "other") return { tone: "bad", text: right };
    return t(measureSlipText(q, tag as Parameters<typeof measureSlipText>[1]));
  }
  if (q.type === "parallel") {
    const tag = geometryMistake(q, v);
    if (tag === "right") return { tone: "good", text: `درست است! ${how}` };
    if (tag === "other") return { tone: "bad", text: right };
    return t(parallelSlipText(q, tag as Parameters<typeof parallelSlipText>[1]));
  }
  switch (geometryMistake(q, v)) {
    case "right":
      return { tone: "good", text: `درست است! ${how}` };
    case "perimeter":
      return t("این محیط شکل است، نه مساحت. مساحت یعنی چند مربع درون شکل جا می‌شود.");
    case "halfAsWhole":
      return t("نیم‌مربع‌ها را کامل شمردی. هر دو نیم‌مربع با هم یک مربع می‌شوند.");
    case "noHalves":
      return t("نیم‌مربع‌ها را جا انداختی؛ هر دو تا با هم یک مربع کامل است.");
    case "noHalf":
      return q.type === "angle"
        ? t(q.ask === 1 ? "باقی‌مانده بین دو زاویه پایه تقسیم می‌شود؛ ÷ ۲ یادت رفت." : "دو زاویه پایه داریم، نه یکی؛ هر دو را از ۱۸۰ کم کن.")
        : t(q.type === "area" && q.poly.length === 3 ? "مساحت مثلث نصف مستطیل دورش است؛ «÷ ۲» یادت رفت." : "هر تکه گوشه یک مثلث است، یعنی نصف یک مستطیل؛ «÷ ۲» یادت رفت.");
    case "box":
      return q.type === "perimeter" ? t("دو ضلع داخل فرورفتگی را جا انداختی؛ آن‌ها هم جزء دور شکل‌اند.") : t("این مساحت مستطیل دور شکل است؛ تکه‌های گوشه را باید از آن کم کنی.");
    case "dots":
      return q.type === "area" ? t("میخ‌ها را شمردی، نه مربع‌ها. مساحت را با مربع‌های بین میخ‌ها می‌شمارند.") : t("میخ‌ها را شمردی و گوشه‌ها دو بار شمرده شدند. فاصله‌های بین میخ‌ها را بشمار، نه خود میخ‌ها را.");
    case "area":
      return t("این مساحت شکل است، نه محیط. محیط یعنی طول دور شکل.");
    case "cells":
      return t("مربع‌های کنار لبه را شمردی؛ مربع گوشه دو ضلع روی لبه دارد ولی یک بار شمرده شد. ضلع‌ها را بشمار.");
    case "halfP":
      return t("فقط نیمی از دور شکل را شمردی؛ همه ضلع‌ها را دور تا دور جمع کن.");
    case "supplement":
      return t(`این زاویه کنار آن روی خط صاف است: ${ltr(`۱۸۰ − ${fa(q.answer)} = ${fa(v)}`)}. خوب نگاه کن کدام زاویه بین دو کش است.`);
    case "reflex":
      return t("این زاویه بیرونی و بزرگ است؛ زاویه بین دو کش، قسمت کوچک‌تر است.");
    case "sum360":
      return t(q.type === "angle" && a.length > 4 ? `جمع زاویه‌های ${POLY_NAME[a.length]} ۳۶۰° نیست.` : "جمع زاویه‌های مثلث ۱۸۰° است، نه ۳۶۰°.");
    case "noSubtract":
      return t("دو زاویه معلوم را جمع کردی؛ حالا جمعشان را از ۱۸۰ کم کن.");
    case "interior":
      return t("این زاویه داخلی گوشه سوم است. زاویه بیرونی کنار آن است: با هم ۱۸۰°.");
    case "nTimes180":
      return t(`جمع زاویه‌ها ${ltr(`${fa(a.length)} × ۱۸۰`)} نیست: هر ${POLY_NAME[a.length] ?? "چندضلعی"} به ${fa(a.length - 2)} مثلث تقسیم می‌شود.`);
    case "total":
      return t(q.type === "angle" && q.variant === "regular" ? `این جمع همه زاویه‌هاست؛ بین ${fa(a.length)} زاویه برابر تقسیمش کن.` : "این جمع همه زاویه‌هاست؛ زاویه‌های معلوم را از آن کم کن.");
    case "exterior":
      return t(`این زاویه بیرونی است (${ltr(`۳۶۰ ÷ ${fa(a.length)}`)})؛ زاویه داخلی با آن ۱۸۰° می‌شود.`);
    case "slantRight":
      return t("زاویه قائمه می‌تواند کج باشد!");
    case "nearRight":
      return t("نزدیک ۹۰° است ولی دقیقاً نه. با گوشه یک مربع شبکه مقایسه کن.");
    case "smallAngle":
      return t("هر مثلثی دست‌کم دو زاویه تند دارد؛ نوع مثلث را بزرگ‌ترین زاویه‌اش تعیین می‌کند.");
    case "swap":
      return t("تند یعنی کمتر از ۹۰° و باز یعنی بیشتر از ۹۰°.");
    default:
      return { tone: "bad", text: right };
  }
}

function buildFeedback(q: BuildQuestion, band: Pt[]): { tone: Tone; text: string } {
  const r = checkBuild(q, band);
  const stats = r.tag === "few" || r.tag === "crossing" ? "" : ` شکل تو: مساحت ${num(r.area)}${r.perimeter === null ? "، با ضلع کج" : `، محیط ${fa(r.perimeter)}`}.`;
  const t = (text: string) => ({ tone: "turned" as Tone, text: `${text}${stats} ${buildHow(q)}` });
  switch (r.tag) {
    case "right":
      return { tone: "good", text: `درست است!${stats} شکل‌های دیگری هم درست‌اند؛ هر شکلی با این شرط پذیرفته می‌شود. ${buildHow(q)}` };
    case "few":
      return { tone: "bad", text: "کش دست‌کم باید دور سه میخ بپیچد." };
    case "crossing":
      return { tone: "bad", text: "کش از روی خودش رد شده یا همه میخ‌ها روی یک خط‌اند؛ این شکل نیست. میخ‌ها را به ترتیب دور شکل لمس کن." };
    case "notRect":
      return t("این مستطیل نیست: مستطیل چهار گوشه قائمه و ضلع‌های روی خطوط شبکه دارد.");
    case "notTri":
      return t(`این مثلث نیست؛ شکل تو ${fa(band.length)} گوشه دارد.`);
    case "notSquare":
      return t("این مربع نیست: هر چهار ضلع باید هم‌اندازه و گوشه‌ها قائمه باشند.");
    case "notSlanted":
      return t("مربع درستی است ولی صاف است؛ مربعی بساز که ضلع‌هایش کج باشند.");
    case "notGrid":
      return t("یک ضلع کج است؛ همه ضلع‌ها باید روی خطوط شبکه باشند تا محیط را بشود شمرد.");
    case "isRect":
      return t("محیطش درست است ولی مستطیل است؛ شکل دیگری بساز، مثلاً یک گوشه را تو ببر.");
    case "confused":
      return t("مساحت و محیط جابه‌جا شدند.");
    case "noHalf":
      return t("مساحت این مثلث دو برابر خواسته است: یادت باشد «قاعده × ارتفاع ÷ ۲».");
    case "areaOnly":
      return t("مساحت درست است ولی محیط نه.");
    case "perimOnly":
      return t("محیط درست است ولی مساحت نه.");
    default:
      return t("هنوز به عدد خواسته‌شده نرسیده.");
  }
}

function cutFeedback(q: DivideQuestion, band: Pt[]): { tone: Tone; text: string } {
  const r = checkCut(q, band[0], band[1]);
  switch (r.tag) {
    case "right":
      return { tone: "good", text: `درست است! هر قسمت ${num(r.parts![0])} واحد مربع. ${divideHow(q)} هر کدام پذیرفته می‌شود.` };
    case "few":
      return { tone: "bad", text: "دو میخ مختلف لازم است." };
    case "notEdge":
      return { tone: "bad", text: `هر دو سر کش باید روی لبه شکل باشند. ${divideHow(q)}` };
    case "alongEdge":
      return { tone: "bad", text: `کش روی لبه شکل افتاده؛ باید از درون شکل رد شود. ${divideHow(q)}` };
    default:
      return { tone: "turned", text: `دو قسمت ${num(r.parts![0])} و ${num(r.parts![1])} واحد مربع‌اند؛ برابر نیستند. ${divideHow(q)}` };
  }
}

interface Props {
  question: GeometryQuestion;
  type: GeometryQuestionType;
  level: Level;
  checked: number | null;
  onCheck: (v: number) => void;
  /** Mock exam: record the answer, show nothing about it. */
  exam?: boolean;
  /** Build: pegs of the band so far. Divide: the chosen pegs. */
  band: Pt[];
  onUndo: () => void;
  onClear: () => void;
  onType: (t: GeometryQuestionType) => void;
  onLevel: (l: Level) => void;
  onNew: () => void;
}

export function GeometryTryPanel(p: Props) {
  const { question: q, checked } = p;
  const kind = answerKind(q.type);
  const decimal = isMeasure(q.type);
  const [num0, setNum] = useState(kind === "number" && checked !== null ? String(decimal ? checked : Math.floor(checked)) : "");
  const [half, setHalf] = useState(kind === "number" && checked !== null && checked % 1 !== 0);
  const [choice, setChoice] = useState<number | null>(kind === "choice" ? checked : null);
  const done = checked !== null;

  // In a mock exam nothing tells right from wrong until the end.
  const shown = done && !p.exam;
  let fb: { tone: Tone; text: string } | null = null;
  if (shown) {
    if (q.type === "build") fb = buildFeedback(q, p.band);
    else if (q.type === "divide") fb = p.band.length === 2 ? cutFeedback(q, p.band) : null;
    else fb = numberFeedback(q, checked);
  }

  const ready = kind === "number" ? (decimal ? num0 !== "" && num0 !== "0." : num0 !== "" || half) : kind === "choice" ? choice !== null : kind === "shape" ? p.band.length >= 3 : p.band.length === 2;
  const value = kind === "number" ? Number(num0 || 0) + (half ? 0.5 : 0) : kind === "choice" ? choice! : 0;

  return (
    <div className={styles.panel}>
      <div className={styles.types} role="radiogroup" aria-label="نوع پرسش" data-practice-hide>
        {(Object.keys(GEOMETRY_TYPE_LABEL) as GeometryQuestionType[]).map((t) => (
          <button key={t} role="radio" aria-checked={p.type === t} onClick={() => p.onType(t)}>
            {GEOMETRY_TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      <div className={styles.chips} role="radiogroup" aria-label="سطح" data-practice-hide>
        {([1, 2, 3] as Level[]).map((l) => (
          <button key={l} role="radio" aria-checked={p.level === l} onClick={() => p.onLevel(l)} style={{ fontSize: "0.8rem" }}>
            {fa(l)}. {LEVEL_LABEL[p.type][l - 1]}
          </button>
        ))}
      </div>

      <p className={styles.prompt}>{geometryPrompt(q)}</p>

      {kind === "number" && (
        <>
          {decimal ? <DecimalPad value={num0} onChange={setNum} disabled={done} /> : <NumberPad value={num0} onChange={setNum} disabled={done} />}
          {q.type === "area" && (
            <div className={styles.chips}>
              <button aria-pressed={half} onClick={() => setHalf(!half)} disabled={done}>
                {half ? "✓ " : ""}و نیم (½)
              </button>
            </div>
          )}
          {q.type === "area" && (num0 || half) && (
            <output className={styles.hint} aria-live="polite">
              جواب تو: {num(value)} واحد مربع
            </output>
          )}
        </>
      )}

      {kind === "choice" && (
        <ul className={styles.options} style={{ gridTemplateColumns: "1fr" }}>
          {choicesOf(q.level).map((label, i) => {
            const mark = shown ? (i === q.answer ? "good" : i === checked ? "bad" : null) : choice === i ? "turned" : null;
            return (
              <li key={i}>
                <button className={`${styles.option} ${mark ? styles[mark] : ""}`} onClick={() => setChoice(i)} disabled={done} aria-pressed={choice === i}>
                  <span className={styles.optionNum}>
                    {shown && i === q.answer ? "✓ " : shown && i === checked ? "✗ " : choice === i ? "● " : ""}
                    {label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {(kind === "shape" || kind === "cut") && (
        <>
          <p className={styles.hint}>
            {kind === "shape"
              ? `میخ‌های لمس‌شده: ${fa(p.band.length)}. برای برداشتن آخرین میخ دوباره لمسش کن؛ گوشه‌ها را می‌توانی بکشی و جابه‌جا کنی.`
              : `میخ‌های انتخاب‌شده: ${fa(p.band.length)} از ۲. میخ انتخاب‌شده را دوباره لمس کنی برداشته می‌شود.`}
          </p>
          {!done && (
            <div className={styles.chips}>
              <button onClick={p.onUndo} disabled={!p.band.length}>
                ↶ برداشتن آخرین میخ
              </button>
              <button onClick={p.onClear} disabled={!p.band.length}>
                پاک کردن کش
              </button>
            </div>
          )}
        </>
      )}

      {!done && (
        <button className={styles.secondary} disabled={!ready} onClick={() => p.onCheck(value)}>
          بررسی
        </button>
      )}

      {fb && (
        <p className={`${styles.feedback} ${styles[fb.tone]}`} role="status" aria-live="polite">
          <span className={styles.icon}>{ICON[fb.tone]}</span> {fb.text}
        </p>
      )}
      {shown && (q.type === "area" || q.type === "perimeter" || q.type === "parallel" || decimal) && <p className={styles.hint}>روی صفحه، {decimal || q.type === "parallel" ? "راه‌حل" : "شمارش"} قدم‌به‌قدم نشان داده می‌شود؛ با نوار پایین جلو و عقب ببر.</p>}
      {shown && (q.type === "build" || q.type === "divide") && fb?.tone !== "good" && <p className={styles.hint}>روی صفحه، کش تو نارنجی و پررنگ است و یک جواب درست سبز و خط‌چین.</p>}

      <button className={styles.next} onClick={p.onNew}>
        نمونه تازه
      </button>
    </div>
  );
}

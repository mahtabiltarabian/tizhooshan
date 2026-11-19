"use client";

import { useState } from "react";
import {
  answerKind,
  COMPASS,
  motionMistake,
  UNIT,
  walkGrid,
  wheelTurns,
  type GridCmd,
  type Level,
  type Machine,
  type MotionQuestion,
  type MotionQuestionType,
  type TurnCmd,
} from "@/generators/motion";
import { NumberPad } from "@/toolkit/NumberPad";
import { fa } from "@/tools/registry";
import { POINT_NAMES, ROT_ICON, ROT_WORD, WHEEL_NAMES } from "./Pictures";
import styles from "@/toolkit/TryPanel.module.css";

export const MOTION_TYPE_LABEL: Record<MotionQuestionType, string> = {
  gearDir: "جهت چرخش",
  gearTurns: "تعداد دور",
  trip: "سفر و به هم رسیدن",
  chase: "رسیدن و سبقت",
  orient: "جهت‌یابی",
  grid: "مسیر در شبکه",
};

/** Keeps an equation left to right inside a Persian sentence. */
export const ltr = (s: string) => `⁦${s}⁩`;

const COMPASS_ICON = ["↑", "→", "↓", "←"];
const wheelWord = (m: Machine, i: number) => (m.wheels[i].kind === "gear" ? "چرخ‌دنده" : "قرقره");
const sizeWord = (m: Machine, i: number) => (m.wheels[i].kind === "gear" ? `${fa(m.wheels[i].size)} دندانه` : `قطر ${fa(m.wheels[i].size)} سانتی‌متر`);

/** "الف و ب درگیرند؛ ب و پ با تسمه ضربدری..." for trains with belts. */
function linksFa(m: Machine) {
  return m.links
    .map((l, i) => {
      const [a, b] = [WHEEL_NAMES[i], WHEEL_NAMES[i + 1]];
      if (l === "mesh") return `${a} و ${b} دندانه‌به‌دندانه درگیرند`;
      if (l === "axle") return `${a} و ${b} روی یک محورند`;
      return `${a} و ${b} با تسمه ${l === "cross" ? "ضربدری" : "ساده"} به هم وصل‌اند`;
    })
    .join("؛ ");
}

export function turnFa(t: TurnCmd, degrees: boolean) {
  const side = t.side === "R" ? "راست" : "چپ";
  if (t.quarter === 2) return degrees ? "۱۸۰ درجه بچرخ (عقب‌گرد)" : "عقب‌گرد کن";
  if (!degrees) return `به ${side} بچرخ`;
  return `${fa(90 * t.quarter)} درجه به ${side} بچرخ`;
}

export function cmdFa(c: GridCmd) {
  if (c.kind === "go") return `${fa(c.n)} خانه به ${COMPASS[c.dir]}`;
  if (c.kind === "fwd") return `${fa(c.n)} خانه جلو`;
  return `به ${c.side === "R" ? "راست" : "چپ"} بچرخ`;
}

const noun = (unit: "km" | "m") => (unit === "km" ? "ماشین" : "دونده");

export function motionPrompt(q: MotionQuestion, paper = false): string {
  switch (q.type) {
    case "gearDir": {
      const m = q.machine;
      const last = m.wheels.length - 1;
      const train = q.level === 3 ? ` ${linksFa(m)}.` : "";
      return `${wheelWord(m, 0)} الف را ${ROT_WORD[q.driver]} می‌چرخانیم.${train} ${wheelWord(m, last)} ${WHEEL_NAMES[last]} (★) به کدام جهت می‌چرخد؟`;
    }
    case "gearTurns": {
      const m = q.machine;
      const last = m.wheels.length - 1;
      const middle = last === 2 ? ` ${wheelWord(m, 1)} وسط (ب) ${sizeWord(m, 1)} دارد.` : "";
      const belts = m.wheels[0].kind === "pulley" ? ` (${linksFa(m)})` : "";
      return `${wheelWord(m, 0)} الف ${m.wheels[0].kind === "gear" ? "" : "به "}${sizeWord(m, 0)}${m.wheels[0].kind === "gear" ? " دارد و" : ""} ${fa(q.turns)} دور می‌چرخد${belts}.${middle} ${wheelWord(m, last)} ${WHEEL_NAMES[last]} با ${sizeWord(m, last)} چند دور می‌چرخد؟`;
    }
    case "trip": {
      const u = UNIT[q.unit];
      const n = noun(q.unit);
      if (q.level === 1) {
        if (q.ask === "time") return `${n} الف با سرعت ${fa(q.v1)} ${u.speed} مسیری به طول ${fa(q.length)} ${u.dist} را می‌رود. چند ${u.time} طول می‌کشد؟`;
        if (q.ask === "dist") return `${n} الف با سرعت ${fa(q.v1)} ${u.speed}، ${fa(q.time)} ${u.time} راه می‌رود. چند ${u.dist} می‌رود؟`;
        return `${n} الف مسیری به طول ${fa(q.length)} ${u.dist} را در ${fa(q.time)} ${u.time} می‌رود. سرعتش چند ${u.speed} است؟`;
      }
      const setup = `دو سر مسیری به طول ${fa(q.length)} ${u.dist}، ${n} الف با سرعت ${fa(q.v1)} و ${n} ب با سرعت ${fa(q.v2)} ${u.speed} ایستاده‌اند.`;
      if (q.level === 2)
        return `${setup} هم‌زمان به طرف هم راه می‌افتند. ${q.ask === "time" ? `پس از چند ${u.time} به هم می‌رسند؟` : `در چند ${u.dist}ی شروع الف به هم می‌رسند؟`}`;
      return `${setup} الف راه می‌افتد و ب ${fa(q.delay)} ${u.time} بعد به طرف او راه می‌افتد. چند ${u.time} پس از حرکت الف به هم می‌رسند؟`;
    }
    case "chase": {
      const u = UNIT[q.unit];
      const n = noun(q.unit);
      const speeds = `الف با سرعت ${fa(q.v1)} و ب با سرعت ${fa(q.v2)} ${u.speed}`;
      if (q.level === 1) return `${n} ب ${fa(q.gap)} ${u.dist} جلوتر از ${n} الف است. هر دو هم‌زمان به یک طرف راه می‌افتند: ${speeds}. الف پس از چند ${u.time} به ب می‌رسد؟`;
      if (q.level === 2) return `${n} ب با سرعت ${fa(q.v2)} ${u.speed} راه می‌افتد. ${fa(q.delay)} ${u.time} بعد، ${n} الف از همان جا با سرعت ${fa(q.v1)} ${u.speed} دنبالش می‌رود. الف چند ${u.time} پس از حرکتش به ب می‌رسد؟`;
      return `${n} ب ${fa(q.gap)} ${u.dist} جلوتر از ${n} الف است. هر دو هم‌زمان به یک طرف راه می‌افتند: ${speeds}. چند ${u.time} طول می‌کشد تا الف سبقت بگیرد و ${fa(q.lead)} ${u.dist} جلوتر از ب باشد؟`;
    }
    case "orient":
      return `رو به ${COMPASS[q.start]} ایستاده‌ای. ${q.turns.map((t) => turnFa(t, q.level === 3)).join("، بعد ")}. حالا رو به کدام جهتی؟`;
    case "grid": {
      if (q.variant === "routes")
        return `از «الف» تا «ب» فقط از خیابان‌ها می‌رویم و هر بار یک خانه به شرق یا به شمال (کوتاه‌ترین راه). چند راه مختلف هست؟${paper ? "" : " (روی صفحه، الف پایین چپ و ب بالا راست است.)"}`;
      const moves = q.cmds.map(cmdFa).join("، ");
      if (q.variant === "walk") return `از «شروع» به ترتیب برو: ${moves}. به کدام نقطه می‌رسی؟`;
      return `در «شروع» رو به ${COMPASS[q.facing]} ایستاده‌ای. به ترتیب: ${moves}. به کدام نقطه می‌رسی؟`;
    }
  }
}

/** The working, in one line. */
export function motionHow(q: MotionQuestion): string {
  switch (q.type) {
    case "gearDir": {
      const m = q.machine;
      const t = wheelTurns(m);
      const dir = (i: number) => ((t[i] > 0) === (q.driver === 0) ? 0 : 1);
      if (q.level < 3)
        return `هر دو چرخ‌دنده درگیر برعکس هم می‌چرخند، پس جهت یکی در میان عوض می‌شود: ${m.wheels.map((_, i) => `${WHEEL_NAMES[i]} ${ROT_ICON[dir(i)]}`).join("، ")}.`;
      const steps = m.links.map((l, i) => `${WHEEL_NAMES[i + 1]} ${ROT_ICON[dir(i + 1)]} (${l === "mesh" ? "درگیر: برعکس" : l === "axle" ? "یک محور: همان" : l === "cross" ? "ضربدری: برعکس" : "تسمه ساده: همان"})`);
      return `دندانه درگیر و تسمه ضربدری جهت را برعکس می‌کنند؛ تسمه ساده و محور مشترک نه: الف ${ROT_ICON[q.driver]}، ${steps.join("، ")}.`;
    }
    case "gearTurns": {
      const m = q.machine;
      const a = m.wheels[0].size;
      const c = m.wheels[m.wheels.length - 1].size;
      const last = WHEEL_NAMES[m.wheels.length - 1];
      if (m.wheels[0].kind === "gear") {
        const mid = m.wheels.length > 2 ? " چرخ‌دنده وسط فقط جهت را عوض می‌کند؛ هر دندانه‌ای که از الف به آن می‌رسد، به بعدی هم می‌رسد." : "";
        return `از جای درگیری، در هر دو چرخ‌دنده به یک تعداد دندانه می‌گذرد: ${ltr(`${fa(q.turns)} × ${fa(a)} = ${fa(q.turns * a)}`)} دندانه.${mid} ${last}: ${ltr(`${fa(q.turns * a)} ÷ ${fa(c)} = ${fa(q.answer)}`)} دور.`;
      }
      return `از روی همه قرقره‌ها به یک اندازه تسمه می‌گذرد، پس دور × قطر برابر است (قرقره کوچک‌تر تندتر می‌چرخد): ${ltr(`${fa(q.turns)} × ${fa(a)} = ${fa(q.turns * a)}`)} و ${ltr(`${fa(q.turns * a)} ÷ ${fa(c)} = ${fa(q.answer)}`)} دور.`;
    }
    case "trip": {
      if (q.level === 1) {
        if (q.ask === "time") return `زمان = مسافت ÷ سرعت: ${ltr(`${fa(q.length)} ÷ ${fa(q.v1)} = ${fa(q.time)}`)}.`;
        if (q.ask === "dist") return `مسافت = سرعت × زمان: ${ltr(`${fa(q.v1)} × ${fa(q.time)} = ${fa(q.length)}`)}.`;
        return `سرعت = مسافت ÷ زمان: ${ltr(`${fa(q.length)} ÷ ${fa(q.time)} = ${fa(q.v1)}`)}.`;
      }
      const sum = q.v1 + q.v2;
      if (q.level === 2) {
        const t = `هر ${UNIT[q.unit].time}، فاصله‌شان ${ltr(`${fa(q.v1)} + ${fa(q.v2)} = ${fa(sum)}`)} کم می‌شود: ${ltr(`${fa(q.length)} ÷ ${fa(sum)} = ${fa(q.time)}`)} ${UNIT[q.unit].time}.`;
        return q.ask === "time" ? t : `${t} در این مدت الف می‌رود: ${ltr(`${fa(q.v1)} × ${fa(q.time)} = ${fa(q.answer)}`)}.`;
      }
      const alone = q.v1 * q.delay;
      const rest = q.length - alone;
      return `در ${fa(q.delay)} ${UNIT[q.unit].time} اول فقط الف می‌رود: ${ltr(`${fa(q.v1)} × ${fa(q.delay)} = ${fa(alone)}`)}؛ می‌ماند ${ltr(`${fa(q.length)} − ${fa(alone)} = ${fa(rest)}`)}. بعد با هم: ${ltr(`${fa(rest)} ÷ ${fa(sum)} = ${fa(q.time - q.delay)}`)}. روی هم: ${ltr(`${fa(q.delay)} + ${fa(q.time - q.delay)} = ${fa(q.answer)}`)}.`;
    }
    case "chase": {
      const dv = q.v1 - q.v2;
      const close = `هر ${UNIT[q.unit].time}، الف ${ltr(`${fa(q.v1)} − ${fa(q.v2)} = ${fa(dv)}`)} ${UNIT[q.unit].dist} نزدیک‌تر می‌شود`;
      if (q.level === 1) return `${close}: ${ltr(`${fa(q.gap)} ÷ ${fa(dv)} = ${fa(q.answer)}`)}.`;
      if (q.level === 2) return `وقتی الف راه می‌افتد، ب ${ltr(`${fa(q.v2)} × ${fa(q.delay)} = ${fa(q.gap)}`)} جلوتر است. ${close}: ${ltr(`${fa(q.gap)} ÷ ${fa(dv)} = ${fa(q.answer)}`)}.`;
      return `الف باید ${fa(q.gap)} عقب‌ماندگی را جبران کند و ${fa(q.lead)} هم جلو بزند. ${close}: ${ltr(`(${fa(q.gap)} + ${fa(q.lead)}) ÷ ${fa(dv)} = ${fa(q.answer)}`)}.`;
    }
    case "orient": {
      let f = q.start as number;
      const steps = q.turns.map((t) => {
        f = (((f + (t.side === "R" ? t.quarter : -t.quarter)) % 4) + 4) % 4;
        return `${turnFa(t, q.level === 3).replace(" بچرخ", "").replace(" کن", "")}: ${COMPASS[f]}`;
      });
      return `رو به ${COMPASS[q.start]}؛ ${steps.join("؛ ")}. (راست و چپ همیشه نسبت به رو به روی خودت است.)`;
    }
    case "grid": {
      if (q.variant === "routes")
        return `روی هر چهارراه بنویس چند راه به آن می‌رسد: لبه‌ها ۱، هر چهارراه دیگر = جمع چهارراه زیرش (جنوب) و چهارراه چپش (غرب). در «ب»: ${fa(q.answer)}.`;
      const { path } = walkGrid(q.start, q.facing, q.cmds);
      const end = path[path.length - 1];
      const dx = end.x - q.start.x;
      const dy = end.y - q.start.y;
      const parts = [dy ? `${fa(Math.abs(dy))} خانه ${dy > 0 ? "شمال" : "جنوب"}` : "", dx ? `${fa(Math.abs(dx))} خانه ${dx > 0 ? "شرق" : "غرب"}` : ""].filter(Boolean).join(" و ");
      if (q.variant === "walk") return `روی نقشه شمال بالا و شرق راست است. روی هم ${parts}ِ شروع: نقطه ${POINT_NAMES[q.answer]}.`;
      let f = q.facing as number;
      const steps = q.cmds.map((c) => {
        if (c.kind === "turn") {
          f = (f + (c.side === "R" ? 1 : 3)) % 4;
          return `${c.side === "R" ? "راست" : "چپ"} (رو به ${COMPASS[f]})`;
        }
        return `${fa(c.kind === "fwd" ? c.n : 0)} جلو`;
      });
      return `رو به ${COMPASS[q.facing]}: ${steps.join("، ")}. روی هم ${parts}ِ شروع: نقطه ${POINT_NAMES[q.answer]}.`;
    }
  }
}

/** The answer in words. */
export function answerFa(q: MotionQuestion, v = q.answer) {
  switch (answerKind(q)) {
    case "rot":
      return `${ROT_ICON[v]} ${ROT_WORD[v]}`;
    case "compass":
      return `${COMPASS_ICON[v]} ${COMPASS[v]}`;
    case "point":
      return `نقطه ${POINT_NAMES[v]}`;
    default:
      return `${fa(v)} ${unitOf(q)}`.trim();
  }
}

/** Unit of a number answer. */
export function unitOf(q: MotionQuestion) {
  if (q.type === "gearTurns") return "دور";
  if (q.type === "trip") return q.ask === "time" ? UNIT[q.unit].time : q.ask === "dist" ? UNIT[q.unit].dist : UNIT[q.unit].speed;
  if (q.type === "chase") return UNIT[q.unit].time;
  if (q.type === "grid") return "راه";
  return "";
}

type Tone = "good" | "turned" | "bad";
const ICON: Record<Tone, string> = { good: "✓", turned: "↻", bad: "✗" };

function feedback(q: MotionQuestion, v: number): { tone: Tone; text: string } {
  const how = motionHow(q);
  const right = `جواب ${answerFa(q)} است. ${how}`;
  const near = (s: string) => ({ tone: "turned" as Tone, text: `نزدیک بود! ${s} ${right}` });
  switch (motionMistake(q, v)) {
    case "right":
      return { tone: "good", text: `درست است! ${how}` };
    case "allSame":
      return { tone: "bad", text: `همه چرخ‌ها هم‌جهت نمی‌چرخند: دندانه‌های درگیر هم را هل می‌دهند و چرخ‌دنده بعدی را برعکس می‌چرخانند. ${right}` };
    case "alwaysOpposite":
      return near("فقط دو چرخ‌دنده کنار هم برعکس هم‌اند؛ در زنجیره جهت یکی در میان عوض می‌شود. چرخ‌دنده‌های اول، سوم، پنجم… هم‌جهت‌اند.");
    case "crossIgnored":
      return near("تسمه ضربدری جهت را برعکس می‌کند (تسمه ساده نه).");
    case "beltFlips":
      return near("تسمه ساده جهت را عوض نمی‌کند؛ فقط تسمه ضربدری و دندانه‌های درگیر برعکس می‌کنند.");
    case "inverted":
      return near("نسبت را برعکس گرفتی: چرخ کوچک‌تر بیشتر دور می‌زند، نه کمتر.");
    case "sameTurns":
      return { tone: "bad", text: `دو چرخ با اندازه‌های مختلف به یک اندازه دور نمی‌زنند؛ آنچه برابر است تعداد دندانه (یا طول تسمه)ای است که می‌گذرد. ${right}` };
    case "middleOnly":
      return near("این تعداد دور چرخ‌دنده وسط است. چرخ‌دنده وسط در تعداد دور آخری اثری ندارد؛ فقط اولی و آخری مهم‌اند.");
    case "timesInstead":
      return near("اینجا باید تقسیم کنی، نه ضرب.");
    case "divideInstead":
    case "plusInstead":
      return near("مسافت = سرعت × زمان.");
    case "subtractedSpeeds":
      return near("وقتی به طرف هم می‌آیند، هر دو فاصله را کم می‌کنند: سرعت‌ها جمع می‌شوند، نه تفریق.");
    case "oneSpeed":
      return near(q.type === "chase" ? "ب هم جلو می‌رود؛ فاصله فقط به اندازه اختلاف سرعت‌ها کم می‌شود." : "هر دو با هم راه می‌روند؛ فاصله با هر دو سرعت کم می‌شود.");
    case "half":
      return near("فقط وقتی سرعت‌ها برابرند وسط مسیر به هم می‌رسند؛ تندتر بیشتر می‌رود.");
    case "otherSide":
      return near("این فاصله از شروع ب است؛ پرسش از شروع الف بود.");
    case "noDelay":
      return near("ب دیرتر راه افتاد؛ اول الف تنهایی می‌رود.");
    case "fromLater":
    case "fromStart":
      return near(q.type === "trip" ? "این زمان از حرکت ب است؛ پرسش از حرکت الف بود." : "زمان را از حرکت ب شمردی؛ پرسش از حرکت الف بود.");
    case "addedSpeeds":
      return near("وقتی هم‌جهت می‌روند، فاصله با «اختلاف» سرعت‌ها کم می‌شود: تفریق کن، نه جمع.");
    case "gapOnly":
      return near(`این وقتی است که الف تازه به ب می‌رسد؛ برای سبقت باید ${q.type === "chase" ? fa(q.lead) : ""} هم جلو بزند.`);
    case "leadOnly":
      return near(`اول باید ${q.type === "chase" ? fa(q.gap) : ""} عقب‌ماندگی را جبران کند، بعد جلو بزند.`);
    case "swapped":
      return near("راست و چپ جابه‌جا شد. خودت را جای آدمک بگذار و رو به همان جهت بایست.");
    case "aroundSwap":
      return near("بعد از عقب‌گرد، راست و چپ تو هم با تو می‌چرخند: رو به جنوب، دست راستت به طرف غرب است، نه شرق.");
    case "threeQuarter":
      return near("۲۷۰ درجه سه ربع دور است؛ یعنی همان ۹۰ درجه به طرف دیگر.");
    case "fromNorth":
      return near(`از ${q.type === "orient" ? COMPASS[q.start] : ""} شروع کن، نه از شمال.`);
    case "eastWest":
      return near("شرق و غرب جابه‌جا شد: روی نقشه شرق سمت راست است.");
    case "northSouth":
      return near("شمال و جنوب جابه‌جا شد: روی نقشه شمال بالاست.");
    case "skipLast":
      return near("آخرین حرکت جا ماند.");
    case "noTurns":
      return near("چرخیدن‌ها را فراموش کردی: بعد از هر چرخش، «جلو» جهت تازه‌ای دارد.");
    case "edgesOnly":
      return { tone: "bad", text: `فقط دو راه کناری نیست؛ از وسط شبکه هم راه‌های زیادی هست. ${right}` };
    case "plusRoutes":
    case "timesRoutes":
      return { tone: "bad", text: `تعداد راه‌ها با جمع یا ضرب طول و عرض به دست نمی‌آید. ${right}` };
    default:
      return { tone: "bad", text: right };
  }
}

interface Props {
  question: MotionQuestion;
  type: MotionQuestionType;
  level: Level;
  checked: number | null;
  onCheck: (v: number) => void;
  onType: (t: MotionQuestionType) => void;
  onLevel: (l: Level) => void;
  onNew: () => void;
}

export function MotionTryPanel(p: Props) {
  const { question: q, checked } = p;
  const kind = answerKind(q);
  const [num, setNum] = useState(kind === "number" && checked !== null ? String(checked) : "");
  const [choice, setChoice] = useState<number | null>(kind !== "number" ? checked : null);
  const fb = checked !== null ? feedback(q, checked) : null;
  const done = checked !== null;
  const mark = (i: number) => (done && i === q.answer ? "✓ " : done && i === checked ? "✗ " : "");

  return (
    <div className={styles.panel}>
      <div className={styles.types} role="radiogroup" aria-label="نوع پرسش">
        {(Object.keys(MOTION_TYPE_LABEL) as MotionQuestionType[]).map((t) => (
          <button key={t} role="radio" aria-checked={p.type === t} onClick={() => p.onType(t)}>
            {MOTION_TYPE_LABEL[t]}
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

      <p className={styles.prompt}>{motionPrompt(q)}</p>

      {kind === "number" && (
        <>
          <NumberPad value={num} onChange={setNum} disabled={done} maxDigits={4} />
          <p className={styles.hint}>جواب به {unitOf(q)}</p>
        </>
      )}

      {kind === "rot" && (
        <div className={styles.chips} role="radiogroup" aria-label="جهت چرخش">
          {[0, 1].map((i) => (
            <button key={i} role="radio" aria-checked={choice === i} onClick={() => setChoice(i)} disabled={done} style={{ minHeight: 56, fontSize: "1rem" }}>
              {mark(i)}
              <span style={{ fontSize: "1.5rem", verticalAlign: "middle" }}>{ROT_ICON[i]}</span> {ROT_WORD[i]}
            </button>
          ))}
        </div>
      )}

      {kind === "compass" && (
        // A compass: north on top and west on the left, whatever the page direction.
        <div className={styles.types} role="radiogroup" aria-label="جهت" style={{ direction: "ltr", gridTemplateAreas: '". n ." "w . e" ". s ."' }}>
          {[0, 1, 2, 3].map((i) => (
            <button key={i} role="radio" aria-checked={choice === i} onClick={() => setChoice(i)} disabled={done} style={{ gridArea: "nesw"[i], minHeight: 48, fontSize: "0.95rem", direction: "rtl" }}>
              {mark(i)}
              <span style={{ fontSize: "1.2rem" }}>{COMPASS_ICON[i]}</span> {COMPASS[i]}
            </button>
          ))}
        </div>
      )}

      {kind === "point" && (
        <div className={styles.types} role="radiogroup" aria-label="نقطه" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
          {POINT_NAMES.map((name, i) => (
            <button key={name} role="radio" aria-checked={choice === i} onClick={() => setChoice(i)} disabled={done} style={{ minHeight: 48, fontSize: "1rem" }}>
              {mark(i)}
              {name}
            </button>
          ))}
        </div>
      )}

      {!done && (
        <button className={styles.secondary} disabled={kind === "number" ? !num : choice === null} onClick={() => p.onCheck(kind === "number" ? Number(num) : choice!)}>
          بررسی
        </button>
      )}

      {fb && (
        <p className={`${styles.feedback} ${styles[fb.tone]}`} role="status" aria-live="polite">
          <span className={styles.icon}>{ICON[fb.tone]}</span> {fb.text}
        </p>
      )}
      {done && <p className={styles.hint}>{simHint(q)}</p>}

      <button className={styles.next} onClick={p.onNew}>
        نمونه تازه
      </button>
    </div>
  );
}

function simHint(q: MotionQuestion) {
  switch (q.type) {
    case "gearDir":
    case "gearTurns":
      return "روی صفحه، چرخ‌ها می‌چرخند؛ نقطه سیاه روی هر چرخ را دنبال کن. با نوار پایین جلو و عقب ببر.";
    case "trip":
    case "chase":
      return "روی صفحه، حرکت روی مسیر و نمودار زمان–مسافت با هم پیش می‌روند. خط پر الف است و خط‌چین ب.";
    case "orient":
      return "روی صفحه، آدمک قدم‌به‌قدم می‌چرخد؛ فهرست چرخش‌ها کنار صفحه است.";
    case "grid":
      return q.variant === "routes" ? "روی صفحه، عددهای چهارراه‌ها از الف پر می‌شوند تا به ب برسند." : "روی صفحه، مسیر خانه‌به‌خانه کشیده می‌شود.";
  }
}

// Words for «خطوط موازی و زاویه» (tool 16): the question, the chain of
// reasons step by step (each step names the fact it uses), the working in a
// line or two, and what each slip was.
//
// Terms: «مورب» for the slanted line, «روبه‌رو (متقابل به رأس)», «هم‌جا
// (متناظر)», «زاویه‌های Z (متبادل)»; the plain words come first because the
// formal names are taught later than grade 6.

import { angleById, type Fact, type ParallelQuestion, type ParallelTag, type PStep } from "@/generators/parallel-angles";
import { fa } from "@/tools/registry";
import { ltr, type Frame } from "./frames";

const deg = (v: number) => `${fa(v)}°`;
export const PARALLEL_MARK = "خط‌هایی که علامت فلش (>) دارند با هم موازی‌اند.";

/** Each fact's name, as said in "show me" and the teacher guide. */
export const FACT_NAME: Record<Fact, string> = {
  vertical: "روبه‌رو (متقابل به رأس)",
  linear: "کنار هم روی خط صاف",
  corresponding: "هم‌جا (متناظر)",
  alternate: "زاویه‌های Z (متبادل)",
  triangle: "جمع زاویه‌های مثلث",
  helper: "خط کمکی موازی",
  parts: "تکه‌های یک زاویه",
  point: "دور یک نقطه",
};

export function parallelPrompt(q: ParallelQuestion): string {
  const ask = "زاویه «؟» چند درجه است؟";
  switch (q.variant) {
    case "decoy":
      return `یک خط مورب سه خط را بریده است. ${PARALLEL_MARK} ${ask}`;
    case "triApex":
    case "triBase":
      return `${PARALLEL_MARK} رأس P مثلث روی یکی از دو خط موازی است و A و B روی خط دیگر. ${ask}`;
    case "twoTransBase":
    case "twoTransApex":
      return `${PARALLEL_MARK} دو خط از نقطه P روی یکی از آن‌ها گذشته‌اند و خط دیگر را در A و B بریده‌اند. ${ask}`;
    case "zigzag":
      return `${PARALLEL_MARK} خط شکسته ABC بین آن‌ها در نقطه B خم شده است. زاویه خم («؟») چند درجه است؟`;
    case "zigzagArm":
      return `${PARALLEL_MARK} خط شکسته ABC بین آن‌ها در نقطه B خم شده و زاویه خم معلوم است. ${ask}`;
    case "zigzagOut":
      return `${PARALLEL_MARK} خط شکسته ABC بین آن‌ها در نقطه B خم شده است. زاویه بیرون خم («؟»، قسمت بزرگ دور نقطه B) چند درجه است؟`;
    default:
      return `یک خط مورب دو خط را بریده است. ${PARALLEL_MARK} ${ask}`;
  }
}

/** One step of the chain, in a sentence that names the fact. */
function stepSentence(q: ParallelQuestion, s: PStep): string {
  const A = (id: string) => angleById(q, id);
  const f = s.from.map(A);
  const at = s.to ? A(s.to).at : "";
  const box = s.to === q.ask ? "زاویه «؟»" : "زاویه در قاب خط‌چین";
  switch (s.fact) {
    case "vertical":
      return `در ${at}، ${box} روبه‌روی زاویه ${deg(f[0].deg)} است؛ زاویه‌های روبه‌رو برابرند: ${deg(s.value)}.`;
    case "linear":
      return `در ${at}، ${box} و زاویه ${deg(f[0].deg)} کنار هم روی یک خط صاف‌اند و با هم ۱۸۰° می‌شوند: ${ltr(`۱۸۰ − ${fa(f[0].deg)} = ${fa(s.value)}`)}.`;
    case "corresponding":
      return `خط‌ها موازی‌اند (فلش دارند)، پس مورب هر دو را با یک شیب می‌بُرد: ${box} در ${at} همان جای زاویه ${deg(f[0].deg)} در ${f[0].at} است و با آن برابر است: ${deg(s.value)}.`;
    case "alternate":
      return `بین دو خط موازی، دو طرف مورب، یک Z ساخته می‌شود و دو گوشه Z برابرند: ${box} در ${at} برابر زاویه ${deg(f[0].deg)} در ${f[0].at} است: ${deg(s.value)}.`;
    case "triangle":
      return `جمع سه زاویه مثلث ۱۸۰° است: ${ltr(`۱۸۰ − ${fa(f[0].deg)} − ${fa(f[1].deg)} = ${fa(s.value)}`)}.`;
    case "helper":
      return "از B خطی (خط‌چین با فلش) موازی دو خط می‌کشیم. حالا زاویه خم دو تکه است و هر تکه با یک خط موازی یک Z می‌سازد.";
    case "parts":
      return s.value === f[0].deg + f[1].deg
        ? `زاویه خم از همین دو تکه ساخته شده: ${ltr(`${fa(f[0].deg)} + ${fa(f[1].deg)} = ${fa(s.value)}`)}.`
        : `زاویه خم ${deg(f[0].deg)} است و یک تکه‌اش ${deg(f[1].deg)}؛ تکه دیگر: ${ltr(`${fa(f[0].deg)} − ${fa(f[1].deg)} = ${fa(s.value)}`)}.`;
    case "point":
      return `زاویه‌های دور یک نقطه با هم ۳۶۰° می‌شوند: ${ltr(`۳۶۰ − ${fa(f[0].deg)} = ${fa(s.value)}`)}.`;
  }
}

/** "Show me": what is given, then one frame per fact, then the chain in one line. */
export function parallelFrames(q: ParallelQuestion): Frame[] {
  const given = q.fig.angles.filter((a) => a.role === "given").map((a) => a.id);
  const start = q.variant === "decoy" ? `${PARALLEL_MARK} خط بی‌فلش با بقیه موازی نیست، پس زاویه روی آن به کار ما نمی‌آید.` : `${PARALLEL_MARK} از زاویه‌های معلوم شروع می‌کنیم.`;
  const frames: Frame[] = [{ show: { known: given, focus: [] }, note: start }];
  const known = [...given];
  let helper = false;
  q.steps.forEach((s, i) => {
    if (s.fact === "helper") helper = true;
    if (s.to) known.push(s.to);
    frames.push({ show: { known: [...known], focus: [...s.from, ...(s.to ? [s.to] : [])], helper }, note: `قدم ${fa(i + 1)} · ${FACT_NAME[s.fact]}: ${stepSentence(q, s)}` });
  });
  const chain = q.steps.map((s) => FACT_NAME[s.fact]).join(" ← ");
  frames.push({ show: { known, focus: [q.ask], helper }, note: `زنجیره دلیل‌ها: ${chain}. پس زاویه «؟» = ${deg(q.answer)}.` });
  return frames;
}

/** The working in a line or two. */
export function parallelHow(q: ParallelQuestion): string {
  return q.steps.map((s) => `${FACT_NAME[s.fact]}: ${stepSentence(q, s)}`).join(" ");
}

/** What a slip was, in a sentence. */
export function parallelSlipText(q: ParallelQuestion, tag: ParallelTag): string {
  const v = q.variant;
  switch (tag) {
    case "equalNotSupp":
      return v.startsWith("twoTrans")
        ? "زاویه بیرون مثلث در A را با زاویه داخل مثلث در A یکی گرفتی؛ این دو کنار هم روی خط صاف‌اند و با هم ۱۸۰° می‌شوند."
        : "همان عدد زاویه معلوم را نوشتی، ولی این دو زاویه برابر نیستند: یکی تند است و دیگری باز. این دو با هم ۱۸۰° می‌شوند.";
    case "suppNotEqual":
      if (v === "triApex" || v === "triBase") return "زاویه داده‌شده در P و زاویه داخل مثلث در A یک Z می‌سازند و برابرند؛ لازم نبود از ۱۸۰ کم کنی.";
      if (v === "zigzagArm") return "زاویه «؟» و تکه پایینی خم یک Z می‌سازند و برابرند؛ لازم نبود از ۱۸۰ کم کنی.";
      if (v === "twoTransBase") return "زاویه «؟» و زاویه داخل مثلث در B یک Z می‌سازند و برابرند؛ لازم نبود از ۱۸۰ کم کنی.";
      if (v === "twoTransApex") return "زاویه داده‌شده در P و زاویه داخل مثلث در B یک Z می‌سازند و برابرند؛ لازم نبود از ۱۸۰ کم کنی.";
      return "از ۱۸۰ کم کردی، ولی این دو زاویه برابرند: هر دو تند یا هر دو باز.";
    case "notParallel":
      return "خط سوم علامت فلش ندارد، پس با خط‌های دیگر موازی نیست و زاویه‌اش را نمی‌شود به آن‌ها منتقل کرد. فقط زاویه روی خط‌های فلش‌دار به کار می‌آید.";
    case "added":
      if (v === "triApex" || v === "triBase") return "دو زاویه را جمع کردی؛ حالا جمعشان را از ۱۸۰ کم کن.";
      if (v === "zigzagArm") return "زاویه خم و زاویه A را جمع کردی؛ تکه دیگر خم = زاویه خم منهای تکه‌ای که می‌دانی.";
      if (v.startsWith("twoTrans")) return "جمع کردی، ولی باید کم کنی: جمع زاویه‌های مثلث ۱۸۰° است و زاویه‌های معلوم از آن کم می‌شوند.";
      return `۱۸۰ و زاویه را جمع کردی، ولی باید کم کنی: دو زاویه کنار هم روی خط صاف با هم ۱۸۰° می‌شوند (${ltr("۱۸۰ − زاویه")}).`;
    case "sum360":
      return "جمع زاویه‌های مثلث ۱۸۰° است، نه ۳۶۰°.";
    case "subtracted":
      return "دو زاویه را از هم کم کردی؛ زاویه خم از دو تکه ساخته شده و برابر جمع آن دو است.";
    case "asTriangle":
      return "این‌جا مثلثی نیست که جمع زاویه‌هایش ۱۸۰° باشد. از B خطی موازی دو خط بکش تا خم دو تکه شود؛ هر تکه با زاویه کنار خط موازی برابر است.";
    case "insideBend":
      return "این زاویه داخل خم است؛ زاویه بیرون خم با آن ۳۶۰° می‌شود (دور یک نقطه).";
    case "pointAs180":
      return "زاویه‌های دور یک نقطه با هم ۳۶۰° می‌شوند، نه ۱۸۰°.";
  }
}

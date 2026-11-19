// Words for «دایره» and «مساحت ترکیبی» (tool 16): the question, the working
// in a line or two, "show me" step by step, and what each slip was.
// Lengths are in centimetres and π is 3.14, as in the grade 6 book.

import { withPi, type MeasureTag } from "@/generators/circle";
import { dimValue } from "@/generators/composite-area";
import type { CircleQuestion, CompositeQuestion } from "@/generators/geometry";
import { fa } from "@/tools/registry";
import { ltr, num, type Frame } from "./frames";

export type MeasureQuestion = CircleQuestion | CompositeQuestion;

export const PI_NOTE = "عدد پی (π) را ۳٫۱۴ بگیر.";
const CM = "سانتی‌متر";
const CM2 = "سانتی‌متر مربع";

/** n × n × 3.14 (÷ k), worked out. */
const piArea = (r: number, k = 1) => withPi({ lin: 0, pi: (r * r) / k })!;
const piLen = (d: number, k = 1) => withPi({ lin: 0, pi: d / k })!;
const eq = (s: string) => ltr(s);

export const measureUnit = (q: MeasureQuestion) => (q.type === "circle" && q.asks !== "A" ? CM : CM2);

// ── Questions ────────────────────────────────────────────────────────────

const toldFa = (q: CircleQuestion) => (q.given === "r" ? `شعاع ${num(q.givenValue)}` : q.given === "d" ? `قطر ${num(q.givenValue)}` : `محیط ${num(q.givenValue)}`);

export function measurePrompt(q: MeasureQuestion): string {
  if (q.type === "circle") {
    const told = `${toldFa(q)} ${CM}`;
    switch (q.variant) {
      case "circC":
        return `${q.given === "r" ? "شعاع" : "قطر"} این دایره ${num(q.givenValue)} ${CM} است. محیط آن چند ${CM} است؟ ${PI_NOTE}`;
      case "circA":
        return `${q.given === "r" ? "شعاع" : "قطر"} این دایره ${num(q.givenValue)} ${CM} است. مساحت آن چند ${CM2} است؟ ${PI_NOTE}`;
      case "semiA":
        return `این شکل یک نیم‌دایره با ${told} است. مساحت آن چند ${CM2} است؟ ${PI_NOTE}`;
      case "semiP":
        return `این شکل یک نیم‌دایره با ${told} است. محیط آن (دور تا دور شکل) چند ${CM} است؟ ${PI_NOTE}`;
      case "quarterA":
        return `این شکل یک ربع دایره با ${told} است. مساحت آن چند ${CM2} است؟ ${PI_NOTE}`;
      case "quarterP":
        return `این شکل یک ربع دایره با ${told} است. محیط آن (دور تا دور شکل) چند ${CM} است؟ ${PI_NOTE}`;
      case "fromC":
        return `محیط یک دایره ${num(q.givenValue)} ${CM} است. ${q.asks === "r" ? "شعاع" : "قطر"} آن چند ${CM} است؟ ${PI_NOTE}`;
      case "fromCtoA":
        return `محیط یک دایره ${num(q.givenValue)} ${CM} است. مساحت آن چند ${CM2} است؟ ${PI_NOTE}`;
      case "ring":
        return `دو دایره هم‌مرکز با شعاع‌های ${num(q.r)} و ${num(q.inner)} ${CM}. مساحت حلقه سایه‌خورده بین آن‌ها چند ${CM2} است؟ ${PI_NOTE}`;
    }
  }
  const area = `چند ${CM2} است؟`;
  switch (q.variant) {
    case "L":
      return `همه گوشه‌های این شکل قائمه‌اند و اندازه‌ها به ${CM} است. مساحت شکل ${area}`;
    case "hole":
      return `از وسط یک مستطیل، یک مستطیل کوچک بریده شده (سفید). اندازه‌ها به ${CM} است. مساحت قسمت سایه‌خورده ${area}`;
    case "frame":
      return `این یک قاب عکس است و پهنای قاب همه‌جا ${num(dimValue(q, "t"))} ${CM} است. مساحت خود قاب (سایه‌خورده) ${area}`;
    case "triCut":
      return `از گوشه یک مستطیل، یک مثلث قائم‌الزاویه بریده شده (سفید). اندازه‌ها به ${CM} است. مساحت قسمت سایه‌خورده ${area}`;
    case "squareQuarters":
      return `در هر گوشه این مربع یک ربع دایره (سفید) کشیده شده. اندازه‌ها به ${CM} است. مساحت قسمت سایه‌خورده وسط ${area} ${PI_NOTE}`;
    case "squareCircle":
      return `یک دایره (سفید) درون مربع است و به هر چهار ضلع می‌رسد. ضلع مربع ${num(dimValue(q, "s"))} ${CM} است. مساحت چهار گوشه سایه‌خورده با هم ${area} ${PI_NOTE}`;
    case "cornerQuarter":
      return `مرکز ربع دایره (سفید) یک گوشه مربع است و شعاعش هم‌اندازه ضلع مربع. ضلع مربع ${num(dimValue(q, "s"))} ${CM} است. مساحت قسمت سایه‌خورده ${area} ${PI_NOTE}`;
    case "rectSemi":
      return `روی ضلع بالای این مستطیل یک نیم‌دایره است (قطرش همان ضلع). اندازه‌ها به ${CM} است. مساحت کل شکل ${area} ${PI_NOTE}`;
  }
}

export const measureAnswerFa = (q: MeasureQuestion) => `${num(q.answer)} ${measureUnit(q)}`;

// ── Working ──────────────────────────────────────────────────────────────

/** The working of a circle question as steps (each one sentence), shared by "show me" and feedback. */
function circleSteps(q: CircleQuestion): Frame[] {
  const r = q.r;
  const d = 2 * r;
  const A = piArea(r);
  const C = piLen(d);
  const toD: Frame = { show: { reveal: ["d"] }, note: `قطر دو برابر شعاع است: ${eq(`۲ × ${fa(r)} = ${fa(d)}`)}.` };
  const toR: Frame = { show: { reveal: ["r"] }, note: `شعاع نصف قطر است: ${eq(`${fa(d)} ÷ ۲ = ${fa(r)}`)}.` };
  const both = ["r", "d"];
  switch (q.variant) {
    case "circC":
      return [
        { show: {}, note: "محیط دایره یعنی طول دور آن. محیط هر دایره ۳٫۱۴ برابر قطرش است." },
        ...(q.given === "r" ? [toD] : []),
        { show: { lines: [0], reveal: both }, note: `محیط = قطر × ۳٫۱۴: ${eq(`${fa(d)} × ۳٫۱۴ = ${num(C)}`)} ${CM}.` },
      ];
    case "circA":
      return [
        { show: {}, note: "مساحت دایره = شعاع × شعاع × ۳٫۱۴." },
        ...(q.given === "d" ? [toR] : []),
        { show: { parts: { 0: num(A) }, reveal: both }, note: `${eq(`${fa(r)} × ${fa(r)} × ۳٫۱۴ = ${num(A)}`)} ${CM2}.` },
      ];
    case "semiA":
      return [
        { show: {}, note: "نیم‌دایره نصف یک دایره است؛ پس مساحتش نصف مساحت دایره کامل است." },
        ...(q.given === "d" ? [toR] : []),
        { show: { reveal: both }, note: `مساحت دایره کامل: ${eq(`${fa(r)} × ${fa(r)} × ۳٫۱۴ = ${num(A)}`)}.` },
        { show: { parts: { 0: num(A / 2) }, reveal: both }, note: `نیم‌دایره نصف آن است: ${eq(`${num(A)} ÷ ۲ = ${num(A / 2)}`)} ${CM2}.` },
      ];
    case "semiP":
      return [
        { show: {}, note: "دور نیم‌دایره دو تکه دارد: یک خم و یک لبه صاف." },
        ...(q.given === "r" ? [toD] : []),
        { show: { lines: [0], reveal: both }, note: `خم نصف محیط دایره کامل است: ${eq(`${fa(d)} × ۳٫۱۴ ÷ ۲ = ${num(C / 2)}`)}.` },
        { show: { lines: [1], reveal: both }, note: `لبه صاف همان قطر است: ${fa(d)}.` },
        { show: { lines: [0, 1], reveal: both }, note: `محیط = خم + لبه صاف: ${eq(`${num(C / 2)} + ${fa(d)} = ${num(q.answer)}`)} ${CM}.` },
      ];
    case "quarterA":
      return [
        { show: {}, note: "ربع دایره یک‌چهارم دایره است؛ پس مساحتش یک‌چهارم مساحت دایره کامل است." },
        { show: {}, note: `مساحت دایره کامل: ${eq(`${fa(r)} × ${fa(r)} × ۳٫۱۴ = ${num(A)}`)}.` },
        { show: { parts: { 0: num(q.answer) } }, note: `ربع آن: ${eq(`${num(A)} ÷ ۴ = ${num(q.answer)}`)} ${CM2}.` },
      ];
    case "quarterP":
      return [
        { show: {}, note: "دور ربع دایره سه تکه دارد: یک خم و دو لبه صاف." },
        { show: { lines: [0] }, note: `خم یک‌چهارم محیط دایره کامل است: ${eq(`${fa(d)} × ۳٫۱۴ ÷ ۴ = ${num(C / 4)}`)}.` },
        { show: { lines: [1, 2] }, note: `هر لبه صاف یک شعاع است: ${eq(`${fa(r)} + ${fa(r)} = ${fa(d)}`)}.` },
        { show: { lines: [0, 1, 2] }, note: `محیط: ${eq(`${num(C / 4)} + ${fa(d)} = ${num(q.answer)}`)} ${CM}.` },
      ];
    case "fromC":
      return [
        { show: {}, note: "محیط = قطر × ۳٫۱۴؛ پس قطر = محیط ÷ ۳٫۱۴." },
        { show: { reveal: ["d"] }, note: `قطر: ${eq(`${num(q.givenValue)} ÷ ۳٫۱۴ = ${fa(d)}`)}${q.asks === "d" ? ` ${CM}.` : "."}` },
        ...(q.asks === "r" ? [{ ...toR, show: { reveal: both }, note: `${toR.note.slice(0, -1)} ${CM}.` }] : []),
      ];
    case "fromCtoA":
      return [
        { show: {}, note: "برای مساحت شعاع لازم است. محیط = قطر × ۳٫۱۴؛ پس قطر = محیط ÷ ۳٫۱۴." },
        { show: { reveal: ["d"] }, note: `قطر: ${eq(`${num(q.givenValue)} ÷ ۳٫۱۴ = ${fa(d)}`)}.` },
        { ...toR, show: { reveal: both } },
        { show: { parts: { 0: num(A) }, reveal: both }, note: `مساحت: ${eq(`${fa(r)} × ${fa(r)} × ۳٫۱۴ = ${num(A)}`)} ${CM2}.` },
      ];
    case "ring": {
      const big = piArea(r);
      const small = piArea(q.inner);
      return [
        { show: { parts: { 0: `بزرگ: ${num(big)}` } }, note: `دایره بزرگ: ${eq(`${fa(r)} × ${fa(r)} × ۳٫۱۴ = ${num(big)}`)}.` },
        { show: { parts: { 0: `بزرگ: ${num(big)}`, 1: `− ${num(small)}` } }, note: `دایره کوچک (سوراخ وسط): ${eq(`${fa(q.inner)} × ${fa(q.inner)} × ۳٫۱۴ = ${num(small)}`)}.` },
        { show: { parts: { 0: `بزرگ: ${num(big)}`, 1: `− ${num(small)}` } }, note: `حلقه = بزرگ منهای کوچک: ${eq(`${num(big)} − ${num(small)} = ${num(q.answer)}`)} ${CM2}.` },
      ];
    }
  }
}

/** The working of a composite question as steps. */
function compositeSteps(q: CompositeQuestion): Frame[] {
  const v = (n: string) => dimValue(q, n);
  const A = num(q.answer);
  switch (q.variant) {
    case "L": {
      const [W, H, a, b, iv, ih] = ["W", "H", "a", "b", "iv", "ih"].map(v);
      const [p1, p2] = [W * b, a * iv];
      const missing =
        q.labels === "outer"
          ? { reveal: ["iv"], note: `ضلع بی‌عدد را از ضلع‌های روبه‌رو پیدا می‌کنیم: ${eq(`${fa(H)} − ${fa(b)} = ${fa(iv)}`)}.` }
          : q.labels === "sum"
            ? { reveal: ["W", "iv"], note: `ضلع‌های بی‌عدد: پایین ${eq(`${fa(a)} + ${fa(ih)} = ${fa(W)}`)} و ضلع داخل ${eq(`${fa(H)} − ${fa(b)} = ${fa(iv)}`)}.` }
            : { reveal: ["b"], note: `ضلع بی‌عدد را از ضلع روبه‌رو پیدا می‌کنیم: ${eq(`${fa(H)} − ${fa(iv)} = ${fa(b)}`)}.` };
      const tags = { 0: `الف: ${fa(p1)}`, 1: `ب: ${fa(p2)}` };
      return [
        { show: { parts: { 0: "الف", 1: "ب" } }, note: "شکل را با یک خط به دو مستطیل «الف» و «ب» می‌بُریم (خط‌چین)." },
        { show: { parts: { 0: "الف", 1: "ب" }, reveal: missing.reveal }, note: missing.note },
        { show: { parts: { 0: tags[0], 1: "ب" }, reveal: missing.reveal }, note: `مستطیل الف: ${eq(`${fa(W)} × ${fa(b)} = ${fa(p1)}`)}.` },
        { show: { parts: tags, reveal: missing.reveal }, note: `مستطیل ب: ${eq(`${fa(a)} × ${fa(iv)} = ${fa(p2)}`)}.` },
        {
          show: { parts: tags, reveal: missing.reveal },
          note: `مساحت شکل: ${eq(`${fa(p1)} + ${fa(p2)} = ${A}`)} ${CM2}. راه دیگر: مستطیل دور شکل منهای گوشه خالی، ${eq(`${fa(W)} × ${fa(H)} − ${fa(ih)} × ${fa(iv)} = ${A}`)}.`,
        },
      ];
    }
    case "hole":
    case "frame":
    case "triCut": {
      const [W, H] = [v("W"), v("H")];
      const big = W * H;
      let inner: { label: string; note: string; value: number; pre?: Frame };
      if (q.variant === "hole") inner = { label: "سوراخ", value: v("w") * v("h"), note: `مستطیل سفید: ${eq(`${fa(v("w"))} × ${fa(v("h"))} = ${fa(v("w") * v("h"))}`)}.` };
      else if (q.variant === "frame") {
        const [t, iw, ih] = [v("t"), v("iw"), v("ih")];
        inner = {
          label: "داخل",
          value: iw * ih,
          pre: { show: { parts: { 0: `بزرگ: ${fa(big)}` }, reveal: ["iw", "ih"] }, note: `پهنای قاب از هر دو طرف کم می‌شود: ${eq(`${fa(W)} − ۲ × ${fa(t)} = ${fa(iw)}`)} و ${eq(`${fa(H)} − ۲ × ${fa(t)} = ${fa(ih)}`)}.` },
          note: `داخل قاب (سفید): ${eq(`${fa(iw)} × ${fa(ih)} = ${fa(iw * ih)}`)}.`,
        };
      } else {
        const [p, qq] = [v("p"), v("q")];
        inner = { label: "مثلث", value: (p * qq) / 2, note: `مثلث سفید نصف یک مستطیل ${eq(`${fa(p)} × ${fa(qq)}`)} است: ${eq(`${fa(p)} × ${fa(qq)} ÷ ۲ = ${num((p * qq) / 2)}`)}.` };
      }
      const reveal = q.variant === "frame" ? ["iw", "ih"] : [];
      const both = { 0: `بزرگ: ${fa(big)}`, 1: `− ${num(inner.value)}` };
      return [
        { show: { parts: { 0: `بزرگ: ${fa(big)}` } }, note: `قسمت سایه‌خورده = مستطیل بزرگ منهای قسمت سفید. مستطیل بزرگ: ${eq(`${fa(W)} × ${fa(H)} = ${fa(big)}`)}.` },
        ...(inner.pre ? [inner.pre] : []),
        { show: { parts: both, reveal }, note: inner.note },
        { show: { parts: both, reveal }, note: `سایه‌خورده: ${eq(`${fa(big)} − ${num(inner.value)} = ${A}`)} ${CM2}.` },
      ];
    }
    case "squareQuarters": {
      const [s, r] = [v("s"), v("r")];
      const circle = piArea(r);
      const quarters = { 1: "¼", 2: "¼", 3: "¼", 4: "¼" };
      return [
        { show: { parts: { 0: `مربع: ${fa(s * s)}` } }, note: `قسمت سایه‌خورده = مربع منهای چهار ربع دایره. مربع: ${eq(`${fa(s)} × ${fa(s)} = ${fa(s * s)}`)}.` },
        { show: { parts: { 0: `مربع: ${fa(s * s)}`, ...quarters } }, note: `چهار ربع دایره هم‌اندازه با هم یک دایره کامل به شعاع ${fa(r)} می‌سازند: ${eq(`${fa(r)} × ${fa(r)} × ۳٫۱۴ = ${num(circle)}`)}.` },
        { show: { parts: { 0: `مربع: ${fa(s * s)}`, ...quarters } }, note: `سایه‌خورده: ${eq(`${fa(s * s)} − ${num(circle)} = ${A}`)} ${CM2}.` },
      ];
    }
    case "squareCircle":
    case "cornerQuarter":
    case "rectSemi": {
      const semi = q.variant === "rectSemi";
      const [w, h] = semi ? [v("W"), v("H")] : [v("s"), v("s")];
      const r = v("r");
      const big = w * h;
      const k = q.variant === "squareCircle" ? 1 : q.variant === "cornerQuarter" ? 4 : 2;
      const round = piArea(r, k);
      const name = k === 1 ? "دایره" : k === 4 ? "ربع دایره" : "نیم‌دایره";
      const why =
        q.variant === "squareCircle"
          ? `قطر دایره همان ضلع مربع است؛ پس شعاع: ${eq(`${fa(w)} ÷ ۲ = ${fa(r)}`)}.`
          : q.variant === "cornerQuarter"
            ? `شعاع ربع دایره همان ضلع مربع است: ${fa(r)}.`
            : `قطر نیم‌دایره همان ضلع بالای مستطیل است؛ پس شعاع: ${eq(`${fa(w)} ÷ ۲ = ${fa(r)}`)}.`;
      const first = semi ? `مستطیل: ${fa(big)}` : `مربع: ${fa(big)}`;
      const second = semi ? `+ ${num(round)}` : `− ${num(round)}`;
      return [
        { show: { parts: { 0: first } }, note: `${semi ? "شکل = مستطیل به‌علاوه نیم‌دایره. مستطیل" : `قسمت سایه‌خورده = مربع منهای ${name}. مربع`}: ${eq(`${fa(w)} × ${fa(h)} = ${fa(big)}`)}.` },
        { show: { parts: { 0: first }, reveal: ["r"] }, note: why },
        { show: { parts: { 0: first, 1: second }, reveal: ["r"] }, note: `${name}: ${eq(`${fa(r)} × ${fa(r)} × ۳٫۱۴${k > 1 ? ` ÷ ${fa(k)}` : ""} = ${num(round)}`)}.` },
        { show: { parts: { 0: first, 1: second }, reveal: ["r"] }, note: `${semi ? "مساحت شکل" : "سایه‌خورده"}: ${eq(`${fa(big)} ${semi ? "+" : "−"} ${num(round)} = ${A}`)} ${CM2}.` },
      ];
    }
  }
}

/** "Show me": the steps, each with what to draw. */
export const measureFrames = (q: MeasureQuestion): Frame[] => (q.type === "circle" ? circleSteps(q) : compositeSteps(q));

/** The working in a line or two: the steps' sentences after the first. */
export function measureHow(q: MeasureQuestion): string {
  const steps = measureFrames(q);
  // The first step of a circle (a rule) and of an L (a pointer to the drawing) is left out; elsewhere it holds a number.
  const from = q.type === "circle" ? (q.variant === "ring" ? 0 : 1) : q.variant === "L" ? 1 : 0;
  return steps
    .slice(from)
    .map((s) => s.note)
    .join(" ");
}

// ── Slips ────────────────────────────────────────────────────────────────

const PART: Record<string, string> = { semiA: "نیم‌دایره", semiP: "نیم‌دایره", quarterA: "ربع دایره", quarterP: "ربع دایره" };

/** What a slip was, in a sentence. */
export function measureSlipText(q: MeasureQuestion, tag: MeasureTag): string {
  const v = q.variant;
  const comp = q.type === "composite";
  switch (tag) {
    case "dAsR":
      if (v === "squareCircle") return "ضلع مربع را شعاع گرفتی؛ ضلع مربع قطر دایره است و شعاع نصف آن.";
      if (v === "rectSemi") return "ضلع بالای مستطیل را شعاع گرفتی؛ آن قطر نیم‌دایره است و شعاع نصف آن.";
      if (v === "fromCtoA") return "«محیط ÷ ۳٫۱۴» قطر است، نه شعاع؛ اول نصفش کن.";
      return "قطر را به جای شعاع گذاشتی؛ شعاع نصف قطر است.";
    case "rAsD":
      return "محیط = قطر × ۳٫۱۴؛ تو شعاع را به جای قطر گذاشتی (دو برابرش نکردی).";
    case "squaredD":
      return "قطر را در خودش ضرب کردی؛ در مساحت، شعاع × شعاع × ۳٫۱۴ است.";
    case "circForArea":
      if (comp) return "برای دایره، فرمول محیط (۲ × شعاع × ۳٫۱۴) را به کار بردی؛ مساحت دایره = شعاع × شعاع × ۳٫۱۴.";
      if (v === "fromCtoA") return "این همان محیط است؛ مساحت خواسته شده: شعاع × شعاع × ۳٫۱۴.";
      if (v === "semiA" || v === "quarterA") return `این تکه‌ای از محیط است (۲ × شعاع × ۳٫۱۴)، نه مساحت ${PART[v]}.`;
      return "این محیط دایره است (۲ × شعاع × ۳٫۱۴)، نه مساحت. مساحت = شعاع × شعاع × ۳٫۱۴.";
    case "areaForCirc":
      return "این مساحت دایره است، نه محیط. محیط = قطر × ۳٫۱۴.";
    case "noStraight":
      return v === "quarterP" ? "فقط خم را حساب کردی؛ دو لبه صاف (دو شعاع) هم جزء دور شکل‌اند." : "فقط خم را حساب کردی؛ لبه صاف (قطر) هم جزء دور شکل است.";
    case "oneRadius":
      return v === "quarterP" ? "ربع دایره دو لبه صاف دارد؛ یکی از دو شعاع را جا انداختی." : "لبه صاف نیم‌دایره قطر است، نه شعاع.";
    case "wholeCircle":
      if (v === "rectSemi") return "روی مستطیل نیم‌دایره است، نه دایره کامل؛ نصفش کن.";
      if (v === "semiP" || v === "quarterP") return `محیط کل دایره را گذاشتی؛ خم ${PART[v]} ${v === "semiP" ? "نصف" : "یک‌چهارم"} آن است.`;
      return `این برای دایره کامل است؛ ${PART[v] ?? "این شکل"} ${v.startsWith("semi") ? "نصف" : "یک‌چهارم"} آن است.`;
    case "wrongFraction":
      return v === "cornerQuarter" ? "این ربع دایره است، نه نیم‌دایره؛ «÷ ۴» کن، نه «÷ ۲»." : v === "quarterP" ? "خم ربع دایره یک‌چهارم محیط دایره است، نه نصف." : "ربع دایره یک‌چهارم دایره است، نه نصف.";
    case "rForD":
      return "این شعاع است؛ قطر دو برابر آن است.";
    case "dForR":
      return "این قطر است؛ شعاع نصف آن است.";
    case "forgotPi":
      return "محیط را نصف کردی؛ ولی محیط ۳٫۱۴ برابر قطر است، پس اول بر ۳٫۱۴ تقسیم کن.";
    case "subtractRadii":
      return "اول شعاع‌ها را از هم کم کردی؛ مساحت هر دایره را جدا حساب کن، بعد آن‌ها را از هم کم کن.";
    case "added":
      return v === "ring" ? "مساحت دو دایره را جمع کردی؛ دایره کوچک سوراخ است و باید کم شود." : "مساحت‌ها را جمع کردی؛ قسمت سفید جزء شکل نیست و باید کم شود.";
    case "bigOnly":
      if (v === "rectSemi") return "نیم‌دایره بالا را جا انداختی؛ آن هم جزء شکل است.";
      return v === "ring" ? "این مساحت دایره بزرگ است؛ سوراخ وسط را کم نکردی." : "این مساحت کل مستطیل یا مربع است؛ قسمت سفید را کم نکردی.";
    case "holeOnly":
      return v === "ring" ? "این مساحت دایره کوچک (سوراخ) است؛ حلقه خواسته شده." : "این مساحت قسمت سفید است؛ قسمت سایه‌خورده خواسته شده.";
    case "overlapTwice":
      return "هر دو مستطیل را با ضلع کامل شکل گرفتی، پس گوشه مشترکشان دو بار شمرده شد. وقتی شکل را می‌بُری، هر تکه فقط یک بار حساب می‌شود.";
    case "missingLength":
      return v === "frame" ? `پهنای قاب از هر دو طرف کم می‌شود: داخل قاب ${eq(`${fa(dimValue(q, "W"))} − ۲ × ${fa(dimValue(q, "t"))}`)} است، نه ${eq(`${fa(dimValue(q, "W"))} − ${fa(dimValue(q, "t"))}`)}.` : "یک ضلع بی‌عدد را با عدد ضلع کناری‌اش یکی گرفتی؛ طولش را از ضلع‌های روبه‌رو حساب کن.";
    case "noCut":
      return "این مساحت مستطیل دور شکل است؛ گوشه خالی را کم نکردی.";
    case "perimeter":
      return "این محیط شکل است، نه مساحت. مساحت یعنی چند مربع ۱ در ۱ درون شکل جا می‌شود.";
    case "noHalf":
      return "مساحت مثلث = قاعده × ارتفاع ÷ ۲؛ «÷ ۲» یادت رفت.";
    case "wrongSign":
      return "نیم‌دایره به مستطیل چسبیده و جزء شکل است؛ باید جمع کنی، نه کم.";
  }
}

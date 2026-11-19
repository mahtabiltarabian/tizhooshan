// Words for the five later topics of tool 13: prompts, worked steps (for
// «نشانم بده», the answer and the worksheet key) and feedback that names the
// slip. Numbers and expressions are kept left to right inside Persian text.

import {
  cellDigit,
  cryptColumns,
  gcdAll,
  LETTER,
  lcmAll,
  moreMistake,
  OPS,
  pageDigits,
  powerUnit,
  rangePlaces,
  rowValue,
  signsValue,
  unitCycle,
  type CryptQuestion,
  type LcmQuestion,
  type MoreQuestion,
  type PagesQuestion,
  type SignsQuestion,
  type UnitsQuestion,
} from "@/generators/digits-more";
import { fa } from "@/tools/registry";

const ltr = (s: string) => `⁦${s}⁩`;
const n = (x: number | string) => ltr(fa(x));
const list = (xs: (number | string)[]) => xs.map((x) => fa(x)).join("، ");
const PLACE = ["یکان", "دهگان", "صدگان", "هزارگان"];

/** A time of day from minutes: 7:05. */
export const timeFa = (min: number) => ltr(fa(`${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`));
/** A typed time (705) as a time, or null. */
export function typedTimeFa(v: string) {
  if (v.length < 3) return null;
  return ltr(fa(`${v.slice(0, -2)}:${v.slice(-2)}`));
}

/** b to the power e, in words. */
export const powFa = (b: number, e: number) => `${fa(b)} به توان ${fa(e)}`;

// ── Prompts ──────────────────────────────────────────────────────────────

const LCM_STORIES = [
  (a: string, b: string) => `دو اتوبوس از یک ایستگاه حرکت می‌کنند: یکی هر ${a} دقیقه و دیگری هر ${b} دقیقه. همین الان با هم حرکت کردند. چند دقیقه بعد دوباره با هم حرکت می‌کنند؟`,
  (a: string, b: string) => `دو چراغ چشمک می‌زنند: یکی هر ${a} ثانیه و دیگری هر ${b} ثانیه. همین الان با هم روشن شدند. چند ثانیه بعد دوباره با هم روشن می‌شوند؟`,
  (a: string, b: string) => `سارا هر ${a} روز یک بار و مریم هر ${b} روز یک بار به کتابخانه می‌روند. امروز هر دو آنجا بودند. چند روز دیگر دوباره هر دو با هم به کتابخانه می‌روند؟`,
  (a: string, b: string, c: string) => `سه چراغ چشمک می‌زنند: یکی هر ${a} ثانیه، یکی هر ${b} ثانیه و یکی هر ${c} ثانیه. همین الان هر سه با هم روشن شدند. چند ثانیه بعد دوباره هر سه با هم روشن می‌شوند؟`,
  (a: string, b: string, c: string) => `سه دوست هر ${a}، ${b} و ${c} روز یک بار به استخر می‌روند. امروز هر سه آنجا بودند. چند روز دیگر دوباره هر سه با هم به استخر می‌روند؟`,
];

const GCD_STORIES = [
  (a: string, b: string) => `دو روبان به طول ${a} و ${b} سانتی‌متر داریم. می‌خواهیم هر دو را به تکه‌های هم‌اندازه ببریم، بدون اینکه چیزی اضافه بماند، و تکه‌ها تا جای ممکن بلند باشند. طول هر تکه چند سانتی‌متر است؟`,
  (a: string, b: string) => `${a} مداد و ${b} پاک‌کن را در بسته‌های یکسان می‌گذاریم: همه بسته‌ها مداد به یک اندازه و پاک‌کن به یک اندازه دارند و چیزی نمی‌ماند. بیشترین تعداد بسته چند تاست؟`,
  (a: string, b: string) => `کف یک اتاق مستطیلی ${a} در ${b} دسی‌متر است. آن را با کاشی‌های مربعی هم‌اندازه، بدون بریدن کاشی، می‌پوشانیم. ضلع بزرگ‌ترین کاشی ممکن چند دسی‌متر است؟`,
];

function lcmPrompt(q: LcmQuestion, paper: boolean) {
  const [a, b, c] = q.nums.map((x) => fa(x));
  switch (q.ask) {
    case "lcm":
      return LCM_STORIES[q.story](a, b, c);
    case "gcd":
      return GCD_STORIES[q.story](a, b);
    case "pieces":
      return `دو روبان به طول ${a} و ${b} سانتی‌متر را به تکه‌های هم‌اندازه می‌بریم، بدون اینکه چیزی اضافه بماند، و تکه‌ها تا جای ممکن بلندند. روی هم چند تکه به دست می‌آید؟`;
    case "clock":
      return `از یک ایستگاه، اتوبوس خط یک هر ${a} دقیقه و اتوبوس خط دو هر ${b} دقیقه حرکت می‌کند. ساعت ${timeFa(q.start)} صبح هر دو با هم حرکت کردند. بار بعد، ساعت چند دوباره با هم حرکت می‌کنند؟${paper ? "" : " (ساعت را با رقم‌ها بزن: ۸:۰۵ یعنی ۸۰۵.)"}`;
  }
}

/** A cell as it is written: a digit, or the letter. */
const cellFa = (q: CryptQuestion, c: number) => (c >= LETTER ? q.letters[c - LETTER] : fa(c));
/** A row of cells, letters spaced: «الف ب». */
export const rowFa = (q: CryptQuestion, r: number[]) => r.map((c) => cellFa(q, c)).join(" ");

export const CRYPT_RULE = "هر حرف یک رقم است؛ حرف‌های متفاوت رقم‌های متفاوت دارند؛ هیچ عدد چندرقمی با صفر شروع نمی‌شود.";

function cryptPrompt(q: CryptQuestion) {
  const ask = q.letters.length === 1 ? `حرف ${q.letters[0]} چه رقمی است؟` : `هر حرف چه رقمی است؟ (${q.letters.join("، ")})`;
  return `در جمع زیر ${CRYPT_RULE} ${ask}`;
}

/** An expression with its signs (or ؟ for a gap): "۵ × ۳ − ۲". */
export function exprFa(nums: number[], ops: (number | null)[], paren: [number, number] | null) {
  return ltr(nums.map((x, i) => `${paren?.[0] === i ? "(" : ""}${fa(x)}${paren?.[1] === i ? ")" : ""}${i < ops.length ? ` ${ops[i] === null ? "؟" : OPS[ops[i]!]} ` : ""}`).join(""));
}

export const SIGNS_RULE = "اول داخل پرانتز، بعد ضرب و تقسیم، آخر جمع و تفریق؛ هر دسته از چپ به راست.";

function signsPrompt(q: SignsQuestion) {
  const gaps = q.ops.map(() => null);
  return `به جای هر ؟ یکی از علامت‌های + ، − ، × ، ÷ را بگذار تا تساوی درست شود: ${exprFa(q.nums, gaps, q.paren)} ${ltr(`= ${fa(q.target)}`)}. ترتیب حساب: ${q.paren ? SIGNS_RULE : "ضرب و تقسیم پیش از جمع و تفریق؛ هر دسته از چپ به راست."} (علامت تکراری هم مجاز است.)`;
}

function pagesPrompt(q: PagesQuestion) {
  switch (q.ask) {
    case "digits":
      return `صفحه‌های کتابی را از ۱ تا ${fa(q.to)} شماره می‌زنیم. روی هم چند رقم نوشته می‌شود؟`;
    case "pages":
      return `برای شماره‌زدن همه صفحه‌های یک کتاب، از صفحه ۱ به بعد، ${fa(q.digits)} رقم نوشته شد. کتاب چند صفحه دارد؟`;
    case "ones":
      return q.from === 1
        ? `صفحه‌های کتابی از ۱ تا ${fa(q.to)} شماره خورده‌اند. در شماره صفحه‌ها رقم ۱ روی هم چند بار نوشته شده است؟`
        : `یک فصل کتاب از صفحه ${fa(q.from)} تا صفحه ${fa(q.to)} است (هر دو صفحه جزو فصل‌اند). در شماره صفحه‌های این فصل، رقم ۱ روی هم چند بار نوشته شده است؟`;
  }
}

/** The expression of a units question in words. */
export function unitsExprFa(q: UnitsQuestion) {
  if (q.kind === "product") return ltr(q.factors.map((f) => fa(f)).join(" × "));
  const p = q.powers.map(([b, e]) => `(${powFa(b, e)})`);
  return q.kind === "power" ? powFa(...q.powers[0]) : p.join(q.kind === "sum" ? " + " : " × ");
}

function unitsPrompt(q: UnitsQuestion) {
  if (q.kind === "product") return `رقم یکان حاصل ${unitsExprFa(q)} چیست؟ (لازم نیست خود حاصل را حساب کنی.)`;
  return `رقم یکان ${unitsExprFa(q)} چیست؟`;
}

export function morePrompt(q: MoreQuestion, paper = false): string {
  switch (q.type) {
    case "lcm":
      return lcmPrompt(q, paper);
    case "crypt":
      return cryptPrompt(q);
    case "signs":
      return signsPrompt(q);
    case "pages":
      return pagesPrompt(q);
    case "units":
      return unitsPrompt(q);
  }
}

// ── Worked steps ─────────────────────────────────────────────────────────

/** Multiples of a up to L, shortened when long. */
function multiplesFa(a: number, L: number) {
  const ms = Array.from({ length: L / a }, (_, i) => (i + 1) * a);
  return ms.length > 8 ? `${list(ms.slice(0, 4))}، …، ${list(ms.slice(-2))}` : list(ms);
}
export const divisorsOf = (a: number) => Array.from({ length: a }, (_, i) => i + 1).filter((d) => a % d === 0);

function lcmSteps(q: LcmQuestion): string[] {
  const L = lcmAll(q.nums);
  const G = gcdAll(q.nums);
  if (q.ask === "lcm" || q.ask === "clock") {
    const unit = q.ask === "clock" || q.story === 0 ? "دقیقه" : q.story === 1 || q.story === 3 ? "ثانیه" : "روز";
    const steps = q.nums.map((a) => `مضرب‌های ${fa(a)}: ${multiplesFa(a, L)}`);
    steps.push(`اولین عددی که در ${q.nums.length === 2 ? "هر دو" : "هر سه"} فهرست هست ${fa(L)} است: کوچک‌ترین مضرب مشترک (ک.م.م). روی محورها، پرش‌ها اولین بار در ${fa(L)} به هم می‌رسند.`);
    const P = q.nums.reduce((p, x) => p * x, 1);
    steps.push(`ضرب عددها (${ltr(q.nums.map((x) => fa(x)).join(" × "))} = ${fa(P)}) هم مضرب مشترک است، اما کوچک‌ترین نیست؛ پس ${fa(L)} ${unit}.`);
    if (q.ask === "clock") steps.push(`${fa(L)} دقیقه بعد از ساعت ${timeFa(q.start)}: ساعت ${timeFa(q.start + L)}.`);
    return steps;
  }
  const steps = q.nums.map((a) => `شمارنده‌های ${fa(a)}: ${list(divisorsOf(a))}`);
  const common = divisorsOf(G);
  steps.push(`شمارنده‌های مشترک: ${list(common)}؛ بزرگ‌ترینشان ${fa(G)} است: بزرگ‌ترین شمارنده مشترک (ب.م.م).`);
  const [a, b] = q.nums;
  if (q.ask === "pieces") steps.push(`هر تکه ${fa(G)} سانتی‌متر. روبان اول ${ltr(`${fa(a)} ÷ ${fa(G)} = ${fa(a / G)}`)} تکه و روبان دوم ${ltr(`${fa(b)} ÷ ${fa(G)} = ${fa(b / G)}`)} تکه؛ روی هم ${ltr(`${fa(a / G)} + ${fa(b / G)} = ${fa(q.answer)}`)} تکه.`);
  else if (q.story === 0) steps.push(`پس هر تکه ${fa(G)} سانتی‌متر است: روبان اول ${fa(a / G)} تکه و روبان دوم ${fa(b / G)} تکه می‌شود و چیزی نمی‌ماند.`);
  else if (q.story === 1) steps.push(`پس ${fa(G)} بسته؛ در هر بسته ${fa(a / G)} مداد و ${fa(b / G)} پاک‌کن.`);
  else steps.push(`پس کاشی ${fa(G)} در ${fa(G)} دسی‌متر: در طول ${fa(a / G)} کاشی و در عرض ${fa(b / G)} کاشی جا می‌شود.`);
  return steps;
}

function cryptSteps(q: CryptQuestion): string[] {
  const vals = q.solution;
  const name = (c: number) => (c >= LETTER ? q.letters[c - LETTER] : fa(c));
  const steps = [`قاعده: ${CRYPT_RULE}`];
  const known = new Set<number>();
  const width = Math.max(q.top.length, q.bottom.length);
  const lead = q.sum[0];
  if (q.sum.length > width) {
    steps.push(`حاصل یک رقم بیشتر از عددها دارد. جمع دو عدد ${width === 2 ? "دورقمی از ۱۹۹" : "سه‌رقمی از ۱۹۹۹"} بیشتر نمی‌شود، پس رقم اول حاصل ۱ است${lead >= LETTER ? `؛ یعنی ${name(lead)} = ۱` : ""}.`);
    if (lead >= LETTER) known.add(lead);
  }
  const cols = cryptColumns(q, vals);
  const at = (r: number[], i: number) => (i < r.length ? r[r.length - 1 - i] : null);
  cols.forEach((col, i) => {
    const cells = [at(q.top, i), at(q.bottom, i)].filter((c): c is number => c !== null);
    const total = col.t + col.b + col.carry;
    const carryIn = col.carry ? `ده‌بر ${fa(col.carry)} + ` : "";
    const fresh = [...cells, at(q.sum, i)].filter((c): c is number => c !== null && c >= LETTER && !known.has(c));
    const uniq = [...new Set(fresh)];
    uniq.forEach((c) => known.add(c));
    const out = total >= 10 ? `؛ ${fa(total % 10)} در ${PLACE[i]} می‌نشیند و ${fa(Math.floor(total / 10))} ده‌بر به ستون ${PLACE[i + 1]} می‌رود` : "";
    const found = uniq.length === 1 ? ` پس ${name(uniq[0])} = ${fa(vals[uniq[0] - LETTER])}.` : uniq.length > 1 ? ` با امتحان رقم‌ها، فقط ${uniq.map((c) => `${name(c)} = ${fa(vals[c - LETTER])}`).join(" و ")} همه ستون‌ها را درست می‌کند.` : "";
    if (!cells.length) {
      steps.push(`ستون ${PLACE[i]}: فقط ده‌بر ${fa(col.carry)} می‌ماند.${found}`);
      return;
    }
    const words = cells.map(name).join(" + ");
    const digits = ltr(`${col.carry ? `${fa(col.carry)} + ` : ""}${cells.map((c) => fa(cellDigit(c, vals))).join(" + ")} = ${fa(total)}`);
    steps.push(`ستون ${PLACE[i]}: ${carryIn}${words}، یعنی ${digits}${out}.${found}`);
  });
  const sum = ltr(`${fa(rowValue(q.top, vals))} + ${fa(rowValue(q.bottom, vals))} = ${fa(rowValue(q.sum, vals))}`);
  steps.push(`جواب: ${q.letters.map((l, i) => `${l} = ${fa(vals[i])}`).join("، ")}. امتحان: ${sum} ✓. همه رقم‌ها امتحان شده‌اند و جواب دیگری نیست.`);
  return steps;
}

type Tok = { num: number } | { op: number } | { open: true } | { close: true };

/** The expression reduced one sign at a time, by the rules: [what is done, what is left]. */
export function signsTrace(nums: number[], ops: number[], paren: [number, number] | null): { did: string; left: Tok[]; at: [number, number] }[] {
  let toks: Tok[] = [];
  nums.forEach((x, i) => {
    if (paren?.[0] === i) toks.push({ open: true });
    toks.push({ num: x });
    if (paren?.[1] === i) toks.push({ close: true });
    if (i < ops.length) toks.push({ op: ops[i] });
  });
  const out: { did: string; left: Tok[]; at: [number, number] }[] = [];
  const val = (t: Tok) => ("num" in t ? t.num : NaN);
  const calc = (a: number, op: number, b: number) => [a + b, a - b, a * b, a / b][op];
  for (let guard = 0; guard < 20; guard++) {
    // The part to work in: inside the brackets while they stand, else everything.
    const o = toks.findIndex((t) => "open" in t);
    const c = toks.findIndex((t) => "close" in t);
    const [lo, hi] = o >= 0 ? [o + 1, c - 1] : [0, toks.length - 1];
    if (lo === hi) break;
    let k = -1;
    for (let i = lo + 1; i < hi; i += 2) if ((toks[i] as { op: number }).op >= 2) {
      k = i;
      break;
    }
    if (k < 0) k = lo + 1;
    const a = val(toks[k - 1]);
    const op = (toks[k] as { op: number }).op;
    const b = val(toks[k + 1]);
    const r = calc(a, op, b);
    toks = [...toks.slice(0, k - 1), { num: r }, ...toks.slice(k + 2)];
    // Brackets round a single number go at once.
    const o2 = toks.findIndex((t) => "open" in t);
    if (o2 >= 0 && "close" in toks[o2 + 2]) toks = [...toks.slice(0, o2), toks[o2 + 1], ...toks.slice(o2 + 3)];
    out.push({ did: ltr(`${fa(a)} ${OPS[op]} ${fa(b)} = ${fa(r)}`), left: toks, at: [k - 1, k + 1] });
  }
  return out;
}

export const toksFa = (toks: Tok[]) => ltr(toks.map((t) => ("num" in t ? fa(t.num) : "op" in t ? OPS[t.op] : "open" in t ? "(" : ")")).join(" ").replace(/\( /g, "(").replace(/ \)/g, ")"));

/** A value that may be a fraction. */
const fracFa = (f: [number, number] | null) => (f === null ? "بی‌معنی (تقسیم بر صفر)" : f[1] === 1 ? n(f[0]) : ltr(`${fa(f[0])}/${fa(f[1])}`));

function signsSteps(q: SignsQuestion): string[] {
  const steps = [`قاعده: ${SIGNS_RULE}`, `علامت‌ها: ${exprFa(q.nums, q.ops, q.paren)}`];
  for (const t of signsTrace(q.nums, q.ops, q.paren)) steps.push(`${t.did} ← ${toksFa(t.left)}`);
  steps[steps.length - 1] += ` = ${fa(q.target)} ✓`;
  const left = signsValue(q.nums, q.ops, q.paren, { rules: false, parens: true });
  const trap = left && !(left[1] === 1 && left[0] === q.target) ? ` دام: اگر همین را از چپ به راست حساب کنی، ${fracFa(left)} می‌شود.` : "";
  const noParen = q.paren ? signsValue(q.nums, q.ops, null) : null;
  const trap2 = noParen ? ` بدون پرانتز هم ${fracFa(noParen)} می‌شد.` : "";
  steps.push(`همه ${fa(4 ** q.ops.length)} حالت علامت‌ها امتحان شد؛ فقط همین یکی ${fa(q.target)} می‌دهد.${trap}${trap2}`);
  return steps;
}

/** The groups of pages up to `to`: [first, last, digits each]. */
export function pageGroups(from: number, to: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let len = 1, lo = 1; lo <= to; len++, lo *= 10) {
    const x = Math.max(from, lo);
    const y = Math.min(to, lo * 10 - 1);
    if (y >= x) out.push([x, y, len]);
  }
  return out;
}

const LEN_FA = ["", "یک‌رقمی", "دورقمی", "سه‌رقمی", "چهاررقمی"];

function pagesSteps(q: PagesQuestion): string[] {
  if (q.ask === "digits") {
    const steps = pageGroups(1, q.to).map(([a, b, len]) => `صفحه‌های ${fa(a)} تا ${fa(b)} (${LEN_FA[len]}): ${ltr(`${fa(b)} − ${fa(a)} + ۱ = ${fa(b - a + 1)}`)} صفحه، هر کدام ${fa(len)} رقم: ${ltr(`${fa(b - a + 1)} × ${fa(len)} = ${fa((b - a + 1) * len)}`)} رقم.`);
    steps.push(`جمع: ${ltr(pageGroups(1, q.to).map(([a, b, len]) => fa((b - a + 1) * len)).join(" + "))} = ${fa(q.answer)} رقم.`);
    return steps;
  }
  if (q.ask === "pages") {
    const steps: string[] = [];
    let left = q.digits;
    let last = 0;
    for (const [a, b, len] of pageGroups(1, q.to)) {
      const use = (b - a + 1) * len;
      if (b === q.to && b !== 10 ** len - 1) {
        steps.push(`${fa(left)} رقم برای صفحه‌های ${LEN_FA[len]} می‌ماند: ${ltr(`${fa(left)} ÷ ${fa(len)} = ${fa(left / len)}`)} صفحه، یعنی صفحه‌های ${fa(a)} تا ${ltr(`${fa(last)} + ${fa(left / len)} = ${fa(b)}`)}.`);
      } else {
        steps.push(`صفحه‌های ${fa(a)} تا ${fa(b)} (${LEN_FA[len]}) ${fa(use)} رقم می‌خواهند: ${ltr(`${fa(left)} − ${fa(use)} = ${fa(left - use)}`)} رقم می‌ماند.`);
      }
      left -= use;
      last = b;
    }
    steps.push(`پس کتاب ${fa(q.answer)} صفحه دارد. امتحان: صفحه‌های ۱ تا ${fa(q.answer)} درست ${fa(pageDigits(1, q.answer))} رقم دارند ✓`);
    return steps;
  }
  const places = rangePlaces(1, q.from, q.to);
  const steps = q.from > 1 ? [`صفحه‌های ${fa(q.from)} و ${fa(q.to)} هر دو جزو فصل‌اند: ${ltr(`${fa(q.to)} − ${fa(q.from)} + ۱ = ${fa(q.to - q.from + 1)}`)} صفحه.`] : [];
  places.forEach((c, p) => {
    if (10 ** p <= q.to) steps.push(`رقم ۱ در ${PLACE[p]}: ${fa(c)} بار.`);
  });
  steps.push(`جمع: ${fa(q.answer)} بار. (صفحه‌ای مثل ${fa(q.to >= 111 && q.from <= 111 ? 111 : 11)} چند تا ۱ دارد و هر کدام جدا شمرده می‌شود.)`);
  return steps;
}

function cycleSteps(b: number, e: number): string[] {
  const c = unitCycle(b);
  const r = e % c.length;
  const pos = r === 0 ? c.length : r;
  return [
    `رقم یکان ${powFa(b, e)} فقط به رقم یکان ${fa(b)} (یعنی ${fa(b % 10)}) بستگی دارد. توان‌های پشت‌سرهم: ${list([...c, ...c].slice(0, Math.min(8, c.length * 2)))}، … هر ${fa(c.length)} تا تکرار می‌شود.`,
    `${ltr(`${fa(e)} ÷ ${fa(c.length)}`)}: باقی‌مانده ${fa(r)}${r === 0 ? `؛ باقی‌مانده ۰ یعنی خانه آخر چرخه (خانه ${fa(c.length)})` : `، یعنی خانه ${fa(pos)} چرخه`}: ${fa(powerUnit(b, e))}.`,
  ];
}

function unitsSteps(q: UnitsQuestion): string[] {
  if (q.kind === "product") {
    const us = q.factors.map((f) => f % 10);
    const steps = [`فقط رقم یکان هر عدد در رقم یکان حاصل اثر دارد: ${list(us)}.`];
    let acc = us[0];
    for (const u of us.slice(1)) {
      steps.push(`${ltr(`${fa(acc)} × ${fa(u)} = ${fa(acc * u)}`)}؛ رقم یکان: ${fa((acc * u) % 10)}.`);
      acc = (acc * u) % 10;
    }
    steps.push(`پس رقم یکان حاصل ${fa(q.answer)} است.`);
    return steps;
  }
  const steps = q.powers.flatMap(([b, e]) => cycleSteps(b, e));
  if (q.kind !== "power") {
    const [u1, u2] = q.powers.map(([b, e]) => powerUnit(b, e));
    const r = q.kind === "sum" ? u1 + u2 : u1 * u2;
    steps.push(`${ltr(`${fa(u1)} ${q.kind === "sum" ? "+" : "×"} ${fa(u2)} = ${fa(r)}`)}؛ رقم یکان: ${fa(q.answer)}.`);
  }
  return steps;
}

export function moreSteps(q: MoreQuestion): string[] {
  switch (q.type) {
    case "lcm":
      return lcmSteps(q);
    case "crypt":
      return cryptSteps(q);
    case "signs":
      return signsSteps(q);
    case "pages":
      return pagesSteps(q);
    case "units":
      return unitsSteps(q);
  }
}

/** The answer in words. */
export function moreAnswerFa(q: MoreQuestion): string {
  switch (q.type) {
    case "lcm":
      return q.ask === "clock" ? `ساعت ${timeFa(q.start + lcmAll(q.nums))}` : n(q.answer);
    case "crypt":
      return q.letters.map((l, i) => `${l} = ${fa(q.solution[i])}`).join("، ");
    case "signs":
      return `${exprFa(q.nums, q.ops, q.paren)} ${ltr(`= ${fa(q.target)}`)}`;
    default:
      return n(q.answer);
  }
}

// ── Feedback ─────────────────────────────────────────────────────────────

export type Tone = "good" | "turned" | "bad";

function lcmFeedback(q: LcmQuestion, tag: string, v: number): string | null {
  const L = lcmAll(q.nums);
  const P = q.nums.reduce((p, x) => p * x, 1);
  const times = ltr(q.nums.map((x) => fa(x)).join(" × "));
  switch (tag) {
    case "product":
      return `عددها را در هم ضرب کردی (${times} = ${fa(P)}). این هم مضرب مشترک است، اما کوچک‌ترین نیست؛ ${q.nums.length === 2 ? "دو" : "این"} عدد شمارنده مشترک دارند.`;
    case "swapped":
      return q.ask === "gcd" ? `این کوچک‌ترین مضرب مشترک (ک.م.م) است. برای بریدن یا بسته‌بندی برابر، عددی لازم است که هر دو عدد بر آن بخش‌پذیر باشند: بزرگ‌ترین شمارنده مشترک (ب.م.م).` : `این بزرگ‌ترین شمارنده مشترک (ب.م.م) است. «دوباره با هم» یعنی عددی که بر هر دو بخش‌پذیر باشد: کوچک‌ترین مضرب مشترک (ک.م.م).`;
    case "pairOnly":
      return `${n(v)} فقط برای دو تا از عددها مضرب مشترک است؛ عدد سوم هم باید آن را بشمارد.`;
    case "notLeast":
      return q.ask === "clock" ? `در آن ساعت هم با هم حرکت می‌کنند، اما پیش از آن هم یک بار با هم حرکت کرده‌اند: کوچک‌ترین مضرب مشترک را بگیر.` : `${n(v)} مضرب مشترک است، اما کوچک‌ترین نیست.`;
    case "notGreatest":
      return `${n(v)} شمارنده مشترک است، اما بزرگ‌ترین نیست؛ ${q.ask === "gcd" && q.story === 1 ? "بسته‌های بیشتری" : "تکه‌های بلندتری"} هم ممکن است.`;
    case "pieceLength":
      return `${n(v)} سانتی‌متر طول هر تکه است؛ پرسش تعداد همه تکه‌ها را می‌خواهد.`;
    case "oneRibbon":
      return `${n(v)} تکه فقط از یک روبان است؛ تکه‌های روبان دیگر را هم اضافه کن.`;
    case "forgotStart":
      return `${n(L)} دقیقه درست است، اما پرسش ساعت را می‌خواهد: ${fa(L)} دقیقه را به ساعت ${timeFa(q.start)} اضافه کن.`;
    case "badTime":
      return `این ساعت درستی نیست؛ دقیقه از ۵۹ بیشتر نمی‌شود. مثلاً ۸:۰۵ را ۸۰۵ بزن.`;
  }
  return null;
}

function cryptFeedback(q: CryptQuestion, tag: string, value: string): string | null {
  const vals = value.split("").map(Number);
  const t = rowValue(q.top, vals);
  const b = rowValue(q.bottom, vals);
  const s = rowValue(q.sum, vals);
  const yours = `با رقم‌های تو: ${ltr(`${fa(t)} + ${fa(b)} = ${fa(t + b)}`)}، اما حاصل نوشته‌شده ${n(s)} می‌شود.`;
  switch (tag) {
    case "repeatedDigit": {
      const i = vals.findIndex((d, j) => vals.indexOf(d) !== j);
      const j = vals.indexOf(vals[i]);
      return `${q.letters[j]} و ${q.letters[i]} هر دو ${fa(vals[i])} شده‌اند؛ حرف‌های متفاوت رقم‌های متفاوت دارند.`;
    }
    case "leadingZero": {
      const first = [q.top, q.bottom, q.sum].map((r) => r[0]).find((c) => r0(c) && vals[c - LETTER] === 0)!;
      return `${q.letters[first - LETTER]} اول یک عدد آمده، پس صفر نمی‌شود؛ عدد چندرقمی با صفر شروع نمی‌شود.`;
    }
    case "noCarry":
      return `هر ستون را جدا جمع کردی، اما ده‌بر را به ستون بعد نبردی. ${yours}`;
    case "column": {
      const cols = cryptColumns(q, vals);
      const bad = cols.findIndex((c) => !c.ok);
      return `ستون یکان درست است، اما ستون ${PLACE[bad]} نه${cols[bad].carry ? " (ده‌بر را هم حساب کن)" : ""}. ${yours}`;
    }
    case "notSum":
      return `ستون یکان درست درنمی‌آید. ${yours}`;
  }
  return null;
}
const r0 = (c: number) => c >= LETTER;

function signsFeedback(q: SignsQuestion, tag: string, value: string): string | null {
  const ops = value.split("").map((d) => Number(d) - 1);
  const v = fracFa(signsValue(q.nums, ops, q.paren));
  const e = exprFa(q.nums, ops, q.paren);
  switch (tag) {
    case "leftToRight":
      return `از چپ به راست حساب کردی؛ اما ضرب و تقسیم پیش از جمع و تفریق انجام می‌شوند: ${e} = ${v}، نه ${fa(q.target)}.`;
    case "ignoreParens":
      return `بدون پرانتز درست بود، اما پرانتز اول حساب می‌شود: ${e} = ${v}، نه ${fa(q.target)}.`;
    case "wrongValue":
      return `با علامت‌های تو ${e} = ${v} می‌شود، نه ${fa(q.target)}.`;
  }
  return null;
}

function pagesFeedback(q: PagesQuestion, tag: string): string | null {
  const len = String(q.to).length;
  switch (tag) {
    case "noOnes":
      return q.ask === "pages" ? `۹ رقم صفحه‌های یک‌رقمی (۱ تا ۹) را کم نکردی.` : `صفحه‌های یک‌رقمی (۱ تا ۹) را جا انداختی: آن‌ها هم ۹ رقم دارند.`;
    case "tensAsOne":
      return `صفحه‌های ۱۰ تا ۹۹ هر کدام دو رقم دارند، نه یک رقم: ۹۰ صفحه × ۲ = ۱۸۰ رقم.`;
    case "allSame":
      return `همه صفحه‌ها ${LEN_FA[len]} نیستند: ۱ تا ۹ یک‌رقمی‌اند${len > 2 ? " و ۱۰ تا ۹۹ دورقمی" : ""}. هر دسته را جدا بشمار.`;
    case "divideAll":
      return `همه رقم‌ها را بر ${fa(len)} تقسیم کردی؛ اما صفحه‌های ۱ تا ۹ یک رقم${len > 2 ? " و ۱۰ تا ۹۹ دو رقم" : ""} دارند. اول رقم‌های آن دسته‌ها را کم کن.`;
    case "rangeOnly":
      return `این تعداد صفحه‌های ${LEN_FA[len]} است؛ شماره آخرین صفحه را می‌خواهیم: صفحه‌های پیش از آن (۱ تا ${fa(10 ** (len - 1) - 1)}) را هم اضافه کن.`;
    case "offByOne":
      if (q.ask === "digits") return `یک صفحه کم یا زیاد شمردی: از ${fa(10)} تا ${fa(99)}، ${ltr("۹۹ − ۱۰ + ۱ = ۹۰")} صفحه است${q.to >= 100 ? `، و از ۱۰۰ تا ${fa(q.to)}، ${fa(q.to - 99)} صفحه` : ""}.`;
      if (q.ask === "pages") return `یکی کم یا زیاد شد: صفحه‌های ${LEN_FA[len]} از ${fa(10 ** (len - 1))} شروع می‌شوند؛ پس x صفحه ${LEN_FA[len]} یعنی تا صفحه ${ltr(`${fa(10 ** (len - 1) - 1)} + x`)}.`;
      return `صفحه اول یا آخر فصل را جا انداختی: صفحه ${fa(q.from)} و صفحه ${fa(q.to)} هر دو جزو فصل‌اند.`;
    case "numbersOnly":
      return `صفحه‌هایی را شمردی که رقم ۱ دارند؛ اما صفحه‌ای مثل ۱۱ دو تا ۱ دارد و دو بار حساب می‌شود.`;
    case "onesOnly":
      return `فقط رقم ۱ در یکان را شمردی؛ در دهگان${q.to >= 100 ? " و صدگان" : ""} هم بشمار.`;
    case "noHundreds":
      return `یکان و دهگان درست، اما رقم ۱ در صدگان (صفحه‌های ۱۰۰ تا ۱۹۹) را جا انداختی.`;
  }
  return null;
}

function unitsFeedback(q: UnitsQuestion, tag: string): string | null {
  switch (tag) {
    case "addedUnits":
      return `رقم‌های یکان را جمع کردی؛ در ضرب، رقم‌های یکان را در هم ضرب کن.`;
    case "missedFactor":
      return `فقط دو عدد اول را ضرب کردی؛ عدد سوم (${fa(q.factors[2])}) را هم ضرب کن.`;
    case "multipliedExp":
      return `پایه را در توان ضرب کردی؛ اما توان یعنی چند بار ضرب پایه در خودش، نه ضرب در توان. چرخه رقم‌های یکان را بنویس.`;
    case "cyclePos":
      return `جای خانه در چرخه یکی جابه‌جا شد: باقی‌مانده ۱ یعنی خانه اول، باقی‌مانده ۲ خانه دوم، … و باقی‌مانده ۰ یعنی خانه آخر چرخه.`;
    case "baseOnly":
      return `توان را نادیده گرفتی: رقم یکان پایه با رقم یکان توانش یکی نیست.`;
    case "wrongOp":
      return `رقم‌های یکان درست بودند، اما ${q.kind === "sum" ? "باید جمعشان کنی، نه ضرب" : "باید ضربشان کنی، نه جمع"}.`;
  }
  return null;
}

export function moreFeedback(q: MoreQuestion, value: string): { tone: Tone; text: string } {
  const steps = moreSteps(q);
  const how = steps.slice(-2).join(" ");
  const right = `جواب: ${moreAnswerFa(q)}. ${how}`;
  const tag = moreMistake(q, value);
  if (tag === "right") return { tone: "good", text: `درست است! ${how}` };
  const v = Number(value);
  const named =
    q.type === "lcm" ? lcmFeedback(q, tag, v) : q.type === "crypt" ? cryptFeedback(q, tag, value) : q.type === "signs" ? signsFeedback(q, tag, value) : q.type === "pages" ? pagesFeedback(q, tag) : unitsFeedback(q, tag);
  if (!named) return { tone: "bad", text: `${q.type === "lcm" && q.ask === "clock" && typedTimeFa(value) ? `تو ساعت ${typedTimeFa(value)} را زدی. ` : ""}${right}` };
  // A plain wrong sum or value is still a miss; a named slip is "nearly".
  const tone: Tone = tag === "notSum" || tag === "wrongValue" || tag === "badTime" ? "bad" : "turned";
  return { tone, text: `${named} ${right}` };
}

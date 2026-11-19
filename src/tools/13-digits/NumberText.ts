// Words for primes and divisors, and odd and even (tool 13): prompts, worked
// steps (for «نشانم بده», the answer and the worksheet key) and feedback that
// names the slip. The boards in NumberBoards.tsx follow the same steps.

import {
  choiceWords,
  divisorCount,
  divisors,
  EVEN,
  isPrime,
  ODD,
  primeFactors,
  primePowers,
  rootFloor,
  seqTerms,
  smallestFactor,
  YES,
  type NumberQuestion,
  type ParityQuestion,
  type PrimeQuestion,
} from "@/generators/digits-numbers";
import { fa } from "@/tools/registry";

const ltr = (s: string) => `⁦${s}⁩`;
const n = (x: number | string) => ltr(fa(x));
const list = (xs: (number | string)[]) => xs.map((x) => fa(x)).join("، ");
const times = (xs: number[]) => ltr(xs.map((x) => fa(x)).join(" × "));
const parityFa = (c: number) => (c === EVEN ? "زوج" : "فرد");
const parityOfFa = (x: number) => (x % 2 ? "فرد" : "زوج");

// ── Shared working: which numbers are tried, and the factor tree ─────────

/** The primes to try for "is n prime": those whose square is at most n, up to the first that divides n. */
export function primeTrials(N: number): number[] {
  const out: number[] = [];
  for (let p = 2; p * p <= N; p++) {
    if (!isPrime(p)) continue;
    out.push(p);
    if (N % p === 0) break;
  }
  return out;
}

/** The numbers tried when listing divisors in pairs: 1 up to the largest whose square is at most n. */
export const pairTrials = (N: number) => Array.from({ length: rootFloor(N) }, (_, i) => i + 1);

/** The factor tree as splits: [what is split, the prime taken off, what is left]. */
export function treeSplits(N: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let m = N; !isPrime(m) && m > 1; ) {
    const p = smallestFactor(m);
    out.push([m, p, m / p]);
    m /= p;
  }
  return out;
}

/** Numbers 1 … answer in rows of ten, for "smallest with k divisors". */
export const smallestRows = (answer: number) => Math.ceil(answer / 10);

/** Which way the working goes. */
export const primeWay = (q: PrimeQuestion) => (q.ask === "isPrime" ? (q.n <= 2 ? "tiny" : "trial") : q.ask === "factor" || (q.ask === "count" && q.level === 3) ? "tree" : q.ask === "smallest" ? "smallest" : "pairs");

/** Primes with their exponents, in words: "۲ سه بار و ۳ دو بار". */
const TIMES_FA = ["", "یک بار", "دو بار", "سه بار", "چهار بار", "پنج بار"];
const powersFa = (N: number) =>
  primePowers(N)
    .map(([p, e]) => `${fa(p)} ${TIMES_FA[e]}`)
    .join(" و ");

/** The pairs of divisors of N, written "۱ × ۳۶". */
export const pairsFa = (N: number) =>
  divisors(N)
    .filter((d) => d * d <= N)
    .map((d) => times([d, N / d]))
    .join("، ");

// ── Prompts ──────────────────────────────────────────────────────────────

function primePrompt(q: PrimeQuestion, paper: boolean) {
  switch (q.ask) {
    case "isPrime":
      return `آیا ${n(q.n)} عدد اول است؟`;
    case "count":
      return q.level === 3 ? `عدد ${n(q.n)} چند شمارنده دارد؟ (راهنما: اول آن را به عامل‌های اول تجزیه کن.)` : `عدد ${n(q.n)} چند شمارنده (مقسوم‌علیه) دارد؟`;
    case "smallest":
      return `کوچک‌ترین عددی که دقیقاً ${fa(q.k)} شمارنده دارد چیست؟`;
    case "factor":
      return `عدد ${n(q.n)} را به صورت ضرب عددهای اول بنویس.${paper ? "" : " (روی دکمه هر عامل بزن تا به ضرب اضافه شود؛ عامل تکراری را دوباره بزن.)"}`;
    case "sum":
      return `مجموع همه شمارنده‌های ${n(q.n)} چند است؟`;
  }
}

const LETTERS = ["الف", "ب", "پ"];
const OPS_FA = [" + ", " − ", " × "];

/** "الف و ب هر دو فردند" / "الف فرد و ب زوج است". */
function ruleGiven(q: ParityQuestion) {
  const ps = q.nums.map((x) => (x ? "فرد" : "زوج"));
  if (ps.every((p) => p === ps[0])) return `${q.nums.length === 2 ? "الف و ب هر دو" : "الف، ب و پ هر سه"} عددهایی ${ps[0]}‌اند`;
  return `${q.nums.map((_, i) => `${LETTERS[i]} عددی ${ps[i]}`).join(q.nums.length === 2 ? " و " : "، ")} است`;
}

export const ruleExprFa = (q: ParityQuestion) => ltr(q.nums.map((_, i) => LETTERS[i]).join(OPS_FA[q.op]));
export const exprFa = (q: ParityQuestion) => ltr(q.nums.map((x) => fa(x)).join(OPS_FA[q.op]));

/** A run written short: "۱ + ۲ + ۳ + … + ۴۰". */
export function seqFa(q: ParityQuestion) {
  const t = seqTerms(q);
  return ltr(`${t.slice(0, 3).map((x) => fa(x)).join(" + ")} + … + ${fa(t[t.length - 1])}`);
}

/** The signs puzzle: "۱ ؟ ۲ ؟ ۳ ؟ ۴"; with signs (0 +, 1 −) when given. */
export function signsRowFa(N: number, signs?: number[]) {
  return ltr(Array.from({ length: N }, (_, i) => (i === 0 ? fa(1) : `${signs ? (signs[i - 1] ? "−" : "+") : "؟"} ${fa(i + 1)}`)).join(" "));
}

const DOMINO_CUT = ["", "، که یک خانه گوشه‌اش بریده شده است", "، که دو خانه گوشه‌ای روبه‌روی هم (دو سر یک قطر) بریده شده‌اند"];

function parityPrompt(q: ParityQuestion) {
  switch (q.ask) {
    case "expr":
      return `بدون حساب کردن حاصل بگو: ${exprFa(q)} زوج است یا فرد؟`;
    case "rule":
      return `${ruleGiven(q)}${q.op === 1 ? " (الف از ب بزرگ‌تر است)" : ""}. حاصل ${ruleExprFa(q)} زوج است یا فرد؟`;
    case "oddSum": {
      const [k] = q.nums;
      return [
        `${fa(k)} کیسه داریم و در هر کیسه تعداد فردی تیله هست. ممکن است روی هم درست ${fa(q.target)} تیله باشد؟`,
        `${fa(k)} عدد فرد را با هم جمع می‌کنیم (عدد تکراری هم مجاز است). ممکن است حاصل ${fa(q.target)} شود؟`,
        `${fa(k)} دوست هر کدام تعداد فردی مداد دارند. ممکن است روی هم درست ${fa(q.target)} مداد داشته باشند؟`,
      ][q.variant];
    }
    case "mixed":
      return `${fa(q.nums[0])} عدد فرد و ${fa(q.nums[1])} عدد زوج را با هم جمع می‌کنیم. حاصل زوج است یا فرد؟`;
    case "seq":
      return `بدون حساب کامل بگو: حاصل ${seqFa(q)} زوج است یا فرد؟${q.variant === 2 ? " (همه عددهای فرد از ۱ تا " + fa(q.nums[1]) + ")" : ""}`;
    case "handshake": {
      const [p, k] = q.nums;
      return q.variant === 0
        ? `در یک مهمانی ${fa(p)} نفر هستند و هر دو نفر حداکثر یک بار با هم دست می‌دهند. ممکن است هر نفر دقیقاً با ${fa(k)} نفر دیگر دست داده باشد؟`
        : `${fa(p)} شهر داریم. می‌خواهیم بین بعضی از آن‌ها جاده بکشیم (هر جاده دو شهر را به هم وصل می‌کند و بین دو شهر حداکثر یک جاده است)، طوری که از هر شهر دقیقاً ${fa(k)} جاده بیرون برود. ممکن است؟`;
    }
    case "domino": {
      const [a, b] = q.nums;
      return `صفحه‌ای ${fa(a)} در ${fa(b)} خانه داریم${DOMINO_CUT[q.variant]}. می‌خواهیم همه خانه‌هایش را با دومینوهای ۱ در ۲ بپوشانیم (هر دومینو دقیقاً دو خانه کنار هم را می‌پوشاند؛ روی هم افتادن و بیرون زدن ممنوع). ممکن است؟`;
    }
    case "cups": {
      const [c, u] = q.nums;
      return `${fa(c)} لیوان روی میز است: ${u === c ? "همه" : `${fa(u)} تا`} رو به بالا${u === c ? "" : " و بقیه وارونه"}. در هر حرکت باید دقیقاً دو لیوان را برگردانی (هر دو لیوانی که بخواهی). ممکن است بعد از چند حرکت همه لیوان‌ها وارونه باشند؟`;
    }
    case "signs":
      return `در ${signsRowFa(q.nums[0])} به جای هر ؟ یکی از علامت‌های + یا − را بگذار. ممکن است حاصل ${fa(q.target)} شود؟`;
  }
}

export function numberPrompt(q: NumberQuestion, paper = false): string {
  return q.type === "prime" ? primePrompt(q, paper) : parityPrompt(q);
}

// ── Worked steps ─────────────────────────────────────────────────────────

const PRIME_DEF = "عدد اول دقیقاً دو شمارنده دارد: ۱ و خودش.";

function trialStep(N: number, d: number) {
  const r = N % d;
  return r ? `${ltr(`${fa(N)} ÷ ${fa(d)}`)}: باقی‌مانده ${fa(r)} ✗` : `${ltr(`${fa(N)} ÷ ${fa(d)} = ${fa(N / d)}`)} ✓`;
}

function primeSteps(q: PrimeQuestion): string[] {
  const N = q.n;
  switch (primeWay(q)) {
    case "tiny":
      return N === 1 ? [PRIME_DEF, "۱ فقط یک شمارنده دارد (خودش)؛ پس ۱ اول نیست (مرکب هم نیست)."] : [PRIME_DEF, "۲ فقط بر ۱ و ۲ بخش‌پذیر است؛ پس اول است. ۲ تنها عدد اول زوج است."];
    case "trial": {
      const ps = primeTrials(N);
      const last = ps[ps.length - 1];
      const hit = N % last === 0;
      let next = last + 1;
      while (!isPrime(next)) next++;
      const steps = [
        `${PRIME_DEF} کافی است بخش‌پذیری بر عددهای اول را امتحان کنی، تا جایی که مربعشان از ${fa(N)} بیشتر نشود${hit ? "" : `: ${list(ps)} (چون ${ltr(`${fa(next)} × ${fa(next)} = ${fa(next * next)}`)} بیشتر از ${fa(N)} است)`}.`,
      ];
      for (const p of ps) steps.push(trialStep(N, p));
      steps.push(hit ? `${ltr(`${fa(N)} = ${fa(last)} × ${fa(N / last)}`)}؛ پس ${fa(N)} شمارنده‌ای جز ۱ و خودش دارد و اول نیست.` : `هیچ‌کدام ${fa(N)} را نمی‌شمارد؛ پس ${fa(N)} فقط دو شمارنده دارد و اول است.`);
      return steps;
    }
    case "pairs": {
      const s = rootFloor(N);
      const steps = [`شمارنده‌ها جفت‌جفت پیدا می‌شوند: اگر d عدد ${fa(N)} را بشمارد، ${ltr(`${fa(N)} ÷ d`)} هم می‌شمارد. از ۱ شروع کن (۱ و ${fa(N)} هم شمارنده‌اند) و تا جایی برو که d × d از ${fa(N)} بیشتر نشود.`];
      for (const d of pairTrials(N)) {
        if (N % d) steps.push(`${fa(d)}: ✗`);
        else if (d * d === N) steps.push(`${ltr(`${fa(d)} × ${fa(d)} = ${fa(N)}`)} ✓ (این جفت فقط یک شمارنده است: ${fa(d)})`);
        else steps.push(`${ltr(`${fa(d)} × ${fa(N / d)} = ${fa(N)}`)} ✓ (دو شمارنده)`);
      }
      const ds = divisors(N);
      const stop = `${ltr(`${fa(s + 1)} × ${fa(s + 1)} = ${fa((s + 1) * (s + 1))}`)} بیشتر از ${fa(N)} است؛ بس است.`;
      if (q.ask === "sum") {
        steps.push(`${stop} شمارنده‌ها: ${list(ds)}.`);
        steps.push(`جمع: ${ltr(ds.map((d) => fa(d)).join(" + "))} = ${fa(q.answer)}.`);
      } else steps.push(`${stop} شمارنده‌ها: ${list(ds)}؛ روی هم ${fa(ds.length)} تا.`);
      return steps;
    }
    case "tree": {
      const steps = ["درخت عامل‌ها: هر بار کوچک‌ترین عامل اول را جدا کن؛ عدد اول (در دایره) دیگر شکسته نمی‌شود."];
      for (const [m, p, r] of treeSplits(N)) steps.push(`${ltr(`${fa(m)} = ${fa(p)} × ${fa(r)}`)}`);
      steps.push(`پس ${ltr(`${fa(N)} = ${primeFactors(N).map((x) => fa(x)).join(" × ")}`)}؛ همه عامل‌ها اول‌اند و ${q.ask === "factor" ? "به جز ترتیب، راه دیگری برای نوشتنش نیست" : `${powersFa(N)} آمده است`}.`);
      if (q.ask === "count") {
        const pw = primePowers(N);
        steps.push(
          `هر شمارنده از هر عامل اول، از صفر تا همه‌اش را برمی‌دارد: ${pw.map(([p, e]) => `${fa(p)}: ${fa(e + 1)} حالت (۰ تا ${fa(e)} بار)`).join("، ")}. پس ${ltr(pw.map(([, e]) => `(${fa(e)} + ۱)`).join(" × "))} = ${fa(q.answer)} شمارنده.`,
        );
      }
      return steps;
    }
    case "smallest": {
      const steps = [`عددها را از ۱ به بالا امتحان کن و شمارنده‌هایشان را بشمار؛ اولین عددی که ${fa(q.k)} شمارنده دارد جواب است.`];
      const rows = smallestRows(q.answer);
      for (let r = 0; r < rows; r++) {
        const lo = r * 10 + 1;
        const hi = Math.min(q.answer, lo + 9);
        steps.push(hi === q.answer ? `${fa(lo)} تا ${fa(hi)}: ${fa(q.answer)} اولین عدد با ${fa(q.k)} شمارنده است (${list(divisors(q.answer))}).` : `${fa(lo)} تا ${fa(hi)}: هیچ‌کدام ${fa(q.k)} شمارنده ندارد.`);
      }
      const pp = 2 ** (q.k - 1);
      steps.push(`پس ${fa(q.answer)}.${pp !== q.answer ? ` (${ltr(`${fa(pp)} = ۲ به توان ${fa(q.k - 1)}`)} هم ${fa(q.k)} شمارنده دارد، اما بزرگ‌تر است.)` : ""}`);
      return steps;
    }
  }
}

/** The number of odd terms in a parity question that adds things. */
function oddTerms(q: ParityQuestion) {
  if (q.ask === "rule") return q.nums.filter((x) => x === 1).length;
  if (q.ask === "expr") return q.nums.filter((x) => x % 2).length;
  if (q.ask === "oddSum") return q.nums[0];
  if (q.ask === "mixed") return q.nums[0];
  return seqTerms(q).filter((x) => x % 2).length;
}

const PAIRS = "هر عدد را جفت‌جفت بچین: در عدد زوج همه نقطه‌ها جفت می‌شوند؛ عدد فرد یک نقطه تنها دارد.";

/** Lone dots pairing up: "۳ نقطه تنها: یک جفت و یکی تنها". */
function lonesFa(k: number) {
  return k % 2 ? `${fa(k)} نقطه تنها: ${k > 1 ? `${fa((k - 1) / 2)} جفت می‌شوند و ` : ""}یکی بی‌جفت می‌ماند؛ پس جمع فرد است.` : `${fa(k)} نقطه تنها: ${k ? `دوتا دوتا جفت می‌شوند (${fa(k / 2)} جفت)` : "هیچ نقطه تنهایی نیست"}؛ پس جمع زوج است.`;
}

/** A sum of k odd numbers making T, when there is one: 1 + 1 + … + x. */
export function oddWitness(k: number, T: number) {
  const big = T - (k - 1);
  return ltr(`${Array.from({ length: k - 1 }, () => fa(1)).join(" + ")} + ${fa(big)} = ${fa(T)}`);
}

/** Who shakes whose hand round the table, when it is possible. */
export function circleNote(p: number, k: number) {
  return `${fa(p)} نفر دور یک میز گرد بنشینند؛ هر نفر با ${k >= 2 ? `${fa(Math.floor(k / 2))} نفرِ نزدیک‌ترِ هر طرفش` : ""}${k % 2 ? `${k >= 2 ? " و " : ""}نفر روبه‌رویی‌اش` : ""} دست بدهد: هر نفر درست ${fa(k)} دست.`;
}

function paritySteps(q: ParityQuestion): string[] {
  switch (q.ask) {
    case "expr":
    case "rule": {
      const given = q.ask === "expr" ? `${q.nums.map((x) => `${fa(x)} ${parityOfFa(x)} است (یکانش ${fa(x % 10)})`).join("، ")}.` : `${ruleGiven(q)}.`;
      const k = oddTerms(q);
      const how =
        q.op === 2
          ? k === q.nums.length
            ? `ضرب یعنی چند دسته برابر: ${q.ask === "expr" ? times(q.nums) : ruleExprFa(q)} یعنی تعداد فردی دسته که هر کدام یک نقطه تنها دارد؛ نقطه‌های تنها فردتا هستند و یکی بی‌جفت می‌ماند. فرد × فرد = فرد.`
            : `ضرب یعنی چند دسته برابر. وقتی یکی از عددها زوج است، یا هر دسته جفت‌جفت است یا تعداد دسته‌ها زوج است؛ پس همه نقطه‌ها جفت می‌شوند. هر عدد × زوج = زوج.`
          : `${q.op === 1 ? "در تفریق هم زوج و فرد بودن مثل جمع است (اگر الف − ب = پ، آن‌وقت ب + پ = الف). " : ""}در جمع، نقطه‌های تنها با هم جفت می‌شوند. ${lonesFa(k)}`;
      const check = q.ask === "expr" ? ` (امتحان: ${ltr(`${exprFa(q)} = ${fa(q.op === 0 ? q.nums[0] + q.nums[1] : q.op === 1 ? q.nums[0] - q.nums[1] : q.nums[0] * q.nums[1])}`)})` : "";
      return [PAIRS, given, how, `پس حاصل ${parityFa(q.answer)} است.${check}`];
    }
    case "oddSum": {
      const [k] = q.nums;
      const sumParity = k % 2 ? ODD : EVEN;
      return [
        `هر عدد فرد یک نقطه تنها دارد؛ ${fa(k)} عدد فرد یعنی ${fa(k)} نقطه تنها. هر چه عددها باشند، فقط همین نقطه‌های تنها مهم‌اند.`,
        lonesFa(k),
        q.answer === YES ? `${fa(q.target)} هم ${parityFa(sumParity)} است؛ پس ممکن است. مثلاً ${oddWitness(k, q.target)}.` : `اما ${fa(q.target)} ${parityOfFa(q.target)} است؛ پس ممکن نیست.`,
      ];
    }
    case "mixed": {
      const [a, b] = q.nums;
      return [`عددهای زوج نقطه تنها ندارند؛ پس ${fa(b)} عدد زوج در جواب اثری ندارند. فقط عددهای فرد را بشمار.`, `${fa(a)} عدد فرد یعنی ${lonesFa(a)}`, `پس حاصل ${parityFa(q.answer)} است.`];
    }
    case "seq": {
      const t = seqTerms(q);
      const odd = t.filter((x) => x % 2);
      const total = t.reduce((s, x) => s + x, 0);
      return [
        `عددهای زوج نقطه تنها ندارند؛ فقط تعداد عددهای فرد در این جمع مهم است.`,
        `${fa(t.length)} عدد داریم${q.variant === 2 ? " که همه فردند" : `؛ عددهای فردشان ${odd.length > 6 ? `${list(odd.slice(0, 3))}، …، ${fa(odd[odd.length - 1])}` : list(odd)} است`}: ${fa(odd.length)} عدد فرد.`,
        lonesFa(odd.length),
        `پس حاصل ${parityFa(q.answer)} است. (امتحان: جمع ${fa(total)} است.)`,
      ];
    }
    case "handshake": {
      const [p, k] = q.nums;
      const first = `اگر دست‌دادن‌های هر نفر را بشماریم و همه را جمع کنیم، هر دست‌دادن دو بار شمرده می‌شود (یک بار برای هر کدام از دو نفر)؛ پس این جمع همیشه زوج است.`;
      const sum = `جمع این‌جا: ${ltr(`${fa(p)} × ${fa(k)} = ${fa(p * k)}`)}، که ${parityOfFa(p * k)} است.`;
      return q.answer === YES ? [first, `${sum} پس مانعی نیست.`, `${q.variant === 1 ? "شهرها را دور یک دایره بچین. " : ""}${circleNote(p, k)} پس ممکن است.`] : [first, sum, `جمعِ فرد ممکن نیست؛ پس ممکن نیست.`];
    }
    case "domino": {
      const [a, b] = q.nums;
      const cells = a * b - q.variant;
      const first = `هر دومینو دقیقاً دو خانه را می‌پوشاند؛ پس دومینوها روی هم تعداد زوجی خانه می‌پوشانند.`;
      const count = `خانه‌ها: ${ltr(`${fa(a)} × ${fa(b)}${q.variant ? ` − ${fa(q.variant)}` : ""} = ${fa(cells)}`)}، که ${parityOfFa(cells)} است.`;
      if (q.variant === 2) {
        const dark = (a * b) / 2 - 2;
        return [
          first,
          `${count} پس شمردن خانه‌ها کافی نیست.`,
          `صفحه را مثل شطرنج دو جور کن: خانه‌های نقطه‌دار و بی‌نقطه، یکی در میان. هر دومینو دو خانه کنار هم را می‌پوشاند: یکی نقطه‌دار و یکی بی‌نقطه.`,
          `دو گوشه روبه‌رو هم‌جورند (هر دو نقطه‌دار). پس ${fa(dark)} خانه نقطه‌دار و ${fa(dark + 2)} خانه بی‌نقطه می‌ماند؛ برابر نیستند، پس ممکن نیست.`,
        ];
      }
      return q.answer === YES ? [first, `${count} پس مانعی نیست.`, `یک چیدمان درست روی صفحه کشیده شده است: ${q.variant === 1 ? "ردیف اول افقی، بقیه عمودی" : b % 2 === 0 ? "همه افقی" : "همه عمودی"}. پس ممکن است.`] : [first, count, `تعداد فردِ خانه را نمی‌شود با دوتایی‌ها پوشاند؛ پس ممکن نیست.`];
    }
    case "cups": {
      const [c, u] = q.nums;
      return [
        `لیوان‌های رو به بالا را بشمار: ${fa(u)} تا. هدف: ۰ لیوان رو به بالا.`,
        `هر حرکت دو لیوان را برمی‌گرداند: یا دو تا رو به بالا وارونه می‌شوند (۲ تا کم)، یا دو تا وارونه رو به بالا می‌شوند (۲ تا زیاد)، یا یکی این و یکی آن (بی‌تغییر).`,
        `پس زوج یا فرد بودن تعداد لیوان‌های رو به بالا هیچ‌وقت عوض نمی‌شود.`,
        q.answer === YES ? `${fa(u)} زوج است، مثل ۰. هر بار دو لیوانِ رو به بالا را برگردان: بعد از ${fa(u / 2)} حرکت همه ${fa(c)} لیوان وارونه‌اند. پس ممکن است.` : `${fa(u)} فرد است و ۰ زوج؛ پس ممکن نیست.`,
      ];
    }
    case "signs": {
      const [N] = q.nums;
      const S = (N * (N + 1)) / 2;
      return [
        `اگر همه علامت‌ها + باشند: ${signsRowFa(N, Array(N - 1).fill(0))} = ${fa(S)}، که ${parityOfFa(S)} است.`,
        `اگر + جلوی عدد x را − کنیم، حاصل به اندازه ${ltr("2 × x")} کم می‌شود: یک عدد زوج. پس حاصل، هر علامتی بگذاری، مثل ${fa(S)} ${parityOfFa(S)} می‌ماند.`,
        q.answer === YES ? `${fa(q.target)} هم ${parityOfFa(q.target)} است و مثلاً ${signsRowFa(N, q.witness)} = ${fa(q.target)}. پس ممکن است.` : `اما ${fa(q.target)} ${parityOfFa(q.target)} است؛ پس ممکن نیست.`,
      ];
    }
  }
}

export function numberSteps(q: NumberQuestion): string[] {
  return q.type === "prime" ? primeSteps(q) : paritySteps(q);
}

/** The answer in words. */
export function numberAnswerFa(q: NumberQuestion): string {
  if (q.type === "parity") return choiceWords(q)[q.answer - 1];
  switch (q.ask) {
    case "isPrime":
      return q.answer === YES ? "بله، اول است" : q.n === 1 ? "نه؛ ۱ اول نیست" : `نه؛ ${ltr(`${fa(q.n)} = ${fa(smallestFactor(q.n))} × ${fa(q.n / smallestFactor(q.n))}`)}`;
    case "count":
      return `${fa(q.answer)} شمارنده`;
    case "factor":
      return ltr(`${fa(q.n)} = ${primeFactors(q.n).map((x) => fa(x)).join(" × ")}`);
    default:
      return n(q.answer);
  }
}

// ── Feedback ─────────────────────────────────────────────────────────────

const smallList = (v: number) => (divisorCount(v) <= 16 ? `: ${list(divisors(v))}` : "");

function primeFeedback(q: PrimeQuestion, tag: string, value: string): string | null {
  const N = q.n;
  const v = Number(value);
  const r = rootFloor(N);
  switch (tag) {
    case "oneIsPrime":
      return q.ask === "factor" ? `۱ را در تجزیه نمی‌نویسیم: ۱ عدد اول نیست (فقط یک شمارنده دارد) و ضرب در ۱ چیزی را عوض نمی‌کند.` : `۱ اول نیست: عدد اول دقیقاً دو شمارنده دارد، اما ۱ فقط یکی (خودش).`;
    case "twoEven":
      return `۲ زوج است، اما فقط دو شمارنده دارد (۱ و ۲)؛ پس اول است. ۲ تنها عدد اول زوج است.`;
    case "primeNo":
      return `${fa(N)} بر هیچ‌کدام از ${list(primeTrials(N))} بخش‌پذیر نیست؛ پس جز ۱ و خودش شمارنده‌ای ندارد.`;
    case "missedDivisor": {
      const p = smallestFactor(N);
      const why = p === 3 ? ` (مجموع رقم‌هایش ${fa(String(N).split("").reduce((s, d) => s + Number(d), 0))} بر ۳ بخش‌پذیر است)` : "";
      return `${fa(N)} بر ${fa(p)} بخش‌پذیر است${why}: ${ltr(`${fa(N)} = ${fa(p)} × ${fa(N / p)}`)}.`;
    }
    case "stoppedEarly": {
      const p = smallestFactor(N);
      return `زود دست کشیدی: باید تا جایی امتحان کنی که مربع عدد از ${fa(N)} بیشتر شود. ${ltr(`${fa(p)} × ${fa(p)} = ${fa(p * p)}`)} هنوز از ${fa(N)} کمتر است، و ${ltr(`${fa(N)} = ${fa(p)} × ${fa(N / p)}`)}.`;
    }
    case "noEnds":
      return q.ask === "sum" ? `۱ و خود ${fa(N)} را جمع نکردی؛ این دو هم شمارنده‌اند.` : `۱ و خود ${fa(N)} را نشمردی؛ هر عدد بر ۱ و بر خودش بخش‌پذیر است.`;
    case "oneEnd":
      return `یکی از دو شمارنده ۱ یا ${fa(N)} جا افتاده؛ هر دو شمرده می‌شوند.`;
    case "rootTwice":
      return `${ltr(`${fa(r)} × ${fa(r)} = ${fa(N)}`)}: این جفت فقط یک شمارنده است، اما تو ${fa(r)} را دو بار ${q.ask === "sum" ? "جمع کردی" : "شمردی"}.`;
    case "halfOnly":
      return `فقط شمارنده‌های کوچک (تا ${fa(r)}) را شمردی؛ هر کدام یک جفت بزرگ‌تر هم دارد: ${pairsFa(N)}.`;
    case "expProduct":
      return `توان‌ها را در هم ضرب کردی؛ اما هر عامل اول می‌تواند صفر بار هم در شمارنده بیاید (مثل شمارنده ۱). به هر توان یکی اضافه کن، بعد ضرب کن.`;
    case "expSum":
      return `(توان + ۱)ها را جمع کردی؛ باید در هم ضرب شوند، چون هر حالتِ یک عامل با هر حالتِ عامل دیگر یک شمارنده می‌سازد.`;
    case "noSelf":
      return `خود ${fa(N)} را جمع نکردی؛ هر عدد شمارنده خودش است.`;
    case "noOne":
      return `۱ را جمع نکردی؛ ۱ شمارنده همه عددهاست.`;
    case "countNotSum":
      return `${fa(v)} تعداد شمارنده‌هاست؛ پرسش جمع آن‌ها را می‌خواهد.`;
    case "primePower":
      return `${ltr(`${fa(v)} = ۲ به توان ${fa(q.k - 1)}`)} هم ${fa(q.k)} شمارنده دارد، اما کوچک‌ترین عدد با ${fa(q.k)} شمارنده نیست.`;
    case "notSmallest":
      return `${fa(v)} هم ${fa(q.k)} شمارنده دارد، اما کوچک‌ترین نیست.`;
    case "countIs":
      return `${fa(v)} ${fa(divisorCount(v))} شمارنده دارد${smallList(v)}؛ نه ${fa(q.k)} تا.`;
    case "productWrong": {
      const fs = value.split(".").map(Number);
      return `حاصل‌ضرب عامل‌های تو ${ltr(`${fs.map((x) => fa(x)).join(" × ")} = ${fa(fs.reduce((p, x) => p * x, 1))}`)} است، نه ${fa(N)}.`;
    }
    case "notPrimeFactor": {
      const c = value
        .split(".")
        .map(Number)
        .find((x) => x > 1 && !isPrime(x))!;
      return `ضرب درست است، اما ${fa(c)} اول نیست (${ltr(`${fa(c)} = ${primeFactors(c).map((x) => fa(x)).join(" × ")}`)})؛ آن را هم بشکن تا همه عامل‌ها اول شوند.`;
    }
  }
  return null;
}

function parityFeedback(q: ParityQuestion, tag: string): string | null {
  const minus = q.op === 1;
  switch (tag) {
    case "oddPlusOdd":
      return `فرد ${minus ? "−" : "+"} فرد زوج است: نقطه تنهای دو عدد فرد با هم یک جفت می‌سازند.`;
    case "evenPlusOdd":
      return `زوج و فرد را که ${minus ? "از هم کم کنی" : "جمع کنی"} حاصل فرد است: نقطه تنهای عدد فرد جفتی پیدا نمی‌کند.`;
    case "evenPlusEven":
      return `زوج ${minus ? "−" : "+"} زوج زوج است: هیچ نقطه تنهایی در کار نیست.`;
    case "timesEven":
      return `وقتی یکی از عددها زوج است، حاصل‌ضرب زوج است: مثلاً ${ltr("۳ × ۴")} یعنی سه دسته ۴تایی، و هر دسته ۴تایی جفت‌جفت می‌شود.`;
    case "oddTimesOdd":
      return `فرد × فرد فرد است: مثلاً ${ltr("۳ × ۵")} یعنی سه دسته ۵تایی؛ هر دسته یک نقطه تنها دارد و از سه نقطه تنها یکی بی‌جفت می‌ماند.`;
    case "ignoredCount":
      if (q.ask === "oddSum") return `تعداد عددها را نگاه نکردی: ${fa(q.nums[0])} عدد فرد یعنی ${fa(q.nums[0])} نقطه تنها، و چون ${fa(q.nums[0])} ${parityOfFa(q.nums[0])} است جمعشان ${parityOfFa(q.nums[0])} است؛ ${fa(q.target)} ${parityOfFa(q.target)} است.`;
      return `تعداد عددهای فرد را بشمار: هر دو نقطه تنها با هم جفت می‌شوند. اینجا ${fa(oddTerms(q))} عدد فرد هست؛ ${oddTerms(q) % 2 ? "یکی بی‌جفت می‌ماند" : "همه جفت می‌شوند"}.`;
    case "oddSumOdd":
      return `جمع عددهای فرد همیشه فرد نیست: ${fa(q.nums[0])} عدد فرد (تعدادی زوج) جمع زوج می‌دهد. مثلاً ${oddWitness(q.nums[0], q.target)}.`;
    case "countedAll":
      return q.ask === "mixed" ? `عددهای زوج را هم شمردی (${fa(q.nums[0] + q.nums[1])} عدد)؛ عدد زوج نقطه تنها ندارد. فقط تعداد عددهای فرد (${fa(q.nums[0])}) مهم است.` : `تعداد همه عددها (${fa(seqTerms(q).length)}) را نگاه کردی؛ فقط تعداد عددهای فرد (${fa(oddTerms(q))}) مهم است.`;
    case "lastOnly":
      return `فقط به عدد آخر نگاه کردی؛ زوج یا فرد بودن جمع به تعداد عددهای فرد بستگی دارد: اینجا ${fa(oddTerms(q))} عدد فرد هست.`;
    case "handshakeOdd":
      return `اگر ${q.variant === 0 ? "دست‌دادن‌های همه" : "جاده‌های همه شهرها"} را جمع کنیم، هر ${q.variant === 0 ? "دست‌دادن" : "جاده"} دو بار شمرده می‌شود؛ پس جمع باید زوج باشد. اما ${ltr(`${fa(q.nums[0])} × ${fa(q.nums[1])} = ${fa(q.nums[0] * q.nums[1])}`)} فرد است.`;
    case "dominoOdd":
      return `هر دومینو دو خانه می‌پوشاند، پس دومینوها روی هم تعداد زوجی خانه می‌پوشانند؛ اما ${fa(q.nums[0] * q.nums[1] - q.variant)} خانه داریم: فرد.`;
    case "sameColour":
      return `تعداد خانه‌ها زوج است، اما کافی نیست: صفحه را شطرنجی کن. هر دومینو یک خانه از هر جور می‌پوشاند، ولی دو گوشه روبه‌رو هم‌جورند؛ پس از یک جور دو خانه کمتر می‌ماند.`;
    case "cupsOdd":
      return `هر حرکت تعداد لیوان‌های رو به بالا را ۲ تا کم یا زیاد می‌کند یا تغییر نمی‌دهد؛ پس این تعداد همیشه فرد می‌ماند (مثل ${fa(q.nums[1])}) و به ۰ نمی‌رسد.`;
    case "signsParity": {
      const S = (q.nums[0] * (q.nums[0] + 1)) / 2;
      return `عوض کردن یک + به − حاصل را به اندازه دو برابر آن عدد کم می‌کند (عددی زوج)؛ پس حاصل همیشه مثل ${fa(S)} ${parityOfFa(S)} است، اما ${fa(q.target)} ${parityOfFa(q.target)} است.`;
    }
    case "notImpossible":
      switch (q.ask) {
        case "handshake":
          return `ممکن است: ${ltr(`${fa(q.nums[0])} × ${fa(q.nums[1])}`)} زوج است و مانعی نیست. ${circleNote(q.nums[0], q.nums[1])}`;
        case "domino":
          return `ممکن است: تعداد خانه‌ها زوج است و چیدمانش روی صفحه کشیده شده است.`;
        case "cups":
          return `ممکن است: ${fa(q.nums[1])} لیوانِ رو به بالا زوج‌تاست؛ هر بار دو تا از آن‌ها را برگردان.`;
        case "signs":
          return `ممکن است: ${signsRowFa(q.nums[0], q.witness)} = ${fa(q.target)}.`;
      }
  }
  return null;
}

export function numberFeedback(q: NumberQuestion, tag: string, value: string): string | null {
  return q.type === "prime" ? primeFeedback(q, tag, value) : parityFeedback(q, tag);
}

/** Tags that are a plain miss rather than a near miss. */
export const NUMBER_BAD_TAGS = new Set(["productWrong", "countIs"]);

// Words for tool 14. Sentences are lists of segments: text, a fraction (drawn
// stacked, never as "a/b" that bidi can scramble), or an equation kept left to
// right. The worksheet prompt is plain text, so there fractions are written in
// words ("سه‌چهارم") and drawn stacked beside the question.

import { percentBlocks, simplest, type Frac, type RatioQuestion, type RatioQuestionType } from "@/generators/ratio";
import { fa } from "@/tools/registry";

/** A fraction to draw; parts may be text like "۳ × ۲". */
export interface FracView {
  n: number | string;
  d: number | string;
}
export type EqPart = string | FracView;
export type Seg = string | FracView | { eq: EqPart[] };

export const isFracView = (s: unknown): s is FracView => typeof s === "object" && s !== null && "n" in s && "d" in s;

const F = (n: number | string, d: number | string): FracView => ({ n, d });
/** An equation: numbers become Persian digits, text stays as it is. */
const eq = (...parts: (EqPart | number)[]): Seg => ({ eq: parts.map((p) => (typeof p === "number" ? fa(p) : p)) });
/** "a op b = c" as one left-to-right piece. */
const calc = (a: number, op: string, b: number, c: number) => eq(`${fa(a)} ${op} ${fa(b)} = ${fa(c)}`);

export const RATIO_TYPE_LABEL: Record<RatioQuestionType, string> = {
  shade: "کسر روی شکل",
  partOf: "کسری از عدد",
  compare: "مقایسه کسرها",
  ratio: "نسبت",
  divide: "تقسیم به نسبت",
  percent: "درصد",
  work: "مسئله کار",
};

export const RATIO_THINGS = [
  { where: "در یک کلاس", a: "پسرها", b: "دخترها", all: "همه بچه‌های کلاس", unit: "نفر" },
  { where: "در یک کیسه", a: "مهره‌های قرمز", b: "مهره‌های آبی", all: "همه مهره‌ها", unit: "تا" },
  { where: "در یک سبد", a: "سیب‌ها", b: "پرتقال‌ها", all: "همه میوه‌ها", unit: "تا" },
  { where: "در یک قفسه", a: "کتاب‌های داستان", b: "کتاب‌های علمی", all: "همه کتاب‌ها", unit: "تا" },
];

export const PEOPLE = ["علی", "مریم", "رضا"];
const DIVIDE_ITEMS = ["گردو", "کارت", "مداد رنگی"];

const CARDINAL = ["صفر", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه", "ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده", "بیست"];
const ORDINAL: Record<number, string> = {
  2: "دوم",
  3: "سوم",
  4: "چهارم",
  5: "پنجم",
  6: "ششم",
  7: "هفتم",
  8: "هشتم",
  9: "نهم",
  10: "دهم",
  11: "یازدهم",
  12: "دوازدهم",
  13: "سیزدهم",
  14: "چهاردهم",
  15: "پانزدهم",
  16: "شانزدهم",
  18: "هجدهم",
  20: "بیستم",
};

/** "سه‌چهارم"; falls back to "۳ از ۴ قسمت". */
export function fracWords(f: Frac) {
  const top = CARDINAL[f.n];
  const bottom = ORDINAL[f.d];
  return top && bottom ? `${top}‌${bottom}` : `${fa(f.n)} از ${fa(f.d)} قسمت`;
}

/** Plain text of a sentence (worksheet prompts): fractions in words. */
export function segText(segs: Seg[]): string {
  return segs
    .map((s) => (typeof s === "string" ? s : isFracView(s) ? fracWords({ n: Number(s.n), d: Number(s.d) }) : `⁦${s.eq.map((p) => (typeof p === "string" ? p : `${p.n}/${p.d}`)).join("")}⁩`))
    .join("");
}

const shapeWord = (shape: "bar" | "circle") => (shape === "bar" ? "نوار" : "دایره");
const workWords = (q: Extract<RatioQuestion, { type: "work" }>) =>
  q.ctx === "tap"
    ? { time: "ساعت", thing: "مخزن", doers: ["شیر اول", "شیر دوم", "شیر سوم"], cells: "خانه" }
    : { time: "روز", thing: "دیوار", doers: ["علی", "رضا", "مریم"], cells: "تکه" };

const listFa = (xs: number[]) => (xs.length === 2 ? `${fa(xs[0])} و ${fa(xs[1])}` : `${xs.slice(0, -1).map(fa).join("، ")} و ${fa(xs[xs.length - 1])}`);
const ratioFa = (xs: number[]) => xs.map(fa).join(" به ");
const peopleFa = (n: number) => (n === 2 ? `${PEOPLE[0]} و ${PEOPLE[1]}` : `${PEOPLE[0]}، ${PEOPLE[1]} و ${PEOPLE[2]}`);

export function ratioPrompt(q: RatioQuestion, paper = false): Seg[] {
  switch (q.type) {
    case "shade":
      return [q.frac, ` این ${shapeWord(q.shape)} را ${paper ? "هاشور بزن" : "رنگ کن"}.`];
    case "partOf": {
      if (q.variant === "of") return [q.frac, ` از ${fa(q.whole)} چند است؟`];
      if (q.variant === "whole") return [q.frac, ` یک عدد، ${fa(q.part)} است. آن عدد چند است؟`];
      const N = fa(q.whole);
      if (q.item === 0) return [`${N} شیرینی داشتیم و `, q.frac, " آن‌ها را خوردیم. چند شیرینی ماند؟"];
      if (q.item === 1) return [`کتابی ${N} صفحه دارد. `, q.frac, " آن را خواندیم. چند صفحه مانده است؟"];
      return [`${N} مهره داشتیم و `, q.frac, " آن‌ها را به دوستمان دادیم. چند مهره برایمان ماند؟"];
    }
    case "compare":
      return paper ? ["کدام کسر بزرگ‌تر است؟ آن را دور بزن؛ اگر برابرند، هر دو را."] : ["کدام کسر بزرگ‌تر است؟ اگر برابرند، «برابرند» را بزن."];
    case "ratio": {
      const t = RATIO_THINGS[q.things];
      const [a, b] = q.ratio;
      const head = `${t.where}، نسبت ${t.a} به ${t.b}، ${ratioFa(q.ratio)} است. `;
      if (q.variant === "other") return [`${head}${t.a} ${fa(a * q.k)} ${t.unit} هستند. ${t.b} چند ${t.unit} هستند؟`];
      if (q.variant === "total") return [`${head}${t.a} ${fa(a * q.k)} ${t.unit} هستند. ${t.all} چند ${t.unit} هستند؟`];
      return [`${head}${t.b} ${fa((b - a) * q.k)} ${t.unit} بیشتر از ${t.a} هستند. ${t.a} چند ${t.unit} هستند؟`];
    }
    case "divide": {
      const item = DIVIDE_ITEMS[q.item];
      return [`${fa(q.total)} ${item} را بین ${peopleFa(q.ratio.length)} به نسبت ${ratioFa(q.ratio)} تقسیم کردیم. سهم ${PEOPLE[q.ask]} چند ${item} است؟`];
    }
    case "percent": {
      const [p, N, x] = [fa(q.pct), fa(q.whole), fa(q.part)];
      switch (q.variant) {
        case "of":
          return [`${p} درصد از ${N} چند است؟`];
        case "off":
          return q.item === 0
            ? [`قیمت یک کتاب ${N} هزار تومان است. با ${p} درصد تخفیف، قیمت آن چند هزار تومان می‌شود؟`]
            : [`کلاسی ${N} دانش‌آموز دارد و امروز ${p} درصد آن‌ها غایب‌اند. چند نفر حاضرند؟`];
        case "up":
          return q.item === 0
            ? [`گیاهی ${N} سانتی‌متر بود و ${p} درصد بلندتر شد. حالا چند سانتی‌متر است؟`]
            : [`قیمت یک توپ ${N} هزار تومان بود و ${p} درصد گران شد. قیمت تازه چند هزار تومان است؟`];
        case "whole":
          return [`${p} درصد از یک عدد، ${x} است. آن عدد چند است؟`];
        case "what":
          return [`${x} چند درصدِ ${N} است؟`];
      }
      break;
    }
    case "work": {
      const t = q.times;
      const tap = q.ctx === "tap";
      switch (q.variant) {
        case "single":
          return tap
            ? [`یک شیر آب، مخزنی را در ${fa(t[0])} ساعت پر می‌کند. در ${fa(q.hours)} ساعت چه کسری از مخزن پر می‌شود؟`]
            : [`علی دیواری را در ${fa(t[0])} روز رنگ می‌کند. در ${fa(q.hours)} روز چه کسری از دیوار رنگ می‌شود؟`];
        case "pairFraction":
          return tap
            ? [`شیر اول مخزنی را در ${fa(t[0])} ساعت و شیر دوم در ${fa(t[1])} ساعت پر می‌کند. اگر هر دو با هم باز باشند، در یک ساعت چه کسری از مخزن پر می‌شود؟`]
            : [`علی دیواری را در ${fa(t[0])} روز و رضا در ${fa(t[1])} روز رنگ می‌کند. اگر با هم کار کنند، در یک روز چه کسری از دیوار رنگ می‌شود؟`];
        case "pair":
          return tap
            ? [`شیر اول مخزنی را در ${fa(t[0])} ساعت و شیر دوم در ${fa(t[1])} ساعت پر می‌کند. اگر هر دو با هم باز باشند، مخزن خالی در چند ساعت پر می‌شود؟`]
            : [`علی دیواری را در ${fa(t[0])} روز و رضا در ${fa(t[1])} روز رنگ می‌کند. اگر با هم کار کنند، در چند روز آن را رنگ می‌کنند؟`];
        case "three":
          return [`سه شیر آب، مخزنی را جداگانه در ${listFa(t)} ساعت پر می‌کنند. اگر هر سه با هم باز باشند، مخزن خالی در چند ساعت پر می‌شود؟`];
        case "drain":
          return [`شیری مخزن خالی را در ${fa(t[0])} ساعت پر می‌کند. سوراخ ته مخزن، مخزن پر را در ${fa(t[1])} ساعت خالی می‌کند. اگر شیر و سوراخ هر دو باز باشند، مخزن خالی در چند ساعت پر می‌شود؟`];
        case "crew": {
          const [w1, d, w2] = q.crew;
          return [`${fa(w1)} کارگر، دیواری را در ${fa(d)} روز می‌سازند. ${fa(w2)} کارگر با همان سرعت، آن را در چند روز می‌سازند؟`];
        }
      }
    }
  }
  return [];
}

/** Numbers for the bar-model of a percent: blocks, percent per block, value per block, blocks in the percent. */
export function percentParts(q: { pct: number; whole: number }) {
  const m = percentBlocks(q.pct);
  const step = 100 / m;
  return { m, step, blk: q.whole / m, j: q.pct / step };
}

/** Tank cells and cells per hour of each tap (work problems). */
export function tankOf(q: Extract<RatioQuestion, { type: "work" }>) {
  const cells = q.times.reduce((a, b) => (a / gcdN(a, b)) * b, 1);
  const per = q.times.map((t) => cells / t);
  const net = q.variant === "drain" ? per[0] - per[1] : per.reduce((s, x) => s + x, 0);
  return { cells, per, net };
}
const gcdN = (a: number, b: number): number => (b ? gcdN(b, a % b) : a);

/** "= ۱/۲" when a fraction can be simplified. */
function andSimplest(f: Frac): EqPart[] {
  const s = simplest(f);
  return s.d === f.d ? [] : [" = ", F(fa(s.n), fa(s.d))];
}

/**
 * The bar model, step by step. Step i matches picture stage i of the model;
 * the last step holds the answer.
 */
export function ratioSteps(q: RatioQuestion): Seg[][] {
  switch (q.type) {
    case "shade": {
      const { n, d } = q.frac;
      const first: Seg[] = [`${shapeWord(q.shape)} ${fa(q.parts)} قسمت مساوی دارد.`];
      const second: Seg[] =
        q.parts === d
          ? [`مخرج ${fa(d)} است: هر قسمت `, F(1, fa(d)), ` ${shapeWord(q.shape)} است.`]
          : q.parts > d
            ? [`مخرج ${fa(d)} است؛ پس قسمت‌ها را ${fa(q.parts / d)} تا ${fa(q.parts / d)} تا گروه کن: هر گروه `, F(1, fa(d)), "."]
            : ["کسر را ساده کن: ", eq(F(fa(n), fa(d)), " = ", F(fa(q.answer), fa(q.parts)))];
      const last: Seg[] = [`${fa(q.answer)} قسمت رنگ می‌شود: `, eq(F(fa(n), fa(d)), " = ", F(fa(q.answer), fa(q.parts)))];
      return [first, second, last];
    }
    case "partOf": {
      const { n, d } = q.frac;
      if (q.variant === "whole")
        return [
          [`نوار را ${fa(d)} قسمت مساوی کن؛ ${fa(n)} قسمت آن ${fa(q.part)} است.`],
          ["یک قسمت: ", calc(q.part, "÷", n, q.unit)],
          [`همه ${fa(d)} قسمت: `, calc(d, "×", q.unit, q.whole)],
        ];
      const steps: Seg[][] = [
        [`نوار، ${fa(q.whole)} است. آن را ${fa(d)} قسمت مساوی کن (مخرج).`],
        ["یک قسمت: ", calc(q.whole, "÷", d, q.unit)],
        [`${fa(n)} قسمت (صورت): `, calc(n, "×", q.unit, q.part)],
      ];
      if (q.variant === "rest") steps.push(["مانده: ", calc(q.whole, "−", q.part, q.answer)]);
      return steps;
    }
    case "compare": {
      const [f, g] = q.fracs;
      const L = f.d === g.d ? f.d : (f.d * g.d) / gcdN(f.d, g.d);
      const sym = q.answer === 0 ? " > " : q.answer === 1 ? " < " : " = ";
      const FF = (x: Frac) => F(fa(x.n), fa(x.d));
      const middle: Seg[] =
        f.d === g.d
          ? [`مخرج‌ها برابرند (${fa(f.d)} قسمت)؛ هر کدام قسمت‌های رنگی بیشتری دارد، بزرگ‌تر است.`]
          : f.n === g.n
            ? [`صورت‌ها برابرند (${fa(f.n)} قسمت)؛ هر چه مخرج بزرگ‌تر باشد، قسمت‌ها کوچک‌ترند.`]
            : ["هم‌مخرج کن: ", eq(FF(f), " = ", F(fa((f.n * L) / f.d), fa(L))), " و ", eq(FF(g), " = ", F(fa((g.n * L) / g.d), fa(L)))];
      return [["دو نوار هم‌اندازه: ", FF(f), " و ", FF(g), "."], middle, [q.answer === 2 ? "برابرند: " : "مقایسه: ", eq(FF(f), sym, FF(g))]];
    }
    case "ratio": {
      const t = RATIO_THINGS[q.things];
      const [a, b] = q.ratio;
      const k = q.k;
      const draw: Seg[] = [`برای ${t.a} ${fa(a)} بلوک و برای ${t.b} ${fa(b)} بلوک بکش؛ همه بلوک‌ها هم‌اندازه‌اند.`];
      if (q.variant === "diff")
        return [
          draw,
          [`${t.b} ${fa(b - a)} بلوک بیشتر دارند؛ این ${fa(b - a)} بلوک، ${fa((b - a) * k)} ${t.unit} است.`],
          ["یک بلوک: ", calc((b - a) * k, "÷", b - a, k)],
          [`${t.a}: `, calc(a, "×", k, a * k)],
        ];
      return [
        draw,
        [`${fa(a)} بلوکِ ${t.a}، ${fa(a * k)} ${t.unit} است.`],
        ["یک بلوک: ", calc(a * k, "÷", a, k)],
        q.variant === "other" ? [`${t.b}: `, calc(b, "×", k, b * k)] : [`همه ${fa(a + b)} بلوک: `, calc(a + b, "×", k, (a + b) * k)],
      ];
    }
    case "divide": {
      const sum = q.ratio.reduce((s, r) => s + r, 0);
      return [
        [`برای هر نفر به اندازه نسبتش بلوک بکش: ${ratioFa(q.ratio)}.`],
        ["همه بلوک‌ها: ", eq(`${q.ratio.map(fa).join(" + ")} = ${fa(sum)}`), `؛ این ${fa(sum)} بلوک، ${fa(q.total)} است.`],
        ["یک بلوک: ", calc(q.total, "÷", sum, q.k)],
        [`سهم ${PEOPLE[q.ask]}: `, calc(q.ratio[q.ask], "×", q.k, q.answer)],
      ];
    }
    case "percent": {
      const { m, step, blk, j } = percentParts(q);
      const bar: Seg[] = [`کل نوار ${fa(q.whole)} است، یعنی ۱۰۰ درصد. آن را ${fa(m)} بلوک کن؛ هر بلوک ${fa(step)} درصد.`];
      if (q.variant === "whole")
        return [
          [`نوار را ${fa(m)} بلوک کن؛ هر بلوک ${fa(step)} درصد. ${fa(q.pct)} درصد یعنی ${fa(j)} بلوک، و این ${fa(q.part)} است.`],
          ["یک بلوک: ", calc(q.part, "÷", j, blk)],
          [`۱۰۰ درصد یعنی ${fa(m)} بلوک: `, calc(m, "×", blk, q.whole)],
        ];
      if (q.variant === "what") return [bar, ["یک بلوک: ", calc(q.whole, "÷", m, blk)], [`${fa(q.part)} یعنی ${fa(j)} بلوک: `, calc(j, "×", step, q.pct), " درصد"]];
      const steps: Seg[][] = [bar, ["یک بلوک: ", calc(q.whole, "÷", m, blk)], [`${fa(q.pct)} درصد یعنی ${fa(j)} بلوک: `, calc(j, "×", blk, q.part)]];
      if (q.variant === "off") steps.push(["مانده: ", calc(q.whole, "−", q.part, q.answer)]);
      if (q.variant === "up") steps.push(["حالا: ", calc(q.whole, "+", q.part, q.answer)]);
      return steps;
    }
    case "work": {
      const w = workWords(q);
      if (q.variant === "crew") {
        const [w1, d, w2] = q.crew;
        return [
          [`هر خانه، کار یک کارگر در یک روز است: ${fa(w1)} ردیف (کارگر) و ${fa(d)} ستون (روز).`],
          ["کل کار: ", calc(w1, "×", d, w1 * d), " خانه. این عوض نمی‌شود."],
          [`همین ${fa(w1 * d)} خانه را در ${fa(w2)} ردیف بچین: `, calc(w1 * d, "÷", w2, q.answer as number), " روز."],
        ];
      }
      const { cells, per, net } = tankOf(q);
      if (q.variant === "single") {
        const T = q.times[0];
        const steps: Seg[][] = [[`${w.thing} را ${fa(T)} ${w.cells} کن: هر ${w.time} یک ${w.cells}، یعنی `, F(1, fa(T)), "."]];
        for (let h = 1; h <= q.hours; h++) steps.push([`${w.time} ${fa(h)}: ${fa(h)} ${w.cells} از ${fa(T)}`]);
        steps[steps.length - 1] = [`${w.time} ${fa(q.hours)}: `, eq(F(fa(q.hours), fa(T)), ...andSimplest({ n: q.hours, d: T })), ` ${w.thing}`];
        return steps;
      }
      const who = per.map((c, i) => `${q.variant === "drain" && i === 1 ? "سوراخ" : w.doers[i]} ${fa(c)} ${w.cells}${q.variant === "drain" && i === 1 ? " خالی می‌کند" : ""}`).join("، ");
      const first: Seg[] = [
        `${w.thing} را ${fa(cells)} ${w.cells} کن (کوچک‌ترین مضرب مشترک ${listFa(q.times)}). در هر ${w.time}: ${who}؛ `,
        q.variant === "drain" ? eq(`${fa(per[0])} − ${fa(per[1])} = ${fa(net)}`) : eq(`${per.map(fa).join(" + ")} = ${fa(net)}`),
        ` ${w.cells}.`,
      ];
      if (q.variant === "pairFraction") return [first, [`در یک ${w.time}، ${fa(net)} ${w.cells} از ${fa(cells)}: `, eq(F(fa(net), fa(cells)), ...andSimplest({ n: net, d: cells }))]];
      const hours = q.answer as number;
      const steps: Seg[][] = [first];
      for (let h = 1; h <= hours; h++) steps.push([`${w.time} ${fa(h)}: ${fa(h * net)} ${w.cells} از ${fa(cells)}`]);
      steps[steps.length - 1] = [`${w.time} ${fa(hours)}: پر شد! `, calc(cells, "÷", net, hours), ` ${w.time}`];
      return steps;
    }
  }
}

/** The whole working in one sentence (feedback, answer key). */
export function ratioHow(q: RatioQuestion): Seg[] {
  const steps = ratioSteps(q);
  // The first step only draws; the rest computes.
  const from = q.type === "work" && q.variant !== "crew" && q.variant !== "pairFraction" ? 0 : 1;
  const chosen = q.type === "work" && q.variant !== "crew" && q.variant !== "pairFraction" ? [steps[0], steps[steps.length - 1]] : steps.slice(from);
  const out: Seg[] = [];
  chosen.forEach((s, i) => {
    if (i) out.push(" ");
    out.push(...s);
    const last = s[s.length - 1];
    if (typeof last !== "string" || !/[.!؟]$/.test(last)) out.push(".");
  });
  return out;
}

/** The answer itself, as segments. */
export function answerSegs(q: RatioQuestion, v = q.answer): Seg[] {
  if (q.type === "compare") {
    const n = v as number;
    return n === 2 ? ["برابرند"] : [F(fa(q.fracs[n].n), fa(q.fracs[n].d)), " بزرگ‌تر است"];
  }
  if (typeof v === "object") {
    // The answer itself in simplest form; any equal fraction is accepted.
    const f = v === q.answer ? simplest(v) : v;
    return [F(fa(f.n), fa(f.d))];
  }
  if (q.type === "shade") return [`${fa(v)} قسمت`];
  if (q.type === "percent" && q.variant === "what") return [`${fa(v)} درصد`];
  return [fa(v)];
}

// «مبادله» in words and pictures: each exchange is a balanced scale; the
// question scale starts with the same goods on both pans, and the left pan
// is exchanged step by step (groups ringed, then replaced), so the scale stays
// level all the way. Also the prompt, the working and feedback for each slip.

import { batchTrade, chainPrice, exchangeMistake, GOODS, linkFactor, pathCounts, type ExchangeQuestion } from "@/generators/exchange";
import { fa } from "@/tools/registry";
import type { Frame, ScaleView } from "./frames";
import type { ItemView } from "./Pictures";

const ltr = (s: string) => `⁦${s.replace(/ /g, " ")}⁩`;

export const goodName = (g: number) => GOODS[g].name;
/** "۳ سیب" */
const cnt = (n: number, g: number) => `${fa(n)} ${goodName(g)}`;

/** "۳ سیب = ۲ گلابی" for rate i. */
export const rateFa = (q: ExchangeQuestion, i: number) => `${cnt(q.rates[i].p, q.goods[i])} = ${cnt(q.rates[i].q, q.goods[i + 1])}`;

/** "۳ سیب را با ۲ گلابی" for rate i. */
const rateWords = (q: ExchangeQuestion, i: number) => `${cnt(q.rates[i].p, q.goods[i])} را با ${cnt(q.rates[i].q, q.goods[i + 1])}`;

function ratesSentence(q: ExchangeQuestion) {
  const parts = q.order.map((i) => rateWords(q, i));
  return `${parts.join(" و ")} عوض می‌کنند`;
}

export function exchangePrompt(q: ExchangeQuestion): string {
  const A = q.goods[q.from];
  const B = q.goods[q.to];
  switch (q.variant) {
    case "one":
    case "chain":
      return `در بازار روستا ${ratesSentence(q)}. ${cnt(q.count, A)} را با چند ${goodName(B)} می‌شود عوض کرد؟`;
    case "leftover":
      return `${q.name} ${cnt(q.count, A)} دارد. در بازار ${ratesSentence(q)}؛ فقط دسته‌ی کامل عوض می‌شود. ${q.name} حداکثر چند ${goodName(B)} می‌تواند بگیرد؟`;
    case "compare":
      return `${q.name} ${cnt(q.count, B)} می‌خواهد و فقط ${goodName(A)} دارد. در بازار ${ratesSentence(q)}. یک فروشنده هم می‌گوید: «هر ${goodName(B)} را به ${cnt(q.offer, A)} می‌دهم.» اگر ${q.name} ارزان‌ترین راه را انتخاب کند، چند ${goodName(A)} می‌دهد؟`;
  }
}

export const exchangeAnswerFa = (q: ExchangeQuestion, v = q.answer) => cnt(v, q.goods[q.to === 2 && q.variant === "compare" ? 0 : q.to]);

/** The working, briefly. */
export function exchangeHow(q: ExchangeQuestion): string {
  switch (q.variant) {
    case "one":
    case "chain": {
      const path = pathCounts(q);
      const dir = q.to > q.from ? 1 : -1;
      const steps: string[] = [];
      for (let k = 1; k < path.length; k++) {
        const i = q.from + dir * (k - 1);
        const { mul, div } = linkFactor(q, i, i + dir);
        const groups = path[k - 1] / div;
        steps.push(
          div === 1
            ? `هر ${goodName(q.goods[i])} = ${cnt(mul, q.goods[i + dir])}، پس ${cnt(path[k - 1], q.goods[i])}: ${ltr(`${fa(path[k - 1])} × ${fa(mul)} = ${fa(path[k])}`)} ${goodName(q.goods[i + dir])}`
            : `${cnt(path[k - 1], q.goods[i])} یعنی ${fa(groups)} دسته‌ی ${fa(div)}تایی، و هر دسته ${cnt(mul, q.goods[i + dir])}: ${ltr(`${fa(groups)} × ${fa(mul)} = ${fa(path[k])}`)}`,
        );
      }
      return `${steps.join("؛ ")}.`;
    }
    case "leftover": {
      const { got, left } = batchTrade(q);
      const [r0, r1] = q.rates;
      const g = q.goods;
      return `${cnt(q.count, g[0])}: ${fa(Math.floor(q.count / r0.p))} دسته‌ی ${fa(r0.p)}تایی → ${cnt(got[1], g[1])}${left[0] ? ` (${cnt(left[0], g[0])} می‌ماند)` : ""}؛ ${cnt(got[1], g[1])}: ${fa(got[2])} دسته‌ی ${fa(r1.p)}تایی → ${cnt(got[2], g[2])}${left[1] ? ` (${cnt(left[1], g[1])} می‌ماند)` : ""}.`;
    }
    case "compare": {
      const price = chainPrice(q);
      const g = q.goods;
      const mid = q.rates[1].p;
      return `از راه ${goodName(g[1])}: هر ${goodName(g[2])} = ${cnt(mid, g[1])} = ${ltr(`${fa(mid)} ÷ ${fa(q.rates[0].q)} × ${fa(q.rates[0].p)} = ${fa(price)}`)} ${goodName(g[0])}؛ فروشنده ${fa(q.offer)}. ارزان‌تر ${fa(Math.min(price, q.offer))} است و برای ${fa(q.count)} تا: ${ltr(`${fa(q.count)} × ${fa(Math.min(price, q.offer))} = ${fa(q.answer)}`)}.`;
    }
  }
}

export type Tone = "good" | "turned" | "bad";

export function exchangeFeedback(q: ExchangeQuestion, v: number): { tone: Tone; text: string } {
  const how = exchangeHow(q);
  const right = `جواب ${exchangeAnswerFa(q)} است. ${how}`;
  const near = (s: string) => ({ tone: "turned" as const, text: `نزدیک بود! ${s} ${right}` });
  const g = q.goods;
  switch (exchangeMistake(q, v)) {
    case "right":
      return { tone: "good", text: `درست است! ${how}` };
    case "added":
      return near("عددها را با هم جمع یا از هم کم کردی؛ در مبادله هر دسته جایش را به دسته‌ی دیگری می‌دهد: باید ضرب و تقسیم کنی.");
    case "inverted":
      return near(`یک مبادله را برعکس به کار بردی. ${q.order.map((i) => `«${rateFa(q, i)}»`).join(" و ")}: ببین کدام طرف بیشتر است.`);
    case "skipLink":
      return near(
        q.variant === "leftover"
          ? `${fa(v)} تعداد ${goodName(g[1])}هاست؛ هنوز باید آن‌ها را با ${goodName(g[2])} عوض کنی.`
          : `یک حلقه از زنجیره را جا انداختی: از ${goodName(g[q.from])} به ${goodName(g[1])} و بعد از ${goodName(g[1])} به ${goodName(g[q.to])} برو.`,
      );
    case "perOne":
      return near("هر دانه را جدا عوض کردی؛ مبادله دسته‌ای است: اول بشمار چند دسته‌ی کامل داری.");
    case "oneGroup":
      return near("این جواب برای یک دسته است؛ ببین چند دسته داری.");
    case "roundUp":
      return near(`برای ${goodName(g[2])} آخری ${goodName(g[1])} کافی نداری؛ فقط دسته‌های کامل عوض می‌شوند.`);
    case "dearer":
      return near("این راه گران‌تر است؛ قیمت هر دو راه را حساب کن و ارزان‌تر را بردار.");
    case "forgotCount":
      return near(`این قیمت یک ${goodName(g[2])} است؛ ${q.name} ${fa(q.count)} تا می‌خواهد.`);
    case "saving":
      return near(`${fa(v)} تفاوت دو راه است؛ پرسش می‌پرسد ${q.name} چند ${goodName(g[0])} می‌دهد.`);
    default:
      return { tone: "bad", text: right };
  }
}

// ── Show me: substitution on the scales ─────────────────────────────────

/** A pan's goods: count of each GOODS index, and how many of each are ringed (about to be exchanged). */
type PanCounts = Map<number, { n: number; ring: number }>;

/** Goods on a pan: one by one if few, else a pile with its count. */
export function goodsItems(g: number, n: number, ring = 0, few = 6): ItemView[] {
  if (n <= 0) return [];
  if (n <= few) return Array.from({ length: n }, (_, i) => ({ item: { fruit: g }, ring: i < ring }));
  if (ring > 0 && ring < n) return [{ item: { fruit: g, count: ring }, ring: true }, ...goodsItems(g, n - ring, 0, 2)];
  return [{ item: { fruit: g, count: n }, ring: ring > 0 }];
}

/** Dearest first; with several kinds on a pan, piles come sooner so the pan stays low. */
function panItems(p: PanCounts): ItemView[] {
  const few = p.size > 1 ? 2 : 6;
  return [...p.entries()].sort((a, b) => b[0] - a[0]).flatMap(([g, { n, ring }]) => goodsItems(g, n, ring, few));
}

const pan = (entries: [number, number, number?][]): PanCounts => new Map(entries.filter(([, n]) => n > 0).map(([g, n, ring]) => [g, { n, ring: ring ?? 0 }]));

export function exchangeFrames(q: ExchangeQuestion): Frame[] {
  const g = q.goods;
  // The exchange scales, in the order told; then the seller (compare); then the question.
  const rateScales = (focus = -1): ScaleView[] =>
    q.order.map((i, k) => ({
      left: goodsItems(g[i], q.rates[i].p),
      right: goodsItems(g[i + 1], q.rates[i].q),
      tilt: 0,
      label: `ترازوی ${fa(k + 1)}`,
      focus: i === focus,
    }));
  const seller = (focus = false): ScaleView[] =>
    q.variant === "compare" ? [{ left: goodsItems(g[0], q.offer), right: goodsItems(g[2], 1), tilt: 0, label: "فروشنده", focus }] : [];
  const startCount = q.count;
  const startGood = q.variant === "compare" ? g[2] : g[q.from];
  const reference = goodsItems(startGood, startCount);
  const scene = (left: PanCounts, note: string, focus = -1, sellerFocus = false): Frame => ({
    kind: "scales",
    scales: [...rateScales(focus), ...seller(sellerFocus), { left: panItems(left), right: reference, tilt: 0, label: "ترازوی پرسش", focus: focus >= 0 }],
    note,
  });
  const scaleName = (i: number) => `ترازوی ${fa(q.order.indexOf(i) + 1)}`;

  const frames: Frame[] = [
    scene(
      pan([[startGood, startCount]]),
      `هر ترازوی متعادل یک مبادله است: ${q.order.map((i) => `«${rateFa(q, i)}»`).join(" و ")}. در ترازوی پرسش، دو کفه ${cnt(startCount, startGood)} دارند؛ کفه‌ی چپ را کم‌کم عوض می‌کنیم و ترازو متعادل می‌ماند.`,
    ),
  ];

  // Walk the chain on the left pan, a link at a time, whole batches only.
  const from = q.variant === "compare" ? 2 : q.from;
  const to = q.variant === "compare" ? 0 : q.to;
  const dir = to > from ? 1 : -1;
  const kept = new Map<number, number>(); // leftovers, by GOODS index
  let have = startCount;
  for (let i = from; i !== to; i += dir) {
    const link = q.rates[Math.min(i, i + dir)];
    const { mul, div } = linkFactor(q, i, i + dir);
    const batches = Math.floor(have / div);
    const used = batches * div;
    const rest = have - used;
    const got = batches * mul;
    const others: [number, number][] = [...kept.entries()];
    frames.push(
      scene(
        pan([[g[i], have, used], ...others]),
        `${scaleName(Math.min(i, i + dir))} می‌گوید «${cnt(link.p, g[Math.min(i, i + dir)])} = ${cnt(link.q, g[Math.max(i, i + dir)])}». ${
          div === 1
            ? `به جای هر ${goodName(g[i])} ${cnt(mul, g[i + dir])} می‌گذاریم.`
            : `${cnt(have, g[i])} یعنی ${fa(batches)} دسته‌ی ${fa(div)}تایی${rest ? ` و ${fa(rest)} تا اضافه` : ""}؛ به جای هر دسته ${cnt(mul, g[i + dir])} می‌گذاریم.`
        }`,
        Math.min(i, i + dir),
      ),
    );
    if (rest) kept.set(g[i], rest);
    frames.push(
      scene(
        pan([[g[i + dir], got], ...[...kept.entries()]]),
        `${ltr(`${fa(batches)} × ${fa(mul)} = ${fa(got)}`)}: حالا ${cnt(got, g[i + dir])}${rest ? ` و ${cnt(rest, g[i])} که دسته‌ی کامل نشد` : ""}. ترازو هنوز متعادل است.`,
      ),
    );
    have = got;
  }
  const last = pan([[g[to], have], ...[...kept.entries()]]);
  switch (q.variant) {
    case "one":
    case "chain":
      frames.push(scene(last, `جواب: ${cnt(q.count, g[q.from])} برابر ${cnt(q.answer, g[q.to])} است.`));
      break;
    case "leftover":
      frames.push(scene(last, `${q.name} حداکثر ${cnt(q.answer, g[2])} می‌گیرد؛ بقیه برای یک ${goodName(g[2])} دیگر کافی نیست.`));
      break;
    case "compare": {
      const price = chainPrice(q);
      frames.push(
        scene(
          last,
          `از راه ${goodName(g[1])}، ${cnt(q.count, g[2])} = ${cnt(have, g[0])}؛ از فروشنده ${ltr(`${fa(q.count)} × ${fa(q.offer)} = ${fa(q.count * q.offer)}`)} ${goodName(g[0])}. ارزان‌تر: ${cnt(q.answer, g[0])}${price < q.offer ? " (از راه مبادله)" : " (از فروشنده)"}.`,
          -1,
          true,
        ),
      );
      break;
    }
  }
  return frames;
}

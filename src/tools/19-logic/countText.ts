// Words for «نمودار ون با عدد» (tool 19): facts, questions, steps and the
// working. Plain code (no React): VennCount.tsx and the practice adapter share it.

import { countSteps, refMask, regionsOf, type CountStep, type Fact, type K, type Ref, type VennCountQuestion } from "@/generators/venn-count";
import { fa } from "@/tools/registry";

/** Keeps a formula left to right inside a Persian sentence (no-break spaces). */
export const ltr = (s: string) => `⁦${s.replace(/ /g, " ")}⁩`;

// ───────────── words ─────────────

export interface CountWords {
  items: string[];
  set: (x: string) => string;
  only: (x: string) => string;
  two: string;
  pairOnly: (x: string, y: string, z: string) => string;
  pair: (x: string, y: string) => string;
  all3: string;
  none: (k: K) => string;
  some: (k: K) => string;
}

export const howMany = (k: K) => (k === 2 ? "دو" : "سه");

/** Same order as the generator's themes (COUNT_THEME_COUNT). */
export const COUNT_THEMES: CountWords[] = [
  {
    items: ["فوتبال", "والیبال", "شنا"],
    set: (x) => `به کلاس ${x} می‌روند`,
    only: (x) => `فقط به کلاس ${x} می‌روند`,
    two: "به هر دو کلاس می‌روند",
    pairOnly: (x, y, z) => `فقط به کلاس ${x} و ${y} می‌روند (به ${z} نه)`,
    pair: (x, y) => `هم به کلاس ${x} می‌روند، هم ${y}`,
    all3: "به هر سه کلاس می‌روند",
    none: (k) => `به هیچ‌کدام از این ${howMany(k)} کلاس نمی‌روند`,
    some: (k) => `دست‌کم به یکی از این ${howMany(k)} کلاس می‌روند`,
  },
  {
    items: ["گربه", "ماهی", "طوطی"],
    set: (x) => `${x} دارند`,
    only: (x) => `فقط ${x} دارند`,
    two: "هر دو را دارند",
    pairOnly: (x, y, z) => `فقط ${x} و ${y} دارند (${z} ندارند)`,
    pair: (x, y) => `هم ${x} دارند، هم ${y}`,
    all3: "هر سه را دارند",
    none: (k) => `هیچ‌کدام از این ${howMany(k)} حیوان را ندارند`,
    some: (k) => `دست‌کم یکی از این ${howMany(k)} حیوان را دارند`,
  },
  {
    items: ["سیب", "انار", "هلو"],
    set: (x) => `${x} را دوست دارند`,
    only: (x) => `فقط ${x} را دوست دارند`,
    two: "هر دو را دوست دارند",
    pairOnly: (x, y, z) => `فقط ${x} و ${y} را دوست دارند (${z} را نه)`,
    pair: (x, y) => `هم ${x} را دوست دارند، هم ${y} را`,
    all3: "هر سه را دوست دارند",
    none: (k) => `هیچ‌کدام از این ${howMany(k)} میوه را دوست ندارند`,
    some: (k) => `دست‌کم یکی از این ${howMany(k)} میوه را دوست دارند`,
  },
];

export type QLike = Pick<VennCountQuestion, "k" | "theme" | "items">;
export const words = (q: QLike) => COUNT_THEMES[q.theme];
/** The names on the circles, in circle order. */
export const countNames = (q: QLike) => q.items.map((i) => words(q).items[i]);

/** What a count says about people: "فقط سیب را دوست دارند". */
export function refPred(q: QLike, ref: Ref): string {
  const w = words(q);
  const n = countNames(q);
  switch (ref.kind) {
    case "set":
      return w.set(n[ref.s]);
    case "only":
      return w.only(n[ref.s]);
    case "both":
      return w.two;
    case "pairOnly":
      return w.pairOnly(n[ref.s], n[ref.t], n[3 - ref.s - ref.t]);
    case "pair":
      return w.pair(n[ref.s], n[ref.t]);
    case "all3":
      return w.all3;
    case "union":
      return w.some(q.k);
    case "neither":
      return w.none(q.k);
    case "total":
      return "در کلاس هستند";
  }
}

/** A region's short name: "فقط سیب", "سیب و انار", "هر دو", "هیچ‌کدام". */
export function regionName(q: QLike, r: number): string {
  const n = countNames(q);
  if (r === 0) return "هیچ‌کدام (بیرون)";
  const ins = [0, 1, 2].filter((t) => t < q.k && (r >> t) & 1);
  if (ins.length === 1) return `فقط ${n[ins[0]]}`;
  if (ins.length === q.k) return q.k === 2 ? "هر دو (وسط)" : "هر سه (وسط)";
  return `فقط ${n[ins[0]]} و ${n[ins[1]]}`;
}

export const factText = (q: QLike, f: Fact) => (f.ref.kind === "total" ? `در کلاس ${fa(f.value)} دانش‌آموز هست` : `${fa(f.value)} نفر ${refPred(q, f.ref)}`);

export function countQuestionText(q: VennCountQuestion): string {
  const pred = refPred(q, q.ask);
  if (q.extreme === "minBoth") return `دست‌کم چند نفر ${pred}؟`;
  if (q.extreme) return `حداکثر چند نفر ${pred}؟`;
  return `چند نفر ${pred}؟`;
}

/** "دست‌کم ۴ نفر هر دو را دارند" (value already in Persian digits or a formula). */
export function answerSentence(q: VennCountQuestion, value: string): string {
  const pre = q.extreme === "minBoth" ? "دست‌کم " : q.extreme ? "حداکثر " : "";
  return `${pre}${value} نفر ${refPred(q, q.ask)}`;
}

export function countPrompt(q: VennCountQuestion): string {
  const total = q.facts.find((f) => f.ref.kind === "total");
  const rest = q.facts.filter((f) => f.ref.kind !== "total").map((f) => factText(q, f));
  const intro = total ? `${factText(q, total)}.` : "در یک کلاس:";
  // Three circles: longer sentences with commas inside, so «؛» between them.
  const note = q.facts.some((f) => f.ref.kind === "pair") ? ` («هم … هم …» یعنی همه کسانی که در هر دو دایره‌اند، با کسانی که ${words(q).all3}.)` : "";
  return `${intro} ${rest.join(q.k === 3 ? "؛ " : "، ")}.${note} ${countQuestionText(q)}`;
}

export const plusJoin = (vs: number[]) => vs.map((v) => fa(v)).join(" + ");

/** One step of filling the diagram, in words. */
export function countStepText(q: VennCountQuestion, s: CountStep, known: readonly (number | null)[]): string {
  const name = (r: number) => `«${regionName(q, r)}»`;
  const fact = (i: number) => `«${factText(q, q.facts[i])}»`;
  switch (s.kind) {
    case "given":
      return s.region === 0 ? `${fact(s.fact)}: این‌ها بیرون همه دایره‌ها هستند؛ ${fa(s.value)} را در بخش ${name(0)} بنویس.` : `${fact(s.fact)}: این همان بخش ${name(s.region)} است؛ اول ${fa(s.value)} را آنجا بنویس.`;
    case "sub": {
      const minus = s.minus.map((r) => known[r] ?? 0);
      const formula = ltr(`${fa(q.facts[s.fact].value)} − ${minus.length > 1 ? `(${plusJoin(minus)})` : fa(minus[0])} = ${fa(s.value)}`);
      return `${fact(s.fact)}؛ بخش‌هایی را که پر کرده‌ایم کم کن: ${formula}. پس ${name(s.region)} ${fa(s.value)} نفر است.`;
    }
    case "inside":
      return s.outside === 0 && q.extreme
        ? `پس همه ${fa(s.value)} نفر کلاس داخل دایره‌ها هستند.`
        : `کل کلاس ${fa(q.facts[s.fact].value)} نفر است و ${fa(s.outside)} نفر بیرون دایره‌ها؛ پس داخل دایره‌ها ${ltr(`${fa(q.facts[s.fact].value)} − ${fa(s.outside)} = ${fa(s.value)}`)} نفرند.`;
    case "overlap": {
      const [A, B] = [q.facts[s.a].value, q.facts[s.b].value];
      return `${ltr(`${fa(A)} + ${fa(B)} = ${fa(A + B)}`)}، ولی داخل دایره‌ها فقط ${fa(s.inside)} نفرند؛ کسانی که در هر دو دایره‌اند دو بار شمرده شده‌اند: ${ltr(`${fa(A + B)} − ${fa(s.inside)} = ${fa(s.value)}`)} در بخش وسط.`;
    }
    case "spread": {
      const [, A, B] = q.facts.map((f) => f.value);
      if (s.extreme === "minBoth") return `برای اینکه «هر دو» کمترین باشد، دو دایره را تا جای ممکن از هم دور کن: هیچ‌کس بیرون نمی‌ماند، پس ${name(0)} صفر است.`;
      const small = A <= B ? 0 : 1;
      const what = s.extreme === "maxBoth" ? "«هر دو»" : "«هیچ‌کدام»";
      return `برای اینکه ${what} بیشترین باشد، دایره کوچک‌تر (${countNames(q)[small]}، ${fa(Math.min(A, B))} نفر) را کامل داخل دایره بزرگ‌تر بگذار: همه ${fa(Math.min(A, B))} نفر در بخش وسط.`;
    }
    case "answer": {
      const rs = regionsOf(refMask(q.k, q.ask));
      const formula = rs.length > 1 ? `${ltr(`${plusJoin(rs.map((r) => known[r] ?? 0))} = ${fa(s.value)}`)}` : fa(s.value);
      return `جواب: ${answerSentence(q, formula)}.`;
    }
  }
}

/** The answer key's "how": each region as it is filled. */
export function countHow(q: VennCountQuestion): string {
  const { steps } = countSteps(q);
  const parts: string[] = [];
  for (const s of steps) {
    if (s.kind === "given" || s.kind === "sub" || s.kind === "spread") parts.push(`${regionName(q, s.region)}: ${fa(s.value)}`);
    if (s.kind === "overlap") parts.push(`وسط: ${ltr(`${fa(q.facts[s.a].value)} + ${fa(q.facts[s.b].value)} − ${fa(s.inside)} = ${fa(s.value)}`)}`);
  }
  return parts.join(" · ");
}


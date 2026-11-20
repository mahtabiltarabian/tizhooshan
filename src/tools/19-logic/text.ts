// Words for tool 19: clues, statements, steps, prompts and answers in
// Persian. Plain code (no React): the try panel, the worksheet and the
// practice adapter (which the server imports) share it.

import { chainOf, CREATURES, THEMES, type Clue, type GridQuestion, type GridStep, type LiarsQuestion, type LiarStep, type LogicQuestion, type LogicType, type Says, type Statement, type ThemeKey, type VennQuestion, type VennStep } from "@/generators/logic";
import { fa } from "@/tools/registry";
import { countHow, countPrompt } from "./countText";
import { ifAnswerFa, ifHow, ifPrompt } from "./ifText";

export const LOGIC_TYPE_LABEL: Record<LogicType, string> = {
  grid: "جدول منطقی",
  liars: "راستگو و دروغگو",
  venn: "همه و بعضی",
  vennNum: "ون با عدد",
  ifThen: "اگر… آنگاه",
};

/** Keeps a formula left to right inside a Persian sentence, on one line (no-break spaces). */
export const ltr = (s: string) => `⁦${s.replace(/ /g, " ")}⁩`;

/** "۴ × ۴" */
export const sizeFa = (n: number) => ltr(`${fa(n)} × ${fa(n)}`);

// ───────────── grid ─────────────

export const THEME_WORDS: Record<ThemeKey, { yes: (i: string) => string; no: (i: string) => string; owner: (i: string) => string; intro: string }> = {
  pet: {
    yes: (i) => `${i} دارد`,
    no: (i) => `${i} ندارد`,
    owner: (i) => `صاحب ${i}`,
    intro: "هر کدام از این بچه‌ها یک حیوان خانگی دارد و حیوان‌هایشان با هم فرق دارد.",
  },
  fruit: {
    yes: (i) => `${i} آورده`,
    no: (i) => `${i} نیاورده`,
    owner: (i) => `کسی که ${i} آورده`,
    intro: "هر کدام از این بچه‌ها یک میوه آورده و میوه‌هایشان با هم فرق دارد.",
  },
  class: {
    yes: (i) => `به کلاس ${i} می‌رود`,
    no: (i) => `به کلاس ${i} نمی‌رود`,
    owner: (i) => `کسی که به کلاس ${i} می‌رود`,
    intro: "هر کدام از این بچه‌ها به یک کلاس می‌رود و کلاس‌هایشان با هم فرق دارد.",
  },
};

export type GridLike = Pick<GridQuestion, "theme" | "people" | "size">;
export const words = (q: GridLike) => THEME_WORDS[THEMES[q.theme].key];
export const itemsOf = (q: GridLike) => THEMES[q.theme].items.slice(0, q.size);

/** "سارا گربه دارد" */
export const hasText = (q: GridLike, p: number, i: number) => `${q.people[p]} ${words(q).yes(itemsOf(q)[i])}`;

export function clueText(q: GridLike, c: Clue): string {
  const w = words(q);
  const item = (i: number) => itemsOf(q)[i];
  const who = (p: number) => q.people[p];
  switch (c.kind) {
    case "no":
      return c.owner ? `${w.owner(item(c.i))}، ${who(c.p)} نیست` : `${who(c.p)} ${w.no(item(c.i))}`;
    case "yes":
      return hasText(q, c.p, c.i);
    case "or":
      return `${w.owner(item(c.i))}، ${who(c.ps[0])} یا ${who(c.ps[1])} است`;
    case "nor":
      return `${w.owner(item(c.i))} نه ${who(c.ps[0])} است، نه ${who(c.ps[1])}`;
    case "either":
      return `${who(c.p)} یا ${w.yes(item(c.is[0]))} یا ${item(c.is[1])}`;
  }
}

export const cellName = (q: GridLike, c: number) => `${q.people[Math.floor(c / q.size)]}–${itemsOf(q)[c % q.size]}`;

/** One step of solving a grid, in words. */
export function gridStepText(q: GridLike & { clues: readonly Clue[] }, s: GridStep): string {
  const n = q.size;
  switch (s.kind) {
    case "clue": {
      const head = `سرنخ ${fa(s.clue + 1)}: «${clueText(q, q.clues[s.clue])}».`;
      if (s.yes.length) return `${head} پس ${cellName(q, s.yes[0])} ✓.`;
      if (!s.no.length) return `${head} چیز تازه‌ای نمی‌گوید؛ این را از قبل می‌دانستیم.`;
      return `${head} پس ${s.no.map((c) => cellName(q, c)).join("، ")} ✗.`;
    }
    case "cross": {
      const [p, i] = [Math.floor(s.cell / n), s.cell % n];
      return `${hasText(q, p, i)} ✓؛ پس ${q.people[p]} چیز دیگری ندارد و هیچ‌کس دیگر ${itemsOf(q)[i]} ندارد: بقیه سطر و ستون ✗.`;
    }
    case "row": {
      const [p, i] = [Math.floor(s.cell / n), s.cell % n];
      return `در سطر ${q.people[p]} فقط «${itemsOf(q)[i]}» باز مانده؛ پس ${hasText(q, p, i)} ✓.`;
    }
    case "col": {
      const [p, i] = [Math.floor(s.cell / n), s.cell % n];
      return `در ستون «${itemsOf(q)[i]}» فقط ${q.people[p]} باز مانده؛ پس ${hasText(q, p, i)} ✓.`;
    }
  }
}

/** The answer in words: "سارا: گربه · علی: ماهی". */
export const gridAnswerFa = (q: GridQuestion) => q.answer.map((i, p) => `${q.people[p]}: ${itemsOf(q)[i]}`).join(" · ");

// ───────────── liars ─────────────

export const kindWord = (liar: boolean) => (liar ? "دروغگو" : "راستگو");

/** A statement as the speaker says it ("I" for the speaker). */
export function saysText(people: readonly string[], speaker: number, s: Says): string {
  const name = (p: number) => (p === speaker ? "من" : people[p]);
  // With "I" in a pair, "I" comes first and the verb is "we".
  const pair = (a: number, b: number) => (b === speaker ? [b, a] : [a, b]);
  const me = (a: number, b: number) => a === speaker || b === speaker;
  switch (s.kind) {
    case "is":
      return `${name(s.who)} ${kindWord(s.liar)} است`;
    case "both": {
      const [a, b] = pair(s.a, s.b);
      return `${name(a)} و ${name(b)} هر دو ${kindWord(s.liar)} ${me(a, b) ? "هستیم" : "هستند"}`;
    }
    case "some": {
      const [a, b] = pair(s.a, s.b);
      return `دست‌کم یکی از ${name(a)} و ${name(b)} ${kindWord(s.liar)} است`;
    }
    case "same": {
      const [a, b] = pair(s.a, s.b);
      return `${name(a)} و ${name(b)} از یک دسته ${me(a, b) ? "هستیم" : "هستند"}`;
    }
    case "diff": {
      const [a, b] = pair(s.a, s.b);
      return `${name(a)} و ${name(b)} از یک دسته ${me(a, b) ? "نیستیم" : "نیستند"}`;
    }
    case "count":
      return s.n === 1 ? `از ما ${fa(people.length)} نفر، دقیقاً یک نفر دروغگو است` : `از ما ${fa(people.length)} نفر، دقیقاً ${fa(s.n)} نفر دروغگو هستند`;
  }
}

export const LIARS_RULE = "هر کس یا راستگو است (همیشه راست می‌گوید) یا دروغگو (همیشه دروغ می‌گوید). «دسته» یعنی راستگوها یا دروغگوها.";

export const quoteOf = (q: Pick<LiarsQuestion, "people" | "says">, k: number) => `«${saysText(q.people, k, q.says[k]!)}»`;

/** One step of the case-by-case reasoning, in words. */
export function liarStepText(q: Pick<LiarsQuestion, "people" | "says">, s: LiarStep): string {
  switch (s.kind) {
    case "assume":
      return `${s.depth === 0 ? "فرض کن" : "حالا فرض کن"} ${q.people[s.who]} ${kindWord(s.liar)} باشد.`;
    case "force": {
      const speaker = q.people[s.by];
      if (s.who === s.by) return `حرف ${speaker} ${quoteOf(q, s.by)} ${s.liar ? "دروغ" : "راست"} است؛ پس ${speaker} ${kindWord(s.liar)} است.`;
      const liar = s.known[s.by];
      return `${speaker} ${kindWord(!!liar)} است، پس ${quoteOf(q, s.by)} ${liar ? "دروغ" : "راست"} است؛ پس ${q.people[s.who]} ${kindWord(s.liar)} است.`;
    }
    case "clash": {
      const liar = s.known[s.by];
      const speaker = q.people[s.by];
      return `ولی ${speaker} ${kindWord(!!liar)} است و حرفش ${quoteOf(q, s.by)} ${liar ? "راست" : "دروغ"} درمی‌آید: تناقض ✗. این حالت نمی‌شود.`;
    }
    case "fits":
      return `همه حرف‌ها جور است ✓: ${s.known.map((l, p) => `${q.people[p]} ${kindWord(!!l)}`).join("، ")}.`;
  }
}

export const liarsAnswerFa = (q: LiarsQuestion) => q.answer.map((l, p) => `${q.people[p]} ${kindWord(l)}`).join("، ");

// ───────────── Venn ─────────────

/** "زیبوها" / "مونی‌ها" */
export const plural = (name: string) => (/[او]$/.test(name) ? `${name}ها` : `${name}‌ها`);

export function stmtText(names: readonly string[], s: Statement): string {
  const [a, b] = [names[s.a], names[s.b]];
  switch (s.form) {
    case "all":
      return `همه ${plural(a)} ${b} هستند`;
    case "some":
      return `بعضی ${plural(a)} ${b} هستند`;
    case "no":
      return `هیچ‌کدام از ${plural(a)} ${b} نیستند`;
    case "someNot":
      return `بعضی ${plural(a)} ${b} نیستند`;
  }
}

export const vennNames = (q: VennQuestion) => q.terms.map((t) => CREATURES[t]);
export const NONE_TEXT = "هیچ‌کدام از این نتیجه‌ها حتماً درست نیست";
export const optionText = (q: VennQuestion, i: number) => (q.options[i] ? stmtText(vennNames(q), q.options[i]!) : NONE_TEXT);

export const SHADE_WHY: Record<Statement["form"], string> = {
  all: "بخشی از دایره اول که بیرون دایره دوم است خالی است: هاشورش بزن",
  no: "جای مشترک دو دایره خالی است: هاشورش بزن",
  some: "در جای مشترک دو دایره دست‌کم یک عضو هست: × بگذار",
  someNot: "در بخشی از دایره اول که بیرون دایره دوم است دست‌کم یک عضو هست: × بگذار",
};

export const TAG_WHY: Record<string, string> = {
  right: "✓ حتماً درست است: در هر شکلی که با جمله‌ها جور باشد، درست است.",
  converse: "✗ برعکسِ «همه» است: «همه الف‌ها ب هستند» نمی‌گوید «همه ب‌ها الف هستند».",
  someNotAll: "✗ «بعضی» یعنی «دست‌کم یکی»، نه «فقط بعضی»؛ شاید همه‌شان باشند.",
  tooStrong: "✗ زیادی می‌گوید: جمله‌ها فقط «بعضی» را ثابت می‌کنند.",
  impossible: "✗ با جمله‌ها جور نیست؛ اصلاً نمی‌تواند درست باشد.",
  notSure: "✗ شاید درست باشد، ولی حتماً نه: در شکل نمونه، جمله‌ها درست‌اند و این نه.",
  missedValid: "✗ یکی از گزینه‌ها حتماً درست است.",
};

/** One step of drawing the Venn diagram, in words. */
export function vennStepText(q: VennQuestion, s: VennStep): string {
  const names = vennNames(q);
  switch (s.kind) {
    case "premise":
      return `«${stmtText(names, s.s)}»: ${SHADE_WHY[s.s.form]}${s.s.form === "some" || s.s.form === "someNot" ? " (اگر آن بخش دو تکه است، «×؟» در هر تکه یعنی یکی از این دو)" : ""}.`;
    case "middle":
      return `از شکل اول: «${stmtText(names, s.s)}». دیگر به ${plural(names[1])} نیازی نیست؛ این را با جمله سوم در شکل دوم بکش.`;
    case "option": {
      const why = q.options[s.index] === null && s.tag === "right" ? "✓ هیچ گزینه دیگری حتماً درست نیست، پس همین درست است." : TAG_WHY[s.tag];
      return `گزینه ${fa(s.index + 1)}: «${optionText(q, s.index)}». ${why}`;
    }
  }
}

// ───────────── prompts ─────────────

export function logicPrompt(q: LogicQuestion, paper = false): string {
  switch (q.type) {
    case "grid":
      return `${words(q).intro} با سرنخ‌ها، جدول ${sizeFa(q.size)} را کامل کن: خانه درست ✓ و خانه نادرست ✗.${paper ? "" : " روی هر خانه بزن: یک بار ✓، دو بار ✗، سه بار پاک."}`;
    case "liars": {
      const silent = q.says.map((s, p) => (s ? null : q.people[p])).filter(Boolean);
      return `${LIARS_RULE}${silent.length ? ` ${silent.join("، ")} چیزی نگفته.` : ""} چه کسی راستگو و چه کسی دروغگو است؟`;
    }
    case "vennNum":
      return countPrompt(q);
    case "ifThen":
      return ifPrompt(q);
    case "venn":
      return `در سرزمین خیال: ${q.premises.map((s) => `«${stmtText(vennNames(q), s)}»`).join("، ")}. هر گروه دست‌کم یک عضو دارد. کدام نتیجه حتماً درست است؟`;
  }
}

/** The answer in words, for the answer key. */
export function logicAnswerFa(q: LogicQuestion): string {
  switch (q.type) {
    case "grid":
      return gridAnswerFa(q);
    case "liars":
      return liarsAnswerFa(q);
    case "venn":
      return `گزینه ${fa(q.answer + 1)}: «${optionText(q, q.answer)}»`;
    case "vennNum":
      return fa(q.answer);
    case "ifThen":
      return ifAnswerFa(q);
  }
}

/** How the answer is reached, in one line (answer key). */
export function logicHow(q: LogicQuestion): string {
  switch (q.type) {
    case "grid":
      return `${fa(q.clues.length)} سرنخ؛ بعد از هر سرنخ، سطر یا ستونی که فقط یک خانه باز دارد ✓ می‌گیرد.`;
    case "liars": {
      const first = q.says.findIndex((s) => s !== null);
      return `فرض کن ${q.people[first]} راستگو باشد، بعد دروغگو؛ فقط یکی از این دو حالت بی‌تناقض است.`;
    }
    case "venn": {
      const names = vennNames(q);
      if (q.middle) return `قدم اول: «${stmtText(names, q.middle)}»؛ قدم دوم با «${stmtText(names, chainOf(q)[2])}».`;
      return q.options[q.answer] === null ? "از جمله‌ها چیزی درباره دو گروه کناری حتماً درنمی‌آید." : TAG_WHY.right;
    }
    case "vennNum":
      return countHow(q);
    case "ifThen":
      return ifHow(q);
  }
}


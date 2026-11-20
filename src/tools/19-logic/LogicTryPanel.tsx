"use client";

// Words for tool 19: clues, statements and steps in Persian, the feedback
// that names the slip, and the try-it panel. The board (grid cells, people's
// badges) is where the child answers grids and liars; Venn questions are
// answered here by picking a conclusion.

import {
  answerKind,
  chainOf,
  CREATURES,
  gridCheck,
  liarsMistake,
  THEMES,
  type Clue,
  type GridQuestion,
  type GridStep,
  type Level,
  type LiarsQuestion,
  type LiarStep,
  type LogicQuestion,
  type LogicType,
  type Mark,
  type Says,
  type Statement,
  type ThemeKey,
  type VennQuestion,
  type VennStep,
} from "@/generators/logic";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/TryPanel.module.css";
import { ifAnswerFa, ifFeedback, ifHow, ifOptionText, ifPrompt, ifTone } from "./IfThen";
import { CountAnswer, countFeedback, countHow, countPrompt, type CountEntry } from "./VennCount";

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

const THEME_WORDS: Record<ThemeKey, { yes: (i: string) => string; no: (i: string) => string; owner: (i: string) => string; intro: string }> = {
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

type GridLike = Pick<GridQuestion, "theme" | "people" | "size">;
const words = (q: GridLike) => THEME_WORDS[THEMES[q.theme].key];
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

const cellName = (q: GridLike, c: number) => `${q.people[Math.floor(c / q.size)]}–${itemsOf(q)[c % q.size]}`;

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

const kindWord = (liar: boolean) => (liar ? "دروغگو" : "راستگو");

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

const quoteOf = (q: Pick<LiarsQuestion, "people" | "says">, k: number) => `«${saysText(q.people, k, q.says[k]!)}»`;

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

const SHADE_WHY: Record<Statement["form"], string> = {
  all: "بخشی از دایره اول که بیرون دایره دوم است خالی است: هاشورش بزن",
  no: "جای مشترک دو دایره خالی است: هاشورش بزن",
  some: "در جای مشترک دو دایره دست‌کم یک عضو هست: × بگذار",
  someNot: "در بخشی از دایره اول که بیرون دایره دوم است دست‌کم یک عضو هست: × بگذار",
};

const TAG_WHY: Record<string, string> = {
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

// ───────────── feedback ─────────────

type Tone = "good" | "turned" | "bad";
const ICON: Record<Tone, string> = { good: "✓", turned: "↻", bad: "✗" };

export function gridFeedback(q: GridQuestion, marks: readonly Mark[]): { tone: Tone; text: string } {
  const c = gridCheck(q, marks);
  const clue = c.clue !== null ? `سرنخ ${fa(c.clue + 1)} «${clueText(q, q.clues[c.clue])}»` : "";
  switch (c.tag) {
    case "right":
      return { tone: "good", text: `درست است! همه سرنخ‌ها جور است و جواب فقط همین است: ${gridAnswerFa(q)}.` };
    case "ignoredNo":
      return { tone: "turned", text: `${clue} را نادیده گرفتی: یک «نه» در آن هست، ولی جدولت آنجا ✓ دارد. خانه‌های هاشورخورده با این سرنخ تناقض دارند.` };
    case "ignoredOr":
      return { tone: "turned", text: `${clue} را دوباره بخوان: جواب یکی از همان دو است، نه بیرون از آن‌ها و نه هیچ‌کدام. خانه‌های هاشورخورده با آن تناقض دارند.` };
    case "ignoredYes":
      return { tone: "turned", text: `${clue} را ببین: آن خانه حتماً ✓ است، پس بقیه سطر و ستونش ✗. خانه‌های هاشورخورده با آن تناقض دارند.` };
    case "clash":
      return { tone: "turned", text: "هر کس دقیقاً یک چیز دارد و هر چیز مال دقیقاً یک نفر است. سطر یا ستون هاشورخورده دو ✓ دارد، یا همه خانه‌هایش ✗ است." };
    case "incomplete":
      return { tone: "turned", text: "تا اینجا تناقضی نیست، ولی جدول کامل نیست: در هر سطر باید یک ✓ باشد." };
    default:
      return { tone: "bad", text: "هنوز نه. سرنخ‌ها را یکی‌یکی دوباره بخوان." };
  }
}

export function liarsFeedback(q: LiarsQuestion, liar: readonly boolean[]): { tone: Tone; text: string } {
  const m = liarsMistake(q, liar);
  const broken = m.clashes.length ? ` با جواب تو، حرف ${m.clashes.map((k) => q.people[k]).join(" و ")} جور درنمی‌آید؛ هاشور خورده.` : "";
  switch (m.tag) {
    case "right":
      return { tone: "good", text: `درست است! فقط همین حالت با همه حرف‌ها جور است: ${liarsAnswerFa(q)}.` };
    case "trustedLiar":
      return { tone: "turned", text: `حرف ${q.people[m.who!]} را باور کردی، ولی ${q.people[m.who!]} دروغگو است.${broken} جواب: ${liarsAnswerFa(q)}.` };
    case "doubtedTruth":
      return { tone: "turned", text: `${q.people[m.who!]} راستگو است، ولی دروغگو گرفتی‌اش.${broken} جواب: ${liarsAnswerFa(q)}.` };
  }
}

const VENN_SLIP: Record<string, string> = {
  converse: "این برعکسِ «همه» است. «همه گربه‌ها حیوان‌اند» درست است، ولی «همه حیوان‌ها گربه‌اند» نه؛ «همه» را نمی‌شود برعکس کرد.",
  someNotAll: "«بعضی» یعنی «دست‌کم یکی»، نه «فقط بعضی». از «بعضی‌ها هستند» درنمی‌آید که «بعضی‌ها نیستند»؛ شاید همه‌شان باشند.",
  tooStrong: "این زیادی می‌گوید: از جمله‌ها فقط «بعضی» درمی‌آید، نه «همه» یا «هیچ».",
  impossible: "این با جمله‌ها جور نیست؛ اصلاً نمی‌تواند درست باشد. هاشورها و ×ها را ببین.",
  notSure: "این شاید درست باشد، ولی حتماً نه. روی صفحه یک نمونه هست (نقطه‌ها): همه جمله‌ها در آن درست‌اند، ولی این نتیجه نه.",
  missedValid: "یکی از نتیجه‌ها حتماً درست است.",
};

export function vennFeedback(q: VennQuestion, pick: number): { tone: Tone; text: string } {
  const right = `جواب: گزینه ${fa(q.answer + 1)} «${optionText(q, q.answer)}».`;
  const tag = q.tags[pick];
  if (tag === "right") return { tone: "good", text: `درست است! ${q.options[pick] === null ? "از این جمله‌ها چیزی درباره دو گروه کناری حتماً درنمی‌آید." : "در هر شکلی که با جمله‌ها جور باشد، این نتیجه درست است."}` };
  return { tone: tag === "notSure" || tag === "missedValid" ? "bad" : "turned", text: `${VENN_SLIP[tag]} ${right}` };
}

// ───────────── panel ─────────────

export interface TryEntry {
  marks: Mark[];
  liar: (boolean | null)[];
  pick: number | null;
  checked: boolean;
  /** Venn: the child's own hatching, per picture. */
  user: number[];
  /** Venn with numbers: the typed answer and the child's numbers on the diagram. */
  count: CountEntry | null;
}

interface Props {
  question: LogicQuestion;
  type: LogicType;
  level: Level;
  size: 3 | 4;
  extra: boolean;
  entry: TryEntry;
  /** Mock exam: record the answer, show nothing about it; the first check is final. */
  exam?: boolean;
  /** A practice question is on screen: "show me" waits until it is answered. */
  practice?: boolean;
  onLiar: (p: number, liar: boolean) => void;
  onPick: (i: number) => void;
  /** Venn with numbers: the pad changed (answerChanged: the answer itself, not a note on the diagram). */
  onCount: (e: CountEntry, answerChanged: boolean) => void;
  onCheck: () => void;
  onClear: () => void;
  onType: (t: LogicType) => void;
  onLevel: (l: Level) => void;
  onSize: (s: 3 | 4) => void;
  onExtra: (e: boolean) => void;
  onNew: () => void;
  onShow: () => void;
}

export function LogicTryPanel(p: Props) {
  const { question: q, entry } = p;
  const kind = answerKind(q.type);
  const fb = !entry.checked || p.exam
    ? null
    : q.type === "grid"
      ? gridFeedback(q, entry.marks)
      : q.type === "liars"
        ? entry.liar.every((l) => l !== null)
          ? liarsFeedback(q, entry.liar as boolean[])
          : null
        : q.type === "vennNum"
          ? entry.count && entry.count.value !== ""
            ? countFeedback(q, Number(entry.count.value))
            : null
          : entry.pick === null
            ? null
            : q.type === "ifThen"
              ? ifFeedback(q, entry.pick)
              : vennFeedback(q, entry.pick);
  const right = fb?.tone === "good";
  const ticks = entry.marks.filter((m) => m === 1).length;
  const locked = !!p.exam && entry.checked;
  const done = (kind === "choice" ? entry.pick !== null && entry.checked : right) || locked;

  return (
    <div className={styles.panel}>
      <div className={styles.types} role="radiogroup" aria-label="نوع مسئله" data-practice-hide>
        {(Object.keys(LOGIC_TYPE_LABEL) as LogicType[]).map((t) => (
          <button key={t} role="radio" aria-checked={p.type === t} onClick={() => p.onType(t)}>
            {LOGIC_TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      <div className={styles.chips} role="radiogroup" aria-label="سطح" data-practice-hide>
        {([1, 2, 3] as Level[]).map((l) => (
          <button key={l} role="radio" aria-checked={p.level === l} onClick={() => p.onLevel(l)}>
            سطح {fa(l)}
          </button>
        ))}
      </div>
      {q.type === "grid" && (
        <div className={styles.chips} role="group" aria-label="اندازه جدول و تعداد سرنخ" data-practice-hide>
          {([3, 4] as const).map((s) => (
            <button key={s} role="radio" aria-checked={p.size === s} onClick={() => p.onSize(s)}>
              {sizeFa(s)}
            </button>
          ))}
          <button role="checkbox" aria-checked={p.extra} onClick={() => p.onExtra(!p.extra)}>
            {p.extra ? "✓ " : ""}سرنخ بیشتر
          </button>
        </div>
      )}

      <p className={styles.prompt}>{logicPrompt(q)}</p>

      {q.type === "grid" && (
        <p className={styles.hint}>
          {fa(ticks)} ✓ از {fa(q.size)}. سرنخ‌ها کنار جدول‌اند. {entry.checked && !right && !p.exam ? "خانه یا سطر هاشورخورده تناقض دارد؛ درستش کن و دوباره بررسی کن." : ""}
        </p>
      )}

      {q.type === "liars" && (
        <ul className={styles.options} style={{ gridTemplateColumns: "1fr" }} aria-label="راستگو یا دروغگو">
          {q.people.map((name, k) => (
            <li key={k}>
              <div className={styles.chips} role="radiogroup" aria-label={name}>
                <span style={{ alignSelf: "center", minWidth: "4.5em", fontWeight: 700 }}>{name}</span>
                {[false, true].map((l) => (
                  <button key={String(l)} role="radio" aria-checked={entry.liar[k] === l} onClick={() => p.onLiar(k, l)} disabled={right || locked}>
                    {entry.liar[k] === l ? "● " : ""}
                    {kindWord(l)}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      {(q.type === "venn" || q.type === "ifThen") && (
        <ul className={styles.options} style={{ gridTemplateColumns: "1fr" }}>
          {q.options.map((_, i) => {
            const wrongTone = q.type === "ifThen" ? ifTone(q.tags[i]) : q.tags[i] === "notSure" ? "bad" : "turned";
            const m = entry.checked && !p.exam && entry.pick !== null ? (i === q.answer ? "good" : i === entry.pick ? wrongTone : null) : null;
            const icon = m === "good" ? "✓" : m ? "✗" : "";
            return (
              <li key={i}>
                <button
                  className={`${styles.option} ${m ? styles[m] : ""}`}
                  style={{ flexDirection: "row", gap: 8, color: "var(--ink)", justifyContent: "flex-start", padding: "8px 10px", textAlign: "start", outline: !entry.checked && entry.pick === i ? "3px solid var(--accent)" : undefined }}
                  onClick={() => p.onPick(i)}
                  disabled={entry.checked}
                  aria-pressed={entry.pick === i}
                >
                  <span className={styles.optionNum}>
                    {fa(i + 1)} {icon}
                  </span>
                  <span>{q.type === "ifThen" ? ifOptionText(q, i) : optionText(q, i)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {q.type === "vennNum" && entry.count && <CountAnswer q={q} entry={entry.count} right={right || locked} onChange={p.onCount} />}

      {!done && (
        <button
          className={styles.secondary}
          disabled={kind === "grid" ? ticks === 0 : kind === "people" ? entry.liar.some((l) => l === null) : kind === "number" ? !entry.count?.value : entry.pick === null}
          onClick={p.onCheck}
        >
          بررسی
        </button>
      )}

      {fb && (
        <p className={`${styles.feedback} ${styles[fb.tone]}`} role="status" aria-live="polite">
          <span className={styles.icon}>{ICON[fb.tone]}</span> {fb.text}
        </p>
      )}

      {q.type === "grid" && !right && !locked && (
        <button className={styles.secondary} onClick={p.onClear} disabled={!entry.marks.some((m) => m !== 0)}>
          پاک کردن جدول
        </button>
      )}
      {/* The worked solution would give the answer away before a practice question is answered (and in a mock exam at all). */}
      {!p.exam && !(p.practice && !entry.checked) && (
        <button className={styles.secondary} onClick={p.onShow}>
          نشانم بده چطور حل می‌شود
        </button>
      )}
      <button className={styles.next} onClick={p.onNew}>
        نمونه تازه
      </button>
    </div>
  );
}

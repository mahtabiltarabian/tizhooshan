// Words for «اگر… آنگاه» (tool 19): sentences, steps and the working.
// Plain code (no React): IfThen.tsx and the practice adapter share it.

import { IF_STORIES, pathTo, type IfStep, type IfSlipTag, type IfThenQuestion, type Lit, type Move, type Rule } from "@/generators/if-then";
import { fa } from "@/tools/registry";

// ───────────── words ─────────────

export const atomOf = (story: number, a: number) => IF_STORIES[story].atoms[a];
export const litText = (story: number, l: Lit) => (l.value ? atomOf(story, l.atom).yes : atomOf(story, l.atom).no);
export const ruleText = (story: number, [a, b]: Rule) => `اگر ${atomOf(story, a).cond}، ${atomOf(story, b).yes}`;
/** "باران ← زمین خیس" (the arrow points left, the way Persian reads). */
export const arrowFa = (story: number, [a, b]: Rule) => `${atomOf(story, a).short} ← ${atomOf(story, b).short}`;

export const IF_UNKNOWN = "نمی‌توان فهمید";

export function ifOptionText(q: IfThenQuestion, i: number): string {
  const o = q.options[i];
  return o === "unknown" ? IF_UNKNOWN : litText(q.story, { atom: q.target, value: o === "yes" });
}

export function ifPrompt(q: IfThenQuestion): string {
  return `${q.rules.map((r) => `«${ruleText(q.story, r)}».`).join(" ")} می‌دانیم: «${litText(q.story, q.fact)}». کدام نتیجه درست است؟`;
}

export const ifAnswerFa = (q: IfThenQuestion) => `گزینه ${fa(q.answer + 1)}: «${ifOptionText(q, q.answer)}»`;

/** One sound move in words. */
export function moveText(q: Pick<IfThenQuestion, "story" | "rules">, m: Move): string {
  const [a, b] = q.rules[m.rule].map((x) => atomOf(q.story, x));
  const n = fa(m.rule + 1);
  if (m.kind === "ponens") return `پیکان ${n} (${arrowFa(q.story, q.rules[m.rule])}): «${a.short}» درست است و پیکان از آن بیرون می‌رود؛ پس «${b.short}» هم درست است: ${b.yes}.`;
  return `پیکان ${n} (${arrowFa(q.story, q.rules[m.rule])}): اگر «${a.short}» درست بود، «${b.short}» هم درست می‌شد؛ ولی «${b.short}» نادرست است. پس «${a.short}» هم نادرست است: ${a.no}.`;
}

/** The wrong option a child is most tempted by, for "can't tell" (its flipped arrow). */
export const trap = (q: IfThenQuestion) => {
  const i = q.tags.findIndex((t) => t === "affirmConsequent" || t === "denyAntecedent" || t === "reversedChain");
  return i < 0 ? null : { tag: q.tags[i] as IfSlipTag, rule: q.flipped[i]! };
};

/** Why nothing follows about the target. */
export function unknownWhy(q: IfThenQuestion): string {
  const t = trap(q);
  if (!t) return "";
  const [a, b] = q.rules[t.rule].map((x) => atomOf(q.story, x).short);
  const n = fa(t.rule + 1);
  if (t.tag === "affirmConsequent") return ` پیکان ${n} از «${a}» به «${b}» است، نه برعکس: «${b}» شاید دلیل دیگری داشته باشد.`;
  if (t.tag === "denyAntecedent") return ` پیکان ${n} فقط وقتی «${a}» درست باشد چیزی می‌گوید؛ حالا «${a}» نادرست است.`;
  return ` برای رسیدن به آن باید پیکان ${n} را برعکس (از «${b}» به «${a}») برویم، و این مجاز نیست.`;
}

export function ifStepText(q: IfThenQuestion, s: IfStep): string {
  const T = atomOf(q.story, q.target);
  switch (s.kind) {
    case "arrow": {
      const [a, b] = q.rules[s.rule].map((x) => atomOf(q.story, x).short);
      return `جمله ${fa(s.rule + 1)}: «${ruleText(q.story, q.rules[s.rule])}». پیکان از «${a}» به «${b}»: هر وقت «${a}» درست باشد، «${b}» هم درست است.`;
    }
    case "fact":
      return `می‌دانیم «${litText(q.story, q.fact)}»؛ روی «${atomOf(q.story, q.fact.atom).short}» ${q.fact.value ? "✓ درست" : "✗ نادرست"} می‌گذاریم. «درست» در جهت پیکان جلو می‌رود و «نادرست» برعکس پیکان برمی‌گردد.`;
    case "move":
      return moveText(q, s.move);
    case "end":
      return s.truth === "unknown"
        ? `دیگر هیچ پیکانی درباره «${T.short}» چیزی نمی‌گوید.${unknownWhy(q)} هم «${T.yes}» با جمله‌ها جور است، هم «${T.no}»؛ پس: ${IF_UNKNOWN}.`
        : `جواب: ${litText(q.story, { atom: q.target, value: s.truth === "yes" })}.`;
  }
}

/** How the answer is reached, in one line (answer key). */
export function ifHow(q: IfThenQuestion): string {
  const truth = q.options[q.answer];
  if (truth === "unknown") return `هیچ پیکانی از «${litText(q.story, q.fact)}» به «${atomOf(q.story, q.target).short}» نمی‌رسد.${unknownWhy(q)}`;
  const path = pathTo(q.rules, q.fact, { atom: q.target, value: truth === "yes" }, false)!;
  const chain = [q.fact, ...path.map((m) => m.to)].map((l) => litText(q.story, l)).join("، پس ");
  return `${chain} (${truth === "yes" ? "درست در جهت پیکان‌ها جلو می‌رود" : "نادرست برعکس پیکان‌ها برمی‌گردد"}).`;
}


"use client";

// «اگر… آنگاه» for tool 19: the sentences, steps and feedback in Persian, the
// arrow diagram, and the explore panel where the child marks statements.
// Each sentence «اگر A، B» is an arrow from box A to box B; the diagram runs
// right to left like Persian. Nothing relies on colour: every box says
// «؟», «✓ درست» or «✗ نادرست» (with «پس» when it follows rather than being
// known), each arrow carries its sentence number, the arrow in use is thick,
// and an arrow read the wrong way (or broken) is dashed and labelled.

import { useState, useSyncExternalStore } from "react";
import {
  atomsOf,
  IF_STORIES,
  ifModels,
  pathTo,
  soundMoves,
  truthIn,
  type IfSlipTag,
  type IfStep,
  type IfThenQuestion,
  type Lit,
  type Move,
  type Rule,
} from "@/generators/if-then";
import { fa } from "@/tools/registry";
import layout from "@/toolkit/ToolLayout.module.css";
import { ACCENT, BAD, GOOD, INK, PAPER, SOFT } from "./Pictures";

const round = (v: number) => Math.round(v * 10000) / 10000;

// ───────────── words ─────────────

const atomOf = (story: number, a: number) => IF_STORIES[story].atoms[a];
export const litText = (story: number, l: Lit) => (l.value ? atomOf(story, l.atom).yes : atomOf(story, l.atom).no);
export const ruleText = (story: number, [a, b]: Rule) => `اگر ${atomOf(story, a).cond}، ${atomOf(story, b).yes}`;
/** "باران ← زمین خیس" (the arrow points left, the way Persian reads). */
const arrowFa = (story: number, [a, b]: Rule) => `${atomOf(story, a).short} ← ${atomOf(story, b).short}`;

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
function moveText(q: Pick<IfThenQuestion, "story" | "rules">, m: Move): string {
  const [a, b] = q.rules[m.rule].map((x) => atomOf(q.story, x));
  const n = fa(m.rule + 1);
  if (m.kind === "ponens") return `پیکان ${n} (${arrowFa(q.story, q.rules[m.rule])}): «${a.short}» درست است و پیکان از آن بیرون می‌رود؛ پس «${b.short}» هم درست است: ${b.yes}.`;
  return `پیکان ${n} (${arrowFa(q.story, q.rules[m.rule])}): اگر «${a.short}» درست بود، «${b.short}» هم درست می‌شد؛ ولی «${b.short}» نادرست است. پس «${a.short}» هم نادرست است: ${a.no}.`;
}

/** The wrong option a child is most tempted by, for "can't tell" (its flipped arrow). */
const trap = (q: IfThenQuestion) => {
  const i = q.tags.findIndex((t) => t === "affirmConsequent" || t === "denyAntecedent" || t === "reversedChain");
  return i < 0 ? null : { tag: q.tags[i] as IfSlipTag, rule: q.flipped[i]! };
};

/** Why nothing follows about the target. */
function unknownWhy(q: IfThenQuestion): string {
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

// ───────────── feedback ─────────────

type Tone = "good" | "turned" | "bad";

export const ifTone = (tag: IfSlipTag | "right"): Tone => (tag === "right" ? "good" : tag === "opposite" || tag === "unsupported" ? "bad" : "turned");

export function ifFeedback(q: IfThenQuestion, pick: number): { tone: Tone; text: string } {
  const tag = q.tags[pick];
  const answer = `جواب: «${ifOptionText(q, q.answer)}».`;
  if (tag === "right") return { tone: "good", text: `درست است! ${ifHow(q)}` };
  const T = atomOf(q.story, q.target);
  const flip = q.flipped[pick];
  const [A, B] = flip !== null ? q.rules[flip].map((x) => atomOf(q.story, x)) : [T, T];
  const n = flip !== null ? fa(flip + 1) : "";
  let text: string;
  switch (tag) {
    case "affirmConsequent":
      text = `پیکان یک‌طرفه است. «اگر ${A.cond}، ${B.yes}» نمی‌گوید «اگر ${B.cond}، ${A.yes}». «${B.yes}» شاید دلیل دیگری داشته باشد؛ پس درباره «${A.short}» نمی‌توان فهمید.`;
      break;
    case "denyAntecedent":
      text = `«اگر ${A.cond}، ${B.yes}» فقط می‌گوید وقتی «${A.short}» درست است چه می‌شود. حالا «${A.no}»، پس پیکان درباره «${B.short}» چیزی نمی‌گوید؛ شاید به دلیل دیگری درست باشد.`;
      break;
    case "reversedChain":
      text = `زنجیره را جایی برعکس رفتی: پیکان ${n} («اگر ${A.cond}، ${B.yes}») را از «${B.short}» به «${A.short}» خواندی. ${q.fact.value ? "«درست» فقط در جهت پیکان جلو می‌رود" : "«نادرست» فقط برعکس پیکان برمی‌گردد"}؛ پس درباره «${T.short}» نمی‌توان فهمید.`;
      break;
    case "missedTollens":
      text = `می‌شود فهمید! «نادرست» برعکس پیکان برمی‌گردد: اگر «${T.short}» درست بود، طبق پیکان‌ها «${atomOf(q.story, q.fact.atom).short}» هم درست می‌شد؛ ولی «${litText(q.story, q.fact)}».`;
      break;
    case "missedPonens":
      text = `می‌شود فهمید! «درست» در جهت پیکان جلو می‌رود: ${ifHow(q)}`;
      break;
    case "opposite":
      text = `برعکس شد. ${ifHow(q)}`;
      break;
    case "unsupported":
      text = `هیچ جمله‌ای این را نمی‌گوید، حتی اگر پیکانی را برعکس بخوانی. درباره «${T.short}» نمی‌توان فهمید.`;
      break;
  }
  return { tone: ifTone(tag), text: `${text} ${answer}` };
}

// ───────────── the arrow diagram ─────────────

const BOX_W = 3.3;
const BOX_H = 1.35;
const COL = 4.4;
const ROW = 2.05;
/** Room above the boxes for the «پرسش» tag. */
const TOP = 0.5;

/** Upright (top to bottom) layout: one box per row step, so a phone shows it large. */
const COL_UP = BOX_W + 0.5;
const ROW_UP = BOX_H + 1.15;
const PHONE = "(max-width: 900px)";

/** True on phones and portrait tablets, where the diagram is drawn top to bottom. */
export function useUpright() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(PHONE);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(PHONE).matches,
    () => false,
  );
}

/**
 * Where each atom sits: columns by longest path from a start (right to left),
 * rows within a column. Upright, the same steps run top to bottom instead.
 */
export function ifLayout(rules: readonly Rule[], atoms: readonly number[], upright = false) {
  const depth = new Map(atoms.map((a) => [a, 0]));
  for (let i = 0; i < atoms.length; i++) for (const [a, b] of rules) depth.set(b, Math.max(depth.get(b)!, depth.get(a)! + 1));
  const cols = Math.max(...depth.values()) + 1;
  const byCol = Array.from({ length: cols }, (_, c) => atoms.filter((a) => depth.get(a) === c));
  const rows = Math.max(...byCol.map((c) => c.length));
  const pos = new Map<number, [number, number]>();
  if (upright) {
    byCol.forEach((col, c) =>
      col.forEach((a, i) => {
        // Right to left within a step, like Persian.
        const x = round(((rows - col.length) / 2 + (col.length - 1 - i) + 0.5) * COL_UP);
        const y = round(TOP + c * ROW_UP + BOX_H / 2);
        pos.set(a, [x, y]);
      }),
    );
    const view: [number, number, number, number] = [-0.2, 0, round(rows * COL_UP + 0.4), round(TOP + (cols - 1) * ROW_UP + BOX_H + 0.2)];
    return { pos, view, upright };
  }
  byCol.forEach((col, c) =>
    col.forEach((a, i) => {
      const x = round((cols - 1 - c) * COL + BOX_W / 2);
      const y = round(TOP + ((rows - col.length) / 2 + i + 0.5) * ROW);
      pos.set(a, [x, y]);
    }),
  );
  const view: [number, number, number, number] = [-0.3, 0, round((cols - 1) * COL + BOX_W + 0.6), round(TOP + rows * ROW + 0.1)];
  return { pos, view, upright };
}

export type NodeState = { value: boolean | null; derived?: boolean; note?: string };

interface DiagramProps {
  story: number;
  rules: readonly Rule[];
  atoms: readonly number[];
  /** Arrows drawn (indices into rules); all when omitted. */
  shown?: ReadonlySet<number>;
  state: (a: number) => NodeState;
  /** Arrows in use (thick) and arrows broken or read backwards (dashed, labelled). */
  hot?: ReadonlySet<number>;
  broken?: ReadonlyMap<number, string>;
  focus?: number | null;
  /** The atom asked about: tagged «پرسش». */
  ask?: number | null;
  onAtom?: (a: number) => void;
  /** Draw top to bottom (phones). */
  upright?: boolean;
}

const badge = (s: NodeState) => (s.value === null ? s.note ?? "؟" : `${s.derived ? "پس " : ""}${s.value ? "✓ درست" : "✗ نادرست"}`);

export function IfDiagram({ story, rules, atoms, shown, state, hot, broken, focus = null, ask = null, onAtom, upright = false }: DiagramProps) {
  const { pos } = ifLayout(rules, atoms, upright);
  return (
    <g>
      {rules.map(([a, b], i) => {
        if (shown && !shown.has(i)) return null;
        const [ax, ay0] = pos.get(a)!;
        const [bx, by0] = pos.get(b)!;
        // From the left side of A to the right side of B (upright: bottom of A to top of B).
        const x1 = upright ? ax : ax - BOX_W / 2;
        const ay = upright ? ay0 + BOX_H / 2 : ay0;
        const x2 = upright ? bx : bx + BOX_W / 2 + 0.08;
        const by = upright ? by0 - BOX_H / 2 - 0.08 : by0;
        const len = Math.hypot(x2 - x1, by - ay);
        const [ux, uy] = [(x2 - x1) / len, (by - ay) / len];
        const head = 0.32;
        const [hx, hy] = [x2 - ux * head, by - uy * head];
        const isHot = hot?.has(i);
        const bad = broken?.get(i);
        const stroke = bad ? BAD : isHot ? ACCENT : INK;
        const w = isHot || bad ? 0.09 : 0.05;
        const [mx, my] = [round((x1 + x2) / 2), round((ay + by) / 2)];
        return (
          <g key={`r${i}`}>
            <line x1={round(x1)} y1={round(ay)} x2={round(hx)} y2={round(hy)} stroke={stroke} strokeWidth={w} strokeDasharray={bad ? "0.2 0.12" : undefined} />
            <polygon points={`${round(x2)},${round(by)} ${round(hx - uy * 0.17)},${round(hy + ux * 0.17)} ${round(hx + uy * 0.17)},${round(hy - ux * 0.17)}`} fill={stroke} />
            <circle cx={mx} cy={my} r={0.24} fill={PAPER} stroke={stroke} strokeWidth={0.04} />
            <text x={mx} y={my} dy="0.35em" fontSize={0.28} fontWeight={800} textAnchor="middle" fill={stroke}>
              {fa(i + 1)}
            </text>
            {bad && (
              <text x={mx} y={round(my + 0.5)} dy="0.35em" fontSize={0.26} fontWeight={800} textAnchor="middle" fill={BAD}>
                {bad}
              </text>
            )}
          </g>
        );
      })}
      {atoms.map((a) => {
        const [x, y] = pos.get(a)!;
        const s = state(a);
        const fill = s.value === null ? PAPER : s.value ? "#e7f7ee" : "#fde7e4";
        const edge = s.value === null ? SOFT : s.value ? GOOD : BAD;
        return (
          <g key={`a${a}`} onClick={onAtom ? () => onAtom(a) : undefined} style={onAtom ? { cursor: "pointer" } : undefined} role={onAtom ? "button" : undefined} aria-label={onAtom ? `${atomOf(story, a).short}: ${badge(s)}` : undefined}>
            <rect
              x={round(x - BOX_W / 2)}
              y={round(y - BOX_H / 2)}
              width={BOX_W}
              height={BOX_H}
              rx={0.25}
              fill={fill}
              stroke={focus === a ? ACCENT : edge}
              strokeWidth={focus === a ? 0.1 : 0.045}
              strokeDasharray={s.derived || s.value === null ? "0.16 0.09" : undefined}
            />
            <text x={x} y={round(y - 0.25)} dy="0.35em" fontSize={0.4} fontWeight={800} textAnchor="middle" fill={INK}>
              {atomOf(story, a).short}
            </text>
            <text x={x} y={round(y + 0.32)} dy="0.35em" fontSize={0.32} fontWeight={800} textAnchor="middle" fill={s.value === null ? SOFT : edge}>
              {badge(s)}
            </text>
            {ask === a && (
              // Upright, the space above a box holds the incoming arrow, so the tag sits at the box's right corner.
              <text x={upright ? round(x + BOX_W / 2 - 0.55) : x} y={round(y - BOX_H / 2 - 0.25)} dy="0.35em" fontSize={0.3} fontWeight={800} textAnchor="middle" fill={ACCENT}>
                ؟ پرسش
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** Board view of a question's diagram. */
export const ifView = (q: IfThenQuestion, upright = false) => ifLayout(q.rules, atomsOf(q.rules), upright).view;

/** Show me after k steps, or try it (before or after checking). */
export function ifBoard(q: IfThenQuestion, show: { steps: IfStep[]; k: number } | null, pick: number | null, checked: boolean, upright = false) {
  const atoms = atomsOf(q.rules);
  if (show) {
    const shown = new Set<number>();
    const values = new Map<number, boolean>();
    let last: IfStep | undefined;
    for (const s of show.steps.slice(0, show.k)) {
      last = s;
      if (s.kind === "arrow") shown.add(s.rule);
      if (s.kind === "fact") values.set(q.fact.atom, q.fact.value);
      if (s.kind === "move") values.set(s.move.to.atom, s.move.to.value);
    }
    const ended = last?.kind === "end";
    const hot = new Set<number>(last?.kind === "move" || last?.kind === "arrow" ? [last.kind === "move" ? last.move.rule : last.rule] : []);
    const focus = last?.kind === "move" ? last.move.to.atom : last?.kind === "fact" ? q.fact.atom : ended ? q.target : null;
    return (
      <IfDiagram
        upright={upright}
        story={q.story}
        rules={q.rules}
        atoms={atoms}
        shown={shown}
        hot={hot}
        focus={focus}
        ask={q.target}
        state={(a) => (values.has(a) ? { value: values.get(a)!, derived: a !== q.fact.atom } : { value: null, note: ended && a === q.target ? "؟ نمی‌توان فهمید" : undefined })}
      />
    );
  }
  if (!checked) return <IfDiagram upright={upright} story={q.story} rules={q.rules} atoms={atoms} ask={q.target} state={(a) => (a === q.fact.atom ? { value: q.fact.value } : { value: null })} />;
  const values = new Map(soundMoves(q.rules, q.fact).map((m) => [m.to.atom, m.to.value]));
  const flip = pick !== null ? q.flipped[pick] : null;
  return (
    <IfDiagram
      upright={upright}
      story={q.story}
      rules={q.rules}
      atoms={atoms}
      ask={q.target}
      focus={q.target}
      broken={flip !== null ? new Map([[flip, "✗ برعکس خواندی"]]) : undefined}
      state={(a) => (a === q.fact.atom ? { value: q.fact.value } : values.has(a) ? { value: values.get(a)!, derived: true } : { value: null, note: a === q.target ? "؟ نمی‌توان فهمید" : undefined })}
    />
  );
}

// ───────────── explore ─────────────

/** What the child's marks give: per atom a state, and the arrows that break (no world fits). */
export function ifDeduce(rules: readonly Rule[], marks: readonly (boolean | null)[]) {
  const atoms = atomsOf(rules);
  const facts: Lit[] = atoms.filter((a) => marks[a] !== null && marks[a] !== undefined).map((a) => ({ atom: a, value: marks[a]! }));
  const models = ifModels(rules, facts, atoms);
  const broken = new Set<number>();
  if (!models.length) {
    // A true mark that reaches a false one along the arrows: those arrows break.
    for (const t of facts.filter((f) => f.value))
      for (const f of facts.filter((g) => !g.value)) {
        const path = pathTo(rules, t, { atom: f.atom, value: true }, false);
        path?.forEach((m) => broken.add(m.rule));
      }
    return { ok: false as const, broken, state: (a: number): NodeState => ({ value: marks[a] ?? null }), reasons: [] as { atom: number; value: boolean; from: Lit; path: Move[] }[] };
  }
  const reasons: { atom: number; value: boolean; from: Lit; path: Move[] }[] = [];
  const derived = new Map<number, boolean>();
  for (const a of atoms) {
    if (marks[a] !== null && marks[a] !== undefined) continue;
    const t = truthIn(models, a);
    if (t === "yes" || t === "no") {
      derived.set(a, t === "yes");
      const goal = { atom: a, value: t === "yes" };
      for (const f of facts) {
        const path = pathTo(rules, f, goal, false);
        if (path) {
          reasons.push({ atom: a, value: goal.value, from: f, path });
          break;
        }
      }
    }
  }
  return {
    ok: true as const,
    broken,
    reasons,
    state: (a: number): NodeState => (marks[a] !== null && marks[a] !== undefined ? { value: marks[a]! } : derived.has(a) ? { value: derived.get(a)!, derived: true } : { value: null }),
  };
}

export function useIfExplore() {
  const [story, setStoryRaw] = useState(0);
  const [count, setCountRaw] = useState(1);
  const [marks, setMarks] = useState<(boolean | null)[]>(() => IF_STORIES[0].atoms.map(() => null));
  const clear = (s = story) => setMarks(IF_STORIES[s].atoms.map(() => null));
  return {
    story,
    count,
    marks,
    rules: IF_STORIES[story].edges.slice(0, count) as Rule[],
    setStory: (s: number) => {
      setStoryRaw(s);
      setCountRaw((c) => Math.min(c, IF_STORIES[s].edges.length));
      clear(s);
    },
    setCount: (c: number) => {
      setCountRaw(c);
      clear();
    },
    /** ؟ → true → false → ؟ */
    toggle: (a: number) => setMarks((ms) => ms.map((m, i) => (i === a ? (m === null ? true : m ? false : null) : m))),
    clear: () => clear(),
  };
}
export type IfExplore = ReturnType<typeof useIfExplore>;

export const ifExploreView = (ex: IfExplore, upright = false) => ifLayout(ex.rules, atomsOf(ex.rules), upright).view;

export function ifExploreBoard(ex: IfExplore, upright = false) {
  const d = ifDeduce(ex.rules, ex.marks);
  return (
    <IfDiagram
      upright={upright}
      story={ex.story}
      rules={ex.rules}
      atoms={atomsOf(ex.rules)}
      state={d.state}
      broken={d.ok ? undefined : new Map([...d.broken].map((r) => [r, "✗ جور نیست"]))}
      hot={d.ok ? new Set(d.reasons.flatMap((r) => r.path.map((m) => m.rule))) : undefined}
      onAtom={ex.toggle}
    />
  );
}

export function IfExplorePanel({ ex }: { ex: IfExplore }) {
  const d = ifDeduce(ex.rules, ex.marks);
  const atoms = atomsOf(ex.rules);
  const st = IF_STORIES[ex.story];
  const unknown = atoms.filter((a) => d.state(a).value === null);
  return (
    <>
      <h2 className={layout.progress}>پیکان‌ها را بخوان، بعد علامت بزن</h2>
      <div className={layout.chipsRow} role="radiogroup" aria-label="داستان" style={{ flexWrap: "wrap" }}>
        {IF_STORIES.map((s, i) => (
          <button key={i} role="radio" aria-checked={ex.story === i} onClick={() => ex.setStory(i)}>
            {s.atoms[0].short}
          </button>
        ))}
      </div>
      <div className={layout.chipsRow} role="radiogroup" aria-label="تعداد پیکان" style={{ marginTop: 6 }}>
        {st.edges.map((_, i) => (
          <button key={i} role="radio" aria-checked={ex.count === i + 1} onClick={() => ex.setCount(i + 1)}>
            {fa(i + 1)} پیکان
          </button>
        ))}
      </div>
      <ol className={layout.note} style={{ paddingInlineStart: 20 }}>
        {ex.rules.map((r, i) => (
          <li key={i}>
            «{ruleText(ex.story, r)}» <bdi>({arrowFa(ex.story, r)})</bdi>
          </li>
        ))}
      </ol>
      <p className={layout.note}>روی هر جعبه بزن: ؟ ← ✓ درست ← ✗ نادرست ← ؟. جعبه‌هایی که «پس» دارند، از علامت‌های تو حتماً درمی‌آیند.</p>
      <div className={layout.row} style={{ flexWrap: "wrap" }}>
        {atoms.map((a) => (
          <button key={a} className={layout.clear} onClick={() => ex.toggle(a)} aria-label={`${st.atoms[a].short}: ${badge(d.state(a))}`}>
            {st.atoms[a].short}: {ex.marks[a] === null ? "؟" : ex.marks[a] ? "✓" : "✗"}
          </button>
        ))}
      </div>
      <div className={`${layout.status} ${d.ok ? layout.info : layout.warn}`} aria-live="polite">
        {!d.ok ? (
          <>✗ این علامت‌ها با هم جور نیستند: {[...d.broken].map((r) => `پیکان ${fa(r + 1)}`).join(" و ")} می‌گوید اگر اولی درست باشد، دومی هم درست است. یک علامت را عوض کن.</>
        ) : (
          <>
            {d.reasons.map((r) => (
              <div key={r.atom}>
                پس «{litText(ex.story, { atom: r.atom, value: r.value })}» (از «{litText(ex.story, r.from)}»، با {r.path.map((m) => `پیکان ${fa(m.rule + 1)}`).join(" و ")}، {r.value ? "در جهت پیکان" : "برعکس پیکان"})
              </div>
            ))}
            {unknown.length > 0 && <div>درباره {unknown.map((a) => `«${st.atoms[a].short}»`).join(" و ")} {unknown.length === atoms.length ? "هنوز چیزی نمی‌دانیم." : "چیزی درنمی‌آید: نمی‌توان فهمید."}</div>}
          </>
        )}
      </div>
      <p className={layout.note}>
        امتحان کن: فقط «{st.atoms[st.edges[0][1]].short}» را درست بزن. درباره «{st.atoms[st.edges[0][0]].short}» چه می‌فهمی؟ حالا آن را نادرست بزن.
      </p>
      <div className={layout.row}>
        <button className={layout.clear} onClick={ex.clear}>
          پاک کردن علامت‌ها
        </button>
      </div>
    </>
  );
}

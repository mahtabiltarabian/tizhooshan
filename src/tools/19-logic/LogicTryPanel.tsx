"use client";

// Words for tool 19: clues, statements and steps in Persian, the feedback
// that names the slip, and the try-it panel. The board (grid cells, people's
// badges) is where the child answers grids and liars; Venn questions are
// answered here by picking a conclusion.

import {
  answerKind,
  gridCheck,
  liarsMistake,
  type GridQuestion,
  type Level,
  type LiarsQuestion,
  type LogicQuestion,
  type LogicType,
  type Mark,
  type VennQuestion,
} from "@/generators/logic";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/TryPanel.module.css";
import { ifFeedback, ifOptionText, ifTone } from "./IfThen";
import { CountAnswer, countFeedback, type CountEntry } from "./VennCount";

import { LOGIC_TYPE_LABEL, clueText, gridAnswerFa, kindWord, liarsAnswerFa, logicPrompt, optionText, sizeFa } from "./text";
export * from "./text";

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

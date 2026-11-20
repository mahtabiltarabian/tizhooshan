"use client";

import { askMistake, placeMistake, type Level, type SeatingQuestion, type SeatingType } from "@/generators/seating";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/TryPanel.module.css";
import own from "./Seating.module.css";
import { askFeedback, condText, factText, familyFeedback, ICON, placeFeedback, seatingPrompt, SEATING_TYPE_LABEL } from "./text";

/** A condition (or sentence) with its state: true ✓, false ✗, not yet known ·. */
export interface Card {
  text: string;
  state: boolean | null;
  /** Show-me: the step being applied (now) or not reached yet (later). */
  stage?: "now" | "later";
}

export function CondCards({ cards, label, marks = true }: { cards: Card[]; label: string; marks?: boolean }) {
  return (
    <ol className={own.cards} aria-label={label}>
      {cards.map((c, i) => (
        <li key={i} className={[marks && c.state === true ? own.ok : marks && c.state === false ? own.no : "", c.stage ? own[c.stage] : ""].join(" ")} aria-current={c.stage === "now" ? "step" : undefined}>
          <span className={own.num}>{fa(i + 1)}</span>
          <span style={{ flex: 1 }}>{c.text}</span>
          {marks && (
            <span className={own.mark} aria-label={c.state === true ? "برقرار" : c.state === false ? "برقرار نیست" : "هنوز معلوم نیست"}>
              {c.state === true ? "✓" : c.state === false ? "✗" : "·"}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

/** What the learner has done on a try question. */
export interface TryEntry {
  key: string;
  /** Seat (or tree place) of each person, -1: waiting. Scratch work in "ask" and family questions. */
  seatOf: number[];
  sel: number | null;
  /** Ask: the person chosen; family: the option chosen. */
  choice: number | null;
  checked: boolean;
}

interface Props {
  question: SeatingQuestion;
  type: SeatingType;
  level: Level;
  entry: TryEntry;
  /** Mock exam: record the answer, show nothing about it. */
  exam?: boolean;
  /** A practice question is on screen: "show me" waits until it is answered. */
  practice?: boolean;
  onChoice: (c: number) => void;
  onCheck: () => void;
  onClear: () => void;
  onType: (t: SeatingType) => void;
  onLevel: (l: Level) => void;
  onNew: () => void;
  onShow: () => void;
}

export function SeatingTryPanel(p: Props) {
  const { question: q, entry: e } = p;
  const done = e.checked;
  // In a mock exam nothing tells right from wrong until the end.
  const shown = done && !p.exam;

  let fb: { tone: "good" | "turned" | "bad"; text: string } | null = null;
  let cards: Card[];
  let ready: boolean;
  if (q.type === "family") {
    cards = q.facts.map((f) => ({ text: factText(q, f), state: null }));
    ready = e.choice !== null;
    if (shown && e.choice !== null) fb = familyFeedback(q, e.choice);
  } else if (q.variant === "place") {
    const m = shown ? placeMistake(q, e.seatOf) : null;
    cards = q.conds.map((c, i) => ({ text: condText(q, c), state: m ? !m.bad.includes(i) : null }));
    ready = e.seatOf.every((s) => s >= 0);
    if (m) fb = placeFeedback(q, m.tag, m.bad);
  } else {
    cards = q.conds.map((c) => ({ text: condText(q, c), state: null }));
    ready = e.choice !== null;
    if (shown && e.choice !== null) fb = askFeedback(q, askMistake(q, e.choice), e.choice);
  }

  return (
    <div className={styles.panel}>
      <div className={styles.types} role="radiogroup" aria-label="نوع پرسش" data-practice-hide>
        {(Object.keys(SEATING_TYPE_LABEL) as SeatingType[]).map((t) => (
          <button key={t} role="radio" aria-checked={p.type === t} onClick={() => p.onType(t)}>
            {SEATING_TYPE_LABEL[t]}
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

      <p className={styles.prompt}>{seatingPrompt(q)}</p>
      <CondCards cards={cards} label={q.type === "family" ? "جمله‌ها" : "شرط‌ها"} marks={shown && q.type !== "family" && q.variant === "place"} />

      {q.type !== "family" && q.variant === "place" && !done && <p className={styles.hint}>روی یک نام بزن، بعد روی جایش (یا نام را بکش و رها کن). برای برداشتن، نام را بزن و بعد نوار نام‌های پایین را.</p>}

      {q.type !== "family" && q.variant === "ask" && (
        <>
          {!done && <p className={styles.hint}>می‌توانی روی صفحه آدم‌ها را بچینی تا فکر کنی؛ جواب را این‌جا انتخاب کن.</p>}
          <div className={own.names} role="radiogroup" aria-label="جواب">
            {q.names.map((name, i) => (
              <button key={name} role="radio" aria-checked={e.choice === i} onClick={() => p.onChoice(i)} disabled={done}>
                {shown && i === q.answer ? "✓ " : shown && i === e.choice ? "✗ " : ""}
                {name}
              </button>
            ))}
          </div>
        </>
      )}

      {q.type === "family" && (
        <>
          {!done && <p className={styles.hint}>روی صفحه، شکل خانواده هست (مربع: مرد، بیضی: زن). اسم‌ها را بچین تا فکر کنی؛ جواب را این‌جا انتخاب کن.</p>}
          <div className={own.names} role="radiogroup" aria-label="گزینه‌ها" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            {q.options.map((o, i) => (
              <button key={i} role="radio" aria-checked={e.choice === i} onClick={() => p.onChoice(i)} disabled={done}>
                {fa(i + 1)}. {shown && i === q.answer ? "✓ " : shown && i === e.choice ? "✗ " : ""}
                {o.text}
              </button>
            ))}
          </div>
        </>
      )}

      {!done && (
        <div className={own.stepper} style={{ justifyContent: "stretch" }}>
          <button className={styles.secondary} style={{ flex: 2, width: "auto" }} disabled={!ready} onClick={p.onCheck}>
            بررسی
          </button>
          <button className={styles.secondary} style={{ flex: 1, width: "auto" }} onClick={p.onClear}>
            پاک کن
          </button>
        </div>
      )}

      {fb && (
        <p className={`${styles.feedback} ${styles[fb.tone]}`} role="status" aria-live="polite">
          <span className={styles.icon}>{ICON[fb.tone]}</span> {fb.text}
        </p>
      )}
      {shown && q.type !== "family" && q.variant === "place" && <p className={styles.hint}>روی صفحه، چیدمان درست است؛ ✓ یعنی آن جا را درست گذاشته بودی و ✗ یعنی نه («تو: …» جای تو را می‌گوید).</p>}
      {shown && q.type !== "family" && q.variant === "ask" && <p className={styles.hint}>روی صفحه، جاهایی که شرط‌ها حتماً معلوم می‌کنند پر شده‌اند؛ بقیه می‌توانند فرق کنند.</p>}

      {/* The worked solution would give the answer away before a practice question is answered (and in a mock exam at all). */}
      {!p.exam && !(p.practice && !done) && (
        <button className={styles.secondary} onClick={p.onShow}>
          نشانم بده روی همین
        </button>
      )}
      <button className={styles.next} onClick={p.onNew}>
        نمونه تازه
      </button>
    </div>
  );
}

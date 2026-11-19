"use client";

// Worksheet for tool 9: the terms in a row of boxes, read right to left, with
// a dashed box for the gap. Each sheet uses the level's own gap position
// (last at level 1). Repeating patterns show the given row, "…" and the box
// for item N. Nth-term questions show the first terms (or the first three
// shapes of a pattern, with their counts) and the far place; a rule question
// shows the two boxes. The answer key adds the working.

import { cycleAnswerIsCount, itemAt, makeCycleQuestion, type CycleQuestion } from "@/generators/cycle";
import { makeNthQuestion, PATTERNS, termsOf, type NthQuestion } from "@/generators/nth-term";
import { makeSequenceQuestion, type SequenceQuestion } from "@/generators/sequence";
import { fa } from "@/tools/registry";
import { WorksheetShell, type WorksheetConfig } from "@/toolkit/WorksheetShell";
import { SymbolIcon } from "./Cycle";
import { cycleAnswerFa, cycleHow, cyclePrompt } from "./CycleTryPanel";
import { PatternG, patternView } from "./Nth";
import { nthAnswerFa, nthHow, nthPrompt, RULE_TEMPLATE } from "./NthTryPanel";
import css from "./Sequence.module.css";
import { answerFa, SEQ_TYPE_LABEL, sequenceHow, sequencePrompt, type SeqTryType } from "./SequenceTryPanel";
import { termFa } from "./Train";
import styles from "@/toolkit/Worksheet.module.css";

type SheetQuestion = SequenceQuestion | CycleQuestion | NthQuestion;

function nthFigures(q: NthQuestion) {
  if (q.variant === "pattern") {
    const [, , w, h] = patternView(q.pattern!, q.shown);
    return (
      <>
        <svg viewBox={`0 0 ${w} ${h - 1.9}`} width="100%" style={{ maxWidth: 420, display: "block", margin: "8px auto" }} aria-label="شکل‌های الگو">
          <PatternG kind={q.pattern!} shown={q.shown} n={q.n} done={false} />
        </svg>
        <p className={styles.symbols}>جواب: ............ {PATTERNS[q.pattern!].tiles ? "کاشی" : "چوب‌کبریت"}</p>
      </>
    );
  }
  const row = (vals: number[], mark?: string) => (
    <div className={css.seqRow}>
      {mark && <span className={css.box} style={{ border: "none" }}>{mark}</span>}
      {vals.map((v, k) => (
        <span key={k} className={css.box}>
          {fa(v)}
        </span>
      ))}
      <span className={css.box} style={{ border: "none" }}>
        …
      </span>
      {q.variant === "far" && (
        <span className={`${css.box} ${css.gap}`}>
          <small>جمله {fa(q.n)}</small>
        </span>
      )}
    </div>
  );
  return (
    <>
      {q.variant === "meet" ? (
        <>
          {row(termsOf(q, q.shown), "●")}
          {row(termsOf(q, q.shown, true), "▲")}
        </>
      ) : (
        row(termsOf(q, q.shown))
      )}
      <p className={styles.symbols}>{q.variant === "rule" ? <>جمله nام = {RULE_TEMPLATE}</> : "جواب: ............"}</p>
    </>
  );
}

function cycleFigures(q: CycleQuestion) {
  return (
    <>
      <div className={css.seqRow}>
        {Array.from({ length: q.shown }, (_, k) => (
          <span key={k} className={css.box}>
            <SymbolIcon set={q.set} id={itemAt(q, k + 1)} size={22} />
          </span>
        ))}
        <span className={css.box} style={{ border: "none" }}>
          …
        </span>
        {!cycleAnswerIsCount(q) && (
          <span className={`${css.box} ${css.gap}`}>
            <small>خانه {fa(q.n)}</small>
          </span>
        )}
      </div>
      <p className={styles.symbols}>جواب: ............</p>
    </>
  );
}

function figures(q: SheetQuestion) {
  if (q.type === "cycle") return cycleFigures(q);
  if (q.type === "nth") return nthFigures(q);
  return (
    <>
      <div className={css.seqRow}>
        {q.terms.map((v, k) => (
          <span key={k} className={`${css.box} ${k === q.blank ? css.gap : ""}`}>
            {k === q.blank ? "…" : termFa(v, q.letters)}
          </span>
        ))}
      </div>
      <p className={styles.symbols}>جواب: ............</p>
    </>
  );
}

function answer(q: SheetQuestion) {
  return (
    <>
      {q.type === "cycle" ? cycleAnswerFa(q) : q.type === "nth" ? nthAnswerFa(q) : answerFa(q)} ·{" "}
      <span style={{ fontWeight: 400 }}>{q.type === "cycle" ? cycleHow(q) : q.type === "nth" ? nthHow(q) : sequenceHow(q)}</span>
    </>
  );
}

const CONFIG: WorksheetConfig<SeqTryType, SheetQuestion> = {
  title: "دنباله",
  backHref: "/tools/sequence",
  typeLabels: SEQ_TYPE_LABEL,
  defaultTypes: ["mixed"],
  make: (type, level, seed) => (type === "cycle" ? makeCycleQuestion(level, seed) : type === "nth" ? makeNthQuestion(level, seed) : makeSequenceQuestion(type, level, seed)),
  prompt: (q) => (q.type === "cycle" ? cyclePrompt(q) : q.type === "nth" ? nthPrompt(q) : sequencePrompt(q, true)),
  figures,
  answer,
};

export function SequenceWorksheet() {
  return <WorksheetShell config={CONFIG} />;
}

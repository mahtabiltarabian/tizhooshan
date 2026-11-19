"use client";

// Worksheet for tool 9: the terms in a row of boxes, read right to left, with
// a dashed box for the gap. Each sheet uses the level's own gap position
// (last at level 1). Repeating patterns show the given row, "…" and the box
// for item N. The answer key adds the working.

import { cycleAnswerIsCount, itemAt, makeCycleQuestion, type CycleQuestion } from "@/generators/cycle";
import { makeSequenceQuestion, type SequenceQuestion } from "@/generators/sequence";
import { fa } from "@/tools/registry";
import { WorksheetShell, type WorksheetConfig } from "@/toolkit/WorksheetShell";
import { SymbolIcon } from "./Cycle";
import { cycleAnswerFa, cycleHow, cyclePrompt } from "./CycleTryPanel";
import css from "./Sequence.module.css";
import { answerFa, SEQ_TYPE_LABEL, sequenceHow, sequencePrompt, type SeqTryType } from "./SequenceTryPanel";
import { termFa } from "./Train";
import styles from "@/toolkit/Worksheet.module.css";

type SheetQuestion = SequenceQuestion | CycleQuestion;

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
      {q.type === "cycle" ? cycleAnswerFa(q) : answerFa(q)} · <span style={{ fontWeight: 400 }}>{q.type === "cycle" ? cycleHow(q) : sequenceHow(q)}</span>
    </>
  );
}

const CONFIG: WorksheetConfig<SeqTryType, SheetQuestion> = {
  title: "دنباله",
  backHref: "/tools/sequence",
  typeLabels: SEQ_TYPE_LABEL,
  defaultTypes: ["mixed"],
  make: (type, level, seed) => (type === "cycle" ? makeCycleQuestion(level, seed) : makeSequenceQuestion(type, level, seed)),
  prompt: (q) => (q.type === "cycle" ? cyclePrompt(q) : sequencePrompt(q, true)),
  figures,
  answer,
};

export function SequenceWorksheet() {
  return <WorksheetShell config={CONFIG} />;
}

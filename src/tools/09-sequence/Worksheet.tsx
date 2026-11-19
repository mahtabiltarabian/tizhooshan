"use client";

// Worksheet for tool 9: the terms in a row of boxes, read right to left, with
// a dashed box for the gap. Each sheet uses the level's own gap position
// (last at level 1). The answer key adds the working.

import { makeSequenceQuestion, type SequenceQuestion, type SequenceQuestionType } from "@/generators/sequence";
import { WorksheetShell, type WorksheetConfig } from "@/toolkit/WorksheetShell";
import css from "./Sequence.module.css";
import { answerFa, SEQ_TYPE_LABEL, sequenceHow, sequencePrompt } from "./SequenceTryPanel";
import { termFa } from "./Train";
import styles from "@/toolkit/Worksheet.module.css";

function figures(q: SequenceQuestion) {
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

function answer(q: SequenceQuestion) {
  return (
    <>
      {answerFa(q)} · <span style={{ fontWeight: 400 }}>{sequenceHow(q)}</span>
    </>
  );
}

const CONFIG: WorksheetConfig<SequenceQuestionType, SequenceQuestion> = {
  title: "دنباله",
  backHref: "/tools/sequence",
  typeLabels: SEQ_TYPE_LABEL,
  defaultTypes: ["mixed"],
  make: (type, level, seed) => makeSequenceQuestion(type, level, seed),
  prompt: (q) => sequencePrompt(q, true),
  figures,
  answer,
};

export function SequenceWorksheet() {
  return <WorksheetShell config={CONFIG} />;
}

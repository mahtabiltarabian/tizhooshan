"use client";

// Worksheet for tool 17: the question in words, a picture where it helps (the
// grid, the roads, the drawer, the people on a circle) and an answer line.
// Probability asks for a fraction. The answer key adds the working.

import { makeCountingQuestion, type CountingQuestion, type CountingQuestionType } from "@/generators/counting";
import { WorksheetShell, type WorksheetConfig } from "@/toolkit/WorksheetShell";
import { SetupG } from "./Pictures";
import { answerText, COUNTING_TYPE_LABEL, countingHow, countingPrompt } from "./text";
import styles from "@/toolkit/Worksheet.module.css";
import own from "./counting.module.css";

/** The board picture, small, on paper. */
function Fig({ q, width }: { q: CountingQuestion; width: number }) {
  return (
    <div className={own.paperFig}>
      <svg width={width} height={(width * 9) / 16} viewBox="0 0 16 9" style={{ direction: "ltr" }} role="img" aria-label="شکل مسئله">
        <SetupG q={q} />
      </svg>
    </div>
  );
}

function figures(q: CountingQuestion) {
  const line = q.type === "probability" ? "احتمال: ........ بر ........" : "جواب: ..................";
  const pic = q.type === "grid" || (q.type === "tree" && q.variant === "roads") || q.type === "pigeonhole" || (q.type === "handshake" && q.variant !== "inverse");
  return (
    <>
      {pic && <Fig q={q} width={300} />}
      <p className={styles.symbols}>{line}</p>
    </>
  );
}

function answer(q: CountingQuestion) {
  return (
    <>
      {answerText(q)} · <span style={{ fontWeight: 400 }}>{countingHow(q)}</span>
    </>
  );
}

const CONFIG: WorksheetConfig<CountingQuestionType, CountingQuestion> = {
  title: "چیدمان و شمارش",
  backHref: "/tools/counting",
  typeLabels: COUNTING_TYPE_LABEL,
  defaultTypes: ["tree", "arrange", "handshake", "grid"],
  make: makeCountingQuestion,
  prompt: (q) => countingPrompt(q, true),
  figures,
  answer,
};

export function CountingWorksheet() {
  return <WorksheetShell config={CONFIG} />;
}

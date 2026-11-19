"use client";

// Worksheet for tool 5: the figure, and a box to write the count in. Growing
// patterns show their first three stages. The answer key adds the
// systematic count (smallest first).

import { figureOf, GROW, listShapes, makeCountQuestion, questionSpec, type CountQuestion, type CountQuestionType } from "@/generators/shape-count";
import { FigureRow, WorksheetShell, type WorksheetConfig } from "@/toolkit/WorksheetShell";
import { fa } from "@/tools/registry";
import { COUNT_TYPE_LABEL, countPrompt, groupsOf, groupSum } from "./CounterTryPanel";
import { CountFigureSvg } from "./Pictures";
import styles from "@/toolkit/Worksheet.module.css";

function figures(q: CountQuestion) {
  if (q.type === "growing")
    return (
      <FigureRow>
        {[1, 2, 3].map((n) => (
          <figure key={n} className={styles.caption}>
            <CountFigureSvg fig={figureOf(GROW[q.pattern].stage(n))} size={64} origin={q.kind === "angle"} />
            <figcaption>مرحله {fa(n)}</figcaption>
          </figure>
        ))}
        <span className={styles.bigNum}>…</span>
        <figure className={styles.caption}>
          <span className={styles.bigNum}>؟</span>
          <figcaption>مرحله {fa(q.ask)}</figcaption>
        </figure>
      </FigureRow>
    );
  return (
    <>
      <FigureRow>
        <CountFigureSvg fig={figureOf(q.spec)} size={q.spec.family === "line" ? 220 : 170} origin={q.kind === "angle"} />
      </FigureRow>
      <p className={styles.symbols}>جواب: ............</p>
    </>
  );
}

function answer(q: CountQuestion) {
  if (q.type === "growing") return <>{fa(q.answer)}</>;
  const groups = groupsOf(listShapes(figureOf(questionSpec(q)), q.kind));
  return <>{groups.length > 1 ? groupSum(groups) : fa(q.answer)}</>;
}

const CONFIG: WorksheetConfig<CountQuestionType, CountQuestion> = {
  title: "شمارشگر شکل",
  backHref: "/tools/shape-counter",
  typeLabels: COUNT_TYPE_LABEL,
  defaultTypes: ["triangle", "square", "rectangle", "angle"],
  make: makeCountQuestion,
  prompt: countPrompt,
  figures,
  answer,
};

export function ShapeCounterWorksheet() {
  return <WorksheetShell config={CONFIG} />;
}

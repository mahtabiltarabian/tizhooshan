"use client";

// Worksheet for tool 5: the figure, and a box to write the count in. Growing
// patterns show their first three stages. The answer key adds the
// systematic count (smallest first). Hidden figure: the shape and four
// numbered drawings at the same scale. One stroke: four figures, or one
// figure with lettered points.

import type { HiddenQuestion } from "@/generators/hidden-figure";
import { degrees, oddPoints, pointNames, type StrokeQuestion } from "@/generators/one-stroke";
import { figureOf, GROW, isCountQuestion, listShapes, makeShapeQuestion, questionSpec, type CountQuestion, type ShapeQuestion, type ShapeQuestionType } from "@/generators/shape-count";
import { Choices, FigureRow, WorksheetShell, type WorksheetConfig } from "@/toolkit/WorksheetShell";
import { fa } from "@/tools/registry";
import { COUNT_TYPE_LABEL, countPrompt, groupsOf, groupSum } from "./CounterTryPanel";
import { hiddenPrompt, SLIP_WORD } from "./HiddenLab";
import { HiddenSvg } from "./HiddenPictures";
import { CountFigureSvg } from "./Pictures";
import { strokePrompt } from "./StrokeLab";
import { StrokeSvg } from "./StrokePictures";
import styles from "@/toolkit/Worksheet.module.css";

function hiddenFigures(q: HiddenQuestion) {
  return (
    <>
      <FigureRow>
        <HiddenSvg shape={q.shape} n={q.n} size={100} />
      </FigureRow>
      <Choices wide>{q.options.map((segs, i) => <HiddenSvg key={i} segs={segs} n={q.n} size={100} />)}</Choices>
    </>
  );
}

function strokeFigures(q: StrokeQuestion) {
  if (q.ask === "which") return <Choices wide>{q.options.map((f, i) => <StrokeSvg key={i} fig={f} size={96} />)}</Choices>;
  const names = pointNames(q);
  return (
    <>
      <FigureRow>
        <StrokeSvg fig={q.fig} size={150} names={names} start={q.ask === "end" ? q.from : null} />
      </FigureRow>
      {q.ask === "count" ? <p className={styles.symbols}>جواب: ............</p> : <Choices>{q.choices.map((v) => <span key={v}>«{names.get(v)}»</span>)}</Choices>}
    </>
  );
}

function strokeAnswer(q: StrokeQuestion) {
  if (q.ask === "count") return <>{fa(q.answer)}</>;
  if (q.ask === "which") return <>گزینه {fa(q.answer + 1)} ({fa(oddPoints(q.options[q.answer]).length)} رأس فرد؛ بقیه: {q.options.filter((_, i) => i !== q.answer).map((f) => fa(oddPoints(f).length)).join("، ")})</>;
  const names = pointNames(q);
  const deg = degrees(q.fig);
  return (
    <>
      «{names.get(q.choices[q.answer])}» (درجه {fa(deg[q.choices[q.answer]])})
    </>
  );
}

const hiddenAnswer = (q: HiddenQuestion) => (
  <>
    گزینه {fa(q.answer + 1)} ({q.mistakes.map((m, i) => (m ? `${fa(i + 1)}: ${SLIP_WORD[m]}` : null)).filter(Boolean).join("، ")})
  </>
);

function figures(q: ShapeQuestion) {
  if (q.type === "hidden") return hiddenFigures(q);
  if (q.type === "stroke") return strokeFigures(q);
  return countFigures(q);
}

function countFigures(q: CountQuestion) {
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

function answer(q: ShapeQuestion) {
  if (q.type === "hidden") return hiddenAnswer(q);
  if (q.type === "stroke") return strokeAnswer(q);
  if (q.type === "growing") return <>{fa(q.answer)}</>;
  const groups = groupsOf(listShapes(figureOf(questionSpec(q)), q.kind));
  return <>{groups.length > 1 ? groupSum(groups) : fa(q.answer)}</>;
}

const prompt = (q: ShapeQuestion) => (isCountQuestion(q) ? countPrompt(q) : q.type === "hidden" ? hiddenPrompt(q) : strokePrompt(q));

const CONFIG: WorksheetConfig<ShapeQuestionType, ShapeQuestion> = {
  title: "شمارشگر شکل",
  backHref: "/tools/shape-counter",
  typeLabels: COUNT_TYPE_LABEL,
  defaultTypes: ["triangle", "square", "rectangle", "angle"],
  make: makeShapeQuestion,
  prompt,
  figures,
  answer,
};

export function ShapeCounterWorksheet() {
  return <WorksheetShell config={CONFIG} />;
}

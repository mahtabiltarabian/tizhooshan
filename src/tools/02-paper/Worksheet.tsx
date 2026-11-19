"use client";

// Worksheet for tool 2. Each question shows the folds in order (dashed line,
// tinted flap, arrow), then the folded paper with its hole or cut.

import { makePaperQuestion, shapes, unfoldPoints, type PaperQuestion, type PaperQuestionType } from "@/generators/paper-folding";
import { Choices, FigureRow, WorksheetShell, type WorksheetConfig } from "@/toolkit/WorksheetShell";
import { fa } from "@/tools/registry";
import { PAPER_TYPE_LABEL, paperPrompt } from "./PaperTryPanel";
import { FoldSteps, PaperSvg, STEP_NAMES } from "./Pictures";
import styles from "@/toolkit/Worksheet.module.css";

function figures(q: PaperQuestion) {
  const final = shapes(q.S, q.folds).at(-1)!;
  const steps = <FoldSteps S={q.S} folds={q.folds} size={78} />;
  switch (q.type) {
    case "holes":
      return (
        <>
          <FigureRow>
            {steps}
            <PaperSvg S={q.S} size={96} shape={final} outline holes={q.punches} />
          </FigureRow>
          <div className={styles.answerGrid}>
            <PaperSvg S={q.S} size={150} />
          </div>
        </>
      );
    case "holesChoice":
      return (
        <>
          <FigureRow>
            {steps}
            <PaperSvg S={q.S} size={96} shape={final} outline holes={q.punches} />
          </FigureRow>
          <Choices>
            {q.options.map((pts, i) => (
              <PaperSvg key={i} S={q.S} size={84} holes={pts} />
            ))}
          </Choices>
        </>
      );
    case "cutChoice":
      return (
        <>
          <FigureRow>
            {steps}
            <PaperSvg S={q.S} size={96} shape={final} outline removed={[q.cut]} />
          </FigureRow>
          <Choices>
            {q.options.map((polys, i) => (
              <PaperSvg key={i} S={q.S} size={84} removed={polys} grid={false} />
            ))}
          </Choices>
        </>
      );
    case "pieces":
      return (
        <>
          <FigureRow>
            {steps}
            <PaperSvg S={q.S} size={96} shape={final} outline cuts={[q.segment]} />
          </FigureRow>
          <Choices>
            {q.options.map((v, i) => (
              <span key={i} className={styles.bigNum}>
                {fa(v)}
              </span>
            ))}
          </Choices>
        </>
      );
    case "foldedShape":
      return (
        <>
          <FigureRow>{steps}</FigureRow>
          <Choices>
            {q.options.map((poly, i) => (
              <PaperSvg key={i} S={q.S} size={84} shape={poly} outline grid={false} />
            ))}
          </Choices>
        </>
      );
    case "order":
      return (
        <FigureRow>
          <FoldSteps S={q.S} folds={q.folds} size={92} order={q.shown} />
        </FigureRow>
      );
  }
}

function answer(q: PaperQuestion) {
  if (q.type === "holes")
    return (
      <>
        {fa(q.answer.length)} سوراخ:{" "}
        <span className={styles.keyGrid}>
          <PaperSvg S={q.S} size={70} holes={unfoldPoints(q.punches, q.folds)} />
        </span>
      </>
    );
  if (q.type === "order") return <>{q.folds.map((_, i) => STEP_NAMES[q.shown.indexOf(i)]).join("، ")}</>;
  return <>گزینه {fa(q.answer + 1)}</>;
}

const CONFIG: WorksheetConfig<PaperQuestionType, PaperQuestion> = {
  title: "کاغذ: تا کن، سوراخ کن، باز کن",
  backHref: "/tools/paper",
  typeLabels: PAPER_TYPE_LABEL,
  defaultTypes: ["holes", "holesChoice"],
  make: makePaperQuestion,
  prompt: (q) => paperPrompt(q, true),
  figures,
  answer,
};

export function PaperWorksheet() {
  return <WorksheetShell config={CONFIG} />;
}

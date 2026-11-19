"use client";

// Worksheet for tool 14: the question in words, the fractions drawn stacked
// beside it, a shape to shade or room for a bar model, and an answer line.
// The answer key adds the working.

import { makeRatioQuestion, type RatioQuestion, type RatioQuestionType } from "@/generators/ratio";
import { FigureRow, WorksheetShell, type WorksheetConfig } from "@/toolkit/WorksheetShell";
import { FracH, Rich } from "./Frac";
import { ShapeSvg } from "./Pictures";
import { answerSegs, RATIO_TYPE_LABEL, ratioHow, ratioPrompt, segText } from "./text";
import styles from "@/toolkit/Worksheet.module.css";
import own from "./ratio.module.css";

function figures(q: RatioQuestion) {
  switch (q.type) {
    case "shade":
      return (
        <FigureRow>
          <FracH f={q.frac} big />
          <ShapeSvg shape={q.shape} parts={q.parts} width={q.shape === "bar" ? 230 : 120} />
        </FigureRow>
      );
    case "compare":
      return (
        <div className={own.paperFracs}>
          <FracH f={q.fracs[0]} big />
          <FracH f={q.fracs[1]} big />
        </div>
      );
    case "partOf":
      return (
        <>
          <div className={own.paperFracs}>
            <FracH f={q.frac} big />
          </div>
          <p className={styles.symbols}>جواب: ..................</p>
        </>
      );
    case "work":
      return <p className={styles.symbols}>{q.variant === "single" || q.variant === "pairFraction" ? "کسر: ........ بر ........" : "جواب: .................."}</p>;
    default:
      return <p className={styles.symbols}>جواب: ..................</p>;
  }
}

function answer(q: RatioQuestion) {
  return (
    <>
      <Rich segs={answerSegs(q)} /> · <span style={{ fontWeight: 400 }}>
        <Rich segs={ratioHow(q)} />
      </span>
    </>
  );
}

const CONFIG: WorksheetConfig<RatioQuestionType, RatioQuestion> = {
  title: "نسبت",
  backHref: "/tools/ratio",
  typeLabels: RATIO_TYPE_LABEL,
  defaultTypes: ["shade", "partOf", "ratio", "percent"],
  make: makeRatioQuestion,
  prompt: (q) => segText(ratioPrompt(q, true)),
  figures,
  answer,
};

export function RatioWorksheet() {
  return <WorksheetShell config={CONFIG} />;
}

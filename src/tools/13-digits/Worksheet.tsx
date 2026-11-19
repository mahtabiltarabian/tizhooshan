"use client";

// Worksheet for tool 13: cards to arrange, a number with a box, or a
// matchstick equation to correct. Counting and digit-sum questions are text
// with an answer line. The answer key adds the working.

import { makeDigitsQuestion, type DigitsQuestion, type DigitsQuestionType } from "@/generators/digits";
import { FigureRow, WorksheetShell, type WorksheetConfig } from "@/toolkit/WorksheetShell";
import { answerFa, digitsHow, DIGITS_TYPE_LABEL, digitsPrompt, holeFa } from "./DigitsTryPanel";
import { CardsSvg, MatchSvg } from "./Pictures";
import styles from "@/toolkit/Worksheet.module.css";

function figures(q: DigitsQuestion) {
  switch (q.type) {
    case "extreme":
    case "condition":
      return (
        <>
          <FigureRow>
            <CardsSvg cards={q.cards} height={52} />
          </FigureRow>
          <p className={styles.symbols}>{q.type === "extreme" && q.want === "diff" ? "تفاضل" : "عدد"}: ..................</p>
        </>
      );
    case "divisible":
      return (
        <p className={styles.symbols} style={{ fontSize: "1.4rem" }}>
          {holeFa(q.digits)} · رقم: ......
        </p>
      );
    case "match":
      return (
        <>
          <FigureRow>
            <MatchSvg lens={q.lens} masks={q.start} width={q.lens.join("") === "111" ? 250 : 290} />
          </FigureRow>
          <p className={styles.symbols}>تساوی درست: ..................</p>
        </>
      );
    default:
      return <p className={styles.symbols}>جواب: ..................</p>;
  }
}

function answer(q: DigitsQuestion) {
  if (q.type === "match") return <>{answerFa(q)}</>;
  return (
    <>
      {answerFa(q)} · <span style={{ fontWeight: 400 }}>{digitsHow(q)}</span>
    </>
  );
}

const CONFIG: WorksheetConfig<DigitsQuestionType, DigitsQuestion> = {
  title: "ارقام",
  backHref: "/tools/digits",
  typeLabels: DIGITS_TYPE_LABEL,
  defaultTypes: ["extreme", "condition", "count", "match"],
  make: makeDigitsQuestion,
  prompt: (q) => digitsPrompt(q, true),
  figures,
  answer,
};

export function DigitsWorksheet() {
  return <WorksheetShell config={CONFIG} />;
}

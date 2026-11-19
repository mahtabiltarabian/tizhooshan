"use client";

// Worksheet for tool 13: cards to arrange, a number with a box, a
// matchstick equation to correct, or a board to cover with dominoes. Counting and digit-sum questions are text
// with an answer line. The answer key adds the working.

import { answerKind, isMore, makeDigitsQuestion, type DigitsQuestion, type DigitsQuestionType } from "@/generators/digits";
import { choiceWords } from "@/generators/digits-numbers";
import { fa } from "@/tools/registry";
import { FigureRow, WorksheetShell, type WorksheetConfig } from "@/toolkit/WorksheetShell";
import { answerFa, digitsHow, DIGITS_TYPE_LABEL, digitsPrompt, holeFa } from "./DigitsTryPanel";
import { CryptG } from "./MoreBoards";
import { exprFa, moreSteps } from "./MoreText";
import { DominoPaper } from "./NumberBoards";
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
    case "crypt":
      return (
        <>
          <FigureRow>
            <svg viewBox="4 0.3 6 7.1" width={150} role="img" aria-label="جمع رمزی">
              <CryptG q={q} vals={q.letters.map(() => null)} />
            </svg>
          </FigureRow>
          <p className={styles.symbols}>{q.letters.map((l) => `${l} = ......`).join("   ")}</p>
        </>
      );
    case "signs":
      return (
        <p className={styles.symbols} style={{ fontSize: "1.3rem" }}>
          {exprFa(q.nums, q.ops.map(() => null), q.paren).replace(/؟/g, "☐")} = {fa(q.target)}
        </p>
      );
    case "prime":
    case "parity": {
      const kind = answerKind(q);
      return (
        <>
          {q.type === "parity" && q.ask === "domino" && (
            <FigureRow>
              <DominoPaper rows={q.nums[0]} cols={q.nums[1]} variant={q.variant} />
            </FigureRow>
          )}
          <p className={styles.symbols}>
            {kind === "choice" ? `${choiceWords(q).join("  /  ")} (یکی را دور کن) · دلیل: ..................` : kind === "factors" && q.type === "prime" ? `${fa(q.n)} = .... × .... × .... × ....` : "جواب: .................."}
          </p>
        </>
      );
    }
    default:
      return <p className={styles.symbols}>جواب: ..................</p>;
  }
}

function answer(q: DigitsQuestion) {
  if (q.type === "match") return <>{answerFa(q)}</>;
  if (isMore(q))
    return (
      <>
        {answerFa(q)} · <span style={{ fontWeight: 400 }}>{moreSteps(q).filter((s) => !s.startsWith("قاعده")).join(" ")}</span>
      </>
    );
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

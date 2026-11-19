"use client";

// Worksheet for tool 8: the clock (or the mirror image, or the start time)
// and a blank face to draw the answer hands on. Day questions are text only.
// The answer key adds the working.

import { makeClockQuestion, type ClockQuestion, type ClockQuestionType } from "@/generators/clock";
import { FigureRow, WorksheetShell, type WorksheetConfig } from "@/toolkit/WorksheetShell";
import { answerFa, CLOCK_TYPE_LABEL, clockHow, clockPrompt } from "./ClockTryPanel";
import { ClockSvg } from "./Pictures";
import styles from "@/toolkit/Worksheet.module.css";

function figures(q: ClockQuestion) {
  switch (q.type) {
    case "angle":
      return (
        <>
          <FigureRow>
            <ClockSvg t={q.time} size={120} />
          </FigureRow>
          <p className={styles.symbols}>زاویه: ............ درجه</p>
        </>
      );
    case "mirror":
    case "elapsed":
    case "drift":
      return (
        <>
          <FigureRow>
            <figure className={styles.caption}>
              <ClockSvg t={q.type === "mirror" ? q.shown : q.start} size={104} mirrored={q.type === "mirror"} />
              <figcaption>{q.type === "mirror" ? "در آینه" : "شروع"}</figcaption>
            </figure>
            <figure className={styles.caption}>
              <ClockSvg t={0} size={104} noHands />
              <figcaption>عقربه‌ها را بکش</figcaption>
            </figure>
          </FigureRow>
          <p className={styles.symbols}>ساعت: ...... : ......</p>
        </>
      );
    default:
      return <p className={styles.symbols}>جواب: ..................</p>;
  }
}

function answer(q: ClockQuestion) {
  return (
    <>
      {answerFa(q)} · <span style={{ fontWeight: 400 }}>{clockHow(q)}</span>
    </>
  );
}

const CONFIG: WorksheetConfig<ClockQuestionType, ClockQuestion> = {
  title: "ساعت و تقویم",
  backHref: "/tools/clock",
  typeLabels: CLOCK_TYPE_LABEL,
  defaultTypes: ["angle", "mirror", "elapsed", "weekday"],
  make: makeClockQuestion,
  prompt: (q) => clockPrompt(q, true),
  figures,
  answer,
};

export function ClockWorksheet() {
  return <WorksheetShell config={CONFIG} />;
}

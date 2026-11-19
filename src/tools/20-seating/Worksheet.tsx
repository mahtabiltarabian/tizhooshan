"use client";

// Worksheet for tool 20: the empty places (queue, bars, building or table,
// with the fixed sitter of a round table) and the conditions; a family tree
// question lists its sentences and four options. The answer key gives the
// arrangement or the answer with its chain of relations.

import { makeSeatingQuestion, type SeatingQuestion, type SeatingType } from "@/generators/seating";
import { Choices, FigureRow, WorksheetShell, type WorksheetConfig } from "@/toolkit/WorksheetShell";
import styles from "@/toolkit/Worksheet.module.css";
import { Backdrop, geometryOf, PlaceFigure } from "./Pictures";
import { answerText, condText, factText, familyHow, seatingPrompt, SEATING_TYPE_LABEL } from "./text";

const listStyle = { listStyleType: "persian", margin: "4px 0", paddingInlineStart: "1.4em", fontSize: "0.85rem", lineHeight: 1.7 } as const;

function figures(q: SeatingQuestion) {
  if (q.type === "family")
    return (
      <>
        <ol style={listStyle}>
          {q.facts.map((f, i) => (
            <li key={i}>{factText(q, f)}</li>
          ))}
        </ol>
        <Choices>
          {q.options.map((o, i) => (
            <span key={i}>{o.text}</span>
          ))}
        </Choices>
      </>
    );
  const geo = geometryOf(q, false);
  const [x, y, w, h] = geo.view;
  return (
    <>
      <FigureRow>
        <svg viewBox={`${x} ${y} ${w} ${h}`} width={260} height={Math.round((260 * h) / w)} style={{ direction: "ltr" }} role="img" aria-label="جاهای خالی">
          <PlaceFigure geo={geo} names={q.names} seatOf={q.names.map((_, p) => (p === q.fixed ? 0 : -1))} asked={q.ask?.rel === "at" ? q.ask.p : null}>
            <Backdrop q={q} geo={geo} fixedSeat={q.fixed !== null ? 0 : null} />
          </PlaceFigure>
        </svg>
      </FigureRow>
      <p className={styles.symbols} style={{ fontSize: "0.85rem" }}>
        آدم‌ها: {q.names.join("، ")}
      </p>
      <ol style={listStyle}>
        {q.conds.map((c, i) => (
          <li key={i}>{condText(q, c)}</li>
        ))}
      </ol>
      {q.variant === "ask" && <p className={styles.symbols}>جواب: ..................</p>}
    </>
  );
}

function answer(q: SeatingQuestion) {
  if (q.type === "family")
    return (
      <>
        {answerText(q)} · <span style={{ fontWeight: 400 }}>{familyHow(q)}</span>
      </>
    );
  return <>{answerText(q)}</>;
}

const CONFIG: WorksheetConfig<SeatingType, SeatingQuestion> = {
  title: "میز چیدمان و شجره‌نامه",
  backHref: "/tools/seating",
  typeLabels: SEATING_TYPE_LABEL,
  defaultTypes: ["queue", "round", "floors", "family"],
  make: makeSeatingQuestion,
  prompt: (q) => seatingPrompt(q, true),
  figures,
  answer,
};

export function SeatingWorksheet() {
  return <WorksheetShell config={CONFIG} />;
}

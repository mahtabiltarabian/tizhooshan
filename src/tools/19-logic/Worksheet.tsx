"use client";

// Worksheet for tool 19: an empty grid with its clues listed, the liars'
// statements, the premises with numbered conclusions and blank circles to
// draw on, or a counting question with an empty Venn diagram to write
// numbers in. The answer key adds the solved grid (or the answer) and how.

import { makeLogicQuestion, type LogicQuestion, type LogicType } from "@/generators/logic";
import { FigureRow, WorksheetShell, type WorksheetConfig } from "@/toolkit/WorksheetShell";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/Worksheet.module.css";
import { clueText, itemsOf, LOGIC_TYPE_LABEL, logicAnswerFa, logicHow, logicPrompt, optionText, saysText, vennNames } from "./LogicTryPanel";
import { GridSvg, solvedMarks, VennSvg } from "./Pictures";
import { countNames, CountVennSvg } from "./VennCount";

const list = { margin: "4px 0", paddingInlineStart: 20, lineHeight: 1.8, fontSize: "0.9rem" } as const;

function figures(q: LogicQuestion) {
  switch (q.type) {
    case "vennNum":
      return (
        <FigureRow>
          <CountVennSvg names={countNames(q)} width={q.k === 2 ? 170 : 150} />
        </FigureRow>
      );
    case "grid":
      return (
        <>
          <ol style={list}>
            {q.clues.map((c, i) => (
              <li key={i}>{clueText(q, c)}.</li>
            ))}
          </ol>
          <FigureRow>
            <GridSvg n={q.size} people={q.people} items={itemsOf(q)} marks={Array(q.size * q.size).fill(0)} width={q.size === 3 ? 190 : 240} />
          </FigureRow>
        </>
      );
    case "liars":
      return (
        <>
          <ul style={{ ...list, listStyle: "none", paddingInlineStart: 0 }}>
            {q.people.map((name, p) => (
              <li key={p}>
                <b>{name}:</b> {q.says[p] ? `«${saysText(q.people, p, q.says[p]!)}»` : "(چیزی نمی‌گوید)"}
              </li>
            ))}
          </ul>
          <p className={styles.symbols}>{q.people.map((name) => `${name}: ............`).join("   ")}</p>
        </>
      );
    case "venn": {
      const names = vennNames(q);
      return (
        <>
          <ol style={list}>
            {q.options.map((_, i) => (
              <li key={i}>{optionText(q, i)}</li>
            ))}
          </ol>
          <FigureRow>
            {q.level === 3 ? (
              <>
                <VennSvg names={[names[0], names[1], names[2]]} width={120} />
                <VennSvg names={[names[0], names[2], names[3]]} width={120} />
              </>
            ) : (
              <VennSvg names={names} width={q.level === 1 ? 150 : 130} />
            )}
          </FigureRow>
        </>
      );
    }
  }
}

function answer(q: LogicQuestion) {
  return (
    <>
      {q.type === "grid" && <GridSvg n={q.size} people={q.people} items={itemsOf(q)} marks={solvedMarks(q.size, q.answer)} width={q.size === 3 ? 110 : 130} />} {logicAnswerFa(q)} ·{" "}
      <span style={{ fontWeight: 400 }}>{logicHow(q)}</span>
    </>
  );
}

const CONFIG: WorksheetConfig<LogicType, LogicQuestion> = {
  title: "تخته استدلال",
  backHref: "/tools/logic",
  typeLabels: LOGIC_TYPE_LABEL,
  defaultTypes: ["grid", "liars", "venn", "vennNum"],
  make: (type, level, seed) => makeLogicQuestion(type, level, seed),
  prompt: (q) => (q.type === "venn" ? logicPrompt(q, true) : `${logicPrompt(q, true)}${q.type === "grid" ? ` (${fa(q.clues.length)} سرنخ)` : ""}`),
  figures,
  answer,
};

export function LogicWorksheet() {
  return <WorksheetShell config={CONFIG} />;
}

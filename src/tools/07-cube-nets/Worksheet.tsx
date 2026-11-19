"use client";

// Worksheet for tool 7: what each question looks like on paper, and its answer.
// Settings, layout and printing come from the shared WorksheetShell.

import { makeQuestion, type Question, type QuestionType } from "@/generators/cube-questions";
import { Choices, FigureRow, WorksheetShell, type WorksheetConfig } from "@/toolkit/WorksheetShell";
import styles from "@/toolkit/Worksheet.module.css";
import { fa } from "@/tools/registry";
import { IsoCube } from "./IsoCube";
import { SymbolNet, TurnTile } from "./SymbolNet";
import { prompt, TYPE_LABEL } from "./TryPanel";

function figures(q: Question) {
  switch (q.type) {
    case "opposite":
    case "touch":
      return <SymbolNet net={q.net} size={170} marks={{ [q.target]: "target" }} />;
    case "hidden":
      return (
        <FigureRow>
          <IsoCube view={q.view} size={120} />
          <SymbolNet net={q.net} size={150} />
        </FigureRow>
      );
    case "missing": {
      const symbols = [...q.net.symbols];
      symbols[q.blank] = "";
      return (
        <>
          <FigureRow>
            <IsoCube view={q.view} size={120} />
            <SymbolNet net={{ ...q.net, symbols }} size={150} />
          </FigureRow>
          <Choices>
            {[0, 1, 2, 3].map((k) => (
              <TurnTile key={k} symbol={q.net.symbols[q.blank]} turns={k} size={46} />
            ))}
          </Choices>
        </>
      );
    }
    case "makes":
    case "cannot":
      return (
        <>
          <SymbolNet net={q.net} size={150} />
          <Choices>
            {q.options.map((o, i) => (
              <IsoCube key={i} view={o.view} size={78} />
            ))}
          </Choices>
        </>
      );
    case "netMakes":
    case "netCannot":
      return (
        <>
          <FigureRow>
            <IsoCube view={q.view} size={110} />
          </FigureRow>
          <Choices wide>
            {q.nets.map((o, i) => (
              <SymbolNet key={i} net={o.net} size={124} />
            ))}
          </Choices>
        </>
      );
    case "place":
      return (
        <>
          <FigureRow>
            <IsoCube view={q.views[0]} size={100} />
            <IsoCube view={q.views[1]} size={100} />
          </FigureRow>
          <SymbolNet net={{ ...q.net, symbols: q.net.symbols.map(() => "") }} size={150} />
          <p className={styles.symbols}>نمادها: {q.net.symbols.join("  ")}</p>
        </>
      );
  }
}

function answer(q: Question) {
  const s = q.net.symbols;
  switch (q.type) {
    case "opposite":
    case "hidden":
      return <>«{s[q.answer]}»</>;
    case "touch":
      return <>{q.answers.map((i) => `«${s[i]}»`).join("، ")}</>;
    case "missing":
    case "makes":
    case "cannot":
    case "netMakes":
    case "netCannot":
      return <>گزینه {fa(q.answer + 1)}</>;
    case "place":
      return <SymbolNet net={q.net} size={90} />;
  }
}

const CONFIG: WorksheetConfig<QuestionType, Question> = {
  title: "گسترده و تاس",
  backHref: "/tools/cube-nets",
  typeLabels: TYPE_LABEL,
  defaultTypes: ["opposite", "makes"],
  make: makeQuestion,
  prompt: (q) => prompt(q, true),
  figures,
  answer,
};

export function Worksheet() {
  return <WorksheetShell config={CONFIG} />;
}

"use client";

// Worksheet for tool 7: what each question looks like on paper, and its answer.
// Settings, layout and printing come from the shared WorksheetShell.

import { makeQuestion, type Question } from "@/generators/cube-questions";
import { makeDiceQuestion, type DiceQuestion } from "@/generators/dice";
import { Choices, FigureRow, WorksheetShell, type WorksheetConfig } from "@/toolkit/WorksheetShell";
import styles from "@/toolkit/Worksheet.module.css";
import { fa } from "@/tools/registry";
import { IsoCube } from "./IsoCube";
import { SymbolNet, TurnTile } from "./SymbolNet";
import { isDiceType, prompt, TYPE_LABEL, type NetsType } from "./TryPanel";
import { DieIso, dieCaption, DieNetSvg, RollBoardSvg } from "./DiceSvg";
import { dicePrompt } from "./diceText";

type AnyQuestion = Question | DiceQuestion;
const isDice = (q: AnyQuestion): q is DiceQuestion => q.type === "die" || q.type === "roll";

function diceFigures(q: DiceQuestion) {
  if (q.type === "roll")
    return (
      <FigureRow>
        <figure className={styles.caption}>
          <DieIso die={q.start} size={100} />
          <figcaption>{dieCaption(q.start)}</figcaption>
        </figure>
        <RollBoardSvg w={q.w} d={q.d} from={q.from} path={q.path} size={170} />
      </FigureRow>
    );
  switch (q.kind) {
    case "opposite":
      return (
        <FigureRow>
          <figure className={styles.caption}>
            <DieIso die={q.die} size={110} />
            <figcaption>{dieCaption(q.die)}</figcaption>
          </figure>
        </FigureRow>
      );
    case "missing":
      return (
        <FigureRow>
          <DieNetSvg net={q.net} size={150} ask={q.ask} />
        </FigureRow>
      );
    case "validNet":
      return (
        <Choices wide>
          {q.nets.map((n, i) => (
            <DieNetSvg key={i} net={n} size={118} />
          ))}
        </Choices>
      );
  }
}

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

const CONFIG: WorksheetConfig<NetsType, AnyQuestion> = {
  title: "گسترده و تاس",
  backHref: "/tools/cube-nets",
  typeLabels: TYPE_LABEL,
  defaultTypes: ["opposite", "makes"],
  make: (type, level, seed) => (isDiceType(type) ? makeDiceQuestion(type, level, seed) : makeQuestion(type, level, seed)),
  prompt: (q) => (isDice(q) ? dicePrompt(q, true) : prompt(q, true)),
  figures: (q) => (isDice(q) ? diceFigures(q) : figures(q)),
  answer: (q) => (isDice(q) ? q.type === "die" && q.kind === "validNet" ? <>گزینه {fa(q.answer + 1)}</> : <>{fa(q.answer)} خال</> : answer(q)),
};

export function Worksheet() {
  return <WorksheetShell config={CONFIG} />;
}

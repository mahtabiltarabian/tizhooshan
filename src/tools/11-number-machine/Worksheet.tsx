"use client";

// Worksheet for tool 11: the machine (steps shown, or empty boxes to fill),
// the table of examples, and a line for the answer. Operator questions are
// text only; «مرتب‌سازی و الگوریتم» shows the row of boxes, or its choices.
// The answer key adds the working.

import { makeMachineQuestion, type Example, type MachineQuestion } from "@/generators/number-machine";
import { makeSortQuestion, type SortQuestion } from "@/generators/sorting";
import { Choices, FigureRow, WorksheetShell, type WorksheetConfig } from "@/toolkit/WorksheetShell";
import { fa } from "@/tools/registry";
import { numFa } from "./format";
import { answerFa, machineHow, machinePrompt, TRY_TYPE_LABEL, type TryType } from "./MachineTryPanel";
import { MachineSvg } from "./Pictures";
import { MiniRow, programFa, sortAnswerFa, sortHow, sortPrompt } from "./Sorting";
import styles from "@/toolkit/Worksheet.module.css";

const cell: React.CSSProperties = { border: "1px solid #222", padding: "1px 10px", textAlign: "center", minWidth: "2.6em" };

/** The examples, input on the left like the machine. */
function Table({ examples, query }: { examples: Example[]; query?: number[] }) {
  const two = examples[0].input.length === 2;
  return (
    <table dir="ltr" style={{ borderCollapse: "collapse", margin: "6px auto 0", fontWeight: 700 }}>
      <thead>
        <tr>
          {(two ? ["a", "b", "a ★ b"] : ["ورودی", "خروجی"]).map((h) => (
            <th key={h} style={{ ...cell, fontSize: "0.8rem" }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {examples.map((e, i) => (
          <tr key={i}>
            {[...e.input, e.output].map((v, k) => (
              <td key={k} style={cell}>
                {numFa(v)}
              </td>
            ))}
          </tr>
        ))}
        {query && (
          <tr>
            {query.map((v, k) => (
              <td key={k} style={{ ...cell, borderTop: "2px dashed #222" }}>
                {fa(v)}
              </td>
            ))}
            <td style={{ ...cell, borderTop: "2px dashed #222" }}>؟</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

type SheetQuestion = MachineQuestion | SortQuestion;

function sortFigures(q: SortQuestion) {
  if (q.variant === "pass")
    return (
      <Choices wide>
        {q.options.map((o, i) => (
          <MiniRow key={i} row={o} />
        ))}
      </Choices>
    );
  if (q.variant === "program")
    return (
      <Choices wide>
        {q.options.map((o, i) => (
          <span key={i}>{programFa(o)}</span>
        ))}
      </Choices>
    );
  return (
    <>
      {"row" in q && (
        <FigureRow>
          <MiniRow row={q.row} />
        </FigureRow>
      )}
      <p className={styles.symbols}>جواب: ............</p>
    </>
  );
}

function figures(q: SheetQuestion) {
  switch (q.type) {
    case "sort":
      return sortFigures(q);
    case "run":
      return (
        <FigureRow>
          <MachineSvg steps={q.rule} values={[q.input, ...q.rule.slice(1).map(() => undefined), null]} />
        </FigureRow>
      );
    case "reverse":
      return (
        <FigureRow>
          <MachineSvg steps={q.rule} values={[null, ...q.rule.slice(1).map(() => undefined), q.output]} />
        </FigureRow>
      );
    case "guess":
      return (
        <>
          <Table examples={q.examples} query={q.query} />
          <p className={styles.symbols}>جواب: ............</p>
        </>
      );
    case "build":
      return (
        <>
          <Table examples={q.examples} />
          {q.machine.kind === "machine" ? (
            <FigureRow>
              <MachineSvg steps={q.machine.rule.map(() => null)} values={q.machine.rule.map(() => undefined).concat([undefined])} width={240} />
            </FigureRow>
          ) : (
            <p className={styles.symbols} dir="ltr">
              a ★ b = ....a .... ....b
            </p>
          )}
        </>
      );
    case "operator":
      return <p className={styles.symbols}>جواب: ............</p>;
  }
}

function answer(q: SheetQuestion) {
  if (q.type === "sort")
    return (
      <>
        {sortAnswerFa(q)} · <span style={{ fontWeight: 400 }}>{sortHow(q)}</span>
      </>
    );
  return (
    <>
      {answerFa(q)} · <span style={{ fontWeight: 400 }}>{machineHow(q)}</span>
    </>
  );
}

const CONFIG: WorksheetConfig<TryType, SheetQuestion> = {
  title: "ماشین اعداد",
  backHref: "/tools/number-machine",
  typeLabels: TRY_TYPE_LABEL,
  defaultTypes: ["run", "reverse", "guess", "operator"],
  make: (type, level, seed) => (type === "sort" ? makeSortQuestion(level, seed) : makeMachineQuestion(type, level, seed)),
  prompt: (q) => (q.type === "sort" ? sortPrompt(q) : machinePrompt(q, true)),
  figures,
  answer,
};

export function MachineWorksheet() {
  return <WorksheetShell config={CONFIG} />;
}

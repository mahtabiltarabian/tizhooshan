"use client";

// Worksheet for tool 11: the machine (steps shown, or empty boxes to fill),
// the table of examples, and a line for the answer. Operator questions are
// text only. The answer key adds the working.

import { makeMachineQuestion, type Example, type MachineQuestion, type MachineQuestionType } from "@/generators/number-machine";
import { FigureRow, WorksheetShell, type WorksheetConfig } from "@/toolkit/WorksheetShell";
import { fa } from "@/tools/registry";
import { numFa } from "./format";
import { answerFa, MACHINE_TYPE_LABEL, machineHow, machinePrompt } from "./MachineTryPanel";
import { MachineSvg } from "./Pictures";
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

function figures(q: MachineQuestion) {
  switch (q.type) {
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

function answer(q: MachineQuestion) {
  return (
    <>
      {answerFa(q)} · <span style={{ fontWeight: 400 }}>{machineHow(q)}</span>
    </>
  );
}

const CONFIG: WorksheetConfig<MachineQuestionType, MachineQuestion> = {
  title: "ماشین اعداد",
  backHref: "/tools/number-machine",
  typeLabels: MACHINE_TYPE_LABEL,
  defaultTypes: ["run", "reverse", "guess", "operator"],
  make: (type, level, seed) => makeMachineQuestion(type, level, seed),
  prompt: (q) => machinePrompt(q, true),
  figures,
  answer,
};

export function MachineWorksheet() {
  return <WorksheetShell config={CONFIG} />;
}

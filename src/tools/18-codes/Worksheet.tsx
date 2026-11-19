"use client";

// Worksheet for tool 18: the key table (level 1), the rule in words (level 2)
// or the examples (level 3), then the given text in boxes and empty boxes for
// the answer, one per letter. The answer key adds the working.
// «کد دودویی» questions draw their cards (or lamp rows) instead.

import { answerKindOf, makeBinaryQuestion, type BinaryQuestion } from "@/generators/binary-code";
import { ALPHABET, encodeLetter, makeCodeQuestion, outKind, type CodeQuestion } from "@/generators/codes";
import { WorksheetShell, type WorksheetConfig } from "@/toolkit/WorksheetShell";
import { binaryAnswerFa, binaryHow, binaryPrompt, CardRowSvg, WordLampsSvg } from "./Binary";
import { answerFa, codeHow, codePrompt, givenKind, TRY_TYPE_LABEL, type TryType } from "./CodesTryPanel";
import { Boxes, TokenHtml } from "./Inputs";
import css from "./Codes.module.css";

/** Key table in rows of up to 16 letters, right to left. */
function KeyTable({ q }: { q: CodeQuestion }) {
  const kind = outKind(q.rule);
  const rows: number[][] = [];
  for (let i = 0; i < q.key.length; i += 16) rows.push(q.key.slice(i, i + 16));
  return (
    <table className={css.keyTable}>
      <tbody>
        {rows.flatMap((row, r) => [
          <tr key={`l${r}`}>
            {row.map((l) => (
              <td key={l}>{ALPHABET[l]}</td>
            ))}
          </tr>,
          <tr key={`c${r}`} className={css.codes}>
            {row.map((l) => (
              <td key={l}>
                <TokenHtml kind={kind} t={encodeLetter(q.rule, l)} />
              </td>
            ))}
          </tr>,
        ])}
      </tbody>
    </table>
  );
}

function binaryFigures(q: BinaryQuestion) {
  switch (q.kind) {
    case "read":
      return <CardRowSvg mask={q.n} />;
    case "show":
      return <CardRowSvg mask={0} blank />;
    case "next":
      return (
        <>
          <CardRowSvg mask={q.n} width={180} />
          <div className={css.boxes}>
            <span className={css.arrow}>عدد بعدی:</span>
          </div>
          <CardRowSvg mask={0} blank width={180} />
        </>
      );
    case "word":
      return <WordLampsSvg q={q} />;
    default:
      return <p className={css.rule}>جواب: ............</p>;
  }
}

function figures(q: SheetQuestion) {
  if (q.type === "binary") return binaryFigures(q);
  const kind = outKind(q.rule);
  return (
    <>
      {q.show === "key" && <KeyTable q={q} />}
      {q.show === "examples" &&
        q.examples.map((e, k) => (
          <div key={k} className={css.boxes}>
            <Boxes tokens={e.plain} kind="letter" />
            <span className={css.arrow}>←</span>
            <Boxes tokens={e.coded} kind={kind} />
          </div>
        ))}
      <div className={css.boxes}>
        <Boxes tokens={q.given} kind={givenKind(q)} />
      </div>
      <div className={css.boxes}>
        <span className={css.arrow}>جواب:</span>
        <Boxes tokens={q.answer} kind={kind} blank />
      </div>
      {kind === "shape" && q.dir === "encode" && <p className={css.rule}>شکل‌ها را در خانه‌ها بکش.</p>}
    </>
  );
}

function answer(q: SheetQuestion) {
  if (q.type === "binary")
    return (
      <>
        {answerKindOf(q.kind) === "lamps" ? <CardRowSvg mask={q.answer} width={150} /> : binaryAnswerFa(q)} · <span style={{ fontWeight: 400 }}>{binaryHow(q)}</span>
      </>
    );
  const kind = q.dir === "encode" ? outKind(q.rule) : "letter";
  return (
    <>
      {kind === "shape" ? <Boxes tokens={q.answer} kind="shape" /> : answerFa(q)} · <span style={{ fontWeight: 400 }}>{codeHow(q)}</span>
    </>
  );
}

type SheetQuestion = CodeQuestion | BinaryQuestion;

const CONFIG: WorksheetConfig<TryType, SheetQuestion> = {
  title: "کدگذاری",
  backHref: "/tools/codes",
  typeLabels: TRY_TYPE_LABEL,
  defaultTypes: ["shift", "number", "shape", "sentence"],
  make: (type, level, seed) => (type === "binary" ? makeBinaryQuestion(level, seed) : makeCodeQuestion(type, level, seed)),
  prompt: (q) => (q.type === "binary" ? binaryPrompt(q, true) : codePrompt(q, true)),
  figures,
  answer,
};

export function CodesWorksheet() {
  return <WorksheetShell config={CONFIG} />;
}


"use client";

// Worksheet for tool 18: the key table (level 1), the rule in words (level 2)
// or the examples (level 3), then the given text in boxes and empty boxes for
// the answer, one per letter. The answer key adds the working.

import { ALPHABET, encodeLetter, makeCodeQuestion, outKind, type CodeQuestion, type CodeQuestionType } from "@/generators/codes";
import { WorksheetShell, type WorksheetConfig } from "@/toolkit/WorksheetShell";
import { answerFa, CODE_TYPE_LABEL, codeHow, codePrompt, givenKind } from "./CodesTryPanel";
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

function figures(q: CodeQuestion) {
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

function answer(q: CodeQuestion) {
  const kind = q.dir === "encode" ? outKind(q.rule) : "letter";
  return (
    <>
      {kind === "shape" ? <Boxes tokens={q.answer} kind="shape" /> : answerFa(q)} · <span style={{ fontWeight: 400 }}>{codeHow(q)}</span>
    </>
  );
}

const CONFIG: WorksheetConfig<CodeQuestionType, CodeQuestion> = {
  title: "کدگذاری",
  backHref: "/tools/codes",
  typeLabels: CODE_TYPE_LABEL,
  defaultTypes: ["shift", "number", "shape", "sentence"],
  make: (type, level, seed) => makeCodeQuestion(type, level, seed),
  prompt: (q) => codePrompt(q, true),
  figures,
  answer,
};

export function CodesWorksheet() {
  return <WorksheetShell config={CONFIG} />;
}


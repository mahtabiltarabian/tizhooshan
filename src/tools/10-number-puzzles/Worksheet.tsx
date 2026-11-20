"use client";

// Worksheet for tool 10: each puzzle drawn with its blanks empty. The answer
// key draws it solved (the blanks' numbers in blue) and, for "number in
// shape", names the rule; when the line total was hidden, it gives the total.

import { givenValues, makeNumberPuzzle, MATRIX_RULES, SHAPE_RULES, type NumberPuzzle, type PuzzleType } from "@/generators/number-puzzles";
import { FigureRow, WorksheetShell, type WorksheetConfig } from "@/toolkit/WorksheetShell";
import { fa } from "@/tools/registry";
import { PuzzleSvg } from "./Pictures";
import { PUZZLE_TYPE_LABEL, puzzlePrompt } from "./PuzzleTryPanel";

const WIDTH: Record<PuzzleType, number> = { magic: 200, pyramid: 210, grid: 210, star: 180, ring: 200, shape: 320, matrix: 190 };

function figures(q: NumberPuzzle) {
  return (
    <FigureRow>
      <PuzzleSvg q={q} vals={givenValues(q)} width={WIDTH[q.type]} />
    </FigureRow>
  );
}

function answer(q: NumberPuzzle) {
  return (
    <>
      <PuzzleSvg q={q} vals={q.cells.map((c) => c.value)} width={Math.round(WIDTH[q.type] * 0.7)} />
      {q.type === "shape" && <span style={{ fontWeight: 400 }}> · قانون: {SHAPE_RULES[q.rule!].words}</span>}
      {q.type === "matrix" && <span style={{ fontWeight: 400 }}> · قانون: {MATRIX_RULES[q.rule!].words}</span>}
      {q.targetHidden && <span style={{ fontWeight: 400 }}> · جمع هر خط: {fa(q.target!)}</span>}
      {q.anyFill && <span style={{ fontWeight: 400 }}> · یک جواب از چند جواب؛ هر چینش درست قبول است.</span>}
    </>
  );
}

const CONFIG: WorksheetConfig<PuzzleType, NumberPuzzle> = {
  title: "معماهای عدد",
  backHref: "/tools/number-puzzles",
  typeLabels: PUZZLE_TYPE_LABEL,
  defaultTypes: ["magic", "pyramid", "grid", "shape"],
  make: (type, level, seed) => makeNumberPuzzle(type, level, seed),
  prompt: (q) => puzzlePrompt(q, true),
  figures,
  answer,
};

export function NumberPuzzlesWorksheet() {
  return <WorksheetShell config={CONFIG} />;
}

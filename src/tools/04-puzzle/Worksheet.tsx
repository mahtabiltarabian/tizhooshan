"use client";

// Worksheet for tool 4: the shadow, sheets or pieces, and numbered options.
// Build questions print the shadow and the pieces; the answer key draws one
// way to build it.

import { boxOf, makePuzzleQuestion, type Pt, type PuzzleQuestion, type PuzzleQuestionType } from "@/generators/puzzle";
import { Choices, FigureRow, WorksheetShell, type WorksheetConfig } from "@/toolkit/WorksheetShell";
import { fa } from "@/tools/registry";
import { guidesOf } from "./layout";
import { PieceRowSvg, PieceSvg, pieceColor, ShapeG, ShapeSvg, SheetSvg } from "./Pictures";
import { PUZZLE_TYPE_LABEL, puzzlePrompt } from "./PuzzleTryPanel";

/** A shadow, optionally with a gap or with every piece's outline. */
function Shadow({ ids, size, hole, lines }: { ids: number[]; size: number; hole?: number[]; lines?: Pt[][] }) {
  const [x0, y0, x1, y1] = boxOf(ids);
  const s = Math.max(x1 - x0, y1 - y0) + 0.6;
  return (
    <svg width={size} height={size} viewBox={`${(x0 + x1 - s) / 2} ${(y0 + y1 - s) / 2} ${s} ${s}`} style={{ direction: "ltr" }}>
      <ShapeG ids={ids.filter((id) => !hole?.includes(id))} fill="#9a9fab" guides={lines} />
      {hole && <ShapeG ids={hole} fill="#ffffff" stroke="#1f2430" dashed />}
    </svg>
  );
}

function figures(q: PuzzleQuestion) {
  switch (q.type) {
    case "build":
      return (
        <>
          <FigureRow>
            <Shadow ids={q.target} size={140} lines={q.guides ? guidesOf(q.solution) : undefined} />
          </FigureRow>
          <FigureRow>
            <PieceRowSvg kinds={q.kinds} height={q.kinds.length > 5 ? 34 : 42} />
          </FigureRow>
        </>
      );
    case "overlay":
      return (
        <>
          <FigureRow>
            <figure>
              <SheetSvg n={q.n} cells={q.a} size={70} tint="#d9e6ff" />
              <figcaption>کاغذ ۱</figcaption>
            </figure>
            <figure>
              <SheetSvg n={q.n} cells={q.b} size={70} tint="#fff1c2" />
              <figcaption>کاغذ ۲</figcaption>
            </figure>
          </FigureRow>
          <Choices>{q.options.map((o, i) => <SheetSvg key={i} n={q.n} cells={o} size={54} />)}</Choices>
        </>
      );
    case "combine":
      return (
        <>
          <FigureRow>
            {q.pieces.map((k, i) => (
              <PieceSvg key={i} kind={k} size={56} color={pieceColor(i)} unit={4} />
            ))}
          </FigureRow>
          <Choices>{q.options.map((o, i) => <ShapeSvg key={i} ids={o} size={58} unit={4} />)}</Choices>
        </>
      );
    case "split":
      return (
        <>
          <FigureRow>
            <Shadow ids={q.target} size={110} />
          </FigureRow>
          <Choices wide>{q.options.map((ks, i) => <PieceRowSvg key={i} kinds={ks} height={28} />)}</Choices>
        </>
      );
    case "extra":
      return (
        <>
          <FigureRow>
            <Shadow ids={q.target} size={110} />
          </FigureRow>
          <Choices>{q.pieces.map((k, i) => <PieceSvg key={i} kind={k} size={44} color={pieceColor(i)} unit={4} />)}</Choices>
        </>
      );
    case "complete":
      return (
        <>
          <FigureRow>
            <Shadow ids={q.target} hole={q.hole} size={110} />
          </FigureRow>
          <Choices>{q.options.map((o, i) => <PieceSvg key={i} kind={o.kind} k={o.k} flip={o.flip} size={52} color="#ffc93d" unit={4} />)}</Choices>
        </>
      );
  }
}

function answer(q: PuzzleQuestion) {
  if (q.type === "build") return <Shadow ids={q.target} size={70} lines={guidesOf(q.solution)} />;
  return (
    <>
      {q.type === "extra" ? "قطعه" : "گزینه"} {fa(q.answer + 1)}
    </>
  );
}

const CONFIG: WorksheetConfig<PuzzleQuestionType, PuzzleQuestion> = {
  title: "هم‌پوشانی و پازل",
  backHref: "/tools/puzzle",
  typeLabels: PUZZLE_TYPE_LABEL,
  defaultTypes: ["overlay", "combine", "extra", "complete"],
  make: makePuzzleQuestion,
  prompt: (q) => puzzlePrompt(q, true),
  figures,
  answer,
};

export function PuzzleWorksheet() {
  return <WorksheetShell config={CONFIG} />;
}

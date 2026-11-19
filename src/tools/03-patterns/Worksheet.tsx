"use client";

// Worksheet for tool 3: the matrix, sequence or picture with its blank, and
// numbered options. The answer key adds the rules in words.

import { useId } from "react";
import { makePatternQuestion, type PatternQuestion, type PatternQuestionType, type Tile } from "@/generators/patterns";
import { Choices, WorksheetShell, type WorksheetConfig } from "@/toolkit/WorksheetShell";
import { fa } from "@/tools/registry";
import { INK, PatchSvg, TileCard, TileDefs, TileSvg } from "./Pictures";
import { PATTERN_TYPE_LABEL, patternPrompt } from "./PatternTryPanel";
import styles from "@/toolkit/Worksheet.module.css";

/** A still grid of tiles (right to left), blanks as "؟", optional signs between cells. */
function MiniGrid({ rows, cols, cells, signs, width }: { rows: number; cols: number; cells: (Tile | null)[]; signs?: string[]; width: number }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const gap = signs ? 0.5 : 0.1;
  const step = 1 + gap;
  const W = cols * step - gap;
  const H = rows * step - gap;
  return (
    <svg width={width} height={(width * H) / W} viewBox={`-0.04 -0.04 ${W + 0.08} ${H + 0.08}`} style={{ direction: "ltr" }}>
      <TileDefs id={id} />
      {cells.map((t, i) => {
        const [r, c] = [Math.floor(i / cols), i % cols];
        const [x, y] = [(cols - 1 - c) * step, r * step];
        return t ? (
          <TileCard key={i} tile={t} x={x} y={y} size={1} defs={id} />
        ) : (
          <g key={i}>
            <rect x={x} y={y} width={1} height={1} rx={0.08} fill="#fff" stroke={INK} strokeWidth={1.5} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
            <text x={x + 0.5} y={y + 0.5} fontSize={0.5} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
              ؟
            </text>
          </g>
        );
      })}
      {signs?.map((s, c) => (
        <text key={c} x={(cols - 1 - c) * step - gap / 2} y={0.5} fontSize={0.45} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
          {s}
        </text>
      ))}
    </svg>
  );
}

function figures(q: PatternQuestion) {
  if (q.type === "odd")
    return (
      <Choices>
        {q.tiles.map((t, i) => (
          <TileSvg key={i} tile={t} size={56} />
        ))}
      </Choices>
    );
  if (q.type === "missing") {
    const [r, c] = q.hole;
    const inHole = (i: number) => {
      const [ri, ci] = [Math.floor(i / q.cols), i % q.cols];
      return ri >= r && ri <= r + 1 && ci >= c && ci <= c + 1;
    };
    return (
      <>
        <div className={styles.row}>
          <MiniGrid rows={q.rows} cols={q.cols} cells={q.cells.map((t, i) => (inHole(i) ? null : t))} width={q.cols * 34} />
        </div>
        <Choices>
          {q.options.map((o, i) => (
            <PatchSvg key={i} tiles={o} size={70} />
          ))}
        </Choices>
      </>
    );
  }
  const width = q.cols === 5 ? 280 : q.signs ? 200 : q.cols * 52;
  return (
    <>
      <div className={styles.row}>
        <MiniGrid rows={q.rows} cols={q.cols} cells={q.cells.map((t, i) => (i === q.blank ? null : t))} signs={q.signs} width={width} />
      </div>
      <Choices>
        {q.options.map((t, i) => (
          <TileSvg key={i} tile={t} size={q.options.length === 6 ? 46 : 58} />
        ))}
      </Choices>
    </>
  );
}

function answer(q: PatternQuestion) {
  if (q.type === "odd") return <>شکل {fa(q.answer + 1)}</>;
  return <>گزینه {fa(q.answer + 1)}</>;
}

const CONFIG: WorksheetConfig<PatternQuestionType, PatternQuestion> = {
  title: "موتور الگو و ماتریس",
  backHref: "/tools/patterns",
  typeLabels: PATTERN_TYPE_LABEL,
  defaultTypes: ["matrix3", "sequence", "odd", "rotation"],
  make: makePatternQuestion,
  prompt: (q) => patternPrompt(q, true),
  figures,
  answer,
};

export function PatternsWorksheet() {
  return <WorksheetShell config={CONFIG} />;
}

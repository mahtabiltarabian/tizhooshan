"use client";

// The big board: tiles in rows and columns, read right to left like Persian
// text. A blank shows "؟"; highlighted cells get a thick frame, so a row or
// a column can be pointed at while its rule is read out.

import { useId } from "react";
import type { Tile } from "@/generators/patterns";
import { Board } from "@/engine-2d/Board";
import { INK, TileCard, TileDefs } from "./Pictures";

interface Props {
  rows: number;
  cols: number;
  /** null: a blank to fill. */
  cells: (Tile | null)[];
  highlight?: number[];
  /** Signs between a row's cells (adding strokes: "+", "="). */
  signs?: string[];
  /** Text under each cell (e.g. numbers to tap, ✓). */
  labels?: string[];
  onCell?: (i: number) => void;
  label?: string;
}

const ACCENT = "#3d7be0";

export function PatternScene({ rows, cols, cells, highlight = [], signs, labels, onCell, label }: Props) {
  const defs = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const gap = signs ? 0.6 : 0.16;
  const step = 1 + gap;
  const X = (c: number) => (cols - 1 - c) * step;
  const Y = (r: number) => r * (step + (labels ? 0.35 : 0));
  const W = cols * step - gap;
  const H = Y(rows - 1) + 1 + (labels ? 0.5 : 0);

  const hl = highlight.map((i) => [Math.floor(i / cols), i % cols]);
  const box = hl.length
    ? {
        x0: Math.min(...hl.map(([, c]) => X(c))) - 0.08,
        x1: Math.max(...hl.map(([, c]) => X(c))) + 1.08,
        y0: Math.min(...hl.map(([r]) => Y(r))) - 0.08,
        y1: Math.max(...hl.map(([r]) => Y(r))) + 1.08,
      }
    : null;

  return (
    <Board view={[-0.5, -0.5, W + 1, H + 1]} imageName="patterns" label={label}>
      <TileDefs id={defs} />
      {cells.map((t, i) => {
        const [r, c] = [Math.floor(i / cols), i % cols];
        const [x, y] = [X(c), Y(r)];
        return (
          <g key={i} onClick={onCell ? () => onCell(i) : undefined} style={onCell ? { cursor: "pointer" } : undefined}>
            {t ? (
              <TileCard tile={t} x={x} y={y} size={1} defs={defs} />
            ) : (
              <g>
                <rect x={x} y={y} width={1} height={1} rx={0.08} fill="#fffaf0" stroke={INK} strokeWidth={2} strokeDasharray="7 5" vectorEffect="non-scaling-stroke" />
                <text x={x + 0.5} y={y + 0.5} fontSize={0.55} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} style={{ fontFamily: "Vazirmatn, sans-serif" }}>
                  ؟
                </text>
              </g>
            )}
            {labels?.[i] && (
              <text x={x + 0.5} y={y + 1.3} fontSize={0.28} fontWeight={700} textAnchor="middle" fill={INK} style={{ fontFamily: "Vazirmatn, sans-serif" }}>
                {labels[i]}
              </text>
            )}
          </g>
        );
      })}
      {signs &&
        Array.from({ length: rows }, (_, r) =>
          signs.map((s, c) => (
            <text key={`${r}-${c}`} x={X(c) - gap / 2} y={Y(r) + 0.5} fontSize={0.5} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
              {s}
            </text>
          )),
        )}
      {box && (
        <rect x={box.x0} y={box.y0} width={box.x1 - box.x0} height={box.y1 - box.y0} rx={0.14} fill="none" stroke={ACCENT} strokeWidth={5} vectorEffect="non-scaling-stroke" />
      )}
    </Board>
  );
}

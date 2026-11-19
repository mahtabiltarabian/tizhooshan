"use client";

import type { Cell } from "@/generators/cube-nets";
import { FACE_COLORS } from "./FoldingNet";
import styles from "./NetEditor.module.css";

export const GRID = 6;

interface NetEditorProps {
  cells: readonly Cell[];
  labels: string[];
  /** Indices into `cells` drawn hatched. */
  marked: readonly number[];
  onToggle: (cell: Cell) => void;
}

/** 6×6 grid; tap a square to add or remove it. Grid y points up, SVG y points down. */
export function NetEditor({ cells, labels, marked, onToggle }: NetEditorProps) {
  const u = 40;
  const size = GRID * u;
  const indexOf = (x: number, y: number) => cells.findIndex((c) => c[0] === x && c[1] === y);

  return (
    <svg className={styles.grid} viewBox={`0 0 ${size} ${size}`} role="grid" aria-label="صفحه شطرنجی برای کشیدن گسترده">
      <defs>
        <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="3" height="8" fill="rgba(31,36,48,0.5)" />
        </pattern>
      </defs>
      {Array.from({ length: GRID * GRID }, (_, k) => {
        const x = k % GRID;
        const y = Math.floor(k / GRID);
        const i = indexOf(x, y);
        const px = x * u;
        const py = (GRID - 1 - y) * u;
        const filled = i >= 0;
        return (
          <g
            key={k}
            role="gridcell"
            aria-selected={filled}
            aria-label={filled ? `مربع ${labels[i]}` : "خانه خالی"}
            tabIndex={0}
            className={styles.cell}
            onClick={() => onToggle([x, y])}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggle([x, y]);
              }
            }}
          >
            <rect x={px + 2} y={py + 2} width={u - 4} height={u - 4} rx={8} className={filled ? styles.filled : styles.empty} fill={filled ? FACE_COLORS[i % FACE_COLORS.length] : undefined} />
            {filled && marked.includes(i) && <rect x={px + 2} y={py + 2} width={u - 4} height={u - 4} rx={8} fill="url(#hatch)" pointerEvents="none" />}
            {filled && (
              <text x={px + u / 2} y={py + u / 2 + 7} textAnchor="middle" className={styles.label}>
                {labels[i]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

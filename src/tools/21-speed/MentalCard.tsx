"use client";

// The card of six sums for tool 21's mental arithmetic, in board units.
// Cards run right to left, top to bottom, like the shape grid. Each sum is
// written left to right, as in the textbook, with an answer box after "=".
// After a check, a right answer gets ✓ and a wrong one ✗ plus the right
// answer, so nothing depends on colour alone.

import type { MentalQuestion } from "@/generators/mental";
import { fa } from "@/tools/registry";
import { itemText, ltr } from "./mentalText";

const INK = "#0f172a";
const PEN = "#2f6fdb";
const ACCENT = "#d9480f";
const GOOD = "#1f9d55";
const BAD = "#d64545";

const W = 4.2;
const H = 1.15;
const GAP = 0.25;

export const mentalView = (n: number): [number, number, number, number] => [-0.1, -0.1, 2 * W + GAP + 0.2, Math.ceil(n / 2) * (H + GAP) + 0.05];

const cardXY = (i: number) => ({ x: i % 2 === 0 ? W + GAP : 0, y: Math.floor(i / 2) * (H + GAP) });

export function MentalCard({
  q,
  vals,
  selected,
  onSelect,
  marks,
  reveal,
}: {
  q: MentalQuestion;
  vals: readonly (number | null)[];
  selected?: number | null;
  onSelect?: (i: number) => void;
  /** After a check: true for a right answer, false for a wrong one. */
  marks?: readonly boolean[] | null;
  /** Show me: how many answers are shown. */
  reveal?: number;
}) {
  return (
    <g aria-label="حساب‌ها">
      {q.items.map((it, i) => {
        const { x, y } = cardXY(i);
        const mark = marks ? marks[i] : null;
        const shown = reveal !== undefined ? (i < reveal ? it.answer : null) : vals[i];
        const sel = selected === i;
        const boxX = x + W - 1.25;
        return (
          <g key={i} onClick={onSelect ? () => onSelect(i) : undefined} style={onSelect ? { cursor: "pointer" } : undefined}>
            <rect x={x} y={y} width={W} height={H} rx={0.14} fill="#fff" stroke={mark === null ? "#e5e7eb" : mark ? GOOD : BAD} strokeWidth={mark === null ? 0.03 : 0.07} />
            <text x={boxX - 0.15} y={y + 0.5} dy="0.35em" fontSize={it.nums.length > 3 ? 0.32 : it.nums.length > 2 ? 0.37 : 0.42} fontWeight={700} textAnchor="end" direction="ltr" fill={INK}>
              {ltr(`${itemText(it)} =`)}
            </text>
            <rect
              x={boxX}
              y={y + 0.16}
              width={1.05}
              height={0.68}
              rx={0.1}
              fill="#fff"
              stroke={sel ? ACCENT : shown === null ? "#9aa0ad" : INK}
              strokeWidth={sel ? 0.08 : 0.03}
              strokeDasharray={shown === null && !sel ? "0.1 0.07" : undefined}
            />
            <text x={boxX + 0.525} y={y + 0.5} dy="0.35em" fontSize={0.4} fontWeight={800} textAnchor="middle" fill={reveal !== undefined ? ACCENT : PEN}>
              {shown === null ? "" : fa(shown)}
            </text>
            {mark !== null && (
              <text x={x + 0.22} y={y + 0.32} fontSize={0.32} fontWeight={800} textAnchor="middle" fill={mark ? GOOD : BAD}>
                {mark ? "✓" : "✗"}
              </text>
            )}
            {mark === false && (
              <text x={boxX + 0.525} y={y + 1.04} fontSize={0.22} fontWeight={700} textAnchor="middle" fill={BAD}>
                {`درست: ${fa(it.answer)}`}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

"use client";

// Columns of blocks for «میانگین»: each person is a column; the average is
// the height every column reaches when blocks are moved from tall columns to
// short ones. Blocks keep their id from frame to frame and slide with a CSS
// transition, so stepping through "show me" animates the levelling. Moved
// blocks carry a dot (not only a colour); groups have a bracket and a name.

import { useRef } from "react";
import { fa } from "@/tools/registry";
import css from "./Columns.module.css";
import { INK } from "./Pictures";

export interface ColView {
  /** Name under the column. */
  label: string;
  /** Block ids, bottom to top. */
  blocks: number[];
  /** Unknown: a dashed empty column with "؟". */
  ask?: boolean;
  /** Dashed outline up to this height (where levelling will bring it). */
  ghost?: number;
  /** Leaving: faded and crossed out. */
  gone?: boolean;
  /** Group 0 or 1 (different block fill; the bracket names it). */
  group?: number;
  /** Explore: the column a block is taken from. */
  selected?: boolean;
}

export interface ColumnsFrame {
  kind: "columns";
  cols: ColView[];
  /** Blocks that just moved or were added (drawn with a dot). */
  marked?: number[];
  /** A dashed level line across the columns. */
  line?: { at: number; label: string };
  /** Group brackets under the columns: [first, last] column and a name. */
  groups?: { from: number; to: number; label: string }[];
  /** Tallest column over the whole demonstration (keeps the scale still). */
  max: number;
  caption?: string;
  note: string;
}

const BLOCK_FILL = ["#7aa6e8", "#f2b766"];
const MOVED_FILL = "#9ad18b";
const TOP = 1.0;

/** Column geometry on a 16-wide board. */
export function columnsGeometry(count: number, max: number, groups = false) {
  const colW = Math.min(1.9, 14.6 / count);
  const x0 = (16 - colW * count) / 2;
  const unit = Math.min(0.62, 6.6 / Math.max(1, max));
  const ground = TOP + max * unit;
  const height = ground + (groups ? 1.55 : 0.95);
  // Columns run right to left, like reading.
  const colX = (i: number) => x0 + (count - 1 - i) * colW;
  return { colW, colX, unit, ground, height };
}

export const columnsView = (fr: Pick<ColumnsFrame, "cols" | "max" | "groups">): [number, number, number, number] => [
  0,
  0,
  16,
  Math.round(columnsGeometry(fr.cols.length, fr.max, !!fr.groups?.length).height * 100) / 100,
];

interface Props extends Omit<ColumnsFrame, "kind" | "note"> {
  /** Explore: a tap on a column, or a drag from one column to another. */
  onTap?: (col: number) => void;
  onMove?: (from: number, to: number) => void;
}

export function ColumnsG({ cols, marked = [], line, groups, max, caption, onTap, onMove }: Props) {
  const g = columnsGeometry(cols.length, max, !!groups?.length);
  const { colW, colX, unit, ground } = g;
  const mark = new Set(marked);
  const r = (v: number) => Math.round(v * 1000) / 1000;
  const drag = useRef<{ col: number } | null>(null);

  const colAt = (e: React.PointerEvent<SVGRectElement>) => {
    const el = e.currentTarget;
    const ctm = (el.ownerSVGElement ?? (el as unknown as SVGSVGElement)).getScreenCTM();
    if (!ctm) return -1;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    for (let i = 0; i < cols.length; i++) if (p.x >= colX(i) && p.x < colX(i) + colW) return i;
    return -1;
  };

  // Where each block sits: by column and place in it.
  const blocks: { id: number; col: number; k: number; group?: number }[] = [];
  cols.forEach((c, i) => c.blocks.forEach((id, k) => blocks.push({ id, col: i, k, group: c.group })));
  blocks.sort((a, b) => a.id - b.id);

  return (
    <g>
      {/* Ground */}
      <line x1={0.4} y1={ground} x2={15.6} y2={ground} stroke={INK} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
      {cols.map((c, i) => {
        const x = colX(i);
        const h = c.blocks.length;
        return (
          <g key={`c${i}`} opacity={c.gone ? 0.4 : 1}>
            {c.ghost !== undefined && c.ghost > 0 && (
              <rect x={r(x + colW * 0.08)} y={r(ground - c.ghost * unit)} width={r(colW * 0.84)} height={r(c.ghost * unit)} fill="none" stroke={INK} strokeWidth={1.5} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
            )}
            {c.ask && h === 0 && (
              <>
                <rect x={r(x + colW * 0.08)} y={r(ground - 2.2 * Math.min(unit, 0.5))} width={r(colW * 0.84)} height={r(2.2 * Math.min(unit, 0.5))} fill="#fffaf0" stroke={INK} strokeWidth={1.5} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
              </>
            )}
            <text x={r(x + colW / 2)} y={r(ground - Math.max(h, c.ask && h === 0 ? 2.2 * Math.min(unit, 0.5) / unit : 0, c.ghost ?? 0) * unit - 0.35)} fontSize={0.42} fontWeight={700} fill={INK} textAnchor="middle" dominantBaseline="central">
              {c.ask && h === 0 ? "؟" : fa(h)}
            </text>
            <text x={r(x + colW / 2)} y={r(ground + 0.42)} fontSize={Math.min(0.36, colW * 0.22)} fontWeight={700} fill={INK} textAnchor="middle" dominantBaseline="central">
              {c.selected ? `▲ ${c.label}` : c.label}
            </text>
            {c.gone && <line x1={r(x + colW * 0.1)} y1={r(ground - 0.1)} x2={r(x + colW * 0.9)} y2={r(ground - Math.max(1, h) * unit)} stroke="#c0392b" strokeWidth={3} vectorEffect="non-scaling-stroke" />}
            {c.selected && (
              <rect x={r(x + colW * 0.03)} y={r(TOP - 0.2)} width={r(colW * 0.94)} height={r(ground - TOP + 0.2)} fill="none" stroke={INK} strokeWidth={2.5} strokeDasharray="6 3" vectorEffect="non-scaling-stroke" />
            )}
          </g>
        );
      })}
      {blocks.map(({ id, col, k, group }) => {
        const x = r(colX(col) + colW * 0.12);
        const y = r(ground - (k + 1) * unit);
        const w = r(colW * 0.76);
        const moved = mark.has(id);
        return (
          <g key={`b${id}`} className={css.block} style={{ transform: `translate(${x}px, ${y}px)` }}>
            <rect x={0} y={0.02} width={w} height={r(unit - 0.04)} rx={Math.min(0.08, unit * 0.15)} fill={moved ? MOVED_FILL : BLOCK_FILL[group ?? 0]} stroke={INK} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
            {moved && <circle cx={r(w / 2)} cy={r(unit / 2)} r={r(Math.min(unit * 0.2, 0.12))} fill={INK} />}
          </g>
        );
      })}
      {line && (
        <g>
          <line x1={0.4} y1={r(ground - line.at * unit)} x2={15.6} y2={r(ground - line.at * unit)} stroke="#c0392b" strokeWidth={2} strokeDasharray="8 5" vectorEffect="non-scaling-stroke" />
          <text x={15.6} y={r(ground - line.at * unit - 0.28)} fontSize={0.36} fontWeight={700} fill="#c0392b" textAnchor="start" dominantBaseline="central" style={{ direction: "rtl" }}>
            {line.label}
          </text>
        </g>
      )}
      {groups?.map((gr, i) => {
        const xa = colX(gr.to);
        const xb = colX(gr.from) + colW;
        const y = ground + 0.8;
        return (
          <g key={`g${i}`}>
            <path d={`M${r(xa + 0.1)},${r(y - 0.12)} V${r(y)} H${r(xb - 0.1)} V${r(y - 0.12)}`} fill="none" stroke={INK} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            <text x={r((xa + xb) / 2)} y={r(y + 0.35)} fontSize={0.34} fontWeight={700} fill={INK} textAnchor="middle" dominantBaseline="central" style={{ direction: "rtl" }}>
              {gr.label}
            </text>
          </g>
        );
      })}
      {caption && (
        <text x={8} y={0.35} fontSize={0.38} fontWeight={700} fill={INK} textAnchor="middle" dominantBaseline="central" style={{ direction: "rtl" }}>
          {caption}
        </text>
      )}
      {(onTap || onMove) &&
        cols.map((_, i) => (
          <rect
            key={`hit${i}`}
            x={r(colX(i))}
            y={TOP - 0.3}
            width={r(colW)}
            height={r(ground - TOP + 0.9)}
            fill="transparent"
            style={{ cursor: "pointer", touchAction: "none" }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { col: i };
            }}
            onPointerUp={(e) => {
              const d = drag.current;
              drag.current = null;
              if (!d) return;
              const to = colAt(e);
              if (to < 0 || to === d.col) onTap?.(d.col);
              else onMove?.(d.col, to);
            }}
            onPointerCancel={() => (drag.current = null)}
          />
        ))}
    </g>
  );
}

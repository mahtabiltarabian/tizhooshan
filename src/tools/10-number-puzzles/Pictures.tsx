"use client";

// A number puzzle in board units: squares for the magic square and the
// table, bricks for the pyramid, circles for the magic triangle and the
// number circle and star, triangles for "number in shape". Given numbers sit on a tinted cell with a solid border;
// blanks are white with a dashed border, and what the child writes is blue.
// Wrong lines are hatched and marked ✗, so nothing depends on colour alone.
// Numbers can be dragged from the bank under the figure onto a cell, from a
// cell to another, or off the figure to take them back.

import { useRef, useState } from "react";
import { lineOk, lineSum, type NumberPuzzle } from "@/generators/number-puzzles";
import { fa } from "@/tools/registry";

export const INK = "#1f2430";
export const PEN = "#2f6fdb";
const GIVEN = "#fff1cc";
const ACCENT = "#d9480f";
const BAD = "#c0392b";
const SOFT = "#5b6170";

type Vals = readonly (number | null)[];
type Pt = [number, number];
const round = (v: number) => Math.round(v * 1000) / 1000;

/** Half width and half height of a cell. */
function cellHalf(q: NumberPuzzle, i: number): [number, number] {
  switch (q.type) {
    case "pyramid":
      return [0.48, 0.43];
    case "star":
    case "ring":
      return [0.42, 0.42];
    case "shape":
      return i % 4 === 3 ? [0.4, 0.34] : [0.38, 0.38];
    default:
      return [0.46, 0.46];
  }
}

const isRound = (q: NumberPuzzle, i: number) => q.type === "star" || q.type === "ring" || (q.type === "shape" && i % 4 !== 3);

/** The outline of a cell, grown by `pad`. */
function CellOutline({ q, i, pad = 0, ...rest }: { q: NumberPuzzle; i: number; pad?: number } & React.SVGProps<SVGRectElement & SVGCircleElement>) {
  const { x, y } = q.cells[i];
  const [hw, hh] = cellHalf(q, i);
  if (isRound(q, i)) return <circle cx={x} cy={y} r={hw + pad} {...rest} />;
  return <rect x={round(x - hw - pad)} y={round(y - hh - pad)} width={round(2 * (hw + pad))} height={round(2 * (hh + pad))} rx={0.08} {...rest} />;
}

/** Where a line's sum or mark is written: just past its end. */
export function labelAt(q: NumberPuzzle, li: number): Pt {
  const line = q.lines[li];
  const cells = line.cells.map((i) => q.cells[i]);
  if (line.kind === "side") {
    const cx = q.cells.reduce((s, c) => s + c.x, 0) / q.cells.length;
    const cy = q.cells.reduce((s, c) => s + c.y, 0) / q.cells.length;
    const m = cells[1];
    const d = Math.hypot(m.x - cx, m.y - cy) || 1;
    return [round(m.x + ((m.x - cx) / d) * 0.85), round(m.y + ((m.y - cy) / d) * 0.85)];
  }
  const last = cells[cells.length - 1];
  if (line.kind === "brick") return [round(last.x + 0.3), round(last.y - 0.22)];
  const prev = cells[cells.length - 2];
  const d = Math.hypot(last.x - prev.x, last.y - prev.y) || 1;
  return [round(last.x + ((last.x - prev.x) / d) * 0.85), round(last.y + ((last.y - prev.y) / d) * 0.85)];
}

/** Bounds of the figure with room for line labels: [x0, y0, x1, y1]. */
function bounds(q: NumberPuzzle): [number, number, number, number] {
  const xs = q.cells.map((c) => c.x);
  const ys = q.cells.map((c) => c.y);
  let [x0, y0, x1, y1] = [Math.min(...xs) - 0.6, Math.min(...ys) - 0.6, Math.max(...xs) + 0.6, Math.max(...ys) + 0.6];
  if (q.type === "magic" || q.type === "star" || q.type === "ring")
    q.lines.forEach((_, li) => {
      const [x, y] = labelAt(q, li);
      [x0, y0, x1, y1] = [Math.min(x0, x - 0.5), Math.min(y0, y - 0.35), Math.max(x1, x + 0.5), Math.max(y1, y + 0.35)];
    });
  if (q.type === "grid") [x0, y0, x1] = [x0 - 0.7, y0 - 0.45, x1 + 0.7];
  if (q.type === "shape") y1 += 0.5;
  return [round(x0), round(y0), round(x1), round(y1)];
}

const TILE = 0.95;

/** Bank tiles under the figure. */
function bankSpots(q: NumberPuzzle, bank: readonly number[]): { v: number; x: number; y: number }[] {
  const [x0, , x1, y1] = bounds(q);
  const cx = (x0 + x1) / 2;
  // The first number on the right, where Persian starts.
  return bank.map((v, i) => ({ v, x: round(cx + ((bank.length - 1) / 2 - i) * TILE), y: round(y1 + 0.6) }));
}

/** The board view for a puzzle, with or without the bank row. */
export function figureView(q: NumberPuzzle, bank?: readonly number[] | null): [number, number, number, number] {
  const [bx0, y0, bx1, by1] = bounds(q);
  let [x0, x1, y1] = [bx0, bx1, by1];
  if (bank?.length) {
    const half = (bank.length * TILE) / 2 + 0.2;
    const cx = (x0 + x1) / 2;
    [x0, x1, y1] = [Math.min(x0, cx - half), Math.max(x1, cx + half), y1 + 1.25];
  }
  return [x0, y0, round(x1 - x0), round(y1 - y0)];
}

const textSize = (v: number) => (v >= 100 ? 0.32 : 0.42);

interface FigureProps {
  q: NumberPuzzle;
  vals: Vals;
  /** Cells the child may change. */
  editable?: (i: number) => boolean;
  selected?: number | null;
  onSelect?: (i: number) => void;
  /** A number dragged from the bank (from = null) or a cell, dropped on a cell (to = null: off the figure). */
  onDrop?: (from: number | null, to: number | null, v: number) => void;
  /** A tap on a bank tile. */
  onTile?: (v: number) => void;
  bank?: readonly number[] | null;
  /** Line sums: live while exploring, full lines only (show me), or ✓ and ✗ after a check. */
  sums?: "live" | "full" | "marks" | null;
  /** Lines to hatch. */
  bad?: readonly number[];
  /** Show me: the line used and the cells just filled. */
  focusLine?: number | null;
  focusCells?: readonly number[];
}

export function PuzzleFigure({ q, vals, editable, selected, onSelect, onDrop, onTile, bank, sums, bad = [], focusLine, focusCells = [] }: FigureProps) {
  const drag = useRef<{ v: number | null; from: number | null; start: Pt; moved: boolean } | null>(null);
  const [ghost, setGhost] = useState<{ v: number; x: number; y: number } | null>(null);
  const live = !!(onDrop || onSelect || onTile);
  const canEdit = (i: number) => !!editable?.(i);

  const pointAt = (e: React.PointerEvent<SVGGElement>): Pt => {
    const ctm = e.currentTarget.ownerSVGElement?.getScreenCTM();
    if (!ctm) return [0, 0];
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return [p.x, p.y];
  };
  const down = (v: number | null, from: number | null, e: React.PointerEvent<SVGGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { v, from, start: pointAt(e), moved: false };
  };
  const move = (e: React.PointerEvent<SVGGElement>) => {
    const d = drag.current;
    if (!d || d.v === null || !onDrop) return;
    const [x, y] = pointAt(e);
    if (!d.moved && Math.hypot(x - d.start[0], y - d.start[1]) < 0.15) return;
    d.moved = true;
    setGhost({ v: d.v, x, y });
  };
  const up = (e: React.PointerEvent<SVGGElement>) => {
    const d = drag.current;
    drag.current = null;
    setGhost(null);
    if (!d) return;
    if (!d.moved) {
      if (d.from !== null) onSelect?.(d.from);
      else if (d.v !== null) onTile?.(d.v);
      return;
    }
    const [x, y] = pointAt(e);
    let to: number | null = null;
    let best = 0.6;
    q.cells.forEach((c, i) => {
      const dist = Math.hypot(c.x - x, c.y - y);
      if (canEdit(i) && dist < best) [to, best] = [i, dist];
    });
    if (to !== d.from) onDrop?.(d.from, to, d.v!);
  };
  const handlers = (v: number | null, from: number | null) =>
    live
      ? {
          onPointerDown: (e: React.PointerEvent<SVGGElement>) => down(v, from, e),
          onPointerMove: move,
          onPointerUp: up,
          onPointerCancel: () => {
            drag.current = null;
            setGhost(null);
          },
          style: { cursor: "pointer", touchAction: "none" } as const,
        }
      : {};

  const hatched = new Set(bad.flatMap((li) => q.lines[li].cells));
  const used = new Set(vals.filter((v): v is number => v !== null));

  // A common total for live sums: the puzzle's, or (magic triangle) the one all full sides share.
  const sideSums = q.lines.filter((l) => !l.total).map((l) => lineSum(l, vals));
  const common = q.target ?? (sideSums.length && sideSums.every((s) => s !== null && s === sideSums[0]) ? sideSums[0] : null);

  return (
    <g>
      {bad.length > 0 && (
        <defs>
          <pattern id="t10-hatch" width={0.18} height={0.18} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={0.18} stroke={BAD} strokeWidth={0.045} />
          </pattern>
        </defs>
      )}

      {/* Triangle edges */}
      {q.type === "star" && <polygon points={[0, 1, 2].map((i) => `${q.cells[i].x},${q.cells[i].y}`).join(" ")} fill="none" stroke={SOFT} strokeWidth={0.03} />}
      {/* Number wheel: the rim and three lines through the centre. Star: its two triangles. */}
      {q.type === "ring" && q.cells.length === 7 && (
        <g fill="none" stroke={SOFT} strokeWidth={0.03}>
          <circle cx={q.cells[0].x} cy={q.cells[0].y} r={round(Math.hypot(q.cells[1].x - q.cells[0].x, q.cells[1].y - q.cells[0].y))} strokeDasharray="0.1 0.08" />
          {q.lines.map((l, li) => (
            <line key={li} x1={q.cells[l.cells[0]].x} y1={q.cells[l.cells[0]].y} x2={q.cells[l.cells[2]].x} y2={q.cells[l.cells[2]].y} />
          ))}
        </g>
      )}
      {q.type === "ring" && q.cells.length === 12 &&
        [0, 1].map((k) => <polygon key={k} points={[k, k + 2, k + 4].map((i) => `${q.cells[i].x},${q.cells[i].y}`).join(" ")} fill="none" stroke={SOFT} strokeWidth={0.03} />)}
      {q.type === "shape" &&
        [0, 1, 2].map((k) => (
          <g key={k}>
            <polygon points={[0, 1, 2].map((j) => `${q.cells[4 * k + j].x},${q.cells[4 * k + j].y}`).join(" ")} fill="#fffaf0" stroke={SOFT} strokeWidth={0.03} />
            <text x={q.cells[4 * k].x} y={2.95} fontSize={0.3} fontWeight={700} textAnchor="middle" fill={SOFT}>
              {k === 2 ? "شکل ۳: ؟" : `شکل ${fa(k + 1)}`}
            </text>
          </g>
        ))}

      {/* Grid headings */}
      {q.type === "grid" && (
        <>
          <text x={0} y={-0.62} fontSize={0.3} fontWeight={700} textAnchor="middle" fill={SOFT}>
            جمع
          </text>
          <text x={4.05} y={3.36} fontSize={0.3} fontWeight={700} textAnchor="middle" fill={SOFT}>
            جمع
          </text>
        </>
      )}

      {q.cells.map((c, i) => {
        const v = vals[i];
        const given = c.given && !canEdit(i) && v !== null;
        const blank = !given;
        const total = q.type === "grid" && (i % 4 === 3 || i >= 12);
        return (
          <g key={i} {...(canEdit(i) ? handlers(v, i) : {})}>
            <CellOutline
              q={q}
              i={i}
              fill={given ? (total ? "#efe2c6" : GIVEN) : "#ffffff"}
              stroke={given ? INK : SOFT}
              strokeWidth={given ? 0.035 : 0.025}
              strokeDasharray={blank ? "0.12 0.08" : undefined}
            />
            {hatched.has(i) && <CellOutline q={q} i={i} fill="url(#t10-hatch)" opacity={0.6} pointerEvents="none" />}
            {v !== null ? (
              <text x={c.x} y={c.y} dy="0.35em" fontSize={textSize(v)} fontWeight={given ? 800 : 700} textAnchor="middle" fill={given ? INK : PEN}>
                {fa(v)}
              </text>
            ) : (
              q.type === "shape" && (
                <text x={c.x} y={c.y} dy="0.35em" fontSize={0.4} fontWeight={800} textAnchor="middle" fill={SOFT}>
                  ؟
                </text>
              )
            )}
          </g>
        );
      })}

      {/* Show me: the line used (dashed) and the cell just found (thick). */}
      {focusLine !== null && focusLine !== undefined && q.lines[focusLine].cells.map((i) => <CellOutline key={`l${i}`} q={q} i={i} pad={0.06} fill="none" stroke={ACCENT} strokeWidth={0.04} strokeDasharray="0.15 0.1" pointerEvents="none" />)}
      {focusCells.map((i) => (
        <CellOutline key={`f${i}`} q={q} i={i} pad={0.08} fill="none" stroke={ACCENT} strokeWidth={0.08} pointerEvents="none" />
      ))}

      {selected !== null && selected !== undefined && q.cells[selected] && (
        <g pointerEvents="none">
          <CellOutline q={q} i={selected} pad={0.05} fill="none" stroke={ACCENT} strokeWidth={0.07} />
          <text x={q.cells[selected].x} y={round(q.cells[selected].y - cellHalf(q, selected)[1] - 0.1)} fontSize={0.26} textAnchor="middle" fill={ACCENT}>
            ▼
          </text>
        </g>
      )}

      {/* Line sums and marks */}
      {sums &&
        q.lines.map((line, li) => {
          const ok = lineOk(q, line, vals);
          const s = lineSum(line, vals);
          if ((sums === "marks" || sums === "full") && ok === null && (line.total || s === null)) return null;
          if (sums === "live" && (line.total || s === null && line.cells.every((i) => vals[i] === null))) return null;
          const partial = line.cells.reduce((t, i) => t + (vals[i] ?? 0), 0);
          const full = s !== null;
          const mark = full ? (sums === "marks" ? (ok ? "✓" : "✗") : common !== null ? (s === common ? "✓" : q.target !== null ? "✗" : "") : "") : "";
          const [x, y] = labelAt(q, li);
          const wrong = mark === "✗";
          const text = line.total ? mark : `${fa(full ? s : partial)}${full ? "" : "…"}${mark ? ` ${mark}` : ""}`;
          return (
            <text key={li} x={x} y={y} dy="0.35em" fontSize={line.kind === "brick" ? 0.26 : 0.32} fontWeight={800} textAnchor="middle" fill={wrong ? BAD : mark === "✓" ? "#1d7a46" : SOFT} pointerEvents="none">
              {text}
            </text>
          );
        })}

      {/* Bank */}
      {bank &&
        bankSpots(q, bank).map(({ v, x, y }) => {
          const off = used.has(v);
          return (
            <g key={v} {...(off ? {} : handlers(v, null))} opacity={off ? 0.35 : 1}>
              <rect x={round(x - 0.4)} y={round(y - 0.4)} width={0.8} height={0.8} rx={0.12} fill={off ? "#ffffff" : "#e8f0ff"} stroke={off ? SOFT : PEN} strokeWidth={0.03} strokeDasharray={off ? "0.1 0.08" : undefined} />
              <text x={x} y={y} dy="0.35em" fontSize={textSize(v)} fontWeight={800} textAnchor="middle" fill={off ? SOFT : PEN}>
                {fa(v)}
              </text>
            </g>
          );
        })}

      {ghost && (
        <g pointerEvents="none" opacity={0.85}>
          <rect x={round(ghost.x - 0.4)} y={round(ghost.y - 0.4)} width={0.8} height={0.8} rx={0.12} fill="#e8f0ff" stroke={PEN} strokeWidth={0.04} />
          <text x={ghost.x} y={ghost.y} dy="0.35em" fontSize={textSize(ghost.v)} fontWeight={800} textAnchor="middle" fill={PEN}>
            {fa(ghost.v)}
          </text>
        </g>
      )}
    </g>
  );
}

/** A small stand-alone drawing (worksheet, answer key). */
export function PuzzleSvg({ q, vals, width }: { q: NumberPuzzle; vals: Vals; width: number }) {
  const [x, y, w, h] = figureView(q);
  return (
    <svg viewBox={`${x} ${y} ${w} ${h}`} width={width} height={Math.round((width * h) / w)} style={{ direction: "ltr" }} role="img" aria-label="معما">
      <PuzzleFigure q={q} vals={vals} />
    </svg>
  );
}

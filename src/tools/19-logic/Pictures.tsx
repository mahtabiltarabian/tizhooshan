"use client";

// Pictures for tool 19, in board units.
// Grid: one square per person and item, the first item on the right where
// Persian starts; ✓ and ✗ are symbols, never colour alone. A contradiction is
// hatched (cell, row or column) and outlined with a dashed line. The clues sit
// beside the grid, numbered, with ✓ once used (show me) or ✗ when broken.
// Liars: one row per person: a badge (؟ / راستگو / دروغگو) and a speech
// bubble; a bubble that does not fit is hatched and marked ✗.
// Venn: two or three circles; an empty region is hatched, "some" puts ×
// (×؟ in each piece when it could be either), an example model puts dots.
// Regions are drawn with clip paths (inside) and masks (outside), and every
// coordinate is rounded so the server and the browser draw the same thing.

import { useId, useRef, useState } from "react";
import type { Mark } from "@/generators/logic";
import { fa } from "@/tools/registry";

export const INK = "#0f172a";
export const PEN = "#2f6fdb";
export const GOOD = "#1d7a46";
export const BAD = "#c0392b";
export const SOFT = "#5b6476";
export const ACCENT = "#d9480f";
export const PAPER = "#ffffff";

type Pt = [number, number];
const round = (v: number) => Math.round(v * 10000) / 10000;

/** A safe, unique id prefix for patterns, clip paths and masks. */
export function useSvgId(prefix: string) {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

export function Hatch({ id, color = BAD, gap = 0.16 }: { id: string; color?: string; gap?: number }) {
  return (
    <pattern id={id} width={gap} height={gap} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1={0} y1={0} x2={0} y2={gap} stroke={color} strokeWidth={0.045} />
    </pattern>
  );
}

// ───────────── grid ─────────────

const NAME_W = 1.6;
const HEAD = 0.95;
const CLUE_GAP = 0.66;
const CLUE_FONT = 0.3;

export type ClueState = "done" | "now" | "broken" | null;

/** Room for the clue list: about 0.16 a letter at this size, plus the number. */
const clueWidth = (clues: readonly string[]) => round(Math.min(10, Math.max(4, 1.3 + 0.16 * Math.max(...clues.map((c) => c.length)))));

/** Board view of a grid; with clues, room for them on the left. */
export function gridView(n: number, clues: readonly string[] | null): [number, number, number, number] {
  const x0 = clues === null ? -0.3 : -clueWidth(clues) - 0.4;
  const y0 = -HEAD - 0.3;
  const h = Math.max(n, clues === null ? 0 : clues.length * CLUE_GAP - HEAD + 0.2) + HEAD + 0.6;
  return [x0, y0, round(n + NAME_W + 0.3 - x0), round(h)];
}

interface GridFigureProps {
  n: number;
  people: readonly string[];
  items: readonly string[];
  marks: readonly Mark[];
  /** Clues beside the grid (board only; the worksheet lists them as text). */
  clues?: readonly string[];
  clueState?: (k: number) => ClueState;
  onCell?: (c: number) => void;
  /** Contradictions to hatch. */
  bad?: { cells: readonly number[]; rows: readonly number[]; cols: readonly number[] } | null;
  /** Show me: cells the step just filled. */
  focus?: readonly number[];
}

export function GridFigure({ n, people, items, marks, clues, clueState, onCell, bad, focus = [] }: GridFigureProps) {
  const hatch = useSvgId("t19g");
  const CLUE_W = clues ? clueWidth(clues) : 0;
  const colX = (i: number) => n - 1 - i;
  const badCells = new Set(bad?.cells ?? []);
  const any = !!bad && (bad.cells.length > 0 || bad.rows.length > 0 || bad.cols.length > 0);
  return (
    <g>
      {any && (
        <defs>
          <Hatch id={hatch} />
        </defs>
      )}

      {/* Item headings, first on the right */}
      {items.map((it, i) => (
        <text key={it} x={round(colX(i) + 0.5)} y={-0.32} fontSize={0.3} fontWeight={700} textAnchor="middle" fill={INK}>
          {it}
        </text>
      ))}
      {people.map((name, p) => (
        <text key={name} x={round(n + NAME_W / 2)} y={p + 0.5} dy="0.35em" fontSize={0.32} fontWeight={700} textAnchor="middle" fill={INK}>
          {name}
        </text>
      ))}

      {Array.from({ length: n * n }, (_, c) => {
        const [p, i] = [Math.floor(c / n), c % n];
        const m = marks[c];
        const x = colX(i);
        return (
          <g key={c} onClick={onCell ? () => onCell(c) : undefined} style={onCell ? { cursor: "pointer" } : undefined}>
            <rect x={x} y={p} width={1} height={1} fill={PAPER} stroke={SOFT} strokeWidth={0.025} />
            {badCells.has(c) && <rect x={x} y={p} width={1} height={1} fill={`url(#${hatch})`} opacity={0.65} pointerEvents="none" />}
            {m !== 0 && (
              <text x={x + 0.5} y={p + 0.5} dy="0.35em" fontSize={0.6} fontWeight={800} textAnchor="middle" fill={m === 1 ? GOOD : SOFT} pointerEvents="none">
                {m === 1 ? "✓" : "✗"}
              </text>
            )}
            {badCells.has(c) && <rect x={x + 0.06} y={p + 0.06} width={0.88} height={0.88} fill="none" stroke={BAD} strokeWidth={0.05} strokeDasharray="0.12 0.08" pointerEvents="none" />}
          </g>
        );
      })}
      {/* Outline and the line between names and items */}
      <rect x={0} y={0} width={n} height={n} fill="none" stroke={INK} strokeWidth={0.05} pointerEvents="none" />
      <rect x={0} y={-HEAD + 0.2} width={round(n + NAME_W)} height={round(n + HEAD - 0.2)} fill="none" stroke={SOFT} strokeWidth={0.02} rx={0.1} pointerEvents="none" />

      {bad?.rows.map((p) => (
        <g key={`r${p}`} pointerEvents="none">
          <rect x={0} y={p} width={n} height={1} fill={`url(#${hatch})`} opacity={0.5} />
          <rect x={-0.04} y={p + 0.04} width={round(n + NAME_W)} height={0.92} fill="none" stroke={BAD} strokeWidth={0.06} strokeDasharray="0.15 0.1" rx={0.08} />
        </g>
      ))}
      {bad?.cols.map((i) => (
        <g key={`c${i}`} pointerEvents="none">
          <rect x={colX(i)} y={0} width={1} height={n} fill={`url(#${hatch})`} opacity={0.5} />
          <rect x={colX(i) + 0.04} y={-HEAD + 0.25} width={0.92} height={round(n + HEAD - 0.2)} fill="none" stroke={BAD} strokeWidth={0.06} strokeDasharray="0.15 0.1" rx={0.08} />
        </g>
      ))}
      {focus.map((c) => (
        <rect key={`f${c}`} x={colX(c % n) + 0.05} y={Math.floor(c / n) + 0.05} width={0.9} height={0.9} fill="none" stroke={ACCENT} strokeWidth={0.09} pointerEvents="none" />
      ))}

      {/* Clues, numbered, beside the grid */}
      {clues?.map((text, k) => {
        const st = clueState?.(k) ?? null;
        const y = round(-HEAD + 0.35 + k * CLUE_GAP);
        return (
          <g key={k} pointerEvents="none">
            {(st === "now" || st === "broken") && (
              <rect x={-CLUE_W - 0.1} y={round(y - 0.28)} width={CLUE_W} height={0.56} rx={0.1} fill={st === "broken" ? `url(#${hatch})` : "#fff1e0"} stroke={st === "now" ? ACCENT : BAD} strokeWidth={0.04} strokeDasharray={st === "broken" ? "0.12 0.08" : undefined} />
            )}
            <circle cx={-0.5} cy={y} r={0.22} fill={st === "done" ? "#e7f7ee" : PAPER} stroke={st === "now" ? ACCENT : SOFT} strokeWidth={0.03} />
            <text x={-0.5} y={y} dy="0.35em" fontSize={0.26} fontWeight={800} textAnchor="middle" fill={INK}>
              {fa(k + 1)}
            </text>
            <text x={-0.85} y={y} dy="0.35em" fontSize={CLUE_FONT} fontWeight={st === "now" ? 800 : 500} textAnchor="end" fill={st === "done" ? SOFT : INK}>
              {text}
            </text>
            {st === "done" && (
              <text x={-CLUE_W} y={y} dy="0.35em" fontSize={0.3} fontWeight={800} fill={GOOD}>
                ✓
              </text>
            )}
            {st === "broken" && (
              <text x={-CLUE_W} y={y} dy="0.35em" fontSize={0.3} fontWeight={800} fill={BAD}>
                ✗
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** A small stand-alone grid (worksheet, answer key). */
export function GridSvg({ n, people, items, marks, width }: { n: number; people: readonly string[]; items: readonly string[]; marks: readonly Mark[]; width: number }) {
  const [x, y, w, h] = gridView(n, null);
  return (
    <svg viewBox={`${x} ${y} ${w} ${h}`} width={width} height={Math.round((width * h) / w)} style={{ direction: "ltr" }} role="img" aria-label="جدول منطقی">
      <GridFigure n={n} people={people} items={items} marks={marks} />
    </svg>
  );
}

/** The solved grid: ✓ on the answer, ✗ elsewhere. */
export const solvedMarks = (n: number, answer: readonly number[]): Mark[] => Array.from({ length: n * n }, (_, c) => (answer[Math.floor(c / n)] === c % n ? 1 : -1));

// ───────────── liars ─────────────

const ROW = 1.5;
const LIARS_W = 13;

export const liarsView = (n: number): [number, number, number, number] => [-0.2, -0.3, LIARS_W + 0.4, round(n * ROW + 0.3)];

interface LiarsFigureProps {
  people: readonly string[];
  /** What each says; null: nothing. */
  texts: readonly (string | null)[];
  /** null: not known yet; true: liar. */
  known: readonly (boolean | null)[];
  onToggle?: (p: number) => void;
  /** Per speaker: fits (✓), clash (hatched, ✗) or not judged. */
  status?: readonly ("fits" | "clash" | null)[];
  /** Show me: the statement used. */
  focus?: number | null;
  /** Show me: the person just assumed or found. */
  focusWho?: number | null;
}

export function LiarsFigure({ people, texts, known, onToggle, status = [], focus = null, focusWho = null }: LiarsFigureProps) {
  const hatch = useSvgId("t19l");
  const bx = LIARS_W - 2.4;
  return (
    <g>
      <defs>
        <Hatch id={hatch} />
      </defs>
      {people.map((name, p) => {
        const y = p * ROW;
        const cy = y + ROW / 2;
        const k = known[p];
        const st = status[p] ?? null;
        const text = texts[p];
        return (
          <g key={p}>
            {/* Person: a face, the name, and the badge */}
            <circle cx={LIARS_W - 0.65} cy={round(cy - 0.22)} r={0.38} fill="#fff1cc" stroke={INK} strokeWidth={0.04} />
            <text x={LIARS_W - 0.65} y={round(cy - 0.22)} dy="0.35em" fontSize={0.36} fontWeight={800} textAnchor="middle" fill={INK}>
              {name[0]}
            </text>
            <text x={LIARS_W - 0.65} y={round(cy + 0.43)} dy="0.35em" fontSize={0.27} fontWeight={700} textAnchor="middle" fill={INK}>
              {name}
            </text>
            <g onClick={onToggle ? () => onToggle(p) : undefined} style={onToggle ? { cursor: "pointer" } : undefined}>
              <rect
                x={bx - 0.25}
                y={round(cy - 0.32)}
                width={1.5}
                height={0.64}
                rx={0.32}
                fill={k === null ? PAPER : k ? "#fde7e4" : "#e7f7ee"}
                stroke={k === null ? SOFT : k ? BAD : GOOD}
                strokeWidth={focusWho === p ? 0.09 : 0.04}
                strokeDasharray={k === null ? "0.1 0.08" : k ? "0.18 0.07" : undefined}
              />
              <text x={round(bx + 0.5)} y={cy} dy="0.35em" fontSize={0.27} fontWeight={800} textAnchor="middle" fill={k === null ? SOFT : k ? BAD : GOOD}>
                {k === null ? "؟" : k ? "دروغگو" : "راستگو"}
              </text>
            </g>
            {focusWho === p && <rect x={bx - 0.38} y={round(cy - 0.45)} width={1.76} height={0.9} rx={0.42} fill="none" stroke={ACCENT} strokeWidth={0.07} pointerEvents="none" />}

            {/* Speech bubble, pointing at the person */}
            <g pointerEvents="none">
              <path
                d={`M ${round(bx - 0.5)} ${round(cy - 0.5)} H 0.2 V ${round(cy + 0.5)} H ${round(bx - 0.5)} V ${round(cy + 0.12)} L ${round(bx - 0.3)} ${cy} L ${round(bx - 0.5)} ${round(cy - 0.12)} Z`}
                fill={PAPER}
                stroke={focus === p ? ACCENT : st === "clash" ? BAD : SOFT}
                strokeWidth={focus === p ? 0.08 : 0.035}
                strokeDasharray={text === null || st === "clash" ? "0.14 0.08" : undefined}
                strokeLinejoin="round"
              />
              {st === "clash" && <rect x={0.2} y={round(cy - 0.5)} width={round(bx - 0.7)} height={1} fill={`url(#${hatch})`} opacity={0.45} />}
              <text x={round(bx - 0.7)} y={cy} dy="0.35em" fontSize={0.32} fontWeight={600} textAnchor="end" fill={text === null ? SOFT : INK}>
                {text === null ? "(چیزی نمی‌گوید)" : `«${text}»`}
              </text>
              {st && (
                <text x={0.4} y={cy} dy="0.35em" fontSize={0.28} fontWeight={800} fill={st === "fits" ? GOOD : BAD}>
                  {st === "fits" ? "✓ جور است" : "✗ جور نیست"}
                </text>
              )}
            </g>
          </g>
        );
      })}
    </g>
  );
}

// ───────────── Venn ─────────────

export const VENN_R = 1.6;
export const CENTERS: Record<2 | 3, Pt[]> = {
  2: [
    [0.95, 0],
    [-0.95, 0],
  ],
  3: [
    [0.95, -0.55],
    [-0.95, -0.55],
    [0, 1.1],
  ],
};
export const TINTS = ["#ffd8a8", "#a5d8ff", "#b2f2bb"];

/** Which region (bit t: inside circle t) a point is in. */
export function regionAt(k: 2 | 3, x: number, y: number): number {
  return CENTERS[k].reduce((r, [cx, cy], t) => (Math.hypot(x - cx, y - cy) < VENN_R ? r | (1 << t) : r), 0);
}

/** A point deep inside each region, found on a fine grid: the one farthest from every circle's edge. */
function regionPoints(k: 2 | 3): Pt[] {
  const best: { pt: Pt; d: number }[] = Array.from({ length: 1 << k }, () => ({ pt: [0, 0], d: -1 }));
  for (let x = -2.6; x <= 2.6; x += 0.05)
    for (let y = -2.2; y <= 2.8; y += 0.05) {
      const r = regionAt(k, x, y);
      if (r === 0) continue;
      const d = Math.min(...CENTERS[k].map(([cx, cy]) => Math.abs(Math.hypot(x - cx, y - cy) - VENN_R)));
      if (d > best[r].d) best[r] = { pt: [round(x), round(y)], d };
    }
  return best.map((b) => b.pt);
}
export const REGION_PT: Record<2 | 3, Pt[]> = { 2: regionPoints(2), 3: regionPoints(3) };

/** Board size of one diagram: [x, y, w, h] around its centre. */
export const vennBox = (k: 2 | 3): [number, number, number, number] => (k === 2 ? [-2.8, -2.4, 5.6, 4.2] : [-2.8, -2.85, 5.6, 6.35]);

const labelAt = (k: 2 | 3, t: number): Pt => {
  const [cx, cy] = CENTERS[k][t];
  return t === 2 ? [cx, round(cy + VENN_R + 0.42)] : [cx, round(cy - VENN_R - 0.28)];
};

const bits = (mask: number) => Array.from({ length: 8 }, (_, r) => r).filter((r) => (mask >> r) & 1);

interface VennProps {
  /** Labels of the circles (2 or 3). */
  names: readonly string[];
  x?: number;
  y?: number;
  /** Regions to hatch (empty). */
  empty?: number;
  /** For each "some": the regions it could be in. */
  needs?: readonly number[];
  /** An example: regions with members (dots). */
  dots?: number;
  /** The child's own hatching, in blue. */
  user?: number;
  onRegion?: (r: number) => void;
  caption?: string;
}

export function VennFigure({ names, x = 0, y = 0, empty = 0, needs = [], dots = 0, user = 0, onRegion, caption }: VennProps) {
  const id = useSvgId("t19v");
  const k = names.length as 2 | 3;
  const centers = CENTERS[k];
  const [bx, by, bw, bh] = vennBox(k);
  const regions = Array.from({ length: (1 << k) - 1 }, (_, i) => i + 1);

  /** One region, filled: inside its circles (nested clips), outside the others (mask). */
  const region = (r: number, fill: string, opacity = 1) => {
    let el = <rect x={bx} y={by} width={bw} height={bh} fill={fill} opacity={opacity} mask={`url(#${id}m${r})`} />;
    for (let t = 0; t < k; t++) if ((r >> t) & 1) el = <g clipPath={`url(#${id}c${t})`}>{el}</g>;
    return <g key={`${fill}${r}`}>{el}</g>;
  };

  const click = (e: React.MouseEvent<SVGRectElement>) => {
    const ctm = e.currentTarget.getScreenCTM();
    if (!ctm || !onRegion) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const r = regionAt(k, p.x, p.y);
    if (r) onRegion(r);
  };

  return (
    <g transform={x || y ? `translate(${round(x)} ${round(y)})` : undefined}>
      <defs>
        <Hatch id={`${id}h`} color={INK} />
        <Hatch id={`${id}u`} color={PEN} gap={0.2} />
        {centers.map(([cx, cy], t) => (
          <clipPath key={t} id={`${id}c${t}`}>
            <circle cx={cx} cy={cy} r={VENN_R} />
          </clipPath>
        ))}
        {regions.map((r) => (
          <mask key={r} id={`${id}m${r}`} maskUnits="userSpaceOnUse" x={bx} y={by} width={bw} height={bh}>
            <rect x={bx} y={by} width={bw} height={bh} fill="#fff" />
            {centers.map(([cx, cy], t) => ((r >> t) & 1 ? null : <circle key={t} cx={cx} cy={cy} r={VENN_R} fill="#000" />))}
          </mask>
        ))}
      </defs>

      {centers.map(([cx, cy], t) => (
        <circle key={`f${t}`} cx={cx} cy={cy} r={VENN_R} fill={TINTS[t]} opacity={0.35} />
      ))}
      {bits(user & ~empty).filter((r) => r > 0).map((r) => region(r, `url(#${id}u)`, 0.9))}
      {bits(empty).filter((r) => r > 0).map((r) => region(r, `url(#${id}h)`, 0.75))}
      {centers.map(([cx, cy], t) => (
        <circle key={`o${t}`} cx={cx} cy={cy} r={VENN_R} fill="none" stroke={INK} strokeWidth={0.045} />
      ))}
      {names.map((name, t) => {
        const [lx, ly] = labelAt(k, t);
        return (
          <text key={t} x={lx} y={ly} dy="0.35em" fontSize={0.36} fontWeight={800} textAnchor="middle" fill={INK}>
            {name}
          </text>
        );
      })}

      {/* × for "some": solid when only one piece is left, ×؟ in each piece otherwise */}
      {needs.map((m, j) => {
        const where = bits(m & ~empty).filter((r) => r > 0);
        return where.map((r) => {
          const [px, py] = REGION_PT[k][r];
          const sure = where.length === 1;
          return (
            <text key={`n${j}-${r}`} x={round(px + (j % 2 ? 0.22 : -0.22) * (needs.length > 1 ? 1 : 0))} y={round(py - 0.12)} dy="0.35em" fontSize={sure ? 0.55 : 0.38} fontWeight={800} textAnchor="middle" fill={ACCENT}>
              {sure ? "×" : "×؟"}
            </text>
          );
        });
      })}

      {bits(dots).filter((r) => r > 0).map((r) => {
        const [px, py] = REGION_PT[k][r];
        return <circle key={`d${r}`} cx={px} cy={round(py + 0.32)} r={0.13} fill={PEN} stroke={PAPER} strokeWidth={0.03} />;
      })}

      {onRegion && <rect x={bx} y={by} width={bw} height={bh} fill="transparent" onClick={click} style={{ cursor: "pointer" }} />}
      {caption && (
        <text x={0} y={round(by + bh + 0.45)} fontSize={0.3} fontWeight={700} textAnchor="middle" fill={SOFT}>
          {caption}
        </text>
      )}
    </g>
  );
}

/** A small stand-alone diagram (worksheet: blank circles to draw on). */
export function VennSvg({ names, width, empty, needs }: { names: readonly string[]; width: number; empty?: number; needs?: readonly number[] }) {
  const [x, y, w, h] = vennBox(names.length as 2 | 3);
  return (
    <svg viewBox={`${x} ${y} ${w} ${h}`} width={width} height={Math.round((width * h) / w)} style={{ direction: "ltr" }} role="img" aria-label="نمودار ون">
      <VennFigure names={names} empty={empty} needs={needs} />
    </svg>
  );
}

// ───────────── Venn tokens (explore) ─────────────

export interface Token {
  id: number;
  name: string;
  /** null: still in the bank under the diagram. */
  at: Pt | null;
}

const TOKEN_H = 0.46;
const tokenW = (name: string) => round(0.19 * name.length + 0.35);
export const BANK_Y = 4.15;

/** Where an unplaced token waits: two rows under the diagram, first on the right. */
export function bankSpot(index: number, count: number): Pt {
  const perRow = Math.ceil(count / 2);
  const row = Math.floor(index / perRow);
  const col = index % perRow;
  return [round(2.25 - col * (4.5 / Math.max(1, perRow - 1))), round(BANK_Y + row * 0.62)];
}

export function TokenLayer({ tokens, onMove }: { tokens: readonly Token[]; onMove: (id: number, at: Pt | null) => void }) {
  const drag = useRef<{ id: number; dx: number; dy: number } | null>(null);
  const [live, setLive] = useState<{ id: number; at: Pt } | null>(null);

  const pointAt = (e: React.PointerEvent<SVGGElement>): Pt => {
    const ctm = e.currentTarget.ownerSVGElement?.getScreenCTM();
    if (!ctm) return [0, 0];
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return [p.x, p.y];
  };

  return (
    <g>
      <line x1={-2.7} x2={2.7} y1={BANK_Y - 0.45} y2={BANK_Y - 0.45} stroke={SOFT} strokeWidth={0.02} strokeDasharray="0.1 0.08" />
      {tokens.map((t, i) => {
        const at = live?.id === t.id ? live.at : (t.at ?? bankSpot(i, tokens.length));
        const w = tokenW(t.name);
        return (
          <g
            key={t.id}
            transform={`translate(${round(at[0])} ${round(at[1])})`}
            style={{ cursor: "grab", touchAction: "none" }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              const [px, py] = pointAt(e);
              drag.current = { id: t.id, dx: at[0] - px, dy: at[1] - py };
              setLive({ id: t.id, at });
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d || d.id !== t.id) return;
              const [px, py] = pointAt(e);
              setLive({ id: t.id, at: [round(px + d.dx), round(py + d.dy)] });
            }}
            onPointerUp={() => {
              const d = drag.current;
              drag.current = null;
              if (!d || !live) return setLive(null);
              // Dropped below the dashed line: back to the bank.
              onMove(t.id, live.at[1] > BANK_Y - 0.45 ? null : live.at);
              setLive(null);
            }}
            onPointerCancel={() => {
              drag.current = null;
              setLive(null);
            }}
          >
            <rect x={round(-w / 2)} y={-TOKEN_H / 2} width={w} height={TOKEN_H} rx={0.2} fill="#e8f0ff" stroke={PEN} strokeWidth={0.03} />
            <text y={0} dy="0.35em" fontSize={0.27} fontWeight={800} textAnchor="middle" fill={PEN}>
              {t.name}
            </text>
          </g>
        );
      })}
    </g>
  );
}

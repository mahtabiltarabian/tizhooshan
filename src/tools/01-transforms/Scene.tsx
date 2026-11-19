"use client";

// The big board: the figure on a grid, and a copy of it carried through the
// moves (flip over a mirror, turn about a point, slide). Each finished step
// leaves a dashed outline behind, so the steps can be followed.

import { useId, type ReactNode } from "react";
import { applyOp, bounds, moveFigure, type Figure, type Op, type Pt } from "@/generators/transforms";
import { Board } from "@/engine-2d/Board";
import { fa } from "@/tools/registry";
import { CountPathG, FigureG, GridG, Hatch, INK, LineG, LinksG, PivotG, progress } from "./Pictures";

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Figure after each move: states[0] is the figure, states[i + 1] after ops[i]. */
export const statesOf = (figure: Figure, ops: Op[]) => ops.reduce<Figure[]>((acc, op) => [...acc, moveFigure(acc[acc.length - 1], op)], [figure]);

/** A whole-cell rectangle around some figures and points. */
export function rectAround(figs: Figure[], pts: Pt[] = [], pad = 1): Rect {
  const bs = figs.map(bounds);
  const xs = [...bs.flatMap((b) => [b.minX, b.maxX]), ...pts.map((p) => p[0])];
  const ys = [...bs.flatMap((b) => [b.minY, b.maxY]), ...pts.map((p) => p[1])];
  return { x0: Math.floor(Math.min(...xs)) - pad, y0: Math.floor(Math.min(...ys)) - pad, x1: Math.ceil(Math.max(...xs)) + pad, y1: Math.ceil(Math.max(...ys)) + pad };
}

/** How a reflection line is drawn: upright lines are mirrors, level ones water. */
const lineLook = (op: Extract<Op, { kind: "reflect" }>, plain: boolean) => (plain ? "plain" : op.line.kind === "v" ? "mirror" : op.line.kind === "h" ? "water" : "plain");

interface SceneProps {
  figure: Figure;
  ops: Op[];
  /** 0 … 1 over all moves. */
  f: number;
  /** Draw the moving copy (hidden until a question is answered). */
  copy: boolean;
  /** Lines and turning points of these moves are always shown (the question's own). */
  given?: Op[];
  /** Show the moves' lines and points as they happen. */
  guides?: boolean;
  /** Dashed links from each cell to where the current move takes it. */
  links?: boolean;
  /** Draw guide lines as plain dashed lines instead of mirror / water. */
  plainLines?: boolean;
  /** Fixed grid; otherwise fitted around everything. */
  grid?: Rect;
  /** Cells the child has coloured (draw questions). */
  painted?: string[];
  /** The right cells after checking (draw questions). */
  rightCells?: string[];
  onCell?: (i: number, j: number) => void;
  /** Extra figures drawn as plain pictures (e.g. the other frames of a sequence). */
  others?: Figure[];
  /** Images drawn still, blue and hatched (e.g. where a slide ended). */
  images?: Figure[];
  /** A slide counted cell by cell from a point. */
  count?: { from: Pt; legs: Pt[] };
  /** Places marked with a "?" box. */
  blanks?: Rect[];
  imageName?: string;
  label?: string;
}

export function TransformScene(p: SceneProps) {
  const hatch = useId();
  const states = statesOf(p.figure, p.ops);
  const { done, t } = progress(p.ops, p.f);
  const pivots = [...(p.given ?? []), ...p.ops].filter((o) => o.kind === "rotate").map((o) => (o as Extract<Op, { kind: "rotate" }>).about);
  const grid =
    p.grid ??
    rectAround([...states, ...(p.others ?? []), ...(p.images ?? [])], [...pivots, ...(p.blanks ?? []).flatMap((b): Pt[] => [[b.x0, b.y0], [b.x1, b.y1]])]);
  // A water line wants some water under it.
  const box = { ...grid };
  const view: [number, number, number, number] = [box.x0 - 0.3, -box.y1 - 0.3, box.x1 - box.x0 + 0.6, box.y1 - box.y0 + 0.6];

  const active = p.ops.length ? (p.f > 0 ? done : -1) : -1;
  const shownOps = (p.given ?? []).concat(p.guides ? p.ops.filter((_, i) => i <= active) : []);
  const current = p.ops[done];

  let linkPairs: [Pt, Pt][] = [];
  if (p.links && current && p.f > 0) {
    const from = states[done];
    const pts = from.mark ? [from.mark.at, ...from.cells.filter((c) => c !== from.mark!.at)] : from.cells;
    linkPairs = pts.map((c): [Pt, Pt] => [c, applyOp(current, c)]);
  }

  const cellAt = (i: number, j: number) => `${i},${j}`;
  const painted = new Set(p.painted ?? []);
  const right = p.rightCells ? new Set(p.rightCells) : null;

  return (
    <Board view={view} imageName={p.imageName ?? "transforms"} label={p.label}>
      <Hatch id={hatch} />
      <GridG {...box} />

      {shownOps.map((o, i) => o.kind === "reflect" && <LineG key={`l${i}`} line={o.line} box={box} look={lineLook(o, !!p.plainLines)} />)}

      {(p.blanks ?? []).map((b, i) => (
        <g key={`b${i}`}>
          <rect x={b.x0} y={-b.y1} width={b.x1 - b.x0} height={b.y1 - b.y0} fill="#ffffff" stroke={INK} strokeWidth={0.06} strokeDasharray="0.2 0.15" rx={0.2} />
          <text x={(b.x0 + b.x1) / 2} y={-(b.y0 + b.y1) / 2} fontSize={1.4} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} style={{ fontFamily: "Vazirmatn, sans-serif" }}>
            ؟
          </text>
        </g>
      ))}

      {/* Painted cells (draw questions): solid with a dot, so they read without colour. */}
      {[...new Set([...painted, ...(right ?? [])])].map((key) => {
        const [i, j] = key.split(",").map(Number);
        const mine = painted.has(key);
        const ok = right?.has(key);
        return (
          <g key={`c${key}`}>
            {mine && <rect x={i} y={-(j + 1)} width={1} height={1} fill="#8fb8ff" stroke={INK} strokeWidth={0.06} />}
            {mine && <rect x={i} y={-(j + 1)} width={1} height={1} fill={`url(#${hatch})`} />}
            {right && ok && <rect x={i + 0.12} y={-(j + 0.88)} width={0.76} height={0.76} fill="none" stroke="#1d8a55" strokeWidth={0.1} strokeDasharray={mine ? undefined : "0.15 0.1"} />}
            {right && mine && !ok && (
              <text x={i + 0.5} y={-(j + 0.5)} fontSize={0.7} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
                ✗
              </text>
            )}
          </g>
        );
      })}

      {(p.others ?? []).map((o, i) => (
        <FigureG key={`o${i}`} fig={o} look="figure" />
      ))}

      {(p.images ?? []).map((o, i) => (
        <FigureG key={`i${i}`} fig={o} look="image" hatchId={hatch} />
      ))}

      <FigureG fig={p.figure} look="figure" />

      {p.copy && p.f > 0 && (
        <>
          {states.slice(1, done + 1).map((s, i) => p.ops[i].kind !== "shift" && <FigureG key={`s${i}`} fig={s} look="ghost" />)}
          <LinksG pairs={linkPairs} />
          <FigureG fig={states[done]} partial={current ? { op: current, t } : undefined} look="image" hatchId={hatch} />
        </>
      )}

      {p.count && <CountPathG from={p.count.from} legs={p.count.legs} />}

      {/* Turning points on top, so a turning copy does not hide them. */}
      {shownOps.map((o, i) => o.kind === "rotate" && <PivotG key={`p${i}`} at={o.about} deg={o.deg} />)}

      {/* Step numbers under each finished image of a chain. */}
      {p.copy &&
        p.ops.filter((o) => o.kind !== "shift").length > 1 &&
        states.slice(1).map((s, i) => {
          if (p.ops[i].kind === "shift" || i > done || (i === done && t < 1)) return null;
          const n = p.ops.slice(0, i + 1).filter((o) => o.kind !== "shift").length;
          const b = bounds(s);
          return (
            <text key={`n${i}`} x={(b.minX + b.maxX) / 2} y={-b.minY + 0.55} fontSize={0.5} textAnchor="middle" fill={INK} style={{ fontFamily: "Vazirmatn, sans-serif" }}>
              {fa(n)}
            </text>
          );
        })}

      {p.onCell &&
        Array.from({ length: (box.x1 - box.x0) * (box.y1 - box.y0) }, (_, k) => {
          const i = box.x0 + (k % (box.x1 - box.x0));
          const j = box.y0 + Math.floor(k / (box.x1 - box.x0));
          return (
            <rect
              key={`t${k}`}
              x={i}
              y={-(j + 1)}
              width={1}
              height={1}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onClick={() => p.onCell!(i, j)}
              aria-label={cellAt(i, j)}
            />
          );
        }) as ReactNode}
    </Board>
  );
}

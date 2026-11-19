"use client";

// Drawing figures. Model coordinates have y up; SVG has y down, so a model
// point (x, y) is drawn at (x, −y). One model unit is one grid cell.
// The figure is yellow and solid; its image is blue and hatched, so the two
// differ without colour.

import { useId } from "react";
import { bounds, mul, opAt, type Figure, type Line, type Mat, type Op, type Pt } from "@/generators/transforms";
import { fa } from "@/tools/registry";
import styles from "./Pictures.module.css";

export const INK = "#1f2430";
const FILL = { figure: "#ffc93d", image: "#8fb8ff", plain: "#cfe0ff", ghost: "none" } as const;
export type FigureStyle = keyof typeof FILL;

/** Every move from a list, done by `f` (0 … 1, spread evenly over the moves). */
export function progress(ops: Op[], f: number): { done: number; t: number } {
  if (!ops.length) return { done: 0, t: 0 };
  const x = Math.min(ops.length, Math.max(0, f * ops.length));
  const done = Math.min(ops.length - 1, Math.floor(x));
  return { done, t: x - done };
}

/** SVG matrix() for a model matrix, flipped into y-down screen coordinates. */
const svgMatrix = (m: Mat, [x, y]: Pt) => `matrix(${m[0]} ${-m[2]} ${-m[1]} ${m[3]} ${x} ${-y})`;

interface FigureGProps {
  fig: Figure;
  /** A move still under way, applied on top of `fig`. */
  partial?: { op: Op; t: number };
  look?: FigureStyle;
  hatchId?: string;
}

/** A figure inside a board (model units). */
export function FigureG({ fig, partial, look = "figure", hatchId }: FigureGProps) {
  const { m, v } = partial ? opAt(partial.op, partial.t) : { m: [1, 0, 0, 1] as Mat, v: [0, 0] as Pt };
  const tp = ([x, y]: Pt): Pt => [m[0] * x + m[1] * y + v[0], m[2] * x + m[3] * y + v[1]];
  const corner = ([cx, cy]: Pt) =>
    [
      [cx - 0.5, cy - 0.5],
      [cx + 0.5, cy - 0.5],
      [cx + 0.5, cy + 0.5],
      [cx - 0.5, cy + 0.5],
    ]
      .map((p) => tp(p as Pt))
      .map(([x, y]) => `${x},${-y}`)
      .join(" ");
  const dashed = look === "ghost";
  return (
    <g strokeLinejoin="round">
      {fig.cells.map((c) => (
        <polygon key={`${c[0]},${c[1]}`} points={corner(c)} fill={FILL[look]} stroke={INK} strokeWidth={dashed ? 0.05 : 0.07} strokeDasharray={dashed ? "0.15 0.12" : undefined} />
      ))}
      {look === "image" &&
        hatchId &&
        fig.cells.map((c) => <polygon key={`h${c[0]},${c[1]}`} points={corner(c)} fill={`url(#${hatchId})`} stroke="none" />)}
      {fig.mark && (
        <text
          opacity={dashed ? 0.45 : 1}
          transform={svgMatrix(mul(m, fig.mark.m), tp(fig.mark.at))}
          fontSize={0.78}
          fontWeight={700}
          textAnchor="middle"
          dominantBaseline="central"
          fill={INK}
          style={{ fontFamily: "Vazirmatn, sans-serif" }}
        >
          {fig.mark.symbol}
        </text>
      )}
    </g>
  );
}

/** Diagonal stripes for images. Put one per SVG and pass its id. */
export function Hatch({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={id} width={0.35} height={0.35} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1={0} y1={0} x2={0} y2={0.35} stroke={INK} strokeWidth={0.06} strokeOpacity={0.45} />
      </pattern>
    </defs>
  );
}

/** Grid lines over a model rectangle. */
export function GridG({ x0, y0, x1, y1 }: { x0: number; y0: number; x1: number; y1: number }) {
  const v = [];
  for (let x = x0; x <= x1; x++) v.push(<line key={`v${x}`} x1={x} y1={-y0} x2={x} y2={-y1} />);
  for (let y = y0; y <= y1; y++) v.push(<line key={`h${y}`} x1={x0} y1={-y} x2={x1} y2={-y} />);
  return (
    <g stroke="#d9cfbc" strokeWidth={0.035}>
      <rect x={x0} y={-y1} width={x1 - x0} height={y1 - y0} fill="#fffaf0" stroke="none" />
      {v}
    </g>
  );
}

/** A mirror (ticks on its back), the water line (waves) or a plain dashed line, across a rectangle. */
export function LineG({ line, box, look }: { line: Line; box: { x0: number; y0: number; x1: number; y1: number }; look: "mirror" | "water" | "plain" }) {
  const { x0, y0, x1, y1 } = box;
  if (line.kind === "v") {
    const x = line.c;
    return (
      <g>
        <line x1={x} y1={-y0} x2={x} y2={-y1} stroke={look === "mirror" ? "#3d6fb6" : INK} strokeWidth={look === "mirror" ? 0.16 : 0.09} strokeDasharray={look === "plain" ? "0.3 0.2" : undefined} />
        {look === "mirror" &&
          Array.from({ length: Math.floor(y1 - y0) * 2 }, (_, i) => (
            <line key={i} x1={x + 0.08} y1={-(y0 + i * 0.5 + 0.1)} x2={x + 0.32} y2={-(y0 + i * 0.5 + 0.3)} stroke="#3d6fb6" strokeWidth={0.05} />
          ))}
      </g>
    );
  }
  if (line.kind === "h") {
    const y = line.c;
    if (look === "water") {
      let d = `M${x0},${-y}`;
      for (let x = x0; x < x1; x += 0.5) d += ` q0.125,-0.15 0.25,0 t0.25,0`;
      return (
        <g>
          <rect x={x0} y={-y} width={x1 - x0} height={y - y0} fill="#dcecff" opacity={0.55} />
          <path d={d} fill="none" stroke="#3d7bf7" strokeWidth={0.09} />
        </g>
      );
    }
    return <line x1={x0} y1={-y} x2={x1} y2={-y} stroke={INK} strokeWidth={0.09} strokeDasharray="0.3 0.2" />;
  }
  // Slanted: y − x = c or x + y = c, clipped to the box.
  const pts: Pt[] =
    line.kind === "d"
      ? [
          [Math.max(x0, y0 - line.c), Math.max(x0, y0 - line.c) + line.c],
          [Math.min(x1, y1 - line.c), Math.min(x1, y1 - line.c) + line.c],
        ]
      : [
          [Math.max(x0, line.c - y1), line.c - Math.max(x0, line.c - y1)],
          [Math.min(x1, line.c - y0), line.c - Math.min(x1, line.c - y0)],
        ];
  return <line x1={pts[0][0]} y1={-pts[0][1]} x2={pts[1][0]} y2={-pts[1][1]} stroke={INK} strokeWidth={0.09} strokeDasharray="0.3 0.2" />;
}

/** The point a figure turns about, with a curved arrow showing the direction. */
export function PivotG({ at, deg }: { at: Pt; deg?: number }) {
  const [x, y] = at;
  const cw = (deg ?? 90) > 0;
  const r = 0.9;
  const sweep = Math.min(150, Math.abs(deg ?? 90)) * (Math.PI / 180);
  const a0 = -Math.PI / 2;
  const p0: Pt = [x + r * Math.cos(a0), -y + r * Math.sin(a0)];
  const a1 = a0 + (cw ? sweep : -sweep);
  const p1: Pt = [x + r * Math.cos(a1), -y + r * Math.sin(a1)];
  const id = useId();
  return (
    <g>
      <defs>
        <marker id={id} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#e5484d" />
        </marker>
      </defs>
      {deg !== undefined && (
        <path
          d={`M${p0[0]},${p0[1]} A${r},${r} 0 0 ${cw ? 1 : 0} ${p1[0]},${p1[1]}`}
          fill="none"
          stroke="#e5484d"
          strokeWidth={0.08}
          markerEnd={`url(#${id})`}
        />
      )}
      <circle cx={x} cy={-y} r={0.18} fill="#e5484d" stroke="#fff" strokeWidth={0.05} />
    </g>
  );
}

/**
 * A slide counted cell by cell: an arrow from one cell's centre along each
 * part of the slide, with the count (۱، ۲، …) on every cell it lands on.
 * Each part starts counting again, as in «۳ خانه به راست، ۲ خانه به بالا».
 */
export function CountPathG({ from, legs }: { from: Pt; legs: Pt[] }) {
  const id = useId();
  const pts: Pt[] = [from];
  const marks: { at: Pt; n: number }[] = [];
  for (const [dx, dy] of legs) {
    const [x, y] = pts[pts.length - 1];
    const k = Math.abs(dx) + Math.abs(dy);
    for (let i = 1; i <= k; i++) marks.push({ at: [x + (Math.sign(dx) * i) || 0, y + (Math.sign(dy) * i) || 0], n: i });
    pts.push([x + dx, y + dy]);
  }
  if (pts.length < 2) return null;
  return (
    <g pointerEvents="none">
      <defs>
        <marker id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="3.5" markerHeight="3.5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#d9480f" />
        </marker>
      </defs>
      <circle cx={from[0]} cy={-from[1]} r={0.13} fill="#d9480f" />
      <polyline points={pts.map(([x, y]) => `${x},${-y}`).join(" ")} fill="none" stroke="#d9480f" strokeWidth={0.08} strokeLinejoin="round" markerEnd={`url(#${id})`} />
      {marks.map(({ at: [x, y], n }, i) => (
        <g key={i}>
          <circle cx={x} cy={-y} r={0.21} fill="#ffffff" stroke="#d9480f" strokeWidth={0.04} />
          <text x={x} y={-y} fontSize={0.28} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} style={{ fontFamily: "Vazirmatn, sans-serif" }}>
            {fa(n)}
          </text>
        </g>
      ))}
    </g>
  );
}

/** Where a slide is counted from: the lettered cell, or the lowest, then leftmost, cell. */
export function countFrom(f: Figure): Pt {
  if (f.mark) return f.mark.at;
  return [...f.cells].sort((a, b) => a[1] - b[1] || a[0] - b[0])[0];
}

/** Dashed links from points to their images. */
export function LinksG({ pairs }: { pairs: [Pt, Pt][] }) {
  return (
    <g stroke="#3d7bf7" strokeWidth={0.06} strokeDasharray="0.12 0.14" strokeLinecap="round">
      {pairs.map(([a, b], i) => (
        <line key={i} x1={a[0]} y1={-a[1]} x2={b[0]} y2={-b[1]} />
      ))}
    </g>
  );
}

/** One figure on its own small grid, for options and worksheets. `box` keeps cells the same size across options. */
export function FigureSvg({ fig, box, size = 96, look = "plain", label }: { fig: Figure; box: number; size?: number; look?: FigureStyle; label?: string }) {
  const b = bounds(fig);
  const ox = b.minX - (box - (b.maxX - b.minX)) / 2;
  const oy = b.minY - (box - (b.maxY - b.minY)) / 2;
  const hatch = useId();
  return (
    <svg className={styles.svg} width={size} height={size} viewBox={`${ox - 0.2} ${-(oy + box) - 0.2} ${box + 0.4} ${box + 0.4}`} role="img" aria-label={label}>
      <Hatch id={hatch} />
      <GridG x0={Math.floor(ox)} y0={Math.floor(oy)} x1={Math.ceil(ox + box)} y1={Math.ceil(oy + box)} />
      <FigureG fig={fig} look={look} hatchId={hatch} />
    </svg>
  );
}

/** Side length that fits every figure in a list. */
export const boxFor = (figs: Figure[]) =>
  Math.max(3, ...figs.map((f) => {
    const b = bounds(f);
    return Math.max(b.maxX - b.minX, b.maxY - b.minY);
  })) + 1;

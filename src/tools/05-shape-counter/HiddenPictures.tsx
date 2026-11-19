"use client";

// Drawing a hidden-figure drawing (lines on a lattice, doubled units, y up)
// and shapes placed on it. A found shape is hatched with a solid outline; a
// look-alike (turned, flipped, other size) has a dashed outline and a word
// label; a side that is not on the lines is a thick dashed red line. So none
// of it is told by colour alone.

import { useId } from "react";
import { sidesOf, type HPt, type HSeg } from "@/generators/hidden-figure";
import { INK, type Frame } from "./Pictures";

const FONT = { fontFamily: "Vazirmatn, sans-serif" } as const;

export type MarkLook = "found" | "slip" | "trace";

export interface Mark {
  poly: HPt[];
  look: MarkLook;
  /** Sides (by index) that are not on the drawing's lines. */
  missing?: number[];
  label?: string;
}

/** Maps doubled lattice units (0 … 2n, y up) into a square box. */
export const latticeMap = (n: number, f: Frame) => {
  const s = f.w / (2 * n);
  return ([x, y]: HPt): HPt => [f.x + x * s, f.y + (2 * n - y) * s];
};

const TINT: Record<MarkLook, string> = { found: "#ffb547", slip: "#c7d7f5", trace: "#b9e4c9" };

interface Props {
  segs: HSeg[];
  n: number;
  frame: Frame;
  marks?: Mark[];
  /** Faint dots on the drawing points (for exploring). */
  dots?: boolean;
  /** Tap on the drawing, in lattice units (not snapped). */
  onPoint?: (p: HPt) => void;
}

export function HiddenDrawingG({ segs, n, frame, marks = [], dots, onPoint }: Props) {
  const hatch = useId();
  const map = latticeMap(n, frame);
  const s = frame.w / (2 * n);

  const tap = (e: React.PointerEvent<SVGRectElement>) => {
    const ctm = e.currentTarget.ownerSVGElement?.getScreenCTM();
    if (!ctm || !onPoint) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    onPoint([(p.x - frame.x) / s, 2 * n - (p.y - frame.y) / s]);
  };

  return (
    <g>
      <defs>
        <pattern id={hatch} width={s * 0.5} height={s * 0.5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={s * 0.5} stroke={INK} strokeWidth={s * 0.08} opacity={0.5} />
        </pattern>
      </defs>
      <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} fill="#fff" stroke="#c9bfae" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {dots &&
        Array.from({ length: (n + 1) * (n + 1) }, (_, k) => {
          const [x, y] = map([2 * (k % (n + 1)), 2 * Math.floor(k / (n + 1))]);
          return <circle key={`g${k}`} cx={x} cy={y} r={s * 0.07} fill="#a89f90" />;
        })}

      {marks.map((m, k) => {
        const pts = m.poly.map(map);
        const str = pts.map((p) => p.join(",")).join(" ");
        return (
          <g key={`m${k}`}>
            <polygon points={str} fill={TINT[m.look]} opacity={0.7} />
            {m.look !== "slip" && <polygon points={str} fill={`url(#${hatch})`} />}
          </g>
        );
      })}

      {segs.map(([a, b], i) => {
        const [p, q] = [map(a), map(b)];
        return <line key={`l${i}`} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={INK} strokeWidth={2.2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />;
      })}

      {marks.map((m, k) => {
        const pts = m.poly.map(map);
        const str = pts.map((p) => p.join(",")).join(" ");
        const sides = sidesOf(m.poly);
        const c = pts.reduce<HPt>((acc, p) => [acc[0] + p[0] / pts.length, acc[1] + p[1] / pts.length], [0, 0]);
        return (
          <g key={`o${k}`}>
            <polygon points={str} fill="none" stroke={m.look === "found" ? INK : "#1f4fa3"} strokeWidth={m.look === "found" ? 4 : 3} strokeDasharray={m.look === "slip" ? "9 5" : undefined} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {(m.missing ?? []).map((i) => {
              const [p, q] = sides[i].map(map);
              return <line key={`x${i}`} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="#b3261e" strokeWidth={5} strokeDasharray="4 5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />;
            })}
            {m.label && (
              <g>
                <rect x={c[0] - s * 1.4} y={c[1] - s * 0.42} width={s * 2.8} height={s * 0.84} rx={s * 0.2} fill="#fff" stroke={INK} strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.95} />
                <text x={c[0]} y={c[1]} fontSize={s * 0.55} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} style={FONT}>
                  {m.label}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {onPoint && <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} fill="transparent" style={{ cursor: "pointer" }} onPointerDown={tap} />}
    </g>
  );
}

/** Box width that holds a shape drawn at `scale` (screen units per doubled unit), with a margin. */
export const cardWidth = (shape: HPt[], scale: number) => (Math.max(...shape.flat()) + 2) * scale;

/** The given shape in a dashed box of width w, at `scale` (default: the scale of a drawing of size n in a box of width w). */
export function ShapeCardG({ shape, n, x, y, w, scale }: { shape: HPt[]; n: number; x: number; y: number; w: number; scale?: number }) {
  const hatch = useId();
  const s = scale ?? w / (2 * n);
  const xs = shape.map((p) => p[0]);
  const ys = shape.map((p) => p[1]);
  const [bw, bh] = [Math.max(...xs) * s, Math.max(...ys) * s];
  const ox = x + (w - bw) / 2;
  const oy = y + (w - bh) / 2;
  const pts = shape.map(([px, py]) => [ox + px * s, oy + bh - py * s].join(",")).join(" ");
  return (
    <g>
      <defs>
        <pattern id={hatch} width={s * 0.5} height={s * 0.5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={s * 0.5} stroke={INK} strokeWidth={s * 0.08} opacity={0.5} />
        </pattern>
      </defs>
      <rect x={x} y={y} width={w} height={w} fill="#fffdf6" stroke={INK} strokeWidth={2} strokeDasharray="7 5" rx={w * 0.04} vectorEffect="non-scaling-stroke" />
      <polygon points={pts} fill="#ffb547" opacity={0.6} />
      <polygon points={pts} fill={`url(#${hatch})`} />
      <polygon points={pts} fill="none" stroke={INK} strokeWidth={3} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </g>
  );
}

/** Small standalone drawing or shape (worksheets). */
export function HiddenSvg({ segs, shape, n, size }: { segs?: HSeg[]; shape?: HPt[]; n: number; size: number }) {
  const pad = size * 0.04;
  return (
    <svg width={size + 2 * pad} height={size + 2 * pad} viewBox={`${-pad} ${-pad} ${size + 2 * pad} ${size + 2 * pad}`} style={{ direction: "ltr" }}>
      {segs && <HiddenDrawingG segs={segs} n={n} frame={{ x: 0, y: 0, w: size, h: size }} />}
      {shape && <ShapeCardG shape={shape} n={n} x={0} y={0} w={size} />}
    </svg>
  );
}

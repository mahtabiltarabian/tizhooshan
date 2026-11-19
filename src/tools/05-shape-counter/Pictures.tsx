"use client";

// Drawing a counting figure inside a box, and the shapes found in it. Model
// points have y up; they are mapped into the box in screen units (y down).
// A highlighted shape is hatched as well as tinted, so it reads without colour.

import { useId } from "react";
import { centroid, type CountFigure, type Pt, type Shape } from "@/generators/shape-count";
import { fa } from "@/tools/registry";

export const INK = "#1f2430";

/** A screen box to draw a figure in. */
export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Maps model points into a box, keeping proportions, centred. */
export function fitter(fig: CountFigure, f: Frame) {
  const xs = fig.pts.map((p) => p[0]);
  const ys = fig.pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const s = Math.min(f.w / Math.max(x1 - x0, 1e-6), f.h / Math.max(y1 - y0, 1e-6));
  const [cx, cy] = [f.x + f.w / 2, f.y + f.h / 2];
  return (p: Pt): Pt => [cx + (p[0] - (x0 + x1) / 2) * s, cy - (p[1] - (y0 + y1) / 2) * s];
}

/** Box of the right shape for a figure, `size` on its longer side. */
export function frameFor(fig: CountFigure, size: number, x = 0, y = 0): Frame {
  const xs = fig.pts.map((p) => p[0]);
  const ys = fig.pts.map((p) => p[1]);
  const [w, h] = [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
  const s = size / Math.max(w, h, 1e-6);
  // A straight line of points still needs some height.
  return { x, y, w: Math.max(w * s, size * 0.05), h: Math.max(h * s, size * 0.05) };
}

export type Look = "current" | "found" | "missed";

const TINT: Record<Look, string> = { current: "#ffb547", found: "#8fb8ff", missed: "#ffb547" };

interface Props {
  fig: CountFigure;
  frame: Frame;
  shapes?: { shape: Shape; look: Look; label?: number }[];
  /** Tapped points, in order. */
  selected?: number[];
  onPoint?: (i: number) => void;
  /** Mark the corner of the rays with "O". */
  origin?: boolean;
}

export function CountFigureG({ fig, frame, shapes = [], selected = [], onPoint, origin }: Props) {
  const hatch = useId();
  const map = fitter(fig, frame);
  const P = fig.pts.map(map);
  const size = Math.max(frame.w, frame.h);
  const dot = size * 0.014;
  const font = size * 0.06;

  const angleWedge = (s: Shape) => {
    const [a, o, b] = s.pts.map((i) => fig.pts[i]);
    const r = Math.min(Math.hypot(a[0] - o[0], a[1] - o[1]), Math.hypot(b[0] - o[0], b[1] - o[1])) * 0.45;
    const t0 = Math.atan2(a[1] - o[1], a[0] - o[0]);
    const t1 = Math.atan2(b[1] - o[1], b[0] - o[0]);
    const arc = Array.from({ length: 25 }, (_, k) => {
      const t = t0 + ((t1 - t0) * k) / 24;
      return map([o[0] + r * Math.cos(t), o[1] + r * Math.sin(t)]);
    });
    return [map(o), ...arc];
  };

  return (
    <g>
      <defs>
        <pattern id={hatch} width={size * 0.03} height={size * 0.03} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={size * 0.03} stroke={INK} strokeWidth={size * 0.006} opacity={0.55} />
        </pattern>
      </defs>

      {shapes.map(({ shape: s, look }, k) => {
        const strong = look !== "found";
        if (s.kind === "segment") {
          const [a, b] = s.pts.map((i) => P[i]);
          return (
            <line
              key={k}
              x1={a[0]}
              y1={a[1]}
              x2={b[0]}
              y2={b[1]}
              stroke={strong ? "#e07a00" : "#3d7be0"}
              strokeWidth={strong ? 9 : 5}
              strokeLinecap="round"
              strokeDasharray={look === "found" ? "2 9" : undefined}
              opacity={strong ? 0.85 : 0.6}
              vectorEffect="non-scaling-stroke"
            />
          );
        }
        const poly = s.kind === "angle" ? angleWedge(s) : s.pts.map((i) => P[i]);
        const pts = poly.map((p) => p.join(",")).join(" ");
        return (
          <g key={k}>
            <polygon points={pts} fill={TINT[look]} opacity={strong ? 0.75 : 0.22} />
            {strong && <polygon points={pts} fill={`url(#${hatch})`} />}
            {strong && (
              <polygon
                points={pts}
                fill="none"
                stroke={look === "missed" ? "#b3261e" : INK}
                strokeWidth={look === "missed" ? 4 : 3}
                strokeDasharray={look === "missed" ? "8 5" : undefined}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </g>
        );
      })}

      {fig.lines.map((l, i) => {
        const [a, b] = [P[l[0]], P[l[l.length - 1]]];
        return <line key={`l${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={INK} strokeWidth={2.2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />;
      })}

      {P.map((p, i) => (
        <circle key={`p${i}`} cx={p[0]} cy={p[1]} r={dot} fill={INK} />
      ))}

      {origin && fig.origin !== undefined && (
        <text x={P[fig.origin][0]} y={P[fig.origin][1] + font * 1.1} fontSize={font} fontWeight={700} textAnchor="middle" fill={INK} style={{ fontFamily: "Vazirmatn, sans-serif" }}>
          O
        </text>
      )}

      {/* Numbers of labelled shapes, on a white disc so they stay readable. */}
      {shapes.map(({ shape: s, label }, k) => {
        if (label === undefined) return null;
        const c = s.kind === "angle" ? centroid(angleWedge(s)) : centroid(s.pts.map((i) => P[i]));
        return (
          <g key={`n${k}`}>
            <circle cx={c[0]} cy={c[1]} r={font * 0.75} fill="#fff" stroke={INK} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            <text x={c[0]} y={c[1]} fontSize={font} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} style={{ fontFamily: "Vazirmatn, sans-serif" }}>
              {fa(label)}
            </text>
          </g>
        );
      })}

      {selected.map((i, k) => (
        <g key={`s${k}`}>
          <circle cx={P[i][0]} cy={P[i][1]} r={dot * 3} fill="#fff" stroke="#b3261e" strokeWidth={3} vectorEffect="non-scaling-stroke" />
          <text x={P[i][0]} y={P[i][1]} fontSize={font * 0.7} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill="#b3261e" style={{ fontFamily: "Vazirmatn, sans-serif" }}>
            {fa(k + 1)}
          </text>
        </g>
      ))}

      {onPoint &&
        P.map((p, i) => (
          <circle key={`t${i}`} cx={p[0]} cy={p[1]} r={dot * 4.5} fill="transparent" style={{ cursor: "pointer" }} onClick={() => onPoint(i)} aria-label={`نقطه ${fa(i + 1)}`} />
        ))}
    </g>
  );
}

/** A small standalone picture of a figure (worksheets, side panel). */
export function CountFigureSvg({ fig, size, shapes, origin }: { fig: CountFigure; size: number; shapes?: Props["shapes"]; origin?: boolean }) {
  const f = frameFor(fig, size);
  const pad = size * 0.08;
  return (
    <svg width={f.w + 2 * pad} height={f.h + 2 * pad} viewBox={`${-pad} ${-pad} ${f.w + 2 * pad} ${f.h + 2 * pad}`} style={{ direction: "ltr" }}>
      <CountFigureG fig={fig} frame={f} shapes={shapes} origin={origin} />
    </svg>
  );
}

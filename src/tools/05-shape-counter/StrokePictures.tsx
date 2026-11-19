"use client";

// Drawing a one-stroke figure. Points can show their degree (how many line
// ends meet there): an even point is a circle, an odd point a square, so odd
// and even differ by shape and not only by colour. Drawn lines of a stroke
// are thick, with their order number on them. Taps are mapped with
// getScreenCTM to the nearest point, so each point has a big target on phones.

import { degrees, type SPt, type StrokeFigure } from "@/generators/one-stroke";
import { fa } from "@/tools/registry";
import { INK, type Frame } from "./Pictures";

export const STROKE = "#d9480f";
const ODD_FILL = "#ffd8a8";
const EVEN_FILL = "#ffffff";
const FONT = { fontFamily: "Vazirmatn, sans-serif" } as const;

/** Maps points (y up) into a box, keeping proportions, centred. */
export function fitPts(pts: SPt[], f: Frame) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const s = Math.min(f.w / Math.max(x1 - x0, 1e-6), f.h / Math.max(y1 - y0, 1e-6));
  const [cx, cy] = [f.x + f.w / 2, f.y + f.h / 2];
  return (p: SPt): SPt => [cx + (p[0] - (x0 + x1) / 2) * s, cy - (p[1] - (y0 + y1) / 2) * s];
}

/** Smallest screen gap between two points, as a share of the box. */
const minGap = (P: SPt[]) => {
  let m = Infinity;
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) m = Math.min(m, Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]));
  return m;
};

/** A spot next to point i, in the middle of the widest gap between its lines. */
function labelSpot(P: SPt[], fig: StrokeFigure, i: number, dist: number): SPt {
  const angles = fig.edges
    .filter((e) => e.includes(i))
    .map(([a, b]) => {
      const w = a === i ? b : a;
      return Math.atan2(P[w][1] - P[i][1], P[w][0] - P[i][0]);
    })
    .sort((a, b) => a - b);
  let dir = -Math.PI / 2;
  if (angles.length) {
    let best = -1;
    angles.forEach((t, k) => {
      const next = k + 1 < angles.length ? angles[k + 1] : angles[0] + 2 * Math.PI;
      if (next - t > best) [best, dir] = [next - t, (t + next) / 2];
    });
  }
  // A wide label sits further out when it points sideways.
  const side = Math.abs(Math.cos(dir));
  return [P[i][0] + Math.cos(dir) * dist * (1 + side * 0.4), P[i][1] + Math.sin(dir) * dist];
}

export interface StrokeProps {
  fig: StrokeFigure;
  frame: Frame;
  /** Show each point's degree (circle = even, square = odd). */
  showDegrees?: boolean;
  /** Only these points show their degree (others plain), when given. */
  degreeOf?: number[];
  /** Lines of the stroke, in drawing order (indices into fig.edges). */
  drawn?: number[];
  /** A thin highlight on these lines (e.g. the lines of the point being counted). */
  lit?: number[];
  /** Letter names next to points. */
  names?: Map<number, string>;
  /** Ring around a point (the pen, or the point being counted). */
  ring?: number | null;
  /** Point marked with the word "start". */
  start?: number | null;
  onPoint?: (i: number) => void;
}

export function StrokeFigureG({ fig, frame, showDegrees, degreeOf, drawn = [], lit = [], names, ring = null, start = null, onPoint }: StrokeProps) {
  const map = fitPts(fig.pts, frame);
  const P = fig.pts.map(map);
  const size = Math.max(frame.w, frame.h);
  const gap = Math.min(minGap(P), size * 0.35);
  const r = Math.min(gap * 0.28, size * 0.055);
  const deg = degrees(fig);
  const order = new Map(drawn.map((e, k) => [e, k]));
  const shown = (i: number) => showDegrees && (!degreeOf || degreeOf.includes(i));

  const pick = (e: React.PointerEvent<SVGRectElement>) => {
    if (!onPoint) return;
    const ctm = e.currentTarget.ownerSVGElement?.getScreenCTM();
    if (!ctm) return;
    // Distance on screen, in pixels, to each point.
    let best = -1;
    let bestD = Infinity;
    P.forEach((p, i) => {
      if (!deg[i]) return;
      const s = new DOMPoint(p[0], p[1]).matrixTransform(ctm);
      const d = Math.hypot(s.x - e.clientX, s.y - e.clientY);
      if (d < bestD) [best, bestD] = [i, d];
    });
    const screenGap = gap * Math.hypot(ctm.a, ctm.b);
    // At least 24 px around each point (a 48 px target), less only when points are closer than that.
    if (best >= 0 && bestD <= Math.max(24, screenGap * 0.5)) onPoint(best);
  };

  return (
    <g>
      {fig.edges.map(([a, b], e) => (
        <line key={`l${e}`} x1={P[a][0]} y1={P[a][1]} x2={P[b][0]} y2={P[b][1]} stroke={INK} strokeWidth={2.4} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      ))}
      {lit.map((e) => {
        const [a, b] = fig.edges[e];
        return <line key={`h${e}`} x1={P[a][0]} y1={P[a][1]} x2={P[b][0]} y2={P[b][1]} stroke="#3d7be0" strokeWidth={7} strokeDasharray="3 6" strokeLinecap="round" opacity={0.8} vectorEffect="non-scaling-stroke" />;
      })}
      {drawn.map((e) => {
        const [a, b] = fig.edges[e];
        return <line key={`d${e}`} x1={P[a][0]} y1={P[a][1]} x2={P[b][0]} y2={P[b][1]} stroke={STROKE} strokeWidth={8} strokeLinecap="round" opacity={0.85} vectorEffect="non-scaling-stroke" />;
      })}
      {/* Order of the drawn lines, on a white disc at the middle of each. */}
      {drawn.map((e) => {
        const [a, b] = fig.edges[e];
        const [mx, my] = [(P[a][0] + P[b][0]) / 2, (P[a][1] + P[b][1]) / 2];
        return (
          <g key={`n${e}`}>
            <circle cx={mx} cy={my} r={r * 0.75} fill="#fff" stroke={STROKE} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            <text x={mx} y={my} fontSize={r * 0.95} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} style={FONT}>
              {fa(order.get(e)! + 1)}
            </text>
          </g>
        );
      })}

      {P.map((p, i) => {
        if (!deg[i]) return null;
        const odd = deg[i] % 2 === 1;
        if (!shown(i)) return <circle key={`p${i}`} cx={p[0]} cy={p[1]} r={r * 0.32} fill={INK} />;
        return (
          <g key={`p${i}`}>
            {odd ? (
              <rect x={p[0] - r} y={p[1] - r} width={2 * r} height={2 * r} rx={r * 0.15} fill={ODD_FILL} stroke={INK} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
            ) : (
              <circle cx={p[0]} cy={p[1]} r={r} fill={EVEN_FILL} stroke={INK} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            )}
            <text x={p[0]} y={p[1]} fontSize={r * 1.2} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} style={FONT}>
              {fa(deg[i])}
            </text>
          </g>
        );
      })}

      {ring !== null && ring >= 0 && <circle cx={P[ring][0]} cy={P[ring][1]} r={r * 1.55} fill="none" stroke="#b3261e" strokeWidth={3.5} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />}

      {P.map((p, i) => {
        const text = [names?.get(i), start === i ? "شروع" : undefined].filter(Boolean).join(" · ");
        if (!text) return null;
        const [x, y] = labelSpot(P, fig, i, r * 2.7);
        const w = r * (1 + 0.62 * text.length);
        return (
          <g key={`a${i}`}>
            <rect x={x - w / 2} y={y - r * 0.85} width={w} height={r * 1.7} rx={r * 0.4} fill="#fff" stroke={start === i ? "#b3261e" : INK} strokeWidth={start === i ? 2.5 : 1.5} vectorEffect="non-scaling-stroke" />
            <text x={x} y={y} fontSize={r * 1.05} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={start === i ? "#b3261e" : INK} style={FONT}>
              {text}
            </text>
          </g>
        );
      })}

      {onPoint && <rect x={frame.x - r * 2} y={frame.y - r * 2} width={frame.w + r * 4} height={frame.h + r * 4} fill="transparent" style={{ cursor: "pointer" }} onPointerDown={pick} />}
    </g>
  );
}

/** Box of the figure's shape, `size` on its longer side. */
export function strokeFrame(fig: StrokeFigure, size: number, x = 0, y = 0): Frame {
  const xs = fig.pts.map((p) => p[0]);
  const ys = fig.pts.map((p) => p[1]);
  const [w, h] = [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
  const s = size / Math.max(w, h, 1e-6);
  return { x, y, w: Math.max(w * s, size * 0.05), h: Math.max(h * s, size * 0.05) };
}

/** Small standalone picture (worksheets). */
export function StrokeSvg({ fig, size, ...rest }: { fig: StrokeFigure; size: number } & Omit<StrokeProps, "fig" | "frame">) {
  const f = strokeFrame(fig, size);
  const pad = size * 0.14;
  return (
    <svg width={f.w + 2 * pad} height={f.h + 2 * pad} viewBox={`${-pad} ${-pad} ${f.w + 2 * pad} ${f.h + 2 * pad}`} style={{ direction: "ltr" }}>
      <StrokeFigureG fig={fig} frame={f} {...rest} />
    </svg>
  );
}

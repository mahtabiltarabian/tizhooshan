"use client";

// Drawings for tool 16, in board units (one unit between neighbouring
// pegs; y grows downwards). The geoboard, rubber bands, counted squares,
// the bounding rectangle with its corner pieces, side lengths, angle marks,
// and angle figures that are not on the board (triangles, polygons).

import type { ReactNode } from "react";
import { anglePolygon, area2, boxOf, boxPieces, cellPiece, cornerAngles, edgesOf, squareCount, type Pt } from "@/generators/geometry";
import { fa } from "@/tools/registry";
import { approxDeg, num, type Overlay } from "./frames";

type F = [number, number];
export type View = [number, number, number, number];

const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
const INK = "#1f2430";
const MUTED = "#5b6170";
export const SHAPE = "#1c6dd0";
export const MINE = "#d9480f";
export const EXAMPLE = "#1d8a55";

/** Room round the pegs. */
export const PAD = 0.6;
export const boardView = (n: number, below = 0): View => [-PAD, -PAD, n - 1 + 2 * PAD, n - 1 + 2 * PAD + below];

const halo = { paintOrder: "stroke" as const, stroke: "#fffaf0", strokeWidth: 0.09, strokeLinejoin: "round" as const };

export function PegsG({ n, grid = false }: { n: number; grid?: boolean }) {
  const m = n - 1;
  return (
    <g>
      <rect x={-0.42} y={-0.42} width={m + 0.84} height={m + 0.84} rx={0.18} fill="#f7f0e2" stroke="#cfc6b6" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {grid &&
        Array.from({ length: n }, (_, i) => (
          <g key={i} stroke="#ddd2bf" strokeWidth={1} vectorEffect="non-scaling-stroke">
            <line x1={i} y1={0} x2={i} y2={m} vectorEffect="non-scaling-stroke" />
            <line x1={0} y1={i} x2={m} y2={i} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
      {Array.from({ length: n * n }, (_, k) => (
        <circle key={k} cx={k % n} cy={Math.floor(k / n)} r={0.075} fill="#6b5d4a" />
      ))}
    </g>
  );
}

/** A rubber band round pegs. Open bands (two arms, or one being built) are not filled. */
export function BandG({ pts, closed = true, color = SHAPE, dashed = false, fill, rings = true, width = 5 }: { pts: F[]; closed?: boolean; color?: string; dashed?: boolean; fill?: string; rings?: boolean; width?: number }) {
  if (!pts.length) return null;
  const d = pts.map((p) => `${r4(p[0])},${r4(p[1])}`).join(" ");
  const common = {
    points: d,
    stroke: color,
    strokeWidth: width,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
    strokeDasharray: dashed ? "10 7" : undefined,
    vectorEffect: "non-scaling-stroke" as const,
  };
  return (
    <g>
      {closed && pts.length > 2 ? <polygon {...common} fill={fill ?? color} fillOpacity={fill ? 1 : 0.12} /> : <polyline {...common} fill="none" />}
      {rings && pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={0.13} fill="#fffaf0" stroke={color} strokeWidth={3} vectorEffect="non-scaling-stroke" />)}
    </g>
  );
}

/** Counted squares: whole ones numbered with a slanted hatch, halves dotted with "½". */
export function CellsG({ poly, mode }: { poly: Pt[]; mode: "whole" | "all" }) {
  const { whole, half, other } = squareCount(poly);
  return (
    <g pointerEvents="none">
      {mode === "all" &&
        other.map((c, i) => (
          <polygon key={`o${i}`} points={cellPiece(poly, c.x, c.y).map((p) => `${r4(p[0])},${r4(p[1])}`).join(" ")} fill="#ece7df" stroke="#9a948a" strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
        ))}
      {whole.map((c, i) => (
        <g key={`w${i}`}>
          <rect x={c.x + 0.04} y={c.y + 0.04} width={0.92} height={0.92} fill="#cfe3fb" stroke="#7aa7d9" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <line x1={c.x + 0.1} y1={c.y + 0.9} x2={c.x + 0.35} y2={c.y + 0.65} stroke="#7aa7d9" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          <text x={c.x + 0.55} y={c.y + 0.5} fontSize={0.36} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
            {fa(i + 1)}
          </text>
        </g>
      ))}
      {mode === "all" &&
        half.map((c, i) => {
          const piece = cellPiece(poly, c.x, c.y);
          const cx = piece.reduce((s, p) => s + p[0], 0) / piece.length;
          const cy = piece.reduce((s, p) => s + p[1], 0) / piece.length;
          return (
            <g key={`h${i}`}>
              <polygon points={piece.map((p) => `${r4(p[0])},${r4(p[1])}`).join(" ")} fill="#ffe2b8" stroke="#c98a00" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
              {[0.25, 0.75].map((t) => (
                <circle key={t} cx={r4(cx + (t - 0.5) * 0.3)} cy={r4(cy + 0.2)} r={0.035} fill="#c98a00" />
              ))}
              <text x={r4(cx)} y={r4(cy - 0.04)} fontSize={0.26} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
                ½
              </text>
            </g>
          );
        })}
    </g>
  );
}

/** The bounding rectangle (dashed) and its first `upto` corner pieces, each with its area. */
export function BoxG({ poly, upto }: { poly: Pt[]; upto: number }) {
  const b = boxOf(poly);
  const pieces = boxPieces(poly) ?? [];
  return (
    <g pointerEvents="none">
      {pieces.slice(0, upto).map((p, i) => {
        const cx = (p.tri[0][0] + p.tri[1][0] + p.tri[2][0]) / 3;
        const cy = (p.tri[0][1] + p.tri[1][1] + p.tri[2][1]) / 3;
        return (
          <g key={i}>
            <polygon points={p.tri.map((q) => q.join(",")).join(" ")} fill="#f6d7bd" stroke="#b5651d" strokeWidth={2} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
            {[0.2, 0.4, 0.6, 0.8].map((t) => (
              <line
                key={t}
                x1={r4(p.tri[1][0] + (p.tri[0][0] - p.tri[1][0]) * t)}
                y1={r4(p.tri[1][1] + (p.tri[0][1] - p.tri[1][1]) * t)}
                x2={r4(p.tri[1][0] + (p.tri[2][0] - p.tri[1][0]) * t)}
                y2={r4(p.tri[1][1] + (p.tri[2][1] - p.tri[1][1]) * t)}
                stroke="#d9a47a"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <text x={r4(cx)} y={r4(cy)} fontSize={0.34} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} style={halo}>
              {num((p.a * p.b) / 2)}
            </text>
          </g>
        );
      })}
      <rect x={b.x0} y={b.y0} width={b.w} height={b.h} fill="none" stroke={INK} strokeWidth={2.5} strokeDasharray="8 6" vectorEffect="non-scaling-stroke" />
      <text x={b.x0 + b.w / 2} y={b.y0 - 0.28} fontSize={0.34} fontWeight={700} textAnchor="middle" fill={INK} style={halo}>
        {fa(b.w)}
      </text>
      <text x={b.x0 - 0.28} y={b.y0 + b.h / 2} fontSize={0.34} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} style={halo}>
        {fa(b.h)}
      </text>
    </g>
  );
}

/** Length of each side, outside the shape (sides along the grid). */
export function EdgeLabelsG({ poly }: { poly: Pt[] }) {
  const s = Math.sign(area2(poly));
  return (
    <g pointerEvents="none">
      {edgesOf(poly).map(([a, b], i) => {
        const len = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
        const [dx, dy] = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
        const [nx, ny] = [s * dy, -s * dx];
        return (
          <text key={i} x={r4((a[0] + b[0]) / 2 + nx * 0.3)} y={r4((a[1] + b[1]) / 2 + ny * 0.3)} fontSize={0.36} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} style={halo}>
            {fa(len)}
          </text>
        );
      })}
    </g>
  );
}

/** Points of an arc at corner v from arm u, sweeping `deg` towards direction `toward`. */
function arcPoints(v: F, u: F, deg: number, toward: F, r: number): F[] {
  const a0 = Math.atan2(u[1], u[0]);
  const sweep = (deg * Math.PI) / 180;
  const along = (sg: number) => Math.cos(a0 + (sg * sweep) / 2) * toward[0] + Math.sin(a0 + (sg * sweep) / 2) * toward[1];
  const sign = along(1) >= along(-1) ? 1 : -1;
  return Array.from({ length: 17 }, (_, k) => {
    const t = a0 + (sign * sweep * k) / 16;
    return [r4(v[0] + r * Math.cos(t)), r4(v[1] + r * Math.sin(t))] as F;
  });
}

const unit = (p: F): F => {
  const l = Math.hypot(p[0], p[1]) || 1;
  return [p[0] / l, p[1] / l];
};

/** One angle mark: an arc (or a small square for 90°) and its label. */
export function AngleMark({ v, p, q, deg, label, toward, strong = false, r = 0.42, fontSize = 0.34 }: { v: F; p: F; q: F; deg: number; label?: string; toward?: F; strong?: boolean; r?: number; fontSize?: number }) {
  const u = unit([p[0] - v[0], p[1] - v[1]]);
  const w = unit([q[0] - v[0], q[1] - v[1]]);
  const dir = toward ?? unit([u[0] + w[0], u[1] + w[1]]);
  const right = Math.abs(deg - 90) < 1e-6;
  const s = r * 0.62;
  const stroke = strong ? INK : MUTED;
  // Narrow corners push the label further out along the bisector, clear of the sides.
  const lr = r + fontSize * (deg < 60 ? 2.1 : 1.25);
  return (
    <g pointerEvents="none">
      {right ? (
        <polyline
          points={[
            [v[0] + u[0] * s, v[1] + u[1] * s],
            [v[0] + (u[0] + w[0]) * s, v[1] + (u[1] + w[1]) * s],
            [v[0] + w[0] * s, v[1] + w[1] * s],
          ]
            .map((pt) => `${r4(pt[0])},${r4(pt[1])}`)
            .join(" ")}
          fill="none"
          stroke={stroke}
          strokeWidth={strong ? 3 : 2}
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        <polyline points={arcPoints(v, u, deg, dir, r).map((pt) => pt.join(",")).join(" ")} fill="none" stroke={stroke} strokeWidth={strong ? 3 : 2} vectorEffect="non-scaling-stroke" />
      )}
      {label && (
        <text x={r4(v[0] + dir[0] * lr)} y={r4(v[1] + dir[1] * lr)} fontSize={fontSize} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} style={halo}>
          {label}
        </text>
      )}
    </g>
  );
}

/** Inside angles of a band, each marked and labelled; `strong` corners drawn heavier. */
export function CornerAnglesG({ poly, strong = [], labels = true }: { poly: Pt[]; strong?: number[]; labels?: boolean }) {
  const angles = cornerAngles(poly);
  const s = Math.sign(area2(poly));
  return (
    <g>
      {poly.map((v, i) => {
        const p = poly[(i + poly.length - 1) % poly.length];
        const q = poly[(i + 1) % poly.length];
        const { deg, kind } = angles[i];
        const u = unit([p[0] - v[0], p[1] - v[1]]);
        const w = unit([q[0] - v[0], q[1] - v[1]]);
        let toward = unit([u[0] + w[0], u[1] + w[1]]);
        if (kind === "reflex") toward = [-toward[0], -toward[1]];
        // A straight corner: the arc bulges into the shape (the inward side of the next side).
        if (kind === "straight") toward = [-s * w[1], s * w[0]];
        return <AngleMark key={i} v={v} p={p} q={q} deg={deg} toward={toward} label={labels ? approxDeg(deg) : undefined} strong={strong.includes(i)} />;
      })}
    </g>
  );
}

/**
 * A triangle or polygon drawn from its angles (not on the board), fitted
 * into the box (x, y, w, h). `label(i)` is the text at corner i (or null).
 * `exterior` extends the side into the last-but-one corner's neighbour and
 * marks the outside angle at corner 2. `ticks` marks equal sides.
 */
export function AngleFigureG({
  angles,
  label,
  x,
  y,
  w,
  h,
  exterior,
  ticks = [],
  fontSize = 0.42,
}: {
  angles: number[];
  label: (i: number) => string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  exterior?: string | null;
  ticks?: number[];
  fontSize?: number;
}) {
  const raw = anglePolygon(angles);
  if (!raw) return null;
  // Flip y (the figure is built with y up), fit to the box.
  let pts: F[] = raw.map(([px, py]) => [px, -py]);
  const extra: F[] = [];
  if (exterior !== undefined) {
    const [b, c] = [pts[1], pts[2]];
    extra.push([c[0] + (c[0] - b[0]) * 0.55, c[1] + (c[1] - b[1]) * 0.55]);
  }
  const all = [...pts, ...extra];
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = Math.min((w - 1.6) / (maxX - minX), (h - 1.6) / (maxY - minY));
  const ox = x + (w - (maxX - minX) * k) / 2 - minX * k;
  const oy = y + (h - (maxY - minY) * k) / 2 - minY * k;
  const fit = (p: F): F => [r4(ox + p[0] * k), r4(oy + p[1] * k)];
  pts = pts.map(fit);
  const ext = extra.map(fit);
  const n = pts.length;
  // Equal-ish label distance whatever the size.
  const r = 0.55;
  return (
    <g>
      <polygon points={pts.map((p) => p.join(",")).join(" ")} fill={SHAPE} fillOpacity={0.1} stroke={SHAPE} strokeWidth={4} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {ext.length > 0 && <line x1={pts[2][0]} y1={pts[2][1]} x2={ext[0][0]} y2={ext[0][1]} stroke={SHAPE} strokeWidth={4} strokeDasharray="9 6" vectorEffect="non-scaling-stroke" />}
      {ticks.map((i) => {
        const [a, b] = [pts[i], pts[(i + 1) % n]];
        const [mx, my] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const d = unit([b[0] - a[0], b[1] - a[1]]);
        return <line key={i} x1={r4(mx - d[1] * 0.2)} y1={r4(my + d[0] * 0.2)} x2={r4(mx + d[1] * 0.2)} y2={r4(my - d[0] * 0.2)} stroke={INK} strokeWidth={3} vectorEffect="non-scaling-stroke" />;
      })}
      {pts.map((v, i) => {
        const t = label(i);
        if (t === null) return null;
        return <AngleMark key={i} v={v} p={pts[(i + n - 1) % n]} q={pts[(i + 1) % n]} deg={angles[i]} label={t} r={r} fontSize={fontSize} strong />;
      })}
      {exterior != null && ext.length > 0 && <AngleMark v={pts[2]} p={ext[0]} q={pts[0]} deg={180 - angles[2]} label={exterior} r={r} fontSize={fontSize} strong />}
    </g>
  );
}

/** Overlays for a "show me" step. */
export function OverlayG({ poly, show }: { poly: Pt[]; show: Overlay }) {
  return (
    <>
      {show.cells && <CellsG poly={poly} mode={show.cells} />}
      {show.box && <BoxG poly={poly} upto={show.pieces ?? 0} />}
    </>
  );
}

/** A small geoboard picture for paper and answer keys. */
export function GeoSvg({ n, size = 150, grid = false, children }: { n: number; size?: number; grid?: boolean; children?: ReactNode }) {
  const [x, y, w, h] = boardView(n);
  return (
    <svg viewBox={`${x} ${y} ${w} ${h}`} width={size} height={size} style={{ direction: "ltr" }} role="img" aria-label="ژئوبرد">
      <PegsG n={n} grid={grid} />
      {children}
    </svg>
  );
}

/** An angle figure as its own picture, for paper. */
export function FigureSvg({ width = 220, height = 150, children }: { width?: number; height?: number; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${width / 30} ${height / 30}`} width={width} height={height} style={{ direction: "ltr" }} role="img" aria-label="شکل">
      {children}
    </svg>
  );
}

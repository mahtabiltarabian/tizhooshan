"use client";

// Drawing tiles. A tile fills a unit square; each shape inside it is drawn
// in its own space (radius 1), then placed, turned and scaled. Fills pair a
// colour with a pattern (striped blue, dotted yellow), so they differ
// without colour.

import { useId, type ReactNode } from "react";
import type { FillName, ShapeName, Tile } from "@/generators/patterns";

export const INK = "#0f172a";

const PATHS: Record<ShapeName, string> = {
  circle: "M0,-0.88 A0.88,0.88 0 1 1 0,0.88 A0.88,0.88 0 1 1 0,-0.88 Z",
  square: "M-0.78,-0.78 H0.78 V0.78 H-0.78 Z",
  triangle: "M0,-0.92 L0.9,0.66 L-0.9,0.66 Z",
  star: star(),
  diamond: "M0,-0.95 L0.7,0 L0,0.95 L-0.7,0 Z",
  hexagon: poly(6, 0.9, 0),
  arrow: "M0,-0.95 L0.68,-0.2 L0.26,-0.2 L0.26,0.95 L-0.26,0.95 L-0.26,-0.2 L-0.68,-0.2 Z",
  flag: "M-0.5,-0.95 L0.75,-0.55 L-0.32,-0.15 L-0.32,0.95 L-0.5,0.95 Z",
  letterF: "M-0.55,-0.95 L0.7,-0.95 L0.7,-0.58 L-0.12,-0.58 L-0.12,-0.15 L0.45,-0.15 L0.45,0.22 L-0.12,0.22 L-0.12,0.95 L-0.55,0.95 Z",
};

function star() {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.4 : 0.95;
    const a = (Math.PI * i) / 5;
    pts.push(`${(r * Math.sin(a)).toFixed(3)},${(-r * Math.cos(a)).toFixed(3)}`);
  }
  return `M${pts.join(" L")} Z`;
}

/** Regular polygon, first corner straight up. */
function poly(n: number, r: number, tilt: number) {
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n + tilt;
    return `${(r * Math.sin(a)).toFixed(3)},${(-r * Math.cos(a)).toFixed(3)}`;
  });
  return `M${pts.join(" L")} Z`;
}

/** Where 1 … 6 shapes sit in a tile, and how big each is. */
const SPOTS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [
    [0.28, 0.5],
    [0.72, 0.5],
  ],
  3: [
    [0.5, 0.27],
    [0.27, 0.72],
    [0.73, 0.72],
  ],
  4: [
    [0.28, 0.28],
    [0.72, 0.28],
    [0.28, 0.72],
    [0.72, 0.72],
  ],
  5: [
    [0.24, 0.24],
    [0.76, 0.24],
    [0.5, 0.5],
    [0.24, 0.76],
    [0.76, 0.76],
  ],
  6: [
    [0.28, 0.2],
    [0.72, 0.2],
    [0.28, 0.5],
    [0.72, 0.5],
    [0.28, 0.8],
    [0.72, 0.8],
  ],
};
const ITEM_SIZE: Record<number, number> = { 1: 0.34, 2: 0.2, 3: 0.19, 4: 0.18, 5: 0.15, 6: 0.13 };

/** Fill patterns, once per SVG; pass the id to the tiles. */
export function TileDefs({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={`${id}-striped`} width={0.32} height={0.32} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width={0.32} height={0.32} fill="#8fb8ff" />
        <line x1={0.08} y1={0} x2={0.08} y2={0.32} stroke={INK} strokeWidth={0.1} />
      </pattern>
      <pattern id={`${id}-dotted`} width={0.4} height={0.4} patternUnits="userSpaceOnUse">
        <rect width={0.4} height={0.4} fill="#ffc93d" />
        <circle cx={0.2} cy={0.2} r={0.08} fill={INK} />
      </pattern>
    </defs>
  );
}

const fillOf = (f: FillName | undefined, id: string) => (f === "black" ? INK : f === "striped" ? `url(#${id}-striped)` : f === "dotted" ? `url(#${id}-dotted)` : "#ffffff");

/** Stroke ends for each stroke bit, in a unit tile. */
const STROKES: [number, number, number, number][] = [
  [0.15, 0.15, 0.85, 0.15],
  [0.85, 0.15, 0.85, 0.85],
  [0.15, 0.85, 0.85, 0.85],
  [0.15, 0.15, 0.15, 0.85],
  [0.15, 0.15, 0.85, 0.85],
  [0.85, 0.15, 0.15, 0.85],
  [0.5, 0.15, 0.5, 0.85],
  [0.15, 0.5, 0.85, 0.5],
];

/** The 8 spots round a marker frame, clockwise from the top-left. */
const FRAME_SPOTS: [number, number][] = [
  [0.16, 0.16],
  [0.5, 0.16],
  [0.84, 0.16],
  [0.84, 0.5],
  [0.84, 0.84],
  [0.5, 0.84],
  [0.16, 0.84],
  [0.16, 0.5],
];

interface TileGProps {
  tile: Tile;
  x: number;
  y: number;
  size: number;
  defs: string;
}

/** One tile's contents in a size×size square at (x, y). No background. */
export function TileG({ tile: t, x, y, size, defs }: TileGProps) {
  const parts: ReactNode[] = [];
  const at = (u: number, v: number) => `translate(${x + u * size} ${y + v * size})`;

  if (t.lines !== undefined) {
    for (const [u, v] of [0.15, 0.5, 0.85].flatMap((a) => [0.15, 0.5, 0.85].map((b) => [a, b])))
      parts.push(<circle key={`g${u}${v}`} cx={x + u * size} cy={y + v * size} r={size * 0.025} fill="#94a3b8" />);
    STROKES.forEach(([x1, y1, x2, y2], i) => {
      if (t.lines! & (1 << i))
        parts.push(<line key={`s${i}`} x1={x + x1 * size} y1={y + y1 * size} x2={x + x2 * size} y2={y + y2 * size} stroke={INK} strokeWidth={4} strokeLinecap="round" vectorEffect="non-scaling-stroke" />);
    });
  }

  if (t.marks) {
    parts.push(<rect key="frame" x={x + 0.16 * size} y={y + 0.16 * size} width={0.68 * size} height={0.68 * size} fill="none" stroke="#94a3b8" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />);
    FRAME_SPOTS.forEach(([u, v], i) => parts.push(<circle key={`f${i}`} cx={x + u * size} cy={y + v * size} r={size * 0.035} fill="#fff" stroke="#94a3b8" strokeWidth={1} vectorEffect="non-scaling-stroke" />));
    t.marks.forEach((p, k) => {
      const [u, v] = FRAME_SPOTS[p];
      parts.push(
        k === 0 ? (
          <circle key={`m${k}`} cx={x + u * size} cy={y + v * size} r={size * 0.09} fill={INK} />
        ) : (
          <path key={`m${k}`} d={PATHS.star} transform={`${at(u, v)} scale(${size * 0.13})`} fill="#ffc93d" stroke={INK} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        ),
      );
    });
    if (t.arrow !== undefined)
      parts.push(<path key="arrow" d={PATHS.arrow} transform={`${at(0.5, 0.5)} rotate(${t.arrow * 45}) scale(${size * 0.2})`} fill="#8fb8ff" stroke={INK} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />);
  }

  if (t.sides !== undefined) {
    parts.push(<path key="poly" d={poly(t.sides, 0.92, 0)} transform={`${at(0.5, 0.52)} scale(${size * 0.42})`} fill={fillOf(t.fill, defs)} stroke={INK} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />);
    (SPOTS[t.dots ?? 0] ?? []).forEach(([u, v], i) =>
      parts.push(<circle key={`d${i}`} cx={x + (0.5 + (u - 0.5) * 0.5) * size} cy={y + (0.53 + (v - 0.5) * 0.5) * size} r={size * 0.045} fill="#fff" stroke={INK} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />),
    );
  }

  if (t.shape) {
    const n = t.count ?? 1;
    const s = ITEM_SIZE[n] * size;
    SPOTS[n].forEach(([u, v], i) =>
      parts.push(
        <path
          key={`i${i}`}
          d={PATHS[t.shape!]}
          transform={`${at(u, v)} rotate(${(t.turn ?? 0) * 45}) scale(${t.flip ? -s : s} ${s})`}
          fill={fillOf(t.fill, defs)}
          stroke={INK}
          strokeWidth={2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />,
      ),
    );
  }

  return <g>{parts}</g>;
}

/** A tile on a white card. */
export function TileCard({ tile, x, y, size, defs }: TileGProps) {
  return (
    <g>
      <rect x={x} y={y} width={size} height={size} rx={size * 0.08} fill="#fff" stroke={INK} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <TileG tile={tile} x={x} y={y} size={size} defs={defs} />
    </g>
  );
}

/** A standalone tile picture (options, worksheets). */
export function TileSvg({ tile, size }: { tile: Tile; size: number }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg width={size} height={size} viewBox="-0.04 -0.04 1.08 1.08" style={{ direction: "ltr" }}>
      <TileDefs id={id} />
      <TileCard tile={tile} x={0} y={0} size={1} defs={id} />
    </svg>
  );
}

/** A 2×2 piece (missing-piece options), right to left like the board. */
export function PatchSvg({ tiles, size }: { tiles: Tile[]; size: number }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const g = 0.06;
  return (
    <svg width={size} height={size} viewBox={`-0.04 -0.04 ${2 + g + 0.08} ${2 + g + 0.08}`} style={{ direction: "ltr" }}>
      <TileDefs id={id} />
      {tiles.map((t, k) => (
        <TileCard key={k} tile={t} x={(1 - (k & 1)) * (1 + g)} y={(k >> 1) * (1 + g)} size={1} defs={id} />
      ))}
    </svg>
  );
}

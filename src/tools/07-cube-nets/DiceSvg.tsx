"use client";

// Flat pictures for the dice questions: one die face (pips plus its number),
// a die seen from the front-right corner, a net with pip faces, and the
// board with the rolling path. Pips are always drawn with the number, so
// nothing depends on counting dots alone or on colour.

import type { Cell } from "@/generators/cube-nets";
import { DIR_STEP, type DieNet, type DieState, type Dir } from "@/generators/dice";
import { fa } from "@/tools/registry";
import { DIR_ARROW } from "./diceText";

const INK = "#0f172a";
const PAPER = "#fffaf0";

/** Pip centres in a −1…1 square (y down). */
export const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-0.45, -0.45], [0.45, 0.45]],
  3: [[-0.45, -0.45], [0, 0], [0.45, 0.45]],
  4: [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]],
  5: [[-0.45, -0.45], [0.45, -0.45], [0, 0], [-0.45, 0.45], [0.45, 0.45]],
  6: [[-0.45, -0.5], [0.45, -0.5], [-0.45, 0], [0.45, 0], [-0.45, 0.5], [0.45, 0.5]],
};

/** Pips in a −1…1 square, with the number small in the corner. */
function Pips({ n, digit = true }: { n: number; digit?: boolean }) {
  return (
    <>
      {(PIPS[n] ?? []).map(([x, y], i) => (
        <circle key={i} cx={x * 0.85} cy={y * 0.85} r={0.15} fill={INK} />
      ))}
      {digit && (
        <text x={0.72} y={0.95} textAnchor="middle" fontSize={0.38} fontWeight={700} fill={INK} fontFamily="Vazirmatn, sans-serif">
          {fa(n)}
        </text>
      )}
    </>
  );
}

/** One face: pips and the number under them. */
export function DieFaceSvg({ n, size = 52, mark }: { n: number; size?: number; mark?: "ask" }) {
  const k = size / 2.3;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <g transform={`translate(${size / 2} ${size / 2}) scale(${k})`}>
        <rect x={-1} y={-1} width={2} height={2} rx={0.28} fill={PAPER} stroke={INK} strokeWidth={0.07} strokeDasharray={mark ? "0.25 0.15" : undefined} />
        {n > 0 ? (
          <Pips n={n} />
        ) : mark ? (
          <text x={0} y={0.35} textAnchor="middle" fontSize={1.1} fontWeight={700} fill={INK} fontFamily="Vazirmatn, sans-serif">
            ؟
          </text>
        ) : null}
      </g>
    </svg>
  );
}

// Isometric view from (+x, -y, +z), like IsoCube: top, right (+x) and front (-y).
const C = Math.cos(Math.PI / 6);
const S = 0.5;
type V3 = [number, number, number];
const screen = ([x, y, z]: V3): [number, number] => [C * x + C * y, S * x - S * y - z];
const ISO_FACES: { side: "top" | "east" | "south"; n: V3; up: V3; right: V3; shade: string }[] = [
  { side: "top", n: [0, 0, 1], up: [0, 1, 0], right: [1, 0, 0], shade: "#fffaf0" },
  { side: "east", n: [1, 0, 0], up: [0, 0, 1], right: [0, 1, 0], shade: "#f1e6d2" },
  { side: "south", n: [0, -1, 0], up: [0, 0, 1], right: [1, 0, 0], shade: "#e6d7bd" },
];

/** A die seen from the front-right corner: top, front and right faces. */
export function DieIso({ die, size = 130, label }: { die: DieState; size?: number; label?: string }) {
  const k = size / 4.4;
  const o = size / 2;
  const text = label ?? `تاس: بالا ${fa(die.top)}، روبرو ${fa(die.south)}، راست ${fa(die.east)}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={text}>
      {ISO_FACES.map((f) => {
        const [cx, cy] = screen(f.n);
        const [rx, ry] = screen(f.right);
        const [ux, uy] = screen(f.up);
        const matrix = `matrix(${k * rx} ${k * ry} ${-k * ux} ${-k * uy} ${o + k * cx} ${o + k * cy})`;
        return (
          <g key={f.side} transform={matrix}>
            <rect x={-1} y={-1} width={2} height={2} fill={f.shade} stroke={INK} strokeWidth={0.05} strokeLinejoin="round" />
            <Pips n={die[f.side]} digit={false} />
          </g>
        );
      })}
    </svg>
  );
}

/** Numbers of a die picture as words, for under the picture. */
export const dieCaption = (die: DieState) => `بالا ${fa(die.top)} · روبرو ${fa(die.south)} · راست ${fa(die.east)}`;

export type NetCellMark = "ask" | "correct" | "wrong";

/** A net with pip faces; 0 = empty cell; the `ask` cell shows «؟». */
export function DieNetSvg({ net, size = 200, ask, label }: { net: DieNet; size?: number; ask?: number; label?: string }) {
  const { cells, values } = net;
  const maxX = Math.max(...cells.map((c) => c[0]));
  const maxY = Math.max(...cells.map((c) => c[1]));
  const u = size / (Math.max(maxX, maxY) + 1);
  const offX = (size - (maxX + 1) * u) / 2;
  const offY = (size - (maxY + 1) * u) / 2;
  const words = cells.map((_, i) => (i === ask ? "؟" : values[i] ? fa(values[i]) : "خالی")).join("، ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label ?? `گسترده تاس: ${words}`}>
      {cells.map(([x, y], i) => {
        const cx = offX + x * u + u / 2;
        const cy = offY + (maxY - y) * u + u / 2;
        const k = (u - 4) / 2;
        return (
          <g key={i} transform={`translate(${cx} ${cy}) scale(${k})`}>
            <rect x={-1} y={-1} width={2} height={2} rx={0.12} fill={i === ask ? "#fff3c4" : PAPER} stroke={INK} strokeWidth={4 / u} strokeDasharray={i === ask ? "0.3 0.18" : undefined} />
            {values[i] > 0 && <Pips n={values[i]} />}
            {i === ask && (
              <text x={0} y={0.38} textAnchor="middle" fontSize={1.1} fontWeight={700} fill={INK} fontFamily="Vazirmatn, sans-serif">
                ؟
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** The board seen from above, the viewer at the bottom edge; the path drawn as numbered arrows. */
export function RollBoardSvg({ w, d, from, path, size = 220 }: { w: number; d: number; from: Cell; path: readonly Dir[]; size?: number }) {
  const u = Math.min(42, (size - 8) / Math.max(w, d + 0.7));
  const W = w * u + 8;
  const H = d * u + 8 + u * 0.7;
  const px = (x: number) => 4 + x * u + u / 2;
  const py = (y: number) => 4 + (d - 1 - y) * u + u / 2;
  const cells: Cell[] = [from];
  for (const dir of path) {
    const [x, y] = cells[cells.length - 1];
    cells.push([x + DIR_STEP[dir][0], y + DIR_STEP[dir][1]]);
  }
  const end = cells[cells.length - 1];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`صفحه و مسیر غلتیدن: ${path.map((p) => DIR_ARROW[p]).join(" ")}`} style={{ maxWidth: "100%", height: "auto" }}>
      <defs>
        <marker id="roll-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill={INK} />
        </marker>
      </defs>
      {Array.from({ length: w * d }, (_, i) => {
        const x = i % w;
        const y = Math.floor(i / w);
        return <rect key={i} x={4 + x * u} y={4 + (d - 1 - y) * u} width={u} height={u} fill={(x + y) % 2 ? "#f7efe0" : "#efe3cc"} stroke="#c9b99b" strokeWidth={1} />;
      })}
      {/* Start: a small die outline; end: a double square. */}
      <rect x={px(from[0]) - u * 0.42} y={py(from[1]) - u * 0.42} width={u * 0.84} height={u * 0.84} rx={u * 0.12} fill={PAPER} stroke={INK} strokeWidth={2} />
      <text x={px(from[0])} y={py(from[1]) - u * 0.12} textAnchor="middle" fontSize={u * 0.26} fontWeight={700} fill={INK} fontFamily="Vazirmatn, sans-serif">
        شروع
      </text>
      <rect x={px(end[0]) - u * 0.42} y={py(end[1]) - u * 0.42} width={u * 0.84} height={u * 0.84} fill="none" stroke={INK} strokeWidth={2.5} strokeDasharray="5 3" />
      {cells.slice(0, -1).map(([x, y], i) => {
        const [nx, ny] = cells[i + 1];
        return (
          <g key={i}>
            <line x1={px(x)} y1={py(y)} x2={px(nx) - (nx - x) * u * 0.3} y2={py(ny) + (ny - y) * u * 0.3} stroke={INK} strokeWidth={2.4} markerEnd="url(#roll-arrow)" />
            <text x={(px(x) + px(nx)) / 2 + (ny !== y ? u * 0.16 : 0)} y={(py(y) + py(ny)) / 2 - (nx !== x ? u * 0.14 : 0)} textAnchor="middle" fontSize={u * 0.28} fontWeight={700} fill={INK} fontFamily="Vazirmatn, sans-serif">
              {fa(i + 1)}
            </text>
          </g>
        );
      })}
      <text x={px(end[0])} y={py(end[1]) + u * 0.5 - 2} textAnchor="middle" fontSize={u * 0.24} fontWeight={700} fill={INK} fontFamily="Vazirmatn, sans-serif">
        پایان
      </text>
      <text x={W / 2} y={H - 6} textAnchor="middle" fontSize={u * 0.3} fill={INK} fontFamily="Vazirmatn, sans-serif">
        ↓ ما این طرفیم (روبرو)
      </text>
    </svg>
  );
}

// Shapes and the grid of tool 21. Cells run right to left, top to bottom,
// the way a Persian reader scans. Marks pair a symbol with a colour.

import { FLAG, type Glyph, type SpeedQuestion } from "@/generators/speed";

const INK = "#0f172a";

/** One shape, centred on (0, 0), about 0.7 wide. */
export function GlyphShape({ g, color = INK }: { g: Glyph; color?: string }) {
  const t = `rotate(${g.rot * 90}) scale(${g.flip ? -1 : 1}, 1)`;
  switch (g.shape) {
    case 0:
      return <circle r={0.3} fill={color} />;
    case 1:
      return <rect x={-0.27} y={-0.27} width={0.54} height={0.54} fill={color} />;
    case 2:
      return <polygon points="0,-0.32 0.31,0.25 -0.31,0.25" fill={color} />;
    case 3:
      return <polygon points={star()} fill={color} />;
    case 4:
      return <path d="M-0.1-0.32h0.2v0.22h0.22v0.2h-0.22v0.22h-0.2v-0.22h-0.22v-0.2h0.22z" fill={color} />;
    case 5:
      return <polygon points="0,-0.34 0.28,0 0,0.34 -0.28,0" fill={color} />;
    case 6:
      return <circle r={0.24} fill="none" stroke={color} strokeWidth={0.1} />;
    case FLAG:
      return (
        <g transform={t}>
          <polygon points="-0.24,-0.32 0.24,-0.32 0.24,-0.17 -0.07,-0.17 -0.07,-0.04 0.15,-0.04 0.15,0.1 -0.07,0.1 -0.07,0.32 -0.24,0.32" fill={color} />
        </g>
      );
    default:
      return null;
  }
}

function star() {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.14 : 0.34;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(r * Math.cos(a)).toFixed(3)},${(r * Math.sin(a)).toFixed(3)}`);
  }
  return pts.join(" ");
}

/** Cell centre: column 0 is on the right. */
export const cellXY = (q: Pick<SpeedQuestion, "cols">, i: number) => ({ x: q.cols - 1 - (i % q.cols) + 0.5, y: Math.floor(i / q.cols) + 0.5 });

export type CellMark = "tapped" | "right" | "wrong" | "missed" | "found" | null;

const MARK: Record<Exclude<CellMark, null>, { stroke: string; dash?: string; symbol?: string }> = {
  tapped: { stroke: "#4f46e5", symbol: "●" },
  right: { stroke: "#1f9d55", symbol: "✓" },
  wrong: { stroke: "#d64545", symbol: "✗" },
  missed: { stroke: "#d64545", dash: "0.08 0.06", symbol: "؟" },
  found: { stroke: "#4f46e5", symbol: "✓" },
};

export function GlyphGrid({
  q,
  marks,
  onTap,
  scanRow,
  label,
}: {
  q: Pick<SpeedQuestion, "cols" | "rows" | "grid">;
  marks?: (i: number) => CellMark;
  onTap?: (i: number) => void;
  /** Show me: the row being scanned. */
  scanRow?: number;
  label?: string;
}) {
  return (
    <g aria-label={label}>
      {scanRow !== undefined && scanRow < q.rows && <rect x={0.02} y={scanRow + 0.02} width={q.cols - 0.04} height={0.96} rx={0.12} fill="#ffe9a8" />}
      {q.grid.map((g, i) => {
        const { x, y } = cellXY(q, i);
        const m = marks?.(i) ?? null;
        const style = m ? MARK[m] : null;
        return (
          <g key={i} transform={`translate(${x} ${y})`} onClick={onTap ? () => onTap(i) : undefined} style={onTap ? { cursor: "pointer" } : undefined}>
            <rect x={-0.46} y={-0.46} width={0.92} height={0.92} rx={0.14} fill="#fff" stroke={style?.stroke ?? "#e5e7eb"} strokeWidth={style ? 0.08 : 0.03} strokeDasharray={style?.dash} />
            <GlyphShape g={g} />
            {style?.symbol && (
              <text x={0.3} y={-0.24} fontSize={0.3} fontWeight={700} fill={style.stroke} textAnchor="middle">
                {style.symbol}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** The target, framed, above the grid. */
export function TargetCard({ g, x, y }: { g: Glyph; x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-0.55} y={-0.55} width={1.1} height={1.1} rx={0.16} fill="#fff" stroke="#4f46e5" strokeWidth={0.07} />
      <g transform="scale(1.2)">
        <GlyphShape g={g} />
      </g>
    </g>
  );
}

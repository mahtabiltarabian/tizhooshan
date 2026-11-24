import type { Cell } from "@/generators/cube-nets";

interface NetThumbProps {
  cells: readonly Cell[];
  size?: number;
  /** Optional label per cell, in `cells` order. */
  labels?: readonly string[];
  /** Optional colour per cell; defaults to one toy blue. */
  colors?: readonly string[];
}

/** Flat drawing of a net. Grid y points up, SVG y points down. */
export function NetThumb({ cells, size = 64, labels, colors }: NetThumbProps) {
  const maxX = Math.max(...cells.map((c) => c[0]));
  const maxY = Math.max(...cells.map((c) => c[1]));
  const span = Math.max(maxX, maxY) + 1;
  const u = size / span;
  const offX = (size - (maxX + 1) * u) / 2;
  const offY = (size - (maxY + 1) * u) / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      {cells.map(([x, y], i) => {
        const px = offX + x * u;
        const py = offY + (maxY - y) * u;
        return (
          <g key={`${x},${y}`}>
            <rect
              x={px + 1}
              y={py + 1}
              width={u - 2}
              height={u - 2}
              rx={u * 0.18}
              fill={colors?.[i] ?? "var(--toy-4)"}
              stroke="#0f172a"
              strokeOpacity={0.25}
            />
            {labels && (
              <text
                x={px + u / 2}
                y={py + u / 2 + u * 0.17}
                textAnchor="middle"
                fontSize={u * 0.48}
                fontWeight={700}
                fill="#fff"
                stroke="rgba(31,36,48,0.85)"
                strokeWidth={u * 0.07}
                paintOrder="stroke"
              >
                {labels[i]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

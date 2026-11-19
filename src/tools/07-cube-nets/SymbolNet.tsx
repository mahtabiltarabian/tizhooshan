"use client";

import type { DecoratedNet } from "@/generators/cube-questions";
import styles from "./SymbolNet.module.css";

export type CellMark = "target" | "selected" | "correct" | "turned" | "wrong" | "missed";

const BADGE: Partial<Record<CellMark, string>> = { correct: "✓", turned: "↻", wrong: "✗", missed: "!" };

interface SymbolNetProps {
  net: DecoratedNet;
  size?: number;
  marks?: Partial<Record<number, CellMark>>;
  /** When set, cells are buttons. */
  onPick?: (index: number) => void;
  label?: string;
}

/**
 * A net with its symbols drawn as on paper (turned by `net.turns`); an empty
 * symbol draws an empty square. Grid y points up, SVG y points down.
 */
export function SymbolNet({ net, size = 220, marks = {}, onPick, label = "گسترده با نمادها" }: SymbolNetProps) {
  const { cells, symbols, turns } = net;
  const maxX = Math.max(...cells.map((c) => c[0]));
  const maxY = Math.max(...cells.map((c) => c[1]));
  const u = size / (Math.max(maxX, maxY) + 1);
  const offX = (size - (maxX + 1) * u) / 2;
  const offY = (size - (maxY + 1) * u) / 2;

  return (
    <svg className={styles.net} width={size} height={size} viewBox={`0 0 ${size} ${size}`} role={onPick ? "group" : "img"} aria-label={label}>
      {cells.map(([x, y], i) => {
        const px = offX + x * u;
        const py = offY + (maxY - y) * u;
        const mark = marks[i];
        const cx = px + u / 2;
        const cy = py + u / 2;
        return (
          <g
            key={i}
            className={`${styles.cell} ${mark ? styles[mark] : ""} ${onPick ? styles.pickable : ""}`}
            role={onPick ? "button" : undefined}
            tabIndex={onPick ? 0 : undefined}
            aria-label={onPick ? (symbols[i] ? `وجه ${symbols[i]}` : "خانه خالی") : undefined}
            onClick={onPick ? () => onPick(i) : undefined}
            onKeyDown={
              onPick
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onPick(i);
                    }
                  }
                : undefined
            }
          >
            <rect x={px + 2} y={py + 2} width={u - 4} height={u - 4} rx={u * 0.14} />
            {/* SVG angles turn clockwise; net turns are counter-clockwise. */}
            {symbols[i] && (
              <text x={cx} y={cy + u * 0.17} textAnchor="middle" fontSize={u * 0.5} transform={`rotate(${-90 * turns[i]} ${cx} ${cy})`}>
                {symbols[i]}
              </text>
            )}
            {mark && BADGE[mark] && (
              <text className={styles.badge} x={px + u - 11} y={py + 17} fontSize={Math.min(16, u * 0.3)}>
                {BADGE[mark]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** One square showing `symbol` turned `turns` quarter turns counter-clockwise. */
export function TurnTile({ symbol, turns, size = 64 }: { symbol: string; turns: number; size?: number }) {
  const c = size / 2;
  return (
    <svg className={styles.net} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <g className={styles.cell}>
        <rect x={2} y={2} width={size - 4} height={size - 4} rx={size * 0.14} />
        <text x={c} y={c + size * 0.17} textAnchor="middle" fontSize={size * 0.5} transform={`rotate(${-90 * turns} ${c} ${c})`}>
          {symbol}
        </text>
      </g>
    </svg>
  );
}

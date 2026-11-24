// Pictures for tool 17, in board units (the board is 16 × 9). Every object
// carries a letter or number as well as a colour, and every case that is
// left out gets a ✗, a dashed border and grey text (kept cases get a ✓ and a
// solid border), so nothing is told by colour alone. Trees grow
// from the right, like Persian text.

import type { ReactNode } from "react";
import {
  ballColour,
  cases,
  COLOURS,
  gridOpen,
  gridValues,
  routeNodes,
  worstCase,
  type Case,
  type CountingQuestion,
  type GridCond,
  type PigeonholeQuestion,
  type ProbabilityQuestion,
} from "@/generators/counting";
import { fa } from "@/tools/registry";
import { caseLabel, initial, itemName, stepLabel, TREE_GROUPS } from "./text";

export const INK = "#0f172a";
const SOFT = "#8a8f9c";
const PAPER = "#fffdf8";
const OUT = "#ece7de";
const GOOD = "#e3f5ea";
const GOOD_LINE = "#1d8a55";

/** Fills for people and fruits, by position (each also has its own letter). */
export const TOKEN_FILL = ["#ff8a8a", "#7fb2ff", "#7fd6a8", "#ffd76a", "#c9a3ff", "#ffb877", "#7fd3d0"];
/** Fills for the named colours red, blue, green, yellow, black, with the letter's colour. */
export const COLOUR_FILL: { bg: string; fg: string }[] = [
  { bg: "#e04848", fg: "#fff" },
  { bg: "#3d7bf7", fg: "#fff" },
  { bg: "#2f9e5b", fg: "#fff" },
  { bg: "#f2c230", fg: INK },
  { bg: "#2b2b2b", fg: "#fff" },
];

export const r4 = (v: number) => Math.round(v * 1e4) / 1e4;

interface TxProps {
  x: number;
  y: number;
  size: number;
  children: ReactNode;
  anchor?: "start" | "middle" | "end";
  /** Mixed Persian words and digits: lay them out right to left. "end" is still the right edge. */
  rtl?: boolean;
  fill?: string;
  weight?: number;
}

export function Tx({ x, y, size, children, anchor = "middle", rtl, fill = INK, weight = 700 }: TxProps) {
  const a = rtl && anchor !== "middle" ? (anchor === "end" ? "start" : "end") : anchor;
  return (
    <text
      x={r4(x)}
      y={r4(y)}
      fontSize={r4(size)}
      fontWeight={weight}
      textAnchor={a}
      dominantBaseline="central"
      fill={fill}
      direction={rtl ? "rtl" : undefined}
      pointerEvents="none"
    >
      {children}
    </text>
  );
}

/** A round token: a fill and a letter. `faded` draws it dashed and pale (used up). */
export function Token({ x, y, r, fill, label, fg = INK, faded, onClick, title }: { x: number; y: number; r: number; fill: string; label: string; fg?: string; faded?: boolean; onClick?: () => void; title?: string }) {
  return (
    <g onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined} role={onClick ? "button" : undefined} aria-label={title}>
      <circle cx={r4(x)} cy={r4(y)} r={r4(r)} fill={faded ? "#fff" : fill} stroke={faded ? SOFT : INK} strokeWidth={0.05} strokeDasharray={faded ? "0.12 0.1" : undefined} />
      <Tx x={x} y={y} size={r * 1.05} fill={faded ? SOFT : fg}>
        {label}
      </Tx>
    </g>
  );
}

/** Rough width of a short Persian label, in board units. */
const textW = (s: string, size: number) => s.length * size * 0.52;

/** A label in a rounded box: kept (✓, solid), left out (✗, dashed, struck), or plain. */
function Chip({ x, y, w, h, label, state, size, num }: { x: number; y: number; w: number; h: number; label: string; state: "ok" | "out" | "plain"; size: number; num?: string }) {
  const out = state === "out";
  return (
    <g>
      <rect x={r4(x)} y={r4(y)} width={r4(w)} height={r4(h)} rx={0.14} fill={out ? OUT : state === "ok" ? GOOD : PAPER} stroke={out ? SOFT : state === "ok" ? GOOD_LINE : INK} strokeWidth={0.04} strokeDasharray={out ? "0.14 0.1" : undefined} />
      <Tx x={x + w / 2} y={y + h / 2} size={size} fill={out ? SOFT : INK} rtl>
        {label}
      </Tx>
      {state !== "plain" && (
        <Tx x={x + w - size * 0.55} y={y + h / 2} size={size * 0.95} fill={out ? SOFT : GOOD_LINE}>
          {out ? "✗" : "✓"}
        </Tx>
      )}
      {num && (
        <Tx x={x + size * 0.6} y={y + h / 2} size={size * 0.7} fill={SOFT}>
          {num}
        </Tx>
      )}
    </g>
  );
}

// ── Tree of cases ──

interface TNode {
  key: string;
  depth: number;
  v: number;
  y: number;
  first: number;
  /** Leaves under it. */
  leaves: number[];
  parent: string | null;
}

/**
 * The tree of every case. Branches of the first level appear one by one up to
 * `upto`; with `marks`, leaves get ✓ or ✗ (only where some case is left out).
 */
export function TreeG({ q, upto, marks }: { q: CountingQuestion; upto: number; marks: boolean }) {
  const all = cases(q);
  const L = all.length;
  const D = Math.max(...all.map((c) => c.pick.length));
  const top = 0.35;
  const rowH = (9 - 2 * top) / L;
  const leafY = (i: number) => top + rowH * (i + 0.5);
  const nodes = new Map<string, TNode>();
  const firsts: number[] = [];
  all.forEach((c, i) => {
    if (!firsts.includes(c.pick[0])) firsts.push(c.pick[0]);
    for (let d = 1; d <= c.pick.length; d++) {
      const key = c.pick.slice(0, d).join(",");
      const n = nodes.get(key);
      if (n) n.leaves.push(i);
      else nodes.set(key, { key, depth: d, v: c.pick[d - 1], y: 0, first: firsts.indexOf(c.pick[0]), leaves: [i], parent: d > 1 ? c.pick.slice(0, d - 1).join(",") : null });
    }
  });
  for (const n of nodes.values()) n.y = (leafY(n.leaves[0]) + leafY(n.leaves[n.leaves.length - 1])) / 2;
  const showMarks = marks && all.some((c) => !c.ok);
  const labelW = Math.min(5.2, Math.max(...all.map((c) => textW(caseLabel(q, c), Math.min(0.34, rowH * 0.72)))) + 1);
  const rootX = 15.4;
  const colW = (rootX - labelW - 0.9) / D;
  const xOf = (d: number) => rootX - d * colW;
  // Font for each depth: as big as the spacing of its nodes allows.
  const fontAt = (d: number) => {
    const ns = [...nodes.values()].filter((n) => n.depth === d);
    const gap = Math.min(...ns.map((n) => n.leaves.length)) * rowH;
    return Math.max(0.2, Math.min(0.4, gap * 0.72));
  };
  const visible = (n: { first: number }) => n.first <= upto;
  const list = [...nodes.values()];
  const rootY = 4.5;
  return (
    <g>
      {/* Branches first, then labels on top. */}
      {list.filter(visible).map((n) => {
        const p = n.parent ? nodes.get(n.parent)! : null;
        return <line key={`l${n.key}`} x1={r4(p ? xOf(p.depth) : rootX)} y1={r4(p ? p.y : rootY)} x2={r4(xOf(n.depth))} y2={r4(n.y)} stroke={SOFT} strokeWidth={0.035} />;
      })}
      <g>
        <rect x={rootX - 0.5} y={rootY - 0.3} width={1} height={0.6} rx={0.15} fill={INK} />
        <Tx x={rootX} y={rootY} size={0.3} fill="#fff">
          شروع
        </Tx>
      </g>
      {list.filter(visible).map((n) => {
        const size = fontAt(n.depth);
        const label = stepLabel(q, n.depth - 1, n.v);
        const w = textW(label, size) + 0.3;
        const leafOut = showMarks && n.leaves.every((i) => !all[i].ok);
        return (
          <g key={`n${n.key}`}>
            <rect x={r4(xOf(n.depth) - w / 2)} y={r4(n.y - size * 0.7)} width={r4(w)} height={r4(size * 1.4)} rx={0.1} fill={leafOut ? OUT : PAPER} stroke={leafOut ? SOFT : INK} strokeWidth={0.03} strokeDasharray={leafOut ? "0.1 0.08" : undefined} />
            <Tx x={xOf(n.depth)} y={n.y} size={size} fill={leafOut ? SOFT : INK} rtl>
              {label}
            </Tx>
          </g>
        );
      })}
      {/* Each whole case at the end of its branch. */}
      {all.map((c, i) => {
        const first = firsts.indexOf(c.pick[0]);
        if (first > upto) return null;
        const size = Math.min(0.34, rowH * 0.72);
        const leafX = xOf(c.pick.length);
        const out = showMarks && !c.ok;
        return (
          <g key={`c${i}`}>
            <line x1={r4(leafX - 0.35)} y1={r4(leafY(i))} x2={r4(labelW + 0.15)} y2={r4(leafY(i))} stroke={OUT} strokeWidth={0.03} strokeDasharray="0.06 0.08" />
            <Tx x={labelW} y={leafY(i)} size={size} anchor="end" fill={out ? SOFT : INK} rtl>
              {caseLabel(q, c)}
            </Tx>
            {showMarks && (
              <Tx x={0.35} y={leafY(i)} size={size} fill={out ? SOFT : GOOD_LINE}>
                {out ? "✗" : "✓"}
              </Tx>
            )}
          </g>
        );
      })}
    </g>
  );
}

// ── Handshakes: people on a circle ──

export function CircleG({ n, twins, upto, teams, all: showAll }: { n: number; twins: boolean; upto: number; teams?: boolean; all?: boolean }) {
  const cx = 8;
  const cy = 4.5;
  const R = 3.5;
  const at = (i: number) => {
    const a = ((-90 + (i * 360) / n) * Math.PI) / 180;
    return { x: r4(cx + R * Math.cos(a)), y: r4(cy + R * Math.sin(a)) };
  };
  const lines: ReactNode[] = [];
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      if (twins && i >> 1 === j >> 1) continue;
      if (!showAll && i > upto) continue;
      const p = at(i);
      const q = at(j);
      const now = !showAll && i === upto;
      lines.push(<line key={`${i}-${j}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={now ? "#4f46e5" : SOFT} strokeWidth={now ? 0.07 : 0.035} />);
    }
  return (
    <g>
      {lines}
      {twins &&
        Array.from({ length: n / 2 }, (_, t) => {
          const p = at(2 * t);
          const q = at(2 * t + 1);
          const mx = (p.x + q.x) / 2;
          const my = (p.y + q.y) / 2;
          return (
            <g key={`t${t}`}>
              <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={SOFT} strokeWidth={0.05} strokeDasharray="0.12 0.1" />
              <circle cx={r4(mx)} cy={r4(my)} r={0.24} fill="#fff" stroke={SOFT} strokeWidth={0.03} />
              <Tx x={mx} y={my} size={0.28} fill={SOFT}>
                ✗
              </Tx>
            </g>
          );
        })}
      {Array.from({ length: n }, (_, i) => {
        const p = at(i);
        const done = showAll || i <= upto;
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={0.5} fill={done ? TOKEN_FILL[(twins ? i >> 1 : i) % TOKEN_FILL.length] : "#fff"} stroke={INK} strokeWidth={!showAll && i === upto ? 0.1 : 0.05} />
            <Tx x={p.x} y={p.y} size={0.42}>
              {fa(i + 1)}
            </Tx>
          </g>
        );
      })}
      {teams && (
        <Tx x={cx} y={cy} size={0.36} fill={SOFT}>
          هر خط = یک بازی
        </Tx>
      )}
    </g>
  );
}

// ── Grid of routes ──

interface GridProps {
  a: number;
  b: number;
  cond: GridCond;
  at: [number, number] | null;
  /** Show the number of routes at each node for which `shown` says so. */
  values?: number[][] | null;
  shown?: (x: number, y: number) => boolean;
  route?: number[];
  /** Explore: tap the next node. */
  onNode?: (x: number, y: number) => void;
  box?: [number, number, number, number];
}

export function gridLayout(a: number, b: number, box: [number, number, number, number] = [1.2, 0.8, 13.6, 7.6]) {
  const [bx, by, bw, bh] = box;
  const s = Math.min(bw / a, bh / b, 2.6);
  const x0 = bx + (bw - a * s) / 2;
  const y0 = by + (bh + b * s) / 2;
  return { s, px: (x: number) => r4(x0 + x * s), py: (y: number) => r4(y0 - y * s) };
}

export function GridG({ a, b, cond, at, values, shown, route, onNode, box }: GridProps) {
  const { s, px, py } = gridLayout(a, b, box);
  const nodes = route ? routeNodes(route) : [];
  const end = nodes[nodes.length - 1];
  const next = (x: number, y: number) => !!end && ((x === end[0] + 1 && y === end[1]) || (x === end[0] && y === end[1] + 1));
  const dot = Math.min(0.42, s * 0.24);
  return (
    <g>
      {Array.from({ length: b + 1 }, (_, y) => (
        <line key={`h${y}`} x1={px(0)} y1={py(y)} x2={px(a)} y2={py(y)} stroke={INK} strokeWidth={0.05} />
      ))}
      {Array.from({ length: a + 1 }, (_, x) => (
        <line key={`v${x}`} x1={px(x)} y1={py(0)} x2={px(x)} y2={py(b)} stroke={INK} strokeWidth={0.05} />
      ))}
      {nodes.length > 1 && <polyline points={nodes.map(([x, y]) => `${px(x)},${py(y)}`).join(" ")} fill="none" stroke="#4f46e5" strokeWidth={0.18} strokeLinecap="round" strokeLinejoin="round" />}
      {Array.from({ length: b + 1 }, (_, y) =>
        Array.from({ length: a + 1 }, (_, x) => {
          const blocked = cond === "block" && at && at[0] === x && at[1] === y;
          const star = cond === "through" && at && at[0] === x && at[1] === y;
          const v = values && (!shown || shown(x, y)) ? values[y][x] : null;
          const closed = values && !gridOpen({ cond, at }, x, y);
          const can = onNode && next(x, y);
          return (
            <g key={`${x}-${y}`} onClick={can ? () => onNode!(x, y) : undefined} style={can ? { cursor: "pointer" } : undefined} role={can ? "button" : undefined} aria-label={can ? `برو به گره ${fa(x)}، ${fa(y)}` : undefined}>
              {can && <circle cx={px(x)} cy={py(y)} r={r4(dot * 1.6)} fill="#eef2ff" stroke="#4f46e5" strokeWidth={0.06} strokeDasharray="0.15 0.1" />}
              {can && <circle cx={px(x)} cy={py(y)} r={r4(s * 0.45)} fill="transparent" />}
              {v !== null ? (
                <>
                  <circle cx={px(x)} cy={py(y)} r={r4(dot * 1.15)} fill={closed ? OUT : "#fff"} stroke={closed ? SOFT : INK} strokeWidth={0.04} strokeDasharray={closed ? "0.1 0.08" : undefined} />
                  <Tx x={px(x)} y={py(y)} size={dot * 1.1} fill={closed ? SOFT : INK}>
                    {fa(v)}
                  </Tx>
                </>
              ) : (
                !blocked && !star && <circle cx={px(x)} cy={py(y)} r={r4(dot * 0.35)} fill={INK} />
              )}
              {blocked && (
                <Tx x={px(x) + (v !== null ? dot * 1.3 : 0)} y={py(y) - (v !== null ? dot * 1.3 : 0)} size={dot * 2.2} fill="#c0392b">
                  ✗
                </Tx>
              )}
              {star && (
                <Tx x={px(x) + (v !== null ? dot * 1.3 : 0)} y={py(y) - (v !== null ? dot * 1.3 : 0)} size={dot * 2.2} fill="#c98a00">
                  ★
                </Tx>
              )}
            </g>
          );
        }),
      )}
      {/* Outside the corner nodes, so a number there stays readable. */}
      <Tx x={px(0) - dot * 1.15 - 0.45} y={py(0)} size={0.42}>
        الف
      </Tx>
      <Tx x={px(a) + dot * 1.15 + 0.35} y={py(b)} size={0.42}>
        ب
      </Tx>
    </g>
  );
}

// ── Pigeonhole: colours in columns ──

/** Every ball by colour. `taken[i]` balls of colour i are lifted out (solid); the rest are pale and dashed. */
export function DrawerG({ q, taken, next }: { q: PigeonholeQuestion; taken: number[] | null; next: boolean }) {
  const c = q.counts.length;
  const colW = Math.min(2.4, 10 / c);
  const x0 = 6 - (c * colW) / 2;
  const maxN = Math.max(...q.counts);
  const r = Math.min(0.36, 6.6 / maxN / 2.3);
  const W = taken ? taken.reduce((s, x) => s + x, 0) : 0;
  return (
    <g>
      {q.counts.map((n, i) => {
        const cx = x0 + colW * (i + 0.5);
        const f = COLOUR_FILL[q.colours[i]];
        const name = COLOURS[q.colours[i]];
        return (
          <g key={i}>
            {Array.from({ length: n }, (_, j) => (
              <Token key={j} x={cx} y={7.4 - j * r * 2.3} r={r} fill={f.bg} fg={f.fg} label={initial(name)} faded={taken !== null && j >= taken[i]} />
            ))}
            <Tx x={cx} y={8.3} size={0.34} rtl>
              {`${name} ${fa(n)}`}
            </Tx>
            {taken && taken[i] > 0 && (
              <Tx x={cx} y={7.4 - n * r * 2.3 - 0.1} size={0.3} fill={SOFT}>
                {`برداشته ${fa(taken[i])}`}
              </Tx>
            )}
          </g>
        );
      })}
      {taken && (
        <g>
          <rect x={11.6} y={2.4} width={3.8} height={3.6} rx={0.2} fill={PAPER} stroke={INK} strokeWidth={0.04} />
          <Tx x={13.5} y={3.1} size={0.36} rtl>
            {`برداشته: ${fa(W)} تا`}
          </Tx>
          <Tx x={13.5} y={3.8} size={0.3} fill={SOFT} rtl>
            هنوز نه ✗
          </Tx>
          {next && (
            <>
              <Tx x={13.5} y={4.6} size={0.36} fill={GOOD_LINE} rtl>
                {`بعدی (${fa(W + 1)}): ✓`}
              </Tx>
              <Tx x={13.5} y={5.3} size={0.28} fill={SOFT} rtl>
                هر رنگی بیاید
              </Tx>
            </>
          )}
        </g>
      )}
    </g>
  );
}

// ── Two dice: a 6 × 6 table ──

export function DiceTableG({ q, rows, marks }: { q: ProbabilityQuestion; rows: number; marks: boolean }) {
  const all = cases(q);
  const s = 1.1;
  const x0 = 8 - 3.5 * s;
  const y0 = 0.5;
  const sumCells = q.event.kind === "sum" || q.event.kind === "sumAtLeast";
  return (
    <g>
      <Tx x={x0 + 7 * s + 0.55} y={y0 + 0.5 * s} size={0.3} fill={SOFT} rtl>
        سیاه
      </Tx>
      <Tx x={x0 + 0.5 * s} y={y0 + 7 * s + 0.3} size={0.3} fill={SOFT} rtl>
        سفید
      </Tx>
      {Array.from({ length: 6 }, (_, b) => (
        <g key={`b${b}`}>
          <rect x={r4(x0 + (b + 1) * s + 0.08)} y={r4(y0 + 0.08)} width={r4(s - 0.16)} height={r4(s - 0.16)} rx={0.14} fill={INK} />
          <Tx x={x0 + (b + 1.5) * s} y={y0 + 0.5 * s} size={0.42} fill="#fff">
            {fa(b + 1)}
          </Tx>
        </g>
      ))}
      {Array.from({ length: 6 }, (_, a) => (
        <g key={`a${a}`}>
          <rect x={r4(x0 + 0.08)} y={r4(y0 + (a + 1) * s + 0.08)} width={r4(s - 0.16)} height={r4(s - 0.16)} rx={0.14} fill="#fff" stroke={INK} strokeWidth={0.04} />
          <Tx x={x0 + 0.5 * s} y={y0 + (a + 1.5) * s} size={0.42}>
            {fa(a + 1)}
          </Tx>
        </g>
      ))}
      {all.map((c, i) => {
        const [a, b] = c.pick;
        if (a >= rows) return null;
        const x = x0 + (b + 1) * s;
        const y = y0 + (a + 1) * s;
        const good = marks && c.ok;
        return (
          <g key={i}>
            <rect x={r4(x + 0.04)} y={r4(y + 0.04)} width={r4(s - 0.08)} height={r4(s - 0.08)} fill={good ? GOOD : PAPER} stroke={good ? GOOD_LINE : OUT} strokeWidth={good ? 0.06 : 0.03} />
            <Tx x={x + s / 2} y={y + s / 2 + (good ? 0.12 : 0)} size={0.3} fill={good ? INK : SOFT} weight={good ? 700 : 400}>
              {sumCells ? fa(a + b + 2) : `${fa(a + 1)}،${fa(b + 1)}`}
            </Tx>
            {good && (
              <Tx x={x + s / 2} y={y + 0.24} size={0.24} fill={GOOD_LINE}>
                ✓
              </Tx>
            )}
          </g>
        );
      })}
    </g>
  );
}

// ── Every case, as a gallery ──

/** A small route picture inside a box. */
function MiniRoute({ x, y, w, h, a, b, route, out, at, cond }: { x: number; y: number; w: number; h: number; a: number; b: number; route: number[]; out: boolean; at: [number, number] | null; cond: GridCond }) {
  const s = Math.min((w - 0.5) / a, (h - 0.35) / b);
  const gx = x + (w - a * s) / 2 - 0.12;
  const gy = y + (h + b * s) / 2;
  const px = (v: number) => r4(gx + v * s);
  const py = (v: number) => r4(gy - v * s);
  return (
    <g>
      {Array.from({ length: b + 1 }, (_, j) => (
        <line key={`h${j}`} x1={px(0)} y1={py(j)} x2={px(a)} y2={py(j)} stroke={OUT} strokeWidth={0.025} />
      ))}
      {Array.from({ length: a + 1 }, (_, i) => (
        <line key={`v${i}`} x1={px(i)} y1={py(0)} x2={px(i)} y2={py(b)} stroke={OUT} strokeWidth={0.025} />
      ))}
      <polyline points={routeNodes(route).map(([i, j]) => `${px(i)},${py(j)}`).join(" ")} fill="none" stroke={out ? SOFT : "#4f46e5"} strokeWidth={0.07} strokeDasharray={out ? "0.1 0.08" : undefined} strokeLinejoin="round" />
      {at && cond !== "none" && (
        <Tx x={px(at[0])} y={py(at[1])} size={s * 0.55} fill={cond === "block" ? "#c0392b" : "#c98a00"}>
          {cond === "block" ? "✗" : "★"}
        </Tx>
      )}
    </g>
  );
}

/** All the cases, the first `count` shown; kept ones numbered 1, 2, 3 … */
export function CasesG({ q, count }: { q: CountingQuestion; count: number }) {
  const all: Case[] = cases(q);
  const N = all.length;
  const grid = q.type === "grid";
  const labels = all.map((c) => (grid ? "" : caseLabel(q, c)));
  const longest = Math.max(1, ...labels.map((l) => l.length));
  const cols = grid ? Math.min(6, Math.ceil(Math.sqrt(N * 1.6))) : Math.max(1, Math.min(6, Math.floor(15 / Math.max(1.6, longest * 0.22 + 0.9)), Math.ceil(N / 2)));
  const rows = Math.ceil(N / cols);
  const w = 15.2 / cols;
  const h = Math.min(grid ? 2.2 : 1.1, 8.0 / rows);
  const size = Math.min(0.38, h * 0.42, (w - 0.9) / (longest * 0.55));
  const x0 = 0.4;
  const y0 = 0.9;
  const kept = all.filter((c) => c.ok).length;
  const marks = all.some((c) => !c.ok);
  let num = 0;
  return (
    <g>
      <Tx x={8} y={0.42} size={0.36} rtl>
        {marks ? `همه حالت‌ها ${fa(N)} · ${q.type === "probability" ? "حالت‌های خوب" : "با شرط"} ${fa(kept)} (✓)` : `همه حالت‌ها: ${fa(N)}`}
      </Tx>
      {all.map((c, i) => {
        if (c.ok) num++;
        if (i >= count) return null;
        // Right to left, row by row.
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = x0 + (cols - 1 - col) * w + 0.06;
        const y = y0 + row * h + 0.05;
        const state = marks ? (c.ok ? "ok" : "out") : "plain";
        if (grid && q.type === "grid")
          return (
            <g key={i}>
              <rect x={r4(x)} y={r4(y)} width={r4(w - 0.12)} height={r4(h - 0.1)} rx={0.12} fill={state === "out" ? OUT : state === "ok" ? GOOD : PAPER} stroke={state === "out" ? SOFT : state === "ok" ? GOOD_LINE : INK} strokeWidth={0.035} strokeDasharray={state === "out" ? "0.12 0.1" : undefined} />
              <MiniRoute x={x} y={y} w={w - 0.12} h={h - 0.1} a={q.a} b={q.b} route={c.pick} out={!c.ok} at={q.at} cond={q.cond} />
              <Tx x={x + w - 0.36} y={y + 0.25} size={0.24} fill={state === "out" ? SOFT : GOOD_LINE}>
                {state === "out" ? "✗" : state === "ok" ? "✓" : ""}
              </Tx>
              {c.ok && (
                <Tx x={x + 0.25} y={y + 0.25} size={0.22} fill={SOFT}>
                  {fa(num)}
                </Tx>
              )}
            </g>
          );
        return <Chip key={i} x={x} y={y} w={w - 0.12} h={h - 0.1} label={labels[i]} state={state} size={size} num={c.ok ? fa(num) : undefined} />;
      })}
    </g>
  );
}

// ── Before answering: what the question is about ──

function Slots({ k, y, filled, onSlot, ordered = true }: { k: number; y: number; filled?: (j: number) => ReactNode; onSlot?: (j: number) => void; ordered?: boolean }) {
  const w = Math.min(2, 12 / k);
  const x0 = 8 + (k * w) / 2;
  return (
    <g>
      {Array.from({ length: k }, (_, j) => {
        // Slot 1 on the right.
        const cx = x0 - w * (j + 0.5);
        return (
          <g key={j} onClick={onSlot ? () => onSlot(j) : undefined} style={onSlot ? { cursor: "pointer" } : undefined} role={onSlot ? "button" : undefined} aria-label={onSlot ? `جای ${fa(j + 1)}` : undefined}>
            <rect x={r4(cx - w * 0.4)} y={r4(y - w * 0.4)} width={r4(w * 0.8)} height={r4(w * 0.8)} rx={0.18} fill="#fff" stroke={INK} strokeWidth={0.05} strokeDasharray={ordered ? undefined : "0.15 0.1"} />
            {ordered && (
              <Tx x={cx} y={y + w * 0.4 + 0.3} size={0.3} fill={SOFT}>
                {fa(j + 1)}
              </Tx>
            )}
            {filled?.(j)}
          </g>
        );
      })}
    </g>
  );
}

/** Explore: tokens on top, slots below. */
export function SlotsG({ names, k, placed, ordered, onObject, onSlot }: { names: string[]; k: number; placed: number[]; ordered: boolean; onObject: (i: number) => void; onSlot: (j: number) => void }) {
  const n = names.length;
  const w = Math.min(2.2, 13 / n);
  const sw = Math.min(2, 12 / k);
  const x0 = 8 + (n * w) / 2;
  return (
    <g>
      <Tx x={8} y={0.6} size={0.36} fill={SOFT} rtl>
        روی یک نفر بزن تا در جای خالی بعدی بنشیند
      </Tx>
      {names.map((name, i) => {
        const cx = x0 - w * (i + 0.5);
        const used = placed.includes(i);
        return (
          <g key={i}>
            <Token x={cx} y={2.1} r={Math.min(0.62, w * 0.3)} fill={TOKEN_FILL[i]} label={initial(name)} faded={used} onClick={used ? undefined : () => onObject(i)} title={name} />
            <Tx x={cx} y={3.05} size={0.32} fill={used ? SOFT : INK}>
              {used ? `${name} ✓` : name}
            </Tx>
          </g>
        );
      })}
      <Slots
        k={k}
        y={5.6}
        ordered={ordered}
        onSlot={onSlot}
        filled={(j) => {
          const i = placed[j];
          if (i === undefined) return null;
          const cx = 8 + (k * sw) / 2 - sw * (j + 0.5);
          return <Token x={cx} y={5.6} r={sw * 0.3} fill={TOKEN_FILL[i]} label={initial(names[i])} title={names[i]} />;
        }}
      />
      <Tx x={8} y={7.75} size={0.34} fill={SOFT} rtl>
        {ordered ? "جاها شماره دارند: ترتیب مهم است" : "سبد: ترتیب مهم نیست"}
      </Tx>
    </g>
  );
}

function TreeSetup({ q }: { q: Extract<CountingQuestion, { type: "tree" }> }) {
  if (q.variant === "roads") {
    const A = { x: 13.5, y: 3.4 };
    const B = { x: 8, y: 3.4 };
    const C = { x: 2.5, y: 3.4 };
    const arcs = (p: { x: number; y: number }, r: { x: number; y: number }, n: number, lift: number, key: string) =>
      Array.from({ length: n }, (_, i) => {
        const off = (i - (n - 1) / 2) * 0.55 + lift;
        const mx = (p.x + r.x) / 2;
        const my = p.y + off * 2;
        return (
          <g key={`${key}${i}`}>
            <path d={`M ${p.x} ${p.y} Q ${mx} ${r4(my)} ${r.x} ${r.y}`} fill="none" stroke={INK} strokeWidth={0.05} />
            <circle cx={mx} cy={r4(p.y + off)} r={0.2} fill="#fff" stroke={INK} strokeWidth={0.03} />
            <Tx x={mx} y={p.y + off} size={0.24}>
              {fa(i + 1)}
            </Tx>
          </g>
        );
      });
    return (
      <g>
        {arcs(A, B, q.sizes[0], -0.3, "ab")}
        {arcs(B, C, q.sizes[1], -0.3, "bc")}
        {Array.from({ length: q.sizes[2] }, (_, i) => {
          const y = 6.3 + i * 0.7;
          return (
            <g key={`ac${i}`}>
              <path d={`M ${A.x} ${A.y} L ${A.x} ${y} L ${C.x} ${y} L ${C.x} ${C.y}`} fill="none" stroke={INK} strokeWidth={0.05} strokeDasharray="0.2 0.1" />
              <circle cx={8} cy={y} r={0.2} fill="#fff" stroke={INK} strokeWidth={0.03} />
              <Tx x={8} y={y} size={0.24}>
                {fa(i + 1)}
              </Tx>
            </g>
          );
        })}
        {[
          [A, "الف"],
          [B, "ب"],
          [C, "پ"],
        ].map(([p, name]) => (
          <g key={name as string}>
            <circle cx={(p as { x: number }).x} cy={(p as { y: number }).y} r={0.6} fill="#ffd76a" stroke={INK} strokeWidth={0.06} />
            <Tx x={(p as { x: number }).x} y={(p as { y: number }).y} size={0.42}>
              {name as string}
            </Tx>
          </g>
        ))}
        <Tx x={8} y={8.6} size={0.3} fill={SOFT} rtl>
          خط‌چین: جاده مستقیم از «الف» به «پ»
        </Tx>
      </g>
    );
  }
  const groups =
    q.variant === "either"
      ? [
          { name: "اتوبوس", options: Array.from({ length: q.sizes[0] }, (_, i) => `اتوبوس ${fa(i + 1)}`) },
          { name: "قطار", options: Array.from({ length: q.sizes[1] }, (_, i) => `قطار ${fa(i + 1)}`) },
        ]
      : TREE_GROUPS[q.ctx === "menu" ? "menu" : "outfit"].slice(0, q.sizes.length).map((g, i) => ({ name: g.name, options: g.options.slice(0, q.sizes[i]) }));
  const G = groups.length;
  const colW = 13 / G;
  const cx = (g: number) => 15 - colW * (g + 0.5);
  const oy = (i: number) => 2.2 + i * 1.3;
  return (
    <g>
      {q.forbid && (
        <g>
          <line x1={r4(cx(0))} y1={r4(oy(q.forbid[0]))} x2={r4(cx(1))} y2={r4(oy(q.forbid[1]))} stroke="#c0392b" strokeWidth={0.06} strokeDasharray="0.2 0.12" />
          <circle cx={r4((cx(0) + cx(1)) / 2)} cy={r4((oy(q.forbid[0]) + oy(q.forbid[1])) / 2)} r={0.32} fill="#fff" stroke="#c0392b" strokeWidth={0.05} />
          <Tx x={(cx(0) + cx(1)) / 2} y={(oy(q.forbid[0]) + oy(q.forbid[1])) / 2} size={0.36} fill="#c0392b">
            ✗
          </Tx>
        </g>
      )}
      {groups.map((g, gi) => (
        <g key={gi}>
          <Tx x={cx(gi)} y={1.0} size={0.44} rtl>
            {g.name}
          </Tx>
          {g.options.map((o, i) => (
            <Chip key={i} x={cx(gi) - 1.4} y={oy(i) - 0.45} w={2.8} h={0.9} label={o} state="plain" size={0.36} />
          ))}
          {q.variant === "either" && gi === 0 && (
            <Tx x={8} y={4} size={0.6} fill={SOFT}>
              یا
            </Tx>
          )}
          {q.variant !== "either" && gi < G - 1 && (
            <Tx x={cx(gi) - colW / 2} y={4} size={0.6} fill={SOFT}>
              ×
            </Tx>
          )}
        </g>
      ))}
    </g>
  );
}

function ProbSetup({ q }: { q: ProbabilityQuestion }) {
  const die = (x: number, y: number, dark = false) => (
    <g>
      <rect x={x - 1} y={y - 1} width={2} height={2} rx={0.35} fill={dark ? INK : "#fff"} stroke={INK} strokeWidth={0.06} />
      <Tx x={x} y={y} size={0.9} fill={dark ? "#fff" : INK}>
        ؟
      </Tx>
    </g>
  );
  const coin = (x: number, y: number, r: number) => (
    <g>
      <circle cx={x} cy={y} r={r} fill="#ffd76a" stroke={INK} strokeWidth={0.06} />
      <Tx x={x} y={y - r * 0.2} size={r * 0.42} rtl>
        شیر یا خط
      </Tx>
      <Tx x={x} y={y + r * 0.35} size={r * 0.5}>
        ؟
      </Tx>
    </g>
  );
  switch (q.variant) {
    case "die":
      return (
        <g>
          {die(8, 3.8)}
          <Tx x={8} y={6.4} size={0.4} rtl>
            {`۶ حالت: ${[1, 2, 3, 4, 5, 6].map(fa).join("، ")}`}
          </Tx>
        </g>
      );
    case "bag": {
      const N = q.counts.reduce((s, x) => s + x, 0);
      return (
        <g>
          <path d="M 4.5 2.4 Q 8 1.2 11.5 2.4 L 12.4 7.6 Q 8 8.8 3.6 7.6 Z" fill="#f3e6cf" stroke={INK} strokeWidth={0.06} />
          {Array.from({ length: N }, (_, i) => {
            const c = ballColour(q.counts, i);
            const f = COLOUR_FILL[q.colours[c]];
            return <Token key={i} x={8 + (i - (N - 1) / 2) * 1.25} y={5} r={0.52} fill={f.bg} fg={f.fg} label={initial(COLOURS[q.colours[c]])} title={COLOURS[q.colours[c]]} />;
          })}
        </g>
      );
    }
    case "coins2":
      return (
        <g>
          {coin(10, 4.2, 1.5)}
          {coin(5.6, 4.4, 1.1)}
        </g>
      );
    case "coins3":
      return (
        <g>
          {coin(11.5, 4.2, 1.5)}
          {coin(7.6, 4.4, 1.2)}
          {coin(4.4, 4.6, 0.95)}
        </g>
      );
    case "coinDie":
      return (
        <g>
          {coin(10.2, 4.3, 1.3)}
          {die(5.6, 4.3)}
        </g>
      );
    case "dice2":
      return (
        <g>
          {die(10, 4.3)}
          {die(6, 4.3, true)}
          <Tx x={10} y={6.1} size={0.34} fill={SOFT}>
            سفید
          </Tx>
          <Tx x={6} y={6.1} size={0.34} fill={SOFT}>
            سیاه
          </Tx>
        </g>
      );
  }
}

export function SetupG({ q }: { q: CountingQuestion }) {
  switch (q.type) {
    case "tree":
      return <TreeSetup q={q} />;
    case "arrange":
    case "choose": {
      const names = q.items.map((_, i) => itemName(q, i));
      const n = names.length;
      const w = Math.min(2.2, 13 / n);
      const x0 = 8 + (n * w) / 2;
      const digits = q.type === "arrange" && q.ctx === "digits";
      return (
        <g>
          {names.map((name, i) => {
            const cx = x0 - w * (i + 0.5);
            const special = (q.cond === "together" || q.cond === "notAdjacent" || q.cond === "notBoth" ? i < 2 : q.cond === "atEnd" || q.cond === "must" ? i === 0 : false);
            return (
              <g key={i}>
                {digits ? (
                  <>
                    <rect x={r4(cx - 0.6)} y={1.3} width={1.2} height={1.5} rx={0.16} fill="#fff" stroke={INK} strokeWidth={0.06} />
                    <Tx x={cx} y={2.05} size={0.9}>
                      {name}
                    </Tx>
                  </>
                ) : (
                  <Token x={cx} y={2.05} r={Math.min(0.62, w * 0.3)} fill={TOKEN_FILL[i]} label={initial(name)} title={name} />
                )}
                {!digits && (
                  <Tx x={cx} y={3.05} size={0.32} rtl>
                    {special ? `${name} ★` : name}
                  </Tx>
                )}
              </g>
            );
          })}
          <Slots k={q.k} y={5.5} ordered={q.type === "arrange"} />
          <Tx x={8} y={7.7} size={0.34} fill={SOFT} rtl>
            {q.type === "arrange" ? (digits ? "هر خانه یک رقم؛ خانه ۱ رقم اول است" : "جاها شماره دارند: ترتیب مهم است") : "سبد: ترتیب مهم نیست"}
          </Tx>
        </g>
      );
    }
    case "handshake":
      if (q.variant === "inverse")
        return (
          <g>
            <Tx x={8} y={3.6} size={0.8} rtl>
              {`${fa(q.shakes)} ${q.ctx === "teams" ? "بازی" : "دست‌دادن"}`}
            </Tx>
            <Tx x={8} y={5.2} size={0.6} fill={SOFT} rtl>
              {q.ctx === "teams" ? "چند تیم؟" : "چند نفر؟"}
            </Tx>
          </g>
        );
      return <CircleG n={q.n} twins={q.variant === "twins"} upto={-1} />;
    case "grid":
      return <GridG a={q.a} b={q.b} cond={q.cond} at={q.at} />;
    case "pigeonhole":
      return <DrawerG q={q} taken={null} next={false} />;
    case "probability":
      return <ProbSetup q={q} />;
  }
}

/** Grid with every node's number of routes, for show-me (up to `upto` diagonals). */
export function GridShowG({ q, stage }: { q: Extract<CountingQuestion, { type: "grid" }>; stage: number }) {
  const v = gridValues(q);
  return <GridG a={q.a} b={q.b} cond={q.cond} at={q.at} values={v} shown={(x, y) => x === 0 || y === 0 || x + y <= stage + 1} />;
}

/** Show me: the picture for a step. */
export function ShowG({ q, stage, steps }: { q: CountingQuestion; stage: number; steps: number }) {
  const last = stage >= steps - 1;
  switch (q.type) {
    case "grid":
      return <GridShowG q={q} stage={stage} />;
    case "handshake": {
      const n = q.variant === "inverse" ? q.answer : q.n;
      return <CircleG n={n} twins={q.variant === "twins"} upto={last ? n : stage} all={last} teams={q.ctx === "teams"} />;
    }
    case "pigeonhole": {
      const w = worstCase(q);
      const order = w.map((x, i) => (x ? i : -1)).filter((i) => i >= 0);
      const taken = w.map((x, i) => (order.indexOf(i) >= 0 && order.indexOf(i) <= stage ? x : 0));
      return <DrawerG q={q} taken={taken} next={last} />;
    }
    case "probability":
      if (q.variant === "dice2") return <DiceTableG q={q} rows={Math.min(6, stage + 1)} marks />;
      break;
  }
  // Trees: first branches one by one, then the marks.
  const branches = new Set(cases(q).map((c) => c.pick[0])).size;
  return <TreeG q={q} upto={Math.min(stage, branches - 1)} marks={stage >= branches} />;
}

/** Try, after the answer: every case (or the worst case, or the dice table). `f` reveals them. */
export function AfterG({ q, f }: { q: CountingQuestion; f: number }) {
  if (q.type === "pigeonhole") return <ShowG q={q} stage={f >= 0.99 ? 99 : Math.floor(f * worstCase(q).filter(Boolean).length)} steps={worstCase(q).filter(Boolean).length + 1} />;
  if (q.type === "probability" && q.variant === "dice2") return <DiceTableG q={q} rows={Math.max(1, Math.ceil(f * 6))} marks />;
  const N = cases(q).length;
  return <CasesG q={q} count={Math.max(1, Math.round(f * N))} />;
}

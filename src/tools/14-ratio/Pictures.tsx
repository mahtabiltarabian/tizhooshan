// Bar models in board units (the board is 16 × 9). A block is one equal share;
// shaded blocks get a fill and a pattern (lines, dots or back-lines), so the
// picture reads without colour. Rows run right to left, like Persian text.

import type { ReactNode } from "react";
import type { RatioQuestion, Shape } from "@/generators/ratio";
import { fa } from "@/tools/registry";
import { FracG } from "./Frac";
import { PEOPLE, RATIO_THINGS, percentParts, tankOf } from "./text";

export const INK = "#0f172a";
export type Kind = "A" | "B" | "C";
const FILLS: Record<Kind, { bg: string; line: string }> = {
  A: { bg: "#cfe0ff", line: "#2f6fdb" },
  B: { bg: "#ffe0b8", line: "#b45f00" },
  C: { bg: "#cdeed8", line: "#1f7a43" },
};

/** Hatches: A = lines "/", B = dots, C = lines "\". One per SVG. */
export function Patterns() {
  return (
    <defs>
      <pattern id="r14-A" patternUnits="userSpaceOnUse" width={0.3} height={0.3} patternTransform="rotate(45)">
        <line x1={0.15} y1={0} x2={0.15} y2={0.3} stroke={FILLS.A.line} strokeWidth={0.07} />
      </pattern>
      <pattern id="r14-B" patternUnits="userSpaceOnUse" width={0.26} height={0.26}>
        <circle cx={0.13} cy={0.13} r={0.055} fill={FILLS.B.line} />
      </pattern>
      <pattern id="r14-C" patternUnits="userSpaceOnUse" width={0.3} height={0.3} patternTransform="rotate(-45)">
        <line x1={0.15} y1={0} x2={0.15} y2={0.3} stroke={FILLS.C.line} strokeWidth={0.07} />
      </pattern>
    </defs>
  );
}

const r4 = (v: number) => Math.round(v * 1e4) / 1e4;

interface TxProps {
  x: number;
  y: number;
  size: number;
  children: ReactNode;
  anchor?: "start" | "middle" | "end";
  /** Mixed Persian words and digits: lay them out right to left. */
  rtl?: boolean;
  halo?: boolean;
  fill?: string;
}

export function Tx({ x, y, size, children, anchor = "middle", rtl, halo, fill = INK }: TxProps) {
  // Keep "end" meaning the right edge at x: under direction rtl, SVG swaps start and end.
  const a = rtl && anchor !== "middle" ? (anchor === "end" ? "start" : "end") : anchor;
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      fontWeight={700}
      textAnchor={a}
      dominantBaseline="central"
      fill={fill}
      direction={rtl ? "rtl" : undefined}
      stroke={halo ? "#fff" : undefined}
      strokeWidth={halo ? 4 : undefined}
      paintOrder={halo ? "stroke" : undefined}
      vectorEffect={halo ? "non-scaling-stroke" : undefined}
      pointerEvents="none"
    >
      {children}
    </text>
  );
}

interface CellProps {
  x: number;
  y: number;
  w: number;
  h: number;
  kind?: Kind | null;
  dashed?: boolean;
  onClick?: () => void;
  label?: string;
}

/** One block: white, or filled with a colour and its pattern. */
export function Cell({ x, y, w, h, kind, dashed, onClick, label }: CellProps) {
  return (
    <g onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined} role={onClick ? "button" : undefined} aria-label={label}>
      <rect x={x} y={y} width={w} height={h} fill={kind ? FILLS[kind].bg : "#fff"} stroke={INK} strokeWidth={2} strokeDasharray={dashed ? "6 4" : undefined} vectorEffect="non-scaling-stroke" />
      {kind && <rect x={x} y={y} width={w} height={h} fill={`url(#r14-${kind})`} pointerEvents="none" />}
    </g>
  );
}

/** A curly brace along x1 … x2 at y, its tip pointing up or down, with a label past the tip. */
export function HBrace({ x1, x2, y, up, label, size = 0.42 }: { x1: number; x2: number; y: number; up?: boolean; label: string; size?: number }) {
  const dir = up ? -1 : 1;
  const s = 0.34;
  const m = (x1 + x2) / 2;
  const r = Math.min(0.25, (x2 - x1) / 4);
  const yb = y + (dir * s) / 2;
  const yt = y + dir * s;
  const d = `M${x1},${y} Q${x1},${yb} ${x1 + r},${yb} L${m - r},${yb} Q${m},${yb} ${m},${yt} Q${m},${yb} ${m + r},${yb} L${x2 - r},${yb} Q${x2},${yb} ${x2},${y}`;
  return (
    <g>
      <path d={d} fill="none" stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <Tx x={m} y={yt + dir * size * 0.75} size={size} rtl halo>
        {label}
      </Tx>
    </g>
  );
}

/** A brace on the left of y1 … y2, its tip pointing left, label to the left. */
export function VBrace({ x, y1, y2, label, size = 0.45 }: { x: number; y1: number; y2: number; label: string; size?: number }) {
  const s = 0.34;
  const m = (y1 + y2) / 2;
  const r = Math.min(0.25, (y2 - y1) / 4);
  const xb = x - s / 2;
  const xt = x - s;
  const d = `M${x},${y1} Q${xb},${y1} ${xb},${y1 + r} L${xb},${m - r} Q${xb},${m} ${xt},${m} Q${xb},${m} ${xb},${m + r} L${xb},${y2 - r} Q${xb},${y2} ${x},${y2}`;
  return (
    <g>
      <path d={d} fill="none" stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <Tx x={xt - 0.12} y={m} size={size} anchor="end" halo>
        {label}
      </Tx>
    </g>
  );
}

// ── Bar and circle cut into equal parts ─────────────────────────────────

const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  // Rounded: the server and the browser differ in the last digits of sin and cos.
  const a = (deg * Math.PI) / 180;
  return [r4(cx + r * Math.sin(a)), r4(cy - r * Math.cos(a))];
};

interface ShapeProps {
  shape: Shape;
  parts: number;
  shaded: (i: number) => boolean;
  /** x, y, width, height; a circle sits in the middle. */
  box: [number, number, number, number];
  /** Draw a thick line every `group` parts (2/3 = 4/6: groups of two). */
  group?: number;
  onPart?: (i: number) => void;
  kind?: Kind;
}

export function ShapeG({ shape, parts, shaded, box, group, onPart, kind = "A" }: ShapeProps) {
  const [x, y, w, h] = box;
  const groupLines: ReactNode[] = [];
  if (shape === "bar") {
    const pw = w / parts;
    if (group && group > 1 && group < parts)
      for (let j = group; j < parts; j += group) {
        const lx = r4(x + w - j * pw);
        groupLines.push(<line key={j} x1={lx} y1={y - 0.15} x2={lx} y2={y + h + 0.15} stroke={INK} strokeWidth={6} vectorEffect="non-scaling-stroke" />);
      }
    return (
      <g>
        {Array.from({ length: parts }, (_, i) => (
          <Cell key={i} x={r4(x + w - (i + 1) * pw)} y={y} w={r4(pw)} h={h} kind={shaded(i) ? kind : null} onClick={onPart ? () => onPart(i) : undefined} label={onPart ? `قسمت ${fa(i + 1)}` : undefined} />
        ))}
        <rect x={x} y={y} width={w} height={h} fill="none" stroke={INK} strokeWidth={4} vectorEffect="non-scaling-stroke" pointerEvents="none" />
        {groupLines}
      </g>
    );
  }
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.min(w, h) / 2;
  const slice = (i: number) => {
    if (parts === 1) return `M${cx - r},${cy} A${r},${r} 0 1 1 ${cx + r},${cy} A${r},${r} 0 1 1 ${cx - r},${cy} Z`;
    const [x1, y1] = polar(cx, cy, r, (i * 360) / parts);
    const [x2, y2] = polar(cx, cy, r, ((i + 1) * 360) / parts);
    return `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${parts === 1 ? 1 : 0} 1 ${x2},${y2} Z`;
  };
  if (group && group > 1 && group < parts)
    for (let j = group; j < parts; j += group) {
      const [lx, ly] = polar(cx, cy, r, (j * 360) / parts);
      groupLines.push(<line key={j} x1={cx} y1={cy} x2={lx} y2={ly} stroke={INK} strokeWidth={6} vectorEffect="non-scaling-stroke" />);
    }
  return (
    <g>
      {Array.from({ length: parts }, (_, i) => {
        const d = slice(i);
        const on = shaded(i);
        return (
          <g key={i} onClick={onPart ? () => onPart(i) : undefined} style={onPart ? { cursor: "pointer" } : undefined} role={onPart ? "button" : undefined} aria-label={onPart ? `قسمت ${fa(i + 1)}` : undefined}>
            <path d={d} fill={on ? FILLS[kind].bg : "#fff"} stroke={INK} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {on && <path d={d} fill={`url(#r14-${kind})`} pointerEvents="none" />}
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={INK} strokeWidth={4} vectorEffect="non-scaling-stroke" pointerEvents="none" />
      {groupLines}
    </g>
  );
}

/** A standalone shape (worksheets). */
export function ShapeSvg({ shape, parts, width }: { shape: Shape; parts: number; width: number }) {
  const box: [number, number, number, number] = shape === "bar" ? [0.1, 0.1, 8, 1.4] : [0.1, 0.1, 4, 4];
  const [, , w, h] = box;
  return (
    <svg width={width} height={(width * (h + 0.2)) / (w + 0.2)} viewBox={`0 0 ${w + 0.2} ${h + 0.2}`} style={{ direction: "ltr" }}>
      <ShapeG shape={shape} parts={parts} shaded={() => false} box={box} />
    </svg>
  );
}

// ── One bar of blocks (fraction of a number, percent) ───────────────────

const X0 = 1.2;
const X1 = 13;

interface OneBarProps {
  count: number;
  /** Text in every block (its value), or nothing. */
  value?: string | null;
  /** Blocks shaded, counted from the right. */
  hatched: number;
  /** Extra dashed blocks past the whole (a percent increase). */
  extra?: number;
  top?: string | null;
  topAll?: string | null;
  under?: string | null;
  underRest?: string | null;
  underExtra?: string | null;
  /** Labels at the block edges (percent ruler), from the right. */
  ruler?: string[] | null;
  side?: ReactNode;
}

function OneBar({ count, value, hatched, extra = 0, top, topAll, under, underRest, underExtra, ruler, side }: OneBarProps) {
  const slots = count + extra;
  const bw = (X1 - X0) / slots;
  const y = 3.5;
  const h = 1.3;
  const xi = (i: number) => r4(X1 - (i + 1) * bw);
  const below = y + h + (ruler ? 0.75 : 0.18);
  return (
    <g>
      {Array.from({ length: slots }, (_, i) => (
        <Cell key={i} x={xi(i)} y={y} w={r4(bw)} h={h} kind={i < hatched || i >= count ? "A" : null} dashed={i >= count} />
      ))}
      {value &&
        Array.from({ length: slots }, (_, i) => (
          <Tx key={i} x={r4(xi(i) + bw / 2)} y={y + h / 2} size={Math.min(0.5, bw * 0.42)} halo>
            {value}
          </Tx>
        ))}
      {ruler &&
        ruler.map((t, i) =>
          t ? (
            <g key={i}>
              <line x1={r4(X1 - i * bw)} y1={y + h} x2={r4(X1 - i * bw)} y2={y + h + 0.18} stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke" />
              <Tx x={r4(X1 - i * bw)} y={y + h + 0.42} size={0.27}>
                {t}
              </Tx>
            </g>
          ) : null,
        )}
      {top != null && <HBrace x1={r4(X1 - count * bw)} x2={X1} y={y - 0.12} up label={top} />}
      {topAll != null && <HBrace x1={X0} x2={X1} y={y - 1.15} up label={topAll} />}
      {under != null && hatched > 0 && <HBrace x1={r4(X1 - hatched * bw)} x2={X1} y={below} label={under} />}
      {underRest != null && <HBrace x1={r4(X1 - count * bw)} x2={r4(X1 - hatched * bw)} y={below} label={underRest} />}
      {underExtra != null && extra > 0 && <HBrace x1={X0} x2={r4(X1 - count * bw)} y={below} label={underExtra} />}
      {side}
    </g>
  );
}

// ── Rows of blocks (ratio, sharing) ─────────────────────────────────────

export interface BlockRow {
  name: string;
  count: number;
  kind: Kind;
  up?: string | null;
  down?: string | null;
  /** Brace only over blocks from this one on (the extra blocks of the longer row). */
  braceFrom?: number;
  onBlock?: (i: number) => void;
}

const RX1 = 12.3;

export function RowsG({ rows, value, total, maxCount }: { rows: BlockRow[]; value?: string | null; total?: string | null; maxCount?: number }) {
  const most = Math.max(maxCount ?? 0, ...rows.map((r) => r.count), 1);
  const bw = Math.min(1.9, 10.2 / most);
  const h = 0.95;
  const gap = rows.length === 3 ? 2.15 : 2.3;
  const top = rows.length === 3 ? 1.3 : 2.1;
  const rowY = (i: number) => top + i * gap;
  const widest = Math.max(...rows.map((r) => r.count));
  return (
    <g>
      {rows.map((row, ri) => {
        const y = rowY(ri);
        const from = row.braceFrom ?? 0;
        return (
          <g key={ri}>
            <Tx x={15.6} y={y + h / 2} size={0.4} anchor="end">
              {row.name}
            </Tx>
            {Array.from({ length: row.count }, (_, i) => (
              <Cell key={i} x={r4(RX1 - (i + 1) * bw)} y={y} w={r4(bw)} h={h} kind={row.kind} onClick={row.onBlock ? () => row.onBlock!(i) : undefined} label={row.onBlock ? `بلوک ${fa(i + 1)} از ${row.name}` : undefined} />
            ))}
            {value &&
              Array.from({ length: row.count }, (_, i) => (
                <Tx key={i} x={r4(RX1 - (i + 0.5) * bw)} y={y + h / 2} size={Math.min(0.48, bw * 0.4)} halo>
                  {value}
                </Tx>
              ))}
            {row.up != null && <HBrace x1={r4(RX1 - row.count * bw)} x2={r4(RX1 - from * bw)} y={y - 0.1} up label={row.up} />}
            {row.down != null && <HBrace x1={r4(RX1 - row.count * bw)} x2={r4(RX1 - from * bw)} y={y + h + 0.1} label={row.down} />}
          </g>
        );
      })}
      {total != null && <VBrace x={r4(RX1 - widest * bw - 0.15)} y1={rowY(0)} y2={rowY(rows.length - 1) + h} label={total} />}
    </g>
  );
}

// ── Work: a tank filling hour by hour, and a grid of worker-days ────────

function TankG({ q, hours }: { q: Extract<RatioQuestion, { type: "work" }>; hours: number }) {
  const { cells, per, net } = tankOf(q);
  const drain = q.variant === "drain";
  const [tx, ty, tw, th] = [5.4, 0.9, 3.6, 7.2];
  const ch = th / cells;
  const tap = q.ctx === "tap";
  const time = tap ? "ساعت" : "روز";
  const kinds: Kind[] = ["A", "B", "C"];
  // Who fills which cell: hour by hour, each tap its share (net share when draining).
  const owners: { kind: Kind; hour: number }[] = [];
  for (let hr = 1; hr <= hours && owners.length < cells; hr++) {
    const shares = drain ? [net] : per;
    shares.forEach((c, i) => {
      for (let j = 0; j < c && owners.length < cells; j++) owners.push({ kind: kinds[i], hour: hr });
    });
  }
  const doers = tap ? ["شیر اول", "شیر دوم", "شیر سوم"] : ["علی", "رضا", "مریم"];
  const legend = drain
    ? [
        { kind: "A" as Kind, text: `شیر: ⁦+${fa(per[0])}⁩ خانه در ساعت` },
        { kind: null, text: `سوراخ: ⁦−${fa(per[1])}⁩ خانه در ساعت` },
        { kind: "A" as Kind, text: `هر ساعت: ${fa(net)} خانه` },
      ]
    : per.map((c, i) => ({ kind: kinds[i], text: `${per.length === 1 ? (tap ? "شیر" : "علی") : doers[i]}: ${fa(c)} ${tap ? "خانه" : "تکه"} در ${time}` }));
  const hourMarks: ReactNode[] = [];
  for (let hr = 1; hr <= hours; hr++) {
    const upto = owners.filter((o) => o.hour <= hr).length;
    const prev = owners.filter((o) => o.hour < hr).length;
    if (upto === prev) continue;
    const yTop = r4(ty + th - upto * ch);
    const yMid = r4(ty + th - ((upto + prev) / 2) * ch);
    hourMarks.push(
      <g key={hr}>
        <line x1={tx + tw} y1={yTop} x2={tx + tw + 0.35} y2={yTop} stroke={INK} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
        <Tx x={tx + tw + 0.55} y={yMid} size={Math.min(0.4, Math.max(0.24, (upto - prev) * ch * 0.8))} anchor="start">
          {fa(hr)}
        </Tx>
      </g>,
    );
  }
  const filled = owners.length;
  return (
    <g>
      <Tx x={tx + tw / 2} y={0.45} size={0.4} rtl>
        {tap ? "مخزن" : "دیوار"} · {fa(cells)} {tap ? "خانه" : "تکه"}
      </Tx>
      <Tx x={tx + tw + 0.7} y={0.45} size={0.32}>
        {time}
      </Tx>
      {Array.from({ length: cells }, (_, c) => {
        const o = owners[c];
        return <Cell key={c} x={tx} y={r4(ty + th - (c + 1) * ch)} w={tw} h={r4(ch)} kind={o ? o.kind : null} />;
      })}
      <rect x={tx} y={ty} width={tw} height={th} fill="none" stroke={INK} strokeWidth={4} vectorEffect="non-scaling-stroke" />
      {hourMarks}
      {drain && (
        <g>
          <path d={`M${tx + tw / 2 - 0.25},${ty + th + 0.15} L${tx + tw / 2 + 0.25},${ty + th + 0.15} L${tx + tw / 2},${ty + th + 0.6} Z`} fill={INK} />
          <Tx x={tx + tw / 2 + 0.45} y={ty + th + 0.4} size={0.3} anchor="start" rtl>
            سوراخ
          </Tx>
        </g>
      )}
      {legend.map((l, i) => (
        <g key={i}>
          {l.kind ? <Cell x={15.0} y={1.2 + i * 0.9} w={0.6} h={0.5} kind={l.kind} /> : <path d={`M15.05,${1.2 + i * 0.9} L15.55,${1.2 + i * 0.9} L15.3,${1.7 + i * 0.9} Z`} fill={INK} />}
          <Tx x={14.8} y={1.45 + i * 0.9} size={0.3} anchor="end" rtl>
            {l.text}
          </Tx>
        </g>
      ))}
      {(q.variant === "single" || q.variant === "pairFraction") && hours > 0 && <FracG f={{ n: filled, d: cells }} x={2.8} y={4.5} size={0.75} />}
      {filled >= cells && (
        <Tx x={2.8} y={4.5} size={0.55} rtl>
          پر شد!
        </Tx>
      )}
    </g>
  );
}

function CrewG({ q, step }: { q: Extract<RatioQuestion, { type: "work" }>; step: number }) {
  const [w1, d, w2] = q.crew;
  const ans = q.answer as number;
  const [rows, cols] = step >= 2 ? [w2, ans] : [w1, d];
  const s = Math.min(0.85, 10.5 / Math.max(d, ans), 5.6 / Math.max(w1, w2));
  const right = 12.6;
  const top = 1.4;
  return (
    <g>
      {Array.from({ length: rows * cols }, (_, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        return <Cell key={i} x={r4(right - (c + 1) * s)} y={r4(top + r * s)} w={r4(s)} h={r4(s)} kind={step >= 2 ? "B" : step >= 1 ? "A" : null} />;
      })}
      <Tx x={15.6} y={top + (rows * s) / 2} size={0.42} anchor="end" rtl>
        {fa(rows)} کارگر
      </Tx>
      <HBrace x1={r4(right - cols * s)} x2={right} y={r4(top + rows * s + 0.1)} label={`${fa(cols)} روز`} />
      {step >= 1 && (
        <Tx x={r4(right - (cols * s) / 2)} y={0.7} size={0.42} rtl>
          کل کار: {fa(w1 * d)} خانه
        </Tx>
      )}
    </g>
  );
}

// ── The model of each question, stage by stage ──────────────────────────

/** The bar model of a question at a stage (0 = the setting, last = the answer). */
export function ModelG({ q, step }: { q: RatioQuestion; step: number }) {
  const ask = "؟";
  switch (q.type) {
    case "shade": {
      const { n, d } = q.frac;
      const group = q.parts > d ? q.parts / d : undefined;
      const box: [number, number, number, number] = q.shape === "bar" ? [1.2, 3.2, 11.4, 1.8] : [3.6, 0.7, 7.6, 7.6];
      return (
        <g>
          <ShapeG shape={q.shape} parts={q.parts} shaded={(i) => step >= 2 && i < q.answer} box={box} group={step >= 1 ? group : undefined} />
          <FracG f={{ n, d }} x={14.4} y={4.1} size={0.8} />
          {step >= 2 && <FracG f={{ n: q.answer, d: q.parts }} x={14.4} y={6.6} size={0.55} />}
        </g>
      );
    }
    case "partOf": {
      const { n, d } = q.frac;
      const whole = q.variant === "whole";
      return (
        <OneBar
          count={d}
          hatched={n}
          value={step >= 1 ? fa(q.unit) : null}
          top={whole ? (step >= 2 ? fa(q.whole) : ask) : fa(q.whole)}
          under={whole ? fa(q.part) : step >= 2 ? fa(q.part) : q.variant === "of" ? ask : null}
          underRest={q.variant === "rest" ? (step >= 3 ? fa(q.answer) : ask) : null}
          side={<FracG f={{ n, d }} x={14.5} y={4.15} size={0.7} />}
        />
      );
    }
    case "percent": {
      const { m, step: pstep, blk, j } = percentParts(q);
      const every = m === 20 ? 2 : 1;
      const ruler = Array.from({ length: m + 1 }, (_, i) => (i % every === 0 ? `${fa(i * pstep)}٪` : ""));
      const what = q.variant === "what";
      const up = q.variant === "up";
      return (
        <OneBar
          count={m}
          hatched={up || (what && step < 2) ? 0 : j}
          extra={up ? j : 0}
          value={step >= 1 ? fa(blk) : null}
          top={q.variant === "whole" ? (step >= 2 ? fa(q.whole) : ask) : fa(q.whole)}
          topAll={up ? (step >= 3 ? fa(q.answer) : ask) : null}
          under={up ? null : q.variant === "whole" ? fa(q.part) : what ? (step >= 2 ? fa(q.part) : null) : step >= 2 ? fa(q.part) : q.variant === "of" ? ask : null}
          underRest={q.variant === "off" ? (step >= 3 ? fa(q.answer) : ask) : null}
          underExtra={up ? (step >= 2 ? fa(q.part) : `${fa(q.pct)}٪`) : null}
          ruler={ruler}
          side={
            <Tx x={14.6} y={4.15} size={0.6}>
              {what && step < 2 ? "؟" : `${fa(q.pct)}٪`}
            </Tx>
          }
        />
      );
    }
    case "compare": {
      const [f, g] = q.fracs;
      const L = (f.d * g.d) / gcdN(f.d, g.d);
      const fineOk = f.d !== g.d && L <= 36;
      const bars = [f, g].map((x, i) => {
        const y = i === 0 ? 1.7 : 5.0;
        const [bx, bw] = [1.2, 11];
        const sub = L / x.d;
        const lines: ReactNode[] = [];
        if (step >= 1 && fineOk && sub > 1)
          for (let k = 1; k < L; k++)
            if (k % sub) lines.push(<line key={k} x1={r4(bx + bw - (k * bw) / L)} y1={y} x2={r4(bx + bw - (k * bw) / L)} y2={y + 1.3} stroke={INK} strokeWidth={1.2} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />);
        const bigger = q.answer === i;
        return (
          <g key={i}>
            <ShapeG shape="bar" parts={x.d} shaded={(p) => p < x.n} box={[bx, y, bw, 1.3]} kind={i === 0 ? "A" : "B"} />
            {lines}
            <FracG f={x} x={14.4} y={y + 0.65} size={0.6} />
            {step >= 2 && bigger && (
              <Tx x={bx + 1.2} y={y - 0.35} size={0.38} rtl>
                ★ بزرگ‌تر
              </Tx>
            )}
            {step >= 1 && fineOk && (
              <Tx x={bx + bw - 0.1} y={y + 1.62} size={0.3} anchor="end" rtl>
                {`${fa((x.n * L) / x.d)} از ${fa(L)}`}
              </Tx>
            )}
          </g>
        );
      });
      return (
        <g>
          {bars}
          {step >= 2 && q.answer === 2 && (
            <Tx x={6.7} y={4.0} size={0.5} rtl>
              = برابرند
            </Tx>
          )}
        </g>
      );
    }
    case "ratio": {
      const t = RATIO_THINGS[q.things];
      const [a, b] = q.ratio;
      const k = q.k;
      const diff = q.variant === "diff";
      const rows: BlockRow[] = [
        { name: t.a, count: a, kind: "A", up: diff ? (step >= 3 ? fa(a * k) : ask) : step >= 1 ? fa(a * k) : null },
        {
          name: t.b,
          count: b,
          kind: "B",
          down: diff ? (step >= 1 ? fa((b - a) * k) : null) : q.variant === "other" ? (step >= 3 ? fa(b * k) : ask) : null,
          braceFrom: diff ? a : 0,
        },
      ];
      return <RowsG rows={rows} value={step >= 2 ? fa(k) : null} total={q.variant === "total" ? (step >= 3 ? fa((a + b) * k) : ask) : null} />;
    }
    case "divide": {
      const kinds: Kind[] = ["A", "B", "C"];
      const rows: BlockRow[] = q.ratio.map((r, i) => ({ name: PEOPLE[i], count: r, kind: kinds[i], down: i === q.ask ? (step >= 3 ? fa(q.answer) : ask) : null }));
      return <RowsG rows={rows} value={step >= 2 ? fa(q.k) : null} total={step >= 1 ? fa(q.total) : null} />;
    }
    case "work": {
      if (q.variant === "crew") return <CrewG q={q} step={step} />;
      return <TankG q={q} hours={step} />;
    }
  }
}

const gcdN = (a: number, b: number): number => (b ? gcdN(b, a % b) : a);

/** Before the answer: no picture gives the answer away (compare shows only the fractions). */
export function SetupG({ q }: { q: RatioQuestion }) {
  if (q.type === "compare") {
    const [f, g] = q.fracs;
    return (
      <g>
        <FracG f={f} x={10.6} y={4.4} size={1.3} />
        <Tx x={8} y={4.4} size={1.1}>
          ؟
        </Tx>
        <FracG f={g} x={5.4} y={4.4} size={1.3} />
      </g>
    );
  }
  return <ModelG q={q} step={0} />;
}

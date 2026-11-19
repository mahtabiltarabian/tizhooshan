"use client";

// Drawings for tool 13, in board units: digit cards with the place value
// written under each slot, a row of digit boxes, a hundred chart that marks a
// digit by its place, and matchstick equations.
//
// Marks never rely on colour: on the hundred chart a digit in the ones place
// gets a square, in the tens place a bar under it, in the hundreds place a
// circle. A lifted matchstick is raised and outlined; an empty spot is dashed.
//
// Matchstick digits are the Western seven-segment shapes of the puzzle books
// (see src/generators/digits.ts); they are drawings, so they stay Western.
// Everything else on the board is in Persian digits.

import { PLACE_NAMES, slotKinds, type SlotKind } from "@/generators/digits";
import { fa } from "@/tools/registry";

export const INK = "#1f2430";
const SOFT = "#5b6170";
const CARD = "#ffffff";
const MARK = "#ffc93d";
const TENS = "#9fc3ff";

const r2 = (v: number) => Math.round(v * 1000) / 1000;

// ── Digit cards ──────────────────────────────────────────────────────────

export const CARD_W = 1.5;
export const CARD_H = 2;
const CARD_GAP = 0.35;

/** Left edge of card i in a centred row of n. */
export const rowX = (cx: number, n: number, i: number) => r2(cx - (n * CARD_W + (n - 1) * CARD_GAP) / 2 + i * (CARD_W + CARD_GAP));

function Card({ x, y, d, dashed, faded, onClick, label }: { x: number; y: number; d: number | null; dashed?: boolean; faded?: boolean; onClick?: () => void; label?: string }) {
  return (
    <g onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined} role={onClick ? "button" : undefined} aria-label={label}>
      <rect
        x={x}
        y={y}
        width={CARD_W}
        height={CARD_H}
        rx={0.18}
        fill={d === null ? "#f7f2e8" : CARD}
        stroke={d === null || faded ? "#b9ad98" : INK}
        strokeWidth={d === null || faded ? 1.5 : 2.5}
        strokeDasharray={dashed ? "6 4" : undefined}
        vectorEffect="non-scaling-stroke"
        opacity={faded ? 0.5 : 1}
      />
      {d !== null && (
        <text x={x + CARD_W / 2} y={y + CARD_H / 2 + 0.05} fontSize={1.25} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} opacity={faded ? 0.35 : 1}>
          {fa(d)}
        </text>
      )}
    </g>
  );
}

interface CardsProps {
  /** Digits in the number slots, left to right; null is an empty slot. */
  slots: (number | null)[];
  /** The cards in hand, and which are already in a slot. */
  hand?: number[];
  used?: boolean[];
  onHand?: (i: number) => void;
  onSlot?: (i: number) => void;
  /** Write each slot's place and value under it. */
  places?: boolean;
  cx: number;
  y: number;
  handY?: number;
  caption?: string;
}

/** A number made of cards (read left to right), with the hand of cards below. */
export function CardsG({ slots, hand, used, onHand, onSlot, places = true, cx, y, handY, caption }: CardsProps) {
  const n = slots.length;
  return (
    <g>
      {slots.map((d, i) => {
        const x = rowX(cx, n, i);
        const p = n - 1 - i;
        return (
          <g key={`s${i}`}>
            <Card x={x} y={y} d={d} dashed={d === null} onClick={onSlot && d !== null ? () => onSlot(i) : undefined} label={d !== null ? `برگرداندن ${fa(d)}` : undefined} />
            {places && (
              <>
                <text x={x + CARD_W / 2} y={y + CARD_H + 0.38} fontSize={0.3} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={SOFT}>
                  {PLACE_NAMES[p]}
                </text>
                <text x={x + CARD_W / 2} y={y + CARD_H + 0.8} fontSize={0.34} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
                  {d === null ? "…" : fa(d * 10 ** p)}
                </text>
              </>
            )}
          </g>
        );
      })}
      {caption && (
        <text x={cx} y={y - 0.45} fontSize={0.4} fontWeight={700} textAnchor="middle" direction="rtl" dominantBaseline="central" fill={INK}>
          {caption}
        </text>
      )}
      {hand && handY !== undefined && (
        <>
          <line x1={rowX(cx, hand.length, 0) - 0.3} x2={rowX(cx, hand.length, hand.length - 1) + CARD_W + 0.3} y1={handY - 0.35} y2={handY - 0.35} stroke="#cfc6b6" strokeWidth={2} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          {hand.map((d, i) => (
            <Card key={`h${i}`} x={rowX(cx, hand.length, i)} y={handY} d={d} faded={used?.[i]} onClick={onHand && !used?.[i] ? () => onHand(i) : undefined} label={`کارت ${fa(d)}`} />
          ))}
        </>
      )}
    </g>
  );
}

// ── A row of boxes and signs (sums, a number with a hole) ────────────────

export type RowItem = { box: string; hole?: boolean } | { sign: string };

export function RowG({ items, cx, y, size = 1.2 }: { items: RowItem[]; cx: number; y: number; size?: number }) {
  const w = (it: RowItem) => ("box" in it ? size : size * 0.7);
  const total = items.reduce((s, it) => s + w(it), 0) + (items.length - 1) * size * 0.12;
  // Left edge of each item: the widths of the ones before it.
  const lefts = items.map((_, i) => r2(cx - total / 2 + items.slice(0, i).reduce((s, it) => s + w(it) + size * 0.12, 0)));
  return (
    <g>
      {items.map((it, i) => {
        const x0 = lefts[i];
        if ("sign" in it)
          return (
            <text key={i} x={r2(x0 + w(it) / 2)} y={y + size * 0.62} fontSize={size * 0.7} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
              {it.sign}
            </text>
          );
        return (
          <g key={i}>
            <rect x={x0} y={y} width={size} height={size * 1.25} rx={size * 0.12} fill={it.hole ? "#fff1c2" : CARD} stroke={INK} strokeWidth={it.hole ? 3 : 2} strokeDasharray={it.hole ? "6 4" : undefined} vectorEffect="non-scaling-stroke" />
            <text x={r2(x0 + size / 2)} y={r2(y + size * 0.66)} fontSize={size * 0.8} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
              {it.box}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ── Hundred chart ────────────────────────────────────────────────────────

export const CHART_CELL = 0.8;

/**
 * The numbers base … base + 99 in rows of ten (left to right, like numbers).
 * Phase 1 marks the digit in the ones place, 2 adds the tens, 3 the hundreds.
 * Numbers outside 1 … n are faint.
 */
export function HundredChartG({ digit, n, base, phase, x, y }: { digit: number; n: number; base: number; phase: number; x: number; y: number }) {
  const cells: React.ReactNode[] = [];
  const fs = base >= 100 ? 0.24 : 0.3;
  // Digit spacing: wide enough that a circle around one digit leaves its neighbours clear.
  const dw = fs * (base >= 100 ? 0.8 : 0.66);
  for (let r = 0; r < 10; r++)
    for (let c = 0; c < 10; c++) {
      const k = base + r * 10 + c;
      const cx = x + c * CHART_CELL;
      const cy = y + r * CHART_CELL;
      const live = k >= 1 && k <= n;
      const s = String(k);
      const left = cx + CHART_CELL / 2 - (s.length * dw) / 2;
      const marks: React.ReactNode[] = [];
      let hit = false;
      s.split("").forEach((ch, j) => {
        const place = s.length - 1 - j;
        if (!live || Number(ch) !== digit || place >= phase) return;
        hit = true;
        const mx = r2(left + j * dw);
        const my = cy + CHART_CELL / 2;
        if (place === 0) marks.push(<rect key={j} x={mx - 0.02} y={r2(my - fs * 0.55)} width={r2(dw + 0.04)} height={r2(fs * 1.1)} fill={MARK} stroke={INK} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />);
        else if (place === 1) marks.push(<rect key={j} x={mx} y={r2(my - fs * 0.55)} width={r2(dw)} height={r2(fs * 1.1)} fill={TENS} />, <line key={`u${j}`} x1={mx} x2={r2(mx + dw)} y1={r2(my + fs * 0.62)} y2={r2(my + fs * 0.62)} stroke={INK} strokeWidth={3} vectorEffect="non-scaling-stroke" />);
        else marks.push(<circle key={j} cx={r2(mx + dw / 2)} cy={my} r={r2(dw * 0.56)} fill="none" stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke" />);
      });
      cells.push(
        <g key={k}>
          <rect x={cx + 0.03} y={cy + 0.03} width={CHART_CELL - 0.06} height={CHART_CELL - 0.06} rx={0.06} fill={hit ? "#fffaf0" : "#fff"} stroke="#cfc6b6" strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={live ? 1 : 0.35} />
          {marks}
          {s.split("").map((ch, j) => (
            <text key={j} x={r2(left + j * dw + dw / 2)} y={cy + CHART_CELL / 2 + 0.02} fontSize={fs} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} opacity={live ? 1 : 0.3}>
              {fa(ch)}
            </text>
          ))}
        </g>,
      );
    }
  return <g>{cells}</g>;
}

/** Key to the chart marks, as a small drawing per place. */
export function ChartKeyG({ x, y, phase }: { x: number; y: number; phase: number }) {
  const rows: [string, React.ReactNode][] = [
    ["یکان", <rect key="o" x={x} y={y - 0.15} width={0.3} height={0.3} fill={MARK} stroke={INK} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />],
    ["دهگان", <line key="t" x1={x} x2={x + 0.3} y1={y + 0.15} y2={y + 0.15} stroke={INK} strokeWidth={3} vectorEffect="non-scaling-stroke" />],
    ["صدگان", <circle key="h" cx={x + 0.15} cy={y} r={0.17} fill="none" stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke" />],
  ];
  return (
    <g>
      {rows.map(([name, icon], i) => (
        <g key={name} transform={`translate(0 ${i * 0.55})`} opacity={i < phase ? 1 : 0.35}>
          {icon}
          <text x={x + 0.5} y={y} fontSize={0.3} fontWeight={700} dominantBaseline="central" fill={INK}>
            {name}
          </text>
        </g>
      ))}
    </g>
  );
}

// ── Matchsticks ──────────────────────────────────────────────────────────

/** A stick spot: slot index and segment bit. */
export type Spot = [number, number];
type Seg = [number, number, number, number];

export const SLOT_W = 1;
export const SLOT_H = 2;
const IN_NUMBER = 0.45;
const BETWEEN = 0.8;
const END = 0.1;

/** Segment ends in a slot of width 1 and height 2. */
const DIGIT_SEGS: Record<number, Seg> = {
  1: [0, 0, 1, 0],
  2: [1, 0, 1, 1],
  4: [1, 1, 1, 2],
  8: [0, 2, 1, 2],
  16: [0, 1, 0, 2],
  32: [0, 0, 0, 1],
  64: [0, 1, 1, 1],
};
const SIGN_SEGS: Record<number, Seg> = { 1: [0, 1, 1, 1], 2: [0.5, 0.5, 0.5, 1.5] };
const EQUALS_SEGS: Record<number, Seg> = { 1: [0, 0.72, 1, 0.72], 2: [0, 1.28, 1, 1.28] };

const segsOf = (kind: SlotKind) => (kind === "sign" ? SIGN_SEGS : kind === "equals" ? EQUALS_SEGS : DIGIT_SEGS);

/** Left edges of the slots, and the total width. */
export function slotXs(lens: [number, number, number]) {
  const kinds = slotKinds(lens);
  const xs: number[] = [];
  let x = 0;
  kinds.forEach((k, i) => {
    xs.push(r2(x));
    const sameNumber = (k === "digit" || k === "lead") && (kinds[i + 1] === "digit" || kinds[i + 1] === "lead");
    x += SLOT_W + (sameNumber ? IN_NUMBER : BETWEEN);
  });
  return { xs, width: r2(x - BETWEEN) };
}

/** Where a spot's stick lies, shortened a little at the ends so sticks do not touch. */
export function spotLine(lens: [number, number, number], [slot, bit]: Spot): Seg {
  const kinds = slotKinds(lens);
  const [x1, y1, x2, y2] = segsOf(kinds[slot])[bit];
  const x0 = slotXs(lens).xs[slot];
  const dx = x2 === x1 ? 0 : END;
  const dy = y2 === y1 ? 0 : END;
  return [r2(x0 + x1 + dx), r2(y1 + dy), r2(x0 + x2 - dx), r2(y2 - dy)];
}

/** Every spot a stick may lie in ("=" sticks included; they never move). */
export function allSpots(lens: [number, number, number]): Spot[] {
  return slotKinds(lens).flatMap((k, i) => Object.keys(segsOf(k)).map((b) => [i, Number(b)] as Spot));
}

function Stick({ seg, lifted, faint }: { seg: Seg; lifted?: boolean; faint?: boolean }) {
  const [x1, y1, x2, y2] = seg;
  // The head sits at the right or bottom end.
  return (
    <g opacity={faint ? 0.45 : 1}>
      {lifted && <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={0.26} strokeLinecap="round" />}
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#d9a65a" strokeWidth={0.15} strokeLinecap="round" />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#a8742e" strokeWidth={0.04} strokeLinecap="round" strokeOpacity={0.5} />
      <circle cx={x2} cy={y2} r={0.1} fill="#a8322a" />
    </g>
  );
}

export interface Flying {
  from: Spot;
  to: Spot;
  /** 0 … 1 along the way. */
  t: number;
}

interface MatchProps {
  lens: [number, number, number];
  masks: number[];
  x: number;
  y: number;
  /** Stick being carried (drawn raised and outlined). */
  lifted?: Spot | null;
  onStick?: (s: Spot) => void;
  onSpot?: (s: Spot) => void;
  /** Show empty spots as dashed outlines. */
  spots?: boolean;
  /** Sticks on their way, drawn between their two spots and lifted in an arc. */
  flying?: Flying[];
  /** Spots to point out (where the moved sticks land). */
  marks?: Spot[];
}

export function MatchG({ lens, masks, x, y, lifted, onStick, onSpot, spots, flying = [], marks = [] }: MatchProps) {
  const kinds = slotKinds(lens);
  const items: React.ReactNode[] = [];
  for (const [slot, bit] of allSpots(lens)) {
    const seg = spotLine(lens, [slot, bit]);
    const on = (masks[slot] & bit) !== 0;
    const fixed = kinds[slot] === "equals";
    const isLifted = lifted && lifted[0] === slot && lifted[1] === bit;
    const key = `${slot}-${bit}`;
    const [x1, y1, x2, y2] = seg;
    if (on) {
      const up = isLifted ? -0.22 : 0;
      items.push(
        <g key={key} transform={up ? `translate(0 ${up})` : undefined} onClick={onStick && !fixed ? () => onStick([slot, bit]) : undefined} style={onStick && !fixed ? { cursor: "pointer" } : undefined}>
          <Stick seg={seg} lifted={!!isLifted} />
          {onStick && !fixed && <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={0.45} strokeLinecap="round" />}
        </g>,
      );
    } else if (!fixed && (spots || marks.some((m) => m[0] === slot && m[1] === bit))) {
      const marked = marks.some((m) => m[0] === slot && m[1] === bit);
      items.push(
        <g key={key} onClick={onSpot ? () => onSpot([slot, bit]) : undefined} style={onSpot ? { cursor: "pointer" } : undefined}>
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={marked ? INK : "#b9ad98"} strokeWidth={marked ? 0.05 : 0.035} strokeDasharray="0.1 0.08" strokeLinecap="round" />
          {onSpot && <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={0.45} strokeLinecap="round" />}
        </g>,
      );
    }
  }
  const flights = flying
    .filter((f) => f.t > 0 && f.t < 1)
    .map((f, i) => {
      const a = spotLine(lens, f.from);
      const b = spotLine(lens, f.to);
      const lift = -0.9 * Math.sin(Math.PI * f.t);
      const seg = a.map((v, j) => r2(v + (b[j] - v) * f.t + (j % 2 ? lift : 0))) as Seg;
      return <Stick key={`f${i}`} seg={seg} lifted />;
    });
  return (
    <g transform={`translate(${x} ${y})`}>
      {items}
      {flights}
    </g>
  );
}

/** Spots whose stick leaves, and where each lands, paired so the sticks travel least. */
export function stickMoves(lens: [number, number, number], start: number[], end: number[]): [Spot, Spot][] {
  const from: Spot[] = [];
  const to: Spot[] = [];
  start.forEach((m, i) => {
    for (let b = 1; b < 128; b <<= 1) {
      if (m & b && !(end[i] & b)) from.push([i, b]);
      if (!(m & b) && end[i] & b) to.push([i, b]);
    }
  });
  const mid = (s: Spot) => {
    const [x1, y1, x2, y2] = spotLine(lens, s);
    return [(x1 + x2) / 2, (y1 + y2) / 2];
  };
  const dist = (a: Spot, b: Spot) => Math.hypot(mid(a)[0] - mid(b)[0], mid(a)[1] - mid(b)[1]);
  const k = Math.min(from.length, to.length);
  if (k === 2 && dist(from[0], to[1]) + dist(from[1], to[0]) < dist(from[0], to[0]) + dist(from[1], to[1])) to.reverse();
  return from.slice(0, k).map((s, i) => [s, to[i]]);
}

/** Sticks part of the way (f = 0 … 1) from one arrangement to another, one move after the other. */
export function moveFrame(lens: [number, number, number], start: number[], end: number[], f: number) {
  const moves = stickMoves(lens, start, end);
  const masks = [...start];
  const flying: Flying[] = moves.map(([from, to], i) => {
    const t = Math.min(1, Math.max(0, f * moves.length - i));
    if (t > 0) masks[from[0]] &= ~from[1];
    if (t >= 1) masks[to[0]] |= to[1];
    return { from, to, t };
  });
  return { masks, flying, marks: moves.map(([, to]) => to) };
}

/** Board view that fits a matchstick equation (with room above for flying sticks). */
export function matchView(lens: [number, number, number]): [number, number, number, number] {
  const { width } = slotXs(lens);
  return [-0.9, -1.4, width + 1.8, SLOT_H + 2.4];
}

/** A standalone matchstick equation (worksheets). */
export function MatchSvg({ lens, masks, width }: { lens: [number, number, number]; masks: number[]; width: number }) {
  const { width: w } = slotXs(lens);
  const vb = [-0.3, -0.3, w + 0.6, SLOT_H + 0.6];
  return (
    <svg width={width} height={(width * vb[3]) / vb[2]} viewBox={vb.join(" ")} style={{ direction: "ltr" }}>
      <MatchG lens={lens} masks={masks} x={0} y={0} />
    </svg>
  );
}

/** Cards as a small standalone picture (worksheets). */
export function CardsSvg({ cards, height }: { cards: number[]; height: number }) {
  const n = cards.length;
  const w = n * CARD_W + (n - 1) * CARD_GAP;
  return (
    <svg height={height} width={(height * (w + 0.2)) / (CARD_H + 0.2)} viewBox={`-0.1 -0.1 ${w + 0.2} ${CARD_H + 0.2}`} style={{ direction: "ltr" }}>
      <CardsG slots={cards} places={false} cx={w / 2} y={0} />
    </svg>
  );
}

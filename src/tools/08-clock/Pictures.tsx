"use client";

// A clock face and a week calendar, in board units. The hour hand is short
// and wide, the minute hand long and thin with a round tail, so they differ
// without colour. A clock can be drawn as seen in a mirror, numbers and all.

import { useRef } from "react";
import { angleBetween, dateOf, handAngles, MONTHS, WEEKDAYS } from "@/generators/clock";
import { fa } from "@/tools/registry";

export const INK = "#0f172a";
export const MINUTE = "#2f6fdb";
const WEDGE = "#ffc93d";

const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  // Rounded: the server and the browser differ in the last digits of sin and cos.
  const a = (deg * Math.PI) / 180;
  const round = (v: number) => Math.round(v * 1e4) / 1e4;
  return [round(cx + r * Math.sin(a)), round(cy - r * Math.cos(a))];
};

/** Clockwise wedge between two directions, the short way round. */
function wedgePath(cx: number, cy: number, r: number, a: number, b: number) {
  let from = a;
  let sweep = (((b - a) % 360) + 360) % 360;
  if (sweep > 180) {
    from = b;
    sweep = 360 - sweep;
  }
  const [x1, y1] = polar(cx, cy, r, from);
  const [x2, y2] = polar(cx, cy, r, from + sweep);
  return { d: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2} Z`, mid: from + sweep / 2 };
}

interface ClockProps {
  /** Minutes past 12:00; fractions move the hands smoothly. */
  t: number;
  cx: number;
  cy: number;
  r: number;
  mirrored?: boolean;
  /** Horizontal scale of the face, -1 (mirror) … 1, to show a mirror image turning back. */
  squash?: number;
  /** Shade the angle between the hands and write it. */
  wedge?: boolean;
  caption?: string;
  /** Hands that can be dragged: the minute hand moves the hour hand with it. */
  onTime?: (t: number) => void;
  /** Hide the hands (a blank face to set). */
  noHands?: boolean;
  dim?: boolean;
}

export function ClockG({ t, cx, cy, r, mirrored, squash, wedge, caption, onTime, noHands, dim }: ClockProps) {
  const sx = squash ?? (mirrored ? -1 : 1);
  const { hour, minute } = handAngles(t);
  const drag = useRef<{ hand: "hour" | "minute"; last: number; t: number } | null>(null);

  const angleAt = (e: React.PointerEvent<SVGElement>) => {
    const el = e.currentTarget as unknown as SVGGraphicsElement;
    const svg = el.ownerSVGElement;
    const ctm = (svg ?? el).getScreenCTM();
    if (!ctm) return 0;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return (Math.atan2(p.x - cx, -(p.y - cy)) * 180) / Math.PI;
  };
  const down = (hand: "hour" | "minute", e: React.PointerEvent<SVGElement>) => {
    if (!onTime) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { hand, last: angleAt(e), t };
  };
  const move = (e: React.PointerEvent<SVGElement>) => {
    const d = drag.current;
    if (!d || !onTime) return;
    const a = angleAt(e);
    const delta = ((a - d.last + 540) % 360) - 180;
    d.last = a;
    d.t += d.hand === "minute" ? delta / 6 : delta * 2;
    onTime(Math.round(d.t));
  };
  const up = () => (drag.current = null);

  const ticks = [];
  for (let i = 0; i < 60; i++) {
    const big = i % 5 === 0;
    const [x1, y1] = polar(cx, cy, r * (big ? 0.86 : 0.91), i * 6);
    const [x2, y2] = polar(cx, cy, r * 0.96, i * 6);
    ticks.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={big ? 2.5 : 1} vectorEffect="non-scaling-stroke" />);
  }
  const numbers = Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    const [x, y] = polar(cx, cy, r * 0.72, n * 30);
    return (
      <text key={n} x={x} y={y} fontSize={r * 0.2} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
        {fa(n)}
      </text>
    );
  });

  const w = wedge ? wedgePath(cx, cy, r * 0.5, hour, minute) : null;
  const [lx, ly] = w ? polar(cx, cy, r * 0.36, sx < 0 ? -w.mid : w.mid) : [0, 0];
  const grab = onTime ? { cursor: "grab", touchAction: "none" as const } : undefined;

  return (
    <g opacity={dim ? 0.45 : 1}>
      <g transform={sx !== 1 ? `translate(${cx} 0) scale(${sx} 1) translate(${-cx} 0)` : undefined}>
        <circle cx={cx} cy={cy} r={r} fill="#fff" stroke={INK} strokeWidth={3} vectorEffect="non-scaling-stroke" />
        {sx < 0 && <circle cx={cx} cy={cy} r={r * 1.04} fill="none" stroke="#9fc3ff" strokeWidth={6} strokeDasharray="2 5" vectorEffect="non-scaling-stroke" />}
        {ticks}
        {numbers}
        {w && <path d={w.d} fill={WEDGE} fillOpacity={0.75} stroke={INK} strokeWidth={1} vectorEffect="non-scaling-stroke" />}
        {!noHands && (
          <g onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
            {/* Hour: short, wide. */}
            <g transform={`rotate(${hour} ${cx} ${cy})`} onPointerDown={(e) => down("hour", e)} style={grab}>
              {onTime && <rect x={cx - r * 0.12} y={cy - r * 0.55} width={r * 0.24} height={r * 0.6} fill="transparent" />}
              <path d={`M${cx - r * 0.055},${cy + r * 0.08} L${cx - r * 0.055},${cy - r * 0.4} L${cx},${cy - r * 0.5} L${cx + r * 0.055},${cy - r * 0.4} L${cx + r * 0.055},${cy + r * 0.08} Z`} fill={INK} />
            </g>
            {/* Minute: long, thin, round tail. */}
            <g transform={`rotate(${minute} ${cx} ${cy})`} onPointerDown={(e) => down("minute", e)} style={grab}>
              {onTime && <rect x={cx - r * 0.1} y={cy - r * 0.86} width={r * 0.2} height={r * 0.6} fill="transparent" />}
              <line x1={cx} y1={cy + r * 0.14} x2={cx} y2={cy - r * 0.8} stroke={MINUTE} strokeWidth={r * 0.035} strokeLinecap="round" />
              <circle cx={cx} cy={cy + r * 0.16} r={r * 0.05} fill={MINUTE} />
              <path d={`M${cx - r * 0.05},${cy - r * 0.72} L${cx},${cy - r * 0.86} L${cx + r * 0.05},${cy - r * 0.72} Z`} fill={MINUTE} />
            </g>
          </g>
        )}
        <circle cx={cx} cy={cy} r={r * 0.04} fill="#fff" stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </g>
      {w && (
        <text x={lx} y={ly} fontSize={r * 0.15} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} stroke="#fff" strokeWidth={4} paintOrder="stroke" vectorEffect="non-scaling-stroke">
          {fa(Math.round(angleBetween(t) * 10) / 10)}°
        </text>
      )}
      {caption && (
        <text x={cx} y={cy + r + r * 0.22} fontSize={r * 0.15} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
          {caption}
        </text>
      )}
    </g>
  );
}

/** A standalone clock (options, worksheets). */
export function ClockSvg({ t, size, mirrored, noHands }: { t: number; size: number; mirrored?: boolean; noHands?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="-1.06 -1.06 2.12 2.12" style={{ direction: "ltr" }}>
      <ClockG t={t} cx={0} cy={0} r={1} mirrored={mirrored} noHands={noHands} />
    </svg>
  );
}

/** Persian time "۳:۰۵". */
export function timeFa(t: number) {
  const w = ((Math.round(t) % 720) + 720) % 720;
  const h = Math.floor(w / 60) || 12;
  return `${fa(h)}:${fa(String(w % 60).padStart(2, "0"))}`;
}

/** "۲ ساعت و ۱۵ دقیقه" */
export function durationFa(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${fa(m)} دقیقه`;
  return m ? `${fa(h)} ساعت و ${fa(m)} دقیقه` : `${fa(h)} ساعت`;
}

// ── Week calendar ────────────────────────────────────────────────────────

export const CELL = 1;
const HEAD = 0.55;

interface WeekProps {
  /** Weekday (0 = Saturday) of day 0. */
  weekday: number;
  /** Days shown, as offsets from day 0 (negative = before). */
  lo: number;
  hi: number;
  /** Day of the year of day 0, to write dates; otherwise days are numbered from 0. */
  doy?: number;
  /** Solar Hijri year of day 0, so each Esfand has its right length; without one, every year is common. */
  year?: number;
  /** The day the question asks about (offset). */
  target?: number;
  /** Write "؟" on the target until it is shown. */
  hideTarget?: boolean;
  /** Hops from day 0 to the target, 0 … 1: whole weeks first, then single days. */
  hops?: number;
  x: number;
  y: number;
  onDay?: (offset: number) => void;
}

/** Rows of the calendar: whole weeks, with long runs of weeks folded into one row. */
export function weekRows(weekday: number, lo: number, hi: number) {
  const rowOf = (k: number) => Math.floor((weekday + k) / 7);
  const first = rowOf(lo);
  const last = rowOf(hi);
  const all = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  if (all.length <= 8) return all.map((r) => ({ row: r as number | null, skipped: 0 }));
  const keep = [...all.slice(0, 3), ...all.slice(-3)];
  return [...keep.slice(0, 3).map((r) => ({ row: r as number | null, skipped: 0 })), { row: null, skipped: all.length - 6 }, ...keep.slice(3).map((r) => ({ row: r as number | null, skipped: 0 }))];
}

export const weekHeight = (weekday: number, lo: number, hi: number) => HEAD + weekRows(weekday, lo, hi).length * CELL;

export function WeekG({ weekday, lo, hi, doy, year, target, hideTarget, hops, x, y, onDay }: WeekProps) {
  const rows = weekRows(weekday, lo, hi);
  const where = new Map<number, [number, number]>();
  const cells: React.ReactNode[] = [];
  rows.forEach(({ row, skipped }, i) => {
    const top = y + HEAD + i * CELL;
    if (row === null) {
      cells.push(
        <text key={`gap${i}`} x={x + 3.5 * CELL} y={top + CELL / 2} fontSize={0.34} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill="#5b6476">
          ⋮ {fa(skipped)} هفته کامل ⋮
        </text>,
      );
      return;
    }
    for (let c = 0; c < 7; c++) {
      const k = row * 7 + c - weekday;
      if (k < lo || k > hi) continue;
      // Saturday on the right, like a Persian calendar.
      const cx = x + (6 - c) * CELL;
      where.set(k, [cx + CELL / 2, top + CELL / 2]);
      const date = doy !== undefined ? dateOf(doy + k, year) : null;
      const isTarget = k === target;
      const isStart = k === 0;
      cells.push(
        <g key={k} onClick={onDay ? () => onDay(k) : undefined} style={onDay ? { cursor: "pointer" } : undefined}>
          <rect
            x={cx + 0.04}
            y={top + 0.04}
            width={CELL - 0.08}
            height={CELL - 0.08}
            rx={0.1}
            fill={isStart ? "#eef2ff" : isTarget && !hideTarget ? "#fff1c2" : "#fff"}
            stroke={isStart || isTarget ? INK : "#cfc6b6"}
            strokeWidth={isStart || isTarget ? 2.5 : 1}
            strokeDasharray={isTarget && hideTarget ? "4 3" : undefined}
            vectorEffect="non-scaling-stroke"
          />
          {date?.d === 1 && (
            <text x={cx + CELL / 2} y={top + 0.2} fontSize={0.17} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill="#c0392b">
              ۱ {MONTHS[date.m].name}
            </text>
          )}
          <text x={cx + CELL / 2} y={top + CELL / 2 + 0.05} fontSize={0.36} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
            {isTarget && hideTarget ? "؟" : date ? fa(date.d) : fa(Math.abs(k))}
          </text>
          {isStart && (
            <text x={cx + CELL / 2} y={top + CELL - 0.15} fontSize={0.15} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
              ● شروع
            </text>
          )}
          {isTarget && !hideTarget && (
            <text x={cx + CELL / 2} y={top + CELL - 0.15} fontSize={0.15} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
              ★ جواب
            </text>
          )}
        </g>,
      );
    }
  });

  // Hops: one arc per whole week (same column), then one per single day.
  const arcs: React.ReactNode[] = [];
  if (target !== undefined && hops !== undefined && hops > 0) {
    const dir = target < 0 ? -1 : 1;
    const weeks = Math.floor(Math.abs(target) / 7);
    const rest = Math.abs(target) % 7;
    const steps = [...Array.from({ length: weeks }, () => 7 * dir), ...Array.from({ length: rest }, () => dir)];
    const shown = Math.round(hops * steps.length);
    let k = 0;
    steps.slice(0, shown).forEach((s, i) => {
      const a = where.get(k);
      const b = where.get(k + s);
      k += s;
      if (!a || !b) return;
      const week = Math.abs(s) === 7;
      const bend = week ? 0.45 : 0.4;
      const [mx, my] = week ? [(a[0] + b[0]) / 2 + bend, (a[1] + b[1]) / 2] : [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - bend];
      arcs.push(
        <path
          key={i}
          d={`M${a[0]},${a[1]} Q${mx},${my} ${b[0]},${b[1]}`}
          fill="none"
          stroke={week ? MINUTE : "#c0392b"}
          strokeWidth={week ? 3 : 2.5}
          strokeDasharray={week ? undefined : "5 3"}
          markerEnd="url(#hop-head)"
          vectorEffect="non-scaling-stroke"
        />,
      );
    });
  }

  return (
    <g>
      <defs>
        <marker id="hop-head" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={5} markerHeight={5} orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 Z" fill={INK} />
        </marker>
      </defs>
      {WEEKDAYS.map((name, c) => (
        <text key={name} x={x + (6 - c) * CELL + CELL / 2} y={y + HEAD / 2} fontSize={0.2} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={c === 6 ? "#c0392b" : INK}>
          {name}
        </text>
      ))}
      {cells}
      {arcs}
    </g>
  );
}

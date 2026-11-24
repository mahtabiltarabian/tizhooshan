"use client";

// The balance scale, its weights, coins and age bars, in board units. Each
// symbol has its own shape (circle, triangle, square), so colour is only a
// help. The beam tips with a damped spring towards an angle set by the sign
// and size of the weight difference; the spring runs in an effect, never in
// render, and every trig-derived coordinate is rounded so the server and the
// browser draw the same thing.

import { useEffect, useRef, useState } from "react";
import { fa } from "@/tools/registry";

export const INK = "#0f172a";
const SOFT = "#5b6476";
const METAL = "#8a7f6c";
export const SYM_FILL = ["#2f6fdb", "#f08c00", "#2b9348"];
const BLOCK_FILL = "#64748b";
const COIN_FILL = "#e9c46a";

const r4 = (v: number) => Math.round(v * 1e4) / 1e4;

/** Something on a pan. A fruit with a count above 1 is a pile ("×۱۲"). */
export type Item = { sym: number } | { w: number } | { coin: number } | { pile: number } | { fruit: number; count?: number };

export interface ItemView {
  item: Item;
  /** Being taken off both pans. */
  crossed?: boolean;
  /** About to be replaced (dashed ring). */
  ring?: boolean;
  /** Put there by the child (can be tapped off). */
  mine?: boolean;
  /** Coin label, e.g. group letter. */
  tag?: string;
}

// ── Shapes ──────────────────────────────────────────────────────────────

/** A symbol centred on (x, y); `s` is the slot size. */
export function SymbolG({ sym, x, y, s, ring, crossed }: { sym: number; x: number; y: number; s: number; ring?: boolean; crossed?: boolean }) {
  const h = s * 0.42;
  // vector-effect is not inherited, so each shape carries its own stroke.
  const paint = { fill: SYM_FILL[sym] ?? INK, stroke: INK, strokeWidth: 2, vectorEffect: "non-scaling-stroke" as const };
  const shape =
    sym === 0 ? (
      <circle cx={x} cy={y} r={h} {...paint} />
    ) : sym === 1 ? (
      <path d={`M${r4(x)},${r4(y - h * 1.05)} L${r4(x + h * 1.1)},${r4(y + h * 0.85)} L${r4(x - h * 1.1)},${r4(y + h * 0.85)} Z`} {...paint} />
    ) : (
      <rect x={x - h * 0.9} y={y - h * 0.9} width={h * 1.8} height={h * 1.8} rx={h * 0.12} {...paint} />
    );
  return (
    <g opacity={crossed ? 0.45 : 1}>
      {shape}
      {ring && <circle cx={x} cy={y} r={s * 0.5} fill="none" stroke={INK} strokeWidth={2} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
      {crossed && <Cross x={x} y={y} r={s * 0.42} />}
    </g>
  );
}

function Cross({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g stroke="#c0392b" strokeLinecap="round">
      <line x1={x - r} y1={y - r} x2={x + r} y2={y + r} strokeWidth={3} vectorEffect="non-scaling-stroke" />
      <line x1={x + r} y1={y - r} x2={x - r} y2={y + r} strokeWidth={3} vectorEffect="non-scaling-stroke" />
    </g>
  );
}

/** A numbered weight: a trapezoid with a handle. */
export function BlockG({ value, x, y, s, crossed, ring }: { value: number | string; x: number; y: number; s: number; crossed?: boolean; ring?: boolean }) {
  const wide = String(value).length > 1;
  const w = s * (wide ? 0.5 : 0.46);
  const top = y - s * 0.3;
  const bot = y + s * 0.42;
  return (
    <g opacity={crossed ? 0.45 : 1}>
      <path d={`M${x - w * 0.28},${top} Q${x},${top - s * 0.22} ${x + w * 0.28},${top}`} fill="none" stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <path d={`M${x - w * 0.7},${top} L${x + w * 0.7},${top} L${x + w},${bot} L${x - w},${bot} Z`} fill={BLOCK_FILL} stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <text x={x} y={(top + bot) / 2 + s * 0.02} fontSize={s * (wide ? 0.37 : 0.4)} fontWeight={700} fill="#fff" textAnchor="middle" dominantBaseline="central">
        {typeof value === "number" ? fa(value) : value}
      </text>
      {ring && <circle cx={x} cy={y} r={s * 0.55} fill="none" stroke={INK} strokeWidth={2} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
      {crossed && <Cross x={x} y={y + s * 0.05} r={s * 0.4} />}
    </g>
  );
}

export function CoinG({ x, y, r, tag, out, fake }: { x: number; y: number; r: number; tag?: string; out?: boolean; fake?: boolean }) {
  return (
    <g opacity={out ? 0.35 : 1}>
      <circle cx={x} cy={y} r={r} fill={COIN_FILL} stroke={INK} strokeWidth={fake ? 3.5 : 1.5} vectorEffect="non-scaling-stroke" />
      <circle cx={x} cy={y} r={r * 0.72} fill="none" stroke={INK} strokeWidth={0.8} strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />
      {tag && (
        <text x={x} y={y + r * 0.05} fontSize={r * 1.05} fontWeight={700} fill={INK} textAnchor="middle" dominantBaseline="central">
          {tag}
        </text>
      )}
      {fake && (
        <text x={x} y={y - r * 1.7} fontSize={r * 1.2} fontWeight={700} fill={INK} textAnchor="middle" dominantBaseline="central">
          ★
        </text>
      )}
      {out && <line x1={x - r} y1={y + r} x2={x + r} y2={y - r} stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke" />}
    </g>
  );
}

/** Exchange goods (apple, pear, pomegranate, melon): each its own outline; colour only helps. */
export const FRUIT_FILL = ["#e05a47", "#e8c547", "#9b3a6b", "#c9d86a"];

export function FruitG({ fruit, x, y, s, ring, crossed }: { fruit: number; x: number; y: number; s: number; ring?: boolean; crossed?: boolean }) {
  const h = s * 0.42;
  const P = (dx: number, dy: number) => `${r4(x + dx * h)},${r4(y + dy * h)}`;
  const paint = { fill: FRUIT_FILL[fruit] ?? INK, stroke: INK, strokeWidth: 2, vectorEffect: "non-scaling-stroke" as const };
  const thin = { fill: "none", stroke: INK, strokeWidth: 1.5, vectorEffect: "non-scaling-stroke" as const };
  let shape: React.ReactNode;
  if (fruit === 0)
    // Apple: two lobes, a stem and a leaf.
    shape = (
      <>
        <path d={`M${P(0, -0.55)} C${P(0.5, -1.05)} ${P(1.15, -0.6)} ${P(1, 0.15)} C${P(0.9, 0.8)} ${P(0.4, 1)} ${P(0, 0.85)} C${P(-0.4, 1)} ${P(-0.9, 0.8)} ${P(-1, 0.15)} C${P(-1.15, -0.6)} ${P(-0.5, -1.05)} ${P(0, -0.55)} Z`} {...paint} />
        <path d={`M${P(0, -0.55)} L${P(0.12, -1.05)}`} {...thin} />
        <ellipse cx={r4(x + 0.42 * h)} cy={r4(y - 0.95 * h)} rx={0.28 * h} ry={0.13 * h} fill="#4c9a2a" stroke={INK} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      </>
    );
  else if (fruit === 1)
    // Pear: narrow top, round bottom.
    shape = (
      <>
        <path d={`M${P(0, -0.95)} C${P(0.35, -0.95)} ${P(0.42, -0.5)} ${P(0.5, -0.2)} C${P(1, 0.15)} ${P(0.95, 1)} ${P(0, 1)} C${P(-0.95, 1)} ${P(-1, 0.15)} ${P(-0.5, -0.2)} C${P(-0.42, -0.5)} ${P(-0.35, -0.95)} ${P(0, -0.95)} Z`} {...paint} />
        <path d={`M${P(0, -0.95)} L${P(0.1, -1.25)}`} {...thin} />
      </>
    );
  else if (fruit === 2)
    // Pomegranate: round with a crown.
    shape = (
      <>
        <circle cx={x} cy={r4(y + 0.12 * h)} r={0.86 * h} {...paint} />
        <path d={`M${P(-0.34, -0.62)} L${P(-0.42, -1.08)} L${P(-0.14, -0.84)} L${P(0, -1.14)} L${P(0.14, -0.84)} L${P(0.42, -1.08)} L${P(0.34, -0.62)} Z`} {...paint} />
      </>
    );
  else
    // Melon: a wide oval with stripes.
    shape = (
      <>
        <ellipse cx={x} cy={y} rx={1.15 * h} ry={0.8 * h} {...paint} />
        <path d={`M${P(-1.0, -0.38)} Q${P(0, -0.05)} ${P(1.0, -0.38)} M${P(-1.0, 0.38)} Q${P(0, 0.05)} ${P(1.0, 0.38)}`} {...thin} />
      </>
    );
  return (
    <g opacity={crossed ? 0.45 : 1}>
      {shape}
      {ring && <circle cx={x} cy={y} r={s * 0.55} fill="none" stroke={INK} strokeWidth={2} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
      {crossed && <Cross x={x} y={y} r={s * 0.42} />}
    </g>
  );
}

export function ItemG({ v, x, y, s }: { v: ItemView; x: number; y: number; s: number }) {
  const it = v.item;
  if ("fruit" in it) {
    if (!it.count || it.count <= 1) return <FruitG fruit={it.fruit} x={x} y={y} s={s} ring={v.ring} crossed={v.crossed} />;
    // A pile: one fruit and its count, two slots wide.
    return (
      <g>
        {v.ring && <rect x={x - s} y={y - s * 0.5} width={2 * s} height={s} rx={s * 0.2} fill="none" stroke={INK} strokeWidth={2} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
        <FruitG fruit={it.fruit} x={x - s * 0.45} y={y} s={s * 0.95} crossed={v.crossed} />
        <text x={x + s * 0.5} y={y + s * 0.04} fontSize={s * 0.42} fontWeight={700} fill={INK} textAnchor="middle" dominantBaseline="central">
          {`×${fa(it.count)}`}
        </text>
      </g>
    );
  }
  if ("sym" in it) return <SymbolG sym={it.sym} x={x} y={y} s={s} ring={v.ring} crossed={v.crossed} />;
  if ("w" in it) return <BlockG value={it.w} x={x} y={y} s={s} ring={v.ring} crossed={v.crossed} />;
  if ("coin" in it) return <CoinG x={x} y={y} r={s * 0.4} tag={v.tag} />;
  // A pile of coins with its count.
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <ellipse key={i} cx={x - s * 0.4} cy={y + s * 0.3 - i * s * 0.22} rx={s * 0.42} ry={s * 0.16} fill={COIN_FILL} stroke={INK} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      ))}
      <text x={x + s * 0.45} y={y + s * 0.1} fontSize={s * 0.42} fontWeight={700} fill={INK} textAnchor="middle" dominantBaseline="central">
        {`${fa(it.pile)}${v.tag ? ` ${v.tag}` : ""}`}
      </text>
    </g>
  );
}

/** Slots an item takes on a pan (a pile is wide). */
const slots = (it: Item) => ("pile" in it || ("fruit" in it && (it.count ?? 1) > 1) ? 2 : 1);

// ── The scale ───────────────────────────────────────────────────────────

export const ARM = 3; // half beam, in u
export const HANG = 1.7; // beam end to pan rim
export const PAN = 1.35; // half pan
export const SLOT = 0.64;
const PER_ROW = 4;

/** Where the items sit: rows from the rim upwards, each row centred. */
function placeItems(items: ItemView[], u: number) {
  const s = SLOT * u;
  const rows: ItemView[][] = [[]];
  let used = 0;
  for (const v of items) {
    const n = slots(v.item);
    if (used + n > PER_ROW) {
      rows.push([]);
      used = 0;
    }
    rows[rows.length - 1].push(v);
    used += n;
  }
  const out: { v: ItemView; dx: number; dy: number; i: number }[] = [];
  let i = 0;
  rows.forEach((row, r) => {
    const width = row.reduce((t, v) => t + slots(v.item), 0) * s;
    let x = -width / 2;
    for (const v of row) {
      const w = slots(v.item) * s;
      out.push({ v, dx: x + w / 2, dy: -s / 2 - r * s * 1.02 - 0.03 * u, i: i++ });
      x += w;
    }
  });
  return out;
}

interface BalanceProps {
  cx: number;
  cy: number;
  u: number;
  /** Beam angle in degrees; positive: the right pan goes down. */
  angle: number;
  left: ItemView[];
  right: ItemView[];
  label?: string;
  focus?: boolean;
  locked?: boolean;
  /** Draw a "?" on this empty pan. */
  ask?: "left" | "right";
  onItem?: (side: "left" | "right", index: number) => void;
  /** Half beam in u (shorter on paper). */
  arm?: number;
}

export function BalanceG({ cx, cy, u, angle, left, right, label, focus, locked, ask, onItem, arm = ARM }: BalanceProps) {
  const a = (angle * Math.PI) / 180;
  const ex = r4(arm * u * Math.cos(a));
  const ey = r4(arm * u * Math.sin(a));
  const ends = { left: [r4(cx - ex), r4(cy - ey)], right: [r4(cx + ex), r4(cy + ey)] } as const;
  const ground = cy + 3.15 * u;
  const lw = 2.5;

  const pan = (side: "left" | "right", items: ItemView[]) => {
    const [x, y] = ends[side];
    const rim = r4(y + HANG * u);
    const p = PAN * u;
    return (
      <g key={side}>
        <line x1={x} y1={y} x2={x - p} y2={rim} stroke={METAL} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        <line x1={x} y1={y} x2={x + p} y2={rim} stroke={METAL} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        <circle cx={x} cy={y} r={0.07 * u} fill={INK} />
        {placeItems(items, u).map(({ v, dx, dy, i }) => (
          <g
            key={i}
            onClick={onItem && v.mine ? () => onItem(side, i) : undefined}
            style={onItem && v.mine ? { cursor: "pointer" } : undefined}
          >
            <ItemG v={v} x={r4(x + dx)} y={r4(rim + dy)} s={SLOT * u} />
          </g>
        ))}
        {ask === side && items.length === 0 && (
          <text x={x} y={rim - 0.5 * u} fontSize={0.7 * u} fontWeight={700} fill={SOFT} textAnchor="middle" dominantBaseline="central">
            ؟
          </text>
        )}
        <path d={`M${r4(x - p)},${rim} Q${x},${r4(rim + 0.5 * u)} ${r4(x + p)},${rim} Z`} fill="#d9cfbd" stroke={INK} strokeWidth={lw} vectorEffect="non-scaling-stroke" />
      </g>
    );
  };

  // Needle and its dial: the needle points straight up when the scale is level.
  const nx = r4(cx + 0.95 * u * Math.sin(a));
  const ny = r4(cy - 0.95 * u * Math.cos(a));
  const tick = (deg: number, len: number) => {
    const t = (deg * Math.PI) / 180;
    return (
      <line
        key={deg}
        x1={r4(cx + 1.05 * u * Math.sin(t))}
        y1={r4(cy - 1.05 * u * Math.cos(t))}
        x2={r4(cx + (1.05 + len) * u * Math.sin(t))}
        y2={r4(cy - (1.05 + len) * u * Math.cos(t))}
        stroke={INK}
        strokeWidth={deg === 0 ? 3 : 1.5}
        vectorEffect="non-scaling-stroke"
      />
    );
  };

  return (
    <g>
      {label && (
        <text x={cx} y={cy - 1.75 * u} fontSize={0.36 * u} fontWeight={700} fill={INK} textAnchor="middle" dominantBaseline="central">
          {focus ? `◀ ${label} ▶` : label}
        </text>
      )}
      {/* Stand */}
      <path d={`M${cx - 0.9 * u},${ground} L${cx - 0.5 * u},${ground - 0.32 * u} L${cx + 0.5 * u},${ground - 0.32 * u} L${cx + 0.9 * u},${ground} Z`} fill={METAL} stroke={INK} strokeWidth={lw} vectorEffect="non-scaling-stroke" />
      <rect x={cx - 0.1 * u} y={cy} width={0.2 * u} height={ground - 0.32 * u - cy} fill={METAL} stroke={INK} strokeWidth={lw} vectorEffect="non-scaling-stroke" />
      {[-15, -10, -5, 0, 5, 10, 15].map((d) => tick(d, d === 0 ? 0.28 : 0.15))}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={INK} strokeWidth={2.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {pan("left", left)}
      {pan("right", right)}
      {/* Beam */}
      <line x1={ends.left[0]} y1={ends.left[1]} x2={ends.right[0]} y2={ends.right[1]} stroke={INK} strokeWidth={0.16 * u} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={0.16 * u} fill="#fff" stroke={INK} strokeWidth={lw} vectorEffect="non-scaling-stroke" />
      {locked && (
        <g>
          <path d={`M${cx - 0.13 * u},${cy + 0.5 * u} v${-0.12 * u} a${0.13 * u},${0.13 * u} 0 0 1 ${0.26 * u},0 v${0.12 * u}`} fill="none" stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          <rect x={cx - 0.2 * u} y={cy + 0.5 * u} width={0.4 * u} height={0.3 * u} rx={0.04 * u} fill="#ffc93d" stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          <text x={cx} y={ground + 0.3 * u} fontSize={0.26 * u} fontWeight={700} fill={INK} textAnchor="middle" dominantBaseline="central">
            قفل است
          </text>
        </g>
      )}
    </g>
  );
}

// ── Physics ─────────────────────────────────────────────────────────────

export const MAX_TILT = 14;

/** Resting angle for a weight difference (right − left): the sign says which pan goes down. */
export function tiltFor(diff: number) {
  if (diff === 0) return 0;
  return Math.sign(diff) * Math.round((4 + (MAX_TILT - 4) * (1 - Math.exp(-Math.abs(diff) / 4))) * 100) / 100;
}

const OMEGA = 6.5; // rad/s
const ZETA = 0.22; // light damping: a few swings, then rest

/** A damped spring from the current angle to `target`. */
export function useSpring(target: number) {
  const [angle, setAngle] = useState(target);
  const state = useRef({ a: target, v: 0 });
  useEffect(() => {
    const s = state.current;
    if (s.a === target && s.v === 0) return;
    const still = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let last = -1;
    const tick = (now: number) => {
      const dt = last < 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
      last = now;
      if (still) [s.a, s.v] = [target, 0];
      else
        for (let i = 0; i < 4; i++) {
          const h = dt / 4;
          s.v += (-OMEGA * OMEGA * (s.a - target) - 2 * ZETA * OMEGA * s.v) * h;
          s.a += s.v * h;
        }
      if (Math.abs(s.a - target) < 0.03 && Math.abs(s.v) < 0.2) [s.a, s.v] = [target, 0];
      setAngle(Math.round(s.a * 100) / 100);
      if (s.a !== target || s.v !== 0) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return angle;
}

/** A balance whose beam swings to `target`. */
export function LiveBalance(p: Omit<BalanceProps, "angle"> & { target: number }) {
  const angle = useSpring(p.target);
  return <BalanceG {...p} angle={angle} />;
}

/** Where scales go on a 16-wide board, and how big. Up to four. */
export function layoutOf(count: number): { cx: number; cy: number; u: number }[] {
  if (count === 1) return [{ cx: 8, cy: 2.6, u: 1.25 }];
  if (count === 2)
    return [
      { cx: 12, cy: 1.85, u: 0.85 },
      { cx: 4, cy: 1.85, u: 0.85 },
    ];
  const top = [
    { cx: 12, cy: 1.75, u: 0.8 },
    { cx: 4, cy: 1.75, u: 0.8 },
  ];
  if (count === 3) return [...top, { cx: 8, cy: 6.0, u: 0.8 }];
  return [...top, { cx: 12, cy: 6.0, u: 0.8 }, { cx: 4, cy: 6.0, u: 0.8 }];
}

/** Height of the scales' area for a layout. */
export const scalesHeight = (count: number) => (count === 1 ? 7.1 : count === 2 ? 5.0 : 9.0);

/** A standalone level scale with a short beam (worksheets). */
export function BalanceSvg({ left, right, width, ask }: { left: ItemView[]; right: ItemView[]; width: number; ask?: "left" | "right" }) {
  const arm = 2.2;
  const rows = Math.max(1, ...[left, right].map((items) => Math.ceil(items.reduce((t, v) => t + slots(v.item), 0) / PER_ROW)));
  const top = Math.min(-1.4, HANG - rows * SLOT * 1.02 - 0.15);
  const half = arm + PAN + 0.1;
  const h = 3.25 - top;
  return (
    <svg width={width} height={Math.round((width * h) / (2 * half))} viewBox={`${-half} ${top} ${2 * half} ${h}`} style={{ direction: "ltr" }}>
      <BalanceG cx={0} cy={0} u={1} angle={0} left={left} right={right} ask={ask} arm={arm} />
    </svg>
  );
}

// ── Coins ───────────────────────────────────────────────────────────────

/** Coins in rows (right to left, like reading), with a tag per coin. */
export function CoinRow({ n, x, y, width, out, tagOf, fake }: { n: number; x: number; y: number; width: number; out: (i: number) => boolean; tagOf: (i: number) => string | undefined; fake?: number }) {
  const per = n <= 12 ? n : n <= 40 ? Math.ceil(n / 2) : 20;
  const step = Math.min(1.1, width / per);
  const r = step * 0.4;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const row = Math.floor(i / per);
        const col = i % per;
        const cx = r4(x + width - (width - per * step) / 2 - (col + 0.5) * step);
        const cy = r4(y + row * step * 1.05 + r);
        return <CoinG key={i} x={cx} y={cy} r={r} tag={tagOf(i)} out={out(i)} fake={fake === i} />;
      })}
    </g>
  );
}

export const coinRowsHeight = (n: number, width: number) => {
  const per = n <= 12 ? n : n <= 40 ? Math.ceil(n / 2) : 20;
  const step = Math.min(1.1, width / per);
  return Math.ceil(n / per) * step * 1.05;
};

// ── Age bars ────────────────────────────────────────────────────────────

export interface Part {
  years: number;
  /** "unit": one of the equal pieces; "extra": a number of years (hatched). */
  kind: "unit" | "extra";
  label: string;
  crossed?: boolean;
}

export interface BarRow {
  name: string;
  parts: Part[];
}

/** Bars from the right edge leftwards; equal units have equal length. */
export function BarsG({ rows, x, y, width, scale, caption }: { rows: BarRow[]; x: number; y: number; width: number; scale: number; caption?: string }) {
  const h = 0.75;
  const gap = 0.55;
  const nameW = 3.2;
  const right = x + width - nameW;
  return (
    <g>
      <defs>
        <pattern id="bar-hatch" width={0.22} height={0.22} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={0.22} height={0.22} fill="#fff1c2" />
          <line x1={0} y1={0} x2={0} y2={0.22} stroke={INK} strokeWidth={0.05} />
        </pattern>
      </defs>
      {rows.map((row, i) => {
        const top = y + i * (h + gap);
        let at = right;
        return (
          <g key={i}>
            <text x={x + width - 0.05} y={top + h / 2} fontSize={0.36} fontWeight={700} fill={INK} textAnchor="start" dominantBaseline="central" style={{ direction: "rtl" }}>
              {row.name}
            </text>
            {row.parts.map((p, j) => {
              const w = r4(p.years * scale);
              at = r4(at - w);
              return (
                <g key={j} opacity={p.crossed ? 0.45 : 1}>
                  <rect x={at} y={top} width={w} height={h} fill={p.kind === "unit" ? "#eef2ff" : "url(#bar-hatch)"} stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke" />
                  <text x={at + w / 2} y={top + h / 2} fontSize={Math.min(0.36, w * 0.45)} fontWeight={700} fill={INK} textAnchor="middle" dominantBaseline="central">
                    {p.label}
                  </text>
                  {p.crossed && <Cross x={at + w / 2} y={top + h / 2} r={Math.min(w, h) * 0.4} />}
                </g>
              );
            })}
          </g>
        );
      })}
      {caption && (
        <text x={x + width / 2} y={y + rows.length * (h + gap) + 0.3} fontSize={0.36} fontWeight={700} fill={INK} textAnchor="middle" dominantBaseline="central" style={{ direction: "rtl" }}>
          {caption}
        </text>
      )}
    </g>
  );
}

export const barsHeight = (rows: number) => rows * 1.3 + 0.8;

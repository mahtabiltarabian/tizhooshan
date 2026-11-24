"use client";

// Tool 20 drawings, in board units. A queue faces the counter on the right
// (first place nearest it); a ranking stands from the most on the right; a
// building counts floors from the bottom; tables seat everyone facing the
// middle, with "راست" and "چپ" written at the hands of the sitter at the top.
// A family tree draws men as squares and women as rounded pills.
//
// People are name tokens. Tap a name, then a place (or drag it there); tap a
// placed name and then the strip of names below to take it back.

import { useRef, useState, type ReactNode } from "react";
import type { Arrangement, FPerson } from "@/generators/seating";
import { fa } from "@/tools/registry";
import { ordinal, rankWords } from "./text";

export const INK = "#0f172a";
export const SOFT = "#5b6476";
const ACCENT = "#4f46e5";
const GOOD = "#1d8a55";
const BAD = "#b3261e";
const PAPER = "#fffaf0";
const TABLE = "#d9b98c";

export const TW = 1.75;
export const TH = 0.72;

/** Rounded: the server and the browser differ in the last digits of sin and cos. */
const r4 = (v: number) => Math.round(v * 1e4) / 1e4;

export interface Spot {
  x: number;
  y: number;
}

export interface Geometry {
  view: [number, number, number, number];
  /** Where each place is. Family trees: male / female outline. */
  seats: (Spot & { male?: boolean })[];
  /** Where each person waits before being placed. */
  bank: Spot[];
  /** Top of the strip of waiting names (null: no strip). */
  bankTop: number | null;
  /** Words under or beside the places. */
  labels: { x: number; y: number; text: string; anchor?: "start" | "middle" | "end"; size?: number; weight?: number }[];
}

function bankRow(n: number, y: number, step = 1.95): Spot[] {
  return Array.from({ length: n }, (_, i) => ({ x: r4(8 + ((n - 1) / 2 - i) * step), y }));
}

/** Where everything goes for an arrangement of n people. */
export function geometryOf(q: Pick<Arrangement, "kind" | "n" | "attr">, withBank = true): Geometry {
  const { kind, n } = q;
  const lab: Geometry["labels"] = [];
  switch (kind) {
    case "queue": {
      const seats = Array.from({ length: n }, (_, p) => ({ x: r4(13.3 - p * 1.95), y: 3.2 }));
      seats.forEach((s, p) => lab.push({ x: s.x, y: 4.35, text: p === 0 ? "اول" : p === n - 1 ? "آخر" : ordinal(p), size: 0.32 }));
      return { view: [0, 0, 16, withBank ? 7.2 : 4.6], seats, bank: bankRow(n, 6.2), bankTop: withBank ? 5.45 : null, labels: lab };
    }
    case "rank": {
      const seats = Array.from({ length: n }, (_, p) => ({ x: r4(13.3 - p * 1.95), y: r4(5 - barHeight(p, n) - 0.5) }));
      const w = rankWords(q.attr);
      seats.forEach((s, p) => lab.push({ x: s.x, y: 5.45, text: p === 0 ? w.most : p === n - 1 ? w.least : fa(p + 1), size: p === 0 || p === n - 1 ? 0.28 : 0.34 }));
      return { view: [0, 0, 16, withBank ? 7.6 : 5.9], seats, bank: bankRow(n, 6.75), bankTop: withBank ? 6.05 : null, labels: lab };
    }
    case "floors": {
      const fh = floorHeight(n);
      const seats = Array.from({ length: n }, (_, p) => ({ x: 10, y: r4(1.3 + p * fh + fh / 2) }));
      seats.forEach((s, p) => lab.push({ x: 12.85, y: s.y, text: `طبقه‌ی ${fa(n - p)}`, anchor: "start", size: 0.34 }));
      const bottom = 1.3 + n * fh;
      const bank = Array.from({ length: n }, (_, i) => ({ x: i % 2 ? 2.2 : 4.4, y: r4(1.6 + Math.floor(i / 2) * 1.0) }));
      return { view: [0, 0, 16, Math.max(bottom + 0.6, 5)], seats, bank, bankTop: withBank ? 0 : null, labels: lab };
    }
    case "round": {
      const seats = Array.from({ length: n }, (_, s) => {
        const a = (s * 2 * Math.PI) / n;
        return { x: r4(8 + 3.0 * Math.sin(a)), y: r4(3.95 - 3.0 * Math.cos(a)) };
      });
      return { view: [0, 0, 16, withBank ? 9.3 : 7.6], seats, bank: bankRow(n, 8.55), bankTop: withBank ? 7.8 : null, labels: lab };
    }
    case "rect": {
      const seats =
        n === 4
          ? [
              { x: 6.7, y: 1.55 },
              { x: 9.3, y: 1.55 },
              { x: 9.3, y: 6.05 },
              { x: 6.7, y: 6.05 },
            ]
          : [
              { x: 6.7, y: 1.55 },
              { x: 9.3, y: 1.55 },
              { x: 12.2, y: 3.8 },
              { x: 9.3, y: 6.05 },
              { x: 6.7, y: 6.05 },
              { x: 3.8, y: 3.8 },
            ];
      return { view: [0, 0, 16, withBank ? 9.1 : 7.7], seats, bank: bankRow(n, 8.35), bankTop: withBank ? 7.65 : null, labels: lab };
    }
  }
}

const barHeight = (p: number, n: number) => 3.4 - (p * 2.3) / (n - 1);
const floorHeight = (n: number) => Math.min(1.05, 7 / n);

/** Columns of a family tree mapped onto the board. */
export function familyGeometry(people: readonly FPerson[], withBank = true): Geometry {
  const cols = people.map((p) => p.x);
  const mid = (Math.min(...cols) + Math.max(...cols)) / 2;
  const gens = Math.max(...people.map((p) => p.gen)) + 1;
  const seats = people.map((p) => ({ x: r4(8 + (p.x - mid) * 2.55), y: r4(1.0 + p.gen * 2.5), male: p.male }));
  const top = 1.0 + (gens - 1) * 2.5 + 1.05;
  const perRow = 7;
  const rows = Math.ceil(people.length / perRow);
  const bank = people.map((_, i) => {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, people.length - row * perRow);
    return { x: r4(8 + ((inRow - 1) / 2 - (i % perRow)) * 2.05), y: r4(top + 0.75 + row * 0.95) };
  });
  return { view: [0, 0, 16, withBank ? top + 0.45 + rows * 0.95 : top], seats, bank, bankTop: withBank ? top : null, labels: [] };
}

// ─── Backdrops ─────────────────────────────────────────────────────────────

/** A little standing figure facing right (towards the counter). */
function Walker({ x, y }: Spot) {
  return (
    <g pointerEvents="none" stroke={SOFT} strokeWidth={0.06} fill="none" strokeLinecap="round">
      <circle cx={x} cy={y - 0.95} r={0.22} fill="#fff" />
      <path d={`M${r4(x + 0.2)},${r4(y - 0.98)} l0.12,0.06 l-0.1,0.04`} fill={SOFT} stroke="none" />
      <path d={`M${x},${r4(y - 0.72)} v0.2`} />
    </g>
  );
}

export function Backdrop({ q, geo, fixedSeat = null, hands = true }: { q: Pick<Arrangement, "kind" | "n" | "attr">; geo: Geometry; fixedSeat?: number | null; hands?: boolean }) {
  const { kind, n } = q;
  const parts: ReactNode[] = [];
  if (kind === "queue") {
    parts.push(
      <g key="counter">
        <rect x={14.55} y={1.6} width={1.25} height={3.2} rx={0.1} fill={TABLE} stroke={INK} strokeWidth={0.04} />
        <text x={15.17} y={1.35} fontSize={0.38} fontWeight={800} textAnchor="middle" fill={INK}>
          باجه
        </text>
        <line x1={2.2} y1={0.85} x2={13.2} y2={0.85} stroke={SOFT} strokeWidth={0.05} markerEnd="url(#t20-arrow)" />
        <text x={7.7} y={0.6} fontSize={0.32} fontWeight={700} textAnchor="middle" fill={SOFT}>
          همه رو به باجه‌اند؛ جلوی صف این طرف است
        </text>
      </g>,
      ...geo.seats.map((s, i) => <Walker key={`w${i}`} x={s.x} y={s.y} />),
    );
  } else if (kind === "rank") {
    parts.push(
      ...geo.seats.map((s, p) => (
        <rect key={p} x={r4(s.x - 0.55)} y={r4(5 - barHeight(p, n))} width={1.1} height={r4(barHeight(p, n))} fill="#efe2c6" stroke={SOFT} strokeWidth={0.03} />
      )),
      <line key="base" x1={0.6} y1={5} x2={15.2} y2={5} stroke={INK} strokeWidth={0.04} />,
    );
  } else if (kind === "floors") {
    const fh = floorHeight(n);
    const bottom = 1.3 + n * fh;
    parts.push(
      <g key="building">
        <path d={`M7.3,1.3 L10,0.35 L12.7,1.3 Z`} fill={TABLE} stroke={INK} strokeWidth={0.04} />
        <rect x={7.6} y={1.3} width={4.8} height={r4(n * fh)} fill={PAPER} stroke={INK} strokeWidth={0.05} />
        {Array.from({ length: n - 1 }, (_, i) => (
          <line key={i} x1={7.6} x2={12.4} y1={r4(1.3 + (i + 1) * fh)} y2={r4(1.3 + (i + 1) * fh)} stroke={SOFT} strokeWidth={0.03} />
        ))}
        <line x1={6.6} x2={13.6} y1={r4(bottom)} y2={r4(bottom)} stroke={INK} strokeWidth={0.06} />
        <text x={14.6} y={0.9} fontSize={0.3} fontWeight={700} textAnchor="middle" fill={SOFT}>
          ↑ بالا
        </text>
      </g>,
    );
  } else if (kind === "round") {
    parts.push(<circle key="t" cx={8} cy={3.95} r={2.0} fill={TABLE} stroke={INK} strokeWidth={0.05} />);
  } else {
    const ends = n === 6;
    parts.push(
      <g key="t">
        <rect x={ends ? 5.0 : 5.3} y={2.35} width={ends ? 6.0 : 5.4} height={2.9} rx={0.12} fill={TABLE} stroke={INK} strokeWidth={0.05} />
        <rect x={5.6} y={0.15} width={4.8} height={0.42} fill="#dbe9ff" stroke={INK} strokeWidth={0.04} />
        <line x1={8} x2={8} y1={0.15} y2={0.57} stroke={INK} strokeWidth={0.03} />
        <text x={10.65} y={0.47} fontSize={0.32} fontWeight={800} textAnchor="start" fill={INK}>
          پنجره
        </text>
        <rect x={7.3} y={6.95} width={1.4} height={0.5} fill="#fff" stroke={INK} strokeWidth={0.04} />
        <circle cx={8.5} cy={7.2} r={0.05} fill={INK} />
        <text x={8.95} y={7.33} fontSize={0.32} fontWeight={800} textAnchor="start" fill={INK}>
          در
        </text>
      </g>,
    );
  }
  // Tables: a notch on the side facing the middle, and the hands of the sitter at the top.
  if (kind === "round" || kind === "rect") {
    geo.seats.forEach((s, i) => {
      // Round: towards the middle. Rectangle: straight at the table.
      const dx = kind === "round" ? 8 - s.x : Math.abs(s.y - 3.8) < 0.1 ? 8 - s.x : 0;
      const dy = kind === "round" ? 3.95 - s.y : Math.abs(s.y - 3.8) < 0.1 ? 0 : 3.8 - s.y;
      const d = Math.hypot(dx, dy) || 1;
      const [ux, uy] = [dx / d, dy / d];
      const tip = { x: r4(s.x + ux * 0.62), y: r4(s.y + uy * 0.62) };
      const b1 = { x: r4(s.x + ux * 0.44 - uy * 0.16), y: r4(s.y + uy * 0.44 + ux * 0.16) };
      const b2 = { x: r4(s.x + ux * 0.44 + uy * 0.16), y: r4(s.y + uy * 0.44 - ux * 0.16) };
      parts.push(<path key={`f${i}`} d={`M${tip.x},${tip.y} L${b1.x},${b1.y} L${b2.x},${b2.y} Z`} fill={SOFT} pointerEvents="none" />);
    });
    if (hands) {
      const s = geo.seats[0];
      // Facing down: the right hand is on the drawing's left.
      parts.push(
        <g key="hands" pointerEvents="none" fontSize={0.26} fontWeight={700} fill={ACCENT}>
          <text x={r4(s.x - 0.75)} y={r4(s.y + 0.72)} textAnchor="middle">
            راست
          </text>
          <text x={r4(s.x + 0.75)} y={r4(s.y + 0.72)} textAnchor="middle">
            چپ
          </text>
        </g>,
      );
    }
  }
  if (fixedSeat !== null) {
    const s = geo.seats[fixedSeat];
    parts.push(
      <text key="fixed" x={s.x} y={r4(s.y - 0.5)} fontSize={0.26} fontWeight={700} textAnchor="middle" fill={SOFT} pointerEvents="none">
        جای ثابت
      </text>,
    );
  }
  return (
    <g>
      <defs>
        <marker id="t20-arrow" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={5} markerHeight={5} orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 Z" fill={SOFT} />
        </marker>
      </defs>
      {parts}
    </g>
  );
}

/** Couple lines and child lines of a family tree. */
export function TreeLines({ people, geo, shown }: { people: readonly FPerson[]; geo: Geometry; shown?: (i: number) => boolean }) {
  const on = shown ?? (() => true);
  const lines: ReactNode[] = [];
  const half = TW / 2 + 0.05;
  people.forEach((p, i) => {
    if (p.spouse > i && on(i) && on(p.spouse)) {
      const [a, b] = [geo.seats[i], geo.seats[p.spouse]].sort((u, v) => u.x - v.x);
      lines.push(<line key={`s${i}`} x1={r4(a.x + half)} x2={r4(b.x - half)} y1={a.y} y2={b.y} stroke={INK} strokeWidth={0.05} />);
      lines.push(<line key={`s2${i}`} x1={r4(a.x + half)} x2={r4(b.x - half)} y1={r4(a.y + 0.1)} y2={r4(b.y + 0.1)} stroke={INK} strokeWidth={0.05} />);
    }
  });
  // Children of each couple, keyed by the father.
  const groups = new Map<number, number[]>();
  people.forEach((p, i) => {
    if (p.father >= 0) groups.set(p.father, [...(groups.get(p.father) ?? []), i]);
  });
  for (const [f, kids] of groups) {
    const m = people[kids[0]].mother;
    const vis = kids.filter(on);
    if (!vis.length || !(on(f) || on(m))) continue;
    // From the couple's line, or from the one parent met so far.
    const both = on(f) && on(m);
    const one = on(f) ? f : m;
    const top = both ? (geo.seats[f].y + geo.seats[m].y) / 2 + 0.05 : geo.seats[one].y + TH / 2;
    const x0 = both ? (geo.seats[f].x + geo.seats[m].x) / 2 : geo.seats[one].x;
    const midY = r4((both ? top : top - TH / 2) + 1.2);
    const xs = vis.map((k) => geo.seats[k].x);
    lines.push(
      <g key={`c${f}`} stroke={INK} strokeWidth={0.04} fill="none">
        <line x1={r4(x0)} x2={r4(x0)} y1={r4(top)} y2={midY} />
        <line x1={r4(Math.min(x0, ...xs))} x2={r4(Math.max(x0, ...xs))} y1={midY} y2={midY} />
        {vis.map((k) => (
          <line key={k} x1={geo.seats[k].x} x2={geo.seats[k].x} y1={midY} y2={r4(geo.seats[k].y - TH / 2)} />
        ))}
      </g>,
    );
  }
  return <g pointerEvents="none">{lines}</g>;
}

/** The outline of a place: a seat, a floor, a bar top, or a person in a tree. */
function SlotShape({ s, fill, stroke, dash, width = 0.04 }: { s: Geometry["seats"][number]; fill: string; stroke: string; dash?: string; width?: number }) {
  const rx = s.male === undefined ? 0.16 : s.male ? 0.06 : TH / 2;
  return <rect x={r4(s.x - TW / 2)} y={r4(s.y - TH / 2)} width={TW} height={TH} rx={rx} fill={fill} stroke={stroke} strokeWidth={width} strokeDasharray={dash} />;
}

export function LegendShapes({ x, y }: Spot) {
  return (
    <g pointerEvents="none" fontSize={0.28} fill={SOFT} fontWeight={700}>
      <rect x={x} y={y} width={0.5} height={0.3} rx={0.03} fill="#fff" stroke={INK} strokeWidth={0.03} />
      <text x={r4(x - 0.12)} y={r4(y + 0.25)} textAnchor="end">
        مرد
      </text>
      <rect x={x} y={r4(y + 0.45)} width={0.5} height={0.3} rx={0.15} fill="#fff" stroke={INK} strokeWidth={0.03} />
      <text x={r4(x - 0.12)} y={r4(y + 0.7)} textAnchor="end">
        زن
      </text>
    </g>
  );
}

// ─── The placing figure ────────────────────────────────────────────────────

export type Mark = "good" | "bad" | null;

interface PlaceProps {
  geo: Geometry;
  names: readonly string[];
  /** Seat of each person, -1: waiting. */
  seatOf: readonly number[];
  locked?: (p: number) => boolean;
  selected?: number | null;
  onSelect?: (p: number | null) => void;
  /** Put p in a seat (null: back to the waiting names). */
  onPlace?: (p: number, seat: number | null) => void;
  /** After a check: ✓ / ✗ beside a seat. */
  marks?: (seat: number) => Mark;
  /** Small words under a seat ("تو: سارا", "۳ نفر ممکن"). */
  notes?: (seat: number) => string | null;
  /** A seat to mark with "؟". */
  asked?: number | null;
  /** People drawn with a thick outline. */
  focus?: readonly number[];
  /** Hide the waiting names. */
  hideBank?: boolean;
  /** Family trees: men's tokens square, women's rounded. */
  maleOf?: (p: number) => boolean;
  children?: ReactNode;
}

export function PlaceFigure({ geo, names, seatOf, locked, selected = null, onSelect, onPlace, marks, notes, asked = null, focus = [], hideBank, maleOf, children }: PlaceProps) {
  const drag = useRef<{ p: number; x: number; y: number; moved: boolean } | null>(null);
  const [ghost, setGhost] = useState<{ p: number; x: number; y: number } | null>(null);
  const live = !!onPlace;
  const isLocked = (p: number) => !!locked?.(p);
  const who = (s: number) => seatOf.indexOf(s);

  const pointAt = (e: React.PointerEvent<SVGElement>): Spot => {
    const svg = (e.currentTarget as SVGGraphicsElement).ownerSVGElement;
    const ctm = svg?.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: pt.x, y: pt.y };
  };

  const tapPerson = (p: number) => {
    if (!live) return;
    if (selected !== null && selected !== p && seatOf[p] >= 0 && !isLocked(p)) return onPlace!(selected, seatOf[p]);
    if (isLocked(p)) return;
    onSelect?.(selected === p ? null : p);
  };
  const tapSeat = (s: number) => {
    if (!live) return;
    const q = who(s);
    if (selected !== null) {
      if (q >= 0 && isLocked(q)) return;
      return onPlace!(selected, s);
    }
    if (q >= 0 && !isLocked(q)) onSelect?.(q);
  };
  const tapBank = () => {
    if (live && selected !== null && seatOf[selected] >= 0) onPlace!(selected, null);
  };

  const down = (p: number, e: React.PointerEvent<SVGGElement>) => {
    if (!live || isLocked(p)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = pointAt(e);
    drag.current = { p, x: pt.x, y: pt.y, moved: false };
  };
  const move = (e: React.PointerEvent<SVGGElement>) => {
    const d = drag.current;
    if (!d) return;
    const pt = pointAt(e);
    if (!d.moved && Math.hypot(pt.x - d.x, pt.y - d.y) < 0.2) return;
    d.moved = true;
    setGhost({ p: d.p, x: pt.x, y: pt.y });
  };
  const up = (e: React.PointerEvent<SVGGElement>) => {
    const d = drag.current;
    drag.current = null;
    setGhost(null);
    if (!d) return;
    if (!d.moved) return tapPerson(d.p);
    const pt = pointAt(e);
    let best = -1;
    let dist = 1.1;
    geo.seats.forEach((s, i) => {
      const k = Math.hypot(s.x - pt.x, s.y - pt.y);
      if (k < dist && !(who(i) >= 0 && isLocked(who(i)))) [best, dist] = [i, k];
    });
    if (best >= 0) onPlace!(d.p, best);
    else if (geo.bankTop !== null && (geo.bankTop === 0 ? pt.x < 6 : pt.y > geo.bankTop)) onPlace!(d.p, null);
  };
  const key = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };

  const bankArea =
    geo.bankTop === null ? null : geo.bankTop === 0 ? { x: 0.6, y: 0.6, w: 5.6, h: Math.ceil(names.length / 2) * 1.0 + 0.4 } : { x: 0.4, y: geo.bankTop, w: 15.2, h: geo.view[3] - geo.bankTop - 0.1 };

  return (
    <g>
      {bankArea && (
        <g onClick={tapBank}>
          <rect x={bankArea.x} y={bankArea.y} width={bankArea.w} height={bankArea.h} rx={0.2} fill="#f6efe2" stroke={SOFT} strokeWidth={0.025} strokeDasharray="0.12 0.1" />
          <text x={r4(bankArea.x + bankArea.w - 0.2)} y={r4(bankArea.y + 0.32)} fontSize={0.24} fontWeight={700} textAnchor="end" fill={SOFT} pointerEvents="none">
            {live ? "منتظرِ جا · روی نام بزن، بعد روی جایش" : "منتظرِ جا"}
          </text>
        </g>
      )}
      {children}

      {/* Places */}
      {geo.seats.map((s, i) => {
        const m = marks?.(i) ?? null;
        const note = notes?.(i);
        return (
          <g key={`seat${i}`} onClick={() => tapSeat(i)} style={live ? { cursor: "pointer" } : undefined} role={live ? "button" : undefined} tabIndex={live ? 0 : undefined} aria-label={live ? `جای ${fa(i + 1)}` : undefined} onKeyDown={live ? key(() => tapSeat(i)) : undefined}>
            <SlotShape s={s} fill={asked === i ? "#fff6db" : "#fff"} stroke={selected !== null && live ? ACCENT : SOFT} dash="0.14 0.09" />
            {asked === i && who(i) < 0 && (
              <text x={s.x} y={s.y} dy="0.35em" fontSize={0.45} fontWeight={800} textAnchor="middle" fill={INK}>
                ؟
              </text>
            )}
            {m && (
              <text x={r4(s.x + TW / 2 + 0.05)} y={r4(s.y - TH / 2 + 0.05)} fontSize={0.42} fontWeight={800} textAnchor="middle" fill={m === "good" ? GOOD : BAD} stroke="#fff" strokeWidth={0.08} paintOrder="stroke">
                {m === "good" ? "✓" : "✗"}
              </text>
            )}
            {note && (
              <text x={s.x} y={r4(s.y + TH / 2 + 0.24)} fontSize={0.24} fontWeight={700} textAnchor="middle" fill={SOFT} stroke="#fff" strokeWidth={0.06} paintOrder="stroke">
                {note}
              </text>
            )}
          </g>
        );
      })}
      {geo.labels.map((l, i) => (
        <text key={`l${i}`} x={l.x} y={l.y} dy="0.35em" fontSize={l.size ?? 0.3} fontWeight={l.weight ?? 700} textAnchor={l.anchor ?? "middle"} fill={SOFT} pointerEvents="none">
          {l.text}
        </text>
      ))}

      {/* People */}
      {names.map((name, p) => {
        const seat = seatOf[p];
        if (seat < 0 && (hideBank || geo.bankTop === null)) return null;
        const at = seat >= 0 ? geo.seats[seat] : geo.bank[p];
        const sel = selected === p;
        const lock = isLocked(p);
        const strong = focus.includes(p);
        return (
          <g
            key={`p${p}`}
            onPointerDown={(e) => down(p, e)}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={() => {
              drag.current = null;
              setGhost(null);
            }}
            style={live && !lock ? { cursor: "grab", touchAction: "none" } : undefined}
            opacity={ghost?.p === p ? 0.35 : 1}
            role={live && !lock ? "button" : undefined}
            tabIndex={live && !lock ? 0 : undefined}
            aria-label={live && !lock ? `${name}${sel ? "، انتخاب‌شده" : ""}` : undefined}
            aria-pressed={live && !lock ? sel : undefined}
            onKeyDown={live && !lock ? key(() => tapPerson(p)) : undefined}
          >
            <rect
              x={r4(at.x - TW / 2 + 0.05)}
              y={r4(at.y - TH / 2 + 0.05)}
              width={TW - 0.1}
              height={TH - 0.1}
              rx={maleOf ? (maleOf(p) ? 0.05 : (TH - 0.1) / 2) : 0.14}
              fill={sel ? "#eef2ff" : lock ? "#efe2c6" : "#fff"}
              stroke={sel || strong ? ACCENT : INK}
              strokeWidth={sel || strong ? 0.09 : 0.04}
              strokeDasharray={sel ? "0.16 0.08" : undefined}
            />
            <text x={at.x} y={at.y} dy="0.36em" fontSize={0.36} fontWeight={800} textAnchor="middle" fill={INK} pointerEvents="none">
              {name}
            </text>
          </g>
        );
      })}

      {ghost && (
        <g pointerEvents="none" opacity={0.85}>
          <rect x={r4(ghost.x - TW / 2)} y={r4(ghost.y - TH / 2)} width={TW} height={TH} rx={0.14} fill="#eef2ff" stroke={ACCENT} strokeWidth={0.06} />
          <text x={r4(ghost.x)} y={r4(ghost.y)} dy="0.36em" fontSize={0.36} fontWeight={800} textAnchor="middle" fill={INK}>
            {names[ghost.p]}
          </text>
        </g>
      )}
    </g>
  );
}

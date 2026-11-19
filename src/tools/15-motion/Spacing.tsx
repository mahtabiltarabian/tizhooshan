"use client";

// Spacing pictures for tool 15, in board units (view 16 × 9): things along a
// straight path, round a loop or a field, on both sides of a road, cuts in a
// log, and floors with the flights of stairs between them. Things and gaps
// appear one by one (the order of `spacingEvents`), each gap with its number
// under a bracket, and a counter says how many of each so far. Things differ
// by shape (tree, post, lamp, flag), gaps by a bracket and a number, so
// nothing depends on colour alone.

import type { SpacingQuestion, SpacingThing } from "@/generators/motion";
import { fa } from "@/tools/registry";
import { BLUE, INK, ORANGE, SOFT } from "./Pictures";

export type SpacingShape = "row" | "loop" | "rect" | "log" | "sides" | "floors";
export type SpacingKind = SpacingThing | "cut" | "floor";

const GREEN = "#3f9a52";
const WOOD = "#c98e4f";

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const LOOP_R = 2.85;
const LOOP_Y = 4.9;

export const THING_WORD: Record<SpacingKind, string> = { tree: "درخت", post: "تیرک", lamp: "چراغ", flag: "پرچم", cut: "برش", floor: "طبقه" };
/** What a gap is called: a stretch between two things, a piece of log, a flight of stairs. */
export const gapWord = (k: SpacingKind) => (k === "cut" ? "تکه" : k === "floor" ? "راه‌پله" : "فاصله");

export interface SpacingScene {
  shape: SpacingShape;
  kind: SpacingKind;
  /** Steps along the path: row, sides and log run 0 … gaps; a loop has gaps places; floors 1 … gaps + 1. */
  gaps: number;
  /** Field sides in steps (rect). */
  rectA?: number;
  rectB?: number;
  /** Which places carry a thing (a cut inside the log, a floor drawn). */
  marks: boolean[];
}

/** Number of places a scene has. */
export function placeCount(s: Pick<SpacingScene, "shape" | "gaps" | "rectA" | "rectB">) {
  if (s.shape === "loop") return s.gaps;
  if (s.shape === "rect") return 2 * ((s.rectA ?? 1) + (s.rectB ?? 1));
  return s.gaps + 1;
}

export type SpacingEvent = { kind: "thing"; side: 0 | 1; at: number; n: number } | { kind: "gap"; side: 0 | 1; from: number; to: number; n: number };

/**
 * Things and gaps in the order they are drawn and counted: a thing, the gap
 * to the next, the next thing … A loop ends with the gap back to the first
 * thing; a log's pieces come one per cut, with the last piece after the last cut.
 */
export function spacingEvents(s: SpacingScene): SpacingEvent[] {
  const n = placeCount(s);
  const at = s.marks.slice(0, n).flatMap((m, i) => (m ? [i] : []));
  const out: SpacingEvent[] = [];
  let things = 0;
  let gaps = 0;
  if (s.shape === "log") {
    // Places 0 and gaps are the ends of the log; a cut is a mark inside it.
    const cuts = at.filter((i) => i > 0 && i < s.gaps);
    let prev = 0;
    for (const c of cuts) {
      out.push({ kind: "gap", side: 0, from: prev, to: c, n: ++gaps }, { kind: "thing", side: 0, at: c, n: ++things });
      prev = c;
    }
    out.push({ kind: "gap", side: 0, from: prev, to: s.gaps, n: ++gaps });
    return out;
  }
  const sides: (0 | 1)[] = s.shape === "sides" ? [0, 1] : [0];
  for (const side of sides) {
    at.forEach((i, k) => {
      out.push({ kind: "thing", side, at: i, n: ++things });
      if (k + 1 < at.length) out.push({ kind: "gap", side, from: i, to: at[k + 1], n: ++gaps });
    });
    // Round a closed path the last thing has a gap back to the first.
    if ((s.shape === "loop" || s.shape === "rect") && at.length >= 2) out.push({ kind: "gap", side, from: at[at.length - 1], to: at[0] + n, n: ++gaps });
  }
  return out;
}

/** Things and gaps counted after the first `k` events. */
export function countsAfter(events: SpacingEvent[], k: number) {
  const done = events.slice(0, k);
  return { things: done.filter((e) => e.kind === "thing").length, gaps: done.filter((e) => e.kind === "gap").length };
}

// ── Drawing ─────────────────────────────────────────────────────────────

/** One thing standing on (x, y), `s` tall. */
export function ThingIcon({ kind, x, y, s, faded }: { kind: SpacingThing; x: number; y: number; s: number; faded?: boolean }) {
  const o = faded ? 0.35 : 1;
  const sw = { stroke: INK, strokeWidth: 1.5, vectorEffect: "non-scaling-stroke" as const };
  switch (kind) {
    case "tree":
      return (
        <g opacity={o}>
          <rect x={r3(x - s * 0.08)} y={r3(y - s * 0.45)} width={r3(s * 0.16)} height={r3(s * 0.45)} fill={WOOD} {...sw} />
          <circle cx={x} cy={r3(y - s * 0.68)} r={r3(s * 0.32)} fill={GREEN} {...sw} />
        </g>
      );
    case "post":
      return (
        <g opacity={o}>
          <rect x={r3(x - s * 0.09)} y={r3(y - s * 0.9)} width={r3(s * 0.18)} height={r3(s * 0.9)} fill={WOOD} {...sw} />
          <path d={`M${r3(x - s * 0.09)},${r3(y - s * 0.9)} L${x},${r3(y - s)} L${r3(x + s * 0.09)},${r3(y - s * 0.9)} Z`} fill={WOOD} {...sw} />
        </g>
      );
    case "lamp":
      return (
        <g opacity={o}>
          <line x1={x} y1={y} x2={x} y2={r3(y - s * 0.8)} stroke={INK} strokeWidth={3} vectorEffect="non-scaling-stroke" />
          <circle cx={x} cy={r3(y - s * 0.85)} r={r3(s * 0.17)} fill="#ffd36b" {...sw} />
        </g>
      );
    case "flag":
      return (
        <g opacity={o}>
          <line x1={x} y1={y} x2={x} y2={r3(y - s)} stroke={INK} strokeWidth={3} vectorEffect="non-scaling-stroke" />
          <path d={`M${x},${r3(y - s)} L${r3(x + s * 0.45)},${r3(y - s * 0.84)} L${x},${r3(y - s * 0.68)} Z`} fill={ORANGE} {...sw} />
        </g>
      );
  }
}

interface SpacingProps {
  scene: SpacingScene;
  /** How far through the events, 0 … 1 (1 = all drawn). */
  reveal?: number;
  /** Write the counter of things and gaps. */
  counters?: boolean;
  /** Text under each gap's number (e.g. its length), by gap. */
  gapText?: (e: Extract<SpacingEvent, { kind: "gap" }>) => string;
  /** Labels: the whole length (or perimeter), the sides of a field. */
  total?: string;
  sideA?: string;
  sideB?: string;
  /** Floors: a time written beside floors. */
  floorNotes?: Record<number, string>;
  /** Explore: tap a place to put or take away a thing. */
  onPlace?: (i: number) => void;
  /** Places drawn faintly where a thing could go (explore). */
  ghosts?: boolean;
  /** Places crossed out (both ends empty). */
  crossed?: number[];
  /** Draw the things but not the gaps (before an answer, when the gaps are what is asked). */
  thingsOnly?: boolean;
}

/** Where place i is, and which way is "up" there (row and sides: up the page; loop: outward). */
function placeXY(s: SpacingScene, i: number, side: 0 | 1 = 0): [number, number] {
  const n = placeCount(s);
  switch (s.shape) {
    case "row":
      return [r3(1.4 + (13.2 * i) / Math.max(1, s.gaps)), 5];
    case "sides":
      return [r3(1.4 + (13.2 * i) / Math.max(1, s.gaps)), side ? 7.6 : 3.4];
    case "log":
      return [r3(1.4 + (13.2 * i) / Math.max(1, s.gaps)), 4.6];
    case "loop": {
      const a = ((-90 + (360 * i) / n) * Math.PI) / 180;
      return [r3(8 + LOOP_R * Math.cos(a)), r3(LOOP_Y + LOOP_R * Math.sin(a))];
    }
    case "rect": {
      const A = s.rectA ?? 1;
      const B = s.rectB ?? 1;
      const unit = Math.min(11 / A, 5.6 / B);
      const x0 = 8 - (A * unit) / 2;
      const y0 = 4.9 - (B * unit) / 2;
      // Clockwise from the top-left corner.
      const k = ((i % n) + n) % n;
      if (k <= A) return [r3(x0 + k * unit), r3(y0)];
      if (k <= A + B) return [r3(x0 + A * unit), r3(y0 + (k - A) * unit)];
      if (k <= 2 * A + B) return [r3(x0 + (2 * A + B - k) * unit), r3(y0 + B * unit)];
      return [r3(x0), r3(y0 + (2 * A + 2 * B - k) * unit)];
    }
    case "floors": {
      const h = Math.min(0.62, 7.4 / (s.gaps + 1));
      return [8, r3(8.3 - i * h)];
    }
  }
}

export function SpacingG({ scene: s, reveal = 1, counters = false, gapText, total, sideA, sideB, floorNotes, onPlace, ghosts, crossed = [], thingsOnly }: SpacingProps) {
  const events = spacingEvents(s);
  const shownCount = Math.round(Math.min(1, Math.max(0, reveal)) * events.length);
  const shown = events.slice(0, shownCount);
  const n = placeCount(s);
  const step = s.shape === "loop" ? (2 * Math.PI * LOOP_R) / Math.max(1, n) : s.shape === "rect" ? 11 / Math.max(s.rectA ?? 1, 1) : 13.2 / Math.max(1, s.gaps);
  const size = r3(Math.min(1.1, Math.max(0.45, step * 0.9)));
  const fs = r3(Math.min(0.34, Math.max(0.2, step * 0.42)));
  const halo = { stroke: "#fff", strokeWidth: 3, paintOrder: "stroke" as const, vectorEffect: "non-scaling-stroke" as const };
  const parts: React.ReactNode[] = [];
  const lastEvent = shown[shown.length - 1];

  // The path itself.
  if (s.shape === "row") parts.push(<line key="path" x1={1.1} y1={5} x2={14.9} y2={5} stroke={SOFT} strokeWidth={6} strokeLinecap="round" vectorEffect="non-scaling-stroke" />);
  if (s.shape === "sides")
    parts.push(
      <g key="road">
        <rect x={1.1} y={4.1} width={13.8} height={2.6} fill="#8e939c" />
        <line x1={1.3} y1={5.4} x2={14.7} y2={5.4} stroke="#fff" strokeWidth={3} strokeDasharray="10 8" vectorEffect="non-scaling-stroke" />
        <line x1={1.1} y1={3.4} x2={14.9} y2={3.4} stroke={SOFT} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        <line x1={1.1} y1={7.6} x2={14.9} y2={7.6} stroke={SOFT} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        <text x={8} y={4.75} fontSize={0.32} fontWeight={700} textAnchor="middle" fill="#fff">
          خیابان
        </text>
      </g>,
    );
  if (s.shape === "loop") parts.push(<circle key="path" cx={8} cy={LOOP_Y} r={LOOP_R} fill="#cfe6f7" stroke={SOFT} strokeWidth={5} vectorEffect="non-scaling-stroke" />);
  if (s.shape === "rect") {
    const [x0, y0] = placeXY(s, 0);
    const [x1, y1] = placeXY(s, (s.rectA ?? 1) + (s.rectB ?? 1));
    parts.push(<rect key="path" x={x0} y={y0} width={r3(x1 - x0)} height={r3(y1 - y0)} fill="#e3efd3" stroke={SOFT} strokeWidth={5} vectorEffect="non-scaling-stroke" />);
  }
  if (s.shape === "log") parts.push(<rect key="path" x={1.4} y={4.1} width={13.2} height={1} rx={0.2} fill={WOOD} stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke" />);
  if (s.shape === "floors") {
    const [, top] = placeXY(s, s.gaps);
    const [, bottom] = placeXY(s, 0);
    const h = bottom - placeXY(s, 1)[1];
    parts.push(<rect key="path" x={6.2} y={r3(top - h * 0.5)} width={3.6} height={r3(bottom - top + h)} fill="#f3e6cf" stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke" />);
    for (let i = 0; i <= s.gaps; i++) {
      const [, y] = placeXY(s, i);
      parts.push(
        <g key={`fl${i}`}>
          <line x1={6.2} y1={r3(y + h * 0.5)} x2={9.8} y2={r3(y + h * 0.5)} stroke={INK} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          <text x={5.3} y={y} fontSize={r3(Math.min(0.32, h * 0.6))} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} direction="rtl">
            {`طبقه ${fa(i + 1)}`}
          </text>
          {floorNotes?.[i + 1] && (
            <text x={12.4} y={y} fontSize={r3(Math.min(0.32, h * 0.6))} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={BLUE} direction="rtl">
              {floorNotes[i + 1]}
            </text>
          )}
        </g>,
      );
    }
  }

  // Faint places to tap (explore), crossed-out places.
  for (let i = 0; i < n; i++) {
    if (s.shape === "floors") break;
    const sides: (0 | 1)[] = s.shape === "sides" ? [0, 1] : [0];
    for (const side of sides) {
      const [x, y] = placeXY(s, i, side);
      if (ghosts && !s.marks[i] && s.shape !== "log") parts.push(<circle key={`g${i}-${side}`} cx={x} cy={y} r={0.09} fill={SOFT} />);
      if (ghosts && s.shape === "log" && i > 0 && i < s.gaps && !s.marks[i]) parts.push(<line key={`g${i}`} x1={x} y1={4.1} x2={x} y2={5.1} stroke={INK} strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />);
      if (crossed.includes(i))
        parts.push(
          <g key={`x${i}-${side}`}>
            <line x1={r3(x - 0.25)} y1={r3(y - 0.6)} x2={r3(x + 0.25)} y2={r3(y - 0.1)} stroke={INK} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
            <line x1={r3(x + 0.25)} y1={r3(y - 0.6)} x2={r3(x - 0.25)} y2={r3(y - 0.1)} stroke={INK} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
          </g>,
        );
    }
  }

  // Gaps: a bracket (or arc) with its number; then things on top.
  const gapEls: React.ReactNode[] = [];
  const thingEls: React.ReactNode[] = [];
  for (const e of shown) {
    const isLast = e === lastEvent && reveal < 1;
    if (e.kind === "gap") {
      if (thingsOnly) continue;
      const label = fa(e.n);
      const sub = gapText?.(e);
      if (s.shape === "row" || s.shape === "sides" || s.shape === "log") {
        const [xa] = placeXY(s, e.from, e.side);
        const [xb] = placeXY(s, e.to, e.side);
        const yb = s.shape === "log" ? 5.35 : s.shape === "sides" ? (e.side ? 7.85 : 3.65) : 5.25;
        const dir = s.shape === "sides" && e.side === 0 ? -1 : 1;
        const by = s.shape === "sides" && e.side === 0 ? 3.6 - 0.05 : yb;
        const tip = r3(by + dir * 0.28);
        const xm = r3((xa + xb) / 2);
        gapEls.push(
          <g key={`gap${e.n}`}>
            {s.shape === "log" && <rect x={r3(xa + 0.04)} y={4.14} width={r3(xb - xa - 0.08)} height={0.92} fill={isLast ? "#e7b57d" : "none"} />}
            <path d={`M${r3(xa + 0.06)},${r3(by)} L${r3(xa + 0.06)},${tip} L${r3(xb - 0.06)},${tip} L${r3(xb - 0.06)},${r3(by)}`} fill="none" stroke={BLUE} strokeWidth={isLast ? 3 : 2} vectorEffect="non-scaling-stroke" />
            <text x={xm} y={r3(tip + dir * 0.3)} fontSize={fs} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={BLUE} {...halo}>
              {label}
            </text>
            {sub && (
              <text x={xm} y={r3(tip + dir * 0.66)} fontSize={r3(fs * 0.85)} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={SOFT} {...halo}>
                {sub}
              </text>
            )}
          </g>,
        );
      } else if (s.shape === "loop" || s.shape === "rect") {
        // A short arc just inside the path, from one thing to the next.
        const pts: [number, number][] = [];
        for (let t = 0; t <= 8; t++) {
          const at = e.from + ((e.to - e.from) * t) / 8;
          pts.push(placeIn(s, at));
        }
        const [mx, my] = placeIn(s, (e.from + e.to) / 2, 0.75);
        gapEls.push(
          <g key={`gap${e.n}`}>
            <path d={`M${pts.map(([x, y]) => `${x},${y}`).join("L")}`} fill="none" stroke={BLUE} strokeWidth={isLast ? 3.5 : 2} vectorEffect="non-scaling-stroke" />
            <text x={mx} y={my} fontSize={fs} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={BLUE} {...halo}>
              {label}
            </text>
            {sub && n <= 16 && (
              <text x={mx} y={r3(my + fs * 1.1)} fontSize={r3(fs * 0.8)} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={SOFT} {...halo}>
                {sub}
              </text>
            )}
          </g>,
        );
      } else {
        // Floors: a zigzag flight of stairs beside the building, numbered.
        const [, ya] = placeXY(s, e.from);
        const [, yb] = placeXY(s, e.to);
        const steps = 4;
        const d: string[] = [`M10,${r3(ya)}`];
        for (let k = 1; k <= steps; k++) {
          const y = r3(ya + ((yb - ya) * k) / steps);
          d.push(`L${r3(10 + (0.6 * k) / steps)},${r3(ya + ((yb - ya) * (k - 1)) / steps)}`, `L${r3(10 + (0.6 * k) / steps)},${y}`);
        }
        gapEls.push(
          <g key={`gap${e.n}`}>
            <path d={d.join("")} fill="none" stroke={BLUE} strokeWidth={isLast ? 3 : 2} vectorEffect="non-scaling-stroke" />
            <text x={10.95} y={r3((ya + yb) / 2)} fontSize={fs} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={BLUE} {...halo}>
              {label}
            </text>
          </g>,
        );
      }
    } else {
      if (s.shape === "floors") {
        const [, y] = placeXY(s, e.at);
        thingEls.push(<rect key={`t${e.n}`} x={6.25} y={r3(y - 0.2)} width={3.5} height={0.4} fill={isLast ? "#ffd36b" : "none"} stroke={isLast ? INK : "none"} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />);
        continue;
      }
      const [x, y] = placeXY(s, e.at, e.side);
      if (s.shape === "log") {
        thingEls.push(
          <g key={`t${e.n}`}>
            <line x1={x} y1={3.7} x2={x} y2={5.5} stroke={INK} strokeWidth={isLast ? 4 : 3} vectorEffect="non-scaling-stroke" />
            <text x={x} y={3.45} fontSize={fs} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={ORANGE} {...halo}>
              {`✂${fa(e.n)}`}
            </text>
          </g>,
        );
        continue;
      }
      thingEls.push(
        <g key={`t${e.n}`}>
          {isLast && <circle cx={x} cy={r3(y - size * 0.55)} r={r3(size * 0.62)} fill="#ffd36b" opacity={0.7} />}
          <ThingIcon kind={s.kind as SpacingThing} x={x} y={y} s={size} />
          {n <= 30 && (
            <text x={x} y={r3(y - size - 0.18)} fontSize={r3(fs * 0.85)} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} {...halo}>
              {fa(e.n)}
            </text>
          )}
        </g>,
      );
    }
  }

  // Taps (explore): a wide invisible target over each place.
  const taps: React.ReactNode[] = [];
  if (onPlace && s.shape !== "floors" && s.shape !== "rect")
    for (let i = 0; i < n; i++) {
      if (s.shape === "log" && (i === 0 || i === s.gaps)) continue;
      const [x, y] = placeXY(s, i);
      const w = Math.min(1.2, step);
      taps.push(<rect key={`tap${i}`} x={r3(x - w / 2)} y={r3(y - 1.4)} width={r3(w)} height={1.9} fill="transparent" style={{ cursor: "pointer" }} onClick={() => onPlace(i)} />);
    }

  const c = countsAfter(events, shownCount);
  const counterText = s.kind === "cut" ? `برش: ${fa(c.things)} · تکه: ${fa(c.gaps)}` : s.kind === "floor" ? `راه‌پله: ${fa(c.gaps)}` : `${THING_WORD[s.kind]}: ${fa(c.things)} · فاصله: ${fa(c.gaps)}`;

  return (
    <g>
      {parts}
      {gapEls}
      {thingEls}
      {total && (
        <text x={8} y={s.shape === "sides" ? 8.8 : s.shape === "row" ? 7.1 : s.shape === "log" ? 6.6 : 8.75} fontSize={0.36} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} direction="rtl">
          {total}
        </text>
      )}
      {sideA && s.shape === "rect" && (
        <text x={8} y={r3(placeXY(s, (s.rectA ?? 1) + (s.rectB ?? 1))[1] + 0.55)} fontSize={0.32} fontWeight={700} textAnchor="middle" fill={INK} direction="rtl">
          {sideA}
        </text>
      )}
      {sideB && s.shape === "rect" && (
        <text x={r3(placeXY(s, s.rectA ?? 1)[0] + 0.95)} y={4.9} fontSize={0.32} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} direction="rtl">
          {sideB}
        </text>
      )}
      {counters && (
        <text x={8} y={0.4} fontSize={0.38} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} direction="rtl">
          {counterText}
        </text>
      )}
      {taps}
    </g>
  );
}

/** A point just inside a loop or a field's edge at place `at` (may be fractional), pulled in by `inset`. */
function placeIn(s: SpacingScene, at: number, inset = 0.35): [number, number] {
  const n = placeCount(s);
  if (s.shape === "loop") {
    const a = ((-90 + (360 * at) / n) * Math.PI) / 180;
    return [r3(8 + (LOOP_R - inset) * Math.cos(a)), r3(LOOP_Y + (LOOP_R - inset) * Math.sin(a))];
  }
  const lo = Math.floor(at);
  const t = at - lo;
  const [ax, ay] = placeXY(s, lo);
  const [bx, by] = placeXY(s, lo + 1);
  const [x, y] = [ax + (bx - ax) * t, ay + (by - ay) * t];
  // Pull towards the middle of the field.
  const [cx, cy] = [8, 4.9];
  const d = Math.hypot(cx - x, cy - y) || 1;
  return [r3(x + ((cx - x) / d) * inset), r3(y + ((cy - y) / d) * inset)];
}

// ── A question as a scene ───────────────────────────────────────────────

const m = (v: number) => `${fa(v)} متر`;

/**
 * The picture of a spacing question. Before the answer only what the
 * question gives is drawn (the ends, a first thing, the cuts as a number);
 * after it, everything appears one by one.
 */
export interface SpacingPicture {
  scene: SpacingScene;
  total?: string;
  sideA?: string;
  sideB?: string;
  gapText?: (e: Extract<SpacingEvent, { kind: "gap" }>) => string;
  crossed?: number[];
  floorNotes?: Record<number, string>;
  thingsOnly?: boolean;
  /** One line for the side panel. */
  note: string;
}

export function questionSpacing(q: SpacingQuestion, done: boolean): SpacingPicture {
  const all = (k: number) => Array.from({ length: k }, () => true);
  const only = (k: number, keep: number[]) => Array.from({ length: k }, (_, i) => keep.includes(i));
  const gaps = q.variant === "floors" ? q.width - 1 : q.variant === "rect" ? 0 : q.length / q.gap;
  switch (q.variant) {
    case "row": {
      const scene: SpacingScene = { shape: "row", kind: q.thing, gaps, marks: done || q.ask !== "count" ? all(gaps + 1) : only(gaps + 1, [0, gaps]) };
      const gapLen = q.ask === "gap" && !done ? "؟" : m(q.gap);
      const total = q.ask === "length" && !done ? "از اولی تا آخری: ؟ متر" : `از اولی تا آخری: ${m(q.length)}`;
      return { scene, total, thingsOnly: q.ask === "count" && !done, gapText: () => (gaps <= 16 ? gapLen : ""), note: q.ask === "count" && !done ? `هر ${m(q.gap)} یک ${THING_WORD[q.thing]}` : `هر فاصله ${gapLen}` };
    }
    case "ends": {
      const scene: SpacingScene = { shape: "row", kind: q.thing, gaps, marks: done ? only(gaps + 1, Array.from({ length: gaps - 1 }, (_, i) => i + 1)) : [] };
      return { scene, total: `طول دیوار: ${m(q.length)}`, gapText: undefined, crossed: [0, gaps], note: `هر ${m(q.gap)} یک ${THING_WORD[q.thing]}، ولی دو سر دیوار خالی` };
    }
    case "sides": {
      const scene: SpacingScene = { shape: "sides", kind: q.thing, gaps, marks: done ? all(gaps + 1) : only(gaps + 1, [0, gaps]) };
      return { scene, total: `طول خیابان: ${m(q.length)} · دو طرف خیابان`, thingsOnly: !done, gapText: undefined, note: `هر ${m(q.gap)} یک ${THING_WORD[q.thing]}، از سر تا ته، دو طرف خیابان` };
    }
    case "loop": {
      const scene: SpacingScene = { shape: "loop", kind: q.thing, gaps, marks: done || q.ask === "length" ? all(gaps) : only(gaps, [0]) };
      return { scene, total: `دور استخر: ${q.ask === "length" && !done ? "؟ متر" : m(q.length)}`, gapText: () => m(q.gap), note: `هر ${m(q.gap)} یک ${THING_WORD[q.thing]}` };
    }
    case "rect": {
      const A = q.length / q.gap;
      const B = q.width / q.gap;
      const corners = [0, A, A + B, 2 * A + B];
      const scene: SpacingScene = { shape: "rect", kind: "post", gaps: 2 * (A + B), rectA: A, rectB: B, marks: done ? all(2 * (A + B)) : only(2 * (A + B), corners) };
      return { scene, sideA: m(q.length), sideB: m(q.width), thingsOnly: !done, gapText: undefined, total: `هر ${m(q.gap)} یک تیرک؛ در هر گوشه یک تیرک`, note: "" };
    }
    case "cut": {
      const pieces = q.count;
      const scene: SpacingScene = { shape: "log", kind: "cut", gaps: pieces, marks: done || q.ask === "length" ? all(pieces + 1) : [] };
      const total = q.ask === "length" && !done ? "طول چوب: ؟ متر" : `طول چوب: ${m(q.length)}`;
      return { scene, total, gapText: () => (q.ask === "pieces" && !done ? "" : m(q.gap)), note: "" };
    }
    case "floors": {
      const scene: SpacingScene = { shape: "floors", kind: "floor", gaps, marks: done ? all(gaps + 1) : only(gaps + 1, Array.from({ length: q.count }, (_, i) => i)) };
      const notes: Record<number, string> = { 1: "شروع", [q.count]: `${fa(q.per)} ثانیه`, [q.width]: done ? `${fa(q.answer)} ثانیه` : "؟ ثانیه" };
      return { scene, floorNotes: notes, gapText: undefined, note: "" };
    }
  }
}

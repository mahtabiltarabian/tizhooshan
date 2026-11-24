"use client";

// The nth term for tool 9, in board units. Wagons ride right to left (like
// Persian text), each with its place under it. Far wagons are reached with
// "…": the board shows wagons 1 to 4, a gap, then n − 1 and n. Above the
// wagons, each jump is an arc with its number ("جهش ۳") and the step, so the
// pupil sees that n wagons have only n − 1 jumps between them. Two sequences
// that meet ride as two rows, told apart by ● and ▲ (not by colour), with the
// gap between them written in between. Growing patterns are drawn as
// matchsticks or tiles, with the count under each shape.

import { patternShape, PATTERNS, ruleParts, termAt, type NthQuestion, type PatternKind } from "@/generators/nth-term";
import { fa } from "@/tools/registry";

const INK = "#0f172a";
const SOFT = "#5b6476";
const JUMP = "#2f6fdb";
const MARK = "#c0392b";
const WAGON = "#ffd36b";
const WAGON_B = "#a8d8ff";
const TILE = "#ffd36b";
const HEAD = "#c0392b";

const P = 1.5;
const W = 1.2;
const PAD = 0.35;
export const NTH_H = 5.3;

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const halo = { stroke: "#fff", strokeWidth: 4, paintOrder: "stroke" as const, vectorEffect: "non-scaling-stroke" as const };

/** Pattern names and what is counted. */
export const PATTERN_NAME: Record<PatternKind, string> = {
  squares: "مربع‌های چوب‌کبریتی",
  triangles: "مثلث‌های چوب‌کبریتی",
  houses: "خانه‌های چوب‌کبریتی",
  cross: "بعلاوه کاشی‌ها",
  corner: "گوشه کاشی‌ها",
};
export const unitOf = (kind: PatternKind) => (PATTERNS[kind].tiles ? "کاشی" : "چوب‌کبریت");

export type NSlot = { kind: "term"; k: number } | { kind: "gap" };
const term = (k: number): NSlot => ({ kind: "term", k });
const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);

/** Wagons 1 … n when few; otherwise 1 … lead, a gap, then n − 1 and n. */
export function farSlots(n: number, lead = 4): NSlot[] {
  if (n <= lead + 2) return range(1, n).map(term);
  return [...range(1, lead).map(term), { kind: "gap" }, term(n - 1), term(n)];
}

/** The row as a question gives it: the first terms, a gap, then (maybe) term n. */
export const givenSlots = (shown: number, n?: number): NSlot[] => [...range(1, shown).map(term), { kind: "gap" }, ...(n ? [term(n)] : [])];

export const nthView = (slotCount: number): [number, number, number, number] => [0, 0, r3(2 * PAD + slotCount * P), NTH_H];

export interface BoardLine {
  text: string;
  /** 0 … 1 */
  o: number;
  rtl?: boolean;
}

interface TrainProps {
  first: number;
  step: number;
  slots: NSlot[];
  /** Wagon k shows "؟" instead of its value. */
  hide?: number | null;
  /** Wagon k shows its value but "؟" for its place. */
  askPlace?: number | null;
  /** Wagons arriving one by one, 0 … 1 (explore). */
  build?: number;
  /** Under each wagon, how it is made. */
  under?: (k: number) => string | null;
  /** Jump arcs appearing one by one, 0 … 1. */
  jumps?: number;
  /** Wagon framed as the one asked. */
  target?: number | null;
  /** Lines of working under the train. */
  lines?: BoardLine[];
  mark?: { right: boolean; text: string } | null;
}

/** A train of terms first, first + step, … with the jumps counted above it. */
export function NthTrainG({ first, step, slots, hide = null, askPlace = null, build = 1, under, jumps = 0, target = null, lines = [], mark = null }: TrainProps) {
  const total = r3(2 * PAD + slots.length * P);
  const cx = (i: number) => r3(total - PAD - (i + 0.5) * P);
  const termSlots = slots.map((s, i) => ({ s, i })).filter((t): t is { s: Extract<NSlot, { kind: "term" }>; i: number } => t.s.kind === "term");
  const arrived = (j: number) => clamp01(build * termSlots.length - j);

  const els: React.ReactNode[] = [];

  // Jumps: one arc between neighbouring wagons, one long dashed arc across a gap.
  const arcs: { from: number; to: number; ka: number; kb: number }[] = [];
  for (let j = 0; j + 1 < termSlots.length; j++) {
    const a = termSlots[j];
    const b = termSlots[j + 1];
    arcs.push({ from: a.i, to: b.i, ka: a.s.k, kb: b.s.k });
  }
  arcs.forEach((arc, j) => {
    const o = jumps > 0 ? clamp01(jumps * arcs.length - j) : 0;
    if (o <= 0 || Math.min(arrived(j), arrived(j + 1)) < 1) return;
    const x1 = r3(cx(arc.from) - 0.22);
    const x2 = r3(cx(arc.to) + 0.22);
    const xm = r3((x1 + x2) / 2);
    const many = arc.kb - arc.ka > 1;
    const label = many ? `جهش ${fa(arc.ka)} تا ${fa(arc.kb - 1)}` : `جهش ${fa(arc.ka)}`;
    els.push(
      <g key={`arc${j}`} opacity={r3(o)}>
        <path d={`M${x1},1.48 Q${xm},0.62 ${x2},1.48`} fill="none" stroke={JUMP} strokeWidth={2} strokeDasharray={many ? "6 4" : undefined} vectorEffect="non-scaling-stroke" />
        <path d={`M${x2},1.48 l0.06,-0.24 l0.16,0.16 Z`} fill={JUMP} />
        <text x={xm} y={0.98} fontSize={0.3} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={JUMP} direction="ltr" {...halo}>
          {many ? `+${fa(step)} …` : `+${fa(step)}`}
        </text>
        <text x={xm} y={0.4} fontSize={0.24} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} direction="rtl">
          {label}
        </text>
      </g>,
    );
  });

  slots.forEach((s, i) => {
    const x = cx(i);
    if (s.kind === "gap") {
      els.push(
        <text key={`gap${i}`} x={x} y={2.0} fontSize={0.6} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={SOFT}>
          …
        </text>,
      );
      return;
    }
    const j = termSlots.findIndex((t) => t.i === i);
    const o = arrived(j);
    if (o <= 0) return;
    const k = s.k;
    const hidden = hide === k;
    const value = termAt(first, step, k);
    const text = hidden ? "؟" : fa(value);
    const isTarget = target === k;
    const sub = under?.(k);
    const dx = r3(-(1 - o) * 0.8);
    els.push(
      <g key={`w${i}`} opacity={r3(o)} transform={dx ? `translate(${dx} 0)` : undefined}>
        {/* Coupler to the wagon in front (to the right), not across a gap. */}
        {i > 0 && slots[i - 1].kind === "term" && <line x1={r3(x + W / 2)} y1={2.2} x2={r3(x + P - W / 2)} y2={2.2} stroke={INK} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />}
        <rect
          x={r3(x - W / 2)}
          y={1.55}
          width={W}
          height={0.9}
          rx={0.1}
          fill={hidden ? "#fff" : WAGON}
          stroke={isTarget ? MARK : INK}
          strokeWidth={isTarget ? 4 : 1.8}
          strokeDasharray={hidden ? "6 4" : undefined}
          vectorEffect="non-scaling-stroke"
        />
        <text x={x} y={2.0} fontSize={hidden ? 0.55 : r3(Math.min(0.46, 1.0 / (0.58 * Math.max(1, text.length))))} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
          {text}
        </text>
        <circle cx={r3(x - 0.33)} cy={2.53} r={0.09} fill={INK} />
        <circle cx={r3(x + 0.33)} cy={2.53} r={0.09} fill={INK} />
        <text x={x} y={2.88} fontSize={0.26} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={isTarget || askPlace === k ? MARK : SOFT} direction="rtl">
          {askPlace === k ? "جمله ؟" : `جمله ${fa(k)}`}
        </text>
        {sub && (
          <text x={x} y={3.26} fontSize={0.24} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={JUMP} direction="ltr">
            {sub}
          </text>
        )}
      </g>,
    );
  });

  els.push(...linesG(lines, total, 3.85));
  if (mark) els.push(markG(mark, total, 4.98));
  return <g>{els}</g>;
}

function linesG(lines: BoardLine[], total: number, y0: number) {
  return lines.map((l, j) =>
    l.o > 0 ? (
      <text key={`line${j}`} x={r3(total / 2)} y={r3(y0 + j * 0.55)} opacity={r3(clamp01(l.o))} fontSize={0.36} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} direction={l.rtl ? "rtl" : "ltr"}>
        {l.text}
      </text>
    ) : null,
  );
}

function markG(mark: { right: boolean; text: string }, total: number, y: number) {
  return (
    <text key="mark" x={r3(total / 2)} y={y} fontSize={0.32} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} direction="rtl">
      {mark.right ? `✓ درست: ${mark.text}` : `✗ ${mark.text}`}
    </text>
  );
}

/** "۳+۱۹×۴": how term k is made from the first term and the jumps. */
export const madeOf = (first: number, step: number, k: number) => (k === 1 ? fa(first) : `${fa(first)}+${fa(k - 1)}×${fa(step)}`);
/** "۳×۵+۴": term k from the rule. */
export const ruleOf = (coef: number, constant: number, k: number) => `${fa(coef)}×${fa(k)}+${fa(constant)}`;

// ── Two sequences that meet ─────────────────────────────────────────────

const MP = 1.3;
const MW = 1.05;
const HEAD_W = 1.9;
export const MEET_H = 5.6;

/** Columns 1 … shown and a gap before the answer; 1 … n after. */
export const meetColumns = (q: NthQuestion, done: boolean) => (done ? range(1, q.n) : range(1, q.shown));
export const meetView = (cols: number, done: boolean): [number, number, number, number] => [0, 0, r3(2 * PAD + HEAD_W + (cols + (done ? 0 : 1)) * MP), MEET_H];

interface MeetProps {
  q: NthQuestion;
  done: boolean;
  /** Gaps written column by column, 0 … 1. */
  reveal?: number;
  lines?: BoardLine[];
  mark?: { right: boolean; text: string } | null;
}

export function MeetG({ q, done, reveal = 0, lines = [], mark = null }: MeetProps) {
  const cols = meetColumns(q, done);
  const total = meetView(cols.length, done)[2];
  const headX = r3(total - PAD - HEAD_W / 2);
  const cx = (i: number) => r3(total - PAD - HEAD_W - (i + 0.5) * MP);
  const rows: { y: number; first: number; step: number; marker: "●" | "▲"; fill: string }[] = [
    { y: 0.75, first: q.first, step: q.step, marker: "●", fill: WAGON },
    { y: 2.55, first: q.first2, step: q.step2, marker: "▲", fill: WAGON_B },
  ];
  const els: React.ReactNode[] = [];
  rows.forEach((r, ri) => {
    els.push(
      <text key={`h${ri}`} x={headX} y={r3(r.y + 0.42)} fontSize={0.3} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} direction="rtl">
        {`دنباله ${r.marker}`}
      </text>,
    );
    cols.forEach((k, i) => {
      const x = cx(i);
      const v = termAt(r.first, r.step, k);
      const meet = done && k === q.n;
      els.push(
        <g key={`r${ri}c${k}`}>
          <rect x={r3(x - MW / 2)} y={r.y} width={MW} height={0.84} rx={0.1} fill={r.fill} stroke={meet ? MARK : INK} strokeWidth={meet ? 4 : 1.8} vectorEffect="non-scaling-stroke" />
          {r.marker === "●" ? (
            <circle cx={r3(x + MW / 2 - 0.16)} cy={r3(r.y + 0.15)} r={0.075} fill={INK} />
          ) : (
            <path d={`M${r3(x + MW / 2 - 0.16)},${r3(r.y + 0.06)} l0.09,0.17 l-0.18,0 Z`} fill={INK} />
          )}
          <text x={x} y={r3(r.y + 0.46)} fontSize={r3(Math.min(0.42, 0.9 / (0.58 * Math.max(1, fa(v).length))))} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
            {fa(v)}
          </text>
        </g>,
      );
    });
  });
  // Places on top; the gap between the rows in the middle.
  els.push(
    <text key="hp" x={headX} y={0.38} fontSize={0.26} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={SOFT} direction="rtl">
      جمله
    </text>,
  );
  if (done)
    els.push(
      <text key="hg" x={headX} y={2.07} fontSize={0.26} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={JUMP} direction="rtl">
        فاصله
      </text>,
    );
  cols.forEach((k, i) => {
    const x = cx(i);
    els.push(
      <text key={`p${k}`} x={x} y={0.38} fontSize={0.26} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={done && k === q.n ? MARK : SOFT}>
        {fa(k)}
      </text>,
    );
    if (!done) return;
    const o = clamp01(reveal * cols.length - i);
    if (o <= 0) return;
    const gap = termAt(q.first2, q.step2, k) - termAt(q.first, q.step, k);
    els.push(
      <text key={`g${k}`} x={x} y={2.07} opacity={r3(o)} fontSize={gap === 0 ? 0.24 : 0.3} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={JUMP} direction="rtl" {...halo}>
        {gap === 0 ? "۰ برابر" : fa(gap)}
      </text>,
    );
  });
  if (!done) {
    const x = cx(cols.length);
    els.push(
      <text key="gap" x={x} y={2.0} fontSize={0.6} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={SOFT}>
        …
      </text>,
    );
  }
  els.push(...linesG(lines, total, 3.95));
  if (mark) els.push(markG(mark, total, 5.15));
  return <g>{els}</g>;
}

// ── Growing patterns ────────────────────────────────────────────────────

const STICK_U = 0.6;
const TILE_U = 0.27;
const CELL_GAP = 0.5;
const BASE = 2.45;
export const PATTERN_H = 5.75;

/** Board units of one stick or tile. */
const unitSize = (kind: PatternKind) => (PATTERNS[kind].tiles ? TILE_U : STICK_U);
const cellW = (kind: PatternKind, k: number) => Math.max(1.5, patternShape(kind, k).width * unitSize(kind)) + CELL_GAP;

export function patternView(kind: PatternKind, shown: number): [number, number, number, number] {
  let w = 2 * PAD;
  for (let k = 1; k <= shown; k++) w += cellW(kind, k);
  return [0, 0, r3(w + 0.9 + 1.9), PATTERN_H];
}

/** Shape k drawn with its bottom middle at (x, BASE). */
function ShapeG({ kind, k, x }: { kind: PatternKind; k: number; x: number }) {
  const s = patternShape(kind, k);
  const u = unitSize(kind);
  const left = x - (s.width * u) / 2;
  const top = BASE - s.height * u;
  const X = (v: number) => r3(left + v * u);
  const Y = (v: number) => r3(top + v * u);
  return (
    <g>
      {s.tiles.map(([tx, ty], i) => (
        <rect key={`t${i}`} x={X(tx)} y={Y(ty)} width={r3(u)} height={r3(u)} fill={TILE} stroke={INK} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
      ))}
      {s.sticks.map(([x1, y1, x2, y2], i) => (
        <g key={`s${i}`}>
          <line x1={X(x1 + (x2 - x1) * 0.06)} y1={Y(y1 + (y2 - y1) * 0.06)} x2={X(x2 - (x2 - x1) * 0.06)} y2={Y(y2 - (y2 - y1) * 0.06)} stroke={INK} strokeWidth={3} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <circle cx={X(x2 - (x2 - x1) * 0.1)} cy={Y(y2 - (y2 - y1) * 0.1)} r={0.045} fill={HEAD} />
        </g>
      ))}
    </g>
  );
}

interface PatternProps {
  kind: PatternKind;
  shown: number;
  n: number;
  /** Show the count of shape n (after the answer). */
  done: boolean;
  /** "+step" arcs between the shapes, 0 … 1. */
  steps?: number;
  lines?: BoardLine[];
  mark?: { right: boolean; text: string } | null;
}

export function PatternG({ kind, shown, n, done, steps = 0, lines = [], mark = null }: PatternProps) {
  const total = patternView(kind, shown)[2];
  const { first, step } = PATTERNS[kind];
  const unit = unitOf(kind);
  const els: React.ReactNode[] = [];
  const centres: number[] = [];
  let right = total - PAD;
  for (let k = 1; k <= shown; k++) {
    const w = cellW(kind, k);
    const x = r3(right - w / 2);
    centres.push(x);
    right -= w;
    els.push(
      <g key={`shape${k}`}>
        <ShapeG kind={kind} k={k} x={x} />
        <text x={x} y={2.82} fontSize={0.28} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={SOFT} direction="rtl">
          {`شکل ${fa(k)}`}
        </text>
        <text x={x} y={3.2} fontSize={0.3} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} direction="rtl">
          {`${fa(termAt(first, step, k))} ${unit}`}
        </text>
      </g>,
    );
  }
  // The gap and shape n.
  const gx = r3(right - 0.45);
  els.push(
    <text key="gap" x={gx} y={1.9} fontSize={0.6} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={SOFT}>
      …
    </text>,
  );
  const nx = r3(right - 0.9 - 0.95);
  els.push(
    <g key="far">
      <rect x={r3(nx - 0.8)} y={0.75} width={1.6} height={1.7} rx={0.12} fill="#fff" stroke={done ? MARK : INK} strokeWidth={done ? 3 : 1.8} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
      <text x={nx} y={1.6} fontSize={done ? 0.42 : 0.6} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
        {done ? fa(termAt(first, step, n)) : "؟"}
      </text>
      <text x={nx} y={2.82} fontSize={0.28} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={MARK} direction="rtl">
        {`شکل ${fa(n)}`}
      </text>
    </g>,
  );
  // Each shape adds the same number.
  for (let j = 0; j + 1 < centres.length; j++) {
    const o = steps > 0 ? clamp01(steps * (centres.length - 1) - j) : 0;
    if (o <= 0) continue;
    const [x1, x2] = [r3(centres[j] - 0.3), r3(centres[j + 1] + 0.3)];
    const xm = r3((x1 + x2) / 2);
    els.push(
      <g key={`step${j}`} opacity={r3(o)}>
        <path d={`M${x1},3.42 Q${xm},3.82 ${x2},3.42`} fill="none" stroke={JUMP} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        <path d={`M${x2},3.42 l0.05,0.22 l0.17,-0.13 Z`} fill={JUMP} />
        <text x={xm} y={3.75} fontSize={0.28} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={JUMP} direction="ltr" {...halo}>
          {`+${fa(step)}`}
        </text>
      </g>,
    );
  }
  els.push(...linesG(lines, total, 4.3));
  if (mark) els.push(markG(mark, total, 5.42));
  return <g>{els}</g>;
}

// ── The working, as board lines ─────────────────────────────────────────

/** The working for a question, line by line, with how far each line has come in. */
export function nthLines(q: NthQuestion, f: number): BoardLine[] {
  const { first: a, step: d, n } = q;
  const at = (from: number) => clamp01((f - from) / 0.12);
  switch (q.variant) {
    case "far":
    case "pattern":
      return [
        { text: `(${fa(n)} − ۱) × ${fa(d)} = ${fa(n - 1)} × ${fa(d)} = ${fa((n - 1) * d)}`, o: at(0.5) },
        { text: `${fa(a)} + ${fa((n - 1) * d)} = ${fa(q.answer)}`, o: at(0.72) },
      ];
    case "which":
      return [
        { text: `(${fa(q.value)} − ${fa(a)}) ÷ ${fa(d)} = ${fa(q.value - a)} ÷ ${fa(d)} = ${fa(n - 1)}`, o: at(0.5) },
        { text: `${fa(n - 1)} + ۱ = ${fa(n)}`, o: at(0.72) },
      ];
    case "meet": {
      const g = q.first2 - q.first;
      const s = q.step - q.step2;
      return [
        { text: `(${fa(q.first2)} − ${fa(q.first)}) ÷ (${fa(q.step)} − ${fa(q.step2)}) = ${fa(g)} ÷ ${fa(s)} = ${fa(n - 1)}`, o: at(0.5) },
        { text: `${fa(n - 1)} + ۱ = ${fa(n)}`, o: at(0.72) },
      ];
    }
    case "rule": {
      const { coef, constant } = ruleParts(q.answer);
      return [
        { text: `${fa(coef)} × ۱ = ${fa(coef)}   →   ${fa(a)} − ${fa(coef)} = ${fa(constant)}`, o: at(0.5) },
        { text: `n → ${fa(coef)} × n + ${fa(constant)}`, o: at(0.72) },
      ];
    }
  }
}

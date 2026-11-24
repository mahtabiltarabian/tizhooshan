"use client";

// Repeating patterns for tool 9, in board units. The items ride as wagons
// right to left (like Persian text), each with its place number under it.
// Each cycle sits in a box labelled with its number ("دور ۳"); the start that
// does not repeat sits in a dashed box. Far-off cycles are skipped with "…",
// so item N is always on the board. Shapes are drawn as shapes, beads carry
// the first letter of their colour, days their initial, so no item is told by
// colour alone.

import { divide, itemAt, SYMBOL_NAMES, SYMBOLS, type CycleQuestion, type CycleSet } from "@/generators/cycle";
import { fa } from "@/tools/registry";

const INK = "#0f172a";
const SOFT = "#5b6476";
const BOX = "#2f6fdb";
const MARK = "#c0392b";
const WAGON = "#fff6dc";
const BEAD_FILL = ["#e0564f", "#2f6fdb", "#3f9a52", "#ffd36b", "#8a4fd6", "#f39c34"];
const BEAD_INK = ["#fff", "#fff", "#fff", INK, "#fff", INK];

const P = 1.15;
const W = 0.95;
const PAD = 0.35;
export const CYCLE_H = 5.2;

const r3 = (v: number) => Math.round(v * 1000) / 1000;
/** Keeps an equation left to right inside a Persian sentence. */
export const ltr = (s: string) => `⁦${s}⁩`;

/** One item drawn at (x, y), `s` across. */
export function SymbolG({ set, id, x, y, s }: { set: CycleSet; id: number; x: number; y: number; s: number }) {
  const sw = { stroke: INK, strokeWidth: 1.5, vectorEffect: "non-scaling-stroke" as const };
  const h = s / 2;
  if (set === "shapes") {
    switch (id) {
      case 0:
        return <circle cx={x} cy={y} r={r3(h * 0.8)} fill={INK} />;
      case 1:
        return <path d={`M${x},${r3(y - h * 0.85)} L${r3(x + h * 0.9)},${r3(y + h * 0.7)} L${r3(x - h * 0.9)},${r3(y + h * 0.7)} Z`} fill={INK} />;
      case 2:
        return <rect x={r3(x - h * 0.72)} y={r3(y - h * 0.72)} width={r3(h * 1.44)} height={r3(h * 1.44)} fill={INK} />;
      case 3:
        return <path d={`M${x},${r3(y - h * 0.9)} L${r3(x + h * 0.7)},${y} L${x},${r3(y + h * 0.9)} L${r3(x - h * 0.7)},${y} Z`} fill={INK} />;
      case 4: {
        const pts: string[] = [];
        for (let k = 0; k < 10; k++) {
          const a = ((-90 + 36 * k) * Math.PI) / 180;
          const r = k % 2 ? h * 0.4 : h * 0.92;
          pts.push(`${r3(x + r * Math.cos(a))},${r3(y + r * Math.sin(a))}`);
        }
        return <path d={`M${pts.join("L")}Z`} fill={INK} />;
      }
      default:
        return (
          <path
            d={`M${x},${r3(y + h * 0.8)} C${r3(x - h * 1.1)},${r3(y)} ${r3(x - h * 0.6)},${r3(y - h * 0.95)} ${x},${r3(y - h * 0.35)} C${r3(x + h * 0.6)},${r3(y - h * 0.95)} ${r3(x + h * 1.1)},${r3(y)} ${x},${r3(y + h * 0.8)} Z`}
            fill={INK}
          />
        );
    }
  }
  if (set === "beads")
    return (
      <g>
        <circle cx={x} cy={y} r={r3(h * 0.85)} fill={BEAD_FILL[id]} {...sw} />
        <text x={x} y={r3(y + 0.02)} fontSize={r3(s * 0.48)} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={BEAD_INK[id]}>
          {SYMBOLS.beads[id]}
        </text>
      </g>
    );
  return (
    <text x={x} y={r3(y + 0.02)} fontSize={r3(s * 0.62)} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
      {SYMBOLS[set][id]}
    </text>
  );
}

/** A small picture of one item, for buttons and lists. */
export function SymbolIcon({ set, id, size = 26 }: { set: CycleSet; id: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-0.5 -0.5 1 1" aria-hidden style={{ verticalAlign: "middle", flex: "none" }}>
      <SymbolG set={set} id={id} x={0} y={0} s={0.95} />
    </svg>
  );
}

/** An item in words: «ب», "مثلث ▲", "مهره آبی", "سه‌شنبه". */
export function symbolWord(set: CycleSet, id: number) {
  if (set === "letters") return `«${SYMBOLS.letters[id]}»`;
  if (set === "shapes") return `${SYMBOL_NAMES.shapes[id]} ${SYMBOLS.shapes[id]}`;
  if (set === "beads") return `مهره ${SYMBOL_NAMES.beads[id]}`;
  return SYMBOL_NAMES.days[id];
}

/** Items in a sentence: "ا، ب، پ" / "●، ▲، ■" / "قرمز، آبی" / "شنبه، یکشنبه". */
export function rowWords(set: CycleSet, ids: number[]) {
  return ids.map((id) => (set === "letters" || set === "shapes" ? SYMBOLS[set][id] : SYMBOL_NAMES[set][id])).join("، ");
}

/** What one item is called. */
export const noun = (set: CycleSet) => (set === "letters" ? "حرفی" : set === "shapes" ? "شکلی" : set === "beads" ? "مهره‌ای" : "روزی");

type Slot = { kind: "item"; pos: number } | { kind: "gap" };
interface Box {
  /** 0 = the start that does not repeat; 1, 2, … cycles. */
  c: number;
  from: number;
  to: number;
}

/** The cycle (1, 2, …) holding place `pos`, or 0 inside the start. */
const cycleOf = (p: number, L: number, pos: number) => (pos <= p ? 0 : Math.ceil((pos - p) / L));

/**
 * The slots on the board: the start, the first cycles, then (if far) a gap
 * and the cycle holding N. `given` shows the row as the question gives it:
 * the first `shown` items, a gap and N alone.
 */
export function cycleLayout(p: number, L: number, n: number, given?: number) {
  const slots: Slot[] = [];
  const boxes: Box[] = [];
  const addCycle = (c: number) => {
    const from = slots.length;
    for (let k = 1; k <= L; k++) slots.push({ kind: "item", pos: p + (c - 1) * L + k });
    boxes.push({ c, from, to: slots.length - 1 });
  };
  if (given !== undefined) {
    for (let pos = 1; pos <= given; pos++) slots.push({ kind: "item", pos });
    slots.push({ kind: "gap" }, { kind: "item", pos: n });
    return { slots, boxes };
  }
  if (p) {
    for (let pos = 1; pos <= p; pos++) slots.push({ kind: "item", pos });
    boxes.push({ c: 0, from: 0, to: p - 1 });
  }
  const cN = Math.max(2, cycleOf(p, L, n));
  const lead = L <= 4 ? 2 : 1;
  if (cN <= lead + 1) for (let c = 1; c <= cN; c++) addCycle(c);
  else {
    for (let c = 1; c <= lead; c++) addCycle(c);
    slots.push({ kind: "gap" });
    addCycle(cN);
  }
  return { slots, boxes };
}

export const cycleView = (slotCount: number): [number, number, number, number] => [0, 0, r3(2 * PAD + slotCount * P), CYCLE_H];

interface CycleProps {
  set: CycleSet;
  prefix: number[];
  cycle: number[];
  n: number;
  /** Show the row as given (`shown` items, then N alone), not grouped. */
  given?: number;
  /** "؟" on item N. */
  hideN?: boolean;
  /** How many boxes are drawn, 0 … 1 (show me). */
  boxes?: number;
  /** Walk through the last cycle up to N, 0 … 1 (show me); 1 = N marked. */
  walk?: number;
  /** The equation under the row, and how far it has come in (0 … 1). */
  equation?: number;
  /** Count questions: mark every item of this symbol, with a count per box. */
  target?: number;
  /** The checked answer. */
  mark?: { right: boolean; text: string } | null;
}

export function CycleG({ set, prefix, cycle, n, given, hideN = false, boxes: boxShare = 1, walk = 1, equation = 0, target, mark = null }: CycleProps) {
  const p = prefix.length;
  const L = cycle.length;
  const q = { prefix, cycle };
  const { slots, boxes } = cycleLayout(p, L, n, given);
  const total = r3(2 * PAD + slots.length * P);
  const cx = (i: number) => r3(total - PAD - (i + 0.5) * P);
  const { cycles, rem } = divide({ prefix, cycle, n });
  const shownBoxes = Math.round(Math.min(1, Math.max(0, boxShare)) * boxes.length);
  const counting = target !== undefined;

  // The walk inside the last cycle: from its first item up to N (or to its last item when r = 0).
  const lastBox = boxes[boxes.length - 1];
  const steps = rem || L;
  const walked = given === undefined && lastBox && n > p ? Math.min(steps, Math.ceil(walk * steps - 1e-9)) : 0;

  const els: React.ReactNode[] = [];
  boxes.slice(0, shownBoxes).forEach((b) => {
    const x1 = r3(cx(b.to) - P / 2 + 0.04);
    const x2 = r3(cx(b.from) + P / 2 - 0.04);
    const items = slots.slice(b.from, b.to + 1).filter((s): s is Extract<Slot, { kind: "item" }> => s.kind === "item");
    const inBox = counting ? items.filter((s) => s.pos <= n && itemAt(q, s.pos) === target).length : 0;
    els.push(
      <g key={`box${b.c}`}>
        <rect x={x1} y={1.05} width={r3(x2 - x1)} height={2.05} rx={0.14} fill="none" stroke={b.c ? BOX : SOFT} strokeWidth={2} strokeDasharray={b.c ? undefined : "5 4"} vectorEffect="non-scaling-stroke" />
        <text x={r3((x1 + x2) / 2)} y={0.78} fontSize={0.3} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={b.c ? BOX : SOFT} direction="rtl">
          {b.c ? `دور ${fa(b.c)}` : "شروع (تکرار نمی‌شود)"}
          {counting && b.c ? ` · ${fa(inBox)} تا` : ""}
        </text>
      </g>,
    );
  });

  slots.forEach((s, i) => {
    const x = cx(i);
    if (s.kind === "gap") {
      els.push(
        <text key={`gap${i}`} x={x} y={2.05} fontSize={0.6} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={SOFT}>
          …
        </text>,
      );
      return;
    }
    const isN = s.pos === n;
    const id = itemAt(q, s.pos);
    // While walking the last cycle, the items passed so far are ringed.
    const inLast = lastBox && i >= lastBox.from && i <= lastBox.to && given === undefined;
    const k = inLast ? i - lastBox.from + 1 : 0;
    const passed = inLast && k <= walked && walk < 1;
    const hidden = isN && hideN;
    const counted = counting && s.pos <= n && id === target && given === undefined;
    els.push(
      <g key={`w${i}`}>
        <rect
          x={r3(x - W / 2)}
          y={1.55}
          width={W}
          height={W}
          rx={0.12}
          fill={hidden ? "#fff" : WAGON}
          stroke={isN && !hideN && !counting ? MARK : INK}
          strokeWidth={isN || passed ? 4 : 1.8}
          strokeDasharray={hidden ? "5 3" : undefined}
          vectorEffect="non-scaling-stroke"
        />
        {hidden ? (
          <text x={x} y={2.04} fontSize={0.6} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
            ؟
          </text>
        ) : (
          <SymbolG set={set} id={id} x={x} y={2.02} s={0.78} />
        )}
        {counted && <rect x={r3(x - W / 2 + 0.1)} y={2.56} width={r3(W - 0.2)} height={0.09} fill={INK} />}
        <text x={x} y={2.86} fontSize={s.pos >= 100 ? 0.22 : 0.26} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={isN ? MARK : SOFT}>
          {fa(s.pos)}
        </text>
        {passed && (
          <text x={x} y={3.4} fontSize={0.26} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={BOX}>
            {fa(k)}
          </text>
        )}
        {isN && (
          <path d={`M${x},3.25 l-0.16,0.26 l0.32,0 Z`} fill={counting ? INK : MARK} transform={`rotate(180 ${x} 3.38)`} />
        )}
      </g>,
    );
  });

  // N − start = cycles × L + r, then where N lands.
  if (equation > 0 && n > p) {
    const m = n - p;
    const eq = p ? `${fa(n)} − ${fa(p)} = ${fa(m)} = ${fa(cycles)} × ${fa(L)} + ${fa(rem)}` : `${fa(n)} = ${fa(cycles)} × ${fa(L)} + ${fa(rem)}`;
    const said = counting
      ? `${fa(cycles)} دور کامل و ${fa(rem)} خانه دیگر`
      : rem
        ? `${fa(cycles)} دور کامل، بعد خانه ${fa(rem)}ام دور بعدی`
        : `باقیمانده ۰: خانه ${fa(n)} آخرین خانه دور ${fa(cycles)} است`;
    els.push(
      <g key="eq" opacity={r3(Math.min(1, equation))}>
        <text x={r3(total / 2)} y={3.95} fontSize={0.4} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} direction="ltr">
          {eq}
        </text>
        <text x={r3(total / 2)} y={4.5} fontSize={0.32} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={BOX} direction="rtl">
          {said}
        </text>
      </g>,
    );
  }
  if (mark)
    els.push(
      <text key="mark" x={r3(total / 2)} y={4.95} fontSize={0.34} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} direction="rtl">
        {mark.right ? `✓ درست: ${mark.text}` : `✗ ${mark.text}`}
      </text>,
    );
  return <g>{els}</g>;
}

/** The board for a cycle question, before and after the answer. */
export function cycleBoardProps(q: CycleQuestion, done: boolean) {
  const given = done ? undefined : q.shown;
  const { slots } = cycleLayout(q.prefix.length, q.cycle.length, q.n, given);
  return { view: cycleView(slots.length), given };
}

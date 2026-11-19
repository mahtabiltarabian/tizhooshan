"use client";

// Drawings for tool 18, in board units: the shapes of shape codes, the cipher
// wheel (plain letters outside, code tokens inside), rows of letter boxes and
// key tables. Every letter sits in its own box, so it shows in its isolated
// form; whole words are written separately, joined as usual. Highlighted
// letters get a thick outline and an order number, not only a colour.

import { useRef } from "react";
import { ALPHABET, encodeLetter, mod, N, SHAPE_FA, SHAPES, SPACE, type Rule, type TokenKind } from "@/generators/codes";
import { fa } from "@/tools/registry";

export const INK = "#1f2430";
const SOFT = "#5b6170";
const MARK = "#ffe08a";
const INNER = "#eef3ff";
const STEP = 360 / N;

// Rounded: the server and the browser differ in the last digits of sin and cos.
const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [r4(cx + r * Math.sin(a)), r4(cy - r * Math.cos(a))];
};
const ring = (n: number, r: number, offset = 0) =>
  Array.from({ length: n }, (_, k) => polar(0, 0, k % 2 && offset ? offset : r, (k * 360) / n))
    .map(([x, y], k) => `${k ? "L" : "M"}${x},${y}`)
    .join(" ") + " Z";
const STAR = ring(10, 0.5, 0.21);
const HEXAGON = ring(6, 0.47);

/** One shape, drawn in a box from -0.5 to 0.5. */
function shapeBody(s: number, ink = INK) {
  switch (SHAPES[s]) {
    case "circle":
      return <circle r={0.42} fill={ink} />;
    case "triangle":
      return <path d="M0,-0.46 L0.48,0.38 L-0.48,0.38 Z" fill={ink} />;
    case "square":
      return <rect x={-0.38} y={-0.38} width={0.76} height={0.76} fill={ink} />;
    case "diamond":
      return <path d="M0,-0.5 L0.38,0 L0,0.5 L-0.38,0 Z" fill={ink} />;
    case "star":
      return <path d={STAR} fill={ink} />;
    case "heart":
      return <path d="M0,0.44 C-0.62,0 -0.42,-0.62 0,-0.22 C0.42,-0.62 0.62,0 0,0.44 Z" fill={ink} />;
    case "moon":
      return <path d="M0.12,-0.434 A0.45,0.45 0 1 0 0.12,0.434 A0.34,0.34 0 0 1 0.12,-0.434 Z" fill={ink} />;
    case "plus":
      return <path d="M-0.13,-0.46 H0.13 V-0.13 H0.46 V0.13 H0.13 V0.46 H-0.13 V0.13 H-0.46 V-0.13 H-0.13 Z" fill={ink} />;
    case "hexagon":
      return <path d={HEXAGON} fill={ink} />;
    case "arrow":
      return <path d="M0,-0.5 L0.42,-0.02 L0.15,-0.02 L0.15,0.46 L-0.15,0.46 L-0.15,-0.02 L-0.42,-0.02 Z" fill={ink} />;
    case "ring":
      return (
        <>
          <circle r={0.36} fill="none" stroke={ink} strokeWidth={0.12} />
          <circle r={0.11} fill={ink} />
        </>
      );
    case "cross":
      return <path d="M-0.42,-0.27 L-0.27,-0.42 L0,-0.15 L0.27,-0.42 L0.42,-0.27 L0.15,0 L0.42,0.27 L0.27,0.42 L0,0.15 L-0.27,0.42 L-0.42,0.27 L-0.15,0 Z" fill={ink} />;
    default:
      return null;
  }
}

export function ShapeG({ shape, x, y, size }: { shape: number; x: number; y: number; size: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`} aria-label={SHAPE_FA[SHAPES[shape]]}>
      {shapeBody(shape)}
    </g>
  );
}

/** A shape as a small picture inside HTML (side panel, worksheet). */
export function ShapeIcon({ shape, size = 26 }: { shape: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-0.55 -0.55 1.1 1.1" role="img" aria-label={SHAPE_FA[SHAPES[shape]] ?? "شکل"} style={{ display: "inline-block", verticalAlign: "middle" }}>
      {shapeBody(shape)}
    </svg>
  );
}

/** A code token centred at x, y in a box of the given size. */
export function TokenG({ kind, t, x, y, size }: { kind: TokenKind; t: number; x: number; y: number; size: number }) {
  if (kind === "shape") return <ShapeG shape={t} x={x} y={y} size={size * 0.62} />;
  return (
    <text x={x} y={y} fontSize={size * (kind === "number" ? (t >= 10 ? 0.46 : 0.56) : 0.62)} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
      {kind === "number" ? fa(t) : (ALPHABET[t] ?? "")}
    </text>
  );
}

/** The token a rule gives letter i, as text (for captions and lists). */
export function tokenText(kind: TokenKind, t: number | null) {
  if (t === null) return "؟";
  if (t === SPACE) return " ";
  return kind === "number" ? fa(t) : kind === "shape" ? SHAPE_FA[SHAPES[t]] : (ALPHABET[t] ?? "؟");
}

// ---------------------------------------------------------------- the wheel

interface WheelProps {
  rule: Rule;
  cx: number;
  cy: number;
  r: number;
  /** Shift rules: how far the inner ring has turned, in letters (fractions while it moves). */
  turn?: number;
  /** Other rules: how much the inner ring has appeared, 0 … 1. */
  reveal?: number;
  /** Letters of the text, in order; the first `linked` are joined to their code. */
  word?: number[];
  linked?: number;
  /** Drag the inner ring to set a shift. */
  onTurn?: (n: number) => void;
}

/** Sector i is centred on -i × STEP: ا at the top, the alphabet running anticlockwise (right to left over the top). */
const sectorPath = (cx: number, cy: number, r1: number, r2: number, i: number) => {
  const a0 = -i * STEP - STEP / 2;
  const a1 = a0 + STEP;
  const [x1, y1] = polar(cx, cy, r2, a0);
  const [x2, y2] = polar(cx, cy, r2, a1);
  const [x3, y3] = polar(cx, cy, r1, a1);
  const [x4, y4] = polar(cx, cy, r1, a0);
  return `M${x1},${y1} A${r2},${r2} 0 0 1 ${x2},${y2} L${x3},${y3} A${r1},${r1} 0 0 0 ${x4},${y4} Z`;
};

export function Wheel({ rule, cx, cy, r, turn, reveal = 1, word = [], linked = 0, onTurn }: WheelProps) {
  const drag = useRef<{ last: number; turn: number } | null>(null);
  const kind = rule.kind === "number" ? "number" : rule.kind === "shape" ? "shape" : "letter";
  const shift = rule.kind === "shift";
  const t = shift ? (turn ?? rule.n) : 0;
  const rOut = r;
  const rMid = r * 0.78;
  const rIn = r * 0.52;

  const angleAt = (e: React.PointerEvent<SVGElement>) => {
    const el = e.currentTarget as unknown as SVGGraphicsElement;
    const ctm = (el.ownerSVGElement ?? el).getScreenCTM();
    if (!ctm) return 0;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return (Math.atan2(p.x - cx, -(p.y - cy)) * 180) / Math.PI;
  };
  const down = (e: React.PointerEvent<SVGElement>) => {
    if (!onTurn) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { last: angleAt(e), turn: t };
  };
  const move = (e: React.PointerEvent<SVGElement>) => {
    const d = drag.current;
    if (!d || !onTurn) return;
    const a = angleAt(e);
    d.turn += (((a - d.last + 540) % 360) - 180) / STEP;
    d.last = a;
    const n = Math.round(d.turn);
    const signed = mod(n) > N / 2 ? mod(n) - N : mod(n);
    if (signed !== t) onTurn(signed);
  };
  const up = () => (drag.current = null);

  // Which sectors are linked so far, with their order numbers.
  const order = new Map<number, number[]>();
  let k = 0;
  for (const x of word) {
    if (x === SPACE) continue;
    if (k < linked) order.set(x, [...(order.get(x) ?? []), k + 1]);
    k++;
  }

  const sectors = [];
  const inner = [];
  for (let i = 0; i < N; i++) {
    const on = order.has(i);
    sectors.push(<path key={`o${i}`} d={sectorPath(cx, cy, rMid, rOut, i)} fill={on ? MARK : "#fff"} stroke={INK} strokeWidth={1} vectorEffect="non-scaling-stroke" />);
    sectors.push(<path key={`i${i}`} d={sectorPath(cx, cy, rIn, rMid, i)} fill={on ? MARK : INNER} stroke={INK} strokeWidth={1} vectorEffect="non-scaling-stroke" />);
    const [lx, ly] = polar(cx, cy, (rOut + rMid) / 2, -i * STEP);
    sectors.push(
      <text key={`l${i}`} x={lx} y={ly} fontSize={r * 0.105} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
        {ALPHABET[i]}
      </text>,
    );
    // Inner ring: a shift ring carries the alphabet round; other rules write each letter's code.
    if (shift) {
      const [x, y] = polar(cx, cy, (rMid + rIn) / 2, -(i - t) * STEP);
      inner.push(
        <text key={`c${i}`} x={x} y={y} fontSize={r * 0.08} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
          {ALPHABET[i]}
        </text>,
      );
    } else {
      const code = encodeLetter(rule, i);
      if (code === null) continue;
      const [x, y] = polar(cx, cy, (rMid + rIn) / 2, -i * STEP);
      inner.push(
        <g key={`c${i}`} opacity={reveal}>
          <TokenG kind={kind} t={code} x={x} y={y} size={r * (kind === "number" ? 0.155 : 0.16)} />
        </g>,
      );
    }
  }

  // Thick outlines and order numbers for the linked letters.
  const links = [...order.entries()].map(([i, nums]) => {
    const [bx, by] = polar(cx, cy, rOut + r * 0.09, -i * STEP);
    return (
      <g key={`k${i}`}>
        <path d={sectorPath(cx, cy, rIn, rOut, i)} fill="none" stroke={INK} strokeWidth={4} vectorEffect="non-scaling-stroke" />
        <circle cx={bx} cy={by} r={r * 0.065} fill={INK} />
        <text x={bx} y={by} fontSize={r * (nums.length > 1 ? 0.05 : 0.075)} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill="#fff">
          {fa(nums.join("،"))}
        </text>
      </g>
    );
  });

  const grab = onTurn ? { cursor: "grab", touchAction: "none" as const } : undefined;
  return (
    <g>
      {sectors}
      <g onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={grab}>
        {onTurn && <circle cx={cx} cy={cy} r={rMid} fill="transparent" />}
        {inner}
      </g>
      {links}
      <circle cx={cx} cy={cy} r={rIn} fill="#fff" stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <text x={cx} y={cy - r * 0.12} fontSize={r * 0.085} textAnchor="middle" dominantBaseline="central" fill={SOFT}>
        بیرون: حرف
      </text>
      <text x={cx} y={cy + r * 0.02} fontSize={r * 0.085} textAnchor="middle" dominantBaseline="central" fill={SOFT}>
        درون: رمز
      </text>
      {onTurn && (
        <text x={cx} y={cy + r * 0.17} fontSize={r * 0.07} textAnchor="middle" dominantBaseline="central" fill={SOFT}>
          حلقه درون را بچرخان
        </text>
      )}
    </g>
  );
}

// ---------------------------------------------------------------- rows of boxes

/** Width of a row: a box per token, half a box for a space. */
export const rowWidth = (tokens: readonly (number | null)[], size: number) => tokens.reduce<number>((w, t) => w + (t === SPACE ? size * 0.5 : size * 1.08), 0);

/** Box size that fits n tokens in a width. */
export const fitSize = (tokens: readonly (number | null)[], width: number, max = 1.1) => Math.min(max, width / Math.max(1, rowWidth(tokens, 1)));

interface RowProps {
  tokens: readonly (number | null)[];
  kind: TokenKind;
  /** Right edge: the row reads right to left. */
  right: number;
  y: number;
  size: number;
  /** ✓ / ✗ under each box. */
  marks?: boolean[];
  /** Box with the cursor (thick dashed outline and ▲ under it). */
  active?: number;
  onSlot?: (i: number) => void;
  /** Number of the first tokens drawn; the rest are empty boxes. */
  shown?: number;
}

/** x of the centre of each token. */
export function rowCentres(tokens: readonly (number | null)[], right: number, size: number) {
  const xs: number[] = [];
  let x = right;
  for (const t of tokens) {
    const w = t === SPACE ? size * 0.5 : size * 1.08;
    xs.push(x - w / 2);
    x -= w;
  }
  return xs;
}

export function TokenRow({ tokens, kind, right, y, size, marks, active, onSlot, shown = tokens.length }: RowProps) {
  const xs = rowCentres(tokens, right, size);
  return (
    <g>
      {tokens.map((t, i) => {
        if (t === SPACE) return null;
        const x = xs[i];
        const on = active === i;
        return (
          <g key={i} onClick={onSlot ? () => onSlot(i) : undefined} style={onSlot ? { cursor: "pointer" } : undefined}>
            <rect
              x={x - size / 2}
              y={y - size / 2}
              width={size}
              height={size}
              rx={size * 0.14}
              fill={t === null || i >= shown ? "#fbf8f1" : "#fff"}
              stroke={INK}
              strokeWidth={on ? 4 : 1.5}
              strokeDasharray={t === null || i >= shown ? "5 4" : undefined}
              vectorEffect="non-scaling-stroke"
            />
            {t !== null && i < shown && <TokenG kind={kind} t={t} x={x} y={y} size={size} />}
            {on && <path d={`M${x},${y + size * 0.58} l${size * 0.16},${size * 0.24} h${-size * 0.32} Z`} fill={INK} />}
            {marks && (
              <text x={x} y={y + size * 0.82} fontSize={size * 0.42} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={marks[i] ? "#1d7a46" : "#b3261e"}>
                {marks[i] ? "✓" : "✗"}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** Arrows between a row and the row under it. */
export function DownArrows({ tokens, right, y, size }: { tokens: readonly (number | null)[]; right: number; y: number; size: number }) {
  const xs = rowCentres(tokens, right, size);
  return (
    <g>
      {tokens.map((t, i) =>
        t === SPACE ? null : (
          <path key={i} d={`M${xs[i]},${y - size * 0.2} V${y + size * 0.12} m${-size * 0.12},${-size * 0.12} l${size * 0.12},${size * 0.12} l${size * 0.12},${-size * 0.12}`} fill="none" stroke={SOFT} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        ),
      )}
    </g>
  );
}

/** A label to the right of a row. */
export function RowLabel({ x, y, text, size = 0.36 }: { x: number; y: number; text: string; size?: number }) {
  return (
    <text x={x} y={y} fontSize={size} fontWeight={700} textAnchor="end" dominantBaseline="central" fill={SOFT}>
      {text}
    </text>
  );
}

/** A table of letters (top) and their codes (bottom), right to left, in rows of up to `perRow`. */
export function KeyTable({ letters, rule, x, y, width, perRow = 16, codes = true }: { letters: number[]; rule: Rule | null; x: number; y: number; width: number; perRow?: number; codes?: boolean }) {
  const kind = rule ? (rule.kind === "number" ? "number" : rule.kind === "shape" ? "shape" : "letter") : "letter";
  const per = Math.min(perRow, letters.length);
  const w = Math.min(1.1, width / per);
  const h = codes ? w * 1.7 : w;
  const rows = Math.ceil(letters.length / per);
  const cells = letters.map((l, i) => {
    const row = Math.floor(i / per);
    const col = i % per;
    const cxr = x + width / 2 + (per * w) / 2 - (col + 0.5) * w;
    const top = y + row * (h + w * 0.25);
    const code = rule && codes ? encodeLetter(rule, l) : null;
    return (
      <g key={l}>
        <rect x={cxr - w / 2} y={top} width={w} height={h} fill="#fff" stroke={INK} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {codes && <line x1={cxr - w / 2} x2={cxr + w / 2} y1={top + w * 0.85} y2={top + w * 0.85} stroke={INK} strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
        <text x={cxr} y={top + w * 0.44} fontSize={w * 0.52} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
          {ALPHABET[l]}
        </text>
        {code !== null && <TokenG kind={kind} t={code} x={cxr} y={top + w * 1.28} size={w * 0.9} />}
      </g>
    );
  });
  return <g aria-label={`جدول رمز، ${fa(rows)} ردیف`}>{cells}</g>;
}

export const keyTableHeight = (count: number, width: number, perRow = 16, codes = true) => {
  const per = Math.min(perRow, count);
  const w = Math.min(1.1, width / per);
  const h = codes ? w * 1.7 : w;
  const rows = Math.ceil(count / per);
  return rows * h + (rows - 1) * w * 0.25;
};

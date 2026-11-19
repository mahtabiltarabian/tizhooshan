"use client";

// The number machine in board units. Numbers flow left to right: the input
// on the left, a box per step inside the machine, the output on the right
// (the same direction as the equations). A number token rides the belt,
// goes into each box and comes out changed. Run backwards, the token goes
// right to left and each box shows its inverse step. Adding and multiplying
// boxes differ in shape as well as colour; a hidden box is hatched with "؟".

import { inverse, isMult, type Example, type OpDef, type Step } from "@/generators/number-machine";
import { numFa, opDefFa, stepFa } from "./format";

export const INK = "#1f2430";
const SOFT = "#5b6170";
const TOKEN = "#ffc93d";
const ADD_FILL = "#dcebff";
const MULT_FILL = "#ffe3c2";
const HOUSING = "#fbf7ef";

const round = (v: number) => Math.round(v * 1e4) / 1e4;

/** Font size that fits `text` in `width`. */
const fit = (text: string, width: number, max: number) => round(Math.min(max, width / (0.62 * Math.max(1, text.length))));

/** Hatching for hidden boxes, defined once per drawing. */
export function MachineDefs() {
  return (
    <defs>
      <pattern id="nm-hatch" width={0.3} height={0.3} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width={0.3} height={0.3} fill="#eef0f4" />
        <line x1={0} y1={0} x2={0} y2={0.3} stroke="#9aa1b0" strokeWidth={0.08} />
      </pattern>
      <marker id="nm-head" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={6} markerHeight={6} orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 Z" fill={SOFT} />
      </marker>
    </defs>
  );
}

interface MachineProps {
  /** One box per step; null is a hidden box. */
  steps: (Step | null)[];
  /**
   * Values at the slots before, between and after the boxes (steps + 1).
   * A number is shown, null is "؟", undefined is an empty slot.
   */
  values: (number | null | undefined)[];
  /** A token rides the belt: 0 … steps (in steps passed). Slots fill as it reaches them. */
  token?: number;
  /** Run backwards: the token goes right to left and boxes show their inverse. */
  back?: boolean;
  cx: number;
  cy: number;
  width: number;
  /** Words over the input and output (the default is ورودی and خروجی). */
  ends?: [string, string];
}

/** x of slot i (even: values, odd: boxes) and sizes, for n steps in `width`. */
export function machineLayout(n: number, cx: number, width: number) {
  const pitch = Math.min(2.6, (width - 1.6) / (2 * n));
  return {
    pitch,
    x: (i: number) => round(cx - n * pitch + i * pitch),
    boxW: Math.min(2, pitch * 0.95),
    tagW: Math.min(1.5, pitch * 0.7),
  };
}

export function MachineG({ steps, values, token, back, cx, cy, width, ends = ["ورودی", "خروجی"] }: MachineProps) {
  const n = steps.length;
  const { x, boxW, tagW, pitch } = machineLayout(n, cx, width);
  const boxH = 1.7;
  const tagH = 0.95;
  const left = x(1) - boxW / 2 - 0.12;
  const right = x(2 * n - 1) + boxW / 2 + 0.12;

  // Where the token is: travelling from slot s to the next one.
  let tokenX = 0;
  let tokenValue: number | null | undefined;
  if (token !== undefined) {
    const p = Math.max(0, Math.min(n, token));
    const s = Math.min(n - 1, Math.floor(p));
    const t = p - s;
    const [from, to] = back ? [n - s, n - s - 1] : [s, s + 1];
    tokenX = round(x(2 * from) + (x(2 * to) - x(2 * from)) * t);
    tokenValue = t < 0.5 ? values[from] : values[to];
  }
  const reached = (i: number) => token === undefined || (back ? n - token <= i + 1e-6 : token >= i - 1e-6);

  const tags = values.map((v, i) => {
    const shown = reached(i) ? v : i === (back ? 0 : n) ? null : undefined;
    const text = shown === undefined ? "" : shown === null ? "؟" : numFa(shown);
    const end = i === 0 || i === n;
    return (
      <g key={`t${i}`}>
        <rect
          x={round(x(2 * i) - tagW / 2)}
          y={round(cy - tagH / 2)}
          width={round(tagW)}
          height={tagH}
          rx={0.2}
          fill="#fff"
          stroke={INK}
          strokeWidth={end ? 2.5 : 1.5}
          strokeDasharray={shown === undefined || shown === null ? "4 3" : undefined}
          vectorEffect="non-scaling-stroke"
        />
        <text x={x(2 * i)} y={cy + 0.03} fontSize={fit(text, tagW - 0.15, 0.55)} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
          {text}
        </text>
      </g>
    );
  });

  const boxes = steps.map((s, k) => {
    const bx = x(2 * k + 1);
    const top = round(cy - boxH / 2);
    if (!s)
      return (
        <g key={`b${k}`}>
          <rect x={round(bx - boxW / 2)} y={top} width={round(boxW)} height={boxH} rx={0.18} fill="url(#nm-hatch)" stroke={INK} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
          <text x={bx} y={cy} fontSize={0.85} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} stroke="#fff" strokeWidth={5} paintOrder="stroke" vectorEffect="non-scaling-stroke">
            ؟
          </text>
        </g>
      );
    const shown = back ? inverse(s) : s;
    const mult = isMult(s.op);
    const label = stepFa(shown);
    return (
      <g key={`b${k}`}>
        {/* Adding boxes are square-cornered, multiplying boxes round-cornered with a double edge. */}
        <rect x={round(bx - boxW / 2)} y={top} width={round(boxW)} height={boxH} rx={mult ? 0.55 : 0.08} fill={mult ? MULT_FILL : ADD_FILL} stroke={INK} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
        {mult && <rect x={round(bx - boxW / 2 + 0.1)} y={top + 0.1} width={round(boxW - 0.2)} height={boxH - 0.2} rx={0.45} fill="none" stroke={INK} strokeWidth={1} vectorEffect="non-scaling-stroke" />}
        {back && (
          <text x={bx} y={round(top + 0.3)} fontSize={0.24} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={SOFT}>
            برعکس
          </text>
        )}
        <text x={bx} y={cy + 0.04} fontSize={fit(label, boxW - 0.25, 0.75)} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
          {label}
        </text>
        {back && (
          <text x={bx} y={round(top + boxH - 0.28)} fontSize={0.24} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={SOFT}>
            ({stepFa(s)})
          </text>
        )}
      </g>
    );
  });

  // Arrows on the belt between neighbouring slots, in the direction of travel.
  const arrows = Array.from({ length: 2 * n }, (_, i) => {
    const mid = (x(i) + x(i + 1)) / 2;
    const d = back ? -0.12 : 0.12;
    return <line key={`a${i}`} x1={round(mid - d)} y1={cy} x2={round(mid + d)} y2={cy} stroke={SOFT} strokeWidth={2} markerEnd="url(#nm-head)" vectorEffect="non-scaling-stroke" />;
  });

  const labelY = round(cy - boxH / 2 - 0.35);
  return (
    <g>
      <MachineDefs />
      <rect x={round(left)} y={round(cy - boxH / 2 - 0.25)} width={round(right - left)} height={round(boxH + 0.5)} rx={0.35} fill={HOUSING} stroke={INK} strokeWidth={3} vectorEffect="non-scaling-stroke" />
      <text x={cx} y={round(cy + boxH / 2 + 0.6)} fontSize={0.34} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={SOFT}>
        {back ? "⚙ ماشین برعکس: از راست به چپ" : "⚙ ماشین"}
      </text>
      <line x1={x(0)} y1={cy} x2={x(2 * n)} y2={cy} stroke={SOFT} strokeWidth={4} strokeDasharray="1 5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {pitch > 1.2 && arrows}
      {tags}
      {token !== undefined && tokenValue !== undefined && (
        <g>
          <circle cx={tokenX} cy={cy} r={0.55} fill={TOKEN} stroke={INK} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
          <text x={tokenX} y={cy + 0.03} fontSize={fit(tokenValue === null ? "؟" : numFa(tokenValue), 0.95, 0.5)} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
            {tokenValue === null ? "؟" : numFa(tokenValue)}
          </text>
        </g>
      )}
      {boxes}
      <text x={x(0)} y={labelY} fontSize={0.32} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
        {ends[0]}
      </text>
      <text x={x(2 * n)} y={labelY} fontSize={0.32} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
        {ends[1]}
      </text>
    </g>
  );
}

interface OpMachineProps {
  /** null: a hidden operator. */
  op: OpDef | null;
  a: number | null | undefined;
  b: number | null | undefined;
  out: number | null | undefined;
  cx: number;
  cy: number;
  /** Write "□" for an unknown a. */
  boxA?: boolean;
}

/** An operator as a machine with two inputs: a above, b below, one output. */
export function OpMachineG({ op, a, b, out, cx, cy, boxA }: OpMachineProps) {
  const boxW = 4.4;
  const boxH = 1.9;
  const inX = cx - boxW / 2 - 1.6;
  const outX = cx + boxW / 2 + 1.6;
  const tag = (v: number | null | undefined, tx: number, ty: number, name: string, key: string, square = false) => {
    const text = square ? "□" : v === undefined ? "" : v === null ? "؟" : numFa(v);
    return (
      <g key={key}>
        <rect x={round(tx - 0.75)} y={round(ty - 0.45)} width={1.5} height={0.9} rx={0.2} fill="#fff" stroke={INK} strokeWidth={2.5} strokeDasharray={v === null || v === undefined || square ? "4 3" : undefined} vectorEffect="non-scaling-stroke" />
        <text x={tx} y={ty + 0.03} fontSize={fit(text, 1.35, 0.55)} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
          {text}
        </text>
        <text x={round(tx - 1.05)} y={ty} fontSize={0.42} fontWeight={700} fontStyle="italic" textAnchor="middle" dominantBaseline="central" fill={SOFT}>
          {name}
        </text>
      </g>
    );
  };
  const def = op ? opDefFa(op) : "";
  return (
    <g>
      <MachineDefs />
      <path d={`M${round(inX + 0.75)},${round(cy - 0.6)} L${round(cx - boxW / 2)},${round(cy - 0.3)}`} stroke={SOFT} strokeWidth={2.5} markerEnd="url(#nm-head)" vectorEffect="non-scaling-stroke" />
      <path d={`M${round(inX + 0.75)},${round(cy + 0.6)} L${round(cx - boxW / 2)},${round(cy + 0.3)}`} stroke={SOFT} strokeWidth={2.5} markerEnd="url(#nm-head)" vectorEffect="non-scaling-stroke" />
      <line x1={round(cx + boxW / 2)} y1={cy} x2={round(outX - 0.8)} y2={cy} stroke={SOFT} strokeWidth={2.5} markerEnd="url(#nm-head)" vectorEffect="non-scaling-stroke" />
      <rect x={round(cx - boxW / 2)} y={round(cy - boxH / 2)} width={boxW} height={boxH} rx={0.3} fill={op ? MULT_FILL : "url(#nm-hatch)"} stroke={INK} strokeWidth={3} vectorEffect="non-scaling-stroke" />
      <text x={cx} y={round(cy - (op ? 0.35 : 0))} fontSize={op ? 0.75 : 0.9} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} stroke={op ? undefined : "#fff"} strokeWidth={op ? undefined : 5} paintOrder="stroke" vectorEffect="non-scaling-stroke">
        {op ? "★" : "★ ؟"}
      </text>
      {op && (
        <text x={cx} y={round(cy + 0.45)} fontSize={fit(def, boxW - 0.3, 0.42)} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
          {def}
        </text>
      )}
      {tag(a, inX, cy - 0.75, "a", "a", boxA)}
      {tag(b, inX, cy + 0.75, "b", "b")}
      {tag(out, outX, cy, "", "out")}
    </g>
  );
}

interface ExamplesProps {
  examples: Example[];
  /** The new input, and its output once shown (null: "؟"). */
  query?: { input: number[]; output: number | null };
  /** Outputs of the child's machine, one per example (shown after checking). */
  mine?: number[];
  two: boolean;
  cx: number;
  y: number;
}

/** The examples as a table, input on the left like the machine. */
export function ExamplesG({ examples, query, mine, two, cx, y }: ExamplesProps) {
  const colW = 2.1;
  const rowH = 0.7;
  const heads = [...(two ? ["a", "b", "a ★ b"] : ["ورودی", "خروجی"]), ...(mine ? ["ماشین تو"] : [])];
  const cols = heads.length;
  const left = cx - (cols * colW) / 2;
  const rows: { cells: string[]; marks?: string; key: string; dashed?: boolean }[] = examples.map((e, i) => {
    const cells = [...e.input.map(numFa), numFa(e.output)];
    if (mine) {
      const ok = Math.abs(mine[i] - e.output) < 1e-9;
      cells.push(`${numFa(mine[i])} ${ok ? "✓" : "✗"}`);
    }
    return { cells, key: `e${i}` };
  });
  if (query) rows.push({ cells: [...query.input.map(numFa), query.output === null ? "؟" : numFa(query.output), ...(mine ? [""] : [])], key: "q", dashed: true });

  const cell = (text: string, c: number, r: number, head = false) => (
    <text key={`${r}-${c}`} x={round(left + (c + 0.5) * colW)} y={round(y + (r + 0.5) * rowH)} fontSize={fit(text, colW - 0.2, head ? 0.36 : 0.44)} fontWeight={700} fontStyle={head && two && c < 2 ? "italic" : undefined} textAnchor="middle" dominantBaseline="central" fill={head ? SOFT : INK}>
      {text}
    </text>
  );

  return (
    <g>
      <rect x={round(left)} y={y} width={round(cols * colW)} height={round((rows.length + 1) * rowH)} rx={0.2} fill="#fff" stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {/* The output column is set apart by a thick line, not by colour. */}
      <line x1={round(left + (two ? 2 : 1) * colW)} y1={y} x2={round(left + (two ? 2 : 1) * colW)} y2={round(y + (rows.length + 1) * rowH)} stroke={INK} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
      {mine && <line x1={round(left + (cols - 1) * colW)} y1={y} x2={round(left + (cols - 1) * colW)} y2={round(y + (rows.length + 1) * rowH)} stroke={INK} strokeWidth={1} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />}
      {heads.map((h, c) => cell(h, c, 0, true))}
      {rows.map((row, r) => (
        <g key={row.key}>
          <line x1={round(left)} y1={round(y + (r + 1) * rowH)} x2={round(left + cols * colW)} y2={round(y + (r + 1) * rowH)} stroke={INK} strokeWidth={row.dashed ? 2 : 1} strokeDasharray={row.dashed ? "6 3" : undefined} vectorEffect="non-scaling-stroke" />
          {row.cells.map((t, c) => cell(t, c, r + 1))}
        </g>
      ))}
      {query && (
        <text x={round(left - 0.25)} y={round(y + (rows.length + 0.5) * rowH)} fontSize={0.3} fontWeight={700} textAnchor="end" dominantBaseline="central" fill={SOFT}>
          تازه →
        </text>
      )}
    </g>
  );
}

/** Lines of working, the first `shown` of them, centred under each other. */
export function LinesG({ lines, shown, cx, y, size = 0.5 }: { lines: string[]; shown: number; cx: number; y: number; size?: number }) {
  return (
    <g>
      {lines.slice(0, shown).map((l, i) => (
        <text key={i} x={cx} y={round(y + i * size * 1.6)} fontSize={fit(l, 14.5, size)} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} direction="ltr">
          {l}
        </text>
      ))}
    </g>
  );
}

/** A standalone machine for the worksheet: shown or empty boxes. */
export function MachineSvg({ steps, values, width = 300 }: { steps: (Step | null)[]; values: (number | null | undefined)[]; width?: number }) {
  const n = steps.length;
  const w = Math.min(15, 4.2 * n + 2);
  return (
    <svg width={width} height={round((width * 3.5) / w)} viewBox={`${-w / 2} -1.5 ${w} 3.5`} style={{ direction: "ltr", maxWidth: "100%", height: "auto" }}>
      <MachineG steps={steps} values={values} cx={0} cy={0} width={w} />
    </svg>
  );
}

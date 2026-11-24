"use client";

// The sequence as a train, in board units. The first term rides right behind
// the engine on the right, so the train reads right to left like Persian
// text. Rows of differences hang under the wagons, a second row under them
// when needed; ratios, sums and the two strands of a woven sequence ride
// above. Rows differ by place, line style and a written heading, not by
// colour alone; the hidden wagon is dashed and holds "؟".

import { diffsOf, letterAt, type Rule } from "@/generators/sequence";
import { fa } from "@/tools/registry";

export const INK = "#0f172a";
const SOFT = "#5b6476";
const WAGON = "#ffd36b";
const WAGON_B = "#a8d8ff";
const DIFF = "#2f6fdb";
const SECOND = "#c0392b";
const ABOVE = "#8a4fd6";
const ENGINE = "#e0564f";

export const PITCH = 1.9;
const W = 1.55;
const ENGINE_W = 2.4;
const PAD = 0.4;
const HEIGHT = 6.1;

/** Keeps an equation or a signed number left to right inside a Persian sentence. */
export const ltr = (s: string) => `⁦${s}⁩`;
/** "−۴" with a real minus sign. */
export const numFa = (v: number) => (v < 0 ? `−${fa(-v)}` : fa(v));
/** "+۳" or "−۳". */
export const signedFa = (d: number) => (d < 0 ? `−${fa(-d)}` : `+${fa(d)}`);
/** A step as written on a card: "+۳", "−۲", "×۲", "÷۳". */
export const stepFa = (op: "+" | "×" | "÷", by: number) => (op === "+" ? signedFa(by) : `${op}${fa(by)}`);

/** Rounded: the server and the browser must write the same numbers. */
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const trainView = (n: number): [number, number, number, number] => [0, 0, r3(2 * PAD + n * PITCH + ENGINE_W), HEIGHT];
const cxOf = (n: number, k: number) => r3(PAD + (n - k - 0.5) * PITCH);

/** Which rows of working suit a rule. */
export type RowName = "diff" | "second" | "ratio" | "sums" | "strandA" | "strandB";
export function rowsFor(rule: Rule): RowName[] {
  switch (rule.kind) {
    case "step":
      return rule.op === "+" ? ["diff"] : ["diff", "ratio"];
    case "grow":
      return ["diff", "second"];
    case "sum2":
      return ["diff", "sums"];
    case "alt":
      return ["strandA", "strandB"];
  }
}

/** What the rows of working are called: woven sequences get hop arcs, not a row of differences. */
export const rowsName = (rule: Rule) => (rule.kind === "alt" ? "کمان‌های یکی‌درمیان" : "ردیف اختلاف‌ها");

/** Where to look on the board once the rows are drawn. */
export function rowsHint(rule: Rule) {
  if (rule.kind === "alt")
    return "روی صفحه، کمان‌های بالای قطار واگن‌های ● را یکی‌درمیان به هم وصل می‌کنند و کمان‌های زیر قطار واگن‌های ▲ را؛ روی هر کمان، گام همان دنباله نوشته شده.";
  return "روی صفحه، ردیف اختلاف‌ها زیر قطار ساخته می‌شود.";
}

interface TrainProps {
  /** All the terms (alphabet places when `letters`). */
  terms: number[];
  letters: boolean;
  /** Wagon written as "؟". */
  hidden?: number | null;
  /** Wagons arriving, 0 … 1 (explore). */
  build?: number;
  rows?: RowName[];
  /** How far through the rows, 0 … 1: one row after another, label by label. */
  reveal?: number;
  /** Write each letter's place in the alphabet under it. */
  places?: boolean;
  /** The checked wagon. */
  mark?: { index: number; right: boolean; yours: string } | null;
  /** Wagons 1, 3, 5 … carry ●, wagons 2, 4, 6 … carry ▲ (woven sequences). */
  strands?: boolean;
  /** Wagons past this one are left off (numbers grown too large). */
  upTo?: number;
  /** Labels of one hop along strand ● and strand ▲, e.g. ["+۲", "×۲"]. */
  strandSteps?: [string, string];
}

/** What a wagon says. */
export function termFa(v: number, letters: boolean) {
  if (letters) return v >= 1 && v <= 32 ? letterAt(v) : "·";
  return numFa(v);
}

export function TrainG({ terms, letters, hidden = null, build = 1, rows = [], reveal = 1, places = false, mark = null, strands = false, upTo, strandSteps }: TrainProps) {
  const n = terms.length;
  const shown = Math.min(n, upTo ?? n);
  const cx = (k: number) => cxOf(n, k);
  const engineX = r3(PAD + n * PITCH);
  const arrived = (k: number) => clamp01(build * n - k);

  // One row after another, each label fading in in turn.
  const share = rows.length ? 1 / rows.length : 1;
  const rowAt = (name: RowName) => clamp01((reveal - rows.indexOf(name) * share) / share);
  const label = (name: RowName, j: number, count: number) => (rows.includes(name) ? clamp01(rowAt(name) * count - j) : 0);

  const d1 = diffsOf(terms.slice(0, shown));
  const d2 = diffsOf(d1);
  const mid = (k: number) => r3((cx(k) + cx(k + 1)) / 2);
  const halo = { stroke: "#fff", strokeWidth: 4, paintOrder: "stroke" as const, vectorEffect: "non-scaling-stroke" as const };
  const heading = (text: string, y: number, fill: string) => (
    <text x={r3(engineX + ENGINE_W / 2)} y={y} fontSize={0.3} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={fill} direction="rtl">
      {text}
    </text>
  );

  const wagons = [];
  for (let k = 0; k < shown; k++) {
    const o = arrived(k);
    if (o <= 0) continue;
    const x = cx(k);
    const dx = r3(-(1 - o) * 1.2);
    const isHidden = hidden === k;
    const isB = strands && k % 2 === 1;
    const text = isHidden ? "؟" : termFa(terms[k], letters);
    const withPlace = letters && places && !isHidden;
    const fs = withPlace ? 0.6 : letters || isHidden ? 0.78 : r3(Math.min(0.62, 1.38 / (0.56 * text.length)));
    const marked = mark && mark.index === k;
    wagons.push(
      <g key={k} transform={dx ? `translate(${dx} 0)` : undefined} opacity={r3(o)}>
        {/* Coupler to the wagon in front (to the right). */}
        <line x1={r3(x + W / 2)} y1={2.62} x2={r3(x + PITCH - W / 2)} y2={2.62} stroke={INK} strokeWidth={3} vectorEffect="non-scaling-stroke" />
        <rect
          x={r3(x - W / 2)}
          y={1.55}
          width={W}
          height={1.3}
          rx={0.12}
          fill={isHidden ? "#fff" : isB ? WAGON_B : WAGON}
          stroke={INK}
          strokeWidth={marked ? 4 : 2}
          strokeDasharray={isHidden ? "6 4" : undefined}
          vectorEffect="non-scaling-stroke"
        />
        {strands &&
          (isB ? (
            <path d={`M${r3(x + W / 2 - 0.22)},1.66 l0.13,0.24 l-0.26,0 Z`} fill={INK} />
          ) : (
            <circle cx={r3(x + W / 2 - 0.22)} cy={1.79} r={0.11} fill={INK} />
          ))}
        <text x={x} y={withPlace ? 1.98 : 2.2} fontSize={fs} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
          {text}
        </text>
        {withPlace && (
          <text x={x} y={2.66} fontSize={0.24} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={SOFT}>
            {fa(terms[k])}
          </text>
        )}
        <circle cx={r3(x - 0.45)} cy={2.98} r={0.16} fill={INK} />
        <circle cx={r3(x + 0.45)} cy={2.98} r={0.16} fill={INK} />
        {marked && (
          <g>
            <circle cx={r3(x - W / 2 + 0.05)} cy={1.6} r={0.24} fill={mark.right ? "#2e9d57" : SECOND} stroke="#fff" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            <text x={r3(x - W / 2 + 0.05)} y={1.61} fontSize={0.3} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill="#fff">
              {mark.right ? "✓" : "✗"}
            </text>
          </g>
        )}
      </g>,
    );
  }

  // Under the train: differences, then second differences.
  const below = [];
  if (rows.includes("diff")) {
    below.push(<g key="h1">{heading("اختلاف‌ها", 4.2, DIFF)}</g>);
    d1.forEach((d, k) => {
      const o = label("diff", k, d1.length);
      if (o <= 0) return;
      const [x1, x2, xm] = [r3(cx(k) - 0.15), r3(cx(k + 1) + 0.15), mid(k)];
      below.push(
        <g key={`d${k}`} opacity={r3(o)}>
          <path d={`M${x1},3.38 Q${xm},4 ${x2},3.38`} fill="none" stroke={DIFF} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          <path d={`M${x2},3.38 l0.2,0.04 l-0.12,0.16 Z`} fill={DIFF} />
          <text x={xm} y={4.2} fontSize={0.4} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={DIFF} {...halo}>
            {signedFa(d)}
          </text>
        </g>,
      );
    });
  }
  if (rows.includes("second")) {
    below.push(<g key="h2">{heading("اختلاف دوم", 5.2, SECOND)}</g>);
    d2.forEach((d, k) => {
      const o = label("second", k, d2.length);
      if (o <= 0) return;
      const xm = cx(k + 1);
      below.push(
        <g key={`s${k}`} opacity={r3(o)}>
          <path d={`M${mid(k)},4.45 L${xm},4.95 L${mid(k + 1)},4.45`} fill="none" stroke={SECOND} strokeWidth={2} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />
          <text x={xm} y={5.2} fontSize={0.36} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={SECOND} {...halo}>
            {signedFa(d)}
          </text>
        </g>,
      );
    });
  }

  // Above the train: ratios, sums, or the first strand; the second strand below.
  const above = [];
  if (rows.includes("ratio")) {
    above.push(<g key="hr">{heading("نسبت‌ها", 0.45, ABOVE)}</g>);
    for (let k = 0; k + 1 < shown; k++) {
      const o = label("ratio", k, shown - 1);
      if (o <= 0) continue;
      const [a, b] = [terms[k], terms[k + 1]];
      const text = b >= a ? `×${fa(Math.round((b / a) * 100) / 100)}` : `÷${fa(Math.round((a / b) * 100) / 100)}`;
      above.push(
        <g key={`r${k}`} opacity={r3(o)}>
          <path d={`M${r3(cx(k) - 0.15)},1.45 Q${mid(k)},0.85 ${r3(cx(k + 1) + 0.15)},1.45`} fill="none" stroke={ABOVE} strokeWidth={2} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
          <text x={mid(k)} y={0.62} fontSize={0.38} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={ABOVE} {...halo}>
            {text}
          </text>
        </g>,
      );
    }
  }
  if (rows.includes("sums")) {
    above.push(<g key="hs">{heading("جمع دو قبلی", 0.45, ABOVE)}</g>);
    for (let k = 2; k < shown; k++) {
      const o = label("sums", k - 2, shown - 2);
      if (o <= 0) continue;
      above.push(
        <g key={`u${k}`} opacity={r3(o)}>
          <text x={cx(k)} y={1.15} fontSize={0.3} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={ABOVE} {...halo}>
            {`${fa(terms[k - 2])}+${fa(terms[k - 1])}`}
          </text>
          <path d={`M${r3(cx(k) - 0.3)},1.32 L${cx(k)},1.48 L${r3(cx(k) + 0.3)},1.32`} fill="none" stroke={ABOVE} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </g>,
      );
    }
  }
  if (rows.includes("strandA") || rows.includes("strandB")) {
    if (rows.includes("strandA")) above.push(<g key="ha">{heading("دنباله ● (جمله‌های فرد)", 0.45, ABOVE)}</g>);
    if (rows.includes("strandB")) below.push(<g key="hb">{heading("دنباله ▲ (جمله‌های زوج)", 4.45, DIFF)}</g>);
    const hops = (parity: 0 | 1) => Array.from({ length: shown }, (_, k) => k).filter((k) => k % 2 === parity && k + 2 < shown);
    const ha = hops(0);
    const hb = hops(1);
    ha.forEach((k, j) => {
      const o = label("strandA", j, ha.length);
      if (o <= 0) return;
      above.push(
        <g key={`a${k}`} opacity={r3(o)}>
          <path d={`M${cx(k)},1.45 Q${cx(k + 1)},0.35 ${cx(k + 2)},1.45`} fill="none" stroke={ABOVE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          <text x={cx(k + 1)} y={0.72} fontSize={0.38} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={ABOVE} {...halo}>
            {strandSteps?.[0] ?? signedFa(terms[k + 2] - terms[k])}
          </text>
        </g>,
      );
    });
    hb.forEach((k, j) => {
      const o = label("strandB", j, hb.length);
      if (o <= 0) return;
      below.push(
        <g key={`b${k}`} opacity={r3(o)}>
          <path d={`M${cx(k)},3.38 Q${cx(k + 1)},4.5 ${cx(k + 2)},3.38`} fill="none" stroke={DIFF} strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
          <text x={cx(k + 1)} y={4.0} fontSize={0.38} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={DIFF} {...halo}>
            {strandSteps?.[1] ?? signedFa(terms[k + 2] - terms[k])}
          </text>
        </g>,
      );
    });
  }

  const caption = mark ? (mark.right ? `✓ درست: ${mark.yours}` : `✗ جواب تو: ${mark.yours} · جواب درست: ${termFa(terms[mark.index], letters)}`) : null;

  return (
    <g>
      {/* Rails and sleepers. */}
      <line x1={0.1} y1={3.17} x2={r3(engineX + ENGINE_W + 0.2)} y2={3.17} stroke={SOFT} strokeWidth={3} vectorEffect="non-scaling-stroke" />
      {Array.from({ length: Math.ceil((engineX + ENGINE_W) / 0.5) }, (_, i) => (
        <line key={i} x1={r3(0.2 + i * 0.5)} y1={3.1} x2={r3(0.2 + i * 0.5)} y2={3.26} stroke={SOFT} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      ))}
      <Engine x={engineX} />
      {wagons}
      {below}
      {above}
      {caption && (
        <text x={r3((engineX + ENGINE_W) / 2)} y={5.78} fontSize={0.36} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} direction="rtl">
          {caption}
        </text>
      )}
    </g>
  );
}

/** The engine, facing right, cab at the back by the first wagon. */
function Engine({ x }: { x: number }) {
  return (
    <g>
      <rect x={r3(x + 0.05)} y={1.2} width={0.85} height={1.65} rx={0.08} fill={ENGINE} stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <rect x={r3(x + 0.2)} y={1.38} width={0.55} height={0.45} rx={0.05} fill="#fff" stroke={INK} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <rect x={r3(x + 0.9)} y={1.85} width={1.25} height={1} rx={0.12} fill={ENGINE} stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <rect x={r3(x + 1.7)} y={1.45} width={0.25} height={0.42} fill={INK} />
      <path d={`M${r3(x + 2.15)},2.35 L${r3(x + 2.4)},2.9 L${r3(x + 2.15)},2.9 Z`} fill={INK} />
      {[0.4, 1.15, 1.8].map((dx) => (
        <circle key={dx} cx={r3(x + dx)} cy={2.95} r={0.2} fill={INK} />
      ))}
    </g>
  );
}

"use client";

// Drawings for «دایره» and «مساحت ترکیبی» (tool 16), in centimetres (y grows
// downwards): a figure of shaded and white parts with its lengths, "show me"
// highlights (outlined parts with labels, heavy edges, worked-out lengths in
// a box), the two explore boards, and a number pad with a decimal sign.
// Shading is a hatch as well as a colour, highlights are dashed as well as
// orange, and every part a step talks about carries a written label.

import { useId, type ReactNode } from "react";
import { figureBox, onCircle, type Dim, type Edge, type Figure, type Part, type XY } from "@/generators/circle";
import { fa } from "@/tools/registry";
import padStyles from "@/toolkit/NumberPad.module.css";
import { ltr, num, type Overlay } from "./frames";
import { SHAPE, type View } from "./Pictures";

const INK = "#1f2430";
const HI = "#b5651d";
const PAPER = "#fffaf0";
const SHADE = "#bcd6f3";
const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
const halo = (fs: number) => ({ paintOrder: "stroke" as const, stroke: PAPER, strokeWidth: fs * 0.22, strokeLinejoin: "round" as const });

/** Font size for a figure: the same on screen whatever its size in centimetres. */
const fontOf = (f: Figure) => {
  const [, , w, h] = figureBox(f);
  return Math.max(0.32, Math.max(w, h) * 0.07);
};

/** The view round a figure, with room for its numbers. */
export function figureView(f: Figure): View {
  const [x, y, w, h] = figureBox(f);
  const m = fontOf(f) * 2.6;
  return [r4(x - m), r4(y - m), r4(w + 2 * m), r4(h + 2 * m)];
}

/** An SVG path for a part. */
function partPath(p: Part): string {
  switch (p.kind) {
    case "rect":
      return `M${p.x},${p.y}h${p.w}v${p.h}h${-p.w}Z`;
    case "tri":
      return `M${p.pts.map((q) => `${r4(q[0])},${r4(q[1])}`).join("L")}Z`;
    case "sector": {
      if (p.sweep >= 360) return `M${r4(p.c[0] - p.r)},${r4(p.c[1])}a${p.r},${p.r} 0 1 0 ${2 * p.r},0a${p.r},${p.r} 0 1 0 ${-2 * p.r},0Z`;
      const a = onCircle(p.c, p.r, p.from);
      const b = onCircle(p.c, p.r, p.from + p.sweep);
      return `M${r4(p.c[0])},${r4(p.c[1])}L${r4(a[0])},${r4(a[1])}A${p.r},${p.r} 0 ${p.sweep > 180 ? 1 : 0} 1 ${r4(b[0])},${r4(b[1])}Z`;
    }
  }
}

function edgePath(e: Edge): string {
  if (e.kind === "line") return `M${r4(e.a[0])},${r4(e.a[1])}L${r4(e.b[0])},${r4(e.b[1])}`;
  if (e.sweep >= 360) return `M${r4(e.c[0] - e.r)},${r4(e.c[1])}a${e.r},${e.r} 0 1 0 ${2 * e.r},0a${e.r},${e.r} 0 1 0 ${-2 * e.r},0`;
  const a = onCircle(e.c, e.r, e.from);
  const b = onCircle(e.c, e.r, e.from + e.sweep);
  return `M${r4(a[0])},${r4(a[1])}A${e.r},${e.r} 0 ${e.sweep > 180 ? 1 : 0} 1 ${r4(b[0])},${r4(b[1])}`;
}

/** Where a part's label goes. */
function partCentre(p: Part): XY {
  switch (p.kind) {
    case "rect":
      return [p.x + p.w / 2, p.y + p.h / 2];
    case "tri":
      return [(p.pts[0][0] + p.pts[1][0] + p.pts[2][0]) / 3, (p.pts[0][1] + p.pts[1][1] + p.pts[2][1]) / 3];
    case "sector":
      return p.sweep >= 360 ? p.c : onCircle(p.c, p.r * (p.sweep > 100 ? 0.45 : 0.55), p.from + p.sweep / 2);
  }
}

function DimG({ d, fs, state }: { d: Dim; fs: number; state: "given" | "ask" | "found" }) {
  const t = d.at ?? 0.5;
  const at: XY = [d.a[0] + (d.b[0] - d.a[0]) * t + d.off[0] * fs * 0.95, d.a[1] + (d.b[1] - d.a[1]) * t + d.off[1] * fs * 0.95];
  const text = state === "ask" ? "؟" : num(d.value);
  const w = fs * (0.45 + 0.55 * text.length);
  // End ticks show where a drawn length starts and stops.
  const len = Math.hypot(d.b[0] - d.a[0], d.b[1] - d.a[1]) || 1;
  const [nx, ny] = [-(d.b[1] - d.a[1]) / len, (d.b[0] - d.a[0]) / len];
  return (
    <g pointerEvents="none">
      {d.line && (
        <g stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke">
          <line x1={r4(d.a[0])} y1={r4(d.a[1])} x2={r4(d.b[0])} y2={r4(d.b[1])} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
          {[d.a, d.b].map((p, i) => (
            <line key={i} x1={r4(p[0] - nx * fs * 0.3)} y1={r4(p[1] - ny * fs * 0.3)} x2={r4(p[0] + nx * fs * 0.3)} y2={r4(p[1] + ny * fs * 0.3)} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
      )}
      {state === "found" && <rect x={r4(at[0] - w / 2)} y={r4(at[1] - fs * 0.62)} width={r4(w)} height={r4(fs * 1.24)} rx={fs * 0.2} fill={PAPER} stroke={HI} strokeWidth={2} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />}
      <text x={r4(at[0])} y={r4(at[1])} fontSize={fs} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={state === "found" ? HI : INK} style={state === "found" ? undefined : halo(fs)}>
        {text}
      </text>
    </g>
  );
}

/**
 * A circle or composite figure: + parts shaded (colour and hatch), − parts
 * white, the outline, and the lengths. `show` adds a "show me" step.
 */
export function MeasureFigureG({ fig, show }: { fig: Figure; show?: Overlay }) {
  const id = `h${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const fs = fontOf(fig);
  const hatch = fs * 0.55;
  const reveal = show?.reveal ?? [];
  const labels = show?.parts ?? {};
  return (
    <g>
      <defs>
        <pattern id={id} patternUnits="userSpaceOnUse" width={hatch} height={hatch} patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={hatch} stroke="#7aa7d9" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </pattern>
      </defs>
      {fig.parts.map((p, i) =>
        p.sign > 0 ? (
          <g key={i}>
            <path d={partPath(p)} fill={SHADE} />
            <path d={partPath(p)} fill={`url(#${id})`} />
          </g>
        ) : null,
      )}
      {fig.parts.map((p, i) => (p.sign < 0 ? <path key={i} d={partPath(p)} fill={PAPER} /> : null))}
      {fig.edges.map((e, i) => (
        <path key={i} d={edgePath(e)} fill="none" stroke={SHAPE} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      ))}
      {fig.parts.some((p) => p.kind === "sector") && fig.parts.filter((p): p is Extract<Part, { kind: "sector" }> => p.kind === "sector" && p.sweep >= 180).map((p, i) => <circle key={i} cx={p.c[0]} cy={p.c[1]} r={fs * 0.14} fill={INK} />)}
      {/* "Show me": outlined parts with labels, heavy edges. */}
      {Object.keys(labels).map((k) => {
        const p = fig.parts[Number(k)];
        if (!p) return null;
        return <path key={`o${k}`} d={partPath(p)} fill={p.sign < 0 ? "#f6d7bd" : "none"} fillOpacity={p.sign < 0 ? 0.75 : 1} stroke={HI} strokeWidth={3} strokeDasharray="8 5" vectorEffect="non-scaling-stroke" />;
      })}
      {(show?.lines ?? []).map((i) => (fig.edges[i] ? <path key={`l${i}`} d={edgePath(fig.edges[i])} fill="none" stroke={HI} strokeWidth={8} strokeDasharray="12 6" strokeLinecap="round" vectorEffect="non-scaling-stroke" /> : null))}
      {fig.dims.map((d) => {
        const found = reveal.includes(d.name);
        if (!d.given && !d.ask && !found) return null;
        return <DimG key={d.name} d={d} fs={fs} state={d.given ? "given" : d.ask && !found ? "ask" : "found"} />;
      })}
      {labelSpots(fig, labels, fs).map(([k, x, y, text]) => (
        <text key={`t${k}`} x={r4(x)} y={r4(y)} fontSize={fs * 0.95} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} style={halo(fs)}>
          {/^[−+]/.test(text) ? ltr(text) : text}
        </text>
      ))}
    </g>
  );
}

/** Where each part label goes: its part's centre, moved down a line when it would sit on an earlier label. */
function labelSpots(fig: Figure, labels: Record<number, string>, fs: number): [string, number, number, string][] {
  const out: [string, number, number, string][] = [];
  for (const [k, text] of Object.entries(labels)) {
    const p = fig.parts[Number(k)];
    if (!p) continue;
    const [x, y0] = partCentre(p);
    let y = y0;
    while (out.some(([, ox, oy]) => Math.abs(ox - x) < fs * 3 && Math.abs(oy - y) < fs * 1.2)) y += fs * 1.3;
    out.push([k, x, y, text]);
  }
  return out;
}

/** A figure as its own picture, for paper. */
export function MeasureSvg({ fig, width = 200 }: { fig: Figure; width?: number }) {
  const [x, y, w, h] = figureView(fig);
  const height = Math.min(220, Math.round((width * h) / w));
  return (
    <svg viewBox={`${x} ${y} ${w} ${h}`} width={Math.round((height * w) / h)} height={height} style={{ direction: "ltr" }} role="img" aria-label="شکل">
      <MeasureFigureG fig={fig} />
    </svg>
  );
}

// ── Number pad with a decimal sign ──────────────────────────────────────

/** Like the toolkit's NumberPad, plus «٫» for decimals (up to two places). The value uses "." inside. */
export function DecimalPad({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const dot = value.indexOf(".");
  const press = (d: string) => {
    if (value.length >= 7 || (dot >= 0 && value.length - dot > 2)) return;
    onChange(value === "0" ? d : value + d);
  };
  const show = value ? fa(value).replace(".", "٫") : "؟";
  return (
    <div className={padStyles.pad}>
      <output className={padStyles.display} aria-live="polite">
        {show}
      </output>
      <div className={padStyles.keys}>
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} onClick={() => press(d)} disabled={disabled}>
            {fa(d)}
          </button>
        ))}
        <button onClick={() => onChange((value || "0") + ".")} disabled={disabled || dot >= 0 || value.length >= 6} aria-label="ممیز">
          ٫
        </button>
        <button onClick={() => press("0")} disabled={disabled}>
          {fa(0)}
        </button>
        <button onClick={() => onChange(value.slice(0, -1))} disabled={disabled || !value} aria-label="پاک کردن یک رقم">
          ⌫
        </button>
      </div>
    </div>
  );
}

// ── Explore: a circle ───────────────────────────────────────────────────

export type CircleView = "circ" | "area";
export interface CircleEx {
  r: number;
  view: CircleView;
  /** Slices for "area". */
  k: number;
}
export const CIRCLE_R = [1, 2, 3, 4, 5];
export const SLICES = [8, 16, 32];
const RMAX = 5;

export const circleExView = (ex: CircleEx): View => (ex.view === "circ" ? [-0.8, -1.2, 2 * Math.PI * RMAX + 1.8, 2 * RMAX + 3.4] : [-0.8, -0.8, 2 * RMAX + 2 + Math.PI * RMAX + 3, 2 * RMAX + 2.6]);

/** Explore: the circle with radius and diameter; its circumference unrolled, or its slices laid in a row. */
export function CircleExploreG({ ex }: { ex: CircleEx }) {
  const { r } = ex;
  const fs = 0.55;
  const d = 2 * r;
  if (ex.view === "circ") {
    // The circle stands on the line where it would roll; its circumference is the line's length.
    const base = 2 * RMAX + 0.4;
    const c: XY = [r, base - r];
    const L = 2 * Math.PI * r;
    const whole = Math.floor(L / d);
    return (
      <g>
        <circle cx={c[0]} cy={c[1]} r={r} fill={SHADE} fillOpacity={0.5} stroke={SHAPE} strokeWidth={4} vectorEffect="non-scaling-stroke" />
        <RadiusDiameter c={c} r={r} fs={fs} />
        <line x1={0} y1={base} x2={r4(L)} y2={base} stroke={SHAPE} strokeWidth={6} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {Array.from({ length: whole }, (_, i) => (
          <g key={i}>
            <line x1={(i + 1) * d} y1={base - 0.3} x2={(i + 1) * d} y2={base + 0.3} stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke" />
            <text x={(i + 0.5) * d} y={base + 0.75} fontSize={fs} fontWeight={700} textAnchor="middle" fill={INK} style={halo(fs)}>
              قطر {fa(i + 1)}
            </text>
          </g>
        ))}
        <text x={r4((whole * d + L) / 2)} y={base - 0.55} fontSize={fs * 0.85} fontWeight={700} textAnchor="middle" fill={HI} style={halo(fs)}>
          {num(L - whole * d)}
        </text>
        <text x={r4(L / 2)} y={base + 1.75} fontSize={fs} fontWeight={700} textAnchor="middle" fill={INK} style={halo(fs)}>
          محیط باز شده ≈ {num(Math.round(L * 100) / 100)} (کمی بیشتر از ۳ قطر)
        </text>
      </g>
    );
  }
  // Area: k slices, every other one turned over, make a near-rectangle πr wide and r tall.
  const k = ex.k;
  const theta = 360 / k;
  const half = (theta / 2) * (Math.PI / 180);
  const chord = 2 * r * Math.sin(half);
  const c: XY = [RMAX, RMAX];
  const x0 = 2 * RMAX + 1.6;
  const top = RMAX - r / 2;
  const slices: ReactNode[] = [];
  for (let i = 0; i < k; i++) {
    const up = i % 2 === 0;
    const j = Math.floor(i / 2);
    const apex: XY = up ? [x0 + j * chord, top] : [x0 + j * chord + chord / 2, top + r * Math.cos(half)];
    const from = up ? 90 - theta / 2 : 270 - theta / 2;
    const a = onCircle(apex, r, from);
    const b = onCircle(apex, r, from + theta);
    slices.push(
      <path
        key={i}
        d={`M${r4(apex[0])},${r4(apex[1])}L${r4(a[0])},${r4(a[1])}A${r},${r} 0 0 1 ${r4(b[0])},${r4(b[1])}Z`}
        fill={up ? SHADE : "#f6d7bd"}
        stroke={up ? SHAPE : HI}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />,
    );
  }
  const width = (k / 2) * chord;
  return (
    <g>
      {Array.from({ length: k }, (_, i) => {
        const a = onCircle(c, r, i * theta);
        return <line key={i} x1={c[0]} y1={c[1]} x2={r4(a[0])} y2={r4(a[1])} stroke={i % 2 ? HI : SHAPE} strokeWidth={1} vectorEffect="non-scaling-stroke" />;
      })}
      <circle cx={c[0]} cy={c[1]} r={r} fill={SHADE} fillOpacity={0.35} stroke={SHAPE} strokeWidth={4} vectorEffect="non-scaling-stroke" />
      <RadiusDiameter c={c} r={r} fs={fs} />
      {slices}
      <line x1={x0} y1={top + r + 0.45} x2={r4(x0 + width)} y2={top + r + 0.45} stroke={INK} strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
      <text x={r4(x0 + width / 2)} y={top + r + 1.15} fontSize={fs} fontWeight={700} textAnchor="middle" fill={INK} style={halo(fs)}>
        نصف محیط ≈ {num(Math.PI * r)}
      </text>
      <line x1={r4(x0 - 0.35)} y1={top} x2={r4(x0 - 0.35)} y2={top + r} stroke={INK} strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
      <text x={r4(x0 - 0.55)} y={top + r / 2} fontSize={fs} fontWeight={700} textAnchor="end" dominantBaseline="central" fill={INK} style={halo(fs)}>
        {fa(r)}
      </text>
    </g>
  );
}

/** Radius (to the right, above) and diameter (through the centre, below), labelled in words. */
function RadiusDiameter({ c, r, fs }: { c: XY; r: number; fs: number }) {
  return (
    <g pointerEvents="none">
      <line x1={c[0] - r} y1={c[1]} x2={c[0] + r} y2={c[1]} stroke={INK} strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
      <line x1={c[0]} y1={c[1]} x2={c[0] + r} y2={c[1]} stroke={INK} strokeWidth={4} vectorEffect="non-scaling-stroke" />
      <circle cx={c[0]} cy={c[1]} r={0.1} fill={INK} />
      <text x={c[0] + r / 2} y={c[1] - fs * 0.8} fontSize={fs * (r < 2 ? 0.75 : 1)} fontWeight={700} textAnchor="middle" fill={INK} style={halo(fs)}>
        شعاع {fa(r)}
      </text>
      <text x={c[0] - r / 2} y={c[1] + fs * 1.1} fontSize={fs * (r < 2 ? 0.75 : 1)} fontWeight={700} textAnchor="middle" fill={INK} style={halo(fs)}>
        قطر {fa(2 * r)}
      </text>
    </g>
  );
}

/** Readouts for the circle explore board. */
export function circleExText(ex: CircleEx): string[] {
  const { r } = ex;
  const d = 2 * r;
  return [
    `شعاع ${fa(r)} · قطر ${ltr(`۲ × ${fa(r)} = ${fa(d)}`)}`,
    `محیط = قطر × ۳٫۱۴: ${ltr(`${fa(d)} × ۳٫۱۴ = ${num(3.14 * d)}`)}`,
    `مساحت = شعاع × شعاع × ۳٫۱۴: ${ltr(`${fa(r)} × ${fa(r)} × ۳٫۱۴ = ${num(3.14 * r * r)}`)}`,
  ];
}

// ── Explore: an L shape, three ways ─────────────────────────────────────

export type CompCut = "h" | "v" | "box";
export interface CompEx {
  W: number;
  H: number;
  a: number;
  b: number;
  cut: CompCut;
}
export const COMP_LIMITS = { W: [4, 10], H: [3, 8] } as const;
/** Keep the arm and bar inside the shape. */
export const fixComp = (e: CompEx): CompEx => ({ ...e, a: Math.max(1, Math.min(e.W - 1, e.a)), b: Math.max(1, Math.min(e.H - 1, e.b)) });

export const compExView = (): View => [-1.6, -1.6, COMP_LIMITS.W[1] + 3.2, COMP_LIMITS.H[1] + 3.2];

/** The pieces of each way: [x, y, w, h, sign, name]. */
export function compPieces(e: CompEx): [number, number, number, number, 1 | -1, string][] {
  const { W, H, a, b } = e;
  if (e.cut === "h")
    return [
      [0, H - b, W, b, 1, "الف"],
      [0, 0, a, H - b, 1, "ب"],
    ];
  if (e.cut === "v")
    return [
      [0, 0, a, H, 1, "الف"],
      [a, H - b, W - a, b, 1, "ب"],
    ];
  return [
    [0, 0, W, H, 1, "بزرگ"],
    [a, 0, W - a, H - b, -1, "گوشه"],
  ];
}

export function CompositeExploreG({ ex }: { ex: CompEx }) {
  const { W, H, a, b } = ex;
  const fs = 0.5;
  const outline: XY[] = [
    [0, 0],
    [a, 0],
    [a, H - b],
    [W, H - b],
    [W, H],
    [0, H],
  ];
  const pieces = compPieces(ex);
  return (
    <g>
      {Array.from({ length: COMP_LIMITS.W[1] + 1 }, (_, i) => (
        <line key={`x${i}`} x1={i} y1={0} x2={i} y2={COMP_LIMITS.H[1]} stroke="#ddd2bf" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      ))}
      {Array.from({ length: COMP_LIMITS.H[1] + 1 }, (_, i) => (
        <line key={`y${i}`} x1={0} y1={i} x2={COMP_LIMITS.W[1]} y2={i} stroke="#ddd2bf" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      ))}
      {ex.cut === "box" && <rect x={0} y={0} width={W} height={H} fill="none" stroke={INK} strokeWidth={2.5} strokeDasharray="8 6" vectorEffect="non-scaling-stroke" />}
      <polygon points={outline.map((p) => p.join(",")).join(" ")} fill={SHADE} fillOpacity={0.55} stroke={SHAPE} strokeWidth={4} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {pieces.map(([x, y, w, h, sign, name], i) => (
        <g key={i}>
          <rect x={x} y={y} width={w} height={h} fill={sign < 0 ? "#f6d7bd" : "none"} fillOpacity={0.8} stroke={HI} strokeWidth={3} strokeDasharray="8 5" vectorEffect="non-scaling-stroke" />
          {/* The big rectangle's label goes in the bottom bar, clear of the corner drawn over it. */}
          <text x={ex.cut === "box" && sign > 0 ? W / 2 : x + w / 2} y={ex.cut === "box" && sign > 0 ? H - b / 2 : y + h / 2} fontSize={Math.min(fs, (ex.cut === "box" && sign > 0 ? b : h) * 0.45, w * 0.3)} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} style={halo(fs)}>
            {name}: {sign < 0 ? "−" : ""}
            {fa(w * h)}
          </text>
        </g>
      ))}
      {(
        [
          [W / 2, H + 0.6, W],
          [-0.6, H / 2, H],
          [a / 2, -0.6, a],
          [W + 0.6, H - b / 2, b],
        ] as const
      ).map(([x, y, v], i) => (
        <text key={i} x={x} y={y} fontSize={fs} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} style={halo(fs)}>
          {fa(v)}
        </text>
      ))}
    </g>
  );
}

/** The sum for the chosen way. */
export function compExText(ex: CompEx): string {
  const pieces = compPieces(ex);
  const total = pieces.reduce((s, p) => s + p[4] * p[2] * p[3], 0);
  const parts = pieces.map(([, , w, h], i) => `${i ? (pieces[i][4] < 0 ? " − " : " + ") : ""}${fa(w)} × ${fa(h)}`).join("");
  return `${ltr(`${parts} = ${fa(total)}`)} سانتی‌متر مربع`;
}

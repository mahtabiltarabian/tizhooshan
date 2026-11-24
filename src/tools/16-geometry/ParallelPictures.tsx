"use client";

// Drawings for «خطوط موازی و زاویه» (tool 16), in figure units (y grows
// downwards): parallel lines with arrow marks, the slanted lines, named
// points, and angle marks. Equal angles share the same number of arcs (one,
// two, three …) as well as the same number; an angle not yet known has a
// dashed arc and «؟». The angles a "show me" step talks about are drawn
// heavy, and the one it finds has its number in a dashed box. The explore
// board turns the transversal by dragging either round handle.

import { useRef } from "react";
import { exploreFigure, unitOf, type PAngle, type ParallelFigure, type PLine, type XY } from "@/generators/parallel-angles";
import { fa } from "@/tools/registry";
import { ltr, type Overlay } from "./frames";
import { SHAPE, type View } from "./Pictures";

const INK = "#0f172a";
const MUTED = "#6b7180";
const HI = "#b5651d";
const PAPER = "#fffaf0";
const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
const FS = 0.5;
const halo = (fs: number) => ({ paintOrder: "stroke" as const, stroke: PAPER, strokeWidth: fs * 0.24, strokeLinejoin: "round" as const });
const pts = (ps: XY[]) => ps.map((p) => `${r4(p[0])},${r4(p[1])}`).join(" ");

/** The view round a figure, with room for its letters and numbers. */
export function parallelView(fig: ParallelFigure, pad = 1.1): View {
  const all: XY[] = fig.lines.flatMap((l) => [l.a, l.b]);
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const [x0, y0] = [Math.min(...xs) - pad, Math.min(...ys) - pad];
  return [r4(x0), r4(y0), r4(Math.max(...xs) + pad - x0), r4(Math.max(...ys) + pad - y0)];
}

/** Chevrons along a parallel line (all lines run the same way, so they point the same way). */
function Arrows({ l, n, color }: { l: PLine; n: number; color: string }) {
  const d = unitOf([l.b[0] - l.a[0], l.b[1] - l.a[1]]);
  const nn: XY = [-d[1], d[0]];
  const at: XY = [l.a[0] + (l.b[0] - l.a[0]) * 0.8, l.a[1] + (l.b[1] - l.a[1]) * 0.8];
  const s = 0.22;
  return (
    <g stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke">
      {Array.from({ length: n }, (_, k) => {
        const c: XY = [at[0] + d[0] * k * 0.28, at[1] + d[1] * k * 0.28];
        return <polyline key={k} points={pts([[c[0] - d[0] * s + nn[0] * s, c[1] - d[1] * s + nn[1] * s], c, [c[0] - d[0] * s - nn[0] * s, c[1] - d[1] * s - nn[1] * s]])} vectorEffect="non-scaling-stroke" />;
      })}
    </g>
  );
}

function LinesG({ lines, helper }: { lines: PLine[]; helper: boolean }) {
  return (
    <g pointerEvents="none">
      {lines.map((l, i) => {
        if (l.kind === "helper" && !helper) return null;
        const color = l.kind === "trans" ? SHAPE : l.kind === "helper" ? HI : l.kind === "plain" ? MUTED : INK;
        return (
          <g key={i}>
            <line x1={r4(l.a[0])} y1={r4(l.a[1])} x2={r4(l.b[0])} y2={r4(l.b[1])} stroke={color} strokeWidth={l.kind === "helper" ? 2.5 : 3} strokeDasharray={l.kind === "helper" ? "8 6" : undefined} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {l.arrows > 0 && <Arrows l={l} n={l.arrows} color={color} />}
          </g>
        );
      })}
    </g>
  );
}

/** Arc points at v from arm u to arm w, the short way (or the long way when reflex). */
function arc(a: PAngle, r: number): XY[] {
  const t0 = Math.atan2(a.p[1] - a.v[1], a.p[0] - a.v[0]);
  const t1 = Math.atan2(a.q[1] - a.v[1], a.q[0] - a.v[0]);
  let d = Math.atan2(Math.sin(t1 - t0), Math.cos(t1 - t0));
  if (a.reflex) d -= Math.sign(d) * 2 * Math.PI;
  const n = Math.max(8, Math.ceil((Math.abs(d) * 180) / Math.PI / 8));
  return Array.from({ length: n + 1 }, (_, k) => [a.v[0] + r * Math.cos(t0 + (d * k) / n), a.v[1] + r * Math.sin(t0 + (d * k) / n)] as XY);
}

/** Direction from the corner to the middle of the angle. */
function bisector(a: PAngle): XY {
  const u = unitOf([a.p[0] - a.v[0], a.p[1] - a.v[1]]);
  const w = unitOf([a.q[0] - a.v[0], a.q[1] - a.v[1]]);
  const b = unitOf([u[0] + w[0], u[1] + w[1]]);
  return a.reflex ? [-b[0], -b[1]] : b;
}

/**
 * One angle: `arcs` arcs (equal angles share the count), a square for 90°,
 * or a dashed arc when not known. `text` is its label; `boxed` puts it in a
 * dashed box (just found); `heavy` draws the arcs heavier (this step uses it).
 * Arcs of a bigger class sit further out, so marks round one crossing never
 * close into a ring; `depth` (other marked angles inside this one, e.g. the
 * two parts of a bend) pushes the arcs and the label further out again.
 */
function AngleG({ a, arcs, text, boxed, heavy, depth = 0, fs = FS }: { a: PAngle; arcs: number; text: string; boxed: boolean; heavy: boolean; depth?: number; fs?: number }) {
  const gap = 0.12;
  const r0 = a.reflex ? 0.45 : 0.5 + 0.16 * Math.max(0, arcs - 1) + 1.1 * Math.min(1, depth);
  const color = heavy ? HI : INK;
  const sw = heavy ? 3.5 : 2;
  const b = bisector(a);
  const outer = r0 + gap * Math.max(0, arcs - 1);
  const lr = outer + fs * (a.deg < 45 ? 1.9 : a.deg < 70 ? 1.3 : 1);
  const at: XY = [a.v[0] + b[0] * lr, a.v[1] + b[1] * lr];
  const right = !a.reflex && a.deg === 90 && arcs > 0;
  const w = fs * (0.5 + 0.55 * text.length);
  return (
    <g pointerEvents="none">
      {right ? (
        (() => {
          const u = unitOf([a.p[0] - a.v[0], a.p[1] - a.v[1]]);
          const ww = unitOf([a.q[0] - a.v[0], a.q[1] - a.v[1]]);
          const s = 0.38;
          return <polyline points={pts([[a.v[0] + u[0] * s, a.v[1] + u[1] * s], [a.v[0] + (u[0] + ww[0]) * s, a.v[1] + (u[1] + ww[1]) * s], [a.v[0] + ww[0] * s, a.v[1] + ww[1] * s]])} fill="none" stroke={color} strokeWidth={sw} vectorEffect="non-scaling-stroke" />;
        })()
      ) : arcs === 0 ? (
        <polyline points={pts(arc(a, a.reflex ? 0.45 : r0))} fill="none" stroke={color} strokeWidth={sw} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      ) : (
        Array.from({ length: arcs }, (_, k) => <polyline key={k} points={pts(arc(a, (a.reflex ? 0.45 : r0) + gap * k))} fill="none" stroke={color} strokeWidth={sw} vectorEffect="non-scaling-stroke" />)
      )}
      {boxed && <rect x={r4(at[0] - w / 2)} y={r4(at[1] - fs * 0.66)} width={r4(w)} height={r4(fs * 1.32)} rx={fs * 0.2} fill={PAPER} stroke={HI} strokeWidth={2} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />}
      <text x={r4(at[0])} y={r4(at[1])} fontSize={fs} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={boxed ? HI : INK} style={boxed ? undefined : halo(fs)} direction="ltr">
        {text}
      </text>
    </g>
  );
}

/** Arcs per value: the smallest value one arc, the next two, and so on. */
function arcClasses(values: number[]): Map<number, number> {
  const sorted = [...new Set(values)].sort((x, y) => x - y);
  return new Map(sorted.map((v, i) => [v, i + 1]));
}

/**
 * A question figure. Without `show` (a question not yet answered) only the
 * printed angles and «؟» are marked. With `show` (a "show me" step) angles
 * found so far are written too.
 */
/** How many other marks at the same corner lie inside angle a. */
function depthOf(a: PAngle, marks: PAngle[]): number {
  if (a.reflex) return 0;
  const dirs = (x: PAngle): XY[] => [unitOf([x.p[0] - x.v[0], x.p[1] - x.v[1]]), unitOf([x.q[0] - x.v[0], x.q[1] - x.v[1]])];
  const [u, w] = dirs(a);
  const ang = (x: XY, y: XY) => (Math.acos(Math.max(-1, Math.min(1, x[0] * y[0] + x[1] * y[1]))) * 180) / Math.PI;
  const inside = (x: XY) => Math.abs(ang(u, x) + ang(x, w) - a.deg) < 1e-6;
  return marks.filter((b) => b !== a && !b.reflex && b.deg < a.deg && Math.hypot(b.v[0] - a.v[0], b.v[1] - a.v[1]) < 1e-6 && dirs(b).every(inside)).length;
}

export function ParallelFigureG({ fig, show, fs = FS }: { fig: ParallelFigure; show?: Overlay; fs?: number }) {
  const known = new Set(show?.known ?? fig.angles.filter((a) => a.role === "given").map((a) => a.id));
  const focus = new Set(show?.focus ?? []);
  const visible = fig.angles.filter((a) => a.role !== "hidden" || known.has(a.id));
  const classes = arcClasses(visible.filter((a) => known.has(a.id)).map((a) => a.deg));
  const found = (a: PAngle) => a.role !== "given" && known.has(a.id);
  return (
    <g>
      <LinesG lines={fig.lines} helper={!!show?.helper} />
      {visible.map((a) => (
        <AngleG key={a.id} a={a} arcs={known.has(a.id) ? classes.get(a.deg)! : 0} text={known.has(a.id) ? `${fa(a.deg)}°` : "؟"} boxed={found(a) && focus.has(a.id)} heavy={focus.has(a.id)} depth={depthOf(a, visible)} fs={fs} />
      ))}
      {fig.points.map((p) => (
        <g key={p.name} pointerEvents="none">
          <circle cx={r4(p.at[0])} cy={r4(p.at[1])} r={0.08} fill={INK} />
          <text x={r4(p.at[0] + p.off[0] * fs * 1.15)} y={r4(p.at[1] + p.off[1] * fs * 1.15)} fontSize={fs * 0.95} fontStyle="italic" fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} style={halo(fs)}>
            {p.name}
          </text>
        </g>
      ))}
    </g>
  );
}

/** A question figure as its own picture, for paper. */
export function ParallelSvg({ fig, width = 240 }: { fig: ParallelFigure; width?: number }) {
  const [x, y, w, h] = parallelView(fig, 0.9);
  const height = Math.min(200, Math.round((width * h) / w));
  return (
    <svg viewBox={`${x} ${y} ${w} ${h}`} width={Math.round((height * w) / h)} height={height} style={{ direction: "ltr" }} role="img" aria-label="شکل خط‌های موازی">
      <ParallelFigureG fig={fig} fs={0.55} />
    </svg>
  );
}

// ── Explore ─────────────────────────────────────────────────────────────

/** Pairs to point out: opposite, side by side, same place, «Z», and «C» (same side, between the lines). */
export type ParRel = "vertical" | "linear" | "corresponding" | "alternate" | "coInterior";
export const PAR_RELS: [ParRel, string][] = [
  ["vertical", "روبه‌رو"],
  ["linear", "کنار هم"],
  ["corresponding", "هم‌جا"],
  ["alternate", "Z"],
  ["coInterior", "C"],
];
const REL_PAIR: Record<ParRel, [string, string]> = {
  vertical: ["A0", "A2"],
  linear: ["A0", "A1"],
  corresponding: ["A0", "B0"],
  alternate: ["A0", "B2"],
  coInterior: ["A0", "B3"],
};

export interface ParEx {
  /** The transversal's angle to the top line, 20 … 160. */
  phi: number;
  /** The bottom line turned by 12° (not parallel). */
  tilt: boolean;
  rel: ParRel | null;
}
export const PHI_RANGE: [number, number] = [20, 160];
const TILT = 12;
export const parExFigure = (ex: ParEx) => exploreFigure(ex.phi, ex.tilt ? TILT : 0);
export const parExView = (): View => [-6.2, -4.4, 12.4, 8.8];

/** The explore board: two lines and a transversal with its two handles; all eight angles marked. */
export function ParallelExploreG({ ex, onPhi }: { ex: ParEx; onPhi: (phi: number) => void }) {
  const fig = parExFigure(ex);
  const classes = arcClasses(fig.angles.map((a) => a.deg));
  const pair: string[] = ex.rel ? REL_PAIR[ex.rel] : [];
  const trans = fig.lines[2];
  const drag = useRef<number | null>(null);
  const toPhi = (e: React.PointerEvent<SVGCircleElement>, end: number) => {
    const ctm = e.currentTarget.ownerSVGElement?.getScreenCTM();
    if (!ctm) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    // The transversal turns about the middle (0, 0); the top handle is at −t, the bottom one at +t.
    let a = (Math.atan2(end * p.y, end * p.x) * 180) / Math.PI;
    if (a < 0) a += 180;
    onPhi(Math.max(PHI_RANGE[0], Math.min(PHI_RANGE[1], Math.round(a))));
  };
  return (
    <g>
      <LinesG lines={fig.lines} helper={false} />
      {fig.angles.map((a) => (
        <AngleG key={a.id} a={a} arcs={classes.get(a.deg)!} text={`${fa(a.deg)}°`} boxed={pair.includes(a.id)} heavy={pair.includes(a.id)} fs={0.42} />
      ))}
      {[
        [trans.a, -1],
        [trans.b, 1],
      ].map(([at, end]) => {
        const [x, y] = at as XY;
        return (
          <g key={end as number}>
            <circle cx={r4(x)} cy={r4(y)} r={0.3} fill={PAPER} stroke={SHAPE} strokeWidth={3} vectorEffect="non-scaling-stroke" pointerEvents="none" />
            <circle cx={r4(x)} cy={r4(y)} r={0.12} fill={SHAPE} pointerEvents="none" />
            <circle
              cx={r4(x)}
              cy={r4(y)}
              r={0.75}
              fill="transparent"
              style={{ cursor: "grab", touchAction: "none" }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = end as number;
              }}
              onPointerMove={(e) => {
                if (drag.current === end) toPhi(e, end as number);
              }}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
            />
          </g>
        );
      })}
    </g>
  );
}

/** What the explore board shows, line by line. */
export function parExText(ex: ParEx): string[] {
  const fig = parExFigure(ex);
  const v = (id: string) => fig.angles.find((a) => a.id === id)!.deg;
  const top = fig.angles.slice(0, 4).map((a) => a.deg);
  const lines = [`دور نقطه برخورد بالا: ${ltr(`${top.map(fa).join(" + ")} = ۳۶۰`)} (دور یک نقطه)`];
  if (!ex.tilt) {
    const [s, b] = [Math.min(...top), Math.max(...top)];
    lines.push(s === b ? "همه هشت زاویه ۹۰° اند." : `چهار زاویه تند ${fa(s)}° و چهار زاویه باز ${fa(b)}°؛ ${ltr(`${fa(s)} + ${fa(b)} = ۱۸۰`)}.`);
  } else lines.push("خط پایین موازی نیست: زاویه‌های برخورد پایین دیگر با زاویه‌های برخورد بالا برابر نیستند (شمار کمان‌ها فرق می‌کند).");
  if (ex.rel) {
    const [p, q] = REL_PAIR[ex.rel].map(v);
    const tilted = ex.tilt && ex.rel !== "vertical" && ex.rel !== "linear";
    const say: Record<ParRel, string> = {
      vertical: `روبه‌رو (متقابل به رأس): ${fa(p)}° و ${fa(q)}° همیشه برابرند، حتی بدون خط موازی.`,
      linear: `کنار هم روی خط صاف: ${ltr(`${fa(p)} + ${fa(q)} = ${fa(p + q)}`)}؛ همیشه ۱۸۰°.`,
      corresponding: tilted ? `هم‌جا: ${fa(p)}° و ${fa(q)}° برابر نیستند، چون خط‌ها موازی نیستند.` : `هم‌جا (متناظر): ${fa(p)}° و ${fa(q)}°، در جای یکسان در دو نقطه برخورد؛ با خط‌های موازی برابرند.`,
      alternate: tilted ? `Z: ${fa(p)}° و ${fa(q)}° برابر نیستند، چون خط‌ها موازی نیستند.` : `زاویه‌های Z (متبادل): ${fa(p)}° و ${fa(q)}°، بین دو خط و دو طرف مورب؛ با خط‌های موازی برابرند.`,
      coInterior: tilted ? `C: ${ltr(`${fa(p)} + ${fa(q)} = ${fa(p + q)}`)}، نه ۱۸۰، چون خط‌ها موازی نیستند.` : `زاویه‌های C: بین دو خط و یک طرف مورب: ${ltr(`${fa(p)} + ${fa(q)} = ۱۸۰`)}.`,
    };
    lines.push(say[ex.rel]);
  }
  return lines;
}

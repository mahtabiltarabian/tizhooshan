"use client";

// Pictures for tool 15, in board units: a train of gears and pulleys with
// belts, a straight track with its time–distance graph, a walker on a compass
// and a street grid. Directions are shown with arrows and words, movers with
// different shapes and letters, graph lines solid and dashed, so nothing
// depends on colour alone. Every trig-derived coordinate is rounded: the
// server and the browser differ in the last digits of sin and cos.

import { COMPASS, positionAt, reverses, STEP, wheelTurns, type Compass, type Machine, type Mover, type Pt, type Rot } from "@/generators/motion";
import { fa } from "@/tools/registry";

export const INK = "#1f2430";
export const SOFT = "#5b6170";
export const BLUE = "#2f6fdb";
export const ORANGE = "#d9631e";
const GEAR_FILL = "#dfe5f0";
const PULLEY_FILL = "#f3e6cf";
const BELT = "#3a3f4b";

const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
/** Point at angle `deg`, measured clockwise from east (SVG y points down). */
const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [r4(cx + r * Math.cos(a)), r4(cy + r * Math.sin(a))];
};

/** Persian number with at most one decimal: ۲٫۵ */
export const numFa = (x: number) => fa(String(Math.round(x * 10) / 10)).replace(".", "٫");

export const WHEEL_NAMES = ["الف", "ب", "پ", "ت", "ث", "ج"];
export const ROT_WORD = ["ساعتگرد", "پادساعتگرد"];
export const ROT_ICON = ["↻", "↺"];

// ── Gears and pulleys ────────────────────────────────────────────────────

const gearCache = new Map<number, string>();
/** Outline of a gear with T teeth, pitch radius T / 2 (raw units, centre 0,0); a tooth is centred on angle 0. */
function gearPath(T: number) {
  const hit = gearCache.get(T);
  if (hit) return hit;
  const r = T / 2;
  const tip = r + 1;
  const root = r - 1.25;
  const p = 360 / T;
  const pts: [number, number][] = [];
  for (let k = 0; k < T; k++) {
    const c = k * p;
    pts.push(polar(0, 0, root, c - 0.5 * p), polar(0, 0, root, c - 0.27 * p), polar(0, 0, tip, c - 0.13 * p), polar(0, 0, tip, c + 0.13 * p), polar(0, 0, root, c + 0.27 * p));
  }
  const d = `M${pts.map(([x, y]) => `${Math.round(x * 1e3) / 1e3},${Math.round(y * 1e3) / 1e3}`).join("L")}Z`;
  gearCache.set(T, d);
  return d;
}

/** Outer radius (raw units) of a wheel. */
const outer = (w: Machine["wheels"][number]) => (w.kind === "gear" ? w.size / 2 + 1 : w.size / 2);
const BELT_GAP = 7;

/** Where each wheel goes, in raw units along one line; wheels on one axle share a place. */
export function layoutMachine(m: Machine) {
  const group: number[] = [0];
  m.links.forEach((l, i) => group.push(l === "axle" ? group[i] : group[i] + 1));
  const foot: number[] = [];
  m.wheels.forEach((w, i) => (foot[group[i]] = Math.max(foot[group[i]] ?? 0, outer(w))));
  const xs = [0];
  m.links.forEach((l, i) => {
    const a = m.wheels[i];
    const b = m.wheels[i + 1];
    xs.push(l === "axle" ? xs[i] : l === "mesh" ? xs[i] + a.size / 2 + b.size / 2 : xs[i] + foot[group[i]] + foot[group[i + 1]] + BELT_GAP);
  });
  const left = -foot[0];
  const right = xs[xs.length - 1] + foot[group[group.length - 1]];
  return { xs, group, foot, left, width: right - left, height: 2 * Math.max(...foot) };
}

/** Starting angle of each wheel so that meshing teeth fall into gaps. */
function phases(m: Machine) {
  const out = [0];
  const frac = (v: number) => ((v % 1) + 1) % 1;
  m.links.forEach((l, i) => {
    if (l !== "mesh") return out.push(0);
    const s = frac((-out[i] * m.wheels[i].size) / 360);
    out.push(180 - ((0.5 - s) * 360) / m.wheels[i + 1].size);
  });
  return out;
}

/** A curved arrow on a wheel's face: clockwise or counterclockwise, two halves. */
function RotArrow({ cx, cy, r, dir, bold }: { cx: number; cy: number; r: number; dir: Rot; bold?: boolean }) {
  const arcs = [
    [200, 340],
    [20, 160],
  ];
  const head = Math.min(r * 0.45, 0.3);
  return (
    <g pointerEvents="none">
      {arcs.map(([a, b], i) => {
        const [from, to] = dir === 0 ? [a, b] : [b, a];
        const [x1, y1] = polar(cx, cy, r, from);
        const [x2, y2] = polar(cx, cy, r, to);
        // Arrowhead along the direction of travel at the end of the arc.
        const t = ((to + (dir === 0 ? 90 : -90)) * Math.PI) / 180;
        const [tx, ty] = [Math.cos(t), Math.sin(t)];
        const tipX = r4(x2 + tx * head * 0.6);
        const tipY = r4(y2 + ty * head * 0.6);
        const [nx, ny] = [-ty, tx];
        const b1 = `${r4(x2 + nx * head * 0.5 - tx * head * 0.3)},${r4(y2 + ny * head * 0.5 - ty * head * 0.3)}`;
        const b2 = `${r4(x2 - nx * head * 0.5 - tx * head * 0.3)},${r4(y2 - ny * head * 0.5 - ty * head * 0.3)}`;
        return (
          <g key={i}>
            <path d={`M${x1},${y1} A${r},${r} 0 0 ${dir === 0 ? 1 : 0} ${x2},${y2}`} fill="none" stroke="#fff" strokeWidth={bold ? 9 : 7} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <path d={`M${x1},${y1} A${r},${r} 0 0 ${dir === 0 ? 1 : 0} ${x2},${y2}`} fill="none" stroke={INK} strokeWidth={bold ? 4.5 : 3} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <path d={`M${tipX},${tipY} L${b1} L${b2} Z`} fill={INK} stroke="#fff" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          </g>
        );
      })}
    </g>
  );
}

interface MachineProps {
  machine: Machine;
  /** Box to fit in (board units); labels go in the bottom 1.9 units. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Turns made so far by the first wheel (fractions turn it part way). */
  spin: number;
  driver: Rot;
  /** "all": an arrow on every wheel; "driver": only on the first; "none". */
  arrows: "all" | "driver" | "none";
  /** Show "۲ دور" under each wheel (turns so far). */
  counters?: boolean;
  /** Turns the first wheel is told to make, written under it. */
  driverTurns?: number;
  /** The wheel asked about: marked with "؟" until shown. */
  asked?: number;
  hideAnswer?: boolean;
  /** Click a wheel (explore: pick a gear to change). */
  onWheel?: (i: number) => void;
  /** Bigger labels (worksheets). */
  fontScale?: number;
  selected?: number;
}

export function MachineG({ machine: m, x, y, w, h, spin, driver, arrows, counters, driverTurns, asked, hideAnswer, onWheel, selected, fontScale = 1 }: MachineProps) {
  const lay = layoutMachine(m);
  const labelH = 1.9 * fontScale;
  const s = Math.min((w - 0.4) / lay.width, (h - labelH - 0.3) / lay.height, 0.32);
  const cy = r4(y + (h - labelH) / 2 + 0.1);
  const x0 = x + (w - lay.width * s) / 2 - lay.left * s;
  const cx = (i: number) => r4(x0 + lay.xs[i] * s);
  const ratio = wheelTurns(m, 1);
  const sign = driver === 0 ? 1 : -1;
  const phi = phases(m);
  const angle = (i: number) => Math.round((phi[i] + 360 * spin * ratio[i] * sign) * 1000) / 1000;
  const dirOfWheel = (i: number): Rot => ((ratio[i] > 0) === (driver === 0) ? 0 : 1);

  // Belts: straight ones on the outer tangents, crossed ones on the inner tangents.
  const belts = m.links.map((l, i) => {
    if (l !== "belt" && l !== "cross") return null;
    const r1 = (m.wheels[i].size / 2) * s;
    const r2 = (m.wheels[i + 1].size / 2) * s;
    const x1 = cx(i);
    const x2 = cx(i + 1);
    const d = x2 - x1;
    const lines: string[] = [];
    if (l === "belt") {
      const ph = Math.asin((r1 - r2) / d);
      for (const up of [-1, 1]) {
        const [nx, ny] = [Math.sin(ph), up * Math.cos(ph)];
        lines.push(`M${r4(x1 + r1 * nx)},${r4(cy + r1 * ny)} L${r4(x2 + r2 * nx)},${r4(cy + r2 * ny)}`);
      }
    } else {
      const ph = Math.asin((r1 + r2) / d);
      for (const up of [-1, 1]) {
        const [nx, ny] = [Math.sin(ph), up * Math.cos(ph)];
        lines.push(`M${r4(x1 + r1 * nx)},${r4(cy + r1 * ny)} L${r4(x2 - r2 * nx)},${r4(cy - r2 * ny)}`);
      }
    }
    return (
      <g key={`belt${i}`}>
        {lines.map((dd, k) => (
          <path key={k} d={dd} stroke={BELT} strokeWidth={5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        ))}
        {l === "cross" && (
          <text x={r4((x1 + r1 + x2 - r2) / 2)} y={r4(cy - Math.max(r1, r2) - 0.25)} fontSize={0.26} fontWeight={700} textAnchor="middle" fill={INK}>
            ✕ ضربدری
          </text>
        )}
      </g>
    );
  });
  const belted = (i: number) => (m.links[i - 1] === "belt" || m.links[i - 1] === "cross" || m.links[i] === "belt" || m.links[i] === "cross");

  // Gears behind, pulleys (smaller, on the same axle) in front.
  const order = m.wheels.map((_, i) => i).sort((a, b) => (m.wheels[a].kind === m.wheels[b].kind ? a - b : m.wheels[a].kind === "gear" ? -1 : 1));
  const wheels = order.map((i) => {
    const wh = m.wheels[i];
    const R = (wh.size / 2) * s;
    const pick = onWheel ? { onClick: () => onWheel(i), style: { cursor: "pointer" } } : {};
    const sel = selected === i;
    return (
      <g key={i} {...pick}>
        <g transform={`translate(${cx(i)} ${cy}) rotate(${angle(i)})`}>
          {wh.kind === "gear" ? (
            <>
              <path d={gearPath(wh.size)} transform={`scale(${s})`} fill={GEAR_FILL} stroke={INK} strokeWidth={sel ? 3.5 : 2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              <circle r={r4(R * 0.72)} fill="none" stroke={SOFT} strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            </>
          ) : (
            <>
              <circle r={R} fill={PULLEY_FILL} stroke={belted(i) ? BELT : INK} strokeWidth={belted(i) ? 5 : 2} vectorEffect="non-scaling-stroke" />
              <circle r={r4(R * 0.82)} fill="none" stroke={INK} strokeWidth={1} vectorEffect="non-scaling-stroke" />
              {[0, 90, 180, 270].map((a) => {
                const [px, py] = polar(0, 0, R * 0.82, a);
                return <line key={a} x1={0} y1={0} x2={px} y2={py} stroke={SOFT} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />;
              })}
            </>
          )}
          {/* A marked spot, to count the turns by. */}
          <circle cx={r4(R * (wh.kind === "gear" ? 0.55 : 0.6))} cy={0} r={r4(Math.max(0.07, R * 0.1))} fill={INK} />
        </g>
        {sel && <circle cx={cx(i)} cy={cy} r={r4(R + (wh.kind === "gear" ? s : 0) + 0.12)} fill="none" stroke={BLUE} strokeWidth={3} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />}
      </g>
    );
  });

  // Hubs, arrows and labels stay upright.
  const groups = new Map<number, number[]>();
  lay.group.forEach((g, i) => groups.set(g, [...(groups.get(g) ?? []), i]));
  const fs = 0.3 * fontScale;
  let lastX = -99;
  let stagger = false;
  const labels: React.ReactNode[] = [];
  const overlays: React.ReactNode[] = [];
  for (const [g, members] of groups) {
    const gx = cx(members[0]);
    // Labels stay inside the board even under a small wheel at the edge.
    const lx = r4(Math.min(x + w - 1.5, Math.max(x + 1.5, gx)));
    const footR = lay.foot[g] * s;
    stagger = gx - lastX < 1.9 * fontScale && !stagger;
    lastX = gx;
    let ly = cy + footR + 0.42 * fontScale + (stagger ? 0.95 * fontScale : 0);
    // The smallest wheel on an axle carries the hub, the arrow and the name.
    const front = [...members].sort((a, b) => m.wheels[a].size - m.wheels[b].size)[0];
    const fr = (m.wheels[front].size / 2) * s;
    const show = arrows === "all" || (arrows === "driver" && members.includes(0));
    const hidden = hideAnswer && asked !== undefined && members.includes(asked);
    if (show && !hidden) overlays.push(<RotArrow key={`arr${g}`} cx={gx} cy={cy} r={r4(Math.max(0.28, fr * 0.6))} dir={dirOfWheel(front)} bold={members.includes(0)} />);
    if (hidden && asked !== undefined)
      overlays.push(
        <text key={`q${g}`} x={gx} y={cy} fontSize={Math.max(0.5, fr * 0.9)} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} stroke="#fff" strokeWidth={5} paintOrder="stroke" vectorEffect="non-scaling-stroke">
          ؟
        </text>,
      );
    overlays.push(<circle key={`hub${g}`} cx={gx} cy={cy} r={r4(Math.max(0.08, fr * 0.12))} fill="#fff" stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke" />);
    for (const i of members) {
      const wh = m.wheels[i];
      const turnsNow = Math.abs(spin * ratio[i]);
      const parts = [wh.kind === "gear" ? `${fa(wh.size)} دندانه` : `قطر ${fa(wh.size)}`];
      labels.push(
        <text key={`n${i}`} x={lx} y={r4(ly)} fontSize={fs * 1.15} fontWeight={700} textAnchor="middle" fill={i === 0 ? BLUE : INK}>
          {WHEEL_NAMES[i]}
          {i === 0 ? " (دسته)" : ""}
          {i === asked ? " ★" : ""}
          <tspan fontSize={fs} fontWeight={400} fill={INK}>
            {" · "}
            {parts[0]}
          </tspan>
        </text>,
      );
      ly += 0.4 * fontScale;
      const showDir = (arrows === "all" || (arrows === "driver" && i === 0)) && !(hideAnswer && i === asked);
      const bits: string[] = [];
      if (showDir) bits.push(`${ROT_ICON[dirOfWheel(i)]} ${ROT_WORD[dirOfWheel(i)]}`);
      if (counters && !(hideAnswer && i === asked)) bits.push(`${numFa(turnsNow)} دور`);
      if (i === 0 && driverTurns !== undefined && !counters) bits.push(`${fa(driverTurns)} دور`);
      if (hideAnswer && i === asked) bits.push("؟");
      if (bits.length) {
        labels.push(
          <text key={`d${i}`} x={lx} y={r4(ly)} fontSize={fs} fontWeight={700} textAnchor="middle" fill={INK}>
            {bits.join(" · ")}
          </text>,
        );
        ly += 0.4 * fontScale;
      }
    }
  }

  return (
    <g>
      {wheels.filter((_, k) => m.wheels[order[k]].kind === "gear")}
      {wheels.filter((_, k) => m.wheels[order[k]].kind === "pulley")}
      {belts}
      {overlays}
      {labels}
    </g>
  );
}

/** A standalone machine (worksheets): no counters, arrow on the first wheel only. */
export function MachineSvg({ machine, driver, asked, width = 340 }: { machine: Machine; driver: Rot; asked?: number; width?: number }) {
  return (
    <svg width={width} height={(width * 8) / 16} viewBox="0 0 16 8" style={{ direction: "ltr" }}>
      <MachineG machine={machine} x={0} y={0} w={16} h={8} spin={0} driver={driver} arrows="driver" asked={asked} hideAnswer={asked !== undefined} fontScale={1.9} />
    </svg>
  );
}

/** Whether every link keeps or flips the direction, as words: "درگیر: برعکس". */
export const linkWord = (l: Machine["links"][number]) => (l === "mesh" ? "دندانه درگیر" : l === "belt" ? "تسمه ساده" : l === "cross" ? "تسمه ضربدری" : "یک محور");
export const linkEffect = (l: Machine["links"][number]) => (reverses(l) ? "جهت برعکس می‌شود" : "جهت همان می‌ماند");

// ── Track and graph ──────────────────────────────────────────────────────

export interface TrackMover {
  mover: Mover;
  name: string;
  /** Arrow (A) or round (B): shapes, not only colours. */
  shape: "arrow" | "round";
}

const NICE = [1, 2, 5, 10, 20, 25, 30, 40, 50, 60, 100, 120, 150, 200, 250, 300, 400, 500, 1000, 2000];
const niceStep = (span: number, most: number) => NICE.find((s) => span / s <= most) ?? span;

function MoverMark({ x, y, shape, dir, name, color }: { x: number; y: number; shape: "arrow" | "round"; dir: 1 | -1; name: string; color: string }) {
  const s = 0.36;
  return (
    <g>
      {shape === "arrow" ? (
        <path d={`M${r4(x - dir * s)},${r4(y - s * 0.75)} L${r4(x + dir * s * 0.35)},${r4(y - s * 0.75)} L${r4(x + dir * s * 1.05)},${y} L${r4(x + dir * s * 0.35)},${r4(y + s * 0.75)} L${r4(x - dir * s)},${r4(y + s * 0.75)} Z`} fill={color} stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      ) : (
        <>
          <circle cx={x} cy={y} r={s * 0.85} fill={color} stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          <path d={`M${r4(x + dir * s * 0.85)},${r4(y - s * 0.35)} L${r4(x + dir * s * 1.3)},${y} L${r4(x + dir * s * 0.85)},${r4(y + s * 0.35)} Z`} fill={INK} />
        </>
      )}
      <text x={r4(x - dir * (shape === "arrow" ? 0.06 : 0))} y={r4(y + 0.02)} fontSize={0.24} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill="#fff">
        {name}
      </text>
    </g>
  );
}

export const MOVER_COLOR = [BLUE, ORANGE];

interface TrackProps {
  length: number;
  distUnit: string;
  movers: TrackMover[];
  t: number;
  x: number;
  y: number;
  w: number;
  /** Write each mover's distance from its start above it. */
  marks?: boolean;
  /** Star where they meet, once they have. */
  meet?: number | null;
  /** The length is the question: no numbers along the track, "؟" at the end. */
  unknownLength?: boolean;
  /** No numbers at all (small worksheet pictures; the numbers are in the question). */
  bare?: boolean;
}

/** A straight two-lane track from 0 (left) to `length`: A on the upper lane, B on the lower, at time t. */
export function TrackG({ length, distUnit, movers, t, x, y, w, marks, meet, unknownLength, bare }: TrackProps) {
  const sx = (p: number) => r4(x + (p / length) * w);
  const step = niceStep(length, 8);
  const ticks: number[] = [];
  if (!unknownLength) for (let p = 0; p < length - step * 0.3; p += step) ticks.push(p);
  else ticks.push(0);
  if (!bare) ticks.push(length);
  else ticks.length = 0;
  const lane = (i: number) => r4(y + (i ? 0.3 : -0.3));
  return (
    <g>
      <rect x={x - 0.3} y={y - 0.62} width={w + 0.6} height={1.24} rx={0.3} fill="#d8cdb8" stroke={INK} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <line x1={x - 0.2} y1={y} x2={x + w + 0.2} y2={y} stroke="#fff" strokeWidth={2} strokeDasharray="6 6" vectorEffect="non-scaling-stroke" />
      {ticks.map((p) => (
        <g key={p}>
          <line x1={sx(p)} y1={y + 0.62} x2={sx(p)} y2={y + 0.8} stroke={INK} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          <text x={sx(p)} y={y + 1.08} fontSize={unknownLength && p ? 0.4 : 0.26} fontWeight={unknownLength && p ? 700 : 400} textAnchor="middle" fill={INK}>
            {unknownLength && p ? "؟" : fa(p)}
          </text>
        </g>
      ))}
      <text x={x + w + 0.15} y={y + 1.42} fontSize={0.24} textAnchor="middle" fill={SOFT}>
        {distUnit}
      </text>
      {meet !== undefined && meet !== null && (
        <>
          <line x1={sx(meet)} y1={y - 0.62} x2={sx(meet)} y2={y + 0.62} stroke={INK} strokeWidth={2.5} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
          <text x={sx(meet)} y={y} fontSize={0.42} textAnchor="middle" dominantBaseline="central" fill={INK} stroke="#fff" strokeWidth={4} paintOrder="stroke" vectorEffect="non-scaling-stroke">
            ★
          </text>
        </>
      )}
      {movers.map((mv, i) => {
        const p = positionAt(mv.mover, t, length);
        return (
          <g key={mv.name}>
            <MoverMark x={sx(p)} y={lane(i)} shape={mv.shape} dir={mv.mover.dir} name={mv.name} color={MOVER_COLOR[i]} />
            {marks && (
              <text x={sx(p)} y={i ? y + 1.45 : y - 0.85} fontSize={0.24} fontWeight={700} textAnchor="middle" fill={INK} stroke="#efe5d3" strokeWidth={4} paintOrder="stroke" vectorEffect="non-scaling-stroke">
                {mv.name}: {numFa(Math.abs(p - mv.mover.start))} {distUnit}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

interface GraphProps {
  length: number;
  tMax: number;
  movers: TrackMover[];
  /** Lines are drawn up to time t. */
  t: number;
  x: number;
  y: number;
  w: number;
  h: number;
  timeUnit: string;
  distUnit: string;
  /** A marked moment, e.g. when they meet. */
  mark?: { t: number; label: string } | null;
}

/** Time to the right, place on the track upward: each mover is a line, A solid and B dashed. */
export function GraphG({ length, tMax, movers, t, x, y, w, h, timeUnit, distUnit, mark }: GraphProps) {
  const gx = (tt: number) => r4(x + (tt / tMax) * w);
  const gy = (p: number) => r4(y + h - (p / length) * h);
  const tStep = niceStep(tMax, 12);
  const pStep = niceStep(length, 6);
  const tTicks: number[] = [];
  for (let k = 0; k <= tMax + 1e-9; k += tStep) tTicks.push(k);
  const pTicks: number[] = [];
  for (let p = 0; p <= length + 1e-9; p += pStep) pTicks.push(p);
  const until = Math.min(t, tMax);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#fff" stroke={INK} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {tTicks.map((k) => (
        <g key={`t${k}`}>
          <line x1={gx(k)} y1={y} x2={gx(k)} y2={y + h} stroke="#e4ddd0" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <text x={gx(k)} y={y + h + 0.32} fontSize={0.24} textAnchor="middle" fill={INK}>
            {fa(k)}
          </text>
        </g>
      ))}
      {pTicks.map((p) => (
        <g key={`p${p}`}>
          <line x1={x} y1={gy(p)} x2={x + w} y2={gy(p)} stroke="#e4ddd0" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <text x={x - 0.1} y={gy(p)} fontSize={0.22} textAnchor="end" dominantBaseline="central" fill={INK}>
            {fa(p)}
          </text>
        </g>
      ))}
      <text x={x + w / 2} y={y + h + 0.68} fontSize={0.26} fontWeight={700} textAnchor="middle" fill={SOFT}>
        زمان ({timeUnit}) →
      </text>
      <text x={x - 0.1} y={y - 0.2} fontSize={0.24} fontWeight={700} textAnchor="end" fill={SOFT}>
        ↑ جا روی مسیر ({distUnit})
      </text>
      {movers.map((mv, i) => {
        // Straight pieces: waiting, moving, stopped at the end.
        const pts: number[] = [0];
        if (mv.mover.delay > 0 && mv.mover.delay < until) pts.push(mv.mover.delay);
        const reach = mv.mover.delay + (mv.mover.dir > 0 ? length - mv.mover.start : mv.mover.start) / Math.max(mv.mover.speed, 1e-9);
        if (reach > 0 && reach < until) pts.push(reach);
        pts.push(until);
        const d = pts.map((tt, k) => `${k ? "L" : "M"}${gx(tt)},${gy(positionAt(mv.mover, tt, length))}`).join(" ");
        const end = positionAt(mv.mover, until, length);
        // Name above the line if it runs above the other one, below if under it.
        const other = movers[1 - i];
        const cmp = (tt: number) => (other ? positionAt(mv.mover, tt, length) - positionAt(other.mover, tt, length) : 1);
        const above = Math.abs(cmp(until)) > 1e-9 ? cmp(until) > 0 : cmp(until / 2) >= 0;
        return (
          <g key={mv.name}>
            <path d={d} fill="none" stroke={MOVER_COLOR[i]} strokeWidth={4} strokeDasharray={i ? "8 5" : undefined} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {until > 0 && (
              <text x={gx(until) + 0.15} y={gy(end) + (above ? -0.2 : 0.35)} fontSize={0.28} fontWeight={700} fill={INK} stroke="#fff" strokeWidth={4} paintOrder="stroke" vectorEffect="non-scaling-stroke">
                {mv.name}
              </text>
            )}
          </g>
        );
      })}
      {mark && mark.t <= until + 1e-9 && (
        <g>
          <line x1={gx(mark.t)} y1={y} x2={gx(mark.t)} y2={y + h} stroke={INK} strokeWidth={1.5} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          <text x={gx(mark.t)} y={y - 0.2} fontSize={0.28} fontWeight={700} textAnchor="middle" fill={INK} stroke="#fff" strokeWidth={4} paintOrder="stroke" vectorEffect="non-scaling-stroke">
            {mark.label}
          </text>
        </g>
      )}
    </g>
  );
}

// ── Compass, walker and grid ─────────────────────────────────────────────

/** A walker seen from above: a disc with a pointed nose, facing `heading` degrees clockwise from north. */
export function WalkerG({ x, y, size, heading }: { x: number; y: number; size: number; heading: number }) {
  const s = size;
  return (
    <g transform={`translate(${x} ${y}) rotate(${Math.round(heading * 1000) / 1000})`}>
      <path d={`M0,${r4(-s * 1.25)} L${r4(s * 0.55)},${r4(-s * 0.45)} L${r4(-s * 0.55)},${r4(-s * 0.45)} Z`} fill={INK} />
      <circle r={s * 0.62} fill={ORANGE} stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <circle cx={r4(-s * 0.22)} cy={r4(-s * 0.25)} r={r4(s * 0.09)} fill={INK} />
      <circle cx={r4(s * 0.22)} cy={r4(-s * 0.25)} r={r4(s * 0.09)} fill={INK} />
    </g>
  );
}

/** A compass rose: north up, the four directions written in Persian with arrows. */
export function CompassG({ x, y, r, highlight, needle = true }: { x: number; y: number; r: number; highlight?: Compass | null; needle?: boolean }) {
  const pos: [number, number, string][] = [
    [0, -1, "↑"],
    [1, 0, "→"],
    [0, 1, "↓"],
    [-1, 0, "←"],
  ];
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#fff" stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {needle && <path d={`M${x},${r4(y - r * 0.8)} L${r4(x + r * 0.16)},${y} L${x},${r4(y + r * 0.8)} L${r4(x - r * 0.16)},${y} Z`} fill="#f4f1ec" stroke={INK} strokeWidth={1} vectorEffect="non-scaling-stroke" />}
      {needle && <path d={`M${x},${r4(y - r * 0.8)} L${r4(x + r * 0.16)},${y} L${r4(x - r * 0.16)},${y} Z`} fill={INK} />}
      {pos.map(([dx, dy], i) => (
        <text
          key={i}
          x={r4(x + dx * (r + 0.55))}
          y={r4(y + dy * (r + 0.32))}
          fontSize={0.34}
          fontWeight={700}
          textAnchor="middle"
          dominantBaseline="central"
          fill={INK}
          stroke={highlight === i ? "#ffc93d" : "none"}
          strokeWidth={highlight === i ? 9 : 0}
          paintOrder="stroke"
          vectorEffect="non-scaling-stroke"
        >
          {COMPASS[i]}
        </text>
      ))}
    </g>
  );
}

/** Small compass in a corner: "N ↑" and friends. */
export function MiniCompass({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <line x1={x} y1={y + 0.35} x2={x} y2={y - 0.45} stroke={INK} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
      <path d={`M${x},${y - 0.6} L${x + 0.12},${y - 0.38} L${x - 0.12},${y - 0.38} Z`} fill={INK} />
      <line x1={x - 0.35} y1={y} x2={x + 0.35} y2={y} stroke={INK} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <text x={x} y={y - 0.78} fontSize={0.24} fontWeight={700} textAnchor="middle" fill={INK}>
        شمال
      </text>
      <text x={x + 0.42} y={y} fontSize={0.2} textAnchor="start" dominantBaseline="central" fill={INK}>
        شرق
      </text>
      <text x={x - 0.42} y={y} fontSize={0.2} textAnchor="end" dominantBaseline="central" fill={INK}>
        غرب
      </text>
      <text x={x} y={y + 0.55} fontSize={0.2} textAnchor="middle" fill={INK}>
        جنوب
      </text>
    </g>
  );
}

export const POINT_NAMES = ["الف", "ب", "پ", "ت"];

interface GridProps {
  cols: number;
  rows: number;
  x: number;
  y: number;
  cell: number;
  start?: Pt;
  /** Facing at the start, drawn as the walker. */
  facing?: Compass;
  /** Walker heading in degrees (animated) and where it is now. */
  walker?: { at: [number, number]; heading: number } | null;
  /** Labelled points; `answer` (when shown) gets a star. */
  points?: Pt[];
  answer?: number | null;
  /** The path walked so far (grid points; the last may be part way). */
  path?: [number, number][];
  /** Numbers written on street corners (routes). */
  numbers?: Map<string, number>;
  goal?: Pt;
  /** Click a street corner. */
  onPoint?: (p: Pt) => void;
}

/** A street grid: x to the east (right), y to the north (up). */
export function GridG({ cols, rows, x, y, cell, start, walker, points, answer, path, numbers, goal, onPoint }: GridProps) {
  const px = (gx: number) => r4(x + gx * cell);
  const py = (gy: number) => r4(y + (rows - gy) * cell);
  const lines: React.ReactNode[] = [];
  for (let c = 0; c <= cols; c++) lines.push(<line key={`c${c}`} x1={px(c)} y1={py(0)} x2={px(c)} y2={py(rows)} stroke="#b9ad97" strokeWidth={3} vectorEffect="non-scaling-stroke" />);
  for (let r = 0; r <= rows; r++) lines.push(<line key={`r${r}`} x1={px(0)} y1={py(r)} x2={px(cols)} y2={py(r)} stroke="#b9ad97" strokeWidth={3} vectorEffect="non-scaling-stroke" />);
  const blocks: React.ReactNode[] = [];
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++)
      blocks.push(<rect key={`b${c}-${r}`} x={r4(px(c) + cell * 0.12)} y={r4(py(r + 1) + cell * 0.12)} width={r4(cell * 0.76)} height={r4(cell * 0.76)} rx={r4(cell * 0.08)} fill="#f6efe2" />);
  const corners: React.ReactNode[] = [];
  if (onPoint)
    for (let c = 0; c <= cols; c++)
      for (let r = 0; r <= rows; r++)
        corners.push(<circle key={`k${c}-${r}`} cx={px(c)} cy={py(r)} r={r4(cell * 0.3)} fill="transparent" style={{ cursor: "pointer" }} onClick={() => onPoint({ x: c, y: r })} />);
  return (
    <g>
      {blocks}
      {lines}
      {path && path.length > 1 && <path d={path.map(([gx, gy], i) => `${i ? "L" : "M"}${px(gx)},${py(gy)}`).join(" ")} fill="none" stroke={BLUE} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
      {numbers &&
        [...numbers].map(([k, n]) => {
          const [gx, gy] = k.split(",").map(Number);
          return (
            <g key={`n${k}`}>
              <circle cx={px(gx)} cy={py(gy)} r={r4(cell * 0.26)} fill="#fff" stroke={INK} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
              <text x={px(gx)} y={py(gy)} fontSize={r4(cell * (n > 9 ? 0.24 : 0.3))} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
                {fa(n)}
              </text>
            </g>
          );
        })}
      {points?.map((p, i) => (
        <g key={`p${i}`}>
          <rect x={r4(px(p.x) - cell * 0.3)} y={r4(py(p.y) - cell * 0.3)} width={r4(cell * 0.6)} height={r4(cell * 0.6)} rx={r4(cell * 0.12)} fill={answer === i ? "#fff1c2" : "#fff"} stroke={INK} strokeWidth={answer === i ? 3 : 2} vectorEffect="non-scaling-stroke" />
          <text x={px(p.x)} y={py(p.y)} fontSize={r4(cell * 0.3)} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
            {POINT_NAMES[i]}
          </text>
          {answer === i && (
            <text x={r4(px(p.x) + cell * 0.38)} y={r4(py(p.y) - cell * 0.32)} fontSize={r4(cell * 0.36)} textAnchor="middle" dominantBaseline="central" fill={INK}>
              ★
            </text>
          )}
        </g>
      ))}
      {goal && (
        <g>
          <rect x={r4(px(goal.x) - cell * 0.28)} y={r4(py(goal.y) - cell * 0.28)} width={r4(cell * 0.56)} height={r4(cell * 0.56)} fill="#fff1c2" stroke={INK} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
          <text x={px(goal.x)} y={py(goal.y)} fontSize={r4(cell * 0.3)} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK}>
            ب
          </text>
        </g>
      )}
      {start && (
        <g>
          <circle cx={px(start.x)} cy={py(start.y)} r={r4(cell * 0.3)} fill="#e3edff" stroke={INK} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
          <text x={px(start.x)} y={r4(py(start.y) + cell * 0.48)} fontSize={r4(Math.min(0.3, cell * 0.24))} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} stroke="#efe5d3" strokeWidth={4} paintOrder="stroke" vectorEffect="non-scaling-stroke">
            {goal ? "الف" : "شروع"}
          </text>
        </g>
      )}
      {walker && <WalkerG x={px(walker.at[0])} y={py(walker.at[1])} size={r4(cell * 0.3)} heading={walker.heading} />}
      {corners}
    </g>
  );
}

/** Path of a walk up to fraction f of its length, as grid points (the last may be part way). */
export function partialPath(path: Pt[], f: number): [number, number][] {
  const steps = path.length - 1;
  if (steps <= 0) return path.map((p) => [p.x, p.y]);
  const done = f * steps;
  const whole = Math.floor(done);
  const out: [number, number][] = path.slice(0, Math.min(path.length, whole + 1)).map((p) => [p.x, p.y]);
  if (whole < steps) {
    const a = path[whole];
    const b = path[whole + 1];
    const k = done - whole;
    out.push([r4(a.x + (b.x - a.x) * k), r4(a.y + (b.y - a.y) * k)]);
  }
  return out;
}

export { STEP };

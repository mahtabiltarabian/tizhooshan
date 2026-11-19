"use client";

// Drawing pieces, shadows and see-through sheets. A piece is drawn from its
// own corner list with a pose (where, how far turned, flipped or not), so it
// can glide and turn smoothly. Pieces have their own shapes, so colour is
// only a help.

import { boxOf, optionTris, outline, PIECES, polyTris, type PieceKind, type Pt } from "@/generators/puzzle";

export const INK = "#1f2430";
export const SHADOW = "#5b6170";

const COLORS = ["#ff6b6b", "#4d96ff", "#4cc38a", "#ffc93d", "#b983ff", "#ff9f45", "#3ec1d3"];
export const pieceColor = (i: number) => COLORS[i % COLORS.length];

/** Where a piece is: its own (0, 0) lands at (x, y); turned `a` degrees clockwise; mirrored first when sx is −1. */
export interface Pose {
  x: number;
  y: number;
  a: number;
  /** Horizontal scale, 1 or −1 (in between while flipping). */
  sx: number;
}

export const pathOf = (loops: Pt[][]) => loops.map((l) => `M${l.map((p) => p.join(",")).join(" L")} Z`).join(" ");

/** Middle of a piece's own corners: it turns about this point. */
export function pieceCentre(kind: PieceKind): Pt {
  const p = PIECES[kind].poly;
  return [p.reduce((s, v) => s + v[0], 0) / p.length, p.reduce((s, v) => s + v[1], 0) / p.length];
}

/** A point of the piece's own drawing, placed by a pose. */
export function posePt(pose: Pose, [u, v]: Pt): Pt {
  const x = u * pose.sx;
  const r = (pose.a * Math.PI) / 180;
  return [pose.x + x * Math.cos(r) - v * Math.sin(r), pose.y + x * Math.sin(r) + v * Math.cos(r)];
}

/** Turn a pose about the piece's middle. */
export function turnPose(kind: PieceKind, pose: Pose, by: number): Pose {
  const c = pieceCentre(kind);
  const before = posePt(pose, c);
  const next = { ...pose, a: pose.a + by };
  const after = posePt(next, c);
  return { ...next, x: next.x + before[0] - after[0], y: next.y + before[1] - after[1] };
}

/** Flip a pose left–right about the piece's middle. */
export function flipPose(kind: PieceKind, pose: Pose): Pose {
  const c = pieceCentre(kind);
  const before = posePt(pose, c);
  // Mirroring the world left–right: the turn runs the other way.
  const next = { ...pose, sx: -pose.sx, a: -pose.a };
  const after = posePt(next, c);
  return { ...next, x: next.x + before[0] - after[0], y: next.y + before[1] - after[1] };
}

/** Halfway between two poses, gliding the middle, turning and flipping. */
export function blendPose(kind: PieceKind, from: Pose, to: Pose, t: number): Pose {
  const e = t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
  const c = pieceCentre(kind);
  const [ax, ay] = posePt(from, c);
  const [bx, by] = posePt(to, c);
  // Turn the short way.
  let da = (((to.a - from.a) % 360) + 540) % 360 - 180;
  if (from.sx !== to.sx) da = to.a - from.a;
  const pose: Pose = { x: 0, y: 0, a: from.a + da * e, sx: from.sx + (to.sx - from.sx) * e };
  const [cx, cy] = posePt(pose, c);
  return { ...pose, x: ax + (bx - ax) * e - cx, y: ay + (by - ay) * e - cy };
}

/** Pose of a lattice placement. */
export const poseOf = (p: { k: number; flip: boolean; x: number; y: number }): Pose => ({ x: p.x, y: p.y, a: 90 * p.k, sx: p.flip ? -1 : 1 });

interface PieceProps {
  kind: PieceKind;
  pose: Pose;
  color: string;
  label?: string;
  dashed?: boolean;
  faded?: boolean;
  selected?: boolean;
}

export function PieceG({ kind, pose, color, label, dashed, faded, selected }: PieceProps) {
  const pts = PIECES[kind].poly.map((v) => posePt(pose, v));
  const c = posePt(pose, pieceCentre(kind));
  return (
    <g opacity={faded ? 0.35 : 1}>
      <path
        d={pathOf([pts])}
        fill={color}
        fillOpacity={0.9}
        stroke={selected ? "#1f2430" : INK}
        strokeWidth={selected ? 4 : 2}
        strokeDasharray={dashed ? "6 4" : undefined}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {label && (
        <text x={c[0]} y={c[1]} fontSize={0.42} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} stroke="#fff" strokeWidth={3} paintOrder="stroke" vectorEffect="non-scaling-stroke">
          {label}
        </text>
      )}
    </g>
  );
}

/** A shape (shadow) drawn from its tris, at (x, y). */
export function ShapeG({ ids, x = 0, y = 0, fill = SHADOW, stroke = INK, dashed, guides }: { ids: number[]; x?: number; y?: number; fill?: string; stroke?: string; dashed?: boolean; guides?: Pt[][] }) {
  if (!ids.length) return null;
  return (
    <g transform={x || y ? `translate(${x} ${y})` : undefined}>
      <path d={pathOf(outline(ids))} fill={fill} fillRule="evenodd" stroke={stroke} strokeWidth={2.5} strokeDasharray={dashed ? "6 4" : undefined} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {guides?.map((g, i) => (
        <path key={i} d={pathOf([g])} fill="none" stroke="#fff" strokeOpacity={0.85} strokeWidth={1.5} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
      ))}
    </g>
  );
}

/** Light grid of lattice points behind a shape. */
export function DotGrid({ x0, y0, x1, y1 }: { x0: number; y0: number; x1: number; y1: number }) {
  const dots = [];
  for (let x = Math.ceil(x0); x <= x1; x++) for (let y = Math.ceil(y0); y <= y1; y++) dots.push(<circle key={`${x},${y}`} cx={x} cy={y} r={0.045} fill="#c9bfae" />);
  return <g>{dots}</g>;
}

/** A shape on its own, fitted in a square picture. */
export function ShapeSvg({ ids, size, fill = SHADOW, unit }: { ids: number[]; size: number; fill?: string; unit?: number }) {
  const [x0, y0, x1, y1] = boxOf(ids);
  const s = Math.max(x1 - x0, y1 - y0, unit ?? 0) + 0.6;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return (
    <svg width={size} height={size} viewBox={`${cx - s / 2} ${cy - s / 2} ${s} ${s}`} style={{ direction: "ltr" }}>
      <ShapeG ids={ids} fill={fill} />
    </svg>
  );
}

/** One piece on its own, turned k quarter turns (and flipped). */
export function PieceSvg({ kind, k = 0, flip = false, size, color = pieceColor(0), unit }: { kind: PieceKind; k?: number; flip?: boolean; size: number; color?: string; unit?: number }) {
  return <ShapeSvg ids={optionTris({ kind, k, flip })} size={size} fill={color} unit={unit} />;
}

/** A row of pieces (a set to choose). */
export function PieceRowSvg({ kinds, height, unit = 1 }: { kinds: PieceKind[]; height: number; unit?: number }) {
  const boxes = kinds.map((kind) => {
    const ids = polyTris(PIECES[kind].poly);
    return { ids, box: boxOf(ids) };
  });
  // Left edge of each piece: the widths before it, with gaps.
  const lefts = boxes.map((_, i) => boxes.slice(0, i).reduce((s, b) => s + b.box[2] - b.box[0] + 0.5, 0));
  const w = lefts[lefts.length - 1] + boxes[boxes.length - 1].box[2] - boxes[boxes.length - 1].box[0];
  const h = 2.2 * unit;
  return (
    <svg width={(height * (w + 0.4)) / (h + 0.4)} height={height} viewBox={`-0.2 -0.2 ${w + 0.4} ${h + 0.4}`} style={{ direction: "ltr" }}>
      {boxes.map(({ ids, box }, i) => (
        <ShapeG key={i} ids={ids} x={lefts[i] - box[0]} y={-box[1]} fill={pieceColor(i)} />
      ))}
    </svg>
  );
}

/** A see-through sheet: n×n cells, the marked ones inked. */
export function SheetG({ n, cells, x, y, size, tint, label, sx = 1, a = 0, opacity = 1 }: { n: number; cells: number[]; x: number; y: number; size: number; tint: string; label?: string; sx?: number; a?: number; opacity?: number }) {
  const c = size / n;
  const mid = size / 2;
  return (
    <g transform={`translate(${x + mid} ${y + mid}) rotate(${a}) scale(${sx} 1) translate(${-mid} ${-mid})`} opacity={opacity}>
      <rect x={0} y={0} width={size} height={size} fill={tint} fillOpacity={0.28} stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {Array.from({ length: n - 1 }, (_, i) => (
        <g key={i}>
          <line x1={(i + 1) * c} y1={0} x2={(i + 1) * c} y2={size} stroke="#9a917f" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <line x1={0} y1={(i + 1) * c} x2={size} y2={(i + 1) * c} stroke="#9a917f" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        </g>
      ))}
      {cells.map((i) => (
        <rect key={i} x={(i % n) * c + c * 0.08} y={Math.floor(i / n) * c + c * 0.08} width={c * 0.84} height={c * 0.84} rx={c * 0.08} fill={INK} />
      ))}
      {/* A corner mark shows which way the sheet lies. */}
      <path d={`M0,0 L${c * 0.45},0 L0,${c * 0.45} Z`} fill={INK} fillOpacity={0.5} />
      {label && (
        <text x={mid} y={-c * 0.3} fontSize={c * 0.42} fontWeight={700} textAnchor="middle" fill={INK} transform={sx < 0 ? `translate(${size} 0) scale(-1 1)` : undefined}>
          {label}
        </text>
      )}
    </g>
  );
}

export function SheetSvg({ n, cells, size, tint = "#ffffff" }: { n: number; cells: number[]; size: number; tint?: string }) {
  return (
    <svg width={size} height={size} viewBox={`-0.05 -0.05 ${n + 0.1} ${n + 0.1}`} style={{ direction: "ltr" }}>
      <SheetG n={n} cells={cells} x={0} y={0} size={n} tint={tint} />
    </svg>
  );
}

export const pieceName = (kind: PieceKind) => PIECES[kind].name;

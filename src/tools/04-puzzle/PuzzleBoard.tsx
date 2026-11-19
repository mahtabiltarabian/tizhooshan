"use client";

// Pieces you can move on the board. Drag to move; tap to turn (45° or 90°);
// tap twice quickly to flip. On letting go a piece snaps to the lattice, so
// pieces meet edge to edge. The board also plays pieces gliding into place.

import { useRef, type ReactNode } from "react";
import { Board } from "@/engine-2d/Board";
import { placedTris, type PieceKind, type Pt } from "@/generators/puzzle";
import { DotGrid, flipPose, PieceG, ShapeG, turnPose, type Pose } from "./Pictures";

export interface BoardPiece {
  kind: PieceKind;
  pose: Pose;
  color: string;
  label?: string;
  dashed?: boolean;
  faded?: boolean;
}

export interface BoardTarget {
  ids: number[];
  x: number;
  y: number;
  guides?: Pt[][];
  /** Part left empty and outlined (a gap to fill). */
  hole?: number[];
  fill?: string;
}

interface Props {
  view: [number, number, number, number];
  target?: BoardTarget;
  pieces: BoardPiece[];
  /** Moving is on when this is given. */
  onPose?: (i: number, pose: Pose) => void;
  onSelect?: (i: number) => void;
  selected?: number | null;
  step?: 45 | 90;
  allowFlip?: boolean;
  label: string;
  children?: ReactNode;
}

/** Snap to the lattice: whole cells when square to it, half cells otherwise. */
export function snapPose(pose: Pose): Pose {
  const a = ((Math.round(pose.a / 45) * 45) % 360 + 360) % 360;
  const square = a % 90 === 0;
  const r = square ? 1 : 2;
  return { x: Math.round(pose.x * r) / r, y: Math.round(pose.y * r) / r, a, sx: pose.sx < 0 ? -1 : 1 };
}

/** Tris a piece covers, or null if it is not lying on the lattice. */
export function poseTris(kind: PieceKind, pose: Pose): number[] | null {
  const a = ((Math.round(pose.a) % 360) + 360) % 360;
  if (a % 90 || Math.abs(pose.x - Math.round(pose.x)) > 1e-6 || Math.abs(pose.y - Math.round(pose.y)) > 1e-6) return null;
  return placedTris({ kind, k: a / 90, flip: pose.sx < 0, x: Math.round(pose.x), y: Math.round(pose.y) });
}

export function PuzzleBoard({ view, target, pieces, onPose, onSelect, selected, step = 90, allowFlip = true, label, children }: Props) {
  const drag = useRef<{ i: number; from: Pt; pose: Pose; moved: boolean } | null>(null);
  const lastTap = useRef<{ i: number; at: number; before: Pose } | null>(null);

  const pointAt = (e: React.PointerEvent<SVGGElement>): Pt => {
    const svg = e.currentTarget.ownerSVGElement;
    const ctm = svg?.getScreenCTM();
    if (!ctm) return [0, 0];
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return [p.x, p.y];
  };

  const down = (i: number, e: React.PointerEvent<SVGGElement>) => {
    if (!onPose) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { i, from: pointAt(e), pose: pieces[i].pose, moved: false };
    onSelect?.(i);
  };
  const move = (e: React.PointerEvent<SVGGElement>) => {
    const d = drag.current;
    if (!d || !onPose) return;
    const [x, y] = pointAt(e);
    const [dx, dy] = [x - d.from[0], y - d.from[1]];
    if (!d.moved && Math.hypot(dx, dy) < 0.15) return;
    d.moved = true;
    onPose(d.i, { ...d.pose, x: d.pose.x + dx, y: d.pose.y + dy });
  };
  const up = (e: React.PointerEvent<SVGGElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !onPose) return;
    const kind = pieces[d.i].kind;
    if (d.moved) {
      const [x, y] = pointAt(e);
      onPose(d.i, snapPose({ ...d.pose, x: d.pose.x + x - d.from[0], y: d.pose.y + y - d.from[1] }));
      return;
    }
    // A tap turns; a second quick tap undoes that turn and flips instead.
    const now = e.timeStamp;
    const t = lastTap.current;
    if (allowFlip && t && t.i === d.i && now - t.at < 350) {
      lastTap.current = null;
      onPose(d.i, snapPose(flipPose(kind, t.before)));
      return;
    }
    lastTap.current = { i: d.i, at: now, before: d.pose };
    onPose(d.i, snapPose(turnPose(kind, d.pose, step)));
  };

  // The selected piece is drawn last, on top.
  const order = pieces.map((_, i) => i).filter((i) => i !== selected);
  if (selected !== null && selected !== undefined && pieces[selected]) order.push(selected);

  const [vx, vy, vw, vh] = view;
  return (
    <Board view={view} imageName="puzzle" label={label}>
      <DotGrid x0={vx} y0={vy} x1={vx + vw} y1={vy + vh} />
      {target && (
        <>
          <ShapeG ids={target.ids.filter((id) => !target.hole?.includes(id))} x={target.x} y={target.y} fill={target.fill} guides={target.guides} />
          {target.hole && <ShapeG ids={target.hole} x={target.x} y={target.y} fill="#ffffff" stroke="#c0392b" dashed />}
        </>
      )}
      {children}
      {order.map((i) => {
        const p = pieces[i];
        return (
          <g
            key={i}
            onPointerDown={(e) => down(i, e)}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={() => (drag.current = null)}
            style={onPose ? { cursor: "grab", touchAction: "none" } : undefined}
          >
            <PieceG kind={p.kind} pose={p.pose} color={p.color} label={p.label} dashed={p.dashed} faded={p.faded} selected={onPose ? i === selected : false} />
          </g>
        );
      })}
    </Board>
  );
}

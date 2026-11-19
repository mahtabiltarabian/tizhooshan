// Where things go on the puzzle board: the shadow on the right, a tray of
// pieces on the left (the board reads right to left, shadow first).

import { boxOf, PIECES, placedPoly, type PieceKind, type Placement, type Pt } from "@/generators/puzzle";
import { posePt, type Pose } from "./Pictures";

export const VIEW: [number, number, number, number] = [0, 0, 24, 13];
const TRAY = { x0: 0.6, x1: 11, y0: 0.8 };

/** A closer board for fewer, smaller pieces. */
export const SMALL_VIEW: [number, number, number, number] = [0, 0, 20, 11];
export const SMALL_SPOT: [number, number] = [14.2, 5.5];
export const SMALL_TRAY: [number, number, number] = [0.6, 8.6, 0.8];

/** Whole-cell offset that centres a shape in the right half. */
export function targetSpot(ids: number[], cx = 17.6, cy = 6.5): Pt {
  const [x0, y0, x1, y1] = boxOf(ids);
  return [Math.round(cx - (x0 + x1) / 2), Math.round(cy - (y0 + y1) / 2)];
}

/** Pieces laid out on shelves in the tray, each turned as given. */
export function trayPoses(items: { kind: PieceKind; k?: number; flip?: boolean }[], x0 = TRAY.x0, x1 = TRAY.x1, y0 = TRAY.y0): Pose[] {
  // Whole cells only, so pieces stay on the lattice; a free cell between pieces.
  let x = Math.ceil(x0);
  let y = Math.ceil(y0);
  let row = 0;
  return items.map(({ kind, k = 0, flip = false }) => {
    const pose: Pose = { x: 0, y: 0, a: 90 * k, sx: flip ? -1 : 1 };
    const pts = PIECES[kind].poly.map((v) => posePt(pose, v));
    const [minX, minY] = [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1]))];
    const [w, h] = [Math.ceil(Math.max(...pts.map((p) => p[0])) - minX - 1e-9), Math.ceil(Math.max(...pts.map((p) => p[1])) - minY - 1e-9)];
    if (x + w > x1 && x > Math.ceil(x0)) {
      x = Math.ceil(x0);
      y += row + 1;
      row = 0;
    }
    const placed = { ...pose, x: Math.round(x - minX), y: Math.round(y - minY) };
    x += w + 1;
    row = Math.max(row, h);
    return placed;
  });
}

/** A lattice placement moved onto the board. */
export const movePlacement = (p: Placement, [dx, dy]: Pt): Placement => ({ ...p, x: p.x + dx, y: p.y + dy });

/** Guide lines: every piece's outline in the solution. */
export const guidesOf = (solution: Placement[]) => solution.map(placedPoly);

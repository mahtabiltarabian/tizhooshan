// Transforms used by the 3D net. Kept apart from the React component so a
// test can rebuild the same object tree and check it against the question
// model in cube-questions.ts.

import type { Dir } from "@/generators/cube-nets";

export type Triple = [number, number, number];

export const DIR_STEP: Record<Dir, [number, number]> = {
  "+x": [1, 0],
  "-x": [-1, 0],
  "+y": [0, 1],
  "-y": [0, -1],
};

/**
 * A child face hangs off its parent: a hinge group on the shared edge,
 * turned by `angle` (0 = flat, π/2 = folded down), then the face centre one
 * half-step further out.
 */
export function hinge(dir: Dir, angle: number): { position: Triple; rotation: Triple; offset: Triple } {
  const [dx, dy] = DIR_STEP[dir];
  // Fold downward (toward -z): positive turn about y for +x, negative about x for +y.
  const rotation: Triple = dx ? [0, dx * angle, 0] : [-dy * angle, 0, 0];
  return { position: [dx * 0.5, dy * 0.5, 0], rotation, offset: [dx * 0.5, dy * 0.5, 0] };
}

/** Net space (x right, y up, z out of the paper) to world space (y up). */
export const NET_TO_WORLD: Triple = [-Math.PI / 2, 0, 0];

/** Rotation of a label on its face for `turns` counter-clockwise quarter turns. */
export const labelRotation = (turns: number): Triple => [0, 0, (turns * Math.PI) / 2];

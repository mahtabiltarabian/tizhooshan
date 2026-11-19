"use client";

// A cube net that folds into a cube as `t` goes from 0 (flat) to 1 (closed).
// The flat net floats one unit above the table with its printed side up;
// faces fold downward, so what you see on the flat net is the outside of
// the cube, as on paper. Shapes that are not nets fold too, so the faces
// that collide can be seen.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { CanvasTexture } from "three";
import { foldNet, pickRoot, type Cell } from "@/generators/cube-nets";
import { roundedBox } from "@/engine-3d/roundedBox";
import { labelTexture } from "./faceTexture";
import { hinge, labelRotation, NET_TO_WORLD } from "./foldGeometry";

export const FACE_COLORS = ["#ff6b6b", "#ffc93d", "#4cc38a", "#4d96ff", "#b983ff", "#ff9f45"];

interface FoldingNetProps {
  cells: readonly Cell[];
  /** 0 = flat, 1 = closed cube. */
  t: number;
  /** One label per cell, in `cells` order. */
  labels: string[];
  /** Indices into `cells` drawn hatched (faces that collide). */
  marked?: readonly number[];
  /** One colour per cell; defaults to the toy palette by cell index. */
  colors?: readonly string[];
  /** Fold one face after another (breadth-first from the middle) instead of all at once. */
  sequential?: boolean;
  /** Counter-clockwise quarter turns of each label on the flat net. */
  turns?: readonly number[];
  /** "dark": dark symbols for pale exam-style faces. */
  ink?: "light" | "dark";
}

/** Number of hinge folds in a net: every face except the root. */
export const FOLD_STEPS = 5;

const SIZE = 0.94;
const THICK = 0.07;

export function FoldingNet({ cells, t, labels, marked = [], colors, sequential = false, turns, ink = "light" }: FoldingNetProps) {
  const fold = useMemo(() => (cells.length ? foldNet(cells, pickRoot(cells)) : null), [cells]);
  const markedKey = marked.join(",");

  // Textures need the bundled font loaded before drawing to canvas.
  const [textures, setTextures] = useState<CanvasTexture[] | null>(null);
  useEffect(() => {
    let alive = true;
    let made: CanvasTexture[] = [];
    const warn = new Set(markedKey ? markedKey.split(",").map(Number) : []);
    document.fonts.load("700 140px Vazirmatn").finally(() => {
      if (!alive) return;
      made = labels.map((l, i) => labelTexture(l, warn.has(i), ink));
      setTextures(made);
    });
    return () => {
      alive = false;
      made.forEach((tex) => tex.dispose());
    };
  }, [labels, markedKey, ink]);

  const children = useMemo(() => {
    const map = new Map<number, number[]>();
    fold?.faces.forEach((f, i) => {
      if (f.parent >= 0) map.set(f.parent, [...(map.get(f.parent) ?? []), i]);
    });
    return map;
  }, [fold]);

  if (!fold) return null;

  const cellIndex = (c: Cell) => cells.findIndex((x) => x[0] === c[0] && x[1] === c[1]);

  // Slide the whole net so it stays centred while flat and ends with the cube centred.
  const xs = cells.map((c) => c[0]);
  const ys = cells.map((c) => c[1]);
  const netCenter = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  const root = fold.faces[0].cell;
  const ox = netCenter[0] + (root[0] - netCenter[0]) * t;
  const oy = netCenter[1] + (root[1] - netCenter[1]) * t;
  // Face i (breadth-first order, root = 0) folds during step i when sequential.
  const angleOf = (i: number) => {
    const amount = sequential ? Math.min(1, Math.max(0, t * FOLD_STEPS - (i - 1))) : t;
    return (amount * Math.PI) / 2;
  };

  const tile = (idx: number) => (
    <>
      <mesh geometry={roundedBox(SIZE, SIZE, THICK, 0.03, 3)} position={[0, 0, -THICK / 2]} castShadow>
        <meshStandardMaterial color={colors?.[idx] ?? FACE_COLORS[idx % FACE_COLORS.length]} roughness={0.45} />
      </mesh>
      {textures?.[idx] && (
        <mesh position={[0, 0, 0.002]} rotation={labelRotation(turns?.[idx] ?? 0)}>
          <planeGeometry args={[SIZE * 0.8, SIZE * 0.8]} />
          <meshBasicMaterial map={textures[idx]} transparent depthWrite={false} />
        </mesh>
      )}
    </>
  );

  const renderFace = (i: number): ReactNode => {
    const f = fold.faces[i];
    const face = (
      <>
        {tile(cellIndex(f.cell))}
        {(children.get(i) ?? []).map(renderFace)}
      </>
    );

    if (!f.dir) return <group key={i} position={[root[0] - ox, root[1] - oy, 0]}>{face}</group>;

    const h = hinge(f.dir, angleOf(i));
    return (
      <group key={i} position={h.position} rotation={h.rotation}>
        <group position={h.offset}>{face}</group>
      </group>
    );
  };

  // Squares not joined to the rest stay flat where they were drawn.
  const reached = new Set(fold.faces.map((f) => cellIndex(f.cell)));
  const loose = cells.map((_, i) => i).filter((i) => !reached.has(i));

  // Net space (x right, y up, z out of the paper) to world (y up): lay it on the table at height 1.
  return (
    <group rotation={NET_TO_WORLD} position={[0, 1, 0]}>
      {renderFace(0)}
      {loose.map((i) => (
        <group key={`loose-${i}`} position={[cells[i][0] - ox, cells[i][1] - oy, 0]}>
          {tile(i)}
        </group>
      ))}
    </group>
  );
}

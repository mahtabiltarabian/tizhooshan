"use client";

// A die on a board, rolling along a path. `progress` runs from 0 (at the
// start) to path.length (at the end); a fractional value tips the die over
// its bottom edge. Model coordinates (x right, y away, z up) map to world
// (x, z, -y). Each face shows its pips and its number; after every roll a
// label above the die says which number is on top.

import { useEffect, useMemo, useState } from "react";
import { CanvasTexture, MeshStandardMaterial, SRGBColorSpace } from "three";
import type { Cell } from "@/generators/cube-nets";
import { DIR_STEP, rollStates, type DieState, type Dir } from "@/generators/dice";
import { textTexture } from "@/engine-3d/textTexture";
import { fa } from "@/tools/registry";
import { PIPS } from "./DiceSvg";

const SIZE = 0.86;
const INK = "#1f2430";

/** Face texture: pips, and the number in a corner. */
function pipTexture(n: number): CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fffaf0";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = INK;
  for (const [x, y] of PIPS[n]) {
    ctx.beginPath();
    ctx.arc(size / 2 + x * size * 0.36, size / 2 + y * size * 0.36, size * 0.075, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = `700 ${size * 0.2}px Vazirmatn, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(fa(n), size * 0.86, size * 0.87);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

interface DieSceneProps {
  start: DieState;
  path: readonly Dir[];
  from: Cell;
  w: number;
  d: number;
  /** 0 … path.length; fractions are mid-roll. */
  progress: number;
  /** Draw the path's arrows on the board. */
  showPath?: boolean;
  /** Write "بالا: n" above the die when it is not rolling. */
  topLabel?: boolean;
}

export function DieScene({ start, path, from, w, d, progress, showPath = true, topLabel = true }: DieSceneProps) {
  const [tex, setTex] = useState<{ pips: CanvasTexture[]; arrow: CanvasTexture; end: CanvasTexture } | null>(null);
  useEffect(() => {
    let alive = true;
    let made: { pips: CanvasTexture[]; arrow: CanvasTexture; end: CanvasTexture } | null = null;
    document.fonts.load("700 60px Vazirmatn").finally(() => {
      if (!alive) return;
      made = { pips: [1, 2, 3, 4, 5, 6].map(pipTexture), arrow: textTexture("→", 128, 128), end: textTexture("پایان") };
      setTex(made);
    });
    return () => {
      alive = false;
      if (made) [...made.pips, made.arrow, made.end].forEach((t) => t.dispose());
    };
  }, []);

  const states = useMemo(() => rollStates(start, path), [start, path]);
  const cells = useMemo(() => {
    const out: Cell[] = [from];
    for (const dir of path) {
      const [x, y] = out[out.length - 1];
      out.push([x + DIR_STEP[dir][0], y + DIR_STEP[dir][1]]);
    }
    return out;
  }, [from, path]);

  const k = Math.min(path.length, Math.max(0, Math.floor(progress)));
  const f = k < path.length ? Math.min(1, Math.max(0, progress - k)) : 0;
  const state = states[k];
  const cx = (w - 1) / 2;
  const cy = (d - 1) / 2;
  const at = ([x, y]: Cell): [number, number, number] => [x - cx, 0, -(y - cy)];

  const topText = useMemo(() => (tex ? textTexture(`بالا: ${fa(state.top)}`) : null), [tex, state.top]);
  useEffect(() => () => topText?.dispose(), [topText]);

  // One material per number, shared; box faces: +x (east), -x (west), +y (top), -y (bottom), +z (front, toward us), -z (back).
  const mats = useMemo(() => [1, 2, 3, 4, 5, 6].map((n) => new MeshStandardMaterial({ color: "#ffffff", map: tex?.pips[n - 1] ?? null, roughness: 0.5 })), [tex]);
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  const material = [state.east, state.west, state.top, state.bottom, state.south, state.north].map((n) => mats[n - 1]);

  const [px, , pz] = at(cells[k]);
  const dir = f > 0 ? path[k] : null;
  const [dx, dy] = dir ? DIR_STEP[dir] : [0, 0];
  // World direction of the roll and the turn about the bottom edge.
  const wx = dx;
  const wz = -dy;
  const angle = (f * Math.PI) / 2;
  const rotation: [number, number, number] = dir ? (dx ? [0, 0, -dx * angle] : [-dy * angle, 0, 0]) : [0, 0, 0];
  const half = SIZE / 2;
  const scale = Math.min(0.9, 3.8 / Math.max(w, d));

  return (
    <group scale={scale}>
      {Array.from({ length: w * d }, (_, i) => {
        const x = i % w;
        const y = Math.floor(i / w);
        const onPath = showPath && cells.some((c) => c[0] === x && c[1] === y);
        return (
          <mesh key={i} position={[x - cx, 0.01, -(y - cy)]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[0.97, 0.97]} />
            <meshStandardMaterial color={onPath ? "#ffe49a" : (x + y) % 2 ? "#f7efe0" : "#efe3cc"} />
          </mesh>
        );
      })}

      {showPath &&
        tex &&
        path.map((p, i) => {
          const [x, , z] = at(cells[i]);
          const turn = { E: 0, N: Math.PI / 2, W: Math.PI, S: -Math.PI / 2 }[p];
          // Arrows sit between this cell and the next, so the die never hides them all.
          return (
            <mesh key={`a${i}`} position={[x + DIR_STEP[p][0] * 0.5, 0.015, z - DIR_STEP[p][1] * 0.5]} rotation={[-Math.PI / 2, 0, turn]}>
              <planeGeometry args={[0.5, 0.5]} />
              <meshBasicMaterial map={tex.arrow} transparent depthWrite={false} />
            </mesh>
          );
        })}

      {showPath && tex && path.length > 0 && (
        <mesh position={[at(cells[cells.length - 1])[0], 0.016, at(cells[cells.length - 1])[2] + 0.36]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.8, 0.2]} />
          <meshBasicMaterial map={tex.end} transparent depthWrite={false} />
        </mesh>
      )}

      {/* Pivot on the bottom edge the die tips over. */}
      <group position={[px + wx * half, 0, pz + wz * half]} rotation={rotation}>
        <group position={[-wx * half, half + 0.01, -wz * half]}>
          <mesh material={material} castShadow>
            <boxGeometry args={[SIZE, SIZE, SIZE]} />
          </mesh>
        </group>
      </group>

      {topLabel && f === 0 && topText && (
        <sprite position={[px, SIZE + 0.5, pz]} scale={[1.7 / scale, 0.42 / scale, 1]} renderOrder={10}>
          <spriteMaterial map={topText} depthTest={false} transparent />
        </sprite>
      )}
    </group>
  );
}

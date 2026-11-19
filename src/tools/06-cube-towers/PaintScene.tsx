"use client";

// "Paint and cut": an n×n×n cube painted on the outside, cut into small
// cubes. Pulling it apart shows how many small cubes have 0, 1, 2 or 3
// painted faces. Painted faces are dark blue, unpainted faces cream, so the
// difference is clear without colour vision (light vs dark).

import { useMemo } from "react";
import { MeshStandardMaterial } from "three";
import { paintedFaces } from "@/generators/cube-towers";

const PAINT = "#2f5fd0";
const RAW = "#fff4dc";

interface PaintSceneProps {
  n: number;
  /** 0 = whole cube, 1 = pulled apart. */
  explode: number;
  /** Only cubes with this many painted faces stay solid; the rest fade. */
  focus?: number | null;
}

export function PaintScene({ n, explode, focus = null }: PaintSceneProps) {
  const size = 0.98;
  const gap = 1 + explode * 0.9;
  const mid = (n - 1) / 2;

  // Two materials per opacity level, shared by all cubes.
  const mats = useMemo(() => {
    const make = (color: string, faded: boolean) =>
      new MeshStandardMaterial({ color, roughness: 0.5, transparent: faded, opacity: faded ? 0.12 : 1, depthWrite: !faded });
    return { paint: make(PAINT, false), raw: make(RAW, false), paintFaded: make(PAINT, true), rawFaded: make(RAW, true) };
  }, []);

  const cubes = useMemo(() => {
    const list: { x: number; y: number; z: number; k: number }[] = [];
    for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) for (let z = 0; z < n; z++) list.push({ x, y, z, k: paintedFaces(n, x, y, z) });
    return list;
  }, [n]);

  const scale = Math.min(1, 3.2 / (n * gap));

  return (
    <group scale={scale} position={[0, (n * gap * scale) / 2, 0]}>
      {cubes.map(({ x, y, z, k }) => {
        const faded = focus !== null && k !== focus;
        const paint = faded ? mats.paintFaded : mats.paint;
        const raw = faded ? mats.rawFaded : mats.raw;
        // Box faces: +x, -x, +y(up), -y(down), +z(toward viewer = model -y), -z.
        const material = [
          x === n - 1 ? paint : raw,
          x === 0 ? paint : raw,
          z === n - 1 ? paint : raw,
          z === 0 ? paint : raw,
          y === 0 ? paint : raw,
          y === n - 1 ? paint : raw,
        ];
        return (
          <mesh key={`${x},${y},${z}`} position={[(x - mid) * gap, (z - mid) * gap, -(y - mid) * gap]} material={material} castShadow>
            <boxGeometry args={[size, size, size]} />
          </mesh>
        );
      })}
    </group>
  );
}

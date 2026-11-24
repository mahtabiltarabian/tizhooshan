"use client";

// A tower of cubes on a board. Model coordinates (x right, y away from the
// viewer, z up) map to world coordinates (x, z, -y), centred on the board.
// Cubes are coloured by layer; hidden cubes can be striped; layers can be
// pulled apart to count them; taps report which column was touched.

import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { BoxGeometry, EdgesGeometry, type CanvasTexture } from "three";
import { isHidden, type Tower } from "@/generators/cube-towers";
import { hatchTexture, textTexture } from "@/engine-3d/textTexture";
import { roundedBox } from "@/engine-3d/roundedBox";

export const LAYER_COLORS = ["#4d96ff", "#ffc93d", "#4cc38a", "#ff6b6b", "#b983ff"];
const SIZE = 0.96;

export type ColumnTap = { x: number; y: number; z: number | null; side: [number, number] | null };

interface TowerSceneProps {
  tower: Tower;
  /** 0 = stacked, 1 = layers pulled apart. */
  explode?: number;
  /** Stripe the cubes nobody can see. */
  showHidden?: boolean;
  /** Translucent cubes (e.g. the ones still missing from a big cube). */
  ghosts?: [number, number, number][];
  /** Draw the outline of an n×n×n cube on the board. */
  frame?: number;
  /** Called on a tap (not a drag) on a cube or a board square. */
  onTap?: (tap: ColumnTap) => void;
  /** Show "روبرو" and "کنار" on the board edges. */
  labels?: boolean;
}

export function TowerScene({ tower, explode = 0, showHidden = false, ghosts = [], frame, onTap, labels = true }: TowerSceneProps) {
  const { w, d } = tower;
  const cx = (w - 1) / 2;
  const cy = (d - 1) / 2;
  const at = (x: number, y: number, z: number): [number, number, number] => [x - cx, z + 0.5 + z * explode * 1.1, -(y - cy)];

  const [tex, setTex] = useState<{ front: CanvasTexture; side: CanvasTexture; hatch: CanvasTexture } | null>(null);
  useEffect(() => {
    let alive = true;
    let made: { front: CanvasTexture; side: CanvasTexture; hatch: CanvasTexture } | null = null;
    document.fonts.load("700 60px Vazirmatn").finally(() => {
      if (!alive) return;
      made = { front: textTexture("روبرو ↓"), side: textTexture("کنار →"), hatch: hatchTexture() };
      setTex(made);
    });
    return () => {
      alive = false;
      if (made) Object.values(made).forEach((t) => t.dispose());
    };
  }, []);

  const frameEdges = useMemo(() => (frame ? new EdgesGeometry(new BoxGeometry(frame, frame, frame)) : null), [frame]);
  useEffect(() => () => frameEdges?.dispose(), [frameEdges]);

  const cubes = useMemo(() => {
    const list: { x: number; y: number; z: number; hidden: boolean }[] = [];
    tower.h.forEach((row, y) => row.forEach((h, x) => {
      for (let z = 0; z < h; z++) list.push({ x, y, z, hidden: isHidden(tower, x, y, z) });
    }));
    return list;
  }, [tower]);

  // Taps, not drags: a drag rotates the camera.
  const tap = (e: ThreeEvent<MouseEvent>, x: number, y: number, z: number | null) => {
    if (!onTap || e.delta > 6) return;
    e.stopPropagation();
    let side: [number, number] | null = null;
    const n = e.face?.normal;
    if (z !== null && n && Math.abs(n.y) < 0.5) {
      side = Math.abs(n.x) > Math.abs(n.z) ? [Math.sign(n.x), 0] : [0, -Math.sign(n.z)];
    }
    onTap({ x, y, z, side });
  };

  return (
    <group>
      {/* Board */}
      {Array.from({ length: w * d }, (_, i) => {
        const x = i % w;
        const y = Math.floor(i / w);
        return (
          <mesh key={`b${i}`} position={[x - cx, 0.01, -(y - cy)]} rotation={[-Math.PI / 2, 0, 0]} onClick={(e) => tap(e, x, y, null)} receiveShadow>
            <planeGeometry args={[0.97, 0.97]} />
            <meshStandardMaterial color={(x + y) % 2 ? "#f7efe0" : "#efe3cc"} />
          </mesh>
        );
      })}

      {labels && tex && (
        <>
          <mesh position={[0, 0.012, cy + 1.05]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.6, 0.4]} />
            <meshBasicMaterial map={tex.front} transparent depthWrite={false} />
          </mesh>
          <mesh position={[cx + 1.05, 0.012, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
            <planeGeometry args={[1.6, 0.4]} />
            <meshBasicMaterial map={tex.side} transparent depthWrite={false} />
          </mesh>
        </>
      )}

      {/* Cubes */}
      {cubes.map(({ x, y, z, hidden }) => {
        const striped = showHidden && hidden;
        return (
          <mesh
            key={`${x},${y},${z}`}
            geometry={roundedBox(SIZE, SIZE, SIZE, 0.06, 3)}
            position={at(x, y, z)}
            castShadow
            onClick={(e) => tap(e, x, y, z)}
          >
            <meshStandardMaterial
              color={striped ? "#ffffff" : LAYER_COLORS[z % LAYER_COLORS.length]}
              map={striped && tex ? tex.hatch : null}
              roughness={0.45}
            />
          </mesh>
        );
      })}

      {/* Ghost cubes */}
      {ghosts.map(([x, y, z]) => (
        <mesh key={`g${x},${y},${z}`} position={at(x, y, z)}>
          <boxGeometry args={[SIZE * 0.92, SIZE * 0.92, SIZE * 0.92]} />
          <meshStandardMaterial color="#4f46e5" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      ))}

      {/* Outline of the big cube */}
      {frameEdges && frame && (
        <lineSegments geometry={frameEdges} position={[(frame - 1) / 2 - cx, frame / 2, -((frame - 1) / 2 - cy)]}>
          <lineBasicMaterial color="#0f172a" />
        </lineSegments>
      )}
    </group>
  );
}

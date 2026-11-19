"use client";

import type { Tower, ViewPicture } from "@/generators/cube-towers";
import { fa } from "@/tools/registry";
import styles from "./Pictures.module.css";

const INK = "#1f2430";

/**
 * One view as exam sheets draw it: front and side as columns of squares,
 * top as the footprint with the front row at the bottom.
 */
export function ViewSvg({ pic, size = 110, label }: { pic: ViewPicture; size?: number; label?: string }) {
  const cols = pic.kind === "top" ? pic.cells[0].length : pic.heights.length;
  const rows = pic.kind === "top" ? pic.cells.length : Math.max(1, ...pic.heights);
  const u = Math.min(size / cols, size / rows);
  const w = cols * u;
  const h = rows * u;
  const ox = (size - w) / 2;
  const oy = (size - h) / 2;
  const squares: [number, number][] = [];
  if (pic.kind === "top") pic.cells.forEach((row, y) => row.forEach((f, x) => f && squares.push([x, rows - 1 - y])));
  else pic.heights.forEach((ht, x) => { for (let z = 0; z < ht; z++) squares.push([x, rows - 1 - z]); });

  return (
    <svg className={styles.svg} width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
      {/* faint grid */}
      {Array.from({ length: cols * rows }, (_, i) => (
        <rect key={`g${i}`} x={ox + (i % cols) * u} y={oy + Math.floor(i / cols) * u} width={u} height={u} fill="none" stroke="#d9d0bf" strokeWidth={1} />
      ))}
      {squares.map(([x, y]) => (
        <rect key={`${x},${y}`} x={ox + x * u + 1} y={oy + y * u + 1} width={u - 2} height={u - 2} fill="#cfe0ff" stroke={INK} strokeWidth={1.6} />
      ))}
      {pic.kind === "cols" && <line x1={ox - 4} x2={ox + w + 4} y1={oy + h} y2={oy + h} stroke={INK} strokeWidth={2.5} />}
    </svg>
  );
}

// Isometric picture of a tower from the front-right corner (+x, -y, +z), same corner as the 3D camera.
const C = Math.cos(Math.PI / 6);
const S = 0.5;
const scr = (x: number, y: number, z: number): [number, number] => [C * (x + y), S * (x - y) - z];

export function IsoTower({ tower, size = 180 }: { tower: Tower; size?: number }) {
  const cubes: [number, number, number][] = [];
  tower.h.forEach((row, y) => row.forEach((ht, x) => { for (let z = 0; z < ht; z++) cubes.push([x, y, z]); }));
  // Painter's order: far to near along the view direction (+x, -y, +z).
  cubes.sort((a, b) => a[0] - a[1] + a[2] - (b[0] - b[1] + b[2]));

  const maxZ = Math.max(1, ...tower.h.flat());
  const pts = [scr(0, 0, 0), scr(tower.w, 0, 0), scr(0, tower.d, 0), scr(tower.w, tower.d, 0), scr(0, tower.d, maxZ), scr(tower.w, 0, maxZ)];
  const minX = Math.min(...pts.map((p) => p[0]));
  const maxX = Math.max(...pts.map((p) => p[0]));
  const minY = Math.min(...pts.map((p) => p[1]), scr(0, tower.d, maxZ)[1]);
  const maxY = Math.max(...pts.map((p) => p[1]));
  const k = Math.min(size / (maxX - minX + 0.6), size / (maxY - minY + 0.6));
  const P = (x: number, y: number, z: number) => {
    const [a, b] = scr(x, y, z);
    return `${(a - minX + 0.3) * k},${(b - minY + 0.3) * k}`;
  };
  const poly = (corners: [number, number, number][]) => corners.map((c) => P(...c)).join(" ");

  return (
    <svg className={styles.svg} width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="تصویر برج">
      {/* board */}
      <polygon points={poly([[0, 0, 0], [tower.w, 0, 0], [tower.w, tower.d, 0], [0, tower.d, 0]])} fill="#f3ead8" stroke="#bfb29b" strokeWidth={1} />
      {cubes.map(([x, y, z]) => (
        <g key={`${x},${y},${z}`} stroke={INK} strokeWidth={1.3} strokeLinejoin="round">
          <polygon points={poly([[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]])} fill="#ffffff" />
          <polygon points={poly([[x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x + 1, y, z + 1]])} fill="#c9c2b4" />
          <polygon points={poly([[x, y, z], [x + 1, y, z], [x + 1, y, z + 1], [x, y, z + 1]])} fill="#e6dfd0" />
        </g>
      ))}
    </svg>
  );
}

/**
 * Height map: one square per board position with its height. Tap to add a
 * cube, or (in remove mode) to take one away. Front row at the bottom.
 */
export function HeightGrid({
  tower,
  maxH,
  remove = false,
  onChange,
}: {
  tower: Tower;
  maxH: number;
  remove?: boolean;
  onChange?: (x: number, y: number, h: number) => void;
}) {
  return (
    <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${tower.w}, minmax(0, 1fr))` }} role="grid" aria-label="نقشه ارتفاع">
      {[...tower.h].map((_, ry) => {
        const y = tower.d - 1 - ry;
        return tower.h[y].map((ht, x) => (
          <button
            key={`${x},${y}`}
            role="gridcell"
            className={ht ? styles.filled : ""}
            disabled={!onChange}
            aria-label={`ستون ${fa(x + 1)}، ردیف ${fa(y + 1)}: ${fa(ht)} مکعب`}
            onClick={() => onChange?.(x, y, remove ? Math.max(0, ht - 1) : Math.min(maxH, ht + 1))}
          >
            {ht ? fa(ht) : ""}
          </button>
        ));
      })}
    </div>
  );
}

import type { Vec3 } from "@/generators/cube-nets";
import { SLOT_NORMALS, SLOTS, type CubeView, type Slot } from "@/generators/cube-questions";

// Isometric picture of a cube seen from (+x, -y, +z): top, front-right (+x)
// and front-left (-y) faces, the same corner the 3D stage camera shows.

const C = Math.cos(Math.PI / 6);
const S = 0.5;
/** 3D point to 2D screen (SVG y points down). */
const screen = ([x, y, z]: Vec3): [number, number] => [C * x + C * y, S * x - S * y - z];

const SHADE: Record<Slot, string> = { top: "#fffaf0", right: "#f1e6d2", left: "#e6d7bd" };

const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

interface IsoCubeProps {
  view: CubeView;
  size?: number;
}

export function IsoCube({ view, size = 120 }: IsoCubeProps) {
  // Unit cube with half-size 1 fits in about ±2 screen units.
  const k = size / 4.4;
  const o = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      {SLOTS.map((slot) => {
        const n = SLOT_NORMALS[slot];
        const { symbol, up } = view[slot];
        const right = cross(up, n);
        const [cx, cy] = screen(n);
        const [rx, ry] = screen(right);
        const [ux, uy] = screen(up);
        // Face-local square -1..1 (x = right, svg y = down = -up) onto the screen.
        const matrix = `matrix(${k * rx} ${k * ry} ${-k * ux} ${-k * uy} ${o + k * cx} ${o + k * cy})`;
        return (
          <g key={slot} transform={matrix}>
            <rect x={-1} y={-1} width={2} height={2} fill={SHADE[slot]} stroke="#0f172a" strokeWidth={0.05} strokeLinejoin="round" />
            <text x={0} y={0.42} textAnchor="middle" fontSize={1.25} fontWeight={700} fill="#0f172a" fontFamily="Vazirmatn, sans-serif">
              {symbol}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

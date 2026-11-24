// A small two-tone picture for each tool on the main page, in its area's
// colours. Decorative only: the card always shows the number and name too.

import type { Area } from "@/tools/registry";

interface Ink {
  /** Lines. */
  k: string;
  /** Soft fill. */
  f: string;
  /** Stronger accent fill. */
  a: string;
}

export const AREA_INK: Record<Area, Ink & { bg: string }> = {
  visual: { k: "#3730a3", f: "#c7d2fe", a: "#818cf8", bg: "#eef2ff" },
  computational: { k: "#92400e", f: "#fde68a", a: "#f59e0b", bg: "#fffbeb" },
  logical: { k: "#6b21a8", f: "#e9d5ff", a: "#c084fc", bg: "#faf5ff" },
  speed: { k: "#9f1239", f: "#fecdd3", a: "#fb7185", bg: "#fff1f2" },
};

/** A gear outline: `teeth` flat-topped teeth around a circle. */
function gear(cx: number, cy: number, r: number, teeth: number) {
  const pts: string[] = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const at = (rad: number, t: number) =>
      `${(cx + rad * Math.cos(a + t * step)).toFixed(2)},${(cy + rad * Math.sin(a + t * step)).toFixed(2)}`;
    pts.push(at(r, 0), at(r + 4, 0.15), at(r + 4, 0.45), at(r, 0.6));
  }
  return `M${pts.join("L")}Z`;
}

const T = ({ x, y, c, s = 9 }: { x: number; y: number; c: string; s?: number }) => (
  <text x={x} y={y} fill="currentColor" stroke="none" fontSize={s} fontWeight={700} textAnchor="middle" fontFamily="Vazirmatn, sans-serif">
    {c}
  </text>
);

function draw(id: number, c: Ink) {
  switch (id) {
    case 1: // Mirror: a flag and its reflection.
      return (
        <>
          <line x1="32" y1="8" x2="32" y2="56" strokeDasharray="4 4" />
          <path d="M14 46V16l12 7-12 7" fill={c.a} />
          <path d="M50 46V16l-12 7 12 7" fill={c.f} />
        </>
      );
    case 2: // Folded paper with punched holes.
      return (
        <>
          <path d="M12 12h40v26L38 52H12z" fill="#fff" />
          <path d="M52 38H38v14" fill={c.f} />
          <circle cx="24" cy="24" r="4" fill={c.a} />
          <circle cx="38" cy="24" r="4" fill={c.a} />
          <circle cx="24" cy="38" r="4" fill={c.a} />
        </>
      );
    case 3: // 3×3 pattern with a missing cell.
      return (
        <>
          <rect x="10" y="10" width="44" height="44" rx="4" fill="#fff" />
          <path d="M24.7 10v44M39.3 10v44M10 24.7h44M10 39.3h44" />
          <circle cx="17.3" cy="17.3" r="3.5" fill={c.a} />
          <rect x="28.5" y="13.8" width="7" height="7" fill={c.a} />
          <path d="M46.6 13.5l4 7.5h-8z" fill={c.a} />
          <circle cx="17.3" cy="32" r="3.5" fill={c.f} />
          <rect x="28.5" y="28.5" width="7" height="7" fill={c.f} />
          <path d="M46.6 28.2l4 7.5h-8z" fill={c.f} />
          <circle cx="17.3" cy="46.6" r="3.5" fill={c.a} />
          <rect x="28.5" y="43.1" width="7" height="7" fill={c.a} />
          <T x={46.6} y={50.5} c="؟" s={11} />
        </>
      );
    case 4: // Puzzle piece over a square.
      return (
        <>
          <rect x="30" y="8" width="24" height="24" rx="3" fill={c.f} />
          <path
            d="M10 24h10a5 5 0 1 1 10 0h10v10a5 5 0 1 1 0 10v10H10V44a5 5 0 1 0 0-10z"
            fill={c.a}
          />
        </>
      );
    case 5: // A triangle cut into smaller triangles.
      return (
        <>
          <path d="M32 9L56 53H8z" fill={c.f} />
          <path d="M20 31h24M32 53L20 31M32 53l12-22" />
          <path d="M32 9L20 31h24z" fill={c.a} />
        </>
      );
    case 6: { // Isometric tower of cubes.
      const cube = (x: number, y: number, key: string) => (
        <g key={key}>
          <path d={`M${x} ${y}l10-5 10 5-10 5z`} fill="#fff" />
          <path d={`M${x} ${y}v11l10 5V${y + 5}z`} fill={c.a} />
          <path d={`M${x + 20} ${y}v11l-10 5V${y + 5}z`} fill={c.f} />
        </g>
      );
      return (
        <>
          {cube(12, 36, "a")}
          {cube(32, 36, "b")}
          {cube(22, 31, "c")}
          {cube(22, 15, "d")}
        </>
      );
    }
    case 7: // A cube net and a die.
      return (
        <>
          <path d="M16 8h10v10h10v10H26v10H16V28H6V18h10z" fill={c.f} />
          <path d="M16 18h10v10H16z" fill="#fff" />
          <rect x="32" y="32" width="24" height="24" rx="5" fill="#fff" />
          <circle cx="38" cy="38" r="2.4" fill={c.k} />
          <circle cx="44" cy="44" r="2.4" fill={c.k} />
          <circle cx="50" cy="50" r="2.4" fill={c.k} />
        </>
      );
    case 8: // Clock and calendar page.
      return (
        <>
          <rect x="34" y="8" width="22" height="22" rx="3" fill="#fff" />
          <path d="M34 15h22" />
          <rect x="34" y="8" width="22" height="7" rx="2" fill={c.a} />
          <T x={45} y={27} c="۷" />
          <circle cx="24" cy="38" r="17" fill="#fff" />
          <path d="M24 38V27a11 11 0 0 1 7 15z" fill={c.f} stroke="none" />
          <path d="M24 38V27M24 38l7 4" />
          <circle cx="24" cy="38" r="2" fill={c.k} />
        </>
      );
    case 9: // Growing sequence.
      return (
        <>
          <circle cx="52" cy="38" r="4" fill={c.f} />
          <circle cx="39" cy="36" r="6" fill={c.f} />
          <circle cx="23" cy="33" r="9" fill={c.a} />
          <path d="M56 18H16m6-6-6 6 6 6" />
        </>
      );
    case 10: // Number pyramid.
      return (
        <>
          <rect x="8" y="38" width="16" height="14" rx="2" fill="#fff" />
          <rect x="24" y="38" width="16" height="14" rx="2" fill="#fff" />
          <rect x="40" y="38" width="16" height="14" rx="2" fill="#fff" />
          <rect x="16" y="24" width="16" height="14" rx="2" fill={c.f} />
          <rect x="32" y="24" width="16" height="14" rx="2" fill={c.f} />
          <rect x="24" y="10" width="16" height="14" rx="2" fill={c.a} />
          <T x={16} y={48} c="۲" />
          <T x={32} y={48} c="۳" />
          <T x={48} y={48} c="۴" />
          <T x={24} y={34} c="۵" />
          <T x={40} y={34} c="۷" />
          <T x={32} y={20} c="؟" />
        </>
      );
    case 11: // Number machine: in, process, out.
      return (
        <>
          <rect x="18" y="20" width="28" height="26" rx="5" fill={c.f} />
          <circle cx="32" cy="33" r="6" fill="#fff" />
          <path d="M32 27v-3M32 42v-3M26 33h-3M41 33h-3" />
          <path d="M60 33H48m4-4-4 4 4 4M16 33H4m4-4-4 4 4 4" />
          <rect x="26" y="12" width="12" height="8" rx="2" fill={c.a} />
        </>
      );
    case 12: // Balance scale.
      return (
        <>
          <path d="M32 12v38M20 54h24M12 20h40" />
          <circle cx="32" cy="12" r="3" fill={c.a} />
          <path d="M12 20l-7 16h14zM52 20l-7 16h14z" fill={c.f} />
          <rect x="7" y="28" width="10" height="8" rx="2" fill={c.a} />
          <circle cx="52" cy="32" r="4" fill={c.a} />
        </>
      );
    case 13: // Digit tiles.
      return (
        <>
          <rect x="6" y="18" width="16" height="22" rx="3" fill="#fff" />
          <rect x="24" y="14" width="16" height="22" rx="3" fill={c.f} />
          <rect x="42" y="22" width="16" height="22" rx="3" fill={c.a} />
          <T x={14} y={33} c="۱" s={13} />
          <T x={32} y={29} c="۸" s={13} />
          <T x={50} y={37} c="۵" s={13} />
          <path d="M12 50h40" strokeDasharray="3 4" />
        </>
      );
    case 14: // Fraction pie and bar.
      return (
        <>
          <circle cx="22" cy="28" r="15" fill="#fff" />
          <path d="M22 28V13a15 15 0 0 1 13 22.5z" fill={c.a} />
          <path d="M22 28V13M22 28l13 7.5M22 28L9 35.5" />
          <rect x="40" y="10" width="16" height="44" rx="3" fill="#fff" />
          <rect x="40" y="32" width="16" height="22" rx="3" fill={c.f} />
          <path d="M40 21h16M40 32h16M40 43h16" />
        </>
      );
    case 15: // Two meshing gears.
      return (
        <>
          <path d={gear(23, 27, 13, 9)} fill={c.f} />
          <circle cx="23" cy="27" r="4" fill="#fff" />
          <path d={gear(44, 44, 9, 7)} fill={c.a} />
          <circle cx="44" cy="44" r="3" fill="#fff" />
        </>
      );
    case 16: // Triangle with a marked angle and a ruler.
      return (
        <>
          <path d="M10 46L46 46 22 14z" fill={c.f} />
          <path d="M18 46a8 8 0 0 0-3.2-6.4" />
          <rect x="6" y="50" width="52" height="8" rx="2" fill="#fff" />
          <path d="M12 50v4M20 50v3M28 50v4M36 50v3M44 50v4M52 50v3" />
          <circle cx="46" cy="46" r="2.5" fill={c.a} />
          <circle cx="22" cy="14" r="2.5" fill={c.a} />
          <circle cx="10" cy="46" r="2.5" fill={c.a} />
        </>
      );
    case 17: // Choice tree.
      return (
        <>
          <path d="M32 14L16 32M32 14l16 18M16 32L9 50M16 32l7 18M48 32l-7 18M48 32l7 18" />
          <circle cx="32" cy="12" r="5" fill={c.a} />
          <circle cx="16" cy="32" r="4.5" fill={c.f} />
          <circle cx="48" cy="32" r="4.5" fill={c.f} />
          {[9, 23, 41, 55].map((x) => (
            <circle key={x} cx={x} cy={51} r="4" fill="#fff" />
          ))}
        </>
      );
    case 18: // Code lock.
      return (
        <>
          <path d="M22 28v-7a10 10 0 0 1 20 0v7" />
          <rect x="12" y="28" width="40" height="28" rx="5" fill={c.f} />
          <rect x="17" y="35" width="8" height="12" rx="2" fill="#fff" />
          <rect x="28" y="35" width="8" height="12" rx="2" fill="#fff" />
          <rect x="39" y="35" width="8" height="12" rx="2" fill={c.a} />
          <T x={21} y={44.5} c="۱" s={8} />
          <T x={32} y={44.5} c="۰" s={8} />
          <T x={43} y={44.5} c="۱" s={8} />
        </>
      );
    case 19: // Logic grid with yes / no marks.
      return (
        <>
          <rect x="10" y="10" width="44" height="44" rx="4" fill="#fff" />
          <path d="M24.7 10v44M39.3 10v44M10 24.7h44M10 39.3h44" />
          <rect x="10" y="10" width="14.7" height="14.7" rx="3" fill={c.f} stroke="none" />
          <rect x="24.7" y="24.7" width="14.6" height="14.6" fill={c.f} stroke="none" />
          <rect x="39.3" y="39.3" width="14.7" height="14.7" rx="3" fill={c.f} stroke="none" />
          <path d="M13 17.5l3 3 5-6M28 32l3 3 5-6M42.3 46.5l3 3 5-6" stroke={c.k} />
          <path d="M28 14l5.5 5.5M33.5 14L28 19.5M43 14l5.5 5.5M48.5 14L43 19.5M14 29l5 5M19 29l-5 5" />
        </>
      );
    case 20: // Round table with seats.
      return (
        <>
          <circle cx="32" cy="32" r="13" fill={c.f} />
          {[
            [32, 10],
            [54, 32],
            [32, 54],
            [10, 32],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="5.5" fill={i === 0 ? c.a : "#fff"} />
          ))}
          {[
            [47.5, 16.5],
            [16.5, 47.5],
          ].map(([x, y], i) => (
            <circle key={`d${i}`} cx={x} cy={y} r="5" fill="#fff" />
          ))}
        </>
      );
    case 21: // Stopwatch with a flash.
      return (
        <>
          <path d="M28 8h8M32 8v6M46 16l3-3" />
          <circle cx="32" cy="36" r="20" fill="#fff" />
          <path d="M32 36V22a14 14 0 0 1 12.1 21z" fill={c.f} stroke="none" />
          <path d="M32 36V22" />
          <path d="M35 27l-7 11h6l-3 9 9-13h-6l3-7z" fill={c.a} />
        </>
      );
    default:
      return <circle cx="32" cy="32" r="16" fill={c.f} />;
  }
}

export function ToolPicture({ id, area, size = 64 }: { id: number; area: Area; size?: number }) {
  const c = AREA_INK[area];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden
      fill="none"
      stroke={c.k}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: c.k }}
    >
      <g fill="none">{draw(id, c)}</g>
    </svg>
  );
}

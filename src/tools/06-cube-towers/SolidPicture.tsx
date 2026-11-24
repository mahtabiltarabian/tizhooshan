import { solidName, solidPicture, type Solid } from "@/generators/solids";

// A solid drawn as in exam pictures: seen from the front, a little to the
// right and above; edges behind the solid are dashed (shape, not colour).

interface SolidPictureProps {
  solid: Solid;
  size?: number;
  /** Dots on the corners, hidden ones hollow. */
  dots?: boolean;
  label?: string;
}

export function SolidPictureSvg({ solid, size = 150, dots = false, label }: SolidPictureProps) {
  const pic = solidPicture(solid);
  const xs = pic.points.map((p) => p[0]);
  const ys = pic.points.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pad = 10;
  const k = (size - 2 * pad) / Math.max(x1 - x0, y1 - y0);
  const ox = (size - (x1 - x0) * k) / 2;
  const oy = (size - (y1 - y0) * k) / 2;
  const at = ([x, y]: [number, number]): [number, number] => [ox + (x - x0) * k, size - oy - (y - y0) * k];

  // Hidden edges first, so the solid lines are drawn on top where they cross.
  const edges = [...pic.edges].sort((a, b) => Number(b.hidden) - Number(a.hidden));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label ?? `تصویر ${solidName(solid)}؛ یال‌های پشت با خط‌چین`}>
      {edges.map((e, i) => {
        const [ax, ay] = at(pic.points[e.a]);
        const [bx, by] = at(pic.points[e.b]);
        return (
          <line
            key={i}
            x1={ax}
            y1={ay}
            x2={bx}
            y2={by}
            stroke="#0f172a"
            strokeWidth={e.hidden ? 1.6 : 2.6}
            strokeDasharray={e.hidden ? "5 4" : undefined}
            strokeLinecap="round"
          />
        );
      })}
      {dots &&
        pic.points.map((p, i) => {
          const [x, y] = at(p);
          return <circle key={i} cx={x} cy={y} r={3.6} fill={pic.vertexHidden[i] ? "#ffffff" : "#0f172a"} stroke="#0f172a" strokeWidth={1.4} />;
        })}
    </svg>
  );
}

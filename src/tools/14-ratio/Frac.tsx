// Fractions drawn as numerator over denominator, in HTML and in SVG, and
// sentences made of text, fractions and left-to-right equations.

import { fa } from "@/tools/registry";
import { isFracView, type EqPart, type FracView, type Seg } from "./text";
import styles from "./ratio.module.css";

const part = (v: number | string) => (typeof v === "number" ? fa(v) : v);

/** A stacked fraction inside HTML text. */
export function FracH({ f, big }: { f: FracView; big?: boolean }) {
  return (
    <span className={`${styles.frac} ${big ? styles.big : ""}`} role="math" aria-label={`${part(f.n)} بر ${part(f.d)}`}>
      <span>{part(f.n)}</span>
      <span>{part(f.d)}</span>
    </span>
  );
}

function EqView({ parts }: { parts: EqPart[] }) {
  return (
    <bdi dir="ltr" className={styles.eq}>
      {parts.map((p, i) => (typeof p === "string" ? <span key={i}>{p}</span> : <FracH key={i} f={p} />))}
    </bdi>
  );
}

/** A sentence of segments. */
export function Rich({ segs, className }: { segs: Seg[]; className?: string }) {
  return (
    <span className={`${styles.rich} ${className ?? ""}`}>
      {segs.map((s, i) => (typeof s === "string" ? <span key={i}>{s}</span> : isFracView(s) ? <FracH key={i} f={s} /> : <EqView key={i} parts={s.eq} />))}
    </span>
  );
}

/** A stacked fraction in SVG, centred on (x, y); `size` is the digit height. */
export function FracG({ f, x, y, size, fill = "#0f172a" }: { f: FracView; x: number; y: number; size: number; fill?: string }) {
  const n = part(f.n);
  const d = part(f.d);
  const w = Math.max(n.length, d.length) * size * 0.62 + size * 0.3;
  return (
    <g role="math" aria-label={`${n} بر ${d}`}>
      <text x={x} y={y - size * 0.62} fontSize={size} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={fill}>
        {n}
      </text>
      <line x1={x - w / 2} y1={y} x2={x + w / 2} y2={y} stroke={fill} strokeWidth={size * 0.09} strokeLinecap="round" />
      <text x={x} y={y + size * 0.68} fontSize={size} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={fill}>
        {d}
      </text>
    </g>
  );
}

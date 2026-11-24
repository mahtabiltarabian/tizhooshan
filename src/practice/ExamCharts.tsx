// Charts for the exam screens and the printed report card. One series each,
// in the app's accent colour; every bar and point carries its value in
// words, so nothing depends on colour (and black-and-white printing works).
// SVG, so they print exactly as shown. A table with the same numbers sits
// next to each chart on the report card.

import { fa } from "@/tools/registry";

const INK = "#0f172a";
const MUTED = "#5b6476";
const TRACK = "#e5e7eb";
const BAR = "#4f46e5";

const pct = (right: number, total: number) => (total ? Math.round((100 * right) / total) : 0);

/** Horizontal bars, labels on the right (Persian reads from the right). */
export function BarChart({ rows, label }: { rows: { label: string; right: number; total: number; note?: string }[]; label: string }) {
  const W = 620;
  const ROW = 40;
  const LABEL_W = 170;
  const VALUE_W = 150;
  const barW = W - LABEL_W - VALUE_W - 20;
  const H = rows.length * ROW + 8;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} style={{ maxWidth: W, display: "block" }}>
      {rows.map((r, i) => {
        const y = i * ROW + 4;
        const p = pct(r.right, r.total);
        const w = Math.max(p ? 4 : 0, (barW * p) / 100);
        const x0 = W - LABEL_W - 10;
        return (
          <g key={r.label}>
            <title>{`${r.label}: ${fa(r.right)} از ${fa(r.total)} (${fa(p)}٪)`}</title>
            <text x={W - 4} y={y + ROW / 2 - 4} dy="0.35em" textAnchor="start" direction="rtl" fontSize={15} fontWeight={700} fill={INK}>
              {r.label}
            </text>
            <rect x={x0 - barW} y={y + 6} width={barW} height={ROW - 20} rx={4} fill={TRACK} />
            <rect x={x0 - w} y={y + 6} width={w} height={ROW - 20} rx={4} fill={BAR} />
            <text x={x0 - barW - 8} y={y + ROW / 2 - 4} dy="0.35em" textAnchor="start" direction="rtl" fontSize={14} fill={INK}>
              {`${fa(r.right)} از ${fa(r.total)} (${fa(p)}٪)${r.note ? ` · ${r.note}` : ""}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Right answers (%) over the last exams, oldest on the right. */
export function HistoryChart({ points, label }: { points: { at: number; right: number; total: number }[]; label: string }) {
  const W = 620;
  const H = 200;
  const top = 24;
  const bottom = 44;
  const side = 40;
  const n = points.length;
  const x = (i: number) => (n === 1 ? W / 2 : W - side - ((W - 2 * side) * i) / (n - 1));
  const y = (p: number) => top + ((H - top - bottom) * (100 - p)) / 100;
  const date = (t: number) => new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "numeric", day: "numeric" }).format(new Date(t));
  const ps = points.map((p) => pct(p.right, p.total));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} style={{ maxWidth: W, display: "block" }}>
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line x1={side} x2={W - side} y1={y(g)} y2={y(g)} stroke={TRACK} strokeWidth={1} />
          <text x={side - 6} y={y(g)} dy="0.35em" textAnchor="end" fontSize={11} fill={MUTED}>
            {`${fa(g)}٪`}
          </text>
        </g>
      ))}
      <polyline points={ps.map((p, i) => `${x(i)},${y(p)}`).join(" ")} fill="none" stroke={BAR} strokeWidth={2} />
      {ps.map((p, i) => (
        <g key={i}>
          <title>{`${date(points[i].at)}: ${fa(points[i].right)} از ${fa(points[i].total)} (${fa(p)}٪)`}</title>
          <circle cx={x(i)} cy={y(p)} r={5} fill={BAR} stroke="#fff" strokeWidth={2} />
          {(i === 0 || i === n - 1) && (
            <text x={x(i)} y={y(p) - 12} textAnchor="middle" fontSize={13} fontWeight={700} fill={INK}>
              {`${fa(p)}٪`}
            </text>
          )}
          <text x={x(i)} y={H - bottom + 20} textAnchor="middle" fontSize={11} fill={MUTED}>
            {date(points[i].at)}
          </text>
        </g>
      ))}
    </svg>
  );
}

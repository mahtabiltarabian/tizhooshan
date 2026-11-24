// Charts for the profile page. Time runs from right to left, as Persian is
// read (oldest on the right), like the exam history chart. Right answers are
// solid blue; wrong ones are orange with diagonal stripes, so the two differ
// without colour too, and every bar carries its numbers in words.

import { fa } from "@/tools/registry";

const INK = "#0f172a";
const MUTED = "#5b6476";
const TRACK = "#e5e7eb";
const RIGHT = "#4f46e5";
const WRONG = "#e08a1e";
const GAP = 2;
/** Narrower than this, the text gets too small: the page scrolls the chart sideways instead. */
const MIN_W = 540;
/** Persian digits and the Persian decimal point. */
const num = (v: number) => fa(v).replace(".", "٫");

export interface Column {
  label: string;
  sub?: string;
  long: string;
}

/** Diagonal stripes for wrong answers (the second series). */
function Stripes({ id }: { id: string }) {
  return (
    <defs>
      <pattern
        id={id}
        width="6"
        height="6"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect width="6" height="6" fill={WRONG} />
        <line
          x1="0"
          y1="0"
          x2="0"
          y2="6"
          stroke="#fff"
          strokeWidth="2"
          opacity="0.55"
        />
      </pattern>
    </defs>
  );
}

/** A bar with its top end rounded (4px) and its foot flat on the baseline. */
function topRounded(x: number, y: number, w: number, h: number, r = 4) {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

const layout = (n: number) => {
  const W = 620;
  const H = 230;
  const top = 26;
  const bottom = 46;
  const side = 8;
  const slot = (W - 2 * side) / n;
  const barW = Math.min(36, slot * 0.6);
  // Oldest on the right.
  const cx = (i: number) => W - side - slot * (i + 0.5);
  return { W, H, top, bottom, slot, barW, cx, plotH: H - top - bottom };
};

function Labels({
  cols,
  cx,
  y,
}: {
  cols: readonly Column[];
  cx: (i: number) => number;
  y: number;
}) {
  return (
    <>
      {cols.map((c, i) => (
        <g key={i}>
          <text x={cx(i)} y={y} textAnchor="middle" fontSize={12} fill={INK}>
            {c.label}
          </text>
          {c.sub && (
            <text
              x={cx(i)}
              y={y + 16}
              textAnchor="middle"
              fontSize={11}
              fill={MUTED}
            >
              {c.sub}
            </text>
          )}
        </g>
      ))}
    </>
  );
}

/** One value per column: time spent. */
export function TimeChart({
  cols,
  values,
  unit,
  label,
}: {
  cols: readonly Column[];
  values: number[];
  unit: string;
  label: string;
}) {
  const { W, H, top, bottom, barW, cx, plotH } = layout(cols.length);
  const max = Math.max(1, ...values);
  const base = H - bottom;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={label}
      style={{ maxWidth: W, minWidth: MIN_W, display: "block" }}
    >
      <line x1={0} x2={W} y1={base} y2={base} stroke={TRACK} strokeWidth={2} />
      {values.map((v, i) => {
        const h = v > 0 ? Math.max(3, (plotH * v) / max) : 0;
        return (
          <g key={i}>
            <title>{`${cols[i].long}: ${num(v)} ${unit}`}</title>
            {/* A tall invisible target, so hovering a short bar still shows its numbers. */}
            <rect
              x={cx(i) - barW / 2 - 4}
              y={top}
              width={barW + 8}
              height={plotH}
              fill="transparent"
            />
            {h > 0 && (
              <path
                d={topRounded(cx(i) - barW / 2, base - h, barW, h)}
                fill={RIGHT}
              />
            )}
            {v > 0 && (
              <text
                x={cx(i)}
                y={base - h - 6}
                textAnchor="middle"
                fontSize={12}
                fontWeight={700}
                fill={INK}
              >
                {num(v)}
              </text>
            )}
          </g>
        );
      })}
      <Labels cols={cols} cx={cx} y={base + 18} />
    </svg>
  );
}

/** Right and wrong answers per column, stacked: right at the foot, wrong on top. */
export function AnswersChart({
  cols,
  right,
  wrong,
  label,
}: {
  cols: readonly Column[];
  right: number[];
  wrong: number[];
  label: string;
}) {
  const { W, H, top, bottom, barW, cx, plotH } = layout(cols.length);
  const max = Math.max(1, ...right.map((r, i) => r + wrong[i]));
  const base = H - bottom;
  const scale = (v: number) => (plotH * v) / max;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={label}
      style={{ maxWidth: W, minWidth: MIN_W, display: "block" }}
    >
      <Stripes id="profile-wrong" />
      <line x1={0} x2={W} y1={base} y2={base} stroke={TRACK} strokeWidth={2} />
      {right.map((r, i) => {
        const w = wrong[i];
        const hr = r ? Math.max(3, scale(r)) : 0;
        const hw = w ? Math.max(3, scale(w)) : 0;
        const x = cx(i) - barW / 2;
        const total = r + w;
        const topY = base - hr - (hr && hw ? GAP : 0) - hw;
        return (
          <g key={i}>
            <title>{`${cols[i].long}: ${fa(r)} درست، ${fa(w)} نادرست`}</title>
            <rect
              x={x - 4}
              y={top}
              width={barW + 8}
              height={plotH}
              fill="transparent"
            />
            {hr > 0 &&
              (hw ? (
                <rect
                  x={x}
                  y={base - hr}
                  width={barW}
                  height={hr}
                  fill={RIGHT}
                />
              ) : (
                <path d={topRounded(x, base - hr, barW, hr)} fill={RIGHT} />
              ))}
            {hw > 0 && (
              <path
                d={topRounded(x, topY, barW, hw)}
                fill="url(#profile-wrong)"
              />
            )}
            {total > 0 && (
              <text
                x={cx(i)}
                y={topY - 6}
                textAnchor="middle"
                fontSize={12}
                fontWeight={700}
                fill={INK}
              >
                {fa(total)}
              </text>
            )}
          </g>
        );
      })}
      <Labels cols={cols} cx={cx} y={base + 18} />
    </svg>
  );
}

/** One row per tool: right and wrong side by side in one bar, numbers in words. */
export function ToolsChart({
  rows,
  label,
}: {
  rows: { title: string; right: number; wrong: number }[];
  label: string;
}) {
  const W = 620;
  const ROW = 34;
  const LABEL_W = 190;
  const VALUE_W = 150;
  const barW = W - LABEL_W - VALUE_W - 20;
  const H = rows.length * ROW + 4;
  const max = Math.max(1, ...rows.map((r) => r.right + r.wrong));
  const x0 = W - LABEL_W - 10;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={label}
      style={{ maxWidth: W, minWidth: MIN_W, display: "block" }}
    >
      <Stripes id="profile-tool-wrong" />
      {rows.map((r, i) => {
        const y = i * ROW + 4;
        const wr = (barW * r.right) / max;
        const ww = (barW * r.wrong) / max;
        const gap = r.right && r.wrong ? GAP : 0;
        return (
          <g key={r.title}>
            <title>{`${r.title}: ${fa(r.right)} درست، ${fa(r.wrong)} نادرست`}</title>
            <text
              x={W - 4}
              y={y + ROW / 2 - 2}
              dy="0.35em"
              textAnchor="start"
              direction="rtl"
              fontSize={14}
              fontWeight={700}
              fill={INK}
            >
              {r.title}
            </text>
            {r.right > 0 && (
              <rect
                x={x0 - wr}
                y={y + 6}
                width={Math.max(3, wr)}
                height={ROW - 16}
                rx={3}
                fill={RIGHT}
              />
            )}
            {r.wrong > 0 && (
              <rect
                x={x0 - wr - gap - ww}
                y={y + 6}
                width={Math.max(3, ww)}
                height={ROW - 16}
                rx={3}
                fill="url(#profile-tool-wrong)"
              />
            )}
            <text
              x={x0 - barW - 8}
              y={y + ROW / 2 - 2}
              dy="0.35em"
              textAnchor="start"
              direction="rtl"
              fontSize={13}
              fill={INK}
            >
              {`${fa(r.right)} درست · ${fa(r.wrong)} نادرست`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** The legend for the two answer series, as HTML above the charts. */
export function AnswersLegend() {
  const sw = (fill: string, stripes = false) => (
    <svg
      width="16"
      height="12"
      aria-hidden
      style={{ verticalAlign: "middle", marginInlineEnd: 4 }}
    >
      {stripes && <Stripes id="profile-legend-wrong" />}
      <rect width="16" height="12" rx="3" fill={fill} />
    </svg>
  );
  return (
    <p
      style={{
        display: "flex",
        gap: 16,
        margin: "0 0 6px",
        fontSize: "0.95rem",
      }}
    >
      <span>{sw(RIGHT)}درست</span>
      <span>{sw("url(#profile-legend-wrong)", true)}نادرست (راه‌راه)</span>
    </p>
  );
}

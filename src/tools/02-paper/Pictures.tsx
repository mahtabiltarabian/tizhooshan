"use client";

// Flat pictures of the paper, drawn the way exam sheets draw them: the paper
// on a faint grid, the fold line dashed with a curved arrow for the flap,
// holes as dark dots, cut-away parts with a dashed edge, cuts in red with ✂.
// Paper coordinates have y up; the picture has y down.

import { useId, useRef, type PointerEvent as ReactPointerEvent } from "react";
import {
  centroid,
  chord,
  clip,
  creases,
  intersect,
  lineNormal,
  reflect,
  shapes,
  square,
  unfoldPoints,
  type Fold,
  type FoldLine,
  type Poly,
  type Pt,
} from "@/generators/paper-folding";
import { fa } from "@/tools/registry";
import { STEP_NAMES } from "./orderText";
import styles from "./Pictures.module.css";

const INK = "#1f2430";
const PAPER = "#fffaf0";
const FLAP = "#dbe8ff";
const CUT = "#d6343a";
const GONE = "#8a8478";

/** Pointer handlers in paper coordinates (unsnapped), for drawing on the paper. */
export interface PaperPad {
  down: (p: Pt) => void;
  move: (p: Pt) => void;
  up: (p: Pt) => void;
  cancel: () => void;
}

/** Marks on a grid answer: the child's dot, the right place (ring), or both. */
export type Mark = { cell: [number, number]; mine: boolean; right: boolean };

interface PaperSvgProps {
  S: number;
  size?: number;
  /** The paper as it lies now (default: the whole square, open). */
  shape?: Poly;
  /** Dashed outline of the whole sheet behind a folded shape. */
  outline?: boolean;
  grid?: boolean;
  holes?: Pt[];
  removed?: Poly[];
  cuts?: [Pt, Pt][];
  /** The next fold: dashed line, the flap tinted, a curved arrow. */
  fold?: Fold;
  /** Old fold lines on opened paper. */
  creases?: [Pt, Pt][];
  /** A fold line being undone: dashed, no flap. */
  mirror?: FoldLine;
  /** Dashed links between a hole and its mirror image. */
  links?: [Pt, Pt][];
  marks?: Mark[];
  onCell?: (i: number, j: number) => void;
  /** Spots on a fold where a hole can be punched too: small dashed rings, tapped with `onSpot`. */
  spots?: Pt[];
  onSpot?: (p: Pt) => void;
  onVertex?: (v: number) => void;
  /** A cut being drawn: its corners so far, and the segment under the finger. */
  draft?: Pt[];
  preview?: [Pt, Pt] | null;
  /** Small dots where a cut can bend (the half-grid). */
  dots?: Pt[];
  /** Draw on the paper with a finger or mouse. */
  pad?: PaperPad;
  label?: string;
}

export function PaperSvg({
  S,
  size = 160,
  shape,
  outline = false,
  grid = true,
  holes = [],
  removed = [],
  cuts = [],
  fold,
  creases = [],
  mirror,
  links = [],
  marks = [],
  onCell,
  spots = [],
  onSpot,
  onVertex,
  draft = [],
  preview,
  dots = [],
  pad: drawPad,
  label,
}: PaperSvgProps) {
  const id = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const pad = 10;
  const u = (size - 2 * pad) / S;
  const X = (x: number) => pad + x * u;
  const Y = (y: number) => pad + (S - y) * u;
  const pts = (poly: Poly) => poly.map(([x, y]) => `${X(x)},${Y(y)}`).join(" ");
  // Screen → paper coordinates, whatever size the picture is drawn at.
  const toPaper = (e: ReactPointerEvent): Pt | null => {
    const m = svgRef.current?.getScreenCTM();
    if (!m) return null;
    const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [(q.x - pad) / u, S - (q.y - pad) / u];
  };
  const padEvents = drawPad && {
    onPointerDown: (e: ReactPointerEvent<SVGSVGElement>) => {
      if (e.button !== 0) return;
      const p = toPaper(e);
      if (!p) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drawPad.down(p);
    },
    onPointerMove: (e: ReactPointerEvent<SVGSVGElement>) => {
      const p = e.currentTarget.hasPointerCapture(e.pointerId) && toPaper(e);
      if (p) drawPad.move(p);
    },
    onPointerUp: (e: ReactPointerEvent<SVGSVGElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const p = toPaper(e);
      if (p) drawPad.up(p);
      else drawPad.cancel();
    },
    onPointerCancel: () => drawPad.cancel(),
  };
  const paper = shape ?? square(S);
  const clipId = `${id}-paper`;
  const arrowId = `${id}-arrow`;

  let flap: Poly | null = null;
  let arrow: string | null = null;
  if (fold) {
    flap = clip(paper, fold.line, fold.moving);
    const from = centroid(flap);
    const to = reflect(from, fold.line);
    const { n } = lineNormal(fold.line);
    const d = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const mid: Pt = [(from[0] + to[0]) / 2 + n[1] * d * 0.35, (from[1] + to[1]) / 2 - n[0] * d * 0.35];
    arrow = `M${X(from[0])},${Y(from[1])} Q${X(mid[0])},${Y(mid[1])} ${X(to[0])},${Y(to[1])}`;
  }

  const line = (c: [Pt, Pt] | null, key: string, strong: boolean) =>
    c && (
      <line
        key={key}
        x1={X(c[0][0])}
        y1={Y(c[0][1])}
        x2={X(c[1][0])}
        y2={Y(c[1][1])}
        stroke={strong ? INK : "#9a8f7c"}
        strokeWidth={strong ? 2.2 : 1.2}
        strokeDasharray={strong ? "7 5" : "4 4"}
      />
    );

  return (
    <svg
      ref={svgRef}
      className={styles.svg}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      style={drawPad ? { touchAction: "none", cursor: "crosshair" } : undefined}
      {...padEvents}
    >
      <defs>
        <clipPath id={clipId}>
          <polygon points={pts(paper)} />
        </clipPath>
        <marker id={arrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={INK} />
        </marker>
      </defs>

      {outline && <polygon points={pts(square(S))} fill="none" stroke="#bfb29b" strokeWidth={1.2} strokeDasharray="3 4" />}

      <polygon points={pts(paper)} fill={PAPER} stroke="none" />
      {flap && <polygon points={pts(flap)} fill={FLAP} stroke="none" />}

      <g clipPath={`url(#${clipId})`}>
        {grid &&
          Array.from({ length: S - 1 }, (_, i) => (
            <g key={`g${i}`} stroke="#ddd2bd" strokeWidth={1}>
              <line x1={X(i + 1)} y1={Y(0)} x2={X(i + 1)} y2={Y(S)} />
              <line x1={X(0)} y1={Y(i + 1)} x2={X(S)} y2={Y(i + 1)} />
            </g>
          ))}
        {removed.map((r, i) => {
          const part = intersect(r, paper);
          return part.length > 2 && <polygon key={`r${i}`} points={pts(part)} fill={GONE} stroke={INK} strokeWidth={1.4} strokeDasharray="4 3" />;
        })}
        {/* Clipped to the paper: a hole punched on a fold shows as a half circle at the folded edge. */}
        {holes.map(([x, y], i) => (
          <circle key={`h${i}`} cx={X(x)} cy={Y(y)} r={u * 0.27} fill={INK} />
        ))}
      </g>

      <polygon points={pts(paper)} fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" />

      {creases.map((c, i) => line(c, `c${i}`, false))}
      {mirror && line(chord(mirror, paper), "mirror", true)}
      {fold && line(chord(fold.line, paper), "fold", true)}

      {links.map(([a, b], i) => (
        <line key={`l${i}`} x1={X(a[0])} y1={Y(a[1])} x2={X(b[0])} y2={Y(b[1])} stroke="#3d7bf7" strokeWidth={1.6} strokeDasharray="2 4" strokeLinecap="round" />
      ))}

      {cuts.map(([a, b], i) => (
        <g key={`s${i}`}>
          <line x1={X(a[0])} y1={Y(a[1])} x2={X(b[0])} y2={Y(b[1])} stroke={CUT} strokeWidth={3} strokeDasharray="9 4" strokeLinecap="round" />
          <text x={X(a[0])} y={Y(a[1])} fontSize={u * 0.55 + 6} textAnchor="middle" dominantBaseline="central" fill={CUT}>
            ✂
          </text>
        </g>
      ))}

      {dots.map(([x, y]) => (
        <circle key={`d${x},${y}`} cx={X(x)} cy={Y(y)} r={1.6} fill="#9a8f7c" pointerEvents="none" />
      ))}
      {draft.length > 0 && (
        <g pointerEvents="none">
          {/* A loop started inside must come back to its start: a dashed ring marks it. */}
          <circle cx={X(draft[0][0])} cy={Y(draft[0][1])} r={Math.max(7, u * 0.28)} fill="none" stroke={CUT} strokeWidth={2} strokeDasharray="3 2" />
          <polyline points={pts(draft)} fill="none" stroke={CUT} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
          {draft.map(([x, y], i) => (
            <circle key={`q${i}`} cx={X(x)} cy={Y(y)} r={3.5} fill={CUT} />
          ))}
        </g>
      )}
      {preview && (
        <g pointerEvents="none">
          <line x1={X(preview[0][0])} y1={Y(preview[0][1])} x2={X(preview[1][0])} y2={Y(preview[1][1])} stroke={CUT} strokeWidth={3} strokeDasharray="8 4" strokeLinecap="round" />
          <circle cx={X(preview[1][0])} cy={Y(preview[1][1])} r={6} fill="#ffffff" stroke={CUT} strokeWidth={2.5} />
          <text x={X(preview[1][0]) + 12} y={Y(preview[1][1]) - 12} fontSize={16} textAnchor="middle" dominantBaseline="central" fill={CUT}>
            ✂
          </text>
        </g>
      )}

      {arrow && <path d={arrow} fill="none" stroke={INK} strokeWidth={2} markerEnd={`url(#${arrowId})`} />}

      {marks.map(({ cell: [i, j], mine, right }) => (
        <g key={`m${i},${j}`}>
          {right && <circle cx={X(i + 0.5)} cy={Y(j + 0.5)} r={u * 0.38} fill="none" stroke="#1d8a55" strokeWidth={2.4} strokeDasharray={mine ? undefined : "3 3"} />}
          {mine && <circle cx={X(i + 0.5)} cy={Y(j + 0.5)} r={u * 0.25} fill={INK} />}
          {mine && !right && (
            <text x={X(i + 0.5)} y={Y(j + 0.5)} fontSize={u * 0.4} textAnchor="middle" dominantBaseline="central" fill="#fff" fontWeight={700}>
              ✗
            </text>
          )}
        </g>
      ))}

      {onCell &&
        Array.from({ length: S * S }, (_, k) => {
          const i = k % S;
          const j = Math.floor(k / S);
          return (
            <rect
              key={`t${k}`}
              x={X(i)}
              y={Y(j + 1)}
              width={u}
              height={u}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onClick={() => onCell(i, j)}
              aria-label={`خانه ${fa(i + 1)}، ${fa(j + 1)}`}
            />
          );
        })}

      {onSpot &&
        spots.map(([x, y], i) => (
          <circle
            key={`p${x},${y}`}
            cx={X(x)}
            cy={Y(y)}
            r={Math.max(8, u * 0.32)}
            fill="transparent"
            stroke={INK}
            strokeWidth={1.4}
            strokeDasharray="3 2"
            style={{ cursor: "pointer" }}
            onClick={() => onSpot([x, y])}
            aria-label={`جای ${fa(i + 1)} روی خط تا`}
          />
        ))}

      {onVertex &&
        paper.map(([x, y], v) => (
          <circle
            key={`v${v}`}
            cx={X(x)}
            cy={Y(y)}
            r={Math.max(9, u * 0.3)}
            fill="#ffffff"
            fillOpacity={0.85}
            stroke={CUT}
            strokeWidth={2}
            style={{ cursor: "pointer" }}
            onClick={() => onVertex(v)}
            aria-label={`گوشه ${fa(v + 1)}`}
          />
        ))}
    </svg>
  );
}

/** The fold steps in a row: each shows the paper before that fold. `order` reorders them. */
export function FoldSteps({ S, folds, size = 96, order, captions = true }: { S: number; folds: Fold[]; size?: number; order?: number[]; captions?: boolean }) {
  const before = shapes(S, folds);
  const idx = order ?? folds.map((_, i) => i);
  return (
    <div className={styles.steps}>
      {idx.map((i, n) => (
        <figure key={i}>
          <PaperSvg S={S} size={size} shape={before[i]} fold={folds[i]} outline grid={false} label={`تای ${fa(i + 1)}`} />
          {captions && <figcaption>{order ? `شکل ${STEP_NAMES[n]}` : `تای ${fa(i + 1)}`}</figcaption>}
        </figure>
      ))}
    </div>
  );
}

/**
 * One picture of an "order" question. With two or more folds, step n is the
 * paper before fold n. With one fold, the steps are fold → punch → open.
 */
export function OrderPicture({ S, folds, punches, step, size }: { S: number; folds: Fold[]; punches: Pt[]; step: number; size: number }) {
  const before = shapes(S, folds);
  if (folds.length !== 1) return <PaperSvg S={S} size={size} shape={before[step]} fold={folds[step]} outline grid={false} />;
  if (step === 0) return <PaperSvg S={S} size={size} fold={folds[0]} grid={false} label="کاغذ باز و خط تا" />;
  if (step === 1) return <PaperSvg S={S} size={size} shape={before[1]} outline holes={punches} label="کاغذ تاشده با سوراخ" />;
  return <PaperSvg S={S} size={size} holes={unfoldPoints(punches, folds)} creases={creases(S, folds)} label="کاغذ باز با سوراخ‌ها" />;
}

/** Persian letter names for the shuffled steps in "order" questions. */
export { STEP_NAMES };

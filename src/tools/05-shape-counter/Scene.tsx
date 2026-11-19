"use client";

// The big board: one counting figure, or the stages of a growing pattern in
// a row (stage 1 on the right, read like Persian text) with the asked stage
// larger at the end.

import { useMemo } from "react";
import { figureOf, type CountFigure, type FigureSpec, type Kind, type Shape } from "@/generators/shape-count";
import { Board } from "@/engine-2d/Board";
import { fa } from "@/tools/registry";
import { CountFigureG, frameFor, INK, type Look } from "./Pictures";

type Marks = { shape: Shape; look: Look; label?: number }[];

interface Props {
  fig: CountFigure;
  shapes?: Marks;
  selected?: number[];
  onPoint?: (i: number) => void;
  origin?: boolean;
  label?: string;
}

export function CountScene({ fig, shapes, selected, onPoint, origin, label }: Props) {
  const f = frameFor(fig, 10);
  const pad = 0.9;
  return (
    <Board view={[-pad, -pad, f.w + 2 * pad, f.h + 2 * pad]} imageName="shape-counter" label={label}>
      <CountFigureG fig={fig} frame={f} shapes={shapes} selected={selected} onPoint={onPoint} origin={origin} />
    </Board>
  );
}

interface GrowProps {
  stage: (n: number) => FigureSpec;
  kind: Kind;
  counts: number[];
  ask: number;
  /** Show the asked stage (after answering), with these marks. */
  answered: boolean;
  answer: number;
  shapes?: Marks;
  kindName: string;
}

export function GrowingScene(p: GrowProps) {
  const { stage, ask } = p;
  const figs = useMemo(() => [1, 2, 3, ask].map((n) => figureOf(stage(n))), [stage, ask]);
  const H = 7;
  const gap = 1.4;
  const sizes = [4, 4, 4, H];
  // Right to left: stage 1 at the right edge.
  const frames: ReturnType<typeof frameFor>[] = [];
  let right = 0;
  figs.forEach((fig, i) => {
    const fr = frameFor(fig, sizes[i]);
    frames.push({ ...fr, x: right - fr.w, y: (H - fr.h) / 2 });
    right -= fr.w + gap;
  });
  const left = right + gap;
  const font = 0.55;
  const caption = (i: number) => {
    const n = i < 3 ? i + 1 : p.ask;
    const count = i < 3 ? p.counts[i] : p.answered ? p.answer : null;
    return `مرحله ${fa(n)}: ${count === null ? "؟" : `${fa(count)} ${p.kindName}`}`;
  };
  return (
    <Board view={[left - 0.6, -0.6, -left + 1.2, H + 2]} imageName="shape-counter" label="الگوی رشدکننده">
      {figs.map((fig, i) => {
        const fr = frames[i];
        const shown = i < 3 || p.answered;
        return (
          <g key={i}>
            {shown ? (
              <CountFigureG fig={fig} frame={fr} shapes={i === 3 ? p.shapes : undefined} origin={p.kind === "angle"} />
            ) : (
              <g>
                <rect x={fr.x} y={0} width={fr.w} height={H} rx={0.3} fill="#fff" stroke={INK} strokeWidth={2} strokeDasharray="8 6" vectorEffect="non-scaling-stroke" />
                <text x={fr.x + fr.w / 2} y={H / 2} fontSize={2} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} style={{ fontFamily: "Vazirmatn, sans-serif" }}>
                  ؟
                </text>
              </g>
            )}
            <text x={fr.x + fr.w / 2} y={H + 0.9} fontSize={font} fontWeight={700} textAnchor="middle" fill={INK} style={{ fontFamily: "Vazirmatn, sans-serif" }}>
              {caption(i)}
            </text>
          </g>
        );
      })}
      {/* Dots between the shown stages and the asked one. */}
      <text x={frames[3].x + frames[3].w + gap / 2} y={H / 2} fontSize={0.9} textAnchor="middle" dominantBaseline="central" fill={INK}>
        …
      </text>
    </Board>
  );
}

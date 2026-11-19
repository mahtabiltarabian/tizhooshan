"use client";

// Worksheet for tool 1. Mirror and water questions show the mirror or the
// water line next to the figure; draw and slide questions give a grid to
// colour, and "which slide?" shows both pictures on the grid.

import { useId } from "react";
import {
  makeTransformQuestion,
  moveAll,
  moveFigure,
  stagedOps,
  type Figure,
  type Op,
  type TransformQuestion,
  type TransformQuestionType,
} from "@/generators/transforms";
import { Choices, FigureRow, WorksheetShell, type WorksheetConfig } from "@/toolkit/WorksheetShell";
import { fa } from "@/tools/registry";
import { boxFor, FigureG, FigureSvg, GridG, Hatch, LineG, PivotG } from "./Pictures";
import { rectAround, type Rect } from "./Scene";
import { MOVE_NAME, sequenceFrames, TRANSFORM_TYPE_LABEL, transformPrompt, vecText } from "./TransformTryPanel";
import styles from "@/toolkit/Worksheet.module.css";

/** A small still board: figures on a grid with the lines and turning points of some moves. */
function MiniBoard({ figs, ops = [], grid, size = 150, image, plain = false }: { figs: Figure[]; ops?: Op[]; grid?: Rect; size?: number; image?: Figure; plain?: boolean }) {
  const hatch = useId();
  const g = grid ?? rectAround(figs, [], 1);
  const w = g.x1 - g.x0;
  const h = g.y1 - g.y0;
  return (
    <svg width={size} height={(size * h) / w} viewBox={`${g.x0 - 0.2} ${-g.y1 - 0.2} ${w + 0.4} ${h + 0.4}`} style={{ direction: "ltr" }}>
      <Hatch id={hatch} />
      <GridG {...g} />
      {ops.map((o, i) =>
        o.kind === "reflect" ? (
          <LineG key={i} line={o.line} box={g} look={plain ? "plain" : o.line.kind === "v" ? "mirror" : o.line.kind === "h" ? "water" : "plain"} />
        ) : o.kind === "rotate" ? (
          <PivotG key={i} at={o.about} deg={o.deg} />
        ) : null,
      )}
      {figs.map((f, i) => (
        <FigureG key={i} fig={f} />
      ))}
      {image && <FigureG fig={image} look="image" hatchId={hatch} />}
    </svg>
  );
}

function figures(q: TransformQuestion) {
  if (q.type === "shift") {
    const grid = { x0: 0, y0: 0, x1: q.w, y1: q.h };
    if (q.form === "draw")
      return (
        <div className={styles.answerGrid}>
          <MiniBoard figs={[q.figure]} ops={q.ops} grid={grid} size={240} plain />
        </div>
      );
    return (
      <>
        <div className={styles.answerGrid}>
          <MiniBoard figs={[q.figure]} grid={grid} size={240} image={q.image} />
        </div>
        <Choices>
          {q.options.map((v) => (
            <span key={v.join()}>{vecText(v)}</span>
          ))}
        </Choices>
      </>
    );
  }
  if (q.type === "draw")
    return (
      <div className={styles.answerGrid}>
        <MiniBoard figs={[q.figure]} ops={[q.op]} grid={{ x0: 0, y0: 0, x1: q.w, y1: q.h }} size={240} plain />
      </div>
    );
  if (q.type === "which") {
    const box = boxFor([q.figure, q.image]);
    return (
      <>
        <FigureRow>
          <figure className={styles.caption}>
            <FigureSvg fig={q.figure} box={box} size={84} look="figure" />
            <figcaption>شکل ۱</figcaption>
          </figure>
          <figure className={styles.caption}>
            <FigureSvg fig={q.image} box={box} size={84} look="figure" />
            <figcaption>شکل ۲</figcaption>
          </figure>
        </FigureRow>
        <Choices>
          {q.options.map((m) => (
            <span key={m}>{MOVE_NAME[m]}</span>
          ))}
        </Choices>
      </>
    );
  }
  const box = boxFor([q.figure, ...q.options]);
  let top: React.ReactNode;
  if (q.type === "sequence") {
    const frames = sequenceFrames(q);
    top = (
      <FigureRow>
        {q.frames.map((fr, i) =>
          fr ? (
            <FigureSvg key={i} fig={frames[i]} box={box} size={64} look="figure" />
          ) : (
            <span key={i} className={styles.bigNum}>
              ؟
            </span>
          ),
        )}
      </FigureRow>
    );
  } else if (q.type === "mirror" || q.type === "water") {
    const op = stagedOps(q.figure, q.moves)[0];
    const end = moveFigure(q.figure, op);
    top = (
      <FigureRow>
        <MiniBoard figs={[q.figure]} ops={[op]} grid={rectAround([q.figure, end], [], 1)} size={q.type === "mirror" ? 150 : 90} />
      </FigureRow>
    );
  } else
    top = (
      <FigureRow>
        <FigureSvg fig={q.figure} box={box} size={84} look="figure" />
      </FigureRow>
    );
  return (
    <>
      {top}
      <Choices>
        {q.options.map((fig, i) => (
          <FigureSvg key={i} fig={fig} box={box} size={86} />
        ))}
      </Choices>
    </>
  );
}

function answer(q: TransformQuestion) {
  if (q.type === "shift")
    return q.form === "vector" ? (
      <>{vecText(q.vec)}</>
    ) : (
      <span className={styles.keyGrid}>
        <MiniBoard figs={[q.figure]} ops={q.ops} grid={{ x0: 0, y0: 0, x1: q.w, y1: q.h }} size={110} image={moveAll(q.figure, q.ops)} plain />
      </span>
    );
  if (q.type === "draw")
    return (
      <span className={styles.keyGrid}>
        <MiniBoard figs={[q.figure]} ops={[q.op]} grid={{ x0: 0, y0: 0, x1: q.w, y1: q.h }} size={110} image={moveFigure(q.figure, q.op)} plain />
      </span>
    );
  if (q.type === "which") return <>{MOVE_NAME[q.options[q.answer]]}</>;
  return <>گزینه {fa(q.answer + 1)}</>;
}

const CONFIG: WorksheetConfig<TransformQuestionType, TransformQuestion> = {
  title: "تبدیل‌ها: آینه، آب، چرخش، انتقال",
  backHref: "/tools/transforms",
  typeLabels: TRANSFORM_TYPE_LABEL,
  defaultTypes: ["mirror", "water", "draw"],
  make: makeTransformQuestion,
  prompt: (q) => transformPrompt(q, true),
  figures,
  answer,
};

export function TransformsWorksheet() {
  return <WorksheetShell config={CONFIG} />;
}

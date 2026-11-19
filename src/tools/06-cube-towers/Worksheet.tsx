"use client";

// Worksheet for tool 6. Counting on paper shows the tower from the front-right
// corner together with its top view, so the hidden cubes can be reasoned out.

import { makeTowerQuestion, type TowerQuestion, type TowerQuestionType } from "@/generators/cube-towers";
import { Choices, FigureRow, WorksheetShell, type WorksheetConfig } from "@/toolkit/WorksheetShell";
import { fa } from "@/tools/registry";
import { HeightGrid, IsoTower, ViewSvg } from "./Pictures";
import { SolidPictureSvg } from "./SolidPicture";
import { TOWER_TYPE_LABEL, towerPrompt } from "./TowerTryPanel";
import styles from "@/toolkit/Worksheet.module.css";

function figures(q: TowerQuestion) {
  switch (q.type) {
    case "count":
      return (
        <>
          <FigureRow>
            <IsoTower tower={q.tower} size={170} />
            <figure className={styles.caption}>
              <ViewSvg pic={{ kind: "top", cells: q.tower.h.map((r) => r.map((v) => v > 0)) }} size={80} />
              <figcaption>نمای بالا</figcaption>
            </figure>
          </FigureRow>
          <Choices>
            {q.options.map((v, i) => (
              <span key={i} className={styles.bigNum}>{fa(v)}</span>
            ))}
          </Choices>
        </>
      );
    case "top":
    case "front":
    case "side":
      return (
        <>
          <FigureRow>
            <IsoTower tower={q.tower} size={160} />
          </FigureRow>
          <Choices>
            {q.options.map((pic, i) => (
              <ViewSvg key={i} pic={pic} size={70} />
            ))}
          </Choices>
        </>
      );
    case "build":
      return (
        <>
          <FigureRow>
            {q.views.top && (
              <figure className={styles.caption}>
                <ViewSvg pic={{ kind: "top", cells: q.views.top }} size={80} />
                <figcaption>بالا</figcaption>
              </figure>
            )}
            <figure className={styles.caption}>
              <ViewSvg pic={{ kind: "cols", heights: q.views.front }} size={80} />
              <figcaption>روبرو</figcaption>
            </figure>
            <figure className={styles.caption}>
              <ViewSvg pic={{ kind: "cols", heights: q.views.side }} size={80} />
              <figcaption>کنار</figcaption>
            </figure>
          </FigureRow>
          <div className={styles.answerGrid}>
            <HeightGrid tower={{ w: 3, d: 3, h: [[0, 0, 0], [0, 0, 0], [0, 0, 0]] }} maxH={0} />
          </div>
        </>
      );
    case "complete":
      return (
        <>
          <FigureRow>
            <IsoTower tower={q.tower} size={150} />
          </FigureRow>
          <Choices>
            {q.options.map((v, i) => (
              <span key={i} className={styles.bigNum}>{fa(v)}</span>
            ))}
          </Choices>
        </>
      );
    case "solid":
      return (
        <>
          {q.kind === "count" && (
            <FigureRow>
              <SolidPictureSvg solid={q.solid} size={130} />
            </FigureRow>
          )}
          <Choices>
            {q.options.map((v, i) => (
              <span key={i} className={styles.bigNum}>{fa(v)}</span>
            ))}
          </Choices>
        </>
      );
    case "paint":
      return (
        <>
          <FigureRow>
            <IsoTower tower={{ w: q.n, d: q.n, h: Array.from({ length: q.n }, () => Array(q.n).fill(q.n)) }} size={130} />
          </FigureRow>
          <Choices>
            {q.options.map((v, i) => (
              <span key={i} className={styles.bigNum}>{fa(v)}</span>
            ))}
          </Choices>
        </>
      );
  }
}

function answer(q: TowerQuestion) {
  if (q.type === "build")
    return (
      <>
        یک جواب:{" "}
        <span className={styles.keyGrid}>
          <HeightGrid tower={q.tower} maxH={0} />
        </span>{" "}
        (کمترین {fa(q.min)}، بیشترین {fa(q.max)} مکعب)
      </>
    );
  return <>گزینه {fa(q.answer + 1)}</>;
}

const CONFIG: WorksheetConfig<TowerQuestionType, TowerQuestion> = {
  title: "برج مکعب‌ها",
  backHref: "/tools/cube-towers",
  typeLabels: TOWER_TYPE_LABEL,
  defaultTypes: ["count", "front"],
  make: makeTowerQuestion,
  prompt: (q) => towerPrompt(q, true),
  figures,
  answer,
};

export function TowerWorksheet() {
  return <WorksheetShell config={CONFIG} />;
}

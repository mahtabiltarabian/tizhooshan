"use client";

// Worksheet for tool 15: the gear train, the track, the compass or the grid,
// drawn still, with a line for the answer. The answer key adds the working.

import { COMPASS, makeMotionQuestion, type MotionQuestion, type MotionQuestionType } from "@/generators/motion";
import { FigureRow, WorksheetShell, type WorksheetConfig } from "@/toolkit/WorksheetShell";
import { answerFa, motionHow, motionPrompt, MOTION_TYPE_LABEL, unitOf } from "./MotionTryPanel";
import { CompassG, GridG, MachineSvg, TrackG, WalkerG, type TrackMover } from "./Pictures";
import { MapG, questionTags, roadFa } from "./RoadMap";
import { questionSpacing, SpacingG } from "./Spacing";
import styles from "@/toolkit/Worksheet.module.css";

function TrackSvg({ q }: { q: Extract<MotionQuestion, { type: "trip" | "chase" }> }) {
  const a: TrackMover = { mover: { start: 0, speed: q.v1, dir: 1, delay: 0 }, name: "الف", shape: "arrow" };
  const movers: TrackMover[] = [a];
  let length: number;
  if (q.type === "trip") {
    length = q.length;
    if (q.level > 1) movers.push({ mover: { start: q.length, speed: q.v2, dir: -1, delay: 0 }, name: "ب", shape: "round" });
  } else {
    length = q.gap * 3;
    movers.push({ mover: { start: q.gap, speed: q.v2, dir: 1, delay: 0 }, name: "ب", shape: "round" });
  }
  return (
    <svg width={320} height={50} viewBox="0 0 16 2.5" style={{ direction: "ltr" }}>
      <TrackG length={length} distUnit="" movers={movers} t={0} x={1} y={1.1} w={14} bare />
    </svg>
  );
}

function figures(q: MotionQuestion) {
  switch (q.type) {
    case "gearDir":
    case "gearTurns":
      return (
        <>
          <FigureRow>
            <MachineSvg machine={q.machine} driver={q.type === "gearDir" ? q.driver : 0} asked={q.machine.wheels.length - 1} />
          </FigureRow>
          <p className={styles.symbols}>{q.type === "gearDir" ? "جهت: ساعتگرد ↻ ☐   پادساعتگرد ↺ ☐" : "جواب: ............ دور"}</p>
        </>
      );
    case "trip":
    case "chase":
      return (
        <>
          <FigureRow>
            <TrackSvg q={q} />
          </FigureRow>
          <p className={styles.symbols}>جواب: ............ {unitOf(q)}</p>
        </>
      );
    case "orient":
      return (
        <>
          <FigureRow>
            <svg width={150} height={150} viewBox="0 0 8 8" style={{ direction: "ltr" }}>
              <CompassG x={4} y={4} r={2.4} needle={false} />
              <WalkerG x={4} y={4} size={0.9} heading={q.start * 90} />
            </svg>
          </FigureRow>
          <p className={styles.symbols}>رو به: {COMPASS.join(" ☐   ")} ☐</p>
        </>
      );
    case "spacing": {
      const pic = questionSpacing(q, false);
      return (
        <>
          <FigureRow>
            <svg width={320} height={180} viewBox="0 0 16 9" style={{ direction: "ltr" }}>
              <SpacingG scene={pic.scene} gapText={pic.gapText} total={pic.total} sideA={pic.sideA} sideB={pic.sideB} crossed={pic.crossed} floorNotes={pic.floorNotes} thingsOnly={pic.thingsOnly} />
            </svg>
          </FigureRow>
          <p className={styles.symbols}>جواب: ............ {unitOf(q)}</p>
        </>
      );
    }
    case "map":
      return (
        <>
          <FigureRow>
            <svg width={360} height={203} viewBox="0 0.6 16 8.4" style={{ direction: "ltr" }}>
              <MapG map={q.map} tags={questionTags(q)} />
            </svg>
          </FigureRow>
          <p className={styles.symbols}>{q.variant === "close" ? `جاده: ${q.options.map((r) => `${roadFa(q.map, r)} ☐`).join("   ")}` : `جواب: ............ ${unitOf(q)}`}</p>
        </>
      );
    case "grid": {
      if (q.variant === "routes") {
        const cell = 1;
        return (
          <>
            <FigureRow>
              <svg width={40 + q.cols * 34} height={40 + q.rows * 34} viewBox={`-0.6 -0.6 ${q.cols + 1.2} ${q.rows + 1.2}`} style={{ direction: "ltr" }}>
                <GridG cols={q.cols} rows={q.rows} x={0} y={0} cell={cell} start={{ x: 0, y: 0 }} goal={{ x: q.cols, y: q.rows }} />
              </svg>
            </FigureRow>
            <p className={styles.symbols}>جواب: ............ راه</p>
          </>
        );
      }
      return (
        <>
          <FigureRow>
            <svg width={320} height={250} viewBox={`-0.6 -0.6 ${q.cols + 1.2} ${q.rows + 1.2}`} style={{ direction: "ltr" }}>
              <GridG cols={q.cols} rows={q.rows} x={0} y={0} cell={1} start={q.start} points={q.points} walker={q.variant === "turtle" ? { at: [q.start.x, q.start.y], heading: q.facing * 90 } : null} />
            </svg>
          </FigureRow>
          <p className={styles.symbols}>نقطه: ............ (شمال بالاست)</p>
        </>
      );
    }
  }
}

function answer(q: MotionQuestion) {
  return (
    <>
      {answerFa(q)} · <span style={{ fontWeight: 400 }}>{motionHow(q)}</span>
    </>
  );
}

const CONFIG: WorksheetConfig<MotionQuestionType, MotionQuestion> = {
  title: "حرکت و چرخ‌دنده",
  backHref: "/tools/motion",
  typeLabels: MOTION_TYPE_LABEL,
  defaultTypes: ["gearDir", "gearTurns", "trip", "orient"],
  make: (type, level, seed) => makeMotionQuestion(type, level, seed),
  prompt: (q) => motionPrompt(q, true),
  figures,
  answer,
};

export function MotionWorksheet() {
  return <WorksheetShell config={CONFIG} />;
}

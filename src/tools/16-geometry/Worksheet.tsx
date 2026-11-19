"use client";

// Worksheet for tool 16: shapes on a dot grid (the geoboard on paper), angle
// figures, and blank dot grids for building. The answer key adds the working,
// and for build and halving questions one answer drawn small (others count).

import { makeGeometryQuestion, type GeometryQuestion, type GeometryQuestionType } from "@/generators/geometry";
import { Choices, FigureRow, WorksheetShell, type WorksheetConfig } from "@/toolkit/WorksheetShell";
import { degFa } from "./frames";
import { answerFa, choicesOf, GEOMETRY_TYPE_LABEL, geometryHow, geometryPrompt } from "./GeometryTryPanel";
import { AngleFigureG, AngleMark, BandG, EXAMPLE, FigureSvg, GeoSvg } from "./Pictures";
import styles from "@/toolkit/Worksheet.module.css";

function angleFigure(q: Extract<GeometryQuestion, { type: "angle" }>) {
  const a = q.angles;
  const label = (i: number) => {
    if (q.variant === "regular") return i === 0 ? "؟" : null;
    if (q.given.includes(i)) return degFa(a[i]);
    return i === q.ask && q.variant !== "exterior" ? "؟" : null;
  };
  return (
    <FigureSvg width={240} height={160}>
      <AngleFigureG
        angles={a}
        label={label}
        x={0}
        y={0}
        w={8}
        h={160 / 30}
        exterior={q.variant === "exterior" ? "؟" : undefined}
        ticks={q.variant === "isosceles" ? [0, 2] : q.variant === "regular" ? a.map((_, i) => i) : []}
        fontSize={0.62}
      />
    </FigureSvg>
  );
}

function figures(q: GeometryQuestion) {
  switch (q.type) {
    case "area":
    case "perimeter":
      return (
        <>
          <FigureRow>
            <GeoSvg n={q.n} size={150}>
              <BandG pts={q.poly} rings={false} width={3} />
            </GeoSvg>
          </FigureRow>
          <p className={styles.symbols}>{q.type === "area" ? "مساحت: ............ واحد مربع" : "محیط: ............ واحد"}</p>
        </>
      );
    case "angle":
      return (
        <>
          <FigureRow>
            {q.variant === "geo" ? (
              <GeoSvg n={q.n} size={150}>
                <BandG pts={q.arms} closed={false} rings={false} width={3} />
                <AngleMark v={q.arms[1]} p={q.arms[0]} q={q.arms[2]} deg={q.answer} label="؟" strong />
              </GeoSvg>
            ) : (
              angleFigure(q)
            )}
          </FigureRow>
          <p className={styles.symbols}>زاویه: ............ درجه</p>
        </>
      );
    case "classify":
      return (
        <>
          <FigureRow>
            <GeoSvg n={q.n} size={140}>
              <BandG pts={q.poly} closed={q.level > 1} rings={false} width={3} />
            </GeoSvg>
          </FigureRow>
          <Choices>{choicesOf(q.level, true).map((c) => <span key={c}>{c}</span>)}</Choices>
        </>
      );
    case "build":
      return (
        <FigureRow>
          <GeoSvg n={q.n} size={170} />
        </FigureRow>
      );
    case "divide":
      return (
        <FigureRow>
          <GeoSvg n={q.n} size={160}>
            <BandG pts={q.poly} rings={false} width={3} />
          </GeoSvg>
        </FigureRow>
      );
  }
}

function answer(q: GeometryQuestion) {
  const drawn =
    q.type === "build" ? (
      <GeoSvg n={q.n} size={84}>
        <BandG pts={q.example} color={EXAMPLE} rings={false} width={2} />
      </GeoSvg>
    ) : q.type === "divide" ? (
      <GeoSvg n={q.n} size={84}>
        <BandG pts={q.poly} rings={false} width={2} />
        <BandG pts={q.example} closed={false} color={EXAMPLE} rings={false} width={2} />
      </GeoSvg>
    ) : null;
  return (
    <>
      {answerFa(q)} · <span style={{ fontWeight: 400 }}>{geometryHow(q)}</span>
      {drawn && <span style={{ display: "block", textAlign: "center" }}>{drawn}</span>}
    </>
  );
}

const CONFIG: WorksheetConfig<GeometryQuestionType, GeometryQuestion> = {
  title: "هندسه",
  backHref: "/tools/geometry",
  typeLabels: GEOMETRY_TYPE_LABEL,
  defaultTypes: ["area", "perimeter", "angle", "build"],
  make: makeGeometryQuestion,
  prompt: (q) => geometryPrompt(q, true),
  figures,
  answer,
};

export function GeometryWorksheet() {
  return <WorksheetShell config={CONFIG} />;
}

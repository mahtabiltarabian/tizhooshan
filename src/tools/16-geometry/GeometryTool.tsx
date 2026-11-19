"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Board } from "@/engine-2d/Board";
import {
  areaMethod,
  areaOf,
  bandProblem,
  checkBuild,
  checkCut,
  cornerAngles,
  cutParts,
  makeGeometryQuestion,
  perimeterOf,
  ptsFromParam,
  samePt,
  sampleShape,
  type BuildQuestion,
  type DivideQuestion,
  type GeometryQuestion,
  type GeometryQuestionType,
  type Level,
  type ParallelQuestion,
  type Pt,
  type ShapeKind,
} from "@/generators/geometry";
import { newSeed } from "@/generators/random";
import { setClassroom as applyClassroom, useClassroom } from "@/toolkit/classroom";
import { TeacherGuideButton } from "@/toolkit/TeacherGuide";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/ToolLayout.module.css";
import { areaFrames, degFa, ltr, num, perimeterFrames, approxDeg, type Frame } from "./frames";
import { GEOMETRY_TYPE_LABEL, geometryPrompt, GeometryTryPanel, LEVEL_LABEL } from "./GeometryTryPanel";
import { GEOMETRY_GUIDE } from "./guide";
import {
  CIRCLE_R,
  CircleExploreG,
  circleExText,
  circleExView,
  COMP_LIMITS,
  compExText,
  compExView,
  CompositeExploreG,
  figureView,
  fixComp,
  MeasureFigureG,
  SLICES,
  type CircleEx,
  type CompCut,
  type CompEx,
} from "./MeasurePictures";
import { measureFrames, type MeasureQuestion } from "./MeasureText";
import { PAR_RELS, ParallelExploreG, ParallelFigureG, parallelView, parExText, parExView, PHI_RANGE, type ParEx, type ParRel } from "./ParallelPictures";
import { FACT_NAME, parallelFrames } from "./ParallelText";
import { AngleFigureG, AngleMark, BandG, boardView, CellsG, CornerAnglesG, EdgeLabelsG, EXAMPLE, MINE, OverlayG, PegsG, SHAPE, type View } from "./Pictures";

type Mode = "explore" | "show" | "try";
type ShowSource = "sample" | "mine";
/** Explore: the geoboard, a circle, an L shape three ways, or a transversal across two lines. */
type ExArea = "geo" | "circle" | "composite" | "parallel";
/** Show me: counting area on the geoboard, or a circle, composite or parallel-lines question. */
type ShowKind = "area" | "circle" | "composite" | "parallel";
const EX_AREAS: [ExArea, string][] = [
  ["geo", "ژئوبرد"],
  ["circle", "دایره"],
  ["composite", "مساحت ترکیبی"],
  ["parallel", "خطوط موازی"],
];
const SHOW_KINDS: [ShowKind, string][] = [
  ["area", "شمردن مساحت"],
  ["circle", "دایره"],
  ["composite", "مساحت ترکیبی"],
  ["parallel", "خطوط موازی"],
];
const REL_KEYS = PAR_RELS.map(([k]) => k);
const CUTS: [CompCut, string][] = [
  ["h", "برش افقی"],
  ["v", "برش عمودی"],
  ["box", "منهای گوشه"],
];

const TYPES = Object.keys(GEOMETRY_TYPE_LABEL) as GeometryQuestionType[];
const SIZES = [5, 7, 9];
const KINDS: [ShapeKind, string][] = [
  ["rect", "مستطیل"],
  ["triangle", "مثلث"],
  ["polygon", "چندضلعی"],
  ["slanted", "شکل کج"],
];
const SHOW_LEVELS = ["مستطیل", "مثلث و چندضلعی", "شکل کج"];
const FRAME_MS = 2200;
const FIGURE_VIEW: View = [0, 0, 12, 8];
const START_BAND: Pt[] = [
  [1, 1],
  [5, 1],
  [5, 4],
  [1, 4],
];

/** Show-me steps: the area, then the perimeter when every side runs along the grid. */
function framesFor(poly: Pt[]): Frame[] {
  if (bandProblem(poly)) return [{ show: {}, note: "کش از روی خودش رد شده؛ اول در «کشف» شکل درستی بساز." }];
  if (!areaMethod(poly)) return [{ show: {}, note: "این شکل را نمی‌شود با مربع‌ها یا مستطیل دور شمرد (گوشه‌ای درون مستطیل دور است). در «کشف» گوشه‌ها را روی لبه مستطیل دور ببر، یا یک نمونه بگیر." }];
  const frames = areaFrames(poly);
  return perimeterOf(poly) === null ? frames : [...frames, perimeterFrames(poly)[1]];
}

/** Distance from peg p to the segment ab, for adding a peg into the nearest side. */
function segDist(p: Pt, a: Pt, b: Pt) {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

export function GeometryTool() {
  const [mode, setMode] = useState<Mode>("explore");
  const [classroom, setClassroom] = useClassroom();

  // Playback 0 … 1 through the steps.
  const [f, setF] = useState(1);
  const [run, setRun] = useState<{ from: number; ms: number } | null>(null);
  useEffect(() => {
    if (!run) return;
    let frame = 0;
    let start = -1;
    const tick = (now: number) => {
      if (start < 0) start = now;
      const a = Math.min(1, (now - start) / run.ms);
      setF(run.from + (1 - run.from) * a);
      if (a < 1) frame = requestAnimationFrame(tick);
      else setRun(null);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [run]);
  const animate = useCallback((ms: number, from = 0) => {
    setF(from);
    setRun({ from, ms: ms * (1 - from) });
  }, []);

  // Explore
  const [n, setN] = useState(7);
  const [band, setBand] = useState<Pt[]>(START_BAND);
  const [kind, setKind] = useState<ShapeKind>("rect");
  const [showAngles, setShowAngles] = useState(true);
  const [showCells, setShowCells] = useState(false);
  const [exWhat, setExWhat] = useState<ExArea>("geo");
  const [circ, setCirc] = useState<CircleEx>({ r: 3, view: "circ", k: 16 });
  const [comp, setComp] = useState<CompEx>({ W: 8, H: 6, a: 3, b: 2, cut: "h" });
  const [par, setPar] = useState<ParEx>({ phi: 62, tilt: false, rel: "corresponding" });

  // Show me
  const [showSrc, setShowSrc] = useState<ShowSource>("sample");
  const [showLevel, setShowLevel] = useState<Level>(2);
  const [showSeed, setShowSeed] = useState(1616);
  const [mine, setMine] = useState<{ n: number; poly: Pt[] }>({ n: 7, poly: START_BAND });
  const sample = useMemo(() => makeGeometryQuestion("area", showLevel, showSeed), [showLevel, showSeed]);
  const showPoly = showSrc === "mine" ? mine.poly : (sample as Extract<GeometryQuestion, { type: "area" }>).poly;
  const showN = showSrc === "mine" ? mine.n : (sample as Extract<GeometryQuestion, { type: "area" }>).n;
  const [showKind, setShowKind] = useState<ShowKind>("area");
  const showQ = useMemo(() => (showKind === "area" ? null : (makeGeometryQuestion(showKind, showLevel, showSeed) as MeasureQuestion | ParallelQuestion)), [showKind, showLevel, showSeed]);
  const showMeasure = showQ && showQ.type !== "parallel" ? showQ : null;
  const showPar = showQ && showQ.type === "parallel" ? showQ : null;
  const showFrames = () => (showPar ? parallelFrames(showPar) : showMeasure ? measureFrames(showMeasure) : framesFor(showPoly));

  // Try it
  const [tryType, setTryType] = useState<GeometryQuestionType>("area");
  const [tryLevel, setTryLevel] = useState<Level>(1);
  const [seed, setSeed] = useState(1616);
  const [checked, setChecked] = useState<number | null>(null);
  const [tryBand, setTryBand] = useState<Pt[]>([]);
  const question = useMemo(() => makeGeometryQuestion(tryType, tryLevel, seed), [tryType, tryLevel, seed]);

  const frames = useMemo(() => {
    if (mode === "show") return showPar ? parallelFrames(showPar) : showMeasure ? measureFrames(showMeasure) : framesFor(showPoly);
    if (mode === "try" && checked !== null && (question.type === "circle" || question.type === "composite")) return measureFrames(question);
    if (mode === "try" && checked !== null && question.type === "parallel") return parallelFrames(question);
    if (mode === "try" && checked !== null && question.type === "area") return areaFrames(question.poly);
    if (mode === "try" && checked !== null && question.type === "perimeter") return perimeterFrames(question.poly);
    return [];
  }, [mode, showPoly, showMeasure, showPar, question, checked]);
  const at = frames.length ? Math.min(frames.length - 1, Math.round(f * (frames.length - 1))) : 0;
  const frameMs = Math.max(1, frames.length - 1) * FRAME_MS;

  // Shareable links: #try=area&level=2&seed=7(&a=7.5 or &a=0-0_3-0_3-2), #show=sample&level=3&seed=5,
  // #show=mine&n=7&p=1-1_5-1_5-4, #n=7&p=… (explore), #f=0.5, #classroom;
  // circle and composite: #try=circle&level=2&seed=7(&a=28.26), #show=composite&level=3&seed=5,
  // #explore=circle&r=3&view=area&k=16, #explore=composite&w=8&h=6&a=3&b=2&cut=v;
  // parallel lines: #try=parallel&level=2&seed=7(&a=115), #show=parallel&level=3&seed=5, #explore=parallel&phi=62&tilt=1&rel=alternate (rel=none for no pair)
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.has("classroom")) applyClassroom(true);
    const tryParam = params.get("try");
    const show = params.get("show");
    const timer = setTimeout(() => {
      const lv = Number(params.get("level"));
      const level = lv === 1 || lv === 2 || lv === 3 ? (lv as Level) : null;
      const sd = Number(params.get("seed"));
      const sdOk = params.has("seed") && Number.isInteger(sd) && sd >= 0;
      const nn = Number(params.get("n"));
      const size = SIZES.includes(nn) ? nn : 7;
      if (tryParam && (TYPES as string[]).includes(tryParam)) {
        const type = tryParam as GeometryQuestionType;
        setMode("try");
        setTryType(type);
        if (level) setTryLevel(level);
        if (sdOk) setSeed(sd);
        const a = params.get("a");
        if (a !== null) {
          if (type === "build" || type === "divide") {
            const q = makeGeometryQuestion(type, level ?? 1, sdOk ? sd : 1616) as BuildQuestion | DivideQuestion;
            const pts = ptsFromParam(a, q.n);
            if (pts && (type === "build" ? pts.length >= 3 : pts.length === 2)) {
              setTryBand(pts);
              setChecked(0);
            }
          } else if (Number.isFinite(Number(a)) && a !== "") setChecked(Number(a));
          setF(1);
        } else setF(0);
      } else if (show === "circle" || show === "composite" || show === "parallel") {
        setMode("show");
        setShowKind(show);
        if (level) setShowLevel(level);
        if (sdOk) setShowSeed(sd);
        setF(1);
      } else if (show === "sample" || show === "mine") {
        setMode("show");
        setShowSrc(show);
        if (level) setShowLevel(level);
        if (sdOk) setShowSeed(sd);
        const pts = ptsFromParam(params.get("p"), size);
        if (show === "mine" && pts && pts.length >= 3) setMine({ n: size, poly: pts });
        setF(1);
      } else if (params.get("explore") === "circle") {
        const r = Number(params.get("r"));
        const k = Number(params.get("k"));
        setExWhat("circle");
        setCirc({ r: CIRCLE_R.includes(r) ? r : 3, view: params.get("view") === "area" ? "area" : "circ", k: SLICES.includes(k) ? k : 16 });
      } else if (params.get("explore") === "parallel") {
        const phi = Number(params.get("phi"));
        const rel = params.get("rel");
        setExWhat("parallel");
        setPar({
          phi: params.has("phi") && Number.isInteger(phi) && phi >= PHI_RANGE[0] && phi <= PHI_RANGE[1] ? phi : 62,
          tilt: params.get("tilt") === "1",
          rel: rel === "none" ? null : rel && (REL_KEYS as string[]).includes(rel) ? (rel as ParRel) : "corresponding",
        });
      } else if (params.get("explore") === "composite") {
        const get = (key: string, lo: number, hi: number, d: number) => {
          const v = Number(params.get(key));
          return params.has(key) && Number.isInteger(v) && v >= lo && v <= hi ? v : d;
        };
        const cut = params.get("cut");
        setExWhat("composite");
        setComp(fixComp({ W: get("w", ...COMP_LIMITS.W, 8), H: get("h", ...COMP_LIMITS.H, 6), a: get("a", 1, 9, 3), b: get("b", 1, 7, 2), cut: cut === "v" || cut === "box" ? cut : "h" }));
      } else {
        const pts = ptsFromParam(params.get("p"), size);
        if (pts && pts.length >= 3) {
          setN(size);
          setBand(pts);
        }
      }
      const ff = Number(params.get("f"));
      if (params.has("f") && Number.isFinite(ff)) setF(Math.min(1, Math.max(0, ff)));
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const switchMode = (m: Mode) => {
    setMode(m);
    setRun(null);
    setF(m === "show" ? 0 : 1);
  };

  const freshTry = (type = tryType, level = tryLevel) => {
    setTryType(type);
    setTryLevel(level);
    setSeed(newSeed());
    setChecked(null);
    setTryBand([]);
    setRun(null);
    setF(0);
  };
  const freshShow = (level = showLevel, kind = showKind) => {
    setShowKind(kind);
    setShowSrc("sample");
    setShowLevel(level);
    setShowSeed(newSeed());
    setRun(null);
    setF(0);
  };
  const freshExplore = (k = kind, size = n) => {
    setKind(k);
    setN(size);
    setBand(sampleShape(k, size, newSeed()));
  };
  const showMine = () => {
    setMine({ n, poly: band });
    setShowKind("area");
    setShowSrc("mine");
    setMode("show");
    animate(Math.max(1, framesFor(band).length - 1) * FRAME_MS);
  };

  const play = () => {
    if (run) return setRun(null);
    animate(frameMs, f >= 0.99 ? 0 : f);
  };
  const stepTo = (i: number) => {
    setRun(null);
    setF(frames.length > 1 ? Math.max(0, Math.min(1, i / (frames.length - 1))) : 1);
  };

  // ── Pegs on the board: drag a corner, or tap a peg ──────────────────
  const editing: "explore" | "build" | "divide" | null =
    mode === "explore" ? (exWhat === "geo" ? "explore" : null) : mode === "try" && checked === null && (question.type === "build" || question.type === "divide") ? question.type : null;
  const boardN = mode === "explore" ? n : mode === "show" ? showN : "n" in question ? question.n : 7;
  const editBand = mode === "explore" ? band : tryBand;
  const setEditBand = mode === "explore" ? setBand : setTryBand;
  const drag = useRef<{ start: Pt; vertex: number; at: Pt; moved: boolean } | null>(null);

  const boardPoint = (e: React.PointerEvent<SVGRectElement>): [number, number] => {
    const ctm = e.currentTarget.ownerSVGElement?.getScreenCTM();
    if (!ctm) return [-9, -9];
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return [p.x, p.y];
  };
  const clampPeg = ([x, y]: [number, number]): Pt => [Math.max(0, Math.min(boardN - 1, Math.round(x))), Math.max(0, Math.min(boardN - 1, Math.round(y)))];

  const tap = (peg: Pt) => {
    const i = editBand.findIndex((q) => samePt(q, peg));
    if (editing === "explore") {
      if (i >= 0) {
        if (editBand.length > 3) setBand(editBand.filter((_, j) => j !== i));
        return;
      }
      // Stretch the nearest side of the band out to this peg.
      const dists = editBand.map((a, j) => segDist(peg, a, editBand[(j + 1) % editBand.length]));
      const best = dists.indexOf(Math.min(...dists));
      setBand([...editBand.slice(0, best + 1), peg, ...editBand.slice(best + 1)]);
    } else if (editing === "build") {
      if (i === editBand.length - 1) setTryBand(editBand.slice(0, -1));
      else if (i < 0 && editBand.length < 16) setTryBand([...editBand, peg]);
    } else if (editing === "divide") {
      if (i >= 0) setTryBand(editBand.filter((_, j) => j !== i));
      else setTryBand(editBand.length < 2 ? [...editBand, peg] : [editBand[0], peg]);
    }
  };

  const down = (e: React.PointerEvent<SVGRectElement>) => {
    if (!editing) return;
    const p = boardPoint(e);
    const peg = clampPeg(p);
    if (Math.hypot(p[0] - peg[0], p[1] - peg[1]) > 0.45) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const vertex = editing === "divide" ? -1 : editBand.findIndex((q) => samePt(q, peg));
    drag.current = { start: peg, vertex, at: peg, moved: false };
  };
  const move = (e: React.PointerEvent<SVGRectElement>) => {
    const d = drag.current;
    if (!d || d.vertex < 0) return;
    const peg = clampPeg(boardPoint(e));
    if (samePt(peg, d.at) || editBand.some((q, j) => j !== d.vertex && samePt(q, peg))) return;
    d.at = peg;
    d.moved = true;
    const i = d.vertex;
    setEditBand((b) => b.map((q, j) => (j === i ? peg : q)));
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) tap(d.start);
  };

  // ── Board ───────────────────────────────────────────────────────────
  let view: View = boardView(boardN);
  let label = "ژئوبرد";
  let scene: React.ReactNode = null;
  const exProblem = bandProblem(band);
  const fr = frames.length ? frames[at] : null;

  if (mode === "explore" && exWhat === "parallel") {
    view = parExView();
    label = "دو خط و یک خط مورب؛ دایره‌های سر مورب را بکش تا بچرخد";
    scene = <ParallelExploreG ex={par} onPhi={(phi) => setPar((e) => ({ ...e, phi }))} />;
  } else if (mode === "show" && showPar) {
    view = parallelView(showPar.fig);
    label = GEOMETRY_TYPE_LABEL.parallel;
    scene = <ParallelFigureG fig={showPar.fig} show={fr?.show} />;
  } else if (mode === "explore" && exWhat === "circle") {
    view = circleExView(circ);
    label = circ.view === "circ" ? "دایره و محیط باز شده آن" : "دایره و برش‌هایش کنار هم";
    scene = <CircleExploreG ex={circ} />;
  } else if (mode === "explore" && exWhat === "composite") {
    view = compExView();
    label = "شکل L روی شبکه سانتی‌متری";
    scene = <CompositeExploreG ex={comp} />;
  } else if (mode === "explore") {
    label = "ژئوبرد؛ گوشه‌های کش را بکش یا میخ‌ها را لمس کن";
    scene = (
      <>
        <PegsG n={n} grid={showCells} />
        {showCells && !exProblem && <CellsG poly={band} mode="all" />}
        <BandG pts={band} color={exProblem ? MINE : SHAPE} dashed={!!exProblem} />
        {showAngles && !exProblem && <CornerAnglesG poly={band} />}
      </>
    );
  } else if (mode === "show" && showMeasure) {
    view = figureView(showMeasure.fig);
    label = GEOMETRY_TYPE_LABEL[showMeasure.type];
    scene = <MeasureFigureG fig={showMeasure.fig} show={fr?.show} />;
  } else if (mode === "show") {
    scene = (
      <>
        <PegsG n={showN} grid={!!fr?.show.cells || !!fr?.show.box} />
        {fr && <OverlayG poly={showPoly} show={fr.show} />}
        <BandG pts={showPoly} fill={fr?.show.cells ? "none" : undefined} />
        {fr?.show.edges && <EdgeLabelsG poly={showPoly} />}
      </>
    );
  } else {
    const q = question;
    const done = checked !== null;
    switch (q.type) {
      case "circle":
      case "composite":
        view = figureView(q.fig);
        label = GEOMETRY_TYPE_LABEL[q.type];
        scene = <MeasureFigureG fig={q.fig} show={done ? fr?.show : undefined} />;
        break;
      case "parallel":
        view = parallelView(q.fig);
        label = GEOMETRY_TYPE_LABEL.parallel;
        scene = <ParallelFigureG fig={q.fig} show={done ? fr?.show : undefined} />;
        break;
      case "area":
      case "perimeter":
        scene = (
          <>
            <PegsG n={q.n} grid={done && !!fr?.show.cells} />
            {done && fr && <OverlayG poly={q.poly} show={fr.show} />}
            <BandG pts={q.poly} fill={done && fr?.show.cells ? "none" : undefined} />
            {done && fr?.show.edges && <EdgeLabelsG poly={q.poly} />}
          </>
        );
        break;
      case "angle":
        if (q.variant === "geo") {
          const [p, v, r] = q.arms;
          scene = (
            <>
              <PegsG n={q.n} grid={done} />
              <BandG pts={q.arms} closed={false} />
              <AngleMark v={v} p={p} q={r} deg={q.answer} label={done ? degFa(q.answer) : "؟"} strong />
            </>
          );
        } else {
          view = FIGURE_VIEW;
          label = "شکل زاویه‌ها";
          const a = q.angles;
          const labelOf = (i: number) => {
            if (q.variant === "regular") return i === 0 ? (done ? degFa(q.answer) : "؟") : null;
            if (q.variant === "exterior") return q.given.includes(i) ? degFa(a[i]) : done ? degFa(a[i]) : null;
            if (q.given.includes(i)) return degFa(a[i]);
            if (i === q.ask) return done ? degFa(q.answer) : "؟";
            return done ? degFa(a[i]) : null;
          };
          scene = (
            <AngleFigureG
              angles={a}
              label={labelOf}
              x={0}
              y={0}
              w={12}
              h={8}
              exterior={q.variant === "exterior" ? (done ? degFa(q.answer) : "؟") : undefined}
              ticks={q.variant === "isosceles" ? [0, 2] : q.variant === "regular" ? a.map((_, i) => i) : []}
            />
          );
        }
        break;
      case "classify": {
        const open = q.level === 1;
        scene = (
          <>
            <PegsG n={q.n} grid={done} />
            <BandG pts={q.poly} closed={!open} />
            {done &&
              (open ? (
                <AngleMark v={q.poly[1]} p={q.poly[0]} q={q.poly[2]} deg={angleDeg(q.poly)} label={approxDeg(angleDeg(q.poly))} strong />
              ) : (
                <CornerAnglesG poly={q.poly} strong={[q.corner]} />
              ))}
          </>
        );
        break;
      }
      case "build": {
        const result = done ? checkBuild(q, tryBand) : null;
        scene = (
          <>
            <PegsG n={q.n} grid />
            {result && result.tag !== "right" && <BandG pts={q.example} color={EXAMPLE} dashed fill="none" />}
            {!done && tryBand.length >= 3 && <BandG pts={[tryBand[tryBand.length - 1], tryBand[0]]} closed={false} color={MINE} dashed rings={false} width={3} />}
            <BandG pts={tryBand} closed={done && tryBand.length >= 3} color={MINE} />
          </>
        );
        break;
      }
      case "divide": {
        const result = done && tryBand.length === 2 ? checkCut(q, tryBand[0], tryBand[1]) : null;
        const parts = result?.parts ? cutParts(q.poly, tryBand[0], tryBand[1]) : null;
        scene = (
          <>
            <PegsG n={q.n} grid={done} />
            <BandG pts={q.poly} />
            {parts && <PartsG parts={parts} />}
            {result && result.tag !== "right" && <BandG pts={q.example} closed={false} color={EXAMPLE} dashed />}
            <BandG pts={tryBand} closed={false} color={MINE} />
          </>
        );
        break;
      }
    }
  }

  // Explore readouts
  const exArea = exProblem ? null : areaOf(band);
  const exPerim = exProblem ? null : perimeterOf(band);
  const exAngles = exProblem ? [] : cornerAngles(band);
  const exSum = (band.length - 2) * 180;

  const inTry = mode === "try";
  const showSlider = frames.length > 0;
  const note = fr ? fr.note : "";

  return (
    <main className={styles.layout}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          → همه ابزارها
        </Link>
        <h1>
          <span className={styles.badge}>{fa(16)}</span> هندسه
        </h1>
        <div className={styles.tabs} role="tablist" aria-label="حالت ابزار">
          <button role="tab" aria-selected={mode === "explore"} onClick={() => switchMode("explore")}>
            کشف: کش بکش
          </button>
          <button
            role="tab"
            aria-selected={mode === "show"}
            onClick={() => {
              switchMode("show");
              animate(Math.max(1, showFrames().length - 1) * FRAME_MS);
            }}
          >
            نشانم بده
          </button>
          <button role="tab" aria-selected={mode === "try"} onClick={() => switchMode("try")}>
            امتحان کن
          </button>
        </div>
        <div className={styles.teacher}>
          <button aria-pressed={classroom} onClick={() => setClassroom(!classroom)}>
            {classroom ? "خروج از حالت کلاس" : "حالت کلاس"}
          </button>
          <TeacherGuideButton guide={GEOMETRY_GUIDE} />
          <Link href={`/tools/geometry/worksheet?types=${tryType}&level=${tryLevel}`}>کاربرگ</Link>
        </div>
      </header>

      <section className={styles.stageWrap} aria-label="صفحه ژئوبرد">
        <Board view={view} imageName="geometry" label={label}>
          {scene}
          {editing && (
            <rect
              x={-0.5}
              y={-0.5}
              width={boardN}
              height={boardN}
              fill="transparent"
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={() => (drag.current = null)}
              style={{ cursor: "pointer", touchAction: "none" }}
            />
          )}
        </Board>
      </section>

      <section className={styles.controls}>
        {showSlider ? (
          <>
            <label className={styles.slider}>
              <button className={styles.playSmall} onClick={play} aria-label={run ? "توقف" : "پخش"}>
                {run ? "⏸" : "▶"}
              </button>
              <span>
                قدم {fa(at + 1)} از {fa(frames.length)}
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.001}
                value={f}
                onChange={(e) => {
                  setRun(null);
                  setF(Number(e.target.value));
                }}
                aria-label="پیشرفت"
              />
            </label>
            <p className={styles.stepText} style={{ margin: 0, flex: "1 1 100%", textAlign: "start", lineHeight: 1.9 }} aria-live="polite">
              {note}
            </p>
          </>
        ) : (
          <p className={styles.stepText} style={{ margin: 0 }}>
            {inTry
              ? "اول فکر کن، بعد جواب بده"
              : exWhat === "parallel"
                ? `زاویه مورب با خط بالا: ${fa(par.phi)}° · ${parExText(par)[1]}`
                : exWhat === "circle"
                ? circleExText(circ).join(" · ")
                : exWhat === "composite"
                  ? compExText(comp)
                  : exProblem
                ? "کش از روی خودش رد شده؛ یک گوشه را جابه‌جا کن."
                : `مساحت ${num(exArea!)} واحد مربع · ${exPerim === null ? "ضلع کج دارد" : `محیط ${fa(exPerim)} واحد`} · ${fa(band.length)} گوشه`}
          </p>
        )}
      </section>

      <aside className={styles.side}>
        {mode === "explore" && (
          <div className={styles.chipsRow} role="radiogroup" aria-label="چه چیزی را کشف کنیم" style={{ marginTop: 0 }}>
            {EX_AREAS.map(([k, name]) => (
              <button key={k} role="radio" aria-checked={exWhat === k} onClick={() => setExWhat(k)}>
                {name}
              </button>
            ))}
          </div>
        )}
        {mode === "explore" && exWhat === "circle" && <CirclePanel ex={circ} set={setCirc} />}
        {mode === "explore" && exWhat === "composite" && <CompositePanel ex={comp} set={(e) => setComp(fixComp(e))} />}
        {mode === "explore" && exWhat === "parallel" && <ParallelPanel ex={par} set={setPar} />}
        {mode === "explore" && exWhat === "geo" && (
          <>
            <h2>کش را روی ژئوبرد بکش</h2>
            <p className={styles.note}>گوشه‌های کش (حلقه‌ها) را بکش و روی میخ دیگری بگذار. میخ خالی را لمس کنی، نزدیک‌ترین ضلع کش به آن کشیده می‌شود؛ گوشه را لمس کنی، برداشته می‌شود.</p>
            <p className={`${styles.status} ${exProblem ? styles.warn : styles.info}`}>
              {exProblem ? (
                "⚠ کش از روی خودش رد شده یا صاف مانده؛ این شکل مساحت ندارد."
              ) : (
                <>
                  مساحت: {num(exArea!)} واحد مربع
                  <br />
                  محیط: {exPerim === null ? "ضلع کج دارد؛ طول ضلع کج را با شمردن نمی‌شود گفت." : `${fa(exPerim)} واحد`}
                  <br />
                  زاویه‌ها: {exAngles.map((x) => approxDeg(x.deg)).join("، ")}
                  <br />
                  جمع زاویه‌ها: {ltr(`(${fa(band.length)} − ۲) × ۱۸۰ = ${fa(exSum)}`)}
                </>
              )}
            </p>
            <div className={styles.row}>
              <button className={styles.toggle} aria-pressed={showAngles} onClick={() => setShowAngles(!showAngles)}>
                {showAngles ? "✓ " : ""}زاویه‌ها
              </button>
              <button className={styles.toggle} aria-pressed={showCells} onClick={() => setShowCells(!showCells)}>
                {showCells ? "✓ " : ""}مربع‌های واحد
              </button>
            </div>

            <h2 className={styles.progress}>نمونه تازه</h2>
            <div className={styles.chipsRow} role="radiogroup" aria-label="اندازه ژئوبرد">
              {SIZES.map((s) => (
                <button key={s} role="radio" aria-checked={n === s} onClick={() => freshExplore(kind, s)}>
                  {fa(s)}×{fa(s)} میخ
                </button>
              ))}
            </div>
            <div className={styles.chipsRow} role="radiogroup" aria-label="نوع شکل" style={{ marginTop: 6, flexWrap: "wrap" }}>
              {KINDS.map(([k, name]) => (
                <button key={k} role="radio" aria-checked={kind === k} onClick={() => freshExplore(k, n)} style={{ flex: "1 0 40%" }}>
                  {name}
                </button>
              ))}
            </div>
            <div className={styles.row} style={{ marginTop: 8 }}>
              <button className={styles.clear} onClick={() => freshExplore()}>
                نمونه تازه
              </button>
              <button className={styles.clear} onClick={showMine} disabled={!!exProblem}>
                نشانم بده: مساحت همین شکل
              </button>
            </div>
          </>
        )}

        {mode === "show" && (
          <div className={styles.chipsRow} role="radiogroup" aria-label="نوع نمونه" style={{ marginTop: 0 }}>
            {SHOW_KINDS.map(([k, name]) => (
              <button
                key={k}
                role="radio"
                aria-checked={showKind === k}
                onClick={() => {
                  freshShow(showLevel, k);
                }}
              >
                {name}
              </button>
            ))}
          </div>
        )}
        {mode === "show" && showQ && (
          <>
            <h2>{GEOMETRY_TYPE_LABEL[showQ.type]}</h2>
            <div className={styles.chipsRow} role="radiogroup" aria-label="سطح" style={{ flexWrap: "wrap" }}>
              {LEVEL_LABEL[showQ.type].map((name, i) => (
                <button key={name} role="radio" aria-checked={showLevel === i + 1} onClick={() => freshShow((i + 1) as Level)} style={{ flex: "1 0 30%" }}>
                  {name}
                </button>
              ))}
            </div>
            <p className={styles.note}>{geometryPrompt(showQ)}</p>
            <div className={styles.row} style={{ marginTop: 8 }}>
              <button className={styles.clear} onClick={() => stepTo(at - 1)} disabled={at === 0}>
                → قدم قبل
              </button>
              <button className={styles.clear} onClick={() => stepTo(at + 1)} disabled={at >= frames.length - 1}>
                قدم بعد ←
              </button>
            </div>
            <p className={styles.note}>
              {showQ.type === "parallel"
                ? `هر قدم نام یک دلیل را می‌گوید (${[FACT_NAME.vertical, FACT_NAME.linear, FACT_NAME.corresponding, FACT_NAME.alternate].join("، ")} …). زاویه‌هایی که آن قدم به کار می‌برد پررنگ می‌شوند و زاویه‌ای که پیدا می‌شود عددش در قاب خط‌چین است. زاویه‌های برابر شمار کمان یکسان دارند.`
                : showQ.type === "circle"
                ? "تکه‌ای که هر قدم درباره‌اش است خط‌چین نارنجی و پررنگ می‌شود؛ طولی که پیدا می‌شود در قاب خط‌چین نوشته می‌شود."
                : "هر تکه خط‌چین نارنجی می‌شود و اسم و مساحتش رویش نوشته می‌شود؛ تکه‌ای که کم می‌شود «−» دارد. طولی که پیدا می‌شود در قاب خط‌چین است."}
            </p>
            <button className={styles.clear} onClick={() => freshShow()}>
              نمونه تازه
            </button>
          </>
        )}
        {mode === "show" && !showQ && (
          <>
            <h2>شمردن مساحت</h2>
            <div className={styles.chipsRow} role="radiogroup" aria-label="نوع شکل" style={{ flexWrap: "wrap" }}>
              {SHOW_LEVELS.map((name, i) => (
                <button key={name} role="radio" aria-checked={showSrc === "sample" && showLevel === i + 1} onClick={() => freshShow((i + 1) as Level)} style={{ flex: "1 0 40%" }}>
                  {name}
                </button>
              ))}
              <button role="radio" aria-checked={showSrc === "mine"} onClick={showMine} style={{ flex: "1 0 40%" }}>
                شکل من (از کشف)
              </button>
            </div>
            <div className={styles.row} style={{ marginTop: 8 }}>
              <button className={styles.clear} onClick={() => stepTo(at - 1)} disabled={at === 0}>
                → قدم قبل
              </button>
              <button className={styles.clear} onClick={() => stepTo(at + 1)} disabled={at >= frames.length - 1}>
                قدم بعد ←
              </button>
            </div>
            <p className={styles.note}>
              {areaMethod(showPoly) === "box"
                ? "ضلع‌های کج مربع‌ها را تکه‌تکه می‌کنند. پس مستطیل دور شکل (خط‌چین) را می‌کشیم و مثلث‌های گوشه (هاشورخورده، با عدد مساحت) را از آن کم می‌کنیم. هر مثلث گوشه نصف یک مستطیل است."
                : "مربع‌های کامل شماره دارند و هاشور مورب؛ نیم‌مربع‌ها نقطه‌دارند و «½» دارند. هر دو نیم‌مربع یک مربع کامل می‌شوند."}
            </p>
            <button className={styles.clear} onClick={() => freshShow()}>
              نمونه تازه
            </button>
          </>
        )}

        {mode === "try" && (
          <GeometryTryPanel
            key={`${tryType}-${tryLevel}-${seed}`}
            question={question}
            type={tryType}
            level={tryLevel}
            checked={checked}
            onCheck={(v) => {
              setChecked(v);
              if (question.type === "circle" || question.type === "composite") animate(Math.max(1, measureFrames(question).length - 1) * FRAME_MS);
              else if (question.type === "parallel") animate(Math.max(1, parallelFrames(question).length - 1) * FRAME_MS);
              else if (question.type === "area" || question.type === "perimeter") animate(Math.max(1, (question.type === "area" ? areaFrames(question.poly) : perimeterFrames(question.poly)).length - 1) * FRAME_MS);
              else setF(1);
            }}
            band={tryBand}
            onUndo={() => setTryBand((b) => b.slice(0, -1))}
            onClear={() => setTryBand([])}
            onType={(t) => freshTry(t, tryLevel)}
            onLevel={(l) => freshTry(tryType, l)}
            onNew={() => freshTry()}
          />
        )}
      </aside>
    </main>
  );
}

/** The angle at the corner of two arms [end, corner, end], in degrees. */
function angleDeg([p, v, r]: Pt[]) {
  const u = [p[0] - v[0], p[1] - v[1]];
  const w = [r[0] - v[0], r[1] - v[1]];
  return (Math.atan2(Math.abs(u[0] * w[1] - u[1] * w[0]), u[0] * w[0] + u[1] * w[1]) * 180) / Math.PI;
}

/** The two parts of a cut: one hatched, one dotted, each with its area. */
function PartsG({ parts }: { parts: [Pt[], Pt[]] }) {
  return (
    <g pointerEvents="none">
      {parts.map((part, i) => {
        const cx = part.reduce((s, p) => s + p[0], 0) / part.length;
        const cy = part.reduce((s, p) => s + p[1], 0) / part.length;
        return (
          <g key={i}>
            <polygon points={part.map((p) => p.join(",")).join(" ")} fill={i ? "#ffe2b8" : "#cfe3fb"} stroke="none" />
            <text x={Math.round(cx * 1e4) / 1e4} y={Math.round(cy * 1e4) / 1e4} fontSize={0.4} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill="#1f2430" style={{ paintOrder: "stroke", stroke: "#fffaf0", strokeWidth: 0.09 }}>
              {i ? "ب" : "الف"}: {num(areaOf(part))}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function Stepper({ label, onLess, onMore, lessOff, moreOff }: { label: string; onLess: () => void; onMore: () => void; lessOff: boolean; moreOff: boolean }) {
  return (
    <div className={styles.row} style={{ marginTop: 6 }}>
      <button className={styles.clear} onClick={onLess} disabled={lessOff} aria-label={`${label}: کمتر`}>
        −
      </button>
      <span className={styles.stepperLabel}>{label}</span>
      <button className={styles.clear} onClick={onMore} disabled={moreOff} aria-label={`${label}: بیشتر`}>
        +
      </button>
    </div>
  );
}

/** Explore a circle: its radius, and how its circumference and area come about. */
function CirclePanel({ ex, set }: { ex: CircleEx; set: (e: CircleEx) => void }) {
  return (
    <>
      <h2>دایره را بزرگ و کوچک کن</h2>
      <Stepper label={`شعاع ${fa(ex.r)} سانتی‌متر`} onLess={() => set({ ...ex, r: ex.r - 1 })} onMore={() => set({ ...ex, r: ex.r + 1 })} lessOff={ex.r <= CIRCLE_R[0]} moreOff={ex.r >= CIRCLE_R[CIRCLE_R.length - 1]} />
      <div className={styles.chipsRow} role="radiogroup" aria-label="چه ببینیم">
        <button role="radio" aria-checked={ex.view === "circ"} onClick={() => set({ ...ex, view: "circ" })}>
          محیط: باز کردن
        </button>
        <button role="radio" aria-checked={ex.view === "area"} onClick={() => set({ ...ex, view: "area" })}>
          مساحت: برش‌ها
        </button>
      </div>
      {ex.view === "area" && (
        <div className={styles.chipsRow} role="radiogroup" aria-label="تعداد برش">
          {SLICES.map((k) => (
            <button key={k} role="radio" aria-checked={ex.k === k} onClick={() => set({ ...ex, k })}>
              {fa(k)} برش
            </button>
          ))}
        </div>
      )}
      <p className={`${styles.status} ${styles.info}`}>
        {circleExText(ex).map((line, i) => (
          <span key={i}>
            {i > 0 && <br />}
            {line}
          </span>
        ))}
      </p>
      <p className={styles.note}>
        {ex.view === "circ"
          ? "دایره را روی خط بغلتان: دورش کمی بیشتر از سه قطر است (۳٫۱۴ قطر). پس محیط = قطر × ۳٫۱۴. شعاع را عوض کن: این نسبت همیشه همین است."
          : "دایره را برش بزن و برش‌ها را یکی در میان وارونه کنار هم بچین: تقریباً مستطیلی می‌شود که پهنایش نصف محیط (۳٫۱۴ × شعاع) و بلندی‌اش شعاع است. برش‌ها را بیشتر کن تا صاف‌تر شود. پس مساحت = شعاع × شعاع × ۳٫۱۴."}
      </p>
    </>
  );
}

/** Explore an L shape: split it two ways or take a corner off a rectangle; the area stays the same. */
function CompositePanel({ ex, set }: { ex: CompEx; set: (e: CompEx) => void }) {
  const step = (key: "W" | "H" | "a" | "b", label: string, lo: number, hi: number) => (
    <Stepper key={key} label={`${label} ${fa(ex[key])}`} onLess={() => set({ ...ex, [key]: ex[key] - 1 })} onMore={() => set({ ...ex, [key]: ex[key] + 1 })} lessOff={ex[key] <= lo} moreOff={ex[key] >= hi} />
  );
  return (
    <>
      <h2>یک شکل، سه راه</h2>
      {step("W", "پهنای پایین", Math.max(COMP_LIMITS.W[0], ex.a + 1), COMP_LIMITS.W[1])}
      {step("H", "بلندی چپ", Math.max(COMP_LIMITS.H[0], ex.b + 1), COMP_LIMITS.H[1])}
      {step("a", "پهنای بالا", 1, ex.W - 1)}
      {step("b", "بلندی راست", 1, ex.H - 1)}
      <div className={styles.chipsRow} role="radiogroup" aria-label="راه حساب کردن">
        {CUTS.map(([k, name]) => (
          <button key={k} role="radio" aria-checked={ex.cut === k} onClick={() => set({ ...ex, cut: k })}>
            {name}
          </button>
        ))}
      </div>
      <p className={`${styles.status} ${styles.info}`}>مساحت: {compExText(ex)}</p>
      <p className={styles.note}>
        راه را عوض کن: تکه‌ها فرق می‌کنند ولی مساحت همان می‌ماند. در «برش افقی» و «برش عمودی» هر تکه فقط یک بار حساب می‌شود؛ در «منهای گوشه» مستطیل دور شکل را می‌گیریم و گوشه خالی را کم می‌کنیم. طول ضلع‌های داخلی را از ضلع‌های روبه‌رو پیدا کن.
      </p>
    </>
  );
}

/** Explore parallel lines: turn the transversal, point out a pair of angles, or make the bottom line not parallel. */
function ParallelPanel({ ex, set }: { ex: ParEx; set: (e: ParEx) => void }) {
  const turn = (by: number) => set({ ...ex, phi: Math.max(PHI_RANGE[0], Math.min(PHI_RANGE[1], ex.phi + by)) });
  return (
    <>
      <h2>خط مورب را بچرخان</h2>
      <p className={styles.note}>دایره‌های دو سر خط مورب (آبی) را بکش. هشت زاویه با هم عوض می‌شوند؛ زاویه‌های برابر یک‌جور کمان دارند (یک کمان، دو کمان …) و عددشان هم یکی است.</p>
      <Stepper label={`زاویه مورب ${fa(ex.phi)}°`} onLess={() => turn(-5)} onMore={() => turn(5)} lessOff={ex.phi <= PHI_RANGE[0]} moreOff={ex.phi >= PHI_RANGE[1]} />
      <div className={styles.chipsRow} role="radiogroup" aria-label="کدام دو زاویه" style={{ flexWrap: "wrap" }}>
        {PAR_RELS.map(([k, name]) => (
          <button key={k} role="radio" aria-checked={ex.rel === k} onClick={() => set({ ...ex, rel: ex.rel === k ? null : k })} style={{ flex: "1 0 28%" }}>
            {name}
          </button>
        ))}
      </div>
      <div className={styles.row}>
        <button className={styles.toggle} aria-pressed={ex.tilt} onClick={() => set({ ...ex, tilt: !ex.tilt })}>
          {ex.tilt ? "✓ " : ""}خط پایین را کج کن (موازی نباشد)
        </button>
      </div>
      <p className={`${styles.status} ${styles.info}`}>
        {parExText(ex).map((line, i) => (
          <span key={i}>
            {i > 0 && <br />}
            {line}
          </span>
        ))}
      </p>
      <p className={styles.note}>دو زاویه‌ای که انتخاب کردی پررنگ‌اند و عددشان در قاب خط‌چین است. «روبه‌رو» و «کنار هم» همیشه درست‌اند؛ «هم‌جا»، «Z» و «C» فقط وقتی که دو خط موازی باشند (علامت فلش).</p>
    </>
  );
}

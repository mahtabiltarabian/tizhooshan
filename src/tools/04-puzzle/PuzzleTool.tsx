"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Board } from "@/engine-2d/Board";
import {
  makePuzzleQuestion,
  moveCells,
  normalize,
  PIECES,
  polyTris,
  SIMPLE_SET,
  simpleFigures,
  solveOnce,
  TANGRAM,
  tangramFigures,
  type Level,
  type PieceKind,
  type Placement,
  type PuzzleQuestion,
  type PuzzleQuestionType,
} from "@/generators/puzzle";
import { newSeed } from "@/generators/random";
import { practiceCheck, usePractice } from "@/practice/bridge";
import { setClassroom as applyClassroom, useClassroom } from "@/toolkit/classroom";
import { TeacherGuideButton } from "@/toolkit/TeacherGuide";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/ToolLayout.module.css";
import { buildResponse, PUZZLE_ADAPTER } from "./adapter";
import { PUZZLE_GUIDE } from "./guide";
import { guidesOf, movePlacement, SMALL_SPOT, SMALL_TRAY, SMALL_VIEW, targetSpot, trayPoses, VIEW } from "./layout";
import { blendPose, flipPose, PieceG, pieceColor, poseOf, posePt, SheetG, turnPose, type Pose } from "./Pictures";
import { poseTris, PuzzleBoard, snapPose, type BoardPiece, type BoardTarget } from "./PuzzleBoard";
import { MOVE_TEXT, PUZZLE_TYPE_LABEL, PuzzleTryPanel } from "./PuzzleTryPanel";

type Mode = "explore" | "show" | "try";
type Area = "puzzle" | "sheets";
type SetName = "tangram" | "simple";

/** Piece sets for explore; "show me" uses the one chosen there. `figures`: the shadows that set fills. */
const SETS: Record<SetName, { label: string; kinds: PieceKind[]; figures: () => { name: string; poly: [number, number][] }[]; showName: string }> = {
  tangram: { label: "تانگرام (۷ قطعه)", kinds: TANGRAM, figures: tangramFigures, showName: "تانگرام" },
  simple: { label: "قطعه‌های ساده", kinds: SIMPLE_SET, figures: simpleFigures, showName: "ساده" },
};


/** Pair each piece with a solution placement of the same kind. */
function matchSolution(kinds: PieceKind[], solution: Placement[]): (Placement | null)[] {
  const left = [...solution];
  return kinds.map((k) => {
    const i = left.findIndex((p) => p.kind === k);
    return i < 0 ? null : left.splice(i, 1)[0];
  });
}

/** How a build stands: done, or what is still wrong. */
function buildCheck(kinds: PieceKind[], poses: Pose[], target: Set<number>): { done: boolean; text: string } {
  const covered = new Map<number, number>();
  let out = 0;
  let crooked = 0;
  let sticking = 0;
  kinds.forEach((k, i) => {
    const tris = poseTris(k, poses[i]);
    if (!tris) return void crooked++;
    const inside = tris.filter((id) => target.has(id)).length;
    if (!inside) out++;
    else if (inside < tris.length) sticking++;
    for (const id of tris) covered.set(id, (covered.get(id) ?? 0) + 1);
  });
  const overlap = [...covered.values()].some((n) => n > 1);
  const full = [...target].every((id) => covered.has(id));
  if (full && !overlap && !out && !crooked && !sticking) return { done: true, text: "آفرین! سایه کامل پر شد." };
  if (crooked) return { done: false, text: "یک قطعه کج مانده؛ آن را بچرخان تا صاف روی خط‌ها بنشیند." };
  if (out) return { done: false, text: `هنوز ${fa(out)} قطعه بیرون از سایه است.` };
  if (overlap) return { done: false, text: "دو قطعه روی هم افتاده‌اند." };
  if (sticking) return { done: false, text: "قسمتی از یک قطعه از سایه بیرون زده." };
  return { done: false, text: "هنوز جای خالی هست." };
}

/** Turn and flip buttons for the selected piece: three share a line. */
const NUDGE = { flex: "1 1 6.5em", width: "auto", minWidth: 0, padding: "0 6px" } as const;

export function PuzzleTool() {
  const [mode, setMode] = useState<Mode>("explore");
  const [classroom, setClassroom] = useClassroom();

  // Playback 0 … 1.
  const [f, setF] = useState(1);
  const [run, setRun] = useState<{ from: number; ms: number } | null>(null);
  useEffect(() => {
    if (!run) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
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

  // Explore: puzzle
  const [area, setArea] = useState<Area>("puzzle");
  const [set, setSet] = useState<SetName>("tangram");
  const figures = useMemo(() => SETS[set].figures(), [set]);
  const [figure, setFigure] = useState(0);
  const [guides, setGuides] = useState(false);
  const [step, setStep] = useState<45 | 90>(90);
  const kinds = SETS[set].kinds;
  const [poses, setPoses] = useState<Pose[]>(() => trayPoses(TANGRAM.map((kind) => ({ kind }))));
  const [selected, setSelected] = useState<number | null>(null);
  const [gallery, setGallery] = useState<{ kind: PieceKind; pose: Pose }[][]>([]);

  const figTarget = useMemo(() => {
    if (figure < 0 || !figures[figure]) return null;
    const ids = normalize(polyTris(figures[figure].poly)).tris;
    const spot = targetSpot(ids);
    return { ids, spot, solution: solveOnce(ids, SETS[set].kinds, true)! };
  }, [set, figure, figures]);
  const figSet = useMemo(() => new Set(figTarget ? figTarget.ids.map((id) => id + figTarget.spot[0] * 1024 + figTarget.spot[1] * 4) : []), [figTarget]);
  const exploreStatus = figTarget ? buildCheck(kinds, poses, figSet) : null;

  const changeSet = (s: SetName) => {
    setSet(s);
    setPoses(trayPoses(SETS[s].kinds.map((kind) => ({ kind }))));
    setSelected(null);
    // Each set has its own shadows: start on the first one, or stay free.
    setFigure((i) => (i < 0 ? i : 0));
  };

  // Explore: see-through sheets
  const [sheetA, setSheetA] = useState<number[]>([0, 5, 6, 15]);
  const [sheetB, setSheetB] = useState<number[]>([1, 6, 11, 12]);
  const [sheetMove, setSheetMove] = useState<"none" | "turn" | "flip">("none");
  const [stack, setStack] = useState(0);
  const toggle = (cells: number[], i: number) => (cells.includes(i) ? cells.filter((c) => c !== i) : [...cells, i].sort((a, b) => a - b));

  // Try it
  const [tryType, setTryType] = useState<PuzzleQuestionType>("build");
  const [tryLevel, setTryLevel] = useState<Level>(1);
  const [seed, setSeed] = useState(404);
  const [picked, setPicked] = useState<number | null>(null);
  const question = useMemo(() => makePuzzleQuestion(tryType, tryLevel, seed), [tryType, tryLevel, seed]);
  const [buildPoses, setBuildPoses] = useState<Pose[]>([]);
  const [buildSel, setBuildSel] = useState<number | null>(null);
  const [buildChecked, setBuildChecked] = useState(false);
  const [buildShow, setBuildShow] = useState<Pose[] | null>(null);

  // Fresh tray whenever the question changes.
  const [trayFor, setTrayFor] = useState<PuzzleQuestion | null>(null);
  if (trayFor !== question) {
    setTrayFor(question);
    setBuildPoses(question.type === "build" ? (question.level === 3 ? trayPoses(question.kinds.map((kind) => ({ kind }))) : trayPoses(question.kinds.map((kind) => ({ kind })), ...SMALL_TRAY)) : []);
    setBuildSel(null);
    setBuildChecked(false);
    setBuildShow(null);
  }

  const buildTarget = useMemo(() => {
    if (question.type !== "build") return null;
    const spot = question.level === 3 ? targetSpot(question.target) : targetSpot(question.target, ...SMALL_SPOT);
    return { spot, set: new Set(question.target.map((id) => id + spot[0] * 1024 + spot[1] * 4)) };
  }, [question]);
  // Poses belong to the question only once the tray has been laid out for it.
  const buildStatus = question.type === "build" && buildTarget && buildPoses.length === question.kinds.length ? buildCheck(question.kinds, buildPoses, buildTarget.set) : null;

  // Practice sessions: the next question of this tool arrives through the address.
  const practice = usePractice(PUZZLE_ADAPTER, (type, level, sd) => {
    setMode("try");
    if (type in PUZZLE_TYPE_LABEL) setTryType(type as PuzzleQuestionType);
    if (level === 1 || level === 2 || level === 3) setTryLevel(level);
    setSeed(sd);
    setPicked(null);
    setRun(null);
    setF(0);
  });
  const { exam } = practice;
  const reportBuild = () => {
    if (buildTarget && buildPoses.length) void practiceCheck(PUZZLE_ADAPTER, buildResponse(buildPoses, buildTarget.spot));
  };
  // A finished shadow is an answer even without «بررسی» (the panel says «آفرین» on its own).
  const buildDone = mode === "try" && !!buildStatus?.done;
  useEffect(() => {
    if (buildDone) reportBuild();
    // Only the moment it is finished; reportBuild reads the poses of that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildDone]);

  // Shareable links: #try=build&level=2&seed=7(&pick=1)(&solve), #show=puzzle-2, #show=simple-2 or #show=sheets, #f=0.5, #classroom
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.has("classroom")) applyClassroom(true);
    const tryParam = params.get("try");
    const show = params.get("show");
    const timer = setTimeout(() => {
      if (tryParam) {
        setMode("try");
        if (tryParam in PUZZLE_TYPE_LABEL) setTryType(tryParam as PuzzleQuestionType);
        const lv = Number(params.get("level"));
        if (lv === 1 || lv === 2 || lv === 3) setTryLevel(lv);
        const sd = Number(params.get("seed"));
        if (Number.isInteger(sd) && sd >= 0) setSeed(sd);
        const pk = Number(params.get("pick"));
        if (params.has("pick") && Number.isInteger(pk) && pk >= 0) {
          setPicked(pk);
          setF(1);
        } else setF(0);
        if (params.has("solve")) setTimeout(() => setBuildShow([]), 0);
      } else if (show) {
        const [kind, n] = show.split("-");
        if (kind === "sheets") setArea("sheets");
        else {
          setArea("puzzle");
          if (kind === "simple") {
            setSet("simple");
            setPoses(trayPoses(SIMPLE_SET.map((k) => ({ kind: k }))));
          }
          const i = Number(n);
          if (Number.isInteger(i) && i >= 0) setFigure(i);
        }
        setMode("show");
        setF(1);
      }
      const ff = Number(params.get("f"));
      if (params.has("f") && Number.isFinite(ff)) setF(Math.min(1, Math.max(0, ff)));
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const switchMode = (m: Mode) => {
    setMode(m);
    setRun(null);
    setF(m === "try" ? 0 : 1);
  };

  const freshQuestion = (type = tryType, level = tryLevel) => {
    setTryType(type);
    setTryLevel(level);
    setSeed(newSeed());
    setPicked(null);
    setRun(null);
    setF(0);
  };

  const play = (ms: number) => {
    if (run) return setRun(null);
    animate(ms, f >= 0.99 ? 0 : f);
  };

  // Pieces glide one after another as f goes 0 → 1.
  const glide = (kindsOf: PieceKind[], from: Pose[], to: (Pose | null)[], t: number) =>
    kindsOf.map((kind, i) => (to[i] ? blendPose(kind, from[i], to[i]!, t * kindsOf.length - i) : from[i]));

  // Show me: the pieces chosen in explore build one of that set's shadows.
  const showKinds = kinds;
  const showFigure = figures[Math.min(Math.max(0, figure), figures.length - 1)];
  const showIds = useMemo(() => normalize(polyTris(showFigure.poly)).tris, [showFigure]);
  const showSpot = targetSpot(showIds);
  const showSolution = useMemo(() => solveOnce(showIds, showKinds, true)!, [showIds, showKinds]);

  // ── Board ──
  let board: React.ReactNode;
  let showMs = 6000;
  const sheetBoard = (n: number, a: number[], b: number[], move: "none" | "turn" | "flip", t: number, label: string) => {
    const size = 6;
    const [ax, bx, y] = [11.5, 2.5, 2.2];
    const turnT = move === "none" ? 1 : Math.min(1, t / 0.4);
    const slideT = move === "none" ? t : Math.max(0, (t - 0.4) / 0.6);
    const e = slideT * slideT * (3 - 2 * slideT);
    return (
      <Board view={SMALL_VIEW} imageName="sheets" label={label}>
        <SheetG n={n} cells={a} x={ax} y={y} size={size} tint="#4d96ff" label="کاغذ ۱" />
        <SheetG n={n} cells={b} x={bx + (ax - bx) * e} y={y} size={size} tint="#ffc93d" label={e < 0.5 ? "کاغذ ۲" : undefined} a={move === "turn" ? 90 * turnT : 0} sx={move === "flip" ? 1 - 2 * turnT : 1} opacity={e > 0 ? 0.92 : 1} />
        {move !== "none" && t === 0 && (
          <text x={bx + size / 2} y={y + size + 1.1} fontSize={0.5} fontWeight={700} textAnchor="middle" fill="#1f2430">
            {move === "turn" ? "↻ یک ربع دور" : "⇋ برگردان"}
          </text>
        )}
      </Board>
    );
  };

  if (mode === "explore" && area === "puzzle") {
    const pieces: BoardPiece[] = kinds.map((kind, i) => ({ kind, pose: poses[i], color: pieceColor(i) }));
    board = (
      <PuzzleBoard
        view={VIEW}
        label="قطعه‌ها را بکش، با یک ضربه بچرخان، با دو ضربه برگردان"
        target={figTarget ? { ids: figTarget.ids, x: figTarget.spot[0], y: figTarget.spot[1], guides: guides ? guidesOf(figTarget.solution) : undefined } : undefined}
        pieces={pieces}
        onPose={(i, pose) => setPoses((ps) => ps.map((p, j) => (j === i ? pose : p)))}
        onSelect={setSelected}
        selected={selected}
        step={step}
      />
    );
  } else if (mode === "explore" && area === "sheets") {
    const size = 6;
    const cell = size / 4;
    board = (
      <Board view={SMALL_VIEW} imageName="sheets" label="کاغذهای شفاف؛ روی خانه‌ها بزن">
        {stack > 0 ? (
          <>
            <SheetG n={4} cells={sheetA} x={11.5} y={2.2} size={size} tint="#4d96ff" label="کاغذ ۱" />
            <SheetG n={4} cells={sheetB} x={2.5 + 9 * stack} y={2.2} size={size} tint="#ffc93d" a={sheetMove === "turn" ? 90 : 0} sx={sheetMove === "flip" ? -1 : 1} opacity={0.92} />
          </>
        ) : (
          [
            [sheetA, 11.5, "#4d96ff", "کاغذ ۱", setSheetA, "none"],
            [sheetB, 2.5, "#ffc93d", "کاغذ ۲", setSheetB, sheetMove],
          ].map(([cells, x, tint, label, set, mv]) => (
            <g key={label as string}>
              <SheetG n={4} cells={cells as number[]} x={x as number} y={2.2} size={size} tint={tint as string} label={label as string} a={mv === "turn" ? 90 : 0} sx={mv === "flip" ? -1 : 1} />
              {/* Taps go to the sheet as it lies, so read the cell back through the move. */}
              {Array.from({ length: 16 }, (_, i) => (
                <rect
                  key={i}
                  x={(x as number) + (i % 4) * cell}
                  y={2.2 + Math.floor(i / 4) * cell}
                  width={cell}
                  height={cell}
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    const own = mv === "turn" ? moveCells([i], 4, "turnBack")[0] : mv === "flip" ? moveCells([i], 4, "flip")[0] : i;
                    (set as (fn: (c: number[]) => number[]) => void)((c) => toggle(c, own));
                  }}
                />
              ))}
            </g>
          ))
        )}
      </Board>
    );
  } else if (mode === "show" && area === "sheets") {
    board = sheetBoard(4, sheetA, sheetB, sheetMove, f, "روی‌هم‌گذاری کاغذها");
  } else if (mode === "show") {
    const from = trayPoses(showKinds.map((kind) => ({ kind })));
    const to = matchSolution(showKinds, showSolution).map((p) => (p ? poseOf(movePlacement(p, showSpot)) : null));
    showMs = 8000;
    board = (
      <PuzzleBoard
        view={VIEW}
        label={`ساختن ${showFigure.name} با ${SETS[set].label}`}
        target={{ ids: showIds, x: showSpot[0], y: showSpot[1] }}
        pieces={glide(showKinds, from, to, f).map((pose, i) => ({ kind: showKinds[i], pose, color: pieceColor(i) }))}
      />
    );
  } else {
    const q = question;
    // In a mock exam the board does not play the answer.
    const done = picked !== null && !exam;
    showMs = 5000;
    if (q.type === "build" && buildTarget) {
      const solved = matchSolution(q.kinds, q.solution).map((p) => (p ? poseOf(movePlacement(p, buildTarget.spot)) : null));
      const showing = buildShow !== null;
      const from = buildShow && buildShow.length ? buildShow : buildPoses;
      board = (
        <PuzzleBoard
          view={q.level === 3 ? VIEW : SMALL_VIEW}
          label="قطعه‌ها را روی سایه بچین"
          target={{ ids: q.target, x: buildTarget.spot[0], y: buildTarget.spot[1], guides: q.guides ? guidesOf(q.solution) : undefined }}
          pieces={buildPoses.length !== q.kinds.length ? [] : (showing ? glide(q.kinds, from, solved, f) : buildPoses).map((pose, i) => ({ kind: q.kinds[i], pose, color: pieceColor(i) }))}
          onPose={showing ? undefined : (i, pose) => setBuildPoses((ps) => ps.map((p, j) => (j === i ? pose : p)))}
          onSelect={setBuildSel}
          selected={buildSel}
          allowFlip={q.allowFlip}
        />
      );
    } else if (q.type === "overlay") {
      board = sheetBoard(q.n, q.a, q.b, q.move, done ? f : 0, "دو کاغذ شفاف");
    } else if (q.type !== "build") {
      // Shape questions: a shadow on the right, pieces in the tray gliding in after the answer.
      const tray = (items: { kind: PieceKind; k?: number; flip?: boolean }[]) => trayPoses(items, ...SMALL_TRAY);
      let target: BoardTarget;
      let pieces: BoardPiece[] = [];
      if (q.type === "combine") {
        const spot = targetSpot(q.options[q.answer], ...SMALL_SPOT);
        target = { ids: done ? q.options[q.answer] : [], x: spot[0], y: spot[1], fill: "#e9e2d4" };
        const from = tray(q.pieces.map((kind) => ({ kind })));
        const to = q.solution.map((p) => poseOf(movePlacement(p, spot)));
        pieces = glide(q.pieces, from, done ? to : [null, null], f).map((pose, i) => ({ kind: q.pieces[i], pose, color: pieceColor(i) }));
      } else if (q.type === "complete") {
        const spot = targetSpot(q.target, ...SMALL_SPOT);
        target = { ids: q.target, x: spot[0], y: spot[1], hole: q.hole };
        const from = tray(q.options);
        pieces = q.options.map((o, i) => {
          const right = i === q.answer;
          const pose = done && right ? blendPose(o.kind, from[i], poseOf(movePlacement(q.fill, spot)), f) : from[i];
          return { kind: o.kind, pose, color: "#ffc93d", label: fa(i + 1), faded: done && !right };
        });
      } else {
        const spot = targetSpot(q.target, ...SMALL_SPOT);
        target = { ids: q.target, x: spot[0], y: spot[1] };
        const shown = q.type === "extra" ? q.pieces : done ? q.solution.map((p) => p.kind) : [];
        const from = tray(shown.map((kind) => ({ kind })));
        const extraAt = q.type === "extra" ? q.answer : -1;
        const sol = matchSolution(
          shown.filter((_, i) => i !== extraAt),
          q.solution,
        );
        const to = shown.map((_, i) => (i === extraAt ? null : sol[i < extraAt || extraAt < 0 ? i : i - 1]));
        pieces = glide(shown, from, done ? to.map((p) => (p ? poseOf(movePlacement(p, spot)) : null)) : shown.map(() => null), f).map((pose, i) => ({
          kind: shown[i],
          pose,
          color: pieceColor(i),
          label: q.type === "extra" ? (done && i === extraAt ? "✗" : fa(i + 1)) : undefined,
          faded: done && i === extraAt,
        }));
      }
      board = <PuzzleBoard view={SMALL_VIEW} label={PUZZLE_TYPE_LABEL[q.type]} target={target} pieces={pieces} />;
    }
  }

  // Turn and flip buttons for the selected piece.
  const editing = mode === "explore" && area === "puzzle" ? { sel: selected, kinds, set: setPoses, step } : mode === "try" && question.type === "build" && buildShow === null ? { sel: buildSel, kinds: question.kinds, set: setBuildPoses, step: 90 as const } : null;
  const nudgeSelected = (how: "turn" | "back" | "flip") => {
    if (!editing || editing.sel === null) return;
    const i = editing.sel;
    const kind = editing.kinds[i];
    editing.set((ps) => ps.map((p, j) => (j !== i ? p : snapPose(how === "flip" ? flipPose(kind, p) : turnPose(kind, p, how === "turn" ? editing.step : -editing.step)))));
  };

  const inTry = mode === "try";
  const playing = mode === "show" || (inTry && picked !== null && !exam) || (inTry && buildShow !== null);
  const canFlip = !(inTry && question.type === "build" && !question.allowFlip);

  return (
    <main className={styles.layout}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          → همه ابزارها
        </Link>
        <h1>
          <span className={styles.badge}>{fa(4)}</span> هم‌پوشانی و پازل
        </h1>
        <div className={styles.tabs} role="tablist" aria-label="حالت ابزار">
          <button role="tab" aria-selected={mode === "explore"} onClick={() => switchMode("explore")}>
            کشف: خودت بساز
          </button>
          <button
            role="tab"
            aria-selected={mode === "show"}
            onClick={() => {
              switchMode("show");
              animate(area === "sheets" ? 4000 : 8000);
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
          <TeacherGuideButton guide={PUZZLE_GUIDE} />
          <Link href={`/tools/puzzle/worksheet?types=${tryType}&level=${tryLevel}`}>کاربرگ</Link>
        </div>
      </header>

      <section className={styles.stageWrap} aria-label="صفحه پازل">
        {board}
      </section>

      <section className={styles.controls}>
        {playing ? (
          <label className={styles.slider}>
            <button className={styles.playSmall} onClick={() => play(showMs)} aria-label={run ? "توقف" : "پخش"}>
              {run ? "⏸" : "▶"}
            </button>
            <span>{area === "sheets" || (inTry && question.type === "overlay") ? "روی هم گذاشتن" : "قطعه‌ها سر جایشان"}</span>
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
        ) : editing ? (
          // Wraps on phones: the hint on one line, the three buttons below.
          <div className={styles.row} style={{ flex: 1, flexWrap: "wrap" }}>
            <span className={styles.stepText} style={{ margin: 0, flex: "1 1 12em" }}>
              {editing.sel === null ? "روی یک قطعه بزن تا انتخاب شود" : "قطعه انتخاب‌شده:"}
            </span>
            <button className={styles.clear} style={NUDGE} onClick={() => nudgeSelected("back")} disabled={editing.sel === null}>
              ↺ چرخش
            </button>
            <button className={styles.clear} style={NUDGE} onClick={() => nudgeSelected("turn")} disabled={editing.sel === null}>
              ↻ چرخش
            </button>
            <button className={styles.clear} style={NUDGE} onClick={() => nudgeSelected("flip")} disabled={editing.sel === null || !canFlip}>
              ⇋ برگرداندن
            </button>
          </div>
        ) : mode === "explore" ? (
          <label className={styles.slider}>
            <span>روی هم گذاشتن</span>
            <input type="range" min={0} max={1} step={0.01} value={stack} onChange={(e) => setStack(Number(e.target.value))} aria-label="روی هم گذاشتن" />
          </label>
        ) : (
          <p className={styles.stepText} style={{ margin: 0 }}>
            اول فکر کن، بعد جواب بده
          </p>
        )}
      </section>

      <aside className={styles.side}>
        {mode !== "try" && (
          <div className={styles.chipsRow} role="radiogroup" aria-label="بخش">
            {(
              [
                ["puzzle", "پازل و تانگرام"],
                ["sheets", "کاغذ شفاف"],
              ] as [Area, string][]
            ).map(([a, label]) => (
              <button
                key={a}
                role="radio"
                aria-checked={area === a}
                onClick={() => {
                  setArea(a);
                  setRun(null);
                  setF(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {mode === "explore" && area === "puzzle" && (
          <>
            <h2 className={styles.progress}>۱. قطعه‌ها</h2>
            <div className={styles.chipsRow} role="radiogroup" aria-label="دسته قطعه">
              {(Object.keys(SETS) as SetName[]).map((s) => (
                <button key={s} role="radio" aria-checked={set === s} onClick={() => changeSet(s)}>
                  {SETS[s].label}
                </button>
              ))}
            </div>
            <h2 className={styles.progress}>۲. سایه</h2>
            <div className={styles.choiceGrid} role="radiogroup" aria-label="سایه">
              <button role="radio" aria-checked={figure < 0} onClick={() => setFigure(-1)}>
                آزاد
              </button>
              {figures.map((fig, i) => (
                <button key={fig.name} role="radio" aria-checked={figure === i} onClick={() => setFigure(i)}>
                  {fig.name}
                </button>
              ))}
            </div>
            <div className={styles.row} style={{ marginTop: 8 }}>
              <button className={styles.toggle} aria-pressed={guides} onClick={() => setGuides(!guides)} disabled={!figTarget}>
                {guides ? "✓ " : ""}خطوط راهنما
              </button>
              <button className={styles.toggle} aria-pressed={step === 45} onClick={() => setStep(step === 45 ? 90 : 45)}>
                چرخش {step === 45 ? "۴۵°" : "۹۰°"}
              </button>
            </div>
            <p className={styles.note}>قطعه را بکش. یک ضربه: چرخش. دو ضربه پشت سر هم: برگرداندن (قرینه). قطعه‌ها روی نقطه‌ها می‌چسبند.</p>
            {exploreStatus && <p className={`${styles.status} ${exploreStatus.done ? styles.good : styles.info}`}>{exploreStatus.done ? "✓ " + exploreStatus.text : exploreStatus.text}</p>}
            {figTarget && (
              <button className={styles.clear} onClick={() => { setMode("show"); animate(8000); }}>
                نشانم بده
              </button>
            )}

            <h2 className={styles.progress}>هر چند شکل که می‌توانی بساز</h2>
            <div className={styles.row}>
              <button className={styles.clear} onClick={() => setGallery((g) => [...g, kinds.map((kind, i) => ({ kind, pose: poses[i] }))])}>
                این شکل را نگه دار
              </button>
              <button className={styles.clear} onClick={() => { setPoses(trayPoses(kinds.map((kind) => ({ kind })))); setSelected(null); }}>
                از نو
              </button>
            </div>
            {gallery.length > 0 && (
              <div className={styles.row} style={{ flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {gallery.map((g, i) => (
                  <GalleryThumb key={i} items={g} n={i + 1} />
                ))}
              </div>
            )}
          </>
        )}

        {mode === "explore" && area === "sheets" && (
          <>
            <h2 className={styles.progress}>کاغذهای شفاف</h2>
            <p className={styles.note}>روی خانه‌های هر کاغذ بزن تا سیاه یا سفید شوند. بعد با نوار پایین، کاغذ ۲ را روی کاغذ ۱ بگذار.</p>
            <h2 className={styles.progress}>کاغذ ۲ پیش از گذاشتن</h2>
            <div className={styles.chipsRow} role="radiogroup" aria-label="حرکت کاغذ ۲">
              {(
                [
                  ["none", "همین‌طور"],
                  ["turn", "↻ یک ربع دور"],
                  ["flip", "⇋ برگردان"],
                ] as ["none" | "turn" | "flip", string][]
              ).map(([m, label]) => (
                <button key={m} role="radio" aria-checked={sheetMove === m} onClick={() => setSheetMove(m)}>
                  {label}
                </button>
              ))}
            </div>
            <p className={styles.note}>کاغذها شفاف‌اند: هر خانه‌ای که در یکی سیاه باشد، روی هم هم سیاه دیده می‌شود. مثلث گوشه نشان می‌دهد کاغذ چطور چرخیده.</p>
            <button className={styles.clear} onClick={() => { setMode("show"); animate(4000); }}>
              نشانم بده
            </button>
          </>
        )}

        {mode === "show" && area === "puzzle" && (
          <>
            <h2>قطعه‌ها یکی‌یکی</h2>
            <div className={styles.choiceGrid} role="radiogroup" aria-label="سایه">
              {figures.map((fig, i) => (
                <button key={fig.name} role="radio" aria-checked={Math.max(0, figure) === i} onClick={() => { setFigure(i); animate(8000); }}>
                  {fig.name}
                </button>
              ))}
            </div>
            <p className={styles.note}>
              {fa(showKinds.length)} قطعه {SETS[set].showName} (همان دسته‌ای که در «کشف» انتخاب شده) آهسته سر جایشان می‌روند: اول قطعه‌های بزرگ. هر قطعه می‌چرخد و اگر لازم باشد برمی‌گردد. قطعه {fa(Math.min(showKinds.length, Math.floor(f * showKinds.length) + 1))} از {fa(showKinds.length)}.
            </p>
          </>
        )}

        {mode === "show" && area === "sheets" && (
          <>
            <h2>روی هم گذاشتن</h2>
            <p className={styles.note}>
              {sheetMove === "none" ? "کاغذ ۲ آهسته روی کاغذ ۱ می‌رود." : `${MOVE_TEXT[sheetMove].replace("، بعد", "")}؛ بعد آهسته روی کاغذ ۱ می‌رود.`} هر خانه سیاهِ هر کدام، در نتیجه سیاه است.
            </p>
            <p className={styles.note}>نتیجه: {fa([...new Set([...sheetA, ...moveCells(sheetB, 4, sheetMove)])].length)} خانه سیاه.</p>
          </>
        )}

        {mode === "try" && (
          <PuzzleTryPanel
            key={`${tryType}-${tryLevel}-${seed}`}
            question={question}
            type={tryType}
            level={tryLevel}
            picked={picked}
            onPick={(i) => {
              setPicked(i);
              void practiceCheck(PUZZLE_ADAPTER, i);
              if (!exam) animate(5000);
            }}
            buildStatus={buildStatus && (buildStatus.done || buildChecked) ? buildStatus : null}
            onCheckBuild={() => {
              setBuildChecked(true);
              reportBuild();
            }}
            buildChecked={buildChecked}
            hideShowBuild={practice.active && (exam || !buildChecked)}
            exam={exam}
            onShowBuild={() => {
              setBuildShow(buildPoses);
              animate(question.type === "build" ? 1200 * question.kinds.length : 5000);
            }}
            onType={(t) => freshQuestion(t, tryLevel)}
            onLevel={(l) => freshQuestion(tryType, l)}
            onNew={() => freshQuestion()}
          />
        )}
      </aside>
    </main>
  );
}

/** A saved arrangement, small. */
function GalleryThumb({ items, n }: { items: { kind: PieceKind; pose: Pose }[]; n: number }) {
  const pts = items.flatMap(({ kind, pose }) => posePolyPts(kind, pose));
  const [x0, y0] = [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1]))];
  const s = Math.max(Math.max(...pts.map((p) => p[0])) - x0, Math.max(...pts.map((p) => p[1])) - y0) + 0.6;
  return (
    <svg width={64} height={64} viewBox={`${x0 - 0.3} ${y0 - 0.3} ${s} ${s}`} style={{ direction: "ltr", background: "#fff", borderRadius: 8 }} aria-label={`شکل ${fa(n)}`}>
      {items.map(({ kind, pose }, i) => (
        <PieceG key={i} kind={kind} pose={pose} color={pieceColor(i)} />
      ))}
    </svg>
  );
}

const posePolyPts = (kind: PieceKind, pose: Pose) => PIECES[kind].poly.map((v) => posePt(pose, v));

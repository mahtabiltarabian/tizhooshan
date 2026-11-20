"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyzeShape, CUBE_NETS, oppositePairs, pairReason, shapeKey, type Cell } from "@/generators/cube-nets";
import { makeQuestion, type Level, type QuestionType } from "@/generators/cube-questions";
import { DIR_STEP, makeDiceQuestion, rollAll, STANDARD, type DiceQuestion, type DieState, type Dir } from "@/generators/dice";
import { newSeed } from "@/generators/random";
import { practiceCheck, usePractice } from "@/practice/bridge";
import { isDiceType, TYPE_LABEL, TryPanel, type Display, type NetsType } from "./TryPanel";
import { DiceTryPanel, type DieDisplay } from "./DiceTryPanel";
import { DiceExplorePanel, DiceShowPanel } from "./DicePanels";
import { DieScene } from "./DieScene";
import { useRollPlayer } from "./useRollPlayer";
import { setClassroom as applyClassroom, useClassroom } from "@/toolkit/classroom";
import { TeacherGuideButton } from "@/toolkit/TeacherGuide";
import { CUBE_NETS_ADAPTER } from "./adapter";
import { CUBE_NETS_GUIDE } from "./guide";
import { Stage } from "@/engine-3d/Stage";
import { fa } from "@/tools/registry";
import { FOLD_STEPS, FoldingNet } from "./FoldingNet";
import { GRID, NetEditor } from "./NetEditor";
import { NetThumb } from "./NetThumb";
import styles from "@/toolkit/ToolLayout.module.css";

const DIGITS = ["۱", "۲", "۳", "۴", "۵", "۶"];
const PAIR_DIGITS = ["۱", "۲", "۳"];
const PAIR_COLORS = ["#4d96ff", "#ff9f45", "#4cc38a"];
/** Seconds per fold step. */
const STEP_SECONDS = { normal: 0.9, slow: 2.2 };

type Mode = "explore" | "show" | "try";
type Part = "net" | "dice";
/** Explore board for the die. */
const DIE_BOARD = 5;
const DIE_HOME: Cell = [2, 2];
/** After this many rolls in explore, the trail restarts from where the die stands. */
const TRAIL = 12;
const NO_CELLS: Cell[] = [];
const NO_LABELS: string[] = [];
type RollQuestion = Extract<DiceQuestion, { type: "roll" }>;
const rollExample = (seed: number) => makeDiceQuestion("roll", 2, seed) as RollQuestion;
const PALE = Array(6).fill("#fffaf0");

/** "x,y;x,y;..." from a link into up to 6 distinct cells on the grid, or null. */
function parseShape(text: string | null): Cell[] | null {
  if (!text) return null;
  const cells: Cell[] = [];
  for (const part of text.split(";")) {
    const [x, y] = part.split(",").map(Number);
    const ok = Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < GRID && y < GRID;
    if (ok && !cells.some((c) => c[0] === x && c[1] === y)) cells.push([x, y]);
  }
  return cells.length ? cells.slice(0, 6) : null;
}

/** Status line for the explore panel, plus whether folding is allowed. */
function describe(status: ReturnType<typeof analyzeShape>, isNew: boolean): { text: string; tone: "info" | "warn" | "good"; canFold: boolean } {
  switch (status.kind) {
    case "incomplete":
      return {
        text: status.count === 0 ? "شش مربع روی صفحه بگذار؛ مربع‌ها باید ضلع به ضلع کنار هم باشند." : `${fa(status.count)} از ۶ مربع`,
        tone: "info",
        canFold: false,
      };
    case "disconnected":
      return { text: "همه مربع‌ها باید ضلع به ضلع به هم وصل باشند.", tone: "warn", canFold: false };
    case "overlap": {
      const pairs = status.pairs.map(([a, b]) => `وجه ${DIGITS[a]} روی ${DIGITS[b]}`).join(" و ");
      return { text: `این شکل مکعب نمی‌شود: ${pairs} می‌افتد. «تا کن» را بزن و ببین.`, tone: "warn", canFold: true };
    }
    case "valid":
      return {
        text: isNew
          ? `آفرین! گسترده شماره ${fa(status.netIndex + 1)} را کشف کردی.`
          : `این گسترده شماره ${fa(status.netIndex + 1)} است؛ قبلاً پیدایش کرده بودی.`,
        tone: "good",
        canFold: true,
      };
  }
}

/** Short status for the step counter under the 3D stage. */
function stepText(t: number): string {
  if (t <= 0) return "آماده";
  if (t >= 1) return "مکعب بسته شد";
  return `گام ${fa(Math.ceil(t * FOLD_STEPS - 1e-6))} از ${fa(FOLD_STEPS)}`;
}

export function CubeNetsTool() {
  const [mode, setMode] = useState<Mode>("explore");
  const [t, setT] = useState(0);
  const [classroom, setClassroom] = useClassroom();

  // Explore mode. Discoveries live only in memory: nothing about the child is stored.
  const [drawn, setDrawn] = useState<Cell[]>([]);
  const [found, setFound] = useState<Set<number>>(() => new Set());
  const [lastNew, setLastNew] = useState(false);

  // Show-me mode.
  const [showCells, setShowCells] = useState<readonly Cell[]>(CUBE_NETS[0]);
  const [pairsOn, setPairsOn] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [slow, setSlow] = useState(false);

  // Try-it mode. Answers are never stored or scored.
  const [tryType, setTryType] = useState<NetsType>("makes");
  const [tryLevel, setTryLevel] = useState<Level>(1);
  const [seed, setSeed] = useState(1405);
  const [initialPick, setInitialPick] = useState<number | undefined>(undefined);
  const dice = isDiceType(tryType);
  // Net questions and dice questions come from two generators; only one is shown.
  const netType: QuestionType = isDiceType(tryType) ? "opposite" : tryType;
  const question = useMemo(() => makeQuestion(netType, tryLevel, seed), [netType, tryLevel, seed]);
  const diceQuestion = useMemo(() => (isDiceType(tryType) ? makeDiceQuestion(tryType, tryLevel, seed) : null), [tryType, tryLevel, seed]);
  const [dieDisplay, setDieDisplay] = useState<DieDisplay | null>(null);

  // The die: explore (arrow buttons), show-me (a path rolled step by step), try-it.
  const [explorePart, setExplorePart] = useState<Part>("net");
  const [showPart, setShowPart] = useState<Part>("net");
  const roller = useRollPlayer();
  const { jump: rollJump, setTarget: rollTo } = roller;
  const [exStart, setExStart] = useState<DieState>(STANDARD);
  const [exFrom, setExFrom] = useState<Cell>(DIE_HOME);
  const [exPath, setExPath] = useState<Dir[]>([]);
  const exEnd = useMemo(() => {
    let [x, y] = exFrom;
    for (const d of exPath) [x, y] = [x + DIR_STEP[d][0], y + DIR_STEP[d][1]];
    return { cell: [x, y] as Cell, die: rollAll(exStart, exPath) };
  }, [exStart, exFrom, exPath]);
  const exNext = (d: Dir): Cell => [exEnd.cell[0] + DIR_STEP[d][0], exEnd.cell[1] + DIR_STEP[d][1]];
  const onBoard = ([x, y]: Cell) => x >= 0 && y >= 0 && x < DIE_BOARD && y < DIE_BOARD;
  const rollExplore = (d: Dir) => {
    if (!onBoard(exNext(d))) return;
    if (exPath.length >= TRAIL) {
      setExStart(exEnd.die);
      setExFrom(exEnd.cell);
      setExPath([d]);
      rollJump(0);
      rollTo(1);
    } else {
      setExPath([...exPath, d]);
      rollTo(exPath.length + 1);
    }
  };
  const resetExplore = () => {
    setExStart(STANDARD);
    setExFrom(DIE_HOME);
    setExPath([]);
    rollJump(0);
  };
  const [rollSeed, setRollSeed] = useState(1405);
  const showRoll = useMemo(() => rollExample(rollSeed), [rollSeed]);
  const onDieDisplay = useCallback(
    (d: DieDisplay | null) => {
      setDieDisplay(d);
      if (d?.play) rollTo(d.path.length);
      else rollJump(0);
    },
    [rollTo, rollJump],
  );
  // What the try-it panel wants the 3D net to show (a blank face, the child's own placement…).
  const [tryDisplay, setTryDisplay] = useState<Display | null>(null);

  // Practice sessions: the next question of this tool arrives through the address.
  const practice = usePractice(CUBE_NETS_ADAPTER, (type, level, sd) => {
    setMode("try");
    if (type in TYPE_LABEL) setTryType(type as NetsType);
    if (level === 1 || level === 2 || level === 3) setTryLevel(level);
    setSeed(sd);
    setInitialPick(undefined);
    setTryDisplay(null);
    setDieDisplay(null);
    rollJump(0);
    setPlaying(false);
    setT(0);
  });
  // Mock exam: no folding or rolling on the stage; it would solve the question.
  const stageLocked = mode === "try" && practice.exam;

  const status = useMemo(() => analyzeShape(drawn), [drawn]);
  const info = describe(status, lastNew);
  const marked = status.kind === "overlap" ? [...new Set(status.pairs.flat())] : [];

  const pairs = useMemo(() => oppositePairs(showCells), [showCells]);
  const pairOf = useMemo(() => {
    const p: number[] = [];
    pairs.forEach(([a, b], k) => (p[a] = p[b] = k));
    return p;
  }, [pairs]);
  const showKey = shapeKey(showCells);

  const cells = mode === "show" ? showCells : mode === "try" ? (tryDisplay?.cells ?? (dice ? NO_CELLS : question.net.cells)) : drawn;
  const pairView = mode === "show" && pairsOn;
  const labels = useMemo(() => {
    if (mode === "try") return tryDisplay?.symbols ?? (dice ? NO_LABELS : question.net.symbols);
    return pairView ? cells.map((_, i) => PAIR_DIGITS[pairOf[i]]) : DIGITS.slice(0, cells.length);
  }, [mode, question, tryDisplay, pairView, cells, pairOf, dice]);
  const colors = useMemo(() => {
    if (mode === "try") return PALE;
    return pairView ? cells.map((_, i) => PAIR_COLORS[pairOf[i]]) : undefined;
  }, [mode, pairView, cells, pairOf]);

  // Playback for show-me: advance t until the cube is closed.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const perStep = slow ? STEP_SECONDS.slow : STEP_SECONDS.normal;
    const tick = (now: number) => {
      const next = Math.min(1, tRef.current + (now - last) / 1000 / (perStep * FOLD_STEPS));
      last = now;
      setT(next);
      if (next >= 1) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, slow]);

  // Shareable links (handy for teachers' slides):
  //   #shape=1,0;0,1;1,1&fold   explore with that shape drawn, optionally folded
  //   #show=10&pairs=0&t=0.4     show-me on net 10, pairs off, 40% folded
  //   #folded                    show-me, cube closed
  //   #try=makes&level=2&seed=7  try-it: that exact example (pick=n shows answer n); also try=die, try=roll
  //   #dice                      explore: roll a die with arrow buttons
  //   #show=roll&seed=7          show-me: that rolling path, step by step
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    // #classroom: board shortcut. Full screen still needs a tap (browser rule).
    if (params.has("classroom")) applyClassroom(true);
    const shape = parseShape(params.get("shape"));
    const show = Number(params.get("show"));
    const tryParam = params.get("try");
    if (!shape && !params.has("show") && !params.has("folded") && !tryParam && !params.has("dice")) return;
    const timer = setTimeout(() => {
      if (params.has("dice") && !tryParam && !params.has("show")) {
        setExplorePart("dice");
        return;
      }
      if (params.get("show") === "roll") {
        setMode("show");
        setShowPart("dice");
        const sd = Number(params.get("seed"));
        if (Number.isInteger(sd) && sd >= 0) setRollSeed(sd);
        return;
      }
      if (tryParam) {
        setMode("try");
        if (tryParam in TYPE_LABEL) setTryType(tryParam as NetsType);
        const lv = Number(params.get("level"));
        if (lv === 1 || lv === 2 || lv === 3) setTryLevel(lv);
        const sd = Number(params.get("seed"));
        if (Number.isInteger(sd) && sd >= 0) setSeed(sd);
        const pk = Number(params.get("pick"));
        if (params.has("pick") && Number.isInteger(pk) && pk >= 1 && pk <= 6) {
          setInitialPick(pk - 1);
          setT(1);
        }
        return;
      }
      if (shape) {
        setDrawn(shape);
        const s = analyzeShape(shape);
        if (s.kind === "valid") setFound(new Set([s.netIndex]));
        setLastNew(true);
        setT(params.has("fold") ? 1 : 0);
        return;
      }
      setMode("show");
      if (show >= 1 && show <= CUBE_NETS.length) setShowCells(CUBE_NETS[show - 1]);
      if (params.get("pairs") === "0") setPairsOn(false);
      const tt = Number(params.get("t"));
      setT(params.has("folded") ? 1 : Number.isFinite(tt) ? Math.min(1, Math.max(0, tt)) : 0);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const toggle = ([x, y]: Cell) => {
    const exists = drawn.some((c) => c[0] === x && c[1] === y);
    if (!exists && drawn.length >= 6) return;
    const next = exists ? drawn.filter((c) => c[0] !== x || c[1] !== y) : [...drawn, [x, y] as Cell];
    setDrawn(next);
    setT(0);
    const s = analyzeShape(next);
    if (s.kind === "valid") {
      setLastNew(!found.has(s.netIndex));
      setFound((f) => new Set(f).add(s.netIndex));
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setPlaying(false);
    setT(0);
    rollJump(0);
    if (m === "explore") resetExplore();
  };

  const openInShow = (net: readonly Cell[]) => {
    setShowCells(net);
    setMode("show");
    setPlaying(false);
    setT(0);
  };

  const stepTo = (dir: 1 | -1) => {
    setPlaying(false);
    const g = t * FOLD_STEPS;
    const target = dir > 0 ? Math.floor(g + 1e-6) + 1 : Math.ceil(g - 1e-6) - 1;
    setT(Math.min(FOLD_STEPS, Math.max(0, target)) / FOLD_STEPS);
  };

  const play = () => {
    if (playing) return setPlaying(false);
    if (t >= 1) setT(0);
    setPlaying(true);
  };

  const freshQuestion = (type = tryType, level = tryLevel) => {
    setTryType(type);
    setTryLevel(level);
    setSeed(newSeed());
    setInitialPick(undefined);
    setTryDisplay(null);
    setDieDisplay(null);
    rollJump(0);
    setPlaying(false);
    setT(0);
  };

  // Answering folds the net, so the child sees why.
  const onAnswered = useCallback(() => {
    setT(0);
    setPlaying(true);
  }, []);
  const onEdit = useCallback(() => {
    setPlaying(false);
    setT(0);
  }, []);

  const canFold = mode !== "explore" || info.canFold;

  // When the stage shows the die instead of a net, and which path it rolls.
  const diePath: { start: DieState; path: Dir[]; from: Cell; w: number; d: number; showPath: boolean } | null =
    mode === "explore" && explorePart === "dice"
      ? { start: exStart, path: exPath, from: exFrom, w: DIE_BOARD, d: DIE_BOARD, showPath: exPath.length > 0 }
      : mode === "show" && showPart === "dice"
        ? { start: showRoll.start, path: showRoll.path, from: showRoll.from, w: showRoll.w, d: showRoll.d, showPath: true }
        : mode === "try" && dice && dieDisplay
          ? dieDisplay
          : null;
  const rollLen = diePath?.path.length ?? 0;
  const rollDone = Math.min(rollLen, Math.floor(roller.p + 1e-6));
  const rollPlay = () => {
    if (roller.playing) return rollTo(Math.ceil(roller.p - 1e-6));
    if (roller.p >= rollLen) rollJump(0);
    rollTo(rollLen);
  };

  return (
    <main className={styles.layout}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          → همه ابزارها
        </Link>
        <h1>
          <span className={styles.badge}>{fa(7)}</span> گسترده و تاس
        </h1>
        <div className={styles.tabs} role="tablist" aria-label="حالت ابزار">
          <button role="tab" aria-selected={mode === "explore"} onClick={() => switchMode("explore")}>
            کشف: خودت بساز
          </button>
          <button role="tab" aria-selected={mode === "show"} onClick={() => switchMode("show")}>
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
          <TeacherGuideButton guide={CUBE_NETS_GUIDE} />
          <Link href={`/tools/cube-nets/worksheet?types=${tryType}&level=${tryLevel}`}>کاربرگ</Link>
        </div>
      </header>

      <section className={styles.stageWrap} aria-label="صحنه سه‌بعدی">
        <Stage imageName="cube-net">
          {diePath ? (
            <DieScene start={diePath.start} path={diePath.path} from={diePath.from} w={diePath.w} d={diePath.d} progress={roller.p} showPath={diePath.showPath} />
          ) : (
          <FoldingNet
            cells={cells}
            t={t}
            labels={labels}
            colors={colors}
            marked={mode === "explore" ? marked : []}
            sequential={mode !== "explore"}
            turns={mode === "try" ? (tryDisplay?.turns ?? question.net.turns) : undefined}
            ink={mode === "try" ? "dark" : "light"}
          />
          )}
        </Stage>
      </section>

      <section className={styles.controls}>
        {diePath && mode !== "explore" && !stageLocked && (
          <div className={styles.player} dir="ltr" role="group" aria-label="غلتاندن گام‌به‌گام">
            <button onClick={() => rollTo(Math.max(0, Math.ceil(roller.p - 1e-6) - 1))} disabled={roller.p <= 0} aria-label="غلت قبل">
              ⏮
            </button>
            <button className={styles.playButton} onClick={rollPlay} aria-label={roller.playing ? "توقف" : "پخش"}>
              {roller.playing ? "⏸" : "▶"}
            </button>
            <button onClick={() => rollTo(Math.min(rollLen, rollDone + 1))} disabled={roller.p >= rollLen} aria-label="غلت بعد">
              ⏭
            </button>
            <span className={styles.stepText} aria-live="polite">
              غلت {fa(rollDone)} از {fa(rollLen)}
            </span>
          </div>
        )}
        {diePath && mode === "explore" && (
          <p className={styles.note}>تاس را با دکمه‌های کنار صفحه بغلتان؛ صحنه را هم می‌توانی بچرخانی.</p>
        )}
        {!diePath && mode !== "explore" && !stageLocked && (
          // Media controls keep the usual left-to-right order, as in Persian video players.
          <div className={styles.player} dir="ltr" role="group" aria-label="پخش گام‌به‌گام">
            <button onClick={() => stepTo(-1)} disabled={t <= 0} aria-label="گام قبل">
              ⏮
            </button>
            <button className={styles.playButton} onClick={play} aria-label={playing ? "توقف" : "پخش"}>
              {playing ? "⏸" : "▶"}
            </button>
            <button onClick={() => stepTo(1)} disabled={t >= 1} aria-label="گام بعد">
              ⏭
            </button>
            <span className={styles.stepText} aria-live="polite">
              {stepText(t)}
            </span>
            <button className={styles.speed} onClick={() => setSlow((s) => !s)} aria-pressed={slow}>
              {slow ? "آهسته" : "عادی"}
            </button>
          </div>
        )}
        {!diePath && !stageLocked && (
        <label className={styles.slider}>
          <span>تا کردن</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={t}
            disabled={!canFold}
            onChange={(e) => {
              setPlaying(false);
              setT(Number(e.target.value));
            }}
            aria-label="میزان تا شدن"
          />
          <span className={styles.percent}>{fa(Math.round(t * 100))}٪</span>
        </label>
        )}
        {!diePath && mode === "explore" && (
          <div className={styles.buttons}>
            <button onClick={() => setT(1)} disabled={!canFold}>
              تا کن
            </button>
            <button onClick={() => setT(0)}>باز کن</button>
          </div>
        )}
      </section>

      <aside className={styles.side}>
        {mode !== "try" && (
          <div className={styles.row} role="group" aria-label="گسترده یا تاس">
            {(["net", "dice"] as Part[]).map((pt) => {
              const on = (mode === "explore" ? explorePart : showPart) === pt;
              return (
                <button
                  key={pt}
                  className={on ? styles.primary : styles.clear}
                  aria-pressed={on}
                  onClick={() => {
                    if (mode === "explore") setExplorePart(pt);
                    else setShowPart(pt);
                    rollJump(0);
                    setPlaying(false);
                  }}
                >
                  {pt === "net" ? "گسترده" : mode === "explore" ? "تاس" : "غلتاندن تاس"}
                </button>
              );
            })}
          </div>
        )}
        {mode === "try" && dice && diceQuestion ? (
          <DiceTryPanel
            key={`${tryType}-${tryLevel}-${seed}`}
            question={diceQuestion}
            type={tryType}
            level={tryLevel}
            initialPick={initialPick}
            onType={(t) => freshQuestion(t, tryLevel)}
            onLevel={(l) => freshQuestion(tryType, l)}
            onNew={() => freshQuestion()}
            onAnswered={onAnswered}
            onNetDisplay={setTryDisplay}
            onDieDisplay={onDieDisplay}
            exam={practice.exam}
            onCheck={(v) => void practiceCheck(CUBE_NETS_ADAPTER, v)}
          />
        ) : mode === "explore" && explorePart === "dice" ? (
          <DiceExplorePanel
            die={exEnd.die}
            canRoll={{ E: onBoard(exNext("E")), W: onBoard(exNext("W")), N: onBoard(exNext("N")), S: onBoard(exNext("S")) }}
            onRoll={rollExplore}
            onReset={resetExplore}
            rolls={exPath.length}
          />
        ) : mode === "show" && showPart === "dice" ? (
          <DiceShowPanel
            start={showRoll.start}
            path={showRoll.path}
            p={roller.p}
            onNew={() => {
              setRollSeed(newSeed());
              rollJump(0);
            }}
          />
        ) : mode === "try" ? (
          <TryPanel
            key={`${tryType}-${tryLevel}-${seed}`}
            question={question}
            type={netType}
            level={tryLevel}
            initialPick={initialPick}
            onType={(t) => freshQuestion(t, tryLevel)}
            onLevel={(l) => freshQuestion(tryType, l)}
            onNew={() => freshQuestion()}
            onAnswered={onAnswered}
            onEdit={onEdit}
            onDisplay={setTryDisplay}
            exam={practice.exam}
            onCheck={(r) => void practiceCheck(CUBE_NETS_ADAPTER, r)}
          />
        ) : mode === "explore" ? (
          <>
            <h2>شش مربع بچین</h2>
            <NetEditor cells={drawn} labels={labels} marked={marked} onToggle={toggle} />
            <p className={`${styles.status} ${styles[info.tone]}`} role="status" aria-live="polite">
              {info.tone === "good" && "✓ "}
              {info.tone === "warn" && "! "}
              {info.text}
            </p>
            <div className={styles.row}>
              {status.kind === "valid" && (
                <button className={styles.primary} onClick={() => openInShow(drawn)}>
                  نشانم بده
                </button>
              )}
              <button
                className={styles.clear}
                onClick={() => {
                  setDrawn([]);
                  setT(0);
                }}
                disabled={!drawn.length}
              >
                پاک کن
              </button>
            </div>

            <h2 className={styles.progress}>
              کشف‌شده: {fa(found.size)} از {fa(11)}
            </h2>
            <ul className={styles.netList}>
              {CUBE_NETS.map((net, i) => (
                <li
                  key={i}
                  className={found.has(i) ? styles.found : styles.hidden}
                  aria-label={found.has(i) ? `گسترده ${fa(i + 1)} کشف شد` : `گسترده ${fa(i + 1)} هنوز پیدا نشده`}
                >
                  {found.has(i) ? <NetThumb cells={net} size={44} /> : <span className={styles.mystery}>؟</span>}
                  <span>{fa(i + 1)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <div className={styles.titleRow}>
              <h2>وجه‌های روبرو</h2>
              <button className={styles.toggle} onClick={() => setPairsOn((p) => !p)} aria-pressed={pairsOn}>
                {pairsOn ? "جفت‌ها: روشن" : "جفت‌ها: خاموش"}
              </button>
            </div>

            <div className={styles.diagram}>
              <NetThumb cells={showCells} size={180} labels={labels} colors={colors} />
            </div>

            {pairsOn && pairs.every(([a, b]) => pairReason(showCells, a, b) === "fold") && (
              <p className={`${styles.status} ${styles.info}`}>
                در این گسترده هیچ سه مربعی در یک ردیف نیست، پس قانون ۲ کمکی نمی‌کند. «▶» را بزن و ببین هر جفت کجا روبروی هم قرار می‌گیرد.
              </p>
            )}

            {pairsOn && pairs.some(([a, b]) => pairReason(showCells, a, b) === "row") && (
              <ul className={styles.pairs}>
                {pairs.map(([a, b], k) => (
                  <li key={k}>
                    <span className={styles.chip} style={{ background: PAIR_COLORS[k] }}>
                      {PAIR_DIGITS[k]}
                    </span>
                    {pairReason(showCells, a, b) === "row"
                      ? "در یک ردیف، با یک خانه فاصله (قانون ۲)"
                      : "با تا کردن معلوم می‌شود؛ «▶» را بزن"}
                  </li>
                ))}
              </ul>
            )}

            <div className={styles.rules}>
              <p>
                <strong>قانون ۱:</strong> دو وجه که ضلع مشترک دارند هیچ‌وقت روبروی هم نیستند.
              </p>
              <p>
                <strong>قانون ۲:</strong> دو وجه در یک ردیف که یک خانه بینشان فاصله است، روبروی هم هستند.
              </p>
            </div>

            <h2 className={styles.progress}>یک گسترده انتخاب کن</h2>
            <ul className={styles.netList}>
              {CUBE_NETS.map((net, i) => {
                const active = shapeKey(net) === showKey;
                return (
                  <li key={i}>
                    <button
                      className={`${styles.pick} ${active ? styles.active : ""}`}
                      onClick={() => openInShow(net)}
                      aria-label={`گسترده ${fa(i + 1)}`}
                      aria-pressed={active}
                    >
                      <NetThumb cells={net} size={44} />
                      <span>{fa(i + 1)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </aside>
    </main>
  );
}

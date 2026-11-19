"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Board } from "@/engine-2d/Board";
import {
  badLines,
  blankCells,
  brickIndex,
  givenValues,
  lineSum,
  magicFrame,
  makeNumberPuzzle,
  pyramidFrame,
  solveSteps,
  starFrame,
  valuesAfter,
  type Level,
  type NumberPuzzle,
  type PuzzleType,
  type Step,
} from "@/generators/number-puzzles";
import { newSeed } from "@/generators/random";
import { setClassroom as applyClassroom, useClassroom } from "@/toolkit/classroom";
import { NumberPad } from "@/toolkit/NumberPad";
import { TeacherGuideButton } from "@/toolkit/TeacherGuide";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/ToolLayout.module.css";
import tryStyles from "@/toolkit/TryPanel.module.css";
import { PUZZLES_GUIDE } from "./guide";
import { figureView, PuzzleFigure } from "./Pictures";
import { firstHint, linesRight, PUZZLE_TYPE_LABEL, PuzzleTryPanel, setFa, stepText } from "./PuzzleTryPanel";

type Mode = "explore" | "show" | "try";
type Area = "square" | "triangle" | "pyramid";
type Vals = (number | null)[];

const arith = (a: number, d: number, n: number) => Array.from({ length: n }, (_, i) => a + i * d);
const puzzleKey = (t: PuzzleType, l: Level, s: number, b: boolean) => `${t}-${l}-${s}-${b ? 1 : 0}`;

/** Cells a step fills, for the thick outline. */
function stepCells(s: Step | undefined): number[] {
  if (!s) return [];
  if (s.kind === "pick") return s.cells;
  if (s.kind === "check") return [4 * s.shape, 4 * s.shape + 1, 4 * s.shape + 2, 4 * s.shape + 3];
  if (s.kind === "centre" || s.kind === "line" || s.kind === "only" || s.kind === "apply") return [s.cell];
  return [];
}

/** Put v in cell `to` (taking it from `from`, or from the bank); a number already there moves back to `from`. */
function dropInto(vals: Vals, from: number | null, to: number | null, v: number): Vals {
  const next = [...vals];
  if (to === null) {
    if (from !== null) next[from] = null;
    return next;
  }
  const old = next[to];
  next[to] = v;
  if (from !== null) next[from] = old;
  return next;
}

/** First empty cell among `cells` after `after` (wrapping), or null. */
function nextEmpty(cells: number[], vals: Vals, after: number | null): number | null {
  const start = after === null ? 0 : cells.indexOf(after) + 1;
  for (let k = 0; k < cells.length; k++) {
    const c = cells[(start + k) % cells.length];
    if (vals[c] === null) return c;
  }
  return null;
}

/** Pyramid explore: the bottom row is set, the rest follows. */
function pyramidVals(base: Vals): Vals {
  const n = base.length;
  const vals: Vals = [];
  base.forEach((v, i) => (vals[brickIndex(n - 1, i)] = v));
  for (let r = n - 2; r >= 0; r--)
    for (let i = 0; i <= r; i++) {
      const [a, b] = [vals[brickIndex(r + 1, i)], vals[brickIndex(r + 1, i + 1)]];
      vals[brickIndex(r, i)] = a === null || b === null ? null : a + b;
    }
  return vals;
}

const SQUARE_SETS: [string, number, number][] = [
  ["۱ تا ۹", 1, 1],
  ["۲ تا ۱۰", 2, 1],
  ["زوج‌ها", 2, 2],
  ["فردها", 1, 2],
];
const TRIANGLE_SETS: [string, number, number][] = [
  ["۱ تا ۶", 1, 1],
  ["۲ تا ۷", 2, 1],
  ["زوج‌ها", 2, 2],
];

export function NumberPuzzlesTool() {
  const [mode, setMode] = useState<Mode>("explore");
  const [classroom, setClassroom] = useClassroom();

  // Playback 0 … 1 (show me).
  const [f, setF] = useState(0);
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

  // Explore
  const [area, setArea] = useState<Area>("square");
  const [sqSet, setSqSet] = useState<[number, number]>([1, 1]);
  const [sqVals, setSqVals] = useState<Vals>(() => Array(9).fill(null));
  const [triSet, setTriSet] = useState<[number, number]>([1, 1]);
  const [triVals, setTriVals] = useState<Vals>(() => Array(6).fill(null));
  const [base, setBase] = useState<Vals>([3, 5, 2, 4]);
  const [exSel, setExSel] = useState<number | null>(null);

  // Show me
  const [showType, setShowType] = useState<PuzzleType>("magic");
  const [showLevel, setShowLevel] = useState<Level>(2);
  const [showSeed, setShowSeed] = useState(310);
  const [showBig, setShowBig] = useState(false);
  const showQ = useMemo(() => makeNumberPuzzle(showType, showLevel, showSeed, showBig), [showType, showLevel, showSeed, showBig]);
  const steps = useMemo(() => solveSteps(showQ) ?? [], [showQ]);
  const stepMs = 1400;

  // Try it: answers belong to one puzzle, so they reset with it.
  const [tryType, setTryType] = useState<PuzzleType>("magic");
  const [tryLevel, setTryLevel] = useState<Level>(1);
  const [seed, setSeed] = useState(1010);
  const [big, setBig] = useState(false);
  const question = useMemo(() => makeNumberPuzzle(tryType, tryLevel, seed, big), [tryType, tryLevel, seed, big]);
  const qKey = puzzleKey(tryType, tryLevel, seed, big);
  const [entry, setEntry] = useState<{ key: string; vals: Vals; sel: number | null; checked: boolean } | null>(null);
  const blanks = useMemo(() => blankCells(question), [question]);
  const cur = entry?.key === qKey ? entry : { key: qKey, vals: givenValues(question), sel: blanks[0] ?? null, checked: false };

  // Shareable links: #try=magic&level=2&seed=7&big=1(&a=4,_,9), #show=pyramid&level=3&seed=5&step=2, #explore=triangle, #classroom
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.has("classroom")) applyClassroom(true);
    const tryParam = params.get("try");
    const show = params.get("show");
    const explore = params.get("explore");
    const lv = Number(params.get("level"));
    const level = lv === 1 || lv === 2 || lv === 3 ? lv : null;
    const sd = Number(params.get("seed"));
    const sdOk = params.has("seed") && Number.isInteger(sd) && sd >= 0;
    const b = params.get("big") === "1";
    const timer = setTimeout(() => {
      if (tryParam && tryParam in PUZZLE_TYPE_LABEL) {
        const t = tryParam as PuzzleType;
        const l = level ?? 1;
        const s = sdOk ? sd : 1010;
        setMode("try");
        setTryType(t);
        setTryLevel(l);
        setSeed(s);
        setBig(b);
        if (params.has("a")) {
          const q = makeNumberPuzzle(t, l, s, b);
          const vals = givenValues(q);
          const given = params.get("a")!.split(",");
          blankCells(q).forEach((c, i) => {
            const v = Number(given[i]);
            if (given[i] !== undefined && given[i] !== "_" && given[i] !== "" && Number.isInteger(v)) vals[c] = v;
          });
          setEntry({ key: puzzleKey(t, l, s, b), vals, sel: null, checked: !vals.includes(null) });
        }
      } else if (show && show in PUZZLE_TYPE_LABEL) {
        const t = show as PuzzleType;
        const l = level ?? 2;
        const s = sdOk ? sd : 310;
        setShowType(t);
        setShowLevel(l);
        setShowSeed(s);
        setShowBig(b);
        setMode("show");
        const n = solveSteps(makeNumberPuzzle(t, l, s, b))?.length ?? 1;
        const step = Number(params.get("step"));
        setF(params.has("step") && Number.isFinite(step) ? Math.min(1, Math.max(0, step / n)) : 1);
      } else if (explore === "square" || explore === "triangle" || explore === "pyramid") {
        setArea(explore);
        if (explore === "pyramid") setExSel(6);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const switchMode = (m: Mode) => {
    setMode(m);
    setRun(null);
    setF(m === "show" ? 0 : 1);
  };

  const freshQuestion = (type = tryType, level = tryLevel, b = big) => {
    setTryType(type);
    setTryLevel(level);
    setBig(b);
    setSeed(newSeed());
    setEntry(null);
  };

  const freshShow = (type = showType, level = showLevel, b = showBig) => {
    setShowType(type);
    setShowLevel(level);
    setShowBig(b);
    setShowSeed(newSeed());
    setRun(null);
    setF(0);
  };

  /** Show me, on the puzzle being tried. */
  const showThis = () => {
    setShowType(tryType);
    setShowLevel(tryLevel);
    setShowSeed(seed);
    setShowBig(big);
    setMode("show");
    const n = solveSteps(question)?.length ?? 1;
    animate(stepMs * n);
  };

  const play = () => {
    if (run) return setRun(null);
    animate(stepMs * Math.max(1, steps.length), f >= 0.99 ? 0 : f);
  };

  // Try: editing
  const setTry = (vals: Vals, sel = cur.sel) => setEntry({ key: qKey, vals, sel, checked: false });
  const tryEditable = (i: number) => !question.cells[i].given;
  const trySelect = (i: number) => setEntry({ ...cur, sel: i });
  const tryValue = (v: number | null) => {
    if (cur.sel === null) return;
    const vals = [...cur.vals];
    vals[cur.sel] = v;
    setTry(vals);
  };
  const tryTile = (v: number) => {
    const at = cur.sel !== null && tryEditable(cur.sel) ? cur.sel : nextEmpty(blanks, cur.vals, null);
    if (at === null) return;
    const vals = cur.vals.map((x, i) => (x === v && tryEditable(i) ? null : x));
    vals[at] = v;
    setTry(vals, nextEmpty(blanks, vals, at) ?? at);
  };

  // Explore: the figure and its editing
  const sqNumbers = arith(sqSet[0], sqSet[1], 9);
  const triNumbers = arith(triSet[0], triSet[1], 6);
  const exQ: NumberPuzzle = area === "square" ? magicFrame(sqNumbers) : area === "triangle" ? starFrame(triNumbers) : pyramidFrame(4);
  const exVals = area === "square" ? sqVals : area === "triangle" ? triVals : pyramidVals(base);
  const setExVals = area === "square" ? setSqVals : setTriVals;
  const exCells = area === "pyramid" ? [6, 7, 8, 9] : exQ.cells.map((_, i) => i);
  const exTile = (v: number) => {
    const at = exSel !== null ? exSel : nextEmpty(exCells, exVals, null);
    if (at === null) return;
    const vals = exVals.map((x) => (x === v ? null : x));
    vals[at] = v;
    setExVals(vals);
    setExSel(nextEmpty(exCells, vals, at));
  };

  // The board
  let board: React.ReactNode;
  let view: [number, number, number, number];
  if (mode === "explore") {
    const bank = area === "pyramid" ? null : exQ.set;
    view = figureView(exQ, bank);
    board = (
      <PuzzleFigure
        q={exQ}
        vals={exVals}
        editable={(i) => exCells.includes(i)}
        selected={exSel !== null && exCells.includes(exSel) ? exSel : null}
        onSelect={setExSel}
        onDrop={area === "pyramid" ? undefined : (from, to, v) => setExVals(dropInto(exVals, from, to, v))}
        onTile={area === "pyramid" ? undefined : exTile}
        bank={bank}
        sums={area === "pyramid" ? null : "live"}
      />
    );
  } else if (mode === "show") {
    const k = Math.round(f * steps.length);
    const last = steps[k - 1];
    view = figureView(showQ);
    board = <PuzzleFigure q={showQ} vals={valuesAfter(showQ, steps, k)} focusLine={last?.kind === "line" ? last.line : null} focusCells={stepCells(last)} sums={showQ.type === "magic" || showQ.type === "star" ? "full" : null} />;
  } else {
    const bank = question.set;
    view = figureView(question, bank);
    board = (
      <PuzzleFigure
        q={question}
        vals={cur.vals}
        editable={tryEditable}
        selected={cur.sel}
        onSelect={trySelect}
        onDrop={(from, to, v) => setTry(dropInto(cur.vals.map((x, i) => (from === null && x === v && tryEditable(i) ? null : x)), from, to, v), to ?? cur.sel)}
        onTile={tryTile}
        bank={bank}
        sums={cur.checked ? "marks" : null}
        bad={cur.checked ? badLines(question, cur.vals) : []}
      />
    );
  }

  const k = Math.round(f * steps.length);
  const sqRight = linesRight(exQ, exVals);
  const sideSums = area === "triangle" ? exQ.lines.map((l) => lineSum(l, triVals)) : [];
  const triDone = sideSums.length > 0 && sideSums.every((s) => s !== null && s === sideSums[0]);
  const pv = pyramidVals(base);

  return (
    <main className={styles.layout}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          → همه ابزارها
        </Link>
        <h1>
          <span className={styles.badge}>{fa(10)}</span> معماهای عدد
        </h1>
        <div className={styles.tabs} role="tablist" aria-label="حالت ابزار">
          <button role="tab" aria-selected={mode === "explore"} onClick={() => switchMode("explore")}>
            کشف: خودت بچین
          </button>
          <button
            role="tab"
            aria-selected={mode === "show"}
            onClick={() => {
              switchMode("show");
              animate(stepMs * Math.max(1, steps.length));
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
          <TeacherGuideButton guide={PUZZLES_GUIDE} />
          <Link href={`/tools/number-puzzles/worksheet?types=${tryType}&level=${tryLevel}`}>کاربرگ</Link>
        </div>
      </header>

      <section className={styles.stageWrap} aria-label="صفحه معما">
        <Board view={view} imageName="number-puzzle" label={mode === "show" ? "حل قدم‌به‌قدم" : "معما؛ عددها را بکش و رها کن"}>
          {board}
        </Board>
      </section>

      <section className={styles.controls}>
        {mode === "show" ? (
          <label className={styles.slider}>
            <button className={styles.playSmall} onClick={play} aria-label={run ? "توقف" : "پخش"}>
              {run ? "⏸" : "▶"}
            </button>
            <span>
              قدم {fa(k)} از {fa(steps.length)}
            </span>
            <input
              type="range"
              min={0}
              max={steps.length}
              step={1}
              value={k}
              onChange={(e) => {
                setRun(null);
                setF(Number(e.target.value) / Math.max(1, steps.length));
              }}
              aria-label="قدم"
            />
          </label>
        ) : (
          <p className={styles.stepText} style={{ margin: 0 }}>
            {mode === "try"
              ? firstHint(question)
              : area === "square"
                ? `${fa(sqRight)} از ۸ خط جمعشان ${fa(exQ.target!)} است`
                : area === "triangle"
                  ? triDone
                    ? `هر سه ضلع ${fa(sideSums[0]!)} ✓`
                    : "سه ضلع را برابر کن"
                  : `بالای هرم: ${fa(pv[0] ?? 0)}`}
          </p>
        )}
      </section>

      <aside className={styles.side}>
        {mode === "explore" && (
          <>
            <div className={styles.chipsRow} role="radiogroup" aria-label="معما">
              {(
                [
                  ["square", "مربع جادویی"],
                  ["triangle", "مثلث جادویی"],
                  ["pyramid", "هرم"],
                ] as [Area, string][]
              ).map(([a, label]) => (
                <button
                  key={a}
                  role="radio"
                  aria-checked={area === a}
                  onClick={() => {
                    setArea(a);
                    setExSel(a === "pyramid" ? 6 : null);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {area === "square" && (
              <>
                <h2 className={styles.progress}>مربع جادویی خودت را بساز</h2>
                <p className={styles.note}>
                  عددها را از پایین صفحه بکش و در خانه‌ها رها کن (یا خانه را بزن، بعد عدد را). عددی را از جدول بیرون بکش تا برگردد. جمع هر سطر، ستون و قطر زنده کنار آن نوشته می‌شود.
                </p>
                <div className={styles.chipsRow} role="radiogroup" aria-label="عددها" style={{ flexWrap: "wrap" }}>
                  {SQUARE_SETS.map(([label, a, d]) => (
                    <button
                      key={label}
                      role="radio"
                      aria-checked={sqSet[0] === a && sqSet[1] === d}
                      onClick={() => {
                        setSqSet([a, d]);
                        setSqVals(Array(9).fill(null));
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className={styles.row} style={{ marginTop: 8 }}>
                  <Stepper label={`شروع ${fa(sqSet[0])}`} onLess={() => (setSqSet([sqSet[0] - 1, sqSet[1]]), setSqVals(Array(9).fill(null)))} onMore={() => (setSqSet([sqSet[0] + 1, sqSet[1]]), setSqVals(Array(9).fill(null)))} lessOff={sqSet[0] <= 1} moreOff={sqSet[0] >= 20} />
                  <Stepper label={`گام ${fa(sqSet[1])}`} onLess={() => (setSqSet([sqSet[0], sqSet[1] - 1]), setSqVals(Array(9).fill(null)))} onMore={() => (setSqSet([sqSet[0], sqSet[1] + 1]), setSqVals(Array(9).fill(null)))} lessOff={sqSet[1] <= 1} moreOff={sqSet[1] >= 5} />
                </div>
                <p className={styles.status + " " + (sqRight === 8 ? styles.good : styles.info)}>
                  {sqRight === 8 ? "✓ مربع جادویی شد! هر هشت خط برابرند. " : `${fa(sqRight)} از ۸ خط درست. `}
                  جمع همه عددها {fa(sqNumbers.reduce((s, x) => s + x, 0))} است و سه سطر همه را می‌گیرند؛ پس هر خط باید{" "}
                  <bdi dir="ltr">
                    {fa(sqNumbers.reduce((s, x) => s + x, 0))} ÷ ۳ = {fa(exQ.target!)}
                  </bdi>{" "}
                  شود.
                </p>
                <p className={styles.note}>راهنما: عدد وسطی ({fa(sqNumbers[4])}) در چهار خط هست؛ آن را کجا بگذاری بهتر است؟</p>
                <button className={styles.clear} onClick={() => setSqVals(Array(9).fill(null))}>
                  پاک کردن جدول
                </button>
              </>
            )}

            {area === "triangle" && (
              <>
                <h2 className={styles.progress}>ضلع‌ها را برابر کن</h2>
                <p className={styles.note}>عددها را در دایره‌ها بکش. جمع هر ضلع کنار آن نوشته می‌شود؛ هر سه برابر شوند، کار تمام است. چند جمع مختلف می‌توانی بسازی؟</p>
                <div className={styles.chipsRow} role="radiogroup" aria-label="عددها">
                  {TRIANGLE_SETS.map(([label, a, d]) => (
                    <button
                      key={label}
                      role="radio"
                      aria-checked={triSet[0] === a && triSet[1] === d}
                      onClick={() => {
                        setTriSet([a, d]);
                        setTriVals(Array(6).fill(null));
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className={styles.status + " " + (triDone ? styles.good : styles.info)}>
                  {triDone ? `✓ هر سه ضلع ${fa(sideSums[0]!)} است.` : `ضلع‌ها: ${sideSums.map((s) => (s === null ? "…" : fa(s))).join("، ")}`}
                </p>
                <p className={styles.note}>راهنما: هر گوشه در دو ضلع حساب می‌شود. گوشه‌های کوچک جمع کوچک می‌سازند.</p>
                <button className={styles.clear} onClick={() => setTriVals(Array(6).fill(null))}>
                  پاک کردن
                </button>
              </>
            )}

            {area === "pyramid" && (
              <>
                <h2 className={styles.progress}>هرم را بساز</h2>
                <p className={styles.note}>یک آجر پایین را بزن و عددش را عوض کن. هر آجر جمع دو آجر زیرش است و همه زنده حساب می‌شوند.</p>
                <NumberPad
                  value={exSel !== null && exSel >= 6 && base[exSel - 6] !== null ? String(base[exSel - 6]) : ""}
                  onChange={(v) => {
                    if (exSel === null || exSel < 6) return;
                    const next = [...base];
                    next[exSel - 6] = v === "" ? null : Number(v);
                    setBase(next);
                  }}
                  disabled={exSel === null || exSel < 6}
                  maxDigits={2}
                />
                {pv[0] !== null && (
                  <p className={styles.status + " " + styles.info}>
                    هر عدد وسط پایه از سه راه به بالا می‌رسد:{" "}
                    <bdi dir="ltr">
                      {fa(base[0]!)} + ۳ × {fa(base[1]!)} + ۳ × {fa(base[2]!)} + {fa(base[3]!)} = {fa(pv[0])}
                    </bdi>
                  </p>
                )}
              </>
            )}
          </>
        )}

        {mode === "show" && (
          <>
            <div className={tryStyles.types} role="radiogroup" aria-label="نوع معما">
              {(Object.keys(PUZZLE_TYPE_LABEL) as PuzzleType[]).map((t) => (
                <button key={t} role="radio" aria-checked={showType === t} onClick={() => freshShow(t)}>
                  {PUZZLE_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            <div className={tryStyles.chips} role="radiogroup" aria-label="سطح" style={{ marginTop: 6 }}>
              {([1, 2, 3] as Level[]).map((l) => (
                <button key={l} role="radio" aria-checked={showLevel === l} onClick={() => freshShow(showType, l)}>
                  سطح {fa(l)}
                </button>
              ))}
            </div>
            <div className={tryStyles.chips} role="radiogroup" aria-label="اندازه اعداد" style={{ marginTop: 6 }}>
              <button role="radio" aria-checked={!showBig} onClick={() => freshShow(showType, showLevel, false)}>
                اعداد کوچک
              </button>
              <button role="radio" aria-checked={showBig} onClick={() => freshShow(showType, showLevel, true)}>
                اعداد بزرگ
              </button>
            </div>
            <h2 className={styles.progress} style={{ marginTop: 10 }}>
              حل قدم‌به‌قدم
            </h2>
            <p className={styles.note}>هر بار خانه‌ای پر می‌شود که فقط یک انتخاب دارد. خط به‌کاررفته خط‌چین است و خانه تازه با قاب پررنگ.</p>
            <ol className={styles.note} style={{ listStyle: "none", padding: 0 }}>
              {steps.slice(0, Math.max(1, k)).map((s, i) => (
                <li key={i} style={i === k - 1 ? { fontWeight: 700, color: "var(--ink)" } : undefined} aria-current={i === k - 1 ? "step" : undefined}>
                  {k === 0 ? "▶ را بزن تا حل شروع شود." : `${i === k - 1 ? "◀ " : ""}${fa(i + 1)}. ${stepText(showQ, s)}`}
                </li>
              ))}
            </ol>
            <div className={styles.row}>
              <button className={styles.clear} disabled={k <= 0} onClick={() => (setRun(null), setF((k - 1) / steps.length))}>
                قدم قبل
              </button>
              <button className={styles.clear} disabled={k >= steps.length} onClick={() => (setRun(null), setF((k + 1) / steps.length))}>
                قدم بعد
              </button>
            </div>
            <div className={styles.row} style={{ marginTop: 8 }}>
              <button className={styles.clear} onClick={() => freshShow()}>
                نمونه تازه
              </button>
              <button
                className={styles.clear}
                onClick={() => {
                  setTryType(showType);
                  setTryLevel(showLevel);
                  setSeed(showSeed);
                  setBig(showBig);
                  setEntry(null);
                  switchMode("try");
                }}
              >
                خودم امتحان کنم
              </button>
            </div>
          </>
        )}

        {mode === "try" && (
          <PuzzleTryPanel
            question={question}
            type={tryType}
            level={tryLevel}
            big={big}
            vals={cur.vals}
            selected={cur.sel}
            onValue={tryValue}
            checked={cur.checked}
            onCheck={() => setEntry({ ...cur, checked: true })}
            onType={(t) => freshQuestion(t, tryLevel)}
            onLevel={(l) => freshQuestion(tryType, l)}
            onBig={(b) => freshQuestion(tryType, tryLevel, b)}
            onNew={() => freshQuestion()}
            onShow={showThis}
          />
        )}
        {mode === "try" && <p className={styles.note} style={{ marginTop: 8 }}>{tryNote(question)}</p>}
      </aside>
    </main>
  );
}

function tryNote(q: NumberPuzzle) {
  if (q.type === "magic" && q.set) return `عددها: ${setFa(q.set)}. بعد از «بررسی»، هر خط نادرست هاشور می‌خورد و ✗ می‌گیرد.`;
  if (q.type === "shape") return "شکل‌ها از راست خوانده می‌شوند: شکل ۱ سمت راست است.";
  if (q.type === "grid") return `جمع کل (گوشه پایین چپ) هم جمع ستون «جمع» است و هم جمع سطر «جمع».`;
  return "بعد از «بررسی»، هر خط نادرست هاشور می‌خورد و ✗ می‌گیرد.";
}

function Stepper({ label, onLess, onMore, lessOff, moreOff }: { label: string; onLess: () => void; onMore: () => void; lessOff: boolean; moreOff: boolean }) {
  return (
    <div className={styles.row} style={{ flex: 1 }}>
      <button className={styles.clear} onClick={onLess} disabled={lessOff} aria-label="کمتر">
        −
      </button>
      <span className={styles.stepperLabel}>{label}</span>
      <button className={styles.clear} onClick={onMore} disabled={moreOff} aria-label="بیشتر">
        +
      </button>
    </div>
  );
}

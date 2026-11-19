"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  makeTransformQuestion,
  moveFigure,
  normalize,
  stagedOps,
  SYMBOLS,
  type Figure,
  type Level,
  type MoveName,
  type Op,
  type Pt,
  type TransformQuestionType,
} from "@/generators/transforms";
import { newSeed } from "@/generators/random";
import { setClassroom as applyClassroom, useClassroom } from "@/toolkit/classroom";
import { TeacherGuideButton } from "@/toolkit/TeacherGuide";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/ToolLayout.module.css";
import { TRANSFORMS_GUIDE } from "./guide";
import { progress } from "./Pictures";
import { TransformScene } from "./Scene";
import { MOVE_NAME, TRANSFORM_TYPE_LABEL, TransformTryPanel, type SceneSetup } from "./TransformTryPanel";

type Mode = "explore" | "show" | "try";
type MoveKind = "mirror" | "water" | "rotate" | "shift";
type Brush = "cell" | "letter";

const W = 16;
const H = 10;
const BOARD = { x0: 0, y0: 0, x1: W, y1: H };

/** An F-shaped starter, so the board is not empty on first visit. */
const STARTER: Figure = {
  cells: [
    [3.5, 3.5],
    [3.5, 4.5],
    [3.5, 5.5],
    [4.5, 5.5],
    [4.5, 4.5],
  ],
  mark: { at: [3.5, 5.5], symbol: "F", m: [1, 0, 0, 1] },
};

const SHOW_CHOICES: { key: string; label: string; moves: MoveName[] }[] = [
  { key: "mirror", label: "آینه", moves: ["mirror"] },
  { key: "water", label: "آب", moves: ["water"] },
  { key: "cw90", label: "۹۰° ↻", moves: ["cw90"] },
  { key: "r180", label: "۱۸۰°", moves: ["r180"] },
  { key: "ccw90", label: "۹۰° ↺", moves: ["ccw90"] },
  { key: "combo", label: "آینه، بعد ۹۰° ↻", moves: ["mirror", "cw90"] },
];

const SHOW_WHY: Record<MoveName, string> = {
  mirror: "آینه: هر خانه به همان فاصله، آن طرف آینه می‌رود. چپ و راست جابه‌جا می‌شود، بالا و پایین نه. حرف برعکس می‌شود.",
  water: "آب: هر خانه به همان فاصله، زیر خط آب می‌رود. بالا و پایین جابه‌جا می‌شود، چپ و راست نه. حرف وارونه و برعکس می‌شود.",
  cw90: "چرخش ۹۰ درجه ساعتگرد: شکل مثل عقربه ساعت یک‌چهارم دور می‌زند. بالای شکل به راست می‌رود. حرف برعکس نمی‌شود، فقط می‌خوابد.",
  r180: "نیم‌دور: شکل دو بار ۹۰ درجه می‌چرخد. بالا پایین می‌شود و راست چپ؛ ولی حرف برعکس نمی‌شود.",
  ccw90: "چرخش ۹۰ درجه پادساعتگرد: خلاف عقربه ساعت یک‌چهارم دور. بالای شکل به چپ می‌رود.",
};

export function TransformsTool() {
  const [mode, setMode] = useState<Mode>("explore");
  const [classroom, setClassroom] = useClassroom();

  // Playback 0 … 1 over the moves, animated between two values.
  const [f, setF] = useState(1);
  const [run, setRun] = useState<{ from: number; to: number; ms: number } | null>(null);
  const fRef = useRef(f);
  useEffect(() => {
    fRef.current = f;
  }, [f]);
  useEffect(() => {
    if (!run) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const a = Math.min(1, (now - start) / run.ms);
      setF(run.from + (run.to - run.from) * a);
      if (a < 1) frame = requestAnimationFrame(tick);
      else setRun(null);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [run]);
  const animate = useCallback((from: number, to: number, steps: number) => {
    setF(from);
    setRun({ from, to, ms: 300 + 1300 * Math.abs(to - from) * Math.max(1, steps) });
  }, []);

  // Explore
  const [figure, setFigure] = useState<Figure>(STARTER);
  const [brush, setBrush] = useState<Brush>("cell");
  const [kind, setKind] = useState<MoveKind>("mirror");
  const [mirrorX, setMirrorX] = useState(8);
  const [waterY, setWaterY] = useState(3);
  const [pivot, setPivot] = useState<Pt>([8, 4]);
  const [deg, setDeg] = useState(90);
  const [shift, setShift] = useState<Pt>([5, 1]);
  const [links, setLinks] = useState(true);

  const exploreOp: Op =
    kind === "mirror"
      ? { kind: "reflect", line: { kind: "v", c: mirrorX } }
      : kind === "water"
        ? { kind: "reflect", line: { kind: "h", c: waterY } }
        : kind === "rotate"
          ? { kind: "rotate", deg, about: pivot }
          : { kind: "shift", by: shift };
  const image = figure.cells.length ? moveFigure(figure, exploreOp) : null;
  const offBoard = image?.cells.some(([x, y]) => x < 0 || y < 0 || x > W || y > H);

  const tapCell = (i: number, j: number) => {
    const c: Pt = [i + 0.5, j + 0.5];
    const same = (p: Pt) => p[0] === c[0] && p[1] === c[1];
    const has = figure.cells.some(same);
    if (brush === "letter") {
      if (!has) return;
      if (figure.mark && same(figure.mark.at)) {
        const next = SYMBOLS[(SYMBOLS.indexOf(figure.mark.symbol) + 1) % (SYMBOLS.length + 1)];
        setFigure({ cells: figure.cells, mark: next ? { ...figure.mark, symbol: next } : undefined });
      } else setFigure({ cells: figure.cells, mark: { at: c, symbol: figure.mark?.symbol ?? "F", m: figure.mark?.m ?? [1, 0, 0, 1] } });
      return;
    }
    if (has) {
      const cells = figure.cells.filter((p) => !same(p));
      setFigure({ cells, mark: figure.mark && !same(figure.mark.at) ? figure.mark : undefined });
    } else if (figure.cells.length < 12) setFigure({ ...figure, cells: [...figure.cells, c] });
  };

  // Show me
  const [showKey, setShowKey] = useState("mirror");
  const [reversed, setReversed] = useState(false);
  const chosen = SHOW_CHOICES.find((c) => c.key === showKey)!.moves;
  const showMoves = useMemo(() => (reversed && showKey === "combo" ? [...chosen].reverse() : chosen), [chosen, reversed, showKey]);
  const showFigure = useMemo(() => {
    const base = figure.cells.length ? normalize(figure) : normalize(STARTER);
    return moveFigure(base, { kind: "shift", by: [1, 3] });
  }, [figure]);
  const showOps = useMemo(() => stagedOps(showFigure, showMoves), [showFigure, showMoves]);
  // Which named move each board move belongs to (a turn is a slide, then the turn).
  const moveOfOp = showOps.map((_, i) => showOps.slice(0, i + 1).filter((o) => o.kind !== "shift").length - (showOps[i].kind === "shift" ? 0 : 1));
  const { done } = progress(showOps, f);
  const showStep = f > 0 ? Math.min(showMoves.length - 1, moveOfOp[done]) : -1;

  // Try it
  const [tryType, setTryType] = useState<TransformQuestionType>("mirror");
  const [tryLevel, setTryLevel] = useState<Level>(1);
  const [seed, setSeed] = useState(1811);
  const [initialPick, setInitialPick] = useState<number | undefined>(undefined);
  const question = useMemo(() => makeTransformQuestion(tryType, tryLevel, seed), [tryType, tryLevel, seed]);
  const [scene, setScene] = useState<SceneSetup | null>(null);
  const [painted, setPainted] = useState<string[]>([]);

  // Shareable links: #try=mirror&level=2&seed=7(&pick=n), #show=combo, #f=0.5, #classroom
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.has("classroom")) applyClassroom(true);
    const tryParam = params.get("try");
    const show = params.get("show");
    const timer = setTimeout(() => {
      if (tryParam) {
        setMode("try");
        if (tryParam in TRANSFORM_TYPE_LABEL) setTryType(tryParam as TransformQuestionType);
        const lv = Number(params.get("level"));
        if (lv === 1 || lv === 2 || lv === 3) setTryLevel(lv);
        const sd = Number(params.get("seed"));
        if (Number.isInteger(sd) && sd >= 0) setSeed(sd);
        setF(0);
        const pk = Number(params.get("pick"));
        if (params.has("pick") && pk >= 1 && pk <= 4) {
          setInitialPick(pk - 1);
          setF(1);
        }
      } else if (show !== null) {
        setMode("show");
        if (SHOW_CHOICES.some((c) => c.key === show)) setShowKey(show);
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
    setInitialPick(undefined);
    setScene(null);
    setPainted([]);
    setRun(null);
    setF(0);
  };

  const onAnswered = useCallback(() => animate(0, 1, question.type === "combo" ? question.moves.length : 1), [question, animate]);

  const steps = mode === "show" ? showMoves.length : mode === "try" && scene ? Math.max(1, scene.ops.filter((o) => o.kind !== "shift").length) : 1;
  const play = () => {
    if (run) return setRun(null);
    animate(f >= 0.99 ? 0 : f, 1, steps);
  };

  let board: React.ReactNode;
  if (mode === "explore")
    board = (
      <TransformScene
        figure={figure}
        ops={image ? [exploreOp] : []}
        f={f}
        copy={!!image}
        given={[exploreOp]}
        links={links}
        grid={BOARD}
        onCell={tapCell}
        imageName="transforms"
        label="صفحه شطرنجی؛ روی خانه‌ها بزن"
      />
    );
  else if (mode === "show") board = <TransformScene figure={showFigure} ops={showOps} f={f} copy guides links imageName="transforms" />;
  else if (scene)
    board = (
      <TransformScene
        {...scene}
        f={f}
        painted={scene.grid ? painted : undefined}
        onCell={scene.paint ? (i, j) => {
          const key = `${i},${j}`;
          setPainted((ps) => (ps.includes(key) ? ps.filter((k) => k !== key) : [...ps, key]));
        } : undefined}
        imageName="transforms"
      />
    );

  return (
    <main className={styles.layout}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          → همه ابزارها
        </Link>
        <h1>
          <span className={styles.badge}>{fa(1)}</span> تبدیل‌ها: آینه، آب، چرخش
        </h1>
        <div className={styles.tabs} role="tablist" aria-label="حالت ابزار">
          <button role="tab" aria-selected={mode === "explore"} onClick={() => switchMode("explore")}>
            کشف: خودت بساز
          </button>
          <button role="tab" aria-selected={mode === "show"} onClick={() => { switchMode("show"); animate(0, 1, showMoves.length); }}>
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
          <TeacherGuideButton guide={TRANSFORMS_GUIDE} />
          <Link href={`/tools/transforms/worksheet?types=${tryType}&level=${tryLevel}`}>کاربرگ</Link>
        </div>
      </header>

      <section className={styles.stageWrap} aria-label="صفحه شطرنجی">
        {board}
      </section>

      <section className={styles.controls}>
        <label className={styles.slider}>
          <button className={styles.playSmall} onClick={play} aria-label={run ? "توقف" : "پخش"}>
            {run ? "⏸" : "▶"}
          </button>
          <span>انجام تبدیل</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={f}
            onChange={(e) => {
              setRun(null);
              setF(Number(e.target.value));
            }}
            aria-label="میزان انجام تبدیل"
          />
        </label>
      </section>

      <aside className={styles.side}>
        {mode === "explore" && (
          <>
            <h2>۱. شکل بکش</h2>
            <div className={styles.chipsRow} role="radiogroup" aria-label="قلم">
              <button role="radio" aria-checked={brush === "cell"} onClick={() => setBrush("cell")}>
                ■ خانه
              </button>
              <button role="radio" aria-checked={brush === "letter"} onClick={() => setBrush("letter")}>
                F حرف
              </button>
            </div>
            <p className={styles.note}>
              {brush === "cell"
                ? "روی خانه‌های صفحه بزن تا به شکل اضافه یا از آن کم شود."
                : `روی یکی از خانه‌های شکل بزن تا حرف رویش برود؛ دوباره بزنی، حرف عوض می‌شود (${SYMBOLS.join("، ")}، بی‌حرف).`}
            </p>
            <div className={styles.row}>
              <button className={styles.clear} onClick={() => setFigure({ cells: [] })} disabled={!figure.cells.length}>
                پاک کن
              </button>
              <button className={styles.clear} onClick={() => setFigure(STARTER)}>
                شکل نمونه
              </button>
            </div>

            <h2 className={styles.progress}>۲. تبدیل را انتخاب کن</h2>
            <div className={styles.chipsRow} role="radiogroup" aria-label="تبدیل">
              {(
                [
                  ["mirror", "آینه"],
                  ["water", "آب"],
                  ["rotate", "چرخش"],
                  ["shift", "انتقال"],
                ] as [MoveKind, string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => {
                    setKind(k);
                    animate(0, 1, 1);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {kind === "mirror" && (
              <Stepper label={`آینه روی خط ${fa(mirrorX)}`} onLess={() => setMirrorX((x) => Math.max(1, x - 1))} onMore={() => setMirrorX((x) => Math.min(W - 1, x + 1))} less="→ چپ" more="راست ←" />
            )}
            {kind === "water" && <Stepper label={`لب آب روی خط ${fa(waterY)}`} onLess={() => setWaterY((y) => Math.max(1, y - 1))} onMore={() => setWaterY((y) => Math.min(H - 1, y + 1))} less="↓ پایین" more="بالا ↑" />}
            {kind === "rotate" && (
              <>
                <div className={styles.chipsRow} role="radiogroup" aria-label="زاویه">
                  {[
                    [90, "۹۰° ↻"],
                    [180, "۱۸۰°"],
                    [-90, "۹۰° ↺"],
                  ].map(([d, label]) => (
                    <button key={d} role="radio" aria-checked={deg === d} onClick={() => { setDeg(d as number); animate(0, 1, 1); }}>
                      {label}
                    </button>
                  ))}
                </div>
                <Stepper label="نقطه چرخش (قرمز)" onLess={() => setPivot(([x, y]) => [Math.max(0, x - 1), y])} onMore={() => setPivot(([x, y]) => [Math.min(W, x + 1), y])} less="→" more="←" />
                <Stepper label="" onLess={() => setPivot(([x, y]) => [x, Math.max(0, y - 1)])} onMore={() => setPivot(([x, y]) => [x, Math.min(H, y + 1)])} less="↓" more="↑" />
              </>
            )}
            {kind === "shift" && (
              <>
                <Stepper label={`افقی: ${fa(Math.abs(shift[0]))} خانه ${shift[0] >= 0 ? "به راست" : "به چپ"}`} onLess={() => setShift(([x, y]) => [x - 1, y])} onMore={() => setShift(([x, y]) => [x + 1, y])} less="→" more="←" />
                <Stepper label={`عمودی: ${fa(Math.abs(shift[1]))} خانه ${shift[1] >= 0 ? "به بالا" : "به پایین"}`} onLess={() => setShift(([x, y]) => [x, y - 1])} onMore={() => setShift(([x, y]) => [x, y + 1])} less="↓" more="↑" />
              </>
            )}

            <div className={styles.titleRow}>
              <h2 className={styles.progress}>۳. ببین</h2>
              <button className={styles.toggle} aria-pressed={links} onClick={() => setLinks((l) => !l)}>
                {links ? "خط‌چین‌ها: روشن" : "خط‌چین‌ها: خاموش"}
              </button>
            </div>
            <p className={styles.note}>شکل زرد، تصویرش آبیِ راه‌راه. «▶» را بزن تا تبدیل آهسته انجام شود.</p>
            {offBoard && <p className={`${styles.status} ${styles.warn}`}>تصویر از صفحه بیرون زده؛ خط یا نقطه را جابه‌جا کن.</p>}
            <button
              className={styles.clear}
              disabled={!image || offBoard}
              onClick={() => {
                if (image) setFigure(image);
                setF(0);
              }}
            >
              تصویر را شکل اصلی کن (تبدیل بعدی)
            </button>
          </>
        )}

        {mode === "show" && (
          <>
            <div className={styles.choiceGrid} role="radiogroup" aria-label="تبدیل">
              {SHOW_CHOICES.map((c) => (
                <button
                  key={c.key}
                  role="radio"
                  aria-checked={showKey === c.key}
                  onClick={() => {
                    setShowKey(c.key);
                    animate(0, 1, c.moves.length);
                  }}
                >
                  {c.key === "combo" && reversed ? "۹۰° ↻، بعد آینه" : c.label}
                </button>
              ))}
            </div>
            <p className={styles.note}>{figure.cells.length ? "شکلی که خودت کشیدی" : "یک شکل نمونه"}. خط‌چین‌های آبی هر خانه را به جایش در تصویر وصل می‌کنند.</p>
            <ol className={styles.pairs}>
              {showMoves.map((m, i) => (
                <li key={i} aria-current={showStep === i ? "step" : undefined} style={{ fontWeight: showStep === i ? 700 : 400 }}>
                  <span className={styles.chip}>{fa(i + 1)}</span> {MOVE_NAME[m]}
                </li>
              ))}
            </ol>
            <p className={styles.stepText}>{SHOW_WHY[showMoves[Math.max(0, showStep)]]}</p>
            {showKey === "combo" && <p className={`${styles.status} ${styles.info}`}>ترتیب مهم است: با ترتیب برعکس، شکل آخر فرق می‌کند. امتحانش کن!</p>}
            {showKey === "combo" && (
              <button
                className={styles.clear}
                onClick={() => {
                  setReversed((r) => !r);
                  animate(0, 1, 2);
                }}
              >
                ترتیب را برعکس کن
              </button>
            )}
          </>
        )}

        {mode === "try" && (
          <TransformTryPanel
            key={`${tryType}-${tryLevel}-${seed}`}
            question={question}
            type={tryType}
            level={tryLevel}
            initialPick={initialPick}
            painted={painted}
            onClearPaint={() => setPainted([])}
            onType={(ty) => freshQuestion(ty, tryLevel)}
            onLevel={(l) => freshQuestion(tryType, l)}
            onNew={() => freshQuestion()}
            onAnswered={onAnswered}
            onScene={setScene}
          />
        )}
      </aside>
    </main>
  );
}

function Stepper({ label, less, more, onLess, onMore }: { label: string; less: string; more: string; onLess: () => void; onMore: () => void }) {
  return (
    <div className={styles.row}>
      <button className={styles.clear} onClick={onLess}>
        {less}
      </button>
      {label && <span className={styles.stepperLabel}>{label}</span>}
      <button className={styles.clear} onClick={onMore}>
        {more}
      </button>
    </div>
  );
}

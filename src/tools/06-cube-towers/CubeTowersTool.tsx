"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  countCubes,
  emptyTower,
  frontView,
  hiddenCount,
  layerCounts,
  makeTowerQuestion,
  paintedCount,
  sideView,
  topView,
  type Level,
  type Tower,
  type TowerQuestionType,
} from "@/generators/cube-towers";
import { newSeed } from "@/generators/random";
import { Stage, type Look } from "@/engine-3d/Stage";
import { setClassroom as applyClassroom, useClassroom } from "@/toolkit/classroom";
import { TeacherGuideButton } from "@/toolkit/TeacherGuide";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/ToolLayout.module.css";
import { CUBE_TOWERS_GUIDE } from "./guide";
import { PaintScene } from "./PaintScene";
import { HeightGrid, ViewSvg } from "./Pictures";
import { LAYER_COLORS, TowerScene, type ColumnTap } from "./TowerScene";
import { TOWER_TYPE_LABEL, TowerTryPanel, type TowerDisplay } from "./TowerTryPanel";
import { paintWhy } from "./paintText";

type Mode = "explore" | "show" | "try";
type ShowPart = "layers" | "paint";

const BOARD = 5;
const MAX_H = 5;
const CAMERA: [number, number, number] = [5.2, 6.4, 7.4];
const TARGET: [number, number, number] = [0, 0.9, 0];

/** A small starting tower, so the board is not empty on first visit. */
function starter(): Tower {
  const t = emptyTower(BOARD, BOARD);
  t.h[1][1] = 2;
  t.h[1][2] = 1;
  t.h[2][1] = 1;
  return t;
}

/** Sample tower with hidden cubes, for "show me" when the child has not built one. */
const SAMPLE = (() => {
  const q = makeTowerQuestion("count", 2, 1405);
  return q.type === "count" ? q.tower : starter();
})();

export function CubeTowersTool() {
  const [mode, setMode] = useState<Mode>("explore");
  const [classroom, setClassroom] = useClassroom();
  const [look, setLook] = useState<Look | null>(null);
  const [lookNonce, setLookNonce] = useState(0);
  const flyTo = (l: Look) => {
    setLook(l);
    setLookNonce((n) => n + 1);
  };

  // Playback value: layers pulled apart, painted cube opened (0..1).
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const next = Math.min(1, tRef.current + (now - last) / 1600);
      last = now;
      setT(next);
      if (next >= 1) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);
  const play = () => {
    if (playing) return setPlaying(false);
    if (t >= 1) setT(0);
    setPlaying(true);
  };

  // Explore
  const [tower, setTower] = useState<Tower>(starter);
  const [remove, setRemove] = useState(false);
  const [showCount, setShowCount] = useState(true);

  // Show me
  const [part, setPart] = useState<ShowPart>("layers");
  const [showHidden, setShowHidden] = useState(true);
  const [paintN, setPaintN] = useState(3);
  const [focus, setFocus] = useState<number | null>(null);
  const showTower = countCubes(tower) ? tower : SAMPLE;

  // Try it
  const [tryType, setTryType] = useState<TowerQuestionType>("count");
  const [tryLevel, setTryLevel] = useState<Level>(1);
  const [seed, setSeed] = useState(1405);
  const [initialPick, setInitialPick] = useState<number | undefined>(undefined);
  const question = useMemo(() => makeTowerQuestion(tryType, tryLevel, seed), [tryType, tryLevel, seed]);
  const [build, setBuild] = useState<Tower>(() => emptyTower(3, 3));
  const [display, setDisplay] = useState<TowerDisplay | null>(null);

  // Shareable links: #try=count&level=2&seed=7(&pick=n), #show=paint, #classroom
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.has("classroom")) applyClassroom(true);
    const tryParam = params.get("try");
    const show = params.get("show");
    if (!tryParam && show === null) return;
    const timer = setTimeout(() => {
      if (tryParam) {
        setMode("try");
        if (tryParam in TOWER_TYPE_LABEL) setTryType(tryParam as TowerQuestionType);
        const lv = Number(params.get("level"));
        if (lv === 1 || lv === 2 || lv === 3) setTryLevel(lv);
        const sd = Number(params.get("seed"));
        if (Number.isInteger(sd) && sd >= 0) setSeed(sd);
        const pk = Number(params.get("pick"));
        if (params.has("pick") && pk >= 1 && pk <= 4) {
          setInitialPick(pk - 1);
          setT(1);
        }
      } else {
        setMode("show");
        if (show === "paint") setPart("paint");
        const tt = Number(params.get("t"));
        if (Number.isFinite(tt)) setT(Math.min(1, Math.max(0, tt)));
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const switchMode = (m: Mode) => {
    setMode(m);
    setPlaying(false);
    setT(0);
    flyTo("corner");
  };

  const freshQuestion = (type = tryType, level = tryLevel) => {
    setTryType(type);
    setTryLevel(level);
    setSeed(newSeed());
    setInitialPick(undefined);
    setBuild(emptyTower(3, 3));
    setDisplay(null);
    setPlaying(false);
    setT(0);
    flyTo("corner");
  };

  const onAnswered = useCallback(() => {
    setT(0);
    setPlaying(true);
  }, []);

  // Taps on the 3D scene edit the explore tower or the build answer.
  const editTower = (current: Tower, tap: ColumnTap, maxH: number, removing: boolean): Tower | null => {
    let { x, y } = tap;
    if (removing) {
      if (!current.h[y][x]) return null;
    } else if (tap.side) {
      x += tap.side[0];
      y += tap.side[1];
      if (x < 0 || y < 0 || x >= current.w || y >= current.d) return null;
    }
    const h = current.h[y][x] + (removing ? -1 : 1);
    if (h < 0 || h > maxH) return null;
    const next = { ...current, h: current.h.map((r) => [...r]) };
    next.h[y][x] = h;
    return next;
  };

  const setHeight = (x: number, y: number, h: number) => {
    const next = { ...tower, h: tower.h.map((r) => [...r]) };
    next.h[y][x] = h;
    setTower(next);
  };

  // What the 3D stage shows.
  let scene: React.ReactNode;
  if (mode === "explore") {
    scene = (
      <TowerScene
        tower={tower}
        onTap={(tap) => {
          const next = editTower(tower, tap, MAX_H, remove);
          if (next) setTower(next);
        }}
      />
    );
  } else if (mode === "show") {
    scene = part === "layers" ? <TowerScene tower={showTower} explode={t} showHidden={showHidden} /> : <PaintScene n={paintN} explode={t} focus={focus} />;
  } else if (display?.scene === "paint") {
    scene = <PaintScene n={display.n} explode={display.explode ? t : 0} focus={display.focus} />;
  } else if (display?.scene === "tower") {
    scene = (
      <TowerScene
        tower={display.tower}
        explode={display.explode ? t : 0}
        showHidden={display.showHidden}
        ghosts={display.ghosts}
        frame={display.frame}
        onTap={
          question.type === "build"
            ? (tap) => {
                const next = editTower(build, tap, 3, false);
                if (next) setBuild(next);
              }
            : undefined
        }
      />
    );
  }

  const stageLook = mode === "try" && display?.scene === "tower" && display.look ? display.look : look;

  return (
    <main className={styles.layout}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          → همه ابزارها
        </Link>
        <h1>
          <span className={styles.badge}>{fa(6)}</span> برج مکعب‌ها
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
          <TeacherGuideButton guide={CUBE_TOWERS_GUIDE} />
          <Link href={`/tools/cube-towers/worksheet?types=${tryType}&level=${tryLevel}`}>کاربرگ</Link>
        </div>
      </header>

      <section className={styles.stageWrap} aria-label="صحنه سه‌بعدی">
        <Stage imageName="cube-tower" camera={CAMERA} target={TARGET} look={stageLook} lookNonce={lookNonce}>
          {scene}
        </Stage>
      </section>

      <section className={styles.controls}>
        <div className={styles.viewButtons} role="group" aria-label="بردن دوربین به یک نما">
          {(["front", "side", "top", "corner"] as Look[]).map((l) => (
            <button key={l} onClick={() => flyTo(l)}>
              {{ front: "نمای روبرو", side: "نمای کنار", top: "نمای بالا", corner: "گوشه" }[l]}
            </button>
          ))}
        </div>
        {mode !== "explore" && (
          <label className={styles.slider}>
            <button className={styles.playSmall} onClick={play} aria-label={playing ? "توقف" : "پخش"}>
              {playing ? "⏸" : "▶"}
            </button>
            <span>{(mode === "show" && part === "paint") || (mode === "try" && display?.scene === "paint") ? "باز کردن مکعب" : "جدا کردن لایه‌ها"}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={t}
              onChange={(e) => {
                setPlaying(false);
                setT(Number(e.target.value));
              }}
              aria-label="میزان باز شدن"
            />
          </label>
        )}
      </section>

      <aside className={styles.side}>
        {mode === "explore" && (
          <>
            <h2>برج بساز</h2>
            <p className={styles.note}>روی صفحه یا روی یک مکعب بزن تا مکعب اضافه شود. با «برداشتن»، روی مکعب بزن تا برداشته شود.</p>
            <div className={styles.row}>
              <button className={!remove ? styles.primary : styles.clear} aria-pressed={!remove} onClick={() => setRemove(false)}>
                افزودن
              </button>
              <button className={remove ? styles.primary : styles.clear} aria-pressed={remove} onClick={() => setRemove(true)}>
                برداشتن
              </button>
              <button className={styles.clear} onClick={() => setTower(emptyTower(BOARD, BOARD))} disabled={!countCubes(tower)}>
                پاک کن
              </button>
            </div>

            <div className={styles.titleRow}>
              <h2>
                تعداد مکعب‌ها: {showCount ? fa(countCubes(tower)) : "؟"}
              </h2>
              <button className={styles.toggle} aria-pressed={showCount} onClick={() => setShowCount((s) => !s)}>
                {showCount ? "پنهان کن" : "نشان بده"}
              </button>
            </div>

            <h2 className={styles.progress}>نماها</h2>
            <div className={styles.views}>
              <figure>
                <ViewSvg pic={{ kind: "top", cells: topView(tower) }} size={86} label="نمای بالا" />
                <figcaption>بالا</figcaption>
              </figure>
              <figure>
                <ViewSvg pic={{ kind: "cols", heights: frontView(tower) }} size={86} label="نمای روبرو" />
                <figcaption>روبرو</figcaption>
              </figure>
              <figure>
                <ViewSvg pic={{ kind: "cols", heights: sideView(tower) }} size={86} label="نمای کنار" />
                <figcaption>کنار</figcaption>
              </figure>
            </div>

            <h2 className={styles.progress}>نقشه ارتفاع (از بالا)</h2>
            <HeightGrid tower={tower} maxH={MAX_H} remove={remove} onChange={setHeight} />
          </>
        )}

        {mode === "show" && (
          <>
            <div className={styles.row}>
              <button className={part === "layers" ? styles.primary : styles.clear} aria-pressed={part === "layers"} onClick={() => { setPart("layers"); setT(0); }}>
                لایه‌ها
              </button>
              <button className={part === "paint" ? styles.primary : styles.clear} aria-pressed={part === "paint"} onClick={() => { setPart("paint"); setT(0); }}>
                رنگ کن و ببر
              </button>
            </div>

            {part === "layers" ? (
              <>
                <p className={styles.note}>
                  {countCubes(tower) ? "برجی که ساختی" : "یک برج نمونه"}. «▶» را بزن تا لایه‌ها از هم جدا شوند و هر لایه را جدا بشماری.
                </p>
                <ul className={styles.pairs}>
                  {layerCounts(showTower).map((n, z) => (
                    <li key={z}>
                      <span className={styles.chip} style={{ background: LAYER_COLORS[z % LAYER_COLORS.length] }}>
                        {fa(z + 1)}
                      </span>
                      لایه {fa(z + 1)}: {fa(n)} مکعب
                    </li>
                  ))}
                </ul>
                <p className={`${styles.status} ${styles.info}`}>
                  جمع: {layerCounts(showTower).map((n) => fa(n)).join(" + ")} = {fa(countCubes(showTower))} مکعب
                </p>
                <div className={styles.titleRow}>
                  <h2>مکعب‌های پنهان: {fa(hiddenCount(showTower))}</h2>
                  <button className={styles.toggle} aria-pressed={showHidden} onClick={() => setShowHidden((s) => !s)}>
                    {showHidden ? "راه‌راه: روشن" : "راه‌راه: خاموش"}
                  </button>
                </div>
                <p className={styles.note}>
                  مکعب پنهان از هیچ طرف دیده نمی‌شود، ولی چون مکعب‌ها روی هوا نمی‌ایستند، زیر مکعب‌های دیگر باید باشد. با راه‌راه نشانشان داده‌ایم.
                </p>
              </>
            ) : (
              <>
                <div className={styles.chipsRow} role="radiogroup" aria-label="اندازه مکعب بزرگ">
                  {[2, 3, 4].map((n) => (
                    <button key={n} role="radio" aria-checked={paintN === n} onClick={() => { setPaintN(n); setFocus(null); }}>
                      {fa(n)}×{fa(n)}×{fa(n)}
                    </button>
                  ))}
                </div>
                <p className={styles.note}>مکعب بزرگ را از بیرون رنگ کرده‌ایم. «▶» را بزن تا به مکعب‌های کوچک بریده شود؛ روی هر دسته بزن تا فقط همان‌ها را ببینی.</p>
                <ul className={styles.paintList}>
                  {[3, 2, 1, 0].map((k) => (
                    <li key={k}>
                      <button aria-pressed={focus === k} onClick={() => setFocus(focus === k ? null : k)}>
                        <strong>{k === 0 ? "بدون رنگ" : `${fa(k)} وجه رنگی`}</strong>
                        <span>{fa(paintedCount(paintN, k))} مکعب</span>
                        {paintN > 1 && <small>{paintWhy(paintN, k)}</small>}
                      </button>
                    </li>
                  ))}
                </ul>
                <p className={`${styles.status} ${styles.info}`}>
                  جمع: {[3, 2, 1, 0].map((k) => fa(paintedCount(paintN, k))).join(" + ")} = {fa(paintN ** 3)} = {fa(paintN)}×{fa(paintN)}×{fa(paintN)}
                </p>
              </>
            )}
          </>
        )}

        {mode === "try" && (
          <TowerTryPanel
            key={`${tryType}-${tryLevel}-${seed}`}
            question={question}
            type={tryType}
            level={tryLevel}
            initialPick={initialPick}
            build={build}
            onBuild={setBuild}
            onType={(ty) => freshQuestion(ty, tryLevel)}
            onLevel={(l) => freshQuestion(tryType, l)}
            onNew={() => freshQuestion()}
            onAnswered={onAnswered}
            onDisplay={setDisplay}
          />
        )}
      </aside>
    </main>
  );
}

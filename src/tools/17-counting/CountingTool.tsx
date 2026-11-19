"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Board } from "@/engine-2d/Board";
import { cases, comb, gridValues, makeCountingQuestion, PEOPLE, perm, routes, worstCase, type Answer, type CountingQuestionType, type Level } from "@/generators/counting";
import { newSeed } from "@/generators/random";
import { setClassroom as applyClassroom, useClassroom } from "@/toolkit/classroom";
import { TeacherGuideButton } from "@/toolkit/TeacherGuide";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/ToolLayout.module.css";
import tryStyles from "@/toolkit/TryPanel.module.css";
import { CountingTryPanel } from "./CountingTryPanel";
import { COUNTING_GUIDE } from "./guide";
import { AfterG, GridG, SetupG, ShowG, SlotsG, TOKEN_FILL } from "./Pictures";
import { COUNTING_TYPE_LABEL, countingPrompt, initial, ltr, showSteps } from "./text";
import own from "./counting.module.css";

type Mode = "explore" | "show" | "try";
type Area = "slots" | "grid";

const VIEW: [number, number, number, number] = [0, 0, 16, 9];
const TYPES = Object.keys(COUNTING_TYPE_LABEL) as CountingQuestionType[];

/** A found arrangement (or route) in explore; repeats stay in the list, marked. */
interface Found {
  key: string;
  items: number[];
  repeat: boolean;
}

const ARROW = ["→", "↑"];

export function CountingTool() {
  const [mode, setMode] = useState<Mode>("explore");
  const [classroom, setClassroom] = useClassroom();

  // Playback 0 … 1.
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

  // Explore: put people in places (a row, or a basket), or walk routes on a grid.
  const [area, setArea] = useState<Area>("slots");
  const [n, setN] = useState(3);
  const [k, setK] = useState(3);
  const [ordered, setOrdered] = useState(true);
  const [placed, setPlaced] = useState<number[]>([]);
  const [found, setFound] = useState<Found[]>([]);
  const [showTotal, setShowTotal] = useState(false);
  const [ga, setGa] = useState(2);
  const [gb, setGb] = useState(2);
  const [route, setRoute] = useState<number[]>([]);
  const [routesFound, setRoutesFound] = useState<Found[]>([]);
  const [gridNumbers, setGridNumbers] = useState(false);

  // Show me
  const [showType, setShowType] = useState<CountingQuestionType>("tree");
  const [showLevel, setShowLevel] = useState<Level>(2);
  const [showSeed, setShowSeed] = useState(17);
  const shown = useMemo(() => makeCountingQuestion(showType, showLevel, showSeed), [showType, showLevel, showSeed]);

  // Try it
  const [tryType, setTryType] = useState<CountingQuestionType>("tree");
  const [tryLevel, setTryLevel] = useState<Level>(1);
  const [seed, setSeed] = useState(1717);
  const [checked, setChecked] = useState<Answer | null>(null);
  const question = useMemo(() => makeCountingQuestion(tryType, tryLevel, seed), [tryType, tryLevel, seed]);

  const msFor = (steps: number) => Math.min(16000, 1600 * steps);
  /** Time to show every case after an answer. */
  const msCases = (count: number) => Math.min(9000, 300 * count + 600);
  const afterCount = (q = question) => (q.type === "pigeonhole" ? worstCase(q).filter(Boolean).length + 1 : q.type === "probability" && q.variant === "dice2" ? 6 : cases(q).length);

  // Read the link once, on arrival. Shareable links: #try=grid&level=3&seed=7(&a=12 or &a=3/8), #show=tree&level=2&seed=5(&f=0.5), #explore=row|group|grid, #classroom
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.has("classroom")) applyClassroom(true);
    const tryParam = params.get("try");
    const show = params.get("show");
    const explore = params.get("explore");
    const lv = Number(params.get("level"));
    const level = lv === 1 || lv === 2 || lv === 3 ? (lv as Level) : null;
    const sd = Number(params.get("seed"));
    const sdOk = params.has("seed") && Number.isInteger(sd) && sd >= 0;
    const timer = setTimeout(() => {
      if (tryParam) {
        setMode("try");
        if ((TYPES as string[]).includes(tryParam)) setTryType(tryParam as CountingQuestionType);
        if (level) setTryLevel(level);
        if (sdOk) setSeed(sd);
        const a = params.get("a");
        if (a) {
          const [x, y] = a.split("/").map(Number);
          const v: Answer | null = a.includes("/") ? (Number.isInteger(x) && Number.isInteger(y) && y > 0 ? { n: x, d: y } : null) : Number.isInteger(x) ? x : null;
          if (v !== null) {
            setChecked(v);
            setF(1);
          }
        } else setF(0);
      } else if (show) {
        if ((TYPES as string[]).includes(show)) setShowType(show as CountingQuestionType);
        if (level) setShowLevel(level);
        if (sdOk) setShowSeed(sd);
        setMode("show");
        setF(1);
      } else if (explore === "row" || explore === "group" || explore === "grid") {
        setArea(explore === "grid" ? "grid" : "slots");
        if (explore === "group") {
          setOrdered(false);
          setN(4);
          setK(2);
        }
        setMode("explore");
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
    setChecked(null);
    setRun(null);
    setF(0);
  };

  const steps = showSteps(shown);
  const stageOf = (count: number) => Math.min(count - 1, Math.max(0, Math.round(f * (count - 1))));
  const showStage = stageOf(steps.length);

  const freshShow = (type = showType, level = showLevel) => {
    setShowType(type);
    setShowLevel(level);
    setShowSeed(newSeed());
    setRun(null);
    setF(0);
  };

  const play = (ms: number) => {
    if (run) return setRun(null);
    animate(ms, f >= 0.99 ? 0 : f);
  };

  // ── Explore: slots ──
  const total = ordered ? perm(n, k) : comb(n, k);
  const distinct = found.filter((x) => !x.repeat).length;
  const keyOf = (items: number[]) => (ordered ? items : [...items].sort((x, y) => x - y)).join(",");
  const record = (items: number[], list: Found[], key: string): Found[] => [...list, { key, items, repeat: list.some((x) => x.key === key) }];

  const putObject = (i: number) => {
    // A full row starts again with this one.
    const next = placed.length >= k ? [i] : [...placed, i];
    setPlaced(next);
    if (next.length === k) setFound(record(next, found, keyOf(next)));
  };
  const takeSlot = (j: number) => {
    if (j < placed.length) setPlaced(placed.filter((_, x) => x !== j));
  };
  const resetSlots = (nn = n, kk = k, ord = ordered) => {
    setN(nn);
    setK(Math.min(kk, nn));
    setOrdered(ord);
    setPlaced([]);
    setFound([]);
  };

  // ── Explore: grid ──
  const gridTotal = routes(ga, gb);
  const gridDistinct = routesFound.filter((x) => !x.repeat).length;
  const step = (m: number) => {
    const next = [...route, m];
    const right = next.filter((x) => x === 0).length;
    const up = next.length - right;
    if (right > ga || up > gb) return;
    setRoute(next);
    if (right === ga && up === gb) setRoutesFound(record(next, routesFound, next.join("")));
  };
  const atEnd = route.length === ga + gb;
  const resetGrid = (a = ga, b = gb) => {
    setGa(a);
    setGb(b);
    setRoute([]);
    setRoutesFound([]);
  };
  const rightNow = route.filter((x) => x === 0).length;
  const upNow = route.length - rightNow;

  // ── Board ──
  let board: React.ReactNode;
  if (mode === "explore" && area === "slots") {
    board = (
      <Board view={VIEW} imageName="arrangements" label="چیدمان؛ روی هر نفر بزن تا در جای خالی بنشیند">
        <SlotsG names={PEOPLE.slice(0, n)} k={k} placed={placed} ordered={ordered} onObject={putObject} onSlot={takeSlot} />
      </Board>
    );
  } else if (mode === "explore") {
    board = (
      <Board view={VIEW} imageName="grid-routes" label="شبکه؛ روی گره بعدی بزن تا مسیر جلو برود">
        <GridG a={ga} b={gb} cond="none" at={null} route={route} onNode={(x) => step(x > rightNow ? 0 : 1)} values={gridNumbers ? gridValues({ a: ga, b: gb, cond: "none", at: null }) : null} box={[1.2, 0.6, 13.6, 7.8]} />
      </Board>
    );
  } else if (mode === "show") {
    board = (
      <Board view={VIEW} imageName="counting" label="ساخت حالت‌ها قدم‌به‌قدم">
        <ShowG q={shown} stage={showStage} steps={steps.length} />
      </Board>
    );
  } else {
    board = (
      <Board view={VIEW} imageName="counting" label={checked === null ? "صورت مسئله" : "همه حالت‌ها"}>
        {checked === null ? <SetupG q={question} /> : <AfterG q={question} f={f} />}
      </Board>
    );
  }

  const inTry = mode === "try";
  const showSlider = mode === "show" || (inTry && checked !== null);
  const tryCount = afterCount();
  // After an answer: how far the cases (or the worst case, or the dice rows) have come.
  const afterLabel =
    question.type === "pigeonhole"
      ? `قدم ${fa(Math.min(tryCount, Math.floor(f * (tryCount - 1)) + 1))} از ${fa(tryCount)}`
      : question.type === "probability" && question.variant === "dice2"
        ? `ردیف ${fa(Math.max(1, Math.ceil(f * 6)))} از ۶`
        : `حالت ${fa(Math.max(1, Math.round(f * tryCount)))} از ${fa(tryCount)}`;

  return (
    <main className={styles.layout}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          → همه ابزارها
        </Link>
        <h1>
          <span className={styles.badge}>{fa(17)}</span> چیدمان و شمارش
        </h1>
        <div className={styles.tabs} role="tablist" aria-label="حالت ابزار">
          <button role="tab" aria-selected={mode === "explore"} onClick={() => switchMode("explore")}>
            کشف: همه راه‌ها را پیدا کن
          </button>
          <button
            role="tab"
            aria-selected={mode === "show"}
            onClick={() => {
              switchMode("show");
              animate(msFor(steps.length));
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
          <TeacherGuideButton guide={COUNTING_GUIDE} />
          <Link href={`/tools/counting/worksheet?types=${tryType}&level=${tryLevel}`}>کاربرگ</Link>
        </div>
      </header>

      <section className={styles.stageWrap} aria-label="صفحه چیدمان و شمارش">
        {board}
      </section>

      <section className={styles.controls}>
        {showSlider ? (
          <label className={styles.slider}>
            <button className={styles.playSmall} onClick={() => play(inTry ? msCases(tryCount) : msFor(steps.length))} aria-label={run ? "توقف" : "پخش"}>
              {run ? "⏸" : "▶"}
            </button>
            <span>{inTry ? afterLabel : `قدم ${fa(showStage + 1)} از ${fa(steps.length)}`}</span>
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
        ) : (
          <p className={styles.stepText} style={{ margin: 0 }}>
            {inTry ? "اول در ذهنت (یا روی کاغذ) حالت‌ها را بشمار، بعد جواب بده" : area === "slots" ? "روی هر نفر بزن تا بنشیند؛ روی جای پرشده بزن تا خالی شود" : "روی گره بعدی (راست یا بالا) بزن"}
          </p>
        )}
      </section>

      <aside className={styles.side}>
        {mode === "explore" && (
          <div className={styles.chipsRow} role="radiogroup" aria-label="بخش">
            {(
              [
                ["slots", "چیدن و انتخاب"],
                ["grid", "مسیر در شبکه"],
              ] as [Area, string][]
            ).map(([a, label]) => (
              <button key={a} role="radio" aria-checked={area === a} onClick={() => setArea(a)}>
                {label}
              </button>
            ))}
          </div>
        )}

        {mode === "explore" && area === "slots" && (
          <>
            <div className={styles.chipsRow} role="radiogroup" aria-label="ترتیب">
              <button role="radio" aria-checked={ordered} onClick={() => resetSlots(n, k, true)}>
                ردیف
              </button>
              <button role="radio" aria-checked={!ordered} onClick={() => resetSlots(n, k, false)}>
                سبد
              </button>
            </div>
            <Stepper label={`${fa(n)} نفر`} onLess={() => resetSlots(n - 1, k)} onMore={() => resetSlots(n + 1, k)} lessOff={n <= 2} moreOff={n >= 5} />
            <div style={{ height: 6 }} />
            <Stepper label={`${fa(k)} جا`} onLess={() => resetSlots(n, k - 1)} onMore={() => resetSlots(n, k + 1)} lessOff={k <= 1} moreOff={k >= n} />
            <h2 className={styles.progress}>همه راه‌ها را پیدا کن</h2>
            <p className={`${styles.status} ${distinct === total ? styles.good : styles.info}`} aria-live="polite">
              <span className={own.counter}>
                {distinct === total ? "✓ " : ""}پیدا شده: {fa(distinct)} از {showTotal || distinct === total ? fa(total) : "؟"}
              </span>
              {distinct === total && " · همه را پیدا کردی!"}
              {found.length > distinct && ` · ${fa(found.length - distinct)} تکراری`}
            </p>
            <div className={styles.row}>
              <button className={styles.toggle} aria-pressed={showTotal} onClick={() => setShowTotal(!showTotal)}>
                {showTotal ? "✓ " : ""}تعداد کل را نشان بده
              </button>
              <button className={styles.toggle} onClick={() => resetSlots()} disabled={!found.length && !placed.length}>
                از اول
              </button>
            </div>
            {showTotal && (
              <p className={styles.note} style={{ marginTop: 8 }}>
                {ordered
                  ? `جای اول ${fa(n)} انتخاب، بعدی یکی کمتر: ${ltr(`${Array.from({ length: k }, (_, i) => fa(n - i)).join(" × ")} = ${fa(total)}`)}`
                  : `ردیف‌ها ${fa(perm(n, k))} تاست؛ هر سبد ${ltr(`${Array.from({ length: k }, (_, i) => fa(k - i)).join(" × ")}`)} بار شمرده شده: ${fa(total)}`}
              </p>
            )}
            <ol className={own.found} aria-label="چیدمان‌های پیدا شده" style={{ marginTop: 10 }}>
              {found.map((x, i) => (
                <li key={i} data-repeat={x.repeat ? "true" : undefined} data-new={!x.repeat && i === found.length - 1 ? "true" : undefined} aria-label={x.repeat ? "تکراری" : undefined}>
                  <span className={own.num}>{x.repeat ? "↺" : fa(found.slice(0, i + 1).filter((y) => !y.repeat).length)}</span>
                  {(ordered ? x.items : [...x.items].sort((p, q) => p - q)).map((p, j) => (
                    <span key={j} className={own.tok} style={{ background: TOKEN_FILL[p] }} title={PEOPLE[p]}>
                      {initial(PEOPLE[p])}
                    </span>
                  ))}
                  {x.repeat && <span className={own.repeatTag}>تکراری</span>}
                </li>
              ))}
            </ol>
            {!found.length && <p className={styles.note}>هر بار که همه جاها پر شوند، چیدمان اینجا ثبت می‌شود. تکراری‌ها کم‌رنگ، خط‌خورده و با «تکراری ↺» می‌آیند.</p>}
            {found.length > 0 && (
              <p className={styles.note} style={{ marginTop: 10 }}>
                {ordered ? "راهنما: یک نفر را اول بگذار و همه حالت‌های بقیه را بساز؛ بعد نفر بعدی را اول بگذار." : "در سبد، «س ع» همان «ع س» است؛ برای همین سبدها از ردیف‌ها کمترند."}
              </p>
            )}
          </>
        )}

        {mode === "explore" && area === "grid" && (
          <>
            <Stepper label={`پهنا ${fa(ga)}`} onLess={() => resetGrid(ga - 1, gb)} onMore={() => resetGrid(ga + 1, gb)} lessOff={ga <= 1} moreOff={ga >= 4} />
            <div style={{ height: 6 }} />
            <Stepper label={`بلندی ${fa(gb)}`} onLess={() => resetGrid(ga, gb - 1)} onMore={() => resetGrid(ga, gb + 1)} lessOff={gb <= 1} moreOff={gb >= 3} />
            <div className={styles.row} style={{ marginTop: 10 }}>
              <button className={styles.clear} onClick={() => step(0)} disabled={atEnd || rightNow >= ga} aria-label="یک قدم به راست">
                → راست
              </button>
              <button className={styles.clear} onClick={() => step(1)} disabled={atEnd || upNow >= gb} aria-label="یک قدم به بالا">
                ↑ بالا
              </button>
            </div>
            <div className={styles.row} style={{ marginTop: 6 }}>
              <button className={styles.clear} onClick={() => setRoute(route.slice(0, -1))} disabled={!route.length}>
                یک قدم برگرد
              </button>
              <button className={styles.clear} onClick={() => setRoute([])} disabled={!route.length}>
                مسیر تازه
              </button>
            </div>
            <h2 className={styles.progress}>همه مسیرها را پیدا کن</h2>
            <p className={`${styles.status} ${gridDistinct === gridTotal ? styles.good : styles.info}`} aria-live="polite">
              <span className={own.counter}>
                {gridDistinct === gridTotal ? "✓ " : ""}پیدا شده: {fa(gridDistinct)} از {showTotal || gridDistinct === gridTotal ? fa(gridTotal) : "؟"}
              </span>
              {gridDistinct === gridTotal && " · همه را پیدا کردی!"}
              {atEnd && gridDistinct < gridTotal && " · به «ب» رسیدی؛ «مسیر تازه» را بزن"}
            </p>
            <div className={styles.row}>
              <button className={styles.toggle} aria-pressed={showTotal} onClick={() => setShowTotal(!showTotal)}>
                {showTotal ? "✓ " : ""}تعداد کل
              </button>
              <button className={styles.toggle} aria-pressed={gridNumbers} onClick={() => setGridNumbers(!gridNumbers)}>
                {gridNumbers ? "✓ " : ""}عدد هر گره
              </button>
              <button className={styles.toggle} onClick={() => resetGrid()} disabled={!routesFound.length && !route.length}>
                از اول
              </button>
            </div>
            {gridNumbers && <p className={styles.note} style={{ marginTop: 8 }}>عدد هر گره: چند راه به آن می‌رسد = جمع عدد گره چپ و گره پایین.</p>}
            <ol className={own.found} aria-label="مسیرهای پیدا شده" style={{ marginTop: 10 }}>
              {routesFound.map((x, i) => (
                <li key={i} data-repeat={x.repeat ? "true" : undefined} data-new={!x.repeat && i === routesFound.length - 1 ? "true" : undefined}>
                  <span className={own.num}>{x.repeat ? "↺" : fa(routesFound.slice(0, i + 1).filter((y) => !y.repeat).length)}</span>
                  <span className={own.route}>{x.items.map((m) => ARROW[m]).join("")}</span>
                  {x.repeat && <span className={own.repeatTag}>تکراری</span>}
                </li>
              ))}
            </ol>
            {!routesFound.length && <p className={styles.note}>از «الف» شروع کن و فقط به راست یا بالا برو. هر مسیری که به «ب» برسد اینجا ثبت می‌شود.</p>}
          </>
        )}

        {mode === "show" && (
          <>
            <div className={tryStyles.types} role="radiogroup" aria-label="نوع مسئله">
              {TYPES.map((t) => (
                <button key={t} role="radio" aria-checked={showType === t} onClick={() => freshShow(t, showLevel)}>
                  {COUNTING_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            <div className={tryStyles.chips} role="radiogroup" aria-label="سطح" style={{ marginTop: 8 }}>
              {([1, 2, 3] as Level[]).map((l) => (
                <button key={l} role="radio" aria-checked={showLevel === l} onClick={() => freshShow(showType, l)}>
                  سطح {fa(l)}
                </button>
              ))}
            </div>
            <p className={tryStyles.prompt}>{countingPrompt(shown)}</p>
            <h2 className={styles.progress}>{shown.type === "grid" ? "عدد هر گره، قطر به قطر" : shown.type === "handshake" ? "دست‌دادن‌ها، نفر به نفر" : shown.type === "pigeonhole" ? "بدترین حالت" : shown.type === "probability" && shown.variant === "dice2" ? "جدول حالت‌ها، ردیف به ردیف" : "درخت حالت‌ها، شاخه به شاخه"}</h2>
            <ol className={own.steps}>
              {steps.map((s, i) => (
                <li key={i} data-on={i === showStage ? "true" : i < showStage ? undefined : "false"}>
                  {s}
                </li>
              ))}
            </ol>
            <button
              className={tryStyles.next}
              style={{ marginTop: 12, width: "100%" }}
              onClick={() => {
                freshShow();
                animate(msFor(steps.length));
              }}
            >
              نمونه تازه
            </button>
          </>
        )}

        {mode === "try" && (
          <CountingTryPanel
            key={`${tryType}-${tryLevel}-${seed}`}
            question={question}
            type={tryType}
            level={tryLevel}
            checked={checked}
            onCheck={(v) => {
              setChecked(v);
              animate(msCases(tryCount));
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

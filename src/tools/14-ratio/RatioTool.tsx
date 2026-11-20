"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Board } from "@/engine-2d/Board";
import { cmpFrac, gcd, makeRatioQuestion, simplest, type Answer, type Level, type RatioQuestionType, type Shape } from "@/generators/ratio";
import { newSeed } from "@/generators/random";
import { practiceCheck, usePractice } from "@/practice/bridge";
import { setClassroom as applyClassroom, useClassroom } from "@/toolkit/classroom";
import { TeacherGuideButton } from "@/toolkit/TeacherGuide";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/ToolLayout.module.css";
import tryStyles from "@/toolkit/TryPanel.module.css";
import { RATIO_ADAPTER } from "./adapter";
import { FracG, Rich } from "./Frac";
import { RATIO_GUIDE } from "./guide";
import { ModelG, Patterns, RowsG, SetupG, ShapeG, Tx, type BlockRow, type Kind } from "./Pictures";
import { RatioTryPanel } from "./RatioTryPanel";
import { PEOPLE, RATIO_TYPE_LABEL, ratioPrompt, ratioSteps } from "./text";
import own from "./ratio.module.css";

type Mode = "explore" | "show" | "try";
type Area = "bar" | "blocks";

const VIEW: [number, number, number, number] = [0, 0, 16, 9];
const MAX_PARTS = 16;
const MAX_BLOCKS = 8;
const TYPES = Object.keys(RATIO_TYPE_LABEL) as RatioQuestionType[];

/** Toggle part i in a list of shaded parts. */
const toggle = (list: number[], i: number) => (list.includes(i) ? list.filter((x) => x !== i) : [...list, i]);
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

export function RatioTool() {
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

  // Explore: a bar or circle to cut and shade (and a second bar to compare)
  const [area, setArea] = useState<Area>("bar");
  const [shape, setShape] = useState<Shape>("bar");
  const [parts, setParts] = useState(4);
  const [shaded, setShaded] = useState<number[]>([0, 1, 2]);
  const [compareOn, setCompareOn] = useState(false);
  const [parts2, setParts2] = useState(8);
  const [shaded2, setShaded2] = useState<number[]>([0, 1, 2, 3, 4, 5]);
  // Explore: ratio blocks
  const [counts, setCounts] = useState<number[]>([2, 3]);
  const [blockValue, setBlockValue] = useState(4);

  // Show me
  const [showType, setShowType] = useState<RatioQuestionType>("divide");
  const [showLevel, setShowLevel] = useState<Level>(2);
  const [showSeed, setShowSeed] = useState(14);
  const shown = useMemo(() => makeRatioQuestion(showType, showLevel, showSeed), [showType, showLevel, showSeed]);

  // Try it
  const [tryType, setTryType] = useState<RatioQuestionType>("partOf");
  const [tryLevel, setTryLevel] = useState<Level>(1);
  const [seed, setSeed] = useState(1414);
  const [trySel, setTrySel] = useState<number[]>([]);
  const [checked, setChecked] = useState<Answer | null>(null);
  const question = useMemo(() => makeRatioQuestion(tryType, tryLevel, seed), [tryType, tryLevel, seed]);

  // Practice sessions: the next question of this tool arrives through the address.
  const practice = usePractice(RATIO_ADAPTER, (type, level, sd) => {
    setMode("try");
    if ((TYPES as string[]).includes(type)) setTryType(type as RatioQuestionType);
    if (level === 1 || level === 2 || level === 3) setTryLevel(level);
    setSeed(sd);
    setTrySel([]);
    setChecked(null);
    setRun(null);
    setF(0);
  });

  const msFor = (steps: number) => Math.min(14000, 1500 * steps);

  // Shareable links: #try=percent&level=2&seed=7(&a=15 or &a=3/4), #show=divide&level=3&seed=5(&f=0.5), #explore=bar|circle|compare|blocks, #classroom
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
        const type = (TYPES as string[]).includes(tryParam) ? (tryParam as RatioQuestionType) : tryType;
        setTryType(type);
        if (level) setTryLevel(level);
        if (sdOk) setSeed(sd);
        const a = params.get("a");
        if (a) {
          const [n, d] = a.split("/").map(Number);
          const v: Answer | null = a.includes("/") ? (Number.isInteger(n) && Number.isInteger(d) && d > 0 ? { n, d } : null) : Number.isInteger(n) ? n : null;
          if (v !== null) {
            if (type === "shade" && typeof v === "number") setTrySel(range(v));
            setChecked(v);
            setF(1);
          }
        } else setF(0);
      } else if (show) {
        if ((TYPES as string[]).includes(show)) setShowType(show as RatioQuestionType);
        if (level) setShowLevel(level);
        if (sdOk) setShowSeed(sd);
        setMode("show");
        setF(1);
      } else if (explore === "bar" || explore === "blocks" || explore === "circle" || explore === "compare") {
        setArea(explore === "blocks" ? "blocks" : "bar");
        if (explore === "circle") setShape("circle");
        if (explore === "compare") setCompareOn(true);
        setMode("explore");
      }
      const ff = Number(params.get("f"));
      if (params.has("f") && Number.isFinite(ff)) setF(Math.min(1, Math.max(0, ff)));
    }, 0);
    return () => clearTimeout(timer);
    // Read the link once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setTrySel([]);
    setChecked(null);
    setRun(null);
    setF(0);
  };

  const showSteps = ratioSteps(shown);
  const tryStepsCount = ratioSteps(question).length;
  const stageOf = (n: number) => Math.min(n - 1, Math.max(0, Math.round(f * (n - 1))));
  const showStage = stageOf(showSteps.length);

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

  // ── Board ──
  let board: React.ReactNode;
  if (mode === "explore" && area === "bar") {
    const frac = { n: shaded.length, d: parts };
    board = (
      <Board view={VIEW} imageName="fraction" label="شکل؛ روی قسمت‌ها بزن تا رنگ شوند">
        <Patterns />
        {compareOn ? (
          <>
            <ShapeG shape="bar" parts={parts} shaded={(i) => shaded.includes(i)} box={[1.2, 1.6, 11.2, 1.5]} onPart={(i) => setShaded(toggle(shaded, i))} />
            <FracG f={frac} x={14.2} y={2.35} size={0.65} />
            <ShapeG shape="bar" parts={parts2} shaded={(i) => shaded2.includes(i)} box={[1.2, 5.4, 11.2, 1.5]} onPart={(i) => setShaded2(toggle(shaded2, i))} kind="B" />
            <FracG f={{ n: shaded2.length, d: parts2 }} x={14.2} y={6.15} size={0.65} />
            {(() => {
              const c = cmpFrac(frac, { n: shaded2.length, d: parts2 });
              return (
                <Tx x={6.8} y={4.25} size={0.42} rtl>
                  {c === 0 ? "= هم‌اندازه‌اند" : c > 0 ? "▲ نوار بالا بیشتر است" : "▼ نوار پایین بیشتر است"}
                </Tx>
              );
            })()}
          </>
        ) : (
          <>
            <ShapeG shape={shape} parts={parts} shaded={(i) => shaded.includes(i)} box={shape === "bar" ? [1.2, 3.3, 11.2, 1.8] : [3.4, 0.7, 7.6, 7.6]} onPart={(i) => setShaded(toggle(shaded, i))} />
            <FracG f={frac} x={14.3} y={4.2} size={0.85} />
          </>
        )}
      </Board>
    );
  } else if (mode === "explore") {
    const kinds: Kind[] = ["A", "B", "C"];
    const move = (row: number) => {
      // A block goes to the next row: the total stays, the ratio changes.
      const to = (row + 1) % counts.length;
      if (counts[row] <= 1 || counts[to] >= MAX_BLOCKS) return;
      setCounts(counts.map((c, i) => (i === row ? c - 1 : i === to ? c + 1 : c)));
    };
    const rows: BlockRow[] = counts.map((c, i) => ({ name: PEOPLE[i], count: c, kind: kinds[i], up: fa(c * blockValue), onBlock: () => move(i) }));
    board = (
      <Board view={VIEW} imageName="ratio-blocks" label="بلوک‌های نسبت؛ روی بلوک بزن تا به ردیف بعد برود">
        <Patterns />
        <RowsG rows={rows} value={fa(blockValue)} total={fa(counts.reduce((s, c) => s + c, 0) * blockValue)} maxCount={MAX_BLOCKS} />
      </Board>
    );
  } else if (mode === "show") {
    board = (
      <Board view={VIEW} imageName="bar-model" label="مدل نواری">
        <Patterns />
        <ModelG q={shown} step={showStage} />
      </Board>
    );
  } else {
    const q = question;
    // In a mock exam the bar model (the worked answer) waits for the end; the shape stays as shaded.
    const done = checked !== null && !practice.exam;
    const locked = checked !== null;
    board = (
      <Board view={VIEW} imageName="ratio" label={q.type === "shade" && !done ? "شکل؛ روی قسمت‌ها بزن تا رنگ شوند" : "مدل نواری"}>
        <Patterns />
        {q.type === "shade" && !done ? (
          <>
            <ShapeG shape={q.shape} parts={q.parts} shaded={(i) => trySel.includes(i)} box={q.shape === "bar" ? [1.2, 3.2, 11.4, 1.8] : [3.6, 0.7, 7.6, 7.6]} onPart={(i) => !locked && setTrySel(toggle(trySel, i))} />
            <FracG f={q.frac} x={14.4} y={4.1} size={0.8} />
          </>
        ) : done ? (
          <ModelG q={q} step={stageOf(tryStepsCount)} />
        ) : (
          <SetupG q={q} />
        )}
      </Board>
    );
  }

  const inTry = mode === "try";
  const showSlider = mode === "show" || (inTry && checked !== null && !practice.exam);
  const total = counts.reduce((s, c) => s + c, 0);
  const g = counts.reduce((a, b) => gcd(a, b), 0);
  const frac = { n: shaded.length, d: parts };
  const low = simplest(frac);
  const pct = (shaded.length * 100) / parts;

  return (
    <main className={styles.layout}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          → همه ابزارها
        </Link>
        <h1>
          <span className={styles.badge}>{fa(14)}</span> نسبت
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
              animate(msFor(showSteps.length));
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
          <TeacherGuideButton guide={RATIO_GUIDE} />
          <Link href={`/tools/ratio/worksheet?types=${tryType}&level=${tryLevel}`}>کاربرگ</Link>
        </div>
      </header>

      <section className={styles.stageWrap} aria-label="صفحه نسبت">
        {board}
      </section>

      <section className={styles.controls}>
        {showSlider ? (
          <label className={styles.slider}>
            <button className={styles.playSmall} onClick={() => play(msFor(inTry ? tryStepsCount : showSteps.length))} aria-label={run ? "توقف" : "پخش"}>
              {run ? "⏸" : "▶"}
            </button>
            <span>
              قدم {fa((inTry ? stageOf(tryStepsCount) : showStage) + 1)} از {fa(inTry ? tryStepsCount : showSteps.length)}
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
        ) : (
          <p className={styles.stepText} style={{ margin: 0 }}>
            {inTry ? "اول مدل را در ذهنت کامل کن، بعد جواب بده" : area === "bar" ? "روی قسمت‌ها بزن تا رنگ شوند" : "روی یک بلوک بزن تا به ردیف بعد برود"}
          </p>
        )}
      </section>

      <aside className={styles.side}>
        {mode === "explore" && (
          <div className={styles.chipsRow} role="radiogroup" aria-label="بخش">
            {(
              [
                ["bar", "نوار و دایره"],
                ["blocks", "بلوک‌های نسبت"],
              ] as [Area, string][]
            ).map(([a, label]) => (
              <button key={a} role="radio" aria-checked={area === a} onClick={() => setArea(a)}>
                {label}
              </button>
            ))}
          </div>
        )}

        {mode === "explore" && area === "bar" && (
          <>
            <h2 className={styles.progress}>۱. شکل را به قسمت‌های مساوی تقسیم کن</h2>
            {!compareOn && (
              <div className={styles.chipsRow} role="radiogroup" aria-label="شکل">
                {(
                  [
                    ["bar", "نوار"],
                    ["circle", "دایره"],
                  ] as [Shape, string][]
                ).map(([s, label]) => (
                  <button key={s} role="radio" aria-checked={shape === s} onClick={() => setShape(s)}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            <Stepper
              label={`${fa(parts)} قسمت`}
              onLess={() => {
                setParts(parts - 1);
                setShaded(shaded.filter((i) => i < parts - 1));
              }}
              onMore={() => setParts(parts + 1)}
              lessOff={parts <= 1}
              moreOff={parts >= MAX_PARTS}
            />
            <h2 className={styles.progress}>۲. چند قسمت را رنگ کن</h2>
            <div className={styles.row}>
              <button className={styles.clear} onClick={() => setShaded([])} disabled={!shaded.length}>
                پاک کردن رنگ‌ها
              </button>
              <button className={styles.clear} onClick={() => setShaded(range(parts))}>
                همه را رنگ کن
              </button>
            </div>
            <p className={styles.status + " " + styles.info}>
              <Rich
                segs={[
                  "رنگ‌شده: ",
                  { n: fa(frac.n), d: fa(frac.d) },
                  ...(low.d !== frac.d && frac.n > 0 ? [" یعنی ", { n: fa(low.n), d: fa(low.d) }] : []),
                  ...(Number.isInteger(pct) ? [` · ${fa(pct)} درصد`] : []),
                ]}
              />
            </p>
            <div className={styles.row} style={{ marginTop: 8 }}>
              <button className={styles.toggle} aria-pressed={compareOn} onClick={() => setCompareOn(!compareOn)}>
                {compareOn ? "✓ " : ""}نوار دوم برای مقایسه
              </button>
            </div>
            {compareOn && (
              <>
                <h2 className={styles.progress}>نوار دوم (نقطه‌دار)</h2>
                <Stepper
                  label={`${fa(parts2)} قسمت`}
                  onLess={() => {
                    setParts2(parts2 - 1);
                    setShaded2(shaded2.filter((i) => i < parts2 - 1));
                  }}
                  onMore={() => setParts2(parts2 + 1)}
                  lessOff={parts2 <= 1}
                  moreOff={parts2 >= MAX_PARTS}
                />
                <p className={styles.note} style={{ marginTop: 8 }}>
                  دو نوار هم‌اندازه‌اند؛ پس هر کدام رنگ بیشتری دارد، کسر بزرگ‌تری است. سعی کن با قسمت‌های متفاوت، دو کسر مساوی بسازی.
                </p>
              </>
            )}
          </>
        )}

        {mode === "explore" && area === "blocks" && (
          <>
            <h2 className={styles.progress}>بلوک‌های هر نفر</h2>
            {counts.map((c, i) => (
              <div key={i} className={styles.row} style={{ marginBottom: 6 }}>
                <Stepper
                  label={`${PEOPLE[i]}: ${fa(c)} بلوک`}
                  onLess={() => setCounts(counts.map((x, j) => (j === i ? x - 1 : x)))}
                  onMore={() => setCounts(counts.map((x, j) => (j === i ? x + 1 : x)))}
                  lessOff={c <= 1}
                  moreOff={c >= MAX_BLOCKS}
                />
              </div>
            ))}
            <div className={styles.row}>
              <button className={styles.toggle} aria-pressed={counts.length === 3} onClick={() => setCounts(counts.length === 3 ? counts.slice(0, 2) : [...counts, 1])}>
                {counts.length === 3 ? "✓ " : ""}نفر سوم
              </button>
            </div>
            <h2 className={styles.progress}>هر بلوک چند تا است؟</h2>
            <Stepper label={`هر بلوک = ${fa(blockValue)}`} onLess={() => setBlockValue(blockValue - 1)} onMore={() => setBlockValue(blockValue + 1)} lessOff={blockValue <= 1} moreOff={blockValue >= 12} />
            <p className={styles.status + " " + styles.info}>
              نسبت {counts.map(fa).join(" به ")}
              {g > 1 ? ` (ساده: ${counts.map((c) => fa(c / g)).join(" به ")})` : ""} · سهم‌ها: {counts.map((c, i) => `${PEOPLE[i]} ${fa(c * blockValue)}`).join("، ")} · جمع {fa(total * blockValue)}
            </p>
            <p className={styles.note}>روی یک بلوک بزن تا به ردیف بعد برود: جمع ثابت می‌ماند ولی نسبت عوض می‌شود. «هر بلوک» را عوض کن: نسبت ثابت می‌ماند ولی سهم‌ها بزرگ و کوچک می‌شوند.</p>
          </>
        )}

        {mode === "show" && (
          <>
            <div className={tryStyles.types} role="radiogroup" aria-label="نوع مسئله">
              {TYPES.map((t) => (
                <button key={t} role="radio" aria-checked={showType === t} onClick={() => freshShow(t, showLevel)}>
                  {RATIO_TYPE_LABEL[t]}
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
            <p className={tryStyles.prompt}>
              <Rich segs={ratioPrompt(shown)} />
            </p>
            <h2 className={styles.progress}>مدل نواری، قدم‌به‌قدم</h2>
            <ol className={own.steps}>
              {showSteps.map((s, i) => (
                <li key={i} data-on={i === showStage ? "true" : i < showStage ? undefined : "false"}>
                  <Rich segs={s} />
                </li>
              ))}
            </ol>
            <button
              className={tryStyles.next}
              style={{ marginTop: 12, width: "100%" }}
              onClick={() => {
                freshShow();
                animate(msFor(showSteps.length));
              }}
            >
              نمونه تازه
            </button>
          </>
        )}

        {mode === "try" && (
          <RatioTryPanel
            key={`${tryType}-${tryLevel}-${seed}`}
            question={question}
            type={tryType}
            level={tryLevel}
            shadedCount={trySel.length}
            onClearShade={() => setTrySel([])}
            checked={checked}
            exam={practice.exam}
            onCheck={(v) => {
              setChecked(v);
              void practiceCheck(RATIO_ADAPTER, v);
              if (!practice.exam) animate(msFor(tryStepsCount));
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

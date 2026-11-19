"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fillLayout,
  LAYOUT_SIZE,
  makePatternQuestion,
  makeRules,
  matrixWhy,
  ruleText,
  type Layout,
  type Level,
  type PatternQuestion,
  type PatternQuestionType,
  type RuleKind,
  type Why,
} from "@/generators/patterns";
import { mulberry32, newSeed } from "@/generators/random";
import { setClassroom as applyClassroom, useClassroom } from "@/toolkit/classroom";
import { TeacherGuideButton } from "@/toolkit/TeacherGuide";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/ToolLayout.module.css";
import { PATTERNS_GUIDE } from "./guide";
import { PATTERN_TYPE_LABEL, PatternTryPanel, tileWords } from "./PatternTryPanel";
import { PatternScene } from "./Scene";

type Mode = "explore" | "show" | "try";

const LAYOUTS: [Layout, string][] = [
  ["m3", "ماتریس ۳×۳"],
  ["m2", "ماتریس ۲×۲"],
  ["seq", "دنباله"],
];

const CARDS: { kind: RuleKind; label: string }[] = [
  { kind: "turn", label: "چرخش ↻" },
  { kind: "count", label: "تعداد" },
  { kind: "shape", label: "شکل" },
  { kind: "fill", label: "رنگ و نقش" },
  { kind: "lines", label: "جمع شکل" },
];

/** Steps for reading a question: its rows and columns (or rules), then the answer. */
function stepsOf(q: PatternQuestion): Why[] {
  if (q.type === "odd") return [{ text: q.why, cells: [q.answer] }];
  const last = { text: `پس جواب گزینه ${fa(q.answer + 1)} است${q.type === "missing" ? "" : tileWords(q.options[q.answer]) ? `: ${tileWords(q.options[q.answer])}` : ""}.`, cells: [] as number[] };
  if (q.type === "missing") {
    const [r, c] = q.hole;
    const hole = [r * q.cols + c, r * q.cols + c + 1, (r + 1) * q.cols + c, (r + 1) * q.cols + c + 1];
    return [...q.why.map((w) => ({ ...w, cells: hole })), { ...last, cells: hole }];
  }
  const read = q.why.filter((w) => w.cells.length);
  return [...(read.length ? read : q.why), { ...last, cells: [q.blank] }];
}

export function PatternsTool() {
  const [mode, setMode] = useState<Mode>("explore");
  const [classroom, setClassroom] = useClassroom();

  // Playback 0 … 1 over the reading steps.
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
  const animate = useCallback((steps: number, from = 0) => {
    setF(from);
    setRun({ from, ms: steps * 2600 * (1 - from) });
  }, []);

  // Explore: rule cards fill the layout.
  const [layout, setLayout] = useState<Layout>("m3");
  const [kinds, setKinds] = useState<RuleKind[]>(["count", "shape"]);
  const [turnStep, setTurnStep] = useState(2);
  const [countStep, setCountStep] = useState(1);
  const [op, setOp] = useState<"add" | "xor">("add");
  const [valuesSeed, setValuesSeed] = useState(3);
  const [hideLast, setHideLast] = useState(false);
  const pattern = useMemo(() => {
    const { rules, base } = makeRules(kinds, layout, mulberry32(valuesSeed), op, { turn: turnStep, count: countStep });
    return { rules, cells: fillLayout(base, rules, layout) };
  }, [kinds, layout, op, turnStep, countStep, valuesSeed]);
  const [rows, cols] = LAYOUT_SIZE[layout];
  const blank = rows * cols - 1;
  const showSteps = useMemo<Why[]>(
    () => [...matrixWhy(pattern.cells, rows, cols, pattern.rules, blank), { text: `پس جای «؟»${tileWords(pattern.cells[blank]) ? `: ${tileWords(pattern.cells[blank])}` : " پر می‌شود"}.`, cells: [blank] }],
    [pattern, rows, cols, blank],
  );

  const toggleCard = (k: RuleKind) => {
    if (k === "lines") {
      setKinds(["lines"]);
      setLayout("m3");
      return;
    }
    const cur = kinds.filter((x) => x !== "lines");
    if (cur.includes(k)) {
      if (cur.length > 1) setKinds(cur.filter((x) => x !== k));
    } else if (cur.length < 3) setKinds([...cur, k]);
    else setKinds([...cur.slice(1), k]);
  };

  // Try it
  const [tryType, setTryType] = useState<PatternQuestionType>("matrix3");
  const [tryLevel, setTryLevel] = useState<Level>(1);
  const [seed, setSeed] = useState(303);
  const [picked, setPicked] = useState<number | null>(null);
  const question = useMemo(() => makePatternQuestion(tryType, tryLevel, seed), [tryType, tryLevel, seed]);
  const trySteps = useMemo(() => stepsOf(question), [question]);
  const pickAnswer = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    animate(trySteps.length);
  };

  // Shareable links: #try=matrix3&level=2&seed=7(&pick=n), #show, #f=0.5, #classroom
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.has("classroom")) applyClassroom(true);
    const tryParam = params.get("try");
    const timer = setTimeout(() => {
      if (tryParam) {
        setMode("try");
        if (tryParam in PATTERN_TYPE_LABEL) setTryType(tryParam as PatternQuestionType);
        const lv = Number(params.get("level"));
        if (lv === 1 || lv === 2 || lv === 3) setTryLevel(lv);
        const sd = Number(params.get("seed"));
        if (Number.isInteger(sd) && sd >= 0) setSeed(sd);
        const pk = Number(params.get("pick"));
        if (params.has("pick") && pk >= 1 && pk <= 6) setPicked(pk - 1);
        setF(1);
      } else if (params.has("show")) {
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
    setF(1);
  };

  const freshQuestion = (type = tryType, level = tryLevel) => {
    setTryType(type);
    setTryLevel(level);
    setSeed(newSeed());
    setPicked(null);
    setRun(null);
    setF(1);
  };

  const steps = mode === "show" ? showSteps : trySteps;
  const stepAt = Math.min(steps.length - 1, Math.floor(f * steps.length));
  const play = () => {
    if (run) return setRun(null);
    animate(steps.length, f >= 0.99 ? 0 : f);
  };

  let board: React.ReactNode;
  if (mode === "explore")
    board = (
      <PatternScene rows={rows} cols={cols} cells={pattern.cells.map((t, i) => (hideLast && i === blank ? null : t))} label="الگو" />
    );
  else if (mode === "show") {
    const reveal = stepAt === steps.length - 1;
    board = <PatternScene rows={rows} cols={cols} cells={pattern.cells.map((t, i) => (i === blank && !reveal ? null : t))} highlight={steps[stepAt].cells} label="الگو، سطر به سطر" />;
  } else {
    const q = question;
    const answered = picked !== null;
    const hl = answered ? trySteps[stepAt].cells : [];
    if (q.type === "odd")
      board = (
        <PatternScene
          rows={1}
          cols={5}
          cells={q.tiles}
          labels={q.tiles.map((_, i) => `${fa(i + 1)}${answered && i === q.answer ? " ✓" : answered && i === picked ? " ✗" : ""}`)}
          highlight={hl}
          onCell={answered ? undefined : pickAnswer}
          label="کدام فرق دارد؟"
        />
      );
    else if (q.type === "missing") {
      const [r, c] = q.hole;
      const right = q.options[q.answer];
      const holeAt = (i: number) => {
        const [ri, ci] = [Math.floor(i / q.cols), i % q.cols];
        return ri >= r && ri <= r + 1 && ci >= c && ci <= c + 1 ? (ri - r) * 2 + (ci - c) : -1;
      };
      board = (
        <PatternScene
          rows={q.rows}
          cols={q.cols}
          cells={q.cells.map((t, i) => {
            const k = holeAt(i);
            return k < 0 ? t : answered ? right[k] : null;
          })}
          highlight={hl}
          label="تصویر با جای خالی"
        />
      );
    } else board = <PatternScene rows={q.rows} cols={q.cols} cells={q.cells.map((t, i) => (i === q.blank && !answered ? null : t))} signs={q.signs} highlight={hl} label="الگو" />;
  }

  const showControls = mode === "show" || (mode === "try" && picked !== null);

  return (
    <main className={styles.layout}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          → همه ابزارها
        </Link>
        <h1>
          <span className={styles.badge}>{fa(3)}</span> موتور الگو و ماتریس
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
              animate(showSteps.length);
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
          <TeacherGuideButton guide={PATTERNS_GUIDE} />
          <Link href={`/tools/patterns/worksheet?types=${tryType}&level=${tryLevel}`}>کاربرگ</Link>
        </div>
      </header>

      <section className={styles.stageWrap} aria-label="صفحه الگو">
        {board}
      </section>

      <section className={styles.controls}>
        {showControls ? (
          <label className={styles.slider}>
            <button className={styles.playSmall} onClick={play} aria-label={run ? "توقف" : "پخش"}>
              {run ? "⏸" : "▶"}
            </button>
            <span>
              گام {fa(stepAt + 1)} از {fa(steps.length)}
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
              aria-label="گام‌ها"
            />
          </label>
        ) : (
          <p className={styles.stepText} style={{ margin: 0 }}>
            {mode === "explore" ? "کارت‌های قانون را روشن و خاموش کن؛ الگو خودش پر می‌شود." : "گزینه درست را انتخاب کن"}
          </p>
        )}
        {showControls && <p className={styles.stepText} style={{ margin: 0, flexBasis: "100%", textAlign: "start" }}>{steps[stepAt].text}</p>}
      </section>

      <aside className={styles.side}>
        {mode === "explore" && (
          <>
            <h2>۱. چیدمان</h2>
            <div className={styles.chipsRow} role="radiogroup" aria-label="چیدمان">
              {LAYOUTS.map(([l, label]) => (
                <button key={l} role="radio" aria-checked={layout === l} disabled={kinds.includes("lines") && l !== "m3"} onClick={() => setLayout(l)}>
                  {label}
                </button>
              ))}
            </div>

            <h2 className={styles.progress}>۲. کارت‌های قانون</h2>
            <p className={styles.note}>تا سه کارت با هم. «جمع شکل» تنها کار می‌کند و فقط در ماتریس ۳×۳.</p>
            <div className={styles.choiceGrid} aria-label="کارت‌های قانون">
              {CARDS.map((c) => (
                <button key={c.kind} role="checkbox" aria-checked={kinds.includes(c.kind)} onClick={() => toggleCard(c.kind)}>
                  {kinds.includes(c.kind) ? "✓ " : ""}
                  {c.label}
                </button>
              ))}
            </div>
            {kinds.includes("turn") && (
              <div className={styles.chipsRow} role="radiogroup" aria-label="اندازه چرخش">
                {[
                  [1, "۴۵° ↻"],
                  [2, "۹۰° ↻"],
                  [-2, "۹۰° ↺"],
                ].map(([s, label]) => (
                  <button key={s} role="radio" aria-checked={turnStep === s} onClick={() => setTurnStep(s as number)}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            {kinds.includes("count") && (
              <div className={styles.chipsRow} role="radiogroup" aria-label="تغییر تعداد">
                <button role="radio" aria-checked={countStep === 1} onClick={() => setCountStep(1)}>
                  یکی بیشتر
                </button>
                <button role="radio" aria-checked={countStep === -1} onClick={() => setCountStep(-1)}>
                  یکی کمتر
                </button>
              </div>
            )}
            {kinds.includes("lines") && (
              <div className={styles.chipsRow} role="radiogroup" aria-label="جمع یا تفریق">
                <button role="radio" aria-checked={op === "add"} onClick={() => setOp("add")}>
                  روی هم (جمع)
                </button>
                <button role="radio" aria-checked={op === "xor"} onClick={() => setOp("xor")}>
                  مشترک‌ها پاک
                </button>
              </div>
            )}

            <h2 className={styles.progress}>۳. قانون‌ها</h2>
            <ul className={styles.note} style={{ paddingInlineStart: 18 }}>
              {pattern.rules.map((r, i) => (
                <li key={i}>{ruleText(r, layout)}</li>
              ))}
            </ul>
            <div className={styles.row}>
              <button className={styles.clear} onClick={() => setValuesSeed(newSeed())}>
                شکل‌های تازه
              </button>
              <button className={styles.clear} aria-pressed={hideLast} onClick={() => setHideLast((h) => !h)}>
                {hideLast ? "خانه آخر را نشان بده" : "خانه آخر را پنهان کن"}
              </button>
            </div>
          </>
        )}

        {mode === "show" && (
          <>
            <h2>قانون هر سطر و ستون</h2>
            <p className={styles.note}>الگویی که در «کشف» ساختی، سطر به سطر خوانده می‌شود؛ در آخر، خانه «؟» پر می‌شود.</p>
            <ol className={styles.pairs}>
              {showSteps.map((s, i) => (
                <li key={i} aria-current={stepAt === i ? "step" : undefined} style={{ fontWeight: stepAt === i ? 700 : 400 }}>
                  <span className={styles.chip} style={{ background: stepAt === i ? "var(--accent)" : "#b9b2a5" }}>
                    {fa(i + 1)}
                  </span>
                  <button
                    style={{ border: "none", background: "none", textAlign: "start", padding: 0, font: "inherit", lineHeight: 1.7 }}
                    onClick={() => {
                      setRun(null);
                      setF((i + 0.5) / showSteps.length);
                    }}
                  >
                    {s.text}
                  </button>
                </li>
              ))}
            </ol>
            <div className={styles.rules}>
              {pattern.rules.map((r, i) => (
                <p key={i}>{ruleText(r, layout)}</p>
              ))}
            </div>
          </>
        )}

        {mode === "try" && (
          <PatternTryPanel
            key={`${tryType}-${tryLevel}-${seed}`}
            question={question}
            type={tryType}
            level={tryLevel}
            picked={picked}
            onPick={pickAnswer}
            onType={(t) => freshQuestion(t, tryLevel)}
            onLevel={(l) => freshQuestion(tryType, l)}
            onNew={() => freshQuestion()}
          />
        )}
      </aside>
    </main>
  );
}

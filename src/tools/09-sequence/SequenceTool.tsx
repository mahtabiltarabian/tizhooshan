"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Board } from "@/engine-2d/Board";
import { newSeed } from "@/generators/random";
import { diffsOf, makeSequenceQuestion, termsOf, type BlankChoice, type Level, type Rule, type SequenceQuestionType } from "@/generators/sequence";
import { setClassroom as applyClassroom, useClassroom } from "@/toolkit/classroom";
import { TeacherGuideButton } from "@/toolkit/TeacherGuide";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/ToolLayout.module.css";
import { decodeBuild, DEFAULT_BUILD, LIMITS, PRESETS, ruleOf, TOO_BIG, type Build, type BuildKind } from "./build";
import { SEQUENCE_GUIDE } from "./guide";
import css from "./Sequence.module.css";
import { BLANK_LABEL, SEQ_TYPE_LABEL, SequenceTryPanel } from "./SequenceTryPanel";
import { ltr, numFa, rowsFor, signedFa, stepFa, termFa, trainView, TrainG } from "./Train";

type Mode = "explore" | "show" | "try";

const CARDS: [BuildKind, string, string][] = [
  ["add", "+", "هر بار جمع کن"],
  ["mul", "×", "هر بار ضرب کن"],
  ["alt", "● ▲ ● ▲", "یکی‌درمیان"],
  ["grow", "+۱ +۲ +۳", "اختلاف رو به رشد"],
  ["sum2", "۱+۲", "جمع دو قبلی"],
];

/** How many terms can be drawn before the numbers run away. */
const drawable = (terms: number[]) => {
  const k = terms.findIndex((t) => !Number.isFinite(t) || Math.abs(t) > TOO_BIG);
  return k < 0 ? terms.length : k;
};

/** Strand hop labels for a woven rule. */
const strandSteps = (rule: Rule): [string, string] | undefined => (rule.kind === "alt" ? [stepFa(rule.a.op, rule.a.by), stepFa(rule.b.op, rule.b.by)] : undefined);

/** What the rows show, in words. */
function rowsText(rule: Rule, terms: number[]) {
  const d = diffsOf(terms);
  const list = (xs: number[]) => xs.map((v) => ltr(signedFa(v))).join("، ");
  switch (rule.kind) {
    case "step":
      if (rule.op === "+") return `اختلاف‌ها همه ${ltr(signedFa(rule.by))} هستند: اختلاف ثابت یعنی دنباله حسابی.`;
      return `اختلاف‌ها (${list(d)}) ثابت نیستند، ولی بالای قطار هر جمله ${ltr(stepFa(rule.op, rule.by))} جمله قبلی است: نسبت ثابت یعنی دنباله هندسی. اختلاف‌ها هم خودشان ${fa(rule.by)} برابر می‌شوند.`;
    case "grow":
      return `اختلاف‌ها (${list(d)}) ثابت نیستند؛ ولی اختلاف بین آن‌ها، یعنی اختلاف دوم، همیشه ${ltr(signedFa(rule.growth))} است. پس اختلاف بعدی را می‌شود پیش‌بینی کرد.`;
    case "sum2":
      return `بالای هر واگن، جمع دو واگن قبلی نوشته شده و همان است! اختلاف‌ها (${list(d)}) هم خود جمله‌های دنباله‌اند که یکی عقب افتاده‌اند.`;
    case "alt":
      return `یکی‌درمیان نگاه کن: واگن‌های ● (فرد) با گام ${ltr(stepFa(rule.a.op, rule.a.by))} و واگن‌های ▲ (زوج) با گام ${ltr(stepFa(rule.b.op, rule.b.by))} پیش می‌روند. دو دنباله ساده در هم بافته شده‌اند.`;
  }
}

/** The rule in one sentence. */
function ruleSentence(b: Build) {
  const s = numFa(b.start);
  switch (b.kind) {
    case "add":
      return `از ${s} شروع کن و هر بار ${fa(Math.abs(b.step))} تا ${b.step < 0 ? "کم" : "اضافه"} کن.`;
    case "mul":
      return `از ${s} شروع کن و هر بار در ${fa(b.factor)} ضرب کن.`;
    case "grow":
      return `از ${s} شروع کن؛ اختلاف اول ${ltr(signedFa(b.first))} است و هر بار ${ltr(signedFa(b.growth))} تغییر می‌کند.`;
    case "sum2":
      return `با ${s} و ${numFa(b.second)} شروع کن؛ هر جمله جمع دو جمله قبلی است.`;
    case "alt":
      return `واگن‌های فرد (●) از ${s} با گام ${ltr(b.opA === "+" ? signedFa(b.step) : `×${fa(b.factor)}`)}؛ واگن‌های زوج (▲) از ${numFa(b.start2)} با گام ${ltr(b.opB === "+" ? signedFa(b.step2) : `×${fa(b.factor2)}`)}.`;
  }
}

export function SequenceTool() {
  const [mode, setMode] = useState<Mode>("explore");
  const [classroom, setClassroom] = useClassroom();

  // Playback 0 … 1: wagons arriving (explore) or rows appearing (show me, after an answer).
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

  // Explore and show me
  const [build, setBuild] = useState<Build>(DEFAULT_BUILD);
  const [showRows, setShowRows] = useState(false);
  const rule = useMemo(() => ruleOf(build), [build]);
  const terms = useMemo(() => termsOf(rule, build.n), [rule, build.n]);
  const upTo = drawable(terms);

  // Try it
  const [tryType, setTryType] = useState<SequenceQuestionType>("mixed");
  const [tryLevel, setTryLevel] = useState<Level>(1);
  const [blank, setBlank] = useState<BlankChoice>("auto");
  const [big, setBig] = useState(false);
  const [seed, setSeed] = useState(909);
  const [checked, setChecked] = useState<number | null>(null);
  const question = useMemo(() => makeSequenceQuestion(tryType, tryLevel, seed, { blank, big }), [tryType, tryLevel, seed, blank, big]);

  const buildMs = 600 + 350 * build.n;
  const showMs = 1500 + 450 * build.n * rowsFor(rule).length;
  const tryMs = 1200 + 400 * question.terms.length * rowsFor(question.rule).length;

  // Shareable links: #try=alternate&level=2&seed=7&blank=mid&big=1(&a=17), #show=add&s=2&d=3&n=6, #build=… for explore, #f=0.5, #classroom
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.has("classroom")) applyClassroom(true);
    const tryParam = params.get("try");
    const show = params.get("show") ?? params.get("build");
    const timer = setTimeout(() => {
      if (tryParam) {
        setMode("try");
        if (tryParam in SEQ_TYPE_LABEL) setTryType(tryParam as SequenceQuestionType);
        const lv = Number(params.get("level"));
        if (lv === 1 || lv === 2 || lv === 3) setTryLevel(lv);
        const sd = Number(params.get("seed"));
        if (Number.isInteger(sd) && sd >= 0) setSeed(sd);
        const bl = params.get("blank");
        if (bl && bl in BLANK_LABEL) setBlank(bl as BlankChoice);
        setBig(params.get("big") === "1");
        const a = Number(params.get("a"));
        if (params.has("a") && Number.isInteger(a)) {
          setChecked(a);
          setF(1);
        } else setF(0);
      } else if (show) {
        const b = decodeBuild(show, params);
        if (b) setBuild(b);
        setMode(params.has("show") ? "show" : "explore");
        if (params.has("rows")) setShowRows(true);
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
    setF(m === "try" && checked === null ? 0 : 1);
  };

  const freshQuestion = (type = tryType, level = tryLevel) => {
    setTryType(type);
    setTryLevel(level);
    setSeed(newSeed());
    setChecked(null);
    setRun(null);
    setF(0);
  };
  /** Same seed, other gap or size: the pupil sees the change. */
  const retune = (b: BlankChoice, isBig: boolean) => {
    setBlank(b);
    setBig(isBig);
    setChecked(null);
    setRun(null);
    setF(0);
  };

  const play = (ms: number) => {
    if (run) return setRun(null);
    animate(ms, f >= 0.99 ? 0 : f);
  };

  const pickCard = (kind: BuildKind) => {
    setBuild((b) => ({ ...b, ...PRESETS[kind], letters: kind === "mul" || kind === "sum2" ? false : b.letters }));
    animate(600 + 350 * Math.max(build.n, kind === "alt" ? 8 : 0));
  };
  const set = <K extends keyof Build>(k: K, v: Build[K]) => setBuild((b) => ({ ...b, [k]: v }));

  const outOfAlphabet = build.letters && terms.slice(0, upTo).some((t) => t < 1 || t > 32);
  const seqLine = terms
    .slice(0, upTo)
    .map((t) => termFa(t, build.letters))
    .join("، ");

  let board: React.ReactNode;
  if (mode !== "try") {
    const rows = mode === "show" || showRows ? rowsFor(rule) : [];
    board = (
      <Board view={trainView(build.n)} imageName="sequence" label={`قطار دنباله: ${seqLine}`}>
        <TrainG
          terms={terms}
          letters={build.letters}
          upTo={upTo}
          build={mode === "explore" ? f : 1}
          rows={rows}
          reveal={mode === "show" ? f : 1}
          places={build.letters}
          strands={rule.kind === "alt"}
          strandSteps={strandSteps(rule)}
        />
      </Board>
    );
  } else {
    const q = question;
    const done = checked !== null;
    board = (
      <Board view={trainView(q.terms.length)} imageName="sequence" label="قطار دنباله با یک واگن خالی">
        <TrainG
          terms={q.terms}
          letters={q.letters}
          hidden={done ? null : q.blank}
          rows={done ? rowsFor(q.rule) : []}
          reveal={f}
          places={q.letters && done}
          strands={done && q.rule.kind === "alt"}
          strandSteps={strandSteps(q.rule)}
          mark={done ? { index: q.blank, right: checked === q.answer, yours: termFa(checked, q.letters) } : null}
        />
      </Board>
    );
  }

  const inTry = mode === "try";
  const showSlider = mode !== "try" || checked !== null;

  return (
    <main className={styles.layout}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          → همه ابزارها
        </Link>
        <h1>
          <span className={styles.badge}>{fa(9)}</span> دنباله
        </h1>
        <div className={styles.tabs} role="tablist" aria-label="حالت ابزار">
          <button role="tab" aria-selected={mode === "explore"} onClick={() => switchMode("explore")}>
            کشف: قطار را بساز
          </button>
          <button
            role="tab"
            aria-selected={mode === "show"}
            onClick={() => {
              switchMode("show");
              animate(showMs);
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
          <TeacherGuideButton guide={SEQUENCE_GUIDE} />
          <Link href={`/tools/sequence/worksheet?types=${tryType}&level=${tryLevel}`}>کاربرگ</Link>
        </div>
      </header>

      <section className={styles.stageWrap} aria-label="صفحه دنباله">
        {board}
      </section>

      <section className={styles.controls}>
        {showSlider ? (
          <label className={styles.slider}>
            <button className={styles.playSmall} onClick={() => play(mode === "explore" ? buildMs : inTry ? tryMs : showMs)} aria-label={run ? "توقف" : "پخش"}>
              {run ? "⏸" : "▶"}
            </button>
            <span>{mode === "explore" ? "ساختن قطار" : "ردیف اختلاف‌ها"}</span>
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
            اول قانون را پیدا کن، بعد جواب بده
          </p>
        )}
      </section>

      <aside className={styles.side}>
        {mode === "explore" && (
          <>
            <h2 className={styles.progress}>۱. کارت قانون را انتخاب کن</h2>
            <div className={css.cards} role="radiogroup" aria-label="کارت قانون">
              {CARDS.map(([kind, symbol, name]) => (
                <button key={kind} className={css.card} role="radio" aria-checked={build.kind === kind} onClick={() => pickCard(kind)}>
                  <span className={`${css.cardSymbol} ${symbol.length === 1 ? css.cardBig : ""}`}>{symbol}</span>
                  <span className={css.cardName}>{name}</span>
                </button>
              ))}
            </div>

            <h2 className={styles.progress}>۲. عددهای کارت</h2>
            {build.kind !== "alt" && <Param name={build.kind === "sum2" ? "جمله اول" : "شروع"} k="start" b={build} set={set} />}
            {build.kind === "add" && <Param name="گام" k="step" b={build} set={set} signed />}
            {build.kind === "mul" && <Param name="ضرب در" k="factor" b={build} set={set} />}
            {build.kind === "grow" && (
              <>
                <Param name="اختلاف اول" k="first" b={build} set={set} signed />
                <Param name="رشد اختلاف" k="growth" b={build} set={set} signed />
              </>
            )}
            {build.kind === "sum2" && <Param name="جمله دوم" k="second" b={build} set={set} />}
            {build.kind === "alt" && (
              <>
                <StrandEditor title="● واگن‌های فرد" b={build} set={set} keys={["opA", "start", "step", "factor"]} />
                <StrandEditor title="▲ واگن‌های زوج" dashed b={build} set={set} keys={["opB", "start2", "step2", "factor2"]} />
              </>
            )}
            <Param name="تعداد واگن" k="n" b={build} set={set} />

            <div className={styles.row} style={{ marginTop: 8 }}>
              <button className={styles.toggle} aria-pressed={showRows} onClick={() => setShowRows(!showRows)}>
                {showRows ? "✓ " : ""}اختلاف‌ها را نشان بده
              </button>
              {build.kind !== "mul" && build.kind !== "sum2" && (
                <button className={styles.toggle} aria-pressed={build.letters} onClick={() => set("letters", !build.letters)}>
                  {build.letters ? "✓ " : ""}حرف‌ها به‌جای عدد
                </button>
              )}
            </div>

            <p className={css.seqLine}>{seqLine}{upTo < build.n ? "، …" : ""}</p>
            <p className={styles.status + " " + styles.info}>
              {ruleSentence(build)}
              {upTo < build.n && " عددها خیلی بزرگ شدند؛ قطار همین‌جا می‌ایستد."}
              {outOfAlphabet && " بعضی واگن‌ها از الفبا بیرون زدند (·)؛ الفبا از ا = ۱ تا ی = ۳۲ است."}
            </p>
            <button
              className={styles.clear}
              onClick={() => {
                setMode("show");
                animate(showMs);
              }}
            >
              نشانم بده اختلاف‌ها چه می‌گویند
            </button>
          </>
        )}

        {mode === "show" && (
          <>
            <h2>اختلاف‌ها زیر جمله‌ها</h2>
            <p className={styles.note}>زیر هر دو واگن کنار هم، می‌نویسیم چقدر عوض شد. اگر اختلاف‌ها ثابت نبودند، زیر خودشان ردیف اختلاف دوم را می‌سازیم.</p>
            <div className={styles.chipsRow} role="radiogroup" aria-label="نمونه" style={{ flexWrap: "wrap" }}>
              {CARDS.map(([kind, , name]) => (
                <button
                  key={kind}
                  role="radio"
                  aria-checked={build.kind === kind}
                  style={{ flex: "1 0 30%", fontSize: "0.8rem" }}
                  onClick={() => {
                    setBuild((b) => ({ ...b, ...PRESETS[kind], letters: false, n: kind === "alt" ? 8 : Math.max(6, b.n) }));
                    animate(showMs);
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
            <p className={css.seqLine}>{seqLine}</p>
            <p className={styles.status + " " + styles.info}>{rowsText(rule, terms.slice(0, upTo))}</p>
            {build.letters && <p className={styles.note}>زیر هر حرف، شماره‌اش در الفبا آمده؛ اختلاف‌ها روی همین شماره‌ها حساب می‌شوند.</p>}
            <p className={styles.note}>دنباله را در «کشف» با کارت‌ها عوض کن.</p>
          </>
        )}

        {mode === "try" && (
          <SequenceTryPanel
            key={`${tryType}-${tryLevel}-${seed}-${blank}-${big}`}
            question={question}
            type={tryType}
            level={tryLevel}
            blank={blank}
            big={big}
            checked={checked}
            onCheck={(v) => {
              setChecked(v);
              animate(tryMs);
            }}
            onType={(t) => freshQuestion(t, tryLevel)}
            onLevel={(l) => freshQuestion(tryType, l)}
            onBlank={(b) => retune(b, big)}
            onBig={(v) => retune(blank, v)}
            onNew={() => freshQuestion()}
          />
        )}
      </aside>
    </main>
  );
}

type NumKey = keyof typeof LIMITS;

function Param({ name, k, b, set, signed }: { name: string; k: NumKey; b: Build; set: <K extends keyof Build>(k: K, v: Build[K]) => void; signed?: boolean }) {
  const [lo, hi] = LIMITS[k];
  const v = b[k];
  // A step of zero is no rule at all.
  const skipZero = k === "step" || k === "step2" || k === "first" || k === "growth";
  const to = (x: number) => set(k, skipZero && x === 0 ? x + Math.sign(x - v) : x);
  return (
    <div className={styles.row} style={{ marginBottom: 6 }}>
      <span className={css.paramName}>{name}</span>
      <button className={styles.clear} onClick={() => to(v - 1)} disabled={v <= lo} aria-label={`${name} کمتر`}>
        −
      </button>
      <span className={styles.stepperLabel}>
        <bdi dir="ltr">{signed ? signedFa(v) : numFa(v)}</bdi>
      </span>
      <button className={styles.clear} onClick={() => to(v + 1)} disabled={v >= hi} aria-label={`${name} بیشتر`}>
        +
      </button>
    </div>
  );
}

function StrandEditor({
  title,
  b,
  set,
  keys,
  dashed,
}: {
  title: string;
  b: Build;
  set: <K extends keyof Build>(k: K, v: Build[K]) => void;
  keys: ["opA" | "opB", "start" | "start2", "step" | "step2", "factor" | "factor2"];
  dashed?: boolean;
}) {
  const [opKey, startKey, stepKey, factorKey] = keys;
  const op = b[opKey];
  return (
    <div className={`${css.strand} ${dashed ? css.strandB : ""}`}>
      <h3>{title}</h3>
      <div className={styles.chipsRow} role="radiogroup" aria-label={`کارت ${title}`} style={{ margin: "0 0 6px" }}>
        {(["+", "×"] as const).map((o) => (
          <button key={o} role="radio" aria-checked={op === o} onClick={() => set(opKey, o)}>
            {o === "+" ? "+ جمع" : "× ضرب"}
          </button>
        ))}
      </div>
      <Param name="شروع" k={startKey} b={b} set={set} />
      {op === "+" ? <Param name="گام" k={stepKey} b={b} set={set} signed /> : <Param name="ضرب در" k={factorKey} b={b} set={set} />}
    </div>
  );
}

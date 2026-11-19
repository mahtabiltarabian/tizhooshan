"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Board } from "@/engine-2d/Board";
import { newSeed } from "@/generators/random";
import { divide, itemAt, makeCycleQuestion, SYMBOLS, type CycleSet } from "@/generators/cycle";
import { makeNthQuestion } from "@/generators/nth-term";
import { diffsOf, makeSequenceQuestion, termsOf, type BlankChoice, type Level, type Rule } from "@/generators/sequence";
import { setClassroom as applyClassroom, useClassroom } from "@/toolkit/classroom";
import { TeacherGuideButton } from "@/toolkit/TeacherGuide";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/ToolLayout.module.css";
import { decodeBuild, DEFAULT_BUILD, LIMITS, PRESETS, ruleOf, TOO_BIG, type Build, type BuildKind } from "./build";
import { SEQUENCE_GUIDE } from "./guide";
import css from "./Sequence.module.css";
import { CycleG, cycleBoardProps, cycleLayout, cycleView, ltr as ltrC, rowWords, SymbolIcon, symbolWord } from "./Cycle";
import { cycleAnswerFa, CycleTryPanel } from "./CycleTryPanel";
import { decodeNth, DEFAULT_NTH, NTH_LIMITS, NTH_PHASES, NthBuildBoard, NthExplorePanel, NthShowPanel, NthTryBoard, type NthBuild } from "./NthPanels";
import { NthTryPanel } from "./NthTryPanel";
import { BLANK_LABEL, SEQ_TYPE_LABEL, SequenceTryPanel, type SeqTryType } from "./SequenceTryPanel";
import { ltr, numFa, rowsFor, rowsName, signedFa, stepFa, termFa, trainView, TrainG } from "./Train";

type Mode = "explore" | "show" | "try";
/** Explore and show me: number rules on the train, a repeating pattern, or the nth term. */
type Topic = "rule" | "cycle" | "nth";
type CycleSetChoice = Exclude<CycleSet, "days">;
interface CycleBuild {
  set: CycleSetChoice;
  cycle: number[];
  n: number;
}
const DEFAULT_CYCLE: CycleBuild = { set: "shapes", cycle: [0, 1, 2], n: 100 };
const CYCLE_SETS: [CycleSetChoice, string][] = [
  ["shapes", "شکل"],
  ["letters", "حرف"],
  ["beads", "مهره رنگی"],
];
const N_MAX = 300;
/** Show me for a cycle: boxes, then the division, then the walk to N. */
const PHASES = [0.4, 0.7];
/** The step under way: marked by "◀" and a frame, not by colour alone. */
const CURRENT = { outline: "2px solid var(--accent)", borderRadius: 6, background: "var(--surface)" };

/** #show=cycle&set=shapes&c=0.1.1.2&n=100 */
function decodeCycle(params: URLSearchParams): CycleBuild {
  const set = CYCLE_SETS.some(([k]) => k === params.get("set")) ? (params.get("set") as CycleSetChoice) : DEFAULT_CYCLE.set;
  const ids = (params.get("c") ?? "")
    .split(".")
    .map(Number)
    .filter((v) => Number.isInteger(v) && v >= 0 && v < SYMBOLS[set].length)
    .slice(0, 6);
  const n = Number(params.get("n"));
  return { set, cycle: ids.length >= 2 ? ids : DEFAULT_CYCLE.cycle, n: Number.isInteger(n) && n >= 1 && n <= N_MAX ? n : DEFAULT_CYCLE.n };
}

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
  const [topic, setTopic] = useState<Topic>("rule");
  const [cyc, setCyc] = useState<CycleBuild>(DEFAULT_CYCLE);
  const [nth, setNth] = useState<NthBuild>(DEFAULT_NTH);
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
  const [tryType, setTryType] = useState<SeqTryType>("mixed");
  const [tryLevel, setTryLevel] = useState<Level>(1);
  const [blank, setBlank] = useState<BlankChoice>("auto");
  const [big, setBig] = useState(false);
  const [seed, setSeed] = useState(909);
  const [checked, setChecked] = useState<number | null>(null);
  const question = useMemo(() => makeSequenceQuestion(tryType === "cycle" || tryType === "nth" ? "mixed" : tryType, tryLevel, seed, { blank, big }), [tryType, tryLevel, seed, blank, big]);
  const cycleQ = useMemo(() => makeCycleQuestion(tryLevel, seed), [tryLevel, seed]);
  const isCycle = tryType === "cycle";
  const nthQ = useMemo(() => makeNthQuestion(tryLevel, seed), [tryLevel, seed]);
  const isNth = tryType === "nth";

  const buildMs = 600 + 350 * build.n;
  const showMs = 1500 + 450 * build.n * rowsFor(rule).length;
  const tryMs = isCycle || isNth ? 6000 : 1200 + 400 * question.terms.length * rowsFor(question.rule).length;
  const cycleMs = 7000;
  const nthMs = 7000;
  const nthBuildMs = 500 + 300 * Math.min(nth.n, 6);
  /** Show me lasts as long as the topic needs. */
  const topicMs = (t: Topic) => (t === "cycle" ? cycleMs : t === "nth" ? nthMs : showMs);

  // Shareable links: #try=alternate&level=2&seed=7&blank=mid&big=1(&a=17), #try=cycle&level=3&seed=7(&a=2),
  // #try=nth&level=3&seed=7(&a=3004: a rule's boxes as coefficient × 1000 + constant),
  // #show=add&s=2&d=3&n=6, #show=cycle&set=shapes&c=0.1.2&n=100, #show=nth&s=3&d=4&n=20 (or &p=squares&n=15),
  // #build=… for explore, #f=0.5, #classroom
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.has("classroom")) applyClassroom(true);
    const tryParam = params.get("try");
    const show = params.get("show") ?? params.get("build");
    const timer = setTimeout(() => {
      if (tryParam) {
        setMode("try");
        if (tryParam in SEQ_TYPE_LABEL) setTryType(tryParam as SeqTryType);
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
      } else if (show === "nth") {
        setTopic("nth");
        setNth(decodeNth(params));
        setMode(params.has("show") ? "show" : "explore");
        setF(1);
      } else if (show === "cycle") {
        setTopic("cycle");
        setCyc(decodeCycle(params));
        setMode(params.has("show") ? "show" : "explore");
        setF(1);
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

  const freshQuestion = (type: SeqTryType = tryType, level = tryLevel) => {
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

  // Repeating pattern (explore and show me).
  const cycDiv = divide({ prefix: [], cycle: cyc.cycle, n: cyc.n });
  const cycSlots = cycleLayout(0, cyc.cycle.length, cyc.n).slots.length;
  const cycItem = itemAt({ prefix: [], cycle: cyc.cycle }, cyc.n);
  const phase = f < PHASES[0] ? 0 : f < PHASES[1] ? 1 : 2;
  const setCycle = (c: number[]) => setCyc((b) => ({ ...b, cycle: c }));

  let board: React.ReactNode;
  if (mode !== "try" && topic === "nth") {
    board = <NthBuildBoard b={nth} show={mode === "show"} f={f} />;
  } else if (mode !== "try" && topic === "cycle") {
    const show = mode === "show";
    board = (
      <Board view={cycleView(cycSlots)} imageName="cycle" label={`الگوی تکرارشونده: ${rowWords(cyc.set, cyc.cycle)}، … ؛ خانه ${fa(cyc.n)}`}>
        <CycleG
          set={cyc.set}
          prefix={[]}
          cycle={cyc.cycle}
          n={cyc.n}
          boxes={show ? f / PHASES[0] : 1}
          equation={show ? (f - PHASES[0]) / 0.08 : 1}
          walk={show ? (f - PHASES[1]) / (1 - PHASES[1] - 0.04) : 1}
        />
      </Board>
    );
  } else if (mode !== "try") {
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
  } else if (isNth) {
    board = <NthTryBoard q={nthQ} checked={checked} f={checked === null ? 0 : f} />;
  } else if (isCycle) {
    const q = cycleQ;
    const done = checked !== null;
    const { view, given } = cycleBoardProps(q, done);
    board = (
      <Board view={view} imageName="cycle" label="الگوی تکرارشونده">
        <CycleG
          set={q.set}
          prefix={q.prefix}
          cycle={q.cycle}
          n={q.n}
          given={given}
          hideN={!done && q.variant !== "count"}
          target={q.variant === "count" ? q.target : undefined}
          boxes={done ? Math.min(1, f / 0.4) : 0}
          equation={done ? (f - 0.4) / 0.1 : 0}
          walk={done ? (f - 0.6) / 0.36 : 0}
          mark={done && f > 0.98 ? { right: checked === q.answer, text: checked === q.answer ? cycleAnswerFa(q) : `جواب تو: ${cycleAnswerFa(q, checked)} · جواب درست: ${cycleAnswerFa(q)}` } : null}
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
              animate(topicMs(topic));
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
        {mode === "explore" && topic === "nth" ? (
          <label className={styles.slider}>
            <span>جمله n = {fa(nth.n)}</span>
            <input type="range" min={NTH_LIMITS.n[0]} max={NTH_LIMITS.n[1]} step={1} value={nth.n} onChange={(e) => setNth((b) => ({ ...b, n: Number(e.target.value) }))} aria-label="شماره جمله n" />
          </label>
        ) : mode === "explore" && topic === "cycle" ? (
          <label className={styles.slider}>
            <span>خانه {fa(cyc.n)}</span>
            <input type="range" min={1} max={N_MAX} step={1} value={cyc.n} onChange={(e) => setCyc((b) => ({ ...b, n: Number(e.target.value) }))} aria-label="شماره خانه" />
          </label>
        ) : showSlider ? (
          <label className={styles.slider}>
            <button className={styles.playSmall} onClick={() => play(mode === "explore" ? buildMs : inTry ? tryMs : topicMs(topic))} aria-label={run ? "توقف" : "پخش"}>
              {run ? "⏸" : "▶"}
            </button>
            <span>
              {inTry && isCycle
                ? "دورها و تقسیم"
                : inTry && isNth
                  ? "جهش‌ها و ضرب"
                  : mode === "explore"
                    ? "ساختن قطار"
                    : topic === "cycle"
                      ? ["۱. دسته کن", "۲. تقسیم کن", "۳. بشمار"][phase]
                      : topic === "nth"
                        ? ["۱. بشمار", "۲. ضرب کن", "۳. اضافه کن"][f < NTH_PHASES[0] ? 0 : f < NTH_PHASES[1] ? 1 : 2]
                        : rowsName(inTry ? question.rule : rule)}
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
            اول قانون را پیدا کن، بعد جواب بده
          </p>
        )}
      </section>

      <aside className={styles.side}>
        {!inTry && (
          <div className={styles.chipsRow} role="radiogroup" aria-label="بخش">
            {(
              [
                ["rule", "قانون دنباله"],
                ["cycle", "تکرار و باقیمانده"],
                ["nth", "جمله nام"],
              ] as [Topic, string][]
            ).map(([t, label]) => (
              <button
                key={t}
                role="radio"
                aria-checked={topic === t}
                onClick={() => {
                  setTopic(t);
                  setRun(null);
                  if (mode === "show") animate(topicMs(t));
                  else setF(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {mode === "explore" && topic === "nth" && (
          <NthExplorePanel
            b={nth}
            set={(b) => {
              setRun(null);
              setNth(b);
              setF(1);
            }}
            onBuild={() => animate(nthBuildMs)}
            onShow={() => {
              setMode("show");
              animate(nthMs);
            }}
          />
        )}

        {mode === "show" && topic === "nth" && (
          <NthShowPanel
            b={nth}
            f={f}
            pick={(b) => {
              setNth(b);
              animate(nthMs);
            }}
          />
        )}

        {mode === "explore" && topic === "cycle" && (
          <>
            <h2 className={styles.progress}>۱. یک دور بساز</h2>
            <div className={styles.chipsRow} role="radiogroup" aria-label="نوع نماد">
              {CYCLE_SETS.map(([k, label]) => (
                <button key={k} role="radio" aria-checked={cyc.set === k} onClick={() => setCyc((b) => ({ ...b, set: k }))}>
                  {label}
                </button>
              ))}
            </div>
            <p className={styles.note}>روی نمادها بزن تا به آخر دور اضافه شوند (۲ تا ۶ خانه).</p>
            <div className={css.cards} role="group" aria-label="نمادها" style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
              {SYMBOLS[cyc.set].map((_, id) => (
                <button key={id} className={css.card} style={{ minHeight: 44 }} disabled={cyc.cycle.length >= 6} onClick={() => setCycle([...cyc.cycle, id])} aria-label={`افزودن ${symbolWord(cyc.set, id)}`}>
                  <SymbolIcon set={cyc.set} id={id} size={28} />
                </button>
              ))}
            </div>
            <div className={styles.row} style={{ marginTop: 6 }}>
              <button className={styles.clear} disabled={cyc.cycle.length <= 2} onClick={() => setCycle(cyc.cycle.slice(0, -1))}>
                ↩ حذف آخری
              </button>
              <button className={styles.clear} onClick={() => setCycle(cyc.cycle.slice(0, 2))} disabled={cyc.cycle.length <= 2}>
                از نو (دو خانه)
              </button>
            </div>
            <p className={css.seqLine}>
              دور: {rowWords(cyc.set, cyc.cycle)} <small>({fa(cyc.cycle.length)} خانه)</small>
            </p>
            <h2 className={styles.progress}>۲. خانه چندم؟</h2>
            <div className={styles.row} style={{ flexWrap: "wrap" }}>
              {[-10, -1, 1, 10].map((d) => (
                <button key={d} className={styles.clear} style={{ flex: "1 1 20%" }} disabled={cyc.n + d < 1 || cyc.n + d > N_MAX} onClick={() => setCyc((b) => ({ ...b, n: b.n + d }))}>
                  <bdi dir="ltr">{d > 0 ? `+${fa(d)}` : `−${fa(-d)}`}</bdi>
                </button>
              ))}
            </div>
            <p className={styles.status + " " + styles.info}>
              {ltrC(`${fa(cyc.n)} = ${fa(cycDiv.cycles)} × ${fa(cyc.cycle.length)} + ${fa(cycDiv.rem)}`)}:{" "}
              {cycDiv.rem
                ? `${fa(cycDiv.cycles)} دور کامل و ${fa(cycDiv.rem)} خانه دیگر؛ خانه ${fa(cyc.n)} همان خانه ${fa(cycDiv.rem)}ام دور است: ${symbolWord(cyc.set, cycItem)}.`
                : `باقیمانده ۰؛ خانه ${fa(cyc.n)} آخرین خانه دور ${fa(cycDiv.cycles)} است: ${symbolWord(cyc.set, cycItem)}.`}
            </p>
            <button
              className={styles.clear}
              onClick={() => {
                setMode("show");
                animate(cycleMs);
              }}
            >
              نشانم بده: دسته کن، تقسیم کن، بشمار
            </button>
          </>
        )}

        {mode === "show" && topic === "cycle" && (
          <>
            <h2>دسته کن، تقسیم کن، بشمار</h2>
            <ol className={styles.rules}>
              <li aria-current={phase === 0 ? "step" : undefined} style={phase === 0 ? CURRENT : undefined}>
                {phase === 0 ? "◀ " : ""}
                <strong>دسته کن:</strong> هر {fa(cyc.cycle.length)} خانه یک دور است و در یک قاب می‌رود ({rowWords(cyc.set, cyc.cycle)}).
              </li>
              <li aria-current={phase === 1 ? "step" : undefined} style={phase === 1 ? CURRENT : undefined}>
                {phase === 1 ? "◀ " : ""}
                <strong>تقسیم کن:</strong> {ltrC(`${fa(cyc.n)} ÷ ${fa(cyc.cycle.length)}`)} می‌شود {fa(cycDiv.cycles)} و باقیمانده {fa(cycDiv.rem)}؛ یعنی {fa(cycDiv.cycles)} دور کامل
                {cycDiv.rem ? ` و ${fa(cycDiv.rem)} خانه از دور بعد` : ""}.
              </li>
              <li aria-current={phase === 2 ? "step" : undefined} style={phase === 2 ? CURRENT : undefined}>
                {phase === 2 ? "◀ " : ""}
                <strong>بشمار:</strong>{" "}
                {cycDiv.rem
                  ? `در دور آخر از خانه اول ${fa(cycDiv.rem)} خانه بشمار: ${symbolWord(cyc.set, cycItem)}.`
                  : `باقیمانده ۰ یعنی خانه ${fa(cyc.n)} آخرین خانه یک دور کامل است، نه اولین خانه دور بعد: ${symbolWord(cyc.set, cycItem)}.`}
              </li>
            </ol>
            <div className={styles.chipsRow} role="radiogroup" aria-label="نمونه" style={{ flexWrap: "wrap" }}>
              {(
                [
                  ["باقیمانده ۱", { set: "shapes", cycle: [0, 1, 2], n: 100 }],
                  ["باقیمانده ۰", { set: "letters", cycle: [0, 1, 2, 3], n: 48 }],
                  ["دور ۵ تایی", { set: "beads", cycle: [0, 1, 1, 2, 3], n: 123 }],
                ] as [string, CycleBuild][]
              ).map(([name, b]) => (
                <button
                  key={name}
                  role="radio"
                  aria-checked={cyc.set === b.set && cyc.n === b.n && cyc.cycle.join() === b.cycle.join()}
                  style={{ flex: "1 0 30%", fontSize: "0.8rem" }}
                  onClick={() => {
                    setCyc(b);
                    animate(cycleMs);
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
            <p className={styles.note}>دور و شماره خانه را در «کشف» عوض کن.</p>
          </>
        )}

        {mode === "explore" && topic === "rule" && (
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
                {showRows ? "✓ " : ""}{rule.kind === "alt" ? "کمان‌های یکی‌درمیان را نشان بده" : "اختلاف‌ها را نشان بده"}
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
              {rule.kind === "alt" ? "نشانم بده دو دنباله درهم چطورند" : "نشانم بده اختلاف‌ها چه می‌گویند"}
            </button>
          </>
        )}

        {mode === "show" && topic === "rule" && (
          <>
            <h2>{rule.kind === "alt" ? "دو دنباله یکی‌درمیان" : "اختلاف‌ها زیر جمله‌ها"}</h2>
            <p className={styles.note}>
              {rule.kind === "alt"
                ? "هر کمان یک واگن را به واگن یکی بعد از بعدی‌اش وصل می‌کند: بالای قطار واگن‌های ●، زیر قطار واگن‌های ▲. روی هر کمان می‌نویسیم آن دنباله چقدر عوض شد."
                : "زیر هر دو واگن کنار هم، می‌نویسیم چقدر عوض شد. اگر اختلاف‌ها ثابت نبودند، زیر خودشان ردیف اختلاف دوم را می‌سازیم."}
            </p>
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

        {mode === "try" && isCycle && (
          <CycleTryPanel
            key={`cycle-${tryLevel}-${seed}`}
            question={cycleQ}
            level={tryLevel}
            checked={checked}
            onCheck={(v) => {
              setChecked(v);
              animate(tryMs);
            }}
            onType={(t) => freshQuestion(t, tryLevel)}
            onLevel={(l) => freshQuestion(tryType, l)}
            onNew={() => freshQuestion()}
          />
        )}

        {mode === "try" && isNth && (
          <NthTryPanel
            key={`nth-${tryLevel}-${seed}`}
            question={nthQ}
            level={tryLevel}
            checked={checked}
            onCheck={(v) => {
              setChecked(v);
              animate(tryMs);
            }}
            onType={(t) => freshQuestion(t, tryLevel)}
            onLevel={(l) => freshQuestion(tryType, l)}
            onNew={() => freshQuestion()}
          />
        )}

        {mode === "try" && !isCycle && !isNth && (
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

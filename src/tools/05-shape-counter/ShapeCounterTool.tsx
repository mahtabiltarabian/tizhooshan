"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  countOf,
  figureOf,
  GROW,
  listShapes,
  makeCountQuestion,
  questionSpec,
  shapeFromTaps,
  shapeId,
  TAPS,
  type CountFigure,
  type CountQuestionType,
  type Family,
  type FigureSpec,
  type Kind,
  type Level,
  type Shape,
  type ShapeQuestionType,
} from "@/generators/shape-count";
import { NAMED, type NamedFigure } from "@/generators/one-stroke";
import { newSeed } from "@/generators/random";
import { setClassroom as applyClassroom, useClassroom } from "@/toolkit/classroom";
import { TeacherGuideButton } from "@/toolkit/TeacherGuide";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/ToolLayout.module.css";
import { COUNT_TYPE_LABEL, CounterTryPanel, groupsOf, groupSum, KIND_NAME, PIECE_WORD } from "./CounterTryPanel";
import { SHAPE_COUNTER_GUIDE } from "./guide";
import type { Look } from "./Pictures";
import { CountScene, GrowingScene } from "./Scene";
import { HiddenLab } from "./HiddenLab";
import { StrokeLab } from "./StrokeLab";
import { TopicPicker, TypeLevelPicker, type Topic } from "./labKit";

type Mode = "explore" | "show" | "try";
type Range = { label: string; min: number; max: number; names?: string[] };

const FAMILIES: Record<Family, { label: string; a: Range; b?: Range; start: [number, number] }> = {
  grid: { label: "شبکه مربعی", a: { label: "ستون", min: 1, max: 5 }, b: { label: "ردیف", min: 1, max: 4 }, start: [3, 2] },
  fan: { label: "مثلث برش‌خورده", a: { label: "بخش", min: 1, max: 6 }, b: { label: "خط افقی", min: 1, max: 3 }, start: [3, 2] },
  triGrid: { label: "مثلث شبکه‌ای", a: { label: "ردیف", min: 1, max: 5 }, start: [3, 0] },
  star: { label: "ستاره", a: { label: "", min: 0, max: 1, names: ["ستاره تنها", "با پنج‌ضلعی دورش"] }, start: [0, 0] },
  envelope: { label: "پاکت نامه", a: { label: "", min: 0, max: 2, names: ["بی خط وسط", "یک خط وسط", "دو خط وسط"] }, start: [0, 0] },
  rays: { label: "پرتوها", a: { label: "پرتو", min: 1, max: 8 }, b: { label: "", min: 0, max: 1, names: ["بی خط راست", "روی خط راست"] }, start: [4, 0] },
  line: { label: "نقطه روی خط", a: { label: "نقطه", min: 3, max: 9 }, start: [5, 0] },
};

const KINDS: Kind[] = ["triangle", "square", "rectangle", "segment", "angle"];

/** Kinds worth counting in a figure. */
const kindsOf = (spec: FigureSpec) => KINDS.filter((k) => countOf(spec, k) > 1);

const clampSpec = (s: FigureSpec): FigureSpec => {
  const u = FAMILIES[s.family];
  // Rays on a straight line need only one; without the line, at least two.
  const aMin = s.family === "rays" && !s.b ? 2 : u.a.min;
  return { ...s, a: Math.min(u.a.max, Math.max(aMin, s.a)), b: u.b ? Math.min(u.b.max, Math.max(u.b.min, s.b)) : 0 };
};

type Msg = { tone: "good" | "info" | "warn"; text: string };

/** Taps on the figure's points mark shapes; each new one keeps a number. */
function useMarking(fig: CountFigure, kind: Kind) {
  const [taps, setTaps] = useState<number[]>([]);
  const [found, setFound] = useState<Shape[]>([]);
  const [msg, setMsg] = useState<Msg | null>(null);
  const reset = useCallback(() => {
    setTaps([]);
    setFound([]);
    setMsg(null);
  }, []);
  const tap = (i: number) => {
    if (kind === "angle" && i === fig.origin) return setMsg({ tone: "info", text: "رأس O خودش حساب است؛ روی سر دو پرتو بزن." });
    if (taps.includes(i)) return setTaps(taps.filter((t) => t !== i));
    const next = [...taps, i];
    if (next.length < TAPS[kind]) return setTaps(next);
    setTaps([]);
    const s = shapeFromTaps(fig, kind, next);
    const name = KIND_NAME[kind];
    if (!s) return setMsg({ tone: "warn", text: `این نقطه‌ها یک ${name} نمی‌سازند. ${kind === "triangle" ? "هر دو نقطه باید با یک خط کشیده‌شده به هم وصل باشند." : kind === "segment" ? "دو سر پاره‌خط باید روی یک خط باشند." : kind === "angle" ? "" : "چهار گوشه باید با خط‌های شکل به هم وصل باشند."}` });
    const k = found.findIndex((f) => shapeId(f) === shapeId(s));
    if (k >= 0) return setMsg({ tone: "info", text: `این ${name} را قبلاً پیدا کردی (شماره ${fa(k + 1)}).` });
    setFound([...found, s]);
    setMsg({ tone: "good", text: `✓ ${name} شماره ${fa(found.length + 1)} پیدا شد؛ از ${fa(s.pieces)} ${PIECE_WORD[kind]} ساخته شده.` });
  };
  return { taps, found, msg, tap, reset, undo: () => setFound(found.slice(0, -1)) };
}

export function ShapeCounterTool() {
  const [mode, setMode] = useState<Mode>("explore");
  const [classroom, setClassroom] = useClassroom();

  // Playback 0 … 1 over the shapes, one at a time.
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
  const animate = useCallback((count: number, from = 0) => {
    setF(from);
    setRun({ from, ms: Math.min(40_000, Math.max(1500, count * 650)) * (1 - from) });
  }, []);

  // Explore and show me share the figure.
  const [spec, setSpec] = useState<FigureSpec>({ family: "grid", a: 3, b: 2 });
  const [kind, setKind] = useState<Kind>("rectangle");
  const fig = useMemo(() => figureOf(spec), [spec]);
  const kinds = kindsOf(spec);
  const shapes = useMemo(() => listShapes(fig, kind), [fig, kind]);
  const mark = useMarking(fig, kind);
  const [revealed, setRevealed] = useState(false);
  const [selectedFound, setSelectedFound] = useState<number | null>(null);

  const { reset } = mark;
  const changeFigure = (s: FigureSpec, k = kind) => {
    const next = clampSpec(s);
    setSpec(next);
    const ks = kindsOf(next);
    setKind(ks.includes(k) ? k : ks[0]);
    reset();
    setRevealed(false);
    setSelectedFound(null);
  };

  // The hidden-figure and one-stroke parts (explore and show me).
  const [topic, setTopic] = useState<Topic>("count");
  const [strokeFig, setStrokeFig] = useState<NamedFigure | number>("house");
  const [hiddenEx, setHiddenEx] = useState<{ level: Level; seed: number }>({ level: 1, seed: 705 });

  // Try it
  const [tryType, setTryType] = useState<ShapeQuestionType>("triangle");
  const [tryLevel, setTryLevel] = useState<Level>(1);
  const [seed, setSeed] = useState(705);
  const [initialAnswer, setInitialAnswer] = useState<number | undefined>(undefined);
  const [answered, setAnswered] = useState(false);
  const labTry = tryType === "hidden" || tryType === "stroke";
  // Counting questions only; a hidden-figure or one-stroke question is made by its own panel.
  const countType: CountQuestionType = tryType === "hidden" || tryType === "stroke" ? "triangle" : tryType;
  const question = useMemo(() => makeCountQuestion(countType, tryLevel, seed), [countType, tryLevel, seed]);
  const qFig = useMemo(() => figureOf(questionSpec(question)), [question]);
  const qShapes = useMemo(() => listShapes(qFig, question.kind), [qFig, question.kind]);
  const tryMark = useMarking(qFig, question.kind);

  // Shareable links: #try=triangle&level=2&seed=7(&n=12), #show=grid-3-2-rectangle, #f=0.5, #classroom.
  // Hidden figure and one stroke: #try=hidden|stroke&level&seed(&n = answer or option 1–4),
  // #show=hidden-2-17 (level-seed), #show=stroke-house or #show=stroke-1234 (a random figure's seed).
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.has("classroom")) applyClassroom(true);
    const tryParam = params.get("try");
    const show = params.get("show");
    const timer = setTimeout(() => {
      if (tryParam) {
        setMode("try");
        if (tryParam in COUNT_TYPE_LABEL) setTryType(tryParam as CountQuestionType);
        const lv = Number(params.get("level"));
        if (lv === 1 || lv === 2 || lv === 3) setTryLevel(lv);
        const sd = Number(params.get("seed"));
        if (Number.isInteger(sd) && sd >= 0) setSeed(sd);
        const n = Number(params.get("n"));
        if (params.has("n") && Number.isInteger(n) && n >= 0) {
          setInitialAnswer(n);
          setAnswered(true);
          setF(1);
        } else setF(0);
      } else if (show?.startsWith("stroke-") || show?.startsWith("hidden-")) {
        const [t, a, b] = show.split("-");
        if (t === "stroke") {
          if (a in NAMED) setStrokeFig(a as NamedFigure);
          else if (Number.isInteger(Number(a)) && Number(a) >= 0) setStrokeFig(Number(a));
        } else {
          const lv = Number(a);
          const sd = Number(b);
          setHiddenEx({ level: lv === 2 || lv === 3 ? lv : 1, seed: Number.isInteger(sd) && sd >= 0 ? sd : 705 });
        }
        setTopic(t as Topic);
        setMode("show");
      } else if (show) {
        const [fam, a, b, k] = show.split("-");
        if (fam in FAMILIES) {
          const s = clampSpec({ family: fam as Family, a: Number(a) || 0, b: Number(b) || 0 });
          setSpec(s);
          const ks = kindsOf(s);
          setKind(ks.includes(k as Kind) ? (k as Kind) : ks[0]);
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
    // Into try it from a hidden-figure or one-stroke page: start on that type.
    if (m === "try" && topic !== "count" && tryType !== topic) {
      setTryType(topic);
      setInitialAnswer(undefined);
      setAnswered(false);
    }
    setRun(null);
    setF(m === "try" ? 0 : 1);
  };

  const freshQuestion = (type: ShapeQuestionType = tryType, level = tryLevel) => {
    setTryType(type);
    setTryLevel(level);
    setSeed(newSeed());
    setInitialAnswer(undefined);
    setAnswered(false);
    tryMark.reset();
    setRun(null);
    setF(0);
  };

  const playing = mode === "show" ? shapes : qShapes;
  const current = Math.min(playing.length - 1, Math.floor(f * playing.length));
  const play = () => {
    if (run) return setRun(null);
    animate(playing.length, f >= 0.99 ? 0 : f);
  };

  let board: React.ReactNode;
  if (mode === "explore") {
    const last = mark.found.length - 1;
    board = (
      <CountScene
        fig={fig}
        origin={kind === "angle"}
        shapes={mark.found.map((s, i) => ({ shape: s, look: (i === (selectedFound ?? last) ? "current" : "found") as Look, label: i + 1 }))}
        selected={mark.taps}
        onPoint={mark.tap}
        label="شکل مرکب؛ روی نقطه‌ها بزن"
      />
    );
  } else if (mode === "show") board = <CountScene fig={fig} origin={kind === "angle"} shapes={shapes.length ? [{ shape: shapes[current], look: "current", label: current + 1 }] : []} />;
  else {
    const marked = new Set(tryMark.found.map(shapeId));
    const playMarks = answered && qShapes.length
      ? [
          ...tryMark.found.filter((s) => shapeId(s) !== shapeId(qShapes[current])).map((s) => ({ shape: s, look: "found" as Look })),
          { shape: qShapes[current], look: (tryMark.found.length && !marked.has(shapeId(qShapes[current])) ? "missed" : "current") as Look, label: current + 1 },
        ]
      : tryMark.found.map((s, i) => ({ shape: s, look: "found" as Look, label: i + 1 }));
    board =
      question.type === "growing" ? (
        <GrowingScene
          stage={GROW[question.pattern].stage}
          kind={question.kind}
          counts={question.counts}
          ask={question.ask}
          answered={answered}
          answer={question.answer}
          shapes={answered && qShapes.length ? [{ shape: qShapes[current], look: "current", label: current + 1 }] : undefined}
          kindName={KIND_NAME[question.kind]}
        />
      ) : (
        <CountScene fig={qFig} origin={question.kind === "angle"} shapes={playMarks} selected={answered ? [] : tryMark.taps} onPoint={answered ? undefined : tryMark.tap} />
      );
  }

  const ui = FAMILIES[spec.family];
  const stepper = (key: "a" | "b", r: Range) => {
    const v = spec[key];
    const min = key === "a" && spec.family === "rays" && !spec.b ? 2 : r.min;
    return (
      <Stepper
        key={key}
        label={r.names ? r.names[v] : `${fa(v)} ${r.label}`}
        onLess={() => changeFigure({ ...spec, [key]: v - 1 })}
        onMore={() => changeFigure({ ...spec, [key]: v + 1 })}
        lessOff={v <= min}
        moreOff={v >= r.max}
      />
    );
  };

  const topicPicker = (
    <TopicPicker
      topic={topic}
      onTopic={(t) => {
        setTopic(t);
        if (mode === "show" && t === "count") animate(shapes.length);
      }}
    />
  );
  const picker = <TypeLevelPicker labels={COUNT_TYPE_LABEL} type={tryType} level={tryLevel} onType={(t) => freshQuestion(t, tryLevel)} onLevel={(l) => freshQuestion(tryType, l)} />;
  const labTopic: Topic | null = mode === "try" ? (labTry ? (tryType as Topic) : null) : topic === "count" ? null : topic;
  const labKey = mode === "try" ? `try-${tryLevel}-${seed}` : `ex-${mode}`;
  let lab: React.ReactNode = null;
  if (labTopic === "stroke")
    lab = <StrokeLab key={labKey} mode={mode} topicPicker={topicPicker} figure={strokeFig} onFigure={setStrokeFig} level={tryLevel} seed={seed} picker={picker} initialN={initialAnswer} onNew={() => freshQuestion()} />;
  else if (labTopic === "hidden")
    lab = <HiddenLab key={labKey} mode={mode} topicPicker={topicPicker} ex={hiddenEx} onEx={setHiddenEx} level={tryLevel} seed={seed} picker={picker} initialN={initialAnswer} onNew={() => freshQuestion()} />;

  const groups = groupsOf(shapes);
  const shownGroups = groupsOf(shapes.slice(0, current + 1));
  const showShape = shapes[current];

  return (
    <main className={styles.layout}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          → همه ابزارها
        </Link>
        <h1>
          <span className={styles.badge}>{fa(5)}</span> شمارشگر شکل
        </h1>
        <div className={styles.tabs} role="tablist" aria-label="حالت ابزار">
          <button role="tab" aria-selected={mode === "explore"} onClick={() => switchMode("explore")}>
            کشف: خودت پیدا کن
          </button>
          <button
            role="tab"
            aria-selected={mode === "show"}
            onClick={() => {
              switchMode("show");
              animate(shapes.length);
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
          <TeacherGuideButton guide={SHAPE_COUNTER_GUIDE} />
          <Link href={`/tools/shape-counter/worksheet?types=${tryType}&level=${tryLevel}`}>کاربرگ</Link>
        </div>
      </header>

      {lab}
      {!lab && (
      <>
      <section className={styles.stageWrap} aria-label="صفحه شکل">
        {board}
      </section>

      <section className={styles.controls}>
        {mode === "explore" || (mode === "try" && !answered) ? (
          <p className={styles.stepText} style={{ margin: 0 }}>
            {mode === "explore" ? `${fa(mark.found.length)} ${KIND_NAME[kind]} پیدا کردی` : "اول بشمار، بعد عدد را بنویس"}
          </p>
        ) : (
          <label className={styles.slider}>
            <button className={styles.playSmall} onClick={play} aria-label={run ? "توقف" : "پخش"}>
              {run ? "⏸" : "▶"}
            </button>
            <span>
              {KIND_NAME[mode === "show" ? kind : question.kind]} {fa(current + 1)} از {fa(playing.length)}
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
              aria-label="شکل‌ها یکی‌یکی"
            />
          </label>
        )}
      </section>

      <aside className={styles.side}>
        {mode === "explore" && (
          <>
            {topicPicker}
            <h2>۱. شکل را انتخاب کن</h2>
            <div className={styles.choiceGrid} role="radiogroup" aria-label="شکل">
              {(Object.keys(FAMILIES) as Family[]).map((fam) => (
                <button key={fam} role="radio" aria-checked={spec.family === fam} onClick={() => changeFigure({ family: fam, a: FAMILIES[fam].start[0], b: FAMILIES[fam].start[1] })}>
                  {FAMILIES[fam].label}
                </button>
              ))}
            </div>
            {stepper("a", ui.a)}
            {ui.b && stepper("b", ui.b)}

            <h2 className={styles.progress}>۲. چه چیزی را بشماری؟</h2>
            <div className={styles.chipsRow} role="radiogroup" aria-label="چه چیزی">
              {kinds.map((k) => (
                <button key={k} role="radio" aria-checked={kind === k} onClick={() => changeFigure(spec, k)}>
                  {KIND_NAME[k]}
                </button>
              ))}
            </div>

            <h2 className={styles.progress}>۳. پیدا کن</h2>
            <p className={styles.note}>
              {kind === "angle"
                ? "روی سر دو پرتو بزن تا زاویه بین آن‌ها با رأس O علامت بخورد."
                : `روی ${fa(TAPS[kind])} نقطه بزن (${kind === "segment" ? "دو سر" : "گوشه‌ها"}) تا یک ${KIND_NAME[kind]} علامت بخورد. هر ${KIND_NAME[kind]} تازه هاشور و شماره می‌گیرد.`}
            </p>
            {mark.msg && <p className={`${styles.status} ${styles[mark.msg.tone]}`}>{mark.msg.text}</p>}
            {mark.found.length > 0 && (
              <div className={styles.chipsRow} style={{ flexWrap: "wrap" }} aria-label="پیدا شده‌ها">
                {mark.found.map((s, i) => (
                  <button key={shapeId(s)} role="radio" aria-checked={(selectedFound ?? mark.found.length - 1) === i} onClick={() => setSelectedFound(i)} style={{ flex: "0 0 auto", minWidth: 40 }}>
                    {fa(i + 1)}
                  </button>
                ))}
              </div>
            )}
            <div className={styles.row}>
              <button className={styles.clear} onClick={() => { mark.undo(); setSelectedFound(null); }} disabled={!mark.found.length}>
                واگرد
              </button>
              <button className={styles.clear} onClick={() => { reset(); setSelectedFound(null); }} disabled={!mark.found.length}>
                پاک کن
              </button>
            </div>
            <button className={styles.clear} style={{ marginTop: 8 }} onClick={() => setRevealed(true)}>
              چندتا هست؟
            </button>
            {revealed && (
              <>
                <p className={`${styles.status} ${mark.found.length === shapes.length ? styles.good : styles.info}`}>
                  همه: {fa(shapes.length)} {KIND_NAME[kind]}. {mark.found.length === shapes.length ? "همه را پیدا کردی!" : `${fa(shapes.length - mark.found.length)} تا مانده.`}
                </p>
                <button
                  className={styles.clear}
                  onClick={() => {
                    setMode("show");
                    animate(shapes.length);
                  }}
                >
                  نشانم بده، یکی‌یکی
                </button>
              </>
            )}
          </>
        )}

        {mode === "show" && (
          <>
            {topicPicker}
            <h2>شمارش نظام‌مند</h2>
            <div className={styles.chipsRow} role="radiogroup" aria-label="چه چیزی">
              {kinds.map((k) => (
                <button
                  key={k}
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => {
                    changeFigure(spec, k);
                    animate(listShapes(fig, k).length);
                  }}
                >
                  {KIND_NAME[k]}
                </button>
              ))}
            </div>
            <p className={styles.note}>
              {FAMILIES[spec.family].label}. اول {KIND_NAME[kind]}‌های کوچک (یک {PIECE_WORD[kind]})، بعد آن‌هایی که از ۲ {PIECE_WORD[kind]} ساخته شده‌اند، و همین‌طور تا بزرگ‌ترین. این‌طوری هیچ‌کدام جا نمی‌افتد و هیچ‌کدام دو بار شمرده نمی‌شود.
            </p>
            <table className={styles.countTable}>
              <thead>
                <tr>
                  <th>ساخته‌شده از</th>
                  <th>تعداد</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  const seen = shownGroups.find((s) => s.pieces === g.pieces)?.count ?? 0;
                  const now = showShape?.pieces === g.pieces;
                  return (
                    <tr key={g.pieces} aria-current={now ? "step" : undefined}>
                      <td>
                        {now ? "◀ " : ""}
                        {fa(g.pieces)} {PIECE_WORD[kind]}
                      </td>
                      <td>{seen ? `${fa(seen)}${seen < g.count ? " …" : ""}` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
              {current === shapes.length - 1 && (
                <tfoot>
                  <tr>
                    <td>جمع</td>
                    <td>{groupSum(groups)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
            {showShape && (
              <p className={styles.stepText}>
                {KIND_NAME[kind]} {fa(current + 1)}: از {fa(showShape.pieces)} {PIECE_WORD[kind]}
              </p>
            )}
          </>
        )}

        {mode === "try" && (
          <CounterTryPanel
            key={`${tryType}-${tryLevel}-${seed}`}
            question={question}
            type={tryType}
            level={tryLevel}
            shapes={qShapes}
            marked={tryMark.found}
            initialAnswer={initialAnswer}
            onType={(ty) => freshQuestion(ty, tryLevel)}
            onLevel={(l) => freshQuestion(tryType, l)}
            onNew={() => freshQuestion()}
            onAnswered={() => {
              setAnswered(true);
              animate(qShapes.length);
            }}
          />
        )}
      </aside>
      </>
      )}
    </main>
  );
}

function Stepper({ label, onLess, onMore, lessOff, moreOff }: { label: string; onLess: () => void; onMore: () => void; lessOff: boolean; moreOff: boolean }) {
  return (
    <div className={styles.row} style={{ marginTop: 8 }}>
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

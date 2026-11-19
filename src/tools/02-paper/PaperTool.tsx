"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addCutPoint,
  cornerCut,
  creaseSpots,
  creases,
  cutAway,
  makePaperQuestion,
  onBoundary,
  pointInPoly,
  punchableCells,
  reflect,
  shapes,
  snapToShape,
  symmetryLines,
  unfoldPoints,
  unfoldPolys,
  type CutStep,
  type Fold,
  type FreeCut,
  type Level,
  type PaperQuestionType,
  type Pt,
} from "@/generators/paper-folding";
import { newSeed } from "@/generators/random";
import { Stage, type Look } from "@/engine-3d/Stage";
import { setClassroom as applyClassroom, useClassroom } from "@/toolkit/classroom";
import { TeacherGuideButton } from "@/toolkit/TeacherGuide";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/ToolLayout.module.css";
import { PAPER_GUIDE } from "./guide";
import { PaperScene } from "./PaperScene";
import { PaperSvg } from "./Pictures";
import { PAPER_TYPE_LABEL, PaperTryPanel, startsFolded, type PaperDisplay } from "./PaperTryPanel";

type Mode = "explore" | "show" | "try";
type Tool = "punch" | "corner" | "free";

const CAMERA: [number, number, number] = [0, 6.2, 5.4];
const TARGET: [number, number, number] = [0, 0, 0];
const MAX_FOLDS = 3;

/** Which side goes over which, in words. */
function foldName(f: Fold): string {
  const up = f.moving === 1;
  switch (f.line.kind) {
    case "v":
      return up ? "راست روی چپ" : "چپ روی راست";
    case "h":
      return up ? "بالا روی پایین" : "پایین روی بالا";
    case "d":
      return up ? "بالا‌چپ روی پایین‌راست" : "پایین‌راست روی بالا‌چپ";
    case "a":
      return up ? "بالا‌راست روی پایین‌چپ" : "پایین‌چپ روی بالا‌راست";
  }
}

const samePt = (a: Pt, b: Pt) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;

/** Why a free-cut corner was refused, in words. */
const CUT_REFUSED: Record<Extract<CutStep, { kind: "bad" }>["why"], string> = {
  same: "",
  edge: "برش روی لبه کاغذ چیزی نمی‌بُرد؛ از روی کاغذ رد شو.",
  crossing: "برش نباید از روی خودش رد شود یا روی خودش برگردد.",
  insideToEdge: "این برش از وسط کاغذ شروع شده؛ باید به همان نقطه شروع (حلقه خط‌چین) برگردد.",
  outside: "بیرون کاغذ نمی‌شود برید.",
};

/** Sample for "show me" when nothing was punched in explore. */
const SAMPLE = (() => {
  const q = makePaperQuestion("holes", 2, 2207);
  return { S: q.S, folds: q.folds, punches: q.type === "holes" ? q.punches : [], cutVerts: [] as number[], freeCuts: [] as FreeCut[] };
})();

export function PaperTool() {
  const [mode, setMode] = useState<Mode>("explore");
  const [classroom, setClassroom] = useClassroom();
  const [look, setLook] = useState<Look | null>(null);
  const [lookNonce, setLookNonce] = useState(0);
  const flyTo = (l: Look) => {
    setLook(l);
    setLookNonce((n) => n + 1);
  };

  // How far the paper is folded: 0 open … 1 every fold made. Animated between two values.
  const [f, setF] = useState(0);
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

  // Explore
  const [S, setS] = useState<4 | 8>(4);
  const [folds, setFolds] = useState<Fold[]>([]);
  const [punches, setPunches] = useState<Pt[]>([]);
  const [cutVerts, setCutVerts] = useState<number[]>([]);
  const [tool, setTool] = useState<Tool>("punch");
  const [reveal, setReveal] = useState(false);
  // Free cuts: finished ones, the one being drawn, the segment under the finger, and a note.
  const [freeCuts, setFreeCuts] = useState<FreeCut[]>([]);
  const [draft, setDraft] = useState<Pt[]>([]);
  const [drag, setDrag] = useState<[Pt, Pt] | null>(null);
  const [cutNote, setCutNote] = useState("");

  const animate = useCallback((from: number, to: number, k: number) => {
    setF(from);
    setRun({ from, to, ms: 250 + 1300 * Math.abs(to - from) * Math.max(1, k) });
  }, []);

  // Try it
  const [tryType, setTryType] = useState<PaperQuestionType>("holes");
  const [tryLevel, setTryLevel] = useState<Level>(1);
  const [seed, setSeed] = useState(2207);
  const [initialPick, setInitialPick] = useState<number | undefined>(undefined);
  const question = useMemo(() => makePaperQuestion(tryType, tryLevel, seed), [tryType, tryLevel, seed]);
  const [display, setDisplay] = useState<PaperDisplay | null>(null);

  // Show me: one fold opened per step.
  const [step, setStep] = useState(0);

  // Shareable links: #try=holes&level=2&seed=7(&pick=n), #show(&step=n), #explore=v,h&punch=2.5_0.5, #f=0.5, #classroom
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.has("classroom")) applyClassroom(true);
    const tryParam = params.get("try");
    const timer = setTimeout(() => {
      if (tryParam) {
        setMode("try");
        const ty = tryParam in PAPER_TYPE_LABEL ? (tryParam as PaperQuestionType) : "holes";
        setTryType(ty);
        const lv = Number(params.get("level"));
        if (lv === 1 || lv === 2 || lv === 3) setTryLevel(lv);
        const sd = Number(params.get("seed"));
        if (Number.isInteger(sd) && sd >= 0) setSeed(sd);
        setF(startsFolded(ty) ? 1 : 0);
        const pk = Number(params.get("pick"));
        if (params.has("pick") && pk >= 1 && pk <= 4) {
          setInitialPick(pk - 1);
          setF(startsFolded(ty) ? 0 : 1);
        }
      } else if (params.has("show")) {
        setMode("show");
        const st = Number(params.get("step"));
        if (Number.isInteger(st) && st >= 0) setStep(st);
      }
      const ff = Number(params.get("f"));
      if (params.has("f") && Number.isFinite(ff)) setF(Math.min(1, Math.max(0, ff)));
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Explore: the paper as folded so far.
  const before = shapes(S, folds);
  const final = before[before.length - 1];
  const leg = S === 8 ? 1.5 : 1;
  const cuts = [...cutVerts.map((v) => cornerCut(final, v, leg)), ...freeCuts.map(cutAway)];
  const marked = punches.length > 0 || cutVerts.length > 0 || freeCuts.length > 0 || draft.length > 0;
  const options = folds.length < MAX_FOLDS && !marked ? symmetryLines(final) : [];

  const addFold = (fold: Fold) => {
    const next = [...folds, fold];
    setFolds(next);
    setReveal(false);
    animate((next.length - 1) / next.length, 1, 1);
  };
  const undo = () => {
    setCutNote("");
    if (draft.length) return setDraft(draft.slice(0, -1));
    if (cutVerts.length || punches.length || freeCuts.length) {
      // Take back the newest mark of the tool in hand first.
      if (tool === "free" && freeCuts.length) setFreeCuts(freeCuts.slice(0, -1));
      else if (tool === "corner" && cutVerts.length) setCutVerts(cutVerts.slice(0, -1));
      else if (punches.length) setPunches(punches.slice(0, -1));
      else if (cutVerts.length) setCutVerts(cutVerts.slice(0, -1));
      else setFreeCuts(freeCuts.slice(0, -1));
      return;
    }
    if (!folds.length) return;
    setFolds(folds.slice(0, -1));
    setRun(null);
    setF(1);
  };
  const reset = () => {
    setFolds([]);
    setPunches([]);
    setCutVerts([]);
    setFreeCuts([]);
    setDraft([]);
    setDrag(null);
    setCutNote("");
    setReveal(false);
    setRun(null);
    setF(0);
  };
  const tapCell = (i: number, j: number) => {
    const p: Pt = [i + 0.5, j + 0.5];
    if (punches.some((q) => q[0] === p[0] && q[1] === p[1])) return setPunches(punches.filter((q) => q[0] !== p[0] || q[1] !== p[1]));
    if (punchableCells(S, folds).some((q) => q[0] === p[0] && q[1] === p[1])) setPunches([...punches, p]);
  };
  const tapSpot = (p: Pt) =>
    setPunches(punches.some((q) => q[0] === p[0] && q[1] === p[1]) ? punches.filter((q) => q[0] !== p[0] || q[1] !== p[1]) : [...punches, p]);
  const tapVertex = (v: number) => setCutVerts(cutVerts.includes(v) ? cutVerts.filter((x) => x !== v) : [...cutVerts, v]);

  // Free cut: press and drag a straight segment (or tap corner after corner);
  // every corner snaps to the half-grid on the folded paper.
  const snap = (p: Pt) => snapToShape(p, final, S);
  const cutPad = {
    down: (p: Pt) => {
      const q = snap(p);
      setDrag([draft.length ? draft[draft.length - 1] : q, q]);
    },
    move: (p: Pt) => setDrag((d) => (d ? [d[0], snap(p)] : d)),
    up: (p: Pt) => {
      const to = snap(p);
      // Where the press began (a very quick tap may come before the drag state is drawn).
      const from = drag?.[0] ?? draft.at(-1) ?? to;
      setDrag(null);
      let path = draft;
      if (!path.length) {
        path = [from];
        if (samePt(to, from)) {
          setDraft(path);
          setCutNote(onBoundary(to, final) ? "حالا تا لبه دیگر کاغذ ببر." : "از وسط کاغذ شروع کردی؛ برش را به همین نقطه برگردان تا تکه‌ای جدا شود.");
          return;
        }
      }
      const step = addCutPoint(final, path, to);
      if (step.kind === "add" || step.kind === "start") {
        setDraft(step.path);
        setCutNote(onBoundary(step.path[0], final) ? "ادامه بده تا به لبه کاغذ برسی." : "ادامه بده تا به نقطه شروع (حلقه خط‌چین) برگردی.");
      } else if (step.kind === "done") {
        setDraft([]);
        setFreeCuts([...freeCuts, step.cut]);
        setReveal(false);
        setCutNote("تکه بریده شد و از همه لایه‌ها افتاد. حدس بزن باز که کنی چه می‌بینی.");
      } else {
        setDraft(path);
        if (CUT_REFUSED[step.why]) setCutNote(CUT_REFUSED[step.why]);
      }
    },
    cancel: () => setDrag(null),
  };
  // The 3D paper: kept the same while a cut is being drawn, so the panels are not rebuilt on every pointer move.
  const sceneHoles = useMemo(() => unfoldPoints(punches, folds), [punches, folds]);
  const sceneRemoved = useMemo(() => {
    const shape = shapes(S, folds).at(-1)!;
    return unfoldPolys([...cutVerts.map((v) => cornerCut(shape, v, S === 8 ? 1.5 : 1)), ...freeCuts.map(cutAway)], folds);
  }, [S, folds, cutVerts, freeCuts]);
  const lastCut = freeCuts.at(-1);
  const swapLast = () => lastCut && setFreeCuts([...freeCuts.slice(0, -1), { ...lastCut, pick: 1 - lastCut.pick }]);
  // Where a cut can bend: the half-grid points on the folded paper.
  const bendDots: Pt[] = [];
  if (tool === "free") for (let v = 0; v <= 2 * S; v++) for (let u = 0; u <= 2 * S; u++) if (pointInPoly([u / 2, v / 2], final)) bendDots.push([u / 2, v / 2]);
  const pickTool = (t: Tool) => {
    setTool(t);
    setDraft([]);
    setDrag(null);
    setCutNote("");
  };

  // Show me: the explore paper if it has a hole or a cut, otherwise the sample.
  const ex = punches.length || cutVerts.length || freeCuts.length ? { S, folds, punches, cutVerts, freeCuts } : SAMPLE;
  const exBefore = shapes(ex.S, ex.folds);
  const exFinal = exBefore[exBefore.length - 1];
  const exCuts = [...ex.cutVerts.map((v) => cornerCut(exFinal, v, ex.S === 8 ? 1.5 : 1)), ...ex.freeCuts.map(cutAway)];
  const K = ex.folds.length;
  const s = Math.min(step, K);
  const showStep = (n: number) => {
    const target = Math.max(0, Math.min(K, n));
    setStep(target);
    if (K) animate(fRef.current, (K - target) / K, 1);
  };
  const open = ex.folds.slice(K - s); // the folds undone so far
  const shownHoles = unfoldPoints(ex.punches, open);
  const lastHoles = s ? unfoldPoints(ex.punches, ex.folds.slice(K - s + 1)) : [];
  const links: [Pt, Pt][] = s ? lastHoles.map((p) => [p, reflect(p, ex.folds[K - s].line)]) : [];
  // Holes on the fold just opened: they stay one hole each.
  const onFold = s ? lastHoles.filter((p) => samePt(p, reflect(p, ex.folds[K - s].line))).length : 0;
  const counts = Array.from({ length: s + 1 }, (_, i) => unfoldPoints(ex.punches, ex.folds.slice(K - i)).length);

  const switchMode = (m: Mode) => {
    setMode(m);
    setRun(null);
    if (m === "explore") setF(folds.length ? 1 : 0);
    if (m === "show") {
      setStep(0);
      setF(1);
    }
    if (m === "try") setF(startsFolded(tryType) ? 1 : 0);
    flyTo("corner");
  };

  const freshQuestion = (type = tryType, level = tryLevel) => {
    setTryType(type);
    setTryLevel(level);
    setSeed(newSeed());
    setInitialPick(undefined);
    setDisplay(null);
    setRun(null);
    setF(startsFolded(type) ? 1 : 0);
    flyTo("corner");
  };

  const onAnswered = useCallback(() => {
    const k = question.folds.length;
    if (startsFolded(question.type)) animate(1, 0, k);
    else animate(0, 1, k);
  }, [question, animate]);

  const play = () => {
    if (run) return setRun(null);
    const k = mode === "try" ? question.folds.length : mode === "show" ? K : folds.length;
    animate(f, f >= 0.5 ? 0 : 1, k);
  };

  // What the 3D stage shows.
  let scene: React.ReactNode = null;
  if (mode === "explore") scene = <PaperScene S={S} folds={folds} f={f} holes={sceneHoles} removed={sceneRemoved} />;
  else if (mode === "show") scene = <PaperScene S={ex.S} folds={ex.folds} f={f} holes={unfoldPoints(ex.punches, ex.folds)} removed={unfoldPolys(exCuts, ex.folds)} />;
  else if (display) scene = <PaperScene S={display.S} folds={display.folds} f={f} holes={display.holes} removed={display.removed} cutLines={display.cutLines} />;

  return (
    <main className={styles.layout}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          → همه ابزارها
        </Link>
        <h1>
          <span className={styles.badge}>{fa(2)}</span> کاغذ: تا کن، سوراخ کن، باز کن
        </h1>
        <div className={styles.tabs} role="tablist" aria-label="حالت ابزار">
          <button role="tab" aria-selected={mode === "explore"} onClick={() => switchMode("explore")}>
            کشف: خودت تا کن
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
          <TeacherGuideButton guide={PAPER_GUIDE} />
          <Link href={`/tools/paper/worksheet?types=${tryType}&level=${tryLevel}`}>کاربرگ</Link>
        </div>
      </header>

      <section className={styles.stageWrap} aria-label="صحنه سه‌بعدی">
        <Stage imageName="paper" camera={CAMERA} target={TARGET} look={look} lookNonce={lookNonce}>
          {scene}
        </Stage>
      </section>

      <section className={styles.controls}>
        <div className={styles.viewButtons} role="group" aria-label="بردن دوربین به یک نما">
          <button onClick={() => flyTo("top")}>از بالا</button>
          <button onClick={() => flyTo("corner")}>کج</button>
        </div>
        <label className={styles.slider}>
          <button className={styles.playSmall} onClick={play} aria-label={run ? "توقف" : "پخش"}>
            {run ? "⏸" : "▶"}
          </button>
          <span>باز ↔ تا</span>
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
            aria-label="میزان تا شدن"
          />
        </label>
      </section>

      <aside className={styles.side}>
        {mode === "explore" && (
          <>
            <div className={styles.titleRow}>
              <h2>کاغذ</h2>
              <div className={styles.chipsRow} role="radiogroup" aria-label="اندازه کاغذ">
                {([4, 8] as const).map((n) => (
                  <button
                    key={n}
                    role="radio"
                    aria-checked={S === n}
                    onClick={() => {
                      setS(n);
                      reset();
                    }}
                  >
                    {fa(n)}×{fa(n)}
                  </button>
                ))}
              </div>
            </div>

            <h2 className={styles.progress}>
              ۱. تا کن {folds.length > 0 && `(${fa(folds.length)} تا)`}
            </h2>
            {options.length > 0 ? (
              <div className={styles.foldGrid}>
                {options.flatMap((line) =>
                  ([1, -1] as const).map((moving) => {
                    const fold = { line, moving };
                    return (
                      <button key={`${line.kind}${line.c}${moving}`} onClick={() => addFold(fold)} aria-label={foldName(fold)}>
                        <PaperSvg S={S} size={64} shape={final} fold={fold} outline={folds.length > 0} grid={false} />
                        <span>{foldName(fold)}</span>
                      </button>
                    );
                  }),
                )}
              </div>
            ) : (
              <p className={styles.note}>
                {folds.length >= MAX_FOLDS ? `حداکثر ${fa(MAX_FOLDS)} تا.` : marked ? "بعد از سوراخ کردن دیگر تا نمی‌کنیم؛ برای تای بیشتر، «برگرد» را بزن." : "این شکل دیگر خط تقارنی روی شبکه ندارد."}
              </p>
            )}

            <div className={styles.titleRow}>
              <h2 className={styles.progress}>۲. سوراخ یا برش</h2>
              <div className={styles.chipsRow} role="radiogroup" aria-label="ابزار">
                <button role="radio" aria-checked={tool === "punch"} onClick={() => pickTool("punch")}>
                  ● سوراخ
                </button>
                <button role="radio" aria-checked={tool === "corner"} onClick={() => pickTool("corner")}>
                  ✂ گوشه
                </button>
                <button role="radio" aria-checked={tool === "free"} onClick={() => pickTool("free")}>
                  ✂ برش آزاد
                </button>
              </div>
            </div>
            <p className={styles.note}>
              {tool === "punch"
                ? folds.length
                  ? "روی یک خانه کاغذ تاشده بزن تا سوراخ شود. روی لبه تا هم می‌شود سوراخ زد: دایره‌های خط‌چین."
                  : "روی یک خانه کاغذ بزن تا سوراخ شود."
                : tool === "corner"
                  ? "روی یک گوشه کاغذ تاشده بزن تا بریده شود."
                  : "روی کاغذ تاشده خط برش بکش: انگشت را بگذار و بکش؛ رها کن و از همان‌جا ادامه بده (یا نقطه به نقطه بزن). از لبه شروع کن و به لبه برس، یا از وسط شروع کن و به همان نقطه برگرد."}
            </p>
            <PaperSvg
              S={S}
              size={tool === "free" ? 260 : 220}
              shape={final}
              outline={folds.length > 0}
              holes={punches}
              removed={cuts}
              onCell={tool === "punch" ? tapCell : undefined}
              spots={creaseSpots(S, folds)}
              onSpot={tool === "punch" ? tapSpot : undefined}
              onVertex={tool === "corner" ? tapVertex : undefined}
              pad={tool === "free" ? cutPad : undefined}
              dots={tool === "free" ? bendDots : undefined}
              draft={tool === "free" ? draft : undefined}
              preview={tool === "free" && drag && !samePt(drag[0], drag[1]) ? drag : null}
              label={tool === "free" ? "کاغذ تاشده: خط برش را بکش" : "کاغذ تاشده"}
            />
            {tool === "free" && cutNote && (
              <p className={styles.note} role="status" aria-live="polite">
                {cutNote}
              </p>
            )}
            {tool === "free" && lastCut?.parts.length === 2 && !draft.length && (
              <button className={styles.clear} onClick={swapLast}>
                تکه دیگر بیفتد
              </button>
            )}
            <div className={styles.row}>
              <button className={styles.clear} onClick={undo} disabled={!folds.length && !marked}>
                برگرد
              </button>
              <button className={styles.clear} onClick={reset} disabled={!folds.length && !marked}>
                از نو
              </button>
            </div>

            <div className={styles.titleRow}>
              <h2 className={styles.progress}>۳. باز کن: {reveal ? `${fa(unfoldPoints(punches, folds).length)} سوراخ` : "حدس بزن!"}</h2>
              <button
                className={styles.toggle}
                aria-pressed={reveal}
                onClick={() => {
                  const next = !reveal;
                  setReveal(next);
                  if (next && folds.length) animate(fRef.current, 0, folds.length);
                }}
              >
                {reveal ? "پنهان کن" : "باز کن و نشان بده"}
              </button>
            </div>
            {reveal ? (
              <PaperSvg S={S} size={220} holes={unfoldPoints(punches, folds)} removed={unfoldPolys(cuts, folds)} creases={creases(S, folds)} label="کاغذ باز" />
            ) : (
              <p className={styles.note}>اول روی کاغذ خودت حدس بزن سوراخ‌ها کجا می‌آیند؛ بعد باز کن.</p>
            )}
          </>
        )}

        {mode === "show" && (
          <>
            <p className={styles.note}>
              {ex === SAMPLE ? "یک نمونه" : "کاغذی که خودت تا کردی"}: {fa(K)} تا. هر بار یک تا را باز می‌کنیم؛ خط تا مثل آینه است.
            </p>
            <div className={styles.row}>
              <button className={styles.clear} onClick={() => showStep(s - 1)} disabled={s === 0}>
                → قبلی
              </button>
              <button className={styles.primary} onClick={() => showStep(s + 1)} disabled={s === K}>
                یک تا باز کن ←
              </button>
            </div>
            <p className={styles.stepText}>
              {s === 0
                ? `کاغذ تاشده با ${fa(ex.punches.length)} سوراخ${exCuts.length ? " و برش" : ""}. ${fa(2 ** K)} لایه روی هم است، پس هر سوراخ از ${fa(2 ** K)} لایه رد شده.`
                : `تای ${fa(K - s + 1)} باز شد: هر سوراخ نسبت به خط‌چین قرینه شد${onFold ? `؛ سوراخ روی خط تا قرینه خودش است و یکی می‌ماند (دو نیمه‌اش به هم رسیدند)` : ""}. حالا ${fa(shownHoles.length)} سوراخ.`}
            </p>
            <PaperSvg
              S={ex.S}
              size={240}
              shape={exBefore[K - s]}
              outline
              holes={shownHoles}
              removed={unfoldPolys(exCuts, open)}
              mirror={s ? ex.folds[K - s].line : undefined}
              links={links}
              creases={creases(ex.S, ex.folds, K - s)}
              label={`مرحله ${fa(s)}`}
            />
            <p className={`${styles.status} ${styles.info}`}>
              {counts.map((n) => fa(n)).join(" ← ")} سوراخ
            </p>
            <p className={styles.note}>خط‌چین آبی هر سوراخ را به قرینه‌اش وصل می‌کند: هر دو تا خط تا یک فاصله دارند.</p>
          </>
        )}

        {mode === "try" && (
          <PaperTryPanel
            key={`${tryType}-${tryLevel}-${seed}`}
            question={question}
            type={tryType}
            level={tryLevel}
            initialPick={initialPick}
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

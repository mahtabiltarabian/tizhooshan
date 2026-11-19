"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Board } from "@/engine-2d/Board";
import { BLOCKS, blocksFor, makeBalanceQuestion, SYMBOLS, type BalanceQuestionType, type FillQuestion, type Level } from "@/generators/balance";
import { newSeed } from "@/generators/random";
import { setClassroom as applyClassroom, useClassroom } from "@/toolkit/classroom";
import { TeacherGuideButton } from "@/toolkit/TeacherGuide";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/ToolLayout.module.css";
import { BALANCE_TYPE_LABEL, BalanceTryPanel, balancePrompt, LEVEL_LABEL } from "./BalanceTryPanel";
import { coinPan, fillValue, fillViews, framesOf, glyph, groupOf, ltr, type Frame, type ScaleView } from "./frames";
import { BALANCE_GUIDE } from "./guide";
import {
  ARM,
  BarsG,
  barsHeight,
  CoinRow,
  coinRowsHeight,
  ItemG,
  layoutOf,
  LiveBalance,
  scalesHeight,
  SLOT,
  tiltFor,
  type Item,
  type ItemView,
} from "./Pictures";

type Mode = "explore" | "show" | "try";
type Side = "left" | "right";
type View = [number, number, number, number];

const TYPES = Object.keys(BALANCE_TYPE_LABEL) as BalanceQuestionType[];
const FRAME_MS = 2200;
/** Explore: what each palette offers (shapes and the numbered blocks). */
const EXPLORE_PALETTE: Item[] = [{ sym: 0 }, { sym: 1 }, { sym: 2 }, ...BLOCKS.map((w) => ({ w }))];
const PALETTE_STEP = 0.78;
const EX = { cx: 8, cy: 2.5, u: 1.2 };
const EX_PALETTE_Y = 7.55;

const sideX = (cx: number, u: number, side: Side) => cx + (side === "left" ? -1 : 1) * ARM * u;

/** Scales of a frame, laid out on the board. */
function ScalesScene({ scales, onItem }: { scales: ScaleView[]; onItem?: (scale: number, side: Side, index: number) => void }) {
  const spots = layoutOf(scales.length);
  return (
    <>
      {scales.map((s, i) => (
        <LiveBalance
          key={i}
          {...spots[i]}
          target={s.tilt}
          left={s.left}
          right={s.right}
          label={s.label}
          focus={s.focus}
          locked={s.locked}
          ask={s.ask}
          onItem={onItem ? (side, index) => onItem(i, side, index) : undefined}
        />
      ))}
    </>
  );
}

function sceneView(fr: Frame, extra = 0): View {
  if (fr.kind === "scales") return [0, 0, 16, scalesHeight(fr.scales.length) + extra];
  if (fr.kind === "coins") return [0, 0, 16, 0.4 + coinRowsHeight(fr.n, 15) + 1.9 + 3.15 * 0.8 + 0.5];
  return [0, 0, 16, barsHeight(fr.rows.length) + 0.9];
}

function Scene({ fr }: { fr: Frame }) {
  if (fr.kind === "scales") return <ScalesScene scales={fr.scales} />;
  if (fr.kind === "bars") return <BarsG rows={fr.rows} x={0.3} y={0.5} width={15.4} scale={fr.scale} caption={fr.caption} />;
  const cy = 0.4 + coinRowsHeight(fr.n, 15) + 1.9;
  return (
    <>
      <CoinRow n={fr.n} x={0.5} y={0.4} width={15} out={(i) => i < fr.alive[0] || i >= fr.alive[1]} tagOf={(i) => groupOf(fr.w, i)} fake={fr.fake} />
      <LiveBalance key="coin-scale" cx={8} cy={cy} u={0.8} target={fr.tilt} left={fr.w ? coinPan(fr.w.a, "آ") : []} right={fr.w ? coinPan(fr.w.b, "ب") : []} />
    </>
  );
}

const itemWeight = (it: Item, w: number[]) => ("sym" in it ? w[it.sym] : "w" in it ? it.w : 0);

/** "●● + ۵" for explore pans. */
function itemsFa(items: Item[]) {
  const s = SYMBOLS.map((_, j) => glyph(j).repeat(items.filter((it) => "sym" in it && it.sym === j).length)).filter(Boolean);
  const w = items.filter((it): it is { w: number } => "w" in it).map((it) => fa(it.w));
  return [...s, ...w].join(" + ") || "۰";
}

export function BalanceTool() {
  const [mode, setMode] = useState<Mode>("explore");
  const [classroom, setClassroom] = useClassroom();

  // Playback 0 … 1 through the frames.
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

  // Explore
  const [pans, setPans] = useState<Record<Side, Item[]>>({ left: [{ sym: 0 }, { sym: 0 }, { w: 2 }], right: [{ sym: 1 }] });
  const [symW, setSymW] = useState([3, 8, 5]);
  const [showW, setShowW] = useState(false);

  // Show me
  const [showType, setShowType] = useState<BalanceQuestionType>("balance");
  const [showLevel, setShowLevel] = useState<Level>(2);
  const [showSeed, setShowSeed] = useState(1212);
  const showQ = useMemo(() => makeBalanceQuestion(showType, showLevel, showSeed), [showType, showLevel, showSeed]);

  // Try it
  const [tryType, setTryType] = useState<BalanceQuestionType>("balance");
  const [tryLevel, setTryLevel] = useState<Level>(1);
  const [seed, setSeed] = useState(1212);
  const [checked, setChecked] = useState<number | null>(null);
  const [placed, setPlaced] = useState<number[]>([]);
  const question = useMemo(() => makeBalanceQuestion(tryType, tryLevel, seed), [tryType, tryLevel, seed]);
  const fillQ = question.type === "fill" ? (question as FillQuestion) : null;
  const placedItems: ItemView[] = useMemo(() => (fillQ ? placed.map((b) => ({ item: fillQ.fillWith === null ? { w: b } : { sym: fillQ.fillWith }, mine: true })) : []), [fillQ, placed]);
  const onPan = fillQ ? fillValue(fillQ, placedItems) : 0;

  const frames = useMemo(() => {
    if (mode === "show") return framesOf(showQ);
    if (mode === "try" && checked !== null) return framesOf(question, question.type === "fill" ? checked : undefined);
    return [];
  }, [mode, showQ, question, checked]);
  const at = frames.length ? Math.min(frames.length - 1, Math.round(f * (frames.length - 1))) : 0;
  const frameMs = Math.max(1, frames.length - 1) * FRAME_MS;

  // Shareable links: #try=fill&level=2&seed=7(&a=12), #show=age&level=3&seed=5, #f=0.5, #classroom
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.has("classroom")) applyClassroom(true);
    const tryParam = params.get("try");
    const show = params.get("show");
    const timer = setTimeout(() => {
      const lv = Number(params.get("level"));
      const level = lv === 1 || lv === 2 || lv === 3 ? (lv as Level) : null;
      const sd = Number(params.get("seed"));
      const sdOk = params.has("seed") && Number.isInteger(sd) && sd >= 0;
      if (tryParam && (TYPES as string[]).includes(tryParam)) {
        setMode("try");
        setTryType(tryParam as BalanceQuestionType);
        if (level) setTryLevel(level);
        if (sdOk) setSeed(sd);
        const a = Number(params.get("a"));
        if (params.has("a") && Number.isInteger(a) && a > 0) {
          const q = makeBalanceQuestion(tryParam as BalanceQuestionType, level ?? 1, sdOk ? sd : 1212);
          if (q.type === "fill") setPlaced(q.fillWith === null ? blocksFor(a) : Array<number>(a).fill(0));
          setChecked(a);
          setF(1);
        } else setF(0);
      } else if (show && (TYPES as string[]).includes(show)) {
        setMode("show");
        setShowType(show as BalanceQuestionType);
        if (level) setShowLevel(level);
        if (sdOk) setShowSeed(sd);
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
    setF(m === "show" ? 0 : 1);
  };

  const freshTry = (type = tryType, level = tryLevel) => {
    setTryType(type);
    setTryLevel(level);
    setSeed(newSeed());
    setChecked(null);
    setPlaced([]);
    setRun(null);
    setF(0);
  };
  const freshShow = (type = showType, level = showLevel) => {
    setShowType(type);
    setShowLevel(level);
    setShowSeed(newSeed());
    setRun(null);
    setF(0);
  };

  const play = () => {
    if (run) return setRun(null);
    animate(frameMs, f >= 0.99 ? 0 : f);
  };
  const stepTo = (i: number) => {
    setRun(null);
    setF(frames.length > 1 ? Math.max(0, Math.min(1, i / (frames.length - 1))) : 1);
  };

  // ── Dragging from a palette onto a pan ──────────────────────────────
  const drag = useRef<{ item: Item; from: Side | null; x0: number; y0: number; moved: boolean } | null>(null);
  const [ghost, setGhost] = useState<{ item: Item; x: number; y: number } | null>(null);
  const boardPoint = (e: React.PointerEvent<SVGElement>) => {
    const el = e.currentTarget as unknown as SVGGraphicsElement;
    const ctm = (el.ownerSVGElement ?? el).getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const fillSpot = fillQ ? layoutOf(fillQ.scales.length + 1)[fillQ.scales.length] : null;
  const addToPan = (side: Side, item: Item) => setPans((p) => (p[side].length >= 12 ? p : { ...p, [side]: [...p[side], item] }));
  const addPlaced = (b: number) => setPlaced((p) => (p.length >= 16 ? p : [...p, b]));

  const down = (item: Item, from: Side | null, e: React.PointerEvent<SVGGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = boardPoint(e);
    drag.current = { item, from, x0: p.x, y0: p.y, moved: false };
  };
  const move = (e: React.PointerEvent<SVGGElement>) => {
    const d = drag.current;
    if (!d) return;
    const p = boardPoint(e);
    if (Math.hypot(p.x - d.x0, p.y - d.y0) > 0.25) d.moved = true;
    if (d.moved) setGhost({ item: d.item, x: p.x, y: p.y });
  };
  const up = (e: React.PointerEvent<SVGGElement>) => {
    const d = drag.current;
    drag.current = null;
    setGhost(null);
    if (!d) return;
    const p = boardPoint(e);
    if (mode === "explore") {
      // A tap puts it on the pan above its palette; a drag on the nearer pan, if dropped above the palettes.
      if (!d.moved && d.from) addToPan(d.from, d.item);
      else if (d.moved && p.y < EX_PALETTE_Y - 0.4) addToPan(p.x < EX.cx ? "left" : "right", d.item);
    } else if (fillQ && fillSpot && checked === null) {
      const px = sideX(fillSpot.cx, fillSpot.u, "right");
      const near = Math.abs(p.x - px) < 2.2 * fillSpot.u && p.y > fillSpot.cy - 1.5 * fillSpot.u && p.y < fillSpot.cy + 3 * fillSpot.u;
      if (!d.moved || near) addPlaced("w" in d.item ? d.item.w : 0);
    }
  };
  const cancel = () => {
    drag.current = null;
    setGhost(null);
  };

  const paletteItem = (item: Item, x: number, y: number, from: Side | null, key: string, label?: string) => (
    <g key={key} onPointerDown={(e) => down(item, from, e)} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} style={{ cursor: "grab", touchAction: "none" }}>
      <rect x={x - 0.36} y={y - 0.38} width={0.72} height={0.76} rx={0.12} fill="#fffaf0" stroke="#cfc6b6" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <ItemG v={{ item }} x={x} y={y} s={0.62} />
      {label && (
        <text x={x} y={y + 0.55} fontSize={0.2} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill="#5b6170">
          {label}
        </text>
      )}
    </g>
  );

  // ── Board ───────────────────────────────────────────────────────────
  const exDiff = pans.right.reduce((t, it) => t + itemWeight(it, symW), 0) - pans.left.reduce((t, it) => t + itemWeight(it, symW), 0);
  const leftW = pans.left.reduce((t, it) => t + itemWeight(it, symW), 0);
  const rightW = leftW + exDiff;

  let board: React.ReactNode;
  let view: View = [0, 0, 16, 9];
  let label = "ترازو";
  if (mode === "explore") {
    view = [0, 0, 16, EX_PALETTE_Y + 0.85];
    label = "ترازو؛ وزنه‌ها را روی کفه‌ها بکش";
    board = (
      <>
        <LiveBalance
          {...EX}
          target={tiltFor(exDiff)}
          left={pans.left.map((item) => ({ item, mine: true }))}
          right={pans.right.map((item) => ({ item, mine: true }))}
          onItem={(side, i) => setPans((p) => ({ ...p, [side]: p[side].filter((_, j) => j !== i) }))}
        />
        {(["left", "right"] as Side[]).map((side) =>
          EXPLORE_PALETTE.map((item, i) => {
            const x = sideX(EX.cx, EX.u, side) + (i - (EXPLORE_PALETTE.length - 1) / 2) * PALETTE_STEP;
            return paletteItem(item, Math.round(x * 1000) / 1000, EX_PALETTE_Y, side, `${side}${i}`, showW && "sym" in item ? fa(symW[item.sym]) : undefined);
          }),
        )}
      </>
    );
  } else if (frames.length) {
    const fr = frames[at];
    view = sceneView(fr);
    board = <Scene fr={fr} />;
  } else {
    // Try, before the answer.
    const q = question;
    if (fillQ && fillSpot) {
      const scales = fillViews(fillQ, placedItems, true);
      const h = scalesHeight(scales.length);
      const py = h + 0.55;
      const items: Item[] = fillQ.fillWith === null ? BLOCKS.map((w) => ({ w })) : [{ sym: fillQ.fillWith }];
      const cx = Math.min(14.5, Math.max(1.5, sideX(fillSpot.cx, fillSpot.u, "right")));
      view = [0, 0, 16, h + 1.3];
      board = (
        <>
          <ScalesScene scales={scales} onItem={(_, side, i) => side === "right" && setPlaced((p) => p.filter((__, j) => j !== i))} />
          {items.map((item, i) => paletteItem(item, Math.round((cx + (i - (items.length - 1) / 2) * 0.95) * 1000) / 1000, py, null, `p${i}`))}
        </>
      );
    } else {
      const fr = framesOf(q)[0];
      view = sceneView(fr);
      board = <Scene fr={fr} />;
    }
  }

  const inTry = mode === "try";
  const showSlider = frames.length > 0;
  const note = frames.length ? frames[at].note : "";

  return (
    <main className={styles.layout}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          → همه ابزارها
        </Link>
        <h1>
          <span className={styles.badge}>{fa(12)}</span> ترازو
        </h1>
        <div className={styles.tabs} role="tablist" aria-label="حالت ابزار">
          <button role="tab" aria-selected={mode === "explore"} onClick={() => switchMode("explore")}>
            کشف: وزنه بگذار
          </button>
          <button
            role="tab"
            aria-selected={mode === "show"}
            onClick={() => {
              switchMode("show");
              animate(Math.max(1, framesOf(showQ).length - 1) * FRAME_MS);
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
          <TeacherGuideButton guide={BALANCE_GUIDE} />
          <Link href={`/tools/balance/worksheet?types=${tryType}&level=${tryLevel}`}>کاربرگ</Link>
        </div>
      </header>

      <section className={styles.stageWrap} aria-label="صفحه ترازو">
        <Board view={view} imageName="balance" label={label}>
          {board}
          {ghost && (
            <g opacity={0.75} pointerEvents="none">
              <ItemG v={{ item: ghost.item }} x={ghost.x} y={ghost.y} s={SLOT * 1.2} />
            </g>
          )}
        </Board>
      </section>

      <section className={styles.controls}>
        {showSlider ? (
          <>
            <label className={styles.slider}>
              <button className={styles.playSmall} onClick={play} aria-label={run ? "توقف" : "پخش"}>
                {run ? "⏸" : "▶"}
              </button>
              <span>
                قدم {fa(at + 1)} از {fa(frames.length)}
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
            <p className={styles.stepText} style={{ margin: 0, flex: "1 1 100%", textAlign: "start", lineHeight: 1.9 }} aria-live="polite">
              {note}
            </p>
          </>
        ) : (
          <p className={styles.stepText} style={{ margin: 0 }}>
            {inTry ? "اول فکر کن، بعد جواب بده" : `${ltr(`${itemsFa(pans.left)} ${exDiff === 0 ? "=" : exDiff > 0 ? "<" : ">"} ${itemsFa(pans.right)}`)} · ${exDiff === 0 ? "ترازو متعادل است" : `کفه ${exDiff > 0 ? "راست" : "چپ"} سنگین‌تر است`}`}
          </p>
        )}
      </section>

      <aside className={styles.side}>
        {mode === "explore" && (
          <>
            <h2>وزنه‌ها را روی کفه‌ها بگذار</h2>
            <p className={styles.note}>از ردیف زیر هر کفه، شکل یا وزنه را لمس کن یا روی کفه بکش. هر چیز روی کفه را لمس کنی برداشته می‌شود. کفه‌ی سنگین‌تر پایین می‌رود.</p>
            <p className={`${styles.status} ${exDiff === 0 ? styles.good : styles.info}`}>
              {exDiff === 0 ? "✓ ترازو متعادل است." : `کفه ${exDiff > 0 ? "راست" : "چپ"} سنگین‌تر است و پایین رفته.`}
              {showW && (
                <>
                  {" "}
                  چپ {fa(leftW)} کیلو، راست {fa(rightW)} کیلو.
                </>
              )}
            </p>
            <div className={styles.row}>
              <button
                className={styles.clear}
                onClick={() =>
                  setPans((p) => {
                    // Take off what is on both pans: the balance does not change.
                    const right = [...p.right];
                    const left: Item[] = [];
                    for (const it of p.left) {
                      const j = right.findIndex((r) => JSON.stringify(r) === JSON.stringify(it));
                      if (j >= 0) right.splice(j, 1);
                      else left.push(it);
                    }
                    return { left, right };
                  })
                }
              >
                از هر دو کفه یکسان بردار
              </button>
              <button className={styles.clear} onClick={() => setPans({ left: [], right: [] })}>
                خالی کن
              </button>
            </div>

            <h2 className={styles.progress}>وزن شکل‌ها</h2>
            <p className={styles.note}>وزن شکل‌ها پنهان است. با آزمایش پیدایشان کن؛ مثلاً چند {glyph(0)} با یک {glyph(1)} هم‌وزن است؟</p>
            <button className={styles.toggle} aria-pressed={showW} onClick={() => setShowW(!showW)}>
              {showW ? "✓ " : ""}وزن شکل‌ها را نشان بده
            </button>
            {showW &&
              SYMBOLS.map((s, j) => (
                <div key={s.name} className={styles.row} style={{ marginTop: 6, alignItems: "center" }}>
                  <button className={styles.clear} onClick={() => setSymW((w) => w.map((v, i) => (i === j ? Math.max(1, v - 1) : v)))} disabled={symW[j] <= 1} aria-label="کمتر">
                    −
                  </button>
                  <span className={styles.stepperLabel}>
                    {s.glyph} {s.name}: {fa(symW[j])} کیلو
                  </span>
                  <button className={styles.clear} onClick={() => setSymW((w) => w.map((v, i) => (i === j ? Math.min(15, v + 1) : v)))} disabled={symW[j] >= 15} aria-label="بیشتر">
                    +
                  </button>
                </div>
              ))}
            <button className={styles.clear} style={{ marginTop: 12 }} onClick={() => { setMode("show"); setF(0); animate(Math.max(1, framesOf(showQ).length - 1) * FRAME_MS); }}>
              نشانم بده: حذف از دو کفه و جایگزینی
            </button>
          </>
        )}

        {mode === "show" && (
          <>
            <div className={styles.chipsRow} role="radiogroup" aria-label="نوع مسئله" style={{ flexWrap: "wrap" }}>
              {TYPES.map((t) => (
                <button key={t} role="radio" aria-checked={showType === t} onClick={() => freshShow(t, showLevel)} style={{ flex: "1 0 40%" }}>
                  {BALANCE_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            <div className={styles.chipsRow} role="radiogroup" aria-label="اندازه" style={{ marginTop: 6 }}>
              {([1, 2, 3] as Level[]).map((l) => (
                <button key={l} role="radio" aria-checked={showLevel === l} onClick={() => freshShow(showType, l)} style={{ fontSize: "0.78rem" }}>
                  {LEVEL_LABEL[showType][l - 1]}
                </button>
              ))}
            </div>
            <p className={styles.stepText} style={{ textAlign: "start", lineHeight: 1.9 }}>
              {balancePrompt(showQ, true)}
            </p>
            <div className={styles.row}>
              <button className={styles.clear} onClick={() => stepTo(at - 1)} disabled={at === 0}>
                → قدم قبل
              </button>
              <button className={styles.clear} onClick={() => stepTo(at + 1)} disabled={at >= frames.length - 1}>
                قدم بعد ←
              </button>
            </div>
            <p className={styles.note}>
              {showType === "balance" || showType === "fill"
                ? "هر کاری با یک کفه بکنی، با کفه‌ی دیگر هم بکن: ترازو متعادل می‌ماند. شکل‌های خط‌خورده از هر دو کفه برداشته می‌شوند؛ شکل‌های با حلقه‌ی خط‌چین جایگزین می‌شوند."
                : showType === "coin"
                  ? "هر وزن‌کشی سه جواب دارد: چپ پایین، راست پایین یا تعادل. پس سکه‌ها را سه گروه کن."
                  : "نوارهای آبی تکه‌های برابرند؛ تکه‌های هاشورخورده چند سال‌اند. اختلاف سن هیچ‌وقت عوض نمی‌شود."}
            </p>
            <button className={styles.clear} onClick={() => freshShow()}>
              نمونه تازه
            </button>
          </>
        )}

        {mode === "try" && (
          <BalanceTryPanel
            key={`${tryType}-${tryLevel}-${seed}`}
            question={question}
            type={tryType}
            level={tryLevel}
            onPan={onPan}
            onAdd={addPlaced}
            onUndo={() => setPlaced((p) => p.slice(0, -1))}
            onEmpty={() => setPlaced([])}
            checked={checked}
            onCheck={(v) => {
              setChecked(v);
              animate(Math.max(1, framesOf(question, question.type === "fill" ? v : undefined).length - 1) * FRAME_MS);
            }}
            onType={(t) => freshTry(t, tryLevel)}
            onLevel={(l) => freshTry(tryType, l)}
            onNew={() => freshTry()}
          />
        )}
      </aside>
    </main>
  );
}

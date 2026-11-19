"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Board } from "@/engine-2d/Board";
import {
  answerKind,
  bestBuilt,
  digitsOf,
  digitSum,
  extremes,
  makeDigitsQuestion,
  meets,
  placeCounts,
  readEquation,
  stickDiff,
  type Cond,
  type DigitsQuestion,
  type DigitsQuestionType,
  type Level,
  type MatchQuestion,
} from "@/generators/digits";
import { mulberry32, newSeed, shuffle } from "@/generators/random";
import { setClassroom as applyClassroom, useClassroom } from "@/toolkit/classroom";
import { TeacherGuideButton } from "@/toolkit/TeacherGuide";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/ToolLayout.module.css";
import { COND_FA, COND_RULE, DIGITS_TYPE_LABEL, DigitsTryPanel, equationFa, ltr, numFa } from "./DigitsTryPanel";
import { DIGITS_GUIDE } from "./guide";
import { CardsG, ChartKeyG, CHART_CELL, HundredChartG, MatchG, matchView, moveFrame, RowG, SLOT_H, type Spot } from "./Pictures";

type Mode = "explore" | "show" | "try";
/** Explore: cards or matchsticks. Show me: counting or matchsticks. */
type Area = "cards" | "count" | "match";

const VIEW: [number, number, number, number] = [0, 0, 16, 9];
const sameSpot = (a: Spot | null, b: Spot) => !!a && a[0] === b[0] && a[1] === b[1];

/** Stick puzzle for explore and show me: the matchstick question of that level and seed. */
const puzzleOf = (level: Level, seed: number) => makeDigitsQuestion("match", level, seed) as MatchQuestion;

/** A fresh hand of k different cards, sometimes with a zero. */
function newHand(k: number) {
  const rng = mulberry32(newSeed());
  const zero = rng() < 0.5;
  return shuffle(rng, zero ? [0, ...shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, k - 1)] : shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, k));
}

/** Card indices that spell a number (each card once). */
function indicesFor(cards: number[], s: string) {
  const used = cards.map(() => false);
  return s.split("").map((ch) => {
    const i = cards.findIndex((c, j) => !used[j] && c === Number(ch));
    used[i] = true;
    return i;
  });
}

const COUNT_PHASES = ["", "یکان", "دهگان", "صدگان"];

export function DigitsTool() {
  const [mode, setMode] = useState<Mode>("explore");
  const [classroom, setClassroom] = useClassroom();

  // Playback 0 … 1.
  const [f, setF] = useState(1);
  const [run, setRun] = useState<{ from: number; ms: number } | null>(null);
  useEffect(() => {
    if (!run) return;
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
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

  const [area, setArea] = useState<Area>("cards");

  // Explore: cards
  const [hand, setHand] = useState<number[]>([3, 0, 7, 1]);
  const [placed, setPlaced] = useState<number[]>([]);
  const [cond, setCond] = useState<Cond | null>(null);
  const [cardMsg, setCardMsg] = useState<string | null>(null);

  // Explore and show me: matchsticks
  const [exLevel, setExLevel] = useState<Level>(1);
  const [exSeed, setExSeed] = useState(13);
  const puzzle = useMemo(() => puzzleOf(exLevel, exSeed), [exLevel, exSeed]);
  const [exSticks, setExSticks] = useState<number[] | null>(null);
  const sticksNow = exSticks ?? puzzle.start;

  // Show me: counting
  const [countD, setCountD] = useState(1);
  const [countN, setCountN] = useState(100);
  const [block, setBlock] = useState(0);

  // Matchsticks in hand (explore and try)
  const [lifted, setLifted] = useState<Spot | null>(null);
  const [stickMsg, setStickMsg] = useState<string | null>(null);

  // Try it
  const [tryType, setTryType] = useState<DigitsQuestionType>("extreme");
  const [tryLevel, setTryLevel] = useState<Level>(1);
  const [seed, setSeed] = useState(1313);
  const [built, setBuilt] = useState<number[]>([]);
  const [trySticks, setTrySticks] = useState<number[] | null>(null);
  const [checked, setChecked] = useState<string | null>(null);
  const question = useMemo(() => makeDigitsQuestion(tryType, tryLevel, seed), [tryType, tryLevel, seed]);

  const showMs = area === "match" ? 2600 * puzzle.moves : 7000;
  const tryMs = (q: DigitsQuestion) => (q.type === "match" ? 2600 * q.moves : 6000);

  // Shareable links: #try=match&level=2&seed=7(&a=…), #show=count-3-235(-1) or #show=match-1-13,
  // #explore=cards-3071 or #explore=match-1-13, #f=0.5, #classroom
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.has("classroom")) applyClassroom(true);
    const tryParam = params.get("try");
    const show = params.get("show");
    const explore = params.get("explore");
    const timer = setTimeout(() => {
      const lvl = (x: unknown): x is Level => x === 1 || x === 2 || x === 3;
      if (tryParam) {
        setMode("try");
        const t = tryParam in DIGITS_TYPE_LABEL ? (tryParam as DigitsQuestionType) : "extreme";
        setTryType(t);
        const lv = Number(params.get("level"));
        if (lvl(lv)) setTryLevel(lv);
        const sd = Number(params.get("seed"));
        if (Number.isInteger(sd) && sd >= 0) setSeed(sd);
        const a = params.get("a");
        if (a && /^[\d.]+$/.test(a)) {
          const q = makeDigitsQuestion(t, lvl(lv) ? lv : 1, Number.isInteger(sd) && sd >= 0 ? sd : 1313);
          const kind = answerKind(q);
          if (kind === "cards" && "cards" in q) {
            const ix = indicesFor(q.cards, a);
            if (ix.every((i) => i >= 0)) setBuilt(ix);
          }
          if (kind === "match") setTrySticks(a.split(".").map(Number));
          setChecked(a);
          setF(1);
        } else setF(0);
      } else if (show || explore) {
        const [kind, ...rest] = (show ?? explore)!.split("-");
        const nums = rest.map(Number);
        if (kind === "count" && show) {
          setArea("count");
          if (nums[0] >= 0 && nums[0] <= 9) setCountD(nums[0]);
          if (nums[1] >= 1 && nums[1] <= 1000) setCountN(nums[1]);
          if (nums[2] >= 0 && nums[2] <= 10) setBlock(nums[2]);
        } else if (kind === "match") {
          setArea("match");
          if (lvl(nums[0])) setExLevel(nums[0]);
          if (Number.isInteger(nums[1]) && nums[1] >= 0) setExSeed(nums[1]);
        } else if (kind === "cards" && /^\d{2,5}$/.test(rest[0] ?? "")) {
          setArea("cards");
          setHand(rest[0].split("").map(Number));
        }
        setMode(show ? "show" : "explore");
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
    setLifted(null);
    if (m === "show" && area === "cards") setArea("count");
    if (m === "explore" && area === "count") setArea("cards");
  };

  const freshQuestion = (type = tryType, level = tryLevel) => {
    setTryType(type);
    setTryLevel(level);
    setSeed(newSeed());
    setBuilt([]);
    setTrySticks(null);
    setLifted(null);
    setStickMsg(null);
    setChecked(null);
    setRun(null);
    setF(0);
  };

  const freshPuzzle = (level = exLevel) => {
    setExLevel(level);
    setExSeed(newSeed());
    setExSticks(null);
    setLifted(null);
    setStickMsg(null);
    setRun(null);
    setF(mode === "show" ? 0 : 1);
  };

  const play = (ms: number) => {
    if (run) return setRun(null);
    animate(ms, f >= 0.99 ? 0 : f);
  };

  // Matchsticks: tap a stick to lift it, tap an empty spot to lay it down.
  const tapStick = (s: Spot) => {
    setStickMsg(null);
    setLifted((l) => (sameSpot(l, s) ? null : s));
  };
  const tapSpot = (s: Spot, start: number[], now: number[], set: (m: number[]) => void, limit: number | null) => {
    if (!lifted) {
      setStickMsg("اول روی یک چوب بزن تا بلند شود.");
      return;
    }
    const next = [...now];
    next[lifted[0]] &= ~lifted[1];
    next[s[0]] |= s[1];
    if (limit !== null && stickDiff(start, next).removed > limit) {
      setStickMsg(`فقط ${fa(limit)} جابه‌جایی مجاز است. «از نو» را بزن یا چوبی را به جای اولش برگردان.`);
      return;
    }
    setStickMsg(null);
    set(next);
    setLifted(null);
  };

  // ── Explore: cards ──
  const slots = hand.map((_, i) => (i < placed.length ? hand[placed[i]] : null));
  const usedCards = hand.map((_, i) => placed.includes(i));
  const builtStr = placed.map((i) => hand[i]).join("");
  const autoBuild = (want: "max" | "min") => {
    const n = bestBuilt(hand, hand.length, cond, want);
    if (n === null) {
      setCardMsg(`با این کارت‌ها هیچ عدد ${cond ? COND_FA[cond] : ""}ی ساخته نمی‌شود.`);
      setPlaced([]);
      return;
    }
    setCardMsg(null);
    setPlaced(indicesFor(hand, String(n)));
  };

  // ── Boards ──
  let board: React.ReactNode;
  let caption = "";
  if (mode !== "try") {
    if (area === "cards")
      board = (
        <Board view={VIEW} imageName="digits" label="کارت‌های رقم؛ روی کارت بزن">
          <CardsG
            slots={slots}
            hand={hand}
            used={usedCards}
            onHand={(i) => {
              setCardMsg(null);
              setPlaced((p) => [...p, i]);
            }}
            onSlot={(i) => setPlaced((p) => p.filter((_, j) => j !== i))}
            cx={8}
            y={0.9}
            handY={6.2}
          />
          <text x={8} y={5.25} fontSize={0.36} fontWeight={700} textAnchor="middle" direction="rtl" dominantBaseline="central" fill="#5b6170">
            کارت‌ها
          </text>
        </Board>
      );
    else if (area === "count") {
      const phase = Math.min(3, Math.floor(f * 4));
      board = <CountBoard digit={countD} n={countN} block={block} phase={phase} />;
    } else {
      const frame = mode === "show" ? moveFrame(puzzle.lens, puzzle.start, puzzle.answer, f) : null;
      const masks = frame ? frame.masks : sticksNow;
      const eq = readEquation(puzzle.lens, masks);
      caption = mode === "show" ? (f >= 1 ? `درست شد: ${equationFa(puzzle, puzzle.answer)}` : `${fa(puzzle.moves)} جابه‌جایی`) : eq ? `${equationFa(puzzle, masks)}  ${eq.holds ? "✓ درست" : "✗ نادرست"}` : "یکی از شکل‌ها رقم یا علامت نیست";
      const v = matchView(puzzle.lens);
      board = (
        <Board view={v} imageName="matchsticks" label="چوب‌کبریت‌ها">
          <MatchG
            lens={puzzle.lens}
            masks={masks}
            x={0}
            y={0}
            spots={mode === "explore"}
            lifted={mode === "explore" ? lifted : null}
            onStick={mode === "explore" ? tapStick : undefined}
            onSpot={mode === "explore" ? (s) => tapSpot(s, puzzle.start, sticksNow, setExSticks, null) : undefined}
            flying={frame?.flying}
            marks={frame && f < 1 ? frame.marks : undefined}
          />
          <text x={v[0] + v[2] / 2} y={SLOT_H + 0.65} fontSize={0.38} fontWeight={700} textAnchor="middle" direction="rtl" dominantBaseline="central" fill="#1f2430">
            {caption}
          </text>
        </Board>
      );
    }
  } else board = <TryBoard q={question} built={built} sticks={trySticks ?? (question.type === "match" ? question.start : [])} checked={checked} f={f} lifted={lifted} onBuilt={setBuilt} onTapStick={tapStick} onTapSpot={(s) => question.type === "match" && tapSpot(s, question.start, trySticks ?? question.start, setTrySticks, question.moves)} />;

  const inTry = mode === "try";
  const animated = (inTry && checked !== null && (question.type === "match" || question.type === "count")) || mode === "show";
  const counts = placeCounts(countD, countN);
  const countPhase = Math.min(3, Math.floor(f * 4));

  return (
    <main className={styles.layout}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          → همه ابزارها
        </Link>
        <h1>
          <span className={styles.badge}>{fa(13)}</span> ارقام
        </h1>
        <div className={styles.tabs} role="tablist" aria-label="حالت ابزار">
          <button role="tab" aria-selected={mode === "explore"} onClick={() => switchMode("explore")}>
            کشف: خودت بچین
          </button>
          <button
            role="tab"
            aria-selected={mode === "show"}
            onClick={() => {
              switchMode("show");
              animate(area === "match" ? 2600 * puzzle.moves : 7000);
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
          <TeacherGuideButton guide={DIGITS_GUIDE} />
          <Link href={`/tools/digits/worksheet?types=${tryType}&level=${tryLevel}`}>کاربرگ</Link>
        </div>
      </header>

      <section className={styles.stageWrap} aria-label="صفحه ارقام">
        {board}
      </section>

      <section className={styles.controls}>
        {animated ? (
          <label className={styles.slider}>
            <button className={styles.playSmall} onClick={() => play(inTry ? tryMs(question) : showMs)} aria-label={run ? "توقف" : "پخش"}>
              {run ? "⏸" : "▶"}
            </button>
            <span>{(inTry ? question.type === "count" : area === "count") ? `شمارش: ${COUNT_PHASES[countPhase] || "آماده"}` : "جابه‌جایی چوب"}</span>
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
            {inTry ? (checked === null ? "اول فکر کن، بعد جواب بده" : "جواب و راه‌حل روی صفحه است؛ «نمونه تازه» را بزن") : area === "cards" ? (builtStr ? <>عدد: {numFa(builtStr)}</> : "یک کارت را بزن تا در اولین خانه خالی بنشیند") : caption}
          </p>
        )}
      </section>

      <aside className={styles.side}>
        {mode !== "try" && (
          <div className={styles.chipsRow} role="radiogroup" aria-label="بخش">
            {(
              (mode === "explore"
                ? [
                    ["cards", "کارت رقم"],
                    ["match", "چوب‌کبریت"],
                  ]
                : [
                    ["count", "شمارش رقم"],
                    ["match", "چوب‌کبریت"],
                  ]) as [Area, string][]
            ).map(([a, label]) => (
              <button
                key={a}
                role="radio"
                aria-checked={area === a}
                onClick={() => {
                  setArea(a);
                  setLifted(null);
                  if (mode === "show") animate(a === "match" ? 2600 * puzzle.moves : 7000);
                  else {
                    setRun(null);
                    setF(1);
                  }
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {mode === "explore" && area === "cards" && (
          <>
            <h2 className={styles.progress}>۱. کارت‌ها</h2>
            <div className={styles.chipsRow} role="radiogroup" aria-label="تعداد کارت">
              {[3, 4, 5].map((k) => (
                <button
                  key={k}
                  role="radio"
                  aria-checked={hand.length === k}
                  onClick={() => {
                    setHand(newHand(k));
                    setPlaced([]);
                    setCardMsg(null);
                  }}
                >
                  {fa(k)} کارت
                </button>
              ))}
            </div>
            <div className={styles.row} style={{ marginTop: 6 }}>
              <button
                className={styles.clear}
                onClick={() => {
                  setHand(newHand(hand.length));
                  setPlaced([]);
                  setCardMsg(null);
                }}
              >
                کارت‌های تازه
              </button>
              <button className={styles.clear} onClick={() => setPlaced([])} disabled={!placed.length}>
                برگرداندن همه
              </button>
            </div>
            <p className={styles.note}>روی کارت پایین بزن تا در اولین خانه خالی بنشیند؛ روی کارت بالا بزن تا برگردد. زیر هر خانه، ارزش مکانی رقم نوشته می‌شود.</p>

            <h2 className={styles.progress}>۲. شرط (اختیاری)</h2>
            <div className={styles.chipsRow} role="radiogroup" aria-label="شرط" style={{ flexWrap: "wrap" }}>
              {([null, "even", "odd", "div3", "div4", "div5", "div9"] as (Cond | null)[]).map((c) => (
                <button key={c ?? "none"} role="radio" aria-checked={cond === c} onClick={() => setCond(c)} style={{ flex: "1 0 28%" }}>
                  {c ? COND_FA[c].replace("بخش‌پذیر ", "") : "بی‌شرط"}
                </button>
              ))}
            </div>
            {cond && <p className={styles.note}>{COND_RULE[cond]}.</p>}
            <div className={styles.row}>
              <button className={styles.clear} onClick={() => autoBuild("max")}>
                بزرگ‌ترین را بچین
              </button>
              <button className={styles.clear} onClick={() => autoBuild("min")}>
                کوچک‌ترین را بچین
              </button>
            </div>
            {cardMsg && <p className={`${styles.status} ${styles.warn}`}>{cardMsg}</p>}
            <CardFacts s={builtStr} total={hand.length} />
          </>
        )}

        {mode === "explore" && area === "match" && (
          <>
            <h2 className={styles.progress}>چوب‌ها را جابه‌جا کن</h2>
            <p className={styles.note}>روی یک چوب بزن تا بلند شود (بالا می‌رود و دورش خط می‌افتد)، بعد روی یک جای خالی خط‌چین بزن. علامت = ثابت است.</p>
            <MatchKnobs level={exLevel} onLevel={(l) => freshPuzzle(l)} onNew={() => freshPuzzle()} />
            <button
              className={styles.clear}
              style={{ marginTop: 6 }}
              onClick={() => {
                setExSticks(null);
                setLifted(null);
                setStickMsg(null);
              }}
            >
              از نو
            </button>
            {stickMsg && <p className={`${styles.status} ${styles.warn}`}>{stickMsg}</p>}
            <p className={`${styles.status} ${readEquation(puzzle.lens, sticksNow)?.holds ? styles.good : styles.info}`}>
              {caption} · جابه‌جایی‌ها: {fa(stickDiff(puzzle.start, sticksNow).removed)}
            </p>
            <p className={styles.note}>
              معما: {equationFa(puzzle, puzzle.start)} — با {fa(puzzle.moves)} جابه‌جایی درست می‌شود. راه‌حل را در «نشانم بده» ببین.
            </p>
            <p className={styles.note}>رقم‌های چوب‌کبریتی همان شکل‌های هفت‌خطی کتاب‌های معما هستند (رقم‌های لاتین)؛ رقم‌های فارسی با چوب ساخته نمی‌شوند.</p>
          </>
        )}

        {mode === "show" && area === "count" && (
          <>
            <h2>شمارش رقم، جایگاه به جایگاه</h2>
            <p className={styles.note}>هر جایگاه را جدا بشمار: اول یکان، بعد دهگان، بعد صدگان. عددی مثل ۱۱ دو بار شمرده می‌شود (یک بار در یکان، یک بار در دهگان).</p>
            <div className={styles.chipsRow} role="radiogroup" aria-label="رقم" style={{ flexWrap: "wrap" }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                <button key={d} role="radio" aria-checked={countD === d} onClick={() => setCountD(d)} style={{ flex: "1 0 18%" }}>
                  {fa(d)}
                </button>
              ))}
            </div>
            <div className={styles.row} style={{ marginTop: 6 }}>
              <button className={styles.clear} onClick={() => setCountN(Math.max(1, countN - 100))}>−۱۰۰</button>
              <button className={styles.clear} onClick={() => setCountN(Math.max(1, countN - 10))}>−۱۰</button>
              <span className={styles.stepperLabel}>تا {fa(countN)}</span>
              <button className={styles.clear} onClick={() => setCountN(Math.min(1000, countN + 10))}>+۱۰</button>
              <button className={styles.clear} onClick={() => setCountN(Math.min(1000, countN + 100))}>+۱۰۰</button>
            </div>
            {countN >= 100 && (
              <>
                <h2 className={styles.progress}>کدام صدتایی روی صفحه باشد؟</h2>
                <div className={styles.chipsRow} role="radiogroup" aria-label="صدتایی" style={{ flexWrap: "wrap" }}>
                  {Array.from({ length: Math.floor(countN / 100) + 1 }, (_, b) => (
                    <button key={b} role="radio" aria-checked={block === b} onClick={() => setBlock(b)} style={{ flex: "1 0 18%" }}>
                      {fa(b * 100)}
                    </button>
                  ))}
                </div>
              </>
            )}
            <table className={styles.countTable}>
              <tbody>
                {["یکان (مربع)", "دهگان (خط زیر)", "صدگان (دایره)"].map((name, p) => (
                  <tr key={name} aria-current={countPhase === p + 1 ? "step" : undefined}>
                    <td>{name}</td>
                    <td>{countPhase > p ? fa(counts[p]) : "…"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>جمع</td>
                  <td>{countPhase >= 3 ? fa(counts[0] + counts[1] + counts[2] + counts[3]) : "…"}</td>
                </tr>
              </tfoot>
            </table>
            <p className={styles.note}>در هر صدتایی کامل، رقم {fa(countD)} ده بار در یکان و ده بار در دهگان می‌آید. در صدگان، {fa(countD * 100)} تا {fa(countD * 100 + 99)} هر کدام یک بار.</p>
          </>
        )}

        {mode === "show" && area === "match" && (
          <>
            <h2>جابه‌جایی چوب</h2>
            <p className={styles.note}>
              معما: {equationFa(puzzle, puzzle.start)}. {puzzle.moves === 1 ? "یک چوب" : "دو چوب، یکی پس از دیگری،"} از جای قبلی بلند می‌شود و در جای خط‌چین می‌نشیند.
            </p>
            <p className={`${styles.status} ${styles.good}`}>جواب: {equationFa(puzzle, puzzle.answer)}</p>
            <MatchKnobs level={exLevel} onLevel={(l) => { freshPuzzle(l); animate(2600 * (l === 3 ? 2 : 1)); }} onNew={() => { freshPuzzle(); animate(2600 * (exLevel === 3 ? 2 : 1)); }} />
            <p className={styles.note}>این معما فقط همین یک جواب را دارد: همه جابه‌جایی‌های ممکن امتحان شده‌اند.</p>
          </>
        )}

        {mode === "try" && (
          <DigitsTryPanel
            key={`${tryType}-${tryLevel}-${seed}`}
            question={question}
            type={tryType}
            level={tryLevel}
            built={built.map((i) => ("cards" in question ? question.cards[i] : "")).join("")}
            sticks={trySticks ?? (question.type === "match" ? question.start : [])}
            onClear={() => {
              setBuilt([]);
              setTrySticks(null);
              setLifted(null);
              setStickMsg(null);
            }}
            checked={checked}
            onCheck={(v) => {
              setChecked(v);
              setLifted(null);
              if (question.type === "match" || question.type === "count") animate(tryMs(question));
              else setF(1);
            }}
            onType={(t) => freshQuestion(t, tryLevel)}
            onLevel={(l) => freshQuestion(tryType, l)}
            onNew={() => freshQuestion()}
          />
        )}
        {mode === "try" && stickMsg && <p className={`${styles.status} ${styles.warn}`}>{stickMsg}</p>}
      </aside>
    </main>
  );
}

function MatchKnobs({ level, onLevel, onNew }: { level: Level; onLevel: (l: Level) => void; onNew: () => void }) {
  return (
    <>
      <div className={styles.chipsRow} role="radiogroup" aria-label="نوع معما">
        {(
          [
            [1, "یک حرکت"],
            [2, "یک حرکت، دورقمی"],
            [3, "دو حرکت"],
          ] as [Level, string][]
        ).map(([l, label]) => (
          <button key={l} role="radio" aria-checked={level === l} onClick={() => onLevel(l)}>
            {label}
          </button>
        ))}
      </div>
      <button className={styles.clear} style={{ marginTop: 6 }} onClick={onNew}>
        معمای تازه
      </button>
    </>
  );
}

/** What the number on the cards says: digit sum and the divisibility tests. */
function CardFacts({ s, total }: { s: string; total: number }) {
  if (!s) return null;
  const n = Number(s);
  const lead = s.length > 1 && s[0] === "0";
  const tests: [Cond, string][] = [
    ["even", "زوج"],
    ["div3", "بر ۳"],
    ["div4", "بر ۴"],
    ["div5", "بر ۵"],
    ["div9", "بر ۹"],
  ];
  return (
    <>
      <h2 className={styles.progress}>عدد روی صفحه</h2>
      <p className={styles.stepText} style={{ fontSize: "1.6rem", textAlign: "center", margin: "4px 0" }}>
        <bdi dir="ltr">{fa(s)}</bdi>
      </p>
      {lead && <p className={`${styles.status} ${styles.warn}`}>⚠ عدد با صفر شروع شده؛ پس در واقع {fa(String(n).length)}رقمی است، نه {fa(s.length)}رقمی.</p>}
      {s.length < total && <p className={styles.note}>هنوز {fa(total - s.length)} کارت مانده.</p>}
      <table className={styles.countTable}>
        <tbody>
          <tr>
            <td>مجموع رقم‌ها</td>
            <td>
              <bdi dir="ltr">
                {s.split("").map((d) => fa(d)).join(" + ")} = {fa(digitSum(n))}
              </bdi>
            </td>
          </tr>
          {tests.map(([c, label]) => (
            <tr key={c}>
              <td>بخش‌پذیر {label === "زوج" ? "بر ۲ (زوج)" : label}</td>
              <td>{meets(n, c) ? "✓ بله" : "✗ نه"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/** The hundred chart and running counts (show me, and the answer to a counting question). */
function CountBoard({ digit, n, block, phase }: { digit: number; n: number; block: number; phase: number }) {
  const counts = placeCounts(digit, n);
  const lines = ["یکان", "دهگان", "صدگان"];
  return (
    <Board view={VIEW} imageName="digit-count" label={`شمارش رقم ${fa(digit)} از ۱ تا ${fa(n)}`}>
      <HundredChartG digit={digit} n={n} base={block * 100} phase={phase} x={0.4} y={0.5} />
      <text x={12.3} y={0.9} fontSize={0.42} fontWeight={700} textAnchor="middle" direction="rtl" dominantBaseline="central" fill="#1f2430">
        رقم {fa(digit)} در ۱ تا {fa(n)}
      </text>
      <text x={12.3} y={1.5} fontSize={0.3} textAnchor="middle" direction="rtl" dominantBaseline="central" fill="#5b6170">
        روی صفحه: {fa(Math.max(1, block * 100))} تا {fa(Math.min(n, block * 100 + 99))}
      </text>
      <ChartKeyG x={13.6} y={2.5} phase={phase} />
      {lines.map((name, p) => (
        <text key={name} x={12.3} y={4.4 + p * 0.75} fontSize={0.4} fontWeight={700} textAnchor="middle" direction="rtl" dominantBaseline="central" fill="#1f2430" opacity={phase > p ? 1 : 0.3}>
          {name}: {phase > p ? `${fa(counts[p])} بار` : "…"}
        </text>
      ))}
      <line x1={10.6} x2={14} y1={6.6} y2={6.6} stroke="#1f2430" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <text x={12.3} y={7.2} fontSize={0.5} fontWeight={700} textAnchor="middle" direction="rtl" dominantBaseline="central" fill="#1f2430" opacity={phase >= 3 ? 1 : 0.3}>
        جمع: {phase >= 3 ? `${fa(counts[0] + counts[1] + counts[2] + counts[3])} بار` : "؟"}
      </text>
      {counts[3] > 0 && phase >= 3 && (
        <text x={12.3} y={7.9} fontSize={0.28} textAnchor="middle" direction="rtl" dominantBaseline="central" fill="#5b6170">
          (با رقم هزارگانِ ۱۰۰۰)
        </text>
      )}
      <rect x={0.4} y={0.5} width={10 * CHART_CELL} height={10 * CHART_CELL} fill="none" stroke="#1f2430" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </Board>
  );
}

interface TryBoardProps {
  q: DigitsQuestion;
  built: number[];
  sticks: number[];
  checked: string | null;
  f: number;
  lifted: Spot | null;
  onBuilt: (b: number[]) => void;
  onTapStick: (s: Spot) => void;
  onTapSpot: (s: Spot) => void;
}

function TryBoard({ q, built, sticks, checked, f, lifted, onBuilt, onTapStick, onTapSpot }: TryBoardProps) {
  const done = checked !== null;
  const text = (s: string, y: number, size = 0.5, soft = false) => (
    <text x={8} y={y} fontSize={size} fontWeight={700} textAnchor="middle" direction="rtl" dominantBaseline="central" fill={soft ? "#5b6170" : "#1f2430"}>
      {s}
    </text>
  );
  switch (q.type) {
    case "extreme":
    case "condition": {
      if (q.type === "extreme" && q.want === "diff") {
        const e = extremes(q.cards);
        return (
          <Board view={VIEW} imageName="digits" label="کارت‌ها">
            {done ? (
              <>
                <CardsG slots={digitsOf(e.max)} places={false} cx={8} y={0.7} caption="بزرگ‌ترین" />
                <CardsG slots={digitsOf(e.min)} places={false} cx={8} y={3.6} caption="کوچک‌ترین" />
                {text(ltr(`${fa(e.max)} − ${fa(e.min)} = ${fa(q.answer)}`), 7.2, 0.7)}
                {checked !== String(q.answer) && text(`جواب تو: ${numFa(checked ?? "")}`, 8.2, 0.4, true)}
              </>
            ) : (
              <>
                <CardsG slots={q.cards} places={false} cx={8} y={1.4} caption="کارت‌ها" />
                {text("بزرگ‌ترین − کوچک‌ترین = ؟", 5.6, 0.6)}
              </>
            )}
          </Board>
        );
      }
      const need = q.type === "condition" ? q.use : q.cards.length;
      const shown = done ? digitsOf(q.answer) : Array.from({ length: need }, (_, i) => (i < built.length ? q.cards[built[i]] : null));
      const cap = done ? `جواب: ${numFa(q.answer)}${checked !== String(q.answer) ? `   (تو: ${numFa(checked ?? "")})` : ""}` : q.type === "condition" ? `${q.want === "max" ? "بزرگ‌ترین" : "کوچک‌ترین"} عدد ${COND_FA[q.cond]}` : `${q.want === "max" ? "بزرگ‌ترین" : "کوچک‌ترین"} عدد`;
      return (
        <Board view={VIEW} imageName="digits" label="کارت‌ها؛ روی کارت بزن">
          <CardsG
            slots={shown}
            hand={q.cards}
            used={q.cards.map((_, i) => !done && built.includes(i))}
            onHand={done ? undefined : (i) => built.length < need && onBuilt([...built, i])}
            onSlot={done ? undefined : (i) => onBuilt(built.filter((_, j) => j !== i))}
            cx={8}
            y={1.1}
            handY={6.3}
            caption={cap}
          />
        </Board>
      );
    }
    case "count":
      if (done) return <CountBoard digit={q.digit} n={q.n} block={0} phase={Math.min(3, Math.floor(f * 4))} />;
      return (
        <Board view={VIEW} imageName="digit-count" label="شمارش رقم">
          {text(ltr(`۱ ، ۲ ، ۳ ، … ، ${fa(q.n - 1)} ، ${fa(q.n)}`), 3, 0.8)}
          {text(`رقم ${fa(q.digit)} چند بار نوشته می‌شود؟`, 5, 0.6)}
          {text("راهنما: یکان، دهگان و صدگان را جدا بشمار.", 6.4, 0.38, true)}
        </Board>
      );
    case "digitSum": {
      const ds = digitsOf(q.answer);
      return (
        <Board view={VIEW} imageName="digit-sum" label="مجموع ارقام">
          {done ? (
            <>
              <RowG items={[...ds.flatMap((d, i) => [...(i ? [{ sign: "+" }] : []), { box: fa(d) }]), { sign: "=" }, { box: fa(q.sum) }]} cx={8} y={1.6} size={1.3} />
              {text(`جواب: ${numFa(q.answer)}`, 5.4, 0.7)}
              {checked !== String(q.answer) && text(`جواب تو: ${numFa(checked ?? "")} (مجموع رقم‌ها ${fa(digitSum(Number(checked)))})`, 6.5, 0.4, true)}
            </>
          ) : (
            <>
              {text(`مجموع رقم‌ها = ${fa(q.sum)}`, 3, 0.9)}
              {text(q.variant === "min" ? "کوچک‌ترین عدد؟" : q.variant === "min4" ? "کوچک‌ترین عدد چهاررقمی؟" : q.variant === "max4distinct" ? "بزرگ‌ترین عدد چهاررقمی، بی رقم تکراری؟" : "کوچک‌ترین عدد، بی رقم تکراری؟", 4.8, 0.55, true)}
            </>
          )}
        </Board>
      );
    }
    case "divisible": {
      const full = q.digits.map((d) => d ?? q.answer);
      return (
        <Board view={VIEW} imageName="divisible" label="رقم گمشده">
          <RowG items={q.digits.map((d) => (d === null ? { box: done ? fa(q.answer) : "؟", hole: true } : { box: fa(d) }))} cx={8} y={1.4} size={1.5} />
          {text(`بخش‌پذیر بر ${fa(q.divisor)}`, 4.6, 0.6)}
          {done && text(`مجموع رقم‌ها: ${ltr(`${full.map((d) => fa(d)).join(" + ")} = ${fa(digitSum(Number(full.join(""))))}`)}`, 5.8, 0.42, true)}
          {done && text(ltr(`${fa(full.join(""))} ÷ ${fa(q.divisor)} = ${fa(Number(full.join("")) / q.divisor)}`), 6.8, 0.5)}
        </Board>
      );
    }
    case "match": {
      const v = matchView(q.lens);
      const frame = done ? moveFrame(q.lens, q.start, q.answer, f) : null;
      const right = checked === q.answer.join(".");
      return (
        <Board view={v} imageName="matchsticks" label="چوب‌کبریت‌ها؛ روی چوب و بعد روی جای خالی بزن">
          <MatchG
            lens={q.lens}
            masks={frame ? frame.masks : sticks}
            x={0}
            y={0}
            spots={!done}
            lifted={done ? null : lifted}
            onStick={done ? undefined : onTapStick}
            onSpot={done ? undefined : onTapSpot}
            flying={frame?.flying}
            marks={frame && f < 1 ? frame.marks : undefined}
          />
          <text x={v[0] + v[2] / 2} y={SLOT_H + 0.65} fontSize={0.36} fontWeight={700} textAnchor="middle" direction="rtl" dominantBaseline="central" fill="#1f2430">
            {done ? `${f >= 1 ? "جواب" : "از معما به جواب"}: ${equationFa(q, q.answer)}${right ? " ✓" : `   (تو: ${(checked && equationFa(q, checked.split(".").map(Number))) || "شکل نادرست"})`}` : `${fa(q.moves)} جابه‌جایی`}
          </text>
        </Board>
      );
    }
  }
}

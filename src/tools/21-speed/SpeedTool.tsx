"use client";

// Tool 21: speed and accuracy (هوش سرعتی). Explore: find the copies with no
// clock. Show me: the row-by-row scan, comparing each shape with the target.
// Try it: timed questions; the clock counts up and never runs out.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Board } from "@/engine-2d/Board";
import { newSeed } from "@/generators/random";
import { countSlips, makeSpeedQuestion, relation, sameGlyph, speedMistake, type Level, type SpeedQuestion, type SpeedQuestionType, type SpeedTag } from "@/generators/speed";
import { practiceCheck, usePractice } from "@/practice/bridge";
import { setClassroom as applyClassroom, useClassroom } from "@/toolkit/classroom";
import { NumberPad } from "@/toolkit/NumberPad";
import { TeacherGuideButton } from "@/toolkit/TeacherGuide";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/ToolLayout.module.css";
import panel from "@/toolkit/TryPanel.module.css";
import { SPEED_ADAPTER } from "./adapter";
import { SPEED_GUIDE } from "./guide";
import { GlyphGrid, TargetCard, type CellMark } from "./Pictures";
import { SPEED_TYPE_LABEL } from "./practice";

type Mode = "explore" | "show" | "try";
type Answer = number[] | number;

const viewOf = (q: Pick<SpeedQuestion, "cols" | "rows">): [number, number, number, number] => [-0.2, -1.6, q.cols + 0.4, q.rows + 1.8];

const seconds = (ms: number) => fa(Math.round(ms / 100) / 10);

export function SpeedTool() {
  const [mode, setMode] = useState<Mode>("explore");
  const [classroom, setClassroom] = useClassroom();

  // Explore
  const [exLevel, setExLevel] = useState<Level>(2);
  const [exSeed, setExSeed] = useState(21);
  const [exTaps, setExTaps] = useState<number[]>([]);
  const [reveal, setReveal] = useState(false);
  const exQ = useMemo(() => makeSpeedQuestion("find", exLevel, exSeed), [exLevel, exSeed]);

  // Show me: the scan, one row at a time.
  const [scan, setScan] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setScan((s) => (s >= exQ.rows ? s : s + 1)), 1400);
    return () => clearInterval(t);
  }, [playing, exQ.rows]);
  const scanning = playing && scan < exQ.rows;

  // Try it
  const [type, setType] = useState<SpeedQuestionType>("find");
  const [level, setLevel] = useState<Level>(1);
  const [seed, setSeed] = useState(7);
  const [taps, setTaps] = useState<number[]>([]);
  const [count, setCount] = useState("");
  const [checked, setChecked] = useState<Answer | null>(null);
  const [started, setStarted] = useState(0);
  const [took, setTook] = useState(0);
  const [tick, setTick] = useState(0);
  const q = useMemo(() => makeSpeedQuestion(type, level, seed), [type, level, seed]);

  const fresh = (t = type, l = level, s = newSeed()) => {
    setType(t);
    setLevel(l);
    setSeed(s);
    setTaps([]);
    setCount("");
    setChecked(null);
    setStarted(Date.now());
    setTook(0);
  };

  const practice = usePractice(SPEED_ADAPTER, (t, l, s) => {
    setMode("try");
    fresh(t in SPEED_TYPE_LABEL ? (t as SpeedQuestionType) : "find", l === 1 || l === 2 || l === 3 ? l : 1, s);
  });

  // The clock counts up while a question is open.
  useEffect(() => {
    if (mode !== "try" || checked !== null) return;
    const t = setInterval(() => setTick(Date.now()), 250);
    return () => clearInterval(t);
  }, [mode, checked]);

  // Shareable links: #try=find&level=2&seed=7, #explore&level=3&seed=4, #show, #classroom
  useEffect(() => {
    const p = new URLSearchParams(window.location.hash.slice(1));
    if (p.has("classroom")) applyClassroom(true);
    const timer = setTimeout(() => {
      const lv = Number(p.get("level"));
      const okLevel = lv === 1 || lv === 2 || lv === 3 ? (lv as Level) : null;
      const sd = Number(p.get("seed"));
      const okSeed = p.has("seed") && Number.isInteger(sd) && sd >= 0 ? sd : null;
      const t = p.get("try");
      if (t !== null) {
        setMode("try");
        fresh(t in SPEED_TYPE_LABEL ? (t as SpeedQuestionType) : "find", okLevel ?? 1, okSeed ?? 7);
      } else if (p.has("show") || p.has("explore")) {
        setMode(p.has("show") ? "show" : "explore");
        if (okLevel) setExLevel(okLevel);
        if (okSeed !== null) setExSeed(okSeed);
      }
    }, 0);
    return () => clearTimeout(timer);
    // Read once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchMode = (m: Mode) => {
    setMode(m);
    setPlaying(false);
    setScan(m === "show" ? 0 : exQ.rows);
    if (m === "try") fresh(type, level, seed);
  };

  const check = () => {
    const answer: Answer = type === "count" ? Number(count) : taps.length === 1 && type === "differ" ? taps[0] : [...taps].sort((a, b) => a - b);
    setChecked(answer);
    setTook(Date.now() - started);
    void practiceCheck(SPEED_ADAPTER, answer);
  };

  const tag: SpeedTag | null = checked === null ? null : speedMistake(q, checked);
  const exam = practice.exam;
  const done = checked !== null;
  const reviewMarks = done && !exam;

  const tryMarks = (i: number): CellMark => {
    if (type === "count") return reviewMarks && sameGlyph(q.grid[i], q.target) ? "found" : null;
    const want = type === "find" ? (q.answer as number[]).includes(i) : q.answer === i;
    const tapped = taps.includes(i);
    if (!reviewMarks) return tapped ? "tapped" : null;
    if (tapped) return want ? "right" : "wrong";
    return want ? "missed" : null;
  };

  const tap = (i: number) => {
    if (done) return;
    if (type === "differ") setTaps([i]);
    else if (type === "find") setTaps(taps.includes(i) ? taps.filter((x) => x !== i) : [...taps, i]);
  };

  let board: React.ReactNode;
  if (mode === "try") {
    board = (
      <Board view={viewOf(q)} imageName="speed" label="شبکه شکل‌ها">
        <text x={q.cols - 0.2} y={-0.65} fontSize={0.42} fontWeight={700} textAnchor="start" direction="rtl">
          {type === "differ" ? "همه شبیه این‌اند جز یکی:" : "هدف:"}
        </text>
        <TargetCard g={q.target} x={type === "differ" ? 1 : 2.2} y={-0.75} />
        <GlyphGrid q={q} marks={tryMarks} onTap={type === "count" ? undefined : tap} label="شکل‌ها" />
      </Board>
    );
  } else {
    const shownRows = mode === "show" ? scan : exQ.rows;
    board = (
      <Board view={viewOf(exQ)} imageName="speed" label="شبکه شکل‌ها">
        <text x={exQ.cols - 0.2} y={-0.65} fontSize={0.42} fontWeight={700} textAnchor="start" direction="rtl">
          هدف:
        </text>
        <TargetCard g={exQ.target} x={2.2} y={-0.75} />
        <GlyphGrid
          q={exQ}
          scanRow={mode === "show" && scan > 0 ? scan - 1 : undefined}
          marks={(i) => {
            const isTarget = sameGlyph(exQ.grid[i], exQ.target);
            if (mode === "show") return isTarget && Math.floor(i / exQ.cols) < shownRows ? "found" : null;
            if (exTaps.includes(i)) return reveal ? (isTarget ? "right" : "wrong") : "tapped";
            return reveal && isTarget ? "missed" : null;
          }}
          onTap={mode === "explore" ? (i) => setExTaps(exTaps.includes(i) ? exTaps.filter((x) => x !== i) : [...exTaps, i]) : undefined}
        />
      </Board>
    );
  }

  const exRight = exTaps.filter((i) => sameGlyph(exQ.grid[i], exQ.target)).length;
  const exTotal = (exQ.answer as number[]).length;
  const elapsed = done ? took : Math.max(0, tick - started);
  const scanText =
    mode === "show"
      ? scan === 0
        ? "▶ را بزن: ردیف به ردیف، از راست به چپ، هر شکل را با هدف مقایسه می‌کنیم."
        : scan >= exQ.rows
          ? `تمام شد: ${fa(exTotal)} شکل درست مثل هدف. شکل‌های چرخیده یا آینه‌ای علامت نخوردند.`
          : `ردیف ${fa(scan)}: ${fa(exQ.grid.slice((scan - 1) * exQ.cols, scan * exQ.cols).filter((g) => sameGlyph(g, exQ.target)).length)} شکل درست مثل هدف.`
      : "";

  return (
    <main className={styles.layout}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          → همه ابزارها
        </Link>
        <h1>
          <span className={styles.badge}>{fa(21)}</span> سرعت و دقت
        </h1>
        <div className={styles.tabs} role="tablist" aria-label="حالت ابزار">
          <button role="tab" aria-selected={mode === "explore"} onClick={() => switchMode("explore")}>
            کشف: بدون عجله
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
          <TeacherGuideButton guide={SPEED_GUIDE} />
        </div>
      </header>

      <section className={styles.stageWrap} aria-label="صفحه سرعت و دقت">
        {board}
      </section>

      <section className={styles.controls}>
        {mode === "show" ? (
          <>
            <div className={styles.buttons}>
              <button
                onClick={() => {
                  if (scan >= exQ.rows) setScan(0);
                  setPlaying(!scanning);
                }}
              >
                {scanning ? "⏸ توقف" : scan >= exQ.rows ? "↺ از اول" : "▶ پخش"}
              </button>
              <button onClick={() => setScan(Math.min(exQ.rows, scan + 1))} disabled={scan >= exQ.rows}>
                ردیف بعد
              </button>
            </div>
            <p className={styles.stepText} style={{ margin: 0 }}>
              {scanText}
            </p>
          </>
        ) : (
          <p className={styles.stepText} style={{ margin: 0 }}>
            {mode === "try" ? (
              <>
                ⏱ {seconds(elapsed)} ثانیه {done ? "" : "· عجله نکن؛ دقت مهم‌تر است"}
              </>
            ) : (
              `${fa(exTaps.length)} شکل را علامت زدی.`
            )}
          </p>
        )}
      </section>

      <aside className={styles.side}>
        {mode !== "try" && (
          <>
            <div className={panel.chips} role="radiogroup" aria-label="سطح">
              {([1, 2, 3] as Level[]).map((l) => (
                <button
                  key={l}
                  role="radio"
                  aria-checked={exLevel === l}
                  onClick={() => {
                    setExLevel(l);
                    setExTaps([]);
                    setReveal(false);
                    setScan(mode === "show" ? 0 : exQ.rows);
                    setPlaying(false);
                  }}
                >
                  سطح {fa(l)}
                </button>
              ))}
            </div>
            <p className={styles.note}>
              {exLevel === 1 ? "سطح ۱: شکل‌های متفاوت." : exLevel === 2 ? "سطح ۲: همان شکل، چرخیده؛ فقط جهتِ درست حساب است." : "سطح ۳: چرخیده و آینه‌ای (برعکس)؛ آینه‌ای همان شکل نیست."}
            </p>
          </>
        )}

        {mode === "explore" && (
          <>
            <h2>همه شکل‌هایی را که درست مثل هدف‌اند علامت بزن</h2>
            <p className={styles.note}>اینجا ساعت نیست. وقتی تمام شد «ببینم» را بزن.</p>
            <div className={styles.row}>
              <button className={styles.toggle} aria-pressed={reveal} onClick={() => setReveal(!reveal)}>
                {reveal ? "✓ " : ""}ببینم
              </button>
              <button
                className={styles.toggle}
                onClick={() => {
                  setExSeed(newSeed());
                  setExTaps([]);
                  setReveal(false);
                }}
              >
                شبکه تازه
              </button>
            </div>
            {reveal && (
              <p className={`${styles.status} ${exRight === exTotal && exTaps.length === exTotal ? styles.good : styles.info}`}>
                {fa(exRight)} از {fa(exTotal)} را پیدا کردی{exTaps.length > exRight ? `؛ ${fa(exTaps.length - exRight)} علامت (✗) روی شکل چرخیده یا آینه‌ای یا دیگر است` : ""}. علامت «؟» یعنی جا افتاده.
              </p>
            )}
          </>
        )}

        {mode === "show" && (
          <>
            <h2>جست‌وجوی منظم</h2>
            <p className={styles.note}>چشم‌ها اگر بی‌نظم بگردند، چند شکل را دو بار می‌بینند و چند تا را هیچ‌وقت. نوار زرد ردیف به ردیف جلو می‌رود و در هر ردیف فقط شکل‌هایی که درست مثل هدف‌اند علامت ✓ می‌خورند.</p>
            <p className={styles.note}>برای مقایسه، به یک جزء کوچک نگاه کن (مثلاً بازوی کوتاه پرچم): در هدف به کدام طرف است؟</p>
          </>
        )}

        {mode === "try" && (
          <div className={panel.panel}>
            <div className={panel.types} role="radiogroup" aria-label="نوع پرسش" data-practice-hide>
              {(Object.keys(SPEED_TYPE_LABEL) as SpeedQuestionType[]).map((t) => (
                <button key={t} role="radio" aria-checked={type === t} onClick={() => fresh(t, level)}>
                  {SPEED_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            <div className={panel.chips} role="radiogroup" aria-label="سطح" data-practice-hide>
              {([1, 2, 3] as Level[]).map((l) => (
                <button key={l} role="radio" aria-checked={level === l} onClick={() => fresh(type, l)}>
                  سطح {fa(l)}
                </button>
              ))}
            </div>

            <p className={panel.prompt}>
              {type === "find"
                ? "روی همه شکل‌هایی بزن که درست مثل هدف‌اند (نه چرخیده، نه آینه‌ای)."
                : type === "count"
                  ? "چند شکل درست مثل هدف هست؟"
                  : "یکی از شکل‌ها با بقیه فرق دارد. رویش بزن."}
            </p>

            {type === "count" && <NumberPad value={count} onChange={setCount} disabled={done} />}
            {type === "find" && !done && <p className={panel.hint}>{fa(taps.length)} شکل علامت زدی. برای برداشتن علامت، دوباره بزن.</p>}

            {!done && (
              <button className={panel.secondary} disabled={type === "count" ? !count : taps.length === 0} onClick={check}>
                بررسی
              </button>
            )}

            {done && !exam && tag && <Feedback q={q} tag={tag} took={took} answer={checked!} />}

            <button className={panel.next} onClick={() => fresh()}>
              نمونه تازه
            </button>
          </div>
        )}
      </aside>
    </main>
  );
}

function Feedback({ q, tag, took, answer }: { q: SpeedQuestion; tag: SpeedTag; took: number; answer: Answer }) {
  const time = `در ${seconds(took)} ثانیه`;
  const total = q.type === "find" ? (q.answer as number[]).length : (q.answer as number);
  let text: string;
  let tone: "good" | "turned" | "bad" = "turned";
  switch (tag) {
    case "right":
      tone = "good";
      text = `درست است، ${time}! ${q.type === "differ" ? "شکل متفاوت را پیدا کردی." : `${fa(total)} شکل درست مثل هدف.`}`;
      break;
    case "mirror":
      text = `نزدیک بود! شکل آینه‌ای (برعکس) هم حساب شد؛ بازوی کوتاهش طرف دیگر است. ${q.type === "count" ? `جواب ${fa(total)} است.` : "علامت ✗ روی آن‌هاست."}`;
      break;
    case "rotated":
      text = `نزدیک بود! شکل چرخیده هم حساب شد؛ فقط جهتِ درست قبول است. ${q.type === "count" ? `جواب ${fa(total)} است.` : "علامت ✗ روی آن‌هاست."}`;
      break;
    case "missed":
      text = `خوب بود، ولی ${fa(total - (answer as number[]).length)} تا جا افتاد (علامت «؟»). ردیف به ردیف بگرد.`;
      break;
    case "careless":
      text = "روی شکلی زدی که اصلاً مثل هدف نیست؛ عجله نکن. علامت ✗ روی آن‌هاست.";
      break;
    case "offByOne":
      text = `یکی ${(answer as number) > total ? "زیاد" : "کم"} شمردی؛ جواب ${fa(total)} است. عدد هر ردیف را جدا بنویس و جمع کن.`;
      break;
    default:
      tone = "bad";
      text = q.type === "differ" ? "این شکل همان هدف است. شکل متفاوت با «؟» نشان داده شده." : q.type === "count" ? `جواب ${fa(total)} است. ${countHint(q)}` : "چند شکل اشتباه و چند شکل جاافتاده دارد؛ علامت‌ها را ببین.";
  }
  const icon = tone === "good" ? "✓" : tone === "turned" ? "↻" : "✗";
  return (
    <p className={`${panel.feedback} ${panel[tone]}`} role="status" aria-live="polite">
      <span className={panel.icon}>{icon}</span> {text}
    </p>
  );
}

/** Where the count went wrong, if a look-alike explains it. */
function countHint(q: SpeedQuestion) {
  const kinds = q.grid.map((g) => relation(g, q.target));
  const mirrors = kinds.filter((k) => k === "mirror").length;
  return mirrors ? `${fa(mirrors)} شکل آینه‌ای هم در شبکه هست؛ آن‌ها حساب نمی‌شوند.` : countSlips(q).length > 1 ? "شکل‌های چرخیده حساب نمی‌شوند." : "";
}

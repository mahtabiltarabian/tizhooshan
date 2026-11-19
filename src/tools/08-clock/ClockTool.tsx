"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Board } from "@/engine-2d/Board";
import {
  angleBetween,
  answerKind,
  dateOf,
  dayOfYear,
  handAngles,
  hm,
  makeClockQuestion,
  mirrorOf,
  MONTHS,
  WEEKDAYS,
  wrap7,
  type ClockQuestion,
  type ClockQuestionType,
  type DateRef,
  type Level,
} from "@/generators/clock";
import { newSeed } from "@/generators/random";
import { setClassroom as applyClassroom, useClassroom } from "@/toolkit/classroom";
import { TeacherGuideButton } from "@/toolkit/TeacherGuide";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/ToolLayout.module.css";
import { CLOCK_TYPE_LABEL, ClockTryPanel } from "./ClockTryPanel";
import { CLOCK_GUIDE } from "./guide";
import { ClockG, timeFa, WeekG, weekHeight } from "./Pictures";

type Mode = "explore" | "show" | "try";
type Area = "clock" | "calendar";

const VIEW: [number, number, number, number] = [0, 0, 16, 9];
const weekView = (weekday: number, lo: number, hi: number): [number, number, number, number] => [-0.3, -0.25, 7.6, weekHeight(weekday, lo, hi) + 0.5];

/** Signed minutes the answer clock runs from the start clock to the answer. */
function runOf(q: ClockQuestion): { from: number; by: number } | null {
  switch (q.type) {
    case "elapsed":
      return { from: q.start, by: q.back ? -q.minutes : q.minutes };
    case "drift": {
      const s = q.fast ? 1 : -1;
      if (q.variant === "offset") return { from: q.start, by: -s * q.rate };
      if (q.variant === "perDay") return { from: q.start, by: s * q.rate * q.span };
      return { from: q.start, by: 60 * q.span + s * q.rate * q.span };
    }
    default:
      return null;
  }
}

/** Caption of the clock on the right in a time question. */
function startCaption(q: ClockQuestion) {
  if (q.type === "elapsed") return `اکنون: ${timeFa(q.start)}`;
  if (q.type === "drift") return q.variant === "offset" ? `نشان می‌دهد: ${timeFa(q.start)}` : `تنظیم درست: ${timeFa(q.start)}`;
  return "در آینه";
}

/** Day questions as a calendar: day 0 is the start, the target is the answer day. */
function calendarOf(q: ClockQuestion) {
  if (q.type === "weekday") return { weekday: q.start, target: q.back ? -q.days : q.days, doy: undefined };
  if (q.type === "month") return { weekday: q.weekday, target: q.days, doy: dayOfYear(q.from.m, q.from.d) };
  return null;
}

export function ClockTool() {
  const [mode, setMode] = useState<Mode>("explore");
  const [classroom, setClassroom] = useClassroom();

  // Playback 0 … 1.
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
  const animate = useCallback((ms: number, from = 0) => {
    setF(from);
    setRun({ from, ms: ms * (1 - from) });
  }, []);

  // Explore and show me
  const [area, setArea] = useState<Area>("clock");
  const [time, setTime] = useState(3 * 60 + 30);
  const [showAngle, setShowAngle] = useState(true);
  const [showMirror, setShowMirror] = useState(false);
  const [from, setFrom] = useState<DateRef>({ m: 6, d: 1 });
  const [weekday, setWeekday] = useState(2);
  const [jump, setJump] = useState(30);

  // Try it
  const [tryType, setTryType] = useState<ClockQuestionType>("angle");
  const [tryLevel, setTryLevel] = useState<Level>(1);
  const [seed, setSeed] = useState(808);
  const [answerTime, setAnswerTime] = useState(0);
  const [checked, setChecked] = useState<number | null>(null);
  const question = useMemo(() => makeClockQuestion(tryType, tryLevel, seed), [tryType, tryLevel, seed]);

  const showMs = area === "clock" ? 9000 : Math.min(9000, 1200 + 350 * (Math.floor(Math.abs(jump) / 7) + (Math.abs(jump) % 7)));
  const tryMs = (q: ClockQuestion) => (answerKind(q.type) === "day" ? Math.min(9000, 1200 + 350 * (Math.floor(Math.abs(calendarOf(q)!.target) / 7) + (Math.abs(calendarOf(q)!.target) % 7))) : 4000);

  // Shareable links: #try=angle&level=2&seed=7(&a=75), #show=clock-210 or #show=cal-6-1-2-30, #f=0.5, #classroom
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.has("classroom")) applyClassroom(true);
    const tryParam = params.get("try");
    const show = params.get("show");
    const timer = setTimeout(() => {
      if (tryParam) {
        setMode("try");
        if (tryParam in CLOCK_TYPE_LABEL) setTryType(tryParam as ClockQuestionType);
        const lv = Number(params.get("level"));
        if (lv === 1 || lv === 2 || lv === 3) setTryLevel(lv);
        const sd = Number(params.get("seed"));
        if (Number.isInteger(sd) && sd >= 0) setSeed(sd);
        const a = Number(params.get("a"));
        if (params.has("a") && Number.isInteger(a)) {
          setAnswerTime(a);
          setChecked(a);
          setF(1);
        } else setF(0);
      } else if (show) {
        const [kind, ...rest] = show.split("-").map((x, i) => (i ? Number(x) : x));
        if (kind === "clock") {
          setArea("clock");
          setTime(Number(rest[0]) || 0);
        } else if (kind === "cal") {
          const [m, d, w, n] = rest as number[];
          setArea("calendar");
          if (m >= 0 && m < 12) setFrom({ m, d: Math.min(MONTHS[m].days, Math.max(1, d || 1)) });
          if (w >= 0 && w < 7) setWeekday(w);
          if (Number.isFinite(n)) setJump(Math.max(-400, Math.min(400, n)));
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
    setRun(null);
    setF(m === "try" ? 0 : 1);
  };

  const freshQuestion = (type = tryType, level = tryLevel) => {
    setTryType(type);
    setTryLevel(level);
    setSeed(newSeed());
    setAnswerTime(0);
    setChecked(null);
    setRun(null);
    setF(0);
  };

  const play = (ms: number) => {
    if (run) return setRun(null);
    animate(ms, f >= 0.99 ? 0 : f);
  };

  // Show me: one hour from the explore hour, minute by minute.
  const baseHour = Math.floor(time / 60) * 60;
  const showT = baseHour + 60 * f;
  const lo = Math.min(0, jump);
  const hi = Math.max(0, jump);
  const doy = dayOfYear(from.m, from.d);
  const landed = dateOf(doy + jump);

  let board: React.ReactNode;
  if (mode !== "try") {
    if (area === "calendar")
      board = (
        <Board view={weekView(weekday, lo, hi)} imageName="calendar" label="تقویم هفتگی">
          <WeekG weekday={weekday} lo={lo} hi={hi} doy={doy} target={jump} hops={mode === "show" ? f : 1} x={0} y={0} />
        </Board>
      );
    else if (mode === "show")
      board = (
        <Board view={VIEW} imageName="clock" label="ساعت">
          <ClockG t={showT} cx={8} cy={4.3} r={3.9} wedge caption={timeFa(showT)} />
        </Board>
      );
    else
      board = (
        <Board view={VIEW} imageName="clock" label="ساعت؛ عقربه‌ها را بکش">
          {showMirror ? (
            <>
              <ClockG t={time} cx={11.6} cy={4.1} r={3.3} wedge={showAngle} caption={`ساعت: ${timeFa(time)}`} onTime={setTime} />
              <line x1={8} y1={0.4} x2={8} y2={8.4} stroke="#9fc3ff" strokeWidth={6} strokeDasharray="2 6" vectorEffect="non-scaling-stroke" />
              <text x={8} y={8.7} fontSize={0.4} fontWeight={700} textAnchor="middle" fill="#5b6170">
                آینه
              </text>
              <ClockG t={time} cx={4.4} cy={4.1} r={3.3} mirrored caption={`در آینه، مثل ${timeFa(mirrorOf(time))}`} />
            </>
          ) : (
            <ClockG t={time} cx={8} cy={4.3} r={3.9} wedge={showAngle} caption={timeFa(time)} onTime={setTime} />
          )}
        </Board>
      );
  } else {
    const q = question;
    const cal = calendarOf(q);
    const done = checked !== null;
    if (cal && !done) {
      // Before the answer, only the start week: the full calendar would show the answer's column.
      const [wlo, whi] = [-cal.weekday, 6 - cal.weekday];
      const [vx, vy, vw, vh] = weekView(cal.weekday, wlo, whi);
      board = (
        <Board view={[vx, vy, vw, vh + 1.4]} imageName="calendar" label="تقویم">
          <WeekG weekday={cal.weekday} lo={wlo} hi={whi} doy={cal.doy} x={0} y={0} />
          <text x={3.5} y={vh + 0.4} fontSize={0.42} fontWeight={700} textAnchor="middle" fill="#1f2430">
            {q.type === "month" ? `${fa(q.to.d)} ${MONTHS[q.to.m].name}: ؟` : q.type === "weekday" ? `${fa(q.days)} روز ${q.back ? "پیش" : "بعد"}: ؟` : ""}
          </text>
        </Board>
      );
    } else if (cal) {
      const qlo = Math.min(0, cal.target);
      const qhi = Math.max(0, cal.target);
      board = (
        <Board view={weekView(cal.weekday, qlo, qhi)} imageName="calendar" label="تقویم">
          <WeekG weekday={cal.weekday} lo={qlo} hi={qhi} doy={cal.doy} target={cal.target} hops={f} x={0} y={0} />
        </Board>
      );
    } else if (q.type === "angle") {
      const { h, m } = hm(q.time);
      const t = done ? (h % 12) * 60 + m * f : q.time;
      board = (
        <Board view={VIEW} imageName="clock" label="ساعت">
          <ClockG t={t} cx={8} cy={4.3} r={3.9} wedge={done} caption={timeFa(t)} />
        </Board>
      );
    } else {
      const r = runOf(q);
      const left = done ? (r ? r.from + r.by * f : q.answer) : answerTime;
      board = (
        <Board view={VIEW} imageName="clock" label="ساعت؛ عقربه‌های ساعت چپ را بکش">
          {q.type === "mirror" ? (
            <>
              <ClockG t={q.shown} cx={11.6} cy={4.1} r={3.3} squash={done ? -1 + 2 * f : -1} caption={done && f > 0.5 ? `ساعت واقعی: ${timeFa(q.answer)}` : "در آینه"} />
              <line x1={8} y1={0.4} x2={8} y2={8.4} stroke="#9fc3ff" strokeWidth={6} strokeDasharray="2 6" vectorEffect="non-scaling-stroke" />
            </>
          ) : (
            <ClockG t={r!.from} cx={11.6} cy={4.1} r={3.3} caption={startCaption(q)} />
          )}
          <ClockG
            t={done && q.type === "mirror" ? q.answer : left}
            cx={4.4}
            cy={4.1}
            r={3.3}
            onTime={done ? undefined : setAnswerTime}
            caption={done ? `جواب: ${timeFa(q.answer)}${checked !== null && ((checked % 720) + 720) % 720 !== q.answer ? ` (تو: ${timeFa(checked)})` : ""}` : `جواب تو: ${timeFa(answerTime)}`}
          />
        </Board>
      );
    }
  }

  const angles = handAngles(showT);
  const elapsedMin = Math.round(60 * f);
  const weeks = Math.floor(Math.abs(jump) / 7);
  const rest = Math.abs(jump) % 7;
  const landedDay = WEEKDAYS[wrap7(weekday + jump)];

  const calendarText = (
    <p className={styles.stepText}>
      <bdi dir="ltr">
        {fa(Math.abs(jump))} = ۷ × {fa(weeks)} + {fa(rest)}
      </bdi>
      : {fa(weeks)} هفته کامل باز {WEEKDAYS[weekday]}، بعد {fa(rest)} روز {jump < 0 ? "عقب" : "جلو"}: {landedDay}، {fa(landed.d)} {MONTHS[landed.m].name}.
    </p>
  );

  const inTry = mode === "try";
  const showSlider = mode === "show" || (inTry && checked !== null);

  return (
    <main className={styles.layout}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          → همه ابزارها
        </Link>
        <h1>
          <span className={styles.badge}>{fa(8)}</span> ساعت و تقویم
        </h1>
        <div className={styles.tabs} role="tablist" aria-label="حالت ابزار">
          <button role="tab" aria-selected={mode === "explore"} onClick={() => switchMode("explore")}>
            کشف: خودت بچرخان
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
          <TeacherGuideButton guide={CLOCK_GUIDE} />
          <Link href={`/tools/clock/worksheet?types=${tryType}&level=${tryLevel}`}>کاربرگ</Link>
        </div>
      </header>

      <section className={styles.stageWrap} aria-label="صفحه ساعت و تقویم">
        {board}
      </section>

      <section className={styles.controls}>
        {showSlider ? (
          <label className={styles.slider}>
            <button className={styles.playSmall} onClick={() => play(inTry ? tryMs(question) : showMs)} aria-label={run ? "توقف" : "پخش"}>
              {run ? "⏸" : "▶"}
            </button>
            <span>{mode === "show" && area === "clock" ? `${fa(elapsedMin)} دقیقه گذشت` : inTry && question.type === "mirror" ? "برگرداندن از آینه" : inTry && question.type === "angle" ? "از سر ساعت تا الان" : inTry && answerKind(question.type) === "time" ? "زمان واقعی" : "پرش‌ها"}</span>
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
            {inTry ? "اول فکر کن، بعد جواب بده" : area === "clock" ? `ساعت ${timeFa(time)} · زاویه بین عقربه‌ها ${fa(angleBetween(time))}°` : `${fa(Math.abs(jump))} روز ${jump < 0 ? "پیش" : "بعد"}: ${landedDay}`}
          </p>
        )}
      </section>

      <aside className={styles.side}>
        {mode !== "try" && (
          <div className={styles.chipsRow} role="radiogroup" aria-label="بخش">
            {(
              [
                ["clock", "ساعت"],
                ["calendar", "تقویم"],
              ] as [Area, string][]
            ).map(([a, label]) => (
              <button
                key={a}
                role="radio"
                aria-checked={area === a}
                onClick={() => {
                  setArea(a);
                  setRun(null);
                  setF(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {mode === "explore" && area === "clock" && (
          <>
            <h2 className={styles.progress}>عقربه‌ها را بچرخان</h2>
            <p className={styles.note}>عقربه بلند (دقیقه) را روی صفحه بکش؛ عقربه کوتاه (ساعت) هم آهسته با آن می‌رود. یا از دکمه‌ها کمک بگیر.</p>
            <TimeNudges time={time} onTime={setTime} />
            <div className={styles.row} style={{ marginTop: 8 }}>
              <button className={styles.toggle} aria-pressed={showAngle} onClick={() => setShowAngle(!showAngle)}>
                {showAngle ? "✓ " : ""}زاویه را نشان بده
              </button>
              <button className={styles.toggle} aria-pressed={showMirror} onClick={() => setShowMirror(!showMirror)}>
                {showMirror ? "✓ " : ""}ساعت در آینه
              </button>
            </div>
            <p className={styles.status + " " + styles.info}>
              زاویه بین عقربه‌ها: {fa(angleBetween(time))}°
              {showMirror && (
                <>
                  {" "}· در آینه شبیه {timeFa(mirrorOf(time))} است؛ با هم:{" "}
                  <bdi dir="ltr">
                    {timeFa(time)} + {timeFa(mirrorOf(time))} = ۱۲:۰۰
                  </bdi>
                </>
              )}
            </p>
            <button className={styles.clear} onClick={() => { setMode("show"); animate(showMs); }}>
              نشانم بده دو عقربه چطور با هم می‌روند
            </button>
          </>
        )}

        {mode === "explore" && area === "calendar" && (
          <>
            <h2 className={styles.progress}>۱. روز شروع</h2>
            <div className={styles.row}>
              <select value={from.m} onChange={(e) => setFrom({ m: Number(e.target.value), d: Math.min(from.d, MONTHS[Number(e.target.value)].days) })} aria-label="ماه" style={{ minHeight: 44, flex: 1 }}>
                {MONTHS.map((mo, i) => (
                  <option key={mo.name} value={i}>
                    {mo.name} ({fa(mo.days)} روز)
                  </option>
                ))}
              </select>
              <Stepper label={`روز ${fa(from.d)}`} onLess={() => setFrom({ ...from, d: from.d - 1 })} onMore={() => setFrom({ ...from, d: from.d + 1 })} lessOff={from.d <= 1} moreOff={from.d >= MONTHS[from.m].days} />
            </div>
            <div className={styles.chipsRow} role="radiogroup" aria-label="روز هفته" style={{ flexWrap: "wrap" }}>
              {WEEKDAYS.map((w, i) => (
                <button key={w} role="radio" aria-checked={weekday === i} onClick={() => setWeekday(i)} style={{ flex: "1 0 28%" }}>
                  {w}
                </button>
              ))}
            </div>

            <h2 className={styles.progress}>۲. چند روز بپر؟</h2>
            <div className={styles.row}>
              <button className={styles.clear} onClick={() => setJump(Math.max(-400, jump - 7))}>−۷</button>
              <Stepper label={`${fa(Math.abs(jump))} روز ${jump < 0 ? "پیش" : "بعد"}`} onLess={() => setJump(jump - 1)} onMore={() => setJump(jump + 1)} lessOff={jump <= -400} moreOff={jump >= 400} />
              <button className={styles.clear} onClick={() => setJump(Math.min(400, jump + 7))}>+۷</button>
            </div>
            {calendarText}
            <MonthTable />
          </>
        )}

        {mode === "show" && area === "clock" && (
          <>
            <h2>دو عقربه با هم</h2>
            <p className={styles.note}>در هر دقیقه، عقربه دقیقه ۶ درجه و عقربه ساعت فقط نیم درجه جلو می‌رود. در یک ساعت: ۳۶۰° و ۳۰°.</p>
            <table className={styles.countTable}>
              <tbody>
                <tr>
                  <td>دقیقه گذشته</td>
                  <td>{fa(elapsedMin)}</td>
                </tr>
                <tr>
                  <td>عقربه دقیقه (۶° در دقیقه)</td>
                  <td>{fa(Math.round(angles.minute * 10) / 10)}°</td>
                </tr>
                <tr>
                  <td>عقربه ساعت (۰٫۵° در دقیقه)</td>
                  <td>{fa(Math.round(angles.hour * 10) / 10)}°</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td>زاویه بین</td>
                  <td>{fa(Math.round(angleBetween(showT) * 10) / 10)}°</td>
                </tr>
              </tfoot>
            </table>
            <p className={styles.note}>زاویه‌ها از عدد ۱۲ و در جهت عقربه‌ها اندازه گرفته شده‌اند. ساعت شروع را در «کشف» عوض کن.</p>
          </>
        )}

        {mode === "show" && area === "calendar" && (
          <>
            <h2>شمارش هفته‌ای</h2>
            <p className={styles.note}>هر ۷ روز، باز همان روز هفته است. پس اول هفته‌های کامل را کنار بگذار (پرش‌های آبی)، بعد فقط روزهای باقی‌مانده را بشمار (پرش‌های خط‌چین قرمز).</p>
            {calendarText}
            <p className={styles.note}>
              از {fa(from.d)} {MONTHS[from.m].name}، {fa(Math.abs(jump))} روز {jump < 0 ? "پیش" : "بعد"} می‌شود {fa(landed.d)} {MONTHS[landed.m].name}.
            </p>
          </>
        )}

        {mode === "try" && (
          <ClockTryPanel
            key={`${tryType}-${tryLevel}-${seed}`}
            question={question}
            type={tryType}
            level={tryLevel}
            time={answerTime}
            onTime={setAnswerTime}
            checked={checked}
            onCheck={(v) => {
              setChecked(v);
              animate(tryMs(question));
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

function TimeNudges({ time, onTime }: { time: number; onTime: (t: number) => void }) {
  const nudge = (d: number) => onTime((((time + d) % 720) + 720) % 720);
  return (
    <>
      <p className={styles.stepText} style={{ fontSize: "1.6rem", textAlign: "center", margin: "4px 0" }}>
        {timeFa(time)}
      </p>
      <div className={styles.row}>
        <button className={styles.clear} onClick={() => nudge(60)}>+۱ ساعت</button>
        <button className={styles.clear} onClick={() => nudge(5)}>+۵ دقیقه</button>
        <button className={styles.clear} onClick={() => nudge(1)}>+۱ دقیقه</button>
      </div>
      <div className={styles.row} style={{ marginTop: 6 }}>
        <button className={styles.clear} onClick={() => nudge(-60)}>−۱ ساعت</button>
        <button className={styles.clear} onClick={() => nudge(-5)}>−۵ دقیقه</button>
        <button className={styles.clear} onClick={() => nudge(-1)}>−۱ دقیقه</button>
      </div>
    </>
  );
}

function MonthTable() {
  return (
    <>
      <h2 className={styles.progress}>روزهای ماه‌ها</h2>
      <p className={styles.note}>شش ماه اول ۳۱ روز، پنج ماه بعد ۳۰ روز، اسفند ۲۹ روز (در سال کبیسه ۳۰).</p>
      <table className={styles.countTable}>
        <tbody>
          {[0, 6].map((start) => (
            <tr key={start}>
              {MONTHS.slice(start, start + 6).map((m) => (
                <td key={m.name} style={{ fontSize: "0.78rem" }}>
                  {m.name}
                  <br />
                  {fa(m.days)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
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

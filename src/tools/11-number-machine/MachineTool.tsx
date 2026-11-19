"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Board } from "@/engine-2d/Board";
import {
  backRule,
  decodeMachine,
  decodeRule,
  lin,
  makeMachineQuestion,
  opValue,
  prod,
  sumTimes,
  trace,
  type Level,
  type MachineQuestion,
  type MachineQuestionType,
  type Op,
  type OpDef,
  type Rule,
} from "@/generators/number-machine";
import { newSeed } from "@/generators/random";
import { setClassroom as applyClassroom, useClassroom } from "@/toolkit/classroom";
import { TeacherGuideButton } from "@/toolkit/TeacherGuide";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/ToolLayout.module.css";
import { chainFa, numFa, OP_WORD, opCalcFa, opLines, ruleFa, stepFa, SYM } from "./format";
import { MACHINE_GUIDE } from "./guide";
import { builtOutputs, MACHINE_TYPE_LABEL, MachineTryPanel, operatorLines, type Answer } from "./MachineTryPanel";
import { ExamplesG, LinesG, MachineG, OpMachineG } from "./Pictures";

type Mode = "explore" | "show" | "try";
type Area = "machine" | "operator";
/** Operators to explore: □a + □b, □a − □b, (a + b) × □, a × b + □. */
type ExploreForm = "plus" | "minus" | "sumTimes" | "prod";

const VIEW: [number, number, number, number] = [0, 0, 16, 9];
const MAX_STEPS = 4;
const FORMS: [ExploreForm, string][] = [
  ["plus", "□a + □b"],
  ["minus", "□a − □b"],
  ["sumTimes", "(a + b) × □"],
  ["prod", "a × b + □"],
];

const exploreOp = (form: ExploreForm, p: number, q: number): OpDef =>
  form === "plus" ? lin(p, q) : form === "minus" ? lin(p, -q) : form === "sumTimes" ? sumTimes(p) : prod(0, 0, p);

/** Values at the machine's slots, input first; run backwards from the output when `back`. */
const slotValues = (num: number, rule: Rule, back: boolean) => (back ? [...trace(num, backRule(rule))].reverse() : trace(num, rule));

const clean = (vs: number[]) => vs.every((v) => Number.isInteger(v) && v >= 0);

/** Steps a question's machine has (for the length of its show). */
function stepsOf(q: MachineQuestion) {
  if (q.type === "run" || q.type === "reverse") return q.rule.length;
  if ((q.type === "guess" || q.type === "build") && q.machine.kind === "machine") return q.machine.rule.length;
  return 0;
}

/** Board lines of an operator question: the question, then the working once answered. */
function operatorBoardLines(q: MachineQuestion): string[] {
  if (q.type !== "operator") return [];
  return operatorLines(q).slice(1);
}

export function MachineTool() {
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

  // Explore and show me
  const [area, setArea] = useState<Area>("machine");
  const [rule, setRule] = useState<Rule>([
    { op: "+", n: 3 },
    { op: "×", n: 2 },
  ]);
  const [num, setNum] = useState(5);
  const [back, setBack] = useState(false);
  const [sel, setSel] = useState(0);
  const [form, setForm] = useState<ExploreForm>("plus");
  const [opP, setOpP] = useState(2);
  const [opQ, setOpQ] = useState(1);
  const [opA, setOpA] = useState(3);
  const [opB, setOpB] = useState(5);

  // Try it
  const [tryType, setTryType] = useState<MachineQuestionType>("run");
  const [tryLevel, setTryLevel] = useState<Level>(1);
  const [seed, setSeed] = useState(1111);
  const [exCount, setExCount] = useState<2 | 3 | 4>(3);
  const [division, setDivision] = useState(true);
  const [checked, setChecked] = useState<Answer | null>(null);
  const question = useMemo(() => makeMachineQuestion(tryType, tryLevel, seed, { examples: exCount, division }), [tryType, tryLevel, seed, exCount, division]);

  const op = exploreOp(form, opP, opQ);
  const showMs = area === "machine" ? 1300 * rule.length + 600 : 900 * opLines(op, opA, opB).length;
  const tryMs = (q: MachineQuestion) => (q.type === "operator" ? 900 * operatorBoardLines(q).length : stepsOf(q) ? 1300 * stepsOf(q) + 600 : 2000);

  // Shareable links: #try=guess&level=2&seed=7&ex=3&div=0(&a=19 or &a=m2.a3), #show=m-5-a3.m2 (r- backwards) or #show=o-plus-2-1-3-5, #f=0.5, #classroom
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.has("classroom")) applyClassroom(true);
    const tryParam = params.get("try");
    const show = params.get("show");
    const timer = setTimeout(() => {
      if (tryParam) {
        setMode("try");
        const type = tryParam in MACHINE_TYPE_LABEL ? (tryParam as MachineQuestionType) : "run";
        setTryType(type);
        const lv = Number(params.get("level"));
        if (lv === 1 || lv === 2 || lv === 3) setTryLevel(lv);
        const sd = Number(params.get("seed"));
        if (params.has("seed") && Number.isInteger(sd) && sd >= 0) setSeed(sd);
        const ex = Number(params.get("ex"));
        if (ex === 2 || ex === 3 || ex === 4) setExCount(ex);
        if (params.get("div") === "0") setDivision(false);
        const a = params.get("a");
        const answer: Answer | null = a === null ? null : type === "build" ? decodeMachine(a) : Number.isInteger(Number(a)) && a !== "" ? Number(a) : null;
        if (answer !== null) {
          setChecked(answer);
          setF(1);
        } else setF(0);
      } else if (show) {
        const [kind, ...rest] = show.split("-");
        if (kind === "m" || kind === "r") {
          setArea("machine");
          setBack(kind === "r");
          const v = Number(rest[0]);
          if (Number.isFinite(v)) setNum(Math.max(0, Math.min(999, Math.round(v))));
          const r = rest[1] ? decodeRule(rest[1]) : null;
          if (r) setRule(r);
        } else if (kind === "o") {
          setArea("operator");
          const fm = FORMS.find(([k]) => k === rest[0]);
          if (fm) setForm(fm[0]);
          const [p, q, a, b] = rest.slice(1).map(Number);
          if (p >= 0 && p <= 9) setOpP(p);
          if (q >= 0 && q <= 9) setOpQ(q);
          if (a >= 0 && a <= 20) setOpA(a);
          if (b >= 0 && b <= 20) setOpB(b);
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

  const freshQuestion = (o: { type?: MachineQuestionType; level?: Level; ex?: 2 | 3 | 4; div?: boolean } = {}) => {
    const level = o.level ?? tryLevel;
    setTryType(o.type ?? tryType);
    setTryLevel(level);
    setExCount(level === 3 && (o.ex ?? exCount) === 2 ? 3 : (o.ex ?? exCount));
    setDivision(o.div ?? division);
    setSeed(newSeed());
    setChecked(null);
    setRun(null);
    setF(0);
  };

  const play = (ms: number) => {
    if (run) return setRun(null);
    animate(ms, f >= 0.99 ? 0 : f);
  };

  // ── The board ──
  const values = slotValues(num, rule, back);
  const n = rule.length;
  let board: React.ReactNode;
  if (mode !== "try") {
    if (area === "machine") {
      const k = mode === "show" ? Math.min(n, Math.floor(f * n + 0.5)) : n;
      const chain = back ? chainFa(num, backRule(rule).slice(0, k)) : chainFa(num, rule.slice(0, k));
      board = (
        <Board view={VIEW} imageName="number-machine" label={back ? "ماشین اعداد، برعکس" : "ماشین اعداد"}>
          <MachineG steps={rule} values={values} token={mode === "show" ? f * n : undefined} back={back} cx={8} cy={3.4} width={15.4} />
          <LinesG lines={[chain]} shown={1} cx={8} y={6.9} size={0.55} />
        </Board>
      );
    } else {
      const lines = opLines(op, opA, opB);
      const shown = mode === "show" ? 1 + Math.round(f * (lines.length - 1)) : lines.length;
      const done = shown === lines.length;
      board = (
        <Board view={VIEW} imageName="operator" label="عملگر ستاره">
          <OpMachineG op={op} a={opA} b={opB} out={done ? opValue(op, opA, opB) : undefined} cx={8} cy={2.4} />
          <LinesG lines={lines} shown={shown} cx={8} y={4.7} size={0.6} />
        </Board>
      );
    }
  } else {
    const q = question;
    const done = checked !== null;
    const token = done ? f * stepsOf(q) : undefined;
    if (q.type === "run" || q.type === "reverse") {
      // Before the answer: the input (or "؟"), empty slots inside, "؟" (or the output) at the end.
      const last = q.rule.length;
      const vals: (number | null | undefined)[] = done
        ? trace(q.type === "run" ? q.input : q.answer, q.rule)
        : Array.from({ length: last + 1 }, (_, i) => (i === 0 ? (q.type === "run" ? q.input : null) : i === last ? (q.type === "run" ? null : q.output) : undefined));
      board = (
        <Board view={VIEW} imageName="number-machine" label="ماشین اعداد">
          <MachineG steps={q.rule} values={vals} token={token} back={q.type === "reverse" && done} cx={8} cy={3.8} width={15.4} />
        </Board>
      );
    } else if (q.type === "guess" || q.type === "build") {
      const mine = q.type === "build" && done && typeof checked === "object" ? builtOutputs(q, checked) : undefined;
      if (q.machine.kind === "machine") {
        const rule = q.machine.rule;
        const x = q.type === "guess" ? q.query[0] : q.examples[0].input[0];
        const vals: (number | null | undefined)[] = done ? trace(x, rule) : [x, ...rule.slice(1).map(() => undefined), q.type === "guess" ? null : q.examples[0].output];
        board = (
          <Board view={VIEW} imageName="number-machine" label="ماشین پنهان و مثال‌ها">
            <MachineG steps={done ? rule : rule.map(() => null)} values={vals} token={token} cx={8} cy={2.1} width={12} />
            <ExamplesG examples={q.examples} query={q.type === "guess" ? { input: q.query, output: done ? q.answer : null } : undefined} mine={mine} two={false} cx={8} y={4.2} />
          </Board>
        );
      } else {
        const [a, b] = q.type === "guess" ? q.query : q.examples[0].input;
        const out = q.type === "guess" ? (done ? q.answer : null) : q.examples[0].output;
        board = (
          <Board view={VIEW} imageName="operator" label="عملگر پنهان و مثال‌ها">
            <OpMachineG op={done ? q.machine.op : null} a={a} b={b} out={out} cx={8} cy={2.1} />
            <ExamplesG examples={q.examples} query={q.type === "guess" ? { input: q.query, output: done ? q.answer : null } : undefined} mine={mine} two cx={8} y={4.2} />
          </Board>
        );
      }
    } else {
      const lines = operatorBoardLines(q);
      const ask = q.variant === "plain" ? `${fa(q.a)} ★ ${fa(q.b)} = ؟` : q.variant === "nested" ? `(${fa(q.a)} ★ ${fa(q.b)}) ★ ${fa(q.c)} = ؟` : `□ ★ ${fa(q.b)} = ${fa(q.c)}`;
      const shown = done ? 1 + Math.round(f * (lines.length - 1)) : 1;
      const inner = q.variant === "nested" ? opValue(q.op, q.a, q.b) : q.variant === "plain" ? q.answer : q.c;
      board = (
        <Board view={VIEW} imageName="operator" label="عملگر ستاره">
          <OpMachineG op={q.op} a={q.variant === "unknown" && !done ? null : q.a} b={q.b} out={done || q.variant === "unknown" ? inner : null} boxA={q.variant === "unknown" && !done} cx={8} cy={2.3} />
          <LinesG lines={done ? lines : [ask]} shown={shown} cx={8} y={4.6} size={0.58} />
        </Board>
      );
    }
  }

  const inTry = mode === "try";
  const showSlider = mode === "show" || (inTry && checked !== null);
  const valuesClean = clean(values);
  const opFlip = opValue(op, opB, opA);

  return (
    <main className={styles.layout}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          → همه ابزارها
        </Link>
        <h1>
          <span className={styles.badge}>{fa(11)}</span> ماشین اعداد
        </h1>
        <div className={styles.tabs} role="tablist" aria-label="حالت ابزار">
          <button role="tab" aria-selected={mode === "explore"} onClick={() => switchMode("explore")}>
            کشف: ماشین بساز
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
          <TeacherGuideButton guide={MACHINE_GUIDE} />
          <Link href={`/tools/number-machine/worksheet?types=${tryType}&level=${tryLevel}`}>کاربرگ</Link>
        </div>
      </header>

      <section className={styles.stageWrap} aria-label="صفحه ماشین اعداد">
        {board}
      </section>

      <section className={styles.controls}>
        {showSlider ? (
          <label className={styles.slider}>
            <button className={styles.playSmall} onClick={() => play(inTry ? tryMs(question) : showMs)} aria-label={run ? "توقف" : "پخش"}>
              {run ? "⏸" : "▶"}
            </button>
            <span>{inTry ? (question.type === "operator" ? "قدم‌به‌قدم" : question.type === "reverse" ? "برعکس، از خروجی" : "عدد در ماشین") : area === "machine" ? (back ? "برعکس، از خروجی" : "عدد در ماشین") : "قدم‌به‌قدم"}</span>
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
            {inTry ? "اول فکر کن، بعد جواب بده" : area === "machine" ? (valuesClean ? `ورودی ${numFa(values[0])} · خروجی ${numFa(values[n])}` : "عدد صحیح نماند؛ عددها یا مرحله‌ها را عوض کن") : `${fa(opA)} و ${fa(opB)} ← جواب ${numFa(opValue(op, opA, opB))}`}
          </p>
        )}
      </section>

      <aside className={styles.side}>
        {mode !== "try" && (
          <div className={styles.chipsRow} role="radiogroup" aria-label="بخش">
            {(
              [
                ["machine", "ماشین"],
                ["operator", "عملگر ★"],
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

        {mode === "explore" && area === "machine" && (
          <>
            <h2 className={styles.progress}>۱. عدد {back ? "خروجی" : "ورودی"}</h2>
            <NumberStepper value={num} onValue={setNum} />
            <button className={styles.toggle} aria-pressed={back} onClick={() => setBack(!back)} style={{ marginTop: 8, width: "100%" }}>
              {back ? "✓ " : ""}ماشین برعکس: از خروجی، ورودی را پیدا کن
            </button>

            <h2 className={styles.progress}>۲. مرحله‌های ماشین</h2>
            <div className={styles.chipsRow} role="radiogroup" aria-label="مرحله‌ها" dir="ltr" style={{ flexWrap: "wrap" }}>
              {rule.map((s, i) => (
                <button key={i} role="radio" aria-checked={sel === i} onClick={() => setSel(i)} style={{ fontSize: "1.1rem" }}>
                  {stepFa(s)}
                </button>
              ))}
            </div>
            <p className={styles.note}>مرحله {fa(sel + 1)} را عوض کن:</p>
            <div className={styles.chipsRow} role="radiogroup" aria-label="کار">
              {(["+", "-", "×", "÷"] as Op[]).map((o) => (
                <button key={o} role="radio" aria-checked={rule[sel]?.op === o} aria-label={OP_WORD[o]} onClick={() => setRule(rule.map((s, i) => (i === sel ? { ...s, op: o } : s)))} style={{ fontSize: "1.2rem" }}>
                  {SYM[o]}
                </button>
              ))}
            </div>
            <Stepper
              label={`عدد ${fa(rule[sel]?.n ?? 1)}`}
              onLess={() => setRule(rule.map((s, i) => (i === sel ? { ...s, n: s.n - 1 } : s)))}
              onMore={() => setRule(rule.map((s, i) => (i === sel ? { ...s, n: s.n + 1 } : s)))}
              lessOff={(rule[sel]?.n ?? 1) <= 1}
              moreOff={(rule[sel]?.n ?? 1) >= 20}
            />
            <div className={styles.row} style={{ marginTop: 8 }}>
              <button
                className={styles.clear}
                disabled={rule.length >= MAX_STEPS}
                onClick={() => {
                  setRule([...rule, { op: "+", n: 1 }]);
                  setSel(rule.length);
                }}
              >
                + مرحله تازه
              </button>
              <button
                className={styles.clear}
                disabled={rule.length <= 1}
                onClick={() => {
                  setRule(rule.filter((_, i) => i !== sel));
                  setSel(Math.max(0, sel - 1));
                }}
              >
                حذف مرحله {fa(sel + 1)}
              </button>
            </div>
            <p className={`${styles.status} ${valuesClean ? styles.info : styles.warn}`}>
              قانون ماشین{back ? " برعکس" : ""}:{" "}
              <bdi dir="ltr">{ruleFa(back ? backRule(rule) : rule)}</bdi>
              {!valuesClean && (
                <>
                  <br />
                  {values.some((v) => v < 0) ? "⚠ عدد منفی شد." : "⚠ تقسیم باقی‌مانده داشت؛ عدد صحیح نیست."} {back ? "این خروجی از این ماشین با ورودی صحیح بیرون نمی‌آید." : ""}
                </>
              )}
            </p>
            <button
              className={styles.clear}
              onClick={() => {
                setMode("show");
                animate(showMs);
              }}
            >
              نشانم بده عدد چطور از ماشین رد می‌شود
            </button>
          </>
        )}

        {mode === "explore" && area === "operator" && (
          <>
            <h2 className={styles.progress}>۱. قانون ★</h2>
            <div className={styles.choiceGrid} role="radiogroup" aria-label="شکل قانون" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              {FORMS.map(([k, label]) => (
                <button key={k} role="radio" aria-checked={form === k} onClick={() => setForm(k)}>
                  <bdi dir="ltr">{label}</bdi>
                </button>
              ))}
            </div>
            <Stepper label={`عدد اول: ${fa(opP)}`} onLess={() => setOpP(opP - 1)} onMore={() => setOpP(opP + 1)} lessOff={opP <= 1} moreOff={opP >= 9} />
            {(form === "plus" || form === "minus") && <Stepper label={`عدد دوم: ${fa(opQ)}`} onLess={() => setOpQ(opQ - 1)} onMore={() => setOpQ(opQ + 1)} lessOff={opQ <= 1} moreOff={opQ >= 9} />}

            <h2 className={styles.progress}>۲. عددهای a و b</h2>
            <Stepper label={`a = ${fa(opA)}`} onLess={() => setOpA(opA - 1)} onMore={() => setOpA(opA + 1)} lessOff={opA <= 0} moreOff={opA >= 20} />
            <Stepper label={`b = ${fa(opB)}`} onLess={() => setOpB(opB - 1)} onMore={() => setOpB(opB + 1)} lessOff={opB <= 0} moreOff={opB >= 20} />
            <p className={`${styles.status} ${styles.info}`}>
              <bdi dir="ltr">{opCalcFa(op, opA, opB)}</bdi>
              <br />
              جای a و b را عوض کن:<br /><bdi dir="ltr">{opCalcFa(op, opB, opA)}</bdi>
              <br />
              {opFlip === opValue(op, opA, opB) ? "این بار هر دو یکی شد." : "جواب فرق کرد: در این عملگر ترتیب مهم است."}
            </p>
            <button
              className={styles.clear}
              onClick={() => {
                setMode("show");
                animate(showMs);
              }}
            >
              نشانم بده قدم‌به‌قدم
            </button>
          </>
        )}

        {mode === "show" && area === "machine" && (
          <>
            <h2>{back ? "ماشین برعکس" : "عدد از ماشین رد می‌شود"}</h2>
            <p className={styles.note}>
              {back
                ? "برای پیدا کردن ورودی، از خروجی شروع کن و از آخرین مرحله به اولی برگرد. هر کار برعکس می‌شود: جمع ↔ تفریق و ضرب ↔ تقسیم."
                : "عدد از چپ وارد می‌شود و به ترتیب از هر جعبه رد می‌شود. ترتیب جعبه‌ها مهم است."}
            </p>
            <table className={styles.countTable}>
              <tbody>
                {(back ? backRule(rule) : rule).map((s, i) => {
                  const from = back ? values[n - i] : values[i];
                  const to = back ? values[n - i - 1] : values[i + 1];
                  const k = Math.floor(f * n + 0.5);
                  return (
                    <tr key={i} aria-current={k === i + 1 ? "step" : undefined}>
                      <td>
                        {fa(i + 1)}. <bdi dir="ltr">{stepFa(s)}</bdi>
                      </td>
                      <td>
                        <bdi dir="ltr">{k > i ? `${numFa(from)} → ${numFa(to)}` : `${numFa(from)} → ؟`}</bdi>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className={styles.note}>ماشین و عدد را در «کشف» عوض کن.</p>
          </>
        )}

        {mode === "show" && area === "operator" && (
          <>
            <h2>عملگر ★ قدم‌به‌قدم</h2>
            <p className={styles.note}>
              ★ یک کار تازه است که قانونش را خودمان می‌گوییم. برای حساب کردن <bdi dir="ltr">{`${fa(opA)} ★ ${fa(opB)}`}</bdi>، به‌جای a عدد سمت چپ و به‌جای b عدد سمت راست را بگذار؛ بعد اول ضرب‌ها، بعد جمع و تفریق.
            </p>
            <p className={`${styles.status} ${styles.info}`}>
              جای a و b عوض شود:<br /><bdi dir="ltr">{opCalcFa(op, opB, opA)}</bdi>
            </p>
          </>
        )}

        {mode === "try" && (
          <MachineTryPanel
            key={`${tryType}-${tryLevel}-${seed}-${exCount}-${division}`}
            question={question}
            type={tryType}
            level={tryLevel}
            examples={exCount}
            division={division}
            checked={checked}
            onCheck={(v) => {
              setChecked(v);
              animate(tryMs(question));
            }}
            onType={(t) => freshQuestion({ type: t })}
            onLevel={(l) => freshQuestion({ level: l })}
            onExamples={(e) => freshQuestion({ ex: e })}
            onDivision={(d) => freshQuestion({ div: d })}
            onNew={() => freshQuestion()}
          />
        )}
      </aside>
    </main>
  );
}

function NumberStepper({ value, onValue }: { value: number; onValue: (v: number) => void }) {
  const nudge = (d: number) => onValue(Math.max(0, Math.min(999, value + d)));
  return (
    <>
      <p className={styles.stepText} style={{ fontSize: "1.6rem", textAlign: "center", margin: "4px 0" }}>
        {fa(value)}
      </p>
      <div className={styles.row}>
        <button className={styles.clear} onClick={() => nudge(-10)} disabled={value <= 0}>
          <bdi dir="ltr">−۱۰</bdi>
        </button>
        <button className={styles.clear} onClick={() => nudge(-1)} disabled={value <= 0}>
          <bdi dir="ltr">−۱</bdi>
        </button>
        <button className={styles.clear} onClick={() => nudge(1)} disabled={value >= 999}>
          <bdi dir="ltr">+۱</bdi>
        </button>
        <button className={styles.clear} onClick={() => nudge(10)} disabled={value >= 999}>
          <bdi dir="ltr">+۱۰</bdi>
        </button>
      </div>
    </>
  );
}

function Stepper({ label, onLess, onMore, lessOff, moreOff }: { label: string; onLess: () => void; onMore: () => void; lessOff: boolean; moreOff: boolean }) {
  return (
    <div className={styles.row} style={{ marginTop: 6 }}>
      <button className={styles.clear} onClick={onLess} disabled={lessOff} aria-label="کمتر" style={{ flex: "0 0 var(--tap)" }}>
        −
      </button>
      <span className={styles.stepperLabel}>{label}</span>
      <button className={styles.clear} onClick={onMore} disabled={moreOff} aria-label="بیشتر" style={{ flex: "0 0 var(--tap)" }}>
        +
      </button>
    </div>
  );
}

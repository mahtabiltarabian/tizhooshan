"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Board } from "@/engine-2d/Board";
import {
  ALPHABET,
  answerKind,
  CODE_TYPES,
  decode,
  encode,
  makeCodeQuestion,
  N,
  outKind,
  signedShift,
  slotMarks,
  SPACE,
  textOf,
  toLetters,
  WORDS,
  type CodeQuestion,
  type CodeQuestionType,
  type Level,
  type Rule,
  type TokenKind,
} from "@/generators/codes";
import { makeBinaryQuestion, MAX as BIN_MAX } from "@/generators/binary-code";
import { mulberry32, newSeed, shuffle } from "@/generators/random";
import { practiceCheck, usePractice } from "@/practice/bridge";
import { setClassroom as applyClassroom, useClassroom } from "@/toolkit/classroom";
import { TeacherGuideButton } from "@/toolkit/TeacherGuide";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/ToolLayout.module.css";
import {
  BinaryExploreBoard,
  BinaryExplorePanel,
  binaryFromLink,
  binaryKey,
  BinaryShowBoard,
  BinaryShowPanel,
  BinaryTryBoard,
  BinaryTryPanel,
  binFa,
  blankBinary,
  sumFa,
  useBinaryExplore,
  type BinaryEntry,
} from "./Binary";
import { CODES_ADAPTER } from "./adapter";
import { CodesTryPanel, givenKind, ruleFa, ruleShort, tokensFa, type TryType } from "./CodesTryPanel";
import { CODES_GUIDE } from "./guide";
import { LetterKeyboard } from "./Inputs";
import { DownArrows, fitSize, KeyTable, keyTableHeight, RowLabel, rowWidth, TokenRow, tokenText, Wheel } from "./Pictures";
import css from "./Codes.module.css";

type Mode = "explore" | "show" | "try";
type RuleKind = "shift" | "mirror" | "number" | "shape" | "sub" | "binary";

const RULE_LABEL: Record<RuleKind, string> = {
  shift: "جابه‌جایی",
  mirror: "وارونه",
  number: "عددی",
  shape: "شکلی",
  sub: "دلخواه",
  binary: "دودویی",
};

const VIEW: [number, number, number, number] = [0, 0, 16, 9];
const MAX_TEXT = 12;
const IDENTITY = Array.from({ length: N }, (_, i) => i);

/** A shape for each different letter of the text, in an order set by the seed. */
function shapeKey(letters: number[], seed: number): Rule {
  const own = [...new Set(letters.filter((x) => x >= 0))];
  const shapes = shuffle(mulberry32(seed), Array.from({ length: 12 }, (_, i) => i));
  return { kind: "shape", key: own.slice(0, 12).map((l, k) => [l, shapes[k]]) };
}

/**
 * Playback 0 … 1: in the first 30% the inner ring turns into place (a shift)
 * or appears (other rules); then the letters are joined to their codes one by one.
 */
function phases(rule: Rule, f: number, count: number) {
  const a = Math.min(1, f / 0.3);
  const b = Math.max(0, (f - 0.3) / 0.7);
  return {
    turn: rule.kind === "shift" ? signedShift(rule.n) * a : undefined,
    reveal: a,
    linked: f >= 0.999 ? count : Math.min(count, Math.floor(b * count)),
  };
}

/** How many tokens of a row hold the first `letters` letters (spaces included). */
function tokensFor(tokens: readonly (number | null)[], letters: number) {
  let seen = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === SPACE) continue;
    if (seen === letters) return i;
    seen++;
  }
  return tokens.length;
}

const WHEEL = { cx: 4.4, cy: 4.5, r: 3.75 };
const ROW_RIGHT = 14.15;
const ROW_WIDTH = 5.05;

interface SceneProps {
  rule: Rule;
  /** The plain letters: these are linked on the wheel. */
  plain: number[];
  top: (number | null)[];
  topKind: TokenKind;
  topLabel: string;
  bottom: (number | null)[];
  bottomKind: TokenKind;
  bottomLabel: string;
  f: number;
  caption: string;
  onTurn?: (n: number) => void;
  /** The pupil's answer, with ✓ / ✗. */
  mine?: { tokens: number[]; marks: boolean[] };
}

/** The cipher wheel on the left and the text and its code, box by box, on the right. */
function Scene(p: SceneProps) {
  const count = p.plain.filter((x) => x !== SPACE).length;
  const ph = phases(p.rule, p.f, count);
  const size = fitSize(p.top, ROW_WIDTH, 0.95);
  const right = ROW_RIGHT - Math.max(0, (ROW_WIDTH - rowWidth(p.top, size)) / 2);
  const yTop = 2.2;
  const yBottom = yTop + size + 1.1;
  const yMine = yBottom + size + 1.25;
  const joined = p.topKind === "letter" && p.bottomKind === "letter";
  return (
    <>
      <Wheel rule={p.rule} {...WHEEL} turn={ph.turn} reveal={ph.reveal} word={p.plain} linked={ph.linked} onTurn={p.onTurn} />
      <text x={15.7} y={0.75} fontSize={0.42} fontWeight={700} textAnchor="end" dominantBaseline="central" fill="#0f172a">
        {p.caption}
      </text>
      <RowLabel x={15.7} y={yTop} text={p.topLabel} />
      <TokenRow tokens={p.top} kind={p.topKind} right={right} y={yTop} size={size} />
      <DownArrows tokens={p.top} right={right} y={(yTop + yBottom) / 2} size={size} />
      <RowLabel x={15.7} y={yBottom} text={p.bottomLabel} />
      <TokenRow tokens={p.bottom} kind={p.bottomKind} right={right} y={yBottom} size={size} shown={tokensFor(p.bottom, ph.linked)} />
      {p.mine && (
        <>
          <RowLabel x={15.7} y={yMine} text="جواب تو" />
          <TokenRow tokens={p.mine.tokens} kind={p.bottomKind} right={right} y={yMine} size={size} marks={p.mine.marks} />
        </>
      )}
      {!p.mine && (
        <text x={15.7} y={7.9} fontSize={0.6} fontWeight={700} textAnchor="end" dominantBaseline="central" fill="#0f172a">
          {joined ? `«${textOf(p.top)}» ← «${ph.linked >= count ? textOf(p.bottom) : "…"}»` : `«${textOf(p.plain)}»`}
        </text>
      )}
    </>
  );
}

/** Try it, before the answer: the key, the rule or the examples on top; the text and the answer slots below. */
function TryBoard({ q, answer, active, onSlot }: { q: CodeQuestion; answer: (number | null)[]; active: number; onSlot: (i: number) => void }) {
  const codeKind = outKind(q.rule);
  let top: React.ReactNode = null;
  let topBottom = 3.6;
  if (q.show === "key") {
    const per = q.key.length > 16 ? 16 : q.key.length;
    top = <KeyTable letters={q.key} rule={q.rule} x={0.5} y={0.3} width={15} perRow={per} />;
    topBottom = 0.3 + keyTableHeight(q.key.length, 15, per);
  } else if (q.show === "words") {
    top = (
      <>
        <text x={8} y={0.6} fontSize={0.42} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill="#0f172a">
          قانون: {ruleFa(q.rule)}
        </text>
        <KeyTable letters={Array.from({ length: N }, (_, i) => i)} rule={null} codes={false} x={0.5} y={1.15} width={15} />
      </>
    );
    topBottom = 1.15 + keyTableHeight(N, 15, 16, false);
  } else {
    const size = 0.8;
    top = q.examples.map((e, k) => {
      const y = 0.75 + k * 1.15;
      return (
        <g key={k}>
          <TokenRow tokens={e.plain} kind="letter" right={8.5 + rowWidth(e.plain, size)} y={y} size={size} />
          <text x={8} y={y} fontSize={0.6} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill="#5b6476">
            ←
          </text>
          <TokenRow tokens={e.coded} kind={codeKind} right={7.5} y={y} size={size} />
        </g>
      );
    });
    topBottom = 0.75 + (q.examples.length - 1) * 1.15 + 0.5;
    top = (
      <>
        <text x={15.5} y={0.75} fontSize={0.36} fontWeight={700} textAnchor="end" dominantBaseline="central" fill="#5b6476">
          مثال‌ها
        </text>
        {top}
      </>
    );
  }
  const size = fitSize(q.given, 13, 1.1);
  const right = 8 + rowWidth(q.given, size) / 2;
  const yGiven = Math.max(topBottom + 1.4, 5.0);
  const yAnswer = Math.min(8.1, yGiven + size + 1.3);
  const kind = answerKind(q);
  return (
    <>
      {top}
      <RowLabel x={right + 0.25 + 1.3} y={yGiven} text={q.dir === "encode" ? "کلمه" : "رمز"} />
      <TokenRow tokens={q.given} kind={givenKind(q)} right={right} y={yGiven} size={size} />
      <DownArrows tokens={q.given} right={right} y={(yGiven + yAnswer) / 2} size={size} />
      <RowLabel x={right + 0.25 + 1.3} y={yAnswer} text={q.dir === "encode" ? "رمز" : q.type === "sentence" ? "جمله" : "کلمه"} />
      <TokenRow tokens={answer} kind={kind} right={right} y={yAnswer} size={size} active={active} onSlot={onSlot} />
    </>
  );
}

const blankFor = (q: CodeQuestion) => q.answer.map((x) => (x === SPACE ? SPACE : null));

export function CodesTool() {
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

  // Explore and show me: the rule and the text.
  const [ruleKind, setRuleKind] = useState<RuleKind>("shift");
  const [shiftN, setShiftN] = useState(3);
  const [mirrorN, setMirrorN] = useState(0);
  const [numStart, setNumStart] = useState(1);
  const [numStep, setNumStep] = useState<1 | 2>(1);
  const [numRev, setNumRev] = useState(false);
  const [shapeSeed, setShapeSeed] = useState(18);
  const [perm, setPerm] = useState<number[]>(IDENTITY);
  const [text, setText] = useState("باغ");
  const [decoding, setDecoding] = useState(false);

  const typed = useMemo(() => toLetters(text).filter((x) => x !== -2), [text]);
  const rule: Rule = useMemo(() => {
    switch (ruleKind) {
      case "shift":
        return { kind: "shift", n: shiftN };
      case "mirror":
        return { kind: "mirror", n: mirrorN };
      case "number":
        return { kind: "number", start: numStart, step: numStep, rev: numRev };
      case "shape":
        return shapeKey(typed, shapeSeed);
      case "sub":
        return { kind: "sub", perm };
      case "binary":
        // «دودویی» is not a letter rule; its own board and panel are drawn instead.
        return { kind: "shift", n: 0 };
    }
  }, [ruleKind, shiftN, mirrorN, numStart, numStep, numRev, shapeSeed, perm, typed]);
  const letterRule = outKind(rule) === "letter";
  const dec = decoding && letterRule;
  const plain = useMemo(() => (dec ? (decode(rule, typed).map((x) => x ?? 0) as number[]) : typed), [dec, rule, typed]);
  const coded = useMemo(() => encode(rule, plain), [rule, plain]);
  const letterCount = plain.filter((x) => x !== SPACE).length;

  // Binary code: explore (cards to flip, +1) and show me (the number built greedily).
  const binEx = useBinaryExplore();
  const [binN, setBinN] = useState(13);
  const binary = ruleKind === "binary";

  // Try it
  const [tryType, setTryType] = useState<TryType>("shift");
  const [tryLevel, setTryLevel] = useState<Level>(1);
  const [length, setLength] = useState(0);
  const [examples, setExamples] = useState<2 | 3>(2);
  const [seed, setSeed] = useState(1818);
  const codeType: CodeQuestionType = tryType === "binary" ? "shift" : tryType;
  const question = useMemo(() => makeCodeQuestion(codeType, tryLevel, seed, { length, examples }), [codeType, tryLevel, seed, length, examples]);
  const binQ = useMemo(() => makeBinaryQuestion(tryLevel, seed), [tryLevel, seed]);
  const [binRaw, setBin] = useState<BinaryEntry | null>(null);
  // A stale entry (another question) reads as blank.
  const binEntry = binRaw && binRaw.key === binaryKey(binQ) ? binRaw : blankBinary(binQ);
  const [answerRaw, setAnswerRaw] = useState<(number | null)[]>([]);
  const [active, setActive] = useState(0);
  const [checked, setChecked] = useState<number[] | null>(null);
  // A stale answer (another question) reads as empty slots.
  const answer = answerRaw.length === question.answer.length ? answerRaw : blankFor(question);
  const activeSlot = answer[active] === SPACE || active >= answer.length ? Math.max(0, answer.indexOf(null)) : active;

  // Practice sessions: the next question of this tool arrives through the address,
  // built with the page's default options (any length, two examples).
  const practice = usePractice(CODES_ADAPTER, (type, level, sd) => {
    const t: TryType = type === "binary" || (CODE_TYPES as string[]).includes(type) ? (type as TryType) : "shift";
    const lv: Level = level === 2 || level === 3 ? level : 1;
    setMode("try");
    setTryType(t);
    setTryLevel(lv);
    setLength(0);
    setExamples(2);
    setSeed(sd);
    if (t === "binary") setBin(null);
    else setAnswerRaw(blankFor(makeCodeQuestion(t, lv, sd, { length: 0, examples: 2 })));
    setActive(0);
    setChecked(null);
    setRun(null);
    setF(0);
  });

  const showMs = binary ? 5400 : 1800 + 700 * letterCount;
  const tryMs = 1800 + 600 * question.plain.filter((x) => x !== SPACE).length;

  // Shareable links: #try=shift&level=2&seed=7&len=4&ex=2(&a=3.1._.5), #show=shift&n=3&w=باغ(&dir=decode),
  // #show=mirror&n=0, #show=number&start=1&step=1&rev=0, #show=shape&k=18, #explore=… (same), #f=0.5, #classroom.
  // Binary: #try=binary&level=2&seed=7(&a=13 | a=01101 | a=3.1.5), #explore=binary&n=13, #show=binary&n=13
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.has("classroom")) applyClassroom(true);
    const tryParam = params.get("try");
    const show = params.get("show") ?? params.get("explore");
    const timer = setTimeout(() => {
      if (tryParam === "binary") {
        const lv = Number(params.get("level"));
        const level: Level = lv === 2 || lv === 3 ? lv : 1;
        const sd = Number(params.get("seed"));
        const s = Number.isInteger(sd) && sd >= 0 ? sd : 1818;
        setMode("try");
        setTryType("binary");
        setTryLevel(level);
        setSeed(s);
        const q = makeBinaryQuestion(level, s);
        setBin(binaryFromLink(q, params.get("a") ?? "") ?? blankBinary(q));
        setF(1);
      } else if (tryParam) {
        const type = (CODE_TYPES as string[]).includes(tryParam) ? (tryParam as CodeQuestionType) : "shift";
        const lv = Number(params.get("level"));
        const level: Level = lv === 2 || lv === 3 ? lv : 1;
        const sd = Number(params.get("seed"));
        const s = Number.isInteger(sd) && sd >= 0 ? sd : 1818;
        const ln = Number(params.get("len"));
        const len = ln >= 3 && ln <= 6 ? ln : 0;
        const ex = params.get("ex") === "3" ? 3 : 2;
        setMode("try");
        setTryType(type);
        setTryLevel(level);
        setSeed(s);
        setLength(len);
        setExamples(ex);
        const q = makeCodeQuestion(type, level, s, { length: len, examples: ex });
        const a = (params.get("a") ?? "").split(".").filter(Boolean).map((x) => (x === "_" ? SPACE : Number(x)));
        if (a.length === q.answer.length && a.every((x) => Number.isInteger(x))) {
          setAnswerRaw(a);
          setChecked(a);
          setF(1);
        } else {
          setAnswerRaw(blankFor(q));
          setF(0);
        }
      } else if (show) {
        const kind = (Object.keys(RULE_LABEL) as RuleKind[]).includes(show as RuleKind) ? (show as RuleKind) : "shift";
        setRuleKind(kind);
        const num = (k: string, lo: number, hi: number, def: number) => {
          const v = Number(params.get(k));
          return params.has(k) && Number.isInteger(v) ? Math.max(lo, Math.min(hi, v)) : def;
        };
        if (kind === "shift") setShiftN(num("n", -31, 31, 3) || 3);
        if (kind === "mirror") setMirrorN(num("n", -16, 16, 0));
        if (kind === "number") {
          setNumStart(num("start", 0, 10, 1));
          setNumStep(num("step", 1, 2, 1) as 1 | 2);
          setNumRev(params.get("rev") === "1");
        }
        if (kind === "shape") setShapeSeed(num("k", 0, 1_000_000, 18));
        if (kind === "binary") {
          if (params.has("show")) setBinN(num("n", 1, BIN_MAX, 13));
          else binEx.setMask(num("n", 0, BIN_MAX, 13));
        }
        const w = params.get("w");
        if (w) setText([...w].filter((ch) => ch === " " || ALPHABET.includes(ch)).slice(0, MAX_TEXT).join(""));
        setDecoding(params.get("dir") === "decode");
        setMode(params.has("show") ? "show" : "explore");
        setF(1);
      }
      const ff = Number(params.get("f"));
      if (params.has("f") && Number.isFinite(ff)) setF(Math.min(1, Math.max(0, ff)));
    }, 0);
    return () => clearTimeout(timer);
    // Read once, on load; binEx.setMask only sets state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchMode = (m: Mode) => {
    setMode(m);
    setRun(null);
    setF(m === "try" && checked === null ? 0 : 1);
  };

  const freshQuestion = (o: { type?: TryType; level?: Level; length?: number; examples?: 2 | 3 } = {}) => {
    const type = o.type ?? tryType;
    const level = o.level ?? tryLevel;
    const len = o.length ?? length;
    const ex = o.examples ?? examples;
    const s = newSeed();
    setTryType(type);
    setTryLevel(level);
    setLength(len);
    setExamples(ex);
    setSeed(s);
    if (type === "binary") setBin(null);
    else setAnswerRaw(blankFor(makeCodeQuestion(type, level, s, { length: len, examples: ex })));
    setActive(0);
    setChecked(null);
    setRun(null);
    setF(0);
  };

  const play = (ms: number) => {
    if (run) return setRun(null);
    animate(ms, f >= 0.99 ? 0 : f);
  };

  const typeKey = (i: number) => setText((t) => ([...t].length >= MAX_TEXT ? t : t + ALPHABET[i]));
  const typeSpace = () => setText((t) => (t && !t.endsWith(" ") && [...t].length < MAX_TEXT ? t + " " : t));
  const typeBack = () => setText((t) => [...t].slice(0, -1).join(""));
  const sampleWord = () => setText(WORDS[newSeed() % WORDS.length]);

  /** One-to-one table: give letter a the code b, and a's old code to whoever had b. */
  const setPair = (a: number, b: number) =>
    setPerm((cur) => {
      const next = [...cur];
      const j = next.indexOf(b);
      next[j] = next[a];
      next[a] = b;
      return next;
    });

  const codeKind = outKind(rule);
  const caption = `قانون: ${ruleShort(rule)}`;
  const inTry = mode === "try";
  const done = checked !== null;

  let board: React.ReactNode;
  if (!inTry && binary) {
    board = (
      <Board view={VIEW} imageName="binary" label={mode === "explore" ? "کارت‌های دودویی؛ روی کارت بزن تا برگردد" : "ساختن عدد با کارت‌های دودویی"}>
        {mode === "explore" ? <BinaryExploreBoard ex={binEx} /> : <BinaryShowBoard n={binN} f={f} />}
      </Board>
    );
  } else if (inTry && tryType === "binary") {
    board = (
      <Board view={VIEW} imageName="binary" label="پرسش کد دودویی">
        <BinaryTryBoard q={binQ} entry={binEntry} onEntry={setBin} exam={practice.exam} />
      </Board>
    );
  } else if (!inTry) {
    board = (
      <Board view={VIEW} imageName="codes" label={mode === "explore" ? "چرخ رمز؛ حلقه درون را بچرخان" : "چرخ رمز"}>
        <Scene
          rule={rule}
          plain={plain}
          top={dec ? coded : plain}
          topKind={dec ? codeKind : "letter"}
          topLabel={dec ? "رمز" : "متن"}
          bottom={dec ? plain : coded}
          bottomKind={dec ? "letter" : codeKind}
          bottomLabel={dec ? "متن" : "رمز"}
          f={mode === "show" ? f : 1}
          caption={caption}
          onTurn={mode === "explore" && ruleKind === "shift" ? setShiftN : undefined}
        />
      </Board>
    );
  } else if (!done || practice.exam) {
    // In a mock exam the wheel with the answer waits until the end.
    board = (
      <Board view={VIEW} imageName="codes" label="پرسش رمز">
        <TryBoard q={question} answer={answer} active={activeSlot} onSlot={setActive} />
      </Board>
    );
  } else {
    const q = question;
    const ak = answerKind(q);
    board = (
      <Board view={VIEW} imageName="codes" label="چرخ رمز و جواب">
        <Scene
          rule={q.rule}
          plain={q.plain}
          top={q.given}
          topKind={givenKind(q)}
          topLabel={q.dir === "encode" ? "کلمه" : "رمز"}
          bottom={q.answer}
          bottomKind={ak}
          bottomLabel="جواب"
          f={f}
          caption={`قانون: ${ruleShort(q.rule)}`}
          mine={{ tokens: checked, marks: slotMarks(q, checked) }}
        />
      </Board>
    );
  }

  // Show me: the letter being linked now.
  const ph = phases(rule, f, letterCount);
  const steps = plain
    .map((x, i) => ({ x, i }))
    .filter(({ x }) => x !== SPACE)
    .map(({ x, i }) => ({ plain: x, code: coded[i] }));
  const showSlider = mode === "show" || (inTry && done && tryType !== "binary" && !practice.exam);
  const distinct = [...new Set(typed.filter((x) => x !== SPACE))];

  return (
    <main className={styles.layout}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          → همه ابزارها
        </Link>
        <h1>
          <span className={styles.badge}>{fa(18)}</span> کدگذاری
        </h1>
        <div className={styles.tabs} role="tablist" aria-label="حالت ابزار">
          <button role="tab" aria-selected={mode === "explore"} onClick={() => switchMode("explore")}>
            کشف: رمز بساز
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
          <TeacherGuideButton guide={CODES_GUIDE} />
          <Link href={`/tools/codes/worksheet?types=${tryType}&level=${tryLevel}`}>کاربرگ</Link>
        </div>
      </header>

      <section className={styles.stageWrap} aria-label="صفحه کدگذاری">
        {board}
      </section>

      <section className={styles.controls}>
        {showSlider ? (
          <label className={styles.slider}>
            <button className={styles.playSmall} onClick={() => play(inTry ? tryMs : showMs)} aria-label={run ? "توقف" : "پخش"}>
              {run ? "⏸" : "▶"}
            </button>
            <span>{binary && !inTry ? "کارت به کارت" : f < 0.3 ? "چرخاندن چرخ" : "وصل کردن حرف‌ها"}</span>
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
            {inTry
              ? "اول فکر کن، بعد جواب بده"
              : binary
                ? `${sumFa(binEx.mask)} · کد ${binFa(binEx.mask)}`
                : `${caption} · «${textOf(dec ? coded : plain)}» ← «${tokensFa(dec ? "letter" : codeKind, dec ? plain : coded)}»`}
          </p>
        )}
      </section>

      <aside className={styles.side}>
        {mode === "explore" && (
          <>
            <h2 className={styles.progress}>۱. قانون رمز</h2>
            <div className={styles.chipsRow} role="radiogroup" aria-label="نوع رمز" style={{ flexWrap: "wrap" }}>
              {(Object.keys(RULE_LABEL) as RuleKind[]).map((k) => (
                <button key={k} role="radio" aria-checked={ruleKind === k} onClick={() => setRuleKind(k)} style={{ flex: "1 0 30%" }}>
                  {RULE_LABEL[k]}
                </button>
              ))}
            </div>

            {binary ? (
              <>
                <BinaryExplorePanel ex={binEx} />
                <button
                  className={styles.clear}
                  onClick={() => {
                    setBinN(binEx.mask || 13);
                    switchMode("show");
                    animate(showMs);
                  }}
                >
                  نشانم بده: ساختن {binEx.mask ? `عدد ${fa(binEx.mask)}` : "یک عدد"} از بزرگ‌ترین کارت
                </button>
              </>
            ) : (
              <>
                {ruleKind === "shift" && (
                  <>
                    <Stepper label={`${fa(Math.abs(shiftN))} حرف ${shiftN >= 0 ? "جلو" : "عقب"}`} onLess={() => setShiftN(shiftN - 1 === 0 ? -1 : shiftN - 1)} onMore={() => setShiftN(shiftN + 1 === 0 ? 1 : shiftN + 1)} lessOff={shiftN <= -16} moreOff={shiftN >= 16} />
                    <p className={styles.note}>یا حلقه درون چرخ را با انگشت بچرخان.</p>
                  </>
                )}
                {ruleKind === "mirror" && (
                  <>
                    <p className={styles.note}>الفبا وارونه می‌شود: ا ← ی، ب ← ه، پ ← و … بعد می‌توانی جلو یا عقب هم ببری.</p>
                    <Stepper label={mirrorN === 0 ? "فقط وارونه" : `بعد ${fa(Math.abs(mirrorN))} حرف ${mirrorN > 0 ? "جلو" : "عقب"}`} onLess={() => setMirrorN(mirrorN - 1)} onMore={() => setMirrorN(mirrorN + 1)} lessOff={mirrorN <= -16} moreOff={mirrorN >= 16} />
                  </>
                )}
                {ruleKind === "number" && (
                  <>
                    <Stepper label={`${numRev ? "ی" : "ا"} = ${fa(numStart)}`} onLess={() => setNumStart(numStart - 1)} onMore={() => setNumStart(numStart + 1)} lessOff={numStart <= 0} moreOff={numStart >= 10} />
                    <div className={styles.row} style={{ marginTop: 6 }}>
                      <button className={styles.toggle} aria-pressed={numRev} onClick={() => setNumRev(!numRev)}>
                        {numRev ? "✓ " : ""}از آخر الفبا
                      </button>
                      <button className={styles.toggle} aria-pressed={numStep === 2} onClick={() => setNumStep(numStep === 2 ? 1 : 2)}>
                        {numStep === 2 ? "✓ " : ""}دوتا‌دوتا
                      </button>
                    </div>
                  </>
                )}
                {ruleKind === "shape" && (
                  <>
                    <p className={styles.note}>هر حرف متن یک شکل می‌گیرد؛ حرف‌های یکسان، شکل یکسان.</p>
                    <button className={styles.clear} onClick={() => setShapeSeed(newSeed())}>
                      شکل‌های تازه
                    </button>
                  </>
                )}
                {ruleKind === "sub" && (
                  <>
                    <p className={styles.note}>برای هر حرف متن، حرف رمزش را انتخاب کن. هر حرف رمز فقط مال یک حرف است؛ اگر تکراری باشد، دو حرف جایشان را عوض می‌کنند.</p>
                    <div className={css.pairList}>
                      {distinct.map((l) => (
                        <label key={l}>
                          {ALPHABET[l]} ←
                          <select value={perm[l]} onChange={(e) => setPair(l, Number(e.target.value))} aria-label={`رمز حرف ${ALPHABET[l]}`}>
                            {ALPHABET.map((ch, i) => (
                              <option key={ch} value={i}>
                                {ch}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                    <button className={styles.clear} onClick={() => setPerm(IDENTITY)}>
                      از نو
                    </button>
                  </>
                )}

                <h2 className={styles.progress}>۲. {dec ? "رمز را بنویس" : "متن را بنویس"}</h2>
                {letterRule && (
                  <div className={styles.chipsRow} role="radiogroup" aria-label="جهت">
                    <button role="radio" aria-checked={!decoding} onClick={() => setDecoding(false)}>
                      رمز کن
                    </button>
                    <button role="radio" aria-checked={decoding} onClick={() => setDecoding(true)}>
                      رمزگشایی کن
                    </button>
                  </div>
                )}
                <p className={css.word} aria-live="polite">
                  {text || "…"}
                </p>
                <LetterKeyboard onKey={typeKey} onSpace={typeSpace} onBack={typeBack} />
                <div className={styles.row} style={{ marginTop: 6 }}>
                  <button className={styles.clear} onClick={sampleWord}>
                    کلمه تازه
                  </button>
                  <button className={styles.clear} onClick={() => setText("")}>
                    پاک کردن همه
                  </button>
                </div>
                <p className={styles.status + " " + styles.info}>
                  {ruleFa(rule)}: «{textOf(dec ? coded : plain)}» ← «{tokensFa(dec ? "letter" : codeKind, dec ? plain : coded)}»
                </p>
                <button
                  className={styles.clear}
                  onClick={() => {
                    switchMode("show");
                    animate(showMs);
                  }}
                >
                  نشانم بده روی چرخ
                </button>
              </>
            )}
          </>
        )}

        {mode === "show" && binary && (
          <BinaryShowPanel
            n={binN}
            f={f}
            onN={(n) => {
              setBinN(Math.max(1, Math.min(BIN_MAX, n)));
              animate(showMs);
            }}
          />
        )}
        {mode === "show" && !binary && (
          <>
            <h2>چرخ رمز</h2>
            <p className={styles.note}>
              {rule.kind === "shift"
                ? `حلقه بیرون الفبای معمولی است. حلقه درون ${ruleShort(rule)} می‌چرخد؛ حالا زیر هر حرف، حرف رمزش است.`
                : "حلقه بیرون الفبای معمولی است و حلقه درون، رمز هر حرف."}{" "}
              بعد حرف‌های متن یکی‌یکی (با شماره) به رمزشان وصل می‌شوند.
            </p>
            <table className={styles.countTable}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>حرف</th>
                  <th>رمز</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((s, k) => (
                  <tr key={k} aria-current={k === ph.linked - 1 ? "step" : undefined}>
                    <td>{fa(k + 1)}</td>
                    <td>{ALPHABET[s.plain]}</td>
                    <td>{k < ph.linked ? tokenText(codeKind, s.code) : "؟"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={styles.note}>قانون و متن را در «کشف» عوض کن.</p>
          </>
        )}

        {mode === "try" && tryType === "binary" && (
          <BinaryTryPanel
            q={binQ}
            level={tryLevel}
            entry={binEntry}
            onEntry={setBin}
            exam={practice.exam}
            onCheck={(v) => void practiceCheck(CODES_ADAPTER, v)}
            onType={(t) => freshQuestion({ type: t })} onLevel={(l) => freshQuestion({ level: l })} onNew={() => freshQuestion()} />
        )}
        {mode === "try" && tryType !== "binary" && (
          <CodesTryPanel
            key={`${tryType}-${tryLevel}-${seed}-${length}-${examples}`}
            question={question}
            type={codeType}
            level={tryLevel}
            length={length}
            examples={examples}
            answer={answer}
            active={activeSlot}
            onAnswer={(a, i) => {
              setAnswerRaw(a);
              setActive(i);
            }}
            checked={checked}
            exam={practice.exam}
            onCheck={(v) => {
              setChecked(v);
              void practiceCheck(CODES_ADAPTER, v);
              if (!practice.exam) animate(tryMs);
            }}
            onType={(t) => freshQuestion({ type: t })}
            onLevel={(l) => freshQuestion({ level: l })}
            onLength={(n) => freshQuestion({ length: n })}
            onExamples={(n) => freshQuestion({ examples: n })}
            onNew={() => freshQuestion()}
          />
        )}
      </aside>
    </main>
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


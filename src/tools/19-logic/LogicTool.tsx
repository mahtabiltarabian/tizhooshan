"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Board } from "@/engine-2d/Board";
import {
  chainOf,
  clashes,
  defaultSize,
  emptyBy,
  exampleModel,
  gridCheck,
  gridSteps,
  liarSteps,
  makeLogicQuestion,
  marksAfter,
  mentioned,
  needBy,
  negate,
  saysTrue,
  vennSteps,
  type GridQuestion,
  type GridStep,
  type Level,
  type LiarsQuestion,
  type LogicQuestion,
  type LogicType,
  type Mark,
  type Statement,
  type VennQuestion,
} from "@/generators/logic";
import { newSeed } from "@/generators/random";
import { setClassroom as applyClassroom, useClassroom } from "@/toolkit/classroom";
import { TeacherGuideButton } from "@/toolkit/TeacherGuide";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/ToolLayout.module.css";
import tryStyles from "@/toolkit/TryPanel.module.css";
import { LOGIC_GUIDE } from "./guide";
import {
  clueText,
  gridStepText,
  itemsOf,
  LIARS_RULE,
  liarStepText,
  LOGIC_TYPE_LABEL,
  LogicTryPanel,
  plural,
  saysText,
  sizeFa,
  stmtText,
  vennNames,
  vennStepText,
  type TryEntry,
} from "./LogicTryPanel";
import { BANK_Y, GridFigure, gridView, LiarsFigure, liarsView, regionAt, TokenLayer, vennBox, VennFigure, type ClueState, type Token } from "./Pictures";

type Mode = "explore" | "show" | "try";
type View = [number, number, number, number];

const qKey = (t: LogicType, l: Level, s: number, size: number, extra: boolean) => `${t}-${l}-${s}-${t === "grid" ? `${size}-${extra ? 1 : 0}` : ""}`;
const make = (t: LogicType, l: Level, s: number, size: 3 | 4, extra: boolean) => makeLogicQuestion(t, l, s, { size, extra });

/** Empty marks and choices for a question. */
function blankEntry(q: LogicQuestion): TryEntry {
  const n = q.type === "grid" ? q.size : 0;
  return { marks: Array(n * n).fill(0), liar: q.type === "liars" ? q.people.map(() => null) : [], pick: null, checked: false, user: [0, 0] };
}

/** Tap: empty → ✓ → ✗ → empty. */
const nextMark = (m: Mark): Mark => (m === 0 ? 1 : m === 1 ? -1 : 0);
/** Tap: ؟ → truth-teller → liar → ؟. */
const nextLiar = (l: boolean | null) => (l === null ? false : l === false ? true : null);

/** A ✓ crosses out the empty cells of its row and column (explore helper). */
function withCrosses(n: number, marks: Mark[], c: number): Mark[] {
  const next = [...marks];
  const [p, i] = [Math.floor(c / n), c % n];
  for (let k = 0; k < n; k++) {
    if (next[p * n + k] === 0) next[p * n + k] = -1;
    if (next[k * n + i] === 0) next[k * n + i] = -1;
  }
  return next;
}

/** Fits / clash for every statement whose people are all known. */
function liveStatus(q: LiarsQuestion, known: readonly (boolean | null)[]): ("fits" | "clash" | null)[] {
  return q.says.map((s, k) => {
    if (!s) return null;
    const who = [k, ...mentioned(s, q.people.length)];
    if (who.some((p) => known[p] === null)) return null;
    return saysTrue(s, known as boolean[]) === !known[k] ? "fits" : "clash";
  });
}

/** Cells a grid step changes, for the thick outline. */
function stepCells(s: GridStep | undefined): number[] {
  if (!s) return [];
  if (s.kind === "clue") return [...s.no, ...s.yes];
  if (s.kind === "cross") return s.cells;
  return [s.cell];
}

// ───────────── Venn diagrams of a question ─────────────

/** Groups each picture shows: one picture, or (level 3) the first step and the second. */
const stagesOf = (q: VennQuestion): number[][] => (q.level === 1 ? [[0, 1]] : q.level === 2 ? [[0, 1, 2]] : [[0, 1, 2], [0, 2, 3]]);

/** Hatching and × of some statements in a picture of the groups `terms`. */
function drawOf(terms: readonly number[], stmts: readonly Statement[]) {
  let empty = 0;
  const needs: number[] = [];
  for (const s of stmts) {
    const [a, b] = [terms.indexOf(s.a), terms.indexOf(s.b)];
    if (a < 0 || b < 0) continue;
    const local = { ...s, a, b };
    empty |= emptyBy(local, terms.length);
    const need = needBy(local, terms.length);
    if (need) needs.push(need);
  }
  return { empty, needs };
}

/** A model of all groups, seen in a picture of fewer groups. */
function project(model: number, k: number, terms: readonly number[]): number {
  let out = 0;
  for (let r = 0; r < 1 << k; r++) if ((model >> r) & 1) out |= 1 << terms.reduce((m, t, j) => m | (((r >> t) & 1) << j), 0);
  return out & ~1;
}

function vennView(q: VennQuestion): View {
  const [x, y, w, h] = vennBox(q.level === 1 ? 2 : 3);
  return q.level === 3 ? [-5.9, y, 11.8, h + 0.75] : [x, y, w, h + 0.2];
}

/** The picture(s) of a Venn question: blank, after some steps, or with an example for a wrong option. */
function VennBoard({ q, stmts, dots, user, onRegion }: { q: VennQuestion; stmts: Statement[][]; dots?: number | null; user?: number[]; onRegion?: (stage: number, r: number) => void }) {
  const names = vennNames(q);
  const stages = stagesOf(q);
  const k = q.terms.length;
  return (
    <>
      {stages.map((terms, j) => {
        const { empty, needs } = drawOf(terms, stmts[j] ?? []);
        return (
          <VennFigure
            key={j}
            names={terms.map((t) => names[t])}
            x={stages.length > 1 ? (j === 0 ? 3 : -3) : 0}
            empty={empty}
            needs={needs}
            dots={dots ? project(dots, k, terms) : 0}
            user={user?.[j] ?? 0}
            onRegion={onRegion ? (r) => onRegion(j, r) : undefined}
            caption={stages.length > 1 ? (j === 0 ? `قدم ۱: ${plural(names[0])}، ${plural(names[1])}، ${plural(names[2])}` : `قدم ۲: بدون ${plural(names[1])}`) : undefined}
          />
        );
      })}
      {stages.length > 1 && (
        <text x={0} y={0} dy="0.35em" fontSize={0.6} fontWeight={800} textAnchor="middle" fill="#5b6170">
          ←
        </text>
      )}
    </>
  );
}

// ───────────── explore: Venn with real things ─────────────

const EX_GROUPS = ["پرنده", "پروازکننده", "شناگر"];
const EX_TOKENS: { name: string; r: number }[] = [
  { name: "گنجشک", r: 0b011 },
  { name: "پنگوئن", r: 0b101 },
  { name: "اردک", r: 0b111 },
  { name: "خفاش", r: 0b010 },
  { name: "ماهی", r: 0b100 },
  { name: "گربه", r: 0 },
  { name: "عقاب", r: 0b011 },
  { name: "زنبور", r: 0b010 },
];
/** Where each token goes in the true picture (two in one region sit one above the other). */
const TRUE_SPOTS: [number, number][] = [
  [0, -1.25],
  [1.25, 0.95],
  [0, 0.15],
  [-1.7, -1.3],
  [0, 2.1],
  [2.3, 2.35],
  [0, -0.7],
  [-1.7, -0.75],
];

const EX_FORMS: [Statement["form"], boolean][] = [
  ["all", false],
  ["all", true],
  ["some", false],
  ["no", false],
  ["someNot", false],
  ["someNot", true],
];

/** A statement about the tokens as placed: ✓ / ✗, with one token that shows it. */
function judge(s: Statement, placed: { name: string; r: number }[]): { ok: boolean | null; who: string | null } {
  const inA = placed.filter((t) => (t.r >> s.a) & 1);
  if (!inA.length) return { ok: null, who: null };
  const both = inA.filter((t) => (t.r >> s.b) & 1);
  const out = inA.filter((t) => !((t.r >> s.b) & 1));
  switch (s.form) {
    case "all":
      return { ok: !out.length, who: out[0]?.name ?? null };
    case "no":
      return { ok: !both.length, who: both[0]?.name ?? null };
    case "some":
      return { ok: both.length > 0, who: both[0]?.name ?? null };
    case "someNot":
      return { ok: out.length > 0, who: out[0]?.name ?? null };
  }
}

export function LogicTool() {
  const [mode, setMode] = useState<Mode>("explore");
  const [classroom, setClassroom] = useClassroom();

  // Playback 0 … 1 (show me).
  const [f, setF] = useState(0);
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
  const [area, setArea] = useState<LogicType>("grid");
  const [exSize, setExSize] = useState<3 | 4>(3);
  const [exSeed, setExSeed] = useState(19);
  const exGrid = useMemo(() => makeLogicQuestion("grid", exSize === 3 ? 1 : 2, exSeed) as GridQuestion, [exSize, exSeed]);
  const [exMarks, setExMarks] = useState<{ key: string; marks: Mark[] } | null>(null);
  const exGridKey = `${exSize}-${exSeed}`;
  const gridMarks = exMarks?.key === exGridKey ? exMarks.marks : Array<Mark>(exGrid.size * exGrid.size).fill(0);
  const [autoX, setAutoX] = useState(true);
  const [exLiarSeed, setExLiarSeed] = useState(7);
  const exLiars = useMemo(() => makeLogicQuestion("liars", 2, exLiarSeed) as LiarsQuestion, [exLiarSeed]);
  const [exKnown, setExKnown] = useState<{ seed: number; known: (boolean | null)[] } | null>(null);
  const known = exKnown?.seed === exLiarSeed ? exKnown.known : exLiars.people.map(() => null);
  const [tokens, setTokens] = useState<Token[]>(() => EX_TOKENS.map((t, id) => ({ id, name: t.name, at: null })));
  const [pair, setPair] = useState<[number, number]>([0, 1]);

  // Show me
  const [showType, setShowType] = useState<LogicType>("grid");
  const [showLevel, setShowLevel] = useState<Level>(2);
  const [showSeed, setShowSeed] = useState(219);
  const [showSize, setShowSize] = useState<3 | 4>(4);
  const [showExtra, setShowExtra] = useState(false);
  const showQ = useMemo(() => make(showType, showLevel, showSeed, showSize, showExtra), [showType, showLevel, showSeed, showSize, showExtra]);
  const steps = useMemo(() => (showQ.type === "grid" ? gridSteps(showQ.size, showQ.clues).steps : showQ.type === "liars" ? liarSteps(showQ) : vennSteps(showQ)), [showQ]);
  const stepMs = 1700;

  // Try it: answers belong to one question, so they reset with it.
  const [tryType, setTryType] = useState<LogicType>("grid");
  const [tryLevel, setTryLevel] = useState<Level>(1);
  const [seed, setSeed] = useState(1919);
  const [size, setSize] = useState<3 | 4>(3);
  const [extra, setExtra] = useState(false);
  const question = useMemo(() => make(tryType, tryLevel, seed, size, extra), [tryType, tryLevel, seed, size, extra]);
  const key = qKey(tryType, tryLevel, seed, size, extra);
  const [entry, setEntry] = useState<(TryEntry & { key: string }) | null>(null);
  const cur: TryEntry = entry?.key === key ? entry : blankEntry(question);
  const setCur = (e: TryEntry) => setEntry({ ...e, key });

  // Shareable links: #try=grid&level=2&seed=7&size=3&extra=1(&a=v_x…), #try=liars…&a=rd_, #try=venn…&a=2,
  // #show=venn&level=3&seed=5&step=4, #explore=venn, #classroom
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.has("classroom")) applyClassroom(true);
    const tryParam = params.get("try");
    const show = params.get("show");
    const explore = params.get("explore");
    const lv = Number(params.get("level"));
    const level: Level | null = lv === 1 || lv === 2 || lv === 3 ? lv : null;
    const sd = Number(params.get("seed"));
    const sdOk = params.has("seed") && Number.isInteger(sd) && sd >= 0;
    const sz = Number(params.get("size"));
    const ex = params.get("extra") === "1";
    const timer = setTimeout(() => {
      if (tryParam && tryParam in LOGIC_TYPE_LABEL) {
        const t = tryParam as LogicType;
        const l = level ?? 1;
        const s = sdOk ? sd : 1919;
        const z: 3 | 4 = sz === 3 || sz === 4 ? sz : defaultSize(l);
        setMode("try");
        setTryType(t);
        setTryLevel(l);
        setSeed(s);
        setSize(z);
        setExtra(ex);
        const a = params.get("a");
        if (a !== null) {
          const q = make(t, l, s, z, ex);
          const e = blankEntry(q);
          if (q.type === "grid") e.marks = e.marks.map((_, c) => (a[c] === "v" ? 1 : a[c] === "x" ? -1 : 0));
          if (q.type === "liars") e.liar = e.liar.map((_, p) => (a[p] === "d" ? true : a[p] === "r" ? false : null));
          if (q.type === "venn") {
            const pk = Number(a) - 1;
            e.pick = Number.isInteger(pk) && pk >= 0 && pk < q.options.length ? pk : null;
          }
          e.checked = q.type === "grid" ? e.marks.some((m) => m === 1) : q.type === "liars" ? e.liar.every((x) => x !== null) : e.pick !== null;
          setEntry({ ...e, key: qKey(t, l, s, z, ex) });
        }
      } else if (show && show in LOGIC_TYPE_LABEL) {
        const t = show as LogicType;
        const l = level ?? 2;
        const s = sdOk ? sd : 219;
        const z: 3 | 4 = sz === 3 || sz === 4 ? sz : defaultSize(l);
        setShowType(t);
        setShowLevel(l);
        setShowSeed(s);
        setShowSize(z);
        setShowExtra(ex);
        setMode("show");
        const q = make(t, l, s, z, ex);
        const n = (q.type === "grid" ? gridSteps(q.size, q.clues).steps : q.type === "liars" ? liarSteps(q) : vennSteps(q)).length;
        const step = Number(params.get("step"));
        setF(params.has("step") && Number.isFinite(step) ? Math.min(1, Math.max(0, step / n)) : 1);
      } else if (explore === "grid" || explore === "venn" || explore === "liars") setArea(explore);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const switchMode = (m: Mode) => {
    setMode(m);
    setRun(null);
    setF(m === "show" ? 0 : 1);
  };

  const freshQuestion = (type = tryType, level = tryLevel, z = size, e = extra) => {
    setTryType(type);
    setTryLevel(level);
    setSize(z);
    setExtra(e);
    setSeed(newSeed());
    setEntry(null);
  };

  const freshShow = (type = showType, level = showLevel, z = showSize, e = showExtra) => {
    setShowType(type);
    setShowLevel(level);
    setShowSize(z);
    setShowExtra(e);
    setShowSeed(newSeed());
    setRun(null);
    setF(0);
  };

  /** Show me, on the question being tried. */
  const showThis = () => {
    setShowType(tryType);
    setShowLevel(tryLevel);
    setShowSeed(seed);
    setShowSize(size);
    setShowExtra(extra);
    setMode("show");
    const q = question;
    const n = (q.type === "grid" ? gridSteps(q.size, q.clues).steps : q.type === "liars" ? liarSteps(q) : vennSteps(q)).length;
    animate(stepMs * n);
  };

  const play = () => {
    if (run) return setRun(null);
    animate(stepMs * Math.max(1, steps.length), f >= 0.99 ? 0 : f);
  };

  // The board
  const k = Math.round(f * steps.length);
  let board: React.ReactNode;
  let view: View;
  let boardLabel = "تخته استدلال";

  if (mode === "explore") {
    if (area === "grid") {
      const q = exGrid;
      const check = gridCheck({ size: q.size, clues: q.clues }, gridMarks);
      view = gridView(q.size, q.clues.map((c) => clueText(q, c)));
      boardLabel = "جدول منطقی؛ روی خانه‌ها بزن";
      board = (
        <GridFigure
          n={q.size}
          people={q.people}
          items={itemsOf(q)}
          marks={gridMarks}
          clues={q.clues.map((c) => clueText(q, c))}
          clueState={(j) => (check.clue === j ? "broken" : null)}
          bad={check}
          onCell={(c) => {
            const m = nextMark(gridMarks[c]);
            let next = [...gridMarks];
            next[c] = m;
            if (m === 1 && autoX) next = withCrosses(q.size, next, c);
            setExMarks({ key: exGridKey, marks: next });
          }}
        />
      );
    } else if (area === "liars") {
      view = liarsView(exLiars.people.length);
      boardLabel = "راستگو و دروغگو؛ روی برچسب هر نفر بزن";
      board = (
        <LiarsFigure
          people={exLiars.people}
          texts={exLiars.says.map((s, p) => (s ? saysText(exLiars.people, p, s) : null))}
          known={known}
          status={liveStatus(exLiars, known)}
          onToggle={(p) => setExKnown({ seed: exLiarSeed, known: known.map((x, i) => (i === p ? nextLiar(x) : x)) })}
        />
      );
    } else {
      const [x, y, w] = vennBox(3);
      view = [x, y, w, round2(BANK_Y + 0.62 + 0.45 - y)];
      boardLabel = "نمودار ون؛ نام‌ها را به دایره‌ها بکش";
      board = (
        <>
          <VennFigure names={EX_GROUPS.map(plural)} />
          <TokenLayer tokens={tokens} onMove={(id, at) => setTokens((ts) => ts.map((t) => (t.id === id ? { ...t, at } : t)))} />
        </>
      );
    }
  } else {
    const q = mode === "show" ? showQ : question;
    if (q.type === "grid") {
      const texts = q.clues.map((c) => clueText(q, c));
      view = gridView(q.size, texts);
      if (mode === "show") {
        const st = steps as GridStep[];
        const last = st[k - 1];
        // The clue being worked on: the last clue step so far.
        let now = -1;
        for (let j = 0; j < k; j++) if (st[j].kind === "clue") now = (st[j] as { clue: number }).clue;
        const state = (j: number): ClueState => (j < now ? "done" : j === now ? (k === st.length ? "done" : "now") : null);
        boardLabel = "حل قدم‌به‌قدم";
        board = <GridFigure n={q.size} people={q.people} items={itemsOf(q)} marks={marksAfter(q.size, st, k)} clues={texts} clueState={state} focus={stepCells(last)} />;
      } else {
        const check = cur.checked ? gridCheck(q, cur.marks) : null;
        boardLabel = "جدول منطقی؛ روی خانه‌ها بزن";
        board = (
          <GridFigure
            n={q.size}
            people={q.people}
            items={itemsOf(q)}
            marks={cur.marks}
            clues={texts}
            clueState={(j) => (check?.clue === j ? "broken" : null)}
            bad={check}
            onCell={check?.tag === "right" ? undefined : (c) => setCur({ ...cur, checked: false, marks: cur.marks.map((m, i) => (i === c ? nextMark(m) : m)) })}
          />
        );
      }
    } else if (q.type === "liars") {
      view = liarsView(q.people.length);
      const texts = q.says.map((s, p) => (s ? saysText(q.people, p, s) : null));
      if (mode === "show") {
        const st = steps as ReturnType<typeof liarSteps>;
        const last = st[k - 1];
        const status: ("fits" | "clash" | null)[] = q.people.map(() => null);
        if (last?.kind === "clash") status[last.by] = "clash";
        if (last?.kind === "fits") q.says.forEach((s, p) => s && (status[p] = "fits"));
        boardLabel = "حالت‌به‌حالت";
        board = (
          <LiarsFigure
            people={q.people}
            texts={texts}
            known={last ? last.known : q.people.map(() => null)}
            status={status}
            focus={last && (last.kind === "force" || last.kind === "clash") ? last.by : null}
            focusWho={last && (last.kind === "assume" || last.kind === "force") ? last.who : null}
          />
        );
      } else {
        const bad = cur.checked && cur.liar.every((l) => l !== null) ? clashes(q.says, cur.liar as boolean[]) : null;
        boardLabel = "راستگو و دروغگو؛ روی برچسب هر نفر بزن";
        board = (
          <LiarsFigure
            people={q.people}
            texts={texts}
            known={cur.liar}
            status={bad ? q.says.map((s, p) => (s ? (bad.includes(p) ? "clash" : "fits") : null)) : []}
            onToggle={bad && bad.length === 0 ? undefined : (p) => setCur({ ...cur, checked: false, liar: cur.liar.map((x, i) => (i === p ? nextLiar(x) : x)) })}
          />
        );
      }
    } else {
      view = vennView(q);
      const chain = chainOf(q);
      if (mode === "show") {
        const st = steps as ReturnType<typeof vennSteps>;
        const stmts: Statement[][] = [[], []];
        for (const s of st.slice(0, k)) {
          if (s.kind === "premise") stmts[s.stage].push(s.s);
          if (s.kind === "middle") stmts[1].push(s.s);
        }
        const last = st[k - 1];
        const opt = last?.kind === "option" ? q.options[last.index] : null;
        const dots = opt && last?.kind === "option" && last.tag !== "right" ? exampleModel([...chain, negate(opt)], q.terms.length) : null;
        boardLabel = "نمودار ون قدم‌به‌قدم";
        board = <VennBoard q={q} stmts={stmts} dots={dots} />;
      } else if (cur.checked && cur.pick !== null) {
        const opt = q.options[cur.pick];
        const stmts = q.level === 3 ? [chain.slice(0, 2), [q.middle!, chain[2]]] : [chain];
        const dots = opt && q.tags[cur.pick] !== "right" ? exampleModel([...chain, negate(opt)], q.terms.length) : null;
        board = <VennBoard q={q} stmts={stmts} dots={dots} />;
      } else {
        boardLabel = "نمودار ون؛ برای فکر کردن، روی بخش‌ها بزن تا هاشور بخورند";
        board = <VennBoard q={q} stmts={[]} user={cur.user} onRegion={(j, r) => setCur({ ...cur, user: cur.user.map((u, i) => (i === j ? u ^ (1 << r) : u)) })} />;
      }
    }
  }

  // Explore: side panel numbers
  const exCheck = gridCheck({ size: exGrid.size, clues: exGrid.clues }, gridMarks);
  const exStatus = liveStatus(exLiars, known);
  const placed = tokens.filter((t) => t.at).map((t) => ({ name: t.name, r: regionAt(3, t.at![0], t.at![1]) }));
  const exNames = EX_GROUPS;

  const q = mode === "show" ? showQ : question;
  const stepLine = (i: number) => {
    const s = steps[i];
    if (showQ.type === "grid") return gridStepText(showQ, s as GridStep);
    if (showQ.type === "liars") return liarStepText(showQ, s as ReturnType<typeof liarSteps>[number]);
    return vennStepText(showQ, s as ReturnType<typeof vennSteps>[number]);
  };
  const depthOf = (i: number) => (showQ.type === "liars" ? (steps[i] as { depth: number }).depth : 0);

  return (
    <main className={styles.layout}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          → همه ابزارها
        </Link>
        <h1>
          <span className={styles.badge}>{fa(19)}</span> تخته استدلال
        </h1>
        <div className={styles.tabs} role="tablist" aria-label="حالت ابزار">
          <button role="tab" aria-selected={mode === "explore"} onClick={() => switchMode("explore")}>
            کشف: خودت علامت بزن
          </button>
          <button
            role="tab"
            aria-selected={mode === "show"}
            onClick={() => {
              switchMode("show");
              animate(stepMs * Math.max(1, steps.length));
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
          <TeacherGuideButton guide={LOGIC_GUIDE} />
          <Link href={`/tools/logic/worksheet?types=${tryType}&level=${tryLevel}`}>کاربرگ</Link>
        </div>
      </header>

      <section className={styles.stageWrap} aria-label="صفحه تخته استدلال">
        <Board view={view} imageName="logic" label={boardLabel}>
          {board}
        </Board>
      </section>

      <section className={styles.controls}>
        {mode === "show" ? (
          <label className={styles.slider}>
            <button className={styles.playSmall} onClick={play} aria-label={run ? "توقف" : "پخش"}>
              {run ? "⏸" : "▶"}
            </button>
            <span>
              قدم {fa(k)} از {fa(steps.length)}
            </span>
            <input
              type="range"
              min={0}
              max={steps.length}
              step={1}
              value={k}
              onChange={(e) => {
                setRun(null);
                setF(Number(e.target.value) / Math.max(1, steps.length));
              }}
              aria-label="قدم"
            />
          </label>
        ) : (
          <p className={styles.stepText} style={{ margin: 0 }}>
            {mode === "try"
              ? q.type === "grid"
                ? "اول فکر کن: کدام سرنخ یک خانه را مستقیم ✗ می‌کند؟"
                : q.type === "liars"
                  ? "اول فکر کن: اگر نفر اول راستگو باشد، چه می‌شود؟"
                  : "اول فکر کن: هر جمله کدام بخش را خالی می‌کند؟"
              : area === "grid"
                ? exCheck.tag === "right"
                  ? "✓ جدول کامل است و تناقضی ندارد."
                  : `${fa(gridMarks.filter((m) => m === 1).length)} ✓ از ${fa(exGrid.size)}`
                : area === "liars"
                  ? exStatus.every((s, p) => s === "fits" || !exLiars.says[p]) && known.every((x) => x !== null)
                    ? "✓ همه حرف‌ها جور است!"
                    : "برای هر نفر حدس بزن و ببین کدام حرف جور نیست"
                  : `${fa(placed.length)} از ${fa(tokens.length)} نام روی نمودار`}
          </p>
        )}
      </section>

      <aside className={styles.side}>
        {mode === "explore" && (
          <>
            <div className={styles.chipsRow} role="radiogroup" aria-label="بخش">
              {(Object.keys(LOGIC_TYPE_LABEL) as LogicType[]).map((a) => (
                <button key={a} role="radio" aria-checked={area === a} onClick={() => setArea(a)}>
                  {a === "venn" ? "نمودار ون" : LOGIC_TYPE_LABEL[a]}
                </button>
              ))}
            </div>

            {area === "grid" && (
              <>
                <h2 className={styles.progress}>جدول را با سرنخ‌ها پر کن</h2>
                <p className={styles.note}>روی هر خانه بزن: یک بار ✓، دو بار ✗، سه بار پاک. سرنخ‌ها سمت چپ جدول‌اند. اگر چیزی با سرنخی یا با قانون «هر کس یکی» جور نباشد، هاشور می‌خورد.</p>
                <div className={styles.row}>
                  <button className={styles.toggle} aria-pressed={autoX} onClick={() => setAutoX(!autoX)}>
                    {autoX ? "✓ " : ""}با هر ✓، بقیه سطر و ستونش خودکار ✗ شود
                  </button>
                </div>
                <div className={styles.chipsRow} role="radiogroup" aria-label="اندازه جدول" style={{ marginTop: 8 }}>
                  {([3, 4] as const).map((s) => (
                    <button key={s} role="radio" aria-checked={exSize === s} onClick={() => setExSize(s)}>
                      {sizeFa(s)}
                    </button>
                  ))}
                </div>
                <p className={`${styles.status} ${exCheck.tag === "right" ? styles.good : exCheck.tag === "incomplete" ? styles.info : styles.warn}`}>
                  {exCheck.tag === "right"
                    ? "✓ جدول کامل و بی‌تناقض است. جواب فقط همین است."
                    : exCheck.tag === "incomplete"
                      ? "تا اینجا تناقضی نیست."
                      : exCheck.clue !== null
                        ? `✗ با سرنخ ${fa(exCheck.clue + 1)} جور نیست (هاشور).`
                        : "✗ یک سطر یا ستون دو ✓ دارد یا جایی برایش نمانده (هاشور)."}
                </p>
                <div className={styles.row}>
                  <button className={styles.clear} onClick={() => setExMarks({ key: exGridKey, marks: gridMarks.map(() => 0) })}>
                    پاک کردن
                  </button>
                  <button className={styles.clear} onClick={() => setExSeed(newSeed())}>
                    جدول تازه
                  </button>
                </div>
              </>
            )}

            {area === "liars" && (
              <>
                <h2 className={styles.progress}>حدس بزن و امتحان کن</h2>
                <p className={styles.note}>{LIARS_RULE}</p>
                <p className={styles.note}>روی برچسب هر نفر بزن: ؟ ← راستگو ← دروغگو. وقتی همه آدم‌های یک جمله معلوم باشند، کنارش «✓ جور است» یا «✗ جور نیست» (با هاشور) می‌آید.</p>
                <p className={`${styles.status} ${exStatus.includes("clash") ? styles.warn : styles.info}`}>
                  {exStatus.includes("clash") ? "✗ این حدس تناقض دارد؛ یک برچسب را عوض کن." : known.every((x) => x !== null) ? "✓ بی‌تناقض! این حدس جواب است." : "هنوز همه برچسب‌ها معلوم نیست."}
                </p>
                <div className={styles.row}>
                  <button className={styles.clear} onClick={() => setExKnown({ seed: exLiarSeed, known: exLiars.people.map(() => null) })}>
                    پاک کردن
                  </button>
                  <button className={styles.clear} onClick={() => setExLiarSeed(newSeed())}>
                    نمونه تازه
                  </button>
                </div>
              </>
            )}

            {area === "venn" && (
              <>
                <h2 className={styles.progress}>هر نام را در دایره‌هایش بگذار</h2>
                <p className={styles.note}>نام‌ها را از پایین صفحه بکش و رها کن. اگر در هیچ دایره‌ای نیست، بیرون دایره‌ها بگذار. برای برگرداندن، زیر خط‌چین رها کن.</p>
                <div className={styles.chipsRow} role="radiogroup" aria-label="دو دایره">
                  {(
                    [
                      [0, 1],
                      [0, 2],
                      [1, 2],
                    ] as [number, number][]
                  ).map(([a, b]) => (
                    <button key={`${a}${b}`} role="radio" aria-checked={pair[0] === a && pair[1] === b} onClick={() => setPair([a, b])}>
                      {exNames[a]} و {exNames[b]}
                    </button>
                  ))}
                </div>
                <table className={styles.countTable}>
                  <tbody>
                    {EX_FORMS.map(([form, flip]) => {
                      const s: Statement = { form, a: flip ? pair[1] : pair[0], b: flip ? pair[0] : pair[1] };
                      const j = judge(s, placed);
                      return (
                        <tr key={`${form}${flip}`}>
                          <td>{stmtText(exNames, s)}</td>
                          <td style={{ whiteSpace: "nowrap", fontWeight: 700 }}>{j.ok === null ? "—" : j.ok ? `✓${j.who ? ` (${j.who})` : ""}` : `✗ (${j.who})`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className={styles.note}>«—» یعنی هنوز کسی در آن دایره نیست. نام داخل پرانتز، نمونه‌ای است که جمله را درست یا نادرست می‌کند.</p>
                <div className={styles.row}>
                  <button className={styles.clear} onClick={() => setTokens((ts) => ts.map((t) => ({ ...t, at: null })))}>
                    همه را برگردان
                  </button>
                  <button className={styles.clear} onClick={() => setTokens((ts) => ts.map((t) => ({ ...t, at: TRUE_SPOTS[t.id] })))}>
                    چیدن درست
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {mode === "show" && (
          <>
            <div className={tryStyles.types} role="radiogroup" aria-label="نوع مسئله">
              {(Object.keys(LOGIC_TYPE_LABEL) as LogicType[]).map((t) => (
                <button key={t} role="radio" aria-checked={showType === t} onClick={() => freshShow(t)}>
                  {LOGIC_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            <div className={tryStyles.chips} role="radiogroup" aria-label="سطح" style={{ marginTop: 6 }}>
              {([1, 2, 3] as Level[]).map((l) => (
                <button key={l} role="radio" aria-checked={showLevel === l} onClick={() => freshShow(showType, l, defaultSize(l))}>
                  سطح {fa(l)}
                </button>
              ))}
            </div>
            {showType === "grid" && (
              <div className={tryStyles.chips} role="group" aria-label="اندازه جدول و تعداد سرنخ" style={{ marginTop: 6 }}>
                {([3, 4] as const).map((s) => (
                  <button key={s} role="radio" aria-checked={showSize === s} onClick={() => freshShow(showType, showLevel, s)}>
                    {sizeFa(s)}
                  </button>
                ))}
                <button role="checkbox" aria-checked={showExtra} onClick={() => freshShow(showType, showLevel, showSize, !showExtra)}>
                  {showExtra ? "✓ " : ""}سرنخ بیشتر
                </button>
              </div>
            )}
            <h2 className={styles.progress} style={{ marginTop: 10 }}>
              {showType === "grid" ? "سرنخ‌به‌سرنخ" : showType === "liars" ? "حالت‌به‌حالت" : "جمله‌به‌جمله"}
            </h2>
            <p className={styles.note}>
              {showType === "grid"
                ? "هر سرنخ یکی‌یکی اعمال می‌شود و نتیجه‌اش در جدول می‌آید. خانه‌های تازه قاب پررنگ دارند."
                : showType === "liars"
                  ? `${LIARS_RULE} یک نفر را راستگو فرض می‌کنیم و ادامه می‌دهیم؛ اگر به تناقض رسیدیم، آن حالت نمی‌شود.`
                  : "هر جمله روی نمودار کشیده می‌شود: بخش خالی هاشور، «بعضی» ×. بعد هر گزینه امتحان می‌شود؛ نقطه‌ها یک نمونه‌اند."}
            </p>
            {showQ.type === "venn" && <p className={styles.stepText}>{showQ.premises.map((s) => `«${stmtText(vennNames(showQ), s)}»`).join("، ")}</p>}
            <ol className={styles.note} style={{ listStyle: "none", padding: 0 }}>
              {k === 0 ? (
                <li>▶ را بزن تا حل شروع شود.</li>
              ) : (
                steps.slice(0, k).map((_, i) => (
                  <li key={i} style={{ ...(i === k - 1 ? { fontWeight: 700, color: "var(--ink)" } : {}), paddingInlineStart: `${depthOf(i) * 14}px` }} aria-current={i === k - 1 ? "step" : undefined}>
                    {`${i === k - 1 ? "◀ " : ""}${fa(i + 1)}. ${stepLine(i)}`}
                  </li>
                ))
              )}
            </ol>
            <div className={styles.row}>
              <button className={styles.clear} disabled={k <= 0} onClick={() => (setRun(null), setF((k - 1) / steps.length))}>
                قدم قبل
              </button>
              <button className={styles.clear} disabled={k >= steps.length} onClick={() => (setRun(null), setF((k + 1) / steps.length))}>
                قدم بعد
              </button>
            </div>
            <div className={styles.row} style={{ marginTop: 8 }}>
              <button className={styles.clear} onClick={() => freshShow()}>
                نمونه تازه
              </button>
              <button
                className={styles.clear}
                onClick={() => {
                  setTryType(showType);
                  setTryLevel(showLevel);
                  setSeed(showSeed);
                  setSize(showSize);
                  setExtra(showExtra);
                  setEntry(null);
                  switchMode("try");
                }}
              >
                خودم امتحان کنم
              </button>
            </div>
          </>
        )}

        {mode === "try" && (
          <LogicTryPanel
            question={question}
            type={tryType}
            level={tryLevel}
            size={size}
            extra={extra}
            entry={cur}
            onLiar={(p, l) => setCur({ ...cur, checked: false, liar: cur.liar.map((x, i) => (i === p ? l : x)) })}
            onPick={(i) => setCur({ ...cur, pick: i })}
            onCheck={() => setCur({ ...cur, checked: true })}
            onClear={() => setCur(blankEntry(question))}
            onType={(t) => freshQuestion(t, tryLevel)}
            onLevel={(l) => freshQuestion(tryType, l, defaultSize(l))}
            onSize={(z) => freshQuestion(tryType, tryLevel, z)}
            onExtra={(e) => freshQuestion(tryType, tryLevel, size, e)}
            onNew={() => freshQuestion()}
            onShow={showThis}
          />
        )}
      </aside>
    </main>
  );
}

const round2 = (v: number) => Math.round(v * 10000) / 10000;

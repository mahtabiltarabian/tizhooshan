"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Board } from "@/engine-2d/Board";
import { newSeed } from "@/generators/random";
import { practiceCheck, usePractice } from "@/practice/bridge";
import {
  candidates,
  checkCond,
  layoutOf,
  makeArrangement,
  makeSeatingQuestion,
  relation,
  SIZES,
  survivors,
  totalOf,
  treeOf,
  type Arrangement,
  type Fact,
  type FamilyQuestion,
  type Level,
  type SeatingQuestion,
  type SeatingType,
  type SeatKind,
} from "@/generators/seating";
import { setClassroom as applyClassroom, useClassroom } from "@/toolkit/classroom";
import { TeacherGuideButton } from "@/toolkit/TeacherGuide";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/ToolLayout.module.css";
import tryStyles from "@/toolkit/TryPanel.module.css";
import { SEATING_ADAPTER } from "./adapter";
import { SEATING_GUIDE } from "./guide";
import { Backdrop, familyGeometry, geometryOf, LegendShapes, PlaceFigure, TreeLines, TW, type Geometry } from "./Pictures";
import own from "./Seating.module.css";
import { CondCards, SeatingTryPanel, type Card, type TryEntry } from "./SeatingTryPanel";
import { condText, factorialText, factText, familyAskText, familyHow, SEATING_TYPE_LABEL, setting } from "./text";

type Mode = "explore" | "show" | "try";

/** An explore / show-me puzzle: arrangement, people, about how many conditions; family trees by level. */
interface Spec {
  type: SeatingType;
  n: number;
  c: number;
  level: Level;
  seed: number;
}

const FAMILY_LEVEL: Record<Level, string> = { 1: "دو نسل", 2: "سه نسل، یک طرف", 3: "سه نسل، دو طرف" };

function specPuzzle(s: Spec): Arrangement | FamilyQuestion {
  return s.type === "family" ? (makeSeatingQuestion("family", s.level, s.seed) as FamilyQuestion) : makeArrangement(s.type, s.n, s.seed, s.c);
}

const isFamily = (q: Arrangement | FamilyQuestion): q is FamilyQuestion => "facts" in q;

/** Everyone waiting, except the fixed sitter at a round table. */
function startSeats(q: Arrangement | SeatingQuestion | FamilyQuestion): number[] {
  if (isFamily(q)) return q.people.map(() => -1);
  return q.names.map((_, p) => (p === q.fixed ? 0 : -1));
}

/** Move p to a seat (null: back to waiting); whoever sat there takes p's old place. */
function placeInto(seatOf: readonly number[], p: number, seat: number | null, locked: (i: number) => boolean): number[] {
  const next = [...seatOf];
  if (seat === null) {
    next[p] = -1;
    return next;
  }
  const q = next.indexOf(seat);
  if (q >= 0 && q !== p) {
    if (locked(q)) return next;
    next[q] = seatOf[p];
  }
  next[p] = seat;
  return next;
}

/** Whether a family sentence holds when person i stands in tree place seatOf[i]. */
function factHolds(q: FamilyQuestion, f: Fact, seatOf: readonly number[]): boolean | null {
  const [sa, sb] = [seatOf[f.a], seatOf[f.b]];
  if (sa < 0 || sb < 0) return null;
  const t = treeOf(q.people);
  const male = q.people[f.a].male;
  if (t.male[sa] !== male || t.male[sb] !== q.people[f.b].male) return false;
  const want = f.k === "spouse" ? "همسر" : f.k === "parent" ? (male ? "پدر" : "مادر") : f.k === "child" ? (male ? "پسر" : "دختر") : male ? "برادر" : "خواهر";
  return relation(t, sa, sb)?.word === want;
}

/** Seat numbers beside each place, for the show-me table. */
function numbered(geo: Geometry, kind: SeatKind): Geometry {
  if (kind !== "round" && kind !== "rect") return geo;
  const labels = geo.seats.map((s, i) => ({ x: Math.round((s.x - TW / 2 - 0.22) * 1e4) / 1e4, y: Math.round((s.y - 0.22) * 1e4) / 1e4, text: fa(i + 1), size: 0.32, weight: 800 }));
  return { ...geo, labels: [...geo.labels, ...labels] };
}

/** Column heads of the candidates table. */
function seatHead(q: Arrangement, s: number) {
  if (q.kind === "floors") return `ط${fa(q.n - s)}`;
  return fa(s + 1);
}

export function SeatingTool() {
  const [mode, setMode] = useState<Mode>("explore");
  const [classroom, setClassroom] = useClassroom();

  // Show-me playback 0 … 1.
  const [f, setF] = useState(0);
  const [run, setRun] = useState<{ from: number; ms: number } | null>(null);
  useEffect(() => {
    if (!run) return;
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      start ??= now;
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
    setRun({ from, ms: Math.max(1, ms * (1 - from)) });
  }, []);

  // Explore and show me share one puzzle.
  const [spec, setSpec] = useState<Spec>({ type: "round", n: 6, c: 5, level: 2, seed: 2020 });
  const [showFromTry, setShowFromTry] = useState(false);
  const puzzle = useMemo(() => specPuzzle(spec), [spec]);
  const specKey = `${spec.type}-${spec.n}-${spec.c}-${spec.level}-${spec.seed}`;
  const [ex, setEx] = useState<{ key: string; seatOf: number[]; sel: number | null } | null>(null);
  const exCur = ex?.key === specKey ? ex : { key: specKey, seatOf: startSeats(puzzle), sel: null };

  // Try it
  const [tryType, setTryType] = useState<SeatingType>("queue");
  const [tryLevel, setTryLevel] = useState<Level>(1);
  const [seed, setSeed] = useState(1405);
  const question = useMemo(() => makeSeatingQuestion(tryType, tryLevel, seed), [tryType, tryLevel, seed]);
  const qKey = `${tryType}-${tryLevel}-${seed}`;
  const [entry, setEntry] = useState<TryEntry | null>(null);
  const cur: TryEntry = entry?.key === qKey ? entry : { key: qKey, seatOf: startSeats(question), sel: null, choice: null, checked: false };

  // Practice sessions: the next question of this tool arrives through the address.
  const practice = usePractice(SEATING_ADAPTER, (type, level, sd) => {
    setMode("try");
    if (type in SEATING_TYPE_LABEL) setTryType(type as SeatingType);
    if (level === 1 || level === 2 || level === 3) setTryLevel(level);
    setSeed(sd);
    setEntry(null);
  });

  const shown: Arrangement | FamilyQuestion = showFromTry ? question : puzzle;
  const steps = isFamily(shown) ? shown.facts.length + 1 : shown.conds.length;
  const stepMs = 1600;

  // Shareable links:
  // #try=round&level=2&seed=7(&a=…)  a: seats per person ("_" waiting) for a whole arrangement, the person for one question, the option for a family tree
  // #show=round&n=6&c=5&seed=7(&step=2), #show=family&level=3&seed=7, #show=try&type=queue&level=2&seed=7
  // #explore=queue&n=5&c=5&seed=7, #explore=family&level=2&seed=7, #classroom
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.has("classroom")) applyClassroom(true);
    const num = (k: string) => (params.has(k) && Number.isInteger(Number(params.get(k))) ? Number(params.get(k)) : null);
    const lv = num("level");
    const level: Level | null = lv === 1 || lv === 2 || lv === 3 ? lv : null;
    const sd = num("seed");
    const seedOk = sd !== null && sd >= 0 ? sd : null;
    const isType = (t: string | null): t is SeatingType => !!t && t in SEATING_TYPE_LABEL;
    const specFrom = (t: SeatingType): Spec => {
      const n = num("n");
      const c = num("c");
      return {
        type: t,
        n: t !== "family" && n !== null && SIZES[t].includes(n) ? n : t === "rect" ? 6 : 5,
        c: c !== null && c >= 2 && c <= 10 ? c : 5,
        level: level ?? 2,
        seed: seedOk ?? 2020,
      };
    };
    const tryParam = params.get("try");
    const show = params.get("show");
    const explore = params.get("explore");
    const timer = setTimeout(() => {
      if (isType(tryParam)) {
        const l = level ?? 1;
        const s = seedOk ?? 1405;
        setMode("try");
        setTryType(tryParam);
        setTryLevel(l);
        setSeed(s);
        const a = params.get("a");
        if (a !== null) {
          const q = makeSeatingQuestion(tryParam, l, s);
          const key = `${tryParam}-${l}-${s}`;
          if (q.type === "family" || q.variant === "ask") {
            const v = Number(a);
            const max = q.type === "family" ? q.options.length : q.n;
            if (Number.isInteger(v) && v >= 0 && v < max) setEntry({ key, seatOf: startSeats(q), sel: null, choice: v, checked: true });
          } else {
            const seats = a.split(",").map((x) => (x === "_" || x === "" ? -1 : Number(x)));
            const seatOf = q.names.map((_, p) => (p === q.fixed ? 0 : Number.isInteger(seats[p]) && seats[p] >= 0 && seats[p] < q.n ? seats[p] : -1));
            // Two people in one seat: keep the first.
            seatOf.forEach((s2, p) => {
              if (s2 >= 0 && seatOf.indexOf(s2) !== p) seatOf[p] = -1;
            });
            setEntry({ key, seatOf, sel: null, choice: null, checked: seatOf.every((x) => x >= 0) });
          }
        }
      } else if (show === "try" && isType(params.get("type"))) {
        setTryType(params.get("type") as SeatingType);
        setTryLevel(level ?? 1);
        setSeed(seedOk ?? 1405);
        setShowFromTry(true);
        setMode("show");
        setF(1);
      } else if (isType(show)) {
        setSpec(specFrom(show));
        setMode("show");
        setF(1);
      } else if (isType(explore)) {
        setSpec(specFrom(explore));
      }
      const step = num("step");
      if (show && step !== null) {
        const sp = show === "try" ? null : specFrom(show as SeatingType);
        const q = sp ? specPuzzle(sp) : makeSeatingQuestion(params.get("type") as SeatingType, level ?? 1, seedOk ?? 1405);
        const total = isFamily(q) ? q.facts.length + 1 : q.conds.length;
        setF(Math.min(1, Math.max(0, step / Math.max(1, total))));
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const switchMode = (m: Mode) => {
    setMode(m);
    setRun(null);
    setF(m === "show" ? 0 : 1);
  };

  const freshSpec = (patch: Partial<Spec> = {}) => {
    setSpec((s) => {
      const t = patch.type ?? s.type;
      let n = patch.n ?? s.n;
      if (t !== "family" && !SIZES[t].includes(n)) n = SIZES[t].includes(5) ? 5 : 6;
      return { ...s, ...patch, type: t, n, seed: newSeed() };
    });
    setShowFromTry(false);
    setRun(null);
    setF(mode === "show" ? 0 : 1);
  };

  const freshQuestion = (type = tryType, level = tryLevel) => {
    setTryType(type);
    setTryLevel(level);
    setSeed(newSeed());
    setEntry(null);
  };

  const play = () => {
    if (run) return setRun(null);
    animate(stepMs * Math.max(1, steps), f >= 0.99 ? 0 : f);
  };
  const k = Math.round(f * steps);

  // ─── Board ───
  let board: React.ReactNode;
  let view: [number, number, number, number];
  let label = "";
  let exCards: Card[] = [];

  if (mode === "explore") {
    const q = puzzle;
    const setSeats = (seatOf: number[], sel: number | null = null) => setEx({ key: specKey, seatOf, sel });
    if (isFamily(q)) {
      const geo = familyGeometry(q.people);
      view = geo.view;
      label = "شجره‌نامه؛ اسم‌ها را در جایشان بچین";
      exCards = q.facts.map((fct) => ({ text: factText(q, fct), state: factHolds(q, fct, exCur.seatOf) }));
      board = (
        <PlaceFigure
          geo={geo}
          names={q.people.map((p) => p.name)}
          seatOf={exCur.seatOf}
          selected={exCur.sel}
          onSelect={(p) => setSeats(exCur.seatOf, p)}
          onPlace={(p, s) => setSeats(placeInto(exCur.seatOf, p, s, () => false))}
          maleOf={(p) => q.people[p].male}
        >
          <TreeLines people={q.people} geo={geo} />
          <LegendShapes x={15.0} y={0.2} />
        </PlaceFigure>
      );
    } else {
      const lay = layoutOf(q.kind, q.n);
      const geo = geometryOf(q);
      const locked = (p: number) => p === q.fixed;
      view = geo.view;
      label = "چیدمان؛ آدم‌ها را بکش یا بزن و بچین";
      exCards = q.conds.map((c) => ({ text: condText(q, c), state: checkCond(c, exCur.seatOf, lay) }));
      board = (
        <PlaceFigure geo={geo} names={q.names} seatOf={exCur.seatOf} locked={locked} selected={exCur.sel} onSelect={(p) => setSeats(exCur.seatOf, p)} onPlace={(p, s) => setSeats(placeInto(exCur.seatOf, p, s, locked))}>
          <Backdrop q={q} geo={geo} fixedSeat={q.fixed !== null ? 0 : null} />
        </PlaceFigure>
      );
    }
  } else if (mode === "show") {
    const q = shown;
    if (isFamily(q)) {
      const geo = familyGeometry(q.people, false);
      const met = new Set(q.facts.slice(0, Math.min(k, q.facts.length)).flatMap((fct) => [fct.a, fct.b]));
      const last = k >= 1 && k <= q.facts.length ? q.facts[k - 1] : null;
      const final = k > q.facts.length;
      const target = q.ask.k === "rel" ? [q.ask.x, q.ask.y] : [q.options[q.answer].person, q.ask.y];
      view = geo.view;
      label = "ساختن شجره‌نامه از جمله‌ها";
      board = (
        // People not met yet are moved off the board.
        <PlaceFigure geo={{ ...geo, seats: geo.seats.map((s, i) => (met.has(i) ? s : { ...s, x: -50 })) }} names={q.people.map((p) => p.name)} seatOf={q.people.map((_, i) => (met.has(i) ? i : -1))} focus={final ? target : last ? [last.a, last.b] : []} maleOf={(p) => q.people[p].male} hideBank>
          <TreeLines people={q.people} geo={geo} shown={(i) => met.has(i)} />
          <LegendShapes x={15.0} y={0.2} />
        </PlaceFigure>
      );
    } else {
      const left = survivors(q, k);
      const cand = candidates(q.n, left);
      const seatOf = q.names.map((_, p) => {
        const s = cand.findIndex((c) => c.size === 1 && c.has(p));
        return s;
      });
      const geo = numbered(geometryOf(q), q.kind);
      view = geo.view;
      label = "حذف حالت‌های ناممکن، شرط به شرط";
      board = (
        <PlaceFigure geo={geo} names={q.names} seatOf={seatOf} locked={(p) => p === q.fixed} notes={(s) => (cand[s].size > 1 ? `${fa(cand[s].size)} نفر ممکن` : null)}>
          <Backdrop q={q} geo={geo} fixedSeat={q.fixed !== null ? 0 : null} />
        </PlaceFigure>
      );
    }
  } else {
    const q = question;
    const done = cur.checked;
    // The solution on the board; in a mock exam the child's own answer stays, read-only.
    const reveal = done && !practice.exam;
    const setSeats = (seatOf: number[], sel: number | null = null) => setEntry({ ...cur, seatOf, sel, checked: false });
    if (q.type === "family") {
      const geo = familyGeometry(q.people, !reveal);
      view = geo.view;
      label = "شجره‌نامه";
      const target = q.ask.k === "rel" ? [q.ask.x, q.ask.y] : [q.options[q.answer].person, q.ask.y];
      board = (
        <PlaceFigure
          geo={geo}
          names={q.people.map((p) => p.name)}
          seatOf={reveal ? q.people.map((_, i) => i) : cur.seatOf}
          selected={done ? null : cur.sel}
          onSelect={done ? undefined : (p) => setEntry({ ...cur, sel: p })}
          onPlace={done ? undefined : (p, s) => setSeats(placeInto(cur.seatOf, p, s, () => false))}
          focus={reveal ? target : []}
          maleOf={(p) => q.people[p].male}
        >
          <TreeLines people={q.people} geo={geo} />
          <LegendShapes x={15.0} y={0.2} />
        </PlaceFigure>
      );
    } else {
      const locked = (p: number) => p === q.fixed;
      view = [0, 0, 0, 0];
      if (reveal && q.variant === "place") {
        const geo = geometryOf(q, false);
        view = geo.view;
        board = (
          <PlaceFigure
            geo={geo}
            names={q.names}
            seatOf={q.solution}
            locked={locked}
            marks={(s) => (q.solution.indexOf(s) === cur.seatOf.indexOf(s) ? "good" : "bad")}
            notes={(s) => (q.solution.indexOf(s) === cur.seatOf.indexOf(s) || cur.seatOf.indexOf(s) < 0 ? null : `تو: ${q.names[cur.seatOf.indexOf(s)]}`)}
          >
            <Backdrop q={q} geo={geo} fixedSeat={q.fixed !== null ? 0 : null} />
          </PlaceFigure>
        );
      } else if (reveal) {
        const cand = candidates(q.n, survivors(q, q.conds.length));
        const seatOf = q.names.map((_, p) => cand.findIndex((c) => c.size === 1 && c.has(p)));
        const geo = geometryOf(q, false);
        view = geo.view;
        board = (
          <PlaceFigure geo={geo} names={q.names} seatOf={seatOf} locked={locked} focus={[q.answer]} notes={(s) => (cand[s].size > 1 ? "؟" : null)}>
            <Backdrop q={q} geo={geo} fixedSeat={q.fixed !== null ? 0 : null} />
          </PlaceFigure>
        );
      } else {
        const geo = geometryOf(q);
        view = geo.view;
        board = (
          <PlaceFigure
            geo={geo}
            names={q.names}
            seatOf={cur.seatOf}
            locked={locked}
            selected={done ? null : cur.sel}
            onSelect={done ? undefined : (p) => setEntry({ ...cur, sel: p })}
            onPlace={done ? undefined : (p, s) => setSeats(placeInto(cur.seatOf, p, s, locked))}
            asked={q.ask?.rel === "at" ? q.ask.p : null}
          >
            <Backdrop q={q} geo={geo} fixedSeat={q.fixed !== null ? 0 : null} />
          </PlaceFigure>
        );
      }
      label = q.variant === "place" ? "چیدمان؛ آدم‌ها را بچین" : "چیدمان؛ برای فکر کردن بچین";
    }
  }

  // ─── Side panel pieces ───
  const exDone = exCards.length > 0 && exCards.every((c) => c.state === true) && exCur.seatOf.every((s) => s >= 0);
  const exTrue = exCards.filter((c) => c.state === true).length;

  const knobs = (
    <>
      <div className={tryStyles.types} role="radiogroup" aria-label="نوع چیدمان">
        {(Object.keys(SEATING_TYPE_LABEL) as SeatingType[]).map((t) => (
          <button key={t} role="radio" aria-checked={!showFromTry && spec.type === t} onClick={() => freshSpec({ type: t })}>
            {SEATING_TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      {spec.type === "family" ? (
        <div className={tryStyles.chips} role="radiogroup" aria-label="اندازه خانواده" style={{ marginTop: 6 }}>
          {([1, 2, 3] as Level[]).map((l) => (
            <button key={l} role="radio" aria-checked={spec.level === l} onClick={() => freshSpec({ level: l })}>
              {FAMILY_LEVEL[l]}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className={own.stepper}>
            <span>تعداد نفر</span>
            <button onClick={() => freshSpec({ n: SIZES[spec.type as SeatKind][Math.max(0, SIZES[spec.type as SeatKind].indexOf(spec.n) - 1)] })} aria-label="کمتر" disabled={SIZES[spec.type as SeatKind][0] === spec.n}>
              −
            </button>
            <output>{fa(spec.n)}</output>
            <button
              onClick={() => freshSpec({ n: SIZES[spec.type as SeatKind][Math.min(SIZES[spec.type as SeatKind].length - 1, SIZES[spec.type as SeatKind].indexOf(spec.n) + 1)] })}
              aria-label="بیشتر"
              disabled={SIZES[spec.type as SeatKind].at(-1) === spec.n}
            >
              +
            </button>
          </div>
          <div className={own.stepper}>
            <span>حدود شرط‌ها</span>
            <button onClick={() => freshSpec({ c: Math.max(2, spec.c - 1) })} aria-label="کمتر" disabled={spec.c <= 2}>
              −
            </button>
            <output>{fa(spec.c)}</output>
            <button onClick={() => freshSpec({ c: Math.min(10, spec.c + 1) })} aria-label="بیشتر" disabled={spec.c >= 10}>
              +
            </button>
          </div>
        </>
      )}
      <button className={styles.clear} onClick={() => freshSpec()} style={{ marginTop: 6 }}>
        نمونه تازه
      </button>
    </>
  );

  let sidePanel: React.ReactNode;
  if (mode === "explore") {
    const q = puzzle;
    sidePanel = (
      <>
        <h2>بچین و ببین</h2>
        <p className={styles.note}>{isFamily(q) ? "این جمله‌ها درباره‌ی یک خانواده است. اسم‌ها را در شجره‌نامه بچین (مربع: مرد، بیضی: زن)." : setting(q)}</p>
        <CondCards cards={exCards} label={isFamily(q) ? "جمله‌ها" : "شرط‌ها"} />
        <p className={`${styles.status} ${exDone ? styles.good : styles.info}`} role="status">
          {exDone ? "✓ همه برقرارند! فقط همین یک چیدمان جواب است." : `${fa(exTrue)} از ${fa(exCards.length)} برقرار · ✓ برقرار، ✗ برقرار نیست، · هنوز همه‌ی آدم‌هایش چیده نشده‌اند`}
        </p>
        <div className={styles.row}>
          <button className={styles.clear} onClick={() => setEx({ key: specKey, seatOf: startSeats(q), sel: null })}>
            پاک کن
          </button>
          <button
            className={styles.clear}
            onClick={() => {
              setShowFromTry(false);
              setMode("show");
              animate(stepMs * Math.max(1, steps));
            }}
          >
            نشانم بده
          </button>
        </div>
        <h2 className={styles.progress}>نمونه دیگر</h2>
        {knobs}
      </>
    );
  } else if (mode === "show") {
    const q = shown;
    if (isFamily(q)) {
      const cards: Card[] = q.facts.map((fct, i) => ({ text: factText(q, fct), state: null, stage: i === k - 1 ? "now" : i >= k ? "later" : undefined }));
      sidePanel = (
        <>
          <h2>ساختن شجره‌نامه</h2>
          <p className={styles.note}>هر جمله یک یا دو نفر را به شجره‌نامه اضافه می‌کند. خط دوتایی یعنی زن و شوهر؛ خط‌های پایین، فرزندانشان.</p>
          <CondCards cards={cards} label="جمله‌ها" marks={false} />
          <p className={styles.stepText} style={{ textAlign: "start" }}>
            {familyAskText(q)}
          </p>
          {k > q.facts.length && <p className={`${styles.status} ${styles.good}`}>{familyHow(q)}</p>}
          <StepButtons k={k} steps={steps} onStep={(v) => (setRun(null), setF(v / steps))} />
          {!showFromTry && knobs}
          {showFromTry && (
            <button className={styles.clear} onClick={() => switchMode("try")}>
              برگشت به امتحان
            </button>
          )}
        </>
      );
    } else {
      const left = survivors(q, k);
      const cand = candidates(q.n, left);
      const cards: Card[] = q.conds.map((c, i) => ({ text: condText(q, c), state: null, stage: i === k - 1 ? "now" : i >= k ? "later" : undefined }));
      const counts = q.conds.map((_, i) => survivors(q, i + 1).length);
      const total = totalOf(q);
      sidePanel = (
        <>
          <h2>حذف حالت‌ها</h2>
          <p className={styles.note}>
            {q.fixed !== null
              ? `جای ${q.names[q.fixed]} ثابت است؛ بقیه ${factorialText(q.n - 1)} جور می‌توانند بنشینند.`
              : `${fa(q.n)} نفر ${factorialText(q.n)} جور می‌توانند بچینند.`}{" "}
            هر شرط حالت‌هایی را که با آن جور نیستند خط می‌زند.
          </p>
          <p className={own.count} role="status">
            حالت‌های ممکن: {fa(left.length)} {k > 0 && <span style={{ fontWeight: 400, fontSize: "0.85rem" }}>(از {fa(total)})</span>}
          </p>
          <CondCards cards={cards.map((c, i) => ({ ...c, text: `${c.text} ← ${fa(counts[i])} حالت` }))} label="شرط‌ها" marks={false} />
          <h2 className={styles.progress}>چه کسی کجا می‌تواند باشد؟</h2>
          <table className={own.grid}>
            <thead>
              <tr>
                <th scope="col">{q.kind === "floors" ? "طبقه" : q.kind === "queue" ? "جا" : q.kind === "rank" ? "رتبه" : "صندلی"}</th>
                {Array.from({ length: q.n }, (_, s) => (
                  <th key={s} scope="col">
                    {seatHead(q, s)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.names.map((name, p) => (
                <tr key={name}>
                  <th scope="row">{name}</th>
                  {Array.from({ length: q.n }, (_, s) => {
                    const yes = cand[s].has(p);
                    const sure = yes && cand[s].size === 1;
                    return (
                      <td key={s} className={sure ? own.sure : yes ? own.yes : own.gone} aria-label={sure ? "حتماً" : yes ? "ممکن" : "ناممکن"}>
                        {sure ? "✓" : yes ? "○" : "✗"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className={styles.note}>✓ حتماً همین‌جا · ○ هنوز ممکن · ✗ ناممکن</p>
          {showFromTry && question.type !== "family" && question.variant === "ask" && k >= steps && (
            <p className={`${styles.status} ${styles.good}`}>
              جواب پرسش: {q.names[question.answer]}؛ در همه‌ی {fa(left.length)} حالت باقی‌مانده همین است، حتی اگر جای بقیه معلوم نباشد.
            </p>
          )}
          <StepButtons k={k} steps={steps} onStep={(v) => (setRun(null), setF(v / steps))} />
          {!showFromTry && knobs}
          {showFromTry && (
            <button className={styles.clear} onClick={() => switchMode("try")}>
              برگشت به امتحان
            </button>
          )}
        </>
      );
    }
  } else {
    sidePanel = (
      <SeatingTryPanel
        key={qKey}
        question={question}
        type={tryType}
        level={tryLevel}
        entry={cur}
        exam={practice.exam}
        practice={practice.active}
        onChoice={(c) => setEntry({ ...cur, choice: c })}
        onCheck={() => {
          setEntry({ ...cur, checked: true, sel: null });
          void practiceCheck(SEATING_ADAPTER, question.type !== "family" && question.variant === "place" ? cur.seatOf : cur.choice);
        }}
        onClear={() => setEntry({ key: qKey, seatOf: startSeats(question), sel: null, choice: null, checked: false })}
        onType={(t) => freshQuestion(t, tryLevel)}
        onLevel={(l) => freshQuestion(tryType, l)}
        onNew={() => freshQuestion()}
        onShow={() => {
          setShowFromTry(true);
          setMode("show");
          animate(stepMs * Math.max(1, isFamily(question) ? question.facts.length + 1 : question.conds.length));
        }}
      />
    );
  }

  const worksheetTypes = mode === "try" ? tryType : spec.type;

  return (
    <main className={styles.layout}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          → همه ابزارها
        </Link>
        <h1>
          <span className={styles.badge}>{fa(20)}</span> میز چیدمان و شجره‌نامه
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
              animate(stepMs * Math.max(1, steps));
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
          <TeacherGuideButton guide={SEATING_GUIDE} />
          <Link href={`/tools/seating/worksheet?types=${worksheetTypes}&level=${mode === "try" ? tryLevel : spec.level}`}>کاربرگ</Link>
        </div>
      </header>

      <section className={styles.stageWrap} aria-label="صفحه چیدمان">
        <Board view={view} imageName="seating" label={label}>
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
              {isFamily(shown) ? "جمله" : "شرط"} {fa(Math.min(k, isFamily(shown) ? shown.facts.length : steps))} از {fa(isFamily(shown) ? shown.facts.length : steps)}
              {!isFamily(shown) && ` · حالت‌های ممکن: ${fa(survivors(shown, k).length)}`}
            </span>
            <input
              type="range"
              min={0}
              max={steps}
              step={1}
              value={k}
              onChange={(e) => {
                setRun(null);
                setF(Number(e.target.value) / Math.max(1, steps));
              }}
              aria-label="قدم"
            />
          </label>
        ) : (
          <p className={styles.stepText} style={{ margin: 0 }}>
            {mode === "try"
              ? question.type === "family"
                ? "اول شجره‌نامه را در ذهن (یا روی صفحه) بساز، بعد جواب بده."
                : "اول شرطی را پیدا کن که جای کسی را دقیق می‌گوید."
              : exDone
                ? "✓ همه‌ی شرط‌ها برقرارند"
                : `${fa(exTrue)} از ${fa(exCards.length)} ${isFamily(puzzle) ? "جمله" : "شرط"} برقرار`}
          </p>
        )}
      </section>

      <aside className={styles.side}>{sidePanel}</aside>
    </main>
  );
}

function StepButtons({ k, steps, onStep }: { k: number; steps: number; onStep: (k: number) => void }) {
  return (
    <div className={styles.row} style={{ margin: "8px 0" }}>
      <button className={styles.clear} disabled={k <= 0} onClick={() => onStep(k - 1)}>
        قدم قبل
      </button>
      <button className={styles.clear} disabled={k >= steps} onClick={() => onStep(k + 1)}>
        قدم بعد
      </button>
    </div>
  );
}

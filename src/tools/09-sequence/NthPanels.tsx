"use client";

// The nth term in tool 9: the boards for explore, show me and try it, and the
// side panels of explore and show me. Explore builds the train wagon by wagon
// with «اولی + (n − ۱) × گام» under each wagon and a table n → term; show me
// counts the jumps (n − 1 of them, not n), then multiplies, then adds the
// first term.

import { Board } from "@/engine-2d/Board";
import { PATTERNS, ruleParts, termAt, type NthQuestion, type PatternKind } from "@/generators/nth-term";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/ToolLayout.module.css";
import css from "./Sequence.module.css";
import { farSlots, givenSlots, madeOf, meetColumns, meetView, MeetG, nthLines, nthView, NthTrainG, PATTERN_NAME, PatternG, patternView, ruleOf, unitOf, type BoardLine } from "./Nth";
import { ltr } from "./Train";

export interface NthBuild {
  first: number;
  step: number;
  n: number;
  /** A growing pattern instead of plain numbers (show me). */
  pattern: PatternKind | null;
}
export const DEFAULT_NTH: NthBuild = { first: 3, step: 4, n: 20, pattern: null };
export const NTH_LIMITS = { first: [1, 20], step: [1, 10], n: [1, 40] } as const;
/** Show me: count the jumps until 0.45, multiply until 0.72, then add the first term. */
export const NTH_PHASES = [0.45, 0.72];

/** #show=nth&s=3&d=4&n=20 or #show=nth&p=squares&n=15 */
export function decodeNth(params: URLSearchParams): NthBuild {
  const num = (key: string, [lo, hi]: readonly [number, number], dflt: number) => {
    const v = Number(params.get(key));
    return params.has(key) && Number.isInteger(v) && v >= lo && v <= hi ? v : dflt;
  };
  const p = params.get("p");
  const pattern = p && p in PATTERNS ? (p as PatternKind) : null;
  const n = num("n", NTH_LIMITS.n, DEFAULT_NTH.n);
  if (pattern) return { first: PATTERNS[pattern].first, step: PATTERNS[pattern].step, n, pattern };
  return { first: num("s", NTH_LIMITS.first, DEFAULT_NTH.first), step: num("d", NTH_LIMITS.step, DEFAULT_NTH.step), n, pattern: null };
}

const phaseOf = (f: number) => (f < NTH_PHASES[0] ? 0 : f < NTH_PHASES[1] ? 1 : 2);

/** Explore and show me boards. */
export function NthBuildBoard({ b, show, f }: { b: NthBuild; show: boolean; f: number }) {
  const { first, step, n } = b;
  const lines: BoardLine[] = show ? nthLines({ variant: "far", first, step, n, answer: termAt(first, step, n) } as NthQuestion, f) : [];
  const label = `دنباله ${fa(first)}، ${fa(first + step)}، ${fa(first + 2 * step)}، …؛ جمله ${fa(n)}ام ${fa(termAt(first, step, n))} است`;
  if (show && b.pattern)
    return (
      <Board view={patternView(b.pattern, 3)} imageName="nth-pattern" label={`${PATTERN_NAME[b.pattern]}؛ شکل ${fa(n)}`}>
        <PatternG kind={b.pattern} shown={3} n={n} done={f >= NTH_PHASES[1]} steps={f / NTH_PHASES[0]} lines={lines} />
      </Board>
    );
  const slots = farSlots(n);
  return (
    <Board view={nthView(slots.length)} imageName="nth-term" label={label}>
      <NthTrainG
        first={first}
        step={step}
        slots={slots}
        build={show ? 1 : f}
        jumps={show ? f / NTH_PHASES[0] : 1}
        hide={show && f < NTH_PHASES[1] ? n : null}
        target={n}
        under={show ? undefined : (k) => madeOf(first, step, k)}
        lines={show ? lines : [{ text: `${fa(first)} + (${fa(n)} − ۱) × ${fa(step)} = ${fa(first)} + ${fa((n - 1) * step)} = ${fa(termAt(first, step, n))}`, o: 1 }]}
      />
    </Board>
  );
}

/** Try-it board for an nth-term question. */
export function NthTryBoard({ q, checked, f }: { q: NthQuestion; checked: number | null; f: number }) {
  const done = checked !== null;
  const lines = done ? nthLines(q, f) : [];
  const mark = done && f > 0.98 ? { right: checked === q.answer, text: checked === q.answer ? shortFa(q, q.answer) : `جواب تو: ${shortFa(q, checked)} · جواب درست: ${shortFa(q, q.answer)}` } : null;
  const late = done && f >= NTH_PHASES[1];
  switch (q.variant) {
    case "pattern":
      return (
        <Board view={patternView(q.pattern!, q.shown)} imageName="nth-pattern" label={`${PATTERN_NAME[q.pattern!]}؛ شکل ${fa(q.n)}`}>
          <PatternG kind={q.pattern!} shown={q.shown} n={q.n} done={late} steps={done ? f / NTH_PHASES[0] : 0} lines={lines} mark={mark} />
        </Board>
      );
    case "meet": {
      const cols = meetColumns(q, done);
      return (
        <Board view={meetView(cols.length, done)} imageName="nth-meet" label="دو دنباله ● و ▲">
          <MeetG q={q} done={done} reveal={f / NTH_PHASES[0]} lines={lines} mark={mark} />
        </Board>
      );
    }
    case "rule": {
      const slots = givenSlots(q.shown);
      const { coef, constant } = ruleParts(q.answer);
      return (
        <Board view={nthView(slots.length)} imageName="nth-rule" label="دنباله با گام ثابت">
          <NthTrainG first={q.first} step={q.step} slots={slots} jumps={done ? f / 0.3 : 0} under={done && f > 0.3 ? (k) => ruleOf(coef, constant, k) : undefined} lines={lines} mark={mark} />
        </Board>
      );
    }
    default: {
      const slots = done ? farSlots(q.n) : givenSlots(q.shown, q.n);
      return (
        <Board view={nthView(slots.length)} imageName="nth-term" label="دنباله با گام ثابت و یک جمله دور">
          <NthTrainG
            first={q.first}
            step={q.step}
            slots={slots}
            hide={q.variant === "far" && !late ? q.n : null}
            askPlace={q.variant === "which" && !late ? q.n : null}
            jumps={done ? f / NTH_PHASES[0] : 0}
            target={done ? q.n : null}
            lines={lines}
            mark={mark}
          />
        </Board>
      );
    }
  }
}

/** The answer, short, for the board. */
function shortFa(q: NthQuestion, v: number) {
  if (q.variant !== "rule") return fa(v);
  const { coef, constant } = ruleParts(v);
  return ltr(`${fa(coef)} × n + ${fa(constant)}`);
}

/** The rows of the table: 1 … 5, then n − 1 and n when n is far. */
const tableRows = (n: number) => (n <= 7 ? Array.from({ length: n }, (_, k) => k + 1) : [1, 2, 3, 4, 5, 0, n - 1, n]);

const CURRENT = { outline: "2px solid var(--accent)", borderRadius: 6, background: "var(--surface)" };

interface ExploreProps {
  b: NthBuild;
  set: (b: NthBuild) => void;
  onBuild: () => void;
  onShow: () => void;
}

export function NthExplorePanel({ b, set, onBuild, onShow }: ExploreProps) {
  const { first, step, n } = b;
  const stepper = (name: string, key: "first" | "step", v: number) => {
    const [lo, hi] = NTH_LIMITS[key];
    return (
      <div className={styles.row} style={{ marginBottom: 6 }}>
        <span className={css.paramName}>{name}</span>
        <button className={styles.clear} onClick={() => set({ ...b, [key]: v - 1, pattern: null })} disabled={v <= lo} aria-label={`${name} کمتر`}>
          −
        </button>
        <span className={styles.stepperLabel}>{fa(v)}</span>
        <button className={styles.clear} onClick={() => set({ ...b, [key]: v + 1, pattern: null })} disabled={v >= hi} aria-label={`${name} بیشتر`}>
          +
        </button>
      </div>
    );
  };
  return (
    <>
      <h2 className={styles.progress}>۱. اولی و گام</h2>
      {stepper("جمله اول", "first", first)}
      <label className={styles.slider} style={{ marginBottom: 6 }}>
        <span className={css.paramName}>گام {fa(step)}</span>
        <input type="range" min={NTH_LIMITS.step[0]} max={NTH_LIMITS.step[1]} step={1} value={step} onChange={(e) => set({ ...b, step: Number(e.target.value), pattern: null })} aria-label="گام" />
      </label>
      <p className={css.seqLine}>
        {[1, 2, 3, 4].map((k) => fa(termAt(first, step, k))).join("، ")}، …
      </p>
      <button className={styles.clear} onClick={onBuild}>
        ▶ واگن به واگن بساز
      </button>

      <h2 className={styles.progress}>۲. جمله nام</h2>
      <p className={styles.note}>با نوار پایین n را عوض کن. زیر هر واگن نوشته شده از اولی و گام چطور ساخته می‌شود.</p>
      <table className={styles.countTable}>
        <thead>
          <tr>
            <th>n</th>
            <th>{ltr("اولی + (n − ۱) × گام")}</th>
            <th>جمله</th>
          </tr>
        </thead>
        <tbody>
          {tableRows(n).map((k, i) =>
            k === 0 ? (
              <tr key={`gap${i}`}>
                <td colSpan={3} style={{ textAlign: "center" }}>
                  …
                </td>
              </tr>
            ) : (
              <tr key={k} aria-current={k === n ? "step" : undefined}>
                <td>
                  {k === n ? "◀ " : ""}
                  {fa(k)}
                </td>
                <td>{ltr(`${fa(first)} + ${fa(k - 1)} × ${fa(step)}`)}</td>
                <td>{fa(termAt(first, step, k))}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
      <p className={styles.status + " " + styles.info}>
        از جمله ۱ تا جمله {fa(n)}، {fa(n - 1)} جهش است (یکی کمتر از {fa(n)}): {ltr(`${fa(first)} + ${fa(n - 1)} × ${fa(step)} = ${fa(termAt(first, step, n))}`)}.
      </p>
      <button className={styles.clear} onClick={onShow}>
        نشانم بده: بشمار، ضرب کن، اضافه کن
      </button>
    </>
  );
}

const SHOW_PRESETS: [string, NthBuild][] = [
  ["۳، ۷، ۱۱ … جمله ۲۰", { first: 3, step: 4, n: 20, pattern: null }],
  ["۵، ۸، ۱۱ … جمله ۱۲", { first: 5, step: 3, n: 12, pattern: null }],
  ["مربع‌های چوب‌کبریتی", { first: 4, step: 3, n: 15, pattern: "squares" }],
  ["بعلاوه کاشی‌ها", { first: 5, step: 4, n: 10, pattern: "cross" }],
];

export function NthShowPanel({ b, f, pick }: { b: NthBuild; f: number; pick: (b: NthBuild) => void }) {
  const { first, step, n, pattern } = b;
  const phase = phaseOf(f);
  const jumps = (n - 1) * step;
  const place = pattern ? "شکل" : "جمله";
  const steps: [string, string][] = [
    [
      "بشمار:",
      pattern
        ? `هر شکل ${fa(step)} ${unitOf(pattern)} بیشتر از قبلی دارد. از شکل ۱ تا شکل ${fa(n)}، ${fa(n - 1)} بار اضافه می‌کنیم، نه ${fa(n)} بار.`
        : `از جمله ۱ تا جمله ${fa(n)}، ${fa(n - 1)} جهش است، نه ${fa(n)}: ${fa(n)} واگن فقط ${fa(n - 1)} فاصله بینشان دارند.`,
    ],
    ["ضرب کن:", `${fa(n - 1)} جهش، هر کدام ${fa(step)}: ${ltr(`${fa(n - 1)} × ${fa(step)} = ${fa(jumps)}`)}.`],
    ["اضافه کن:", `${place} اول را هم بگذار: ${ltr(`${fa(first)} + ${fa(jumps)} = ${fa(first + jumps)}`)}.`],
  ];
  return (
    <>
      <h2>بشمار، ضرب کن، اضافه کن</h2>
      <ol className={styles.rules}>
        {steps.map(([head, text], i) => (
          <li key={head} aria-current={phase === i ? "step" : undefined} style={phase === i ? CURRENT : undefined}>
            {phase === i ? "◀ " : ""}
            <strong>{head}</strong> {text}
          </li>
        ))}
      </ol>
      <div className={styles.chipsRow} role="radiogroup" aria-label="نمونه" style={{ flexWrap: "wrap" }}>
        {SHOW_PRESETS.map(([name, p]) => (
          <button
            key={name}
            role="radio"
            aria-checked={p.first === first && p.step === step && p.n === n && p.pattern === pattern}
            style={{ flex: "1 0 45%", fontSize: "0.8rem" }}
            onClick={() => pick(p)}
          >
            {name}
          </button>
        ))}
      </div>
      <p className={styles.note}>
        اگر {fa(n)} جهش برویم، به {fa(first + n * step)} می‌رسیم که {place} {fa(n + 1)}ام است، نه {place} {fa(n)}ام. اولی و گام را در «کشف» عوض کن.
      </p>
    </>
  );
}


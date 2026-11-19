"use client";

// Shared printable worksheet: settings (question types, level, count, new
// examples), an A4 sheet in two columns, and the answer key on its own page.
// Each tool supplies its question maker and how to draw a question and its
// answer. "Print" in the browser also saves as PDF, offline. The seed is
// printed, so the same sheet can be rebuilt or shown on the board.

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { newSeed } from "@/generators/random";
import { fa } from "@/tools/registry";
import styles from "./Worksheet.module.css";

export type Level = 1 | 2 | 3;
const COUNTS = [6, 8, 12];

/** Seed of question i on a sheet: spread out so neighbours differ. */
const seedOf = (base: number, i: number) => base + i * 7919;

export interface WorksheetConfig<T extends string, Q extends { type: T }> {
  /** e.g. "گسترده و تاس" */
  title: string;
  backHref: string;
  typeLabels: Record<T, string>;
  defaultTypes: T[];
  make: (type: T, level: Level, seed: number) => Q;
  /** Question text worded for paper. */
  prompt: (q: Q) => string;
  figures: (q: Q) => ReactNode;
  answer: (q: Q) => ReactNode;
}

/** A row of numbered choices (pictures or numbers); `wide` puts them two by two. */
export function Choices({ children, wide = false }: { children: ReactNode[]; wide?: boolean }) {
  return (
    <ol className={`${styles.choices} ${wide ? styles.netChoices : ""}`}>
      {children.map((c, i) => (
        <li key={i}>
          <span className={styles.choiceNum}>{fa(i + 1)}</span>
          {c}
        </li>
      ))}
    </ol>
  );
}

/** Centred row of figures. */
export function FigureRow({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}

export function WorksheetShell<T extends string, Q extends { type: T }>({ config: c }: { config: WorksheetConfig<T, Q> }) {
  const allTypes = Object.keys(c.typeLabels) as T[];
  const [types, setTypes] = useState<T[]>(c.defaultTypes);
  const [level, setLevel] = useState<Level>(1);
  const [count, setCount] = useState(8);
  const [seed, setSeed] = useState(1405);

  // Settings come from the link (?types=a,b&level=2&count=8&seed=7).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const timer = setTimeout(() => {
      const ts = (p.get("types") ?? "").split(",").filter((t): t is T => allTypes.includes(t as T));
      if (ts.length) setTypes(ts);
      const l = Number(p.get("level"));
      if (l === 1 || l === 2 || l === 3) setLevel(l);
      const n = Number(p.get("count"));
      if (COUNTS.includes(n)) setCount(n);
      const sd = Number(p.get("seed"));
      setSeed(Number.isInteger(sd) && sd > 0 ? sd : newSeed());
    }, 0);
    return () => clearTimeout(timer);
    // allTypes is derived from a constant config.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { make } = c;
  const questions = useMemo(
    () => Array.from({ length: count }, (_, i) => make(types[i % types.length], level, seedOf(seed, i))),
    [make, types, level, count, seed],
  );

  const toggleType = (t: T) => setTypes((cur) => (cur.includes(t) ? (cur.length > 1 ? cur.filter((x) => x !== t) : cur) : [...cur, t]));

  return (
    <div className={styles.page}>
      <aside className={styles.controls}>
        <Link href={c.backHref} className={styles.back}>
          → بازگشت به ابزار
        </Link>
        <h1>کاربرگ {c.title}</h1>
        <fieldset>
          <legend>نوع پرسش‌ها</legend>
          <div className={styles.typeGrid}>
            {allTypes.map((t) => (
              <label key={t}>
                <input type="checkbox" checked={types.includes(t)} onChange={() => toggleType(t)} /> {c.typeLabels[t]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className={styles.inline}>
          <label>
            سطح{" "}
            <select value={level} onChange={(e) => setLevel(Number(e.target.value) as Level)}>
              {[1, 2, 3].map((l) => (
                <option key={l} value={l}>
                  {fa(l)}
                </option>
              ))}
            </select>
          </label>
          <label>
            تعداد{" "}
            <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {COUNTS.map((n) => (
                <option key={n} value={n}>
                  {fa(n)}
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => setSeed(newSeed())}>نمونه‌های تازه</button>
          <button className={styles.print} onClick={() => window.print()}>
            چاپ یا ذخیره PDF
          </button>
        </div>
        <p className={styles.hint}>برای PDF، در پنجره چاپ مقصد «ذخیره به‌صورت PDF» را انتخاب کن. پاسخ‌نامه در صفحه جدا چاپ می‌شود.</p>
      </aside>

      <section className={styles.sheet}>
        <header className={styles.sheetHeader}>
          <h2>
            کاربرگ {c.title} · سطح {fa(level)}
          </h2>
          <p>نام: ............................ کلاس: ............ تاریخ: ............</p>
        </header>
        <ol className={styles.questions}>
          {questions.map((q, i) => (
            <li key={i} className={styles.card}>
              <p className={styles.prompt}>
                <span className={styles.qNum}>{fa(i + 1)}</span> {c.prompt(q)}
              </p>
              {c.figures(q)}
            </li>
          ))}
        </ol>
        <footer className={styles.code}>کد کاربرگ: {fa(seed)}</footer>
      </section>

      <section className={`${styles.sheet} ${styles.answers}`}>
        <h2>پاسخ‌نامه (برای معلم) · کد {fa(seed)}</h2>
        <ol className={styles.answerList}>
          {questions.map((q, i) => (
            <li key={i}>
              <span className={styles.qNum}>{fa(i + 1)}</span> {c.typeLabels[q.type]}: {c.answer(q)}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

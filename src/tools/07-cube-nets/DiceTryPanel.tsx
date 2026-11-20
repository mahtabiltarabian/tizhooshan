"use client";

// "Try it" for the dice questions: the standard die (opposite faces add up
// to 7) and rolling a die along a path. Answers are a tap on one of the six
// faces (pips and number), or on one of four nets.

import { useEffect, useMemo, useState } from "react";
import type { Cell } from "@/generators/cube-nets";
import { HIDDEN_OF, type DiceQuestion, type DieState, type Dir, type Level } from "@/generators/dice";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/TryPanel.module.css";
import { DieFaceSvg, DieIso, dieCaption, DieNetSvg, RollBoardSvg } from "./DiceSvg";
import { diceFeedback, dicePrompt, type DiceTone } from "./diceText";
import { PICKED, TypeLevelPicker, type Display, type NetsType } from "./TryPanel";

const ICON: Record<DiceTone, string> = { good: "✓", turned: "↻", bad: "✗" };

/** What the 3D stage shows for a die question that is not a net. */
export interface DieDisplay {
  start: DieState;
  path: Dir[];
  from: Cell;
  w: number;
  d: number;
  showPath: boolean;
  /** Roll to the end of the path now. */
  play: boolean;
}

/** Rolls that bring a hidden face to the top, to show it after answering. */
const REVEAL: Record<"bottom" | "north" | "west", { path: Dir[]; from: Cell }> = {
  bottom: { path: ["N", "N"], from: [1, 0] },
  north: { path: ["S"], from: [1, 2] },
  west: { path: ["E"], from: [0, 1] },
};

const digitsOf = (values: number[]) => values.map((v) => (v ? fa(v) : ""));

interface Props {
  question: DiceQuestion;
  type: NetsType;
  level: Level;
  initialPick?: number;
  onType: (t: NetsType) => void;
  onLevel: (l: Level) => void;
  onNew: () => void;
  onAnswered: () => void;
  onNetDisplay: (d: Display | null) => void;
  onDieDisplay: (d: DieDisplay | null) => void;
  /** A tap: the number picked (1 … 6), or the net index for "which net". */
  onCheck?: (value: number) => void;
  /** Mock exam: record the answer, show nothing about it (no marks, no roll, no fold). */
  exam?: boolean;
}

export function DiceTryPanel(p: Props) {
  const { question: q } = p;
  const [picked, setPicked] = useState<number | null>(p.initialPick ?? null);
  // In a mock exam the stage stays as before the answer.
  const answered = picked !== null && !p.exam;
  const isNet = q.type === "die" && q.kind === "validNet";
  /** Number picked (1–6), or the net index for "validNet". */
  const value = picked === null ? null : isNet ? picked : picked + 1;

  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    p.onCheck?.(isNet ? i : i + 1);
    if (!p.exam) p.onAnswered();
  };

  // What the stage shows: a net to fold, or the die on its board.
  const { onNetDisplay, onDieDisplay } = p;
  const shown = useMemo(() => {
    if (q.type === "roll")
      return { die: { start: q.start, path: q.path, from: q.from, w: q.w, d: q.d, showPath: true, play: answered } as DieDisplay, net: null };
    if (q.kind === "opposite") {
      const r = REVEAL[HIDDEN_OF[q.shown] as "bottom" | "north" | "west"];
      return { die: { start: q.die, path: r.path, from: r.from, w: 3, d: 3, showPath: answered, play: answered } as DieDisplay, net: null };
    }
    if (q.kind === "missing") {
      const values = [...q.net.values];
      if (answered) {
        values[q.ask] = q.answer;
        values[q.blank] = [1, 2, 3, 4, 5, 6].find((n) => !values.includes(n))!;
      }
      const symbols = digitsOf(values);
      if (!answered) symbols[q.ask] = "؟";
      return { die: null, net: { cells: q.net.cells, symbols, turns: Array(6).fill(0) } as Display };
    }
    if (!answered) return { die: null, net: { cells: [], symbols: [], turns: [] } as Display };
    const n = q.nets[picked!];
    return { die: null, net: { cells: n.cells, symbols: digitsOf(n.values), turns: Array(6).fill(0) } as Display };
  }, [q, answered, picked]);
  const key = JSON.stringify(shown);
  useEffect(() => {
    const s = JSON.parse(key) as typeof shown;
    onNetDisplay(s.net);
    onDieDisplay(s.die);
  }, [key, onNetDisplay, onDieDisplay]);

  const fb = value !== null && !p.exam ? diceFeedback(q, value) : null;
  const correctIndex = isNet ? q.answer : q.answer - 1;
  const mark = (i: number): DiceTone | null => {
    if (picked === null || p.exam) return null;
    if (i === correctIndex) return "good";
    if (i === picked) return fb?.tone === "turned" ? "turned" : "bad";
    return null;
  };

  return (
    <div className={styles.panel}>
      <TypeLevelPicker type={p.type} level={p.level} onType={p.onType} onLevel={p.onLevel} />

      <p className={styles.prompt}>{dicePrompt(q)}</p>

      {q.type === "roll" && (
        <>
          <figure className={styles.cube}>
            <DieIso die={q.start} size={120} />
            <figcaption>{dieCaption(q.start)}</figcaption>
          </figure>
          <figure className={styles.cube}>
            <RollBoardSvg w={q.w} d={q.d} from={q.from} path={q.path} size={280} />
            <figcaption>مسیر، از بالا دیده‌شده</figcaption>
          </figure>
        </>
      )}
      {q.type === "die" && q.kind === "opposite" && (
        <figure className={styles.cube}>
          <DieIso die={q.die} size={140} />
          <figcaption>{dieCaption(q.die)}</figcaption>
        </figure>
      )}
      {q.type === "die" && q.kind === "missing" && (
        <div className={styles.cube}>
          <DieNetSvg net={q.net} size={190} ask={q.ask} />
        </div>
      )}

      {isNet ? (
        <ul className={styles.options}>
          {q.nets.map((n, i) => {
            const m = mark(i);
            return (
              <li key={i}>
                <button className={`${styles.option} ${m ? styles[m] : ""}`} onClick={() => pick(i)} disabled={answered} aria-label={`گسترده ${fa(i + 1)}`}>
                  <DieNetSvg net={n} size={120} label={`گسترده ${fa(i + 1)}`} />
                  <span className={styles.optionNum}>
                    {fa(i + 1)} {m && ICON[m]}
                    {p.exam && picked === i && PICKED}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className={styles.tiles} style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          {[1, 2, 3, 4, 5, 6].map((v, i) => {
            const m = mark(i);
            return (
              <li key={v}>
                <button className={`${styles.option} ${m ? styles[m] : ""}`} onClick={() => pick(i)} disabled={answered} aria-label={`${fa(v)} خال`}>
                  <DieFaceSvg n={v} size={46} />
                  <span className={styles.optionNum}>
                    {fa(v)} {m && ICON[m]}
                    {p.exam && picked === i && PICKED}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {fb && (
        <p className={`${styles.feedback} ${styles[fb.tone]}`} role="status" aria-live="polite">
          <span className={styles.icon}>{ICON[fb.tone]}</span> {fb.text}
        </p>
      )}

      <button className={styles.next} onClick={p.onNew}>
        نمونه تازه
      </button>
    </div>
  );
}

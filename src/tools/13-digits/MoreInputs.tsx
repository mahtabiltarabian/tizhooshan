"use client";

// Answer pads for the later topics: a digit for each letter (cryptarithms)
// and a sign for each gap. The chosen slot has a thicker frame and a word
// on it, not only a colour. Also the worked-steps list for «نشانم بده».

import { OPS } from "@/generators/digits-more";
import { fa } from "@/tools/registry";
import styles from "./Digits.module.css";

interface LetterPadProps {
  letters: string[];
  value: (number | null)[];
  active: number;
  onActive: (i: number) => void;
  onChange: (v: (number | null)[]) => void;
  disabled?: boolean;
}

/** Pick a letter, then a digit; the next empty letter is picked after. */
export function LetterPad({ letters, value, active, onActive, onChange, disabled }: LetterPadProps) {
  const set = (d: number) => {
    const next = [...value];
    next[active] = d;
    onChange(next);
    const empty = next.findIndex((v, i) => v === null && i !== active);
    if (empty >= 0) onActive(empty);
  };
  return (
    <>
      <div className={styles.slots} role="radiogroup" aria-label="حرف‌ها">
        {letters.map((l, i) => (
          <button key={i} role="radio" aria-checked={active === i} onClick={() => onActive(i)} disabled={disabled}>
            {active === i ? "◀ " : ""}
            {l} = {value[i] === null ? "؟" : fa(value[i]!)}
          </button>
        ))}
      </div>
      <div className={styles.keys} aria-label={`رقم برای ${letters[active]}`}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => (
          <button key={d} onClick={() => set(d)} disabled={disabled} aria-pressed={value[active] === d}>
            {fa(d)}
          </button>
        ))}
      </div>
    </>
  );
}

interface OpsPadProps {
  value: (number | null)[];
  active: number;
  onActive: (i: number) => void;
  onChange: (v: (number | null)[]) => void;
  disabled?: boolean;
}

/** Pick a gap (or tap it on the board), then a sign; the next empty gap is picked after. */
export function OpsPad({ value, active, onActive, onChange, disabled }: OpsPadProps) {
  const set = (o: number) => {
    const next = [...value];
    next[active] = o;
    onChange(next);
    const empty = next.findIndex((v, i) => v === null && i > active);
    if (empty >= 0) onActive(empty);
  };
  return (
    <>
      <div className={styles.slots} role="radiogroup" aria-label="جای علامت‌ها">
        {value.map((v, i) => (
          <button key={i} role="radio" aria-checked={active === i} onClick={() => onActive(i)} disabled={disabled}>
            {active === i ? "◀ " : ""}جای {fa(i + 1)}: {v === null ? "؟" : OPS[v]}
          </button>
        ))}
      </div>
      <div className={`${styles.keys} ${styles.four}`} aria-label="علامت">
        {OPS.map((s, o) => (
          <button key={s} onClick={() => set(o)} disabled={disabled} aria-pressed={value[active] === o} aria-label={["جمع", "تفریق", "ضرب", "تقسیم"][o]}>
            {s}
          </button>
        ))}
      </div>
    </>
  );
}

/** Worked steps; the ones not yet reached are faint, the latest is marked ◀. */
export function StepList({ steps, shown }: { steps: string[]; shown: number }) {
  return (
    <ol className={styles.steps}>
      {steps.map((s, i) => (
        <li key={i} aria-current={i === shown - 1 ? "step" : undefined} className={i >= shown ? styles.later : undefined}>
          {i < shown ? s : "…"}
        </li>
      ))}
    </ol>
  );
}

"use client";

// A big-key number pad with Persian digits, for answers that are numbers.
// Touch boards have no keyboard, and a pad keeps the digits Persian.

import { fa } from "@/tools/registry";
import styles from "./NumberPad.module.css";

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  maxDigits?: number;
}

export function NumberPad({ value, onChange, disabled, maxDigits = 3 }: Props) {
  const press = (d: string) => {
    if (value.length >= maxDigits) return;
    onChange(value === "0" ? d : value + d);
  };
  return (
    <div className={styles.pad}>
      <output className={styles.display} aria-live="polite">
        {value ? fa(value) : "؟"}
      </output>
      <div className={styles.keys}>
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} onClick={() => press(d)} disabled={disabled}>
            {fa(d)}
          </button>
        ))}
        <button onClick={() => onChange("")} disabled={disabled || !value} aria-label="پاک کردن همه">
          C
        </button>
        <button onClick={() => press("0")} disabled={disabled}>
          {fa(0)}
        </button>
        <button onClick={() => onChange(value.slice(0, -1))} disabled={disabled || !value} aria-label="پاک کردن یک رقم">
          ⌫
        </button>
      </div>
    </div>
  );
}

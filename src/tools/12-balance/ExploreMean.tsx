"use client";

// Explore «میانگین»: columns of blocks. Tap a column, then another, to move
// its top block (or drag from one to the other); "level out" moves blocks
// from tall columns to short ones. The total and the count never change by
// moving, so the level height is always total ÷ count.

import { useState } from "react";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/ToolLayout.module.css";
import { ColumnsG, columnsView, type ColumnsFrame } from "./Columns";

const MAX_H = 15;
const START = [2, 7, 3, 4];

interface State {
  cols: number[][];
  next: number;
  selected: number | null;
  marked: number[];
}

const fresh = (heights: number[]): State => {
  let id = 0;
  return { cols: heights.map((h) => Array.from({ length: h }, () => id++)), next: id, selected: null, marked: [] };
};

/** Heights as level as whole blocks allow: q each, the first r tallest one more. */
function levelTargets(heights: number[]) {
  const n = heights.length;
  const s = heights.reduce((t, h) => t + h, 0);
  const q = Math.floor(s / n);
  const r = s % n;
  const order = heights.map((h, i) => [h, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  const target = Array<number>(n).fill(q);
  for (let k = 0; k < r; k++) target[order[k][1]]++;
  return target;
}

export function useMeanExplore() {
  const [st, setSt] = useState<State>(() => fresh(START));
  const [showLine, setShowLine] = useState(false);

  const moveOne = (from: number, to: number) =>
    setSt((s) => {
      if (!s.cols[from].length || s.cols[to].length >= MAX_H) return s;
      const cols = s.cols.map((c) => [...c]);
      const id = cols[from].pop()!;
      cols[to].push(id);
      return { ...s, cols, marked: [id], selected: cols[from].length ? from : null };
    });
  const tap = (i: number) =>
    setSt((s) => {
      if (s.selected === null) return s.cols[i].length ? { ...s, selected: i } : s;
      if (s.selected === i) return { ...s, selected: null };
      return s;
    });
  const tapOrMove = (i: number) => {
    if (st.selected !== null && st.selected !== i) moveOne(st.selected, i);
    else tap(i);
  };
  const level = () =>
    setSt((s) => {
      const target = levelTargets(s.cols.map((c) => c.length));
      const cols = s.cols.map((c) => [...c]);
      const spare: number[] = [];
      cols.forEach((c, i) => {
        while (c.length > target[i]) spare.push(c.pop()!);
      });
      const marked = [...spare];
      cols.forEach((c, i) => {
        while (c.length < target[i]) c.push(spare.pop()!);
      });
      return { ...s, cols, marked, selected: null };
    });
  const addBlock = (d: 1 | -1) =>
    setSt((s) => {
      const i = s.selected ?? s.cols.length - 1;
      const cols = s.cols.map((c) => [...c]);
      if (d > 0 && cols[i].length < MAX_H) {
        cols[i].push(s.next);
        return { ...s, cols, next: s.next + 1, marked: [s.next] };
      }
      if (d < 0 && cols[i].length > 0) {
        cols[i].pop();
        return { ...s, cols, marked: [], selected: cols[i].length ? s.selected : null };
      }
      return s;
    });
  const addColumn = (d: 1 | -1) =>
    setSt((s) => {
      if (d > 0 && s.cols.length < 6) return { ...s, cols: [...s.cols, [s.next, s.next + 1]], next: s.next + 2, marked: [s.next, s.next + 1], selected: null };
      if (d < 0 && s.cols.length > 2) return { ...s, cols: s.cols.slice(0, -1), marked: [], selected: null };
      return s;
    });

  const heights = st.cols.map((c) => c.length);
  const n = heights.length;
  const total = heights.reduce((t, h) => t + h, 0);
  const whole = total % n === 0;
  const avg = Math.floor(total / n);
  const isLevel = heights.every((h) => h === heights[0]);
  const frame: Omit<ColumnsFrame, "kind" | "note"> = {
    cols: st.cols.map((b, i) => ({ label: `ستون ${fa(i + 1)}`, blocks: b, selected: st.selected === i })),
    marked: st.marked,
    // Room to grow above the tallest column, without a tall empty board.
    max: Math.min(MAX_H, Math.max(9, ...heights) + 2),
    line: showLine && whole ? { at: avg, label: `میانگین ${fa(avg)}` } : undefined,
    caption: `جمع ${fa(total)} · تعداد ${fa(n)}`,
  };

  const board = <ColumnsG {...frame} onTap={tapOrMove} onMove={moveOne} />;
  const view = columnsView(frame);
  const status = whole
    ? `جمع ${fa(total)} ÷ تعداد ${fa(n)} = ${fa(avg)}${isLevel ? " · همه هم‌قدند: میانگین همین است" : ""}`
    : `جمع ${fa(total)} ÷ تعداد ${fa(n)} = ${fa(avg)} و باقی‌مانده ${fa(total % n)}: میانگین عدد درستی نیست (بین ${fa(avg)} و ${fa(avg + 1)})`;

  const panel = (
    <>
      <h2>ستون‌ها را هم‌قد کن</h2>
      <p className={styles.note}>
        هر ستون مکعب‌های یک نفر است. یک ستون را لمس کن (بالایش ▲ می‌آید)، بعد ستون دیگری را: مکعب بالایی جابه‌جا می‌شود. کشیدن از ستونی به ستون دیگر هم همین کار را می‌کند.
      </p>
      <p className={`${styles.status} ${isLevel && whole ? styles.good : styles.info}`}>
        {isLevel && whole ? "✓ " : ""}
        {status}
      </p>
      <div className={styles.row}>
        <button className={styles.clear} onClick={level} disabled={isLevel}>
          هم‌تراز کن
        </button>
        <button className={styles.toggle} aria-pressed={showLine} onClick={() => setShowLine(!showLine)}>
          {showLine ? "✓ " : ""}خط میانگین
        </button>
      </div>
      <h2 className={styles.progress}>عددها را عوض کن</h2>
      <p className={styles.note}>{st.selected === null ? "دکمه‌های مکعب روی ستون آخر کار می‌کنند؛ برای ستون دیگر اول آن را لمس کن." : `ستون ${fa(st.selected + 1)} انتخاب شده است.`}</p>
      <div className={styles.row}>
        <button className={styles.clear} onClick={() => addBlock(1)}>
          + مکعب
        </button>
        <button className={styles.clear} onClick={() => addBlock(-1)}>
          − مکعب
        </button>
        <button className={styles.clear} onClick={() => addColumn(1)} disabled={n >= 6}>
          + ستون
        </button>
        <button className={styles.clear} onClick={() => addColumn(-1)} disabled={n <= 2}>
          − ستون
        </button>
      </div>
      <button className={styles.clear} style={{ marginTop: 8 }} onClick={() => setSt(fresh(START))}>
        از نو
      </button>
      <p className={styles.note}>بپرس: اگر یک نفر با ۱۵ مکعب بیاید، خط میانگین چقدر بالا می‌رود؟ اگر کسی با کمتر از میانگین برود چه؟</p>
    </>
  );

  return { board, view, panel, label: `ستون‌های مکعب؛ ${status}`, status };
}

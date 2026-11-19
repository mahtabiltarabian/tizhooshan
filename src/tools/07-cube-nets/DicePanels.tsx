"use client";

// Side panels for the die: explore (roll it with arrow buttons) and show-me
// (a path rolled one step at a time, the top face written after each roll).

import { rollStates, type DieState, type Dir } from "@/generators/dice";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/ToolLayout.module.css";
import { DieIso, dieCaption } from "./DiceSvg";
import { DIR_ARROW, DIR_NAME } from "./diceText";
import panel from "./DicePanels.module.css";

function DieFacts({ die }: { die: DieState }) {
  return (
    <>
      <div className={styles.diagram}>
        <DieIso die={die} size={130} />
      </div>
      <p className={`${styles.status} ${styles.info}`}>
        {dieCaption(die)}
        <br />
        پنهان‌ها: زیر {fa(die.bottom)} · پشت {fa(die.north)} · چپ {fa(die.west)}
      </p>
    </>
  );
}

function Rules() {
  return (
    <div className={styles.rules}>
      <p>
        <strong>تاس استاندارد:</strong> ۱ و ۶، ۲ و ۵، ۳ و ۴ روبروی هم‌اند؛ مجموع هر دو وجه روبرو ۷ است. پس وجه زیر = ۷ − وجه بالا.
      </p>
      <p>
        <strong>غلت به راست:</strong> وجه بالا به راست می‌خوابد و وجه چپ بالا می‌آید؛ روبرو و پشت سر جایشان می‌مانند.
      </p>
      <p>
        <strong>غلت به عقب (دور از ما):</strong> وجه بالا به پشت می‌رود و وجه روبرو بالا می‌آید؛ راست و چپ سر جایشان می‌مانند.
      </p>
    </div>
  );
}

interface ExploreProps {
  die: DieState;
  canRoll: Record<Dir, boolean>;
  onRoll: (d: Dir) => void;
  onReset: () => void;
  rolls: number;
}

export function DiceExplorePanel({ die, canRoll, onRoll, onReset, rolls }: ExploreProps) {
  const btn = (d: Dir) => (
    <button className={panel[d]} onClick={() => onRoll(d)} disabled={!canRoll[d]} aria-label={`غلت به ${DIR_NAME[d]}`}>
      <span aria-hidden>{DIR_ARROW[d]}</span> {DIR_NAME[d]}
    </button>
  );
  return (
    <>
      <h2>تاس را بغلتان</h2>
      <p className={styles.note}>با دکمه‌ها تاس را یک خانه بغلتان. پیش از هر غلت حدس بزن کدام عدد بالا می‌آید. عقب یعنی دور از ما، جلو یعنی به طرف ما.</p>
      <div className={panel.pad} role="group" aria-label="غلتاندن تاس">
        {btn("N")}
        {btn("W")}
        {btn("E")}
        {btn("S")}
      </div>
      <DieFacts die={die} />
      <div className={styles.row}>
        <button className={styles.clear} onClick={onReset} disabled={!rolls}>
          از اول
        </button>
      </div>
      <Rules />
    </>
  );
}

interface ShowProps {
  start: DieState;
  path: Dir[];
  /** Rolls done so far, 0 … path.length (fractions mid-roll). */
  p: number;
  onNew: () => void;
}

export function DiceShowPanel({ start, path, p, onNew }: ShowProps) {
  const states = rollStates(start, path);
  const k = Math.min(path.length, Math.floor(p + 1e-6));
  return (
    <>
      <p className={styles.note}>«▶» را بزن یا با «⏭» غلت‌به‌غلت جلو برو. پیش از هر غلت بپرس: کدام وجه بالا می‌آید؟</p>
      <table className={styles.countTable}>
        <thead>
          <tr>
            <th>گام</th>
            <th>غلت</th>
            <th>بالا</th>
          </tr>
        </thead>
        <tbody>
          {states.map((s, i) => (
            <tr key={i} aria-current={i === k ? "step" : undefined}>
              <td>
                {i === k ? "◀ " : ""}
                {i === 0 ? "شروع" : fa(i)}
              </td>
              <td>{i === 0 ? "—" : `${DIR_ARROW[path[i - 1]]} ${DIR_NAME[path[i - 1]]}`}</td>
              <td>{i <= k ? fa(s.top) : "؟"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <DieFacts die={states[k]} />
      <div className={styles.row}>
        <button className={styles.clear} onClick={onNew}>
          مسیر تازه
        </button>
      </div>
      <Rules />
    </>
  );
}

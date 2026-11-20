"use client";

import { useEffect, useMemo, useState } from "react";
import {
  isDirected,
  scorePlacement,
  SLOTS,
  type CellStatus,
  type DecoratedNet,
  type Level,
  type NetOption,
  type Option,
  type Question,
  type QuestionType,
  type Slot,
} from "@/generators/cube-questions";
import type { Cell } from "@/generators/cube-nets";
import type { DiceQuestionType } from "@/generators/dice";
import { fa } from "@/tools/registry";
import { IsoCube } from "./IsoCube";
import { SymbolNet, TurnTile, type CellMark } from "./SymbolNet";
import styles from "@/toolkit/TryPanel.module.css";

/** Net questions (cube-questions.ts) and dice questions (dice.ts) share one list of types. */
export type NetsType = QuestionType | DiceQuestionType;
export const isDiceType = (t: NetsType): t is DiceQuestionType => t === "die" || t === "roll";

export const TYPE_LABEL: Record<NetsType, string> = {
  opposite: "وجه روبرو",
  touch: "وجه‌های مجاور",
  hidden: "وجه پنهان",
  missing: "وجه گمشده",
  makes: "کدام مکعب",
  cannot: "کدام مکعب نمی‌شود",
  netMakes: "کدام گسترده",
  netCannot: "کدام گسترده نمی‌شود",
  place: "نمادگذاری",
  die: "تاس استاندارد",
  roll: "غلتاندن تاس",
};

/** Question type and level pickers, shared by the net and dice panels. */
export function TypeLevelPicker({ type, level, onType, onLevel }: { type: NetsType; level: Level; onType: (t: NetsType) => void; onLevel: (l: Level) => void }) {
  return (
    <>
      <div className={styles.types} role="radiogroup" aria-label="نوع پرسش" data-practice-hide>
        {(Object.keys(TYPE_LABEL) as NetsType[]).map((t) => (
          <button key={t} role="radio" aria-checked={type === t} onClick={() => onType(t)}>
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      <div className={styles.chips} role="radiogroup" aria-label="سطح" data-practice-hide>
        {([1, 2, 3] as Level[]).map((l) => (
          <button key={l} role="radio" aria-checked={level === l} onClick={() => onLevel(l)}>
            سطح {fa(l)}
          </button>
        ))}
      </div>
    </>
  );
}

const SLOT_LABEL: Record<Slot, string> = { top: "بالا", right: "راست", left: "چپ" };

type Tone = "good" | "turned" | "bad";
const ICON: Record<Tone, string> = { good: "✓", turned: "↻", bad: "✗" };
/** The child's pick in a mock exam: marked, but not as right or wrong. */
export const PICKED = "● انتخاب تو";

/** What the 3D stage should show for the current question. */
export interface Display {
  cells: readonly Cell[];
  symbols: string[];
  turns: number[];
}

// ---------------------------------------------------------------------------
// Explanations

function whyImpossible(o: Option): string {
  const [a, b] = o.symbols ?? [];
  switch (o.mistake) {
    case "opposite":
      return `«${a}» و «${b}» روبروی هم‌اند و هیچ‌وقت کنار هم دیده نمی‌شوند.`;
    case "turned":
      return `نماد «${a}» سر جای درستش است، اما جهتش درست نیست.`;
    case "swapped":
      return `جای «${a}» و «${b}» عوض شده؛ این ترتیب با تا کردن ساخته نمی‌شود.`;
    default:
      return "";
  }
}

function whyNetFails(o: NetOption): string {
  const [a, b] = o.symbols ?? [];
  return o.mistake === "turned"
    ? `در این گسترده نماد «${a}» جهت دیگری دارد.`
    : `در این گسترده جای «${a}» و «${b}» عوض شده است.`;
}

/** Feedback for questions answered with one tap. */
function singleFeedback(q: Question, picked: number): { tone: Tone; text: string } {
  const s = q.net.symbols;
  switch (q.type) {
    case "opposite":
      if (picked === q.answer) {
        const why = q.reason === "row" ? "در یک ردیف با یک خانه فاصله‌اند (قانون ۲)." : "تا شدن گسترده را ببین.";
        return { tone: "good", text: `درست است! «${s[q.answer]}» روبروی «${s[q.target]}» است. ${why}` };
      }
      return { tone: "bad", text: `نه؛ «${s[picked]}» کنار «${s[q.target]}» قرار می‌گیرد. روبروی «${s[q.target]}»، وجه «${s[q.answer]}» است.` };

    case "hidden": {
      const shown = q.view[q.slot].symbol;
      if (picked === q.answer) return { tone: "good", text: `درست است! «${s[q.answer]}» روبروی «${shown}» است و در تصویر دیده نمی‌شود.` };
      const visible = SLOTS.map((sl) => q.view[sl].symbol);
      if (visible.includes(s[picked])) return { tone: "bad", text: `«${s[picked]}» در تصویر دیده می‌شود، پس پنهان نیست. روبروی «${shown}»، وجه «${s[q.answer]}» است.` };
      return { tone: "bad", text: `نه؛ «${s[picked]}» کنار «${shown}» است. روبروی «${shown}»، وجه «${s[q.answer]}» است.` };
    }

    case "missing":
      if (picked === q.answer) return { tone: "good", text: "درست است! نماد با همین جهت روی مکعب دیده می‌شود." };
      return { tone: "turned", text: `نماد «${s[q.blank]}» درست است، اما جهتش نه. به همسایه‌هایش در تصویر مکعب نگاه کن و بعد تا شدن را ببین.` };

    case "makes": {
      if (picked === q.answer) return { tone: "good", text: "درست است! این مکعب از همین گسترده ساخته می‌شود." };
      const o = q.options[picked];
      const tone: Tone = o.mistake === "turned" ? "turned" : "bad";
      return { tone, text: `${tone === "turned" ? "نزدیک بود! " : ""}${whyImpossible(o)}` };
    }

    case "cannot":
      if (picked === q.answer) return { tone: "good", text: `درست است! ${whyImpossible(q.options[picked])}` };
      return { tone: "bad", text: `این مکعب ساخته می‌شود. مکعب نادرست گزینه ${fa(q.answer + 1)} است: ${whyImpossible(q.options[q.answer])}` };

    case "netMakes": {
      if (picked === q.answer) return { tone: "good", text: "درست است! این گسترده همین مکعب را می‌سازد، با اینکه شکلش فرق دارد." };
      const o = q.nets[picked];
      const tone: Tone = o.mistake === "turned" ? "turned" : "bad";
      return { tone, text: `${tone === "turned" ? "نزدیک بود! " : ""}${whyNetFails(o)}` };
    }

    case "netCannot":
      if (picked === q.answer) return { tone: "good", text: `درست است! ${whyNetFails(q.nets[picked])}` };
      return { tone: "bad", text: `این گسترده همین مکعب را می‌سازد. گسترده نادرست گزینه ${fa(q.answer + 1)} است: ${whyNetFails(q.nets[q.answer])}` };

    default:
      return { tone: "bad", text: "" };
  }
}

/** The question text; `paper` words it for a printed worksheet instead of a screen. */
export function prompt(q: Question, paper = false): string {
  const s = q.net.symbols;
  const tap = paper ? "روی گسترده علامت بزن." : "روی گسترده بزن.";
  switch (q.type) {
    case "opposite":
      return `روبروی وجه «${s[q.target]}» کدام وجه است؟ ${tap}`;
    case "touch":
      return paper
        ? `همه وجه‌هایی را که با «${s[q.target]}» ضلع مشترک دارند علامت بزن.`
        : `کدام وجه‌ها با «${s[q.target]}» ضلع مشترک دارند؟ همه را انتخاب کن، بعد «بررسی» را بزن.`;
    case "hidden":
      return `در این مکعب، روبروی وجه ${SLOT_LABEL[q.slot]} («${q.view[q.slot].symbol}») کدام وجه است؟ ${tap}`;
    case "missing":
      return `یک خانه گسترده خالی است. نماد «${s[q.blank]}» با کدام جهت آنجا قرار می‌گیرد؟`;
    case "makes":
      return "کدام مکعب از این گسترده ساخته می‌شود؟";
    case "cannot":
      return "کدام مکعب از این گسترده ساخته نمی‌شود؟";
    case "netMakes":
      return "کدام گسترده این مکعب را می‌سازد؟";
    case "netCannot":
      return "کدام گسترده این مکعب را نمی‌سازد؟";
    case "place":
      return paper
        ? "نمادها را با جهت درست روی گسترده بکش تا همین مکعب ساخته شود."
        : "نمادها را روی گسترده بچین تا همین مکعب ساخته شود. نماد را انتخاب کن و روی خانه بزن؛ برای چرخاندن، دوباره روی خانه بزن.";
  }
}

// ---------------------------------------------------------------------------

interface TryPanelProps {
  question: Question;
  type: QuestionType;
  level: Level;
  /** From a shared link: answer this option straight away (1-based in links, 0-based here). */
  initialPick?: number;
  onType: (t: NetsType) => void;
  onLevel: (l: Level) => void;
  onNew: () => void;
  /** An answer was given: fold the net to show why. */
  onAnswered: () => void;
  /** The child changed their placement: unfold. */
  onEdit: () => void;
  onDisplay: (d: Display) => void;
  /** «بررسی» or a tap: the response the practice adapter grades (see adapter.ts). */
  onCheck?: (response: unknown) => void;
  /** Mock exam: record the answer, show nothing about it (no marks, no folding, no solution). */
  exam?: boolean;
}

export function TryPanel(props: TryPanelProps) {
  const { question: q, type, level, initialPick, onType, onLevel, onNew, onAnswered, onEdit, onDisplay, onCheck, exam } = props;

  // One-tap questions
  const [picked, setPicked] = useState<number | null>(initialPick ?? null);
  // Touch
  const [selected, setSelected] = useState<number[]>([]);
  const [touchChecked, setTouchChecked] = useState(false);
  // Place
  const [placed, setPlaced] = useState<{ symbols: (string | null)[]; turns: number[] }>({
    symbols: Array(6).fill(null),
    turns: Array(6).fill(0),
  });
  const [armed, setArmed] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [result, setResult] = useState<{ status: CellStatus[]; solved: boolean; best: DecoratedNet } | null>(null);
  const [reveal, setReveal] = useState(false);

  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    onCheck?.(i);
    if (!exam) onAnswered();
  };
  // In a mock exam the stage and the marks stay as before the answer.
  const shownPick = exam ? null : picked;
  // A mock exam takes the first placement only: no second try, no solution.
  const placeLocked = !!exam && tries > 0;

  // What the 3D stage shows.
  const display = useMemo<Display>(() => {
    const cells = q.net.cells;
    if (q.type === "missing" && shownPick === null) {
      const symbols = [...q.net.symbols];
      symbols[q.blank] = "؟";
      const turns = [...q.net.turns];
      turns[q.blank] = 0;
      return { cells, symbols, turns };
    }
    if (q.type === "place") {
      if (reveal && result) return { cells, symbols: result.best.symbols, turns: result.best.turns };
      return { cells, symbols: placed.symbols.map((s) => s ?? ""), turns: placed.turns };
    }
    if (q.type === "netMakes" || q.type === "netCannot") {
      // Nothing to fold until the child chooses; then fold the net they chose.
      if (shownPick === null) return { cells: [], symbols: [], turns: [] };
      const n = q.nets[shownPick].net;
      return { cells: n.cells, symbols: n.symbols, turns: n.turns };
    }
    return { cells, symbols: q.net.symbols, turns: q.net.turns };
  }, [q, shownPick, placed, reveal, result]);

  const displayKey = JSON.stringify(display);
  useEffect(() => {
    onDisplay(JSON.parse(displayKey));
  }, [displayKey, onDisplay]);

  // ----- place -----
  const tapPlaceCell = (i: number) => {
    if (result?.solved || tries >= 2 || placeLocked) return;
    const symbols = [...placed.symbols];
    const turns = [...placed.turns];
    if (armed) {
      const from = symbols.indexOf(armed);
      if (from >= 0) symbols[from] = null;
      symbols[i] = armed;
      turns[i] = 0;
      setArmed(null);
    } else if (symbols[i] && isDirected(symbols[i]!)) {
      turns[i] = (turns[i] + 1) % 4;
    } else if (symbols[i]) {
      symbols[i] = null;
    } else {
      return;
    }
    setPlaced({ symbols, turns });
    setResult(null);
    onEdit();
  };

  const checkPlace = () => {
    if (q.type !== "place") return;
    const r = scorePlacement(q.net.cells, q.faces, placed);
    setResult(r);
    setTries((n) => n + 1);
    onCheck?.(placed);
    if (!exam) onAnswered();
  };

  // ----- touch -----
  const toggleTouch = (i: number) => {
    if (touchChecked || q.type !== "touch" || i === q.target) return;
    setSelected((sel) => (sel.includes(i) ? sel.filter((x) => x !== i) : [...sel, i]));
  };

  // ----- feedback -----
  let fb: { tone: Tone; text: string } | null = null;
  if (shownPick !== null) fb = singleFeedback(q, shownPick);
  if (q.type === "touch" && touchChecked && !exam) {
    const s = q.net.symbols;
    const exact = selected.length === 4 && selected.every((i) => q.answers.includes(i));
    const opp = [0, 1, 2, 3, 4, 5].find((i) => i !== q.target && !q.answers.includes(i))!;
    fb = exact
      ? { tone: "good", text: `درست است! این چهار وجه دور «${s[q.target]}» قرار می‌گیرند و «${s[opp]}» روبروی آن است.` }
      : { tone: "bad", text: `همه وجه‌ها جز روبرویی با «${s[q.target]}» ضلع مشترک دارند. روبروی آن «${s[opp]}» است.` };
  }
  if (q.type === "place" && result && !exam) {
    const correct = result.status.filter((st) => st === "correct").length;
    const turned = result.status.filter((st) => st === "turned").length;
    if (result.solved) fb = { tone: "good", text: "آفرین! همه نمادها سر جای درست و با جهت درست هستند." };
    else {
      const parts = [`${fa(correct)} درست`];
      if (turned) parts.push(`${fa(turned)} فقط جهتش غلط`);
      parts.push(`${fa(6 - correct - turned)} جابه‌جا`);
      fb = {
        tone: turned && correct + turned === 6 ? "turned" : "bad",
        text: `${parts.join("، ")}. ${tries < 2 ? "درستشان کن و دوباره بررسی کن." : "دو فرصتت تمام شد؛ «جواب را نشانم بده» را بزن."}`,
      };
    }
  }

  // ----- marks on the main net -----
  const marks: Partial<Record<number, CellMark>> = {};
  if (q.type === "opposite" || q.type === "hidden") {
    if (q.type === "opposite") marks[q.target] = "target";
    if (exam && picked !== null) marks[picked] = "selected";
    else if (picked !== null) {
      marks[q.answer] = "correct";
      if (picked !== q.answer) marks[picked] = "wrong";
    }
  }
  if (q.type === "touch") {
    marks[q.target] = "target";
    const judged = touchChecked && !exam;
    for (const i of selected) marks[i] = judged ? (q.answers.includes(i) ? "correct" : "wrong") : "selected";
    if (judged) for (const i of q.answers) if (!selected.includes(i)) marks[i] = "missed";
  }
  if (q.type === "place" && result && !reveal && !exam) result.status.forEach((st, i) => (marks[i] = st));

  const optionMark = (i: number, turnedMistake: boolean): Tone | null => {
    if (picked === null || exam || !("answer" in q)) return null;
    if (i === q.answer) return "good";
    if (i === picked) return turnedMistake ? "turned" : "bad";
    return null;
  };

  // The net drawn in the panel (blank or placed cells for some types).
  const panelNet: DecoratedNet =
    q.type === "missing" || q.type === "place" ? { ...q.net, symbols: display.symbols, turns: display.turns } : q.net;
  const netPick =
    (q.type === "opposite" || q.type === "hidden") && picked === null
      ? pick
      : q.type === "touch"
        ? toggleTouch
        : q.type === "place"
          ? tapPlaceCell
          : undefined;

  return (
    <div className={styles.panel}>
      <TypeLevelPicker type={type} level={level} onType={onType} onLevel={onLevel} />

      <p className={styles.prompt}>{prompt(q)}</p>

      {/* Cube pictures */}
      {(q.type === "hidden" || q.type === "missing" || q.type === "netMakes" || q.type === "netCannot") && (
        <div className={styles.cube}>
          <IsoCube view={q.view} size={150} />
        </div>
      )}
      {q.type === "place" && (
        <div className={styles.twoCubes}>
          <figure>
            <IsoCube view={q.views[0]} size={120} />
            <figcaption>از روبرو</figcaption>
          </figure>
          <figure>
            <IsoCube view={q.views[1]} size={120} />
            <figcaption>از پشت</figcaption>
          </figure>
        </div>
      )}

      {/* The net (not shown for the "which net" questions, whose options are nets) */}
      {q.type !== "netMakes" && q.type !== "netCannot" && (
        <SymbolNet net={panelNet} size={200} marks={marks} onPick={netPick} />
      )}

      {/* Place: symbol palette and check */}
      {q.type === "place" && !reveal && (
        <>
          <div className={styles.palette} role="group" aria-label="نمادها">
            {q.net.symbols.map((s) => (
              <button
                key={s}
                aria-pressed={armed === s}
                className={placed.symbols.includes(s) ? styles.used : ""}
                onClick={() => setArmed(armed === s ? null : s)}
                disabled={!!result?.solved || tries >= 2 || placeLocked}
              >
                {s}
              </button>
            ))}
          </div>
          {!result?.solved && tries < 2 && !placeLocked && (
            <button className={styles.secondary} onClick={checkPlace} disabled={placed.symbols.some((s) => !s)}>
              تا کن و بررسی کن ({fa(2 - tries)} فرصت)
            </button>
          )}
          {!result?.solved && tries >= 2 && !exam && (
            <button className={styles.secondary} onClick={() => setReveal(true)}>
              جواب را نشانم بده
            </button>
          )}
        </>
      )}

      {/* Touch: check */}
      {q.type === "touch" && !touchChecked && (
        <button
          className={styles.secondary}
          disabled={!selected.length}
          onClick={() => {
            setTouchChecked(true);
            onCheck?.(selected);
            if (!exam) onAnswered();
          }}
        >
          بررسی
        </button>
      )}

      {/* Missing: four directions */}
      {q.type === "missing" && (
        <ul className={styles.tiles}>
          {[0, 1, 2, 3].map((k) => {
            const mark = optionMark(k, true);
            return (
              <li key={k}>
                <button className={`${styles.option} ${mark ? styles[mark] : ""}`} onClick={() => pick(k)} disabled={picked !== null} aria-label={`جهت ${fa(k + 1)}`}>
                  <TurnTile symbol={q.net.symbols[q.blank]} turns={k} size={56} />
                  {mark && <span className={styles.optionNum}>{ICON[mark]}</span>}
                  {exam && picked === k && <span className={styles.optionNum}>{PICKED}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Cube options */}
      {(q.type === "makes" || q.type === "cannot") && (
        <ul className={styles.options}>
          {q.options.map((o, i) => {
            const mark = optionMark(i, o.mistake === "turned" && q.type === "makes");
            return (
              <li key={i}>
                <button className={`${styles.option} ${mark ? styles[mark] : ""}`} onClick={() => pick(i)} disabled={picked !== null} aria-label={`گزینه ${fa(i + 1)}`}>
                  <IsoCube view={o.view} size={104} />
                  <span className={styles.optionNum}>
                    {fa(i + 1)} {mark && ICON[mark]}
                    {exam && picked === i && PICKED}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Net options */}
      {(q.type === "netMakes" || q.type === "netCannot") && (
        <ul className={styles.options}>
          {q.nets.map((o, i) => {
            const mark = optionMark(i, o.mistake === "turned" && q.type === "netMakes");
            return (
              <li key={i}>
                <button className={`${styles.option} ${mark ? styles[mark] : ""}`} onClick={() => pick(i)} disabled={picked !== null} aria-label={`گسترده ${fa(i + 1)}`}>
                  <SymbolNet net={o.net} size={112} label={`گسترده ${fa(i + 1)}`} />
                  <span className={styles.optionNum}>
                    {fa(i + 1)} {mark && ICON[mark]}
                    {exam && picked === i && PICKED}
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

      <button className={styles.next} onClick={onNew}>
        نمونه تازه
      </button>
    </div>
  );
}

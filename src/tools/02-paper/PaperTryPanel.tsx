"use client";

import { useEffect, useMemo, useState } from "react";
import {
  holeCells,
  perpendicular,
  creases,
  shapes,
  unfoldPoints,
  unfoldPolys,
  unfoldSegments,
  type Level,
  type PaperQuestion,
  type PaperQuestionType,
  type Poly,
  type Pt,
} from "@/generators/paper-folding";
import { fa } from "@/tools/registry";
import { FoldSteps, OrderPicture, PaperSvg, STEP_NAMES, type Mark } from "./Pictures";
import styles from "@/toolkit/TryPanel.module.css";

export const PAPER_TYPE_LABEL: Record<PaperQuestionType, string> = {
  holes: "سوراخ‌ها روی شبکه",
  holesChoice: "سوراخ‌ها (گزینه‌ای)",
  cutChoice: "برش گوشه",
  pieces: "چند تکه؟",
  foldedShape: "شکل تاشده",
  order: "ترتیب تاها",
};

type Tone = "good" | "turned" | "bad";
const ICON: Record<Tone, string> = { good: "✓", turned: "↻", bad: "✗" };

/** What the 3D stage shows: the paper, folded by `f` (0 open … 1 folded). */
export interface PaperDisplay {
  S: number;
  folds: PaperQuestion["folds"];
  holes: Pt[];
  removed: Poly[];
  cutLines: [Pt, Pt][];
}

/** Folded at first (and opened after answering), or flat at first (and folded after). */
export const startsFolded = (t: PaperQuestionType) => t !== "foldedShape" && t !== "order";

export function paperDisplay(q: PaperQuestion): PaperDisplay {
  const base = { S: q.S, folds: q.folds, holes: [] as Pt[], removed: [] as Poly[], cutLines: [] as [Pt, Pt][] };
  if (q.type === "holes" || q.type === "holesChoice" || q.type === "order") return { ...base, holes: unfoldPoints(q.punches, q.folds) };
  if (q.type === "cutChoice") return { ...base, removed: unfoldPolys([q.cut], q.folds) };
  if (q.type === "pieces") return { ...base, cutLines: unfoldSegments([q.segment], q.folds) };
  return base;
}

/** The question text; `paper` words it for a printed worksheet. */
export function paperPrompt(q: PaperQuestion, paper = false): string {
  const folded = q.folds.length === 1 ? "کاغذ را یک بار تا کرده‌ایم" : `کاغذ را ${fa(q.folds.length)} بار، به ترتیب، تا کرده‌ایم`;
  switch (q.type) {
    case "holes":
      return paper
        ? `${folded} و سوراخ زده‌ایم. وقتی باز شود، جای همه سوراخ‌ها را روی شبکه بکش.`
        : `${folded} و سوراخ زده‌ایم. وقتی باز شود، سوراخ‌ها کجا هستند؟ روی خانه‌های شبکه بزن.`;
    case "holesChoice":
      return `${folded} و سوراخ زده‌ایم. وقتی باز شود، کدام شکل درست است؟`;
    case "cutChoice":
      return `${folded} و یک گوشه‌اش را بریده‌ایم. وقتی باز شود، کدام شکل درست است؟`;
    case "pieces":
      return `${folded} و در امتداد خط قرمز (✂) بریده‌ایم. وقتی همه تکه‌ها را باز کنیم، چند تکه کاغذ داریم؟`;
    case "foldedShape":
      return `${folded}. در آخر، کاغذ تاشده چه شکلی است و کجای صفحه است؟`;
    case "order":
      if (q.folds.length === 1)
        return paper
          ? "کاغذ را یک بار تا کرده‌ایم، سوراخ زده‌ایم و باز کرده‌ایم. این شکل‌ها به‌هم‌ریخته‌اند. زیر هر شکل بنویس چندمین مرحله است."
          : "کاغذ را یک بار تا کرده‌ایم، سوراخ زده‌ایم و باز کرده‌ایم. این شکل‌ها به‌هم‌ریخته‌اند. به ترتیب رویشان بزن: اول کدام، بعد کدام؟";
      return paper
        ? "این تاها به‌هم‌ریخته‌اند. زیر هر شکل بنویس چندمین تا است."
        : "این تاها به‌هم‌ریخته‌اند. به ترتیب رویشان بزن: اول کدام تا را زده‌ایم، بعد کدام؟";
  }
}

const layers = (k: number) => 2 ** k;

/** Letters of the pictures in the right order, e.g. «ب، الف، پ». */
export const orderNames = (q: Extract<PaperQuestion, { type: "order" }>) => q.shown.map((_, i) => STEP_NAMES[q.shown.indexOf(i)]).join("، ");

/** `seq[n]`: the picture tapped n-th. Says what went wrong in words. */
function orderFeedback(q: Extract<PaperQuestion, { type: "order" }>, seq: number[]): { tone: Tone; text: string } {
  const names = orderNames(q);
  const steps = seq.map((pos) => q.shown[pos]);
  if (steps.every((st, n) => st === n)) {
    return q.folds.length === 1
      ? { tone: "good", text: `درست است! ترتیب: ${names}. اول تا می‌کنیم، بعد کاغذ تاشده را سوراخ می‌کنیم، بعد باز می‌کنیم و سوراخ دو تا می‌شود.` }
      : { tone: "good", text: `درست است! ترتیب: ${names}. هر تا روی شکلِ تای قبلی انجام می‌شود.` };
  }
  if (q.folds.length === 1) {
    // Steps: 0 fold, 1 punch the folded paper, 2 open.
    if (steps.indexOf(2) < steps.indexOf(1))
      return { tone: "bad", text: `ترتیب درست: ${names}. کاغذ باز با دو سوراخ آخر است: سوراخ را روی کاغذ تاشده می‌زنیم و وقتی باز کنیم، دو تا می‌شود.` };
    return { tone: "bad", text: `ترتیب درست: ${names}. اول باید تا کنیم: کاغذ تاشده با سوراخ بعد از تا می‌آید.` };
  }
  if (steps[0] !== 0) return { tone: "bad", text: `ترتیب درست: ${names}. تای اول روی کاغذ کامل (مربع) است؛ از کاغذ کامل شروع کن.` };
  return { tone: "bad", text: `ترتیب درست: ${names}. نکته: هر تا روی کاغذی است که تای قبل درست کرده؛ شکل هر مرحله نصف شکل مرحله قبل است.` };
}

function choiceFeedback(q: PaperQuestion, picked: number): { tone: Tone; text: string } {
  if (q.type === "holes" || q.type === "order") return { tone: "bad", text: "" };
  const right = picked === q.answer;
  const mistake = q.mistakes[picked];
  const k = q.folds.length;
  switch (q.type) {
    case "holesChoice": {
      const why = `${fa(q.punches.length)} سوراخ در ${fa(layers(k))} لایه کاغذ، یعنی ${fa(q.punches.length * layers(k))} سوراخ؛ هر خط تا مثل آینه است.`;
      if (right) return { tone: "good", text: `درست است! ${why}` };
      if (mistake === "missingFold") return { tone: "turned", text: `نزدیک بود! یکی از تاها را باز نکردی. ${why}` };
      if (mistake === "wrongAxis") return { tone: "turned", text: "نزدیک بود! قرینه را نسبت به خط دیگری کشیدی. هر سوراخ را نسبت به همان خط تا قرینه کن." };
      return { tone: "bad", text: `جای سوراخ‌ها درست نیست. هر سوراخ و قرینه‌اش تا خط تا یک فاصله دارند. ${why}` };
    }
    case "cutChoice":
      if (right) return { tone: "good", text: "درست است! برش در همه لایه‌ها رفته؛ باز که کنی، دور هر خط تا قرینه می‌شود." };
      if (mistake === "missingFold") return { tone: "turned", text: "نزدیک بود! یکی از تاها را باز نکردی؛ برش باید در همه لایه‌ها باشد." };
      if (mistake === "wrongAxis") return { tone: "turned", text: "نزدیک بود! قرینه را نسبت به خط دیگری کشیدی." };
      return { tone: "bad", text: "گوشه دیگری بریده شده. ببین گوشه‌ای که بریده‌ایم، در کاغذ باز کجا بوده است." };
    case "pieces": {
      const n = q.options[q.answer];
      const why = `کاغذ تاشده ${fa(layers(k))} لایه دارد، پس باز که کنیم ${fa(layers(k))} خط برش داریم و کاغذ ${fa(n)} تکه می‌شود.`;
      if (right) return { tone: "good", text: `درست است! ${why}` };
      if (q.options[picked] === layers(k) && n !== layers(k)) return { tone: "turned", text: `نزدیک بود! این تعداد لایه‌هاست، نه تکه‌ها؛ بعضی تکه‌ها در خط تا به هم وصل‌اند. ${why}` };
      return { tone: "bad", text: `نه. ${why}` };
    }
    case "foldedShape":
      if (right) return { tone: "good", text: "درست است! هر بار نیمی از کاغذ روی نیم دیگر می‌آید." };
      if (mistake === "otherSide") return { tone: "turned", text: "نزدیک بود! شکلش درست است، ولی طرف دیگر کاغذ را تا کردی. فلش‌ها را دنبال کن: کدام طرف رو می‌آید؟" };
      return { tone: "bad", text: "این شکل با این تاها درست نمی‌شود. تا به تا جلو برو: بعد از هر تا، کاغذ نصف می‌شود." };
  }
}

function holesFeedback(q: Extract<PaperQuestion, { type: "holes" }>, mine: string[]): { tone: Tone; text: string } {
  const key = [...mine].sort().join(";");
  const k = q.folds.length;
  const total = q.answer.length;
  const why = `${fa(q.punches.length)} سوراخ × ${fa(layers(k))} لایه = ${fa(total)} سوراخ.`;
  if (key === q.answer.join(";")) return { tone: "good", text: `آفرین! ${why}` };
  for (let j = 1; j <= k; j++)
    if (key === holeCells(unfoldPoints(q.punches, q.folds.slice(j))).join(";"))
      return { tone: "turned", text: `نزدیک بود! ${j === 1 ? "تای اول" : `${fa(j)} تای اول`} را باز نکردی. ${why}` };
  for (let i = 0; i < k; i++) {
    const wrong = q.folds.map((f, j) => (j === i ? { ...f, line: perpendicular(f.line, q.S) } : f));
    if (key === holeCells(unfoldPoints(q.punches, wrong)).join(";"))
      return { tone: "turned", text: "نزدیک بود! قرینه را نسبت به خط دیگری کشیدی. هر سوراخ را نسبت به همان خط تا قرینه کن." };
  }
  if (mine.length !== total) return { tone: "bad", text: `باید ${fa(total)} سوراخ باشد؛ تو ${fa(mine.length)} تا زدی. ${why} حلقه‌های سبز جای درست‌اند.` };
  return { tone: "bad", text: `تعداد درست است ولی جاها نه. حلقه‌های سبز جای درست‌اند؛ ${why}` };
}

interface Props {
  question: PaperQuestion;
  type: PaperQuestionType;
  level: Level;
  initialPick?: number;
  onType: (t: PaperQuestionType) => void;
  onLevel: (l: Level) => void;
  onNew: () => void;
  onAnswered: () => void;
  onDisplay: (d: PaperDisplay) => void;
}

export function PaperTryPanel(p: Props) {
  const { question: q } = p;
  const [picked, setPicked] = useState<number | null>(q.type === "holes" || q.type === "order" ? null : (p.initialPick ?? null));
  const [mine, setMine] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const [seq, setSeq] = useState<number[]>([]);

  const display = useMemo(() => paperDisplay(q), [q]);
  const { onDisplay } = p;
  useEffect(() => onDisplay(display), [display, onDisplay]);

  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    p.onAnswered();
  };

  const before = shapes(q.S, q.folds);
  const final = before[before.length - 1];
  const k = q.folds.length;

  let fb: { tone: Tone; text: string } | null = picked !== null ? choiceFeedback(q, picked) : null;
  if (q.type === "holes" && checked) fb = holesFeedback(q, mine);
  const orderDone = q.type === "order" && seq.length === q.shown.length;
  if (q.type === "order" && orderDone) fb = orderFeedback(q, seq);

  const mark = (i: number): Tone | null => {
    if (picked === null || q.type === "holes" || q.type === "order") return null;
    if (i === q.answer) return "good";
    if (i === picked) return q.mistakes[i] === "missingFold" || q.mistakes[i] === "wrongAxis" || q.mistakes[i] === "otherSide" ? "turned" : "bad";
    return null;
  };

  const option = (i: number, content: React.ReactNode) => {
    const m = mark(i);
    return (
      <li key={i}>
        <button className={`${styles.option} ${m ? styles[m] : ""}`} onClick={() => pick(i)} disabled={picked !== null} aria-label={`گزینه ${fa(i + 1)}`}>
          {content}
          <span className={styles.optionNum}>
            {fa(i + 1)} {m && ICON[m]}
          </span>
        </button>
      </li>
    );
  };

  // Figures that show the question: the folds, then the folded paper with the punch or cut.
  const steps = <FoldSteps S={q.S} folds={q.folds} size={k === 3 ? 74 : q.type === "foldedShape" ? 104 : 90} />;
  let folded: React.ReactNode = null;
  if (q.type === "holes" || q.type === "holesChoice")
    folded = <PaperSvg S={q.S} size={124} shape={final} outline holes={q.punches} label="کاغذ تاشده با سوراخ" />;
  if (q.type === "cutChoice") folded = <PaperSvg S={q.S} size={124} shape={final} outline removed={[q.cut]} label="کاغذ تاشده با برش" />;
  if (q.type === "pieces") folded = <PaperSvg S={q.S} size={124} shape={final} outline cuts={[q.segment]} label="کاغذ تاشده و خط برش" />;

  const marks: Mark[] = useMemo(() => {
    if (q.type !== "holes") return [];
    const cells = new Set([...mine, ...(checked ? q.answer : [])]);
    return [...cells].map((c) => {
      const [i, j] = c.split(",").map(Number) as [number, number];
      return { cell: [i, j], mine: mine.includes(c), right: checked && q.answer.includes(c) };
    });
  }, [q, mine, checked]);

  return (
    <div className={styles.panel}>
      <div className={styles.types} role="radiogroup" aria-label="نوع پرسش">
        {(Object.keys(PAPER_TYPE_LABEL) as PaperQuestionType[]).map((t) => (
          <button key={t} role="radio" aria-checked={p.type === t} onClick={() => p.onType(t)}>
            {PAPER_TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      <div className={styles.chips} role="radiogroup" aria-label="سطح">
        {([1, 2, 3] as Level[]).map((l) => (
          <button key={l} role="radio" aria-checked={p.level === l} onClick={() => p.onLevel(l)}>
            سطح {fa(l)}
          </button>
        ))}
      </div>

      <p className={styles.prompt}>{paperPrompt(q)}</p>

      {q.type !== "order" && steps}
      {folded && (
        <div className={styles.viewRow}>
          <figure>
            {folded}
            <figcaption>{q.type === "pieces" ? "بعد از همه تاها: برش" : q.type === "cutChoice" ? "بعد از همه تاها: برش گوشه" : "بعد از همه تاها: سوراخ"}</figcaption>
          </figure>
        </div>
      )}

      {/* Tap the holes on the open paper */}
      {q.type === "holes" && (
        <>
          <PaperSvg
            S={q.S}
            size={220}
            marks={marks}
            creases={checked ? creases(q.S, q.folds) : []}
            onCell={
              checked
                ? undefined
                : (i, j) => {
                    const c = `${i},${j}`;
                    setMine((m) => (m.includes(c) ? m.filter((x) => x !== c) : [...m, c]));
                  }
            }
            label="کاغذ باز؛ روی خانه‌ها بزن"
          />
          <p className={styles.hint}>
            {checked ? "نقطه سیاه: جایی که تو زدی · حلقه سبز: جای درست · ✗: اشتباه" : `سوراخ‌هایی که زدی: ${fa(mine.length)}. دوباره بزنی، پاک می‌شود.`}
          </p>
          {!checked && (
            <button
              className={styles.secondary}
              disabled={!mine.length}
              onClick={() => {
                setChecked(true);
                p.onAnswered();
              }}
            >
              بررسی
            </button>
          )}
        </>
      )}

      {q.type === "holesChoice" && (
        <ul className={styles.options}>{q.options.map((pts, i) => option(i, <PaperSvg S={q.S} size={112} holes={pts} />))}</ul>
      )}

      {q.type === "cutChoice" && (
        <ul className={styles.options}>
          {q.options.map((polys, i) => option(i, <PaperSvg S={q.S} size={112} removed={polys} grid={false} />))}
        </ul>
      )}

      {q.type === "foldedShape" && (
        <ul className={styles.options}>
          {q.options.map((poly, i) => option(i, <PaperSvg S={q.S} size={104} shape={poly} outline grid={false} />))}
        </ul>
      )}

      {q.type === "pieces" && (
        <ul className={styles.tiles}>
          {q.options.map((v, i) => {
            const m = mark(i);
            return (
              <li key={i}>
                <button className={`${styles.option} ${m ? styles[m] : ""}`} onClick={() => pick(i)} disabled={picked !== null}>
                  <span className={styles.bigNumber}>{fa(v)}</span>
                  {m && <span className={styles.optionNum}>{ICON[m]}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {q.type === "order" && (
        <>
          <ul className={styles.options}>
            {q.shown.map((stepIdx, pos) => {
              const n = seq.indexOf(pos);
              const tone: Tone | null = orderDone ? (q.shown[pos] === n ? "good" : "bad") : null;
              return (
                <li key={pos}>
                  <button
                    className={`${styles.option} ${tone ? styles[tone] : ""}`}
                    disabled={orderDone || n >= 0}
                    onClick={() => {
                      const next = [...seq, pos];
                      setSeq(next);
                      if (next.length === q.shown.length) p.onAnswered();
                    }}
                    aria-label={`شکل ${STEP_NAMES[pos]}`}
                  >
                    <OrderPicture S={q.S} folds={q.folds} punches={q.punches} step={stepIdx} size={104} />
                    <span className={styles.optionNum}>
                      {STEP_NAMES[pos]} {n >= 0 && `← ${fa(n + 1)}`} {tone && ICON[tone]} {orderDone && tone === "bad" && `(درست: ${fa(stepIdx + 1)})`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {!orderDone && seq.length > 0 && (
            <button className={styles.secondary} onClick={() => setSeq([])}>
              از نو
            </button>
          )}
        </>
      )}

      {fb && (
        <p className={`${styles.feedback} ${styles[fb.tone]}`} role="status" aria-live="polite">
          <span className={styles.icon}>{ICON[fb.tone]}</span> {fb.text}
        </p>
      )}
      {(fb || orderDone) && <p className={styles.hint}>صحنه سه‌بعدی را ببین: کاغذ {startsFolded(q.type) ? "باز" : "تا"} می‌شود. با نوار پایین صحنه جلو و عقب ببر.</p>}

      <button className={styles.next} onClick={p.onNew}>
        نمونه تازه
      </button>
    </div>
  );
}


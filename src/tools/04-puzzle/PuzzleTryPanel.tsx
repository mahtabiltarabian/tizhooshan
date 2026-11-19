"use client";

import { type Level, type PuzzleQuestion, type PuzzleQuestionType } from "@/generators/puzzle";
import { fa } from "@/tools/registry";
import { PieceRowSvg, PieceSvg, pieceColor, ShapeSvg, SheetSvg } from "./Pictures";
import styles from "@/toolkit/TryPanel.module.css";

export const PUZZLE_TYPE_LABEL: Record<PuzzleQuestionType, string> = {
  build: "ساختن سایه",
  overlay: "روی‌هم‌گذاری",
  combine: "ترکیب دو شکل",
  split: "تجزیه شکل",
  extra: "قطعه اضافه",
  complete: "کامل‌کردن شکل",
};

export const MOVE_TEXT = {
  none: "",
  turn: "کاغذ ۲ را یک ربع دور در جهت عقربه‌های ساعت بچرخان، بعد",
  flip: "کاغذ ۲ را مثل ورق کتاب برگردان (چپ و راست عوض می‌شود)، بعد",
};

export function puzzlePrompt(q: PuzzleQuestion, paper = false): string {
  switch (q.type) {
    case "build":
      return paper
        ? `با این ${fa(q.kinds.length)} قطعه سایه را بساز: خط جای هر قطعه را روی سایه بکش.`
        : `با این ${fa(q.kinds.length)} قطعه سایه را بساز. قطعه را بکش؛ برای چرخاندن یک بار رویش بزن${q.allowFlip ? "، برای برگرداندن دو بار پشت سر هم" : ""}.`;
    case "overlay":
      return `دو کاغذ شفاف داریم. ${MOVE_TEXT[q.move]} ${q.move === "none" ? "کاغذ ۲ را" : "آن را"} درست روی کاغذ ۱ بگذار. چه دیده می‌شود؟`.replace("  ", " ");
    case "combine":
      return `این دو قطعه را کنار هم بگذار (می‌شود چرخاند${q.level === 3 ? " و برگرداند" : ""}). کدام شکل ساخته می‌شود؟`;
    case "split":
      return "کدام دسته قطعه، این شکل را دقیقاً می‌سازد؟ (می‌شود قطعه‌ها را چرخاند و برگرداند)";
    case "extra":
      return "یکی از این قطعه‌ها لازم نیست؛ با بقیه سایه کامل ساخته می‌شود. کدام قطعه اضافه است؟";
    case "complete":
      return "کدام قطعه جای خالی را پر می‌کند؟ می‌شود قطعه را چرخاند، ولی برنگرداند.";
  }
}

type Tone = "good" | "turned" | "bad";
const ICON: Record<Tone, string> = { good: "✓", turned: "↻", bad: "✗" };

function feedback(q: Exclude<PuzzleQuestion, { type: "build" }>, picked: number): { tone: Tone; text: string } {
  const n = fa(q.answer + 1);
  if (picked === q.answer)
    return {
      tone: "good",
      text:
        q.type === "overlay"
          ? "درست است! کاغذها شفاف‌اند: هر خانه‌ای که در یکی سیاه است، دیده می‌شود."
          : q.type === "extra"
            ? "درست است! روی صفحه ببین بقیه قطعه‌ها چطور سایه را پر می‌کنند."
            : "درست است! روی صفحه ببین قطعه‌ها چطور سر جایشان می‌نشینند.",
    };
  switch (q.type) {
    case "overlay":
      switch (q.tags[picked]) {
        case "noTurn":
          return { tone: "turned", text: `نزدیک بود! یادت رفت کاغذ ۲ را اول ${q.move === "turn" ? "بچرخانی" : "برگردانی"}. جواب گزینه ${n} است.` };
        case "otherTurn":
          return { tone: "turned", text: `نزدیک بود! ${q.move === "turn" ? "چرخش را برعکس (خلاف عقربه‌ها) رفتی" : "کاغذ را از بالا به پایین برگرداندی؛ ورق کتاب چپ و راست برمی‌گردد"}. جواب گزینه ${n} است.` };
        case "overlap":
          return { tone: "bad", text: `فقط خانه‌هایی را گرفتی که در هر دو کاغذ سیاه‌اند. کاغذها شفاف‌اند، پس همه خانه‌های سیاه دیده می‌شوند. جواب گزینه ${n} است.` };
        case "xor":
          return { tone: "turned", text: `نزدیک بود! سیاه روی سیاه پاک نمی‌شود، سیاه می‌ماند. جواب گزینه ${n} است.` };
        default:
          return { tone: "turned", text: `نزدیک بود! یک خانه سیاه جا افتاده. جواب گزینه ${n} است.` };
      }
    case "combine":
      return { tone: "bad", text: `این شکل را این دو قطعه نمی‌سازند؛ اندازه‌اش درست است ولی لبه‌ها جور درنمی‌آیند. جواب گزینه ${n} است.` };
    case "split":
      return { tone: "bad", text: `مساحت این دسته درست است ولی شکل قطعه‌ها جور نمی‌شود. جواب گزینه ${n} است؛ روی صفحه ببین قطعه‌ها کجا می‌نشینند.` };
    case "extra":
      return { tone: "bad", text: `اگر قطعه ${fa(picked + 1)} را کنار بگذاری، بقیه سایه را پر نمی‌کنند. قطعه اضافه شماره ${n} است.` };
    case "complete":
      switch (q.tags[picked]) {
        case "mirror":
          return { tone: "turned", text: `نزدیک بود! این قرینه قطعه درست است؛ بدون برگرداندن جا نمی‌شود. جواب گزینه ${n} است.` };
        case "shape":
          return { tone: "turned", text: `نزدیک بود! اندازه‌اش درست است ولی شکلش با جای خالی جور نیست. جواب گزینه ${n} است.` };
        default:
          return { tone: "bad", text: `اندازه این قطعه با جای خالی فرق دارد. جواب گزینه ${n} است.` };
      }
  }
}

interface Props {
  question: PuzzleQuestion;
  type: PuzzleQuestionType;
  level: Level;
  picked: number | null;
  onPick: (i: number) => void;
  /** Build questions: how the board stands, and help. */
  buildStatus?: { done: boolean; text: string } | null;
  onCheckBuild?: () => void;
  onShowBuild?: () => void;
  onType: (t: PuzzleQuestionType) => void;
  onLevel: (l: Level) => void;
  onNew: () => void;
}

export function PuzzleTryPanel(p: Props) {
  const { question: q, picked } = p;
  const fb = q.type !== "build" && picked !== null ? feedback(q, picked) : null;
  const mark = (i: number): Tone | null => {
    if (picked === null || q.type === "build") return null;
    if (i === q.answer) return "good";
    return i === picked ? feedback(q, i).tone : null;
  };

  let options: React.ReactNode[] = [];
  let cols = 2;
  switch (q.type) {
    case "overlay":
      options = q.options.map((o, i) => <SheetSvg key={i} n={q.n} cells={o} size={84} />);
      break;
    case "combine":
      options = q.options.map((o, i) => <ShapeSvg key={i} ids={o} size={84} unit={4} />);
      break;
    case "split":
      options = q.options.map((ks, i) => <PieceRowSvg key={i} kinds={ks} height={40} />);
      cols = 1;
      break;
    case "extra":
      options = q.pieces.map((k, i) => <PieceSvg key={i} kind={k} size={58} color={pieceColor(i)} unit={4} />);
      cols = 3;
      break;
    case "complete":
      options = q.options.map((o, i) => <PieceSvg key={i} kind={o.kind} k={o.k} flip={o.flip} size={74} color="#ffc93d" unit={4} />);
      break;
  }

  return (
    <div className={styles.panel}>
      <div className={styles.types} role="radiogroup" aria-label="نوع پرسش">
        {(Object.keys(PUZZLE_TYPE_LABEL) as PuzzleQuestionType[]).map((t) => (
          <button key={t} role="radio" aria-checked={p.type === t} onClick={() => p.onType(t)}>
            {PUZZLE_TYPE_LABEL[t]}
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

      <p className={styles.prompt}>{puzzlePrompt(q)}</p>

      {q.type === "build" ? (
        <>
          {q.name && <p className={styles.hint}>شکل: {q.name}</p>}
          <button className={styles.secondary} onClick={p.onCheckBuild} disabled={p.buildStatus?.done}>
            بررسی
          </button>
          {p.buildStatus && (
            <p className={`${styles.feedback} ${styles[p.buildStatus.done ? "good" : "turned"]}`} role="status" aria-live="polite">
              <span className={styles.icon}>{ICON[p.buildStatus.done ? "good" : "turned"]}</span> {p.buildStatus.text}
            </p>
          )}
          <button className={styles.secondary} onClick={p.onShowBuild}>
            نشانم بده
          </button>
          <p className={styles.hint}>قطعه انتخاب‌شده را با دکمه‌های پایین صفحه هم می‌شود چرخاند{q.allowFlip ? " و برگرداند" : ""}.</p>
        </>
      ) : (
        <ul className={styles.options} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {options.map((o, i) => {
            const m = mark(i);
            return (
              <li key={i}>
                <button className={`${styles.option} ${m ? styles[m] : ""}`} onClick={() => p.onPick(i)} disabled={picked !== null} aria-label={`گزینه ${fa(i + 1)}`}>
                  {o}
                  <span className={styles.optionNum}>
                    {fa(i + 1)} {m && ICON[m]}
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
      {fb && <p className={styles.hint}>روی صفحه آهسته نشان داده می‌شود؛ با نوار پایین جلو و عقب ببر.</p>}

      <button className={styles.next} onClick={p.onNew}>
        نمونه تازه
      </button>
    </div>
  );
}

"use client";

import {
  ALPHABET,
  answerKind,
  codeMistake,
  encodeLetter,
  mod,
  N,
  outKind,
  SHAPES,
  signedShift,
  slotMarks,
  SPACE,
  textOf,
  type CodeQuestion,
  type CodeQuestionType,
  type Level,
  type Rule,
  type TokenKind,
} from "@/generators/codes";
import { NumberPad } from "@/toolkit/NumberPad";
import { fa } from "@/tools/registry";
import { AnswerSlots, LetterKeyboard, ShapePad } from "./Inputs";
import { tokenText } from "./Pictures";
import css from "./Codes.module.css";
import styles from "@/toolkit/TryPanel.module.css";

export const CODE_TYPE_LABEL: Record<CodeQuestionType, string> = {
  shift: "جابه‌جایی حروف",
  number: "رمز عددی",
  shape: "رمز شکلی",
  sentence: "رمزگشایی جمله",
};

/** Question types of «امتحان کن»: the letter codes and «کد دودویی» (see Binary.tsx). */
export type TryType = CodeQuestionType | "binary";
export const TRY_TYPE_LABEL: Record<TryType, string> = { ...CODE_TYPE_LABEL, binary: "کد دودویی" };

/** Keeps an equation left to right inside a Persian sentence. */
export const ltr = (s: string) => `⁦${s.replace(/ /g, " ")}⁩`;

const quote = (s: string) => `«${s}»`;

/** First, second and third letters a number rule counts from. */
const countFrom = (r: Extract<Rule, { kind: "number" }>) => (r.rev ? [N - 1, N - 2, N - 3] : [0, 1, 2]);

/** A rule in words. */
export function ruleFa(r: Rule): string {
  switch (r.kind) {
    case "shift": {
      const n = signedShift(r.n);
      return `هر حرف ${fa(Math.abs(n))} حرف ${n > 0 ? "جلوتر" : "عقب‌تر"} (مثلاً د ← ${ALPHABET[mod(9 + n)]})`;
    }
    case "mirror": {
      const n = signedShift(r.n);
      const base = "الفبای وارونه (ا ← ی، ب ← ه، پ ← و …)";
      return n === 0 ? base : `${base}، بعد ${fa(Math.abs(n))} حرف ${n > 0 ? "جلوتر" : "عقب‌تر"}`;
    }
    case "number": {
      const [a, b, c] = countFrom(r).map((i) => `${ALPHABET[i]} = ${fa(encodeLetter(r, i)!)}`);
      return `${a}، ${b}، ${c} و همین‌طور تا آخر الفبا${r.rev ? " (از آخر الفبا)" : ""}`;
    }
    case "shape":
      return "جدول شکل‌ها";
    case "sub":
      return "جدول دلخواه";
  }
}

/** A short name for the rule (board captions). */
export function ruleShort(r: Rule): string {
  if (r.kind === "shift") {
    const n = signedShift(r.n);
    return `${fa(Math.abs(n))} حرف ${n > 0 ? "جلو" : "عقب"}`;
  }
  if (r.kind === "mirror") {
    const n = signedShift(r.n);
    return n === 0 ? "الفبای وارونه" : `وارونه، بعد ${fa(Math.abs(n))} ${n > 0 ? "جلو" : "عقب"}`;
  }
  if (r.kind === "number") return `${ALPHABET[countFrom(r)[0]]} = ${fa(r.start)}${r.step === 2 ? "، دوتا‌دوتا" : ""}`;
  return ruleFa(r);
}

/** Tokens as one string: a joined word for letters, a list for numbers and shapes. */
export function tokensFa(kind: TokenKind, tokens: readonly (number | null)[]) {
  if (kind === "letter") return textOf(tokens);
  const words: string[] = [];
  let cur: string[] = [];
  for (const t of tokens) {
    if (t === SPACE) {
      words.push(cur.join("، "));
      cur = [];
    } else cur.push(tokenText(kind, t));
  }
  words.push(cur.join("، "));
  return words.join(" / ");
}

/** Kind of the tokens the pupil is given. */
export const givenKind = (q: CodeQuestion): TokenKind => (q.dir === "encode" ? "letter" : outKind(q.rule));
const what = (q: CodeQuestion) => (q.type === "sentence" ? "جمله" : "کلمه");

export function codePrompt(q: CodeQuestion, paper = false): string {
  const rule = q.show === "key" ? (paper ? "با جدول رمز:" : "با جدول رمز بالای صفحه:") : q.show === "words" ? `قانون رمز: ${ruleFa(q.rule)}.` : `قانون رمز را از ${fa(q.examples.length)} مثال پیدا کن.`;
  const task =
    q.dir === "encode"
      ? `کلمه ${quote(textOf(q.plain))} را رمز کن.`
      : `این ${what(q)} رمزی را بخوان: ${what(q)} اصلی چیست؟${q.type === "sentence" ? " (فاصله‌ها سر جایشان هستند.)" : ""}`;
  return `${rule} ${task}`;
}

/** Equation for one letter of a number rule: place, then the sum. */
function numberEquation(r: Extract<Rule, { kind: "number" }>, i: number) {
  const place = r.rev ? N - i : i + 1;
  const extra = r.start - r.step;
  const v = encodeLetter(r, i)!;
  const lhs = `${r.step === 2 ? "۲ × " : ""}${fa(place)}${extra ? ` ${extra > 0 ? "+" : "−"} ${fa(Math.abs(extra))}` : ""}`;
  return `${ALPHABET[i]} حرف ${fa(place)}‌ام ${r.rev ? "از آخر " : ""}است: ${ltr(`${lhs} = ${fa(v)}`)}`;
}

/** The working, in a few sentences. */
export function codeHow(q: CodeQuestion): string {
  const r = q.rule;
  const kind = outKind(r);
  const parts: string[] = [];
  if (q.show === "examples") {
    const e = q.examples[0];
    if (r.kind === "shape") parts.push("از مثال‌ها هر حرف شکل خودش را دارد");
    else {
      const p = e.plain[0];
      const c = e.coded[0];
      const p2 = e.plain[1];
      const c2 = e.coded[1];
      parts.push(
        r.kind === "number"
          ? `در مثال ${quote(textOf(e.plain))}: ${ALPHABET[p]} = ${fa(c)} و ${ALPHABET[p2]} = ${fa(c2)}؛ قانون: ${ruleFa(r)}`
          : `در مثال ${quote(textOf(e.plain))}، ${ALPHABET[p]} شده ${ALPHABET[c]} و ${ALPHABET[p2]} شده ${ALPHABET[c2]}؛ قانون: ${ruleFa(r)}`,
      );
    }
  } else if (q.show === "words") parts.push(`قانون: ${ruleFa(r)}`);
  else parts.push("از جدول رمز");

  // Each different letter once, in the order of the text.
  const seen = new Set<number>();
  const pairs: string[] = [];
  for (const x of q.plain) {
    if (x === SPACE || seen.has(x)) continue;
    seen.add(x);
    const t = tokenText(kind, encodeLetter(r, x));
    pairs.push(q.dir === "encode" ? `${ALPHABET[x]} ← ${t}` : `${t} ← ${ALPHABET[x]}`);
  }
  if (r.kind === "number" && q.show !== "key") parts.push(numberEquation(r, q.plain[0]));
  parts.push(pairs.slice(0, 8).join("، ") + (pairs.length > 8 ? " …" : ""));
  if (r.kind === "shift") {
    const d = signedShift(r.n);
    if (q.plain.some((x) => x !== SPACE && (x + d >= N || x + d < 0))) parts.push(d > 0 ? "بعد از ی دوباره از ا شمرده می‌شود" : "قبل از ا دوباره از ی شمرده می‌شود");
  }
  parts.push(`پس جواب ${quote(tokensFa(answerKind(q), q.answer))} است.`);
  return parts.join(". ").replace(/\.\./g, ".");
}

/** The answer in words. */
export const answerFa = (q: CodeQuestion) => tokensFa(answerKind(q), q.answer);

type Tone = "good" | "turned" | "bad";
const ICON: Record<Tone, string> = { good: "✓", turned: "↻", bad: "✗" };

function feedback(q: CodeQuestion, v: (number | null)[]): { tone: Tone; text: string } {
  const how = codeHow(q);
  const marks = slotMarks(q, v);
  const letters = q.answer.filter((x) => x !== SPACE).length;
  const right = marks.filter((m, i) => m && q.answer[i] !== SPACE).length;
  const r = q.rule;
  switch (codeMistake(q, v)) {
    case "right":
      return { tone: "good", text: `درست است! ${how}` };
    case "wrongWay": {
      if (r.kind === "number") return { tone: "turned", text: `نزدیک بود! از سر دیگر الفبا شمردی: ${ALPHABET[countFrom(r)[0]]} = ${fa(r.start)} است. ${how}` };
      if (r.kind === "mirror") return { tone: "turned", text: `نزدیک بود! بعد از وارونه کردن، به سمت دیگر رفتی. ${how}` };
      const n = r.kind === "shift" ? signedShift(r.n) : 0;
      const forward = q.dir === "encode" ? n > 0 : n < 0;
      return { tone: "turned", text: `نزدیک بود! جهت برعکس شد: برای ${q.dir === "encode" ? "رمز کردن" : "رمزگشایی"} باید ${forward ? "جلو" : "عقب"} بروی${q.dir === "decode" ? "، برعکس قانون رمز" : ""}. ${how}` };
    }
    case "offByOne":
      return r.kind === "number"
        ? { tone: "turned", text: `نزدیک بود! همه یک عدد اختلاف دارند: ${ALPHABET[countFrom(r)[0]]} = ${fa(r.start)} است، نه ${fa(r.start - 1)} یا ${fa(r.start + 1)}. ${how}` }
        : { tone: "turned", text: `نزدیک بود! همه یک حرف اختلاف دارند: خود حرف را نشمار؛ اولین قدم، حرف بعدی است. ${how}` };
    case "arabic":
      return { tone: "turned", text: `نزدیک بود! حرف‌های پ، چ، ژ، گ را جا انداختی (مثل الفبای عربی). الفبای فارسی ۳۲ حرف دارد. ${how}` };
    case "wrap":
      return { tone: "turned", text: `نزدیک بود! سر آخر الفبا اشتباه شد: الفبا مثل چرخ است؛ ${r.kind === "shift" && signedShift(q.dir === "encode" ? r.n : -r.n) < 0 ? "قبل از ا، ی می‌آید" : "بعد از ی، دوباره ا می‌آید"}. ${how}` };
    case "oneExample":
      return { tone: "turned", text: `این قانون با یکی از مثال‌ها جور است ولی با مثال دیگر نه. قانون باید با همه مثال‌ها جور باشد. ${how}` };
    case "reversed":
      return { tone: "turned", text: `نزدیک بود! ترتیب برعکس شد: رمز هم مثل کلمه از راست به چپ نوشته می‌شود. ${how}` };
    case "partial":
      return { tone: "turned", text: `قانون را فقط روی بعضی حرف‌ها اجرا کردی؛ ${fa(letters - right)} حرف همان‌طور مانده. همه حرف‌ها باید عوض شوند. ${how}` };
    default:
      return { tone: "bad", text: `${fa(right)} خانه از ${fa(letters)} خانه درست است. ${how}` };
  }
}

/** Shapes offered on the pad: those in the key or the examples, in a fixed order. */
const padShapes = (q: CodeQuestion) => (q.rule.kind === "shape" ? q.rule.key.map(([, s]) => s).sort((a, b) => a - b) : SHAPES.map((_, i) => i));

/** Next slot that is not a space, or -1. */
export function nextSlot(tokens: readonly (number | null)[], from: number, dir = 1) {
  for (let i = from + dir; i >= 0 && i < tokens.length; i += dir) if (tokens[i] !== SPACE) return i;
  return -1;
}

interface Props {
  question: CodeQuestion;
  type: CodeQuestionType;
  level: Level;
  /** Word length, 0 for any. */
  length: number;
  examples: 2 | 3;
  answer: (number | null)[];
  active: number;
  onAnswer: (a: (number | null)[], active: number) => void;
  checked: number[] | null;
  onCheck: (v: number[]) => void;
  /** Mock exam: record the answer, show nothing about it. */
  exam?: boolean;
  onType: (t: TryType) => void;
  onLevel: (l: Level) => void;
  onLength: (n: number) => void;
  onExamples: (n: 2 | 3) => void;
  onNew: () => void;
}

export function CodesTryPanel(p: Props) {
  const { question: q, checked, answer, active } = p;
  const kind = answerKind(q);
  const done = checked !== null;
  const fb = checked && !p.exam ? feedback(q, checked) : null;
  const full = answer.every((t) => t !== null);

  const put = (t: number | null, advance: boolean) => {
    if (active < 0) return;
    const a = [...answer];
    a[active] = t;
    const nx = nextSlot(a, active);
    p.onAnswer(a, advance && nx >= 0 ? nx : active);
  };
  const back = () => {
    if (answer[active] !== null) return put(null, false);
    const pv = nextSlot(answer, active, -1);
    if (pv < 0) return;
    const a = [...answer];
    a[pv] = null;
    p.onAnswer(a, pv);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.types} role="radiogroup" aria-label="نوع رمز" data-practice-hide style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        {(Object.keys(TRY_TYPE_LABEL) as TryType[]).map((t) => (
          <button key={t} role="radio" aria-checked={p.type === t} onClick={() => p.onType(t)}>
            {TRY_TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      <div className={styles.chips} role="radiogroup" aria-label="سطح" data-practice-hide>
        {([1, 2, 3] as Level[]).map((l) => (
          <button key={l} role="radio" aria-checked={p.level === l} onClick={() => p.onLevel(l)}>
            سطح {fa(l)}
          </button>
        ))}
      </div>
      {p.type !== "sentence" && (
        <div className={css.knob} data-practice-hide>
          <span>طول کلمه</span>
          <div className={styles.chips} role="radiogroup" aria-label="طول کلمه">
            {[0, 3, 4, 5, 6].map((n) => (
              <button key={n} role="radio" aria-checked={p.length === n} onClick={() => p.onLength(n)}>
                {n ? fa(n) : "همه"}
              </button>
            ))}
          </div>
        </div>
      )}
      {p.level === 3 && (
        <div className={css.knob} data-practice-hide>
          <span>تعداد مثال</span>
          <div className={styles.chips} role="radiogroup" aria-label="تعداد مثال">
            {([2, 3] as const).map((n) => (
              <button key={n} role="radio" aria-checked={p.examples === n} onClick={() => p.onExamples(n)}>
                {fa(n)}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className={styles.prompt}>{codePrompt(q)}</p>

      <AnswerSlots tokens={done ? checked : answer} kind={kind} active={active} onSlot={(i) => p.onAnswer(answer, i)} marks={done && !p.exam ? slotMarks(q, checked) : undefined} />

      {!done && kind === "letter" && <LetterKeyboard onKey={(i) => put(i, true)} onBack={back} />}
      {!done && kind === "shape" && (
        <>
          <ShapePad shapes={padShapes(q)} onKey={(s) => put(s, true)} />
          <button className={styles.secondary} onClick={back} style={{ minHeight: 40 }}>
            ⌫ پاک کن
          </button>
        </>
      )}
      {!done && kind === "number" && (
        <>
          <NumberPad value={answer[active] === null || active < 0 ? "" : String(answer[active])} onChange={(v) => put(v === "" ? null : Number(v), false)} maxDigits={2} />
          <div className={styles.chips}>
            <button onClick={() => p.onAnswer(answer, Math.max(0, nextSlot(answer, active, -1)))} disabled={nextSlot(answer, active, -1) < 0}>
              → خانه قبلی
            </button>
            <button onClick={() => p.onAnswer(answer, nextSlot(answer, active))} disabled={nextSlot(answer, active) < 0}>
              خانه بعدی ←
            </button>
          </div>
        </>
      )}

      {!done && (
        <button className={styles.secondary} disabled={!full} onClick={() => p.onCheck(answer as number[])}>
          بررسی
        </button>
      )}
      {!done && !full && <p className={styles.hint}>همه خانه‌ها را پر کن. روی هر خانه بزنی، نشانگر به آن می‌رود.</p>}

      {fb && (
        <p className={`${styles.feedback} ${styles[fb.tone]}`} role="status" aria-live="polite">
          <span className={styles.icon}>{ICON[fb.tone]}</span> {fb.text}
        </p>
      )}
      {done && !p.exam && <p className={styles.hint}>روی چرخ رمز، هر حرف به رمزش وصل می‌شود؛ با نوار پایین جلو و عقب ببر.</p>}

      <button className={styles.next} onClick={p.onNew}>
        نمونه تازه
      </button>
    </div>
  );
}


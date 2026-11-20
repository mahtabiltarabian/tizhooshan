"use client";

import { useState } from "react";
import {
  backRule,
  buildMistake,
  fits,
  inverse,
  machineMistake,
  machineValue,
  opValue,
  orderUsed,
  reorder,
  sameRule,
  swappedPair,
  type BuildQuestion,
  type Level,
  type Machine,
  type MachineQuestion,
  type MachineQuestionType,
  type NumberQuestion,
  type Op,
  type OperatorQuestion,
  type Rule,
  type Step,
} from "@/generators/number-machine";
import { NumberPad } from "@/toolkit/NumberPad";
import { fa } from "@/tools/registry";
import { backChainFa, chainFa, ltr, OP_WORD, opCalcFa, opFullFa, opLines, ruleFa, stepFa, SYM } from "./format";
import styles from "@/toolkit/TryPanel.module.css";

export const MACHINE_TYPE_LABEL: Record<MachineQuestionType, string> = {
  run: "خروجی چیست؟",
  reverse: "ورودی چه بود؟",
  guess: "قانون پنهان",
  build: "ماشین را بساز",
  operator: "عملگر ★",
};

/** Every question type of the try panel: the machine's, and «مرتب‌سازی و الگوریتم» (Sorting.tsx). */
export type TryType = MachineQuestionType | "sort";
export const TRY_TYPE_LABEL: Record<TryType, string> = { ...MACHINE_TYPE_LABEL, sort: "مرتب‌سازی و الگوریتم" };

/** The question type and level chips at the top of the try panel. */
export function TypeLevelChips({ type, level, onType, onLevel }: { type: TryType; level: Level; onType: (t: TryType) => void; onLevel: (l: Level) => void }) {
  return (
    <>
      <div className={styles.types} role="radiogroup" aria-label="نوع پرسش" data-practice-hide>
        {(Object.keys(TRY_TYPE_LABEL) as TryType[]).map((t) => (
          <button key={t} role="radio" aria-checked={type === t} onClick={() => onType(t)}>
            {TRY_TYPE_LABEL[t]}
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

/** A child's answer: a number, or a machine they built. */
export type Answer = number | Machine;

const pairFa = (input: number[]) => (input.length === 2 ? ltr(`${fa(input[0])} ★ ${fa(input[1])}`) : fa(input[0]));

export function machinePrompt(q: MachineQuestion, paper = false): string {
  switch (q.type) {
    case "run":
      return `ماشین: ${ltr(ruleFa(q.rule))}. ورودی ${fa(q.input)} است. چه عددی بیرون می‌آید؟`;
    case "reverse":
      return `ماشین: ${ltr(ruleFa(q.rule))}. خروجی ${fa(q.output)} شد. ورودی چه عددی بود؟`;
    case "guess":
      return q.machine.kind === "machine"
        ? `یک ماشین پنهان ${fa(q.machine.rule.length)} مرحله‌ای، ورودی‌های جدول را به این خروجی‌ها تبدیل کرده. اگر ${fa(q.query[0])} به آن بدهیم، چه بیرون می‌آید؟`
        : `مثال‌های جدول با یک عملگر پنهان ★ حساب شده‌اند. ${pairFa(q.query)} چند است؟`;
    case "build":
      return q.machine.kind === "machine"
        ? `این ماشین ${fa(q.machine.rule.length)} مرحله دارد. از روی مثال‌های جدول، مرحله‌هایش را پیدا کن${paper ? " و در جعبه‌ها بنویس" : " و ماشین را بساز"}.`
        : `قانون ${ltr("a ★ b = □a ± □b")} را از روی مثال‌های جدول کامل کن.`;
    case "operator":
      if (q.variant === "plain") return `اگر ${ltr(opFullFa(q.op))} باشد، ${ltr(`${fa(q.a)} ★ ${fa(q.b)}`)} چند است؟`;
      if (q.variant === "nested") return `اگر ${ltr(opFullFa(q.op))} باشد، ${ltr(`(${fa(q.a)} ★ ${fa(q.b)}) ★ ${fa(q.c)}`)} چند است؟`;
      return `اگر ${ltr(opFullFa(q.op))} و ${ltr(`□ ★ ${fa(q.b)} = ${fa(q.c)}`)} باشد، عدد □ چند است؟`;
  }
}

/** Lines of working for an operator question (also drawn on the board). */
export function operatorLines(q: OperatorQuestion): string[] {
  const { op, a, b, c } = q;
  const head = opFullFa(op);
  if (q.variant === "plain") return [head, ...opLines(op, a, b)];
  if (q.variant === "nested") {
    const v = opValue(op, a, b);
    return [head, `(${fa(a)} ★ ${fa(b)}) ★ ${fa(c)}`, opCalcFa(op, a, b), opCalcFa(op, v, c)];
  }
  // □ ★ b = c with a ★ b = p·a ± q·b.
  const qb = Math.abs(op.q) * b;
  const sign = op.q < 0 ? "−" : "+";
  const undo = op.q < 0 ? "+" : "−";
  const rest = c - op.q * b;
  const lines = [head, `□ ★ ${fa(b)} = ${fa(c)}`];
  if (Math.abs(op.q) !== 1) lines.push(`${fa(op.p)} × □ ${sign} ${fa(Math.abs(op.q))} × ${fa(b)} = ${fa(c)}`);
  lines.push(`${fa(op.p)} × □ ${sign} ${fa(qb)} = ${fa(c)}`, `${fa(op.p)} × □ = ${fa(c)} ${undo} ${fa(qb)} = ${fa(rest)}`, `□ = ${fa(rest)} ÷ ${fa(op.p)} = ${fa(a)}`);
  return lines;
}

/** How the outputs grow: "وقتی ورودی ۳ تا بیشتر شد، خروجی ۶ تا بیشتر شد". */
function growthFa(q: { examples: { input: number[]; output: number }[] }) {
  const [e1, e2] = q.examples;
  if (!e2) return "";
  const dx = e2.input[0] - e1.input[0];
  const dy = e2.output - e1.output;
  return ` سرنخ: وقتی ورودی ${fa(dx)} تا بیشتر شد (از ${fa(e1.input[0])} به ${fa(e2.input[0])})، خروجی ${fa(dy)} تا بیشتر شد؛ پس ماشین ${dx === dy ? "ضرب و تقسیم ندارد" : "ضرب یا تقسیم دارد"}.`;
}

/** The working, in one line. */
export function machineHow(q: MachineQuestion): string {
  switch (q.type) {
    case "run":
      return `عدد از چپ به راست از هر مرحله رد می‌شود: ${ltr(chainFa(q.input, q.rule))}.`;
    case "reverse":
      return `از خروجی شروع کن و از آخرین مرحله به عقب برگرد؛ هر کار را برعکس کن: ${ltr(backChainFa(q.output, q.rule))}.`;
    case "guess":
      if (q.machine.kind === "op") return `قانون: ${ltr(opFullFa(q.machine.op))}. پس ${ltr(opCalcFa(q.machine.op, q.query[0], q.query[1]))}.`;
      return `قانون: ${ltr(ruleFa(q.machine.rule))}؛ ${ltr(chainFa(q.query[0], q.machine.rule))}.${growthFa(q)}`;
    case "build":
      if (q.machine.kind === "op") return `قانون: ${ltr(opFullFa(q.machine.op))}؛ مثلاً ${ltr(opCalcFa(q.machine.op, q.examples[0].input[0], q.examples[0].input[1]))}.`;
      return `ماشین پنهان: ${ltr(ruleFa(q.machine.rule))}؛ مثلاً ${ltr(chainFa(q.examples[0].input[0], q.machine.rule))}.${growthFa(q)}`;
    case "operator":
      return operatorLines(q)
        .slice(1)
        .map((l) => ltr(l))
        .join(" ؛ ");
  }
}

/** The answer in words. */
export function answerFa(q: MachineQuestion): string {
  if (q.type !== "build") return fa(q.answer);
  return q.answer.kind === "op" ? ltr(opFullFa(q.answer.op)) : ltr(ruleFa(q.answer.rule));
}

type Tone = "good" | "turned" | "bad";
const ICON: Record<Tone, string> = { good: "✓", turned: "↻", bad: "✗" };

/** What a child did with the steps when they ran them in another order. */
function orderSlipFa(rule: Rule, order: number[] | null): string {
  if (!order || order.every((k, i) => k === rule.length - 1 - i)) return "تو از آخر شروع کردی.";
  const pair = swappedPair(order);
  if (pair) {
    const [i, j] = pair;
    return `تو جای مرحله ${fa(i + 1)} (${ltr(stepFa(rule[i]))}) و مرحله ${fa(j + 1)} (${ltr(stepFa(rule[j]))}) را عوض کردی.`;
  }
  return `تو مرحله‌ها را به این ترتیب اجرا کردی: ${ltr(ruleFa(reorder(rule, order)))}.`;
}

function numberFeedback(q: NumberQuestion, v: number): { tone: Tone; text: string } {
  const how = machineHow(q);
  const right = `جواب ${fa(q.answer)} است. ${how}`;
  const rule = "rule" in q ? q.rule : [];
  switch (machineMistake(q, v)) {
    case "right":
      return { tone: "good", text: `درست است! ${how}` };
    case "order":
      return { tone: "turned", text: `نزدیک بود! ترتیب مرحله‌ها مهم است: ${rule.map((s, i) => `${i ? "بعد" : "اول"} ${ltr(stepFa(s))}`).join("، ")}. ${orderSlipFa(rule, q.type === "run" ? orderUsed(q, v) : null)} ${right}` };
    case "stopEarly":
      return q.type === "operator"
        ? { tone: "turned", text: `نزدیک بود! این فقط داخل پرانتز است. حالا جوابش را با ${fa(q.c)} دوباره به ★ بده. ${right}` }
        : { tone: "turned", text: `نزدیک بود! یک مرحله جا ماند: عدد باید از همه ${fa(rule.length)} مرحله رد شود. ${right}` };
    case "wrongOp":
      return { tone: "turned", text: `علامت را دوباره ببین: ${ltr(stepFa(rule[0]))} یعنی «${OP_WORD[rule[0].op]} ${fa(rule[0].n)}». ${right}` };
    case "noInvert":
      return { tone: "turned", text: `ماشین را رو به جلو راه انداختی. برای پیدا کردن ورودی، ماشین را برعکس کن: ${ltr("+ ↔ −")} و ${ltr("× ↔ ÷")}. ${right}` };
    case "sameOps": {
      const last = rule[rule.length - 1];
      return { tone: "turned", text: `نزدیک بود! از آخرین مرحله شروع کردی، آفرین؛ ولی هر کار را هم باید برعکس کنی: برعکسِ ${ltr(stepFa(last))} می‌شود ${ltr(stepFa(inverse(last)))}. ${right}` };
    }
    case "keepOrder":
      return { tone: "turned", text: `نزدیک بود! کارها را برعکس کردی، آفرین؛ ولی باید از آخرین مرحله شروع کنی (مثل درآوردن جوراب و کفش: اول کفش). ماشین برعکس: ${ltr(ruleFa(backRule(rule)))}. ${right}` };
    case "addOnly":
    case "timesOnly":
      return { tone: "turned", text: `فقط مثال اول را نگاه کردی. قانون باید با همه مثال‌های جدول جور باشد؛ آن را روی مثال دوم و سوم هم امتحان کن. ${right}` };
    case "sequence":
      return { tone: "turned", text: `خروجی‌ها را مثل یک دنباله ادامه دادی؛ ولی خروجی به ورودی بستگی دارد، نه به ردیف جدول. ${right}` };
    case "swapped":
      return q.type === "operator" && q.variant === "unknown"
        ? { tone: "turned", text: `نزدیک بود! □ جای a نشسته (سمت چپ ★)، پس در عدد کنار a ضرب می‌شود، نه عدد کنار b. ${right}` }
        : { tone: "turned", text: `نزدیک بود! جای a و b عوض شد: در ${ltr("a ★ b")}، a عدد سمت چپ ★ است و b عدد سمت راست. ${right}` };
    case "noCoef":
      return q.type === "operator"
        ? { tone: "turned", text: `عددهای کنار a و b را فراموش کردی: ${ltr(`${fa(q.op.p)}a`)} یعنی ${ltr(`${fa(q.op.p)} × a`)}. ${right}` }
        : { tone: "bad", text: right };
    case "precedence":
      return { tone: "turned", text: `نزدیک بود! اول داخل پرانتز را حساب کن، بعد ضرب. ${right}` };
    case "nestOrder":
      return q.type === "operator"
        ? { tone: "turned", text: `نزدیک بود! اول پرانتز: ${ltr(`${fa(q.a)} ★ ${fa(q.b)}`)} را حساب کن، بعد جوابش ★ ${fa(q.c)}. ${right}` }
        : { tone: "bad", text: right };
    case "noDivide":
      return q.type === "operator"
        ? { tone: "turned", text: `تا ${ltr(`${fa(q.op.p)} × □ = ${fa(q.c - q.op.q * q.b)}`)} درست آمدی؛ حالا تقسیم بر ${fa(q.op.p)} کن. ${right}` }
        : { tone: "bad", text: right };
    default:
      return { tone: "bad", text: right };
  }
}

function buildFeedback(q: BuildQuestion, m: Machine): { tone: Tone; text: string } {
  const how = machineHow(q);
  const right = `${how}`;
  const hidden = q.machine;
  switch (buildMistake(q, m)) {
    case "right":
      if (sameRule(m, hidden)) return { tone: "good", text: `درست است! ${how}` };
      return {
        tone: "good",
        text: `درست است! ماشین تو (${answerFa({ ...q, answer: m })}) شبیه ماشین پنهان (${answerFa(q)}) نوشته نشده، ولی برای هر ورودی همان خروجی را می‌دهد؛ پس هر دو درست‌اند.`,
      };
    case "order":
      return { tone: "turned", text: `نزدیک بود! مرحله‌های درست را پیدا کردی، ولی ترتیبشان برعکس است. ${right}` };
    case "swapped":
      return { tone: "turned", text: `نزدیک بود! عددها درست‌اند ولی جای عدد کنار a و عدد کنار b عوض شده. ${right}` };
    case "fitsSome": {
      const good = q.examples.map((e, i) => (fits(m, e) ? fa(i + 1) : null)).filter(Boolean);
      const badOnes = q.examples.map((e, i) => (fits(m, e) ? null : fa(i + 1))).filter(Boolean);
      return { tone: "turned", text: `ماشین تو با مثال ${good.join("، ")} جور است ولی با مثال ${badOnes.join("، ")} نه. قانون باید با همه مثال‌ها جور باشد. ${right}` };
    }
    default:
      return { tone: "bad", text: `ماشین تو با مثال‌ها جور نیست. ${right}` };
  }
}

/** One slot of a machine being built: an operation and a number (empty until chosen). */
interface Slot {
  op: Op | null;
  n: string;
}

interface Props {
  question: MachineQuestion;
  type: TryType;
  level: Level;
  examples: 2 | 3 | 4;
  division: boolean;
  checked: Answer | null;
  onCheck: (a: Answer) => void;
  onType: (t: TryType) => void;
  onLevel: (l: Level) => void;
  onExamples: (n: 2 | 3 | 4) => void;
  onDivision: (on: boolean) => void;
  onNew: () => void;
  /** Mock exam: record the answer, show nothing about it. */
  exam?: boolean;
}

function initialSlots(q: MachineQuestion, checked: Answer | null): Slot[] {
  if (q.type !== "build") return [];
  if (q.machine.kind === "op") {
    const op = typeof checked === "object" && checked?.kind === "op" ? checked.op : null;
    return [
      { op: null, n: op ? String(op.p) : "" },
      { op: null, n: op ? String(Math.abs(op.q)) : "" },
    ];
  }
  const rule = typeof checked === "object" && checked?.kind === "machine" ? checked.rule : null;
  return Array.from({ length: q.machine.rule.length }, (_, i) => (rule?.[i] ? { op: rule[i].op, n: String(rule[i].n) } : { op: null, n: "" }));
}

export function MachineTryPanel(p: Props) {
  const { question: q, checked } = p;
  const done = checked !== null;
  const [num, setNum] = useState(typeof checked === "number" ? String(checked) : "");
  const [slots, setSlots] = useState<Slot[]>(() => initialSlots(q, checked));
  const [minus, setMinus] = useState(() => typeof checked === "object" && checked?.kind === "op" && checked.op.q < 0);
  const [sel, setSel] = useState(0);

  const isOpBuild = q.type === "build" && q.machine.kind === "op";
  const fb = !done || p.exam ? null : q.type === "build" ? buildFeedback(q, checked as Machine) : numberFeedback(q, checked as number);
  const usesSteps = q.type !== "operator" && !(q.type !== "run" && q.type !== "reverse" && p.level === 3);
  const usesExamples = q.type === "guess" || q.type === "build";

  const setSlot = (i: number, s: Partial<Slot>) => setSlots((cur) => cur.map((x, k) => (k === i ? { ...x, ...s } : x)));
  const builtReady = isOpBuild ? slots.every((s) => s.n !== "") : slots.every((s) => s.op && s.n !== "" && Number(s.n) > 0);
  const built = (): Machine =>
    isOpBuild
      ? { kind: "op", op: { form: "lin", r: 0, p: Number(slots[0].n), q: (minus ? -1 : 1) * Number(slots[1].n), c: 0 } }
      : { kind: "machine", rule: slots.map((s) => ({ op: s.op!, n: Number(s.n) }) as Step) };

  return (
    <div className={styles.panel}>
      <TypeLevelChips type={p.type} level={p.level} onType={p.onType} onLevel={p.onLevel} />
      {(usesExamples || usesSteps) && (
        <div className={styles.chips} aria-label="تنظیم نمونه تازه" data-practice-hide>
          {usesExamples &&
            ([2, 3, 4] as const).map((n) => (
              <button key={n} role="radio" aria-checked={p.examples === n} disabled={p.level === 3 && n === 2} onClick={() => p.onExamples(n)} title={p.level === 3 && n === 2 ? "عملگر دست‌کم ۳ مثال لازم دارد" : undefined}>
                {fa(n)} مثال
              </button>
            ))}
          {usesSteps && (
            <button role="checkbox" aria-checked={p.division} onClick={() => p.onDivision(!p.division)}>
              {p.division ? "✓ " : ""}با ÷
            </button>
          )}
        </div>
      )}

      <p className={styles.prompt}>{machinePrompt(q)}</p>

      {q.type !== "build" && <NumberPad value={num} onChange={setNum} disabled={done} />}

      {q.type === "build" && !isOpBuild && (
        <>
          <div className={styles.chips} role="radiogroup" aria-label="مرحله‌های ماشین تو" dir="ltr">
            {slots.map((s, i) => (
              <button key={i} role="radio" aria-checked={sel === i} onClick={() => setSel(i)} disabled={done} style={{ fontSize: "1.2rem" }}>
                {s.op ? SYM[s.op] : "؟"}
                {s.n ? fa(s.n) : "□"}
              </button>
            ))}
          </div>
          <p className={styles.hint}>
            مرحله {fa(sel + 1)} را بساز: کار و عددش را انتخاب کن.
          </p>
          <div className={styles.chips} role="radiogroup" aria-label="کار">
            {(["+", "-", "×", "÷"] as Op[]).map((op) => (
              <button key={op} role="radio" aria-checked={slots[sel]?.op === op} onClick={() => setSlot(sel, { op })} disabled={done} style={{ fontSize: "1.3rem" }} aria-label={OP_WORD[op]}>
                {SYM[op]}
              </button>
            ))}
          </div>
          <NumberPad value={slots[sel]?.n ?? ""} onChange={(v) => setSlot(sel, { n: v })} disabled={done} maxDigits={2} />
        </>
      )}

      {isOpBuild && (
        <>
          <div className={styles.chips} dir="ltr" aria-label="قانون تو" style={{ alignItems: "center", fontSize: "1.2rem", fontWeight: 700 }}>
            <span style={{ padding: "0 4px" }}>a ★ b =</span>
            <button role="radio" aria-checked={sel === 0} onClick={() => setSel(0)} disabled={done} aria-label="عدد کنار a" style={{ fontSize: "1.2rem" }}>
              {slots[0].n ? fa(slots[0].n) : "□"}
            </button>
            <span>a</span>
            <button onClick={() => setMinus(!minus)} disabled={done} aria-label={minus ? "منها؛ برای جمع بزن" : "جمع؛ برای منها بزن"} style={{ fontSize: "1.3rem" }}>
              {minus ? "−" : "+"}
            </button>
            <button role="radio" aria-checked={sel === 1} onClick={() => setSel(1)} disabled={done} aria-label="عدد کنار b" style={{ fontSize: "1.2rem" }}>
              {slots[1].n ? fa(slots[1].n) : "□"}
            </button>
            <span>b</span>
          </div>
          <p className={styles.hint}>یک جعبه را بزن و عددش را بنویس؛ با دکمه وسط، + و − عوض می‌شود.</p>
          <NumberPad value={slots[sel]?.n ?? ""} onChange={(v) => setSlot(sel, { n: v })} disabled={done} maxDigits={2} />
        </>
      )}

      {!done && (
        <button className={styles.secondary} disabled={q.type === "build" ? !builtReady : !num} onClick={() => p.onCheck(q.type === "build" ? built() : Number(num))}>
          بررسی
        </button>
      )}

      {fb && (
        <p className={`${styles.feedback} ${styles[fb.tone]}`} role="status" aria-live="polite">
          <span className={styles.icon}>{ICON[fb.tone]}</span> {fb.text}
        </p>
      )}
      {done && !p.exam && q.type === "build" && (
        <p className={styles.hint}>
          در جدول، ستون «ماشین تو» خروجی ماشین تو را برای هر مثال نشان می‌دهد ({ltr("✓")} جور، {ltr("✗")} ناجور).
        </p>
      )}
      {done && !p.exam && (q.type === "run" || q.type === "reverse" || q.type === "guess") && <p className={styles.hint}>روی صفحه، عدد از ماشین رد می‌شود؛ با نوار پایین جلو و عقب ببر.</p>}

      <button className={styles.next} onClick={p.onNew}>
        نمونه تازه
      </button>
    </div>
  );
}

/** Outputs of a built machine for each example, for the table. */
export const builtOutputs = (q: BuildQuestion, m: Machine) => q.examples.map((e) => machineValue(m, e.input));


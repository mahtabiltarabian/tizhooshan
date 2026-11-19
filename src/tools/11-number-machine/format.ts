// Writing machines and operators in Persian digits. Machines and equations
// read left to right (input on the left, output on the right), so every one
// is wrapped in ltr() inside a Persian sentence.

import { backRule, opValue, trace, type OpDef, type Op, type Rule, type Step } from "@/generators/number-machine";
import { fa } from "@/tools/registry";

/** Keeps an equation left to right inside a Persian sentence. */
export const ltr = (s: string) => `⁦${s}⁩`;

export const SYM: Record<Op, string> = { "+": "+", "-": "−", "×": "×", "÷": "÷" };
export const OP_WORD: Record<Op, string> = { "+": "به‌علاوه", "-": "منهای", "×": "ضرب در", "÷": "تقسیم بر" };

/** A number in Persian digits; fractions with "٫", negatives with "−". */
export function numFa(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const r = Math.round(v * 100) / 100;
  const s = fa(Math.abs(r)).replace(".", "٫");
  return r < 0 ? `−${s}` : s;
}

export const stepFa = (s: Step) => `${SYM[s.op]}${fa(s.n)}`;

/** "+۳ → ×۲" */
export const ruleFa = (rule: Rule) => rule.map(stepFa).join(" → ");

/** "۵ →[+۳]→ ۸ →[×۲]→ ۱۶" */
export function chainFa(x: number, rule: Rule): string {
  const t = trace(x, rule);
  return t.map((v, i) => (i ? `[${stepFa(rule[i - 1])}]→ ${numFa(v)}` : numFa(v))).join(" →");
}

/** The machine backwards from its output: "۱۶ →[÷۲]→ ۸ →[−۳]→ ۵" */
export const backChainFa = (y: number, rule: Rule) => chainFa(y, backRule(rule));

/** One signed term: "۲a", " − b", " + ۳". */
function term(coef: number, v: string, first: boolean) {
  if (coef === 0) return "";
  const body = Math.abs(coef) === 1 && v ? v : `${fa(Math.abs(coef))}${v}`;
  if (first) return coef < 0 ? `−${body}` : body;
  return `${coef < 0 ? " − " : " + "}${body}`;
}

/** The right side of a ★ b = …: "۲a + b", "(a + b) × ۲", "a × b − b". */
export function opDefFa(d: OpDef): string {
  if (d.form === "sumTimes") return `(a + b) × ${fa(d.p)}`;
  if (d.form === "diffTimes") return `(a − b) × ${fa(d.p)}`;
  let s = d.r ? "a × b" : "";
  s += term(d.p, "a", !s);
  s += term(d.q, "b", !s);
  s += term(d.c, "", !s);
  return s || "۰";
}

export const opFullFa = (d: OpDef) => `a ★ b = ${opDefFa(d)}`;

/** Signed terms of the operator with a and b put in, each with its value. */
function parts(d: OpDef, a: number, b: number) {
  const out: { sign: number; text: string; value: number }[] = [];
  if (d.r) out.push({ sign: 1, text: `${fa(a)} × ${fa(b)}`, value: a * b });
  const lin = (k: number, x: number) => {
    if (!k) return;
    out.push({ sign: Math.sign(k), text: Math.abs(k) === 1 ? fa(x) : `${fa(Math.abs(k))} × ${fa(x)}`, value: Math.abs(k) * x });
  };
  lin(d.p, a);
  lin(d.q, b);
  if (d.c) out.push({ sign: Math.sign(d.c), text: fa(Math.abs(d.c)), value: Math.abs(d.c) });
  return out;
}

const joinSigned = (xs: { sign: number; s: string }[]) => xs.map((x, i) => (i ? `${x.sign < 0 ? " − " : " + "}${x.s}` : x.sign < 0 ? `−${x.s}` : x.s)).join("");

/** a and b put in: "۲ × ۳ + ۵", "(۳ + ۵) × ۲". */
export function opSubstFa(d: OpDef, a: number, b: number): string {
  if (d.form === "sumTimes") return `(${fa(a)} + ${fa(b)}) × ${fa(d.p)}`;
  if (d.form === "diffTimes") return `(${fa(a)} − ${fa(b)}) × ${fa(d.p)}`;
  return joinSigned(parts(d, a, b).map((x) => ({ sign: x.sign, s: x.text })));
}

/** One step further: "۶ + ۵", "۸ × ۲"; null when there is nothing in between. */
export function opMidFa(d: OpDef, a: number, b: number): string | null {
  if (d.form === "sumTimes") return `${numFa(a + b)} × ${fa(d.p)}`;
  if (d.form === "diffTimes") return `${numFa(a - b)} × ${fa(d.p)}`;
  const ps = parts(d, a, b);
  if (ps.length < 2 || ps.every((x) => !x.text.includes("×"))) return null;
  return joinSigned(ps.map((x) => ({ sign: x.sign, s: numFa(x.value) })));
}

/** "۳ ★ ۵ = ۲ × ۳ + ۵ = ۶ + ۵ = ۱۱" */
export function opCalcFa(d: OpDef, a: number, b: number, lhs = `${numFa(a)} ★ ${numFa(b)}`): string {
  const mid = opMidFa(d, a, b);
  return `${lhs} = ${opSubstFa(d, a, b)}${mid ? ` = ${mid}` : ""} = ${numFa(opValue(d, a, b))}`;
}

/** The lines of working for a ★ b, one per line. */
export function opLines(d: OpDef, a: number, b: number): string[] {
  const mid = opMidFa(d, a, b);
  return [`${numFa(a)} ★ ${numFa(b)} = ${opSubstFa(d, a, b)}`, ...(mid ? [`= ${mid}`] : []), `= ${numFa(opValue(d, a, b))}`];
}

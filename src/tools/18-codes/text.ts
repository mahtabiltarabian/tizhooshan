// Words for tool 18's letter, number and shape codes: rules, prompts, the
// working and the answer. Plain code (no React): the try panel, the
// worksheet and the practice adapter (which the server imports) share it.

import { ALPHABET, answerKind, encodeLetter, mod, N, outKind, SHAPE_FA, SHAPES, signedShift, SPACE, textOf, type CodeQuestion, type Rule, type TokenKind } from "@/generators/codes";
import { fa } from "@/tools/registry";

/** The token a rule gives letter i, as text (for captions and lists). */
export function tokenText(kind: TokenKind, t: number | null) {
  if (t === null) return "؟";
  if (t === SPACE) return " ";
  return kind === "number" ? fa(t) : kind === "shape" ? SHAPE_FA[SHAPES[t]] : (ALPHABET[t] ?? "؟");
}

/** Keeps an equation left to right inside a Persian sentence. */
export const ltr = (s: string) => `⁦${s.replace(/ /g, " ")}⁩`;

export const quote = (s: string) => `«${s}»`;

/** First, second and third letters a number rule counts from. */
export const countFrom = (r: Extract<Rule, { kind: "number" }>) => (r.rev ? [N - 1, N - 2, N - 3] : [0, 1, 2]);

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
export const what = (q: CodeQuestion) => (q.type === "sentence" ? "جمله" : "کلمه");

export function codePrompt(q: CodeQuestion, paper = false): string {
  const rule = q.show === "key" ? (paper ? "با جدول رمز:" : "با جدول رمز بالای صفحه:") : q.show === "words" ? `قانون رمز: ${ruleFa(q.rule)}.` : `قانون رمز را از ${fa(q.examples.length)} مثال پیدا کن.`;
  const task =
    q.dir === "encode"
      ? `کلمه ${quote(textOf(q.plain))} را رمز کن.`
      : `این ${what(q)} رمزی را بخوان: ${what(q)} اصلی چیست؟${q.type === "sentence" ? " (فاصله‌ها سر جایشان هستند.)" : ""}`;
  return `${rule} ${task}`;
}

/** Equation for one letter of a number rule: place, then the sum. */
export function numberEquation(r: Extract<Rule, { kind: "number" }>, i: number) {
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

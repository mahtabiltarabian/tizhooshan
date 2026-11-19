// Tool 18: codes and ciphers. Letters are places 0 … 31 in the 32-letter
// Persian alphabet (the same order as tool 9). A rule turns each letter into a
// code token: another letter, a number or a shape. Words keep a SPACE token
// between them. Each question keeps its answer and the usual slips, so the
// feedback can say which slip a wrong answer was.

import { mulberry32, pick, randInt, shuffle, type Rng } from "./random";

export type Level = 1 | 2 | 3;
export type CodeQuestionType = "shift" | "number" | "shape" | "sentence";
export const CODE_TYPES: CodeQuestionType[] = ["shift", "number", "shape", "sentence"];

/** The 32 letters of the Persian alphabet, in school order (as in tool 9). */
export const ALPHABET = ["ا", "ب", "پ", "ت", "ث", "ج", "چ", "ح", "خ", "د", "ذ", "ر", "ز", "ژ", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف", "ق", "ک", "گ", "ل", "م", "ن", "و", "ه", "ی"];
export const N = ALPHABET.length;
export const SPACE = -1;
/** پ چ ژ گ: the four letters the Arabic alphabet does not have. */
export const PERSIAN_ONLY = [2, 6, 13, 25];

export const mod = (x: number) => ((x % N) + N) % N;
/** Text to letter places; a space is SPACE, anything else -2. */
export const toLetters = (s: string) => [...s].map((ch) => (ch === " " ? SPACE : ALPHABET.indexOf(ch) < 0 ? -2 : ALPHABET.indexOf(ch)));
export const textOf = (xs: readonly (number | null)[]) => xs.map((i) => (i === SPACE ? " " : i === null ? "…" : (ALPHABET[i] ?? "؟"))).join("");

/** Shapes for shape codes; they differ in form, never only in colour. */
export const SHAPES = ["circle", "triangle", "square", "diamond", "star", "heart", "moon", "plus", "hexagon", "arrow", "ring", "cross"] as const;
export type ShapeName = (typeof SHAPES)[number];
export const SHAPE_FA: Record<ShapeName, string> = {
  circle: "دایره",
  triangle: "مثلث",
  square: "مربع",
  diamond: "لوزی",
  star: "ستاره",
  heart: "قلب",
  moon: "ماه",
  plus: "به‌علاوه",
  hexagon: "شش‌ضلعی",
  arrow: "پیکان",
  ring: "حلقه",
  cross: "ضربدر",
};

/**
 * shift: each letter n places on (n < 0: back), round the end of the alphabet.
 * mirror: the alphabet turned round (ا ↔ ی, ب ↔ ه …), then n places on.
 * number: a letter's place counted from ا (or from ی when `rev`), times `step`, plus `start`.
 * shape: a table of letters and shapes (only the letters in it can be written).
 * sub: any one-to-one table, built by hand in "explore".
 */
export type Rule =
  | { kind: "shift"; n: number }
  | { kind: "mirror"; n: number }
  | { kind: "number"; start: number; step: 1 | 2; rev: boolean }
  | { kind: "shape"; key: [letter: number, shape: number][] }
  | { kind: "sub"; perm: number[] };

export type TokenKind = "letter" | "number" | "shape";
export const outKind = (r: Rule): TokenKind => (r.kind === "number" ? "number" : r.kind === "shape" ? "shape" : "letter");

/** The code of one letter, or null if the rule has none (a shape table without it). */
export function encodeLetter(r: Rule, i: number): number | null {
  switch (r.kind) {
    case "shift":
      return mod(i + r.n);
    case "mirror":
      return mod(N - 1 - i + r.n);
    case "number":
      return r.start + r.step * (r.rev ? N - 1 - i : i);
    case "shape":
      return r.key.find(([l]) => l === i)?.[1] ?? null;
    case "sub":
      return r.perm[i] ?? null;
  }
}

/** The letter behind a code token, or null. */
export function decodeToken(r: Rule, t: number): number | null {
  for (let i = 0; i < N; i++) if (encodeLetter(r, i) === t) return i;
  return null;
}

export const encode = (r: Rule, xs: readonly number[]) => xs.map((x) => (x === SPACE ? SPACE : encodeLetter(r, x)));
export const decode = (r: Rule, xs: readonly number[]) => xs.map((x) => (x === SPACE ? SPACE : decodeToken(r, x)));

/** A shift as people say it: 29 places on is 3 back. */
export const signedShift = (n: number) => (mod(n) > N / 2 ? mod(n) - N : mod(n));

export const sameTokens = (a: readonly (number | null)[], b: readonly (number | null)[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export interface Example {
  plain: number[];
  coded: number[];
}

/** Does a rule turn every example into its code? */
export const fits = (r: Rule, examples: readonly Example[]) => examples.every((e) => sameTokens(encode(r, e.plain), e.coded));

/** Level 3 letter rules: every shift, and the mirror with every shift after it. */
export const LETTER_FAMILY: Rule[] = [
  ...Array.from({ length: N - 1 }, (_, k) => ({ kind: "shift" as const, n: k + 1 })),
  ...Array.from({ length: N }, (_, k) => ({ kind: "mirror" as const, n: k })),
];

/** Level 3 number rules: start 1 … 10, counting by 1 or 2, from ا or from ی. */
export const NUMBER_FAMILY: Rule[] = [1, 2].flatMap((step) =>
  [false, true].flatMap((rev) => Array.from({ length: 10 }, (_, k) => ({ kind: "number" as const, start: k + 1, step: step as 1 | 2, rev }))),
);

// ---------------------------------------------------------------- words

/** Simple, common words a 10-year-old knows; only the 32 letters (no آ, no half-space). */
export const WORDS = [
  // 3 letters
  "سیب", "ماه", "باغ", "کوه", "شیر", "درس", "دست", "گرگ", "مرغ", "برف", "باد", "نان", "چای", "رود", "ابر", "گاو", "موش", "خرس", "اسب", "کیف",
  "میز", "فیل", "توپ", "زنگ", "بال", "گوش", "روز", "نور", "قلم", "عسل", "ببر", "شتر", "مار", "کیک", "پتو", "کفش", "شهر", "شاد", "زرد", "سبز",
  "چتر", "ظرف", "ذرت", "غذا", "هلو", "ژله", "طلا", "صبح", "حوض", "ظهر", "عقاب",
  // 4 letters
  "کتاب", "مداد", "خانه", "درخت", "دریا", "گربه", "ماهی", "جنگل", "زمین", "دفتر", "انار", "پسته", "ژاکت", "پیاز", "قایق", "چراغ", "کلاغ", "طوطی",
  "تخته", "بهار", "گوزن", "فندق", "پلنگ", "جوجه", "اردک", "لیمو", "هویج", "گوجه", "سبزی", "بالش", "دامن", "کلاه", "حیاط", "کوچه", "جاده", "ساعت",
  "فردا", "قرمز", "سفید", "سیاه", "بنفش", "نقشه", "عینک", "ورزش", "تلفن", "مربا",
  // 5 letters
  "پرنده", "مدرسه", "ستاره", "باران", "بادام", "گیلاس", "کبوتر", "زرافه", "دلفین", "شاپرک", "صندلی", "پاییز", "ثانیه", "حلزون", "عروسک",
  "خرگوش", "بستنی", "نارنج", "چمدان", "جوراب", "باغچه", "گلدان", "روستا", "تقویم", "امروز", "صابون", "پنجره", "مهتاب", "شکلات", "تابلو",
  "سنجاب", "طاووس", "شطرنج", "ماشین", "نقاشی", "کلوچه", "دندان", "زنبور", "گنجشک",
  // 6 letters
  "خورشید", "پروانه", "زمستان", "مهربان", "خیابان", "شیرینی", "نارنجی", "دوچرخه", "پرستار", "پیراهن",
];

/** Short sentences of two or three words. */
export const PHRASES = [
  "گل زرد", "سیب سرخ", "باد سرد", "برف سفید", "کتاب خوب", "ابر سیاه", "شیر بخور", "درس بخوان", "باغ سبز", "روز خوب", "ماهی قرمز", "گربه ناز",
  "کوه بلند", "نان گرم", "چای داغ", "توپ گرد", "سلام دوست من", "من گل دارم", "ما شاد هستیم", "ماه روشن است", "باد سرد است", "در باغ گل است",
];

const WORD_LETTERS = WORDS.map(toLetters);
const PHRASE_LETTERS = PHRASES.map(toLetters);
const maskOf = (xs: readonly number[]) => xs.reduce((m, x) => (x >= 0 ? m | (1 << x) : m), 0);
const bits = (m: number) => {
  let c = 0;
  for (let x = m; x; x &= x - 1) c++;
  return c;
};
const MASKS = WORD_LETTERS.map(maskOf);

/** For each word, pairs of other words that hold all its letters (with at most 12 letters between them, one per shape). */
let coverCache: [number, number][][] | null = null;
function covers() {
  if (coverCache) return coverCache;
  coverCache = WORD_LETTERS.map((_, w) => {
    const out: [number, number][] = [];
    for (let a = 0; a < WORDS.length; a++)
      for (let b = a + 1; b < WORDS.length; b++) {
        if (a === w || b === w) continue;
        const u = MASKS[a] | MASKS[b];
        if ((MASKS[w] & ~u) === 0 && bits(u) <= SHAPES.length) out.push([a, b]);
      }
    return out;
  });
  return coverCache;
}

export interface CodeOptions {
  /** Letters in the word, 3 … 6; 0 or missing for any. */
  length?: number;
  /** Examples at level 3: 2 or 3. */
  examples?: 2 | 3;
}

function wordIndex(rng: Rng, lengths: number[], opts: CodeOptions, ok: (w: number) => boolean = () => true) {
  const want = opts.length && opts.length >= 3 && opts.length <= 6 ? [opts.length] : lengths;
  const all = WORD_LETTERS.map((_, i) => i).filter(ok);
  const sized = all.filter((i) => want.includes(WORD_LETTERS[i].length));
  return pick(rng, sized.length ? sized : all);
}

// ---------------------------------------------------------------- questions

export interface CodeQuestion {
  type: CodeQuestionType;
  level: Level;
  seed: number;
  rule: Rule;
  dir: "encode" | "decode";
  /** The word or sentence, as letter places (SPACE between words). */
  plain: number[];
  /** Its code, a token per letter. */
  coded: number[];
  /** What the pupil sees: `plain` to encode, `coded` to decode. */
  given: number[];
  answer: number[];
  /**
   * How the rule reaches the pupil: a key table (level 1), in words (level 2),
   * or from examples (level 3).
   */
  show: "key" | "words" | "examples";
  /** Letters listed in the key table. */
  key: number[];
  examples: Example[];
}

/** What kind of answer a question wants. */
export const answerKind = (q: CodeQuestion): TokenKind => (q.dir === "decode" ? "letter" : outKind(q.rule));

const ALL_LETTERS = Array.from({ length: N }, (_, i) => i);

function build(type: CodeQuestionType, level: Level, seed: number, rule: Rule, dir: "encode" | "decode", plain: number[], show: CodeQuestion["show"], key: number[], examples: Example[] = []): CodeQuestion {
  const coded = encode(rule, plain) as number[];
  return { type, level, seed, rule, dir, plain, coded, given: dir === "encode" ? plain : coded, answer: dir === "encode" ? coded : plain, show, key, examples };
}

/** Examples for level 3: short words, not the question word, and exactly one rule of the family fits them all. */
function examplesFor(rng: Rng, rule: Rule, family: Rule[], avoid: number, count: number): Example[] | null {
  for (let t = 0; t < 40; t++) {
    const picks: number[] = [];
    while (picks.length < count) {
      const w = wordIndex(rng, [3, 4], {}, (i) => i !== avoid && !picks.includes(i));
      picks.push(w);
    }
    const ex = picks.map((w) => ({ plain: WORD_LETTERS[w], coded: encode(rule, WORD_LETTERS[w]) as number[] }));
    if (family.filter((r) => fits(r, ex)).length === 1) return ex;
  }
  return null;
}

function shiftQuestion(rng: Rng, level: Level, seed: number, opts: CodeOptions): CodeQuestion {
  if (level === 1) {
    const rule: Rule = { kind: "shift", n: 1 + randInt(rng, 3) };
    const w = wordIndex(rng, [3, 4], opts);
    return build("shift", level, seed, rule, rng() < 0.7 ? "encode" : "decode", WORD_LETTERS[w], "key", ALL_LETTERS);
  }
  if (level === 2) {
    const n = (1 + randInt(rng, 6)) * (rng() < 0.65 ? 1 : -1);
    const w = wordIndex(rng, [4, 5], opts);
    return build("shift", level, seed, { kind: "shift", n }, rng() < 0.5 ? "encode" : "decode", WORD_LETTERS[w], "words", []);
  }
  for (;;) {
    const rule = rng() < 0.3 ? LETTER_FAMILY[N - 1 + randInt(rng, N)] : { kind: "shift" as const, n: (1 + randInt(rng, 7)) * (rng() < 0.7 ? 1 : -1) };
    const w = wordIndex(rng, [4, 5], opts);
    const ex = examplesFor(rng, rule, LETTER_FAMILY, w, opts.examples ?? 2);
    if (ex) return build("shift", level, seed, rule, rng() < 0.5 ? "encode" : "decode", WORD_LETTERS[w], "examples", [], ex);
  }
}

function numberQuestion(rng: Rng, level: Level, seed: number, opts: CodeOptions): CodeQuestion {
  const dir = rng() < 0.5 ? "encode" : "decode";
  if (level === 1) {
    const w = wordIndex(rng, [3, 4], opts);
    return build("number", level, seed, { kind: "number", start: 1, step: 1, rev: false }, dir, WORD_LETTERS[w], "key", ALL_LETTERS);
  }
  if (level === 2) {
    const rule: Rule = rng() < 0.6 ? { kind: "number", start: 2 + randInt(rng, 8), step: 1, rev: false } : { kind: "number", start: 1 + randInt(rng, 3), step: 1, rev: true };
    const w = wordIndex(rng, [3, 4, 5], opts);
    return build("number", level, seed, rule, dir, WORD_LETTERS[w], "words", []);
  }
  for (;;) {
    const rule = pick(rng, NUMBER_FAMILY);
    const w = wordIndex(rng, [3, 4, 5], opts);
    const ex = examplesFor(rng, rule, NUMBER_FAMILY, w, opts.examples ?? 2);
    if (ex) return build("number", level, seed, rule, dir, WORD_LETTERS[w], "examples", [], ex);
  }
}

function shapeQuestion(rng: Rng, level: Level, seed: number, opts: CodeOptions): CodeQuestion {
  const dir = rng() < 0.5 ? "encode" : "decode";
  const shapes = shuffle(rng, SHAPES.map((_, i) => i));
  const keyOf = (letters: number[]): Rule => ({ kind: "shape", key: letters.map((l, k) => [l, shapes[k]]) });
  if (level < 3) {
    const w = wordIndex(rng, level === 1 ? [3, 4] : [4, 5, 6], opts);
    const own = [...new Set(WORD_LETTERS[w])];
    const size = level === 1 ? 6 + randInt(rng, 3) : 10;
    const extra = shuffle(rng, ALL_LETTERS.filter((l) => !own.includes(l))).slice(0, Math.max(0, size - own.length));
    const key = [...own, ...extra].sort((a, b) => a - b);
    return build("shape", level, seed, keyOf(shuffle(rng, key)), level === 1 ? dir : "decode", WORD_LETTERS[w], "key", key);
  }
  const cov = covers();
  const w = wordIndex(rng, [3, 4, 5], opts, (i) => cov[i].length > 0);
  const [a, b] = pick(rng, cov[w]);
  const picks = [a, b];
  if ((opts.examples ?? 2) === 3) {
    const u = MASKS[a] | MASKS[b];
    const third = WORD_LETTERS.map((_, i) => i).filter((i) => i !== w && !picks.includes(i) && bits(u | MASKS[i]) <= SHAPES.length);
    if (third.length) picks.push(pick(rng, third));
  }
  const letters = [...new Set(picks.flatMap((p) => WORD_LETTERS[p]))];
  const rule = keyOf(shuffle(rng, letters));
  const ex = shuffle(rng, picks).map((p) => ({ plain: WORD_LETTERS[p], coded: encode(rule, WORD_LETTERS[p]) as number[] }));
  return build("shape", level, seed, rule, dir, WORD_LETTERS[w], "examples", [], ex);
}

function sentenceQuestion(rng: Rng, level: Level, seed: number, opts: CodeOptions): CodeQuestion {
  const p = randInt(rng, PHRASES.length);
  const plain = PHRASE_LETTERS[p];
  if (level === 1) return build("sentence", level, seed, { kind: "number", start: 1, step: 1, rev: false }, "decode", plain, "key", ALL_LETTERS);
  if (level === 2) return build("sentence", level, seed, { kind: "shift", n: (1 + randInt(rng, 4)) * (rng() < 0.7 ? 1 : -1) }, "decode", plain, "words", []);
  for (;;) {
    const rule = rng() < 0.25 ? LETTER_FAMILY[N - 1 + randInt(rng, N)] : { kind: "shift" as const, n: (1 + randInt(rng, 5)) * (rng() < 0.7 ? 1 : -1) };
    const ex = examplesFor(rng, rule, LETTER_FAMILY, -1, opts.examples ?? 2);
    if (ex) return build("sentence", level, seed, rule, "decode", plain, "examples", [], ex);
  }
}

export function makeCodeQuestion(type: CodeQuestionType, level: Level, seed: number, opts: CodeOptions = {}): CodeQuestion {
  // Default options leave the seed as it is, so a worksheet and the tool agree on a seed.
  const rng = mulberry32(seed * 7 + level * 101 + CODE_TYPES.indexOf(type) * 13 + (opts.length || 0) * 3 + (opts.examples === 3 ? 15 : 0));
  switch (type) {
    case "shift":
      return shiftQuestion(rng, level, seed, opts);
    case "number":
      return numberQuestion(rng, level, seed, opts);
    case "shape":
      return shapeQuestion(rng, level, seed, opts);
    case "sentence":
      return sentenceQuestion(rng, level, seed, opts);
  }
}

// ---------------------------------------------------------------- slips

export type CodeTag = "right" | "wrongWay" | "offByOne" | "arabic" | "wrap" | "oneExample" | "reversed" | "partial" | "other";

/** n steps along the alphabet (back when n < 0), not stopping on پ چ ژ گ, as if they were missing. */
export function arabicStep(i: number, n: number) {
  let x = i;
  for (let k = 0; k < Math.abs(n); k++) {
    do x = mod(x + Math.sign(n));
    while (PERSIAN_ONLY.includes(x));
  }
  return x;
}

/** Place among the 28 letters of the Arabic alphabet (پ چ ژ گ keep their own place). */
const ARABIC = ALL_LETTERS.filter((i) => !PERSIAN_ONLY.includes(i));
const arabicPlace = (i: number) => (PERSIAN_ONLY.includes(i) ? i : ARABIC.indexOf(i));

const each = (xs: readonly number[], f: (x: number) => number | null) => xs.map((x) => (x === SPACE ? SPACE : f(x)));
const complete = (xs: (number | null)[]): xs is number[] => xs.every((x) => x !== null);

/**
 * The answer as someone would give it who counts in the 28-letter Arabic
 * alphabet (پ چ ژ گ missing), slot by slot, encoding or decoding. null where
 * that alphabet gives nothing: decoding a number past its end. Only for shift
 * and number rules; for the others, null.
 */
export function arabicReading(q: CodeQuestion): (number | null)[] | null {
  const r = q.rule;
  if (r.kind === "shift") {
    const d = signedShift(q.dir === "encode" ? r.n : -r.n);
    return each(q.given, (x) => arabicStep(x, d));
  }
  if (r.kind !== "number") return null;
  // Counting places in the 28-letter Arabic alphabet.
  const value = (i: number) => r.start + r.step * (r.rev ? ARABIC.length - 1 - arabicPlace(i) : arabicPlace(i));
  if (q.dir === "encode") return each(q.given, value);
  return each(q.given, (t) => ARABIC.find((l) => value(l) === t) ?? null);
}

/**
 * Decoding with پ چ ژ گ left out, letter by letter: every letter is either
 * right or what the 28-letter alphabet gives, and at least one is the latter.
 * A code past the end of the 28 letters has no such letter, so there the
 * right letter or an empty slot is allowed.
 */
function arabicDecode(q: CodeQuestion, value: readonly (number | null)[]): boolean {
  if (q.dir !== "decode" || value.length !== q.answer.length) return false;
  const reading = arabicReading(q);
  if (!reading) return false;
  let slip = false;
  for (let i = 0; i < value.length; i++) {
    const v = value[i];
    if (v === q.answer[i]) continue;
    if (reading[i] === null ? v !== null : v !== reading[i]) return false;
    if (reading[i] !== null) slip = true;
  }
  return slip;
}

/** Wrong answers with a known cause, in the order they are checked. */
export function slips(q: CodeQuestion): [CodeTag, number[]][] {
  const out: [CodeTag, (number | null)[]][] = [];
  const r = q.rule;
  const g = q.given;
  const arabic = arabicReading(q);
  // The letter rule as one signed step from the given text to the answer.
  if (r.kind === "shift") {
    const d = signedShift(q.dir === "encode" ? r.n : -r.n);
    out.push(["wrongWay", each(g, (x) => mod(x - d))]);
    out.push(["offByOne", each(g, (x) => mod(x + d + 1))]);
    out.push(["offByOne", each(g, (x) => mod(x + d - 1))]);
    out.push(["arabic", arabic ?? []]);
    const crosses = g.some((x) => x !== SPACE && (x + d >= N || x + d < 0));
    if (crosses) {
      // Stopped at the end of the alphabet, or miscounted the step round the end.
      out.push(["wrap", each(g, (x) => (x + d >= N ? N - 1 : x + d < 0 ? 0 : x + d))]);
      out.push(["wrap", each(g, (x) => (x + d >= N || x + d < 0 ? mod(x + d + Math.sign(d)) : x + d))]);
      out.push(["wrap", each(g, (x) => (x + d >= N || x + d < 0 ? mod(x + d - Math.sign(d)) : x + d))]);
    }
  }
  if (r.kind === "mirror") {
    out.push(["offByOne", encode({ kind: "mirror", n: r.n + 1 }, g)]);
    out.push(["offByOne", encode({ kind: "mirror", n: r.n - 1 }, g)]);
    // Turned the alphabet round but then stepped back instead of on.
    if (mod(r.n) !== 0) out.push(["wrongWay", encode({ kind: "mirror", n: -r.n }, g)]);
  }
  if (r.kind === "number") {
    const variants: [CodeTag, Rule][] = [
      ["offByOne", { ...r, start: r.start - 1 }],
      ["offByOne", { ...r, start: r.start + 1 }],
      ["wrongWay", { ...r, rev: !r.rev }],
    ];
    for (const [tag, v] of variants) out.push([tag, q.dir === "encode" ? encode(v, g) : decode(v, g)]);
    out.push(["arabic", arabic ?? []]);
  }
  if (q.show === "examples" && r.kind !== "shape") {
    const family = r.kind === "number" ? NUMBER_FAMILY : LETTER_FAMILY;
    for (const f of family)
      if (!fits(f, q.examples) && q.examples.some((e) => fits(f, [e]))) out.push(["oneExample", q.dir === "encode" ? encode(f, q.plain) : decode(f, q.coded)]);
  }
  out.push(["reversed", [...q.answer].reverse()]);
  return out.filter((s): s is [CodeTag, number[]] => complete(s[1]) && s[1].length === q.answer.length);
}

/** Which slots of an answer are right. */
export const slotMarks = (q: CodeQuestion, value: readonly (number | null)[]) => q.answer.map((a, i) => value[i] === a);

/** Which slip an answer is, if any. */
export function codeMistake(q: CodeQuestion, value: readonly (number | null)[]): CodeTag {
  if (sameTokens(value, q.answer)) return "right";
  for (const [tag, v] of slips(q)) if (!sameTokens(v, q.answer) && sameTokens(value, v)) return tag;
  if (arabicDecode(q, value)) return "arabic";
  // Some letters coded, the rest copied as they were.
  if (outKind(q.rule) === "letter" && value.length === q.answer.length) {
    const marks = slotMarks(q, value);
    const kept = value.map((v, i) => !marks[i] && v === q.given[i]);
    if (marks.some((m, i) => m && q.given[i] !== SPACE && q.answer[i] !== q.given[i]) && kept.some(Boolean) && marks.every((m, i) => m || kept[i])) return "partial";
  }
  return "other";
}

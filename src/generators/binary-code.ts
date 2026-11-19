// Tool 18, «کد دودویی»: a row of cards worth … ۱۶ ۸ ۴ ۲ ۱, each face up
// (lamp on, ●) or face down (lamp off, ○). The row is always written left to
// right, the biggest card on the left, like the digits of any number.
//
// A row is a mask: bit i is the card worth 2^i (the rightmost card is bit 0).
// Each question keeps its answer and the usual slips, so the feedback can say
// which slip a wrong answer was.

import { mulberry32, pick, randInt, type Rng } from "./random";
import { ALPHABET, WORDS, toLetters } from "./codes";

export type Level = 1 | 2 | 3;

/**
 * read: which number do these lamps show? (level 1)
 * show: tap the cards to show a number (level 2)
 * howMany: how many lamps for every number from 1 to N? (level 2)
 * word: each letter's place in the alphabet (ا = ۱) in lamps; read the word (level 3)
 * next: the lamps of the next number (level 3)
 * largest: the largest number k lamps can show (level 3)
 */
export type BinaryKind = "read" | "show" | "howMany" | "word" | "next" | "largest";
export const BINARY_KINDS: BinaryKind[] = ["read", "show", "howMany", "word", "next", "largest"];
export type BinaryAnswerKind = "number" | "lamps" | "letters";

export const answerKindOf = (k: BinaryKind): BinaryAnswerKind => (k === "show" || k === "next" ? "lamps" : k === "word" ? "letters" : "number");

/** The usual row: five cards, ۱۶ ۸ ۴ ۲ ۱. */
export const CARDS = 5;
export const MAX = (1 << CARDS) - 1;

/** Card values, left to right: [16, 8, 4, 2, 1] for five cards. */
export const cardValues = (cards = CARDS) => Array.from({ length: cards }, (_, i) => 2 ** (cards - 1 - i));
/** Is the card worth 2^bit face up? */
export const isOn = (mask: number, bit: number) => ((mask >> bit) & 1) === 1;
/** Bits of a row, left to right (biggest card first). */
export const bitsOf = (mask: number, cards = CARDS) => Array.from({ length: cards }, (_, i) => isOn(mask, cards - 1 - i));
/** The row as 0s and 1s, left to right: 13 → "01101". */
export const binaryString = (mask: number, cards = CARDS) =>
  bitsOf(mask, cards)
    .map((b) => (b ? "1" : "0"))
    .join("");
/** Values of the face-up cards, biggest first. */
export const onValues = (mask: number, cards = CARDS) => cardValues(cards).filter((v) => mask & v);

export function popcount(m: number) {
  let c = 0;
  for (let x = m; x; x &= x - 1) c++;
  return c;
}

/** Fewest cards that show n (n ≥ 1): 13 → 4, 16 → 5. */
export const bitLength = (n: number) => (n <= 0 ? 0 : Math.floor(Math.log2(n)) + 1);

/** The row read the wrong way round (as if the ۱ card were on the left). */
export function reverseBits(mask: number, cards = CARDS) {
  let r = 0;
  for (let i = 0; i < cards; i++) if (isOn(mask, i)) r |= 1 << (cards - 1 - i);
  return r;
}

/** Card positions counted from the right (۱, ۲, ۳ …) of the face-up cards, added up. */
export function positionSum(mask: number, cards = CARDS) {
  let s = 0;
  for (let i = 0; i < cards; i++) if (isOn(mask, i)) s += i + 1;
  return s;
}

/** The 0s and 1s read as an ordinary number (cards worth 1, 10, 100 …): 01101 → 1101. */
export function decimalReading(mask: number, cards = CARDS) {
  let s = 0;
  for (let i = 0; i < cards; i++) if (isOn(mask, i)) s += 10 ** i;
  return s;
}

/** Show me: from the biggest card down, take the card if it still fits. */
export interface GreedyStep {
  value: number;
  /** What is left to show before this card. */
  before: number;
  on: boolean;
  after: number;
}

export function greedySteps(n: number, cards = CARDS): GreedyStep[] {
  let rest = n;
  return cardValues(cards).map((value) => {
    const on = value <= rest;
    const before = rest;
    if (on) rest -= value;
    return { value, before, on, after: rest };
  });
}

/** Words for the letter code: no ی (its place, ۳۲, needs a sixth card), three or four letters. */
export const BINARY_WORDS = WORDS.filter((w) => [...w].length >= 3 && [...w].length <= 4 && !w.includes("ی") && toLetters(w).every((x) => x >= 0 && x < MAX));

/** The letter a card row stands for (ا = ۱ … ه = ۳۱), or null for 0. */
export const letterOf = (mask: number): number | null => (mask >= 1 && mask <= ALPHABET.length ? mask - 1 : null);

export type BinaryTag =
  | "right"
  /** Read the row from the right, as Persian text is read. */
  | "rtl"
  /** Added the card positions (۱، ۲، ۳ …) instead of their values. */
  | "positions"
  /** Read the cards as 1, 10, 100 … (powers of 10). */
  | "pow10"
  /** k lamps reach 2^k (it is 2^k − 1); or N lamps for a power of two N. */
  | "pow2"
  /** Counted the face-up cards. */
  | "count"
  /** Only the biggest card. */
  | "biggest"
  /** One lamp for each number. */
  | "perNumber"
  /** Next number: turned on a card but did not turn off the ones after it. */
  | "noCarry"
  /** Letters: counted ا as ۰. */
  | "zeroBased"
  | "other";

export interface BinaryQuestion {
  type: "binary";
  level: Level;
  seed: number;
  kind: BinaryKind;
  /** Cards in the row: 5, or k for "largest". */
  cards: number;
  /** read, show, next: the number; howMany: N; largest: k; word: 0. */
  n: number;
  /** word: the letters (places 0 … 30); otherwise empty. */
  word: number[];
  /** A number (read, howMany, largest), a mask (show, next), or -1 (word). */
  answer: number;
  /** Wrong numbers or masks with a known cause, first match wins; never the answer, never twice. */
  slips: [BinaryTag, number][];
  /** word: the whole word as each slip reads it. */
  letterSlips: [BinaryTag, number[]][];
}

function dedupe(answer: number, raw: [BinaryTag, number][]): [BinaryTag, number][] {
  const out: [BinaryTag, number][] = [];
  for (const [t, v] of raw) if (v !== answer && v >= 0 && !out.some(([, w]) => w === v)) out.push([t, v]);
  return out;
}

/** A number for a row: some lamps on and some off, never the same read from either end. */
function rowNumber(rng: Rng, lo: number, hi: number, ok: (n: number) => boolean = () => true) {
  for (;;) {
    const n = lo + randInt(rng, hi - lo + 1);
    if (popcount(n) >= 2 && reverseBits(n) !== n && ok(n)) return n;
  }
}

const base = (level: Level, seed: number, kind: BinaryKind): Omit<BinaryQuestion, "n" | "answer" | "slips"> => ({
  type: "binary",
  level,
  seed,
  kind,
  cards: CARDS,
  word: [],
  letterSlips: [],
});

function readQuestion(rng: Rng, level: Level, seed: number): BinaryQuestion {
  const n = rowNumber(rng, 5, MAX, (m) => positionSum(m) !== m && positionSum(m) !== reverseBits(m));
  return {
    ...base(level, seed, "read"),
    n,
    answer: n,
    slips: dedupe(n, [
      ["rtl", reverseBits(n)],
      ["positions", positionSum(n)],
      ["pow10", decimalReading(n)],
      ["count", popcount(n)],
    ]),
  };
}

function showQuestion(rng: Rng, level: Level, seed: number): BinaryQuestion {
  const n = rowNumber(rng, 6, MAX);
  return {
    ...base(level, seed, "show"),
    n,
    answer: n,
    slips: [["rtl", reverseBits(n)]],
  };
}

function howManyQuestion(rng: Rng, level: Level, seed: number): BinaryQuestion {
  // Powers of two often: there "2^k" and "2^k − 1" give different answers.
  const N =
    rng() < 0.4
      ? 2 ** (2 + randInt(rng, 6))
      : pick(
          rng,
          Array.from({ length: 196 }, (_, i) => i + 5).filter((x) => popcount(x) > 1),
        );
  const answer = bitLength(N);
  return {
    ...base(level, seed, "howMany"),
    n: N,
    answer,
    slips: dedupe(answer, [
      ["pow2", Math.ceil(Math.log2(N))],
      ["pow10", String(N).length],
      ["perNumber", N],
    ]),
  };
}

/** Each letter of a word, as one of the slips would read its row. */
const slipLetter: Partial<Record<BinaryTag, (mask: number) => number | null>> = {
  rtl: (m) => letterOf(reverseBits(m)),
  positions: (m) => letterOf(positionSum(m)),
  zeroBased: (m) => (m < ALPHABET.length ? m : null),
};
export const LETTER_SLIP_TAGS: BinaryTag[] = ["rtl", "positions", "zeroBased"];

/** The row (mask) of a letter: its place counted from ا = ۱. */
export const maskOfLetter = (letter: number) => letter + 1;

function wordQuestion(rng: Rng, level: Level, seed: number): BinaryQuestion {
  for (;;) {
    const word = toLetters(pick(rng, BINARY_WORDS));
    const letterSlips: [BinaryTag, number[]][] = [];
    for (const tag of LETTER_SLIP_TAGS) {
      const read = word.map((l) => slipLetter[tag]!(maskOfLetter(l)));
      if (read.every((x): x is number => x !== null) && read.some((x, i) => x !== word[i])) letterSlips.push([tag, read]);
    }
    // Every slip reads a different whole word, so feedback can tell them apart.
    const keys = letterSlips.map(([, w]) => w.join("."));
    if (new Set(keys).size === keys.length)
      return {
        ...base(level, seed, "word"),
        n: 0,
        word,
        answer: -1,
        slips: [],
        letterSlips,
      };
  }
}

function nextQuestion(rng: Rng, level: Level, seed: number): BinaryQuestion {
  // Odd, so adding one carries: at least one card turns off.
  // Counting from the wrong end must give a third row, so both slips can be named.
  const rtlNext = (m: number) => (reverseBits(m) + 1 <= MAX ? reverseBits(reverseBits(m) + 1) : -1);
  const noCarry = (m: number) => m | ((m + 1) & -(m + 1));
  const n = rowNumber(rng, 3, MAX - 1, (m) => m % 2 === 1 && rtlNext(m) >= 0 && rtlNext(m) !== m + 1 && rtlNext(m) !== noCarry(m));
  const answer = n + 1;
  return {
    ...base(level, seed, "next"),
    n,
    answer,
    slips: dedupe(answer, [
      ["noCarry", noCarry(n)],
      ["rtl", rtlNext(n)],
    ]),
  };
}

function largestQuestion(rng: Rng, level: Level, seed: number): BinaryQuestion {
  const k = 3 + randInt(rng, 5); // 3 … 7 lamps
  const answer = 2 ** k - 1;
  return {
    ...base(level, seed, "largest"),
    cards: k,
    n: k,
    answer,
    slips: dedupe(answer, [
      ["pow2", 2 ** k],
      ["biggest", 2 ** (k - 1)],
      ["positions", (k * (k + 1)) / 2],
      ["pow10", 10 ** k - 1],
      ["count", k],
    ]),
  };
}

export function makeBinaryQuestion(level: Level, seed: number): BinaryQuestion {
  const rng = mulberry32(seed * 7 + level * 101 + 4 * 13 + 1);
  if (level === 1) return readQuestion(rng, level, seed);
  const r = rng();
  if (level === 2) return r < 0.6 ? showQuestion(rng, level, seed) : howManyQuestion(rng, level, seed);
  return r < 0.4 ? wordQuestion(rng, level, seed) : r < 0.7 ? nextQuestion(rng, level, seed) : largestQuestion(rng, level, seed);
}

/** Which slip a number or mask answer is, if any. */
export function binaryMistake(q: BinaryQuestion, value: number): BinaryTag {
  if (value === q.answer) return "right";
  const hit = q.slips.find(([, v]) => v === value);
  if (hit) return hit[0];
  // Show a number: face-up cards whose positions (not values) add up to it.
  if (q.kind === "show" && positionSum(value) === q.n) return "positions";
  return "other";
}

/** Which letters of a word answer are right. */
export const letterMarks = (q: BinaryQuestion, value: readonly (number | null)[]) => q.word.map((l, i) => value[i] === l);

/**
 * Which slip a word answer is: every letter is right or what that slip reads,
 * and at least one is the slip's (the first slip that fits wins).
 */
export function wordMistake(q: BinaryQuestion, value: readonly (number | null)[]): BinaryTag {
  if (value.length === q.word.length && value.every((v, i) => v === q.word[i])) return "right";
  for (const [tag, read] of q.letterSlips) {
    if (value.length !== q.word.length) break;
    let slip = false;
    let ok = true;
    for (let i = 0; i < value.length && ok; i++) {
      if (value[i] === q.word[i]) continue;
      if (value[i] === read[i]) slip = true;
      else ok = false;
    }
    if (ok && slip) return tag;
  }
  return "other";
}

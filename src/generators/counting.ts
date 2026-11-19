// Tool 17: arrangements and counting. Seven kinds of question: the tree of
// possibilities (multiply, or add when it is "this or that"), arranging in a
// row, choosing a group, handshakes, routes on a grid, the pigeonhole
// principle and simple probability. Each answer is worked out with a formula;
// `cases` lists every case by brute force (and marks which ones keep the
// condition), so the tests can check the formula against a plain count, and
// the tool can show all the cases after an answer. Each question keeps the
// usual slips, so the feedback can say which slip a wrong answer was.

import { mulberry32, pick, randInt, shuffle, type Rng } from "./random";

export type Level = 1 | 2 | 3;
export type CountingQuestionType = "tree" | "arrange" | "choose" | "handshake" | "grid" | "pigeonhole" | "probability";

export interface Frac {
  n: number;
  d: number;
}
export type Answer = number | Frac;

// ── Counting helpers ──

export const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));
/** Ordered: k of n in a row. */
export const perm = (n: number, k: number) => (k < 0 || k > n ? 0 : fact(n) / fact(n - k));
/** Unordered: a group of k from n. */
export const comb = (n: number, k: number) => (k < 0 || k > n ? 0 : perm(n, k) / fact(k));
/** Routes on a grid a squares wide and b high, going only right and up. */
export const routes = (a: number, b: number) => (a < 0 || b < 0 ? 0 : comb(a + b, a));

/** Names with different first letters, so a case can be written with initials. */
export const PEOPLE = ["سارا", "علی", "مینا", "رضا", "نیما", "یاسمن", "پویا"];
export const FRUITS = ["سیب", "موز", "انار", "هلو", "گیلاس", "توت", "کیوی"];
/** Colours also have their own letter and pattern in the pictures. */
export const COLOURS = ["قرمز", "آبی", "سبز", "زرد", "مشکی"];

interface Base {
  level: Level;
  seed: number;
}

/**
 * product: one of each group (shirt × trousers × …).
 * either: one from group A or one from group B (buses or trains): add.
 * roads: city A → B → C, or straight A → C: ab × bc + ac.
 * forbid: like product, but option forbid[0] of group 0 never goes with option forbid[1] of group 1.
 */
export interface TreeQuestion extends Base {
  type: "tree";
  variant: "product" | "either" | "roads" | "forbid";
  ctx: "outfit" | "menu" | "trip";
  /** Options in each group (roads: [ab, bc, ac]). */
  sizes: number[];
  forbid: [number, number] | null;
  answer: number;
}

export type ArrangeCond = "none" | "notAdjacent" | "together" | "atEnd" | "noLeadingZero" | "even";

/** k of n things in a row. The condition is about items[0] (and items[1]). */
export interface ArrangeQuestion extends Base {
  type: "arrange";
  ctx: "people" | "digits";
  n: number;
  k: number;
  /** Indices into PEOPLE, or the digits themselves. */
  items: number[];
  cond: ArrangeCond;
  answer: number;
}

export type ChooseCond = "none" | "must" | "notBoth";

/** A group of k from n (order does not matter). must: items[0] is in it; notBoth: not items[0] and items[1] together. */
export interface ChooseQuestion extends Base {
  type: "choose";
  ctx: "fruit" | "team";
  n: number;
  k: number;
  /** Indices into FRUITS or PEOPLE. */
  items: number[];
  cond: ChooseCond;
  answer: number;
}

/**
 * plain: n people, everyone shakes hands once with everyone else (or n teams each play each other once).
 * twins: n / 2 pairs of twins; nobody shakes hands with their own twin.
 * inverse: there were `shakes` handshakes; how many people?
 */
export interface HandshakeQuestion extends Base {
  type: "handshake";
  variant: "plain" | "twins" | "inverse";
  ctx: "people" | "teams";
  /** People (for inverse, the answer). */
  n: number;
  shakes: number;
  answer: number;
}

export type GridCond = "none" | "block" | "through";

/** From the bottom-left corner to the top-right, only right or up. block: never through `at`; through: always through `at`. */
export interface GridQuestion extends Base {
  type: "grid";
  a: number;
  b: number;
  cond: GridCond;
  /** A node [x, y], 0 ≤ x ≤ a, 0 ≤ y ≤ b. */
  at: [number, number] | null;
  answer: number;
}

/**
 * Draw with eyes closed; how many to be sure of …
 * same: k of the same colour. one: at least one of colour `target`.
 * all: one of every colour. different: two of different colours.
 */
export interface PigeonholeQuestion extends Base {
  type: "pigeonhole";
  variant: "same" | "one" | "all" | "different";
  ctx: "socks" | "beads";
  /** Indices into COLOURS. */
  colours: number[];
  counts: number[];
  k: number;
  /** Position in `colours` (for "one"). */
  target: number;
  answer: number;
}

export type ProbVariant = "die" | "bag" | "coins2" | "coins3" | "coinDie" | "dice2";
export type ProbEvent =
  | { kind: "even" | "odd" | "mult3" }
  | { kind: "more"; t: number }
  | { kind: "colour"; c: number }
  | { kind: "twoHeads" | "mixed" | "atLeastOne" | "exactly1" | "exactly2" | "allSame" }
  | { kind: "headsEven" }
  | { kind: "headsMore"; t: number }
  | { kind: "sum"; t: number }
  | { kind: "doubles" }
  | { kind: "sumAtLeast"; t: number };

/** Equally likely cases; the answer is favourable over all, as a fraction (not simplified). */
export interface ProbabilityQuestion extends Base {
  type: "probability";
  variant: ProbVariant;
  event: ProbEvent;
  /** Bag: indices into COLOURS and how many balls of each. */
  colours: number[];
  counts: number[];
  answer: Frac;
}

export type CountingQuestion = TreeQuestion | ArrangeQuestion | ChooseQuestion | HandshakeQuestion | GridQuestion | PigeonholeQuestion | ProbabilityQuestion;

/** What kind of answer a question wants. */
export const answerKind = (type: CountingQuestionType): "number" | "fraction" => (type === "probability" ? "fraction" : "number");

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const prod = (xs: number[]) => xs.reduce((s, x) => s * x, 1);

// ── Formulas ──

function treeAnswer(variant: TreeQuestion["variant"], sizes: number[]) {
  if (variant === "either") return sizes[0] + sizes[1];
  if (variant === "roads") return sizes[0] * sizes[1] + sizes[2];
  if (variant === "forbid") return prod(sizes) - prod(sizes.slice(2));
  return prod(sizes);
}

function arrangeAnswer(n: number, k: number, cond: ArrangeCond, items: number[]) {
  switch (cond) {
    case "none":
      return perm(n, k);
    // The two glued together make one block (2 ways inside), with n − 2 others: (n − 1)! × 2.
    case "together":
      return 2 * fact(n - 1);
    case "notAdjacent":
      return fact(n) - 2 * fact(n - 1);
    // Two end places for items[0], the rest in any order.
    case "atEnd":
      return 2 * fact(n - 1);
    // The first place can't be 0.
    case "noLeadingZero":
      return (n - 1) * perm(n - 1, k - 1);
    // The last place must be even.
    case "even":
      return items.filter((d) => d % 2 === 0).length * perm(n - 1, k - 1);
  }
}

function chooseAnswer(n: number, k: number, cond: ChooseCond) {
  if (cond === "must") return comb(n - 1, k - 1);
  if (cond === "notBoth") return comb(n, k) - comb(n - 2, k - 2);
  return comb(n, k);
}

function gridAnswer(a: number, b: number, cond: GridCond, at: [number, number] | null) {
  if (cond === "none" || !at) return routes(a, b);
  const via = routes(at[0], at[1]) * routes(a - at[0], b - at[1]);
  return cond === "through" ? via : routes(a, b) - via;
}

/**
 * Routes to each node, as the tool fills them in: a node gets the sum of the
 * node to its left and the node below it. A blocked node, or (for "through")
 * a node that can't be on a route through `at`, gets 0. values[y][x].
 */
export function gridValues(q: Pick<GridQuestion, "a" | "b" | "cond" | "at">): number[][] {
  const v = Array.from({ length: q.b + 1 }, () => Array<number>(q.a + 1).fill(0));
  for (let y = 0; y <= q.b; y++)
    for (let x = 0; x <= q.a; x++) {
      if (!gridOpen(q, x, y)) continue;
      v[y][x] = x === 0 && y === 0 ? 1 : (x > 0 ? v[y][x - 1] : 0) + (y > 0 ? v[y - 1][x] : 0);
    }
  return v;
}

/** Whether a route may use node (x, y). */
export function gridOpen(q: Pick<GridQuestion, "cond" | "at">, x: number, y: number) {
  if (!q.at || q.cond === "none") return true;
  const [ax, ay] = q.at;
  if (q.cond === "block") return !(x === ax && y === ay);
  return (x <= ax && y <= ay) || (x >= ax && y >= ay);
}

/** How many of each colour the unluckiest draw takes before it must succeed. */
export function worstCase(q: Pick<PigeonholeQuestion, "variant" | "counts" | "k" | "target">): number[] {
  const { counts } = q;
  switch (q.variant) {
    case "same":
      return counts.map((c) => Math.min(c, q.k - 1));
    case "one":
      return counts.map((c, i) => (i === q.target ? 0 : c));
    case "all": {
      // Everything except the smallest colour.
      const least = counts.indexOf(Math.min(...counts));
      return counts.map((c, i) => (i === least ? 0 : c));
    }
    case "different": {
      const most = counts.indexOf(Math.max(...counts));
      return counts.map((c, i) => (i === most ? c : 0));
    }
  }
}

function pigeonAnswer(variant: PigeonholeQuestion["variant"], counts: number[], k: number, target: number) {
  switch (variant) {
    case "same":
      return sum(counts.map((c) => Math.min(c, k - 1))) + 1;
    case "one":
      return sum(counts) - counts[target] + 1;
    case "all":
      return sum(counts) - Math.min(...counts) + 1;
    case "different":
      return Math.max(...counts) + 1;
  }
}

/** Ways two dice make the sum s. */
const sumWays = (s: number) => Math.max(0, 6 - Math.abs(s - 7));

export const probTotal = (variant: ProbVariant, counts: number[]) =>
  variant === "die" ? 6 : variant === "bag" ? sum(counts) : variant === "coins2" ? 4 : variant === "coins3" ? 8 : variant === "coinDie" ? 12 : 36;

function probFavourable(variant: ProbVariant, e: ProbEvent, counts: number[]): number {
  switch (e.kind) {
    case "even":
    case "odd":
      return 3;
    case "mult3":
      return 2;
    case "more":
      return 6 - e.t;
    case "colour":
      return counts[e.c];
    case "twoHeads":
      return 1;
    case "mixed":
      return 2;
    case "atLeastOne":
      return variant === "coins2" ? 3 : 7;
    case "exactly1":
    case "exactly2":
      return comb(3, e.kind === "exactly1" ? 1 : 2);
    case "allSame":
      return 2;
    case "headsEven":
      return 3;
    case "headsMore":
      return 6 - e.t;
    case "sum":
      return sumWays(e.t);
    case "doubles":
      return 6;
    case "sumAtLeast": {
      let n = 0;
      for (let s = e.t; s <= 12; s++) n += sumWays(s);
      return n;
    }
  }
}

// ── Making questions ──

function treeQuestion(rng: Rng, level: Level, seed: number): TreeQuestion {
  const ctx = (): "outfit" | "menu" => (rng() < 0.5 ? "outfit" : "menu");
  if (level === 1) {
    if (rng() < 0.3) {
      // a + b differs from a × b (2 and 2 would not tell them apart).
      const sizes = pick(rng, [[2, 3], [3, 2], [2, 4], [4, 2], [3, 3]]);
      return { type: "tree", level, seed, variant: "either", ctx: "trip", sizes, forbid: null, answer: treeAnswer("either", sizes) };
    }
    const sizes = pick(rng, [[2, 2], [2, 3], [3, 2]]);
    return { type: "tree", level, seed, variant: "product", ctx: ctx(), sizes, forbid: null, answer: treeAnswer("product", sizes) };
  }
  if (level === 2) {
    for (;;) {
      const groups = rng() < 0.5 ? 2 : 3;
      const sizes = Array.from({ length: groups }, () => 2 + randInt(rng, 3));
      const total = prod(sizes);
      if (total <= 6 || total > 24) continue;
      return { type: "tree", level, seed, variant: "product", ctx: ctx(), sizes, forbid: null, answer: total };
    }
  }
  if (rng() < 0.5) {
    for (;;) {
      const sizes = [2 + randInt(rng, 3), 2 + randInt(rng, 3), 1 + randInt(rng, 3)];
      // Keep "multiply all" and "add all" away from the answer.
      if (sizes[0] * sizes[1] * sizes[2] === treeAnswer("roads", sizes) || sum(sizes) === treeAnswer("roads", sizes)) continue;
      return { type: "tree", level, seed, variant: "roads", ctx: "trip", sizes, forbid: null, answer: treeAnswer("roads", sizes) };
    }
  }
  for (;;) {
    const groups = rng() < 0.6 ? 2 : 3;
    const sizes = groups === 2 ? [3 + randInt(rng, 2), 3 + randInt(rng, 2)] : [2 + randInt(rng, 2), 2 + randInt(rng, 2), 2 + randInt(rng, 2)];
    if (prod(sizes) > 24) continue;
    const forbid: [number, number] = [randInt(rng, sizes[0]), randInt(rng, sizes[1])];
    return { type: "tree", level, seed, variant: "forbid", ctx: ctx(), sizes, forbid, answer: treeAnswer("forbid", sizes) };
  }
}

/** n different digits from 1 … 9 (and 0 first, if asked). */
function digitsFor(rng: Rng, n: number, zero: boolean, evens?: number): number[] {
  for (;;) {
    const ds = shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, zero ? n - 1 : n);
    if (evens !== undefined && ds.filter((d) => d % 2 === 0).length !== evens) continue;
    return (zero ? [0, ...ds] : ds).sort((x, y) => x - y);
  }
}

function arrangeQuestion(rng: Rng, level: Level, seed: number): ArrangeQuestion {
  const people = (n: number) => shuffle(rng, PEOPLE.map((_, i) => i)).slice(0, n);
  const make = (ctx: ArrangeQuestion["ctx"], n: number, k: number, items: number[], cond: ArrangeCond): ArrangeQuestion => ({
    type: "arrange",
    level,
    seed,
    ctx,
    n,
    k,
    items,
    cond,
    answer: arrangeAnswer(n, k, cond, items),
  });
  const digits = rng() < 0.4;
  if (level === 1) {
    if (digits) return make("digits", 3, 2 + randInt(rng, 2), digitsFor(rng, 3, false), "none");
    const [n, k] = pick(rng, [[2, 2], [3, 2], [3, 3]]);
    return make("people", n, k, people(n), "none");
  }
  if (level === 2) {
    if (digits) return make("digits", 4, 2 + randInt(rng, 2), digitsFor(rng, 4, false), "none");
    const k = 2 + randInt(rng, 3);
    return make("people", 4, k, people(4), "none");
  }
  if (digits) {
    if (rng() < 0.5) {
      const n = 3 + randInt(rng, 2);
      return make("digits", n, 2 + randInt(rng, n - 1), digitsFor(rng, n, true), "noLeadingZero");
    }
    return make("digits", 4, 2 + randInt(rng, 2), digitsFor(rng, 4, false, 1 + randInt(rng, 3)), "even");
  }
  const n = rng() < 0.3 ? 3 : 4;
  return make("people", n, n, people(n), pick(rng, ["notAdjacent", "together", "atEnd"] as const));
}

function chooseQuestion(rng: Rng, level: Level, seed: number): ChooseQuestion {
  const ctx: ChooseQuestion["ctx"] = rng() < 0.5 ? "fruit" : "team";
  const [n, k] = pick(
    rng,
    level === 1
      ? [[3, 2], [4, 2], [4, 3]]
      : level === 2
        ? [[5, 2], [5, 3], [6, 2], [6, 3], [7, 2], [6, 4]]
        : [[5, 2], [5, 3], [6, 2], [6, 3]],
  );
  const items = shuffle(rng, FRUITS.map((_, i) => i)).slice(0, n);
  const cond: ChooseCond = level === 3 ? pick(rng, ["must", "notBoth"] as const) : "none";
  return { type: "choose", level, seed, ctx, n, k, items, cond, answer: chooseAnswer(n, k, cond) };
}

function handshakeQuestion(rng: Rng, level: Level, seed: number): HandshakeQuestion {
  const ctx: HandshakeQuestion["ctx"] = rng() < 0.6 ? "people" : "teams";
  if (level < 3) {
    const n = level === 1 ? 3 + randInt(rng, 2) : 5 + randInt(rng, 3);
    return { type: "handshake", level, seed, variant: "plain", ctx, n, shakes: comb(n, 2), answer: comb(n, 2) };
  }
  if (rng() < 0.5) {
    const n = 2 * (3 + randInt(rng, 2));
    const answer = comb(n, 2) - n / 2;
    return { type: "handshake", level, seed, variant: "twins", ctx: "people", n, shakes: answer, answer };
  }
  const n = 5 + randInt(rng, 4);
  return { type: "handshake", level, seed, variant: "inverse", ctx, n, shakes: comb(n, 2), answer: n };
}

function gridQuestion(rng: Rng, level: Level, seed: number): GridQuestion {
  const [a, b] = pick(rng, level === 1 ? [[1, 2], [2, 1], [2, 2], [1, 3], [3, 1]] : [[2, 3], [3, 2], [3, 3]]);
  if (level < 3) return { type: "grid", level, seed, a, b, cond: "none", at: null, answer: routes(a, b) };
  for (;;) {
    const cond: GridCond = rng() < 0.5 ? "block" : "through";
    const at: [number, number] = [randInt(rng, a + 1), randInt(rng, b + 1)];
    if ((at[0] === 0 && at[1] === 0) || (at[0] === a && at[1] === b)) continue;
    const answer = gridAnswer(a, b, cond, at);
    // The condition must matter, and leave more than one route.
    if (answer < 2 || answer === routes(a, b)) continue;
    return { type: "grid", level, seed, a, b, cond, at, answer };
  }
}

function pigeonholeQuestion(rng: Rng, level: Level, seed: number): PigeonholeQuestion {
  const ctx: PigeonholeQuestion["ctx"] = rng() < 0.5 ? "socks" : "beads";
  const colours = (c: number) => shuffle(rng, COLOURS.map((_, i) => i)).slice(0, c);
  const make = (variant: PigeonholeQuestion["variant"], cs: number[], counts: number[], k: number, target = 0): PigeonholeQuestion => ({
    type: "pigeonhole",
    level,
    seed,
    variant,
    ctx,
    colours: cs,
    counts,
    k,
    target,
    answer: pigeonAnswer(variant, counts, k, target),
  });
  if (level === 1) {
    const c = 2 + randInt(rng, 4);
    return make("same", colours(c), Array.from({ length: c }, () => 3 + randInt(rng, 4)), 2);
  }
  if (level === 2) {
    const c = 2 + randInt(rng, 3);
    const k = 3 + randInt(rng, 2);
    return make("same", colours(c), Array.from({ length: c }, () => k + randInt(rng, 4)), k);
  }
  const variant = pick(rng, ["same", "one", "all", "different"] as const);
  if (variant === "same") {
    // One colour has too few to help; another has plenty.
    for (;;) {
      const k = 3 + randInt(rng, 2);
      const counts = Array.from({ length: 3 }, () => 1 + randInt(rng, k + 3));
      if (!counts.some((c) => c < k - 1) || !counts.some((c) => c >= k)) continue;
      return make("same", colours(3), counts, k);
    }
  }
  const c = variant === "all" ? 3 : 2 + randInt(rng, 2);
  for (;;) {
    const counts = Array.from({ length: c }, () => 2 + randInt(rng, 5));
    // A single largest (or smallest) colour, so the worst case is plain.
    if (variant === "different" && counts.filter((x) => x === Math.max(...counts)).length > 1) continue;
    if (variant === "all" && counts.filter((x) => x === Math.min(...counts)).length > 1) continue;
    return make(variant, colours(c), counts, 0, randInt(rng, c));
  }
}

function probabilityQuestion(rng: Rng, level: Level, seed: number): ProbabilityQuestion {
  const make = (variant: ProbVariant, event: ProbEvent, colours: number[] = [], counts: number[] = []): ProbabilityQuestion => ({
    type: "probability",
    level,
    seed,
    variant,
    event,
    colours,
    counts,
    answer: { n: probFavourable(variant, event, counts), d: probTotal(variant, counts) },
  });
  if (level === 1) {
    if (rng() < 0.5) {
      const e: ProbEvent = pick(rng, [{ kind: "even" }, { kind: "odd" }, { kind: "mult3" }, { kind: "more", t: 2 + randInt(rng, 3) }] as ProbEvent[]);
      return make("die", e);
    }
    for (;;) {
      const c = 2 + randInt(rng, 2);
      const counts = Array.from({ length: c }, () => 1 + randInt(rng, 3));
      if (sum(counts) > 6) continue;
      const target = randInt(rng, c);
      // Half the bag would read the same as "the other colour" in a two-colour bag; keep it.
      return make("bag", { kind: "colour", c: target }, shuffle(rng, COLOURS.map((_, i) => i)).slice(0, c), counts);
    }
  }
  if (level === 2) {
    const variant = pick(rng, ["coins2", "coins3", "coinDie"] as const);
    if (variant === "coins2") return make(variant, pick(rng, [{ kind: "twoHeads" }, { kind: "mixed" }, { kind: "atLeastOne" }] as ProbEvent[]));
    if (variant === "coins3") return make(variant, pick(rng, [{ kind: "exactly1" }, { kind: "exactly2" }, { kind: "atLeastOne" }, { kind: "allSame" }] as ProbEvent[]));
    return make(variant, rng() < 0.5 ? { kind: "headsEven" } : { kind: "headsMore", t: 2 + randInt(rng, 3) });
  }
  const r = rng();
  if (r < 0.6) return make("dice2", { kind: "sum", t: 4 + randInt(rng, 7) });
  if (r < 0.75) return make("dice2", { kind: "doubles" });
  return make("dice2", { kind: "sumAtLeast", t: 9 + randInt(rng, 3) });
}

export function makeCountingQuestion(type: CountingQuestionType, level: Level, seed: number): CountingQuestion {
  const rng = mulberry32(seed * 17 + level * 389 + type.length * 31);
  switch (type) {
    case "tree":
      return treeQuestion(rng, level, seed);
    case "arrange":
      return arrangeQuestion(rng, level, seed);
    case "choose":
      return chooseQuestion(rng, level, seed);
    case "handshake":
      return handshakeQuestion(rng, level, seed);
    case "grid":
      return gridQuestion(rng, level, seed);
    case "pigeonhole":
      return pigeonholeQuestion(rng, level, seed);
    case "probability":
      return probabilityQuestion(rng, level, seed);
  }
}

// ── Every case, by brute force ──

/** One case: a list of picks (what they mean depends on the question), and whether it keeps the condition. */
export interface Case {
  pick: number[];
  ok: boolean;
}

/** Dictionary order of two lists of the same length. */
const lex = (x: number[], y: number[]) => {
  const i = x.findIndex((v, j) => v !== y[j]);
  return i < 0 ? 0 : x[i] - y[i];
};

/** Every tuple with entries 0 … sizes[i] − 1, in order. */
function tuples(sizes: number[]): number[][] {
  let out: number[][] = [[]];
  for (const s of sizes) out = out.flatMap((t) => Array.from({ length: s }, (_, i) => [...t, i]));
  return out;
}

/** Every route of a right moves (0) and b up moves (1), as lists of moves. */
export function allRoutes(a: number, b: number): number[][] {
  return tuples(Array(a + b).fill(2)).filter((t) => t.filter((m) => m === 0).length === a);
}

/** The nodes a route visits, from [0, 0]. */
export function routeNodes(route: number[]): [number, number][] {
  const out: [number, number][] = [[0, 0]];
  let [x, y] = [0, 0];
  for (const m of route) {
    if (m === 0) x++;
    else y++;
    out.push([x, y]);
  }
  return out;
}

/** Ball i of a bag: which colour (position in `counts`). */
export const ballColour = (counts: number[], i: number) => {
  let r = i;
  for (let c = 0; c < counts.length; c++) {
    if (r < counts[c]) return c;
    r -= counts[c];
  }
  return counts.length - 1;
};

function probOk(q: ProbabilityQuestion, p: number[]): boolean {
  const e = q.event;
  // Coins: 0 is heads; die faces are 0 … 5 for 1 … 6.
  const heads = p.filter((x) => x === 0).length;
  switch (e.kind) {
    case "even":
      return (p[0] + 1) % 2 === 0;
    case "odd":
      return (p[0] + 1) % 2 === 1;
    case "mult3":
      return (p[0] + 1) % 3 === 0;
    case "more":
      return p[0] + 1 > e.t;
    case "colour":
      return ballColour(q.counts, p[0]) === e.c;
    case "twoHeads":
      return heads === 2;
    case "mixed":
      return heads === 1;
    case "atLeastOne":
      return heads >= 1;
    case "exactly1":
      return heads === 1;
    case "exactly2":
      return heads === 2;
    case "allSame":
      return heads === 0 || heads === p.length;
    case "headsEven":
      return p[0] === 0 && (p[1] + 1) % 2 === 0;
    case "headsMore":
      return p[0] === 0 && p[1] + 1 > e.t;
    case "sum":
      return p[0] + p[1] + 2 === e.t;
    case "doubles":
      return p[0] === p[1];
    case "sumAtLeast":
      return p[0] + p[1] + 2 >= e.t;
  }
}

/** Every case, with `ok` false for the ones the condition (or the event) leaves out. Pigeonhole has none. */
export function cases(q: CountingQuestion): Case[] {
  switch (q.type) {
    case "tree":
      if (q.variant === "either") return tuples([2]).flatMap(([g]) => tuples([q.sizes[g]]).map(([i]) => ({ pick: [g, i], ok: true })));
      if (q.variant === "roads")
        return [...tuples([q.sizes[0], q.sizes[1]]).map((t) => ({ pick: [0, ...t], ok: true })), ...tuples([q.sizes[2]]).map((t) => ({ pick: [1, ...t], ok: true }))];
      return tuples(q.sizes).map((t) => ({ pick: t, ok: !(q.forbid && t[0] === q.forbid[0] && t[1] === q.forbid[1]) }));
    case "arrange":
      return tuples(Array(q.k).fill(q.n))
        .filter((t) => new Set(t).size === t.length)
        .map((t) => {
          const p0 = t.indexOf(0);
          const p1 = t.indexOf(1);
          const ok =
            q.cond === "none"
              ? true
              : q.cond === "together"
                ? Math.abs(p0 - p1) === 1
                : q.cond === "notAdjacent"
                  ? Math.abs(p0 - p1) !== 1
                  : q.cond === "atEnd"
                    ? p0 === 0 || p0 === q.k - 1
                    : q.cond === "noLeadingZero"
                      ? q.items[t[0]] !== 0
                      : q.items[t[q.k - 1]] % 2 === 0;
          return { pick: t, ok };
        });
    case "choose": {
      const out: Case[] = [];
      for (let mask = 0; mask < 1 << q.n; mask++) {
        const t = Array.from({ length: q.n }, (_, i) => i).filter((i) => mask & (1 << i));
        if (t.length !== q.k) continue;
        const ok = q.cond === "must" ? t.includes(0) : q.cond === "notBoth" ? !(t.includes(0) && t.includes(1)) : true;
        out.push({ pick: t, ok });
      }
      // In dictionary order, as a child would list them.
      return out.sort((x, y) => lex(x.pick, y.pick));
    }
    case "handshake": {
      const n = q.variant === "inverse" ? q.answer : q.n;
      const out: Case[] = [];
      // Twins are people 2i and 2i + 1.
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) out.push({ pick: [i, j], ok: !(q.variant === "twins" && i >> 1 === j >> 1) });
      return out;
    }
    case "grid":
      return allRoutes(q.a, q.b).map((r) => {
        if (q.cond === "none" || !q.at) return { pick: r, ok: true };
        const hits = routeNodes(r).some(([x, y]) => x === q.at![0] && y === q.at![1]);
        return { pick: r, ok: q.cond === "through" ? hits : !hits };
      });
    case "pigeonhole":
      return [];
    case "probability": {
      const sizes = q.variant === "die" ? [6] : q.variant === "bag" ? [sum(q.counts)] : q.variant === "coins2" ? [2, 2] : q.variant === "coins3" ? [2, 2, 2] : q.variant === "coinDie" ? [2, 6] : [6, 6];
      return tuples(sizes).map((t) => ({ pick: t, ok: probOk(q, t) }));
    }
  }
}

/** Pigeonhole by brute force: the least m for which every possible draw of m succeeds. */
export function pigeonBrute(q: PigeonholeQuestion): number {
  const total = sum(q.counts);
  const draws = tuples(q.counts.map((c) => c + 1));
  const good = (x: number[]) =>
    q.variant === "same" ? x.some((v) => v >= q.k) : q.variant === "one" ? x[q.target] >= 1 : q.variant === "all" ? x.every((v) => v >= 1) : x.filter((v) => v >= 1).length >= 2;
  for (let m = 1; m <= total; m++) if (draws.filter((x) => sum(x) === m).every(good)) return m;
  return Infinity;
}

// ── Slips ──

export type CountingTag =
  | "right"
  | "unordered"
  | "ordered"
  | "added"
  | "multiplied"
  | "repeated"
  | "forgotCondition"
  | "complement"
  | "doubleCounted"
  | "square"
  | "perPerson"
  | "addedParts"
  | "offByOne"
  | "lucky"
  | "tooMany"
  | "forgotLimit"
  | "odds"
  | "other";

/** Unordered cases for coins and dice: the same faces in a different order count once. */
function unorderedFrac(q: ProbabilityQuestion): Frac | null {
  if (q.variant !== "coins2" && q.variant !== "coins3" && q.variant !== "dice2") return null;
  const seen = new Map<string, boolean>();
  for (const c of cases(q)) seen.set([...c.pick].sort().join(","), c.ok);
  return { n: [...seen.values()].filter(Boolean).length, d: seen.size };
}

/** Wrong answers with a known cause, in the order they are checked. */
export function slips(q: CountingQuestion): [CountingTag, Answer][] {
  switch (q.type) {
    case "tree": {
      const s = q.sizes;
      if (q.variant === "either") return [["multiplied", s[0] * s[1]]];
      if (q.variant === "roads")
        return [
          ["multiplied", s[0] * s[1] * s[2]],
          ["added", sum(s)],
          ["forgotCondition", s[0] * s[1]],
        ];
      const out: [CountingTag, Answer][] = [["added", sum(s)]];
      if (q.variant === "forbid") out.unshift(["forgotCondition", prod(s)], ["complement", prod(s.slice(2))]);
      return out;
    }
    case "arrange": {
      const base = perm(q.n, q.k);
      const out: [CountingTag, Answer][] = [];
      if (q.cond !== "none") out.push(["forgotCondition", base], ["complement", base - q.answer]);
      if (q.cond === "none") out.push(["unordered", comb(q.n, q.k)]);
      out.push(
        ["added", sum(Array.from({ length: q.k }, (_, i) => q.n - i))],
        ["repeated", q.n ** q.k],
      );
      return out;
    }
    case "choose": {
      const out: [CountingTag, Answer][] = [];
      if (q.cond !== "none") out.push(["forgotCondition", comb(q.n, q.k)], ["complement", comb(q.n, q.k) - q.answer]);
      out.push(["ordered", q.answer * fact(q.k)]);
      return out;
    }
    case "handshake": {
      if (q.variant === "inverse")
        return [
          ["offByOne", q.n - 1],
          ["offByOne", q.n + 1],
        ];
      const out: [CountingTag, Answer][] = [["doubleCounted", 2 * q.answer]];
      if (q.variant === "twins") out.unshift(["forgotCondition", comb(q.n, 2)]);
      out.push(["square", q.n * q.n], ["perPerson", q.n - 1]);
      return out;
    }
    case "grid": {
      const out: [CountingTag, Answer][] = [];
      if (q.cond !== "none" && q.at) {
        const total = routes(q.a, q.b);
        const r1 = routes(q.at[0], q.at[1]);
        const r2 = routes(q.a - q.at[0], q.b - q.at[1]);
        out.push(["forgotCondition", total], ["complement", total - q.answer], ["addedParts", q.cond === "through" ? r1 + r2 : total - r1 - r2]);
      }
      out.push(["multiplied", q.a * q.b], ["added", q.a + q.b]);
      return out;
    }
    case "pigeonhole": {
      const c = q.counts.length;
      const out: [CountingTag, Answer][] = [["offByOne", q.answer - 1]];
      if (q.variant === "same") {
        out.push(["forgotLimit", c * (q.k - 1) + 1], ["lucky", q.k], ["tooMany", c * q.k]);
      } else out.push(["lucky", q.variant === "one" ? 1 : q.variant === "all" ? c : 2]);
      return out;
    }
    case "probability": {
      const { n, d } = q.answer;
      const out: [CountingTag, Answer][] = [
        ["complement", { n: d - n, d }],
        ["odds", { n, d: d - n }],
      ];
      const u = unorderedFrac(q);
      if (u) out.push(["unordered", u]);
      return out;
    }
  }
}

/** Two answers are the same: equal numbers, or equal fractions (2/4 = 1/2). */
export function sameAnswer(a: Answer, b: Answer): boolean {
  if (typeof a === "number" || typeof b === "number") return typeof a === "number" && typeof b === "number" && a === b;
  return a.d > 0 && b.d > 0 && a.n * b.d === b.n * a.d;
}

/** Which slip an answer is, if any. */
export function countingMistake(q: CountingQuestion, value: Answer): CountingTag {
  if (sameAnswer(value, q.answer)) return "right";
  for (const [tag, v] of slips(q)) if (!sameAnswer(v, q.answer) && sameAnswer(value, v)) return tag;
  return "other";
}

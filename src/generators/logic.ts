// Tool 19: reasoning board. Three kinds of question:
//  grid  — a logic grid (who has which): a hidden one-to-one assignment of
//          people to items and clues built from templates. Clues are added
//          until the step solver (the one "show me" plays) finishes the grid,
//          then any clue it can do without is pruned.
//  liars — truth-tellers (always true) and liars (always false). Every truth
//          assignment is tried; only puzzles with exactly one that fits are kept.
//  venn  — syllogisms with "all", "some" and "no". A model says which regions
//          of the Venn diagram have members; a conclusion is valid when it is
//          true in every model where the premises are, and every named group
//          has at least one member.
// The solver only uses rules a child can apply: a clue's own ✗ and ✓, a ✓
// crosses out its row and column, and the last open cell of a row or column
// is the ✓. So "solved" means a child can solve it, and since every rule is
// sound, solved also means the answer is the only one.

import { mulberry32, pick, randInt, shuffle, type Rng } from "./random";

export type Level = 1 | 2 | 3;
export type LogicType = "grid" | "liars" | "venn";
export const LOGIC_TYPES: LogicType[] = ["grid", "liars", "venn"];

export const NAMES = ["سارا", "علی", "مریم", "رضا", "نیما", "زهرا", "آرش", "هستی", "پارسا", "نازنین"];

/** What each child has: a pet, the fruit they brought, the class they go to. */
export type ThemeKey = "pet" | "fruit" | "class";
export const THEMES: { key: ThemeKey; items: string[] }[] = [
  { key: "pet", items: ["گربه", "سگ", "ماهی", "طوطی"] },
  { key: "fruit", items: ["سیب", "موز", "انار", "هلو"] },
  { key: "class", items: ["شنا", "نقاشی", "فوتبال", "شطرنج"] },
];

interface Base {
  level: Level;
  seed: number;
}

// ───────────────────────── logic grid ─────────────────────────

/**
 * no:     p does not have i (owner: worded "the owner of i is not p").
 * yes:    p has i.
 * or:     i belongs to one of the two.
 * either: p has one of the two items.
 * nor:    neither of the two has i.
 */
export type Clue =
  | { kind: "no"; p: number; i: number; owner: boolean }
  | { kind: "yes"; p: number; i: number }
  | { kind: "or"; ps: [number, number]; i: number }
  | { kind: "either"; p: number; is: [number, number] }
  | { kind: "nor"; ps: [number, number]; i: number };

export interface GridQuestion extends Base {
  type: "grid";
  size: number;
  theme: number;
  people: string[];
  clues: Clue[];
  /** answer[p]: the item of person p. */
  answer: number[];
}

export interface GridOptions {
  /** 3 × 3 or 4 × 4; by default 3 at level 1 and 4 after. */
  size?: 3 | 4;
  /** One or two clues more than needed: easier. */
  extra?: boolean;
}

/** A cell's mark: ✓ (1), ✗ (-1) or empty (0). */
export type Mark = 1 | -1 | 0;

/** Cells are row by row: person p, item i. */
export const cellAt = (n: number, p: number, i: number) => p * n + i;

/** What a clue says on its own, cell by cell. */
export function clueMarks(n: number, c: Clue): [number, Mark][] {
  const out: [number, Mark][] = [];
  switch (c.kind) {
    case "no":
      out.push([cellAt(n, c.p, c.i), -1]);
      break;
    case "yes":
      out.push([cellAt(n, c.p, c.i), 1]);
      break;
    case "or":
      for (let p = 0; p < n; p++) if (!c.ps.includes(p)) out.push([cellAt(n, p, c.i), -1]);
      break;
    case "either":
      for (let i = 0; i < n; i++) if (!c.is.includes(i)) out.push([cellAt(n, c.p, i), -1]);
      break;
    case "nor":
      out.push([cellAt(n, c.ps[0], c.i), -1], [cellAt(n, c.ps[1], c.i), -1]);
      break;
  }
  return out;
}

/** Whether an assignment (item per person) keeps a clue. */
export function clueHolds(c: Clue, a: readonly number[]): boolean {
  switch (c.kind) {
    case "no":
      return a[c.p] !== c.i;
    case "yes":
      return a[c.p] === c.i;
    case "or":
      return a[c.ps[0]] === c.i || a[c.ps[1]] === c.i;
    case "either":
      return a[c.p] === c.is[0] || a[c.p] === c.is[1];
    case "nor":
      return a[c.ps[0]] !== c.i && a[c.ps[1]] !== c.i;
  }
}

/**
 * clue:  a clue's own marks (new ✗ cells, and a ✓ for "yes").
 * cross: a ✓ crosses out the rest of its row and column.
 * row:   only one cell of the row is not ✗, so it is the ✓ (col: the same down a column).
 */
export type GridStep =
  | { kind: "clue"; clue: number; no: number[]; yes: number[] }
  | { kind: "cross"; cell: number; cells: number[] }
  | { kind: "row"; cell: number }
  | { kind: "col"; cell: number };

/** Plays the clues in order, each followed by everything it lets the grid fill. */
export function gridSteps(n: number, clues: readonly Clue[]): { steps: GridStep[]; marks: Mark[]; solved: boolean } {
  const m: Mark[] = Array(n * n).fill(0);
  const steps: GridStep[] = [];
  const propagate = () => {
    for (;;) {
      let moved = false;
      for (let c = 0; c < n * n && !moved; c++) {
        if (m[c] !== 1) continue;
        const [p, i] = [Math.floor(c / n), c % n];
        const cells: number[] = [];
        for (let k = 0; k < n; k++) {
          if (m[cellAt(n, p, k)] === 0) cells.push(cellAt(n, p, k));
          if (m[cellAt(n, k, i)] === 0) cells.push(cellAt(n, k, i));
        }
        if (cells.length) {
          cells.forEach((x) => (m[x] = -1));
          steps.push({ kind: "cross", cell: c, cells });
          moved = true;
        }
      }
      for (let p = 0; p < n && !moved; p++) {
        const open = Array.from({ length: n }, (_, i) => cellAt(n, p, i)).filter((x) => m[x] !== -1);
        if (open.length === 1 && m[open[0]] === 0) {
          m[open[0]] = 1;
          steps.push({ kind: "row", cell: open[0] });
          moved = true;
        }
      }
      for (let i = 0; i < n && !moved; i++) {
        const open = Array.from({ length: n }, (_, p) => cellAt(n, p, i)).filter((x) => m[x] !== -1);
        if (open.length === 1 && m[open[0]] === 0) {
          m[open[0]] = 1;
          steps.push({ kind: "col", cell: open[0] });
          moved = true;
        }
      }
      if (!moved) return;
    }
  };
  clues.forEach((clue, k) => {
    const fresh = clueMarks(n, clue).filter(([c]) => m[c] === 0);
    fresh.forEach(([c, v]) => (m[c] = v));
    steps.push({ kind: "clue", clue: k, no: fresh.filter(([, v]) => v === -1).map(([c]) => c), yes: fresh.filter(([, v]) => v === 1).map(([c]) => c) });
    propagate();
  });
  return { steps, marks: m, solved: m.every((v) => v !== 0) };
}

/** The grid after the first k steps. */
export function marksAfter(n: number, steps: readonly GridStep[], k: number): Mark[] {
  const m: Mark[] = Array(n * n).fill(0);
  for (const s of steps.slice(0, k)) {
    if (s.kind === "clue") {
      s.no.forEach((c) => (m[c] = -1));
      s.yes.forEach((c) => (m[c] = 1));
    } else if (s.kind === "cross") s.cells.forEach((c) => (m[c] = -1));
    else m[s.cell] = 1;
  }
  return m;
}

const isCompound = (c: Clue) => c.kind === "or" || c.kind === "either" || c.kind === "nor";

/** Every true clue of the kinds a level uses. */
function cluePool(rng: Rng, n: number, a: number[], level: Level): Clue[] {
  const owner = (i: number) => a.indexOf(i);
  const pool: Clue[] = [];
  for (let p = 0; p < n; p++)
    for (let i = 0; i < n; i++) {
      if (i === a[p]) continue;
      if (level < 3) pool.push({ kind: "no", p, i, owner: rng() < 0.35 });
      if (level > 1) pool.push({ kind: "either", p, is: shuffle(rng, [a[p], i]) as [number, number] });
    }
  if (level > 1)
    for (let i = 0; i < n; i++) {
      for (let q = 0; q < n; q++) if (q !== owner(i)) pool.push({ kind: "or", ps: shuffle(rng, [owner(i), q]) as [number, number], i });
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) if (p !== owner(i) && q !== owner(i)) pool.push({ kind: "nor", ps: shuffle(rng, [p, q]) as [number, number], i });
    }
  if (level === 1) {
    const p = randInt(rng, n);
    pool.push({ kind: "yes", p, i: a[p] });
  }
  return shuffle(rng, pool);
}

const sameClue = (x: Clue, y: Clue) => JSON.stringify(x) === JSON.stringify(y);

function gridQuestion(rng: Rng, level: Level, seed: number, opts: GridOptions): GridQuestion {
  const n = opts.size ?? defaultSize(level);
  for (;;) {
    const answer = shuffle(rng, Array.from({ length: n }, (_, i) => i));
    const pool = cluePool(rng, n, answer, level);
    // Add clues until the grid can be solved…
    const used: Clue[] = [];
    for (const c of pool) {
      used.push(c);
      if (gridSteps(n, used).solved) break;
    }
    // …then drop every clue it can do without.
    let clues = used;
    for (const c of shuffle(rng, used)) {
      const without = clues.filter((x) => x !== c);
      if (gridSteps(n, without).solved) clues = without;
    }
    const compound = clues.filter(isCompound).length;
    if (level === 1 && (clues.length < 3 || clues.length > (n === 3 ? 5 : 8))) continue;
    if (level === 2 && compound < 1) continue;
    if (level === 3 && compound < 3) continue;
    // "More clues": one or two true clues that are not needed, mixed in.
    if (opts.extra) {
      const more = pool.filter((c) => !clues.some((x) => sameClue(x, c)) && c.kind !== "yes").slice(0, 2);
      clues = shuffle(rng, [...clues, ...more]);
    }
    const theme = randInt(rng, THEMES.length);
    const people = shuffle(rng, NAMES).slice(0, n);
    return { type: "grid", level, seed, size: n, theme, people, clues, answer };
  }
}

export type GridTag = "right" | "ignoredNo" | "ignoredOr" | "ignoredYes" | "clash" | "incomplete" | "other";

export interface GridCheck {
  tag: GridTag;
  /** The first clue the grid breaks. */
  clue: number | null;
  /** Cells, rows and columns to hatch. */
  cells: number[];
  rows: number[];
  cols: number[];
}

/** Contradictions in a grid the child filled: clues it breaks, and rows or columns with two ✓ or no room left. */
export function gridCheck(q: { size: number; clues: readonly Clue[]; answer?: readonly number[] }, marks: readonly Mark[]): GridCheck {
  const n = q.size;
  const rows: number[] = [];
  const cols: number[] = [];
  const line = (cells: number[]) => {
    const yes = cells.filter((c) => marks[c] === 1).length;
    const no = cells.filter((c) => marks[c] === -1).length;
    return yes > 1 || no === n;
  };
  for (let k = 0; k < n; k++) {
    if (line(Array.from({ length: n }, (_, i) => cellAt(n, k, i)))) rows.push(k);
    if (line(Array.from({ length: n }, (_, p) => cellAt(n, p, k)))) cols.push(k);
  }
  const cells = new Set<number>();
  let first: { clue: number; tag: GridTag } | null = null;
  const broke = (clue: number, tag: GridTag, cs: number[]) => {
    cs.forEach((c) => cells.add(c));
    // A broken "no" is named first: it is the slip the feedback is about.
    if (!first || (tag === "ignoredNo" && first.tag !== "ignoredNo")) first = { clue, tag };
  };
  q.clues.forEach((c, k) => {
    if (c.kind === "yes") {
      const at = cellAt(n, c.p, c.i);
      const off: number[] = [];
      for (let x = 0; x < n; x++) {
        if (x !== c.i && marks[cellAt(n, c.p, x)] === 1) off.push(cellAt(n, c.p, x));
        if (x !== c.p && marks[cellAt(n, x, c.i)] === 1) off.push(cellAt(n, x, c.i));
      }
      if (marks[at] === -1) off.push(at);
      if (off.length) broke(k, "ignoredYes", off);
      return;
    }
    const bad = clueMarks(n, c)
      .filter(([cell]) => marks[cell] === 1)
      .map(([cell]) => cell);
    // Both owners of an "or", or both items of an "either", crossed out.
    const pair = c.kind === "or" ? c.ps.map((p) => cellAt(n, p, c.i)) : c.kind === "either" ? c.is.map((i) => cellAt(n, c.p, i)) : [];
    if (pair.length && pair.every((x) => marks[x] === -1)) bad.push(...pair);
    if (bad.length) broke(k, c.kind === "no" || c.kind === "nor" ? "ignoredNo" : "ignoredOr", bad);
  });
  const result = { cells: [...cells].sort((a, b) => a - b), rows, cols };
  const f = first as { clue: number; tag: GridTag } | null;
  if (f) return { tag: f.tag, clue: f.clue, ...result };
  if (rows.length || cols.length) return { tag: "clash", clue: null, ...result };
  const full = Array.from({ length: n }, (_, p) => Array.from({ length: n }, (_, i) => marks[cellAt(n, p, i)]).filter((v) => v === 1).length === 1).every(Boolean);
  if (!full) return { tag: "incomplete", clue: null, ...result };
  const right = !q.answer || q.answer.every((i, p) => marks[cellAt(n, p, i)] === 1);
  return { tag: right ? "right" : "other", clue: null, ...result };
}

// ───────────────────────── truth-tellers and liars ─────────────────────────

/**
 * is:    "who is a liar" (or a truth-teller).
 * both:  "a and b are both liars" (or both truth-tellers).
 * some:  "at least one of a and b is a liar" (or a truth-teller).
 * same:  "a and b are the same kind"; diff: "…different kinds".
 * count: "exactly n of us are liars".
 * Any person may be the speaker, who then says "I".
 */
export type Says =
  | { kind: "is"; who: number; liar: boolean }
  | { kind: "both"; a: number; b: number; liar: boolean }
  | { kind: "some"; a: number; b: number; liar: boolean }
  | { kind: "same"; a: number; b: number }
  | { kind: "diff"; a: number; b: number }
  | { kind: "count"; n: number };

export interface LiarsQuestion extends Base {
  type: "liars";
  people: string[];
  /** What each person says; null: says nothing. */
  says: (Says | null)[];
  /** answer[p]: true if p is a liar. */
  answer: boolean[];
}

/** Whether a statement is true when `liar` says who lies. */
export function saysTrue(s: Says, liar: readonly boolean[]): boolean {
  switch (s.kind) {
    case "is":
      return liar[s.who] === s.liar;
    case "both":
      return liar[s.a] === s.liar && liar[s.b] === s.liar;
    case "some":
      return liar[s.a] === s.liar || liar[s.b] === s.liar;
    case "same":
      return liar[s.a] === liar[s.b];
    case "diff":
      return liar[s.a] !== liar[s.b];
    case "count":
      return liar.filter(Boolean).length === s.n;
  }
}

/** People a statement is about. */
export function mentioned(s: Says, people: number): number[] {
  switch (s.kind) {
    case "is":
      return [s.who];
    case "count":
      return Array.from({ length: people }, (_, i) => i);
    default:
      return [s.a, s.b];
  }
}

/** Speakers whose statement does not fit what they are: a liar saying something true, or the other way. */
export function clashes(says: readonly (Says | null)[], liar: readonly boolean[]): number[] {
  return says.flatMap((s, k) => (s && saysTrue(s, liar) === liar[k] ? [k] : []));
}

/** Every assignment that fits all statements, as liar flags. */
export function liarSolutions(says: readonly (Says | null)[]): boolean[][] {
  const n = says.length;
  const out: boolean[][] = [];
  for (let mask = 0; mask < 1 << n; mask++) {
    const liar = Array.from({ length: n }, (_, i) => !!(mask & (1 << i)));
    if (clashes(says, liar).length === 0) out.push(liar);
  }
  return out;
}

const LIAR_KINDS: Record<Level, Says["kind"][]> = {
  1: ["is", "is", "same", "diff"],
  2: ["is", "same", "diff", "some", "both"],
  3: ["some", "both", "count", "same", "diff", "is"],
};

function randomSays(rng: Rng, level: Level, n: number, speaker: number): Says {
  for (;;) {
    const kind = pick(rng, LIAR_KINDS[level]);
    const others = Array.from({ length: n }, (_, i) => i).filter((i) => i !== speaker);
    const [a, b] = rng() < 0.5 && n > 2 ? shuffle(rng, others).slice(0, 2) : shuffle(rng, [speaker, pick(rng, others)]);
    switch (kind) {
      case "is":
        return { kind, who: pick(rng, others), liar: rng() < 0.65 };
      case "both":
      case "some":
        return { kind, a, b, liar: rng() < 0.6 };
      case "same":
      case "diff":
        return { kind, a, b };
      case "count":
        if (n < 3) continue;
        return { kind, n: 1 + randInt(rng, n - 1) };
    }
  }
}

function liarsQuestion(rng: Rng, level: Level, seed: number): LiarsQuestion {
  const n = level === 1 ? 2 : 3;
  for (;;) {
    const silent = level === 3 && rng() < 0.35 ? randInt(rng, n) : -1;
    const says = Array.from({ length: n }, (_, k) => (k === silent ? null : randomSays(rng, level, n, k)));
    const sol = liarSolutions(says);
    if (sol.length !== 1) continue;
    const answer = sol[0];
    if (!answer.some(Boolean)) continue;
    if (level > 1 && answer.every(Boolean)) continue;
    // "Show me" should not need a case inside a case inside a case.
    if (liarSteps({ says, people: [] }).filter((s) => s.kind === "assume").length > 4) continue;
    return { type: "liars", level, seed, people: shuffle(rng, NAMES).slice(0, n), says, answer };
  }
}

/**
 * Show me for liars, by cases:
 * assume: "suppose p is a truth-teller" (or a liar).
 * force:  a statement leaves only one choice for someone.
 * clash:  a statement does not fit: this case is impossible.
 * fits:   everything fits: this is the answer.
 * `liar` is what is known after the step.
 */
export type LiarStep =
  | { kind: "assume"; who: number; liar: boolean; depth: number; known: (boolean | null)[] }
  | { kind: "force"; who: number; liar: boolean; by: number; depth: number; known: (boolean | null)[] }
  | { kind: "clash"; by: number; depth: number; known: (boolean | null)[] }
  | { kind: "fits"; depth: number; known: (boolean | null)[] };

export function liarSteps(q: { says: readonly (Says | null)[]; people: readonly string[] }): LiarStep[] {
  const n = q.says.length;
  const steps: LiarStep[] = [];
  const fits = (k: number, liar: readonly boolean[]) => saysTrue(q.says[k]!, liar) !== liar[k];

  const walk = (known: (boolean | null)[], depth: number) => {
    // Use any statement where only one person is still unknown.
    for (let again = true; again; ) {
      again = false;
      for (let k = 0; k < n && !again; k++) {
        const s = q.says[k];
        if (!s) continue;
        const who = [...new Set([k, ...mentioned(s, n)])];
        const open = who.filter((p) => known[p] === null);
        if (open.length > 1) continue;
        if (open.length === 0) {
          if (!fits(k, known as boolean[])) {
            steps.push({ kind: "clash", by: k, depth, known: [...known] });
            return;
          }
          continue;
        }
        const u = open[0];
        const ok = [false, true].filter((v) => {
          const t = [...known];
          t[u] = v;
          return fits(k, t as boolean[]);
        });
        if (ok.length === 0) {
          steps.push({ kind: "clash", by: k, depth, known: [...known] });
          return;
        }
        if (ok.length === 1) {
          known[u] = ok[0];
          steps.push({ kind: "force", who: u, liar: ok[0], by: k, depth, known: [...known] });
          again = true;
        }
      }
    }
    const u = known.indexOf(null);
    if (u < 0) {
      steps.push({ kind: "fits", depth, known: [...known] });
      return;
    }
    for (const v of [false, true]) {
      const next = [...known];
      next[u] = v;
      steps.push({ kind: "assume", who: u, liar: v, depth: depth + 1, known: [...next] });
      walk(next, depth + 1);
    }
  };
  // Start from the first speaker.
  const first = q.says.findIndex((s) => s !== null);
  for (const v of [false, true]) {
    const known: (boolean | null)[] = Array(n).fill(null);
    known[first] = v;
    steps.push({ kind: "assume", who: first, liar: v, depth: 0, known: [...known] });
    walk(known, 0);
  }
  return steps;
}

export type LiarTag = "right" | "trustedLiar" | "doubtedTruth";

/** Which slip a liar answer is: believing a liar first, then doubting a truth-teller. */
export function liarsMistake(q: LiarsQuestion, liar: readonly boolean[]): { tag: LiarTag; who: number | null; clashes: number[] } {
  const bad = clashes(q.says, liar);
  const trusted = q.answer.findIndex((l, p) => l && !liar[p]);
  if (trusted >= 0) return { tag: "trustedLiar", who: trusted, clashes: bad };
  const doubted = q.answer.findIndex((l, p) => !l && liar[p]);
  if (doubted >= 0) return { tag: "doubtedTruth", who: doubted, clashes: bad };
  return { tag: "right", who: null, clashes: bad };
}

// ───────────────────────── Venn and syllogisms ─────────────────────────

/** Made-up creatures, so nothing but the sentences decides. */
export const CREATURES = ["زیبو", "گلوپ", "تیکا", "مونی", "فرفری", "پونک"];

export type Form = "all" | "some" | "no" | "someNot";
export interface Statement {
  form: Form;
  a: number;
  b: number;
}

/**
 * Regions: with k groups, region r (0 … 2^k − 1) is the part inside exactly
 * the groups whose bits are set in r. A model is the set of regions that have
 * members, as a bit mask over regions.
 */
export const regionsWhere = (k: number, f: (r: number) => boolean) => {
  let m = 0;
  for (let r = 0; r < 1 << k; r++) if (f(r)) m |= 1 << r;
  return m;
};
const inA = (r: number, t: number) => (r >> t) & 1;

/** Regions a statement says are empty ("all", "no"). */
export const emptyBy = (s: Statement, k: number) =>
  s.form === "all" ? regionsWhere(k, (r) => !!inA(r, s.a) && !inA(r, s.b)) : s.form === "no" ? regionsWhere(k, (r) => !!inA(r, s.a) && !!inA(r, s.b)) : 0;

/** Regions of which a statement says at least one has members ("some", "some … not"). */
export const needBy = (s: Statement, k: number) =>
  s.form === "some" ? regionsWhere(k, (r) => !!inA(r, s.a) && !!inA(r, s.b)) : s.form === "someNot" ? regionsWhere(k, (r) => !!inA(r, s.a) && !inA(r, s.b)) : 0;

/** Whether a statement is true in a model. */
export function holds(s: Statement, model: number, k: number): boolean {
  const e = emptyBy(s, k);
  if (e) return (model & e) === 0;
  return (model & needBy(s, k)) !== 0;
}

export const negate = (s: Statement): Statement => ({ ...s, form: s.form === "all" ? "someNot" : s.form === "someNot" ? "all" : s.form === "some" ? "no" : "some" });

/** Is there a model where every statement is true and every group has members? */
export function possible(stmts: readonly Statement[], k: number): boolean {
  let allowed = regionsWhere(k, () => true);
  for (const s of stmts) allowed &= ~emptyBy(s, k);
  // Filling every allowed region is the most generous model; if it fails, all do.
  for (let t = 0; t < k; t++) if ((allowed & regionsWhere(k, (r) => !!inA(r, t))) === 0) return false;
  return stmts.every((s) => s.form === "all" || s.form === "no" || (allowed & needBy(s, k)) !== 0);
}

/** A conclusion follows when no model makes the premises true and it false. */
export const follows = (premises: readonly Statement[], s: Statement, k: number) => !possible([...premises, negate(s)], k);

/** The model with every region the statements allow: an example the premises fit (and `against` does not). */
export function exampleModel(stmts: readonly Statement[], k: number): number {
  let allowed = regionsWhere(k, (r) => r > 0);
  for (const s of stmts) allowed &= ~emptyBy(s, k);
  return allowed;
}

export type VennTag = "right" | "converse" | "someNotAll" | "tooStrong" | "impossible" | "missedValid" | "notSure";

export interface VennQuestion extends Base {
  type: "venn";
  /** Groups, as indices into CREATURES; statements use 0 … k − 1. */
  terms: number[];
  /** In the order they are shown. */
  premises: Statement[];
  /** null: "none of these follows". */
  options: (Statement | null)[];
  answer: number;
  /** Why each option is right or wrong. */
  tags: VennTag[];
  /** Level 3: what the first two premises say about the two outer groups (the first step). */
  middle: Statement | null;
}

const FORMS: Form[] = ["all", "some", "no", "someNot"];
const sameStmt = (x: Statement, y: Statement) => x.form === y.form && x.a === y.a && x.b === y.b;

/** All statements about two groups, both ways round. */
const about = (a: number, b: number): Statement[] => FORMS.flatMap((form) => [{ form, a, b }, { form, a: b, b: a }]);

/** Why a wrong option is wrong. */
export function optionTag(premises: readonly Statement[], s: Statement | null, k: number, hasValid: boolean): VennTag {
  if (s === null) return hasValid ? "missedValid" : "right";
  if (follows(premises, s, k)) return "right";
  if (follows(premises, negate(s), k)) return "impossible";
  if (s.form === "all" && follows(premises, { form: "all", a: s.b, b: s.a }, k)) return "converse";
  if (s.form === "someNot" && follows(premises, { form: "some", a: s.a, b: s.b }, k)) return "someNotAll";
  if (s.form === "all" && follows(premises, { form: "some", a: s.a, b: s.b }, k)) return "tooStrong";
  if (s.form === "no" && follows(premises, { form: "someNot", a: s.a, b: s.b }, k)) return "tooStrong";
  return "notSure";
}

const TAG_ORDER: VennTag[] = ["converse", "someNotAll", "tooStrong", "impossible", "notSure"];

/** Three wrong options, the ones with a named slip first. */
function distractors(rng: Rng, premises: Statement[], wrong: Statement[], k: number, count: number): Statement[] {
  const tagged = shuffle(rng, wrong).map((s) => ({ s, t: TAG_ORDER.indexOf(optionTag(premises, s, k, true)) }));
  // Mostly the slips worth naming, with a little chance for the rest.
  tagged.sort((x, y) => x.t - y.t);
  const out: Statement[] = [];
  for (const { s } of tagged) {
    if (out.length === count) break;
    // Not two wordings of the same thing ("no A is B" and "no B is A").
    if (s.form === "no" || s.form === "some") if (out.some((o) => o.form === s.form)) continue;
    out.push(s);
  }
  for (const { s } of tagged) if (out.length < count && !out.includes(s)) out.push(s);
  return out;
}

function vennQuestion(rng: Rng, level: Level, seed: number): VennQuestion {
  const k = level === 1 ? 2 : level === 2 ? 3 : 4;
  for (;;) {
    const terms = shuffle(rng, CREATURES.map((_, i) => i)).slice(0, k);
    // A chain 0 – 1 – … – k−1; each premise may be either way round.
    const chain: Statement[] = [];
    for (let t = 0; t + 1 < k; t++) {
      const form = pick(rng, level === 1 ? (["all", "all", "some", "no"] as Form[]) : (["all", "all", "some", "no", "someNot"] as Form[]));
      const flip = form !== "someNot" && form !== "all" ? rng() < 0.5 : form === "all" ? rng() < 0.3 : false;
      chain.push(flip ? { form, a: t + 1, b: t } : { form, a: t, b: t + 1 });
    }
    if (!possible(chain, k)) continue;
    const [A, Z] = [0, k - 1];
    const cands = about(A, Z).filter((s) => !chain.some((p) => sameStmt(p, s)));
    const valid = cands.filter((s) => follows(chain, s, k));
    const wrong = cands.filter((s) => !follows(chain, s, k));

    let middle: Statement | null = null;
    let answerStmt: Statement | null = null;
    if (level === 3) {
      // Two steps: something about 0 and 2 from the first two premises, then 0 and 3 from that and the third.
      const mids = shuffle(rng, about(0, 2)).filter((s) => follows(chain.slice(0, 2), s, k));
      mids.sort((x, y) => Number(y.form === "all" || y.form === "no") - Number(x.form === "all" || x.form === "no"));
      for (const m of mids) {
        const ends = valid.filter((s) => follows([m, chain[2]], s, k));
        if (ends.length) {
          middle = m;
          answerStmt = pick(rng, ends);
          break;
        }
      }
      if (!answerStmt) continue;
    } else if (valid.length) answerStmt = pick(rng, valid);
    else if (level === 1 || rng() < 0.6) continue; // Keep "nothing follows" to about one level-2 question in four.

    const premises = level === 1 ? chain : shuffle(rng, chain);
    const withNone = level === 2 && (answerStmt === null || rng() < 0.3);
    const picked = distractors(rng, chain, wrong, k, withNone && answerStmt ? 2 : 3);
    if (picked.length < (withNone && answerStmt ? 2 : 3)) continue;
    const options: (Statement | null)[] = shuffle(rng, answerStmt ? [answerStmt, ...picked] : picked);
    // "None of these follows" is always the last option.
    if (withNone) options.push(null);
    const answer = answerStmt ? options.indexOf(answerStmt) : options.length - 1;
    const tags = options.map((s) => optionTag(chain, s, k, answerStmt !== null));
    if (tags.filter((t) => t === "right").length !== 1) continue;
    return { type: "venn", level, seed, terms, premises, options, answer, tags, middle };
  }
}

/** The premises in their logical order (a chain from the first group to the last). */
export const chainOf = (q: VennQuestion) => [...q.premises].sort((x, y) => Math.min(x.a, x.b) - Math.min(y.a, y.b));

/**
 * Show me for Venn: draw each premise (an empty region is hatched, a "some"
 * puts × in a region), then (level 3) read the first step off the first
 * picture, then try each option.
 */
export type VennStep =
  | { kind: "premise"; stage: 0 | 1; s: Statement }
  | { kind: "middle"; s: Statement }
  | { kind: "option"; index: number; tag: VennTag };

export function vennSteps(q: VennQuestion): VennStep[] {
  const chain = chainOf(q);
  const steps: VennStep[] = [];
  if (q.level === 3) {
    steps.push({ kind: "premise", stage: 0, s: chain[0] }, { kind: "premise", stage: 0, s: chain[1] }, { kind: "middle", s: q.middle! }, { kind: "premise", stage: 1, s: chain[2] });
  } else chain.forEach((s) => steps.push({ kind: "premise", stage: 0, s }));
  q.options.forEach((_, index) => steps.push({ kind: "option", index, tag: q.tags[index] }));
  return steps;
}

// ───────────────────────── all questions ─────────────────────────

export type LogicQuestion = GridQuestion | LiarsQuestion | VennQuestion;

/** What kind of answer a question wants. */
export const answerKind = (type: LogicType): "grid" | "people" | "choice" => (type === "grid" ? "grid" : type === "liars" ? "people" : "choice");

/** The grid size a level uses unless asked otherwise. */
export const defaultSize = (level: Level): 3 | 4 => (level === 1 ? 3 : 4);

export function makeLogicQuestion(type: LogicType, level: Level, seed: number, opts: GridOptions = {}): LogicQuestion {
  // The level's own size counts as no choice, so links and worksheets agree.
  const size = type === "grid" && opts.size && opts.size !== defaultSize(level) ? opts.size : 0;
  const extra = type === "grid" && !!opts.extra;
  const rng = mulberry32(seed * 7 + level * 101 + type.length * 13 + size * 31 + (extra ? 17 : 0));
  switch (type) {
    case "grid":
      return gridQuestion(rng, level, seed, { size: size ? (size as 3 | 4) : undefined, extra });
    case "liars":
      return liarsQuestion(rng, level, seed);
    case "venn":
      return vennQuestion(rng, level, seed);
  }
}

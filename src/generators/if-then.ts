// Tool 19, «اگر… آنگاه»: what follows from "if A, then B" sentences and one
// fact. Each sentence is an arrow A → B on a diagram. The question asks about
// one statement (the target) and the child picks "true", "not true" or
// «نمی‌توان فهمید».
//
// Level 1: one arrow; the fact is A (modus ponens: B) or B (affirming the
//          consequent: can't tell about A).
// Level 2: one arrow; the fact is "not B" (modus tollens: not A), "not A"
//          (denying the antecedent: can't tell about B) or B (the converse).
// Level 3: two or three arrows from one story (a chain, a fork or a join),
//          the fact and the target at least two arrows apart.
//
// The answer is found by trying every true/false assignment (truth table);
// "show me" uses only the two sound moves a child can make: a true statement
// travels forward along an arrow, a false one travels backward. Every wrong
// option is tagged with the slip that gives it, found by also allowing the
// two unsound moves (true backward: the converse; false forward: the inverse).

import { mulberry32, pick, shuffle, type Rng } from "./random";

export type Level = 1 | 2 | 3;

/** One statement of a story, in the forms the sentences need. */
export interface IfAtom {
  /** Label on the diagram. */
  short: string;
  /** After «اگر»: "باران ببارد". */
  cond: string;
  yes: string;
  no: string;
}

export interface IfStory {
  atoms: IfAtom[];
  /** Arrows [from, to]; the first ones form a connected diagram (explore takes a prefix). */
  edges: [number, number][];
}

const atom = (short: string, cond: string, yes: string, no: string): IfAtom => ({ short, cond, yes, no });

/**
 * Everyday stories. Every arrow is a rule the story states; its converse is
 * not (the ground can be wet from the sprinkler). In the number story the
 * rules are true arithmetic, and every "can't tell" there is really so.
 */
export const IF_STORIES: IfStory[] = [
  {
    atoms: [
      atom("باران", "باران ببارد", "باران می‌بارد", "باران نمی‌بارد"),
      atom("زمین خیس", "زمین خیس باشد", "زمین خیس است", "زمین خیس نیست"),
      atom("زمین لیز", "زمین لیز باشد", "زمین لیز است", "زمین لیز نیست"),
      atom("آب‌پاش", "آب‌پاش روشن باشد", "آب‌پاش روشن است", "آب‌پاش روشن نیست"),
    ],
    edges: [
      [0, 1],
      [1, 2],
      [3, 1],
    ],
  },
  {
    atoms: [
      atom("زنگ تفریح", "زنگ تفریح خورده باشد", "زنگ تفریح خورده", "زنگ تفریح نخورده"),
      atom("بچه‌ها در حیاط", "بچه‌ها در حیاط باشند", "بچه‌ها در حیاط هستند", "بچه‌ها در حیاط نیستند"),
      atom("حیاط شلوغ", "حیاط شلوغ باشد", "حیاط شلوغ است", "حیاط شلوغ نیست"),
      atom("ناظم در حیاط", "آقای ناظم در حیاط باشد", "آقای ناظم در حیاط است", "آقای ناظم در حیاط نیست"),
    ],
    edges: [
      [0, 1],
      [1, 2],
      [1, 3],
    ],
  },
  {
    atoms: [
      atom("هوای آفتابی", "هوا آفتابی باشد", "هوا آفتابی است", "هوا آفتابی نیست"),
      atom("رفتن به پارک", "بچه‌ها به پارک بروند", "بچه‌ها به پارک می‌روند", "بچه‌ها به پارک نمی‌روند"),
      atom("خریدن بستنی", "بچه‌ها بستنی بخرند", "بچه‌ها بستنی می‌خرند", "بچه‌ها بستنی نمی‌خرند"),
      atom("دست چسبناک", "دست بچه‌ها چسبناک شود", "دست بچه‌ها چسبناک می‌شود", "دست بچه‌ها چسبناک نمی‌شود"),
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
    ],
  },
  {
    atoms: [
      atom("تمرین هر روز", "رضا هر روز تمرین کند", "رضا هر روز تمرین می‌کند", "رضا هر روز تمرین نمی‌کند"),
      atom("برنده شدن", "رضا در مسابقه برنده شود", "رضا در مسابقه برنده می‌شود", "رضا در مسابقه برنده نمی‌شود"),
      atom("مدال", "رضا مدال بگیرد", "رضا مدال می‌گیرد", "رضا مدال نمی‌گیرد"),
      atom("عکس رضا", "عکس رضا در روزنامه دیواری باشد", "عکس رضا در روزنامه دیواری است", "عکس رضا در روزنامه دیواری نیست"),
    ],
    edges: [
      [0, 1],
      [1, 2],
      [1, 3],
    ],
  },
  {
    atoms: [
      atom("بخش‌پذیر بر ۲۰", "عدد روی کارت بر ۲۰ بخش‌پذیر باشد", "عدد روی کارت بر ۲۰ بخش‌پذیر است", "عدد روی کارت بر ۲۰ بخش‌پذیر نیست"),
      atom("بخش‌پذیر بر ۴", "عدد روی کارت بر ۴ بخش‌پذیر باشد", "عدد روی کارت بر ۴ بخش‌پذیر است", "عدد روی کارت بر ۴ بخش‌پذیر نیست"),
      atom("زوج", "عدد روی کارت زوج باشد", "عدد روی کارت زوج است", "عدد روی کارت زوج نیست"),
      atom("بخش‌پذیر بر ۵", "عدد روی کارت بر ۵ بخش‌پذیر باشد", "عدد روی کارت بر ۵ بخش‌پذیر است", "عدد روی کارت بر ۵ بخش‌پذیر نیست"),
    ],
    edges: [
      [0, 1],
      [1, 2],
      [0, 3],
    ],
  },
  {
    atoms: [
      atom("آب دادن", "سارا به گلدان آب بدهد", "سارا به گلدان آب می‌دهد", "سارا به گلدان آب نمی‌دهد"),
      atom("خاک نم‌دار", "خاک گلدان نم‌دار باشد", "خاک گلدان نم‌دار است", "خاک گلدان نم‌دار نیست"),
      atom("گل شاداب", "گل شاداب باشد", "گل شاداب است", "گل شاداب نیست"),
      atom("غنچه", "گل غنچه بدهد", "گل غنچه می‌دهد", "گل غنچه نمی‌دهد"),
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
    ],
  },
  {
    atoms: [
      atom("گربه", "حیوانِ پشت در گربه باشد", "حیوانِ پشت در گربه است", "حیوانِ پشت در گربه نیست"),
      atom("دم", "حیوانِ پشت در دم داشته باشد", "حیوانِ پشت در دم دارد", "حیوانِ پشت در دم ندارد"),
      atom("سبیل", "حیوانِ پشت در سبیل داشته باشد", "حیوانِ پشت در سبیل دارد", "حیوانِ پشت در سبیل ندارد"),
    ],
    edges: [
      [0, 1],
      [0, 2],
    ],
  },
  {
    atoms: [
      atom("باتری تمام", "باتری چراغ‌قوه تمام شده باشد", "باتری چراغ‌قوه تمام شده", "باتری چراغ‌قوه تمام نشده"),
      atom("روشن نشدن", "چراغ‌قوه روشن نشود", "چراغ‌قوه روشن نمی‌شود", "چراغ‌قوه روشن می‌شود"),
    ],
    edges: [[0, 1]],
  },
  {
    atoms: [
      atom("جمعه", "امروز جمعه باشد", "امروز جمعه است", "امروز جمعه نیست"),
      atom("مدرسه تعطیل", "مدرسه تعطیل باشد", "مدرسه تعطیل است", "مدرسه تعطیل نیست"),
    ],
    edges: [[0, 1]],
  },
  {
    atoms: [
      atom("مشق تمام", "سارا مشق‌هایش را تمام کرده باشد", "سارا مشق‌هایش را تمام کرده", "سارا مشق‌هایش را تمام نکرده"),
      atom("بازی", "سارا به بازی برود", "سارا به بازی می‌رود", "سارا به بازی نمی‌رود"),
    ],
    edges: [[0, 1]],
  },
];

/** An arrow: from → to (story atom indices). */
export type Rule = [number, number];
/** A statement and whether it is true. */
export interface Lit {
  atom: number;
  value: boolean;
}

export type Truth = "yes" | "no" | "unknown";

export type IfSlipTag =
  /** B is true, so A is true (one arrow read backwards). */
  | "affirmConsequent"
  /** A is not true, so B is not true (one arrow, "not" sent forwards). */
  | "denyAntecedent"
  /** Two or more arrows, at least one read the wrong way round. */
  | "reversedChain"
  /** The answer follows backwards (not B, so not A) but the child said can't tell. */
  | "missedTollens"
  /** The answer follows forwards but the child said can't tell. */
  | "missedPonens"
  /** The opposite of what follows. */
  | "opposite"
  /** Nothing, not even a slip, leads to this. */
  | "unsupported";

export interface IfThenQuestion {
  type: "ifThen";
  level: Level;
  seed: number;
  story: number;
  /** The arrows, in the order the sentences are shown. */
  rules: Rule[];
  fact: Lit;
  target: number;
  /** Shown in this order; "unknown" (نمی‌توان فهمید) is always last. */
  options: Truth[];
  answer: number;
  /** Why each option is right or wrong. */
  tags: (IfSlipTag | "right")[];
  /** Per option: the rule (index into rules) a slip reads the wrong way round, or null. */
  flipped: (number | null)[];
}

// ───────────── truth tables ─────────────

/** Atoms the rules mention, plus any extra ones, sorted. */
export const atomsOf = (rules: readonly Rule[], extra: readonly number[] = []) => [...new Set([...rules.flat(), ...extra])].sort((a, b) => a - b);

/**
 * Every true/false assignment of the atoms that keeps all the rules and the
 * facts. A model is a bit mask over story atom indices (bit set: true).
 */
export function ifModels(rules: readonly Rule[], facts: readonly Lit[], atoms: readonly number[]): number[] {
  const out: number[] = [];
  for (let m = 0; m < 1 << atoms.length; m++) {
    let model = 0;
    atoms.forEach((a, i) => (model |= ((m >> i) & 1) << a));
    const v = (a: number) => !!((model >> a) & 1);
    if (rules.every(([a, b]) => !v(a) || v(b)) && facts.every((f) => v(f.atom) === f.value)) out.push(model);
  }
  return out;
}

/** What the models say about one atom (null: no model at all). */
export function truthIn(models: readonly number[], a: number): Truth | null {
  if (!models.length) return null;
  const t = models.filter((m) => (m >> a) & 1).length;
  return t === models.length ? "yes" : t === 0 ? "no" : "unknown";
}

export const truthOf = (rules: readonly Rule[], fact: Lit, target: number): Truth | null => truthIn(ifModels(rules, [fact], atomsOf(rules, [fact.atom, target])), target);

// ───────────── moves ─────────────

export type MoveKind = "ponens" | "tollens" | "converse" | "inverse";
export interface Move {
  rule: number;
  from: Lit;
  to: Lit;
  kind: MoveKind;
}

const SOUND: MoveKind[] = ["ponens", "tollens"];

/** Moves out of a statement: true goes forward (ponens), false backward (tollens), and with slips the other two. */
function movesFrom(rules: readonly Rule[], l: Lit, slips: boolean): Move[] {
  const out: Move[] = [];
  rules.forEach(([a, b], rule) => {
    if (l.value && l.atom === a) out.push({ rule, from: l, to: { atom: b, value: true }, kind: "ponens" });
    if (!l.value && l.atom === b) out.push({ rule, from: l, to: { atom: a, value: false }, kind: "tollens" });
    if (slips && l.value && l.atom === b) out.push({ rule, from: l, to: { atom: a, value: true }, kind: "converse" });
    if (slips && !l.value && l.atom === a) out.push({ rule, from: l, to: { atom: b, value: false }, kind: "inverse" });
  });
  return out;
}

/** Shortest path of moves from a fact to a statement (slips allowed or not); null if none. */
export function pathTo(rules: readonly Rule[], fact: Lit, goal: Lit, slips: boolean): Move[] | null {
  const key = (l: Lit) => `${l.atom}${l.value ? "+" : "-"}`;
  const prev = new Map<string, Move | null>([[key(fact), null]]);
  const queue: Lit[] = [fact];
  while (queue.length) {
    const l = queue.shift()!;
    if (l.atom === goal.atom && l.value === goal.value) {
      const path: Move[] = [];
      for (let m = prev.get(key(l)); m; m = prev.get(key(m.from))) path.unshift(m);
      return path;
    }
    for (const m of movesFrom(rules, l, slips)) {
      // Sound moves first in the list, so a sound path wins a tie.
      if (prev.has(key(m.to))) continue;
      prev.set(key(m.to), m);
      queue.push(m.to);
    }
  }
  return null;
}

/** Everything the sound moves reach from the fact, in the order a child finds it. */
export function soundMoves(rules: readonly Rule[], fact: Lit): Move[] {
  const seen = new Set([fact.atom]);
  const out: Move[] = [];
  const queue: Lit[] = [fact];
  while (queue.length) {
    const l = queue.shift()!;
    for (const m of movesFrom(rules, l, false)) {
      if (seen.has(m.to.atom)) continue;
      seen.add(m.to.atom);
      out.push(m);
      queue.push(m.to);
    }
  }
  return out;
}

const valueOf = (t: Truth) => t === "yes";

/** Why choosing option `opt` is right or wrong, and the arrow a slip reads backwards. */
export function ifOptionTag(rules: readonly Rule[], fact: Lit, target: number, opt: Truth): { tag: IfSlipTag | "right"; flipped: number | null } {
  const truth = truthOf(rules, fact, target);
  if (opt === truth) return { tag: "right", flipped: null };
  if (truth !== "unknown") {
    if (opt === "unknown") return { tag: fact.value ? "missedPonens" : "missedTollens", flipped: null };
    return { tag: "opposite", flipped: null };
  }
  const path = pathTo(rules, fact, { atom: target, value: valueOf(opt) }, true);
  if (!path) return { tag: "unsupported", flipped: null };
  const wrong = path.find((m) => !SOUND.includes(m.kind))!;
  if (path.length === 1) return { tag: wrong.kind === "converse" ? "affirmConsequent" : "denyAntecedent", flipped: wrong.rule };
  return { tag: "reversedChain", flipped: wrong.rule };
}

// ───────────── questions ─────────────

/** Undirected distance between two atoms over the rules. */
function distance(rules: readonly Rule[], a: number, b: number): number {
  const dist = new Map([[a, 0]]);
  const queue = [a];
  while (queue.length) {
    const x = queue.shift()!;
    for (const [p, q] of rules)
      for (const [u, v] of [
        [p, q],
        [q, p],
      ])
        if (u === x && !dist.has(v)) {
          dist.set(v, dist.get(x)! + 1);
          queue.push(v);
        }
  }
  return dist.get(b) ?? Infinity;
}

const connected = (rules: readonly Rule[]) => {
  const atoms = atomsOf(rules);
  return atoms.every((b) => distance(rules, atoms[0], b) < Infinity);
};

/** Single-arrow cases: [fact on A or B, fact value, target is the other]. */
type OneCase = "ponens" | "affirm" | "tollens" | "deny";

function build(rng: Rng, level: Level, seed: number, story: number, rules: Rule[], fact: Lit, target: number): IfThenQuestion {
  const truth = truthOf(rules, fact, target)!;
  const options: Truth[] = [...shuffle(rng, ["yes", "no"] as Truth[]), "unknown"];
  const judged = options.map((o) => ifOptionTag(rules, fact, target, o));
  return {
    type: "ifThen",
    level,
    seed,
    story,
    rules,
    fact,
    target,
    options,
    answer: options.indexOf(truth),
    tags: judged.map((j) => j.tag),
    flipped: judged.map((j) => j.flipped),
  };
}

export function makeIfThenQuestion(level: Level, seed: number): IfThenQuestion {
  const rng = mulberry32(seed * 13 + level * 977 + 5);
  if (level < 3) {
    const all = IF_STORIES.flatMap((s, story) => s.edges.map((e) => ({ story, e })));
    const { story, e } = pick(rng, all);
    const [a, b] = e;
    const c: OneCase = level === 1 ? (rng() < 0.5 ? "ponens" : "affirm") : pick(rng, ["tollens", "tollens", "deny", "affirm", "deny"] as OneCase[]);
    const fact: Lit = c === "ponens" ? { atom: a, value: true } : c === "affirm" ? { atom: b, value: true } : c === "tollens" ? { atom: b, value: false } : { atom: a, value: false };
    return build(rng, level, seed, story, [e], fact, fact.atom === a ? b : a);
  }
  // Level 3: aim for each answer about a third of the time.
  const want = pick(rng, ["yes", "no", "unknown"] as Truth[]);
  for (;;) {
    const story = pick(rng, IF_STORIES.map((_, i) => i).filter((i) => IF_STORIES[i].edges.length >= 2));
    const edges = IF_STORIES[story].edges;
    const count = edges.length >= 3 && rng() < 0.5 ? 3 : 2;
    const rules = shuffle(rng, edges).slice(0, count);
    if (!connected(rules)) continue;
    const atoms = atomsOf(rules);
    const fact: Lit = { atom: pick(rng, atoms), value: rng() < 0.5 };
    const far = atoms.filter((t) => distance(rules, fact.atom, t) >= 2);
    if (!far.length) continue;
    const target = pick(rng, far);
    if (truthOf(rules, fact, target) !== want) continue;
    return build(rng, level, seed, story, rules, fact, target);
  }
}

// ───────────── show me ─────────────

export type IfStep =
  /** Draw one sentence as an arrow. */
  | { kind: "arrow"; rule: number }
  /** Mark the fact on the diagram. */
  | { kind: "fact" }
  /** One sound move. */
  | { kind: "move"; move: Move }
  /** The answer (for "unknown": why nothing more follows). */
  | { kind: "end"; truth: Truth };

export function ifSteps(q: IfThenQuestion): IfStep[] {
  const steps: IfStep[] = q.rules.map((_, rule) => ({ kind: "arrow", rule }));
  steps.push({ kind: "fact" });
  const truth = q.options[q.answer];
  // Forced: the moves on the way to the target. Unknown: everything the fact gives.
  const moves = truth === "unknown" ? soundMoves(q.rules, q.fact) : pathTo(q.rules, q.fact, { atom: q.target, value: truth === "yes" }, false)!;
  for (const move of moves) steps.push({ kind: "move", move });
  steps.push({ kind: "end", truth });
  return steps;
}

/** What the diagram shows after k steps: arrows drawn, each atom's value (null: ؟), the latest move. */
export function ifStateAfter(q: IfThenQuestion, steps: readonly IfStep[], k: number) {
  const arrows = new Set<number>();
  const values = new Map<number, boolean>();
  let given: number | null = null;
  for (const s of steps.slice(0, k)) {
    if (s.kind === "arrow") arrows.add(s.rule);
    if (s.kind === "fact") {
      values.set(q.fact.atom, q.fact.value);
      given = q.fact.atom;
    }
    if (s.kind === "move") values.set(s.move.to.atom, s.move.to.value);
  }
  return { arrows, values, given };
}

// Tool 3: picture patterns. A tile is a small picture (shapes with a count,
// fill and turn; or strokes; or markers round a frame; or a polygon with
// dots). Rules say how tiles change along a row or a sequence; a matrix or a
// sequence is filled from its rules, and every wrong option breaks exactly
// one rule, so the feedback can name it.

import { mulberry32, pick, randInt, shuffle, type Rng } from "./random";

export type Level = 1 | 2 | 3;

export type ShapeName = "circle" | "square" | "triangle" | "star" | "diamond" | "hexagon" | "arrow" | "flag" | "letterF";
export type FillName = "white" | "black" | "striped" | "dotted";

/** Shapes that look the same when turned are no use for turning rules. */
export const PLAIN_SHAPES: ShapeName[] = ["circle", "square", "triangle", "star", "diamond", "hexagon"];
export const TURNING_SHAPES: ShapeName[] = ["arrow", "flag", "letterF"];
/** Turning shapes with no mirror line: a mirror image is not a turn of them. */
export const CHIRAL_SHAPES: ShapeName[] = ["flag", "letterF"];
export const FILLS: FillName[] = ["white", "black", "striped", "dotted"];

export interface Tile {
  shape?: ShapeName;
  count?: number;
  fill?: FillName;
  /** Clockwise, in eighths of a turn (45°). */
  turn?: number;
  flip?: boolean;
  /** Strokes, as bits: 0 top, 1 right, 2 bottom, 3 left, 4 "\", 5 "/", 6 upright middle, 7 level middle. */
  lines?: number;
  /** Spot (0 … 7 clockwise from the top-left corner) of each marker round the frame. */
  marks?: number[];
  /** A turning arrow in the middle of a marker frame. */
  arrow?: number;
  sides?: number;
  dots?: number;
}

export const tileKey = (t: Tile) => JSON.stringify([t.shape, t.count, t.fill, t.turn, t.flip, t.lines, t.marks, t.arrow, t.sides, t.dots]);

const mod = (a: number, n: number) => ((a % n) + n) % n;

// --- Rules ---

export type Rule =
  | { kind: "turn"; step: number; rowStep: number; start: number }
  | { kind: "count"; step: number; rowStep: number; start: number }
  | { kind: "shape"; set: ShapeName[]; shift: number }
  | { kind: "fill"; set: FillName[]; shift: number }
  | { kind: "lines"; op: "add" | "xor"; masks: number[] };

export type RuleKind = Rule["kind"];
export type ItemRuleKind = "turn" | "count" | "shape" | "fill";
export type Layout = "m2" | "m3" | "seq";

export const LAYOUT_SIZE: Record<Layout, [number, number]> = { m2: [2, 2], m3: [3, 3], seq: [1, 5] };

/** The tile at row r, column c. */
export function cellTile(base: Tile, rules: Rule[], r: number, c: number): Tile {
  const t: Tile = { ...base };
  for (const rule of rules)
    switch (rule.kind) {
      case "turn":
        t.turn = mod(rule.start + rule.rowStep * r + rule.step * c, 8);
        break;
      case "count":
        t.count = rule.start + rule.rowStep * r + rule.step * c;
        break;
      case "shape":
        t.shape = rule.set[mod(c + rule.shift * r, rule.set.length)];
        break;
      case "fill":
        t.fill = rule.set[mod(c + rule.shift * r, rule.set.length)];
        break;
      case "lines": {
        const [a, b] = [rule.masks[r * 2], rule.masks[r * 2 + 1]];
        t.lines = c === 0 ? a : c === 1 ? b : rule.op === "add" ? a | b : a ^ b;
        break;
      }
    }
  return t;
}


/** Two stroke sets that share `share` strokes, each with 2 or 3. */
function strokePair(rng: Rng, share: number): [number, number] {
  const bits = shuffle(rng, [0, 1, 2, 3, 4, 5, 6, 7]);
  const both = bits.slice(0, share);
  const onlyA = bits.slice(share, share + 1 + randInt(rng, 2));
  const onlyB = bits.slice(share + 2, share + 3 + randInt(rng, 2));
  const m = (bs: number[]) => bs.reduce((x, b) => x | (1 << b), 0);
  return [m([...both, ...onlyA]), m([...both, ...onlyB])];
}

/** Rules with their sizes picked for a layout. */
/** `steps` fixes the turn and count steps (explore mode); otherwise they are picked. */
export function makeRules(kinds: RuleKind[], layout: Layout, rng: Rng, op: "add" | "xor" = "add", steps: { turn?: number; count?: number } = {}): { rules: Rule[]; base: Tile } {
  const [rows, cols] = LAYOUT_SIZE[layout];
  const turning = kinds.includes("turn");
  const rules: Rule[] = [];
  let shapeShift = 1;
  for (const kind of kinds)
    switch (kind) {
      case "turn":
        rules.push({ kind, step: steps.turn ?? pick(rng, [2, -2, 1, -1, 2, -2]), rowStep: rows > 1 ? pick(rng, [1, 2, 3]) : 0, start: randInt(rng, 8) });
        break;
      case "count": {
        const step = steps.count ?? pick(rng, [1, -1]);
        const rowStep = rows > 1 ? pick(rng, [0, 1]) : 0;
        const span = (cols - 1) * Math.abs(step);
        const lo = step > 0 ? 1 : 1 + span;
        const hi = (step > 0 ? 5 - span : 5) - (rows - 1) * rowStep;
        rules.push({ kind, step, rowStep, start: lo + randInt(rng, Math.max(1, hi - lo + 1)) });
        break;
      }
      case "shape": {
        const k = layout === "m2" ? 2 : layout === "seq" ? pick(rng, [2, 3]) : 3;
        shapeShift = layout === "m3" ? pick(rng, [1, 2]) : 1;
        rules.push({ kind, set: shuffle(rng, turning ? TURNING_SHAPES : PLAIN_SHAPES).slice(0, k), shift: shapeShift });
        break;
      }
      case "fill": {
        const k = layout === "m2" ? 2 : layout === "seq" ? pick(rng, [2, 3]) : 3;
        // In a 3×3 matrix, run fills the other diagonal way to shapes, so the two rules differ.
        rules.push({ kind, set: shuffle(rng, FILLS).slice(0, k), shift: layout === "m3" ? 3 - shapeShift : 1 });
        break;
      }
      case "lines": {
        const masks: number[] = [];
        for (let r = 0; r < rows; r++) {
          // For "remove the shared strokes", some strokes must be shared, or adding and removing look alike.
          const [a, b] = strokePair(rng, op === "xor" || r === 0 ? 1 : randInt(rng, 2));
          masks.push(a, b);
        }
        rules.push({ kind, op, masks });
        break;
      }
    }
  const base: Tile = kinds.includes("lines")
    ? {}
    : {
        shape: pick(rng, turning ? TURNING_SHAPES : PLAIN_SHAPES),
        count: 1,
        fill: pick(rng, FILLS),
        turn: 0,
      };
  return { rules, base };
}

export function fillLayout(base: Tile, rules: Rule[], layout: Layout): Tile[] {
  const [rows, cols] = LAYOUT_SIZE[layout];
  return Array.from({ length: rows * cols }, (_, i) => cellTile(base, rules, Math.floor(i / cols), i % cols));
}

// --- Questions ---

export type PatternQuestionType = "matrix2" | "matrix3" | "sequence" | "rotation" | "combine" | "sides" | "missing" | "odd";

/** What is wrong with an option: the one rule it breaks. */
export type Tag = "right" | "turn" | "count" | "shape" | "fill" | "lines" | "otherOp" | "copy" | "marks" | "arrow" | "sides" | "dots" | "patchShift" | "patchMirror" | "patchTile";

/** A rule in words, for "show me" and feedback; `cells` are the cells it is read from. */
export interface Why {
  text: string;
  cells: number[];
}

interface QBase {
  level: Level;
  seed: number;
}

export type GridQuestion = QBase & {
  type: "matrix2" | "matrix3" | "sequence" | "rotation" | "combine" | "sides";
  rows: number;
  cols: number;
  cells: Tile[];
  blank: number;
  options: Tile[];
  answer: number;
  tags: Tag[];
  why: Why[];
  /** Signs between the cells of a row ("+", "=") for adding and removing strokes. */
  signs?: string[];
  rules?: Rule[];
};

export type MissingQuestion = QBase & {
  type: "missing";
  rows: number;
  cols: number;
  cells: Tile[];
  /** Top-left cell of the 2×2 hole. */
  hole: [number, number];
  options: Tile[][];
  answer: number;
  tags: Tag[];
  why: Why[];
};

export type OddQuestion = QBase & { type: "odd"; tiles: Tile[]; answer: number; why: string };

export type PatternQuestion = GridQuestion | MissingQuestion | OddQuestion;

const optionCount = (level: Level) => (level === 3 ? 6 : 4);

/** Answer plus distractors, deduplicated and shuffled. */
function assemble(rng: Rng, answer: Tile, wrong: { tile: Tile; tag: Tag }[], n: number) {
  const seen = new Set([tileKey(answer)]);
  const picked: { tile: Tile; tag: Tag }[] = [];
  for (const w of wrong) {
    if (picked.length >= n - 1) break;
    const k = tileKey(w.tile);
    if (seen.has(k)) continue;
    seen.add(k);
    picked.push(w);
  }
  const all = shuffle(rng, [{ tile: answer, tag: "right" as Tag }, ...picked]);
  return { options: all.map((o) => o.tile), tags: all.map((o) => o.tag), answer: all.findIndex((o) => o.tag === "right") };
}

/** Options that each break one rule, the most tempting first. */
function itemWrong(rng: Rng, ans: Tile, rules: Rule[], copy: Tile): { tile: Tile; tag: Tag }[] {
  const first: { tile: Tile; tag: Tag }[] = [];
  const more: { tile: Tile; tag: Tag }[] = [];
  const has = (k: RuleKind) => rules.some((r) => r.kind === k);
  for (const rule of shuffle(rng, rules)) {
    if (rule.kind === "turn") {
      first.push({ tile: { ...ans, turn: mod(ans.turn! - 2 * rule.step, 8) }, tag: "turn" });
      more.push({ tile: { ...ans, turn: mod(ans.turn! + rule.step, 8) }, tag: "turn" }, { tile: { ...ans, turn: mod(ans.turn! + 4, 8) }, tag: "turn" });
    } else if (rule.kind === "count") {
      const vs = shuffle(rng, [ans.count! + 1, ans.count! - 1].filter((v) => v >= 1 && v <= 6));
      first.push({ tile: { ...ans, count: vs[0] }, tag: "count" });
      if (vs[1]) more.push({ tile: { ...ans, count: vs[1] }, tag: "count" });
    } else if (rule.kind === "shape") {
      const others = shuffle(rng, rule.set.filter((s) => s !== ans.shape));
      others.forEach((s, i) => (i ? more : first).push({ tile: { ...ans, shape: s }, tag: "shape" }));
      const pool = TURNING_SHAPES.includes(ans.shape!) ? TURNING_SHAPES : PLAIN_SHAPES;
      more.push({ tile: { ...ans, shape: pick(rng, pool.filter((s) => !rule.set.includes(s))) }, tag: "shape" });
    } else if (rule.kind === "fill") {
      const others = shuffle(rng, rule.set.filter((s) => s !== ans.fill));
      others.forEach((s, i) => (i ? more : first).push({ tile: { ...ans, fill: s }, tag: "fill" }));
      const outside = FILLS.filter((f) => !rule.set.includes(f));
      if (outside.length) more.push({ tile: { ...ans, fill: pick(rng, outside) }, tag: "fill" });
    }
  }
  // Things that stay the same everywhere, changed.
  const constant: { tile: Tile; tag: Tag }[] = [];
  const turning = TURNING_SHAPES.includes(ans.shape!);
  if (!has("shape")) constant.push({ tile: { ...ans, shape: pick(rng, (turning ? TURNING_SHAPES : PLAIN_SHAPES).filter((s) => s !== ans.shape)) }, tag: "shape" });
  if (!has("fill")) constant.push({ tile: { ...ans, fill: pick(rng, FILLS.filter((f) => f !== ans.fill)) }, tag: "fill" });
  if (!has("count")) constant.push({ tile: { ...ans, count: ans.count! + 1 }, tag: "count" });
  if (!has("turn") && turning) constant.push({ tile: { ...ans, turn: mod(ans.turn! + 2, 8) }, tag: "turn" });
  return [...first, { tile: copy, tag: "copy" }, ...shuffle(rng, more), ...shuffle(rng, constant)];
}

function linesWrong(rng: Rng, ans: Tile, a: number, b: number, op: "add" | "xor", copy: Tile): { tile: Tile; tag: Tag }[] {
  const other = op === "add" ? a ^ b : a | b;
  const bits = [0, 1, 2, 3, 4, 5, 6, 7];
  const on = bits.filter((i) => ans.lines! & (1 << i));
  const off = bits.filter((i) => !(ans.lines! & (1 << i)));
  return [
    { tile: { lines: other }, tag: "otherOp" },
    ...(a & b ? [{ tile: { lines: a & b }, tag: "otherOp" as Tag }] : []),
    { tile: { lines: ans.lines! & ~(1 << pick(rng, on)) }, tag: "lines" },
    { tile: { lines: ans.lines! | (1 << pick(rng, off)) }, tag: "lines" },
    { tile: copy, tag: "copy" },
    { tile: { lines: ans.lines! ^ (1 << pick(rng, on)) ^ (1 << pick(rng, off)) }, tag: "lines" },
    // Spares: every one-stroke slip.
    ...shuffle(rng, bits).map((i) => ({ tile: { lines: ans.lines! ^ (1 << i) }, tag: "lines" as Tag })),
  ];
}

// Words

export const SHAPE_NAME: Record<ShapeName, string> = {
  circle: "دایره",
  square: "مربع",
  triangle: "مثلث",
  star: "ستاره",
  diamond: "لوزی",
  hexagon: "شش‌ضلعی",
  arrow: "پیکان",
  flag: "پرچم",
  letterF: "حرف F",
};
export const FILL_NAME: Record<FillName, string> = { white: "سفید", black: "سیاه", striped: "راه‌راه", dotted: "خال‌خالی" };
const fa = (n: number | string) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
const turnWords = (step: number) => `${fa(Math.abs(step) * 45)} درجه ${step > 0 ? "ساعتگرد ↻" : "پادساعتگرد ↺"}`;

/** One rule in a sentence. */
export function ruleText(rule: Rule, layout: Layout): string {
  const along = layout === "seq" ? "هر خانه نسبت به قبلی" : "در هر سطر، هر خانه نسبت به خانه قبلش";
  switch (rule.kind) {
    case "turn":
      return `چرخش: ${along} ${turnWords(rule.step)} می‌چرخد.`;
    case "count":
      return `تعداد: ${along} ${rule.step > 0 ? "یکی بیشتر" : "یکی کمتر"} دارد.`;
    case "shape":
      return layout === "seq"
        ? `شکل: ${rule.set.map((s) => SHAPE_NAME[s]).join("، ")} به همین ترتیب تکرار می‌شوند.`
        : `شکل: در هر سطر و هر ستون، ${rule.set.map((s) => SHAPE_NAME[s]).join("، ")} هر کدام یک بار می‌آید.`;
    case "fill":
      return layout === "seq"
        ? `رنگ و نقش: ${rule.set.map((s) => FILL_NAME[s]).join("، ")} به همین ترتیب تکرار می‌شوند.`
        : `رنگ و نقش: در هر سطر و هر ستون، ${rule.set.map((s) => FILL_NAME[s]).join("، ")} هر کدام یک بار می‌آید.`;
    case "lines":
      return rule.op === "add" ? "جمع شکل: خانه سوم = خانه اول و دوم روی هم (همه خط‌ها)." : "تفریق شکل: خانه سوم = خانه اول و دوم روی هم، ولی خط‌های مشترک پاک می‌شوند.";
  }
}

/** The values of each rule along a run of cells, e.g. "تعداد ۱، ۲، ۳ · شکل دایره، مربع، مثلث". */
export function valuesText(tiles: (Tile | null)[], rules: Rule[]): string {
  const list = (f: (t: Tile) => string) => tiles.map((t) => (t ? f(t) : "؟")).join("، ");
  return rules
    .map((rule) => {
      switch (rule.kind) {
        case "turn":
          return `چرخش ${list((t) => `${fa(t.turn! * 45)}°`)}`;
        case "count":
          return `تعداد ${list((t) => fa(t.count!))}`;
        case "shape":
          return `شکل ${list((t) => SHAPE_NAME[t.shape!])}`;
        case "fill":
          return `رنگ و نقش ${list((t) => FILL_NAME[t.fill!])}`;
        case "lines":
          return rule.op === "add" ? "اول + دوم = سوم" : "اول و دوم روی هم، مشترک‌ها پاک = سوم";
      }
    })
    .join("؛ ");
}

/** Rows (and columns) of a matrix, each read in a sentence; the blank shows as "؟". */
export function matrixWhy(cells: Tile[], rows: number, cols: number, rules: Rule[], blank: number): Why[] {
  const out: Why[] = [];
  const read = (idx: number[]) => idx.map((i) => (i === blank ? null : cells[i]));
  for (let r = 0; r < rows; r++) {
    const idx = Array.from({ length: cols }, (_, c) => r * cols + c);
    out.push({ text: `${rows > 1 ? `سطر ${fa(r + 1)}` : "دنباله"}: ${valuesText(read(idx), rules)}`, cells: idx });
  }
  const colRules = rules.filter((r) => r.kind !== "lines" && (r.kind === "shape" || r.kind === "fill" || r.rowStep !== 0));
  if (rows > 1 && colRules.length)
    for (let c = 0; c < cols; c++) {
      const idx = Array.from({ length: rows }, (_, r) => r * cols + c);
      out.push({ text: `ستون ${fa(c + 1)}: ${valuesText(read(idx), colRules)}`, cells: idx });
    }
  return out;
}

const ITEM_KINDS: ItemRuleKind[] = ["turn", "count", "shape", "fill"];

function gridQuestion(type: "matrix2" | "matrix3" | "sequence", level: Level, seed: number, rng: Rng): GridQuestion {
  const layout: Layout = type === "matrix2" ? "m2" : type === "matrix3" ? "m3" : "seq";
  const useLines = type === "matrix3" && level === 3 && rng() < 0.34;
  const op = pick(rng, ["add", "xor"] as const);
  const kinds: RuleKind[] = useLines ? ["lines"] : shuffle(rng, ITEM_KINDS).slice(0, level);
  const { rules, base } = makeRules(kinds, layout, rng, op);
  const [rows, cols] = LAYOUT_SIZE[layout];
  const cells = fillLayout(base, rules, layout);
  const blank = rows * cols - 1;
  const ans = cells[blank];
  const copy = cells[blank - 1];
  const wrong = useLines
    ? linesWrong(rng, ans, (rules[0] as Extract<Rule, { kind: "lines" }>).masks[(rows - 1) * 2], (rules[0] as Extract<Rule, { kind: "lines" }>).masks[(rows - 1) * 2 + 1], op, copy)
    : itemWrong(rng, ans, rules, copy);
  return {
    type,
    level,
    seed,
    rows,
    cols,
    cells,
    blank,
    ...assemble(rng, ans, wrong, optionCount(level)),
    why: [...rules.map((r) => ({ text: ruleText(r, layout), cells: [] })), ...matrixWhy(cells, rows, cols, rules, blank)],
    rules,
  };
}

/** Markers moving round a frame, and (level 3) an arrow turning in the middle. */
function rotationQuestion(level: Level, seed: number, rng: Rng): GridQuestion {
  for (;;) {
    const n = level === 1 ? 1 : 2;
    const steps = shuffle(rng, [1, 2, -1, -2, 3]).slice(0, n);
    const starts = shuffle(rng, [0, 1, 2, 3, 4, 5, 6, 7]).slice(0, n);
    const arrowStep = level === 3 ? pick(rng, [2, -2, 1, -1]) : 0;
    const arrow0 = randInt(rng, 8);
    const at = (i: number): Tile => ({ marks: starts.map((s, k) => mod(s + steps[k] * i, 8)), ...(level === 3 ? { arrow: mod(arrow0 + arrowStep * i, 8) } : {}) });
    const cells = [0, 1, 2, 3, 4].map(at);
    // Two markers on one spot would hide each other.
    if (cells.some((t) => new Set(t.marks).size < t.marks!.length)) continue;
    const ans = cells[4];
    const wrong: { tile: Tile; tag: Tag }[] = [];
    steps.forEach((s, k) => {
      const m = (p: number): Tile => ({ ...ans, marks: ans.marks!.map((q, j) => (j === k ? mod(p, 8) : q)) });
      wrong.push({ tile: m(ans.marks![k] - 2 * s), tag: "marks" }, { tile: m(ans.marks![k] + (s > 0 ? 1 : -1)), tag: "marks" });
    });
    if (n === 2) wrong.push({ tile: { ...ans, marks: [ans.marks![1], ans.marks![0]] }, tag: "marks" });
    if (level === 3) wrong.unshift({ tile: { ...ans, arrow: mod(ans.arrow! - 2 * arrowStep, 8) }, tag: "arrow" });
    wrong.push({ tile: cells[3], tag: "copy" });
    const ok = wrong.filter((w) => new Set(w.tile.marks).size === w.tile.marks!.length);
    const why: Why[] = steps.map((s, k) => ({
      text: `${k === 0 ? "نقطه سیاه" : "ستاره"} هر بار ${fa(Math.abs(s))} جا ${s > 0 ? "ساعتگرد ↻" : "پادساعتگرد ↺"} دور قاب جلو می‌رود.`,
      cells: [0, 1, 2, 3],
    }));
    if (level === 3) why.push({ text: `پیکان وسط هر بار ${turnWords(arrowStep)} می‌چرخد.`, cells: [0, 1, 2, 3] });
    return { type: "rotation", level, seed, rows: 1, cols: 5, cells, blank: 4, ...assemble(rng, ans, ok, optionCount(level)), why };
  }
}

/** Polygons whose sides (and dots, and fill) change step by step. */
function sidesQuestion(level: Level, seed: number, rng: Rng): GridQuestion {
  const sStep = pick(rng, [1, -1]);
  const s0 = sStep > 0 ? 3 : 7;
  const dStep = level >= 2 ? pick(rng, [1, -1]) : 0;
  const d0 = level >= 2 ? (dStep > 0 ? 1 + randInt(rng, 2) : 5 + randInt(rng, 2)) : 0;
  const fills = level === 3 ? shuffle(rng, FILLS.filter((f) => f !== "black")).slice(0, pick(rng, [2, 3])) : [pick(rng, ["white", "striped", "dotted"] as FillName[])];
  const at = (i: number): Tile => ({ sides: s0 + sStep * i, dots: d0 + dStep * i, fill: fills[i % fills.length] });
  const cells = [0, 1, 2, 3, 4].map(at);
  const ans = cells[4];
  const slips: { tile: Tile; tag: Tag }[] = [
    { tile: { ...ans, sides: ans.sides! - sStep }, tag: "sides" },
    ...(level >= 2 ? [{ tile: { ...ans, dots: ans.dots! - dStep }, tag: "dots" as Tag }] : []),
    ...(level === 3 ? [{ tile: { ...ans, fill: fills.find((f) => f !== ans.fill) }, tag: "fill" as Tag }] : []),
    { tile: cells[3], tag: "copy" },
    { tile: { ...ans, sides: ans.sides! + sStep }, tag: "sides" },
    ...(level >= 2 ? [{ tile: { ...ans, dots: ans.dots! + dStep }, tag: "dots" as Tag }] : [{ tile: { ...ans, dots: 1 }, tag: "dots" as Tag }]),
    { tile: { ...ans, sides: ans.sides! - sStep, dots: Math.max(0, ans.dots! - dStep) }, tag: "sides" },
    // Spares, for when the sides run out at 3.
    { tile: { ...ans, sides: ans.sides! - 2 * sStep }, tag: "sides" },
    { tile: { ...ans, fill: pick(rng, FILLS.filter((f) => f !== ans.fill && f !== "black")) }, tag: "fill" },
    { tile: { ...ans, dots: ans.dots! + 2 }, tag: "dots" },
  ];
  const wrong = slips.filter((w) => w.tile.sides! >= 3 && w.tile.sides! <= 8 && w.tile.dots! >= 0 && w.tile.dots! <= 6);
  const why: Why[] = [{ text: `تعداد ضلع‌ها هر بار ${sStep > 0 ? "یکی بیشتر" : "یکی کمتر"} می‌شود: ${cells.slice(0, 4).map((t) => fa(t.sides!)).join("، ")}، …`, cells: [0, 1, 2, 3] }];
  if (level >= 2) why.push({ text: `تعداد نقطه‌ها هر بار ${dStep > 0 ? "یکی بیشتر" : "یکی کمتر"} می‌شود: ${cells.slice(0, 4).map((t) => fa(t.dots!)).join("، ")}، …`, cells: [0, 1, 2, 3] });
  if (level === 3 && fills.length > 1) why.push({ text: `رنگ و نقش شکل‌ها به ترتیب تکرار می‌شوند: ${fills.map((f) => FILL_NAME[f]).join("، ")}.`, cells: [0, 1, 2, 3] });
  return { type: "sides", level, seed, rows: 1, cols: 5, cells, blank: 4, ...assemble(rng, ans, wrong, optionCount(level)), why };
}

/** A + B = ?, or (level 3) a 3×3 matrix whose rows add or remove strokes. */
function combineQuestion(level: Level, seed: number, rng: Rng): GridQuestion {
  if (level === 3) {
    const op = pick(rng, ["add", "xor"] as const);
    const { rules } = makeRules(["lines"], "m3", rng, op);
    const cells = fillLayout({}, rules, "m3");
    const r = rules[0] as Extract<Rule, { kind: "lines" }>;
    return {
      type: "combine",
      level,
      seed,
      rows: 3,
      cols: 3,
      cells,
      blank: 8,
      ...assemble(rng, cells[8], linesWrong(rng, cells[8], r.masks[4], r.masks[5], op, cells[7]), optionCount(level)),
      why: [{ text: ruleText(r, "m3"), cells: [] }, ...matrixWhy(cells, 3, 3, rules, 8)],
      rules,
    };
  }
  const op = level === 1 ? "add" : "xor";
  const [a, b] = strokePair(rng, level === 1 ? randInt(rng, 2) : 1 + randInt(rng, 2));
  const ans: Tile = { lines: op === "add" ? a | b : a ^ b };
  return {
    type: "combine",
    level,
    seed,
    rows: 1,
    cols: 3,
    cells: [{ lines: a }, { lines: b }, ans],
    blank: 2,
    signs: [op === "add" ? "+" : "−", "="],
    ...assemble(rng, ans, linesWrong(rng, ans, a, b, op, { lines: b }), optionCount(level)),
    why: [
      {
        text: op === "add" ? "دو شکل را روی هم بگذار: هر خطی که در یکی از آن‌ها هست، در جواب هم هست." : "دو شکل را روی هم بگذار و خط‌های مشترک را پاک کن: فقط خط‌هایی می‌مانند که فقط در یکی هستند.",
        cells: [0, 1],
      },
    ],
  };
}

/** A tiled picture with a 2×2 hole; the options are 2×2 pieces. */
function missingQuestion(level: Level, seed: number, rng: Rng): MissingQuestion {
  const [rows, cols] = level === 1 ? [4, 4] : level === 2 ? [4, 5] : [5, 5];
  // Each attribute follows (a·row + b·column) round a short cycle.
  const coef = () => {
    const a = randInt(rng, 3);
    return [a, a === 0 ? 1 + randInt(rng, 2) : randInt(rng, 3)];
  };
  const kinds = shuffle(rng, ["shape", "fill", "turn", "count"] as const).slice(0, level);
  const turning = kinds.includes("turn");
  const shapes = shuffle(rng, turning ? TURNING_SHAPES : PLAIN_SHAPES).slice(0, 3);
  const fills = shuffle(rng, FILLS).slice(0, 3);
  const cs = Object.fromEntries(kinds.map((k) => [k, coef()])) as Record<string, number[]>;
  const v = (k: string, r: number, c: number) => cs[k][0] * r + cs[k][1] * c;
  const base: Tile = { shape: shapes[0], fill: fills[0], count: 1, turn: 0 };
  const at = (r: number, c: number): Tile => ({
    ...base,
    ...(cs.shape ? { shape: shapes[mod(v("shape", r, c), 3)] } : {}),
    ...(cs.fill ? { fill: fills[mod(v("fill", r, c), fills.length)] } : {}),
    ...(cs.turn ? { turn: mod(2 * v("turn", r, c), 8) } : {}),
    ...(cs.count ? { count: 1 + mod(v("count", r, c), 3) } : {}),
  });
  const cells = Array.from({ length: rows * cols }, (_, i) => at(Math.floor(i / cols), i % cols));
  const hole: [number, number] = [randInt(rng, rows - 1), randInt(rng, cols - 1)];
  const patch = (r: number, c: number) => [at(r, c), at(r, c + 1), at(r + 1, c), at(r + 1, c + 1)];
  const right = patch(...hole);
  const [hr, hc] = hole;
  const wrong: { tiles: Tile[]; tag: Tag }[] = [
    { tiles: [right[1], right[0], right[3], right[2]], tag: "patchMirror" },
    ...shuffle(rng, [
      [hr, hc + 1],
      [hr + 1, hc],
      [hr, hc - 1],
      [hr - 1, hc],
      [hr + 1, hc + 1],
    ]).map(([r, c]) => ({ tiles: patch(r, c), tag: "patchShift" as Tag })),
    ...[0, 1, 2, 3].map((k) => {
      const t = { ...right[k] };
      const kind = pick(rng, kinds);
      if (kind === "shape") t.shape = pick(rng, shapes.filter((s) => s !== t.shape));
      if (kind === "fill") t.fill = pick(rng, FILLS.filter((f) => f !== t.fill));
      if (kind === "turn") t.turn = mod(t.turn! + 2, 8);
      if (kind === "count") t.count = t.count === 3 ? 2 : t.count! + 1;
      return { tiles: right.map((x, j) => (j === k ? t : x)), tag: "patchTile" as Tag };
    }),
    { tiles: [right[2], right[3], right[0], right[1]], tag: "patchMirror" },
  ];
  const key = (ts: Tile[]) => ts.map(tileKey).join("|");
  const seen = new Set([key(right)]);
  const picked = wrong.filter((w) => !seen.has(key(w.tiles)) && seen.add(key(w.tiles))).slice(0, optionCount(level) - 1);
  const all = shuffle(rng, [{ tiles: right, tag: "right" as Tag }, ...picked]);
  const words: Record<string, string> = {
    shape: `شکل‌ها (${shapes.map((s) => SHAPE_NAME[s]).join("، ")})`,
    fill: `رنگ و نقش شکل‌ها (${fills.map((f) => FILL_NAME[f]).join("، ")})`,
    turn: "جهت پیکان‌ها",
    count: "تعداد شکل‌ها (۱، ۲، ۳)",
  };
  const how = (k: string) => {
    const [a, b] = cs[k];
    const along = b ? "در هر سطر به ترتیب تکرار می‌شوند" : "در هر سطر ثابت‌اند";
    return `${words[k]} ${along}${a ? " و هر سطر نسبت به سطر بالا جابه‌جا شده" : ""}.`;
  };
  return {
    type: "missing",
    level,
    seed,
    rows,
    cols,
    cells,
    hole,
    options: all.map((o) => o.tiles),
    tags: all.map((o) => o.tag),
    answer: all.findIndex((o) => o.tag === "right"),
    why: kinds.map((k) => ({ text: how(k), cells: [] })),
  };
}

/** Is one value shared by exactly four of five? */
const fourOne = (vals: unknown[]) => {
  const counts = new Map<string, number>();
  for (const v of vals) counts.set(String(v), (counts.get(String(v)) ?? 0) + 1);
  return [...counts.values()].sort().join() === "1,4";
};

function oddQuestion(level: Level, seed: number, rng: Rng): OddQuestion {
  for (;;) {
    const odd = randInt(rng, 5);
    let tiles: Tile[];
    let why: string;
    if (level === 1) {
      const shared = pick(rng, ["shape", "fill", "count"] as const);
      const shapes = shuffle(rng, PLAIN_SHAPES).slice(0, 3);
      const fills = shuffle(rng, FILLS).slice(0, 3);
      tiles = Array.from({ length: 5 }, () => ({ shape: pick(rng, shapes), fill: pick(rng, fills), count: 1 + randInt(rng, 3), turn: 0 }));
      const keep = tiles[(odd + 1) % 5][shared];
      tiles.forEach((t, i) => {
        if (i !== odd) (t as Record<string, unknown>)[shared] = keep;
      });
      const other = shared === "shape" ? pick(rng, PLAIN_SHAPES.filter((s) => s !== keep)) : shared === "fill" ? pick(rng, FILLS.filter((f) => f !== keep)) : keep === 3 ? 2 : (keep as number) + 1;
      (tiles[odd] as Record<string, unknown>)[shared] = other;
      const sharedOk = (["shape", "fill", "count"] as const).filter((k) => k !== shared).every((k) => !fourOne(tiles.map((t) => t[k])));
      if (!sharedOk) continue;
      why =
        shared === "shape"
          ? `همه ${SHAPE_NAME[keep as ShapeName]} هستند جز این یکی.`
          : shared === "fill"
            ? `همه ${FILL_NAME[keep as FillName]} هستند جز این یکی.`
            : `در همه ${fa(keep as number)} شکل هست جز این یکی.`;
    } else if (level === 2) {
      const shape = pick(rng, CHIRAL_SHAPES);
      const fill = pick(rng, FILLS);
      const turns = shuffle(rng, [0, 1, 2, 3, 4, 5, 6, 7]).slice(0, 5);
      tiles = turns.map((turn, i) => ({ shape, fill, count: 1, turn, flip: i === odd }));
      why = "بقیه فقط چرخیده‌اند؛ این یکی برعکس (قرینه) شده و با چرخاندن، شبیه بقیه نمی‌شود.";
    } else {
      const fill = pick(rng, ["white", "striped", "dotted"] as FillName[]);
      const sides = Array.from({ length: 5 }, () => 3 + randInt(rng, 4));
      const dots = sides.map((s, i) => (i === odd ? pick(rng, sides.filter((x) => x !== s).length ? sides.filter((x) => x !== s) : [s + 1]) : s));
      tiles = sides.map((s, i) => ({ sides: s, dots: dots[i], fill }));
      // The odd one's polygon must also appear elsewhere, or it would stand out for that alone.
      if (!sides.some((s, i) => i !== odd && s === sides[odd]) || fourOne(sides) || fourOne(dots)) continue;
      why = "در بقیه، تعداد نقطه‌ها با تعداد ضلع‌ها برابر است؛ در این یکی نه.";
    }
    if (new Set(tiles.map(tileKey)).size < 5) continue;
    return { type: "odd", level, seed, tiles, answer: odd, why };
  }
}

export function makePatternQuestion(type: PatternQuestionType, level: Level, seed: number): PatternQuestion {
  const rng = mulberry32(seed * 131 + level * 17 + type.length * 3);
  switch (type) {
    case "matrix2":
    case "matrix3":
    case "sequence":
      return gridQuestion(type, level, seed, rng);
    case "rotation":
      return rotationQuestion(level, seed, rng);
    case "sides":
      return sidesQuestion(level, seed, rng);
    case "combine":
      return combineQuestion(level, seed, rng);
    case "missing":
      return missingQuestion(level, seed, rng);
    case "odd":
      return oddQuestion(level, seed, rng);
  }
}

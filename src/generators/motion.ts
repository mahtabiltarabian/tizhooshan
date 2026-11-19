// Tool 15: motion and gears. Gear trains with belts and pulleys (direction and
// number of turns), movers on a straight track (meeting, catching up,
// overtaking), turning on the spot (facing north, east, south or west) and
// walking on a street grid. Every number in a question and its answer is
// whole. Each question keeps its answer and the usual slips, so the feedback
// can say which slip a wrong answer was.

import { mulberry32, pick, randInt, shuffle, type Rng } from "./random";

export type Level = 1 | 2 | 3;
export type MotionQuestionType = "gearDir" | "gearTurns" | "trip" | "chase" | "orient" | "grid";

// ── Gears, pulleys and belts ─────────────────────────────────────────────

export type WheelKind = "gear" | "pulley";
/** How wheel i drives wheel i + 1: teeth in mesh, a straight or crossed belt, or one axle. */
export type Link = "mesh" | "belt" | "cross" | "axle";
/** `size` is the number of teeth of a gear, the diameter (cm) of a pulley. */
export interface Wheel {
  kind: WheelKind;
  size: number;
}
/** A train of wheels; links[i] joins wheel i to wheel i + 1. Wheel 0 is turned by hand. */
export interface Machine {
  wheels: Wheel[];
  links: Link[];
}

/** 0 = clockwise, 1 = counterclockwise. */
export type Rot = 0 | 1;
export const CW: Rot = 0;
export const CCW: Rot = 1;

export const reverses = (l: Link) => l === "mesh" || l === "cross";

/**
 * Signed turns of every wheel when wheel 0 turns `turns` times clockwise
 * (positive = clockwise). In mesh, as many teeth pass on both gears; on a
 * belt, as much belt passes on both pulleys; on one axle, the turns are equal.
 */
export function wheelTurns(m: Machine, turns = 1): number[] {
  let num = turns;
  let den = 1;
  let sign = 1;
  const out = [turns];
  m.links.forEach((l, i) => {
    if (l !== "axle") {
      num *= m.wheels[i].size;
      den *= m.wheels[i + 1].size;
    }
    if (reverses(l)) sign = -sign;
    out.push((sign * num) / den);
  });
  return out;
}

/** Direction of wheel i when wheel 0 turns `driver`. */
export const dirOf = (m: Machine, i: number, driver: Rot): Rot => ((wheelTurns(m)[i] > 0) === (driver === CW) ? CW : CCW);
export const flip = (r: Rot): Rot => (r === CW ? CCW : CW);

/** Whether a train can be built: teeth only mesh with teeth, belts run on pulleys, one gear and one pulley share an axle. */
export function validMachine(m: Machine) {
  if (m.wheels.length !== m.links.length + 1) return false;
  return m.links.every((l, i) => {
    const a = m.wheels[i];
    const b = m.wheels[i + 1];
    if (l === "mesh") return a.kind === "gear" && b.kind === "gear";
    if (l === "axle") {
      // The pulley sits inside the gear on the same axle, so it is smaller.
      const [gear, pulley] = a.kind === "gear" ? [a, b] : [b, a];
      return a.kind !== b.kind && m.links[i - 1] !== "axle" && pulley.size <= gear.size - 6;
    }
    return a.kind === "pulley" && b.kind === "pulley";
  });
}

export const TEETH = [8, 10, 12, 15, 16, 18, 20, 24, 30, 32, 36, 40];
export const DIAMETERS = [8, 10, 12, 15, 16, 18, 20, 24, 25, 30, 32, 36, 40, 45, 48];

// ── Movers on a track ────────────────────────────────────────────────────

/** km with hours (cars and bikes) or metres with minutes (walkers and runners). */
export type Unit = "km" | "m";
export const UNIT: Record<Unit, { dist: string; time: string; speed: string }> = {
  km: { dist: "کیلومتر", time: "ساعت", speed: "کیلومتر در ساعت" },
  m: { dist: "متر", time: "دقیقه", speed: "متر در دقیقه" },
};

/** A mover on a straight track: from `start`, `speed` units per time unit, leaving at `delay`. */
export interface Mover {
  start: number;
  speed: number;
  dir: 1 | -1;
  delay: number;
}

/** Where a mover is at time t; it stops at the ends of the track. */
export function positionAt(m: Mover, t: number, length = Infinity) {
  const p = m.start + m.dir * m.speed * Math.max(0, t - m.delay);
  return Math.min(length, Math.max(0, p));
}

// ── Facing and the street grid ───────────────────────────────────────────

/** 0 = north, 1 = east, 2 = south, 3 = west (clockwise, like a compass). */
export type Compass = 0 | 1 | 2 | 3;
export const COMPASS = ["شمال", "شرق", "جنوب", "غرب"];
export const wrap4 = (n: number) => (((n % 4) + 4) % 4) as Compass;

/** A turn on the spot: `quarter` quarter-turns to the right or the left (2 = turn around). */
export interface TurnCmd {
  side: "R" | "L";
  quarter: 1 | 2 | 3;
}

export const turnBy = (t: TurnCmd) => (t.side === "R" ? t.quarter : -t.quarter);

/** Facing after the turns, one by one. */
export const faceAfter = (start: Compass, turns: TurnCmd[]) => wrap4(turns.reduce<number>((f, t) => f + turnBy(t), start));

/** Grid point; x grows to the east, y to the north. */
export interface Pt {
  x: number;
  y: number;
}
export const STEP: Pt[] = [
  { x: 0, y: 1 },
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
];

/** "go 3 north" (map directions), "forward 2", "turn right" (the walker's own directions). */
export type GridCmd = { kind: "go"; dir: Compass; n: number } | { kind: "fwd"; n: number } | { kind: "turn"; side: "R" | "L" };

/** Ways to read the commands wrongly, to find where each slip lands. */
export interface WalkSlip {
  swapLR?: boolean;
  swapEW?: boolean;
  swapNS?: boolean;
  noTurns?: boolean;
  skipLast?: boolean;
}

/** Every grid point the walker passes, from the start; and where it faces at the end. */
export function walkGrid(start: Pt, facing: Compass, cmds: GridCmd[], slip: WalkSlip = {}) {
  const path: Pt[] = [{ ...start }];
  let f = facing;
  const list = slip.skipLast ? cmds.slice(0, -1) : cmds;
  for (const c of list) {
    if (c.kind === "turn") {
      if (slip.noTurns) continue;
      const right = (c.side === "R") !== !!slip.swapLR;
      f = wrap4(f + (right ? 1 : -1));
      continue;
    }
    let d = c.kind === "go" ? c.dir : f;
    if (slip.swapEW && d % 2 === 1) d = wrap4(d + 2);
    if (slip.swapNS && d % 2 === 0) d = wrap4(d + 2);
    for (let i = 0; i < c.n; i++) {
      const p = path[path.length - 1];
      path.push({ x: p.x + STEP[d].x, y: p.y + STEP[d].y });
    }
  }
  return { path, facing: f };
}

/** Shortest routes along the streets of a w × h grid, corner to corner: (w + h)! / (w! h!). */
export function routes(w: number, h: number) {
  let r = 1;
  for (let i = 1; i <= h; i++) r = (r * (w + i)) / i;
  return Math.round(r);
}

// ── Questions ────────────────────────────────────────────────────────────

interface Base {
  level: Level;
  seed: number;
}

/** Which way does the last wheel turn? */
export interface GearDirQuestion extends Base {
  type: "gearDir";
  machine: Machine;
  driver: Rot;
  answer: Rot;
}

/** The first wheel turns `turns` times; how many turns does the last make? */
export interface GearTurnsQuestion extends Base {
  type: "gearTurns";
  machine: Machine;
  turns: number;
  answer: number;
}

/**
 * level 1: one mover covers `length` in `time` at `v1`; `ask` names the unknown.
 * level 2: A and B start at the two ends at once, towards each other; when (or how far from A's end) do they meet?
 * level 3: as level 2, but B leaves `delay` later; how long after A leaves do they meet?
 */
export interface TripQuestion extends Base {
  type: "trip";
  unit: Unit;
  ask: "time" | "dist" | "speed";
  length: number;
  v1: number;
  v2: number;
  delay: number;
  /** When they meet (or when the single mover arrives), from A's start. */
  time: number;
  answer: number;
}

/**
 * A (faster, `v1`) follows B (`v2`) the same way.
 * level 1: B is `gap` ahead when both start; when does A catch up?
 * level 2: B left the same place `delay` earlier (so it is v2 × delay ahead); when does A catch up?
 * level 3: B is `gap` ahead; when is A `lead` ahead of B?
 * Times are counted from A's start.
 */
export interface ChaseQuestion extends Base {
  type: "chase";
  unit: Unit;
  v1: number;
  v2: number;
  gap: number;
  delay: number;
  lead: number;
  answer: number;
}

/** Facing `start`, turn on the spot as told; which way do you face? */
export interface OrientQuestion extends Base {
  type: "orient";
  start: Compass;
  turns: TurnCmd[];
  answer: Compass;
}

/**
 * walk: map moves from `start`; which labelled point do you reach?
 * turtle: forward and turn, starting to face `facing`; which labelled point?
 * routes: how many shortest routes along the streets from corner to corner of a cols × rows grid?
 */
export interface GridQuestion extends Base {
  type: "grid";
  variant: "walk" | "turtle" | "routes";
  cols: number;
  rows: number;
  start: Pt;
  facing: Compass;
  cmds: GridCmd[];
  /** Four labelled points (walk and turtle); the answer is an index into them. */
  points: Pt[];
  answer: number;
}

export type MotionQuestion = GearDirQuestion | GearTurnsQuestion | TripQuestion | ChaseQuestion | OrientQuestion | GridQuestion;

/** What kind of answer a question wants: a turning direction, a compass direction, a labelled point or a number. */
export type AnswerKind = "rot" | "compass" | "point" | "number";
export function answerKind(q: MotionQuestion): AnswerKind {
  if (q.type === "gearDir") return "rot";
  if (q.type === "orient") return "compass";
  if (q.type === "grid") return q.variant === "routes" ? "number" : "point";
  return "number";
}

// ── Building questions ───────────────────────────────────────────────────

/** A gear train for direction questions: two gears; a chain of 3 … 6; or pulleys and belts, at least one crossed. */
function dirMachine(rng: Rng, level: Level): Machine {
  if (level < 3) {
    const n = level === 1 ? 2 : 3 + randInt(rng, 4);
    const wheels = Array.from({ length: n }, () => ({ kind: "gear" as const, size: pick(rng, TEETH) }));
    return { wheels, links: Array.from({ length: n - 1 }, () => "mesh" as const) };
  }
  for (;;) {
    const n = 3 + randInt(rng, 3);
    const first: WheelKind = rng() < 0.35 ? "gear" : "pulley";
    const wheels: Wheel[] = [{ kind: first, size: pick(rng, first === "gear" ? TEETH.filter((t) => t >= 20) : DIAMETERS) }];
    const links: Link[] = [];
    while (wheels.length < n) {
      const cur = wheels[wheels.length - 1];
      const canAxle = links[links.length - 1] !== "axle" && wheels.length < n - 1 && (cur.kind === "gear" ? cur.size >= 16 : cur.size <= 30);
      let link: Link;
      if (canAxle && rng() < 0.3) link = "axle";
      else link = cur.kind === "gear" ? "mesh" : rng() < 0.5 ? "cross" : "belt";
      let next: Wheel;
      if (link === "axle") {
        // The pulley sits inside the gear on the same axle, so it is smaller.
        next =
          cur.kind === "gear"
            ? { kind: "pulley", size: pick(rng, DIAMETERS.filter((d) => d <= cur.size - 6)) }
            : { kind: "gear", size: pick(rng, TEETH.filter((t) => t >= cur.size + 6)) };
      } else next = { kind: cur.kind, size: pick(rng, cur.kind === "gear" ? TEETH : DIAMETERS) };
      wheels.push(next);
      links.push(link);
    }
    const m = { wheels, links };
    if (!links.includes("cross") || !validMachine(m)) continue;
    return m;
  }
}

function gearDirQuestion(rng: Rng, level: Level, seed: number): GearDirQuestion {
  const machine = dirMachine(rng, level);
  const driver: Rot = rng() < 0.5 ? CW : CCW;
  return { type: "gearDir", level, seed, machine, driver, answer: dirOf(machine, machine.wheels.length - 1, driver) };
}

function gearTurnsQuestion(rng: Rng, level: Level, seed: number): GearTurnsQuestion {
  for (;;) {
    const k = 1 + randInt(rng, level === 1 ? 4 : 6);
    let machine: Machine;
    if (level === 1) {
      machine = { wheels: [pick(rng, TEETH), pick(rng, TEETH)].map((size) => ({ kind: "gear" as const, size })), links: ["mesh"] };
    } else if (level === 2) {
      machine = { wheels: [pick(rng, TEETH), pick(rng, TEETH), pick(rng, TEETH)].map((size) => ({ kind: "gear" as const, size })), links: ["mesh", "mesh"] };
    } else {
      const n = rng() < 0.6 ? 2 : 3;
      const wheels = Array.from({ length: n }, () => ({ kind: "pulley" as const, size: pick(rng, DIAMETERS) }));
      machine = { wheels, links: Array.from({ length: n - 1 }, () => (rng() < 0.5 ? "cross" : "belt")) };
    }
    const w = machine.wheels;
    const a = w[0].size;
    const c = w[w.length - 1].size;
    if (a === c || (k * a) % c !== 0) continue;
    const answer = (k * a) / c;
    if (answer > 60) continue;
    // Level 1: one gear is a whole number of times the other.
    if (level === 1 && a % c !== 0 && c % a !== 0) continue;
    // Level 2: the middle gear is different, so stopping at it is a different slip.
    if (level === 2 && (w[1].size === c || w[1].size === a)) continue;
    // Level 3: a ratio like 3 : 2, not a whole number of times.
    if (level === 3 && (a % c === 0 || c % a === 0)) continue;
    return { type: "gearTurns", level, seed, machine, turns: k, answer };
  }
}

/** Speeds and times that suit the unit. */
const speeds = (unit: Unit) => (unit === "km" ? [20, 30, 40, 50, 60, 70, 80, 90, 100] : [40, 50, 60, 70, 80, 90, 100, 120]);
const times = (unit: Unit) => (unit === "km" ? [1, 2, 3, 4, 5, 6] : [2, 3, 4, 5, 6, 8, 10]);

function tripQuestion(rng: Rng, level: Level, seed: number): TripQuestion {
  const unit: Unit = rng() < 0.6 ? "km" : "m";
  if (level === 1) {
    const v1 = pick(rng, speeds(unit));
    const time = pick(rng, times(unit).filter((t) => t > 1));
    const length = v1 * time;
    const ask = pick(rng, ["time", "dist", "speed"] as const);
    const answer = ask === "time" ? time : ask === "dist" ? length : v1;
    return { type: "trip", level, seed, unit, ask, length, v1, v2: 0, delay: 0, time, answer };
  }
  for (;;) {
    const v1 = pick(rng, speeds(unit));
    const v2 = pick(rng, speeds(unit));
    if (v1 === v2) continue;
    if (level === 2) {
      const time = pick(rng, times(unit));
      const length = (v1 + v2) * time;
      const ask = rng() < 0.5 ? "time" : "dist";
      return { type: "trip", level, seed, unit, ask, length, v1, v2, delay: 0, time, answer: ask === "time" ? time : v1 * time };
    }
    // Level 3: A alone for `delay`, then both close the rest together.
    const delay = 1 + randInt(rng, unit === "km" ? 2 : 3);
    const together = pick(rng, times(unit));
    const length = v1 * delay + (v1 + v2) * together;
    return { type: "trip", level, seed, unit, ask: "time", length, v1, v2, delay, time: delay + together, answer: delay + together };
  }
}

function chaseQuestion(rng: Rng, level: Level, seed: number): ChaseQuestion {
  const unit: Unit = rng() < 0.6 ? "km" : "m";
  for (;;) {
    const v2 = pick(rng, speeds(unit).slice(0, -2));
    const dv = pick(rng, unit === "km" ? [10, 20, 30] : [10, 20, 30, 40]);
    const v1 = v2 + dv;
    if (level === 1) {
      const t = pick(rng, times(unit));
      return { type: "chase", level, seed, unit, v1, v2, gap: dv * t, delay: 0, lead: 0, answer: t };
    }
    if (level === 2) {
      const delay = 1 + randInt(rng, 3);
      const gap = v2 * delay;
      if (gap % dv !== 0) continue;
      const t = gap / dv;
      if (t > 12) continue;
      return { type: "chase", level, seed, unit, v1, v2, gap, delay, lead: 0, answer: t };
    }
    const tg = 1 + randInt(rng, 4);
    const tl = 1 + randInt(rng, 3);
    if (tg === tl) continue;
    return { type: "chase", level, seed, unit, v1, v2, gap: dv * tg, delay: 0, lead: dv * tl, answer: tg + tl };
  }
}

function orientQuestion(rng: Rng, level: Level, seed: number): OrientQuestion {
  const start = randInt(rng, 4) as Compass;
  const side = () => (rng() < 0.5 ? "R" : "L") as "R" | "L";
  for (;;) {
    let turns: TurnCmd[];
    if (level === 1) turns = Array.from({ length: 1 + randInt(rng, 2) }, () => ({ side: side(), quarter: 1 as const }));
    else {
      const n = level === 2 ? 3 + randInt(rng, 2) : 4 + randInt(rng, 2);
      turns = Array.from({ length: n }, () => ({ side: side(), quarter: level === 3 && rng() < 0.35 ? (3 as const) : (1 as const) }));
      // One about-turn, never last, so a right or left turn follows it.
      turns[randInt(rng, n - 1)] = { side: side(), quarter: 2 };
      if (level === 3 && !turns.some((t) => t.quarter === 3)) continue;
    }
    const q: OrientQuestion = { type: "orient", level, seed, start, turns, answer: faceAfter(start, turns) };
    // Past level 1, the usual slips must all land somewhere else, so the feedback can tell them apart.
    if (level > 1 && slips(q).some(([, v]) => v === q.answer)) continue;
    return q;
  }
}

const COLS = 8;
const ROWS = 6;
const inGrid = (p: Pt, cols: number, rows: number) => p.x >= 0 && p.y >= 0 && p.x <= cols && p.y <= rows;
const samePt = (a: Pt, b: Pt) => a.x === b.x && a.y === b.y;

/** Where each grid slip lands (walk and turtle). */
export function gridSlipPoints(q: Pick<GridQuestion, "variant" | "start" | "facing" | "cmds">): [MotionTag, Pt][] {
  const end = (s: WalkSlip) => {
    const { path } = walkGrid(q.start, q.facing, q.cmds, s);
    return path[path.length - 1];
  };
  if (q.variant === "walk")
    return [
      ["eastWest", end({ swapEW: true })],
      ["northSouth", end({ swapNS: true })],
      ["skipLast", end({ skipLast: true })],
    ];
  return [
    ["swapped", end({ swapLR: true })],
    ["noTurns", end({ noTurns: true })],
    ["skipLast", end({ skipLast: true })],
  ];
}

function gridQuestion(rng: Rng, level: Level, seed: number): GridQuestion {
  if (level === 3) {
    const [cols, rows] = pick(rng, [
      [2, 2],
      [3, 2],
      [4, 2],
      [3, 3],
      [5, 2],
      [4, 3],
    ]);
    return { type: "grid", level, seed, variant: "routes", cols, rows, start: { x: 0, y: 0 }, facing: 0, cmds: [], points: [], answer: routes(cols, rows) };
  }
  for (;;) {
    const variant = level === 1 ? "walk" : "turtle";
    const facing = randInt(rng, 4) as Compass;
    const cmds: GridCmd[] = [];
    if (variant === "walk") {
      const n = 2 + randInt(rng, 2);
      let last = -1;
      for (let i = 0; i < n; i++) {
        let dir = randInt(rng, 4);
        // No two moves in a row along the same line, or the second just undoes the first.
        while (last >= 0 && dir % 2 === last % 2) dir = randInt(rng, 4);
        last = dir;
        cmds.push({ kind: "go", dir: dir as Compass, n: 1 + randInt(rng, 4) });
      }
    } else {
      const n = 2 + randInt(rng, 2);
      for (let i = 0; i < n; i++) {
        if (i) cmds.push({ kind: "turn", side: rng() < 0.5 ? "R" : "L" });
        cmds.push({ kind: "fwd", n: 1 + randInt(rng, 3) });
      }
    }
    const start = { x: randInt(rng, COLS + 1), y: randInt(rng, ROWS + 1) };
    const { path } = walkGrid(start, facing, cmds);
    if (!path.every((p) => inGrid(p, COLS, ROWS))) continue;
    const goal = path[path.length - 1];
    if (samePt(goal, start)) continue;
    const others: Pt[] = [];
    for (const [, p] of gridSlipPoints({ variant, start, facing, cmds }))
      if (inGrid(p, COLS, ROWS) && !samePt(p, goal) && !samePt(p, start) && !others.some((o) => samePt(o, p))) others.push(p);
    // Fill up to three wrong points with other street corners near the goal.
    let guard = 0;
    while (others.length < 3 && guard++ < 50) {
      const p = { x: goal.x + randInt(rng, 5) - 2, y: goal.y + randInt(rng, 5) - 2 };
      if (inGrid(p, COLS, ROWS) && !samePt(p, goal) && !samePt(p, start) && !others.some((o) => samePt(o, p))) others.push(p);
    }
    if (others.length < 3) continue;
    const points = shuffle(rng, [goal, ...others.slice(0, 3)]);
    return { type: "grid", level, seed, variant, cols: COLS, rows: ROWS, start, facing, cmds, points, answer: points.findIndex((p) => samePt(p, goal)) };
  }
}

export function makeMotionQuestion(type: MotionQuestionType, level: Level, seed: number): MotionQuestion {
  const rng = mulberry32(seed * 7 + level * 101 + type.length * 13 + type.charCodeAt(0));
  switch (type) {
    case "gearDir":
      return gearDirQuestion(rng, level, seed);
    case "gearTurns":
      return gearTurnsQuestion(rng, level, seed);
    case "trip":
      return tripQuestion(rng, level, seed);
    case "chase":
      return chaseQuestion(rng, level, seed);
    case "orient":
      return orientQuestion(rng, level, seed);
    case "grid":
      return gridQuestion(rng, level, seed);
  }
}

// ── Slips ────────────────────────────────────────────────────────────────

export type MotionTag =
  | "right"
  | "allSame"
  | "alwaysOpposite"
  | "crossIgnored"
  | "beltFlips"
  | "inverted"
  | "sameTurns"
  | "middleOnly"
  | "timesInstead"
  | "divideInstead"
  | "plusInstead"
  | "subtractedSpeeds"
  | "addedSpeeds"
  | "oneSpeed"
  | "half"
  | "otherSide"
  | "noDelay"
  | "fromLater"
  | "fromStart"
  | "gapOnly"
  | "leadOnly"
  | "swapped"
  | "aroundSwap"
  | "threeQuarter"
  | "fromNorth"
  | "eastWest"
  | "northSouth"
  | "skipLast"
  | "noTurns"
  | "edgesOnly"
  | "plusRoutes"
  | "timesRoutes"
  | "other";

/** Facing after the turns, read with a slip. */
function faceWith(q: OrientQuestion, slip: "swapped" | "aroundSwap" | "threeQuarter" | "fromNorth") {
  let f: number = slip === "fromNorth" ? 0 : q.start;
  let arounds = 0;
  for (const t of q.turns) {
    let { side, quarter } = t;
    if (quarter === 2) {
      arounds++;
      f += 2;
      continue;
    }
    if (slip === "swapped" || (slip === "aroundSwap" && arounds % 2 === 1)) side = side === "R" ? "L" : "R";
    if (slip === "threeQuarter" && quarter === 3) quarter = 1;
    f += side === "R" ? quarter : -quarter;
  }
  return wrap4(f);
}

/** Wrong answers with a known cause, in the order they are checked. */
export function slips(q: MotionQuestion): [MotionTag, number][] {
  switch (q.type) {
    case "gearDir": {
      const n = q.machine.wheels.length - 1;
      const crosses = q.machine.links.filter((l) => l === "cross").length;
      const belts = q.machine.links.filter((l) => l === "belt").length;
      return [
        ...(crosses % 2 ? [["crossIgnored", flip(q.answer)] as [MotionTag, number]] : []),
        ...(belts % 2 ? [["beltFlips", flip(q.answer)] as [MotionTag, number]] : []),
        ["allSame", q.driver],
        ...(n > 1 ? [["alwaysOpposite", flip(q.driver)] as [MotionTag, number]] : []),
      ];
    }
    case "gearTurns": {
      const w = q.machine.wheels;
      const a = w[0].size;
      const c = w[w.length - 1].size;
      return [
        ["inverted", (q.turns * c) / a],
        ["sameTurns", q.turns],
        ...(w.length > 2 ? [["middleOnly", (q.turns * a) / w[1].size] as [MotionTag, number]] : []),
      ];
    }
    case "trip": {
      if (q.level === 1) {
        if (q.ask === "time") return [["timesInstead", q.length * q.v1]];
        if (q.ask === "speed") return [["timesInstead", q.length * q.time]];
        return [
          ["divideInstead", q.v1 / q.time],
          ["plusInstead", q.v1 + q.time],
        ];
      }
      if (q.level === 2) {
        if (q.ask === "dist")
          return [
            ["half", q.length / 2],
            ["otherSide", q.v2 * q.time],
          ];
        return [
          ["subtractedSpeeds", q.length / Math.abs(q.v1 - q.v2)],
          ["oneSpeed", q.length / q.v1],
          ["oneSpeed", q.length / q.v2],
        ];
      }
      return [
        ["noDelay", q.length / (q.v1 + q.v2)],
        ["fromLater", q.time - q.delay],
        ["subtractedSpeeds", q.delay + (q.length - q.v1 * q.delay) / Math.abs(q.v1 - q.v2)],
      ];
    }
    case "chase": {
      const dv = q.v1 - q.v2;
      const add = q.v1 + q.v2;
      if (q.level === 1)
        return [
          ["addedSpeeds", q.gap / add],
          ["oneSpeed", q.gap / q.v1],
        ];
      if (q.level === 2)
        return [
          ["fromStart", q.answer + q.delay],
          ["addedSpeeds", q.gap / add],
        ];
      return [
        ["gapOnly", q.gap / dv],
        ["leadOnly", q.lead / dv],
        ["addedSpeeds", (q.gap + q.lead) / add],
      ];
    }
    case "orient":
      return [
        ...(q.level === 3 ? [["threeQuarter", faceWith(q, "threeQuarter")] as [MotionTag, number]] : []),
        ...(q.level > 1 ? [["aroundSwap", faceWith(q, "aroundSwap")] as [MotionTag, number]] : []),
        ["swapped", faceWith(q, "swapped")],
        ...(q.start !== 0 ? [["fromNorth", faceWith(q, "fromNorth")] as [MotionTag, number]] : []),
      ];
    case "grid": {
      if (q.variant === "routes")
        return [
          ["edgesOnly", 2],
          ["plusRoutes", q.cols + q.rows],
          ["timesRoutes", q.cols * q.rows],
        ];
      const out: [MotionTag, number][] = [];
      for (const [tag, p] of gridSlipPoints(q)) {
        const i = q.points.findIndex((x) => samePt(x, p));
        if (i >= 0) out.push([tag, i]);
      }
      return out;
    }
  }
}

/** Which slip an answer is, if any. */
export function motionMistake(q: MotionQuestion, value: number): MotionTag {
  if (value === q.answer) return "right";
  for (const [tag, v] of slips(q)) if (v !== q.answer && v === value) return tag;
  return "other";
}

// Tool 15: the shortest route on a map (Bebras style). Towns are dots on a
// 16 × 9 board, roads are straight lines between them that never cross, and
// every road carries a whole number: its length (km) or the minutes it takes.
// The number is what counts, not how long the line looks.
//
// level 1: shortest route from one town to another; the direct road is not it.
// level 2: a bigger map; or which road can close without making the trip
//          longer; or the shortest route that must pass through a town.
// level 3: visit every town and come home (a tiny travelling salesman, by
//          brute force); or the cheapest roads that still join every town
//          (minimum spanning tree).
// Every answer is unique: the best route (or set of roads) is the only one
// with that length, checked by brute force.

import type { Level, MotionTag } from "./motion";
import { pick, randInt, shuffle, type Rng } from "./random";

export const TOWN_NAMES = ["الف", "ب", "پ", "ت", "ث", "ج", "چ", "ح"];

export interface Town {
  x: number;
  y: number;
}
export interface Road {
  a: number;
  b: number;
  len: number;
}
export interface RoadMap {
  towns: Town[];
  roads: Road[];
}

/** km: the number is the length; min: the minutes it takes. */
export type MapUnit = "km" | "min";
export const MAP_UNIT: Record<MapUnit, string> = { km: "کیلومتر", min: "دقیقه" };

/**
 * short: shortest route from `from` to `to`.
 * close: which of four roads (`options`, road indices) can close without making the shortest route from `from` to `to` longer? (answer: index into options)
 * via: shortest route from `from` to `to` that passes through `via`.
 * tour: start at `from`, visit every other town, come back to `from`.
 * connect: fewest km of road that still join every town.
 */
export type MapVariant = "short" | "close" | "via" | "tour" | "connect";

export interface MapQuestion {
  type: "map";
  level: Level;
  seed: number;
  variant: MapVariant;
  unit: MapUnit;
  map: RoadMap;
  from: number;
  to: number;
  via: number;
  options: number[];
  answer: number;
}

// ── Geometry ─────────────────────────────────────────────────────────────

const d2 = (p: Town, q: Town) => Math.hypot(p.x - q.x, p.y - q.y);

/** Distance from p to the segment a–b. */
function segDist(p: Town, a: Town, b: Town) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

const orient = (a: Town, b: Town, c: Town) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));

/** Whether segments a–b and c–d cross (sharing an end is not crossing). */
function crosses(a: Town, b: Town, c: Town, d: Town) {
  return orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0;
}

/** Angle (degrees) at town o between the roads to p and q. */
function angleAt(o: Town, p: Town, q: Town) {
  const a = Math.atan2(p.y - o.y, p.x - o.x) - Math.atan2(q.y - o.y, q.x - o.x);
  const deg = Math.abs((a * 180) / Math.PI) % 360;
  return deg > 180 ? 360 - deg : deg;
}

export const midpoint = (m: RoadMap, r: Road) => ({ x: (m.towns[r.a].x + m.towns[r.b].x) / 2, y: (m.towns[r.a].y + m.towns[r.b].y) / 2 });

// ── Building a map ───────────────────────────────────────────────────────

/** Board area for towns: x 1.3 … 14.7, y 1.5 … 8.1, as a 4 × 3 grid of cells. */
const COLS = 4;
const ROWS = 3;
const CW = 3.35;
const CH = 2.2;

function connected(n: number, roads: Road[]) {
  const seen = new Set([0]);
  const stack = [0];
  while (stack.length) {
    const v = stack.pop()!;
    for (const r of roads) {
      const w = r.a === v ? r.b : r.b === v ? r.a : -1;
      if (w >= 0 && !seen.has(w)) {
        seen.add(w);
        stack.push(w);
      }
    }
  }
  return seen.size === n;
}

/**
 * A map of `n` towns and `edges` roads, lengths lo … hi (all different when
 * `distinct`), or null when this try does not work out. Roads never cross,
 * never pass close to another town, and their number labels keep apart.
 */
export function makeRoadMap(rng: Rng, n: number, edges: number, lo: number, hi: number, distinct = false): RoadMap | null {
  const cells = shuffle(
    rng,
    Array.from({ length: COLS * ROWS }, (_, i) => i),
  ).slice(0, n);
  const towns = cells.map((c) => ({
    x: Math.round((1.3 + ((c % COLS) + 0.5) * CW + (rng() - 0.5) * 1.3) * 100) / 100,
    y: Math.round((1.5 + (Math.floor(c / COLS) + 0.5) * CH + (rng() - 0.5) * 0.8) * 100) / 100,
  }));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (d2(towns[i], towns[j]) < 2.1) return null;
  // Short roads first; a road goes in when it crosses nothing, misses the other towns and leaves room at its ends.
  const pairs: [number, number][] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (d2(towns[i], towns[j]) <= 6.4) pairs.push([i, j]);
  pairs.sort((p, q) => d2(towns[p[0]], towns[p[1]]) - d2(towns[q[0]], towns[q[1]]));
  let roads: Road[] = [];
  for (const [a, b] of pairs) {
    const A = towns[a];
    const B = towns[b];
    if (roads.some((r) => r.a !== a && r.a !== b && r.b !== a && r.b !== b && crosses(A, B, towns[r.a], towns[r.b]))) continue;
    if (towns.some((t, k) => k !== a && k !== b && segDist(t, A, B) < 0.85)) continue;
    const tight = roads.some((r) => {
      for (const [o, p] of [
        [a, b],
        [b, a],
      ]) {
        const other = r.a === o ? r.b : r.b === o ? r.a : -1;
        if (other >= 0 && angleAt(towns[o], towns[p], towns[other]) < 30) return true;
      }
      return false;
    });
    if (tight) continue;
    roads.push({ a, b, len: 0 });
  }
  if (roads.length < edges || !connected(n, roads)) return null;
  // Take roads away at random, keeping every town reachable.
  let guard = 0;
  while (roads.length > edges && guard++ < 200) {
    const k = randInt(rng, roads.length);
    const rest = roads.filter((_, i) => i !== k);
    if (connected(n, rest)) roads = rest;
  }
  if (roads.length !== edges) return null;
  // Number labels sit on the middle of each road: keep them apart and off the towns.
  const m: RoadMap = { towns, roads };
  const mids = roads.map((r) => midpoint(m, r));
  for (let i = 0; i < mids.length; i++) {
    if (towns.some((t) => d2(t, mids[i]) < 1.0)) return null;
    for (let j = i + 1; j < mids.length; j++) if (d2(mids[i], mids[j]) < 1.2) return null;
  }
  const lens = distinct ? shuffle(rng, Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)).slice(0, edges) : roads.map(() => lo + randInt(rng, hi - lo + 1));
  if (lens.length < edges) return null;
  roads.forEach((r, i) => (r.len = lens[i]));
  // Sort roads by their towns, so the same map always lists them the same way.
  roads.sort((p, q) => p.a - q.a || p.b - q.b);
  return m;
}

// ── Routes ───────────────────────────────────────────────────────────────

/** The town at the other end of road r from town v. */
export const otherEnd = (r: Road, v: number) => (r.a === v ? r.b : r.a);

/** Index of the road joining towns a and b, or -1. */
export const roadBetween = (m: RoadMap, a: number, b: number) => m.roads.findIndex((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));

export interface Route {
  /** Towns in order, from first to last. */
  towns: number[];
  /** Road indices in order. */
  roads: number[];
  len: number;
}

/** Every route from s to t that visits no town twice (towns ≤ 8, so this stays small). */
export function simpleRoutes(m: RoadMap, s: number, t: number, closed = -1): Route[] {
  const out: Route[] = [];
  const towns = [s];
  const roads: number[] = [];
  const seen = new Set([s]);
  const go = (v: number, len: number) => {
    if (v === t) {
      out.push({ towns: [...towns], roads: [...roads], len });
      return;
    }
    m.roads.forEach((r, i) => {
      if (i === closed || (r.a !== v && r.b !== v)) return;
      const w = otherEnd(r, v);
      if (seen.has(w)) return;
      seen.add(w);
      towns.push(w);
      roads.push(i);
      go(w, len + r.len);
      towns.pop();
      roads.pop();
      seen.delete(w);
    });
  };
  go(s, 0);
  return out;
}

/** The shortest of some routes, and whether it is the only one that short. */
function best(routes: Route[]) {
  if (!routes.length) return null;
  const min = Math.min(...routes.map((r) => r.len));
  const all = routes.filter((r) => r.len === min);
  return { route: all[0], unique: all.length === 1 };
}

/** Shortest distance between every two towns (Floyd–Warshall); `closed` road left out. */
export function allDistances(m: RoadMap, closed = -1) {
  const n = m.towns.length;
  const d = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : Infinity)));
  m.roads.forEach((r, i) => {
    if (i === closed) return;
    d[r.a][r.b] = Math.min(d[r.a][r.b], r.len);
    d[r.b][r.a] = Math.min(d[r.b][r.a], r.len);
  });
  for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (d[i][k] + d[k][j] < d[i][j]) d[i][j] = d[i][k] + d[k][j];
  return d;
}

/** The only shortest route from s to t, or null when there is none or more than one. */
export function uniqueShortest(m: RoadMap, s: number, t: number, closed = -1): Route | null {
  const b = best(simpleRoutes(m, s, t, closed));
  return b && b.unique ? b.route : null;
}

/**
 * Greedy: from s, always take the shortest road to a town not visited yet,
 * until t is reached (or, with t = -1, until every town is visited). Null
 * when it gets stuck or two roads tie.
 */
export function greedyRoute(m: RoadMap, s: number, t: number): Route | null {
  const towns = [s];
  const roads: number[] = [];
  let len = 0;
  const n = m.towns.length;
  while (t >= 0 ? towns[towns.length - 1] !== t : towns.length < n) {
    const v = towns[towns.length - 1];
    const next = m.roads.map((r, i) => ({ r, i })).filter(({ r }) => (r.a === v || r.b === v) && !towns.includes(otherEnd(r, v)));
    if (!next.length) return null;
    const min = Math.min(...next.map(({ r }) => r.len));
    const ties = next.filter(({ r }) => r.len === min);
    if (ties.length > 1) return null;
    towns.push(otherEnd(ties[0].r, v));
    roads.push(ties[0].i);
    len += min;
  }
  return { towns, roads, len };
}

/** Fewest roads on any route s → t, and the lengths of the routes with that few. */
export function fewestRoads(routes: Route[]) {
  const k = Math.min(...routes.map((r) => r.roads.length));
  return { roads: k, lens: [...new Set(routes.filter((r) => r.roads.length === k).map((r) => r.len))] };
}

/** All orders of a list. */
export function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}

/** The best round trip from `home` through every other town: the order (home first and last) and its length, by trying every order. */
export function bestTour(m: RoadMap, home: number) {
  const d = allDistances(m);
  const others = m.towns.map((_, i) => i).filter((i) => i !== home);
  let min = Infinity;
  let ties = 0;
  let order: number[] = [];
  for (const p of permutations(others)) {
    const stops = [home, ...p, home];
    const len = stops.slice(1).reduce((s, v, i) => s + d[stops[i]][v], 0);
    if (len < min) {
      min = len;
      ties = 1;
      order = stops;
    } else if (len === min) ties++;
  }
  // Every round trip is counted twice, once each way round.
  return { order, len: min, unique: ties === 2 };
}

/** The best open trip from `home` through every other town, not coming back. */
export function bestOpenTrip(m: RoadMap, home: number) {
  const d = allDistances(m);
  const others = m.towns.map((_, i) => i).filter((i) => i !== home);
  let min = Infinity;
  for (const p of permutations(others)) {
    const stops = [home, ...p];
    min = Math.min(
      min,
      stops.slice(1).reduce((s, v, i) => s + d[stops[i]][v], 0),
    );
  }
  return min;
}

/** Greedy round trip: always on to the nearest town not visited yet (by the map's shortest distances), then home. Null on a tie. */
export function greedyTour(m: RoadMap, home: number) {
  const d = allDistances(m);
  const order = [home];
  let len = 0;
  while (order.length < m.towns.length) {
    const v = order[order.length - 1];
    const left = m.towns.map((_, i) => i).filter((i) => !order.includes(i));
    const min = Math.min(...left.map((i) => d[v][i]));
    const near = left.filter((i) => d[v][i] === min);
    if (near.length > 1) return null;
    order.push(near[0]);
    len += min;
  }
  len += d[order[order.length - 1]][home];
  return { order: [...order, home], len };
}

/** The roads driven on a round trip, leg by leg (each leg the only shortest route), or null when a leg has two shortest routes. */
export function tourRoads(m: RoadMap, order: number[]) {
  const roads: number[] = [];
  const towns = [order[0]];
  for (let i = 1; i < order.length; i++) {
    const r = uniqueShortest(m, order[i - 1], order[i]);
    if (!r) return null;
    roads.push(...r.roads);
    towns.push(...r.towns.slice(1));
  }
  return { roads, towns };
}

/** Kruskal: roads cheapest first, skipping any that closes a loop. `steps` says which roads were kept. */
export function cheapestJoin(m: RoadMap) {
  const parent = m.towns.map((_, i) => i);
  const find = (v: number): number => (parent[v] === v ? v : (parent[v] = find(parent[v])));
  const order = m.roads.map((_, i) => i).sort((p, q) => m.roads[p].len - m.roads[q].len);
  const steps: { road: number; kept: boolean }[] = [];
  let len = 0;
  for (const i of order) {
    const r = m.roads[i];
    const [a, b] = [find(r.a), find(r.b)];
    const kept = a !== b;
    if (kept) {
      parent[a] = b;
      len += r.len;
    }
    steps.push({ road: i, kept });
  }
  return { steps, len, kept: steps.filter((s) => s.kept).map((s) => s.road) };
}

/** The n − 1 cheapest roads, and the towns they leave out of the biggest joined group (none when they join every town). */
export function cheapestFew(m: RoadMap) {
  const n = m.towns.length;
  const roads = m.roads
    .map((_, i) => i)
    .sort((p, q) => m.roads[p].len - m.roads[q].len)
    .slice(0, n - 1);
  const parent = m.towns.map((_, i) => i);
  const find = (v: number): number => (parent[v] === v ? v : (parent[v] = find(parent[v])));
  for (const i of roads) parent[find(m.roads[i].a)] = find(m.roads[i].b);
  const size = new Map<number, number>();
  for (let v = 0; v < n; v++) size.set(find(v), (size.get(find(v)) ?? 0) + 1);
  const big = [...size].sort((p, q) => q[1] - p[1])[0][0];
  return { roads, len: roads.reduce((s, i) => s + m.roads[i].len, 0), left: m.towns.map((_, i) => i).filter((v) => find(v) !== big) };
}

// ── Dijkstra, step by step (show me) ─────────────────────────────────────

export interface DijkstraStep {
  /** The town settled in this step: the nearest of those not settled yet. */
  town: number;
  dist: number;
  /** The road it was reached by (-1 for the start). */
  road: number;
  /** Labels of its neighbours that got better: town, new distance, road. */
  updates: { town: number; dist: number; road: number }[];
}

/** "Nearest town first": settle the closest town, then see if going through it helps its neighbours. Ties go to the lower town index. */
export function dijkstraSteps(m: RoadMap, s: number): DijkstraStep[] {
  const n = m.towns.length;
  const dist = m.towns.map(() => Infinity);
  const via = m.towns.map(() => -1);
  const done = new Set<number>();
  dist[s] = 0;
  const steps: DijkstraStep[] = [];
  while (done.size < n) {
    let v = -1;
    for (let i = 0; i < n; i++) if (!done.has(i) && dist[i] < Infinity && (v < 0 || dist[i] < dist[v])) v = i;
    if (v < 0) break;
    done.add(v);
    const updates: DijkstraStep["updates"] = [];
    m.roads.forEach((r, i) => {
      if (r.a !== v && r.b !== v) return;
      const w = otherEnd(r, v);
      if (done.has(w) || dist[v] + r.len >= dist[w]) return;
      dist[w] = dist[v] + r.len;
      via[w] = i;
      updates.push({ town: w, dist: dist[w], road: i });
    });
    steps.push({ town: v, dist: dist[v], road: via[v], updates });
  }
  return steps;
}

/** Walk back from t along the roads Dijkstra came by: the route s → t. */
export function traceBack(m: RoadMap, steps: DijkstraStep[], t: number): Route {
  const road = new Map(steps.map((st) => [st.town, st.road]));
  const towns = [t];
  const roads: number[] = [];
  let len = 0;
  while (road.get(towns[0]) !== undefined && road.get(towns[0])! >= 0) {
    const r = road.get(towns[0])!;
    roads.unshift(r);
    len += m.roads[r].len;
    towns.unshift(otherEnd(m.roads[r], towns[0]));
  }
  return { towns, roads, len };
}

// ── Questions ────────────────────────────────────────────────────────────

/** Fewest roads between two towns, counting roads not km. */
function hops(m: RoadMap, s: number, t: number) {
  return Math.min(...simpleRoutes(m, s, t).map((r) => r.roads.length));
}

function shortQuestion(rng: Rng, level: Level, seed: number): MapQuestion | null {
  const unit: MapUnit = rng() < 0.6 ? "km" : "min";
  if (level === 1) {
    const m = makeRoadMap(rng, 5, 5 + randInt(rng, 3), 1, 9);
    if (!m) return null;
    const direct = m.roads[randInt(rng, m.roads.length)];
    const [from, to] = rng() < 0.5 ? [direct.a, direct.b] : [direct.b, direct.a];
    const routes = simpleRoutes(m, from, to);
    if (routes.length < 2 || routes.length > 3) return null;
    const b = best(routes);
    if (!b || !b.unique || b.route.roads.length < 2 || b.route.len >= direct.len) return null;
    return { type: "map", level, seed, variant: "short", unit, map: m, from, to, via: -1, options: [], answer: b.route.len };
  }
  const n = 6 + randInt(rng, 2);
  const m = makeRoadMap(rng, n, n + 2 + randInt(rng, 3), 2, 15);
  if (!m) return null;
  const from = randInt(rng, n);
  const to = randInt(rng, n);
  if (from === to || hops(m, from, to) < 2) return null;
  const routes = simpleRoutes(m, from, to);
  if (routes.length < 4) return null;
  const b = best(routes);
  if (!b || !b.unique) return null;
  // The route with the fewest roads is a trap: it is not the shortest.
  if (b.route.roads.length <= fewestRoads(routes).roads) return null;
  return { type: "map", level, seed, variant: "short", unit, map: m, from, to, via: -1, options: [], answer: b.route.len };
}

function closeQuestion(rng: Rng, level: Level, seed: number): MapQuestion | null {
  const n = 6 + randInt(rng, 2);
  const m = makeRoadMap(rng, n, n + 2 + randInt(rng, 3), 2, 15);
  if (!m) return null;
  const from = randInt(rng, n);
  const to = randInt(rng, n);
  if (from === to || hops(m, from, to) < 2) return null;
  const route = uniqueShortest(m, from, to);
  if (!route || route.roads.length < 3) return null;
  // Three roads on the best route (closing one still leaves a way through) and one road off it that touches the route.
  const on = shuffle(rng, route.roads).filter((i) => allDistances(m, i)[from][to] < Infinity);
  if (on.length < 3) return null;
  const off = m.roads.map((_, i) => i).filter((i) => !route.roads.includes(i) && (route.towns.includes(m.roads[i].a) || route.towns.includes(m.roads[i].b)));
  if (!off.length) return null;
  const options = shuffle(rng, [...on.slice(0, 3), pick(rng, off)]);
  const answer = options.findIndex((i) => !route.roads.includes(i));
  return { type: "map", level, seed, variant: "close", unit: rng() < 0.6 ? "km" : "min", map: m, from, to, via: -1, options, answer };
}

function viaQuestion(rng: Rng, level: Level, seed: number): MapQuestion | null {
  const n = 6 + randInt(rng, 2);
  const m = makeRoadMap(rng, n, n + 2 + randInt(rng, 3), 2, 15);
  if (!m) return null;
  const [from, to, via] = shuffle(
    rng,
    m.towns.map((_, i) => i),
  );
  if (hops(m, from, to) < 2) return null;
  const a = uniqueShortest(m, from, via);
  const b = uniqueShortest(m, via, to);
  if (!a || !b) return null;
  // The two halves share only the town in the middle, so the best route is one simple route.
  if (a.towns.some((t) => t !== via && b.towns.includes(t))) return null;
  const answer = a.len + b.len;
  // Without the stop the trip would be shorter, so forgetting it is a different answer.
  if (allDistances(m)[from][to] >= answer) return null;
  return { type: "map", level, seed, variant: "via", unit: rng() < 0.6 ? "km" : "min", map: m, from, to, via, options: [], answer };
}

function tourQuestion(rng: Rng, level: Level, seed: number): MapQuestion | null {
  const n = 4 + randInt(rng, 2);
  const m = makeRoadMap(rng, n, n + randInt(rng, n === 4 ? 2 : 3), 2, 15);
  if (!m) return null;
  const home = randInt(rng, n);
  const t = bestTour(m, home);
  if (!t.unique || !tourRoads(m, t.order)) return null;
  // Going always to the nearest town next must not be the best plan.
  const g = greedyTour(m, home);
  if (!g || g.len === t.len) return null;
  return { type: "map", level, seed, variant: "tour", unit: rng() < 0.6 ? "km" : "min", map: m, from: home, to: home, via: -1, options: [], answer: t.len };
}

function connectQuestion(rng: Rng, level: Level, seed: number): MapQuestion | null {
  const n = 5 + randInt(rng, 2);
  const m = makeRoadMap(rng, n, n + 2 + randInt(rng, 3), 1, 20, true);
  if (!m) return null;
  // Taking just the n − 1 cheapest roads must close a loop and leave a town out.
  if (!cheapestFew(m).left.length) return null;
  return { type: "map", level, seed, variant: "connect", unit: "km", map: m, from: 0, to: 0, via: -1, options: [], answer: cheapestJoin(m).len };
}

export function mapQuestion(rng: Rng, level: Level, seed: number): MapQuestion {
  // Pick the kind first, then try maps until one fits, so harder-to-build kinds come up as often.
  const r = randInt(rng, level === 2 ? 3 : 2);
  const build =
    level === 1 ? shortQuestion : level === 2 ? [shortQuestion, closeQuestion, viaQuestion][r] : [tourQuestion, connectQuestion][r];
  for (;;) {
    const q = build(rng, level, seed);
    if (q) return q;
  }
}

/** A map for explore and show me: six towns, nine roads, 1 … 9 km. */
export function exploreMap(rng: Rng): RoadMap {
  for (;;) {
    const m = makeRoadMap(rng, 6, 9, 1, 9);
    if (m) return m;
  }
}

// ── Slips ────────────────────────────────────────────────────────────────

/**
 * fewestRoads: the route with the fewest roads, not the shortest.
 * greedy: always the nearest town next.
 * forgotVia: the shortest route that skips the town on the way.
 * forgotReturn: the trip without the way home.
 * outAndBack: home between every two towns, so roads are counted twice.
 * spurOnce: a road that must be driven there and back, counted once.
 * onBest: a road on the best route (close).
 * cheapestFew: the n − 1 cheapest roads, though they close a loop.
 * allRoads: every road on the map.
 */
export function mapSlips(q: MapQuestion): [MotionTag, number][] {
  const m = q.map;
  const out: [MotionTag, number][] = [];
  switch (q.variant) {
    case "short": {
      const routes = simpleRoutes(m, q.from, q.to);
      for (const v of fewestRoads(routes).lens) out.push(["fewestRoads", v]);
      const g = greedyRoute(m, q.from, q.to);
      if (g) out.push(["greedy", g.len]);
      return out;
    }
    case "close":
      q.options.forEach((r, i) => {
        if (i !== q.answer) out.push(["onBest", i]);
      });
      return out;
    case "via": {
      out.push(["forgotVia", allDistances(m)[q.from][q.to]]);
      const through = simpleRoutes(m, q.from, q.to).filter((r) => r.towns.includes(q.via));
      for (const v of fewestRoads(through).lens) out.push(["fewestRoads", v]);
      const a = greedyRoute(m, q.from, q.via);
      const b = greedyRoute(m, q.via, q.to);
      if (a && b) out.push(["greedy", a.len + b.len]);
      return out;
    }
    case "tour": {
      const t = bestTour(m, q.from);
      const d = allDistances(m);
      out.push(["forgotReturn", bestOpenTrip(m, q.from)]);
      out.push(["forgotReturn", t.len - d[t.order[t.order.length - 2]][q.from]]);
      out.push(["forgotReturn", t.len - d[q.from][t.order[1]]]);
      const g = greedyTour(m, q.from);
      if (g) out.push(["greedy", g.len]);
      const roads = tourRoads(m, t.order);
      if (roads) for (const r of new Set(roads.roads.filter((r, i) => roads.roads.indexOf(r) !== i))) out.push(["spurOnce", t.len - m.roads[r].len]);
      out.push(["outAndBack", 2 * m.towns.reduce((s, _, i) => s + d[q.from][i], 0)]);
      return out;
    }
    case "connect": {
      out.push(["cheapestFew", cheapestFew(m).len]);
      const g = greedyRoute(m, 0, -1);
      if (g) out.push(["greedy", g.len]);
      out.push(["allRoads", m.roads.reduce((s, r) => s + r.len, 0)]);
      return out;
    }
  }
}

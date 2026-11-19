import { describe, expect, it } from "vitest";
import { answerKind, makeMotionQuestion, motionMistake, slips, type Level, type MotionQuestion } from "./motion";
import { cheapestFew, dijkstraSteps, traceBack, type MapQuestion, type RoadMap } from "./motion-map";

type Q = Extract<MotionQuestion, { type: "map" }>;
const LEVELS: Level[] = [1, 2, 3];

function ok(cond: boolean, what: string) {
  if (!cond) throw new Error(what);
}

// ── Independent checks: Dijkstra with a count of shortest routes, and brute force ──

/** Dijkstra from s (one road may be closed): distance to every town and how many different shortest routes reach it. */
function dijkstra(m: RoadMap, s: number, closed = -1) {
  const n = m.towns.length;
  const dist = Array(n).fill(Infinity);
  const ways = Array(n).fill(0);
  const done = Array(n).fill(false);
  dist[s] = 0;
  ways[s] = 1;
  for (;;) {
    let v = -1;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (v < 0 || dist[i] < dist[v])) v = i;
    if (v < 0) break;
    done[v] = true;
    m.roads.forEach((r, i) => {
      if (i === closed || (r.a !== v && r.b !== v)) return;
      const w = r.a === v ? r.b : r.a;
      if (dist[v] + r.len < dist[w]) {
        dist[w] = dist[v] + r.len;
        ways[w] = ways[v];
      } else if (dist[v] + r.len === dist[w]) ways[w] += ways[v];
    });
  }
  return { dist, ways };
}

/** Every route s → t that visits no town twice, as town lists with lengths. */
function allRoutes(m: RoadMap, s: number, t: number) {
  const out: { towns: number[]; len: number }[] = [];
  const walk = (path: number[], len: number) => {
    const v = path[path.length - 1];
    if (v === t) return void out.push({ towns: path, len });
    for (const r of m.roads) {
      const w = r.a === v ? r.b : r.b === v ? r.a : -1;
      if (w >= 0 && !path.includes(w)) walk([...path, w], len + r.len);
    }
  };
  walk([s], 0);
  return out;
}

function perms(xs: number[]): number[][] {
  return xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms(xs.filter((_, j) => j !== i)).map((p) => [x, ...p]));
}

function subsets(n: number, k: number): number[][] {
  if (k === 0) return [[]];
  if (n < k) return [];
  return [...subsets(n - 1, k), ...subsets(n - 1, k - 1).map((s) => [...s, n - 1])];
}

const isTree = (m: RoadMap, roads: number[]) => {
  const parent = m.towns.map((_, i) => i);
  const find = (v: number): number => (parent[v] === v ? v : (parent[v] = find(parent[v])));
  for (const i of roads) {
    const [a, b] = [find(m.roads[i].a), find(m.roads[i].b)];
    if (a === b) return false;
    parent[a] = b;
  }
  return roads.length === m.towns.length - 1;
};

function crossing(m: RoadMap, i: number, j: number) {
  const [p, q] = [m.roads[i], m.roads[j]];
  if (p.a === q.a || p.a === q.b || p.b === q.a || p.b === q.b) return false;
  const T = m.towns;
  const o = (a: number, b: number, c: number) => Math.sign((T[b].x - T[a].x) * (T[c].y - T[a].y) - (T[b].y - T[a].y) * (T[c].x - T[a].x));
  return o(p.a, p.b, q.a) * o(p.a, p.b, q.b) < 0 && o(q.a, q.b, p.a) * o(q.a, q.b, p.b) < 0;
}

function check(q: Q) {
  const m = q.map;
  const n = m.towns.length;
  ok(n >= 4 && n <= 8, "4 … 8 towns");
  ok(
    m.towns.every((t) => t.x >= 0.4 && t.x <= 15.6 && t.y >= 0.9 && t.y <= 8.6),
    "towns on the board",
  );
  ok(
    m.roads.every((r) => Number.isInteger(r.len) && r.len > 0 && r.a !== r.b),
    "whole road lengths",
  );
  for (let i = 0; i < m.roads.length; i++) for (let j = i + 1; j < m.roads.length; j++) ok(!crossing(m, i, j), "roads do not cross");
  ok(new Set(m.roads.map((r) => `${Math.min(r.a, r.b)}-${Math.max(r.a, r.b)}`)).size === m.roads.length, "one road per pair");
  ok(
    dijkstra(m, 0).dist.every((d) => d < Infinity),
    "every town can be reached",
  );
  const fromA = dijkstra(m, q.from);
  switch (q.variant) {
    case "short": {
      ok(q.answer === fromA.dist[q.to] && fromA.ways[q.to] === 1, "the only shortest route (Dijkstra)");
      const routes = allRoutes(m, q.from, q.to);
      ok(routes.filter((r) => r.len === q.answer).length === 1 && Math.min(...routes.map((r) => r.len)) === q.answer, "the only shortest route (brute force)");
      const fewest = Math.min(...routes.map((r) => r.towns.length));
      ok(routes.filter((r) => r.towns.length === fewest).every((r) => r.len > q.answer), "fewest roads is not shortest");
      if (q.level === 1) {
        ok(n === 5 && routes.length >= 2 && routes.length <= 3, "2 or 3 routes");
        ok(routes.some((r) => r.towns.length === 2), "a direct road");
      } else ok(n >= 6 && routes.length >= 4, "a bigger map");
      break;
    }
    case "close": {
      ok(q.level === 2 && q.options.length === 4 && new Set(q.options).size === 4, "four roads to choose from");
      const keeps = q.options.map((r) => dijkstra(m, q.from, r).dist[q.to]);
      keeps.forEach((d, i) => {
        if (i === q.answer) ok(d === fromA.dist[q.to], "closing the answer road changes nothing");
        else ok(d > fromA.dist[q.to] && d < Infinity, "closing any other makes the trip longer");
      });
      break;
    }
    case "via": {
      ok(q.level === 2 && q.via !== q.from && q.via !== q.to && q.from !== q.to, "three towns");
      const viaD = dijkstra(m, q.via);
      ok(q.answer === fromA.dist[q.via] + viaD.dist[q.to], "no route through the stop is shorter (Dijkstra)");
      ok(fromA.ways[q.via] === 1 && viaD.ways[q.to] === 1, "each half is the only shortest");
      const through = allRoutes(m, q.from, q.to).filter((r) => r.towns.includes(q.via));
      ok(through.filter((r) => r.len === q.answer).length === 1 && Math.min(...through.map((r) => r.len)) === q.answer, "the only best route through the stop (brute force)");
      ok(fromA.dist[q.to] < q.answer, "the stop costs something");
      break;
    }
    case "tour": {
      ok(q.level === 3 && (n === 4 || n === 5) && q.from === q.to, "home and 3 or 4 towns");
      const d = m.towns.map((_, i) => dijkstra(m, i).dist);
      const lens = perms(m.towns.map((_, i) => i).filter((i) => i !== q.from)).map((p) => [q.from, ...p, q.from].reduce((s, v, i, a) => (i ? s + d[a[i - 1]][v] : 0), 0));
      const min = Math.min(...lens);
      ok(min === q.answer, "best round trip (brute force)");
      ok(lens.filter((l) => l === min).length === 2, "only one best round trip (each way round)");
      break;
    }
    case "connect": {
      ok(q.level === 3 && (n === 5 || n === 6), "5 or 6 towns");
      const trees = subsets(m.roads.length, n - 1)
        .filter((s) => isTree(m, s))
        .map((s) => s.reduce((t, i) => t + m.roads[i].len, 0));
      const min = Math.min(...trees);
      ok(min === q.answer && trees.filter((t) => t === min).length === 1, "the only cheapest set of roads (brute force)");
      ok(cheapestFew(m).left.length > 0, "the cheapest few leave a town out");
      break;
    }
  }
  // Something for the feedback to name.
  const named = slips(q).filter(([, v]) => v !== q.answer);
  ok(named.length > 0, "at least one named slip");
}

describe("map questions", () => {
  it("is the same for the same seed", () => {
    for (const l of LEVELS) expect(makeMotionQuestion("map", l, 42)).toEqual(makeMotionQuestion("map", l, 42));
  });

  it("gives a sound map question for 10,000 seeds of every level", () => {
    const seen = new Set<string>();
    for (const level of LEVELS)
      for (let seed = 0; seed < 10_000; seed++) {
        const q = makeMotionQuestion("map", level, seed);
        try {
          ok(q.type === "map" && q.level === level, "type and level");
          if (q.type !== "map") continue;
          seen.add(`${level}${q.variant}`);
          ok(motionMistake(q, q.answer) === "right", "answer is right");
          if (answerKind(q) === "number") ok(Number.isInteger(q.answer) && q.answer > 0 && q.answer < 10_000, "a whole number that fits the pad");
          else ok([0, 1, 2, 3].includes(q.answer), "one of four roads");
          for (const [, v] of slips(q)) if (v !== q.answer) ok(motionMistake(q, v) !== "other", "slip is named");
          check(q);
        } catch (e) {
          throw new Error(`map level ${level} seed ${seed}: ${(e as Error).message}\n${JSON.stringify(q)}`);
        }
      }
    expect([...seen].sort()).toEqual(["1short", "2close", "2short", "2via", "3connect", "3tour"]);
  }, 240_000);

  it("labels towns nearest first and traces the route back", () => {
    for (let seed = 0; seed < 300; seed++) {
      const q = makeMotionQuestion("map", 2, seed) as MapQuestion;
      const steps = dijkstraSteps(q.map, q.from);
      const { dist } = dijkstra(q.map, q.from);
      ok(steps.length === q.map.towns.length, "every town settled");
      steps.forEach((s, i) => ok(s.dist === dist[s.town] && (i === 0 || s.dist >= steps[i - 1].dist), "settled in order, at the right distance"));
      const r = traceBack(q.map, steps, q.to);
      expect(r.towns[0]).toBe(q.from);
      expect(r.len).toBe(dist[q.to]);
    }
  });

  it("names the usual slips", () => {
    // الف–ب is 9 km straight, but الف–پ–ب is 3 + 4 = 7; الف–ت–ب is 5 + 5 = 10.
    const tri: RoadMap = {
      towns: [
        { x: 2, y: 4 },
        { x: 12, y: 4 },
        { x: 7, y: 2 },
        { x: 7, y: 7 },
      ],
      roads: [
        { a: 0, b: 1, len: 9 },
        { a: 0, b: 2, len: 3 },
        { a: 0, b: 3, len: 2 },
        { a: 1, b: 2, len: 4 },
        { a: 1, b: 3, len: 8 },
      ],
    };
    const short: Q = { type: "map", level: 1, seed: 0, variant: "short", unit: "km", map: tri, from: 0, to: 1, via: -1, options: [], answer: 7 };
    expect(motionMistake(short, 9)).toBe("fewestRoads");
    // Nearest first: الف → ت (2), then ت → ب (8): 10.
    expect(motionMistake(short, 10)).toBe("greedy");
    // Must pass ت: 2 + 8 = 10; without it, 7.
    const via: Q = { ...short, level: 2, variant: "via", via: 3, answer: 10 };
    expect(motionMistake(via, 7)).toBe("forgotVia");
    // Close الف–ت (off the best route) is right; الف–پ is on it.
    const close: Q = { ...short, level: 2, variant: "close", options: [2, 1, 3, 0], answer: 0 };
    expect(motionMistake(close, 1)).toBe("onBest");
    // Round trip from الف: الف–ت–ب–پ–الف = 2 + 8 + 4 + 3 = 17. Open: 2 + 8 + 4 = 14 (or الف پ ب ت = 15).
    const tour: Q = { ...short, level: 3, variant: "tour", to: 0, answer: 17 };
    expect(motionMistake(tour, 14)).toBe("forgotReturn");
    // Home between visits: 2 × (3 + 7 + 2) = 24.
    expect(motionMistake(tour, 24)).toBe("outAndBack");
    // Cheapest join: 2 + 3 + 4 = 9; all roads 26.
    const join: Q = { ...short, level: 3, variant: "connect", answer: 9 };
    expect(motionMistake(join, 26)).toBe("allRoads");
    // A dead end: ت hangs off ب by one road, driven there and back. الف–ب–ت–ب–پ–الف = 6 + 2 + 2 + 4 + 3 = 17.
    const spur: RoadMap = {
      towns: tri.towns,
      roads: [
        { a: 0, b: 1, len: 6 },
        { a: 0, b: 2, len: 3 },
        { a: 1, b: 2, len: 4 },
        { a: 1, b: 3, len: 2 },
      ],
    };
    const spurTour: Q = { ...tour, map: spur, answer: 17 };
    expect(motionMistake(spurTour, 15)).toBe("spurOnce");
    // Three cheapest roads 1 + 2 + 3 close the loop الف–ب–پ and leave ت out.
    const loop: RoadMap = {
      towns: tri.towns,
      roads: [
        { a: 0, b: 1, len: 1 },
        { a: 0, b: 2, len: 2 },
        { a: 1, b: 2, len: 3 },
        { a: 1, b: 3, len: 7 },
        { a: 2, b: 3, len: 5 },
      ],
    };
    expect(cheapestFew(loop).left).toEqual([3]);
    expect(motionMistake({ ...join, map: loop, answer: 8 }, 6)).toBe("cheapestFew");
  });
});

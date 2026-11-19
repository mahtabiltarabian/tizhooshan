"use client";

// The road map for tool 15, in board units (view 16 × 9): towns are labelled
// circles, roads are straight lines with their length in a box on the middle.
// A route is drawn thick and dashed and its number boxes get a heavy frame;
// a closed or skipped road gets a ✗; start, goal, stop and home carry a word
// under the town. Nothing depends on colour alone. Also the words for map
// questions: prompt, working and the feedback for each slip.

import {
  allDistances,
  bestTour,
  cheapestFew,
  cheapestJoin,
  MAP_UNIT,
  midpoint,
  roadBetween,
  TOWN_NAMES,
  tourRoads,
  uniqueShortest,
  type MapQuestion,
  type RoadMap,
  type Route,
} from "@/generators/motion-map";
import type { MotionTag } from "@/generators/motion";
import { fa } from "@/tools/registry";
import { BLUE, INK, ORANGE } from "./Pictures";

const r3 = (v: number) => Math.round(v * 1000) / 1000;
/** Keeps a sum left to right inside a Persian sentence. */
const ltr = (s: string) => `⁦${s}⁩`;

export const townFa = (i: number) => TOWN_NAMES[i];
export const roadFa = (m: RoadMap, i: number) => `${TOWN_NAMES[m.roads[i].a]}–${TOWN_NAMES[m.roads[i].b]}`;
/** "الف ← پ ← ت" */
export const routeFa = (towns: number[]) => towns.map(townFa).join(" ← ");
/** "۳ + ۴ = ۷" for the roads of a route, left to right. */
export const sumFa = (m: RoadMap, roads: number[]) => {
  const total = roads.reduce((s, i) => s + m.roads[i].len, 0);
  return ltr(roads.length > 1 ? `${roads.map((i) => fa(m.roads[i].len)).join(" + ")} = ${fa(total)}` : fa(total));
};

export interface TownLabel {
  text: string;
  /** Final (solid heavy frame) or for now (dashed frame). */
  final: boolean;
}

interface MapProps {
  map: RoadMap;
  /** Roads on the route, in order; a road listed twice is driven there and back. */
  used?: number[];
  /** Roads crossed out: closed, or skipped because they would close a loop. */
  crossed?: number[];
  /** Words under towns: «شروع», «مقصد», «سر راه», «خانه». */
  tags?: Map<number, string>;
  /** The town the route ends at now (a dashed ring). */
  current?: number | null;
  /** Number boxes over towns (show me). */
  labels?: Map<number, TownLabel>;
  /** Tap a town. */
  onTown?: (i: number) => void;
}

const halo = { stroke: "#efe5d3", strokeWidth: 4, paintOrder: "stroke" as const, vectorEffect: "non-scaling-stroke" as const };

type XY = { x: number; y: number };
function segDist(p: XY, a: XY, b: XY) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** The clearest of some spots round town i: farthest from roads, number boxes, towns and the `taken` spots. */
function clearSpot(m: RoadMap, i: number, offsets: [number, number][], taken: XY[]): XY {
  const t = m.towns[i];
  const mids = m.roads.map((r) => midpoint(m, r));
  let best: XY = { x: t.x + offsets[0][0], y: t.y + offsets[0][1] };
  let bestScore = -Infinity;
  for (const [dx, dy] of offsets) {
    const p = { x: t.x + dx, y: t.y + dy };
    if (p.x < 0.6 || p.x > 15.4 || p.y < 0.95 || p.y > 8.75) continue;
    const score = Math.min(
      ...m.roads.map((r) => segDist(p, m.towns[r.a], m.towns[r.b]) + 0.1),
      ...mids.map((q) => Math.hypot(p.x - q.x, p.y - q.y) - 0.45),
      ...m.towns.map((q, k) => (k === i ? 9 : Math.hypot(p.x - q.x, p.y - q.y) - 0.55)),
      ...taken.map((q) => Math.hypot(p.x - q.x, p.y - q.y) - 0.6),
    );
    if (score > bestScore + 1e-9) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

const TAG_SPOTS: [number, number][] = [
  [0, 0.92],
  [0, -0.92],
  [1.2, 0],
  [-1.2, 0],
  [0.95, 0.75],
  [-0.95, 0.75],
  [0.95, -0.75],
  [-0.95, -0.75],
];
const LABEL_SPOTS: [number, number][] = [
  [0.8, -0.78],
  [-0.8, -0.78],
  [0.8, 0.78],
  [-0.8, 0.78],
  [0, -1.0],
  [0, 1.0],
  [1.15, 0],
  [-1.15, 0],
];

export function MapG({ map: m, used = [], crossed = [], tags, current, labels, onTown }: MapProps) {
  const times = new Map<number, number>();
  for (const r of used) times.set(r, (times.get(r) ?? 0) + 1);
  return (
    <g>
      {/* Roads */}
      {m.roads.map((r, i) => {
        const a = m.towns[r.a];
        const b = m.towns[r.b];
        const on = times.has(i);
        return (
          <g key={`r${i}`}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#b9ad97" strokeWidth={7} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {on && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={BLUE} strokeWidth={9} strokeDasharray="14 7" strokeLinecap="butt" vectorEffect="non-scaling-stroke" />}
          </g>
        );
      })}
      {/* Number boxes on the roads */}
      {m.roads.map((r, i) => {
        const { x, y } = midpoint(m, r);
        const text = fa(r.len);
        const w = r3(0.42 + 0.27 * String(r.len).length);
        const on = times.has(i);
        const twice = (times.get(i) ?? 0) > 1;
        // The ✗ sits between the number box and one end, so the number stays readable.
        const A = m.towns[r.a];
        const cx = r3(A.x + (x - A.x) * 0.5);
        const cy = r3(A.y + (y - A.y) * 0.5);
        return (
          <g key={`l${i}`}>
            <rect x={r3(x - w / 2)} y={r3(y - 0.32)} width={w} height={0.64} rx={0.14} fill="#fff" stroke={INK} strokeWidth={on ? 3.5 : 1.5} vectorEffect="non-scaling-stroke" />
            <text x={r3(x)} y={r3(y + 0.02)} fontSize={0.46} fontWeight={on ? 800 : 600} textAnchor="middle" dominantBaseline="central" fill={INK}>
              {text}
            </text>
            {twice && (
              <text x={r3(x + w / 2 + 0.08)} y={r3(y - 0.38)} fontSize={0.36} fontWeight={800} textAnchor="start" dominantBaseline="central" fill={INK} {...halo}>
                ×{fa(2)}
              </text>
            )}
            {crossed.includes(i) && (
              <g>
                <line x1={r3(cx - 0.32)} y1={r3(cy - 0.32)} x2={r3(cx + 0.32)} y2={r3(cy + 0.32)} stroke={INK} strokeWidth={6} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                <line x1={r3(cx + 0.32)} y1={r3(cy - 0.32)} x2={r3(cx - 0.32)} y2={r3(cy + 0.32)} stroke={INK} strokeWidth={6} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                <line x1={r3(cx - 0.32)} y1={r3(cy - 0.32)} x2={r3(cx + 0.32)} y2={r3(cy + 0.32)} stroke={ORANGE} strokeWidth={3.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                <line x1={r3(cx + 0.32)} y1={r3(cy - 0.32)} x2={r3(cx - 0.32)} y2={r3(cy + 0.32)} stroke={ORANGE} strokeWidth={3.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </g>
            )}
          </g>
        );
      })}
      {/* Towns */}
      {m.towns.map((t, i) => {
        const tag = tags?.get(i);
        const label = labels?.get(i);
        const tagAt = tag ? clearSpot(m, i, TAG_SPOTS, []) : null;
        const labelAt = label ? clearSpot(m, i, LABEL_SPOTS, tagAt ? [tagAt] : []) : null;
        const lw = label ? r3(0.5 + 0.26 * label.text.length) : 0;
        return (
          <g key={`t${i}`}>
            {current === i && <circle cx={t.x} cy={t.y} r={0.74} fill="none" stroke={ORANGE} strokeWidth={3} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />}
            <circle cx={t.x} cy={t.y} r={0.52} fill={tag ? "#fff1c2" : "#fffaf0"} stroke={INK} strokeWidth={tag ? 3 : 2} vectorEffect="non-scaling-stroke" />
            <text x={t.x} y={r3(t.y + 0.03)} fontSize={0.46} fontWeight={800} textAnchor="middle" dominantBaseline="central" fill={INK}>
              {TOWN_NAMES[i]}
            </text>
            {tag && tagAt && (
              <text x={r3(tagAt.x)} y={r3(tagAt.y)} fontSize={0.34} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={INK} direction="rtl" {...halo}>
                {tag}
              </text>
            )}
            {label && labelAt && (
              <g>
                <rect
                  x={r3(labelAt.x - lw / 2)}
                  y={r3(labelAt.y - 0.3)}
                  width={lw}
                  height={0.6}
                  rx={0.3}
                  fill={label.final ? "#e3edff" : "#fff"}
                  stroke={INK}
                  strokeWidth={label.final ? 3 : 1.5}
                  strokeDasharray={label.final ? undefined : "4 3"}
                  vectorEffect="non-scaling-stroke"
                />
                <text x={r3(labelAt.x)} y={r3(labelAt.y + 0.01)} fontSize={0.4} fontWeight={800} textAnchor="middle" dominantBaseline="central" fill={INK} direction="rtl">
                  {label.text}
                </text>
              </g>
            )}
            {onTown && <circle cx={t.x} cy={t.y} r={0.95} fill="transparent" style={{ cursor: "pointer" }} onClick={() => onTown(i)} role="button" aria-label={`شهر ${TOWN_NAMES[i]}`} />}
          </g>
        );
      })}
    </g>
  );
}

// ── Questions on the board ───────────────────────────────────────────────

/** Words under the towns a question names. */
export function questionTags(q: MapQuestion) {
  const tags = new Map<number, string>();
  if (q.variant === "connect") return tags;
  if (q.variant === "tour") {
    tags.set(q.from, "خانه");
    return tags;
  }
  tags.set(q.from, "شروع");
  tags.set(q.to, "مقصد");
  if (q.variant === "via") tags.set(q.via, "سر راه");
  return tags;
}

/** The best route of a short, close or via question. */
export function bestRoute(q: MapQuestion): Route {
  if (q.variant === "via") {
    const a = uniqueShortest(q.map, q.from, q.via)!;
    const b = uniqueShortest(q.map, q.via, q.to)!;
    return { towns: [...a.towns, ...b.towns.slice(1)], roads: [...a.roads, ...b.roads], len: a.len + b.len };
  }
  return uniqueShortest(q.map, q.from, q.to)!;
}

/** The round trip of a tour question: towns passed and roads driven, in order. */
export function bestWalk(q: MapQuestion) {
  return tourRoads(q.map, bestTour(q.map, q.from).order)!;
}

/**
 * The working on the board after an answer, at playback f (0 … 1): roads
 * drawn so far, roads crossed out, and a line of text for the top.
 */
export function questionPlayback(q: MapQuestion, f: number): { used: number[]; crossed: number[]; caption: string; current: number | null } {
  const m = q.map;
  const u = MAP_UNIT[q.unit];
  if (q.variant === "connect") {
    const { steps } = cheapestJoin(m);
    // Stop once every town is joined.
    let last = 0;
    let kept = 0;
    for (; last < steps.length && kept < m.towns.length - 1; last++) if (steps[last].kept) kept++;
    const k = Math.min(last, Math.round(f * last));
    const shown = steps.slice(0, k);
    const now = shown[shown.length - 1];
    const keptRoads = shown.filter((s) => s.kept).map((s) => s.road);
    const caption = !now
      ? "ارزان‌ترین جاده‌ها اول"
      : `${roadFa(m, now.road)} (${fa(m.roads[now.road].len)}): ${now.kept ? "✓ برداشتیم" : "✗ دور می‌سازد، لازم نیست"}؛ جمع ${fa(keptRoads.reduce((s, i) => s + m.roads[i].len, 0))}`;
    return { used: keptRoads, crossed: shown.filter((s) => !s.kept).map((s) => s.road), caption, current: null };
  }
  const route = q.variant === "tour" ? bestWalk(q) : bestRoute(q);
  const k = Math.round(f * route.roads.length);
  const roads = route.roads.slice(0, k);
  const total = roads.reduce((s, i) => s + m.roads[i].len, 0);
  const closed = q.variant === "close" ? [q.options[q.answer]] : [];
  const caption = k === 0 ? (q.variant === "close" ? `جاده ${roadFa(m, q.options[q.answer])} بسته است` : `از ${townFa(q.from)} راه بیفت`) : `${routeFa(route.towns.slice(0, k + 1))}: ${fa(total)} ${u}`;
  return { used: roads, crossed: closed, caption, current: route.towns[k] };
}

// ── Words ────────────────────────────────────────────────────────────────

const intro = (q: MapQuestion) =>
  q.unit === "km" ? "عدد روی هر جاده طول آن به کیلومتر است (اندازه خط روی نقشه مهم نیست)." : "عدد روی هر جاده می‌گوید رد شدن از آن چند دقیقه طول می‌کشد.";
const askBest = (q: MapQuestion) => (q.unit === "km" ? "کوتاه‌ترین راه چند کیلومتر است؟" : "سریع‌ترین راه چند دقیقه طول می‌کشد؟");

export function mapPrompt(q: MapQuestion): string {
  const [A, B, C] = [townFa(q.from), townFa(q.to), q.via >= 0 ? townFa(q.via) : ""];
  switch (q.variant) {
    case "short":
      return `${intro(q)} از ${A} به ${B} می‌رویم. ${askBest(q)}`;
    case "close":
      return `${intro(q)} قرار است یکی از این چهار جاده برای تعمیر بسته شود: ${q.options.map((r) => roadFa(q.map, r)).join("، ")}. بستن کدام، بهترین راه از ${A} تا ${B} را طولانی‌تر نمی‌کند؟`;
    case "via":
      return `${intro(q)} از ${A} به ${B} می‌رویم، ولی سر راه باید به ${C} هم سر بزنیم. ${askBest(q)}`;
    case "tour": {
      const others = q.map.towns.map((_, i) => i).filter((i) => i !== q.from);
      return `${intro(q)} پستچی از ${A} راه می‌افتد، باید به همه شهرهای دیگر (${others.map(townFa).join("، ")}) سر بزند و به ${A} برگردد. از یک شهر یا یک جاده می‌شود دو بار رد شد. ${askBest(q)}`;
    }
    case "connect":
      return `عدد روی هر جاده طول آن به کیلومتر است. می‌خواهیم بعضی جاده‌ها را آسفالت کنیم، طوری که از هر شهر بشود فقط از راه آسفالت به هر شهر دیگر رفت. کمترین طولی که باید آسفالت شود چند کیلومتر است؟`;
  }
}

/** The working, in one or two sentences. */
export function mapHow(q: MapQuestion): string {
  const m = q.map;
  const u = MAP_UNIT[q.unit];
  switch (q.variant) {
    case "short": {
      const r = bestRoute(q);
      const direct = roadBetween(m, q.from, q.to);
      const tail = direct >= 0 ? ` جاده مستقیم ${roadFa(m, direct)} ${fa(m.roads[direct].len)} ${u} است: جاده کمتر همیشه کوتاه‌تر نیست.` : "";
      return `بهترین راه: ${routeFa(r.towns)}: ${sumFa(m, r.roads)} ${u}.${tail}`;
    }
    case "close": {
      const r = bestRoute(q);
      const ok = q.options[q.answer];
      const others = q.options
        .filter((x) => x !== ok)
        .map((x) => `${roadFa(m, x)} ← ${fa(allDistances(m, x)[q.from][q.to])}`)
        .join("، ");
      return `بهترین راه ${routeFa(r.towns)} است: ${sumFa(m, r.roads)} ${u}. جاده ${roadFa(m, ok)} روی این راه نیست، پس بستنش فرقی نمی‌کند. بستن بقیه، بهترین راه را بلندتر می‌کند: ${others}.`;
    }
    case "via": {
      const a = uniqueShortest(m, q.from, q.via)!;
      const b = uniqueShortest(m, q.via, q.to)!;
      return `${townFa(q.from)} تا ${townFa(q.via)}: ${routeFa(a.towns)} = ${fa(a.len)}؛ ${townFa(q.via)} تا ${townFa(q.to)}: ${routeFa(b.towns)} = ${fa(b.len)}؛ روی هم ${ltr(`${fa(a.len)} + ${fa(b.len)} = ${fa(q.answer)}`)} ${u}.`;
    }
    case "tour": {
      const w = bestWalk(q);
      const twice = [...new Set(w.roads.filter((r, i) => w.roads.indexOf(r) !== i))];
      const note = twice.length ? ` جاده ${twice.map((r) => roadFa(m, r)).join(" و ")} را باید رفت و برگشت.` : "";
      return `همه ترتیب‌ها را امتحان کن؛ بهترین دور: ${routeFa(w.towns)}: ${sumFa(m, w.roads)} ${u}.${note}`;
    }
    case "connect": {
      const { steps } = cheapestJoin(m);
      const out: string[] = [];
      let kept = 0;
      for (const s of steps) {
        if (kept === m.towns.length - 1) break;
        if (s.kept) kept++;
        out.push(`${roadFa(m, s.road)} ${fa(m.roads[s.road].len)} ${s.kept ? "✓" : "✗"}`);
      }
      return `ارزان‌ترین جاده را بردار، بعد ارزان‌ترین بعدی، ولی جاده‌ای را که با جاده‌های برداشته دور می‌سازد (✗) کنار بگذار: ${out.join("، ")}. جمع ✓ها: ${ltr(fa(q.answer))} کیلومتر.`;
    }
  }
}

/** What went wrong, for a named slip; `bad` when it is not a near miss. */
export function mapSlipText(q: MapQuestion, tag: MotionTag, v: number): { text: string; bad?: boolean } | null {
  const m = q.map;
  const u = MAP_UNIT[q.unit];
  switch (tag) {
    case "fewestRoads":
      return { text: "راهی را گرفتی که کمترین تعداد جاده را دارد. مهم جمع عددهاست، نه تعداد جاده‌ها: گاهی راهی با جاده‌های بیشتر کوتاه‌تر است." };
    case "greedy":
      if (q.variant === "tour") return { text: "هر بار به نزدیک‌ترین شهر بعدی رفتی. این روش ساده همیشه بهترین دور را نمی‌دهد؛ ترتیب‌های دیگر را هم امتحان کن." };
      if (q.variant === "connect") return { text: `از ${townFa(0)} شروع کردی و هر بار به نزدیک‌ترین شهر تازه رفتی؛ ولی جاده‌ها لازم نیست پشت سر هم باشند. ارزان‌ترین جاده‌ها را هر جای نقشه که هستند بردار.` };
      return { text: "هر بار کوتاه‌ترین جاده جلوی پایت را برداشتی. این کار همیشه به بهترین راه نمی‌رسد؛ راه‌ها را تا آخر جمع بزن و مقایسه کن." };
    case "forgotVia":
      return { text: `این بهترین راه بدون رفتن به ${townFa(q.via)} است. باید سر راه به ${townFa(q.via)} هم بروی.` };
    case "forgotReturn":
      return { text: `برگشت به ${townFa(q.from)} را فراموش کردی؛ دور وقتی تمام است که دوباره به ${townFa(q.from)} برسی.` };
    case "outAndBack":
      return { text: `لازم نیست بعد از هر شهر به ${townFa(q.from)} برگردی؛ این‌طوری جاده‌ها را دو بار رفته‌ای. از هر شهر یک‌راست به شهر بعدی برو.`, bad: true };
    case "spurOnce": {
      const t = bestTour(m, q.from);
      const w = tourRoads(m, t.order);
      const r = w?.roads.find((x, i) => w.roads.indexOf(x) !== i && t.len - m.roads[x].len === v);
      if (r === undefined) return null;
      const road = m.roads[r];
      const dead = m.roads.filter((x) => x.a === road.a || x.b === road.a).length === 1 ? road.a : road.b;
      return { text: `جاده ${roadFa(m, r)} را باید دو بار رفت: ${townFa(dead)} راه دیگری ندارد، پس رفت و برگشت از همین جاده است. تو آن را یک بار شمردی.` };
    }
    case "onBest": {
      const road = q.options[v];
      if (road === undefined) return null;
      const r = bestRoute(q);
      return { text: `جاده ${roadFa(m, road)} روی بهترین راه (${routeFa(r.towns)}) است. اگر بسته شود، بهترین راه ${fa(allDistances(m, road)[q.from][q.to])} ${u} می‌شود، نه ${fa(r.len)}.`, bad: true };
    }
    case "cheapestFew": {
      const c = cheapestFew(m);
      return { text: `ارزان‌ترین ${fa(m.towns.length - 1)} جاده را برداشتی، ولی چندتایشان با هم دور می‌سازند و ${c.left.map(townFa).join(" و ")} به بقیه وصل نمی‌شود. جاده‌ای که دور می‌سازد لازم نیست؛ به جایش ارزان‌ترین جاده‌ای را بردار که ${c.left.map(townFa).join(" و ")} را وصل کند.` };
    }
    case "allRoads":
      return { text: "همه جاده‌ها لازم نیستند: اگر بین دو شهر از دو راه بشود رفت، یکی از جاده‌ها اضافه است.", bad: true };
    default:
      return null;
  }
}

// ── Explore and show me ──────────────────────────────────────────────────

/** A route the pupil builds: is a road used twice, a town visited twice? */
export function routeFacts(m: RoadMap, towns: number[]) {
  const roads = towns.slice(1).map((t, i) => roadBetween(m, towns[i], t));
  const len = roads.reduce((s, i) => s + m.roads[i].len, 0);
  const roadTwice = roads.some((r, i) => roads.indexOf(r) !== i);
  return { roads, len, roadTwice };
}

/** Labels over the towns after k settled steps of "nearest town first". */
export function dijkstraLabels(steps: { town: number; dist: number; updates: { town: number; dist: number }[] }[], k: number) {
  const labels = new Map<number, TownLabel>();
  for (const s of steps.slice(0, k)) {
    labels.set(s.town, { text: fa(s.dist), final: true });
    for (const up of s.updates) if (!labels.get(up.town)?.final) labels.set(up.town, { text: `${fa(up.dist)}؟`, final: false });
  }
  // Before the first step, the start already has 0 for now.
  if (k === 0 && steps[0]) labels.set(steps[0].town, { text: `${fa(0)}؟`, final: false });
  return labels;
}


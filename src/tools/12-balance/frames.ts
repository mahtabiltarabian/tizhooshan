// Show-me frames for tool 12: each question becomes a list of pictures with
// one sentence each. Scales stay level through every step (taking the same
// thing off both pans keeps the balance); coins and bars have their own frames.

import {
  blocksFor,
  coinWeighings,
  emptyPan,
  panWeight,
  stagesOf,
  SYMBOLS,
  symCount,
  type AgeQuestion,
  type BalanceQuestion,
  type CoinQuestion,
  type FillQuestion,
  type Pan,
  type Scale,
  type Step,
  type Weighing,
} from "@/generators/balance";
import { fa } from "@/tools/registry";
import type { ColumnsFrame } from "./Columns";
import { exchangeFrames } from "./exchangeText";
import { meanFrames } from "./meanText";
import { tiltFor, type BarRow, type ItemView, type Part } from "./Pictures";
import type { AnyQ } from "./questions";

/** Keeps an equation left to right inside a Persian sentence, on one line. */
export const ltr = (s: string) => `⁦${s.replace(/ /g, " ")}⁩`;

export const glyph = (j: number) => SYMBOLS[j].glyph;

/** "●●● + ۵" */
export function panFa(p: Pan, empty = "۰"): string {
  const parts = p.s.map((c, j) => (c ? glyph(j).repeat(c) : "")).filter(Boolean);
  if (p.k) parts.push(fa(p.k));
  return parts.length ? parts.join(" + ") : empty;
}

export const scaleFa = (sc: Scale, emptyRight = "۰") => ltr(`${panFa(sc.left)} = ${panFa(sc.right, emptyRight)}`);

export interface ScaleView {
  left: ItemView[];
  right: ItemView[];
  tilt: number;
  label: string;
  focus?: boolean;
  locked?: boolean;
  ask?: "left" | "right";
}

export type Frame =
  | { kind: "scales"; scales: ScaleView[]; note: string }
  | { kind: "coins"; n: number; heavy: boolean; w: Weighing | null; alive: [number, number]; tilt: number; fake?: number; note: string }
  | { kind: "bars"; rows: BarRow[]; scale: number; caption?: string; note: string }
  | ColumnsFrame;

interface Overlay {
  removed?: Pan;
  ring?: number;
  /** Split a bare known weight into this many equal blocks. */
  split?: number;
}

export function itemsOf(p: Pan, o: Overlay = {}): ItemView[] {
  const out: ItemView[] = [];
  p.s.forEach((c, j) => {
    const cross = o.removed?.s[j] ?? 0;
    for (let i = 0; i < c; i++) out.push({ item: { sym: j }, crossed: i < cross, ring: o.ring === j });
  });
  if (p.k > 0) {
    const rk = o.removed?.k ?? 0;
    if (rk > 0) {
      out.push({ item: { w: rk }, crossed: true });
      if (p.k > rk) out.push({ item: { w: p.k - rk } });
    } else if (o.split && o.split > 1 && symCount(p) === 0) for (let i = 0; i < o.split; i++) out.push({ item: { w: p.k / o.split } });
    else out.push({ item: { w: p.k } });
  }
  return out;
}

const scaleLabel = (i: number, open: number) => (i === open ? "ترازوی پرسش" : `ترازوی ${fa(i + 1)}`);

function views(scales: Scale[], step: Step | null, open: number): ScaleView[] {
  return scales.map((sc, i) => {
    let lo: Overlay = {};
    let ro: Overlay = {};
    let focus = false;
    if (step?.op === "remove" && step.focus === i) {
      lo = ro = { removed: step.removed };
      focus = true;
    } else if (step?.op === "divide" && step.focus === i) {
      if (step.symLeft) ro = { split: step.times };
      else lo = { split: step.times };
      focus = true;
    } else if (step?.op === "value" && step.targets.includes(i)) {
      lo = ro = { ring: step.sym };
      focus = true;
    } else if (step?.op === "define" && step.focus === i) {
      lo = ro = { ring: step.sym };
      focus = true;
    }
    return {
      left: itemsOf(sc.left, lo),
      right: itemsOf(sc.right, ro),
      tilt: 0,
      label: scaleLabel(i, open),
      focus,
      locked: i === open,
      ask: i === open ? "right" : undefined,
    };
  });
}

/** One sentence for a stage. */
export function stepNote(step: Step, before: Scale[], open = -1): string {
  const name = (i: number) => scaleLabel(i, open);
  switch (step.op) {
    case "remove":
      return `از هر دو کفه‌ی ${name(step.focus)}، ${ltr(panFa(step.removed))} برمی‌داریم؛ ترازو باز هم متعادل است.`;
    case "divide": {
      const sc = before[step.focus];
      const y = step.symLeft ? sc.right : sc.left;
      const g = glyph(step.sym);
      if (symCount(y) === 0)
        return step.times === 1
          ? `در ${name(step.focus)} یک ${g} مانده: ${ltr(`${g} = ${fa(y.k)}`)}.`
          : `${fa(step.times)} تا ${g} با ${fa(y.k)} برابر است؛ ${fa(y.k)} را ${fa(step.times)} قسمت مساوی می‌کنیم: ${ltr(`${g} = ${fa(y.k)} ÷ ${fa(step.times)} = ${fa(y.k / step.times)}`)}.`;
      const half: Pan = { s: y.s.map((c) => c / step.times), k: y.k / step.times };
      return `${fa(step.times)} تا ${g} با ${ltr(panFa(y))} برابر است؛ پس یک ${g} با ${fa(step.times)} قسمت از آن برابر است: ${ltr(`${g} = ${panFa(half)}`)}.`;
    }
    case "value":
      return `هر ${glyph(step.sym)} ${fa(step.value)} است؛ به جای هر ${glyph(step.sym)} وزنه‌ی ${fa(step.value)} می‌گذاریم.`;
    case "define":
      return `${name(step.from)} می‌گوید ${ltr(`${glyph(step.sym)} = ${panFa(step.expr)}`)}؛ در ${name(step.focus)} به جای هر ${glyph(step.sym)} همین را می‌گذاریم (جایگزینی).`;
  }
}

// ── Balance and fill ────────────────────────────────────────────────────

export function balanceFrames(q: BalanceQuestion): Frame[] {
  const { stages } = stagesOf(q);
  const frames: Frame[] = [
    { kind: "scales", scales: views(q.scales, null, -1), note: `${q.n === 1 ? "ترازو متعادل است" : "همه‌ی ترازوها متعادل‌اند"}. هر کار را با هر دو کفه با هم می‌کنیم تا تعادل بماند.` },
  ];
  for (const s of stages) frames.push({ kind: "scales", scales: views(s.before, s.step, -1), note: stepNote(s.step, s.before) });
  const end = stages.length ? stages[stages.length - 1].after : q.scales;
  frames.push({ kind: "scales", scales: views(end, null, -1), note: `جواب: ${ltr(`${glyph(q.ask)} = ${fa(q.answer)}`)}.` });
  return frames;
}

/** The empty pan, filled: blocks, or circles. */
export function fillItems(q: FillQuestion, value: number, mine = false): ItemView[] {
  return q.fillWith === null ? blocksFor(value).map((w) => ({ item: { w }, mine })) : Array.from({ length: value }, () => ({ item: { sym: q.fillWith! }, mine }));
}

/** The scales of a fill question with what is on the empty pan. */
export function fillViews(q: FillQuestion, onPan: ItemView[], locked: boolean, tilt = 0): ScaleView[] {
  const open = q.scales.length;
  const vs = views([...q.scales, { left: q.target, right: emptyPan(q.n) }], null, open);
  vs[open] = { ...vs[open], right: onPan, locked, tilt };
  return vs;
}

/** What is on the empty pan, in the answer's unit (weight, or number of circles). */
export const fillValue = (q: FillQuestion, onPan: ItemView[]) =>
  onPan.reduce((t, v) => t + ("w" in v.item ? v.item.w : "sym" in v.item ? q.weights[v.item.sym] / (q.fillWith === null ? 1 : q.weights[q.fillWith]) : 0), 0);

export function fillFrames(q: FillQuestion, attempt?: number): Frame[] {
  const { stages } = stagesOf(q);
  const open = q.scales.length;
  const frames: Frame[] = [];
  if (attempt !== undefined) {
    const d = attempt - q.answer;
    frames.push({
      kind: "scales",
      scales: fillViews(q, fillItems(q, attempt), false, tiltFor(d * (q.fillWith === null ? 1 : q.weights[q.fillWith]))),
      note: d === 0 ? "ترازو را رها کردیم و متعادل ماند!" : `ترازو را رها کردیم: کفه‌ی ${d > 0 ? "تو سنگین‌تر است و پایین رفت" : "تو سبک‌تر است و بالا رفت"}. حالا قدم‌به‌قدم ببین.`,
    });
  }
  frames.push({
    kind: "scales",
    scales: fillViews(q, [], true),
    note: q.fillWith === null ? "ترازوی پرسش قفل است. اول وزن هر شکل را از ترازوهای دیگر پیدا می‌کنیم." : `ترازوی پرسش قفل است. همه‌چیز را به ${glyph(q.fillWith)} تبدیل می‌کنیم.`,
  });
  for (const s of stages) {
    const vs = views(s.before, s.step, open);
    vs[open] = { ...vs[open], locked: true };
    frames.push({ kind: "scales", scales: vs, note: stepNote(s.step, s.before, open) });
  }
  const end = stages.length ? stages[stages.length - 1].after : [...q.scales, { left: q.target, right: emptyPan(q.n) }];
  const vs = views(end, null, open);
  vs[open] = { ...vs[open], right: fillItems(q, q.answer), locked: false, ask: undefined };
  frames.push({ kind: "scales", scales: vs, note: `در کفه‌ی خالی ${answerUnit(q)} می‌گذاریم و ترازو را رها می‌کنیم: متعادل است.` });
  return frames;
}

export const answerUnit = (q: FillQuestion, v = q.answer) => (q.fillWith === null ? `${fa(v)} کیلو وزنه` : `${fa(v)} تا ${glyph(q.fillWith)}`);

// ── Coins ───────────────────────────────────────────────────────────────

const GROUP = ["آ", "ب", "ج"];

/** "۳ × ۳ × ۳ = ۲۷" */
export const powerFa = (k: number) => (k === 0 ? "۱" : k === 1 ? "۳" : `${Array(k).fill("۳").join(" × ")} = ${fa(3 ** k)}`);

export function coinFrames(q: CoinQuestion): Frame[] {
  const n = q.n;
  const path = coinWeighings(n, q.fake, q.heavy);
  const word = q.heavy ? "سنگین‌تر" : "سبک‌تر";
  const frames: Frame[] = [{ kind: "coins", n, heavy: q.heavy, w: null, alive: [0, n], tilt: 0, note: `${fa(n)} سکه؛ یکی ${word} است. سکه‌ها را سه گروه می‌کنیم، نه دو گروه.` }];
  path.forEach((w, i) => {
    const [a, b, c] = [w.a[1] - w.a[0], w.b[1] - w.b[0], w.c[1] - w.c[0]];
    frames.push({
      kind: "coins",
      n,
      heavy: q.heavy,
      w,
      alive: [w.from, w.to],
      tilt: 0,
      note: `وزن‌کشی ${fa(i + 1)}: گروه آ (${fa(a)}) در کفه چپ، گروه ب (${fa(b)}) در کفه راست${c ? `، گروه ج (${fa(c)}) بیرون` : ""}.`,
    });
    const lighterSide = w.tilt === 1 ? "چپ" : "راست";
    const where = w.tilt === 0 ? "ج" : (w.tilt === 1) === q.heavy ? "ب" : "آ";
    frames.push({
      kind: "coins",
      n,
      heavy: q.heavy,
      w,
      alive: [w.from, w.to],
      tilt: w.tilt * 10,
      note: w.tilt === 0 ? "ترازو متعادل ماند: تقلبی روی ترازو نیست، پس در گروه ج است." : `کفه ${lighterSide} بالا رفت؛ تقلبی ${word} است، پس در گروه ${where} است.`,
    });
  });
  const k = q.variant === "min" ? q.answer : q.k;
  frames.push({
    kind: "coins",
    n,
    heavy: q.heavy,
    w: null,
    alive: [q.fake, q.fake + 1],
    tilt: 0,
    fake: q.fake,
    note: `این بار با ${fa(path.length)} وزن‌کشی پیدا شد. هر وزن‌کشی سه جواب دارد (چپ، راست، تعادل)، پس ${fa(k)} وزن‌کشی از میان ${ltr(powerFa(k))} سکه پیدا می‌کند${q.variant === "min" && k > 1 ? ` ولی ${fa(k - 1)} وزن‌کشی فقط از میان ${fa(3 ** (k - 1))} سکه` : ""}.`,
  });
  return frames;
}

/** Group letter of a coin in a weighing. */
export function groupOf(w: Weighing | null, i: number): string | undefined {
  if (!w) return undefined;
  if (i >= w.a[0] && i < w.a[1]) return GROUP[0];
  if (i >= w.b[0] && i < w.b[1]) return GROUP[1];
  if (i >= w.c[0] && i < w.c[1]) return GROUP[2];
  return undefined;
}

/** Coins on a pan: one by one if few, else a pile with its count. */
export function coinPan(range: [number, number], tag: string): ItemView[] {
  const c = range[1] - range[0];
  return c <= 4 ? Array.from({ length: c }, (_, i) => ({ item: { coin: range[0] + i }, tag })) : [{ item: { pile: c }, tag }];
}

// ── Age bars ────────────────────────────────────────────────────────────

const unit = (label = "؟", crossed = false, years = 0): Part => ({ kind: "unit", years, label, crossed });
const extra = (years: number, crossed = false): Part => ({ kind: "extra", years, label: fa(years), crossed });
const units = (n: number, y: number, label = "؟", crossedFirst = 0) => Array.from({ length: n }, (_, i) => unit(label, i < crossedFirst, y));

export function ageFrames(q: AgeQuestion): Frame[] {
  const { older, younger, young: y, old: o, times: m, laterTimes: b, years: t } = q;
  const S = o + y;
  const D = o - y;
  const scale = 11 / (o + (q.variant === "later" ? t : 0));
  const f = (rows: BarRow[], note: string, caption?: string): Frame => ({ kind: "bars", rows, scale, note, caption });
  const final = `جواب: ${q.askOlder ? older : younger} ${fa(q.answer)} سال دارد.`;
  const yl = fa(y);
  switch (q.variant) {
    case "sumDiff":
      return [
        f([{ name: older, parts: [unit("؟", false, y), extra(D)] }, { name: younger, parts: [unit("؟", false, y)] }], `نوار ${older} ${fa(D)} سال بلندتر است. دو نوار روی هم ${fa(S)} سال است.`, `جمع = ${fa(S)}`),
        f(
          [{ name: older, parts: [unit("؟", false, y), extra(D, true)] }, { name: younger, parts: [unit("؟", false, y)] }],
          `تکه‌ی اضافه را کنار بگذار: ${ltr(`${fa(S)} − ${fa(D)} = ${fa(S - D)}`)}؛ این دو تکه‌ی برابر است.`,
          `دو تکه‌ی برابر = ${fa(S - D)}`,
        ),
        f([{ name: older, parts: [unit(yl, false, y), extra(D, true)] }, { name: younger, parts: [unit(yl, false, y)] }], `هر تکه: ${ltr(`${fa(S - D)} ÷ ۲ = ${yl}`)}. پس ${younger} ${yl} سال دارد.`),
        f([{ name: older, parts: [unit(yl, false, y), extra(D)] }, { name: younger, parts: [unit(yl, false, y)] }], `${older}: ${ltr(`${yl} + ${fa(D)} = ${fa(o)}`)}. ${final}`),
      ];
    case "timesSum":
      return [
        f([{ name: older, parts: units(m, y) }, { name: younger, parts: [unit("؟", false, y)] }], `${older} ${fa(m)} تکه‌ی برابر، ${younger} یک تکه. روی هم ${fa(m + 1)} تکه = ${fa(S)} سال.`, `جمع = ${fa(S)}`),
        f([{ name: older, parts: units(m, y, yl) }, { name: younger, parts: [unit(yl, false, y)] }], `هر تکه: ${ltr(`${fa(S)} ÷ ${fa(m + 1)} = ${yl}`)}.`),
        f([{ name: older, parts: units(m, y, yl) }, { name: younger, parts: [unit(yl, false, y)] }], `${older}: ${ltr(`${fa(m)} × ${yl} = ${fa(o)}`)}. ${final}`),
      ];
    case "timesDiff":
      return [
        f([{ name: older, parts: units(m, y) }, { name: younger, parts: [unit("؟", false, y)] }], `${older} ${fa(m)} تکه‌ی برابر، ${younger} یک تکه. ${older} ${fa(D)} سال بزرگ‌تر است.`, `اختلاف = ${fa(D)}`),
        f(
          [{ name: older, parts: units(m, y, "؟", 1) }, { name: younger, parts: [unit("؟", true, y)] }],
          `تکه‌ی مشترک را از هر دو کنار بگذار: ${fa(m - 1)} تکه می‌ماند که همان ${fa(D)} سال اختلاف است.`,
          `${fa(m - 1)} تکه = ${fa(D)}`,
        ),
        f([{ name: older, parts: units(m, y, yl) }, { name: younger, parts: [unit(yl, false, y)] }], `هر تکه: ${ltr(`${fa(D)} ÷ ${fa(m - 1)} = ${yl}`)}.`),
        f([{ name: older, parts: units(m, y, yl) }, { name: younger, parts: [unit(yl, false, y)] }], `${older}: ${ltr(`${fa(m)} × ${yl} = ${fa(o)}`)}. ${final}`),
      ];
    case "later": {
      const twice = (label: string, crossUnits: boolean, crossFirstT: boolean) =>
        Array.from({ length: b }, (_, i) => [unit(label, crossUnits, y), extra(t, crossFirstT && i === 0)]).flat();
      const laterName = `${fa(b)} × ${younger}`;
      return [
        f([{ name: older, parts: units(m, y) }, { name: younger, parts: [unit("؟", false, y)] }], `اکنون: ${older} ${fa(m)} تکه‌ی برابر، ${younger} یک تکه.`),
        f([{ name: older, parts: [...units(m, y), extra(t)] }, { name: younger, parts: [unit("؟", false, y), extra(t)] }], `${fa(t)} سال بعد، به هر دو نوار ${fa(t)} سال اضافه می‌شود.`),
        f(
          [{ name: older, parts: [...units(m, y), extra(t)] }, { name: laterName, parts: twice("؟", false, false) }],
          `آن موقع ${older} ${fa(b)} برابر ${younger} است: نوار بالا با ${fa(b)} بار (یک تکه + ${fa(t)}) هم‌اندازه است.`,
        ),
        f(
          [{ name: older, parts: [...units(m, y, "؟", b), extra(t, true)] }, { name: laterName, parts: twice("؟", true, true) }],
          `مثل ترازو، از هر دو نوار ${fa(b)} تکه و ${fa(t)} سال برمی‌داریم: ${fa(m - b)} تکه می‌ماند که ${ltr(`${fa(b - 1)} × ${fa(t)} = ${fa((b - 1) * t)}`)} سال است.`,
        ),
        f([{ name: older, parts: [...units(m, y, yl), extra(t)] }, { name: laterName, parts: twice(yl, false, false) }], `هر تکه: ${ltr(`${fa((b - 1) * t)} ÷ ${fa(m - b)} = ${yl}`)}. ${final}`),
      ];
    }
  }
}

/** Frames for any question; `attempt` adds the child's released pan first (fill). */
export function framesOf(q: AnyQ, attempt?: number): Frame[] {
  switch (q.type) {
    case "mean":
      return meanFrames(q);
    case "exchange":
      return exchangeFrames(q);
    case "balance":
      return balanceFrames(q);
    case "fill":
      return fillFrames(q, attempt);
    case "coin":
      return coinFrames(q);
    case "age":
      return ageFrames(q);
  }
}

/** For the fill check: weight of the target pan in the answer's unit. */
export const targetValue = (q: FillQuestion) => panWeight(q.target, q.weights) / (q.fillWith === null ? 1 : q.weights[q.fillWith]);


"use client";

// «نمودار ون با عدد» for tool 19: the words (facts, questions, steps,
// feedback that names the slip), the diagram with a number in every region,
// and the explore panel where the child writes the numbers.
// The diagram never relies on colour: every region shows its number, the
// circles carry their names (and totals), the outside is a labelled box, and
// the region being worked on is hatched and its number framed.

import { useState } from "react";
import { countSteps, refMask, regionsOf, sumOf, type CountStep, type Fact, type K, type Ref, type SlipTag, type VennCountQuestion } from "@/generators/venn-count";
import { NumberPad } from "@/toolkit/NumberPad";
import { fa } from "@/tools/registry";
import layout from "@/toolkit/ToolLayout.module.css";
import tryStyles from "@/toolkit/TryPanel.module.css";
import { ACCENT, CENTERS, Hatch, INK, PAPER, PEN, REGION_PT, regionAt, SOFT, TINTS, useSvgId, VENN_R } from "./Pictures";

/** Keeps a formula left to right inside a Persian sentence (no-break spaces). */
const ltr = (s: string) => `⁦${s.replace(/ /g, " ")}⁩`;

// ───────────── words ─────────────

interface CountWords {
  items: string[];
  set: (x: string) => string;
  only: (x: string) => string;
  two: string;
  pairOnly: (x: string, y: string, z: string) => string;
  pair: (x: string, y: string) => string;
  all3: string;
  none: (k: K) => string;
  some: (k: K) => string;
}

const howMany = (k: K) => (k === 2 ? "دو" : "سه");

/** Same order as the generator's themes (COUNT_THEME_COUNT). */
export const COUNT_THEMES: CountWords[] = [
  {
    items: ["فوتبال", "والیبال", "شنا"],
    set: (x) => `به کلاس ${x} می‌روند`,
    only: (x) => `فقط به کلاس ${x} می‌روند`,
    two: "به هر دو کلاس می‌روند",
    pairOnly: (x, y, z) => `فقط به کلاس ${x} و ${y} می‌روند (به ${z} نه)`,
    pair: (x, y) => `هم به کلاس ${x} می‌روند، هم ${y}`,
    all3: "به هر سه کلاس می‌روند",
    none: (k) => `به هیچ‌کدام از این ${howMany(k)} کلاس نمی‌روند`,
    some: (k) => `دست‌کم به یکی از این ${howMany(k)} کلاس می‌روند`,
  },
  {
    items: ["گربه", "ماهی", "طوطی"],
    set: (x) => `${x} دارند`,
    only: (x) => `فقط ${x} دارند`,
    two: "هر دو را دارند",
    pairOnly: (x, y, z) => `فقط ${x} و ${y} دارند (${z} ندارند)`,
    pair: (x, y) => `هم ${x} دارند، هم ${y}`,
    all3: "هر سه را دارند",
    none: (k) => `هیچ‌کدام از این ${howMany(k)} حیوان را ندارند`,
    some: (k) => `دست‌کم یکی از این ${howMany(k)} حیوان را دارند`,
  },
  {
    items: ["سیب", "انار", "هلو"],
    set: (x) => `${x} را دوست دارند`,
    only: (x) => `فقط ${x} را دوست دارند`,
    two: "هر دو را دوست دارند",
    pairOnly: (x, y, z) => `فقط ${x} و ${y} را دوست دارند (${z} را نه)`,
    pair: (x, y) => `هم ${x} را دوست دارند، هم ${y} را`,
    all3: "هر سه را دوست دارند",
    none: (k) => `هیچ‌کدام از این ${howMany(k)} میوه را دوست ندارند`,
    some: (k) => `دست‌کم یکی از این ${howMany(k)} میوه را دوست دارند`,
  },
];

type QLike = Pick<VennCountQuestion, "k" | "theme" | "items">;
const words = (q: QLike) => COUNT_THEMES[q.theme];
/** The names on the circles, in circle order. */
export const countNames = (q: QLike) => q.items.map((i) => words(q).items[i]);

/** What a count says about people: "فقط سیب را دوست دارند". */
export function refPred(q: QLike, ref: Ref): string {
  const w = words(q);
  const n = countNames(q);
  switch (ref.kind) {
    case "set":
      return w.set(n[ref.s]);
    case "only":
      return w.only(n[ref.s]);
    case "both":
      return w.two;
    case "pairOnly":
      return w.pairOnly(n[ref.s], n[ref.t], n[3 - ref.s - ref.t]);
    case "pair":
      return w.pair(n[ref.s], n[ref.t]);
    case "all3":
      return w.all3;
    case "union":
      return w.some(q.k);
    case "neither":
      return w.none(q.k);
    case "total":
      return "در کلاس هستند";
  }
}

/** A region's short name: "فقط سیب", "سیب و انار", "هر دو", "هیچ‌کدام". */
export function regionName(q: QLike, r: number): string {
  const n = countNames(q);
  if (r === 0) return "هیچ‌کدام (بیرون)";
  const ins = [0, 1, 2].filter((t) => t < q.k && (r >> t) & 1);
  if (ins.length === 1) return `فقط ${n[ins[0]]}`;
  if (ins.length === q.k) return q.k === 2 ? "هر دو (وسط)" : "هر سه (وسط)";
  return `فقط ${n[ins[0]]} و ${n[ins[1]]}`;
}

export const factText = (q: QLike, f: Fact) => (f.ref.kind === "total" ? `در کلاس ${fa(f.value)} دانش‌آموز هست` : `${fa(f.value)} نفر ${refPred(q, f.ref)}`);

export function countQuestionText(q: VennCountQuestion): string {
  const pred = refPred(q, q.ask);
  if (q.extreme === "minBoth") return `دست‌کم چند نفر ${pred}؟`;
  if (q.extreme) return `حداکثر چند نفر ${pred}؟`;
  return `چند نفر ${pred}؟`;
}

/** "دست‌کم ۴ نفر هر دو را دارند" (value already in Persian digits or a formula). */
export function answerSentence(q: VennCountQuestion, value: string): string {
  const pre = q.extreme === "minBoth" ? "دست‌کم " : q.extreme ? "حداکثر " : "";
  return `${pre}${value} نفر ${refPred(q, q.ask)}`;
}

export function countPrompt(q: VennCountQuestion): string {
  const total = q.facts.find((f) => f.ref.kind === "total");
  const rest = q.facts.filter((f) => f.ref.kind !== "total").map((f) => factText(q, f));
  const intro = total ? `${factText(q, total)}.` : "در یک کلاس:";
  // Three circles: longer sentences with commas inside, so «؛» between them.
  const note = q.facts.some((f) => f.ref.kind === "pair") ? ` («هم … هم …» یعنی همه کسانی که در هر دو دایره‌اند، با کسانی که ${words(q).all3}.)` : "";
  return `${intro} ${rest.join(q.k === 3 ? "؛ " : "، ")}.${note} ${countQuestionText(q)}`;
}

const plusJoin = (vs: number[]) => vs.map((v) => fa(v)).join(" + ");

/** One step of filling the diagram, in words. */
export function countStepText(q: VennCountQuestion, s: CountStep, known: readonly (number | null)[]): string {
  const name = (r: number) => `«${regionName(q, r)}»`;
  const fact = (i: number) => `«${factText(q, q.facts[i])}»`;
  switch (s.kind) {
    case "given":
      return s.region === 0 ? `${fact(s.fact)}: این‌ها بیرون همه دایره‌ها هستند؛ ${fa(s.value)} را در بخش ${name(0)} بنویس.` : `${fact(s.fact)}: این همان بخش ${name(s.region)} است؛ اول ${fa(s.value)} را آنجا بنویس.`;
    case "sub": {
      const minus = s.minus.map((r) => known[r] ?? 0);
      const formula = ltr(`${fa(q.facts[s.fact].value)} − ${minus.length > 1 ? `(${plusJoin(minus)})` : fa(minus[0])} = ${fa(s.value)}`);
      return `${fact(s.fact)}؛ بخش‌هایی را که پر کرده‌ایم کم کن: ${formula}. پس ${name(s.region)} ${fa(s.value)} نفر است.`;
    }
    case "inside":
      return s.outside === 0 && q.extreme
        ? `پس همه ${fa(s.value)} نفر کلاس داخل دایره‌ها هستند.`
        : `کل کلاس ${fa(q.facts[s.fact].value)} نفر است و ${fa(s.outside)} نفر بیرون دایره‌ها؛ پس داخل دایره‌ها ${ltr(`${fa(q.facts[s.fact].value)} − ${fa(s.outside)} = ${fa(s.value)}`)} نفرند.`;
    case "overlap": {
      const [A, B] = [q.facts[s.a].value, q.facts[s.b].value];
      return `${ltr(`${fa(A)} + ${fa(B)} = ${fa(A + B)}`)}، ولی داخل دایره‌ها فقط ${fa(s.inside)} نفرند؛ کسانی که در هر دو دایره‌اند دو بار شمرده شده‌اند: ${ltr(`${fa(A + B)} − ${fa(s.inside)} = ${fa(s.value)}`)} در بخش وسط.`;
    }
    case "spread": {
      const [, A, B] = q.facts.map((f) => f.value);
      if (s.extreme === "minBoth") return `برای اینکه «هر دو» کمترین باشد، دو دایره را تا جای ممکن از هم دور کن: هیچ‌کس بیرون نمی‌ماند، پس ${name(0)} صفر است.`;
      const small = A <= B ? 0 : 1;
      const what = s.extreme === "maxBoth" ? "«هر دو»" : "«هیچ‌کدام»";
      return `برای اینکه ${what} بیشترین باشد، دایره کوچک‌تر (${countNames(q)[small]}، ${fa(Math.min(A, B))} نفر) را کامل داخل دایره بزرگ‌تر بگذار: همه ${fa(Math.min(A, B))} نفر در بخش وسط.`;
    }
    case "answer": {
      const rs = regionsOf(refMask(q.k, q.ask));
      const formula = rs.length > 1 ? `${ltr(`${plusJoin(rs.map((r) => known[r] ?? 0))} = ${fa(s.value)}`)}` : fa(s.value);
      return `جواب: ${answerSentence(q, formula)}.`;
    }
  }
}

/** The answer key's "how": each region as it is filled. */
export function countHow(q: VennCountQuestion): string {
  const { steps } = countSteps(q);
  const parts: string[] = [];
  for (const s of steps) {
    if (s.kind === "given" || s.kind === "sub" || s.kind === "spread") parts.push(`${regionName(q, s.region)}: ${fa(s.value)}`);
    if (s.kind === "overlap") parts.push(`وسط: ${ltr(`${fa(q.facts[s.a].value)} + ${fa(q.facts[s.b].value)} − ${fa(s.inside)} = ${fa(s.value)}`)}`);
  }
  return parts.join(" · ");
}

// ───────────── feedback ─────────────

type Tone = "good" | "turned" | "bad";

export function countFeedback(q: VennCountQuestion, value: number): { tone: Tone; text: string } {
  const tag = q.answer === value ? "right" : (q.slips.find((s) => s.value === value)?.tag ?? "other");
  const n = countNames(q);
  const fact = (kind: Ref["kind"]) => q.facts.find((f) => f.ref.kind === kind)?.value ?? 0;
  const sets = q.facts.filter((f) => f.ref.kind === "set");
  const [N, d] = [fact("total"), fact("neither")];
  const middle = q.k === 2 ? "بخش مشترک (هر دو)" : "بخش وسط (هر سه)";
  const sumRaw = sets.map((f) => fa(f.value)).join(" + ");
  const sum = ltr(sumRaw);
  const inside = sumOf(countSteps(q).known.map((v) => v ?? 0), refMask(q.k, { kind: "union" }));
  const asked = q.ask.kind === "only" ? n[q.ask.s] : n[0];
  const setFact = q.facts.find((f) => f.ref.kind === "set" && (q.ask.kind !== "only" || f.ref.s === q.ask.s));
  const [lo, hi] = sets.length === 2 ? [Math.min(sets[0].value, sets[1].value), Math.max(sets[0].value, sets[1].value)] : [0, 0];
  const SLIP: Record<SlipTag, string> = {
    addedNoOverlap: `عدد دایره‌ها را جمع زدی (${sum}) و ${middle} را کم نکردی. کسانی که در بیش از یک دایره‌اند، با این جمع بیش از یک بار شمرده می‌شوند.`,
    totalAsOnly: `«${setFact ? factText(q, setFact) : ""}» یعنی همه آدم‌های آن دایره، با کسانی که در بخش مشترک هم هستند؛ این عدد «فقط» آن دایره نیست. بخش مشترک را از آن کم کن.`,
    forgotOutside: `بیرون دایره‌ها را فراموش کردی: ${fa(d)} نفر ${refPred(q, { kind: "neither" })}، ولی جزو ${fa(N)} نفر کلاس‌اند. داخل دایره‌ها ${ltr(`${fa(N)} − ${fa(d)}`)} نفرند.`,
    doubleSubtract:
      q.k === 2
        ? `${middle} را دو بار کم کردی. در جمع دو دایره، وسط فقط یک بار اضافه شمرده شده؛ پس فقط یک بار کمش کن.`
        : `${middle} را دو بار کم کردی. وقتی «فقط»ِ یک دایره را حساب می‌کنی، از عدد آن دایره بخش‌های دوتایی‌اش و وسط را هر کدام فقط یک بار کم کن.`,
    forgotMiddle: `کسانی که در هر سه دایره‌اند را کم نکردی. آن‌ها هم داخل ${q.ask.kind === "only" ? `دایره ${asked}` : "هر دایره"} هستند، ولی «فقط» یک دایره نیستند؛ وسط را هم کم کن.`,
    pairAsOnly: `عدد «هم … هم …» همه کسانی است که در آن دو دایره‌اند، با کسانی که در هر سه‌اند. برای بخش «فقط این دو» باید وسط را از آن کم کنی.`,
    insideNotOutside: "این تعداد کسانی است که دست‌کم در یک دایره‌اند (داخل دایره‌ها). پرسیده شده چند نفر بیرون همه دایره‌ها هستند: کل کلاس منهای داخل.",
    otherPart: `این «فقط ${q.ask.kind === "only" ? n[1 - q.ask.s] : ""}» است، نه «فقط ${asked}». دایره درست را نگاه کن.`,
    partNotBoth:
      value === inside
        ? `${fa(value)} همه کسانی است که دست‌کم در یک دایره‌اند (داخل دایره‌ها). «هر دو» فقط بخش وسط است، جایی که دو دایره روی هم افتاده‌اند.`
        : `${fa(value)} یکی از بخش‌های «فقط» است. «هر دو» فقط بخش وسط است، جایی که دو دایره روی هم افتاده‌اند.`,
    minMax: q.extreme === "minBoth" ? "این بیشترین مقدار ممکن است، نه کمترین." : "این کمترین مقدار ممکن است، نه بیشترین.",
    forgotTotal: `اگر دو گروه کاملاً جدا باشند، ${ltr(`${sumRaw} = ${fa(lo + hi)}`)} نفر لازم است؛ ولی کلاس فقط ${fa(N)} نفر دارد. آن‌هایی که اضافه می‌آیند حتماً در هر دو هستند.`,
    biggerSet:
      q.extreme === "maxBoth"
        ? `بخش «هر دو» داخل هر دو دایره است، پس از دایره کوچک‌تر (${fa(lo)} نفر) بزرگ‌تر نمی‌شود.`
        : `بیرونی‌ها وقتی بیشترین‌اند که داخل دایره‌ها کمترین باشد: دایره کوچک داخل دایره بزرگ. آن وقت داخل دایره‌ها ${fa(hi)} نفرند، نه ${fa(lo)}.`,
  };
  if (tag === "right") return { tone: "good", text: `درست است! ${answerSentence(q, fa(q.answer))}. روی نمودار، بخش‌هایی که از سؤال درمی‌آیند پر شده‌اند.` };
  if (tag === "other")
    return {
      tone: "bad",
      text: q.extreme ? "هنوز نه. دو دایره را در ذهنت جابه‌جا کن: کی بخش وسط کوچک‌تر (یا بزرگ‌تر) می‌شود؟" : "هنوز نه. روی نمودار عدد بنویس: اول بخش وسط، بعد «فقط»ها با تفریق، آخر بیرون دایره‌ها.",
    };
  return { tone: "turned", text: SLIP[tag] };
}

// ───────────── picture ─────────────

/** The box around the circles (the class). */
const BOX: Record<K, [number, number, number, number]> = {
  2: [-3.1, -2.35, 6.2, 4.6],
  3: [-3.1, -2.95, 6.2, 6.6],
};
const OUT_AT: Record<K, [number, number]> = { 2: [-2.45, 1.85], 3: [-2.35, 2.85] };
const round = (v: number) => Math.round(v * 10000) / 10000;

export const countView = (k: K, caption = false): [number, number, number, number] => {
  const [x, y, w, h] = BOX[k];
  return [x - 0.1, y - 0.1, w + 0.2, round(h + 0.2 + (caption ? 0.55 : 0))];
};

interface CountFigureProps {
  names: readonly string[];
  /** The number in each region; null: not written. */
  values: readonly (number | null)[];
  /** Circle totals for the labels: "سیب (۲۵)". */
  totals?: readonly (number | null)[];
  /** The class size, on the box. */
  total?: number | null;
  /** Regions to hatch (the asked count, or the part a step is about). */
  hatch?: number;
  /** The region whose number is framed (selected, or the step's). */
  focus?: number | null;
  /** Regions that show «؟» while empty. */
  ask?: number;
  onRegion?: (r: number) => void;
  caption?: string;
}

export function CountVennFigure({ names, values, totals, total, hatch = 0, focus = null, ask = 0, onRegion, caption }: CountFigureProps) {
  const id = useSvgId("t19n");
  const k = names.length as K;
  const centers = CENTERS[k];
  const [bx, by, bw, bh] = BOX[k];
  const regions = Array.from({ length: 1 << k }, (_, r) => r);

  /** One region, filled: inside its circles (nested clips), outside the others (mask). */
  const region = (r: number, fill: string) => {
    let el = <rect x={bx} y={by} width={bw} height={bh} fill={fill} mask={`url(#${id}m${r})`} />;
    for (let t = 0; t < k; t++) if ((r >> t) & 1) el = <g clipPath={`url(#${id}c${t})`}>{el}</g>;
    return <g key={`h${r}`}>{el}</g>;
  };

  const click = (e: React.MouseEvent<SVGRectElement>) => {
    const ctm = e.currentTarget.getScreenCTM();
    if (!ctm || !onRegion) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    onRegion(regionAt(k, p.x, p.y));
  };

  const spot = (r: number): [number, number] => (r === 0 ? OUT_AT[k] : REGION_PT[k][r]);
  const label = (t: number): [number, number] => {
    const [cx, cy] = centers[t];
    return t === 2 ? [cx, round(cy + VENN_R + 0.35)] : [cx, round(cy - VENN_R - 0.27)];
  };

  return (
    <g>
      <defs>
        <Hatch id={`${id}h`} color={PEN} gap={0.2} />
        {centers.map(([cx, cy], t) => (
          <clipPath key={t} id={`${id}c${t}`}>
            <circle cx={cx} cy={cy} r={VENN_R} />
          </clipPath>
        ))}
        {regions.map((r) => (
          <mask key={r} id={`${id}m${r}`} maskUnits="userSpaceOnUse" x={bx} y={by} width={bw} height={bh}>
            <rect x={bx} y={by} width={bw} height={bh} fill="#fff" />
            {centers.map(([cx, cy], t) => ((r >> t) & 1 ? null : <circle key={t} cx={cx} cy={cy} r={VENN_R} fill="#000" />))}
          </mask>
        ))}
      </defs>

      {/* The class: a box; the outside region is the box minus the circles */}
      <rect x={bx} y={by} width={bw} height={bh} rx={0.2} fill={PAPER} stroke={INK} strokeWidth={0.04} />
      {centers.map(([cx, cy], t) => (
        <circle key={`f${t}`} cx={cx} cy={cy} r={VENN_R} fill={TINTS[t]} opacity={0.35} />
      ))}
      {regions.filter((r) => (hatch >> r) & 1).map((r) => region(r, `url(#${id}h)`))}
      {centers.map(([cx, cy], t) => (
        <circle key={`o${t}`} cx={cx} cy={cy} r={VENN_R} fill="none" stroke={INK} strokeWidth={0.045} />
      ))}

      {names.map((name, t) => {
        const [lx, ly] = label(t);
        const v = totals?.[t];
        return (
          <text key={t} x={lx} y={ly} dy="0.35em" fontSize={0.34} fontWeight={800} textAnchor="middle" fill={INK}>
            {v === null || v === undefined ? name : `${name} (${fa(v)})`}
          </text>
        );
      })}
      <text x={OUT_AT[k][0]} y={round(OUT_AT[k][1] - 0.45)} dy="0.35em" fontSize={0.24} fontWeight={700} textAnchor="middle" fill={SOFT}>
        هیچ‌کدام
      </text>
      {total !== null && total !== undefined && (
        <text x={round(bx + bw - 0.75)} y={round(by + bh - 0.22)} fontSize={0.28} fontWeight={800} textAnchor="middle" fill={INK}>
          {`کل: ${fa(total)}`}
        </text>
      )}

      {regions.map((r) => {
        const [px, py] = spot(r);
        const v = values[r];
        const asked = !!((ask >> r) & 1) && v === null;
        const framed = focus === r;
        if (v === null && !asked && !framed) return null;
        return (
          <g key={`v${r}`} pointerEvents="none">
            {framed && <rect x={round(px - 0.42)} y={round(py - 0.3)} width={0.84} height={0.6} rx={0.12} fill={PAPER} stroke={ACCENT} strokeWidth={0.07} />}
            <text x={px} y={py} dy="0.35em" fontSize={0.44} fontWeight={800} textAnchor="middle" fill={v === null ? ACCENT : INK}>
              {v === null ? "؟" : fa(v)}
            </text>
          </g>
        );
      })}

      {onRegion && <rect x={bx} y={by} width={bw} height={bh} fill="transparent" onClick={click} style={{ cursor: "pointer" }} />}
      {caption && (
        <text x={0} y={round(by + bh + 0.38)} fontSize={0.28} fontWeight={700} textAnchor="middle" fill={SOFT}>
          {caption}
        </text>
      )}
    </g>
  );
}

/** A small stand-alone diagram (worksheet: blank regions to write in). */
export function CountVennSvg({ names, width, total }: { names: readonly string[]; width: number; total?: number | null }) {
  const [x, y, w, h] = countView(names.length as K);
  return (
    <svg viewBox={`${x} ${y} ${w} ${h}`} width={width} height={Math.round((width * h) / w)} style={{ direction: "ltr" }} role="img" aria-label="نمودار ون">
      <CountVennFigure names={names} values={Array(1 << names.length).fill(null)} total={total} />
    </svg>
  );
}

/** Circle totals and the class size a question gives, for the labels. */
export function givenTotals(q: VennCountQuestion) {
  const totals = Array.from({ length: q.k }, (_, s) => q.facts.find((f) => f.ref.kind === "set" && f.ref.s === s)?.value ?? null);
  const total = q.facts.find((f) => f.ref.kind === "total")?.value ?? null;
  return { totals, total };
}

// ───────────── explore ─────────────

const EX_NAMES = ["سیب", "انار", "هلو"];
const EX_START: Record<K, number[]> = { 2: [4, 18, 11, 7], 3: [3, 9, 6, 4, 7, 2, 3, 2] };

export function exRegionName(k: K, r: number) {
  return regionName({ k, theme: 2, items: [0, 1, 2].slice(0, k) }, r);
}

/** State for explore: circles, numbers per region, the region the pad writes to. */
export function useCountExplore() {
  const [k, setK] = useState<K>(2);
  const [values, setValues] = useState<Record<K, number[]>>({ 2: EX_START[2], 3: EX_START[3] });
  const [selected, setSelected] = useState<number>(3);
  return { k, setK: (n: K) => (setK(n), setSelected(n === 2 ? 3 : 7)), values: values[k], setValue: (r: number, v: number) => setValues((all) => ({ ...all, [k]: all[k].map((x, i) => (i === r ? Math.max(0, Math.min(99, v)) : x)) })), selected, setSelected, reset: () => setValues({ 2: EX_START[2], 3: EX_START[3] }) };
}
export type CountExplore = ReturnType<typeof useCountExplore>;

export function countExploreBoard(ex: CountExplore) {
  const names = EX_NAMES.slice(0, ex.k);
  const totals = names.map((_, s) => sumOf(ex.values, refMask(ex.k, { kind: "set", s })));
  return (
    <CountVennFigure
      names={names}
      values={ex.values}
      totals={totals}
      total={sumOf(ex.values, refMask(ex.k, { kind: "total" }))}
      hatch={1 << ex.selected}
      focus={ex.selected}
      onRegion={ex.setSelected}
      caption={`بخش انتخاب‌شده: «${exRegionName(ex.k, ex.selected)}»`}
    />
  );
}

export function CountExplorePanel({ ex }: { ex: CountExplore }) {
  const { k, values } = ex;
  const names = EX_NAMES.slice(0, k);
  const sum = (ref: Ref) => sumOf(values, refMask(k, ref));
  const order = k === 2 ? [3, 1, 2, 0] : [7, 3, 5, 6, 1, 2, 4, 0];
  return (
    <>
      <div className={layout.chipsRow} role="radiogroup" aria-label="تعداد دایره">
        {([2, 3] as K[]).map((n) => (
          <button key={n} role="radio" aria-checked={k === n} onClick={() => ex.setK(n)}>
            {n === 2 ? "دو دایره" : "سه دایره"}
          </button>
        ))}
      </div>
      <h2 className={layout.progress}>در هر بخش چند نفر؟</h2>
      <p className={layout.note}>روی یک بخش نمودار (یا نامش در فهرست) بزن تا هاشور بخورد، بعد عددش را با دکمه‌ها بنویس. جمع هر دایره کنار نامش و جمع کلاس گوشه قاب عوض می‌شود.</p>
      <table className={layout.countTable}>
        <tbody>
          {order.map((r) => (
            <tr key={r} aria-current={ex.selected === r ? "step" : undefined} style={ex.selected === r ? { fontWeight: 800 } : undefined}>
              <td>
                <button className={layout.clear} style={{ minHeight: 40, width: "100%", textAlign: "start" }} aria-pressed={ex.selected === r} onClick={() => ex.setSelected(r)}>
                  {ex.selected === r ? "◀ " : ""}
                  {exRegionName(k, r)}
                </button>
              </td>
              <td style={{ whiteSpace: "nowrap" }}>
                <button className={layout.clear} style={{ minWidth: 40, minHeight: 40 }} aria-label={`یکی کمتر در ${exRegionName(k, r)}`} onClick={() => ex.setValue(r, values[r] - 1)}>
                  −
                </button>{" "}
                <b style={{ display: "inline-block", minWidth: "2em", textAlign: "center" }}>{fa(values[r])}</b>{" "}
                <button className={layout.clear} style={{ minWidth: 40, minHeight: 40 }} aria-label={`یکی بیشتر در ${exRegionName(k, r)}`} onClick={() => ex.setValue(r, values[r] + 1)}>
                  +
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <NumberPad value={String(values[ex.selected])} onChange={(v) => ex.setValue(ex.selected, v === "" ? 0 : Number(v))} maxDigits={2} />
      <table className={layout.countTable}>
        <tbody>
          {names.map((name, s) => (
            <tr key={s}>
              <td>همه {name} (با بخش‌های مشترک)</td>
              <td style={{ fontWeight: 700 }}>{fa(sum({ kind: "set", s }))}</td>
            </tr>
          ))}
          <tr>
            <td>دست‌کم یکی (داخل دایره‌ها)</td>
            <td style={{ fontWeight: 700 }}>{fa(sum({ kind: "union" }))}</td>
          </tr>
          <tr>
            <td>کل کلاس (با بیرون)</td>
            <td style={{ fontWeight: 700 }}>{fa(sum({ kind: "total" }))}</td>
          </tr>
          <tr>
            <td>جمع عدد دایره‌ها</td>
            <td style={{ fontWeight: 700 }}>{fa(names.reduce((t, _, s) => t + sum({ kind: "set", s }), 0))}</td>
          </tr>
        </tbody>
      </table>
      <p className={layout.note}>«جمع عدد دایره‌ها» را با «دست‌کم یکی» مقایسه کن: فرقشان از کجا می‌آید؟ بخش وسط را صفر کن و دوباره نگاه کن.</p>
      <div className={layout.row}>
        <button className={layout.clear} onClick={ex.reset}>
          عددهای اول
        </button>
      </div>
    </>
  );
}

// ───────────── try: the answer pad ─────────────

export interface CountEntry {
  /** The typed answer. */
  value: string;
  /** The child's own numbers on the diagram (null: empty). */
  scratch: (number | null)[];
  /** Where the pad writes: null the answer, or a region of the diagram. */
  target: number | null;
}

export const blankCount = (q: VennCountQuestion): CountEntry => ({ value: "", scratch: Array(1 << q.k).fill(null), target: null });

export function CountAnswer({ q, entry, right, onChange }: { q: VennCountQuestion; entry: CountEntry; right: boolean; onChange: (e: CountEntry, answerChanged: boolean) => void }) {
  const t = entry.target;
  const padValue = t === null ? entry.value : entry.scratch[t] === null ? "" : String(entry.scratch[t]);
  return (
    <>
      <div className={tryStyles.chips} role="radiogroup" aria-label="دکمه‌ها کجا بنویسند">
        <button role="radio" aria-checked={t === null} onClick={() => onChange({ ...entry, target: null }, false)}>
          {t === null ? "● " : ""}نوشتن جواب
        </button>
        <button role="radio" aria-checked={t !== null} onClick={() => onChange({ ...entry, target: t ?? (q.k === 2 ? 3 : 7) }, false)} disabled={right}>
          {t !== null ? "● " : ""}نوشتن روی نمودار
        </button>
      </div>
      <p className={tryStyles.hint}>
        {t !== null
          ? `بخش «${regionName(q, t)}»: عددش را با دکمه‌ها بنویس (یادداشت خودت است و بررسی نمی‌شود). برای بخش دیگر، روی نمودار بزن.`
          : "برای یادداشت، روی هر بخش نمودار بزن و عددش را بنویس؛ بعد «نوشتن جواب» را بزن."}
      </p>
      <NumberPad
        value={padValue}
        disabled={right && t === null}
        onChange={(v) => {
          if (t === null) onChange({ ...entry, value: v }, true);
          else onChange({ ...entry, scratch: entry.scratch.map((x, i) => (i === t ? (v === "" ? null : Number(v)) : x)) }, false);
        }}
      />
    </>
  );
}

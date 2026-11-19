"use client";

// Explore «مبادله»: a market's exchanges are balanced scales. Both pans start
// with the same goods; exchanging on the left pan (give a group, take what it
// equals) keeps the scale level, while adding or taking one fruit tips it.

import { useState } from "react";
import { GOODS, type Rate } from "@/generators/exchange";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/ToolLayout.module.css";
import { goodsItems, goodName } from "./exchangeText";
import { LiveBalance, tiltFor, type ItemView } from "./Pictures";

interface Market {
  name: string;
  /** GOODS indices, cheap to dear; rates[i]: p of goods[i] = q of goods[i + 1]. */
  goods: number[];
  rates: Rate[];
  start: [number, number];
}

const MARKETS: Market[] = [
  { name: "بازار ۱", goods: [0, 1, 3], rates: [{ p: 3, q: 2 }, { p: 4, q: 1 }], start: [3, 1] },
  { name: "بازار ۲", goods: [0, 2, 3], rates: [{ p: 4, q: 1 }, { p: 3, q: 1 }], start: [3, 1] },
  { name: "بازار ۳", goods: [1, 2], rates: [{ p: 5, q: 2 }], start: [1, 10] },
];

const EX = { cx: 8, cy: 2.6, u: 1.25 };
const MAX_EACH = 40;

/** Whole-number values that fit the market's exchanges (for the tilt). */
function valuesOf(m: Market): Map<number, number> {
  const v = [m.rates.reduce((t, r) => t * r.q, 1)];
  m.rates.forEach((r, i) => v.push((v[i] * r.p) / r.q));
  return new Map(m.goods.map((g, i) => [g, v[i]]));
}

type Counts = Map<number, number>;
const weigh = (c: Counts, v: Map<number, number>) => [...c].reduce((t, [g, n]) => t + n * (v.get(g) ?? 0), 0);

/** Items on a pan, dearest first, and which good each item is. */
function panOf(c: Counts, mine: boolean) {
  const items: ItemView[] = [];
  const goods: number[] = [];
  const few = [...c.values()].filter((n) => n > 0).length > 1 ? 2 : 6;
  for (const [g, n] of [...c].sort((a, b) => b[0] - a[0])) {
    for (const it of goodsItems(g, n, 0, few)) {
      items.push({ ...it, mine });
      goods.push(g);
    }
  }
  return { items, goods };
}

const countsFa = (c: Counts) =>
  [...c]
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[0] - a[0])
    .map(([g, n]) => `${fa(n)} ${goodName(g)}`)
    .join(" و ") || "هیچ";

export function useExchangeExplore() {
  const [mi, setMi] = useState(0);
  const m = MARKETS[mi];
  const startCounts = (mk: Market): Counts => new Map([[mk.start[0], mk.start[1]]]);
  const [left, setLeft] = useState<Counts>(() => startCounts(MARKETS[0]));
  const values = valuesOf(m);
  const right = startCounts(m);

  const choose = (i: number) => {
    setMi(i);
    setLeft(startCounts(MARKETS[i]));
  };
  const change = (g: number, d: number) =>
    setLeft((c) => {
      const n = new Map(c);
      const v = Math.max(0, Math.min(MAX_EACH, (n.get(g) ?? 0) + d));
      if (v) n.set(g, v);
      else n.delete(g);
      return n;
    });
  /** Give `give` of good a, take `take` of good b. */
  const trade = (a: number, give: number, b: number, take: number) =>
    setLeft((c) => {
      if ((c.get(a) ?? 0) < give || (c.get(b) ?? 0) + take > MAX_EACH) return c;
      const n = new Map(c);
      const rest = (n.get(a) ?? 0) - give;
      if (rest) n.set(a, rest);
      else n.delete(a);
      n.set(b, (n.get(b) ?? 0) + take);
      return n;
    });

  const lw = weigh(left, values);
  const rw = weigh(right, values);
  const diff = rw - lw;
  const L = panOf(left, true);
  const R = panOf(right, false);

  const board = (
    <LiveBalance
      {...EX}
      target={tiltFor(Math.sign(diff) * Math.min(12, Math.abs(diff) / (values.get(m.goods[0]) ?? 1)))}
      left={L.items}
      right={R.items}
      label="ترازوی مبادله"
      onItem={(side, i) => side === "left" && change(L.goods[i], -1)}
    />
  );
  const status = diff === 0 ? `✓ ترازو متعادل است: ${countsFa(left)} = ${countsFa(right)}` : `کفه ${diff > 0 ? "راست" : "چپ"} سنگین‌تر است: ${countsFa(left)} با ${countsFa(right)} برابر نیست.`;

  const panel = (
    <>
      <h2>جایگزین کن؛ ترازو تکان نمی‌خورد</h2>
      <div className={styles.chipsRow} role="radiogroup" aria-label="بازار">
        {MARKETS.map((mk, i) => (
          <button key={mk.name} role="radio" aria-checked={mi === i} onClick={() => choose(i)}>
            {mk.name}
          </button>
        ))}
      </div>
      <p className={styles.note}>
        در این بازار: {m.rates.map((r, i) => `${fa(r.p)} ${goodName(m.goods[i])} = ${fa(r.q)} ${goodName(m.goods[i + 1])}`).join(" و ")}. هر مبادله یک ترازوی متعادل است. در کفه‌ی چپ مبادله کن: یک دسته را بده و
        هم‌ارزش را بگیر.
      </p>
      <div className={styles.row} style={{ flexWrap: "wrap" }}>
        {m.rates.flatMap((r, i) => {
          const a = m.goods[i];
          const b = m.goods[i + 1];
          return [
            <button key={`u${i}`} className={styles.clear} onClick={() => trade(a, r.p, b, r.q)} disabled={(left.get(a) ?? 0) < r.p}>
              {fa(r.p)} {goodName(a)} بده، {fa(r.q)} {goodName(b)} بگیر
            </button>,
            <button key={`d${i}`} className={styles.clear} onClick={() => trade(b, r.q, a, r.p)} disabled={(left.get(b) ?? 0) < r.q}>
              {fa(r.q)} {goodName(b)} بده، {fa(r.p)} {goodName(a)} بگیر
            </button>,
          ];
        })}
      </div>
      <p className={`${styles.status} ${diff === 0 ? styles.good : styles.info}`}>{status}</p>
      <h2 className={styles.progress}>یکی اضافه یا کم کن</h2>
      <p className={styles.note}>هر میوه‌ی کفه‌ی چپ را لمس کنی یکی برداشته می‌شود. ببین بدون مبادله، با یک میوه بیشتر یا کمتر، ترازو کج می‌شود.</p>
      <div className={styles.row} style={{ flexWrap: "wrap" }}>
        {m.goods.map((g) => (
          <button key={g} className={styles.clear} onClick={() => change(g, 1)} aria-label={`یک ${GOODS[g].name} به کفه‌ی چپ`}>
            + {goodName(g)}
          </button>
        ))}
        <button className={styles.clear} onClick={() => setLeft(startCounts(m))}>
          از نو
        </button>
      </div>
    </>
  );

  return { board, view: [0, 0, 16, 7.1] as [number, number, number, number], panel, label: `ترازوی مبادله؛ ${status}` };
}

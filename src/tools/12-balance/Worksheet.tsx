"use client";

// Worksheet for tool 12: the scales of each question drawn level, with a
// "?" on the empty pan; exchanges are drawn as balanced scales of fruit;
// coins, ages and averages are text with an answer line. The answer key adds
// the working.

import { MEAN_CONTEXTS } from "@/generators/mean";
import { WorksheetShell, type WorksheetConfig } from "@/toolkit/WorksheetShell";
import { fa } from "@/tools/registry";
import { answerFa, BALANCE_TYPE_LABEL, balanceHow, balancePrompt } from "./BalanceTryPanel";
import { goodName, goodsItems } from "./exchangeText";
import { glyph, itemsOf } from "./frames";
import { makeTryQuestion, type AnyQ, type TryType } from "./questions";
import { BalanceSvg, type ItemView } from "./Pictures";
import styles from "@/toolkit/Worksheet.module.css";

/** One scale with its name under it. */
function Fig({ left, right, name, width, ask }: { left: ItemView[]; right: ItemView[]; name?: string; width: number; ask?: "right" }) {
  return (
    <figure className={styles.caption}>
      <BalanceSvg left={left} right={right} width={width} ask={ask} />
      {name && <figcaption>{name}</figcaption>}
    </figure>
  );
}

function figures(q: AnyQ) {
  switch (q.type) {
    case "mean":
      return <p className={styles.symbols}>............ {MEAN_CONTEXTS[q.context].noun}</p>;
    case "exchange": {
      const g = q.goods;
      const asked = q.variant === "compare" ? g[0] : g[q.to];
      return (
        <>
          <div className={styles.row} style={{ flexWrap: "wrap", rowGap: 4 }}>
            {q.order.map((i) => (
              <Fig key={i} left={goodsItems(g[i], q.rates[i].p)} right={goodsItems(g[i + 1], q.rates[i].q)} width={150} name={`${fa(q.rates[i].p)} ${goodName(g[i])} = ${fa(q.rates[i].q)} ${goodName(g[i + 1])}`} />
            ))}
            {q.variant === "compare" && <Fig left={goodsItems(g[0], q.offer)} right={goodsItems(g[2], 1)} width={150} name={`فروشنده: ${fa(q.offer)} ${goodName(g[0])} = ۱ ${goodName(g[2])}`} />}
          </div>
          <p className={styles.symbols}>............ {goodName(asked)}</p>
        </>
      );
    }
    case "balance":
      return (
        <>
          <div className={styles.row} style={{ flexWrap: "wrap", rowGap: 4 }}>
            {q.scales.map((sc, i) => (
              <Fig key={i} left={itemsOf(sc.left)} right={itemsOf(sc.right)} width={q.scales.length === 1 ? 230 : 160} name={q.scales.length > 1 ? `ترازوی ${fa(i + 1)}` : undefined} />
            ))}
          </div>
          <p className={styles.symbols}>{glyph(q.ask)} = ............ کیلو</p>
        </>
      );
    case "fill":
      return (
        <>
          <div className={styles.row} style={{ flexWrap: "wrap", rowGap: 4 }}>
            {q.scales.map((sc, i) => (
              <Fig key={i} left={itemsOf(sc.left)} right={itemsOf(sc.right)} width={160} name={`ترازوی ${fa(i + 1)}`} />
            ))}
            <Fig left={itemsOf(q.target)} right={[]} width={160} ask="right" name="ترازوی پرسش" />
          </div>
          <p className={styles.symbols}>{q.fillWith === null ? "کفه‌ی خالی: ............ کیلو" : `کفه‌ی خالی: ............ تا ${glyph(q.fillWith)}`}</p>
        </>
      );
    case "coin":
      return <p className={styles.symbols}>{q.variant === "min" ? "............ وزن‌کشی" : "............ سکه"}</p>;
    case "age":
      return <p className={styles.symbols}>............ سال</p>;
  }
}

function answer(q: AnyQ) {
  return (
    <>
      {answerFa(q)} · <span style={{ fontWeight: 400 }}>{balanceHow(q)}</span>
    </>
  );
}

const CONFIG: WorksheetConfig<TryType, AnyQ> = {
  title: "ترازو",
  backHref: "/tools/balance",
  typeLabels: BALANCE_TYPE_LABEL,
  defaultTypes: ["balance", "fill", "coin", "age"],
  make: makeTryQuestion,
  prompt: (q) => balancePrompt(q, true),
  figures,
  answer,
};

export function BalanceWorksheet() {
  return <WorksheetShell config={CONFIG} />;
}

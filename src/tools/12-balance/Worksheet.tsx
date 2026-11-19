"use client";

// Worksheet for tool 12: the scales of each question drawn level, with a
// "?" on the empty pan; coins and ages are text with an answer line. The
// answer key adds the working.

import { makeBalanceQuestion, type BalanceQ, type BalanceQuestionType } from "@/generators/balance";
import { WorksheetShell, type WorksheetConfig } from "@/toolkit/WorksheetShell";
import { fa } from "@/tools/registry";
import { answerFa, BALANCE_TYPE_LABEL, balanceHow, balancePrompt } from "./BalanceTryPanel";
import { glyph, itemsOf } from "./frames";
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

function figures(q: BalanceQ) {
  switch (q.type) {
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

function answer(q: BalanceQ) {
  return (
    <>
      {answerFa(q)} · <span style={{ fontWeight: 400 }}>{balanceHow(q)}</span>
    </>
  );
}

const CONFIG: WorksheetConfig<BalanceQuestionType, BalanceQ> = {
  title: "ترازو",
  backHref: "/tools/balance",
  typeLabels: BALANCE_TYPE_LABEL,
  defaultTypes: ["balance", "fill", "coin", "age"],
  make: makeBalanceQuestion,
  prompt: (q) => balancePrompt(q, true),
  figures,
  answer,
};

export function BalanceWorksheet() {
  return <WorksheetShell config={CONFIG} />;
}

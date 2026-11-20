"use client";

// After a session: the stars, each question once more, and a way to replay
// a mistake on its tool. After a mock exam: the report card by area.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { endRun, useRun } from "./bridge";
import { tagText, toolArea, toolTitle, typeLabel, catalogTool } from "./catalog";
import { RUN_TITLE, starText } from "./PracticeBar";
import { starsOf } from "./rewards";
import { AREA_LABEL, fa, type Area } from "@/tools/registry";
import styles from "./Practice.module.css";

const replayHref = (it: { tool: string; type: string; level: number; seed: number }) =>
  `${catalogTool(it.tool)?.href ?? "/"}#try=${encodeURIComponent(it.type)}&level=${it.level}&seed=${it.seed}`;

const minutes = (ms: number) => fa(Math.max(1, Math.round(ms / 60_000)));

export function PracticeResult() {
  const r = useRun();
  const router = useRouter();

  if (!r) {
    return (
      <main className={styles.main}>
        <p>تمرینی در کار نیست.</p>
        <Link className={styles.linkButton} href="/practice/">
          بازگشت به تمرین
        </Link>
      </main>
    );
  }

  const exam = r.kind === "exam";
  const answered = r.results.filter((a) => a !== null);
  const stars = answered.reduce((s, a) => s + starsOf(a!), 0);
  const right = answered.filter((a) => a!.tag === "right").length;
  const done = () => {
    endRun();
    router.push("/practice/");
  };

  const byArea = new Map<Area, { right: number; total: number }>();
  r.items.forEach((it, i) => {
    const area = toolArea(it.tool);
    const cur = byArea.get(area) ?? { right: 0, total: 0 };
    byArea.set(area, { right: cur.right + (r.results[i]?.tag === "right" ? 1 : 0), total: cur.total + 1 });
  });

  return (
    <main className={styles.main}>
      <header className={styles.top}>
        <h1>{exam ? "کارنامه آزمون شبیه‌سازی" : `نتیجه ${RUN_TITLE[r.kind]}`}</h1>
      </header>

      <section className={styles.card}>
        {exam ? (
          <>
            <p>
              {fa(right)} پاسخ درست از {fa(r.items.length)} سؤال
              {answered.length < r.items.length && ` (${fa(r.items.length - answered.length)} سؤال بی‌پاسخ ماند)`}، در {minutes((r.finishedAt ?? r.startedAt) - r.startedAt)} دقیقه.
            </p>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>محور</th>
                  <th>درست</th>
                </tr>
              </thead>
              <tbody>
                {[...byArea].map(([area, v]) => (
                  <tr key={area}>
                    <td>هوش {AREA_LABEL[area]}</td>
                    <td>
                      {fa(v.right)} از {fa(v.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={styles.small}>این آزمون تمرینی است و هوش یا قبولی را نمی‌سنجد؛ فقط نشان می‌دهد کدام مبحث تمرین بیشتری لازم دارد.</p>
          </>
        ) : (
          <>
            <p className={styles.total} aria-label={`${fa(stars)} ستاره`}>
              ★ {fa(stars)}
            </p>
            <p>
              {right === answered.length && answered.length > 0
                ? "همه را درست جواب دادی. عالی بود!"
                : right > 0
                  ? `${fa(right)} سؤال را درست جواب دادی. اشتباه‌ها را پایین ببین؛ چند روز دیگر دوباره سراغشان می‌آیند.`
                  : "امروز سخت بود؛ اشکالی ندارد. اشتباه‌ها را پایین ببین؛ چند روز دیگر دوباره سراغشان می‌آیند."}
            </p>
          </>
        )}
      </section>

      <section className={styles.card}>
        <h2>{exam ? "پاسخ‌ها" : "سؤال‌ها"}</h2>
        <ol className={styles.results}>
          {r.items.map((it, i) => {
            const a = r.results[i];
            // A practice ended early lists only what the child reached; an exam lists every question.
            if (!exam && !a) return null;
            return (
              <li key={i}>
                <strong>
                  {toolTitle(it.tool)} · {typeLabel(it.tool, it.type)}
                </strong>
                {a ? (
                  exam ? (
                    <span>{a.tag === "right" ? "✓ درست" : `✗ ${tagText(it.tool, a.tag)}`}</span>
                  ) : (
                    <span className={styles.stars}>{starText(starsOf(a))}</span>
                  )
                ) : (
                  <span className={styles.small}>بی‌پاسخ</span>
                )}
                {!exam && a && a.tag !== "right" && <span className={styles.small}>{tagText(it.tool, a.tag)}</span>}
                <span className={styles.grow} />
                {(!a || a.tag !== "right") && (
                  <Link className={styles.linkButton} href={replayHref(it)}>
                    دوباره ببین
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <button className={styles.primary} onClick={done}>
        پایان
      </button>
    </main>
  );
}

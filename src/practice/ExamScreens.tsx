"use client";

// The screens of the staged exam (exam.ts): the screen between stages, the
// placement result, and the report card, which prints (or saves as PDF)
// on A4. Every message is kind: what went well first, then what to
// practise, never a verdict on the child.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { adapterFor } from "./adapters";
import { endRun, updateRun, type Run } from "./bridge";
import { catalogTool, tagText, toolArea, toolTitle, typeLabel } from "./catalog";
import { db } from "./db";
import { ANALYTIC_STAGES, byArea, cheer, EXAM_AREAS, EXAM_STAGES, PLACEMENT_ROUNDS, secondsFor, SPEED_TOOL, SPEED_TYPES, STAGE_SIZE, testScore, type AreaLevels, type ExamRecord } from "./exam";
import { finishPlacement, nextStage, saveExam, stageResults, stagesOf, startExam } from "./examRun";
import { BarChart, HistoryChart } from "./ExamCharts";
import { runTitle } from "./PracticeBar";
import type { SessionItem } from "./session";
import { syncNow } from "./sync";
import type { Attempt } from "./types";
import { AREA_LABEL, fa, type Area } from "@/tools/registry";
import styles from "./Exam.module.css";

const replayHref = (it: SessionItem) => `${catalogTool(it.tool)?.href ?? "/"}#try=${encodeURIComponent(it.type)}&level=${it.level}&seed=${it.seed}`;
const minutesFa = (ms: number) => fa(Math.max(1, Math.round(ms / 60_000)));
const dateFa = (t: number) => new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "long", day: "numeric" }).format(new Date(t));
const areaName = (a: Area) => `هوش ${AREA_LABEL[a]}`;

/** The right answer and why, from the tool's adapter (or nothing, if the tool has none yet). */
const solutionOf = (it: SessionItem) => {
  try {
    return adapterFor(it.tool)?.solution(it.type, it.level, it.seed) ?? null;
  } catch {
    return null;
  }
};

function areaRows(items: readonly SessionItem[], results: readonly (Attempt | null)[]) {
  const m = byArea(items, results.map((a) => a?.tag === "right"), toolArea);
  return [...m].map(([area, v]) => ({ area, label: areaName(area), ...v }));
}

/** One question of the list: what it was, how it went, and the right answer. */
function AnswerRow({ it, a, n }: { it: SessionItem; a: Attempt | null; n: number }) {
  const sol = solutionOf(it);
  const status = !a ? "blank" : a.tag === "right" ? "right" : "wrong";
  return (
    <li className={styles.answer}>
      <div className={styles.answerHead}>
        <span className={styles.num}>{fa(n)}</span>
        <strong>
          {toolTitle(it.tool)} · {typeLabel(it.tool, it.type)}
        </strong>
        <span className={styles.small}>سطح {fa(it.level)}</span>
        <span className={styles.grow} />
        <span className={styles[status]}>{status === "right" ? "✓ درست" : status === "wrong" ? "✗ نادرست" : "○ بی‌پاسخ"}</span>
      </div>
      {status === "wrong" && <p className={styles.small}>اشتباه: {tagText(it.tool, a!.tag)}</p>}
      {status !== "right" && sol && <p className={styles.solution}>{sol}</p>}
      {status !== "right" && (
        <Link className={`${styles.link} ${styles.noPrint}`} href={replayHref(it)}>
          دوباره ببین
        </Link>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------

/** Between two stages (or placement rounds). */
export function StageScreen({ r }: { r: Run }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const ex = r.exam!;
  const placement = ex.kind === "placement";
  const { items, results, rights } = stageResults(r);
  const right = rights.filter(Boolean).length;
  const next = EXAM_STAGES[ex.stage + 1];
  const nextSpeed = ex.stage + 1 >= ANALYTIC_STAGES;
  const nextItems = nextSpeed ? SPEED_TYPES.length : STAGE_SIZE;
  const nextSeconds = nextSpeed ? SPEED_TYPES.reduce((t, type) => t + secondsFor({ tool: SPEED_TOOL, type }), 0) : STAGE_SIZE * secondsFor({ tool: "", type: "" });

  const go = async () => {
    setBusy(true);
    await nextStage(router.push);
  };
  const stop = () => {
    updateRun({ finished: true, finishedAt: Date.now(), exam: { ...ex, between: false } });
  };

  if (placement)
    return (
      <main className={styles.main}>
        <h1>تعیین سطح</h1>
        <section className={styles.card}>
          <p className={styles.big}>
            دور {fa(ex.stage + 1)} از {fa(PLACEMENT_ROUNDS)} تمام شد. آفرین!
          </p>
          <p>اینجا درست و غلط مهم نیست؛ فقط می‌خواهیم ببینیم از کجا شروع کنیم. دور بعد، سؤال‌ها به اندازه تو تنظیم می‌شوند.</p>
          <div className={styles.row}>
            <button className={styles.primary} onClick={go} disabled={busy}>
              دور بعد ←
            </button>
          </div>
        </section>
      </main>
    );

  return (
    <main className={styles.main}>
      <h1>
        {runTitle(r)} · مرحله {fa(ex.stage + 1)} ({EXAM_STAGES[ex.stage].title}) تمام شد
      </h1>
      <section className={styles.card}>
        <p className={styles.big}>
          {fa(right)} از {fa(items.length)} درست
        </p>
        <p>{cheer(right, items.length, { answered: results.filter(Boolean).length })}</p>
        <BarChart label="نتیجه این مرحله در هر محور" rows={areaRows(items, results)} />
      </section>

      <section className={styles.card}>
        <h2>{ex.kind === "real" ? "پاسخ‌های این مرحله و جواب درست" : "مرور این مرحله"}</h2>
        <ol className={styles.answers}>
          {items.map((it, i) => (
            <AnswerRow key={i} it={it} a={results[i]} n={ex.stageStart + i + 1} />
          ))}
        </ol>
      </section>

      {next && (
        <section className={styles.card}>
          <h2>
            مرحله بعد: {next.title}
          </h2>
          <p>{next.note}</p>
          <p className={styles.small}>
            {fa(nextItems)} سؤال
            {ex.kind === "real" && ` · ${minutesFa(nextSeconds * 1000)} دقیقه`}
            {" · "}هر وقت آماده بودی شروع کن؛ اینجا ساعت نمی‌رود.
          </p>
          <div className={styles.row}>
            <button className={styles.primary} onClick={go} disabled={busy}>
              شروع مرحله بعد ←
            </button>
            <button className={styles.quiet} onClick={stop}>
              همین‌جا تمام کن و کارنامه را ببین
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------

export function PlacementResult({ r }: { r: Run }) {
  const router = useRouter();
  const [levels, setLevels] = useState<AreaLevels | null>(null);
  useEffect(() => {
    let live = true;
    finishPlacement(r).then((l) => live && setLevels(l));
    syncNow().catch(() => {});
    return () => {
      live = false;
    };
  }, [r]);

  const start = (mode: "learn" | "real") => {
    endRun();
    void startExam(r.childId, mode, router.push);
  };

  return (
    <main className={styles.main}>
      <h1>نتیجه تعیین سطح</h1>
      <section className={styles.card}>
        <p className={styles.big}>سطح شروع تو پیدا شد!</p>
        <p>از این به بعد، «بازی امروز» و آزمون‌ها از همین سطح شروع می‌شوند و با تو بالا می‌روند.</p>
        {levels && (
          <BarChart
            label="سطح شروع در هر محور"
            rows={EXAM_AREAS.map((a) => ({ label: areaName(a), right: levels[a] ?? 1, total: 3, note: `سطح ${fa(levels[a] ?? 1)}` }))}
          />
        )}
        <p className={styles.small}>سطح ۱ یعنی شروع از پایه، سطح ۳ یعنی سؤال‌های سخت‌تر. هیچ‌کدام خوب یا بد نیست؛ نقطه شروع است.</p>
      </section>
      <section className={styles.card}>
        <h2>حالا آزمون</h2>
        <div className={styles.choices}>
          <button className={styles.choice} onClick={() => start("learn")}>
            <strong>آزمون آموزشی</strong>
            <span>بعد از هر سؤال می‌بینی درست بود یا نه، و جواب درست را.</span>
          </button>
          <button className={styles.choice} onClick={() => start("real")}>
            <strong>آزمون شبیه واقعی</strong>
            <span>مثل روز آزمون: زمان‌دار، و جواب‌ها آخر هر مرحله.</span>
          </button>
        </div>
        <button
          className={styles.quiet}
          onClick={() => {
            endRun();
            router.push("/practice/");
          }}
        >
          بعداً
        </button>
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------

/** The report card. Prints on A4 (the browser's «ذخیره به‌صورت PDF» saves it). */
export function ExamReport({ r }: { r: Run }) {
  const router = useRouter();
  const [history, setHistory] = useState<ExamRecord[] | null>(null);
  const [name, setName] = useState("");
  useEffect(() => {
    let live = true;
    saveExam(r).then((h) => live && setHistory(h));
    db.profiles().then((ps) => live && setName(ps.find((p) => p.id === r.childId)?.nickname ?? ""));
    syncNow().catch(() => {});
    return () => {
      live = false;
    };
  }, [r]);

  const real = r.exam?.kind === "real";
  const answered = r.results.filter((a) => a !== null) as Attempt[];
  const right = answered.filter((a) => a.tag === "right").length;
  const wrong = answered.length - right;
  const blank = r.items.length - answered.length;
  const score = testScore(right, wrong, r.items.length);
  const areas = areaRows(r.items, r.results);
  const stages = stagesOf(r);
  const strong = [...areas].sort((a, b) => b.right / b.total - a.right / a.total)[0];
  const weak = [...areas].sort((a, b) => a.right / a.total - b.right / b.total)[0];
  // Up to two skills to practise: those missed in the weakest area.
  const toPractise = [...new Set(r.items.filter((it, i) => toolArea(it.tool) === weak?.area && r.results[i]?.tag !== "right").map((it) => `${it.tool}:${it.type}`))].slice(0, 2);
  const ms = (r.finishedAt ?? r.startedAt) - r.startedAt;

  return (
    <main className={`${styles.main} ${styles.report}`}>
      <header className={styles.reportHead}>
        <div>
          <h1>کارنامه {runTitle(r)}</h1>
          <p className={styles.small}>
            {name && `${name} · `}
            {dateFa(r.finishedAt ?? r.startedAt)} · {minutesFa(ms)} دقیقه
          </p>
        </div>
        <span className={styles.grow} />
        <button className={`${styles.primary} ${styles.noPrint}`} onClick={() => window.print()}>
          چاپ یا ذخیره PDF
        </button>
      </header>

      <section className={styles.card}>
        <div className={styles.tiles}>
          <div className={styles.tile}>
            <strong>{fa(right)}</strong>
            <span>✓ درست</span>
          </div>
          <div className={styles.tile}>
            <strong>{fa(wrong)}</strong>
            <span>✗ نادرست</span>
          </div>
          <div className={styles.tile}>
            <strong>{fa(blank)}</strong>
            <span>○ بی‌پاسخ</span>
          </div>
          {real && (
            <div className={styles.tile}>
              <strong>{`${fa(score.percent)}٪`}</strong>
              <span>
                امتیاز به روش آزمون: {fa(Math.max(0, score.raw))} از {fa(score.max)}
              </span>
            </div>
          )}
        </div>
        <p>{cheer(right, r.items.length, { final: true, answered: answered.length })}</p>
        {real && <p className={styles.small}>روش آزمون: هر جواب درست ۳+، هر جواب نادرست ۱−، بی‌پاسخ صفر. پس وقتی مطمئن نیستی، بی‌پاسخ گذاشتن از حدس زدن بهتر است.</p>}
      </section>

      <section className={styles.card}>
        <h2>هر محور</h2>
        <BarChart label="درصد جواب درست در هر محور" rows={areas} />
        <h2>هر مرحله</h2>
        <BarChart
          label="درصد جواب درست در هر مرحله"
          rows={stages.map((s, i) => ({ label: EXAM_STAGES[i]?.title ?? `مرحله ${fa(i + 1)}`, right: s.right, total: s.total, note: `سطح ${fa(s.level)}` }))}
        />
        {history && history.length >= 2 && (
          <>
            <h2>آزمون‌های تو تا امروز</h2>
            <HistoryChart label="درصد جواب درست در آزمون‌های قبلی" points={history.slice(-8)} />
          </>
        )}
      </section>

      <section className={styles.card}>
        <h2>خلاصه</h2>
        <ul className={styles.summary}>
          {strong && strong.right > 0 && (
            <li>
              <strong>بهترین محور:</strong> {strong.label} ({fa(strong.right)} از {fa(strong.total)}).
            </li>
          )}
          {weak && weak !== strong && (
            <li>
              <strong>برای تمرین بیشتر:</strong> {weak.label}
              {toPractise.length > 0 && `؛ به‌خصوص ${toPractise.map((k) => typeLabel(k.split(":")[0], k.split(":")[1])).join(" و ")}`}.
            </li>
          )}
          {wrong > 0 && <li>اشتباه‌های این آزمون به دفتر اشتباه‌ها رفته‌اند و چند روز دیگر در «مرور اشتباه‌ها» برمی‌گردند.</li>}
          {blank > 0 && <li>جواب درست سؤال‌های بی‌پاسخ هم پایین آمده است.</li>}
        </ul>
      </section>

      <section className={styles.card}>
        <h2>همه سؤال‌ها و جواب درست</h2>
        <ol className={styles.answers}>
          {r.items.map((it, i) => (
            <AnswerRow key={i} it={it} a={r.results[i]} n={i + 1} />
          ))}
        </ol>
      </section>

      <p className={styles.small}>این آزمون تمرینی است و هوش یا قبولی را نمی‌سنجد؛ نشان می‌دهد کدام مبحث تمرین بیشتری لازم دارد. سؤال‌ها با همان ابزارهای جعبه‌ابزار ساخته شده‌اند.</p>

      <div className={`${styles.row} ${styles.noPrint}`}>
        <button
          className={styles.primary}
          onClick={() => {
            endRun();
            router.push("/practice/");
          }}
        >
          پایان
        </button>
      </div>
    </main>
  );
}

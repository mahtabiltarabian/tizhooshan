"use client";

// The bar above a tool during a session: which question, the three-step
// hint, the stars for the answer, and the way on.
//
// Exams (exam.ts) run in stages; at the end of a stage the stage screen
// (PracticeResult) takes over. The learning exam keeps hints and, after
// each answer, says kindly whether it was right and gives the right answer.
// Real-exam practice and the placement test say nothing about answers,
// show the stage's time left (real exam only), and let a question be left
// blank.

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { easierLevel } from "./adaptive";
import { endRun, examKind, getRun, getScreenAdapter, lastOfStage, updateRun, useHash, useRun, type Run } from "./bridge";
import { EXAM_AREAS, EXAM_STAGES, PLACEMENT_ROUNDS } from "./exam";
import { catalogTool, practiceHref } from "./catalog";
import { starsOf } from "./rewards";
import { fa } from "@/tools/registry";
import styles from "./PracticeBar.module.css";

export const RUN_TITLE: Record<Run["kind"], string> = {
  practice: "بازی امروز",
  daily: "چالش روزانه",
  exam: "آزمون شبیه‌سازی",
  assignment: "تکلیف",
  placement: "تعیین سطح",
};

/** The run's name, with the exam's kind. */
export function runTitle(r: Pick<Run, "kind" | "exam">) {
  const kind = examKind(r);
  if (kind === "learn") return "آزمون آموزشی";
  if (kind === "real" && r.exam) return "آزمون شبیه واقعی";
  return RUN_TITLE[r.kind];
}

/** Is the stage now running (or just ended) the last one? */
export const finalStage = (r: Pick<Run, "exam">) =>
  !r.exam || r.exam.stage >= (r.exam.kind === "placement" ? PLACEMENT_ROUNDS : EXAM_STAGES.length) - 1;

const PRAISE = ["آفرین! درست بود.", "عالی! درست جواب دادی.", "درسته! خوب فکر کردی.", "بله، درست است. ادامه بده!"];

const noop = () => () => {};
/** Re-render once a second (exam clock, daily limit). */
function useNow(on: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [on]);
  return now;
}

export const starText = (n: number) => "★".repeat(n) + "☆".repeat(3 - n);

/** "/tools/clock/" and "/tools/clock" are the same page. */
export const samePath = (a: string, b: string) => a.replace(/\/+$/, "") === b.replace(/\/+$/, "");

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return fa(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
};

/** Opens question `index` of the run: same page through the address, another tool through the router. */
export function openItem(r: Run, index: number, push: (href: string) => void) {
  const item = r.items[index];
  updateRun({ index, hints: 0, itemStartedAt: Date.now() });
  const href = practiceHref(item);
  const [path, hash] = href.split("#");
  if (samePath(window.location.pathname, path)) window.location.hash = hash;
  else push(href);
}

export function PracticeBar() {
  const r = useRun();
  const pathname = usePathname();
  const router = useRouter();
  const adapter = useSyncExternalStore(noop, getScreenAdapter, () => null);
  const kind = examKind(r);
  // No word on answers: real-exam practice and placement.
  const exam = kind === "real" || kind === "placement";
  const staged = !!r?.exam;
  const now = useNow(!!r && !r.finished);

  const hash = useHash(pathname);
  const item = r && !r.finished ? r.items[r.index] : undefined;
  const onTool = !!item && samePath(pathname, catalogTool(item.tool)?.href ?? "") && new URLSearchParams(hash.slice(1)).has("practice");

  // Tool pages hide their own mode tabs, level chips and "new example" in a session.
  useEffect(() => {
    const html = document.documentElement;
    if (onTool) html.dataset.practice = "on";
    else delete html.dataset.practice;
    if (onTool && exam) html.dataset.exam = "on";
    else delete html.dataset.exam;
  }, [onTool, exam]);

  const finish = () => {
    updateRun({ finished: true, finishedAt: Date.now() });
    router.push("/practice/result/");
  };

  /** End of a stage: the stage screen, or the report card after the last one. */
  const endStage = () => {
    const cur = getRun();
    if (!cur) return;
    if (!cur.exam || finalStage(cur)) return finish();
    updateRun({ exam: { ...cur.exam, between: true }, finishedAt: Date.now() });
    router.push("/practice/result/");
  };

  // Time is up in the exam (in a staged exam: this stage). The daily limit is checked after each answer.
  useEffect(() => {
    if (!r || r.finished || r.exam?.between || !r.endsAt || examKind(r) !== "real") return;
    if (now >= r.endsAt) endStage();
  });

  if (!r || r.finished || !item || !onTool) return null;

  const result = r.results[r.index];
  const answered = !!result;
  const last = r.index === r.items.length - 1;
  const limitReached = !exam && r.endsAt !== undefined && now >= r.endsAt;
  const hints = adapter && adapter.tool === item.tool ? adapter.hints(item.type, item.level, item.seed) : null;

  const next = () => {
    const cur = getRun();
    if (!cur) return;
    if (cur.exam && lastOfStage(cur)) return endStage();
    if (last || limitReached) return finish();
    // Three wrong in a row: a short lesson came first; the next question of the same skill is one step easier.
    // (Exams set their levels stage by stage instead.)
    if (cur.wrongStreak >= 3 && !cur.exam) {
      const items = cur.items.map((it, i) =>
        i > cur.index && it.tool === item.tool && it.type === item.type ? { ...it, level: easierLevel(it.level, catalogTool(it.tool)?.levels ?? [1]) } : it,
      );
      updateRun({ items, wrongStreak: 0 });
      return openItem({ ...cur, items }, cur.index + 1, router.push);
    }
    openItem(cur, cur.index + 1, router.push);
  };

  const showLesson = !staged && !exam && answered && r.wrongStreak >= 3;
  const solution = adapter && adapter.tool === item.tool ? adapter.solution(item.type, item.level, item.seed) : undefined;
  const where = r.exam
    ? r.exam.kind === "placement"
      ? `سؤال ${fa(r.index + 1)} از ${fa(PLACEMENT_ROUNDS * EXAM_AREAS.length)}`
      : `مرحله ${fa(r.exam.stage + 1)} از ${fa(EXAM_STAGES.length)} (${EXAM_STAGES[r.exam.stage].title}) · سؤال ${fa(r.index - r.exam.stageStart + 1)} از ${fa(r.items.length - r.exam.stageStart)}`
    : `سؤال ${fa(r.index + 1)} از ${fa(r.items.length)}`;

  return (
    <div className={styles.bar} role="region" aria-label={RUN_TITLE[r.kind]}>
      <strong>{runTitle(r)}</strong>
      <span>{where}</span>
      {kind === "real" && r.endsAt && (
        <span className={styles.clock} aria-label="زمان باقی‌مانده">
          ⏱ {clock(r.endsAt - now)}
        </span>
      )}
      {kind === "learn" && !answered && <span className={styles.clock}>⏱ {clock(now - r.itemStartedAt)}</span>}

      {!exam && !answered && hints && (
        <div className={styles.hints}>
          <button onClick={() => updateRun({ hints: Math.min(3, r.hints + 1) })} disabled={r.hints >= 3}>
            {r.hints === 0 ? "راهنمایی" : r.hints < 3 ? "راهنمایی بیشتر" : "راهنمایی تمام شد"}
          </button>
          {r.hints > 0 && (
            <ol className={styles.hintList} aria-live="polite">
              {hints.slice(0, r.hints).map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ol>
          )}
        </div>
      )}

      {!exam && !staged && answered && (
        <span className={styles.stars} aria-label={`${fa(starsOf(result))} ستاره از ۳`}>
          {starText(starsOf(result))}
        </span>
      )}
      {kind === "learn" && answered && (
        <div className={styles.lesson} role="status">
          {result.tag === "right" ? (
            <p>
              <strong>✓ {PRAISE[r.index % PRAISE.length]}</strong>
            </p>
          ) : (
            <p>
              <strong>↻ اشکالی ندارد؛ با اشتباه یاد می‌گیریم.</strong> {solution ?? hints?.[1]}
            </p>
          )}
        </div>
      )}
      {kind === "placement" && answered && <span>پاسخ ثبت شد. آفرین برای تلاشت!</span>}
      {kind === "real" && answered && <span>پاسخ ثبت شد.</span>}

      {showLesson && (
        <div className={styles.lesson} role="status">
          <p>
            <strong>بیا یک لحظه با هم مرور کنیم.</strong> {hints?.[1]}
          </p>
          <p>بازخورد کنار صفحه را بخوان و اگر خواستی پخش را دوباره ببین. سؤال بعدی کمی آسان‌تر است.</p>
        </div>
      )}
      {limitReached && answered && <span>وقت تمرین امروز تمام شد؛ آفرین برای تلاشت!</span>}

      <span className={styles.grow} />
      {answered && (
        <button className={styles.primary} onClick={next}>
          {staged && lastOfStage(r) ? (finalStage(r) ? "دیدن کارنامه" : "پایان این مرحله") : last || limitReached ? "دیدن نتیجه" : "سؤال بعدی ←"}
        </button>
      )}
      {staged && !answered && (
        <button className={styles.quiet} onClick={next}>
          {kind === "real" ? "بی‌جواب بگذار ←" : "نمی‌دانم، بعدی ←"}
        </button>
      )}
      <button
        className={styles.quiet}
        onClick={() => {
          if (!confirm(exam || staged ? "آزمون تمام شود؟ پاسخ‌های داده‌شده ثبت شده‌اند." : "تمرین تمام شود؟ پاسخ‌های داده‌شده ثبت شده‌اند.")) return;
          if (r.results.some(Boolean)) finish();
          else {
            endRun();
            router.push("/practice/");
          }
        }}
      >
        پایان
      </button>
    </div>
  );
}

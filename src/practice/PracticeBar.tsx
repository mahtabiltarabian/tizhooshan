"use client";

// The bar above a tool during a session: which question, the three-step
// hint, the stars for the answer, and the way on. In a mock exam it shows
// the time left instead of hints, and never says whether an answer is right.

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { easierLevel } from "./adaptive";
import { endRun, getRun, getScreenAdapter, updateRun, useHash, useRun, type Run } from "./bridge";
import { catalogTool, practiceHref } from "./catalog";
import { starsOf } from "./rewards";
import { fa } from "@/tools/registry";
import styles from "./PracticeBar.module.css";

export const RUN_TITLE: Record<Run["kind"], string> = {
  practice: "بازی امروز",
  daily: "چالش روزانه",
  exam: "آزمون شبیه‌سازی",
  assignment: "تکلیف",
};

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
  const exam = r?.kind === "exam";
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

  // Time is up in the exam. (The daily limit is checked after each answer.)
  useEffect(() => {
    if (!r || r.finished || !r.endsAt || r.kind !== "exam") return;
    if (now >= r.endsAt) finish();
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
    if (last || limitReached) return finish();
    // Three wrong in a row: a short lesson came first; the next question of the same skill is one step easier.
    if (cur.wrongStreak >= 3) {
      const items = cur.items.map((it, i) =>
        i > cur.index && it.tool === item.tool && it.type === item.type ? { ...it, level: easierLevel(it.level, catalogTool(it.tool)?.levels ?? [1]) } : it,
      );
      updateRun({ items, wrongStreak: 0 });
      return openItem({ ...cur, items }, cur.index + 1, router.push);
    }
    openItem(cur, cur.index + 1, router.push);
  };

  const showLesson = !exam && answered && r.wrongStreak >= 3;

  return (
    <div className={styles.bar} role="region" aria-label={RUN_TITLE[r.kind]}>
      <strong>{RUN_TITLE[r.kind]}</strong>
      <span>
        سؤال {fa(r.index + 1)} از {fa(r.items.length)}
      </span>
      {exam && r.endsAt && <span className={styles.clock}>⏱ {clock(r.endsAt - now)}</span>}

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

      {!exam && answered && (
        <span className={styles.stars} aria-label={`${fa(starsOf(result))} ستاره از ۳`}>
          {starText(starsOf(result))}
        </span>
      )}
      {exam && answered && <span>پاسخ ثبت شد.</span>}

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
          {last || limitReached ? "دیدن نتیجه" : "سؤال بعدی ←"}
        </button>
      )}
      <button
        className={styles.quiet}
        onClick={() => {
          if (!confirm(exam ? "آزمون تمام شود؟ پاسخ‌های داده‌شده ثبت شده‌اند." : "تمرین تمام شود؟ پاسخ‌های داده‌شده ثبت شده‌اند.")) return;
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

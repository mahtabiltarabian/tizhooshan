"use client";

// One-page teacher guide, opened from inside any tool. Same template for all
// 20 tools (sections 8.3 of the plan): aim, a 10-minute lesson, three
// questions for the class, common misconceptions, and 8–12 hand-picked
// scenes that open the tool on one exact example.

import { useRef, useState } from "react";
import styles from "./TeacherGuide.module.css";

/** One hand-picked scene: a link that opens the tool on one exact example. */
export interface GuideExample {
  /** The tool's shareable link without "#", e.g. "try=mirror&level=1&seed=12". */
  hash: string;
  /** Short name of the scene. */
  title: string;
  /** What to ask or point at when the scene is on the board. */
  note: string;
  /** Index (or indexes) of the misconception(s) this scene was picked for. */
  for?: number | number[];
}

/** The misconceptions a scene was picked for. */
export const pickedFor = (ex: GuideExample): number[] => (ex.for === undefined ? [] : [ex.for].flat());

/** Opens a scene. Tools read the link once on arrival, so the page reloads. */
function openScene(hash: string) {
  window.location.hash = hash;
  window.location.reload();
}

export interface GuideContent {
  title: string;
  aim: string;
  /** Exam topic and suggested textbook topic. */
  links: { exam: string; textbook: string };
  lesson: { minutes: number; mode: string; what: string }[];
  questions: string[];
  misconceptions: { wrong: string; fix: string }[];
  /** Hand-picked, reviewed scenes (8–12 per tool, plan section 4). */
  examples?: GuideExample[];
  /** Shown until the education adviser signs the guide off. */
  draft?: boolean;
}

function SceneLink({ example }: { example: GuideExample }) {
  return (
    <a
      className={styles.scene}
      href={`#${example.hash}`}
      onClick={(e) => {
        e.preventDefault();
        openScene(example.hash);
      }}
    >
      {example.title}
    </a>
  );
}

/** Persian digits without Intl, which is slow to start on weak tablets. */
const faDigits = (n: number) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

export function TeacherGuideButton({ guide, className }: { guide: GuideContent; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  // The page is built only while open, so it costs nothing when a tool loads.
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className={className}
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
      >
        راهنمای معلم
      </button>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby="guide-title"
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      >
        {open && (
          <article className={styles.page}>
            <header>
              <h2 id="guide-title">راهنمای معلم · {guide.title}</h2>
              <button className={styles.close} onClick={() => dialog.current?.close()} aria-label="بستن">
                ✕
              </button>
            </header>
            {guide.draft && <p className={styles.draft}>پیش‌نویس: پیش از انتشار، مشاور آموزشی این راهنما را تأیید می‌کند.</p>}

            <section>
              <h3>هدف</h3>
              <p>{guide.aim}</p>
              <p className={styles.links}>
                <span>مبحث آزمون: {guide.links.exam}</span>
                <span>مبحث کتاب (پیشنهادی): {guide.links.textbook}</span>
              </p>
            </section>

            <section>
              <h3>سناریوی ۱۰ دقیقه‌ای کلاس</h3>
              <ol className={styles.lesson}>
                {guide.lesson.map((step, i) => (
                  <li key={i}>
                    <strong>
                      {faDigits(step.minutes)} دقیقه · {step.mode}:
                    </strong>{" "}
                    {step.what}
                  </li>
                ))}
              </ol>
            </section>

            <section>
              <h3>سه پرسش برای کلاس</h3>
              <ol>
                {guide.questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ol>
            </section>

            <section>
              <h3>بدفهمی‌های رایج</h3>
              <ul className={styles.misconceptions}>
                {guide.misconceptions.map((m, i) => (
                  <li key={i}>
                    <span className={styles.wrong}>✗ {m.wrong}</span>
                    <span>← {m.fix}</span>
                    {guide.examples
                      ?.filter((ex) => pickedFor(ex).includes(i))
                      .map((ex) => (
                        <span key={ex.hash} className={styles.pick}>
                          صحنه منتخب: <SceneLink example={ex} />
                        </span>
                      ))}
                  </li>
                ))}
              </ul>
            </section>

            {guide.examples && guide.examples.length > 0 && (
              <section>
                <h3>نمونه‌های منتخب</h3>
                <p className={styles.hint}>هر نمونه ابزار را روی همان صحنه باز می‌کند.</p>
                <ol className={styles.examples}>
                  {guide.examples.map((ex) => (
                    <li key={ex.hash}>
                      <SceneLink example={ex} />
                      <span> · {ex.note}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <footer className={styles.footer}>
              <button onClick={() => window.print()}>چاپ راهنما</button>
            </footer>
          </article>
        )}
      </dialog>
    </>
  );
}

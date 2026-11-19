"use client";

// One-page teacher guide, opened from inside any tool. Same template for all
// 20 tools (sections 8.3 of the plan): aim, a 10-minute lesson, three
// questions for the class, common misconceptions.

import { useRef } from "react";
import styles from "./TeacherGuide.module.css";

export interface GuideContent {
  title: string;
  aim: string;
  /** Exam topic and suggested textbook topic. */
  links: { exam: string; textbook: string };
  lesson: { minutes: number; mode: string; what: string }[];
  questions: string[];
  misconceptions: { wrong: string; fix: string }[];
  /** Shown until the education adviser signs the guide off. */
  draft?: boolean;
}

export function TeacherGuideButton({ guide, className }: { guide: GuideContent; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button className={className} onClick={() => dialog.current?.showModal()}>
        راهنمای معلم
      </button>
      <dialog ref={dialog} className={styles.dialog} aria-labelledby="guide-title" onClick={(e) => e.target === dialog.current && dialog.current?.close()}>
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
                    {step.minutes.toLocaleString("fa-IR")} دقیقه · {step.mode}:
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
                </li>
              ))}
            </ul>
          </section>

          <footer className={styles.footer}>
            <button onClick={() => window.print()}>چاپ راهنما</button>
          </footer>
        </article>
      </dialog>
    </>
  );
}

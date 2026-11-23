"use client";

// /practice/report/#child=<id>: the parent's view of one child. Behind the
// parent PIN, like the rest of the parent area.

import Link from "next/link";
import { useEffect, useState } from "react";
import { STAGE_LABEL } from "./adaptive";
import { db } from "./db";
import { checkPin, hasPin, toLatinDigits } from "./parent";
import { Avatar } from "./PracticeHome";
import { buildReport, type ReportData, type Trend } from "./report";
import type { Profile } from "./types";
import { AREA_LABEL, fa } from "@/tools/registry";
import styles from "./Practice.module.css";

const TREND: Record<Trend, string> = {
  up: "↑ بهتر از هفته پیش",
  same: "→ مثل هفته پیش",
  down: "↓ این هفته سخت‌تر بود",
  new: "· هنوز زود است",
};

const WEEKDAY = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
const weekdayOf = (day: number) => WEEKDAY[new Date(day * 86_400_000).getUTCDay()];

export function ParentReport() {
  const [ok, setOk] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [data, setData] = useState<{ profile: Profile; report: ReportData } | null | "missing">(null);

  // No PIN set: the report opens straight away.
  useEffect(() => {
    hasPin()
      .then((locked) => !locked && setOk(true))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!ok) return;
    const id = new URLSearchParams(window.location.hash.slice(1)).get("child");
    Promise.all([db.profiles(), id ? db.attempts(id) : [], id ? db.skills(id) : []]).then(([profiles, attempts, skills]) => {
      const profile = profiles.find((p) => p.id === id);
      setData(profile ? { profile, report: buildReport(attempts, skills, Date.now()) } : "missing");
    });
  }, [ok]);

  if (!ok) {
    return (
      <main className={styles.main}>
        <form
          className={styles.card}
          onSubmit={async (e) => {
            e.preventDefault();
            if (await checkPin(pin)) setOk(true);
            else setError(true);
          }}
        >
          <h1>گزارش پیشرفت</h1>
          <p>این صفحه برای والدین است.</p>
          <input className={styles.input} autoFocus inputMode="numeric" type="password" aria-label="رمز والدین" value={pin} onChange={(e) => setPin(toLatinDigits(e.target.value))} />
          {error && <p className={styles.error}>رمز درست نیست.</p>}
          <div className={styles.row}>
            <button className={styles.primary} type="submit">
              ورود
            </button>
            <Link className={styles.linkButton} href="/practice/">
              بازگشت
            </Link>
          </div>
        </form>
      </main>
    );
  }

  if (data === null) return <main className={styles.main}>… در حال آماده‌سازی</main>;
  if (data === "missing")
    return (
      <main className={styles.main}>
        <p>این پروفایل پیدا نشد.</p>
        <Link className={styles.linkButton} href="/practice/">
          بازگشت
        </Link>
      </main>
    );

  const { profile, report } = data;
  const maxMin = Math.max(10, ...report.week.map((d) => d.minutes));
  return (
    <main className={styles.main}>
      <header className={styles.top}>
        <Link href="/practice/">→ تمرین</Link>
        <h1>گزارش پیشرفت</h1>
      </header>

      <div className={styles.hello}>
        <Avatar index={profile.avatar} photo={profile.photo} name={profile.nickname} size={56} />
        <div>
          <h2>{profile.nickname}</h2>
          <p className={styles.small}>
            {profile.grade ? `پایه ${fa(profile.grade)} · ` : ""}این هفته {fa(report.answersThisWeek)} سؤال، {fa(report.rightThisWeek)} درست
          </p>
        </div>
        <span className={styles.grow} />
        <button className={styles.quiet} onClick={() => window.print()}>
          چاپ
        </button>
      </div>

      <section className={styles.card}>
        <h3>هفت روز گذشته</h3>
        <div className={styles.weekChart} role="img" aria-label={report.week.map((d) => `${weekdayOf(d.day)} ${fa(d.minutes)} دقیقه`).join("، ")}>
          {report.week.map((d) => (
            <div key={d.day}>
              <span className={styles.small}>{fa(d.minutes)}</span>
              <i style={{ height: `${(d.minutes / maxMin) * 100}%` }} />
              <span className={styles.small}>{weekdayOf(d.day)}</span>
            </div>
          ))}
        </div>
        <p className={styles.small}>دقیقه‌های تمرین در هر روز (زمان پاسخ دادن به سؤال‌ها).</p>
      </section>

      <section className={styles.card}>
        <h3>اشتباه‌های پرتکرار</h3>
        {report.mistakes.length ? (
          <ul className={styles.points}>
            {report.mistakes.map((m) => (
              <li key={m.text}>
                <strong>{m.text}</strong> <span className={styles.small}>({m.tool}، {fa(m.count)} بار در چهار هفته گذشته)</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>هنوز اشتباه تکراری دیده نشده است.</p>
        )}
        <p className={styles.small}>این اشتباه‌ها خودکار در «مرور اشتباه‌ها» برمی‌گردند. اگر خواستید، همان ابزار را با هم باز کنید و «نشانم بده» را ببینید.</p>
      </section>

      {report.areas.map(({ area, skills }) => (
        <section className={styles.card} key={area}>
          <h3>هوش {AREA_LABEL[area]}</h3>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>مهارت</th>
                <th>مرحله</th>
                <th>روند</th>
              </tr>
            </thead>
            <tbody>
              {skills.map((s) => (
                <tr key={s.skill}>
                  <td>
                    {s.title}
                    <br />
                    <span className={styles.small}>{fa(s.answers)} پاسخ</span>
                  </td>
                  <td>
                    <span className={styles.stage} aria-hidden>
                      {STAGE_LABEL.map((_, i) => (
                        <i key={i} className={i <= s.stage ? styles.on : ""} />
                      ))}
                    </span>{" "}
                    {STAGE_LABEL[s.stage]}
                  </td>
                  <td>{TREND[s.trend]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      {!report.areas.length && <p>هنوز تمرینی انجام نشده است.</p>}

      <p className={styles.small}>
        پنج مرحله: {STAGE_LABEL.join("، ")}. مرحله از درستی پاسخ‌ها، سختی سؤال‌ها و تعداد راهنمایی‌ها می‌آید و با چند پاسخ خوش‌شانس بالا نمی‌رود. این گزارش هوش یا شانس قبولی را نمی‌سنجد.
      </p>
    </main>
  );
}

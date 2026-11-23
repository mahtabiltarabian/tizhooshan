"use client";

// /practice/profile/#child=<id>: the child's own profile. Everything since
// the first day: time spent and answers by day, week, month or year; every
// tool with the parts done and the parts still waiting; strong parts and
// parts to practise. Written to the child ("you"), kind, never a grade.
// Open without the PIN, like the child's home; the parent report stays
// behind it.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { STAGE_LABEL } from "./adaptive";
import { db } from "./db";
import { examHistoryKey, type ExamRecord } from "./exam";
import { HistoryChart } from "./ExamCharts";
import { Avatar } from "./PracticeHome";
import {
  buckets,
  dateText,
  durationText,
  highlights,
  PERIODS,
  rangeOf,
  toolRows,
  totals,
  type Period,
} from "./profile";
import {
  AnswersChart,
  AnswersLegend,
  TimeChart,
  ToolsChart,
} from "./ProfileCharts";
import { summarize } from "./summary";
import type { Attempt, Profile, ReviewItem, SkillState } from "./types";
import { AREA_LABEL, fa, type Area } from "@/tools/registry";
import styles from "./Practice.module.css";
import p from "./Profile.module.css";

const GRADE = { 4: "چهارم", 5: "پنجم", 6: "ششم" } as const;
const AREAS: Area[] = ["visual", "computational", "logical", "speed"];

interface Data {
  profile: Profile;
  attempts: Attempt[];
  skills: SkillState[];
  reviews: ReviewItem[];
  exams: ExamRecord[];
}

const pct = (right: number, total: number) =>
  total ? Math.round((100 * right) / total) : 0;

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className={p.tile}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

/**
 * A chart wider than a phone scrolls sideways inside its card. It opens at
 * the left end, where the newest bars are (time runs right to left).
 */
function ScrollX({ children, at }: { children: ReactNode; at: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollLeft = -el.scrollWidth;
  }, [at]);
  return (
    <div ref={ref} className={p.scrollX}>
      {children}
    </div>
  );
}

/** Opens every closed list, so the printed page has everything, then prints. */
function printAll() {
  const closed = [...document.querySelectorAll("details:not([open])")];
  closed.forEach((d) => d.setAttribute("open", ""));
  window.print();
  closed.forEach((d) => d.removeAttribute("open"));
}

export function ChildProfile() {
  const [data, setData] = useState<Data | null | "missing">(null);
  const [period, setPeriod] = useState<Period>("day");
  const [now] = useState(() => Date.now());

  useEffect(() => {
    const id =
      new URLSearchParams(window.location.hash.slice(1)).get("child") ?? "";
    Promise.all([
      db.profiles(),
      db.attempts(id),
      db.skills(id),
      db.reviews(id),
      db.getMeta<ExamRecord[]>(examHistoryKey(id)),
    ]).then(([profiles, attempts, skills, reviews, exams]) => {
      const profile = profiles.find((x) => x.id === id);
      setData(
        profile
          ? { profile, attempts, skills, reviews, exams: exams ?? [] }
          : "missing",
      );
    });
  }, []);

  const view = useMemo(() => {
    if (!data || data === "missing") return null;
    const t = totals(data.attempts, data.profile.createdAt, now);
    const list = buckets(data.attempts, period, now, data.profile.createdAt);
    const inRange = rangeOf(period, list);
    const tools = toolRows(data.attempts, data.skills, inRange);
    return {
      t,
      list,
      tools,
      hl: highlights(tools),
      sum: summarize(data.attempts, data.reviews, now),
    };
  }, [data, period, now]);

  if (data === null)
    return <main className={styles.main}>… در حال آماده‌سازی</main>;
  if (data === "missing" || !view)
    return (
      <main className={styles.main}>
        <p>این پروفایل پیدا نشد.</p>
        <Link className={styles.linkButton} href="/practice/">
          بازگشت
        </Link>
      </main>
    );

  const { profile, exams } = data;
  const { t, list, tools, hl, sum } = view;
  const range = PERIODS.find((x) => x.key === period)!;

  const rangeMin = list.reduce((s, b) => s + b.minutes, 0);
  const rangeRight = list.reduce((s, b) => s + b.right, 0);
  const rangeWrong = list.reduce((s, b) => s + b.wrong, 0);
  const rangeDays = list.reduce((s, b) => s + b.days, 0);
  const maxMin = Math.max(...list.map((b) => b.minutes));
  const inHours = maxMin >= 180;
  const unit = inHours ? "ساعت" : "دقیقه";
  const timeValues = list.map((b) =>
    inHours ? Math.round(b.minutes / 6) / 10 : Math.round(b.minutes),
  );

  const partsTotal = tools.reduce((s, r) => s + r.parts.length, 0);
  const partsTried = tools.reduce((s, r) => s + r.tried, 0);
  const toolsTried = tools.filter((r) => r.tried).length;
  const toolsInRange = tools
    .filter((r) => r.right + r.wrong > 0)
    .sort((a, b) => b.right + b.wrong - (a.right + a.wrong));
  const badgesEarned = sum.badges.filter((b) => b.progress >= b.goal).length;

  return (
    <main className={styles.main}>
      <header className={styles.top}>
        <Link href="/practice/">→ تمرین</Link>
        <h1>پروفایل</h1>
      </header>

      <div className={styles.hello}>
        <Avatar index={profile.avatar} size={72} />
        <div>
          <h2>{profile.nickname}</h2>
          <p className={styles.small}>
            پایه {GRADE[profile.grade]} · از {dateText(t.startDay)} با ما هستی (
            {fa(t.sinceDays)} روز)
          </p>
        </div>
        <span className={styles.grow} />
        <button
          className={`${styles.quiet} ${p.noPrint} ${p.nowrap}`}
          onClick={printAll}
        >
          چاپ یا PDF
        </button>
      </div>

      <section className={styles.card}>
        <h3>از روز اول تا امروز</h3>
        <div className={p.tiles}>
          <Tile
            value={fa(t.daysPracticed)}
            label={`روز تمرین (از ${fa(t.sinceDays)} روز)`}
          />
          <Tile value={durationText(t.minutes)} label="زمان تمرین" />
          <Tile value={fa(t.questions)} label="سؤال جواب دادی" />
          <Tile
            value={`${fa(t.right)}`}
            label={`جواب درست (${fa(pct(t.right, t.questions))}٪)`}
          />
          <Tile value={fa(t.rightAlone)} label="درست، بدون راهنمایی" />
          <Tile value={`★ ${fa(sum.stars)}`} label="ستاره" />
          <Tile
            value={`${fa(toolsTried)} از ${fa(tools.length)}`}
            label="ابزار امتحان کردی"
          />
          <Tile
            value={`${fa(partsTried)} از ${fa(partsTotal)}`}
            label="بخش امتحان کردی"
          />
          <Tile
            value={`${fa(badgesEarned)} از ${fa(sum.badges.length)}`}
            label="نشان گرفتی"
          />
        </div>
        <ul className={styles.points}>
          {t.bestDay && t.bestDay.minutes >= 1 && (
            <li>
              بیشترین تمرین در یک روز: {durationText(t.bestDay.minutes)}،{" "}
              {dateText(t.bestDay.day)}.
            </li>
          )}
          {t.favouriteHour !== null && (
            <li>بیشتر حدود ساعت {fa(t.favouriteHour)} تمرین می‌کنی.</li>
          )}
          {t.questions > 0 && (
            <li>
              از {fa(t.questions)} سؤال، {fa(t.hintsUsed)} بار از راهنمایی کمک
              گرفتی. کمک گرفتن یعنی یاد گرفتن!
            </li>
          )}
          {sum.dueReviews > 0 && (
            <li>{fa(sum.dueReviews)} سؤال در «مرور اشتباه‌ها» منتظر توست.</li>
          )}
          {sum.chainWeeks > 0 && (
            <li>زنجیره تمرین: {fa(sum.chainWeeks)} هفته پشت سر هم.</li>
          )}
        </ul>
      </section>

      <section className={styles.card}>
        <h3>تمرین تو در زمان</h3>
        <div
          className={`${p.tabs} ${p.noPrint}`}
          role="tablist"
          aria-label="نمایش بر اساس"
        >
          {PERIODS.map((x) => (
            <button
              key={x.key}
              role="tab"
              aria-selected={period === x.key}
              onClick={() => setPeriod(x.key)}
            >
              {x.label}
            </button>
          ))}
        </div>
        <p>
          <strong>{range.range}:</strong> {fa(rangeDays)} روز تمرین،{" "}
          {durationText(rangeMin)}، {fa(rangeRight + rangeWrong)} سؤال،{" "}
          {fa(rangeRight)} درست
          {rangeRight + rangeWrong > 0 &&
            ` (${fa(pct(rangeRight, rangeRight + rangeWrong))}٪)`}
          .
        </p>

        <div className={p.chartBlock}>
          <h4>زمان تمرین ({unit})</h4>
          <ScrollX at={period}>
            <TimeChart
              cols={list}
              values={timeValues}
              unit={unit}
              label={`زمان تمرین در ${range.range}، به ${unit}`}
            />
          </ScrollX>
        </div>

        <div className={p.chartBlock}>
          <h4>سؤال‌ها: درست و نادرست</h4>
          <AnswersLegend />
          <ScrollX at={period}>
            <AnswersChart
              cols={list}
              right={list.map((b) => b.right)}
              wrong={list.map((b) => b.wrong)}
              label={`سؤال‌های درست و نادرست در ${range.range}`}
            />
          </ScrollX>
        </div>

        <details className={p.data}>
          <summary>جدول همین اعداد</summary>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>زمان</th>
                <th>روز تمرین</th>
                <th>زمان تمرین</th>
                <th>درست</th>
                <th>نادرست</th>
              </tr>
            </thead>
            <tbody>
              {[...list].reverse().map((b) => (
                <tr key={b.key}>
                  <td>{b.long}</td>
                  <td>{fa(b.days)}</td>
                  <td>{durationText(b.minutes)}</td>
                  <td>{fa(b.right)}</td>
                  <td>{fa(b.wrong)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
        <p className={styles.small}>
          زمان تمرین یعنی وقتی که روی سؤال‌ها گذاشتی؛ هر سؤال حداکثر ۱۰ دقیقه
          حساب می‌شود.
        </p>
      </section>

      <section className={styles.card}>
        <h3>ابزارها در {range.range}</h3>
        {toolsInRange.length ? (
          <>
            <AnswersLegend />
            <ScrollX at={period}>
              <ToolsChart
                rows={toolsInRange}
                label={`درست و نادرست در هر ابزار، ${range.range}`}
              />
            </ScrollX>
          </>
        ) : (
          <p>در این مدت تمرینی نبوده است.</p>
        )}
        {(hl.strong.length > 0 || hl.practice.length > 0) && (
          <div className={p.twoCols}>
            <div>
              <h4>این‌ها را خوب بلدی 🌟</h4>
              {hl.strong.length ? (
                <ul className={styles.points}>
                  {hl.strong.map((h) => (
                    <li key={h.title}>
                      {h.title}{" "}
                      <span className={styles.small}>
                        ({fa(h.right)} از {fa(h.total)})
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.small}>
                  با کمی تمرین بیشتر اینجا پر می‌شود.
                </p>
              )}
            </div>
            <div>
              <h4>با کمی تمرین بهتر می‌شوند 💪</h4>
              {hl.practice.length ? (
                <ul className={styles.points}>
                  {hl.practice.map((h) => (
                    <li key={h.title}>
                      {h.title}{" "}
                      <span className={styles.small}>
                        ({fa(h.right)} از {fa(h.total)})
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.small}>همه را خوب پیش می‌بری!</p>
              )}
            </div>
          </div>
        )}
      </section>

      <section className={styles.card}>
        <h3>همه بخش‌ها: کدام را انجام دادی، کدام مانده</h3>
        <p className={styles.small}>
          ✓ یعنی امتحانش کرده‌ای (با مرحله‌ات)، ○ یعنی هنوز امتحانش نکرده‌ای.
          عددهای درست و نادرست مال {range.range} است.
        </p>
        {AREAS.map((area) => {
          const rows = tools.filter((r) => r.area === area);
          if (!rows.length) return null;
          return (
            <div key={area}>
              <h4>هوش {AREA_LABEL[area]}</h4>
              {rows.map((r) => (
                <details
                  key={r.tool}
                  className={p.tool}
                  open={r.tried > 0 && r.tried < r.parts.length}
                >
                  <summary>
                    <span>{r.title}</span>
                    <progress
                      max={r.parts.length}
                      value={r.tried}
                      aria-hidden
                    />
                    <span className={styles.small}>
                      {fa(r.tried)} از {fa(r.parts.length)} بخش
                      {r.tried === r.parts.length && " · همه را امتحان کردی ✓"}
                      {r.tried === 0 && " · هنوز شروع نکردی"}
                    </span>
                  </summary>
                  <ul className={p.parts}>
                    {r.parts.map((x) => (
                      <li
                        key={x.type}
                        className={x.stage === null ? p.waiting : p.done}
                      >
                        <span>{x.label}</span>
                        {x.stage === null ? (
                          <span className={styles.small}>
                            هنوز امتحانش نکردی
                          </span>
                        ) : (
                          <span className={styles.small}>
                            مرحله: {STAGE_LABEL[x.stage]}
                            {x.right + x.wrong > 0 &&
                              ` · ${fa(x.right)} درست، ${fa(x.wrong)} نادرست`}
                            {x.lastDay !== null &&
                              ` · آخرین بار ${dateText(x.lastDay, false)}`}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <Link
                    className={`${styles.small} ${p.noPrint}`}
                    href={r.href}
                  >
                    رفتن به ابزار ←
                  </Link>
                </details>
              ))}
            </div>
          );
        })}
      </section>

      {exams.length > 0 && (
        <section className={styles.card}>
          <h3>آزمون‌ها</h3>
          <p>
            {fa(exams.length)} آزمون دادی. آخرین: {fa(exams.at(-1)!.right)} از{" "}
            {fa(exams.at(-1)!.total)} درست (
            {fa(pct(exams.at(-1)!.right, exams.at(-1)!.total))}٪).
          </p>
          {exams.length >= 2 && (
            <HistoryChart
              label="درصد جواب درست در آزمون‌ها"
              points={exams.slice(-8)}
            />
          )}
        </section>
      )}

      <p className={`${styles.row} ${p.noPrint}`}>
        <Link className={styles.linkButton} href="/practice/">
          بازگشت به تمرین
        </Link>
        <Link
          className={styles.quiet}
          href={`/practice/report/#child=${profile.id}`}
        >
          گزارش والدین (با رمز)
        </Link>
      </p>
    </main>
  );
}

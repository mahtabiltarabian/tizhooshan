"use client";

// /practice/profile/#child=<id>[&view=parent]: a child's profile, in two
// views. "For me" speaks to the child: stars, this week, what they are good
// at, what to try next, badges. "For parents" has everything since the first
// day: time and answers by day, week, month or year; every tool with the
// parts done and the parts still waiting; exams; printing. Kind, never a
// grade. Open without the PIN, like the child's home.

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
import type { ToolRow } from "./profile";
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

type View = "child" | "parent";

export function ChildProfile() {
  const [data, setData] = useState<Data | null | "missing">(null);
  const [viewMode, setViewMode] = useState<View>("child");
  const [period, setPeriod] = useState<Period>("day");
  const [now] = useState(() => Date.now());

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const id = params.get("child") ?? "";
    const wanted: View = params.get("view") === "parent" ? "parent" : "child";
    Promise.all([
      db.profiles(),
      db.attempts(id),
      db.skills(id),
      db.reviews(id),
      db.getMeta<ExamRecord[]>(examHistoryKey(id)),
    ]).then(([profiles, attempts, skills, reviews, exams]) => {
      const profile = profiles.find((x) => x.id === id);
      setViewMode(wanted);
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
    const allTools = toolRows(data.attempts, data.skills, () => true);
    return {
      t,
      list,
      tools,
      hl: highlights(tools),
      sum: summarize(data.attempts, data.reviews, now),
      allTools,
      hlAll: highlights(allTools),
      week: buckets(data.attempts, "day", now, data.profile.createdAt).slice(
        -7,
      ),
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
  const { t, list, tools, hl, sum, allTools, hlAll, week } = view;
  const showView = (v: View) => {
    setViewMode(v);
    history.replaceState(
      null,
      "",
      `#child=${profile.id}${v === "parent" ? "&view=parent" : ""}`,
    );
  };
  const parent = viewMode === "parent";
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
        <Avatar
          index={profile.avatar}
          photo={profile.photo}
          name={profile.nickname}
          size={72}
        />
        <div>
          <h2>{profile.nickname}</h2>
          <p className={styles.small}>
            {profile.grade ? `پایه ${GRADE[profile.grade]} · ` : ""}از{" "}
            {dateText(t.startDay)} {parent ? "شروع کرده" : "با ما هستی"} (
            {fa(t.sinceDays)} روز)
          </p>
        </div>
        <span className={styles.grow} />
        {parent && (
          <button
            className={`${styles.quiet} ${p.noPrint} ${p.nowrap}`}
            onClick={printAll}
          >
            چاپ یا PDF
          </button>
        )}
      </div>

      <div
        className={`${p.viewTabs} ${p.noPrint}`}
        role="tablist"
        aria-label="نمای پروفایل"
      >
        <button
          role="tab"
          aria-selected={!parent}
          onClick={() => showView("child")}
        >
          برای من
        </button>
        <button
          role="tab"
          aria-selected={parent}
          onClick={() => showView("parent")}
        >
          برای والدین
        </button>
      </div>

      {!parent ? (
        <ChildView
          sum={sum}
          right={t.right}
          tools={allTools}
          strong={hlAll.strong}
          week={week}
          onParent={() => showView("parent")}
        />
      ) : (
        <>
          <section className={styles.card}>
            <h3>از روز اول تا امروز</h3>
            <div className={p.tiles}>
              <Tile
                value={fa(t.daysPracticed)}
                label={`روز تمرین (از ${fa(t.sinceDays)} روز)`}
              />
              <Tile value={durationText(t.minutes)} label="زمان تمرین" />
              <Tile value={fa(t.questions)} label="سؤال جواب داده" />
              <Tile
                value={`${fa(t.right)}`}
                label={`جواب درست (${fa(pct(t.right, t.questions))}٪)`}
              />
              <Tile value={fa(t.rightAlone)} label="درست، بدون راهنمایی" />
              <Tile value={`★ ${fa(sum.stars)}`} label="ستاره" />
              <Tile
                value={`${fa(toolsTried)} از ${fa(tools.length)}`}
                label="ابزار امتحان‌شده"
              />
              <Tile
                value={`${fa(partsTried)} از ${fa(partsTotal)}`}
                label="بخش امتحان‌شده"
              />
              <Tile
                value={`${fa(badgesEarned)} از ${fa(sum.badges.length)}`}
                label="نشان گرفته"
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
                <li>بیشتر حدود ساعت {fa(t.favouriteHour)} تمرین می‌کند.</li>
              )}
              {t.questions > 0 && (
                <li>
                  از {fa(t.questions)} سؤال، {fa(t.hintsUsed)} بار از راهنمایی
                  کمک گرفت؛ کمک گرفتن بخشی از یاد گرفتن است.
                </li>
              )}
              {sum.dueReviews > 0 && (
                <li>
                  {fa(sum.dueReviews)} سؤال در «مرور اشتباه‌ها» منتظر است.
                </li>
              )}
              {sum.chainWeeks > 0 && (
                <li>زنجیره تمرین: {fa(sum.chainWeeks)} هفته پشت سر هم.</li>
              )}
            </ul>
          </section>

          <section className={styles.card}>
            <h3>تمرین در طول زمان</h3>
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
              زمان تمرین یعنی وقتی که روی سؤال‌ها گذاشته شده؛ هر سؤال حداکثر ۱۰
              دقیقه حساب می‌شود.
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
                  <h4>بخش‌های قوی</h4>
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
                  <h4>بخش‌هایی که تمرین بیشتر می‌خواهند</h4>
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
                    <p className={styles.small}>فعلاً بخشی کم نمانده است.</p>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className={styles.card}>
            <h3>همه بخش‌ها: انجام‌شده و مانده</h3>
            <p className={styles.small}>
              ✓ یعنی امتحان شده (با مرحله)، ○ یعنی هنوز امتحان نشده. عددهای درست
              و نادرست مال {range.range} است.
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
                          {r.tried === r.parts.length && " · همه امتحان شده ✓"}
                          {r.tried === 0 && " · هنوز شروع نشده"}
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
                                هنوز امتحان نشده
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
                {fa(exams.length)} آزمون. آخرین: {fa(exams.at(-1)!.right)} از{" "}
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
        </>
      )}

      <p className={`${styles.row} ${p.noPrint}`}>
        <Link className={styles.linkButton} href="/practice/">
          بازگشت به تمرین
        </Link>
        <Link
          className={styles.quiet}
          href={`/practice/report/#child=${profile.id}`}
        >
          گزارش والدین
        </Link>
      </p>
    </main>
  );
}

/** Untried parts to suggest: first in tools already started, then new tools. */
function suggestions(tools: readonly ToolRow[]) {
  const started = tools
    .filter((r) => r.tried > 0 && r.tried < r.parts.length)
    .sort((a, b) => b.tried - a.tried);
  const fresh = tools.filter((r) => r.tried === 0);
  return [...started, ...fresh]
    .slice(0, 3)
    .map((r) => ({
      tool: r.title,
      part: r.parts.find((x) => x.stage === null)!.label,
      href: r.href,
    }));
}

/** The child's own view: short, big, encouraging. */
function ChildView({
  sum,
  right,
  tools,
  strong,
  week,
  onParent,
}: {
  sum: ReturnType<typeof summarize>;
  right: number;
  tools: ToolRow[];
  strong: ReturnType<typeof highlights>["strong"];
  week: ReturnType<typeof buckets>;
  onParent: () => void;
}) {
  const partsTotal = tools.reduce((s, r) => s + r.parts.length, 0);
  const partsTried = tools.reduce((s, r) => s + r.tried, 0);
  const next = suggestions(tools);
  const weekMin = week.reduce((s, b) => s + b.minutes, 0);
  return (
    <>
      <section className={p.bigTiles}>
        <div className={p.bigTile}>
          <strong>★ {fa(sum.stars)}</strong>
          <span>ستاره جمع کردی</span>
        </div>
        <div className={p.bigTile}>
          <strong>{fa(sum.daysThisWeek)} از ۵</strong>
          <span>روز تمرین این هفته</span>
          <progress max={5} value={Math.min(5, sum.daysThisWeek)} aria-hidden />
        </div>
        <div className={p.bigTile}>
          <strong>{fa(right)}</strong>
          <span>جواب درست</span>
        </div>
        <div className={p.bigTile}>
          <strong>
            {fa(partsTried)} از {fa(partsTotal)}
          </strong>
          <span>بخش امتحان کردی</span>
          <progress max={partsTotal} value={partsTried} aria-hidden />
        </div>
      </section>

      <section className={styles.card}>
        <h3>هفت روز اخیر</h3>
        <p className={styles.small}>
          در هفت روز اخیر {durationText(weekMin)} تمرین کردی
          {weekMin >= 1 ? ". آفرین!" : "."}
        </p>
        <ScrollX at="week">
          <TimeChart
            cols={week}
            values={week.map((b) => Math.round(b.minutes))}
            unit="دقیقه"
            label="دقیقه‌های تمرین در هفت روز اخیر"
          />
        </ScrollX>
      </section>

      <div className={p.twoCols}>
        <section className={styles.card}>
          <h3>این‌ها را خوب بلدی</h3>
          {strong.length ? (
            <ul className={p.friendlyList}>
              {strong.map((h) => (
                <li key={h.title}>
                  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                    <path
                      d="M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"
                      fill="#f2b705"
                    />
                  </svg>
                  <span>{h.title}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.small}>
              چند سؤال دیگر جواب بده تا اینجا پر شود.
            </p>
          )}
        </section>
        <section className={styles.card}>
          <h3>بیا این‌ها را امتحان کنیم</h3>
          {next.length ? (
            <ul className={p.friendlyList}>
              {next.map((n) => (
                <li key={n.tool + n.part}>
                  <span className={p.newDot} aria-hidden>
                    +
                  </span>
                  <span className={styles.grow}>
                    {n.tool} · {n.part}
                  </span>
                  <Link href={n.href} className={p.tryLink}>
                    امتحانش کن
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.small}>همه بخش‌ها را امتحان کرده‌ای!</p>
          )}
        </section>
      </div>

      <section className={styles.card}>
        <h3>نشان‌ها</h3>
        <ul className={styles.badges}>
          {sum.badges.map((b) => (
            <li
              key={b.key}
              className={b.progress >= b.goal ? styles.earned : ""}
            >
              <strong>
                {b.progress >= b.goal ? "🏅 " : ""}
                {b.title}
              </strong>
              <span>{b.how}</span>
              <progress
                max={b.goal}
                value={b.progress}
                aria-label={`${fa(b.progress)} از ${fa(b.goal)}`}
              />
              <span className={styles.small}>
                {fa(b.progress)} از {fa(b.goal)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className={`${styles.row} ${p.noPrint}`}>
        <button className={styles.quiet} onClick={onParent}>
          جزئیات بیشتر برای مامان و بابا
        </button>
      </p>
    </>
  );
}

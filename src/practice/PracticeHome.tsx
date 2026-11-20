"use client";

// The practice area (/practice/): the parent sets it up once (consent and a
// PIN), then each child picks their picture and plays "today's game", the
// daily challenge or the mistake review.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { endRun, getRun, startRun, useRun, type RunKind } from "./bridge";
import { SKILLS } from "./catalog";
import { db, newId } from "./db";
import { AccountPanel } from "./AccountPanel";
import { assignmentsOf, deleteChildRemote, syncNow } from "./sync";
import type { AssignmentDto } from "./api";
import { CONSENT_POINTS, checkPin, getParent, setParent, toLatinDigits, validPin } from "./parent";
import { openItem, runTitle } from "./PracticeBar";
import { dailyChallenge, dayNumber } from "./rewards";
import { planSession, type SessionItem } from "./session";
import { EXAM_AREAS, EXAM_STAGES, examHistoryKey, PLACEMENT_ROUNDS, placementKey, type ExamMode, type ExamRecord, type PlacementRecord } from "./exam";
import { startExam, startPlacement } from "./examRun";
import { summarize, timeLeftToday, type ChildSummary } from "./summary";
import type { Profile, SkillState } from "./types";
import { AREA_LABEL, fa } from "@/tools/registry";
import styles from "./Practice.module.css";

/** Picture for a profile: a symbol and a colour, never the colour alone. */
export const AVATARS = [
  { symbol: "▲", color: "var(--toy-1)", name: "مثلث" },
  { symbol: "●", color: "var(--toy-4)", name: "دایره" },
  { symbol: "■", color: "var(--toy-3)", name: "مربع" },
  { symbol: "★", color: "var(--toy-2)", name: "ستاره" },
  { symbol: "◆", color: "var(--toy-5)", name: "لوزی" },
  { symbol: "✿", color: "var(--toy-6)", name: "گل" },
  { symbol: "☾", color: "var(--toy-4)", name: "ماه" },
  { symbol: "⬢", color: "var(--toy-1)", name: "شش‌ضلعی" },
];

export function Avatar({ index, size = 64 }: { index: number; size?: number }) {
  const a = AVATARS[index % AVATARS.length];
  return (
    <span className={styles.avatar} style={{ background: a.color, width: size, height: size, fontSize: size * 0.5 }} aria-label={a.name} role="img">
      {a.symbol}
    </span>
  );
}

const CHILD_KEY = "tizhooshan-child";
const rememberChild = (id: string | null) => {
  try {
    if (id) sessionStorage.setItem(CHILD_KEY, id);
    else sessionStorage.removeItem(CHILD_KEY);
  } catch {}
};
const rememberedChild = () => {
  try {
    return sessionStorage.getItem(CHILD_KEY);
  } catch {
    return null;
  }
};

type Screen = { name: "loading" } | { name: "setup" } | { name: "choose" } | { name: "child"; id: string } | { name: "parent" } | { name: "edit"; profile: Profile | null };

export function PracticeHome() {
  const [screen, setScreen] = useState<Screen>({ name: "loading" });
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [gate, setGate] = useState<null | (() => void)>(null);

  const reload = useCallback(async () => {
    const [parent, list] = await Promise.all([getParent(), db.profiles()]);
    list.sort((a, b) => a.createdAt - b.createdAt);
    setProfiles(list);
    return { parent, list };
  }, []);

  useEffect(() => {
    syncNow().catch(() => {});
  }, []);

  useEffect(() => {
    let live = true;
    Promise.all([getParent(), db.profiles()])
      .then(([parent, list]) => {
        if (!live) return;
        list.sort((a, b) => a.createdAt - b.createdAt);
        setProfiles(list);
        if (!parent) return setScreen({ name: "setup" });
        if (!list.length) return setScreen({ name: "edit", profile: null });
        const id = rememberedChild();
        setScreen(id && list.some((p) => p.id === id) ? { name: "child", id } : { name: "choose" });
      })
      .catch(() => live && setScreen({ name: "setup" }));
    return () => {
      live = false;
    };
  }, []);

  /** Asks for the parent PIN, then runs `then`. */
  const asParent = (then: () => void) => setGate(() => then);

  return (
    <main className={styles.main}>
      <header className={styles.top}>
        <Link href="/">→ همه ابزارها</Link>
        <h1>تمرین</h1>
      </header>

      {screen.name === "loading" && <p>… در حال آماده‌سازی</p>}
      {screen.name === "setup" && <Setup onDone={() => reload().then(() => setScreen({ name: "edit", profile: null }))} />}

      {screen.name === "choose" && (
        <section>
          <h2>کی بازی می‌کند؟</h2>
          <ul className={styles.profiles}>
            {profiles.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => {
                    rememberChild(p.id);
                    setScreen({ name: "child", id: p.id });
                  }}
                >
                  <Avatar index={p.avatar} />
                  <span>{p.nickname}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className={styles.row}>
            <button className={styles.quiet} onClick={() => asParent(() => setScreen({ name: "parent" }))}>
              بخش والدین
            </button>
          </p>
        </section>
      )}

      {screen.name === "child" && (
        <ChildHome
          profile={profiles.find((p) => p.id === screen.id)!}
          asParent={asParent}
          onSwitch={() => {
            rememberChild(null);
            setScreen({ name: "choose" });
          }}
          onParent={() => asParent(() => setScreen({ name: "parent" }))}
        />
      )}

      {screen.name === "parent" && (
        <ParentArea
          profiles={profiles}
          onEdit={(profile) => setScreen({ name: "edit", profile })}
          onDeleted={() =>
            reload().then(({ parent, list }) => {
              rememberChild(null);
              setScreen(!parent ? { name: "setup" } : list.length ? { name: "parent" } : { name: "edit", profile: null });
            })
          }
          onBack={() => setScreen({ name: "choose" })}
        />
      )}

      {screen.name === "edit" && (
        <EditProfile
          profile={screen.profile}
          first={!profiles.length}
          onDone={() => reload().then(({ list }) => setScreen(list.length === 1 ? { name: "choose" } : { name: "parent" }))}
          onCancel={profiles.length ? () => setScreen({ name: "parent" }) : undefined}
        />
      )}

      {gate && (
        <PinGate
          onOk={() => {
            const then = gate;
            setGate(null);
            then();
          }}
          onCancel={() => setGate(null)}
        />
      )}
    </main>
  );
}

function Setup({ onDone }: { onDone: () => void }) {
  const [agree, setAgree] = useState(false);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [error, setError] = useState("");
  return (
    <section className={styles.card}>
      <h2>برای والدین: پیش از شروع</h2>
      <p>در بخش تمرین، برنامه سؤال‌ها را به اندازه کودک انتخاب می‌کند. برای این کار باید چیزهایی ثبت شود:</p>
      <ul className={styles.points}>
        {CONSENT_POINTS.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <label className={styles.check}>
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> خواندم و موافقم.
      </label>
      <p>یک رمز ۴ تا ۶ رقمی برای «بخش والدین» بگذارید (ساختن و پاک کردن پروفایل، گزارش، زمان روزانه):</p>
      <div className={styles.row}>
        <input className={styles.input} inputMode="numeric" type="password" autoComplete="new-password" aria-label="رمز والدین" placeholder="رمز" value={pin} onChange={(e) => setPin(toLatinDigits(e.target.value))} />
        <input className={styles.input} inputMode="numeric" type="password" autoComplete="new-password" aria-label="تکرار رمز" placeholder="تکرار رمز" value={pin2} onChange={(e) => setPin2(toLatinDigits(e.target.value))} />
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <button
        className={styles.primary}
        disabled={!agree}
        onClick={async () => {
          if (!validPin(pin)) return setError("رمز باید ۴ تا ۶ رقم باشد.");
          if (pin !== pin2) return setError("دو رمز یکی نیستند.");
          await setParent(pin);
          onDone();
        }}
      >
        ادامه
      </button>
      <p className={styles.small}>ابزارهای جعبه‌ابزار بدون این بخش هم کامل کار می‌کنند و هیچ چیزی ثبت نمی‌کنند.</p>
    </section>
  );
}

function PinGate({ onOk, onCancel }: { onOk: () => void; onCancel: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  return (
    <div className={styles.overlay} role="dialog" aria-modal aria-label="رمز والدین">
      <form
        className={styles.card}
        onSubmit={async (e) => {
          e.preventDefault();
          if (await checkPin(pin)) onOk();
          else setError(true);
        }}
      >
        <h2>رمز والدین</h2>
        <input className={styles.input} autoFocus inputMode="numeric" type="password" autoComplete="current-password" aria-label="رمز والدین" value={pin} onChange={(e) => setPin(toLatinDigits(e.target.value))} />
        {error && <p className={styles.error}>رمز درست نیست.</p>}
        <div className={styles.row}>
          <button className={styles.primary} type="submit">
            ورود
          </button>
          <button className={styles.quiet} type="button" onClick={onCancel}>
            انصراف
          </button>
        </div>
        <p className={styles.small}>رمز را فراموش کرده‌اید؟ در «بخش والدین» نمی‌شود وارد شد؛ داده‌های مرورگر این سایت را پاک کنید تا از اول شروع شود.</p>
      </form>
    </div>
  );
}

function EditProfile({ profile, first, onDone, onCancel }: { profile: Profile | null; first: boolean; onDone: () => void; onCancel?: () => void }) {
  const year = new Date().getFullYear() - 621; // Rough Solar Hijri year, for the default only.
  const [nickname, setNickname] = useState(profile?.nickname ?? "");
  const [avatar, setAvatar] = useState(profile?.avatar ?? 0);
  const [grade, setGrade] = useState<4 | 5 | 6>(profile?.grade ?? 6);
  const [birthYear, setBirthYear] = useState(profile?.birthYear ?? year - 12);
  const [limit, setLimit] = useState(profile?.dailyLimitMin ?? 30);
  return (
    <section className={styles.card}>
      <h2>{profile ? `ویرایش ${profile.nickname}` : first ? "پروفایل اولین کودک" : "کودک تازه"}</h2>
      <label className={styles.field}>
        نام مستعار (نام کامل لازم نیست)
        <input className={styles.input} maxLength={20} value={nickname} onChange={(e) => setNickname(e.target.value)} />
      </label>
      <fieldset className={styles.field}>
        <legend>تصویر</legend>
        <div className={styles.avatars} role="radiogroup">
          {AVATARS.map((a, i) => (
            <button key={i} role="radio" aria-checked={avatar === i} aria-label={a.name} onClick={() => setAvatar(i)}>
              <Avatar index={i} size={48} />
            </button>
          ))}
        </div>
      </fieldset>
      <div className={styles.row}>
        <label className={styles.field}>
          پایه
          <select className={styles.input} value={grade} onChange={(e) => setGrade(Number(e.target.value) as 4 | 5 | 6)}>
            <option value={4}>چهارم</option>
            <option value={5}>پنجم</option>
            <option value={6}>ششم</option>
          </select>
        </label>
        <label className={styles.field}>
          سال تولد
          <select className={styles.input} value={birthYear} onChange={(e) => setBirthYear(Number(e.target.value))}>
            {Array.from({ length: 8 }, (_, i) => year - 14 + i).map((y) => (
              <option key={y} value={y}>
                {fa(y)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          زمان تمرین روزانه
          <select className={styles.input} value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            {[15, 20, 30, 45, 60].map((m) => (
              <option key={m} value={m}>
                {fa(m)} دقیقه
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={styles.row}>
        <button
          className={styles.primary}
          disabled={!nickname.trim()}
          onClick={async () => {
            await db.putProfile({ id: profile?.id ?? newId(), nickname: nickname.trim(), avatar, grade, birthYear, dailyLimitMin: limit, createdAt: profile?.createdAt ?? Date.now() });
            onDone();
          }}
        >
          ذخیره
        </button>
        {onCancel && (
          <button className={styles.quiet} onClick={onCancel}>
            انصراف
          </button>
        )}
      </div>
    </section>
  );
}

function ParentArea({ profiles, onEdit, onDeleted, onBack }: { profiles: Profile[]; onEdit: (p: Profile | null) => void; onDeleted: () => void; onBack: () => void }) {
  return (
    <section className={styles.card}>
      <h2>بخش والدین</h2>
      <ul className={styles.parentList}>
        {profiles.map((p) => (
          <li key={p.id}>
            <Avatar index={p.avatar} size={40} />
            <strong>{p.nickname}</strong>
            <span className={styles.small}>
              پایه {fa(p.grade)}، {fa(p.dailyLimitMin)} دقیقه در روز
            </span>
            <span className={styles.grow} />
            <Link className={styles.linkButton} href={`/practice/report/#child=${p.id}`}>
              گزارش
            </Link>
            <button className={styles.quiet} onClick={() => onEdit(p)}>
              ویرایش
            </button>
            <button
              className={styles.danger}
              onClick={async () => {
                if (!confirm(`همه داده‌های ${p.nickname} برای همیشه پاک شود؟ این کار برگشت ندارد.`)) return;
                await deleteChildRemote(p.id);
                await db.deleteChild(p.id);
                if (getRun()?.childId === p.id) endRun();
                onDeleted();
              }}
            >
              پاک کردن
            </button>
          </li>
        ))}
      </ul>
      <div className={styles.row}>
        <button className={styles.primary} onClick={() => onEdit(null)}>
          افزودن کودک
        </button>
        <button className={styles.quiet} onClick={onBack}>
          بازگشت
        </button>
      </div>
      <AccountPanel profiles={profiles} />

      <h3>حریم خصوصی</h3>
      <ul className={styles.points}>
        {CONSENT_POINTS.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <button
        className={styles.danger}
        onClick={async () => {
          if (!confirm("همه پروفایل‌ها، پاسخ‌ها، رمز و تنظیمات این بخش برای همیشه پاک شود؟ این کار برگشت ندارد.")) return;
          endRun();
          await db.deleteAll();
          onDeleted();
        }}
      >
        پاک کردن همه داده‌ها
      </button>
    </section>
  );
}

function ChildHome({ profile, onSwitch, onParent, asParent }: { profile: Profile; onSwitch: () => void; onParent: () => void; asParent: (then: () => void) => void }) {
  const router = useRouter();
  const run = useRun();
  const [sum, setSum] = useState<ChildSummary | null>(null);
  const [state, setState] = useState<Awaited<ReturnType<typeof loadChild>> | null>(null);

  useEffect(() => {
    let live = true;
    loadChild(profile.id).then((s) => {
      if (!live) return;
      setState(s);
      setSum(summarize(s.attempts, s.reviews, Date.now()));
    });
    return () => {
      live = false;
    };
  }, [profile.id]);

  if (!sum || !state) return <p>… در حال آماده‌سازی</p>;
  const left = timeLeftToday(sum, profile.dailyLimitMin);
  const resumable = run && run.childId === profile.id && !run.finished;

  const begin = (kind: RunKind, items: SessionItem[], endsAt?: number) => {
    if (!items.length) return;
    const r = startRun({ childId: profile.id, kind, items, endsAt });
    openItem(r, 0, router.push);
  };

  const today = () => {
    const states = new Map(state.skills.map((s) => [s.skill, s]));
    begin("practice", planSession({ catalog: SKILLS, states, reviews: state.reviews, now: Date.now(), seed: Math.floor(Math.random() * 1e9) }), Date.now() + left);
  };
  const reviewOnly = () => {
    const states = new Map(state.skills.map((s) => [s.skill, s]));
    const items = planSession({ catalog: SKILLS, states, reviews: state.reviews, now: Date.now(), seed: Math.floor(Math.random() * 1e9), size: 9 }).filter((i) => i.mode === "review");
    begin("practice", items, Date.now() + left);
  };

  // Placement and exams are sittings of their own: a parent starts them, and they do not count against the daily limit.
  const placement = () => asParent(() => startPlacement(profile.id, router.push));
  const exam = (mode: ExamMode) => asParent(() => void startExam(profile.id, mode, router.push));
  const lastExam = state.exams.at(-1);

  return (
    <section>
      <div className={styles.hello}>
        <Avatar index={profile.avatar} size={72} />
        <div>
          <h2>سلام {profile.nickname}!</h2>
          <p className={styles.small}>
            ★ {fa(sum.stars)} ستاره · این هفته {fa(sum.daysThisWeek)} روز از ۵ روز{sum.chainWeeks > 0 && ` · زنجیره ${fa(sum.chainWeeks)} هفته`}
          </p>
        </div>
        <span className={styles.grow} />
        <button className={styles.quiet} onClick={onSwitch}>
          تعویض
        </button>
      </div>

      {resumable && (
        <div className={styles.card}>
          <p>
            «{runTitle(run)}» نیمه‌کاره است (سؤال {fa(run.index + 1)} از {fa(run.items.length)}).
          </p>
          <div className={styles.row}>
            <button className={styles.primary} onClick={() => openItem(run, run.index, router.push)}>
              ادامه
            </button>
            <button className={styles.quiet} onClick={() => endRun()}>
              کنار بگذار
            </button>
          </div>
        </div>
      )}

      {left <= 0 ? (
        <div className={`${styles.card} ${styles.rest}`}>
          <h3>برای امروز بس است!</h3>
          <p>امروز {fa(Math.round(sum.minutesToday))} دقیقه تمرین کردی. مغزت حالا وقت دارد چیزهای تازه را جا بیندازد. فردا دوباره بیا.</p>
        </div>
      ) : (
        <div className={styles.actions}>
          <button className={styles.big} onClick={today}>
            <strong>بازی امروز</strong>
            <span>{fa(10)} سؤال به اندازه خودت</span>
          </button>
          <button className={styles.big} onClick={() => begin("daily", dailyChallenge(SKILLS, dayNumber(Date.now())), Date.now() + left)} disabled={sum.dailyDoneToday}>
            <strong>چالش روزانه</strong>
            <span>{sum.dailyDoneToday ? "✓ امروز انجامش دادی" : "۳ پازل، هر روز تازه"}</span>
          </button>
          <button className={styles.big} onClick={reviewOnly} disabled={!sum.dueReviews}>
            <strong>مرور اشتباه‌ها</strong>
            <span>{sum.dueReviews ? `${fa(Math.min(3, sum.dueReviews))} سؤال آماده مرور` : "فعلاً چیزی برای مرور نیست"}</span>
          </button>
        </div>
      )}

      {state.assignments.length > 0 && left > 0 && (
        <section>
          <h3>تکلیف‌های کلاس</h3>
          <div className={styles.actions}>
            {state.assignments.map((a: AssignmentDto) => (
              <button key={a.id} className={styles.big} onClick={() => startAssignment(a, profile.id, state.skills, left, router.push)}>
                <strong>{a.title}</strong>
                <span>تا {new Date(a.due).toLocaleDateString("fa-IR")}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className={styles.card}>
        <h3>آزمون</h3>
        {!state.placement ? (
          <>
            <p>
              آزمون چندمرحله‌ای است: اول <strong>تعیین سطح</strong> ({fa(PLACEMENT_ROUNDS * EXAM_AREAS.length)} سؤال کوتاه، بدون نمره)، بعد آزمون در {fa(EXAM_STAGES.length)} مرحله: {EXAM_STAGES.map((s) => s.title).join("، ")}. آخرش کارنامه با نمودار، که چاپ هم می‌شود.
            </p>
            <div className={styles.row}>
              <button className={styles.primary} onClick={placement}>
                شروع تعیین سطح
              </button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.small}>
              سطح شروع: {EXAM_AREAS.map((a) => `${AREA_LABEL[a]} ${fa(state.placement!.levels[a] ?? 1)}`).join("، ")}
              {lastExam && ` · آخرین آزمون: ${fa(lastExam.right)} از ${fa(lastExam.total)} درست`}
            </p>
            <div className={styles.actions}>
              <button className={styles.big} onClick={() => exam("learn")}>
                <strong>آزمون آموزشی</strong>
                <span>بعد از هر سؤال: درست بود یا نه، و جواب درست</span>
              </button>
              <button className={styles.big} onClick={() => exam("real")}>
                <strong>آزمون شبیه واقعی</strong>
                <span>زمان‌دار، مثل روز آزمون؛ جواب‌ها آخر هر مرحله</span>
              </button>
            </div>
            <p className={styles.row}>
              <button className={styles.quiet} onClick={placement}>
                تعیین سطح دوباره
              </button>
            </p>
          </>
        )}
        <p className={styles.small}>با حضور والدین شروع می‌شود و جزو زمان تمرین روزانه حساب نمی‌شود.</p>
      </section>

      <h3>نشان‌ها</h3>
      <ul className={styles.badges}>
        {sum.badges.map((b) => (
          <li key={b.key} className={b.progress >= b.goal ? styles.earned : ""}>
            <strong>
              {b.progress >= b.goal ? "🏅 " : ""}
              {b.title}
            </strong>
            <span>{b.how}</span>
            <progress max={b.goal} value={b.progress} aria-label={`${fa(b.progress)} از ${fa(b.goal)}`} />
            <span className={styles.small}>
              {fa(b.progress)} از {fa(b.goal)}
            </span>
          </li>
        ))}
      </ul>

      <p className={styles.row}>
        <button className={styles.quiet} onClick={onParent}>
          بخش والدین
        </button>
      </p>
    </section>
  );
}

/** A teacher's assignment: a practice session drawn only from its skills. */
function startAssignment(a: AssignmentDto, childId: string, skills: SkillState[], left: number, push: (href: string) => void) {
  const states = new Map(skills.map((s) => [s.skill, s]));
  const only = a.skills.filter((k) => SKILLS.some((s) => s.key === k));
  if (!only.length) return;
  const items = planSession({ catalog: SKILLS, states, reviews: [], now: Date.now(), seed: Math.floor(Math.random() * 1e9), only });
  const r = startRun({ childId, kind: "assignment", items, endsAt: Date.now() + left, assignmentId: a.id });
  openItem(r, 0, push);
}

async function loadChild(id: string) {
  const [attempts, skills, reviews, assignments, placement, exams] = await Promise.all([
    db.attempts(id),
    db.skills(id),
    db.reviews(id),
    assignmentsOf(id),
    db.getMeta<PlacementRecord>(placementKey(id)),
    db.getMeta<ExamRecord[]>(examHistoryKey(id)),
  ]);
  return { attempts, skills, reviews, assignments, placement, exams: exams ?? [] };
}

"use client";

// /panel/: the teacher's side (plan v3, section 12). Sign in with a code by
// SMS, make classrooms, give the join code to parents, see the class skill
// map (stages only, never ability numbers) and set assignments.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { STAGE_LABEL } from "./adaptive";
import type { AssignmentDto, ClassroomDto, Heatmap, User } from "./api";
import { api, ApiError, errorText, hasServer, logout, normalizePhone, requestOtp, verifyOtp } from "./apiClient";
import { CATALOG, toolTitle, typeLabel } from "./catalog";
import { Avatar } from "./PracticeHome";
import { splitSkill } from "./types";
import { fa } from "@/tools/registry";
import styles from "./Practice.module.css";

const KEY = "tizhooshan-teacher";
interface Session {
  token: string;
  user: User;
}
const loadSession = (): Session | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
};
const saveSession = (s: Session | null) => {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {}
};

const skillName = (key: string) => {
  const { tool, type } = splitSkill(key);
  return `${toolTitle(tool)} · ${typeLabel(tool, type)}`;
};

export function TeacherPanel() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    const t = setTimeout(() => setSession(loadSession()), 0);
    return () => clearTimeout(t);
  }, []);

  if (!hasServer)
    return (
      <main className={styles.main}>
        <h1>پنل معلم</h1>
        <p>این نسخه برنامه به سرور وصل نیست. پنل معلم فقط در نسخه‌ای که سرور دارد کار می‌کند.</p>
      </main>
    );
  if (session === undefined) return <main className={styles.main}>… در حال آماده‌سازی</main>;
  if (!session)
    return (
      <SignIn
        onDone={(s) => {
          saveSession(s);
          setSession(s);
        }}
      />
    );
  return (
    <Classes
      session={session}
      onSignOut={async () => {
        await logout(session.token).catch(() => {});
        saveSession(null);
        setSession(null);
      }}
    />
  );
}

function SignIn({ onDone }: { onDone: (s: Session) => void }) {
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  return (
    <main className={styles.main}>
      <header className={styles.top}>
        <Link href="/">→ همه ابزارها</Link>
        <h1>پنل معلم</h1>
      </header>
      <form
        className={styles.card}
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            if (!sentTo) {
              const p = normalizePhone(phone);
              if (!p) throw new ApiError(400, "bad_phone");
              await requestOtp(p);
              setSentTo(p);
            } else {
              const res = await verifyOtp(sentTo, code, "teacher", "پنل معلم");
              if (res.user.role !== "teacher") throw new ApiError(403, "forbidden");
              onDone({ token: res.token, user: res.user });
            }
          } catch (err) {
            setError(err instanceof ApiError && err.code === "forbidden" ? "این شماره حساب والد است؛ برای پنل معلم شماره دیگری لازم است." : errorText(err));
          }
        }}
      >
        <h2>ورود با کد پیامکی</h2>
        {!sentTo ? (
          <label className={styles.field}>
            شماره همراه
            <input className={styles.input} inputMode="tel" autoComplete="tel" dir="ltr" placeholder="09xxxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
        ) : (
          <label className={styles.field}>
            کد پیامک‌شده به {fa(sentTo)}
            <input className={styles.input} autoFocus inputMode="numeric" autoComplete="one-time-code" dir="ltr" value={code} onChange={(e) => setCode(e.target.value.replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c))))} />
          </label>
        )}
        {error && <p className={styles.error}>{error}</p>}
        <button className={styles.primary} type="submit">
          {sentTo ? "ورود" : "دریافت کد"}
        </button>
      </form>
    </main>
  );
}

function Classes({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const [list, setList] = useState<ClassroomDto[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const token = session.token;

  const reload = useCallback(
    () =>
      api<ClassroomDto[]>("/classrooms", { token })
        .then(setList)
        .catch((e) => {
          if (e instanceof ApiError && e.status === 401) onSignOut();
          else setError(errorText(e));
        }),
    [token, onSignOut],
  );
  useEffect(() => {
    const t = setTimeout(reload, 0);
    return () => clearTimeout(t);
  }, [reload]);

  const current = list?.find((c) => c.id === open);

  return (
    <main className={styles.main}>
      <header className={styles.top}>
        <Link href="/">→ همه ابزارها</Link>
        <h1>پنل معلم</h1>
        <span className={styles.grow} />
        <span className={styles.small} dir="ltr">
          {session.user.phone}
        </span>
        <button className={styles.quiet} onClick={onSignOut}>
          خروج
        </button>
      </header>
      {error && <p className={styles.error}>{error}</p>}

      {current ? (
        <ClassView classroom={current} token={token} onBack={() => setOpen(null)} onDeleted={() => (setOpen(null), reload())} />
      ) : (
        <>
          <section className={styles.card}>
            <h2>کلاس‌های من</h2>
            {list === null ? (
              <p>…</p>
            ) : list.length === 0 ? (
              <p>هنوز کلاسی نساخته‌اید.</p>
            ) : (
              <ul className={styles.parentList}>
                {list.map((c) => (
                  <li key={c.id}>
                    <strong>{c.name}</strong>
                    <span className={styles.small}>
                      {fa(c.children?.length ?? 0)} دانش‌آموز · کد کلاس <bdi dir="ltr">{c.joinCode}</bdi>
                    </span>
                    <span className={styles.grow} />
                    <button className={styles.primary} onClick={() => setOpen(c.id)}>
                      باز کن
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <form
            className={`${styles.card} ${styles.row}`}
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim()) return;
              try {
                await api<ClassroomDto>("/classrooms", { token, body: { name: name.trim() } });
                setName("");
                reload();
              } catch (err) {
                setError(errorText(err));
              }
            }}
          >
            <label className={styles.field}>
              کلاس تازه
              <input className={styles.input} maxLength={40} placeholder="مثلاً ششم ب" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <button className={styles.primary} type="submit">
              ساختن
            </button>
          </form>
          <p className={styles.small}>
            کد هر کلاس را به والدین بدهید؛ آن‌ها در «تمرین › بخش والدین › پیوستن به کلاس» کودک را به کلاس وصل می‌کنند. شما فقط نام مستعار، تصویر و پایه هر کودک و پاسخ‌هایش را از همان روز می‌بینید.
          </p>
        </>
      )}
    </main>
  );
}

function ClassView({ classroom, token, onBack, onDeleted }: { classroom: ClassroomDto; token: string; onBack: () => void; onDeleted: () => void }) {
  const [heat, setHeat] = useState<Heatmap | null>(null);
  const [tasks, setTasks] = useState<AssignmentDto[]>([]);
  const [error, setError] = useState("");
  const base = `/classrooms/${classroom.id}`;

  const reload = useCallback(() => {
    api<Heatmap>(`${base}/heatmap`, { token }).then(setHeat).catch((e) => setError(errorText(e)));
    api<AssignmentDto[]>(`${base}/assignments`, { token }).then(setTasks).catch((e) => setError(errorText(e)));
  }, [base, token]);
  useEffect(() => {
    const t = setTimeout(reload, 0);
    return () => clearTimeout(t);
  }, [reload]);

  return (
    <>
      <div className={styles.row}>
        <button className={styles.quiet} onClick={onBack}>
          → همه کلاس‌ها
        </button>
      </div>
      <section className={styles.card}>
        <h2>{classroom.name}</h2>
        <p>
          کد کلاس برای والدین: <strong dir="ltr" style={{ fontSize: "1.4rem", letterSpacing: 3 }}>{classroom.joinCode}</strong>
        </p>
        <ul className={styles.parentList}>
          {(classroom.children ?? []).map((c) => (
            <li key={c.id}>
              <Avatar index={c.avatar} size={36} />
              <strong>{c.nickname}</strong>
              <span className={styles.small}>پایه {fa(c.grade)}</span>
              <span className={styles.grow} />
              <button
                className={styles.quiet}
                onClick={async () => {
                  if (!confirm(`${c.nickname} از کلاس بیرون برود؟`)) return;
                  await api<void>(`${base}/children/${c.id}`, { method: "DELETE", token }).catch((e) => setError(errorText(e)));
                  onDeleted();
                }}
              >
                بیرون از کلاس
              </button>
            </li>
          ))}
        </ul>
        {!classroom.children?.length && <p className={styles.small}>هنوز کسی نپیوسته است.</p>}
      </section>

      <section className={styles.card}>
        <h2>نقشه مهارت کلاس</h2>
        {heat && heat.skills.length ? (
          <div style={{ overflowX: "auto" }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>دانش‌آموز</th>
                  {heat.skills.map((s) => (
                    <th key={s} className={styles.small}>
                      {skillName(s)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heat.rows.map((r) => (
                  <tr key={r.childId}>
                    <td>{r.nickname}</td>
                    {r.cells.map((c, i) => (
                      <td key={i} title={c ? `${STAGE_LABEL[c.stage]}، ${fa(c.answers)} پاسخ` : "تمرین نشده"} style={{ background: c ? `rgba(61, 123, 247, ${0.12 + c.stage * 0.18})` : undefined, color: c && c.stage >= 3 ? "#fff" : undefined }}>
                        {c ? `${fa(c.stage + 1)} · ${STAGE_LABEL[c.stage]}` : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>هنوز پاسخی از این کلاس نرسیده است.</p>
        )}
        <p className={styles.small}>مرحله‌ها از ۱ تا ۵: {STAGE_LABEL.join("، ")}. ستون‌ها مهارت‌هایی‌اند که کسی در کلاس تمرین کرده است.</p>
      </section>

      <AssignmentForm token={token} base={base} tasks={tasks} onChange={reload} onError={setError} />

      {error && <p className={styles.error}>{error}</p>}
      <button
        className={styles.danger}
        onClick={async () => {
          if (!confirm(`کلاس «${classroom.name}» و تکلیف‌هایش پاک شود؟ داده‌های کودکان سر جایش می‌ماند.`)) return;
          await api<void>(base, { method: "DELETE", token }).catch((e) => setError(errorText(e)));
          onDeleted();
        }}
      >
        پاک کردن کلاس
      </button>
    </>
  );
}

function AssignmentForm({ token, base, tasks, onChange, onError }: { token: string; base: string; tasks: AssignmentDto[]; onChange: () => void; onError: (s: string) => void }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const toggle = (k: string) => setSkills(skills.includes(k) ? skills.filter((x) => x !== k) : [...skills, k]);
  return (
    <section className={styles.card}>
      <h2>تکلیف‌ها</h2>
      {tasks.length ? (
        <ul className={styles.parentList}>
          {tasks.map((t) => (
            <li key={t.id}>
              <strong>{t.title}</strong>
              <span className={styles.small}>
                تا {new Date(t.due).toLocaleDateString("fa-IR")} · {t.skills.map(skillName).join("، ")}
              </span>
              <span className={styles.grow} />
              <button className={styles.quiet} onClick={() => api<void>(`${base}/assignments/${t.id}`, { method: "DELETE", token }).then(onChange).catch((e) => onError(errorText(e)))}>
                پاک کردن
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.small}>تکلیفی نیست.</p>
      )}
      <h3>تکلیف تازه</h3>
      <div className={styles.row}>
        <label className={styles.field}>
          عنوان
          <input className={styles.input} maxLength={60} placeholder="مثلاً تمرین ساعت" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className={styles.field}>
          تا تاریخ
          <input className={styles.input} type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
      </div>
      <fieldset className={styles.field}>
        <legend>مهارت‌ها (جلسه تمرین فقط از این‌ها سؤال می‌آورد)</legend>
        {CATALOG.map((t) => (
          <details key={t.tool}>
            <summary>
              {toolTitle(t.tool)} {t.types.some((ty) => skills.includes(`${t.tool}:${ty.key}`)) ? "✓" : ""}
            </summary>
            <div className={styles.row}>
              {t.types.map((ty) => {
                const k = `${t.tool}:${ty.key}`;
                return (
                  <label key={k} className={styles.check}>
                    <input type="checkbox" checked={skills.includes(k)} onChange={() => toggle(k)} /> {ty.label}
                  </label>
                );
              })}
            </div>
          </details>
        ))}
      </fieldset>
      <button
        className={styles.primary}
        disabled={!title.trim() || !due || !skills.length}
        onClick={async () => {
          try {
            await api<AssignmentDto>(`${base}/assignments`, { token, body: { title: title.trim(), skills, due } });
            setTitle("");
            setSkills([]);
            onChange();
          } catch (e) {
            onError(errorText(e));
          }
        }}
      >
        ثبت تکلیف
      </button>
    </section>
  );
}

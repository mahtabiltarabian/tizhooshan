"use client";

// In the parent area: link this device to a parent account (optional), sync,
// join a teacher's classroom, unlink, or delete the account on the server.

import { useEffect, useState } from "react";
import { ApiError, errorText, hasServer, logout, normalizePhone, requestOtp, verifyOtp } from "./apiClient";
import { deleteAccount, getAccount, joinClassroom, setAccount, syncNow, type Account } from "./sync";
import type { Profile } from "./types";
import { fa } from "@/tools/registry";
import styles from "./Practice.module.css";

const when = (t?: number) => (t ? new Date(t).toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" }) : "هنوز نه");

export function AccountPanel({ profiles }: { profiles: Profile[] }) {
  const [account, setAcc] = useState<Account | null | undefined>(undefined);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joinChild, setJoinChild] = useState(profiles[0]?.id ?? "");

  useEffect(() => {
    getAccount().then((a) => setAcc(a ?? null));
  }, []);

  if (!hasServer) return null;

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setMessage(null);
    try {
      const ok = await fn();
      if (ok) setMessage({ ok: true, text: ok });
    } catch (e) {
      setMessage({ ok: false, text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h3>حساب والد (اختیاری)</h3>
      <p className={styles.small}>
        با وصل کردن این دستگاه به حساب والد، پروفایل کودکان (نام مستعار، تصویر، پایه، سال تولد) و پاسخ‌هایشان روی سرور هم نگه داشته می‌شود تا گزارش را روی دستگاه دیگر ببینید و کودک بتواند به کلاس معلمش بپیوندد. سرور هیچ داده‌ای را به سرویس دیگری نمی‌دهد. بدون حساب، همه چیز فقط روی همین دستگاه می‌ماند.
      </p>

      {account === null && (
        <>
          {!sentTo ? (
            <div className={styles.row}>
              <label className={styles.field}>
                شماره همراه والد
                <input className={styles.input} inputMode="tel" autoComplete="tel" dir="ltr" placeholder="09xxxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
              <button
                className={styles.primary}
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const p = normalizePhone(phone);
                    if (!p) throw new ApiError(400, "bad_phone");
                    await requestOtp(p);
                    setSentTo(p);
                    return "کد ۶ رقمی پیامک شد.";
                  })
                }
              >
                دریافت کد
              </button>
            </div>
          ) : (
            <div className={styles.row}>
              <label className={styles.field}>
                کد پیامک‌شده به {fa(sentTo)}
                <input className={styles.input} inputMode="numeric" autoComplete="one-time-code" dir="ltr" value={code} onChange={(e) => setCode(e.target.value.replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c))))} />
              </label>
              <button
                className={styles.primary}
                disabled={busy || code.length < 6}
                onClick={() =>
                  run(async () => {
                    const res = await verifyOtp(sentTo, code, "parent", "تمرین تیزهوشان");
                    if (res.user.role !== "parent") throw new ApiError(403, "forbidden");
                    const acc: Account = { token: res.token, user: res.user, linkedAt: Date.now() };
                    await setAccount(acc);
                    setAcc(acc);
                    await syncNow();
                    setAcc((await getAccount()) ?? acc);
                    return "دستگاه به حساب وصل شد و همگام شد.";
                  })
                }
              >
                وصل کن
              </button>
              <button className={styles.quiet} onClick={() => setSentTo(null)}>
                شماره دیگر
              </button>
            </div>
          )}
        </>
      )}

      {account && (
        <>
          <p>
            وصل به حساب <bdi dir="ltr">{account.user.phone}</bdi> · آخرین همگام‌سازی: {when(account.lastSync)}
          </p>
          <div className={styles.row}>
            <button
              className={styles.primary}
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const r = await syncNow();
                  setAcc((await getAccount()) ?? null);
                  return r ? `همگام شد (${fa(r.sent)} پاسخ تازه).` : "اینترنت وصل نیست.";
                })
              }
            >
              همگام‌سازی
            </button>
            <button
              className={styles.quiet}
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await logout(account.token).catch(() => {});
                  await setAccount(null);
                  setAcc(null);
                  setSentTo(null);
                  return "اتصال این دستگاه قطع شد. داده‌های روی دستگاه سر جایشان هستند.";
                })
              }
            >
              قطع اتصال
            </button>
            <button
              className={styles.danger}
              disabled={busy}
              onClick={() => {
                if (!confirm("حساب والد و همه داده‌های کودکان روی سرور برای همیشه پاک شود؟ داده‌های روی این دستگاه می‌مانند.")) return;
                run(async () => {
                  await deleteAccount();
                  setAcc(null);
                  setSentTo(null);
                  return "حساب و داده‌های سرور پاک شد.";
                });
              }}
            >
              حذف حساب از سرور
            </button>
          </div>

          {profiles.length > 0 && (
            <>
              <h3>پیوستن به کلاس معلم</h3>
              <p className={styles.small}>معلم فقط نام مستعار، تصویر و پایه کودک و پاسخ‌هایش را از این به بعد می‌بیند.</p>
              <div className={styles.row}>
                <label className={styles.field}>
                  کودک
                  <select className={styles.input} value={joinChild} onChange={(e) => setJoinChild(e.target.value)}>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nickname}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  کد کلاس
                  <input className={styles.input} dir="ltr" maxLength={6} value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} />
                </label>
                <button
                  className={styles.primary}
                  disabled={busy || joinCode.length !== 6 || !joinChild}
                  onClick={() =>
                    run(async () => {
                      const c = await joinClassroom(joinCode, joinChild);
                      setJoinCode("");
                      await syncNow();
                      return `به کلاس «${c.name}» پیوست.`;
                    })
                  }
                >
                  پیوستن
                </button>
              </div>
            </>
          )}
        </>
      )}

      {message && <p className={message.ok ? styles.okText : styles.error}>{message.text}</p>}
    </section>
  );
}

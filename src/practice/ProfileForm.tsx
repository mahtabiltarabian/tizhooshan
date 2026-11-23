"use client";

// One form to register a child (the first time, with the parent's consent)
// and to edit a profile later. Only the name is required: the picture or
// photo, grade, birth year, daily time and the parent PIN sit under
// "more (optional)".

import { useState } from "react";
import { AVATARS, Avatar } from "./Avatar";
import { db, newId } from "./db";
import { CONSENT_POINTS, setParent, toLatinDigits, validPin } from "./parent";
import { photoFromFile } from "./photo";
import type { Profile } from "./types";
import { fa } from "@/tools/registry";
import styles from "./Practice.module.css";

type Grade = 4 | 5 | 6;

export function ProfileForm({
  profile,
  register,
  onSaved,
  onCancel,
}: {
  profile: Profile | null;
  /** First time on this device: ask for consent, and offer a parent PIN. */
  register: boolean;
  onSaved: (p: Profile) => void;
  onCancel?: () => void;
}) {
  const year = new Date().getFullYear() - 621; // Rough Solar Hijri year, for the list only.
  const [nickname, setNickname] = useState(profile?.nickname ?? "");
  const [avatar, setAvatar] = useState(profile?.avatar ?? 0);
  const [photo, setPhoto] = useState(profile?.photo);
  const [grade, setGrade] = useState<Grade | undefined>(profile?.grade);
  const [birthYear, setBirthYear] = useState<number | undefined>(
    profile?.birthYear,
  );
  const [limit, setLimit] = useState(profile?.dailyLimitMin ?? 30);
  const [agree, setAgree] = useState(false);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const name = nickname.trim();
  const ready = name && (!register || agree) && !busy;

  const save = async () => {
    setError("");
    if (!name) return setError("اسم کودک را بنویسید.");
    if (register && !agree)
      return setError("برای شروع، تیک «موافقم» را بزنید.");
    if (pin || pin2) {
      if (!validPin(pin))
        return setError("رمز باید ۴ تا ۶ رقم باشد (یا خالی بماند).");
      if (pin !== pin2) return setError("دو رمز یکی نیستند.");
    }
    setBusy(true);
    try {
      if (register) await setParent(pin);
      const p: Profile = {
        id: profile?.id ?? newId(),
        nickname: name,
        avatar,
        ...(photo ? { photo } : {}),
        ...(grade ? { grade } : {}),
        ...(birthYear ? { birthYear } : {}),
        dailyLimitMin: limit,
        createdAt: profile?.createdAt ?? Date.now(),
      };
      await db.putProfile(p);
      onSaved(p);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className={styles.card}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h2>
        {register
          ? "ثبت‌نام"
          : profile
            ? `ویرایش ${profile.nickname}`
            : "کودک تازه"}
      </h2>
      {register && (
        <p>فقط اسم کودک لازم است؛ بقیه را هر وقت خواستید اضافه کنید.</p>
      )}

      <div className={styles.formHead}>
        <Avatar
          index={avatar}
          photo={photo}
          name={name || undefined}
          size={72}
        />
        <label className={`${styles.field} ${styles.grow}`}>
          <strong>اسم کودک</strong>
          <input
            className={styles.input}
            autoFocus={register}
            maxLength={20}
            required
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="مثلاً سارا"
          />
          <span className={styles.small}>
            یک اسم کوتاه یا اسم مستعار کافی است.
          </span>
        </label>
      </div>

      {register && (
        <div className={styles.consent}>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
            />{" "}
            با ثبت پاسخ‌های کودک روی همین دستگاه موافقم.
          </label>
          <details>
            <summary>چه چیزهایی ثبت می‌شود؟</summary>
            <ul className={styles.points}>
              {CONSENT_POINTS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </details>
        </div>
      )}

      <details className={styles.more} open={!register}>
        <summary>
          بیشتر (اختیاری): عکس، پایه، زمان روزانه
          {register ? "، رمز والدین" : ""}
          <span className={styles.moreWhy}>
            با این‌ها کودک شما را بهتر می‌شناسیم و برنامه برایش شخصی‌تر می‌شود.
          </span>
        </summary>

        <fieldset className={styles.field}>
          <legend>عکس یا تصویر</legend>
          <div className={styles.row}>
            <label className={styles.linkButton}>
              {photo ? "عکس دیگر" : "انتخاب عکس"}
              <input
                type="file"
                accept="image/*"
                className={styles.hiddenInput}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  try {
                    setPhoto(await photoFromFile(file));
                  } catch {
                    setError("این فایل عکس نیست یا باز نشد.");
                  }
                }}
              />
            </label>
            {photo && (
              <button
                type="button"
                className={styles.quiet}
                onClick={() => setPhoto(undefined)}
              >
                حذف عکس
              </button>
            )}
          </div>
          <p className={styles.small}>
            عکس فقط روی همین دستگاه می‌ماند و به هیچ جا فرستاده نمی‌شود. بدون
            عکس، یکی از این شکل‌ها نشان داده می‌شود:
          </p>
          <div className={styles.avatars} role="radiogroup" aria-label="شکل">
            {AVATARS.map((a, i) => (
              <button
                type="button"
                key={i}
                role="radio"
                aria-checked={avatar === i}
                aria-label={a.name}
                onClick={() => setAvatar(i)}
              >
                <Avatar index={i} size={44} />
              </button>
            ))}
          </div>
        </fieldset>

        <div className={styles.row}>
          <label className={styles.field}>
            پایه
            <select
              className={styles.input}
              value={grade ?? ""}
              onChange={(e) =>
                setGrade(
                  e.target.value
                    ? (Number(e.target.value) as Grade)
                    : undefined,
                )
              }
            >
              <option value="">نگفتن</option>
              <option value={4}>چهارم</option>
              <option value={5}>پنجم</option>
              <option value={6}>ششم</option>
            </select>
          </label>
          <label className={styles.field}>
            سال تولد
            <select
              className={styles.input}
              value={birthYear ?? ""}
              onChange={(e) =>
                setBirthYear(
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
            >
              <option value="">نگفتن</option>
              {Array.from({ length: 8 }, (_, i) => year - 14 + i).map((y) => (
                <option key={y} value={y}>
                  {fa(y)}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            زمان تمرین روزانه
            <select
              className={styles.input}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              {[15, 20, 30, 45, 60].map((m) => (
                <option key={m} value={m}>
                  {fa(m)} دقیقه
                </option>
              ))}
            </select>
          </label>
        </div>

        {register && (
          <fieldset className={styles.field}>
            <legend>رمز والدین</legend>
            <p className={styles.small}>
              اگر بگذارید، «بخش والدین» (پاک کردن پروفایل، گزارش، زمان روزانه،
              شروع آزمون) فقط با رمز باز می‌شود. بعداً هم می‌شود گذاشت.
            </p>
            <div className={styles.row}>
              <input
                className={styles.input}
                inputMode="numeric"
                type="password"
                autoComplete="new-password"
                aria-label="رمز والدین"
                placeholder="رمز ۴ تا ۶ رقمی"
                value={pin}
                onChange={(e) => setPin(toLatinDigits(e.target.value))}
              />
              <input
                className={styles.input}
                inputMode="numeric"
                type="password"
                autoComplete="new-password"
                aria-label="تکرار رمز"
                placeholder="تکرار رمز"
                value={pin2}
                onChange={(e) => setPin2(toLatinDigits(e.target.value))}
              />
            </div>
          </fieldset>
        )}
      </details>

      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.row}>
        <button className={styles.primary} type="submit" disabled={!ready}>
          {register ? "شروع کن" : "ذخیره"}
        </button>
        {onCancel && (
          <button type="button" className={styles.quiet} onClick={onCancel}>
            انصراف
          </button>
        )}
      </div>
    </form>
  );
}

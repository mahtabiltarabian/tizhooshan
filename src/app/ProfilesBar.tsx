"use client";

// Top of the main page. Before anyone registers: a "sign in / register"
// button (the tools need a registered child). After: one button per child,
// straight to their profile. Never creates the practice database just by
// visiting the page.

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/practice/Avatar";
import { existingProfiles } from "@/practice/db";
import type { Profile } from "@/practice/types";
import styles from "./page.module.css";

export function ProfilesBar() {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);

  useEffect(() => {
    let live = true;
    existingProfiles()
      .then(
        (list) =>
          live &&
          setProfiles([...list].sort((a, b) => a.createdAt - b.createdAt)),
      )
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!profiles) return <div className={styles.profilesSpace} aria-hidden />;
  if (!profiles.length)
    return (
      <nav className={styles.profiles} aria-label="ورود">
        <Link href="/practice/" className={styles.login}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
          ورود / ثبت‌نام
        </Link>
        <span className={styles.loginNote}>
          لطفاً اول ثبت‌نام کنید.
        </span>
      </nav>
    );
  return (
    <nav className={styles.profiles} aria-label="پروفایل‌ها">
      {profiles.map((p) => (
        <Link
          key={p.id}
          href={`/practice/profile/#child=${p.id}`}
          className={styles.profile}
        >
          <Avatar
            index={p.avatar}
            photo={p.photo}
            name={p.nickname}
            size={40}
          />
          <span>
            <strong>پروفایل {p.nickname}</strong>
            <span>پیشرفت، زمان تمرین و نمودارها</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}

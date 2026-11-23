"use client";

// Top of the main page: one button per child on this device, straight to
// their profile. Shows nothing until a parent has made a profile, and never
// creates the practice database just by visiting the page.

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/practice/Avatar";
import { db } from "@/practice/db";
import type { Profile } from "@/practice/types";
import styles from "./page.module.css";

async function savedProfiles(): Promise<Profile[]> {
  if (typeof indexedDB === "undefined") return [];
  // Opening the database would create it: look first, where the browser can tell.
  if ("databases" in indexedDB) {
    const list = await indexedDB.databases();
    if (!list.some((d) => d.name === "tizhooshan")) return [];
  }
  return db.profiles();
}

export function ProfilesBar() {
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    let live = true;
    savedProfiles()
      .then((list) => live && setProfiles([...list].sort((a, b) => a.createdAt - b.createdAt)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!profiles.length) return null;
  return (
    <nav className={styles.profiles} aria-label="پروفایل‌ها">
      {profiles.map((p) => (
        <Link key={p.id} href={`/practice/profile/#child=${p.id}`} className={styles.profile}>
          <Avatar index={p.avatar} size={36} />
          <span>
            <strong>پروفایل {p.nickname}</strong>
            <span>پیشرفت، زمان تمرین و نمودارها</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}

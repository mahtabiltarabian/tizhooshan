"use client";

// The tools are for registered children: with no profile on this device, a
// tool page shows a short "register first" card instead of the tool. Printed
// worksheets stay open (a teacher or parent prints them, nobody plays).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { existingProfiles } from "./db";
import styles from "./Practice.module.css";

export function RequireProfile({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "";
  const open = /\/worksheet\/?$/.test(path);
  const [state, setState] = useState<"checking" | "ok" | "none">("checking");

  useEffect(() => {
    if (open) return;
    let live = true;
    existingProfiles()
      .then((list) => live && setState(list.length ? "ok" : "none"))
      // Storage blocked (a private window): let the tool run rather than lock it.
      .catch(() => live && setState("ok"));
    return () => {
      live = false;
    };
  }, [open]);

  if (open || state === "ok") return <>{children}</>;
  if (state === "checking")
    return <main className={styles.main} aria-busy="true" />;
  return (
    <main className={styles.main}>
      <section className={`${styles.card} ${styles.gate}`}>
        <svg width="72" height="72" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="11" fill="var(--accent-soft)" />
          <circle
            cx="12"
            cy="9"
            r="3.5"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.8"
          />
          <path
            d="M5.5 19a6.5 6.5 0 0 1 13 0"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        <h1>اول ثبت‌نام کن</h1>
        <p>
          برای بازی کردن، یک بار اسمت را ثبت کن. فقط اسم لازم است و یک دقیقه طول
          می‌کشد.
        </p>
        <div className={styles.row}>
          <Link className={styles.primary} href="/practice/">
            ورود / ثبت‌نام
          </Link>
          <Link className={styles.quiet} href="/">
            صفحه اصلی
          </Link>
        </div>
      </section>
    </main>
  );
}

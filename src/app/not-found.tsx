import Link from "next/link";
import styles from "./page.module.css";

// Shown for an unknown address, online or offline.
export default function NotFound() {
  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1>این صفحه پیدا نشد</h1>
        <p>
          نشانی را دوباره ببین، یا از <Link href="/">فهرست همه ابزارها</Link> یکی را انتخاب کن.
        </p>
      </header>
    </main>
  );
}

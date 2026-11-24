import Link from "next/link";
import { AREA_LABEL, TOOLS, fa } from "@/tools/registry";
import { OfflineStatus } from "./OfflineSupport";
import { ProfilesBar } from "./ProfilesBar";
import { AREA_INK, ToolPicture } from "./ToolPicture";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <ProfilesBar />
      <header className={styles.header}>
        <h1>جعبه‌ابزار تیزهوشان</h1>
        <p>ببین، بساز، دست‌کاری کن — حتی بدون اینترنت</p>
        <OfflineStatus />
        <Link href="/practice/" className={styles.practice}>
          <span className={styles.practiceText}>
            <span className={styles.tag}>امروز</span>
            <strong>تمرین</strong>
            <span>بازی امروز، چالش روزانه و مرور اشتباه‌ها، به اندازه هر کودک</span>
          </span>
          <span className={styles.go}>شروع</span>
        </Link>
        {process.env.NEXT_PUBLIC_API_URL && (
          <p>
            معلم هستید؟ <Link href="/panel/">پنل معلم</Link>
          </p>
        )}
      </header>

      <h2 className={styles.section}>ابزارها</h2>
      <ul className={styles.grid}>
        {TOOLS.map((tool) => {
          const card = (
            <>
              <span className={styles.pic} style={{ background: AREA_INK[tool.area].bg }}>
                <ToolPicture id={tool.id} area={tool.area} />
              </span>
              <span className={styles.name}>
                <span className={styles.num}>{fa(tool.id)}</span>
                <span className={styles.title}>{tool.title}</span>
              </span>
              <span className={styles.meta}>
                {AREA_LABEL[tool.area]}
                {!tool.href && ` · موج ${fa(tool.wave)}`}
              </span>
            </>
          );
          return (
            <li key={tool.id} className={`${styles.card} ${styles[tool.area]} ${tool.href ? "" : styles.soon}`}>
              {tool.href ? <Link href={tool.href}>{card}</Link> : <div aria-disabled>{card}</div>}
            </li>
          );
        })}
      </ul>
    </main>
  );
}

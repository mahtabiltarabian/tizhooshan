import Link from "next/link";
import { AREA_LABEL, TOOLS, fa } from "@/tools/registry";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1>جعبه‌ابزار تیزهوشان</h1>
        <p>ببین، بساز، دست‌کاری کن — بدون اینترنت و بدون ثبت‌نام</p>
      </header>

      <ul className={styles.grid}>
        {TOOLS.map((tool) => {
          const card = (
            <>
              <span className={styles.num}>{fa(tool.id)}</span>
              <span className={styles.title}>{tool.title}</span>
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

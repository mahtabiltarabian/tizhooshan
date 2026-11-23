// A profile picture, in a file of its own so the main page can show it
// without loading the practice area.

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

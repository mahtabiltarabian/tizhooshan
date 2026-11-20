import { DAY } from "../shared/practice";

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "YYYY-MM-DD" as a UTC midnight Date, or null when it is not a real date. */
export function parseYmd(s: unknown): Date | null {
  if (typeof s !== "string") return null;
  const m = s.match(YMD);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return back;
}

/** Day number of a "YYYY-MM-DD" date: the same number rewards.ts dayNumber() gives for that local date. */
export const dayOfYmd = (date: Date) => Math.round(date.getTime() / DAY);

export const ymd = (date: Date) => date.toISOString().slice(0, 10);

/** Today on the server's calendar (process TZ), as a UTC midnight Date. */
export function todayDate(now = new Date()) {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

"use client";

// Side panels for the three explore areas on primes and odd/even: rectangles
// of squares, the 1–100 sieve and dot pairs. Their boards are in NumberBoards.tsx.

import { divisors, isPrime, primeFactors } from "@/generators/digits-numbers";
import styles from "@/toolkit/ToolLayout.module.css";
import { fa } from "@/tools/registry";
import own from "./Digits.module.css";
import { SIEVE_PRIMES } from "./NumberBoards";

/** − / + buttons round a value. */
function Stepper({ value, min, max, steps, onChange, label }: { value: number; min: number; max: number; steps: number[]; onChange: (v: number) => void; label: string }) {
  const at = (d: number) => Math.min(max, Math.max(min, value + d));
  return (
    <div className={styles.row} role="group" aria-label={label}>
      {[...steps].reverse().map((d) => (
        <button key={-d} className={styles.clear} onClick={() => onChange(at(-d))} disabled={value <= min} aria-label={`${fa(d)} کمتر`}>
          −{fa(d)}
        </button>
      ))}
      <span className={styles.stepperLabel}>{fa(value)}</span>
      {steps.map((d) => (
        <button key={d} className={styles.clear} onClick={() => onChange(at(d))} disabled={value >= max} aria-label={`${fa(d)} بیشتر`}>
          +{fa(d)}
        </button>
      ))}
    </div>
  );
}

interface RectProps {
  n: number;
  rows: number;
  tried: number[];
  onN: (n: number) => void;
  onRows: (r: number) => void;
  onAll: () => void;
}

/** Explore divisors: n squares in 1, 2, 3, … rows; a full rectangle is a pair of divisors. */
export function RectExplore({ n, rows, tried, onN, onRows, onAll }: RectProps) {
  const found = [...new Set(tried.filter((r) => n % r === 0).map((r) => Math.min(r, n / r)))].sort((a, b) => a - b);
  const pairs = divisors(n).filter((d) => d * d <= n);
  const missing = pairs.filter((d) => !found.includes(d)).length;
  const ds = divisors(n);
  return (
    <>
      <h2 className={styles.progress}>۱. چند مربع؟</h2>
      <Stepper value={n} min={1} max={60} steps={[1, 10]} onChange={onN} label="تعداد مربع‌ها" />
      <h2 className={styles.progress}>۲. در چند ردیف؟</h2>
      <Stepper value={rows} min={1} max={n} steps={[1]} onChange={onRows} label="تعداد ردیف‌ها" />
      <p className={styles.note}>مربع‌ها در ردیف‌های برابر چیده می‌شوند؛ آنچه جا نمی‌شود با خط‌چین کنار می‌ماند. هر مستطیل کامل یک جفت شمارنده است: ردیف × ستون.</p>
      <p className={`${styles.status} ${n % rows === 0 ? styles.good : styles.info}`}>
        {n % rows === 0 ? `✓ ${fa(rows)} و ${fa(n / rows)} شمارنده‌های ${fa(n)} هستند.` : `✗ ${fa(rows)} شمارنده ${fa(n)} نیست: ${fa(n % rows)} مربع اضافه می‌ماند.`}
      </p>
      <h2 className={styles.progress}>جفت‌های پیدا شده</h2>
      <p className={styles.note}>{found.length ? <bdi dir="ltr">{found.map((d) => `${fa(d)} × ${fa(n / d)}`).join("  ·  ")}</bdi> : "هنوز هیچ"}</p>
      {missing === 0 ? (
        <p className={`${styles.status} ${styles.good}`}>
          ✓ همه پیدا شد. شمارنده‌ها: {ds.map((d) => fa(d)).join("، ")} ({fa(ds.length)} تا).{" "}
          {n === 1 ? "۱ فقط یک شمارنده دارد: نه اول است، نه مرکب." : isPrime(n) ? `${fa(n)} فقط یک مستطیل دارد (یک ردیف): عدد اول است.` : `${fa(n)} اول نیست.`}
        </p>
      ) : (
        <p className={styles.note}>هنوز {fa(missing)} جفت مانده. ردیف‌ها را تا جایی امتحان کن که از ستون‌ها بیشتر شوند؛ بعد از آن، همان مستطیل‌ها خوابیده تکرار می‌شوند.</p>
      )}
      <button className={styles.clear} onClick={onAll} disabled={missing === 0}>
        همه جفت‌ها را پیدا کن
      </button>
    </>
  );
}

/** Explore the sieve: cross out the multiples of 2, 3, 5 and 7, and look up any number. */
export function SieveExplore({ k, onK, pick, onPick }: { k: number; onK: (k: number) => void; pick: number; onPick: (n: number) => void }) {
  const crossedBy = SIEVE_PRIMES.slice(0, k).filter((p) => pick !== p && pick % p === 0);
  const fs = primeFactors(pick);
  return (
    <>
      <h2 className={styles.progress}>۱. خط بزن</h2>
      <div className={styles.row}>
        <button className={styles.clear} onClick={() => onK(k + 1)} disabled={k >= SIEVE_PRIMES.length}>
          {k < SIEVE_PRIMES.length ? `مضرب‌های ${fa(SIEVE_PRIMES[k])} را خط بزن` : "همه خط خورد"}
        </button>
        <button className={styles.clear} onClick={() => onK(0)} disabled={k === 0}>
          از نو
        </button>
      </div>
      <p className={styles.note}>هر عدد اول دور خودش حلقه می‌گیرد و مضرب‌هایش با خطِ مخصوص همان عدد خط می‌خورند (۲: ／، ۳: ＼، ۵: —، ۷: |). عددی که چند خط خورده، چند شمارنده اول دارد.</p>
      {k === SIEVE_PRIMES.length && <p className={`${styles.status} ${styles.good}`}>✓ هر عددِ خط‌نخورده (جز ۱) اول است. چرا ۷ کافی است؟ هر عدد مرکبِ تا ۱۰۰ یک شمارنده اول دارد که مربعش از ۱۰۰ بیشتر نیست: ۲، ۳، ۵ یا ۷.</p>}
      <h2 className={styles.progress}>۲. یک عدد را نگاه کن</h2>
      <Stepper value={pick} min={1} max={100} steps={[1, 10]} onChange={onPick} label="عدد" />
      <p className={`${styles.status} ${styles.info}`}>
        {pick === 1 ? (
          "۱ فقط یک شمارنده دارد: نه اول است، نه مرکب."
        ) : isPrime(pick) ? (
          `${fa(pick)} اول است: فقط ۱ و ${fa(pick)} آن را می‌شمارند.`
        ) : (
          <>
            {fa(pick)} اول نیست: <bdi dir="ltr">{`${fa(pick)} = ${fs.map((x) => fa(x)).join(" × ")}`}</bdi>.
          </>
        )}
        {crossedBy.length > 0 && ` روی صفحه با مضرب‌های ${crossedBy.map((p) => fa(p)).join(" و ")} خط خورده است.`}
      </p>
    </>
  );
}

/** Explore odd and even: numbers as dot pairs, added. */
export function DotsExplore({ nums, onNums }: { nums: number[]; onNums: (n: number[]) => void }) {
  const odd = nums.filter((v) => v % 2).length;
  return (
    <>
      <h2 className={styles.progress}>عددها را اضافه کن (تا ۶ عدد)</h2>
      <div className={own.keys} aria-label="عدد تازه">
        {Array.from({ length: 15 }, (_, i) => i + 1).map((d) => (
          <button key={d} onClick={() => onNums([...nums, d])} disabled={nums.length >= 6} aria-label={`اضافه کردن ${fa(d)}`}>
            {fa(d)}
          </button>
        ))}
      </div>
      <div className={styles.row} style={{ marginTop: 6 }}>
        <button className={styles.clear} onClick={() => onNums(nums.slice(0, -1))} disabled={!nums.length}>
          برداشتن آخری
        </button>
        <button className={styles.clear} onClick={() => onNums([])} disabled={!nums.length}>
          پاک کردن
        </button>
      </div>
      <p className={styles.note}>هر عدد جفت‌جفت چیده می‌شود؛ عدد فرد یک نقطه تنها (حلقه‌دار) دارد. نقطه‌های تنها با کمان دوتا دوتا جفت می‌شوند.</p>
      {nums.length > 0 && (
        <p className={`${styles.status} ${styles.info}`}>
          {fa(odd)} عدد فرد ← {odd % 2 ? "یک نقطه بی‌جفت می‌ماند: جمع فرد است." : "همه جفت شدند: جمع زوج است."} عددهای زوج در این حساب اثری ندارند.
        </p>
      )}
      <p className={styles.note}>قاعده‌ها: زوج + زوج = زوج · فرد + فرد = زوج · زوج + فرد = فرد · هر عدد × زوج = زوج · فرد × فرد = فرد.</p>
    </>
  );
}

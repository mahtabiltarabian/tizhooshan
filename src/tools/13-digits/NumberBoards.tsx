"use client";

// Boards for primes and divisors, and odd and even (tool 13), plus the three
// explore boards: rectangles of squares, the 1–100 sieve and dot pairs.
// `step` is how many worked steps are shown (0 = only the question), in step
// with NumberText.ts. Marks are shapes and words (frames, rings, strokes,
// ✓ and ✗), never colour alone.

import type { ReactNode } from "react";
import { Board } from "@/engine-2d/Board";
import {
  divisorCount,
  divisors,
  isPrime,
  primeFactors,
  rootFloor,
  seqTerms,
  YES,
  type NumberQuestion,
  type ParityQuestion,
  type PrimeQuestion,
} from "@/generators/digits-numbers";
import { fa } from "@/tools/registry";
import { numberSteps, pairTrials, primeTrials, primeWay, signsRowFa, smallestRows, treeSplits } from "./NumberText";

const VIEW: [number, number, number, number] = [0, 0, 16, 9];
const INK = "#1f2430";
const SOFT = "#5b6170";
const PAPER = "#ffffff";
const MARK = "#fff1c2";
const r2 = (v: number) => Math.round(v * 1000) / 1000;
const ltr = (s: string) => `⁦${s}⁩`;
const NS = { vectorEffect: "non-scaling-stroke" as const };

function T({ x, y, size = 0.42, soft, bold = true, children, ltrText }: { x: number; y: number; size?: number; soft?: boolean; bold?: boolean; children: ReactNode; ltrText?: boolean }) {
  return (
    <text x={r2(x)} y={r2(y)} fontSize={size} fontWeight={bold ? 700 : 400} textAnchor="middle" direction={ltrText ? "ltr" : "rtl"} dominantBaseline="central" fill={soft ? SOFT : INK}>
      {children}
    </text>
  );
}

/** A framed chip: thick and tinted when `on`, dashed when `faint`. */
function Chip({ x, y, w, h, on, faint, children, size = 0.38 }: { x: number; y: number; w: number; h: number; on?: boolean; faint?: boolean; children: ReactNode; size?: number }) {
  return (
    <g>
      <rect x={r2(x)} y={r2(y)} width={r2(w)} height={r2(h)} rx={0.14} fill={on ? MARK : PAPER} stroke={INK} strokeWidth={on ? 3 : 1.3} strokeDasharray={faint ? "5 3" : undefined} {...NS} />
      <T x={x + w / 2} y={y + h / 2} size={size}>
        {children}
      </T>
    </g>
  );
}

// ── Primes and divisors ──────────────────────────────────────────────────

function PairsBoard({ q, step, total }: { q: PrimeQuestion; step: number; total: number }) {
  const N = q.n;
  const way = primeWay(q);
  const trials = way === "trial" ? primeTrials(N) : way === "tiny" ? [] : pairTrials(N);
  const shown = Math.max(0, Math.min(trials.length, step - 1));
  const done = step >= total;
  const title = q.ask === "isPrime" ? `آیا ${fa(N)} اول است؟` : q.ask === "sum" ? `مجموع شمارنده‌های ${fa(N)}` : `شمارنده‌های ${fa(N)}`;
  const per = 5;
  const colX = (i: number) => (Math.floor(i / per) === 0 ? 8.6 : 1.4);
  const s = rootFloor(N);
  let verdict = "";
  if (q.ask === "isPrime") verdict = q.answer === YES ? `✓ ${fa(N)} اول است` : `✗ ${fa(N)} اول نیست`;
  else if (q.ask === "sum") verdict = `جمع شمارنده‌ها: ${fa(q.answer)}`;
  else verdict = `${fa(divisorCount(N))} شمارنده: ${divisors(N).map((d) => fa(d)).join("، ")}`;
  return (
    <Board view={VIEW} imageName="divisors" label="جفت شمارنده‌ها">
      <T x={8} y={0.6} size={0.5}>
        {title}
      </T>
      {way === "tiny" &&
        divisors(N).map((d, i) => (
          <Chip key={d} x={6.2 + i * 2} y={2.2} w={1.6} h={1.2} on={step >= 2} size={0.6}>
            {fa(d)}
          </Chip>
        ))}
      {way === "tiny" && step >= 1 && (
        <T x={8} y={4.4} size={0.4}>
          {N === 1 ? "فقط یک شمارنده" : "دقیقاً دو شمارنده: ۱ و خودش"}
        </T>
      )}
      {trials.map((d, i) => {
        const x = colX(i);
        const y = 1.3 + (i % per) * 1.12;
        const hit = N % d === 0;
        const on = i < shown;
        const text = !on ? `${fa(d)} ؟` : way === "trial" ? (hit ? ltr(`${fa(N)} = ${fa(d)} × ${fa(N / d)}  ✓`) : `${ltr(`${fa(N)} ÷ ${fa(d)}`)}: باقی‌مانده ${fa(N % d)} ✗`) : hit ? ltr(d * d === N ? `${fa(d)} × ${fa(d)}  ✓ (یکی)` : `${fa(d)} × ${fa(N / d)}  ✓`) : `${fa(d)} ✗`;
        return (
          <Chip key={d} x={x} y={y} w={6} h={0.92} on={on && hit} faint={!on || !hit}>
            {text}
          </Chip>
        );
      })}
      {done && way !== "tiny" && (
        <T x={8} y={7.15} size={0.36} soft>
          {way === "trial" && N % trials[trials.length - 1] === 0 ? "یک شمارنده دیگر پیدا شد؛ بس است" : `${ltr(`${fa(s + 1)} × ${fa(s + 1)} = ${fa((s + 1) * (s + 1))}`)} > ${fa(N)}؛ بس است`}
        </T>
      )}
      <T x={8} y={8.1} size={0.44} soft={!done}>
        {done ? verdict : way === "trial" ? "عددهای اول را یکی‌یکی امتحان کن" : way === "tiny" ? "عدد اول: دقیقاً دو شمارنده" : "جفت‌ها را تا جایی پیدا کن که d × d از عدد بیشتر شود"}
      </T>
    </Board>
  );
}

function TreeBoard({ q, step, total, entry }: { q: PrimeQuestion; step: number; total: number; entry?: (number | null)[] }) {
  const N = q.n;
  const splits = treeSplits(N);
  const shown = Math.max(0, Math.min(splits.length, step - 1));
  const dx = 1.15;
  const dy = 1.25;
  const x0 = 6.2;
  const nodes: { x: number; y: number; v: number; prime: boolean }[] = [{ x: x0, y: 0.8, v: N, prime: isPrime(N) }];
  const lines: [number, number, number, number][] = [];
  for (let i = 0; i < shown; i++) {
    const [, p, rest] = splits[i];
    const px = x0 + i * dx;
    const py = 0.8 + i * dy;
    lines.push([px, py + 0.35, px - 1.1, py + dy - 0.38], [px, py + 0.35, px + dx, py + dy - 0.38]);
    nodes.push({ x: px - 1.1, y: py + dy, v: p, prime: true }, { x: px + dx, y: py + dy, v: rest, prime: isPrime(rest) });
  }
  const fs = primeFactors(N);
  const typed = (entry ?? []).filter((v): v is number => v !== null);
  return (
    <Board view={VIEW} imageName="factor-tree" label="درخت عامل‌ها">
      {lines.map(([a, b, c, d], i) => (
        <line key={i} x1={r2(a)} y1={r2(b)} x2={r2(c)} y2={r2(d)} stroke={INK} strokeWidth={2} {...NS} />
      ))}
      {nodes.map((nd, i) => (
        <g key={i}>
          {nd.prime && step > 0 ? <circle cx={r2(nd.x)} cy={r2(nd.y)} r={0.48} fill={MARK} stroke={INK} strokeWidth={2.5} {...NS} /> : <rect x={r2(nd.x - 0.62)} y={r2(nd.y - 0.36)} width={1.24} height={0.72} rx={0.12} fill={PAPER} stroke={INK} strokeWidth={1.3} {...NS} />}
          <T x={nd.x} y={nd.y} size={0.42}>
            {fa(nd.v)}
          </T>
        </g>
      ))}
      <T x={13.2} y={1} size={0.34} soft>
        ○ دایره = عدد اول
      </T>
      <T x={13.2} y={1.6} size={0.34} soft>
        ▭ قاب = هنوز شکسته می‌شود
      </T>
      {step === 0 && typed.length > 0 && (
        <T x={11.5} y={7.4} size={0.42}>
          {`ضرب تو: ${ltr(`${typed.map((x) => fa(x)).join(" × ")} = ${fa(typed.reduce((p, x) => p * x, 1))}`)}`}
        </T>
      )}
      {step > splits.length + 1 && (
        <T x={11.4} y={7.3} size={0.46}>
          {ltr(`${fa(N)} = ${fs.map((x) => fa(x)).join(" × ")}`)}
        </T>
      )}
      {q.ask === "count" && step >= total && (
        <T x={11.4} y={8.3} size={0.42}>
          {`تعداد شمارنده‌ها: ${fa(q.answer)}`}
        </T>
      )}
    </Board>
  );
}

function SmallestBoard({ q, step, total }: { q: PrimeQuestion; step: number; total: number }) {
  const rows = smallestRows(q.answer);
  const shown = Math.max(0, Math.min(rows, step - 1));
  const w = 1.36;
  const h = 0.98;
  const x0 = 8 + 5 * w;
  return (
    <Board view={VIEW} imageName="divisor-counts" label="شمارش شمارنده‌ها">
      <T x={8} y={0.45} size={0.42}>
        {`اولین عدد با ${fa(q.k)} شمارنده؟ (زیر هر عدد: تعداد شمارنده‌هایش)`}
      </T>
      {Array.from({ length: rows * 10 }, (_, i) => {
        const v = i + 1;
        if (v > q.answer) return null;
        const r = Math.floor(i / 10);
        const c = i % 10;
        const x = x0 - (c + 1) * w;
        const y = 1 + r * h;
        const open = r < shown;
        const hit = open && v === q.answer;
        return (
          <g key={v} opacity={open ? 1 : 0.4}>
            <rect x={r2(x + 0.04)} y={r2(y + 0.04)} width={r2(w - 0.08)} height={r2(h - 0.08)} rx={0.1} fill={hit ? MARK : PAPER} stroke={INK} strokeWidth={hit ? 3.5 : 1} {...NS} />
            <T x={x + w / 2} y={y + 0.32} size={0.34}>
              {fa(v)}
            </T>
            {open && (
              <T x={x + w / 2} y={y + 0.7} size={0.28} soft={!hit}>
                {`(${fa(divisorCount(v))})${hit ? " ★" : ""}`}
              </T>
            )}
          </g>
        );
      })}
      {step >= total && (
        <T x={8} y={8.5} size={0.44}>
          {`جواب: ${fa(q.answer)} — شمارنده‌ها: ${divisors(q.answer).map((d) => fa(d)).join("، ")}`}
        </T>
      )}
    </Board>
  );
}

export function PrimeBoard({ q, step, entry }: { q: PrimeQuestion; step: number; entry?: (number | null)[] }) {
  const total = numberSteps(q).length;
  const way = primeWay(q);
  if (way === "tree") return <TreeBoard q={q} step={step} total={total} entry={entry} />;
  if (way === "smallest") return <SmallestBoard q={q} step={step} total={total} />;
  return <PairsBoard q={q} step={step} total={total} />;
}

// ── Odd and even ─────────────────────────────────────────────────────────

/** A number as dots in pairs (two rows), the lone dot of an odd number ringed. Real dots up to 16; past that, three pairs and "…". */
function DotsG({ x, y, w, value, odd, label, showLone = true }: { x: number; y: number; w: number; value: number | null; odd: boolean; label: string; showLone?: boolean }) {
  const real = value !== null && value <= 16;
  const pairs = real ? Math.floor(value / 2) : 3;
  const gap = Math.min(0.32, (w - 0.5) / (pairs + (real ? 0.6 : 1.8)));
  const dots: ReactNode[] = [];
  const left = x + 0.22;
  for (let i = 0; i < pairs; i++) {
    const cx = r2(left + i * gap + gap / 2);
    dots.push(<circle key={`a${i}`} cx={cx} cy={r2(y + 0.55)} r={0.09} fill={INK} />, <circle key={`b${i}`} cx={cx} cy={r2(y + 0.9)} r={0.09} fill={INK} />);
  }
  const loneX = left + pairs * gap + (real ? gap / 2 : gap * 1.6);
  return (
    <g>
      <rect x={r2(x)} y={r2(y)} width={r2(w)} height={1.3} rx={0.14} fill={PAPER} stroke={INK} strokeWidth={1.3} {...NS} />
      {dots}
      {!real && (
        <T x={left + pairs * gap + gap * 0.55} y={y + 0.72} size={0.3}>
          …
        </T>
      )}
      {odd && showLone && (
        <>
          <circle cx={r2(loneX)} cy={r2(y + 0.55)} r={0.09} fill={INK} />
          <circle cx={r2(loneX)} cy={r2(y + 0.55)} r={0.2} fill="none" stroke={INK} strokeWidth={1.6} {...NS} />
        </>
      )}
      <T x={x + w / 2} y={y - 0.3} size={0.32}>
        {label}
      </T>
    </g>
  );
}
/** Where DotsG puts the lone dot. */
function loneAt(x: number, y: number, w: number, value: number | null): [number, number] {
  const real = value !== null && value <= 16;
  const pairs = real ? Math.floor(value / 2) : 3;
  const gap = Math.min(0.32, (w - 0.5) / (pairs + (real ? 0.6 : 1.8)));
  return [x + 0.22 + pairs * gap + (real ? gap / 2 : gap * 1.6), y + 0.55];
}

/** Arcs joining lone dots two by two; the one left over gets a dashed ring and a word. */
function PairUpG({ at, y }: { at: [number, number][]; y: number }) {
  return (
    <g>
      {at.map(([x], i) =>
        i % 2 === 1 ? <path key={i} d={`M ${r2(at[i - 1][0])} ${r2(y)} Q ${r2((at[i - 1][0] + x) / 2)} ${r2(y + 0.9)} ${r2(x)} ${r2(y)}`} fill="none" stroke={INK} strokeWidth={2.2} {...NS} /> : null,
      )}
      {at.length % 2 === 1 && (
        <>
          <circle cx={r2(at[at.length - 1][0])} cy={r2(at[at.length - 1][1])} r={0.34} fill="none" stroke={INK} strokeWidth={2.5} strokeDasharray="4 3" {...NS} />
          <T x={at[at.length - 1][0]} y={y + 0.75} size={0.3}>
            بی‌جفت
          </T>
        </>
      )}
    </g>
  );
}

const OPS_SIGN = ["+", "−", "×"];

function TermsBoard({ q, step, total }: { q: ParityQuestion; step: number; total: number }) {
  type Term = { value: number | null; odd: boolean; label: string };
  let terms: Term[];
  if (q.ask === "expr") terms = q.nums.map((v) => ({ value: v, odd: v % 2 === 1, label: fa(v) }));
  else if (q.ask === "rule") terms = q.nums.map((p, i) => ({ value: null, odd: p === 1, label: `${["الف", "ب", "پ"][i]} (${p ? "فرد" : "زوج"})` }));
  else if (q.ask === "oddSum") terms = Array.from({ length: q.nums[0] }, () => ({ value: null, odd: true, label: "فرد" }));
  else terms = [...Array.from({ length: q.nums[0] }, () => ({ value: null, odd: true, label: "فرد" })), ...Array.from({ length: q.nums[1] }, () => ({ value: null, odd: false, label: "زوج" }))];
  const rule = q.ask === "expr" || q.ask === "rule";
  const labelsAt = rule ? 2 : 1;
  const pairAt = rule ? 3 : 2;
  const k = terms.length;
  const gapW = rule ? 0.9 : 0.12;
  const w = Math.min(rule ? 3.2 : 1.9, (15.4 - gapW * (k - 1)) / k);
  const totalW = k * w + (k - 1) * gapW;
  const x0 = 8 - totalW / 2;
  const y = 2;
  const xs = terms.map((_, i) => x0 + i * (w + gapW));
  const lone = terms.map((t, i) => (t.odd ? loneAt(xs[i], y, w, t.value) : null)).filter((p): p is [number, number] => p !== null);
  const product = q.op === 2 && rule;
  const verdict =
    q.ask === "oddSum" ? `جمع ${fa(q.nums[0])} عدد فرد: ${q.nums[0] % 2 ? "فرد" : "زوج"} · ${fa(q.target)}: ${q.target % 2 ? "فرد" : "زوج"} ← ${q.answer === YES ? "✓ ممکن است" : "✗ ممکن نیست"}` : `حاصل: ${q.answer === 1 ? "زوج" : "فرد"}`;
  return (
    <Board view={VIEW} imageName="odd-even" label="نقطه‌های جفت و تنها">
      <T x={8} y={0.6} size={0.44}>
        {q.ask === "expr" ? ltr(q.nums.map((v) => fa(v)).join(` ${OPS_SIGN[q.op]} `)) : q.ask === "rule" ? ltr(["الف", "ب", "پ"].slice(0, k).join(` ${OPS_SIGN[q.op]} `)) : q.ask === "oddSum" ? `${fa(q.nums[0])} عدد فرد = ${fa(q.target)} ؟` : `${fa(q.nums[0])} فرد + ${fa(q.nums[1])} زوج`}
      </T>
      {terms.map((t, i) => (
        <g key={i}>
          <DotsG x={xs[i]} y={y} w={w} value={t.value} odd={t.odd} label={step >= labelsAt || !rule ? t.label : t.value !== null ? fa(t.value) : t.label} showLone={step >= 1} />
          {rule && i < k - 1 && (
            <T x={xs[i] + w + gapW / 2} y={y + 0.65} size={0.6} ltrText>
              {OPS_SIGN[q.op]}
            </T>
          )}
        </g>
      ))}
      {step >= labelsAt && (
        <T x={8} y={4.15} size={0.34} soft>
          {`نقطه‌های تنها (حلقه‌دار): ${fa(lone.length)}`}
        </T>
      )}
      {step >= pairAt && !product && <PairUpG at={lone} y={y + 1.55} />}
      {step >= pairAt && product && (
        <T x={8} y={5.2} size={0.38}>
          {q.answer === 1 ? "یکی از عددها زوج است: همه دسته‌ها جفت می‌شوند" : "دسته‌های فرد، تعدادشان فرد: یک نقطه بی‌جفت می‌ماند"}
        </T>
      )}
      <T x={8} y={7.9} size={0.48} soft={step < total}>
        {step >= total ? verdict : "زوج یا فرد؟ نقطه‌های تنها را جفت کن"}
      </T>
    </Board>
  );
}

function SeqBoard({ q, step, total }: { q: ParityQuestion; step: number; total: number }) {
  const t = seqTerms(q);
  const perRow = Math.min(20, t.length);
  const w = Math.min(1.2, 15.4 / perRow);
  const at = (i: number): [number, number] => {
    const r = Math.floor(i / perRow);
    const c = i % perRow;
    const rowLen = Math.min(perRow, t.length - r * perRow);
    return [8 - (rowLen * w) / 2 + c * w, 1.4 + r * 2.4];
  };
  const odd = t.map((v, i) => (v % 2 ? i : -1)).filter((i) => i >= 0);
  // Pairs are joined within a row only, so arcs never cross rows.
  const groups: [number, number][][] = [[], []];
  odd.forEach((i) => {
    const [x, y] = at(i);
    groups[Math.floor(i / perRow)].push([x + w / 2, y + 1.05]);
  });
  const leftover = groups[0].length % 2 === 1 && groups[1].length > 0 ? [groups[0].pop()!, groups[1].shift()!] : null;
  return (
    <Board view={VIEW} imageName="odd-even-run" label="جمع پشت‌سرهم">
      {t.map((v, i) => {
        const [x, y] = at(i);
        const mark = step >= 2 && v % 2 === 1;
        return (
          <g key={i}>
            <rect x={r2(x + 0.03)} y={r2(y)} width={r2(w - 0.06)} height={0.7} rx={0.1} fill={mark ? MARK : PAPER} stroke={INK} strokeWidth={mark ? 2.6 : 1.1} {...NS} />
            <T x={x + w / 2} y={y + 0.36} size={Math.min(0.34, w * 0.42)}>
              {fa(v)}
            </T>
            {mark && <circle cx={r2(x + w / 2)} cy={r2(y + 1.05)} r={0.09} fill={INK} />}
          </g>
        );
      })}
      {step >= 3 && groups.map((g, i) => <PairUpG key={i} at={g} y={1.4 + i * 2.4 + 1.05} />)}
      {step >= 3 && leftover && <line x1={r2(leftover[0][0])} y1={r2(leftover[0][1])} x2={r2(leftover[1][0])} y2={r2(leftover[1][1])} stroke={INK} strokeWidth={2.2} strokeDasharray="6 3" {...NS} />}
      {step >= 2 && (
        <T x={8} y={6.6} size={0.38}>
          {`${fa(t.length)} عدد، ${fa(odd.length)} عدد فرد (قاب پررنگ و نقطه زیرش)`}
        </T>
      )}
      <T x={8} y={7.9} size={0.48} soft={step < total}>
        {step >= total ? `حاصل: ${q.answer === 1 ? "زوج" : "فرد"}` : "فقط عددهای فرد نقطه تنها دارند"}
      </T>
    </Board>
  );
}

function HandshakeBoard({ q, step, total }: { q: ParityQuestion; step: number; total: number }) {
  const [p, k] = q.nums;
  const pos = Array.from({ length: p }, (_, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / p;
    return [8 + 3 * Math.cos(a), 4.1 + 3 * Math.sin(a)] as [number, number];
  });
  const edges: [number, number][] = [];
  if (q.answer === YES && step >= total) {
    for (let i = 0; i < p; i++) for (let s = 1; s <= Math.floor(k / 2); s++) edges.push([i, (i + s) % p]);
    if (k % 2) for (let i = 0; i < p / 2; i++) edges.push([i, i + p / 2]);
  }
  const example = q.answer !== YES && step >= 1;
  const word = q.variant === 0 ? "دست" : "جاده";
  return (
    <Board view={VIEW} imageName={q.variant === 0 ? "handshakes" : "roads"} label={q.variant === 0 ? "دست‌دادن‌ها" : "جاده‌ها"}>
      {edges.map(([a, b], i) => (
        <line key={i} x1={r2(pos[a][0])} y1={r2(pos[a][1])} x2={r2(pos[b][0])} y2={r2(pos[b][1])} stroke={INK} strokeWidth={1.6} {...NS} />
      ))}
      {example && <line x1={r2(pos[0][0])} y1={r2(pos[0][1])} x2={r2(pos[1][0])} y2={r2(pos[1][1])} stroke={INK} strokeWidth={3} strokeDasharray="6 3" {...NS} />}
      {pos.map(([x, y], i) => (
        <g key={i}>
          <circle cx={r2(x)} cy={r2(y)} r={0.42} fill={example && i < 2 ? MARK : PAPER} stroke={INK} strokeWidth={example && i < 2 ? 3 : 1.6} {...NS} />
          <T x={x} y={y} size={0.34}>
            {fa(i + 1)}
          </T>
        </g>
      ))}
      <T x={13.6} y={1} size={0.36}>
        {`هر ${q.variant === 0 ? "نفر" : "شهر"}: ${fa(k)} ${word}`}
      </T>
      {example && (
        <T x={13.6} y={1.7} size={0.3} soft>
          {`هر ${word} دو سر دارد (دو خانه پررنگ)`}
        </T>
      )}
      {step >= 2 && (
        <T x={13.6} y={2.5} size={0.36}>
          {ltr(`${fa(p)} × ${fa(k)} = ${fa(p * k)}`)} {p * k % 2 ? "(فرد)" : "(زوج)"}
        </T>
      )}
      <T x={8} y={8.4} size={0.44} soft={step < total}>
        {step >= total ? (q.answer === YES ? "✓ ممکن است (چیدمان دور دایره)" : "✗ ممکن نیست: جمع باید زوج باشد") : `جمع ${word}های همه، دو برابر تعداد ${word}هاست`}
      </T>
    </Board>
  );
}

/** A domino tiling of the board with the given corner cut, built row by row (null if none of these fits). */
export function dominoTiling(a: number, b: number, variant: number): [number, number, boolean][] | null {
  // [row, column, across]
  const out: [number, number, boolean][] = [];
  if (variant === 0 && (a * b) % 2 === 0) {
    if (b % 2 === 0) for (let r = 0; r < a; r++) for (let c = 0; c < b; c += 2) out.push([r, c, true]);
    else for (let r = 0; r < a; r += 2) for (let c = 0; c < b; c++) out.push([r, c, false]);
    return out;
  }
  if (variant === 1 && (a * b) % 2 === 1) {
    for (let c = 1; c < b; c += 2) out.push([0, c, true]);
    for (let r = 1; r < a; r += 2) for (let c = 0; c < b; c++) out.push([r, c, false]);
    return out;
  }
  return null;
}

/** The board for a worksheet: plain cells, the cut corners crossed out. */
export function DominoPaper({ rows, cols, variant }: { rows: number; cols: number; variant: number }) {
  const s = 22;
  const cut = (r: number, c: number) => (variant >= 1 && r === 0 && c === 0) || (variant === 2 && r === rows - 1 && c === cols - 1);
  return (
    <svg viewBox={`-2 -2 ${cols * s + 4} ${rows * s + 4}`} width={Math.min(220, cols * s + 4)} role="img" aria-label={`صفحه ${fa(rows)} در ${fa(cols)}`}>
      {Array.from({ length: rows * cols }, (_, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        return cut(r, c) ? (
          <g key={i}>
            <rect x={c * s + 2} y={r * s + 2} width={s - 4} height={s - 4} fill="none" stroke={SOFT} strokeDasharray="3 2" />
            <path d={`M ${c * s + 5} ${r * s + 5} L ${c * s + s - 5} ${r * s + s - 5} M ${c * s + s - 5} ${r * s + 5} L ${c * s + 5} ${r * s + s - 5}`} stroke={SOFT} />
          </g>
        ) : (
          <rect key={i} x={c * s} y={r * s} width={s} height={s} fill={PAPER} stroke={INK} strokeWidth={1} />
        );
      })}
    </svg>
  );
}

function DominoBoard({ q, step, total }: { q: ParityQuestion; step: number; total: number }) {
  const [a, b] = q.nums;
  const cell = Math.min(6.2 / a, 10.5 / b);
  const x0 = 6 - (b * cell) / 2;
  const y0 = 0.8;
  const cut = (r: number, c: number) => (q.variant >= 1 && r === 0 && c === 0) || (q.variant === 2 && r === a - 1 && c === b - 1);
  const dots = q.variant === 2 && step >= 3;
  const tiles = q.answer === YES && step >= total ? dominoTiling(a, b, q.variant) : null;
  const cells = a * b - q.variant;
  return (
    <Board view={VIEW} imageName="dominoes" label="صفحه و دومینو">
      {Array.from({ length: a * b }, (_, i) => {
        const r = Math.floor(i / b);
        const c = i % b;
        const x = x0 + c * cell;
        const y = y0 + r * cell;
        if (cut(r, c))
          return (
            <g key={i}>
              <rect x={r2(x + 0.05)} y={r2(y + 0.05)} width={r2(cell - 0.1)} height={r2(cell - 0.1)} fill="none" stroke={SOFT} strokeWidth={1.2} strokeDasharray="4 3" {...NS} />
              <T x={x + cell / 2} y={y + cell / 2} size={cell * 0.45} soft>
                ✗
              </T>
            </g>
          );
        return (
          <g key={i}>
            <rect x={r2(x)} y={r2(y)} width={r2(cell)} height={r2(cell)} fill={PAPER} stroke={INK} strokeWidth={1} {...NS} />
            {dots && (r + c) % 2 === 0 && <circle cx={r2(x + cell / 2)} cy={r2(y + cell / 2)} r={r2(cell * 0.14)} fill={INK} />}
          </g>
        );
      })}
      {tiles?.map(([r, c, across], i) => (
        <rect key={`t${i}`} x={r2(x0 + c * cell + 0.08)} y={r2(y0 + r * cell + 0.08)} width={r2((across ? 2 : 1) * cell - 0.16)} height={r2((across ? 1 : 2) * cell - 0.16)} rx={0.12} fill={MARK} fillOpacity={0.55} stroke={INK} strokeWidth={2.4} {...NS} />
      ))}
      <T x={13.6} y={1.2} size={0.36}>
        {`${fa(a)} × ${fa(b)}${q.variant ? ` − ${fa(q.variant)}` : ""} = ${fa(cells)} خانه`}
      </T>
      {step >= 2 && (
        <T x={13.6} y={1.9} size={0.34} soft>
          {cells % 2 ? "فرد: دوتایی‌ها نمی‌پوشانند" : "زوج"}
        </T>
      )}
      {dots && (
        <T x={13.6} y={2.8} size={0.32}>
          {`نقطه‌دار: ${fa((a * b) / 2 - 2)} · بی‌نقطه: ${fa((a * b) / 2)}`}
        </T>
      )}
      {dots && (
        <T x={13.6} y={3.4} size={0.3} soft>
          هر دومینو: یک نقطه‌دار + یک بی‌نقطه
        </T>
      )}
      <T x={8} y={8.4} size={0.44} soft={step < total}>
        {step >= total ? (q.answer === YES ? "✓ ممکن است (یک چیدمان)" : "✗ ممکن نیست") : "هر دومینو دو خانه کنار هم"}
      </T>
    </Board>
  );
}

function CupG({ x, y, up, n }: { x: number; y: number; up: boolean; n?: number }) {
  // Upright: open at the top, narrow base. Upside down: the other way, with its base on top.
  const w = 0.8;
  const h = 1;
  const d = up ? `M ${r2(x - w / 2)} ${r2(y)} L ${r2(x - w / 3.2)} ${r2(y + h)} L ${r2(x + w / 3.2)} ${r2(y + h)} L ${r2(x + w / 2)} ${r2(y)}` : `M ${r2(x - w / 2)} ${r2(y + h)} L ${r2(x - w / 3.2)} ${r2(y)} L ${r2(x + w / 3.2)} ${r2(y)} L ${r2(x + w / 2)} ${r2(y + h)}`;
  return (
    <g>
      <path d={d} fill={up ? MARK : PAPER} stroke={INK} strokeWidth={2} strokeLinejoin="round" {...NS} />
      <T x={x} y={y + h + 0.32} size={0.26} soft>
        {up ? "بالا ▲" : "وارونه ▼"}
      </T>
      {n !== undefined && (
        <T x={x} y={y + h / 2} size={0.3}>
          {fa(n)}
        </T>
      )}
    </g>
  );
}

function CupsBoard({ q, step, total }: { q: ParityQuestion; step: number; total: number }) {
  const [c, u] = q.nums;
  const gap = Math.min(1.25, 15 / c);
  const x0 = 8 - ((c - 1) * gap) / 2;
  const ups = Array.from({ length: c }, (_, i) => i < u);
  const end = q.answer === YES && step >= total;
  return (
    <Board view={VIEW} imageName="cups" label="لیوان‌ها">
      <T x={8} y={0.5} size={0.38}>
        {`${fa(c)} لیوان؛ هر حرکت: دقیقاً دو لیوان برمی‌گردد`}
      </T>
      {ups.map((up, i) => (
        <CupG key={i} x={x0 + i * gap} y={1.2} up={up} n={step >= 1 && up ? ups.slice(0, i + 1).filter(Boolean).length : undefined} />
      ))}
      {step >= 2 && (
        <T x={8} y={3.4} size={0.32}>
          {"دو بالا ← دو وارونه: ۲ تا کم · دو وارونه ← دو بالا: ۲ تا زیاد · یکی و یکی: بی‌تغییر"}
        </T>
      )}
      {step >= 3 && (
        <T x={8} y={4.1} size={0.36}>
          {`تعداد لیوان‌های بالا: ${fa(u)} (${u % 2 ? "فرد" : "زوج"}) — زوج یا فرد بودنش عوض نمی‌شود`}
        </T>
      )}
      {end &&
        ups.map((_, i) => <CupG key={`e${i}`} x={x0 + i * gap} y={5.1} up={false} />)}
      {end && (
        <T x={8} y={4.75} size={0.3} soft>
          {`بعد از ${fa(u / 2)} حرکت:`}
        </T>
      )}
      <T x={8} y={8.4} size={0.44} soft={step < total}>
        {step >= total ? (q.answer === YES ? "✓ ممکن است" : "✗ ممکن نیست: از فرد به ۰ (زوج) نمی‌رسیم") : "هدف: ۰ لیوان رو به بالا"}
      </T>
    </Board>
  );
}

function SignsParityBoard({ q, step, total }: { q: ParityQuestion; step: number; total: number }) {
  const [N] = q.nums;
  const S = (N * (N + 1)) / 2;
  return (
    <Board view={VIEW} imageName="plus-minus" label="علامت‌های + و −">
      <T x={8} y={1} size={0.6}>
        {`${signsRowFa(N)} = ${fa(q.target)} ؟`}
      </T>
      {step >= 1 && (
        <T x={8} y={2.4} size={0.5}>
          {`${signsRowFa(N, Array(N - 1).fill(0))} = ${fa(S)} (${S % 2 ? "فرد" : "زوج"})`}
        </T>
      )}
      {step >= 2 && (
        <T x={8} y={3.8} size={0.4}>
          {`+x ← −x: حاصل ${ltr("۲ × x")} کم می‌شود (زوج)؛ پس همیشه ${S % 2 ? "فرد" : "زوج"}`}
        </T>
      )}
      {step >= total && q.answer === YES && (
        <T x={8} y={5.3} size={0.56}>
          {`${signsRowFa(N, q.witness)} = ${fa(q.target)} ✓`}
        </T>
      )}
      <T x={8} y={8.2} size={0.44} soft={step < total}>
        {step >= total ? (q.answer === YES ? "✓ ممکن است" : `✗ ممکن نیست: ${fa(q.target)} ${q.target % 2 ? "فرد" : "زوج"} است`) : "اول همه را + بگذار"}
      </T>
    </Board>
  );
}

export function ParityBoard({ q, step }: { q: ParityQuestion; step: number }) {
  const total = numberSteps(q).length;
  switch (q.ask) {
    case "seq":
      return <SeqBoard q={q} step={step} total={total} />;
    case "handshake":
      return <HandshakeBoard q={q} step={step} total={total} />;
    case "domino":
      return <DominoBoard q={q} step={step} total={total} />;
    case "cups":
      return <CupsBoard q={q} step={step} total={total} />;
    case "signs":
      return <SignsParityBoard q={q} step={step} total={total} />;
    default:
      return <TermsBoard q={q} step={step} total={total} />;
  }
}

export function NumberBoard({ q, step, entry }: { q: NumberQuestion; step: number; entry?: (number | null)[] }) {
  return q.type === "prime" ? <PrimeBoard q={q} step={step} entry={entry} /> : <ParityBoard q={q} step={step} />;
}

// ── Explore boards ───────────────────────────────────────────────────────

/** N squares in `rows` rows: full columns, and the squares left over stick out on their own. */
export function RectBoard({ n, rows }: { n: number; rows: number }) {
  const cols = Math.floor(n / rows);
  const extra = n % rows;
  const s = Math.min(13 / (cols + (extra ? 1 : 0)), 6.4 / rows, 0.9);
  const wTotal = (cols + (extra ? 1 : 0)) * s;
  const x0 = 8 - wTotal / 2;
  const y0 = 0.9;
  const cells: ReactNode[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) cells.push(<rect key={`${r}-${c}`} x={r2(x0 + c * s + 0.04)} y={r2(y0 + r * s + 0.04)} width={r2(s - 0.08)} height={r2(s - 0.08)} rx={0.06} fill={extra ? PAPER : MARK} stroke={INK} strokeWidth={1.2} {...NS} />);
  for (let r = 0; r < extra; r++) cells.push(<rect key={`x${r}`} x={r2(x0 + cols * s + 0.04)} y={r2(y0 + r * s + 0.04)} width={r2(s - 0.08)} height={r2(s - 0.08)} rx={0.06} fill={PAPER} stroke={INK} strokeWidth={2.2} strokeDasharray="4 3" {...NS} />);
  return (
    <Board view={VIEW} imageName="rectangles" label={`${fa(n)} مربع در ${fa(rows)} ردیف`}>
      {cells}
      {extra > 0 && (
        <T x={Math.min(15.2, x0 + cols * s + s / 2 + 0.9)} y={y0 + extra * s + 0.35} size={0.3}>
          اضافه (خط‌چین)
        </T>
      )}
      <T x={8} y={8.2} size={0.46}>
        {extra ? `${ltr(`${fa(n)} = ${fa(rows)} × ${fa(cols)} + ${fa(extra)}`)}: ${fa(extra)} مربع اضافه می‌ماند ✗` : `${ltr(`${fa(rows)} × ${fa(cols)} = ${fa(n)}`)} ✓ مستطیل کامل`}
      </T>
    </Board>
  );
}

export const SIEVE_PRIMES = [2, 3, 5, 7];

/** The stroke each prime crosses its multiples with: 2 ／, 3 ＼, 5 —, 7 |. */
function strokeOf(p: number, x: number, y: number, s: number) {
  const m = s * 0.18;
  if (p === 2) return `M ${r2(x + m)} ${r2(y + s - m)} L ${r2(x + s - m)} ${r2(y + m)}`;
  if (p === 3) return `M ${r2(x + m)} ${r2(y + m)} L ${r2(x + s - m)} ${r2(y + s - m)}`;
  if (p === 5) return `M ${r2(x + m)} ${r2(y + s / 2)} L ${r2(x + s - m)} ${r2(y + s / 2)}`;
  return `M ${r2(x + s / 2)} ${r2(y + m)} L ${r2(x + s / 2)} ${r2(y + s - m)}`;
}
const STROKE_NAME: Record<number, string> = { 2: "／", 3: "＼", 5: "—", 7: "|" };

/** 1 … 100; the multiples of the first `k` sieve primes are crossed, each prime with its own stroke. */
export function SieveBoard({ k, pick }: { k: number; pick: number | null }) {
  const crossed = SIEVE_PRIMES.slice(0, k);
  const s = 0.8;
  const x0 = 0.4;
  const y0 = 0.5;
  const done = k === SIEVE_PRIMES.length;
  const left = Array.from({ length: 99 }, (_, i) => i + 2).filter((v) => !crossed.some((p) => v !== p && v % p === 0));
  return (
    <Board view={VIEW} imageName="sieve" label="غربال ۱ تا ۱۰۰">
      {Array.from({ length: 100 }, (_, i) => {
        const v = i + 1;
        const x = x0 + (i % 10) * s;
        const y = y0 + Math.floor(i / 10) * s;
        const hits = crossed.filter((p) => v !== p && v % p === 0);
        const ring = v > 1 && (crossed.includes(v) || (done && !hits.length));
        return (
          <g key={v}>
            <rect x={r2(x)} y={r2(y)} width={s} height={s} fill={PAPER} stroke={INK} strokeWidth={v === pick ? 3.5 : 0.8} strokeDasharray={v === 1 ? "3 2" : undefined} {...NS} />
            {ring && <circle cx={r2(x + s / 2)} cy={r2(y + s / 2)} r={s * 0.4} fill={MARK} stroke={INK} strokeWidth={1.8} {...NS} />}
            <T x={x + s / 2} y={y + s / 2} size={0.28} soft={hits.length > 0} bold={!hits.length}>
              {fa(v)}
            </T>
            {hits.map((p) => (
              <path key={p} d={strokeOf(p, x, y, s)} stroke={INK} strokeWidth={1.4} {...NS} />
            ))}
          </g>
        );
      })}
      <T x={12.3} y={0.8} size={0.4}>
        غربال
      </T>
      {SIEVE_PRIMES.map((p, i) => (
        <T key={p} x={12.3} y={1.6 + i * 0.6} size={0.32} soft={!crossed.includes(p)}>
          {`مضرب‌های ${fa(p)}: ${STROKE_NAME[p]} ${crossed.includes(p) ? "✓" : "…"}`}
        </T>
      ))}
      <T x={12.3} y={4.3} size={0.32}>
        ○ حلقه = عدد اول
      </T>
      <T x={12.3} y={4.9} size={0.3} soft>
        ۱ (قاب خط‌چین): نه اول، نه مرکب
      </T>
      <T x={12.3} y={5.9} size={0.36}>
        {done ? `${fa(left.length)} عدد اول تا ۱۰۰` : `هنوز خط‌نخورده: ${fa(left.length)} عدد`}
      </T>
      {done && (
        <T x={12.3} y={6.5} size={0.3} soft>
          ۱۱ × ۱۱ = ۱۲۱ از ۱۰۰ بیشتر است؛ ۷ کافی بود
        </T>
      )}
    </Board>
  );
}

/** Numbers as dots in pairs; the lone dots pair up across the numbers. */
export function DotsExploreBoard({ nums }: { nums: number[] }) {
  const k = nums.length;
  const gapW = 0.5;
  const w = k ? Math.min(2.6, (15.4 - gapW * (k - 1)) / k) : 2.6;
  const x0 = 8 - (k * w + (k - 1) * gapW) / 2;
  const y = 1.6;
  const xs = nums.map((_, i) => x0 + i * (w + gapW));
  const lone = nums.map((v, i) => (v % 2 ? loneAt(xs[i], y, w, v) : null)).filter((p): p is [number, number] => p !== null);
  const sum = nums.reduce((s, v) => s + v, 0);
  return (
    <Board view={VIEW} imageName="dot-pairs" label="نقطه‌های جفت و تنها">
      {nums.map((v, i) => (
        <g key={i}>
          <DotsG x={xs[i]} y={y} w={w} value={v} odd={v % 2 === 1} label={`${fa(v)} (${v % 2 ? "فرد" : "زوج"})`} />
          {i < k - 1 && (
            <T x={xs[i] + w + gapW / 2} y={y + 0.65} size={0.5} ltrText>
              +
            </T>
          )}
        </g>
      ))}
      {k === 0 && (
        <T x={8} y={3.5} size={0.42} soft>
          از دکمه‌های کنار صفحه عدد اضافه کن
        </T>
      )}
      <PairUpG at={lone} y={y + 1.55} />
      {k > 0 && (
        <>
          <T x={8} y={6.3} size={0.38}>
            {`نقطه‌های تنها: ${fa(lone.length)} ← ${lone.length % 2 ? "یکی بی‌جفت می‌ماند" : "همه جفت می‌شوند"}`}
          </T>
          <T x={8} y={7.3} size={0.5}>
            {`${ltr(`${nums.map((v) => fa(v)).join(" + ")} = ${fa(sum)}`)}: ${sum % 2 ? "فرد" : "زوج"}`}
          </T>
        </>
      )}
    </Board>
  );
}

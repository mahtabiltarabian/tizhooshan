"use client";

// Boards for the five later topics of tool 13. Each draws a question and,
// step by step, its working: `step` is how many worked steps are shown
// (0 = only the question). Marks are shapes and words (circles, frames,
// arrows, ✓ and ✗), never colour alone.

import type { ReactNode } from "react";
import { Board } from "@/engine-2d/Board";
import {
  cellDigit,
  cryptColumns,
  gcdAll,
  LETTER,
  lcmAll,
  OPS,
  powerUnit,
  rangePlaces,
  rowValue,
  unitCycle,
  type CryptQuestion,
  type LcmQuestion,
  type MoreQuestion,
  type PagesQuestion,
  type SignsQuestion,
  type UnitsQuestion,
} from "@/generators/digits-more";
import { fa } from "@/tools/registry";
import { divisorsOf, pageGroups, signsTrace, timeFa } from "./MoreText";
import { NumberBoard } from "./NumberBoards";

export const MORE_VIEW: [number, number, number, number] = [0, 0, 16, 9];
const INK = "#1f2430";
const SOFT = "#5b6170";
const PAPER = "#ffffff";
const MARK = "#fff1c2";
const LINE = 2;
const r2 = (v: number) => Math.round(v * 1000) / 1000;
const ltr = (s: string) => `⁦${s}⁩`;

function T({ x, y, size = 0.42, soft, bold = true, children, ltrText }: { x: number; y: number; size?: number; soft?: boolean; bold?: boolean; children: ReactNode; ltrText?: boolean }) {
  return (
    <text x={r2(x)} y={r2(y)} fontSize={size} fontWeight={bold ? 700 : 400} textAnchor="middle" direction={ltrText ? "ltr" : "rtl"} dominantBaseline="central" fill={soft ? SOFT : INK}>
      {children}
    </text>
  );
}

/** How many worked steps a slider position shows. */
export const stepOf = (f: number, n: number) => Math.min(n, Math.floor(f * (n + 1) + 1e-9));

// ── LCM and GCD ──────────────────────────────────────────────────────────

function LcmBoard({ q, step }: { q: LcmQuestion; step: number }) {
  if (q.ask === "gcd" || q.ask === "pieces") return <GcdBoard q={q} step={step} />;
  const L = lcmAll(q.nums);
  const x0 = 1;
  const x1 = 12.6;
  const X = (v: number) => r2(x0 + ((x1 - x0) * v) / L);
  const rows = q.nums.length;
  const gap = rows === 2 ? 2.6 : 2.1;
  const y0 = 2;
  const met = step > rows;
  const unit = q.ask === "clock" || q.story === 0 ? "دقیقه" : q.story === 1 || q.story === 3 ? "ثانیه" : "روز";
  return (
    <Board view={MORE_VIEW} imageName="lcm" label="محورهای مضرب‌ها">
      {met && <line x1={X(L)} x2={X(L)} y1={y0 - 1.1} y2={y0 + (rows - 1) * gap + 0.5} stroke={INK} strokeWidth={LINE} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />}
      {met && (
        <T x={X(L)} y={0.55} size={0.4}>
          {q.ask === "clock" ? `با هم: ساعت ${timeFa(q.start + L)}` : `اولین دیدار: ${fa(L)} ${unit}`}
        </T>
      )}
      {q.nums.map((a, i) => {
        const y = y0 + i * gap;
        const shown = step > i;
        const jumps = L / a;
        const room = ((x1 - x0) * a) / L;
        return (
          <g key={i}>
            <line x1={x0} x2={x1 + 0.4} y1={y} y2={y} stroke={INK} strokeWidth={LINE} vectorEffect="non-scaling-stroke" />
            <T x={14.4} y={y} size={0.4}>
              هر {fa(a)} {unit}
            </T>
            <line x1={x0} x2={x0} y1={y - 0.15} y2={y + 0.15} stroke={INK} strokeWidth={LINE} vectorEffect="non-scaling-stroke" />
            <T x={x0} y={y + 0.45} size={0.3} soft>
              {q.ask === "clock" ? timeFa(q.start) : "۰"}
            </T>
            {shown &&
              Array.from({ length: jumps }, (_, k) => {
                const a0 = X(k * a);
                const a1 = X((k + 1) * a);
                const h = Math.min(0.9, room * 0.45);
                const last = k === jumps - 1;
                return (
                  <g key={k}>
                    <path d={`M ${a0} ${y} Q ${r2((a0 + a1) / 2)} ${r2(y - h * 2)} ${a1} ${y}`} fill="none" stroke={INK} strokeWidth={last && met ? 3 : 1.6} vectorEffect="non-scaling-stroke" />
                    <line x1={a1} x2={a1} y1={y - 0.15} y2={y + 0.15} stroke={INK} strokeWidth={LINE} vectorEffect="non-scaling-stroke" />
                    {(room >= 0.62 || last) && (
                      <T x={a1} y={y + 0.45} size={0.3} soft={!last}>
                        {fa((k + 1) * a)}
                      </T>
                    )}
                  </g>
                );
              })}
            {met && <circle cx={X(L)} cy={y} r={0.22} fill={MARK} stroke={INK} strokeWidth={LINE} vectorEffect="non-scaling-stroke" />}
          </g>
        );
      })}
      <T x={8} y={8.4} size={0.36} soft>
        {met ? `کوچک‌ترین مضرب مشترک (ک.م.م) = ${fa(L)}` : step === 0 ? "پرش‌ها کجا به هم می‌رسند؟" : "پرش‌ها را دنبال کن"}
      </T>
    </Board>
  );
}

function GcdBoard({ q, step }: { q: LcmQuestion; step: number }) {
  const G = gcdAll(q.nums);
  const common = step > 2;
  const bars = step > 3;
  const max = Math.max(...q.nums);
  return (
    <Board view={MORE_VIEW} imageName="gcd" label="شمارنده‌ها و تکه‌ها">
      {q.nums.map((a, i) => {
        const ds = divisorsOf(a);
        const y = 0.5 + i * 1.6;
        return (
          <g key={i}>
            <T x={14.2} y={y + 0.4} size={0.36}>
              شمارنده‌های {fa(a)}
            </T>
            {step > i &&
              ds.map((d, k) => {
                const x = 0.4 + k * 1.02;
                const shared = common && G % d === 0;
                return (
                  <g key={d}>
                    <rect x={x} y={y} width={0.9} height={0.8} rx={0.12} fill={shared ? MARK : PAPER} stroke={INK} strokeWidth={d === G && common ? 3.5 : shared ? 2.5 : 1.2} strokeDasharray={shared && d !== G ? "5 3" : undefined} vectorEffect="non-scaling-stroke" />
                    <T x={x + 0.45} y={y + 0.42} size={0.36} bold={shared}>
                      {fa(d)}
                    </T>
                  </g>
                );
              })}
          </g>
        );
      })}
      {common && (
        <T x={8} y={3.8} size={0.4}>
          شمارنده‌های مشترک در قاب خط‌چین؛ بزرگ‌ترین (قاب پررنگ): ب.م.م = {fa(G)}
        </T>
      )}
      {!bars && step === 0 && (
        <T x={8} y={4.6} size={0.38} soft>
          کدام عدد هر دو را می‌شمارد؟
        </T>
      )}
      {q.nums.map((a, i) => {
        const y = 4.8 + i * 1.5;
        const w = (12 * a) / max;
        const pieces = a / G;
        return (
          <g key={`bar${i}`}>
            <rect x={0.4} y={y} width={r2(w)} height={0.7} fill={PAPER} stroke={INK} strokeWidth={LINE} vectorEffect="non-scaling-stroke" />
            {bars &&
              Array.from({ length: pieces - 1 }, (_, k) => {
                const x = r2(0.4 + (w * (k + 1)) / pieces);
                return <line key={k} x1={x} x2={x} y1={y - 0.15} y2={y + 0.85} stroke={INK} strokeWidth={LINE} vectorEffect="non-scaling-stroke" />;
              })}
            <T x={14.2} y={y + 0.35} size={0.34} soft={!bars}>
              {bars ? `${fa(pieces)} تکه ${fa(G)}تایی` : `${fa(a)}`}
            </T>
          </g>
        );
      })}
      {bars && (
        <T x={8} y={8.3} size={0.4}>
          {q.ask === "pieces" ? `روی هم ${fa(q.answer)} تکه` : q.story === 1 ? `${fa(G)} بسته` : `هر تکه ${fa(G)}`}
        </T>
      )}
    </Board>
  );
}

// ── Cryptarithms ─────────────────────────────────────────────────────────

const CELL = 1.25;
const COL = 1.45;

/** Which column a worked step is about, and how many letters it has shown. */
function cryptStage(q: CryptQuestion, step: number) {
  const width = Math.max(q.top.length, q.bottom.length);
  const pre = 1 + (q.sum.length > width ? 1 : 0);
  const at = step - 1 - pre;
  const total = q.sum.length;
  const col = step >= pre + total + 1 ? null : at >= 0 && at < total ? at : null;
  const upto = step >= pre + total + 1 ? total : at >= 0 ? at : -1;
  return { col, upto, lead: step >= 2 && pre === 2 };
}

interface CryptProps {
  q: CryptQuestion;
  /** Digits shown for the letters (null: not yet). */
  vals: (number | null)[];
  /** Show me: the column in focus; explore: none. */
  focus?: number | null;
  /** Carries shown above the columns up to this one. */
  carriesUpTo?: number;
  /** Explore: the sum with these digits, column by column. */
  check?: boolean;
  caption?: string;
}

export function CryptG({ q, vals, focus = null, carriesUpTo = -1, check = false }: Omit<CryptProps, "caption">) {
  const W = q.sum.length;
  const right = 9.6;
  const cx = (i: number) => r2(right - (i + 1) * COL + (COL - CELL) / 2);
  const rows: [number[], number][] = [
    [q.top, 1.2],
    [q.bottom, 2.75],
    [q.sum, 4.55],
  ];
  const full = vals.every((v): v is number => v !== null);
  const cols = full ? cryptColumns(q, vals) : null;
  const carries = carriesUpTo >= 0 ? cryptColumns(q, q.solution) : [];
  const value = (c: number) => (c >= LETTER ? vals[c - LETTER] : c);
  return (
    <g>
      {focus !== null && <rect x={cx(focus) - 0.12} y={0.35} width={CELL + 0.24} height={5.7} rx={0.2} fill="none" stroke={INK} strokeWidth={3} strokeDasharray="8 5" vectorEffect="non-scaling-stroke" />}
      {rows.map(([r, y], ri) =>
        r.map((c, k) => {
          const i = r.length - 1 - k;
          const x = cx(i);
          const v = value(c);
          const letter = c >= LETTER;
          return (
            <g key={`${ri}-${k}`}>
              <rect x={x} y={y} width={CELL} height={CELL * 1.08} rx={0.14} fill={letter ? MARK : PAPER} stroke={INK} strokeWidth={letter ? 2.5 : 1.5} strokeDasharray={letter ? "6 3" : undefined} vectorEffect="non-scaling-stroke" />
              {letter && v !== null ? (
                <>
                  <T x={x + CELL / 2} y={y + 0.28} size={0.3} soft>
                    {q.letters[c - LETTER]}
                  </T>
                  <T x={x + CELL / 2} y={y + 0.85} size={0.68}>
                    {fa(v)}
                  </T>
                </>
              ) : (
                <T x={x + CELL / 2} y={y + CELL * 0.56} size={letter && q.letters[c - LETTER].length > 1 ? 0.5 : 0.72}>
                  {letter ? q.letters[c - LETTER] : fa(c)}
                </T>
              )}
            </g>
          );
        }),
      )}
      <T x={cx(W - 1) - 0.55} y={2.75 + CELL * 0.55} size={0.8} ltrText>
        +
      </T>
      <line x1={cx(W - 1) - 0.9} x2={right} y1={4.3} y2={4.3} stroke={INK} strokeWidth={3} vectorEffect="non-scaling-stroke" />
      {carries.map((col, i) =>
          i <= carriesUpTo && i + 1 < W && col.t + col.b + col.carry >= 10 ? (
            <T key={`c${i}`} x={cx(i + 1) + CELL / 2} y={0.75} size={0.34}>
              {`ده‌بر ${fa(1)}`}
            </T>
          ) : null,
        )}
      {check && full && (
        <>
          {cols!.map((col, i) => (
            <T key={`k${i}`} x={cx(i) + CELL / 2} y={6.5} size={0.42}>
              {col.ok ? "✓" : "✗"}
            </T>
          ))}
          <T x={13} y={5.1} size={0.36}>
            {`${ltr(`${fa(rowValue(q.top, vals as number[]))} + ${fa(rowValue(q.bottom, vals as number[]))} = ${fa(rowValue(q.top, vals as number[]) + rowValue(q.bottom, vals as number[]))}`)}`}
          </T>
        </>
      )}
      {PLACE_NAMES.slice(0, W).map((p, i) => (
        <T key={p} x={cx(i) + CELL / 2} y={7.1} size={0.26} soft>
          {p}
        </T>
      ))}
    </g>
  );
}
const PLACE_NAMES = ["یکان", "دهگان", "صدگان", "هزارگان"];

export function CryptBoard({ q, vals, focus, carriesUpTo, check, caption }: CryptProps) {
  return (
    <Board view={MORE_VIEW} imageName="cryptarithm" label="جمع رمزی">
      <CryptG q={q} vals={vals} focus={focus} carriesUpTo={carriesUpTo} check={check} />
      {caption && (
        <T x={8} y={8.3} size={0.38}>
          {caption}
        </T>
      )}
    </Board>
  );
}

/** Show me: digits appear column by column, right to left. */
function CryptShow({ q, step }: { q: CryptQuestion; step: number }) {
  const { col, upto, lead } = cryptStage(q, step);
  // A letter's digit shows from the column (right to left) where it first appears.
  const first = q.letters.map((_, i) => {
    for (let c = 0; c < q.sum.length; c++) {
      const cells = [q.top, q.bottom, q.sum].map((r) => (c < r.length ? r[r.length - 1 - c] : -1));
      if (cells.includes(LETTER + i)) return c;
    }
    return 99;
  });
  const leadLetter = q.sum[0] >= LETTER ? q.sum[0] - LETTER : -1;
  const vals = q.solution.map((d, i) => (first[i] <= upto || (lead && i === leadLetter) ? d : null));
  const done = vals.every((v) => v !== null) && upto >= q.sum.length - 1;
  return (
    <CryptBoard
      q={q}
      vals={vals}
      focus={col}
      carriesUpTo={upto}
      caption={step === 0 ? "ستون به ستون، از یکان شروع کن" : done ? ltr(`${fa(rowValue(q.top, q.solution))} + ${fa(rowValue(q.bottom, q.solution))} = ${fa(rowValue(q.sum, q.solution))} ✓`) : col !== null ? `ستون ${PLACE_NAMES[col]}` : "قاعده‌ها"}
    />
  );
}

// ── Signs ────────────────────────────────────────────────────────────────

type Tok = ReturnType<typeof signsTrace>[number]["left"][number];

function tokW(t: Tok) {
  if ("num" in t) return 0.42 * String(t.num).length + 0.35;
  if ("op" in t) return 0.75;
  return 0.32;
}

/** A row of tokens centred at cx; `under` puts a bracket under tokens i … j; `slots` makes the sign gaps tappable. */
function TokRow({ toks, cx, y, under, active, onSlot, tail }: { toks: Tok[]; cx: number; y: number; under?: [number, number]; active?: number | null; onSlot?: (i: number) => void; tail?: string }) {
  const ws = toks.map(tokW);
  const tailW = tail ? 0.36 * tail.length : 0;
  const total = ws.reduce((s, w) => s + w, 0) + tailW;
  const start = cx - total / 2;
  const lefts = ws.map((_, i) => start + ws.slice(0, i).reduce((s, w) => s + w, 0));
  const tailX = start + total - tailW;
  /** Which sign gap token i is. */
  const slotOf = (i: number) => toks.slice(0, i).filter((t) => "op" in t).length;
  return (
    <g>
      {toks.map((t, i) => {
        const l = lefts[i];
        const w = ws[i];
        if ("num" in t)
          return (
            <T key={i} x={l + w / 2} y={y} size={0.62} ltrText>
              {fa(t.num)}
            </T>
          );
        if ("op" in t) {
          const s = slotOf(i);
          const gap = t.op < 0;
          const on = active === s;
          return (
            <g key={i} onClick={onSlot ? () => onSlot(s) : undefined} style={onSlot ? { cursor: "pointer" } : undefined} role={onSlot ? "button" : undefined} aria-label={onSlot ? `جای علامت ${fa(s + 1)}` : undefined}>
              {(gap || onSlot) && <rect x={r2(l + 0.06)} y={r2(y - 0.38)} width={r2(w - 0.12)} height={0.76} rx={0.12} fill={on ? MARK : PAPER} stroke={INK} strokeWidth={on ? 3 : 1.5} strokeDasharray={gap ? "5 3" : undefined} vectorEffect="non-scaling-stroke" />}
              <T x={l + w / 2} y={y} size={0.58} ltrText>
                {gap ? "؟" : OPS[t.op]}
              </T>
              {on && (
                <T x={l + w / 2} y={y + 0.72} size={0.36}>
                  ▲
                </T>
              )}
            </g>
          );
        }
        return (
          <T key={i} x={l + w / 2} y={y} size={0.62} ltrText>
            {"open" in t ? "(" : ")"}
          </T>
        );
      })}
      {tail && (
        <T x={tailX + tailW / 2} y={y} size={0.62} ltrText>
          {tail}
        </T>
      )}
      {under && <path d={`M ${r2(lefts[under[0]] + 0.05)} ${r2(y + 0.45)} v 0.18 H ${r2(lefts[under[1]] + ws[under[1]] - 0.05)} v -0.18`} fill="none" stroke={INK} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />}
    </g>
  );
}

function signsToks(q: SignsQuestion, ops: (number | null)[]): Tok[] {
  const toks: Tok[] = [];
  q.nums.forEach((x, i) => {
    if (q.paren?.[0] === i) toks.push({ open: true });
    toks.push({ num: x });
    if (q.paren?.[1] === i) toks.push({ close: true });
    if (i < q.ops.length) toks.push({ op: ops[i] ?? -1 });
  });
  return toks;
}

export function SignsBoard({ q, ops, step, active = null, onSlot }: { q: SignsQuestion; ops: (number | null)[]; step: number; active?: number | null; onSlot?: (i: number) => void }) {
  const trace = signsTrace(q.nums, q.ops, q.paren);
  // Steps: rule, the signs, then one per reduction, then the summary.
  const shown = Math.max(0, Math.min(trace.length, step - 2));
  const first = step >= 2 ? signsToks(q, q.ops) : signsToks(q, ops);
  // Where the first reduction happens, in the first row (tokens before it shift as brackets go).
  const rows: { toks: Tok[]; under?: [number, number] }[] = [{ toks: first, under: shown > 0 ? trace[0].at : undefined }];
  for (let k = 0; k < shown; k++) rows.push({ toks: trace[k].left, under: k + 1 < shown ? trace[k + 1].at : undefined });
  const gap = rows.length > 4 ? 1.25 : 1.45;
  return (
    <Board view={MORE_VIEW} imageName="signs" label="گذاشتن علامت‌ها">
      {rows.map((r, i) => (
        <TokRow key={i} toks={r.toks} cx={8} y={1 + i * gap} under={r.under} active={i === 0 && step < 2 ? active : null} onSlot={i === 0 && step < 2 ? onSlot : undefined} tail={i === 0 ? ` = ${fa(q.target)}` : i === rows.length - 1 && shown === trace.length ? " ✓" : undefined} />
      ))}
      <T x={8} y={8.3} size={0.34} soft>
        {q.paren ? "ترتیب: پرانتز ← ضرب و تقسیم ← جمع و تفریق" : "ترتیب: ضرب و تقسیم ← جمع و تفریق (هر کدام از چپ به راست)"}
      </T>
      {shown > 0 && (
        <T x={8} y={7.6} size={0.32} soft>
          زیر هر سطر، خط زیر نشان می‌دهد کدام بخش اول حساب می‌شود
        </T>
      )}
    </Board>
  );
}

// ── Page numbers ─────────────────────────────────────────────────────────

const LEN_FA = ["", "یک‌رقمی", "دورقمی", "سه‌رقمی", "چهاررقمی"];

function PagesBoard({ q, step }: { q: PagesQuestion; step: number }) {
  type Row = { label: string; value: string; bar: number };
  let rows: Row[] = [];
  let total = "";
  if (q.ask === "ones") {
    const places = rangePlaces(1, q.from, q.to);
    rows = places
      .map((c, p) => ({ label: `رقم ۱ در ${PLACE_NAMES[p]}`, value: `${fa(c)} بار`, bar: c, p }))
      .filter((r) => 10 ** r.p <= q.to)
      .map(({ label, value, bar }) => ({ label, value, bar }));
    total = `جمع: ${fa(q.answer)} بار`;
  } else {
    rows = pageGroups(1, q.to).map(([a, b, len]) => ({ label: `${fa(a)} تا ${fa(b)} (${LEN_FA[len]})`, value: ltr(`${fa(b - a + 1)} × ${fa(len)} = ${fa((b - a + 1) * len)}`), bar: (b - a + 1) * len }));
    total = q.ask === "digits" ? `جمع: ${fa(q.answer)} رقم` : `${fa(q.digits)} رقم ← ${fa(q.answer)} صفحه`;
  }
  const lead = q.ask === "ones" && q.from > 1 ? 1 : 0;
  const shownRows = Math.max(0, step - lead);
  const max = Math.max(1, ...rows.map((r) => r.bar));
  const sum = rows.reduce((s, r) => s + r.bar, 0);
  return (
    <Board view={MORE_VIEW} imageName="page-digits" label="شمارش رقم‌های صفحه">
      <T x={8} y={0.6} size={0.44}>
        {q.ask === "digits" ? `صفحه‌های ۱ تا ${fa(q.to)}: چند رقم؟` : q.ask === "pages" ? `${fa(q.digits)} رقم: چند صفحه؟` : `رقم ۱ در صفحه‌های ${fa(q.from)} تا ${fa(q.to)}`}
      </T>
      {q.ask === "pages" && (
        // The digits as one long strip, cut into the groups as they are used.
        <g>
          <rect x={0.6} y={1.2} width={14.8} height={0.6} fill={PAPER} stroke={INK} strokeWidth={LINE} vectorEffect="non-scaling-stroke" />
          {rows.slice(0, shownRows).map((r, i) => {
            const before = rows.slice(0, i).reduce((s, x) => s + x.bar, 0);
            const x = r2(15.4 - (14.8 * (before + r.bar)) / sum);
            return <line key={i} x1={x} x2={x} y1={1.05} y2={1.95} stroke={INK} strokeWidth={3} vectorEffect="non-scaling-stroke" />;
          })}
        </g>
      )}
      {rows.map((r, i) => {
        const y = 2.5 + i * 1.35;
        const on = i < shownRows;
        return (
          <g key={i} opacity={on ? 1 : 0.25}>
            <T x={12.9} y={y} size={0.38}>
              {r.label}
            </T>
            <rect x={r2(10.3 - (9.4 * r.bar) / max)} y={y - 0.3} width={r2((9.4 * r.bar) / max)} height={0.6} fill={on ? MARK : PAPER} stroke={INK} strokeWidth={1.5} strokeDasharray={on ? undefined : "4 3"} vectorEffect="non-scaling-stroke" />
            {on && (
              <T x={5.6} y={y + 0.62} size={0.32} soft>
                {r.value}
              </T>
            )}
          </g>
        );
      })}
      {step > lead + rows.length && (
        <T x={8} y={8.2} size={0.5}>
          {total}
        </T>
      )}
      {step === 0 && (
        <T x={8} y={8.2} size={0.36} soft>
          دسته‌ها: یک‌رقمی، دورقمی، سه‌رقمی…
        </T>
      )}
    </Board>
  );
}

// ── Units digit ──────────────────────────────────────────────────────────

/** b with a raised exponent e, centred at x. */
function PowG({ b, e, x, y, size = 0.8 }: { b: number; e: number; x: number; y: number; size?: number }) {
  const bw = 0.55 * size * String(b).length;
  const ew = 0.36 * size * String(e).length;
  const left = x - (bw + ew) / 2;
  return (
    <g>
      <T x={left + bw / 2} y={y} size={size} ltrText>
        {fa(b)}
      </T>
      <T x={left + bw + ew / 2} y={y - size * 0.42} size={size * 0.55} ltrText>
        {fa(e)}
      </T>
    </g>
  );
}

function CycleTable({ b, e, y, mark }: { b: number; e: number; y: number; mark: boolean }) {
  const c = unitCycle(b);
  const cols = Math.min(8, c.length * 2);
  const w = 1.25;
  const right = 13.4;
  const X = (k: number) => r2(right - (cols - k) * w);
  const r = e % c.length;
  const pos = r === 0 ? c.length : r;
  return (
    <g>
      <T x={14.7} y={y} size={0.3} soft>
        توان
      </T>
      <T x={14.7} y={y + 0.85} size={0.3} soft>
        یکان
      </T>
      {Array.from({ length: cols }, (_, k) => {
        const inCycle = k < c.length;
        const chosen = mark && k === pos - 1;
        return (
          <g key={k}>
            <rect x={X(k)} y={y - 0.35} width={w - 0.08} height={1.6} rx={0.1} fill={chosen ? MARK : PAPER} stroke={INK} strokeWidth={chosen ? 3.5 : 1.2} strokeDasharray={inCycle ? undefined : "4 3"} vectorEffect="non-scaling-stroke" />
            <T x={X(k) + w / 2 - 0.04} y={y} size={0.3} soft>
              {fa(k + 1)}
            </T>
            <T x={X(k) + w / 2 - 0.04} y={y + 0.85} size={0.52}>
              {fa(powerUnit(b, k + 1))}
            </T>
          </g>
        );
      })}
      <path d={`M ${X(0)} ${r2(y - 0.55)} v -0.2 H ${r2(X(c.length) - 0.08)} v 0.2`} fill="none" stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <T x={(X(0) + X(c.length)) / 2} y={y - 1} size={0.3}>
        {`چرخه ${fa(c.length)}تایی`}
      </T>
      {mark && (
        <T x={X(pos - 1) + w / 2} y={y + 1.6} size={0.32}>
          {`▲ خانه ${fa(pos)}`}
        </T>
      )}
      <PowG b={b} e={e} x={X(0) - 1.4} y={y + 0.5} size={0.7} />
    </g>
  );
}

/** "7 × 4 = 28 ← 8", one line per factor after the first. */
function productLines(us: number[]) {
  const lines: string[] = [];
  for (let i = 1, acc = us[0]; i < us.length; acc = (acc * us[i]) % 10, i++) lines.push(ltr(`${fa(acc)} × ${fa(us[i])} = ${fa(acc * us[i])} ← ${fa((acc * us[i]) % 10)}`));
  return lines;
}

function UnitsBoard({ q, step }: { q: UnitsQuestion; step: number }) {
  if (q.kind === "product") {
    const us = q.factors.map((f) => f % 10);
    const lines = productLines(us);
    return (
      <Board view={MORE_VIEW} imageName="units-digit" label="رقم یکان ضرب">
        <T x={8} y={1} size={0.7} ltrText>
          {q.factors.map((f) => fa(f)).join(" × ")}
        </T>
        {/* The units digits, framed under their numbers. */}
        {step > 0 && (
          <T x={8} y={2.2} size={0.5}>
            {`رقم‌های یکان: ${us.map((u) => fa(u)).join("، ")}`}
          </T>
        )}
        {lines.slice(0, Math.max(0, step - 1)).map((l, i) => (
          <T key={i} x={8} y={3.5 + i * 1.1} size={0.56} ltrText>
            {l}
          </T>
        ))}
        <T x={8} y={7.6} size={0.5}>
          {step > lines.length + 1 ? `رقم یکان حاصل: ${fa(q.answer)}` : "رقم یکان حاصل = ؟"}
        </T>
      </Board>
    );
  }
  const two = q.powers.length === 2;
  return (
    <Board view={MORE_VIEW} imageName="units-digit" label="چرخه رقم یکان">
      {q.powers.map(([b, e], i) => {
        const y = two ? 1.7 + i * 3.2 : 2.6;
        const s = step - i * 2;
        return s > 0 ? (
          <CycleTable key={i} b={b} e={e} y={y} mark={s > 1} />
        ) : (
          <PowG key={i} b={b} e={e} x={8} y={y + 0.5} size={1} />
        );
      })}
      <T x={8} y={8.2} size={0.44}>
        {step >= (two ? 5 : 2) ? `رقم یکان: ${fa(q.answer)}` : two ? (q.kind === "sum" ? "یکانِ اولی + یکانِ دومی ← ؟" : "یکانِ اولی × یکانِ دومی ← ؟") : "رقم یکان = ؟"}
      </T>
    </Board>
  );
}

// ── Any of the later topics ──────────────────────────────────────────────────────

export function MoreBoard({ q, step, entry, active, onSlot }: { q: MoreQuestion; step: number; entry?: (number | null)[]; active?: number | null; onSlot?: (i: number) => void }) {
  switch (q.type) {
    case "lcm":
      return <LcmBoard q={q} step={step} />;
    case "crypt":
      return step > 0 ? <CryptShow q={q} step={step} /> : <CryptBoard q={q} vals={entry ?? q.letters.map(() => null)} caption="هر حرف چه رقمی است؟" />;
    case "signs":
      return <SignsBoard q={q} ops={entry ?? q.ops.map(() => null)} step={step} active={active} onSlot={onSlot} />;
    case "pages":
      return <PagesBoard q={q} step={step} />;
    case "units":
      return <UnitsBoard q={q} step={step} />;
    case "prime":
    case "parity":
      return <NumberBoard q={q} step={step} entry={entry} />;
  }
}

/** The sum with the explorer's digits, said in words for the side panel. */
export function cryptCheckFa(q: CryptQuestion, vals: (number | null)[]) {
  if (vals.some((v) => v === null)) return null;
  const v = vals as number[];
  const t = rowValue(q.top, v);
  const b = rowValue(q.bottom, v);
  const s = rowValue(q.sum, v);
  return { t, b, s, holds: t + b === s, firstWrong: cryptColumns(q, v).findIndex((c) => !c.ok), digit: (c: number) => cellDigit(c, v) };
}

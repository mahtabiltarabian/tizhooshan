// «میانگین» in words and pictures: the prompt, the working, feedback for each
// slip, and the show-me frames (columns of blocks levelled step by step, then
// total ÷ count).

import { levelTransfers, MEAN_CONTEXTS, meanColumns, meanMistake, type MeanQuestion } from "@/generators/mean";
import { fa } from "@/tools/registry";
import type { ColView, ColumnsFrame } from "./Columns";

/** Keeps an equation left to right inside a Persian sentence, on one line. */
const ltr = (s: string) => `⁦${s.replace(/ /g, " ")}⁩`;

const sum = (v: readonly number[]) => v.reduce((t, x) => t + x, 0);

/** "علی ۴، سارا ۷ و نیما ۶" */
function listFa(names: string[], values: (number | string)[]) {
  const parts = names.map((n, i) => `${n} ${typeof values[i] === "number" ? fa(values[i] as number) : values[i]}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join("، ")} و ${parts[parts.length - 1]}` : parts[0];
}

export function meanPrompt(q: MeanQuestion): string {
  const c = MEAN_CONTEXTS[q.context];
  const nounPl = `${c.noun}‌های`;
  switch (q.variant) {
    case "plain":
      return `${c.where}، ${listFa(q.names, q.values)} ${c.noun} ${c.did}. به‌طور میانگین هر نفر چند ${c.noun} ${c.didOne}؟`;
    case "missing": {
      const known = q.names.filter((_, i) => i !== q.miss);
      const vals = q.values.filter((_, i) => i !== q.miss);
      const who = q.names[q.miss];
      return `${c.where}، ${listFa(known, vals)} ${c.noun} ${c.did}. ${who} هم ${c.noun} ${c.didOne}. میانگین ${nounPl} این ${fa(q.values.length)} نفر ${fa(q.a)} است. ${who} چند ${c.noun} ${c.didOne}؟`;
    }
    case "join":
      return `${c.where}، میانگین ${nounPl} ${fa(q.n)} نفر ${fa(q.a)} است. ${q.names[0]} هم به آن‌ها اضافه می‌شود و میانگین ${nounPl} این ${fa(q.n + 1)} نفر ${fa(q.b)} می‌شود. ${q.names[0]} چند ${c.noun} ${c.didOne}؟`;
    case "leave":
      return `${c.where}، میانگین ${nounPl} ${fa(q.n)} نفر ${fa(q.a)} است. ${q.names[0]} که ${fa(q.x)} ${c.noun} ${c.didOne}، از گروه می‌رود. میانگین ${nounPl} ${fa(q.n - 1)} نفرِ باقی‌مانده چند است؟`;
    case "groups":
      return `${c.where}، گروه اول ${fa(q.n)} نفرند و میانگین ${nounPl}شان ${fa(q.a)} است. گروه دوم ${fa(q.x)} نفرند و میانگین ${nounPl}شان ${fa(q.b)} است. میانگین ${nounPl} همه‌ی ${fa(q.n + q.x)} نفر چند است؟`;
  }
}

export const meanAnswerFa = (q: MeanQuestion, v = q.answer) => `${fa(v)} ${MEAN_CONTEXTS[q.context].noun}`;

/** The working, briefly. */
export function meanHow(q: MeanQuestion): string {
  switch (q.variant) {
    case "plain": {
      const s = sum(q.values);
      return `جمع ${ltr(`${q.values.map(fa).join(" + ")} = ${fa(s)}`)}، تعداد ${fa(q.values.length)}: ${ltr(`${fa(s)} ÷ ${fa(q.values.length)} = ${fa(q.answer)}`)}.`;
    }
    case "missing": {
      const n = q.values.length;
      const known = sum(q.values) - q.answer;
      return `جمع همه ${ltr(`${fa(q.a)} × ${fa(n)} = ${fa(q.a * n)}`)}؛ جمع بقیه ${fa(known)}؛ پس ${ltr(`${fa(q.a * n)} − ${fa(known)} = ${fa(q.answer)}`)}.`;
    }
    case "join":
      return `جمع قبل ${ltr(`${fa(q.n)} × ${fa(q.a)} = ${fa(q.n * q.a)}`)}، جمع بعد ${ltr(`${fa(q.n + 1)} × ${fa(q.b)} = ${fa((q.n + 1) * q.b)}`)}؛ تازه‌وارد ${ltr(`${fa((q.n + 1) * q.b)} − ${fa(q.n * q.a)} = ${fa(q.x)}`)}.`;
    case "leave":
      return `جمع ${ltr(`${fa(q.n)} × ${fa(q.a)} = ${fa(q.n * q.a)}`)}؛ بی ${q.names[0]}: ${ltr(`${fa(q.n * q.a)} − ${fa(q.x)} = ${fa(q.n * q.a - q.x)}`)}؛ تقسیم بر ${fa(q.n - 1)} نفر: ${ltr(`${fa(q.n * q.a - q.x)} ÷ ${fa(q.n - 1)} = ${fa(q.b)}`)}.`;
    case "groups": {
      const t1 = q.n * q.a;
      const t2 = q.x * q.b;
      return `جمع گروه اول ${ltr(`${fa(q.n)} × ${fa(q.a)} = ${fa(t1)}`)}، گروه دوم ${ltr(`${fa(q.x)} × ${fa(q.b)} = ${fa(t2)}`)}؛ ${ltr(`(${fa(t1)} + ${fa(t2)}) ÷ ${fa(q.n + q.x)} = ${fa(q.answer)}`)}.`;
    }
  }
}

export type Tone = "good" | "turned" | "bad";

export function meanFeedback(q: MeanQuestion, v: number): { tone: Tone; text: string } {
  const how = meanHow(q);
  const right = `جواب ${meanAnswerFa(q)} است. ${how}`;
  const near = (s: string) => ({ tone: "turned" as const, text: `نزدیک بود! ${s} ${right}` });
  const n = q.variant === "plain" || q.variant === "missing" ? q.values.length : q.n;
  switch (meanMistake(q, v)) {
    case "right":
      return { tone: "good", text: `درست است! ${how}` };
    case "noDivide":
      return near(`${fa(v)} جمع همه است؛ میانگین سهم هر نفر است: جمع را بر تعداد (${fa(n)}) تقسیم کن.`);
    case "wrongCount":
      return near(
        q.variant === "plain"
          ? `بر تعداد اشتباه تقسیم کردی: ${fa(n)} نفرند، پس بر ${fa(n)} تقسیم کن.`
          : q.variant === "missing"
            ? `میانگین ${fa(q.a)} برای هر ${fa(n)} نفر است، نه ${fa(n - 1)} نفر: جمع همه ${ltr(`${fa(q.a)} × ${fa(n)}`)} است.`
            : `بعد از رفتن ${q.names[0]}، ${fa(q.n - 1)} نفر می‌مانند؛ بر ${fa(q.n - 1)} تقسیم کن، نه ${fa(q.n)}.`,
      );
    case "noMultiply":
      return near(`${fa(q.a)} میانگین است، نه جمع. اول جمع همه را بساز: ${ltr(`${fa(q.a)} × ${fa(n)}`)}، بعد بقیه را کم کن.`);
    case "noSubtract":
      return near(`${fa(v)} جمع همه است؛ ${q.variant === "join" ? "جمع قبلیِ گروه" : "عددهای معلوم"} را از آن کم کن.`);
    case "gaveAverage":
      return near(`${q.variant === "join" ? q.names[0] : q.names[q.miss]} لازم نیست خودش برابر میانگین باشد؛ با جمع‌ها حساب کن.`);
    case "onlyShare":
      return near(`${fa(v)} فقط چیزی است که تازه‌وارد به بقیه می‌دهد تا هم‌تراز شوند؛ خودش هم باید ${fa(q.b)} داشته باشد.`);
    case "twoNumbers":
      return near(`انگار فقط دو عدد بود! میانگین ${fa(q.a)} مال ${fa(q.n)} نفر است؛ با جمع همه‌ی آن‌ها حساب کن.`);
    case "noTakeAway":
      return near(`${fa(q.x)}ِ ${q.names[0]} را هم که رفته، از جمع کم کن.`);
    case "avgOfAvgs":
      return near(`میانگینِ دو میانگین فقط وقتی درست است که دو گروه هم‌اندازه باشند؛ این‌جا گروه‌ها ${fa(q.n)} و ${fa(q.x)} نفرند. جمع هر گروه را بساز.`);
    case "byGroups":
      return near(`جمع همه را بر تعداد آدم‌ها (${fa(q.n + q.x)}) تقسیم کن، نه بر تعداد گروه‌ها.`);
    case "midRange":
      return near("میانگین وسط بزرگ‌ترین و کوچک‌ترین نیست؛ همه‌ی عددها در آن سهم دارند.");
    default:
      return { tone: "bad", text: right };
  }
}

// ── Show me ─────────────────────────────────────────────────────────────

type Cols = number[][];

function fresh(heights: number[], start = 0): Cols {
  let id = start;
  return heights.map((h) => Array.from({ length: h }, () => id++));
}

/** Move `count` top blocks from one column to another; returns the moved ids. */
function move(cols: Cols, from: number, to: number, count: number): number[] {
  const moved = cols[from].splice(cols[from].length - count, count);
  cols[to].push(...moved);
  return moved;
}

const copy = (cols: Cols): Cols => cols.map((c) => [...c]);

/** Level every column to m: one transfer per frame, or all at once. */
function levelFrames(start: Cols, m: number, view: (cols: Cols, marked: number[]) => Omit<ColumnsFrame, "note">, note: (t: { from: number; to: number; count: number }) => string, together: boolean) {
  const frames: ColumnsFrame[] = [];
  const cols = copy(start);
  const ts = levelTransfers(
    cols.map((c) => c.length),
    m,
  );
  if (together) {
    const marked = ts.flatMap((t) => move(cols, t.from, t.to, t.count));
    if (ts.length) frames.push({ ...view(copy(cols), marked), note: note(ts[0]) });
  } else
    for (const t of ts) {
      const marked = move(cols, t.from, t.to, t.count);
      frames.push({ ...view(copy(cols), marked), note: note(t) });
    }
  return { frames, cols };
}

export function meanFrames(q: MeanQuestion): ColumnsFrame[] {
  const c = MEAN_CONTEXTS[q.context];
  const heights = meanColumns(q);
  switch (q.variant) {
    case "plain": {
      const n = q.values.length;
      const s = sum(q.values);
      const max = Math.max(...q.values);
      const m = q.answer;
      const base = (cols: Cols, marked: number[] = []): Omit<ColumnsFrame, "note"> => ({
        kind: "columns",
        cols: cols.map((b, i) => ({ label: q.names[i], blocks: b })),
        marked,
        max,
        caption: `جمع ${fa(s)} · تعداد ${fa(n)}`,
      });
      const start = fresh(q.values);
      const frames: ColumnsFrame[] = [{ ...base(start), note: `هر ستون ${c.noun}‌های یک نفر است: روی هم ${fa(s)} مکعب در ${fa(n)} ستون. مکعب‌ها را جابه‌جا می‌کنیم تا همه هم‌قد شوند؛ هیچ مکعبی اضافه یا کم نمی‌شود.` }];
      const lv = levelFrames(start, m, base, (t) => `از ستون ${q.names[t.from]}، ${fa(t.count)} مکعب به ستون ${q.names[t.to]} می‌بریم (مکعب‌های نقطه‌دار).`, false);
      frames.push(...lv.frames);
      frames.push({
        ...base(lv.cols),
        line: { at: m, label: `میانگین ${fa(m)}` },
        note: `همه‌ی ستون‌ها ${fa(m)} شدند؛ میانگین ${fa(m)} است. بدون جابه‌جا کردن هم می‌شود: جمع ÷ تعداد = ${ltr(`${fa(s)} ÷ ${fa(n)} = ${fa(m)}`)}.`,
      });
      return frames;
    }
    case "missing": {
      const n = q.values.length;
      const known = sum(q.values) - q.answer;
      const max = Math.max(...q.values, q.a);
      const who = q.names[q.miss];
      const start = fresh(heights.map((h, i) => (i === q.miss ? 0 : h)));
      const view = (cols: Cols, opts: { ghost?: boolean; filled?: boolean; marked?: number[]; line?: boolean; caption?: string } = {}): Omit<ColumnsFrame, "note"> => ({
        kind: "columns",
        cols: cols.map((b, i): ColView => ({ label: q.names[i], blocks: b, ask: i === q.miss && !opts.filled, ghost: opts.ghost ? q.a : undefined })),
        marked: opts.marked,
        line: opts.line ? { at: q.a, label: `میانگین ${fa(q.a)}` } : undefined,
        max,
        caption: opts.caption,
      });
      const frames: ColumnsFrame[] = [
        { ...view(start), note: `ستون ${who} را نمی‌دانیم. میانگین ${fa(q.a)} یعنی اگر مکعب‌ها را هم‌تراز کنیم، هر ستون ${fa(q.a)} می‌شود.` },
        {
          ...view(start, { ghost: true, line: true, caption: `جمع همه = ${fa(q.a)} × ${fa(n)} = ${fa(q.a * n)}` }),
          note: `قاب‌های خط‌چین ستون‌های هم‌تراز را نشان می‌دهند: ${fa(n)} ستون، هر کدام ${fa(q.a)}؛ پس روی هم ${ltr(`${fa(q.a)} × ${fa(n)} = ${fa(q.a * n)}`)} مکعب.`,
        },
      ];
      const filled = copy(start);
      filled[q.miss] = Array.from({ length: q.answer }, (_, k) => 1000 + k);
      frames.push({
        ...view(filled, { ghost: true, filled: true, line: true, marked: filled[q.miss], caption: `${fa(q.a * n)} − ${fa(known)} = ${fa(q.answer)}` }),
        note: `بقیه روی هم ${fa(known)} مکعب دارند؛ پس ستون ${who}: ${ltr(`${fa(q.a * n)} − ${fa(known)} = ${fa(q.answer)}`)}.`,
      });
      const lv = levelFrames(filled, q.a, (cols, marked) => view(cols, { filled: true, line: true, marked }), () => `بررسی: مکعب‌ها را جابه‌جا می‌کنیم؛ همه ${fa(q.a)} می‌شوند.`, true);
      frames.push(...lv.frames);
      frames.push({ ...view(lv.cols, { filled: true, line: true }), note: `درست است: میانگین ${fa(n)} ستون ${fa(q.a)} است. ${who} ${meanAnswerFa(q)} ${c.didOne}.` });
      return frames;
    }
    case "join": {
      const who = q.names[0];
      const max = Math.max(q.a, q.b, q.x);
      const labels = [...Array.from({ length: q.n }, (_, i) => fa(i + 1)), who];
      const start = fresh([...heights, 0]);
      const view = (cols: Cols, o: { ask?: boolean; ghost?: boolean; line?: number; lineLabel?: string; marked?: number[]; caption?: string } = {}): Omit<ColumnsFrame, "note"> => ({
        kind: "columns",
        cols: cols.map((b, i): ColView => ({ label: labels[i], blocks: b, ask: i === q.n && !!o.ask, ghost: o.ghost ? q.b : undefined })),
        marked: o.marked,
        line: o.line !== undefined ? { at: o.line, label: o.lineLabel ?? "" } : undefined,
        max,
        caption: o.caption,
      });
      const d = q.b - q.a;
      const filled = copy(start);
      filled[q.n] = Array.from({ length: q.x }, (_, k) => 1000 + k);
      const lv = levelFrames(filled, q.b, (cols, marked) => view(cols, { line: q.b, lineLabel: `میانگین تازه ${fa(q.b)}`, marked }), () =>
        d > 0 ? `${who} به هر ستون ${fa(d)} مکعب می‌دهد؛ همه ${fa(q.b)} می‌شوند.` : `هر ستون ${fa(-d)} مکعب به ${who} می‌دهد؛ همه ${fa(q.b)} می‌شوند.`, true);
      return [
        { ...view(start, { ask: true, line: q.a, lineLabel: `میانگین ${fa(q.a)}`, caption: `جمع ${fa(q.n)} نفر = ${fa(q.n)} × ${fa(q.a)} = ${fa(q.n * q.a)}` }), note: `میانگین ${fa(q.n)} نفر ${fa(q.a)} است: انگار هر ستون ${fa(q.a)} مکعب دارد. ستون ${who} را نمی‌دانیم.` },
        {
          ...view(start, { ask: true, ghost: true, line: q.b, lineLabel: `میانگین تازه ${fa(q.b)}`, caption: `جمع ${fa(q.n + 1)} نفر = ${fa(q.n + 1)} × ${fa(q.b)} = ${fa((q.n + 1) * q.b)}` }),
          note: `با ${who}، ${fa(q.n + 1)} نفرند و میانگین ${fa(q.b)}: بعد از هم‌تراز کردن هر ستون باید ${fa(q.b)} باشد. ${d > 0 ? `هر ستون قدیمی ${fa(d)} مکعب کم دارد.` : `هر ستون قدیمی ${fa(-d)} مکعب اضافه دارد.`}`,
        },
        {
          ...view(filled, { ghost: true, line: q.b, lineLabel: `میانگین تازه ${fa(q.b)}`, marked: filled[q.n] }),
          note:
            d > 0
              ? `${who} باید خودش ${fa(q.b)} داشته باشد و ${ltr(`${fa(q.n)} × ${fa(d)} = ${fa(q.n * d)}`)} هم به بقیه بدهد: ${ltr(`${fa(q.b)} + ${fa(q.n * d)} = ${fa(q.x)}`)}.`
              : `${who} از بقیه ${ltr(`${fa(q.n)} × ${fa(-d)} = ${fa(-q.n * d)}`)} مکعب می‌گیرد و به ${fa(q.b)} می‌رسد؛ پس خودش ${ltr(`${fa(q.b)} − ${fa(-q.n * d)} = ${fa(q.x)}`)} دارد.`,
        },
        ...lv.frames,
        { ...view(lv.cols, { line: q.b, lineLabel: `میانگین تازه ${fa(q.b)}` }), note: `با جمع‌ها هم همین می‌شود: ${ltr(`${fa((q.n + 1) * q.b)} − ${fa(q.n * q.a)} = ${fa(q.x)}`)}. ${who} ${meanAnswerFa(q)} ${c.didOne}.` },
      ];
    }
    case "leave": {
      const who = q.names[0];
      const max = Math.max(q.a, q.b, q.x);
      const labels = [...Array.from({ length: q.n - 1 }, (_, i) => fa(i + 1)), who];
      const start = fresh(heights);
      const view = (cols: Cols, o: { gone?: boolean; line?: number; lineLabel?: string; marked?: number[]; caption?: string } = {}): Omit<ColumnsFrame, "note"> => ({
        kind: "columns",
        cols: cols.map((b, i): ColView => ({ label: labels[i], blocks: b, gone: o.gone && i === q.n - 1 })),
        marked: o.marked,
        line: o.line !== undefined ? { at: o.line, label: o.lineLabel ?? "" } : undefined,
        max,
        caption: o.caption,
      });
      // Un-level: the leaver's column becomes x; the others even out at b.
      const real = copy(start);
      const marked: number[] = [];
      const d = q.a - q.b;
      for (let i = 0; i < q.n - 1; i++) marked.push(...(d > 0 ? move(real, i, q.n - 1, d) : move(real, q.n - 1, i, -d)));
      const after = real.slice(0, q.n - 1);
      return [
        { ...view(start, { line: q.a, lineLabel: `میانگین ${fa(q.a)}`, caption: `جمع = ${fa(q.n)} × ${fa(q.a)} = ${fa(q.n * q.a)}` }), note: `میانگین ${fa(q.n)} نفر ${fa(q.a)} است: انگار هر ستون ${fa(q.a)} مکعب دارد.` },
        {
          ...view(real, { line: q.a, lineLabel: `میانگین ${fa(q.a)}`, marked }),
          note:
            d > 0
              ? `ولی ستون ${who} در واقع ${fa(q.x)} است، یعنی ${fa(q.x - q.a)} مکعب بیشتر از ${fa(q.a)}. این مکعب‌ها از بقیه آمده‌اند: هر ستون ${fa(d)} تا.`
              : `ولی ستون ${who} در واقع ${fa(q.x)} است، یعنی ${fa(q.a - q.x)} مکعب کمتر از ${fa(q.a)}. این مکعب‌ها به بقیه رسیده‌اند: هر ستون ${fa(-d)} تا.`,
        },
        { ...view(real, { gone: true, line: q.b, lineLabel: `میانگین تازه ${fa(q.b)}`, marked }), note: `${who} می‌رود و ${fa(q.x)} مکعبش را با خود می‌برد. بقیه هر کدام ${fa(q.b)} دارند.` },
        {
          ...view(after, { line: q.b, lineLabel: `میانگین تازه ${fa(q.b)}`, caption: `(${fa(q.n * q.a)} − ${fa(q.x)}) ÷ ${fa(q.n - 1)} = ${fa(q.b)}` }),
          note: `میانگین ${fa(q.n - 1)} نفر باقی‌مانده ${fa(q.b)} است. با جمع‌ها: ${ltr(`(${fa(q.n * q.a)} − ${fa(q.x)}) ÷ ${fa(q.n - 1)} = ${fa(q.b)}`)}.`,
        },
      ];
    }
    case "groups": {
      const n = q.n + q.x;
      const max = Math.max(q.a, q.b);
      const labels = [...Array.from({ length: q.n }, (_, i) => fa(i + 1)), ...Array.from({ length: q.x }, (_, i) => fa(i + 1))];
      const groups = [
        { from: 0, to: q.n - 1, label: `گروه اول (میانگین ${fa(q.a)})` },
        { from: q.n, to: n - 1, label: `گروه دوم (میانگین ${fa(q.b)})` },
      ];
      const start = fresh(heights);
      const view = (cols: Cols, o: { marked?: number[]; line?: boolean; caption?: string } = {}): Omit<ColumnsFrame, "note"> => ({
        kind: "columns",
        cols: cols.map((b, i): ColView => ({ label: labels[i], blocks: b, group: i < q.n ? 0 : 1 })),
        marked: o.marked,
        line: o.line ? { at: q.answer, label: `میانگین همه ${fa(q.answer)}` } : undefined,
        groups,
        max,
        caption: o.caption,
      });
      const t1 = q.n * q.a;
      const t2 = q.x * q.b;
      const lv = levelFrames(start, q.answer, (cols, marked) => view(cols, { marked, line: true }), () => `مکعب‌ها را بین همه‌ی ${fa(n)} ستون پخش می‌کنیم: همه ${fa(q.answer)} می‌شوند.`, true);
      const mid = (q.a + q.b) / 2;
      return [
        { ...view(start), note: `هر گروه را هم‌تراز کشیده‌ایم: گروه اول ${fa(q.n)} ستون ${fa(q.a)}تایی، گروه دوم ${fa(q.x)} ستون ${fa(q.b)}تایی.` },
        { ...view(start, { caption: `${fa(t1)} + ${fa(t2)} = ${fa(t1 + t2)} مکعب در ${fa(n)} ستون` }), note: `جمع گروه اول ${ltr(`${fa(q.n)} × ${fa(q.a)} = ${fa(t1)}`)} و گروه دوم ${ltr(`${fa(q.x)} × ${fa(q.b)} = ${fa(t2)}`)}؛ روی هم ${fa(t1 + t2)}.` },
        ...lv.frames,
        {
          ...view(lv.cols, { line: true, caption: `${fa(t1 + t2)} ÷ ${fa(n)} = ${fa(q.answer)}` }),
          note: `میانگین همه ${ltr(`${fa(t1 + t2)} ÷ ${fa(n)} = ${fa(q.answer)}`)}، نه وسط دو میانگین${Number.isInteger(mid) ? ` (${fa(mid)})` : ""}: گروهی که آدم بیشتری دارد میانگین را به سمت خودش می‌کشد.`,
        },
      ];
    }
  }
}

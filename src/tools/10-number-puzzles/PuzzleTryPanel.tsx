"use client";

import { blankCells, cornersOf, firstMove, lineOk, puzzleMistake, SHAPE_RULES, type Level, type NumberPuzzle, type PuzzleType, type Step } from "@/generators/number-puzzles";
import { NumberPad } from "@/toolkit/NumberPad";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/TryPanel.module.css";

export const PUZZLE_TYPE_LABEL: Record<PuzzleType, string> = {
  magic: "مربع جادویی",
  pyramid: "هرم عددی",
  grid: "جدول جمع",
  star: "مثلث جادویی",
  shape: "عدد داخل شکل",
};

/** Keeps an equation left to right inside a Persian sentence, on one line (no-break spaces). */
export const ltr = (s: string) => `⁦${s.replace(/ /g, " ")}⁩`;

/** "۱ تا ۹", or the numbers one by one when they skip. */
export function setFa(set: readonly number[]) {
  const d = set[1] - set[0];
  return d === 1 ? `${fa(set[0])} تا ${fa(set[set.length - 1])}` : set.map(fa).join("، ");
}

const LEVEL_HINT: Record<Level, string> = {
  1: "قانون فقط جمع و تفریق دارد.",
  2: "در قانون ضرب هم هست.",
  3: "قانون پنهان است؛ خودت پیدایش کن.",
};

export function puzzlePrompt(q: NumberPuzzle, paper = false): string {
  const place = paper ? "بنویس" : "بگذار";
  switch (q.type) {
    case "magic":
      return q.targetHidden
        ? `عددهای ${setFa(q.set!)} هر کدام یک بار در جدول می‌آیند و جمع هر سطر، هر ستون و هر دو قطر یکی است. اول آن جمع را پیدا کن، بعد جدول را کامل کن.`
        : `عددهای ${setFa(q.set!)} هر کدام یک بار در جدول می‌آیند. خانه‌های خالی را پر کن تا جمع هر سطر، هر ستون و هر دو قطر ${fa(q.target!)} شود.`;
    case "pyramid":
      return "هر آجر، جمع دو آجر زیرش است. آجرهای خالی را پر کن.";
    case "grid":
      return "در ستون «جمع»، جمع هر سطر و در سطر «جمع»، جمع هر ستون نوشته شده. خانه‌های خالی را پر کن.";
    case "star":
      return q.anyFill
        ? `عددهای ${setFa(q.set!)} را هر کدام یک بار در دایره‌ها ${place} تا جمع هر ضلع ${fa(q.target!)} شود. این معما بیش از یک جواب دارد؛ هر چینش درستی پذیرفته می‌شود.`
        : `عددهای ${setFa(q.set!)} هر کدام یک بار در دایره‌ها می‌آیند. دایره‌های خالی را پر کن تا جمع هر ضلع ${fa(q.target!)} شود.`;
    case "shape": {
      const blank = blankCells(q)[0];
      return `در هر مثلث، عدد وسط با یک قانون از سه عدد گوشه ساخته می‌شود. ${LEVEL_HINT[q.level]} ${blank % 4 === 3 ? "عدد وسط شکل ۳ چند است؟" : "عدد گوشه‌ای که «؟» دارد چند است؟"}`;
    }
  }
}

/** The "think first" hint: true for this puzzle's own first step (see firstMove). */
export function firstHint(q: NumberPuzzle): string {
  switch (firstMove(q)) {
    case "rule":
      return "اول فکر کن: چه قانونی در شکل ۱ و شکل ۲ هر دو درست است؟";
    case "sum":
      return "اول فکر کن: جمع هر خط چند است؟ سه سطر با هم همه عددها را می‌گیرند.";
    case "cornerSum":
      return "اول فکر کن: هر گوشه در دو ضلع هست. جمع سه ضلع با جمع همه عددها چه فرقی دارد؟";
    case "only":
      return "اول فکر کن: هیچ خطی فقط یک خانه خالی ندارد؛ کدام خانه خالی فقط با یکی از عددهای باقی‌مانده جور است؟";
    case "line":
      return "اول فکر کن: کدام خط فقط یک خانه خالی دارد؟";
  }
}

const cornersFa = (vals: readonly (number | null)[], k: number) => cornersOf(vals, k).map((v) => fa(v ?? 0)) as [string, string, string];

/** One solving step in words. */
export function stepText(q: NumberPuzzle, s: Step): string {
  const v = q.cells.map((c) => c.value);
  switch (s.kind) {
    case "sum":
      return `جمع همه عددها ${fa(q.set!.reduce((a, b) => a + b, 0))} است و سه سطر همه را می‌گیرند؛ پس جمع هر خط ${ltr(`${fa(q.set!.reduce((a, b) => a + b, 0))} ÷ ۳ = ${fa(s.value)}`)}.`;
    case "centre":
      return `خانه وسط در چهار خط هست و همیشه یک‌سوم جمع خط است: ${ltr(`${fa(q.target!)} ÷ ۳ = ${fa(s.value)}`)}.`;
    case "cornerSum":
      return `هر گوشه در دو ضلع حساب می‌شود؛ پس ${ltr(`۳ × ${fa(q.target!)} − ${fa(q.set!.reduce((a, b) => a + b, 0))} = ${fa(s.value)}`)} جمع سه گوشه است.`;
    case "pick":
      return `سه عددی که جمعشان ${fa(s.values.reduce((a, b) => a + b, 0))} است و جواب می‌دهند: ${s.values.map(fa).join("، ")}. آن‌ها را در گوشه‌ها بگذار (ترتیبشان دلخواه است).`;
    case "line": {
      const line = q.lines[s.line];
      const known = line.cells.filter((i) => i !== s.cell);
      if (!line.total) return `${line.name} فقط یک خانه خالی دارد: ${ltr(`${fa(q.target!)} − ${known.map((i) => fa(v[i])).join(" − ")} = ${fa(s.value)}`)}.`;
      const last = line.cells[line.cells.length - 1];
      const parts = line.cells.slice(0, -1);
      const what = q.type === "pyramid" ? "آجر" : "خانه";
      if (s.cell === last) return `${q.type === "pyramid" ? "آجر بالا جمع دو آجر زیرش است" : `جمع ${line.name}`}: ${ltr(`${parts.map((i) => fa(v[i])).join(" + ")} = ${fa(s.value)}`)}.`;
      return `${what} خالی = ${q.type === "pyramid" ? "آجر بالا" : `جمع ${line.name}`} منهای ${q.type === "pyramid" ? "آجر کناری" : "بقیه"}: ${ltr(`${fa(v[last])} − ${parts.filter((i) => i !== s.cell).map((i) => fa(v[i])).join(" − ")} = ${fa(s.value)}`)}.`;
    }
    case "only":
      return `عددهای باقی‌مانده: ${s.rest.map(fa).join("، ")}. با خط‌های این خانه فقط ${fa(s.value)} جور درمی‌آید.`;
    case "check": {
      const r = SHAPE_RULES[q.rule!];
      const [t, l, rr] = cornersFa(v, s.shape);
      return `شکل ${fa(s.shape + 1)}: ${r.words}: ${ltr(`${r.expr(t, l, rr)} = ${fa(s.value)}`)} ✓`;
    }
    case "apply": {
      const r = SHAPE_RULES[q.rule!];
      const [t, l, rr] = cornersFa(v, 2);
      if (s.cell % 4 === 3) return `همین قانون در شکل ۳: ${ltr(`${r.expr(t, l, rr)} = ${fa(s.value)}`)}.`;
      const shown = cornersFa(v, 2);
      shown[s.cell % 4] = "؟";
      return `در شکل ۳ گوشه خالی را پیدا کن: ${ltr(`${r.expr(...shown)} = ${fa(v[11])}`)}، پس ؟ = ${fa(s.value)} (امتحان کن: ${ltr(`${r.expr(t, l, rr)} = ${fa(v[11])}`)}).`;
    }
  }
}

type Tone = "good" | "turned" | "bad";
const ICON: Record<Tone, string> = { good: "✓", turned: "↻", bad: "✗" };

/** Names of the wrong lines, e.g. "سطر بالا، قطر از بالا چپ". */
function badNames(q: NumberPuzzle, bad: readonly number[]) {
  if (q.type === "pyramid") return `${fa(bad.length)} آجر با دو آجر زیرش جور نیست`;
  return `${bad.map((i) => q.lines[i].name).join("، ")} درست نیست`;
}

export function feedback(q: NumberPuzzle, vals: readonly (number | null)[]): { tone: Tone; text: string } {
  const m = puzzleMistake(q, vals);
  const hatch = m.bad.length ? ` ${badNames(q, m.bad)}؛ هاشور خورده‌اند.` : "";
  switch (m.tag) {
    case "right":
      return { tone: "good", text: q.anyFill ? "درست است! هر سه ضلع برابرند. چینش‌های دیگری هم درست‌اند (مثلاً چرخاندن مثلث)." : "درست است! همه خط‌ها جور درمی‌آیند." };
    case "anyValid":
      return { tone: "good", text: "درست است! این هم یک جواب درست است. معما چند جواب دارد؛ مثلاً اگر مثلث را بچرخانی یا برگردانی، جواب تازه‌ای می‌گیری." };
    case "notInSet":
      return { tone: "bad", text: `عدد ${fa(m.value!)} جزو عددهای این معما نیست؛ فقط ${setFa(q.set!)} را به کار ببر.${hatch}` };
    case "repeat":
      return { tone: "turned", text: `عدد ${fa(m.value!)} دو بار آمده؛ هر عدد فقط یک بار می‌آید.${hatch}` };
    case "addedDown":
      return {
        tone: "turned",
        text:
          q.type === "pyramid"
            ? `نزدیک بود! برای آجر پایینی باید از آجر بالا کم کنی، نه اینکه جمع کنی: پایینی = بالایی − کناری.${hatch}`
            : `نزدیک بود! برای یک خانه، بقیه را از «جمع» کم کن، نه اینکه به آن اضافه کنی.${hatch}`,
      };
    case "sumHabit":
      return { tone: "turned", text: "فقط سه گوشه را جمع کردی؛ ولی در شکل‌های ۱ و ۲ عدد وسط جمع گوشه‌ها نیست. یک قانون دیگر را روی شکل ۱ امتحان کن." };
    case "oneExample":
      return { tone: "turned", text: "نزدیک بود! قانونی که پیدا کردی فقط در شکل ۱ درست است. قانون باید در شکل ۲ هم درست باشد." };
    case "diagonal":
      return { tone: "turned", text: `سطرها و ستون‌ها درست‌اند، ولی جمع هر دو قطر هم باید ${fa(q.target!)} شود.${hatch}` };
    case "lines":
      return { tone: "bad", text: `هنوز نه.${hatch} آن‌ها را درست کن و دوباره بررسی کن.` };
    default:
      return { tone: "bad", text: q.type === "shape" ? "هنوز نه. قانون را روی هر دو شکل ۱ و ۲ امتحان کن، بعد در شکل ۳ به کار ببر." : "هنوز نه. دوباره بررسی کن." };
  }
}

/** Lines right so far: "۵ از ۸ خط". */
export function linesRight(q: NumberPuzzle, vals: readonly (number | null)[]) {
  return q.lines.filter((l) => lineOk(q, l, vals)).length;
}

interface Props {
  question: NumberPuzzle;
  type: PuzzleType;
  level: Level;
  big: boolean;
  vals: readonly (number | null)[];
  selected: number | null;
  onValue: (v: number | null) => void;
  checked: boolean;
  onCheck: () => void;
  onType: (t: PuzzleType) => void;
  onLevel: (l: Level) => void;
  onBig: (b: boolean) => void;
  onNew: () => void;
  onShow: () => void;
}

export function PuzzleTryPanel(p: Props) {
  const { question: q, vals, checked, selected } = p;
  const blanks = blankCells(q);
  const full = blanks.every((i) => vals[i] !== null);
  const fb = checked ? feedback(q, vals) : null;
  const right = fb?.tone === "good";
  const sel = selected !== null && blanks.includes(selected) ? selected : null;

  return (
    <div className={styles.panel}>
      <div className={styles.types} role="radiogroup" aria-label="نوع معما">
        {(Object.keys(PUZZLE_TYPE_LABEL) as PuzzleType[]).map((t) => (
          <button key={t} role="radio" aria-checked={p.type === t} onClick={() => p.onType(t)}>
            {PUZZLE_TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      <div className={styles.chips} role="radiogroup" aria-label="سطح">
        {([1, 2, 3] as Level[]).map((l) => (
          <button key={l} role="radio" aria-checked={p.level === l} onClick={() => p.onLevel(l)}>
            سطح {fa(l)}
          </button>
        ))}
      </div>
      <div className={styles.chips} role="radiogroup" aria-label="اندازه اعداد">
        <button role="radio" aria-checked={!p.big} onClick={() => p.onBig(false)}>
          اعداد کوچک
        </button>
        <button role="radio" aria-checked={p.big} onClick={() => p.onBig(true)}>
          اعداد بزرگ
        </button>
      </div>

      <p className={styles.prompt}>{puzzlePrompt(q)}</p>
      <p className={styles.hint}>
        {q.set ? "عددها را از پایین صفحه بکش و در خانه رها کن؛ یا خانه را بزن، بعد عدد را. " : "یک خانه خالی را بزن و عددش را بنویس. "}
        {blanks.length > 1 ? `${fa(blanks.filter((i) => vals[i] !== null).length)} از ${fa(blanks.length)} خانه پر شده.` : ""}
      </p>

      {!right && !q.set && <NumberPad value={sel !== null && vals[sel] !== null ? String(vals[sel]) : ""} onChange={(v) => p.onValue(v === "" ? null : Number(v))} disabled={sel === null} />}

      {!right && (
        <button className={styles.secondary} disabled={!full} onClick={p.onCheck}>
          بررسی
        </button>
      )}

      {fb && (
        <p className={`${styles.feedback} ${styles[fb.tone]}`} role="status" aria-live="polite">
          <span className={styles.icon}>{ICON[fb.tone]}</span> {fb.text}
        </p>
      )}

      <button className={styles.secondary} onClick={p.onShow}>
        نشانم بده چطور حل می‌شود
      </button>
      <button className={styles.next} onClick={p.onNew}>
        نمونه تازه
      </button>
    </div>
  );
}

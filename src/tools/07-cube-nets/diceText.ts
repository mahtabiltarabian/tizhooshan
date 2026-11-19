// Persian wording for the dice questions: prompts, the step-by-step trace,
// and feedback that names each slip.

import { oppositePairs } from "@/generators/cube-nets";
import { diceMistake, HIDDEN_OF, rollStates, type DiceQuestion, type Dir, type Side } from "@/generators/dice";
import { fa } from "@/tools/registry";

export const DIR_ARROW: Record<Dir, string> = { E: "→", W: "←", N: "↑", S: "↓" };
export const DIR_NAME: Record<Dir, string> = { E: "راست", W: "چپ", N: "عقب", S: "جلو" };
export const SIDE_NAME: Record<Side, string> = { top: "بالا", bottom: "زیر", north: "پشت", south: "روبرو", east: "راست", west: "چپ" };

/** "→ ۲ بار راست، ↑ ۱ بار عقب" */
export function movesText(path: readonly Dir[]): string {
  const runs: [Dir, number][] = [];
  for (const d of path) {
    const last = runs[runs.length - 1];
    if (last && last[0] === d) last[1]++;
    else runs.push([d, 1]);
  }
  return runs.map(([d, n]) => `${DIR_ARROW[d]} ${fa(n)} بار ${DIR_NAME[d]}`).join("، ");
}

const ASK_NAME = { top: "وجه بالا", bottom: "وجه زیر (روی زمین)", south: "وجه روبرو (رو به ما)" } as const;

export function dicePrompt(q: DiceQuestion, paper = false): string {
  if (q.type === "roll")
    return `تاس را خانه‌به‌خانه روی مسیر بغلتان: ${movesText(q.path)}. در خانه «پایان»، ${ASK_NAME[q.ask]} چند خال دارد؟${paper ? "" : " (عقب یعنی دور از ما، جلو یعنی به طرف ما)"}`;
  switch (q.kind) {
    case "opposite": {
      const hidden = HIDDEN_OF[q.shown];
      return `در تاس استاندارد مجموع هر دو وجه روبرو ۷ است. وجه ${SIDE_NAME[hidden]} این تاس، که روبروی وجه ${SIDE_NAME[q.shown]} است، چند خال دارد؟`;
    }
    case "missing":
      return `این گسترده یک تاس استاندارد است: مجموع هر دو وجه روبرو ۷ است. دو خانه خالی است. در خانه «؟» چند خال می‌آید؟`;
    case "validNet":
      return "کدام گسترده تاسی می‌سازد که مجموع هر دو وجه روبرویش ۷ باشد؟";
  }
}

/** The asked face after each roll, from the start: "۳ → ۱ → ۴". */
export function rollTrace(q: Extract<DiceQuestion, { type: "roll" }>): string {
  const seq = rollStates(q.start, q.path).map((s) => fa(s[q.ask]));
  return `${ASK_NAME[q.ask]} از شروع تا پایان: ${seq.join(" → ")}.`;
}

export type DiceTone = "good" | "turned" | "bad";

/** Feedback for a picked number (or net index for "validNet"). */
export function diceFeedback(q: DiceQuestion, v: number): { tone: DiceTone; text: string } {
  const tag = diceMistake(q, v);
  if (q.type === "roll") {
    const why = rollTrace(q);
    const end = rollStates(q.start, q.path).at(-1)!;
    switch (tag) {
      case "right":
        return { tone: "good", text: `درست است! ${why}` };
      case "topBottom":
        return { tone: "turned", text: `نزدیک بود! وجه بالا و زیر را جابه‌جا گرفتی؛ ${fa(v)} روبروی جواب است. ${why}` };
      case "frontBack":
        return { tone: "turned", text: `نزدیک بود! وجه روبرو و پشت را جابه‌جا گرفتی؛ ${fa(v)} وجه پشت است. ${why}` };
      case "wrongWay":
        return { tone: "bad", text: `تاس را برعکس غلتاندی. وقتی تاس به راست می‌غلتد، وجه بالا به سمت راست می‌خوابد و وجه چپ بالا می‌آید. ${why}` };
      case "mirror":
        return { tone: "bad", text: `غلت‌های راست و چپ را برعکس زدی. وقتی تاس به راست می‌غلتد، وجه چپ بالا می‌آید. ${why}` };
      case "flipNS":
        return { tone: "bad", text: `غلت‌های عقب و جلو را برعکس زدی. وقتی تاس به عقب (دور از ما) می‌غلتد، وجه روبرو بالا می‌آید. ${why}` };
      case "oneShort":
        return { tone: "turned", text: `نزدیک بود! یک غلت جا افتاد؛ مسیر ${fa(q.path.length)} غلت دارد. ${why}` };
      case "noRoll":
        return { tone: "bad", text: `این ${ASK_NAME[q.ask]} پیش از غلتیدن است؛ با هر غلت عوض می‌شود. ${why}` };
      default:
        return { tone: "bad", text: `نه؛ در پایان ${ASK_NAME[q.ask]} ${fa(end[q.ask])} خال دارد. ${why}` };
    }
  }

  switch (q.kind) {
    case "opposite": {
      const s = q.die[q.shown];
      const why = `${fa(s)} + ${fa(q.answer)} = ۷.`;
      switch (tag) {
        case "right":
          return { tone: "good", text: `درست است! ${why}` };
        case "sameFace":
          return { tone: "bad", text: `${fa(s)} همان وجه ${SIDE_NAME[q.shown]} است که می‌بینی؛ پرسیده روبروی آن چند است. ${why}` };
        case "visible":
          return { tone: "bad", text: `${fa(v)} در تصویر کنار ${fa(s)} دیده می‌شود؛ دو وجه که کنار هم‌اند روبروی هم نیستند. ${why}` };
        case "nextNumber":
          return { tone: "bad", text: `روبروی ${fa(s)}، عدد بعدی یا قبلی آن نیست؛ ${fa(s)} و ${fa(v)} کنار هم‌اند. روبرو یعنی مجموع ۷: ${why}` };
        case "sumSix":
          return { tone: "turned", text: `نزدیک بود! مجموع دو وجه روبرو ۷ است، نه ۶. ${why}` };
        default:
          return { tone: "bad", text: `نه. ${why}` };
      }
    }
    case "missing": {
      const opp = (() => {
        const p = oppositePairs(q.net.cells).find((x) => x.includes(q.ask))!;
        return q.net.values[p[0] === q.ask ? p[1] : p[0]];
      })();
      const why = `روبروی خانه «؟» عدد ${fa(opp)} است و ${fa(opp)} + ${fa(q.answer)} = ۷.`;
      if (tag === "right") return { tone: "good", text: `درست است! ${why}` };
      if (tag === "otherBlank") return { tone: "turned", text: `نزدیک بود! ${fa(v)} هم روی گسترده نیست، ولی جای آن خانه خالی دیگر است. ${why}` };
      if (tag === "shown") return { tone: "bad", text: `${fa(v)} روی گسترده هست؛ هر عدد فقط روی یک وجه می‌آید. ${why}` };
      return { tone: "bad", text: `نه. ${why}` };
    }
    case "validNet": {
      if (tag === "right") return { tone: "good", text: "درست است! در این گسترده ۱ و ۶، ۲ و ۵، ۳ و ۴ روبروی هم می‌افتند. گسترده تا می‌شود تا ببینی." };
      const f = q.faults[v];
      const [a, b] = f ? f.pair : [0, 0];
      const net = q.nets[v];
      const [ia, ib] = [net.values.indexOf(a), net.values.indexOf(b)];
      const touch = Math.abs(net.cells[ia][0] - net.cells[ib][0]) + Math.abs(net.cells[ia][1] - net.cells[ib][1]) === 1;
      return {
        tone: "bad",
        text: `در این گسترده ${fa(a)} و ${fa(b)}، که مجموعشان ۷ است، روبروی هم نمی‌افتند${touch ? "؛ ضلع مشترک دارند، پس کنار هم‌اند" : ""}. گسترده درست گزینه ${fa(q.answer + 1)} است.`,
      };
    }
  }
}

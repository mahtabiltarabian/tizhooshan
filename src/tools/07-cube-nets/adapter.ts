// Tool 7 in practice sessions: grading and three-step hints (the light
// data, types and tag words, is in practice.ts).
// The response is what the panel checks:
//  - opposite, hidden: the index of the tapped net cell;
//  - touch: the indices of the chosen net cells (any order);
//  - missing: the quarter turns of the chosen direction (0 … 3);
//  - makes, cannot, netMakes, netCannot: the index of the chosen option;
//  - place: the placement {symbols: (string | null)[], turns: number[]}, one per net cell;
//  - die, roll: the number picked (1 … 6), or for "which net" the option index.

import { SLOTS, makeQuestion, scorePlacement, type Level, type Question, type QuestionType, type Slot } from "@/generators/cube-questions";
import { oppositePairs } from "@/generators/cube-nets";
import { diceMistake, HIDDEN_OF, makeDiceQuestion, type DiceQuestion, type DiceQuestionType } from "@/generators/dice";
import type { ToolAdapter } from "@/practice/adapter";
import { fa } from "@/tools/registry";
import { DIR_NAME, SIDE_NAME } from "./diceText";
import { CUBE_NETS_PRACTICE } from "./practice";

type Type = QuestionType | DiceQuestionType;
const isDice = (t: string): t is DiceQuestionType => t === "die" || t === "roll";

const int = (v: unknown, lo: number, hi: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= lo && v < hi;
const MISTAKE_TAG = { opposite: "oppositeSide", turned: "turned", swapped: "swapped" } as const;

function gradeNet(q: Question, r: unknown): string {
  switch (q.type) {
    case "opposite":
      if (!int(r, 0, 6)) return "other";
      return r === q.answer ? "right" : r === q.target ? "target" : "adjacent";
    case "hidden": {
      if (!int(r, 0, 6)) return "other";
      if (r === q.answer) return "right";
      const seen = SLOTS.map((s) => q.view[s].symbol);
      return seen.includes(q.net.symbols[r]) ? "visible" : "adjacent";
    }
    case "touch": {
      if (!Array.isArray(r) || !r.every((i) => int(i, 0, 6))) return "other";
      const sel = [...new Set(r as number[])].filter((i) => i !== q.target);
      if (!sel.length) return "other";
      if (sel.some((i) => !q.answers.includes(i))) return "withOpposite";
      return sel.length === q.answers.length ? "right" : "missedSome";
    }
    case "missing":
      if (!int(r, 0, 4)) return "other";
      return r === q.answer ? "right" : "turned";
    case "makes":
      if (!int(r, 0, q.options.length)) return "other";
      if (r === q.answer) return "right";
      return q.options[r].mistake ? MISTAKE_TAG[q.options[r].mistake!] : "other";
    case "cannot":
      if (!int(r, 0, q.options.length)) return "other";
      return r === q.answer ? "right" : "possible";
    case "netMakes":
      if (!int(r, 0, q.nets.length)) return "other";
      if (r === q.answer) return "right";
      return q.nets[r].mistake ?? "other";
    case "netCannot":
      if (!int(r, 0, q.nets.length)) return "other";
      return r === q.answer ? "right" : "possible";
    case "place": {
      const p = r as { symbols?: unknown; turns?: unknown } | null;
      if (!p || !Array.isArray(p.symbols) || !Array.isArray(p.turns) || p.symbols.length !== 6 || p.turns.length !== 6) return "other";
      if (!p.symbols.every((s) => s === null || typeof s === "string") || !p.turns.every((t) => int(t, 0, 4))) return "other";
      const { status, solved } = scorePlacement(q.net.cells, q.faces, { symbols: p.symbols as (string | null)[], turns: p.turns as number[] });
      if (solved) return "right";
      return status.every((s) => s !== "wrong") ? "turned" : "misplaced";
    }
  }
}

function gradeDice(q: DiceQuestion, r: unknown): string {
  if (typeof r !== "number" || !Number.isInteger(r)) return "other";
  if (q.type === "die" && q.kind === "validNet") {
    if (!int(r, 0, q.nets.length)) return "other";
    return r === q.answer ? "right" : "notStandard";
  }
  return diceMistake(q, r);
}

function grade(type: string, level: number, seed: number, response: unknown): string {
  if (isDice(type)) return gradeDice(makeDiceQuestion(type, level as Level, seed), response);
  return gradeNet(makeQuestion(type as QuestionType, level as Level, seed), response);
}

const NUDGE: Record<Type, string> = {
  opposite: "روبرو یعنی وجهی که بعد از تا شدن، پشت به پشت این وجه می‌افتد؛ هیچ‌وقت کنارش نیست.",
  touch: "هر وجه مکعب با چهار وجه دیگر ضلع مشترک دارد.",
  hidden: "در تصویر سه وجه پیداست؛ سه وجه دیگر پشت آن‌ها پنهان‌اند.",
  missing: "به همسایه‌های خانه خالی نگاه کن و جهت نماد را با آن‌ها بسنج.",
  makes: "هر گزینه را با گسترده بسنج؛ دنبال دو وجه روبرو بگرد که کنار هم آمده‌اند.",
  cannot: "هر گزینه را با گسترده بسنج؛ دنبال دو وجه روبرو بگرد که کنار هم آمده‌اند.",
  netMakes: "در هر گسترده، جای نمادها را نسبت به هم با تصویر مکعب مقایسه کن.",
  netCannot: "در هر گسترده، جای نمادها را نسبت به هم با تصویر مکعب مقایسه کن.",
  place: "اول جای نمادها را درست کن، بعد جهتشان را.",
  die: "در تاس استاندارد، مجموع هر دو وجه روبرو ۷ است.",
  roll: "تاس را در ذهنت خانه‌به‌خانه بغلتان و بعد از هر غلت، وجه بالا را بنویس.",
};

const RULE: Record<Type, string> = {
  opposite: "در گسترده، دو خانه که در یک ردیف یا یک ستون‌اند و یک خانه بینشان فاصله است، روبروی هم می‌افتند.",
  touch: "همه وجه‌ها جز وجه روبرو با آن ضلع مشترک دارند؛ پس کافی است وجه روبرو را پیدا کنی.",
  hidden: "وجه پنهان روبروی وجه دیده‌شده است؛ روبروی آن را روی گسترده پیدا کن.",
  missing: "وقتی گسترده تا می‌شود، ضلع‌هایی که به هم می‌چسبند کنار هم می‌مانند؛ جهت نماد را از همسایه‌ای که در تصویر کنارش است پیدا کن.",
  makes: "دو وجه روبرو هیچ‌وقت با هم دیده نمی‌شوند، و ترتیب سه وجه دور یک گوشه با چرخاندن مکعب عوض نمی‌شود.",
  cannot: "دو وجه روبرو هیچ‌وقت با هم دیده نمی‌شوند، و ترتیب سه وجه دور یک گوشه با چرخاندن مکعب عوض نمی‌شود.",
  netMakes: "گسترده درست همان جفت‌های روبرو و همان ترتیب دور هر گوشه را دارد؛ جهت نمادها هم باید بخواند.",
  netCannot: "گسترده درست همان جفت‌های روبرو و همان ترتیب دور هر گوشه را دارد؛ جهت نمادها هم باید بخواند.",
  place: "تصویر «از پشت» سه وجهی را نشان می‌دهد که در تصویر «از روبرو» پنهان‌اند؛ هر وجه آن روبروی یکی از وجه‌های تصویر اول است.",
  die: "عدد وجه روبرو = ۷ منهای عدد این وجه.",
  roll: "وقتی تاس به راست می‌غلتد، وجه بالا به راست می‌خوابد و وجه چپ بالا می‌آید؛ وقتی به عقب می‌غلتد، وجه روبرو بالا می‌آید.",
};

const SLOT_NAME: Record<Slot, string> = { top: "بالا", right: "راست", left: "چپ" };

function netStep(q: Question): string {
  const s = q.net.symbols;
  switch (q.type) {
    case "opposite":
      return `گام اول: «${s[q.target]}» را روی گسترده پیدا کن و همسایه‌هایش را خط بزن؛ هیچ‌کدام روبرویش نیستند.`;
    case "touch":
      return `گام اول: اول وجه روبروی «${s[q.target]}» را پیدا کن.`;
    case "hidden":
      return `گام اول: وجه ${SLOT_NAME[q.slot]} («${q.view[q.slot].symbol}») را روی گسترده پیدا کن.`;
    case "missing": {
      const pair = oppositePairs(q.net.cells).find((p) => p.includes(q.blank))!;
      const opp = s[pair[0] === q.blank ? pair[1] : pair[0]];
      return `گام اول: «${opp}» روبروی خانه خالی است؛ پس در تصویر مکعب دیده نمی‌شود. یکی از همسایه‌های خانه خالی را که در تصویر پیداست انتخاب کن.`;
    }
    case "makes":
    case "cannot":
      return "گام اول: روی گسترده، سه جفت وجه روبرو را پیدا کن و بنویس؛ بعد هر گزینه را با آن‌ها بسنج.";
    case "netMakes":
    case "netCannot":
      return `گام اول: در تصویر مکعب، «${q.view.top.symbol}» بالاست؛ در هر گسترده ببین چه نمادی روبروی آن می‌افتد.`;
    case "place":
      return `گام اول: «${q.views[0].top.symbol}» و «${q.views[1].top.symbol}» روبروی هم‌اند؛ آن‌ها را در دو خانه روبروی گسترده بگذار.`;
  }
}

function diceStep(q: DiceQuestion): string {
  if (q.type === "roll") return `گام اول: غلت اول به ${DIR_NAME[q.path[0]]} است؛ بعد از آن کدام وجه بالا می‌آید؟`;
  switch (q.kind) {
    case "opposite":
      return `گام اول: وجه ${SIDE_NAME[q.shown]} ${fa(q.die[q.shown])} خال دارد و وجه ${SIDE_NAME[HIDDEN_OF[q.shown]]} روبروی آن است.`;
    case "missing":
      return "گام اول: روی گسترده، خانه روبروی «؟» را پیدا کن.";
    case "validNet":
      return "گام اول: در هر گسترده، خانه روبروی عدد یک را پیدا کن و ببین شش است یا نه.";
  }
}

function hints(type: string, level: number, seed: number): [string, string, string] {
  const step = isDice(type) ? diceStep(makeDiceQuestion(type, level as Level, seed)) : netStep(makeQuestion(type as QuestionType, level as Level, seed));
  return [NUDGE[type as Type], RULE[type as Type], step];
}

export const CUBE_NETS_ADAPTER: ToolAdapter = {
  ...CUBE_NETS_PRACTICE,
  version: "cube-nets@1",
  grade,
  hints,
};

// Persian wording for the faces/edges/vertices questions: prompts, the
// counting breakdown ("why"), and feedback that names each slip.

import { counts, solidMistake, solidName, type Part, type Solid, type SolidQuestion } from "@/generators/solids";
import { fa } from "@/tools/registry";

export const PART_NAME: Record<Part, string> = { faces: "وجه", edges: "یال", vertices: "رأس" };
export const PART_PLURAL: Record<Part, string> = { faces: "وجه‌ها", edges: "یال‌ها", vertices: "رأس‌ها" };
/** What each part is, in a child's words. */
export const PART_MEANING: Record<Part, string> = { faces: "سطح صاف", edges: "لبه، جایی که دو وجه به هم می‌رسند", vertices: "گوشه، جایی که یال‌ها به هم می‌رسند" };

const FAMILY_NAME = { prism: "منشور", pyramid: "هرم" } as const;

/** One line per group, then the total: "۵ یال پایین + ۵ یال بالا + ۵ یال کناری = ۱۵". */
export function breakdownParts(s: Solid, part: Part): { count: number; label: string }[] {
  const n = s.n;
  if (s.family === "prism")
    return {
      faces: [
        { count: 2, label: "قاعده (بالا و پایین)" },
        { count: n, label: "وجه کناری" },
      ],
      edges: [
        { count: n, label: "یال پایین" },
        { count: n, label: "یال بالا" },
        { count: n, label: "یال کناری" },
      ],
      vertices: [
        { count: n, label: "رأس پایین" },
        { count: n, label: "رأس بالا" },
      ],
    }[part];
  return {
    faces: [
      { count: 1, label: "قاعده" },
      { count: n, label: "وجه کناری مثلثی" },
    ],
    edges: [
      { count: n, label: "یال قاعده" },
      { count: n, label: "یال کناری تا سر هرم" },
    ],
    vertices: [
      { count: n, label: "رأس قاعده" },
      { count: 1, label: "سر هرم" },
    ],
  }[part];
}

export function breakdown(s: Solid, part: Part): string {
  return `${breakdownParts(s, part).map((g) => `${fa(g.count)} ${g.label}`).join(" + ")} = ${fa(counts(s)[part])}`;
}

/** The rule for a family, e.g. "منشور با قاعده n‌ضلعی: n + ۲ وجه، ۳n یال، ۲n رأس". */
export const RULE = {
  prism: { faces: "n + ۲", edges: "۳ × n", vertices: "۲ × n" },
  pyramid: { faces: "n + ۱", edges: "۲ × n", vertices: "n + ۱" },
} as const;

export function solidPrompt(q: SolidQuestion, paper = false): string {
  const p = PART_NAME[q.part];
  switch (q.kind) {
    case "count":
      return `این ${solidName(q.solid)} چند ${p} دارد؟ یال‌های پشت با خط‌چین کشیده شده‌اند.${paper ? "" : " جسم را در صحنه بچرخان."}`;
    case "combine": {
      const [a, b] = q.solids.map(solidName);
      return q.op === "sum" ? `یک ${a} و یک ${b} روی‌هم چند ${p} دارند؟` : `${a} چند ${p} بیشتر از ${b} دارد؟`;
    }
    case "reverse":
      return `یک ${FAMILY_NAME[q.solid.family]} ${fa(q.givenValue)} ${PART_NAME[q.given]} دارد. چند ${p} دارد؟`;
    case "euler": {
      const given = q.given.map(([part, v]) => `${fa(v)} ${PART_NAME[part]}`).join(" و ");
      return `یک جسم با وجه‌های صاف ${given} دارد. چند ${p} دارد؟ (راهنما: در این جسم‌ها همیشه رأس − یال + وجه = ۲)`;
    }
  }
}

/** Why the right answer is right. */
export function solidWhy(q: SolidQuestion): string {
  switch (q.kind) {
    case "count":
      return `${breakdown(q.solid, q.part)}.`;
    case "combine": {
      const [a, b] = q.solids;
      const [ca, cb] = [counts(a)[q.part], counts(b)[q.part]];
      const each = `${solidName(a)} ${fa(ca)} و ${solidName(b)} ${fa(cb)} ${PART_NAME[q.part]} دارد`;
      return `${each}؛ پس ${fa(ca)} ${q.op === "sum" ? "+" : "−"} ${fa(cb)} = ${fa(q.value)}.`;
    }
    case "reverse": {
      const s = q.solid;
      const rule = RULE[s.family];
      const find = {
        prism: { edges: `${fa(q.givenValue)} ÷ ۳`, faces: `${fa(q.givenValue)} − ۲`, vertices: `${fa(q.givenValue)} ÷ ۲` },
        pyramid: { edges: `${fa(q.givenValue)} ÷ ۲`, faces: `${fa(q.givenValue)} − ۱`, vertices: `${fa(q.givenValue)} − ۱` },
      }[s.family][q.given];
      const value = rule[q.part].replace("n", fa(s.n));
      return `در ${FAMILY_NAME[s.family]}، ${PART_PLURAL[q.given]} = ${rule[q.given]}؛ پس قاعده ${find} = ${fa(s.n)} ضلع دارد (${solidName(s)}). ${PART_PLURAL[q.part]} = ${value} = ${fa(q.value)}.`;
    }
    case "euler": {
      const g = Object.fromEntries(q.given) as Partial<Record<Part, number>>;
      const expr =
        q.part === "faces"
          ? `وجه = ۲ − رأس + یال = ۲ − ${fa(g.vertices!)} + ${fa(g.edges!)}`
          : q.part === "vertices"
            ? `رأس = ۲ − وجه + یال = ۲ − ${fa(g.faces!)} + ${fa(g.edges!)}`
            : `یال = رأس + وجه − ۲ = ${fa(g.vertices!)} + ${fa(g.faces!)} − ۲`;
      return `${expr} = ${fa(q.value)}. (این جسم ${solidName(q.solid)} است.)`;
    }
  }
}

export type SolidTone = "good" | "turned" | "bad";

/** Feedback for a picked number: names the slip, then shows the right count. */
export function solidFeedback(q: SolidQuestion, v: number): { tone: SolidTone; text: string } {
  const why = solidWhy(q);
  const p = PART_PLURAL[q.part];
  const tag = solidMistake(q, v);
  const n = "solid" in q ? q.solid.n : 0;
  const near = (text: string) => ({ tone: "turned" as const, text: `نزدیک بود! ${text} ${why}` });
  const bad = (text: string) => ({ tone: "bad" as const, text: `${text} ${why}` });
  switch (tag) {
    case "right":
      return { tone: "good", text: `درست است! ${why}` };
    case "visibleOnly":
      return near(
        q.part === "faces"
          ? "فقط وجه‌هایی را شمردی که در تصویر پیداست؛ وجه‌های پشت و زیر جسم را هم بشمار."
          : `فقط ${p}یی را شمردی که در تصویر پیداست؛ ${q.part === "edges" ? "خط‌چین‌ها" : "گوشه‌های پشت"} را هم بشمار.`,
      );
    case "hiddenTwice":
      return bad("بعضی یال‌های پشت را دو بار شمردی؛ هر یال فقط یک بار شمرده می‌شود. یال‌ها را دسته‌دسته بشمار.");
    case "noBases":
      return bad("وجه‌های کناری را شمردی، ولی دو قاعده (بالا و پایین) را جا انداختی.");
    case "oneBase":
      return near("یکی از قاعده‌ها را جا انداختی؛ منشور دو قاعده دارد: بالا و پایین.");
    case "noBase":
      return near("قاعده هرم را، که وجه زیرین است، جا انداختی.");
    case "noVertical":
      return bad("یال‌های بالا و پایین را شمردی، ولی یال‌های کناری را نه.");
    case "baseSides":
      return bad(
        q.kind === "combine"
          ? "تعداد ضلع‌های قاعده را جای تعداد یال‌ها گذاشتی؛ منشور ۳ برابر و هرم ۲ برابر ضلع‌های قاعده یال دارد."
          : "فقط ضلع‌های قاعده را شمردی؛ یال‌های دیگر هم هست.",
      );
    case "baseOnly":
      return bad("فقط رأس‌های یک قاعده را شمردی؛ قاعده بالا هم همین تعداد رأس دارد.");
    case "noApex":
      return near("سر هرم را جا انداختی؛ آن هم یک رأس است.");
    case "asFaces":
    case "asEdges":
    case "asVertices": {
      const other = ({ asFaces: "faces", asEdges: "edges", asVertices: "vertices" } as const)[tag];
      return bad(`این تعداد ${PART_PLURAL[other]} است، نه ${p}. ${PART_NAME[q.part]} یعنی ${PART_MEANING[q.part]}.`);
    }
    case "added":
      return bad("دو عدد را جمع کردی؛ پرسیده «چند تا بیشتر»، پس باید کم کنی.");
    case "wrongFamily":
      return bad("قاعده منشور و هرم را جابه‌جا به کار بردی: منشور دو قاعده دارد، هرم یک قاعده و یک سر.");
    case "justN":
      return near(`${fa(n)} تعداد ضلع‌های قاعده است، نه تعداد ${p}؛ یک قدم دیگر مانده.`);
    case "nIsGiven":
      return q.kind === "reverse"
        ? bad(`${fa(q.givenValue)} را تعداد ضلع‌های قاعده گرفتی، ولی ${fa(q.givenValue)} تعداد ${PART_PLURAL[q.given]} است. اول ضلع‌های قاعده را پیدا کن.`)
        : bad("");
    case "wrongDivide":
      return bad(
        q.kind === "reverse" && q.solid.family === "prism"
          ? "یال‌ها را بر ۲ تقسیم کردی، مثل هرم؛ در منشور یال‌ها ۳ برابر ضلع‌های قاعده‌اند."
          : "یال‌ها را بر ۳ تقسیم کردی، مثل منشور؛ در هرم یال‌ها ۲ برابر ضلع‌های قاعده‌اند.",
      );
    case "euler0":
      return bad("رابطه را برابر صفر گرفتی؛ رأس − یال + وجه برابر ۲ است، نه صفر.");
    case "eulerSign":
      return bad("علامت ۲ را برعکس گرفتی؛ رأس − یال + وجه = ۲ است، نه ۲−.");
    default:
      return bad("نه.");
  }
}

// Tool 20 in words: the conditions, prompts, answers and feedback. Left and
// right are always the sitter's own (everyone faces the table); a queue faces
// the counter; floors count from the bottom.

import {
  ezafe,
  isLinear,
  layoutOf,
  relation,
  treeOf,
  type Arrangement,
  type Ask,
  type Cond,
  type Fact,
  type FamilyQuestion,
  type RankAttr,
  type SeatingQuestion,
  type SeatingType,
  type SeatQuestion,
  type SeatTag,
} from "@/generators/seating";
import { fa } from "@/tools/registry";

/** Keeps a formula left to right inside a Persian sentence, on one line (no-break spaces). */
export const ltr = (s: string) => `⁦${s.replace(/ /g, " ")}⁩`;

export const SEATING_TYPE_LABEL: Record<SeatingType, string> = {
  queue: "صف",
  rank: "رتبه‌بندی",
  floors: "طبقه‌ها",
  round: "میز گرد",
  rect: "میز مستطیل",
  family: "شجره‌نامه",
};

const ORD = ["اول", "دوم", "سوم", "چهارم", "پنجم", "ششم", "هفتم"];
export const ordinal = (i: number) => ORD[i] ?? fa(i + 1);

/** Ranking words for height, age and score. */
const RANK: Record<RankAttr, { noun: string; more: (a: string, b: string) => string; most: string; least: string; top: string; less: string }> = {
  height: { noun: "قد", more: (a, b) => `${a} از ${b} بلندتر است`, most: "بلندقدترین", least: "کوتاه‌قدترین", top: "بلندتر", less: "کوتاه‌تر" },
  age: { noun: "سن", more: (a, b) => `${a} از ${b} بزرگ‌تر است`, most: "بزرگ‌ترین", least: "کوچک‌ترین", top: "بزرگ‌تر", less: "کوچک‌تر" },
  score: { noun: "نمره", more: (a, b) => `نمره‌ی ${a} از ${b} بیشتر است`, most: "بیشترین نمره", least: "کمترین نمره", top: "بیشتر", less: "کمتر" },
};
export const rankWords = (attr: RankAttr) => RANK[attr];

/** Name of place p for a person: "نفر سوم", "طبقه‌ی ۵", "رتبه‌ی ۲". */
export function placeName(q: Arrangement, p: number): string {
  if (q.kind === "floors") return `طبقه‌ی ${fa(q.n - p)}`;
  if (q.kind === "rank") return p === 0 ? RANK[q.attr].most : p === q.n - 1 ? RANK[q.attr].least : `${ordinal(p)}`;
  return p === q.n - 1 ? "آخر" : ordinal(p);
}

export function condText(q: Arrangement, c: Cond): string {
  const N = (i: number) => q.names[i];
  const a = N(c.a);
  const b = "b" in c ? N(c.b) : "";
  const r = RANK[q.attr];
  switch (q.kind) {
    case "queue":
      switch (c.k) {
        case "at":
          return c.p === 0 ? `${a} نفر اول صف است.` : c.p === q.n - 1 ? `${a} نفر آخر صف است.` : `${a} نفر ${ordinal(c.p)} صف است.`;
        case "notEnd":
          return `${a} نه نفر اول صف است نه نفر آخر.`;
        case "justAhead":
          return `${a} درست جلوی ${b} ایستاده است.`;
        case "ahead":
          return `${a} جایی جلوتر از ${b} است (نه لزوماً درست جلویش).`;
        case "adjacent":
          return `${a} و ${b} پشت سر هم ایستاده‌اند (کدام جلوتر، معلوم نیست).`;
        case "notAdjacent":
          return `${a} و ${b} پشت سر هم نیستند.`;
        case "apart":
          return `بین ${a} و ${b} دقیقاً ${fa(c.d - 1)} نفر ایستاده‌اند.`;
        case "between":
          return `${a} جایی بین ${b} و ${N(c.c)} ایستاده است.`;
      }
      break;
    case "rank":
      switch (c.k) {
        case "at":
          if (c.p === 0) return q.attr === "score" ? `نمره‌ی ${a} از همه بیشتر است.` : `${a} از همه ${r.top} است.`;
          if (c.p === q.n - 1) return q.attr === "score" ? `نمره‌ی ${a} از همه کمتر است.` : `${a} از همه ${r.less} است.`;
          return q.attr === "score" ? `نمره‌ی دقیقاً ${fa(c.p)} نفر از ${a} بیشتر است.` : `دقیقاً ${fa(c.p)} نفر از ${a} ${r.top}‌اند.`;
        case "notEnd":
          return q.attr === "score" ? `نمره‌ی ${a} نه از همه بیشتر است نه از همه کمتر.` : `${a} نه از همه ${r.top} است نه از همه ${r.less}.`;
        case "justAhead":
          return `${r.more(a, b)} و ${r.noun} هیچ‌کس بین ${r.noun} این دو نفر نیست.`;
        case "ahead":
          return `${r.more(a, b)}.`;
        case "apart":
          return `اگر به ترتیب ${r.noun} بایستند، دقیقاً ${fa(c.d - 1)} نفر بین ${a} و ${b} است.`;
        case "between":
          return q.attr === "score"
            ? `نمره‌ی ${a} از نمره‌ی یکی از ${b} و ${N(c.c)} بیشتر و از دیگری کمتر است.`
            : `${a} از یکی از ${b} و ${N(c.c)} ${r.top} و از دیگری ${r.less} است.`;
      }
      break;
    case "floors":
      switch (c.k) {
        case "at":
          return c.p === 0 ? `${a} در بالاترین طبقه زندگی می‌کند.` : c.p === q.n - 1 ? `${a} در طبقه‌ی ۱ (پایین‌ترین) زندگی می‌کند.` : `${a} در طبقه‌ی ${fa(q.n - c.p)} زندگی می‌کند.`;
        case "notEnd":
          return `${a} نه در بالاترین طبقه است نه در پایین‌ترین.`;
        case "justAhead":
          return `${a} درست یک طبقه بالاتر از ${b} زندگی می‌کند.`;
        case "ahead":
          return `${a} در طبقه‌ای بالاتر از ${b} زندگی می‌کند (نه لزوماً درست بالایش).`;
        case "adjacent":
          return `${a} و ${b} در دو طبقه‌ی پشت سر هم زندگی می‌کنند.`;
        case "notAdjacent":
          return `طبقه‌های ${a} و ${b} پشت سر هم نیستند.`;
        case "apart":
          return `طبقه‌ی ${a} و طبقه‌ی ${b} ${fa(c.d)} طبقه با هم فاصله دارند.`;
        case "between":
          return `طبقه‌ی ${a} جایی بین طبقه‌های ${b} و ${N(c.c)} است.`;
      }
      break;
    default:
      switch (c.k) {
        case "right":
          return `${a} درست سمت راست ${b} نشسته است.`;
        case "left":
          return `${a} درست سمت چپ ${b} نشسته است.`;
        case "right2":
          return `${a} دو صندلی آن‌طرف‌تر، سمت راست ${b} نشسته است (یک نفر بینشان است).`;
        case "adjacent":
          return `${a} کنار ${b} نشسته است (چپ یا راست، معلوم نیست).`;
        case "notAdjacent":
          return `${a} کنار ${b} نیست.`;
        case "opposite":
          return `${a} روبروی ${b} نشسته است.`;
        case "between":
          return `${a} بین ${b} و ${N(c.c)} نشسته است.`;
        case "side":
          return `${a} سمت ${c.s === 0 ? "پنجره" : "در"} نشسته است.`;
        case "head":
          return `${a} سر میز نشسته است.`;
      }
  }
  return "";
}

/** How the arrangement is set out, with left and right made explicit. */
export function setting(q: Arrangement): string {
  const n = fa(q.n);
  const r = RANK[q.attr];
  switch (q.kind) {
    case "queue":
      return `${n} نفر در صف نانوایی ایستاده‌اند و همه رو به باجه‌اند. نفر اول صف کنار باجه است؛ «جلوی کسی» یعنی یک جا نزدیک‌تر به باجه.`;
    case "rank":
      return q.attr === "score"
        ? `${n} دانش‌آموز نمره‌ی آزمون گرفتند و نمره‌ی هیچ دو نفری یکی نیست.`
        : `${r.noun} ${n} دوست را مقایسه کردیم؛ ${r.noun} هیچ دو نفری یکی نیست.`;
    case "floors":
      return `${n} نفر در یک ساختمان ${n} طبقه زندگی می‌کنند، هر نفر در یک طبقه. طبقه‌ها از پایین شمرده می‌شوند: طبقه‌ی ۱ پایین‌ترین است.`;
    case "round":
      return `${n} نفر دور یک میز گرد نشسته‌اند و همه رو به وسط میزند. «سمت راستِ ${q.names[q.fixed ?? 0]}» یعنی سمت دست راست خودِ او. جای ${q.names[q.fixed ?? 0]} را ما گذاشته‌ایم؛ اگر همه با هم دور میز بچرخند، چیدمان فرقی نمی‌کند.`;
    case "rect":
      return q.n === 4
        ? `${n} نفر دور یک میز مستطیل نشسته‌اند: دو نفر سمت پنجره و دو نفر سمت در، روبروی هم. همه رو به میزند؛ «سمت راستِ کسی» یعنی سمت دست راست خودِ او.`
        : `${n} نفر دور یک میز مستطیل نشسته‌اند: دو نفر سمت پنجره، دو نفر سمت در و یک نفر سر هر طرف میز. همه رو به میزند؛ «سمت راستِ کسی» یعنی سمت دست راست خودِ او.`;
  }
}

const placeVerb = (q: Arrangement) =>
  q.kind === "queue"
    ? "صف را بچین."
    : q.kind === "rank"
      ? `آن‌ها را از ${RANK[q.attr].most} تا ${RANK[q.attr].least} بچین.`
      : q.kind === "floors"
        ? "هر کس را در طبقه‌اش بگذار."
        : "هر کس را روی صندلی‌اش بنشان.";

export function askText(q: Arrangement, ask: Ask): string {
  const r = RANK[q.attr];
  if (ask.rel === "at") {
    const p = ask.p;
    if (q.kind === "queue") return p === 0 ? "نفر اول صف کیست؟" : p === q.n - 1 ? "نفر آخر صف کیست؟" : `نفر ${ordinal(p)} صف کیست؟`;
    if (q.kind === "floors") return `چه کسی در طبقه‌ی ${fa(q.n - p)} زندگی می‌کند؟`;
    if (p === 0) return q.attr === "score" ? "نمره‌ی چه کسی از همه بیشتر است؟" : `چه کسی از همه ${r.top} است؟`;
    if (p === q.n - 1) return q.attr === "score" ? "نمره‌ی چه کسی از همه کمتر است؟" : `چه کسی از همه ${r.less} است؟`;
    return `اگر به ترتیب ${r.noun} بایستند (از ${r.most})، نفر ${ordinal(p)} کیست؟`;
  }
  const x = q.names[ask.of];
  switch (ask.rel) {
    case "prev":
      return q.kind === "floors" ? `چه کسی درست یک طبقه بالاتر از ${x} زندگی می‌کند؟` : `چه کسی درست جلوی ${x} ایستاده است؟`;
    case "next":
      return q.kind === "floors" ? `چه کسی درست یک طبقه پایین‌تر از ${x} زندگی می‌کند؟` : `چه کسی درست پشت سر ${x} ایستاده است؟`;
    case "right":
      return `چه کسی درست سمت راست ${x} نشسته است؟`;
    case "left":
      return `چه کسی درست سمت چپ ${x} نشسته است؟`;
    case "opposite":
      return `چه کسی روبروی ${x} نشسته است؟`;
  }
}

// ─── Family ────────────────────────────────────────────────────────────────

export function factText(q: FamilyQuestion, f: Fact): string {
  const A = q.people[f.a];
  const B = q.people[f.b];
  switch (f.k) {
    case "spouse":
      return `${A.name} و ${B.name} زن و شوهرند.`;
    case "parent":
      return `${A.name} ${ezafe(A.male ? "پدر" : "مادر")} ${B.name} است.`;
    case "child":
      return `${A.name} ${A.male ? "پسر" : "دختر"} ${B.name} است.`;
    case "sibling":
      return `${A.name} ${A.male ? "برادر" : "خواهر"} ${B.name} است.`;
  }
}

export function familyAskText(q: FamilyQuestion): string {
  const P = q.people;
  return q.ask.k === "rel" ? `${P[q.ask.x].name} چه نسبتی با ${P[q.ask.y].name} دارد؟` : `${ezafe(q.ask.word)} ${P[q.ask.y].name} کیست؟`;
}

/** The chain of relations that answers a family question. */
export function familyHow(q: FamilyQuestion): string {
  const t = treeOf(q.people);
  const x = q.ask.k === "rel" ? q.ask.x : q.options[q.answer].person;
  const y = q.ask.y;
  const r = relation(t, x, y)!;
  const N = (i: number) => q.people[i].name;
  const pw = (i: number) => (q.people[i].male ? "پدر" : "مادر");
  const cw = (i: number) => (q.people[i].male ? "پسر" : "دختر");
  const sw = (i: number) => (q.people[i].male ? "برادر" : "خواهر");
  const parents = (i: number) => [t.father[i], t.mother[i]].filter((p) => p >= 0).map(N).join(" و ");
  const end = `پس ${N(x)} ${ezafe(r.word)} ${N(y)} است.`;
  const p = r.path;
  switch (p.k) {
    case "spouse":
      return `${N(x)} و ${N(y)} زن و شوهرند.`;
    case "parent":
      return `پدر و مادر ${N(y)}: ${parents(y)}. ${end}`;
    case "child":
    case "sibling":
      return `پدر و مادر ${N(x)}: ${parents(x)}${p.k === "sibling" ? `؛ ${N(y)} هم فرزند همین دو نفر است` : ""}. ${end}`;
    case "grandparent":
      return `${N(x)} ${ezafe(pw(x))} ${N(p.via)} است و ${N(p.via)} ${ezafe(pw(p.via))} ${N(y)}. ${end}`;
    case "grandchild":
      return `${N(p.via)} ${cw(p.via)} ${N(y)} است و ${N(x)} فرزند ${N(p.via)}. ${end}`;
    case "parentSibling":
      return `${N(p.via)} ${ezafe(pw(p.via))} ${N(y)} است و ${N(x)} ${sw(x)} ${N(p.via)}. ${end}`;
    case "auntUncleSpouse": {
      const s = relation(t, p.via2, y)!.word;
      return `${N(p.via2)} ${ezafe(s)} ${N(y)} است و ${N(x)} همسر ${N(p.via2)}. ${end}`;
    }
    case "siblingChild":
      return `${N(p.via)} ${sw(p.via)} ${N(y)} است و ${N(x)} فرزند ${N(p.via)}. ${end}`;
    case "cousin": {
      const s = relation(t, p.via, y)!.word;
      return `${N(p.via)} (${ezafe(pw(p.via))} ${N(x)}) ${ezafe(s)} ${N(y)} است. ${end}`;
    }
    case "inLaw":
      return `${N(x)} همسر ${N(p.via)} است و ${N(p.via)} ${cw(p.via)} ${N(y)}. ${end}`;
  }
}

// ─── Prompts and answers ───────────────────────────────────────────────────

export function seatingPrompt(q: SeatingQuestion, paper = false): string {
  if (q.type === "family")
    return `این جمله‌ها درباره‌ی یک خانواده است (از اسم‌ها معلوم است چه کسی مرد و چه کسی زن است). ${familyAskText(q)}`;
  if (q.variant === "ask") return `${setting(q)} ${askText(q, q.ask!)}`;
  return `${setting(q)} ${paper ? placeVerb(q).replace("بچین", "بنویس").replace("بگذار", "بنویس").replace("بنشان", "بنویس") : placeVerb(q)}`;
}

/** The whole arrangement in words. */
export function arrangementText(q: Arrangement, seatOf = q.solution): string {
  const at = (s: number) => q.names[seatOf.indexOf(s)] ?? "؟";
  const seq = (seats: number[]) => seats.map(at).join("، ");
  const all = Array.from({ length: q.n }, (_, i) => i);
  switch (q.kind) {
    case "queue":
      return `از جلوی صف: ${seq(all)}`;
    case "rank":
      return `از ${RANK[q.attr].most}: ${seq(all)}`;
    case "floors":
      return all.map((s) => `طبقه‌ی ${fa(q.n - s)}: ${at(s)}`).join("، ");
    case "round":
      return `از ${at(0)}، هر بار نفر سمت چپ: ${seq(all)}`;
    case "rect": {
      const lay = layoutOf("rect", q.n);
      const side = (v: number) => all.filter((s) => lay.side[s] === v);
      // Door side is numbered right to left; read both sides as drawn, left to right.
      const ends = side(2);
      return `سمت پنجره: ${seq(side(0))} · سمت در: ${seq(side(1).reverse())}${ends.length ? ` · سر چپ میز: ${at(5)}، سر راست: ${at(2)}` : ""} (چپ و راست از دید تصویر)`;
    }
  }
}

export function answerText(q: SeatingQuestion): string {
  if (q.type === "family") return q.options[q.answer].text;
  if (q.variant === "ask") return q.names[q.answer];
  return arrangementText(q);
}

// ─── Feedback ──────────────────────────────────────────────────────────────

export type Tone = "good" | "turned" | "bad";
export const ICON: Record<Tone, string> = { good: "✓", turned: "↻", bad: "✗" };

function flippedText(q: Arrangement): string {
  switch (q.kind) {
    case "queue":
      return "صف را برعکس خواندی: نفر اول صف کنار باجه است.";
    case "rank":
      return `ترتیب برعکس شد: از ${RANK[q.attr].most} شروع کن.`;
    case "floors":
      return "ساختمان را وارونه خواندی: طبقه‌ی ۱ پایین‌ترین است.";
    default:
      return "چپ و راست برعکس شد. هر کس رو به میز نشسته؛ «راستِ سارا» یعنی سمت دست راست خودِ سارا، نه سمت راستِ ما که از بالا نگاه می‌کنیم.";
  }
}

const SIDE_TEXT =
  "«درست سمت راستِ کسی» یعنی کنار او و طرف دست راست خودش؛ «کنار» هر دو طرف را قبول می‌کند ولی «سمت راست» فقط یک طرف را. هر کس رو به میز است، پس راستِ کسی که بالای میز نشسته، در تصویر طرف چپ ماست.";

function oppositeText(q: Arrangement) {
  return q.kind === "round"
    ? `روبرو را یک صندلی اشتباه شمردی: در میز ${fa(q.n)} نفره، روبروی هر کس ${fa(q.n / 2)} صندلی آن‌طرف‌تر است.`
    : "روبرو را یک صندلی اشتباه شمردی: روبروی هر کس، آن طرف میز درست مقابل اوست.";
}

/** Feedback on a whole arrangement; `bad` are the conditions it breaks. */
export function placeFeedback(q: SeatQuestion, tag: SeatTag, bad: number[]): { tone: Tone; text: string } {
  const list = bad.length ? ` ${fa(bad.length)} شرط برقرار نیست (✗ روی کارت‌ها).` : "";
  const ans = ` جواب: ${arrangementText(q)}.`;
  switch (tag) {
    case "right":
      return { tone: "good", text: "درست است! همه‌ی شرط‌ها برقرارند و فقط همین یک چیدمان جواب است." };
    case "flipped":
      return { tone: "turned", text: `نزدیک بود! ${flippedText(q)}${list}${ans}` };
    case "sideFlip":
      return { tone: "turned", text: `نزدیک بود! ${SIDE_TEXT}${list}${ans}` };
    case "opposite":
      return { tone: "turned", text: `نزدیک بود! ${oppositeText(q)}${list}${ans}` };
    case "apartCount":
      return {
        tone: "turned",
        text:
          q.kind === "floors"
            ? `نزدیک بود! «${fa(2)} طبقه فاصله» یعنی شماره‌ی طبقه‌ها ${fa(2)} تا با هم فرق دارد، نه اینکه ${fa(2)} طبقه بینشان باشد.${list}${ans}`
            : `نزدیک بود! «بین آن‌ها ${fa(2)} نفر» یعنی ${fa(2)} نفر وسطشان است؛ پس جاهایشان ${fa(3)} تا با هم فاصله دارد.${list}${ans}`,
      };
    case "frontBack":
      return {
        tone: "turned",
        text: `نزدیک بود! ${q.kind === "queue" ? "«درست جلوی کسی» یعنی یک جا نزدیک‌تر به باجه." : q.kind === "floors" ? "«یک طبقه بالاتر» یعنی شماره‌ی طبقه یکی بیشتر." : `جای ${RANK[q.attr].top} و ${RANK[q.attr].less} جابه‌جا شد.`}${list}${ans}`,
      };
    default:
      return { tone: "bad", text: `هنوز نه.${list} کارت‌های ✗ را دوباره بخوان.${ans}` };
  }
}

export function askFeedback(q: SeatQuestion, tag: SeatTag, chosen: number): { tone: Tone; text: string } {
  const ans = `جواب: ${q.names[q.answer]}.`;
  const ask = q.ask!;
  switch (tag) {
    case "right":
      return { tone: "good", text: `درست است! ${ans} در هر چیدمانی که همه‌ی شرط‌ها را دارد، همین نفر آنجاست.` };
    case "flipped":
      if (ask.rel === "at") return { tone: "turned", text: `نزدیک بود! از آن سر شمردی. ${flippedText(q)} ${ans}` };
      if (ask.rel === "prev" || ask.rel === "next")
        return { tone: "turned", text: `نزدیک بود! ${q.names[chosen]} ${q.kind === "floors" ? (ask.rel === "prev" ? "پایین" : "بالای") : ask.rel === "prev" ? "پشت سر" : "جلوی"} ${q.names[ask.of]} است، طرف دیگر. ${ans}` };
      return { tone: "turned", text: `نزدیک بود! ${q.names[chosen]} سمت ${ask.rel === "right" ? "چپ" : "راست"} ${q.names[ask.of]} است. ${SIDE_TEXT} ${ans}` };
    case "offByOne":
      return { tone: "turned", text: `نزدیک بود! یک جا اشتباه شمردی؛ «درست» یعنی همان جای کناری. ${ans}` };
    case "opposite":
      return { tone: "turned", text: `نزدیک بود! ${oppositeText(q)} ${ans}` };
    default:
      return { tone: "bad", text: `هنوز نه. ${ans}` };
  }
}

export function familyFeedback(q: FamilyQuestion, choice: number): { tone: Tone; text: string } {
  const how = familyHow(q);
  const o = q.options[choice];
  switch (o.tag) {
    case "right":
      return { tone: "good", text: `درست است! ${how}` };
    case "side":
      return { tone: "turned", text: `نزدیک بود! عمو و عمه از طرف پدرند؛ دایی و خاله از طرف مادر. ${how}` };
    case "gender":
      return { tone: "turned", text: `نزدیک بود! ${o.person >= 0 ? `${o.text} ${q.people[o.person].male ? "مرد" : "زن"} است` : "مرد و زن جابه‌جا شد"}؛ از اسم‌ها معلوم است. ${how}` };
    case "generation":
      return { tone: "turned", text: `نزدیک بود! یک نسل جابه‌جا شد. ${how}` };
    case "inverse":
      return {
        tone: "turned",
        text: `نزدیک بود! برعکس خواندی: «الف چه نسبتی با ب دارد؟» یعنی الف برای ب چه کسی است. ${how}`,
      };
    default:
      return { tone: "bad", text: `هنوز نه. ${how}` };
  }
}

/** Number of arrangements, e.g. "۷ × ۶ × … × ۱ = ۵۰۴۰". */
export function factorialText(m: number): string {
  const parts = Array.from({ length: m }, (_, i) => fa(m - i));
  let v = 1;
  for (let i = 2; i <= m; i++) v *= i;
  return ltr(`${parts.join(" × ")} = ${fa(v)}`);
}

export const isTable = (q: Arrangement) => !isLinear(q.kind);

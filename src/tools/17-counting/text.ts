// Words for tool 17: question text, case labels, the working in one line,
// and the show-me steps. Equations sit inside ltr() so they read left to
// right and never break across lines.

import {
  ballColour,
  cases,
  comb,
  COLOURS,
  fact,
  FRUITS,
  gridValues,
  PEOPLE,
  perm,
  routes,
  worstCase,
  type ArrangeQuestion,
  type Case,
  type CountingQuestion,
  type CountingQuestionType,
  type Frac,
  type PigeonholeQuestion,
  type ProbabilityQuestion,
  type TreeQuestion,
} from "@/generators/counting";
import { fa } from "@/tools/registry";

/** Keeps an equation left to right inside a Persian sentence, on one line. */
export const ltr = (s: string) => `⁦${s.replace(/ /g, " ")}⁩`;

export const COUNTING_TYPE_LABEL: Record<CountingQuestionType, string> = {
  tree: "درخت حالت‌ها",
  arrange: "چیدن در ردیف",
  choose: "انتخاب گروه",
  handshake: "دست‌دادن",
  grid: "مسیر در شبکه",
  pigeonhole: "لانه کبوتری",
  probability: "احتمال",
};

/** Groups for the tree questions: what to wear, what to order. */
export const TREE_GROUPS: Record<"outfit" | "menu", { name: string; options: string[] }[]> = {
  outfit: [
    { name: "پیراهن", options: ["سفید", "آبی", "قرمز", "زرد"] },
    { name: "شلوار", options: ["مشکی", "کرم", "طوسی", "سرمه‌ای"] },
    { name: "کفش", options: ["کتانی", "صندل", "چکمه", "کالج"] },
  ],
  menu: [
    { name: "غذا", options: ["کباب", "پلو", "آش", "کوکو"] },
    { name: "نوشیدنی", options: ["دوغ", "آب", "شربت", "چای"] },
    { name: "دسر", options: ["ژله", "بستنی", "کیک", "میوه"] },
  ],
};

const and = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join("، ")} و ${xs[xs.length - 1]}`);
const q2 = (s: string) => `«${s}»`;

/** Persian word for a count of things, e.g. ۳ پیراهن. */
const groupList = (q: TreeQuestion) => {
  const g = TREE_GROUPS[q.ctx === "menu" ? "menu" : "outfit"];
  return q.sizes.map((s, i) => `${fa(s)} ${g[i].name} (${g[i].options.slice(0, s).join("، ")})`);
};

export const itemName = (q: CountingQuestion, i: number): string => {
  if (q.type === "arrange") return q.ctx === "digits" ? fa(q.items[i]) : PEOPLE[q.items[i]];
  if (q.type === "choose") return q.ctx === "fruit" ? FRUITS[q.items[i]] : PEOPLE[q.items[i]];
  return "";
};

/** First letter, for small tokens. */
export const initial = (name: string) => name.charAt(0);

export const COIN = ["شیر", "خط"];

/** Number of places: «دورقمی» etc. */
const digitsWord = (k: number) => (k === 2 ? "دورقمی" : k === 3 ? "سه‌رقمی" : "چهاررقمی");
const ordinals = ["اول", "دوم", "سوم", "چهارم"];

function probEventText(q: ProbabilityQuestion): string {
  const e = q.event;
  switch (e.kind) {
    case "even":
      return "عدد زوج بیاید";
    case "odd":
      return "عدد فرد بیاید";
    case "mult3":
      return "مضربی از ۳ بیاید";
    case "more":
      return `عددی بزرگ‌تر از ${fa(e.t)} بیاید`;
    case "colour":
      return `مهره ${COLOURS[q.colours[e.c]]} باشد`;
    case "twoHeads":
      return "هر دو «شیر» بیایند";
    case "mixed":
      return "یکی «شیر» و یکی «خط» بیاید";
    case "atLeastOne":
      return "دست‌کم یکی «شیر» بیاید";
    case "exactly1":
      return "دقیقاً یکی «شیر» بیاید";
    case "exactly2":
      return "دقیقاً دوتا «شیر» بیایند";
    case "allSame":
      return "هر سه یکسان بیایند";
    case "headsEven":
      return "سکه «شیر» و تاس زوج بیاید";
    case "headsMore":
      return `سکه «شیر» و تاس بزرگ‌تر از ${fa(e.t)} بیاید`;
    case "sum":
      return `جمع دو عدد ${fa(e.t)} شود`;
    case "doubles":
      return "دو عدد یکسان بیایند";
    case "sumAtLeast":
      return `جمع دو عدد ${fa(e.t)} یا بیشتر شود`;
  }
}

const bagList = (colours: number[], counts: number[], thing: string) => and(counts.map((c, i) => `${fa(c)} ${thing} ${COLOURS[colours[i]]}`));

function pigeonGoal(q: PigeonholeQuestion, thing: string): string {
  switch (q.variant) {
    case "same":
      return q.k === 2 ? `دو ${thing} هم‌رنگ داریم` : `${fa(q.k)} ${thing} هم‌رنگ داریم`;
    case "one":
      return `دست‌کم یک ${thing} ${COLOURS[q.colours[q.target]]} داریم`;
    case "all":
      return "از هر رنگ دست‌کم یکی داریم";
    case "different":
      return `دو ${thing} با رنگ‌های متفاوت داریم`;
  }
}

export function countingPrompt(q: CountingQuestion, paper = false): string {
  switch (q.type) {
    case "tree": {
      if (q.variant === "either") return `برای رفتن به اردو، علی می‌تواند با یکی از ${fa(q.sizes[0])} اتوبوس برود یا با یکی از ${fa(q.sizes[1])} قطار. به چند راه می‌تواند برود؟`;
      if (q.variant === "roads")
        return `از شهر «الف» به «ب» ${fa(q.sizes[0])} جاده هست و از «ب» به «پ» ${fa(q.sizes[1])} جاده. از «الف» مستقیم به «پ» هم ${fa(q.sizes[2])} جاده هست. از «الف» به «پ» چند راه هست؟`;
      const g = TREE_GROUPS[q.ctx === "menu" ? "menu" : "outfit"];
      const list = and(groupList(q));
      const forbid = q.forbid ? ` ولی ${g[0].name} ${q2(g[0].options[q.forbid[0]])} را با ${g[1].name} ${q2(g[1].options[q.forbid[1]])} ${q.ctx === "menu" ? "سفارش نمی‌دهد" : "نمی‌پوشد"}.` : "";
      const each = and(q.sizes.map((_, i) => `یک ${g[i].name}`));
      return q.ctx === "menu"
        ? `منوی رستوران ${list} دارد. مینا ${each} سفارش می‌دهد.${forbid} به چند حالت می‌تواند سفارش بدهد؟`
        : `سارا ${list} دارد و ${each} می‌پوشد.${forbid} به چند حالت می‌تواند لباس بپوشد؟`;
    }
    case "arrange": {
      if (q.ctx === "digits") {
        const ds = q.items.map(fa).join("، ");
        const kind = q.cond === "even" ? `زوجِ ${digitsWord(q.k)}` : digitsWord(q.k);
        const zero = q.cond === "noLeadingZero" ? " (یادت باشد عدد با صفر شروع نمی‌شود.)" : "";
        return `با رقم‌های ${ds} چند عدد ${kind} بدون رقم تکراری می‌شود ساخت؟${zero}`;
      }
      const names = and(q.items.map((p) => PEOPLE[p]));
      const A = PEOPLE[q.items[0]];
      const B = PEOPLE[q.items[1]];
      if (q.k < q.n) return `${names} مسابقه دو می‌دهند. به چند حالت ممکن است نفر ${and(ordinals.slice(0, q.k))} مشخص شوند؟`;
      const cond =
        q.cond === "together" ? ` ${A} و ${B} می‌خواهند کنار هم باشند.` : q.cond === "notAdjacent" ? ` ${A} و ${B} نباید کنار هم باشند.` : q.cond === "atEnd" ? ` ${A} باید یکی از دو سرِ ردیف باشد.` : "";
      return `${names} می‌خواهند برای عکس در یک ردیف بایستند.${cond} به چند حالت می‌توانند بایستند؟`;
    }
    case "choose": {
      const A = itemName(q, 0);
      const B = itemName(q, 1);
      const names = and(q.items.map((_, i) => itemName(q, i)));
      if (q.ctx === "fruit") {
        const cond = q.cond === "must" ? ` ${A} حتماً باید در سبد باشد.` : q.cond === "notBoth" ? ` ${A} و ${B} با هم در سبد نباشند.` : "";
        return `از ${fa(q.n)} میوه (${names}) می‌خواهیم ${fa(q.k)} میوه در سبد بگذاریم.${cond} به چند حالت؟ (ترتیب مهم نیست.)`;
      }
      const cond = q.cond === "must" ? ` ${A} حتماً در گروه است.` : q.cond === "notBoth" ? ` ${A} و ${B} با هم در یک گروه نمی‌روند.` : "";
      return `از ${names} باید یک گروه ${fa(q.k)} نفره انتخاب شود.${cond} چند گروه مختلف ممکن است؟`;
    }
    case "handshake":
      if (q.variant === "twins") return `${fa(q.n / 2)} جفت دوقلو به مهمانی آمدند (${fa(q.n)} نفر). هر کس با همه دست داد، جز با دوقلوی خودش. روی هم چند دست‌دادن شد؟`;
      if (q.variant === "inverse")
        return q.ctx === "teams"
          ? `در یک مسابقه هر دو تیم یک بار با هم بازی کردند و روی هم ${fa(q.shakes)} بازی شد. چند تیم بودند؟`
          : `در یک مهمانی هر دو نفر یک بار با هم دست دادند و روی هم ${fa(q.shakes)} دست‌دادن شد. چند نفر بودند؟`;
      return q.ctx === "teams"
        ? `در یک مسابقه ${fa(q.n)} تیم هستند و هر دو تیم یک بار با هم بازی می‌کنند. روی هم چند بازی انجام می‌شود؟`
        : `${fa(q.n)} نفر به هم رسیدند و هر دو نفر یک بار با هم دست دادند. روی هم چند دست‌دادن شد؟`;
    case "grid": {
      const cond = q.cond === "block" ? " از گره ✗ نمی‌شود گذشت." : q.cond === "through" ? " باید از گره ★ گذشت." : "";
      return `در این شبکه ${fa(q.a)} در ${fa(q.b)}، از «الف» تا «ب» روی خط‌ها فقط به راست یا بالا می‌رویم.${cond} چند راه هست؟${paper ? "" : ""}`;
    }
    case "pigeonhole": {
      const thing = q.ctx === "socks" ? "جوراب" : "مهره";
      const place = q.ctx === "socks" ? "در کشو" : "در کیسه";
      return `${place} ${bagList(q.colours, q.counts, thing)} هست. چشم‌بسته یکی‌یکی برمی‌داریم. دست‌کم چند ${thing} برداریم تا مطمئن باشیم ${pigeonGoal(q, thing)}؟`;
    }
    case "probability": {
      const start =
        q.variant === "die"
          ? "یک تاس می‌اندازیم."
          : q.variant === "bag"
            ? `در کیسه ${bagList(q.colours, q.counts, "مهره")} هست. چشم‌بسته یک مهره برمی‌داریم.`
            : q.variant === "coins2"
              ? "دو سکه (یکی بزرگ، یکی کوچک) می‌اندازیم."
              : q.variant === "coins3"
                ? "سه سکه (بزرگ، متوسط، کوچک) می‌اندازیم."
                : q.variant === "coinDie"
                  ? "یک سکه و یک تاس می‌اندازیم."
                  : "دو تاس (یکی سفید، یکی سیاه) می‌اندازیم.";
      return `${start} احتمال اینکه ${probEventText(q)} چقدر است؟ جواب را کسر بنویس: تعداد حالت‌های خوب بر تعداد همه حالت‌ها.`;
    }
  }
}

// ── Cases ──

/** One step of a case, as a short word: an option, a person, a digit, a coin side… */
export function stepLabel(q: CountingQuestion, depth: number, v: number): string {
  switch (q.type) {
    case "tree": {
      if (q.variant === "either") return depth === 0 ? (v === 0 ? "اتوبوس" : "قطار") : fa(v + 1);
      if (q.variant === "roads") return depth === 0 ? (v === 0 ? "از ب" : "مستقیم") : `جاده ${fa(v + 1)}`;
      return TREE_GROUPS[q.ctx === "menu" ? "menu" : "outfit"][depth].options[v];
    }
    case "arrange":
    case "choose":
      return itemName(q, v);
    case "probability":
      if (q.variant === "die" || q.variant === "dice2") return fa(v + 1);
      if (q.variant === "bag") return `${COLOURS[q.colours[ballColour(q.counts, v)]]}`;
      if (q.variant === "coinDie") return depth === 0 ? COIN[v] : fa(v + 1);
      return COIN[v];
    case "handshake":
      return fa(v + 1);
    default:
      return "";
  }
}

/** A whole case in a few characters. */
export function caseLabel(q: CountingQuestion, c: Case): string {
  switch (q.type) {
    case "arrange":
      return q.ctx === "digits" ? ltr(c.pick.map((i) => fa(q.items[i])).join("")) : c.pick.map((i) => initial(PEOPLE[q.items[i]])).join(" ");
    case "handshake":
      return ltr(`${fa(c.pick[0] + 1)}–${fa(c.pick[1] + 1)}`);
    case "tree":
      if (q.variant === "either") return `${stepLabel(q, 0, c.pick[0])} ${fa(c.pick[1] + 1)}`;
      if (q.variant === "roads") return c.pick[0] === 0 ? `از ب: ${fa(c.pick[1] + 1)} و ${fa(c.pick[2] + 1)}` : `مستقیم ${fa(c.pick[1] + 1)}`;
      return c.pick.map((v, d) => stepLabel(q, d, v)).join("، ");
    case "probability":
      if (q.variant === "bag") return `${COLOURS[q.colours[ballColour(q.counts, c.pick[0])]]} ${fa(c.pick[0] + 1)}`;
      if (q.variant === "coins2" || q.variant === "coins3") return c.pick.map((v) => COIN[v]).join(" ");
      return c.pick.map((v, d) => stepLabel(q, d, v)).join(" ");
    default:
      return c.pick.map((v, d) => stepLabel(q, d, v)).join("، ");
  }
}

// ── The working ──

/** n × (n − 1) × … for k terms, as text. */
const fallingText = (n: number, k: number) => Array.from({ length: k }, (_, i) => fa(n - i)).join(" × ");

export const fracText = (f: Frac) => ltr(`${fa(f.n)}/${fa(f.d)}`);

export function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

function arrangeHow(q: ArrangeQuestion): string {
  const A = itemName(q, 0);
  const B = itemName(q, 1);
  switch (q.cond) {
    case "none":
      return `جای اول ${fa(q.n)} انتخاب دارد، بعدی یکی کمتر و…: ${ltr(`${fallingText(q.n, q.k)} = ${fa(q.answer)}`)}.`;
    case "together":
      return `${A} و ${B} را یک بسته بگیر: ${fa(q.n - 1)} چیز در ردیف (${ltr(`${fallingText(q.n - 1, q.n - 1)} = ${fa(fact(q.n - 1))}`)}) و درون بسته ۲ ترتیب: ${ltr(`${fa(fact(q.n - 1))} × ۲ = ${fa(q.answer)}`)}.`;
    case "notAdjacent":
      return `همه چیدمان‌ها ${fa(fact(q.n))}؛ چیدمان‌هایی که ${A} و ${B} کنار هم‌اند ${ltr(`${fa(fact(q.n - 1))} × ۲ = ${fa(2 * fact(q.n - 1))}`)}: ${ltr(`${fa(fact(q.n))} − ${fa(2 * fact(q.n - 1))} = ${fa(q.answer)}`)}.`;
    case "atEnd":
      return `${A} ۲ جا دارد (اول یا آخر)، بقیه ${ltr(`${fallingText(q.n - 1, q.n - 1)} = ${fa(fact(q.n - 1))}`)} ترتیب: ${ltr(`۲ × ${fa(fact(q.n - 1))} = ${fa(q.answer)}`)}.`;
    case "noLeadingZero":
      return `جای اول ${fa(q.n - 1)} انتخاب دارد (صفر نه)، بعد بقیه: ${ltr(`${fa(q.n - 1)} × ${fallingText(q.n - 1, q.k - 1)} = ${fa(q.answer)}`)}.`;
    case "even": {
      const e = q.items.filter((d) => d % 2 === 0).length;
      return `اول جای آخر را پر کن: ${fa(e)} رقم زوج؛ بعد بقیه جاها: ${ltr(`${fa(e)} × ${fallingText(q.n - 1, q.k - 1)} = ${fa(q.answer)}`)}.`;
    }
  }
}

function pigeonHow(q: PigeonholeQuestion): string {
  const w = worstCase(q);
  const W = w.reduce((s, x) => s + x, 0);
  const parts = w.map((x, i) => (x ? `${fa(x)} ${COLOURS[q.colours[i]]}` : "")).filter(Boolean);
  const thing = q.ctx === "socks" ? "جوراب" : "مهره";
  return `بدترین حالت: ${and(parts)} (روی هم ${fa(W)} تا) و هنوز نه. ${thing} بعدی حتماً کار را تمام می‌کند: ${ltr(`${fa(W)} + ۱ = ${fa(q.answer)}`)}.`;
}

export function countingHow(q: CountingQuestion): string {
  switch (q.type) {
    case "tree": {
      const s = q.sizes.map(fa);
      if (q.variant === "either") return `یا اتوبوس یا قطار؛ هر دو با هم نه، پس جمع می‌کنیم: ${ltr(`${s[0]} + ${s[1]} = ${fa(q.answer)}`)}.`;
      if (q.variant === "roads") return `از راه «ب»: ${ltr(`${s[0]} × ${s[1]} = ${fa(q.sizes[0] * q.sizes[1])}`)}؛ به‌اضافه راه‌های مستقیم: ${ltr(`${fa(q.sizes[0] * q.sizes[1])} + ${s[2]} = ${fa(q.answer)}`)}.`;
      const total = q.sizes.reduce((x, y) => x * y, 1);
      if (q.variant === "forbid") {
        const out = q.sizes.slice(2).reduce((x, y) => x * y, 1);
        return `همه حالت‌ها ${ltr(`${s.join(" × ")} = ${fa(total)}`)}؛ حالت‌های ممنوع ${fa(out)} تا: ${ltr(`${fa(total)} − ${fa(out)} = ${fa(q.answer)}`)}.`;
      }
      return `هر شاخه دوباره شاخه می‌شود، پس ضرب می‌کنیم: ${ltr(`${s.join(" × ")} = ${fa(q.answer)}`)}.`;
    }
    case "arrange":
      return arrangeHow(q);
    case "choose": {
      const A = itemName(q, 0);
      const B = itemName(q, 1);
      if (q.cond === "must") return `${A} در گروه است؛ فقط ${fa(q.k - 1)} تا از ${fa(q.n - 1)} تای دیگر می‌ماند: ${fa(q.answer)} حالت.`;
      if (q.cond === "notBoth")
        return `همه گروه‌ها ${fa(comb(q.n, q.k))}؛ گروه‌هایی که ${A} و ${B} هر دو را دارند ${fa(comb(q.n - 2, q.k - 2))}: ${ltr(`${fa(comb(q.n, q.k))} − ${fa(comb(q.n - 2, q.k - 2))} = ${fa(q.answer)}`)}.`;
      return `اگر ترتیب مهم بود ${ltr(`${fallingText(q.n, q.k)} = ${fa(perm(q.n, q.k))}`)}؛ ولی هر گروه ${ltr(`${fallingText(q.k, q.k)} = ${fa(fact(q.k))}`)} بار شمرده شده: ${ltr(`${fa(perm(q.n, q.k))} ÷ ${fa(fact(q.k))} = ${fa(q.answer)}`)}.`;
    }
    case "handshake": {
      if (q.variant === "twins") return `هر کس با ${fa(q.n - 2)} نفر دست می‌دهد؛ هر دست‌دادن را دو نفر شمرده‌اند: ${ltr(`${fa(q.n)} × ${fa(q.n - 2)} ÷ ۲ = ${fa(q.answer)}`)}.`;
      const n = q.variant === "inverse" ? q.answer : q.n;
      const sumText = Array.from({ length: n - 1 }, (_, i) => fa(n - 1 - i)).join(" + ");
      if (q.variant === "inverse") return `${ltr(`${sumText} = ${fa(q.shakes)}`)}؛ یعنی نفر اول با ${fa(n - 1)} نفر دست داده، پس ${fa(n)} ${q.ctx === "teams" ? "تیم" : "نفر"} بودند.`;
      return `اولی با ${fa(n - 1)} نفر، دومی با ${fa(n - 2)} نفرِ تازه، …: ${ltr(`${sumText} = ${fa(q.answer)}`)} (یا ${ltr(`${fa(n)} × ${fa(n - 1)} ÷ ۲`)}).`;
    }
    case "grid": {
      if (q.cond === "through" && q.at) {
        const r1 = routes(q.at[0], q.at[1]);
        const r2 = routes(q.a - q.at[0], q.b - q.at[1]);
        return `تا ★ ${fa(r1)} راه، از ★ تا «ب» ${fa(r2)} راه: ${ltr(`${fa(r1)} × ${fa(r2)} = ${fa(q.answer)}`)}.`;
      }
      const v = gridValues(q);
      const left = q.a > 0 ? v[q.b][q.a - 1] : 0;
      const down = q.b > 0 ? v[q.b - 1][q.a] : 0;
      return `هر گره = جمع گره چپ و گره پایینش${q.cond === "block" ? "؛ گره ✗ صفر می‌گیرد" : ""}. به «ب» که برسیم: ${ltr(`${fa(left)} + ${fa(down)} = ${fa(q.answer)}`)}.`;
    }
    case "pigeonhole":
      return pigeonHow(q);
    case "probability": {
      const { n, d } = q.answer;
      const g = gcd(n, d);
      return `همه حالت‌ها ${fa(d)}، حالت‌های خوب ${fa(n)}: احتمال ${fracText(q.answer)}${g > 1 ? ` یعنی ${fracText({ n: n / g, d: d / g })}` : ""}.`;
    }
  }
}

export function answerText(q: CountingQuestion): string {
  if (q.type === "probability") return fracText(q.answer);
  return fa(q.answer);
}

// ── Show-me steps ──

/** Leaves under each first branch of the tree of cases. */
export function firstBranches(all: Case[]): { v: number; n: number; ok: number }[] {
  const out: { v: number; n: number; ok: number }[] = [];
  for (const c of all) {
    let b = out.find((x) => x.v === c.pick[0]);
    if (!b) out.push((b = { v: c.pick[0], n: 0, ok: 0 }));
    b.n++;
    if (c.ok) b.ok++;
  }
  return out;
}

/** Whether a question is drawn as a tree in show-me (otherwise: circle, grid, drawer or dice table). */
export const isTree = (q: CountingQuestion) => q.type === "tree" || q.type === "arrange" || q.type === "choose" || (q.type === "probability" && q.variant !== "dice2");

export function showSteps(q: CountingQuestion): string[] {
  const how = countingHow(q);
  if (isTree(q)) {
    const all = cases(q);
    const cond = all.some((c) => !c.ok);
    const steps = firstBranches(all).map((b) => `شاخه ${q2(stepLabel(q, 0, b.v))}: ${fa(b.n)} حالت`);
    if (cond) steps.push(q.type === "probability" ? `حالت‌های خوب ✓ می‌خورند: ${fa(all.filter((c) => c.ok).length)} از ${fa(all.length)}` : `حالت‌هایی که شرط را ندارند ✗ می‌خورند: ${fa(all.filter((c) => !c.ok).length)} تا`);
    return [...steps, how];
  }
  switch (q.type) {
    case "handshake": {
      const n = q.variant === "inverse" ? q.answer : q.n;
      const steps: string[] = [];
      let run = 0;
      for (let i = 0; i < n - 1; i++) {
        const fresh = n - 1 - i - (q.variant === "twins" && i % 2 === 0 ? 1 : 0);
        run += fresh;
        steps.push(`${q.ctx === "teams" ? "تیم" : "نفر"} ${fa(i + 1)} با ${fa(fresh)} ${q.ctx === "teams" ? "تیمِ" : "نفرِ"} تازه: تا اینجا ${fa(run)}`);
      }
      return [...steps, how];
    }
    case "grid": {
      const steps = ["لبه پایین و لبه چپ: تا هر کدام فقط ۱ راه هست (یا ۰ اگر بسته باشد)."];
      for (let d = 2; d <= q.a + q.b; d++) steps.push(d === 2 ? "هر گره = جمع گره چپ و گره پایینش" : `گره‌های قطر ${fa(d)}`);
      return [...steps, how];
    }
    case "pigeonhole": {
      const w = worstCase(q);
      const thing = q.ctx === "socks" ? "جوراب" : "مهره";
      const steps = w.map((x, i) => (x ? `بدشانسی: ${fa(x)} ${thing} ${COLOURS[q.colours[i]]}` : "")).filter(Boolean);
      return [...steps, how];
    }
    case "probability": {
      // Two dice: the table, row by row.
      const all = cases(q);
      const steps = Array.from({ length: 6 }, (_, a) => `تاس سفید ${fa(a + 1)}: ${fa(all.filter((c) => c.pick[0] === a && c.ok).length)} حالت خوب از ۶`);
      return [...steps, how];
    }
    default:
      return [how];
  }
}

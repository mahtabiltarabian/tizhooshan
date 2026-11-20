// Words for tool 21's mental arithmetic: each sum as written, the shortcut
// that solves it in the head, and the feedback for each slip.

import type { MentalItem, MentalQuestion, MentalTag, Sign } from "@/generators/mental";
import { itemSlips } from "@/generators/mental";
import { fa } from "@/tools/registry";

/** Keeps an equation left to right inside a Persian sentence, on one line. */
export const ltr = (s: string) => `⁦${s.replace(/ /g, " ")}⁩`;

/** "۴۷ + ۳۸". */
export const itemText = (it: Pick<MentalItem, "nums" | "signs">) => it.nums.map((n, i) => (i ? `${it.signs[i - 1]} ${fa(n)}` : fa(n))).join(" ");

const eq = (s: string) => ltr(s);

/** The shortcut, worked with numbers. */
export function worked(it: MentalItem): string {
  const [a, b] = it.nums;
  const ans = fa(it.answer);
  switch (it.op) {
    case "add": {
      if (a % 100 >= 98) {
        const r = a + (100 - (a % 100));
        return `${fa(a)} نزدیک ${fa(r)} است: ${eq(`${fa(r)} + ${fa(b)} = ${fa(r + b)}`)}، بعد ${fa(r - a)} کم کن: ${eq(`${fa(r + b)} − ${fa(r - a)} = ${ans}`)}.`;
      }
      if (b >= 10) {
        const t = b - (b % 10);
        const u = b % 10;
        return u
          ? `اول ده‌تایی‌ها: ${eq(`${fa(a)} + ${fa(t)} = ${fa(a + t)}`)}، بعد یکی‌ها: ${eq(`${fa(a + t)} + ${fa(u)} = ${ans}`)}.`
          : `${eq(`${fa(a)} + ${fa(t)} = ${ans}`)}.`;
      }
      const k = 10 - (a % 10);
      if (a % 10 && k < b) return `تا ده بعدی برو: ${eq(`${fa(a)} + ${fa(k)} = ${fa(a + k)}`)}، بعد باقی‌اش: ${eq(`${fa(a + k)} + ${fa(b - k)} = ${ans}`)}.`;
      return `${eq(`${fa(a)} + ${fa(b)} = ${ans}`)}.`;
    }
    case "sub": {
      if (b % 100 >= 98) {
        const r = b + (100 - (b % 100));
        return `${fa(b)} نزدیک ${fa(r)} است: ${eq(`${fa(a)} − ${fa(r)} = ${fa(a - r)}`)}، بعد ${fa(r - b)} اضافه کن (زیادی کم کرده بودی): ${eq(`${fa(a - r)} + ${fa(r - b)} = ${ans}`)}.`;
      }
      if (b >= 10) {
        const t = b - (b % 10);
        const u = b % 10;
        return u
          ? `اول ده‌تایی‌ها: ${eq(`${fa(a)} − ${fa(t)} = ${fa(a - t)}`)}، بعد یکی‌ها: ${eq(`${fa(a - t)} − ${fa(u)} = ${ans}`)}.`
          : `${eq(`${fa(a)} − ${fa(t)} = ${ans}`)}.`;
      }
      const k = a % 10;
      if (k && k < b) return `تا ده قبلی برو: ${eq(`${fa(a)} − ${fa(k)} = ${fa(a - k)}`)}، بعد باقی‌اش: ${eq(`${fa(a - k)} − ${fa(b - k)} = ${ans}`)}.`;
      return `${eq(`${fa(a)} − ${fa(b)} = ${ans}`)}.`;
    }
    case "mul": {
      if (a === 25) return `چهار تا ${fa(25)} می‌شود ${fa(100)}: ${eq(`${fa(b)} ÷ ۴ = ${fa(b / 4)}`)}، پس ${eq(`${fa(100)} × ${fa(b / 4)} = ${ans}`)}.`;
      if (a === 11) return `${eq(`${fa(b)} × ۱۱ = ${fa(b)} × ۱۰ + ${fa(b)} = ${fa(10 * b)} + ${fa(b)} = ${ans}`)}.`;
      if (a === 99) return `${eq(`۹۹ × ${fa(b)} = ۱۰۰ × ${fa(b)} − ${fa(b)} = ${fa(100 * b)} − ${fa(b)} = ${ans}`)}.`;
      if (b === 5 && a >= 10 && a % 2 === 0) return `ضرب در ۵ یعنی ضرب در ۱۰ و نصف کردن: ${eq(`${fa(a)} ÷ ۲ = ${fa(a / 2)}`)}، ${eq(`${fa(a / 2)} × ۱۰ = ${ans}`)}.`;
      if (a >= 10) {
        const t = a - (a % 10);
        const u = a % 10;
        return `دهگان و یکان را جدا ضرب کن: ${eq(`${fa(t)} × ${fa(b)} = ${fa(t * b)}`)} و ${eq(`${fa(u)} × ${fa(b)} = ${fa(u * b)}`)}؛ با هم ${eq(`${fa(t * b)} + ${fa(u * b)} = ${ans}`)}.`;
      }
      return `از جدول ضرب: ${eq(`${fa(a)} × ${fa(b)} = ${ans}`)}.`;
    }
    case "div": {
      const q = it.answer;
      if (q < 10) return `کدام عدد ضرب در ${fa(b)} می‌شود ${fa(a)}؟ ${eq(`${ans} × ${fa(b)} = ${fa(a)}`)}.`;
      const part = Math.floor(q / 10) * 10 * b;
      const rest = a - part;
      if (!rest) return `${eq(`${fa(a)} ÷ ${fa(b)} = ${ans}`)}، چون ${eq(`${ans} × ${fa(b)} = ${fa(a)}`)}.`;
      return `${fa(a)} را دو تکه کن: ${eq(`${fa(part)} ÷ ${fa(b)} = ${fa(part / b)}`)} و ${eq(`${fa(rest)} ÷ ${fa(b)} = ${fa(rest / b)}`)}؛ با هم ${eq(`${fa(part / b)} + ${fa(rest / b)} = ${ans}`)}.`;
    }
    case "mix": {
      // × and ÷ first, then + and − left to right.
      const parts: string[] = [];
      const terms: string[] = [];
      let cur = it.nums[0];
      let curText = fa(cur);
      let multi = false;
      const flush = () => {
        if (multi) parts.push(eq(`${curText} = ${fa(cur)}`));
        terms.push(fa(cur));
      };
      const adds: Sign[] = [];
      it.signs.forEach((s, i) => {
        const n = it.nums[i + 1];
        if (s === "×" || s === "÷") {
          cur = s === "×" ? cur * n : cur / n;
          curText += ` ${s} ${fa(n)}`;
          multi = true;
        } else {
          flush();
          adds.push(s);
          cur = n;
          curText = fa(n);
          multi = false;
        }
      });
      flush();
      const sum = terms.map((t, i) => (i ? `${adds[i - 1]} ${t}` : t)).join(" ");
      return `اول ضرب و تقسیم: ${parts.join(" و ")}. بعد ${eq(`${sum} = ${ans}`)}.`;
    }
  }
}

export const MENTAL_FEEDBACK: Record<Exclude<MentalTag, "right" | "other">, string> = {
  carry: "در یک جمع، ده‌بر را فراموش کردی؛ جواب ده تا کم آمد.",
  borrow: "در یک تفریق، رقم کوچک‌تر را از بزرگ‌تر کم کردی؛ باید از دهگان قرض بگیری.",
  times: "یک جواب یک پله با جدول ضرب فاصله دارد؛ آن ضرب را دوباره بگو.",
  partial: "در ضرب عدد دورقمی، یکان را هم باید ضرب کنی، نه اینکه فقط اضافه‌اش کنی.",
  order: "در عبارتی که هم جمع دارد هم ضرب، اول ضرب و تقسیم را حساب کن، بعد جمع و تفریق را.",
};

/** The slip behind one wrong answer, if known. */
export const slipOf = (it: MentalItem, v: number | null) => (v === null ? null : (itemSlips(it).find(([, x]) => x === v)?.[0] ?? null));

export const MENTAL_LEVEL_NOTE: Record<MentalQuestion["level"], string> = {
  1: "سطح ۱: جمع و تفریق با یک عدد یک‌رقمی، و جدول ضرب.",
  2: "سطح ۲: ده‌بر و قرض، ضرب دورقمی در یک‌رقمی، و ترتیب عملیات.",
  3: "سطح ۳: میان‌بُر با عددهای گرد (۹۹، ۲۵، ۱۱)، عددهای سه‌رقمی، و دو ضرب در یک عبارت.",
};

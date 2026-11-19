import { expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { digitsMistake, makeDigitsQuestion, slips, type Level } from "@/generators/digits";
import { NUMBER_TYPES, type NumberQuestion } from "@/generators/digits-numbers";
import { DominoPaper, DotsExploreBoard, RectBoard, SieveBoard } from "./NumberBoards";
import { DotsExplore, RectExplore, SieveExplore } from "./NumberExplore";
import { numberFeedback } from "./NumberText";

const RX = /NaN|undefined|Infinity|object Object/;

// Every slip a question can make has its own words, not only "the answer is …".
it("names every slip of primes and odd/even in words", () => {
  const missing: string[] = [];
  for (const t of NUMBER_TYPES)
    for (const l of [1, 2, 3] as Level[])
      for (let s = 0; s < 400; s++) {
        const q = makeDigitsQuestion(t, l, s) as NumberQuestion;
        const wrongs = slips(q).map(([, v]) => String(v));
        if (q.type === "prime" && q.ask === "factor") wrongs.push(`1.${q.n}`, "2.3", `4.${q.n / 4}`);
        if (q.type === "prime" && q.ask === "smallest") wrongs.push("10", "18");
        for (const v of wrongs) {
          if (!v) continue;
          const tag = digitsMistake(q, v);
          if (tag === "right" || tag === "other") continue;
          const text = numberFeedback(q, tag, v);
          if (!text || RX.test(text)) missing.push(`${t} ${l} ${s} ${v} ${tag}: ${text}`);
        }
      }
  expect(missing.slice(0, 5)).toEqual([]);
}, 60_000);

it("draws the explore boards and panels", () => {
  const out: string[] = [];
  for (let n = 1; n <= 60; n++)
    for (let r = 1; r <= n; r += n > 20 ? 7 : 1) {
      out.push(renderToString(<RectBoard n={n} rows={r} />));
      out.push(renderToString(<RectExplore n={n} rows={r} tried={[1, r]} onN={() => {}} onRows={() => {}} onAll={() => {}} />));
    }
  for (let k = 0; k <= 4; k++) for (const pick of [1, 2, 49, 91, 97, 100]) out.push(renderToString(<SieveBoard k={k} pick={pick} />), renderToString(<SieveExplore k={k} onK={() => {}} pick={pick} onPick={() => {}} />));
  for (const nums of [[], [1], [3, 5, 4], [15, 15, 15, 15, 15, 15], [2, 4, 6, 8, 10, 12]]) out.push(renderToString(<DotsExploreBoard nums={nums} />), renderToString(<DotsExplore nums={nums} onNums={() => {}} />));
  for (const v of [0, 1, 2]) out.push(renderToString(<DominoPaper rows={4} cols={6} variant={v} />));
  expect(out.filter((x) => RX.test(x))).toEqual([]);
}, 60_000);

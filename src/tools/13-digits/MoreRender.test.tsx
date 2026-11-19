import { it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { makeDigitsQuestion, answerKey, slips, type Level } from "@/generators/digits";
import { MORE_TYPES, type MoreQuestion } from "@/generators/digits-more";
import { MoreBoard } from "./MoreBoards";
import { moreSteps, morePrompt, moreFeedback } from "./MoreText";
import { DigitsTryPanel } from "./DigitsTryPanel";

// Every board, prompt, worked step and feedback renders without NaN or undefined.
it("renders every step of the later topics", () => {
  const bad: string[] = [];
  for (const t of MORE_TYPES) for (const l of [1, 2, 3] as Level[]) for (let s = 0; s < 40; s++) {
    const q = makeDigitsQuestion(t, l, s) as MoreQuestion;
    const steps = moreSteps(q);
    const texts = [morePrompt(q), morePrompt(q, true), ...steps, moreFeedback(q, answerKey(q)).text, ...slips(q).map(([, v]) => moreFeedback(q, String(v)).text)];
    for (let k = 0; k <= steps.length; k++) texts.push(renderToString(<MoreBoard q={q} step={k} />));
    texts.push(renderToString(<DigitsTryPanel question={q} type={t} level={l} built="" sticks={[]} entry={q.type === "crypt" ? q.letters.map(() => null) : q.type === "signs" ? q.ops.map(() => null) : []} onEntry={() => {}} active={0} onActive={() => {}} onClear={() => {}} checked={answerKey(q)} onCheck={() => {}} onType={() => {}} onLevel={() => {}} onNew={() => {}} />));
    const RX = /NaN|undefined|Infinity|object Object/;
    for (const x of texts) if (RX.test(x)) bad.push(`${t} ${l} ${s}: ${x.slice(Math.max(0, x.search(RX) - 150), x.search(RX) + 30)}`);
  }
  expect(bad.slice(0, 5)).toEqual([]);
}, 200000);

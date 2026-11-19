"use client";

// «رسم بدون برداشتن قلم» in tool 5. Explore: trace a figure line by line;
// points show their degree (circle = even, square = odd). Show me: count the
// degree of every point, count the odd ones, then draw a stroke from an odd
// point. Try it: pick the drawable figure, count odd points, or find where
// the stroke starts or ends.

import { useMemo, useState, type ReactNode } from "react";
import {
  countSlip,
  degrees,
  drawable,
  edgeBetween,
  eulerPath,
  latticeFigure,
  linesOddPoints,
  makeStrokeQuestion,
  NAMED,
  oddPoints,
  pointNames,
  type NamedFigure,
  type StrokeFigure,
  type StrokeQuestion,
  type StrokeTag,
} from "@/generators/one-stroke";
import { mulberry32, newSeed, pick } from "@/generators/random";
import type { Level } from "@/generators/shape-count";
import { Board } from "@/engine-2d/Board";
import { NumberPad } from "@/toolkit/NumberPad";
import { fa } from "@/tools/registry";
import layout from "@/toolkit/ToolLayout.module.css";
import tryStyles from "@/toolkit/TryPanel.module.css";
import { ChoiceButtons, ICON, StepBar, useSteps, type LabMode, type Tone } from "./labKit";
import { INK, type Frame } from "./Pictures";
import { StrokeFigureG, strokeFrame } from "./StrokePictures";

export const FIGURE_LABEL: Record<NamedFigure, string> = {
  house: "خانه",
  houseX: "خانه با ضربدر",
  envelope: "پاکت نامه",
  bow: "پاپیون",
  window2: "پنجره دولنگه",
  window4: "پنجره چهارخانه",
  kite: "بادبادک",
  star: "ستاره",
};

const FONT = { fontFamily: "Vazirmatn, sans-serif" } as const;

/** Lines of a stroke given as the points it visits. */
export const pathEdges = (fig: StrokeFigure, path: number[] | null) => (path ? path.slice(1).map((v, i) => edgeBetween(fig, path[i], v)) : []);

const oddWord = (n: number) => `${fa(n)} رأس فرد`;

/** The odd-point rule, said for this figure. */
export function ruleFor(fig: StrokeFigure): string {
  const n = oddPoints(fig).length;
  if (n === 0) return "همه رأس‌ها زوج‌اند (۰ رأس فرد)، پس می‌شود یک‌خطی کشید و قلم به همان نقطه شروع برمی‌گردد.";
  if (n === 2) return "۲ رأس فرد دارد، پس می‌شود یک‌خطی کشید: از یکی از دو رأس فرد شروع کن؛ کار در دیگری تمام می‌شود.";
  return `${oddWord(n)} دارد. هر رأس فرد باید جای شروع یا پایان باشد و یک خط فقط یک شروع و یک پایان دارد، پس نمی‌شود؛ دست‌کم ${fa(n / 2)} بار باید قلم را برداشت.`;
}

// ---------------------------------------------------------------- feedback

const TAG_TEXT: Record<StrokeTag, (fig: StrokeFigure) => string> = {
  fourOdd: () => "این شکل ۴ رأس فرد دارد. با ۴ رأس فرد نمی‌شود: فقط ۰ یا ۲ رأس فرد مجاز است، چون هر رأس فرد باید شروع یا پایان خط باشد.",
  manyOdd: (f) => `این شکل ${oddWord(oddPoints(f).length)} دارد؛ برای یک‌خطی کشیدن باید ۰ یا ۲ رأس فرد داشته باشد.`,
  countLines: (f) =>
    `درجه را اشتباه شمردی: جایی که یک خط از وسط نقطه رد می‌شود، آن خط دو سر حساب می‌شود (از نقطه دو راه بیرون می‌رود). با درست شمردن، این شکل ${oddWord(oddPoints(f).length)} دارد، نه ${fa(linesOddPoints(f).length)}.`,
  evenStart: () => "از رأس زوج شروع کردی. وقتی شکل ۲ رأس فرد دارد، باید از یکی از آن‌ها شروع کنی؛ وگرنه آخر کار در رأس فرد دیگر گیر می‌کنی.",
  evenEnd: () => "خط در رأس زوج تمام نمی‌شود: به هر رأس زوج که برسی، راهی برای بیرون رفتن مانده است. کار در رأس فرد دیگر تمام می‌شود.",
  backToStart: () => "قلم فقط وقتی به جای شروع برمی‌گردد که همه رأس‌ها زوج باشند. اینجا ۲ رأس فرد هست: از یکی شروع می‌کنی و به دیگری می‌رسی.",
  countedEven: () => "رأس‌های زوج را شمردی؛ پرسش رأس‌های فرد را می‌خواهد (۱، ۳، ۵ سر خط).",
  countedAll: () => "همه رأس‌ها را شمردی؛ فقط رأس‌هایی را بشمار که تعداد سرهای خطشان فرد است.",
};

const tagTone = (t: StrokeTag | null): Tone => (t === null || t === "manyOdd" ? "bad" : "turned");

function strokeFeedback(q: StrokeQuestion, picked: number | null, n: number | null): { tone: Tone; text: string } | null {
  if (q.ask === "count") {
    if (n === null) return null;
    const rule = ruleFor(q.fig);
    if (n === q.answer) return { tone: "good", text: `درست است! ${oddWord(q.answer)}. ${rule}` };
    const tag = countSlip(q, n);
    if (tag) return { tone: "turned", text: `نزدیک بود! ${TAG_TEXT[tag](q.fig)} جواب ${fa(q.answer)} است. ${rule}` };
    return { tone: "bad", text: `جواب ${fa(q.answer)} است. در هر رأس سرهای خط را بشمار؛ رأس با ۱، ۳ یا ۵ سر فرد است. روی صفحه عدد هر رأس آمده و رأس‌های فرد مربع‌اند. ${rule}` };
  }
  if (picked === null) return null;
  const names = pointNames(q);
  if (q.ask === "which") {
    const rule = ruleFor(q.options[q.answer]);
    if (picked === q.answer) return { tone: "good", text: `درست است! گزینه ${fa(picked + 1)} ${rule}` };
    const tag = q.mistakes[picked]!;
    return { tone: tagTone(tag), text: `${tag === "manyOdd" ? "" : "نزدیک بود! "}${TAG_TEXT[tag](q.options[picked])} جواب گزینه ${fa(q.answer + 1)} است: ${rule}` };
  }
  const right = names.get(q.choices[q.answer])!;
  const tag = q.mistakes[picked];
  const how = q.ask === "start" ? `شروع از «${right}»؛ روی صفحه یک راه کشیدن با شماره خط‌ها آمده.` : `کار در «${right}» تمام می‌شود؛ روی صفحه یک راه کشیدن با شماره خط‌ها آمده.`;
  if (!tag) return { tone: "good", text: `درست است! «${right}» رأس فرد است. ${how}` };
  return { tone: tagTone(tag), text: `نزدیک بود! ${TAG_TEXT[tag](q.fig)} ${how}` };
}

export function strokePrompt(q: StrokeQuestion): string {
  switch (q.ask) {
    case "which":
      return "کدام شکل را می‌توان بدون برداشتن قلم و بدون رفتن دوباره روی یک خط کشید؟";
    case "count":
      return "این شکل چند رأس فرد دارد؟ (رأسی که تعداد فردی سر خط به آن می‌رسد)";
    case "start":
      return "می‌خواهیم این شکل را بدون برداشتن قلم و بدون رفتن دوباره روی یک خط بکشیم. از کدام نقطه باید شروع کنیم؟";
    case "end":
      return "کشیدن این شکل از نقطه «الف» شروع می‌شود؛ قلم برداشته نمی‌شود و از هیچ خطی دو بار رد نمی‌شویم. کار در کدام نقطه تمام می‌شود؟";
  }
}

// ---------------------------------------------------------------- board

function GridOf({ figs, render, label }: { figs: StrokeFigure[]; render: (i: number, f: Frame) => ReactNode; label: string }) {
  const W = 10;
  const g = 2.4;
  // Option 1 at the top right, read like Persian text.
  const cell = (i: number) => ({ x: (1 - (i % 2)) * (W + g), y: Math.floor(i / 2) * (W + g) + 1.4 });
  return (
    <Board view={[-1.2, -0.4, 2 * W + g + 2.4, 2 * W + g + 3.8]} imageName="one-stroke" label={label}>
      {figs.map((fig, i) => {
        const c = cell(i);
        const fr = strokeFrame(fig, W * 0.78);
        const frame = { ...fr, x: c.x + (W - fr.w) / 2, y: c.y + (W - fr.h) / 2 };
        return (
          <g key={i}>
            <rect x={c.x - 0.6} y={c.y - 1.2} width={W + 1.2} height={W + 1.8} rx={0.5} fill="#fff" stroke="#c9bfae" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <text x={c.x + W / 2} y={c.y - 0.3} fontSize={0.9} fontWeight={700} textAnchor="middle" fill={INK} style={FONT}>
              {fa(i + 1)}
            </text>
            {render(i, frame)}
          </g>
        );
      })}
    </Board>
  );
}

function Single({ fig, label, children }: { fig: StrokeFigure; label: string; children: (f: Frame) => ReactNode }) {
  const f = strokeFrame(fig, 10);
  const pad = 2;
  return (
    <Board view={[-pad, -pad, f.w + 2 * pad, f.h + 2 * pad]} imageName="one-stroke" label={label}>
      {children(f)}
    </Board>
  );
}

// ---------------------------------------------------------------- the lab

interface Props {
  mode: LabMode;
  /** Topic switch, shown at the top of the side panel in explore and show me. */
  topicPicker: ReactNode;
  /** Figure for explore and show me: a named one, or a random one by seed. */
  figure: NamedFigure | number;
  onFigure: (f: NamedFigure | number) => void;
  level: Level;
  seed: number;
  /** Type and level buttons for try it. */
  picker: ReactNode;
  /** Answer from a link (#…&n=): the count, or the option number 1–4. */
  initialN?: number;
  onNew: () => void;
}

export function StrokeLab(p: Props) {
  if (p.mode === "try") return <StrokeTry {...p} />;
  return <StrokeExploreShow {...p} />;
}

/** A random lattice figure for exploring (0, 2 or 4 odd points). */
export function randomStrokeFigure(seed: number): StrokeFigure {
  const rng = mulberry32(seed);
  for (;;) {
    const f = latticeFigure(rng, 4, 3, 8 + Math.floor(rng() * 4), pick(rng, [0, 2, 2, 4]), true);
    if (f) return f;
  }
}

function StrokeExploreShow({ mode, topicPicker, figure, onFigure }: Props) {
  const fig = useMemo(() => (typeof figure === "number" ? randomStrokeFigure(figure) : NAMED[figure]()), [figure]);
  const deg = degrees(fig);
  const odd = oddPoints(fig);

  // Explore: the stroke drawn so far, as points visited.
  const [trace, setTrace] = useState<number[]>([]);
  const [showDeg, setShowDeg] = useState(true);
  const [msg, setMsg] = useState<{ tone: "good" | "info" | "warn"; text: string } | null>(null);
  const drawn = pathEdges(fig, trace.length > 1 ? trace : null);


  const tap = (i: number) => {
    if (!trace.length) {
      setTrace([i]);
      return setMsg({ tone: "info", text: `از نقطه‌ای با ${fa(deg[i])} سر خط شروع کردی (${deg[i] % 2 ? "فرد" : "زوج"}). حالا روی نقطه بعدی بزن.` });
    }
    const last = trace[trace.length - 1];
    if (i === last) return;
    const e = edgeBetween(fig, last, i);
    if (e < 0) return setMsg({ tone: "warn", text: "این دو نقطه با یک خط به هم وصل نیستند؛ فقط روی خط‌های شکل راه برو." });
    if (drawn.includes(e)) return setMsg({ tone: "warn", text: "این خط را قبلاً کشیدی؛ نباید دوباره از روی یک خط رد شوی." });
    const next = [...trace, i];
    setTrace(next);
    const used = new Set([...drawn, e]);
    if (used.size === fig.edges.length) return setMsg({ tone: "good", text: `✓ همه ${fa(fig.edges.length)} خط را بدون برداشتن قلم کشیدی! از رأس ${deg[trace[0]] % 2 ? "فرد" : "زوج"} شروع کردی و در رأس ${deg[i] % 2 ? "فرد" : "زوج"} تمام کردی.` });
    const free = fig.edges.some((ed, k) => ed.includes(i) && !used.has(k));
    if (!free) {
      const left = fig.edges.length - used.size;
      let hint = "«واگرد» را بزن و راه دیگری را امتحان کن.";
      if (odd.length > 2) hint = `این شکل ${oddWord(odd.length)} دارد؛ با یک خط نمی‌شود کشید.`;
      else if (odd.length === 2 && !odd.includes(trace[0])) hint = "از رأس زوج شروع کردی؛ «از نو» را بزن و از یکی از دو رأس فرد (مربع‌ها) شروع کن.";
      return setMsg({ tone: "warn", text: `گیر کردی! از این نقطه خط کشیده‌نشده‌ای نمانده، ولی ${fa(left)} خط مانده. ${hint}` });
    }
    setMsg(null);
  };

  // Show me: count each point's degree, then the odd ones, then draw a stroke.
  const used = deg.map((d, i) => (d ? i : -1)).filter((i) => i >= 0);
  const path = eulerPath(fig);
  const pathE = pathEdges(fig, path);
  const total = used.length + 1 + pathE.length;
  const steps = useSteps(total, mode === "show", 1100);
  const s = steps.step;
  const counting = s < used.length;
  const v = counting ? used[s] : -1;
  const drawStep = s - used.length;

  let board: ReactNode;
  let stepText = "";
  if (mode === "explore") {
    board = (
      <Single fig={fig} label="شکل برای کشیدن با یک خط؛ روی نقطه‌ها بزن">
        {(f) => <StrokeFigureG fig={fig} frame={f} showDegrees={showDeg} drawn={drawn} ring={trace.length ? trace[trace.length - 1] : null} start={trace[0] ?? null} onPoint={tap} />}
      </Single>
    );
  } else {
    if (counting) stepText = `این رأس: ${fa(deg[v])} سر خط به آن می‌رسد، پس ${deg[v] % 2 ? "فرد است (مربع)" : "زوج است (دایره)"}.`;
    else if (drawStep === 0) stepText = `${oddWord(odd.length)}. ${ruleFor(fig)}`;
    else stepText = `خط ${fa(drawStep)} از ${fa(pathE.length)}${drawStep === 1 && odd.length ? " — شروع از یک رأس فرد" : ""}.`;
    board = (
      <Single fig={fig} label="شمردن رأس‌های فرد و کشیدن با یک خط">
        {(f) => (
          <StrokeFigureG
            fig={fig}
            frame={f}
            showDegrees
            degreeOf={counting ? used.slice(0, s + 1) : undefined}
            lit={counting ? fig.edges.map((ed, k) => (ed.includes(v) ? k : -1)).filter((k) => k >= 0) : []}
            ring={counting ? v : drawStep > 0 && path ? path[drawStep] : null}
            drawn={drawStep > 0 ? pathE.slice(0, drawStep) : []}
            start={drawStep > 0 && path ? path[0] : null}
          />
        )}
      </Single>
    );
  }
  const choose = (k: NamedFigure | "random") => {
    onFigure(k === "random" ? newSeed() : k);
    setTrace([]);
    setMsg(null);
    if (mode === "show") steps.restart();
  };
  const oddSoFar = used.slice(0, counting ? s + 1 : used.length).filter((i) => deg[i] % 2).length;

  return (
    <>
      <section className={layout.stageWrap} aria-label="صفحه شکل">
        {board}
      </section>
      <section className={layout.controls}>
        {mode === "explore" ? (
          <p className={layout.stepText} style={{ margin: 0 }}>
            {fa(drawn.length)} از {fa(fig.edges.length)} خط کشیده شد
          </p>
        ) : (
          <StepBar steps={steps} label={counting ? `رأس ${fa(s + 1)} از ${fa(used.length)}` : drawStep === 0 ? "قاعده" : `خط ${fa(drawStep)} از ${fa(pathE.length)}`} />
        )}
      </section>
      <aside className={layout.side}>
        {topicPicker}
        <h2>{mode === "explore" ? "۱. شکل را انتخاب کن" : "شکل"}</h2>
        <div className={layout.choiceGrid} role="radiogroup" aria-label="شکل">
          {(Object.keys(FIGURE_LABEL) as NamedFigure[]).map((k) => (
            <button key={k} role="radio" aria-checked={figure === k} onClick={() => choose(k)}>
              {FIGURE_LABEL[k]}
            </button>
          ))}
          <button role="radio" aria-checked={typeof figure === "number"} onClick={() => choose("random")}>
            شکل تازه
          </button>
        </div>
        <p className={layout.note}>
          درجه هر رأس = تعداد سرهای خطی که به آن می‌رسد. <span aria-hidden>■</span> مربع = رأس فرد، <span aria-hidden>●</span> دایره = رأس زوج.
        </p>

        {mode === "explore" ? (
          <>
            <h2 className={layout.progress}>۲. با یک خط بکش</h2>
            <p className={layout.note}>روی یک نقطه بزن تا قلم آنجا گذاشته شود؛ بعد روی نقطه‌های کناری بزن تا خط‌ها یکی‌یکی کشیده شوند. از هیچ خطی دو بار رد نشو.</p>
            <button className={layout.clear} aria-pressed={showDeg} onClick={() => setShowDeg(!showDeg)}>
              {showDeg ? "پنهان کردن درجه‌ها" : "نشان دادن درجه‌ها"}
            </button>
            {msg && <p className={`${layout.status} ${layout[msg.tone]}`}>{msg.text}</p>}
            <div className={layout.row}>
              <button className={layout.clear} onClick={() => (setTrace(trace.slice(0, -1)), setMsg(null))} disabled={!trace.length}>
                واگرد
              </button>
              <button className={layout.clear} onClick={() => (setTrace([]), setMsg(null))} disabled={!trace.length}>
                از نو
              </button>
            </div>
            <p className={layout.note}>
              {showDeg ? `این شکل ${oddWord(odd.length)} دارد. ` : ""}
              قاعده: اگر ۰ یا ۲ رأس فرد باشد می‌شود؛ با ۲ رأس فرد از یکی شروع کن.
            </p>
          </>
        ) : (
          <>
            <h2 className={layout.progress}>شمردن رأس‌های فرد</h2>
            <p className={layout.stepText}>{stepText}</p>
            <table className={layout.countTable}>
              <tbody>
                <tr aria-current={counting ? "step" : undefined}>
                  <td>{counting ? "◀ " : ""}رأس‌های شمرده‌شده</td>
                  <td>
                    {fa(counting ? s + 1 : used.length)} از {fa(used.length)}
                  </td>
                </tr>
                <tr>
                  <td>رأس فرد تا اینجا</td>
                  <td>{fa(oddSoFar)}</td>
                </tr>
                <tr aria-current={!counting ? "step" : undefined}>
                  <td>{!counting ? "◀ " : ""}می‌شود با یک خط؟</td>
                  <td>{counting ? "—" : drawable(fig) ? "بله" : "نه"}</td>
                </tr>
              </tbody>
            </table>
            <button className={layout.clear} onClick={steps.restart}>
              از اول نشان بده
            </button>
          </>
        )}
      </aside>
    </>
  );
}

function StrokeTry({ level, seed, picker, initialN, onNew }: Props) {
  const q = useMemo(() => makeStrokeQuestion(level, seed), [level, seed]);
  const [picked, setPicked] = useState<number | null>(q.ask !== "count" && initialN !== undefined && initialN >= 1 && initialN <= 4 ? initialN - 1 : null);
  const [value, setValue] = useState(q.ask === "count" && initialN !== undefined ? String(initialN) : "");
  const [checked, setChecked] = useState(q.ask === "count" && initialN !== undefined);
  const done = q.ask === "count" ? checked : picked !== null;
  const fb = strokeFeedback(q, picked, q.ask === "count" && checked && value ? Number(value) : null);
  const names = pointNames(q);

  let board: ReactNode;
  if (q.ask === "which") {
    board = (
      <GridOf
        figs={q.options}
        label="چهار شکل؛ کدام با یک خط کشیده می‌شود؟"
        render={(i, f) => (
          <g>
            <StrokeFigureG fig={q.options[i]} frame={f} showDegrees={done} drawn={done && i === q.answer ? pathEdges(q.options[i], eulerPath(q.options[i])) : []} start={done && i === q.answer ? (eulerPath(q.options[i])?.[0] ?? null) : null} />
            {done && (
              <text x={f.x + f.w / 2} y={f.y + f.h + 1.3} fontSize={0.75} fontWeight={700} textAnchor="middle" fill={INK} style={FONT}>
                {oddWord(oddPoints(q.options[i]).length)} {i === q.answer ? "✓" : "✗"}
              </text>
            )}
            {!done && <rect x={f.x - 1} y={f.y - 1} width={f.w + 2} height={f.h + 2} fill="transparent" style={{ cursor: "pointer" }} onClick={() => setPicked(i)} aria-label={`گزینه ${fa(i + 1)}`} />}
          </g>
        )}
      />
    );
  } else {
    const fig = q.fig;
    const from = q.ask === "end" ? q.from : q.ask === "start" ? q.choices[q.answer] : undefined;
    const path = done ? eulerPath(fig, from) : null;
    board = (
      <Single fig={fig} label="شکل پرسش">
        {(f) => <StrokeFigureG fig={fig} frame={f} showDegrees={done} names={names} drawn={pathEdges(fig, path)} start={q.ask === "end" ? q.from : path ? path[0] : null} />}
      </Single>
    );
  }

  const choiceLabels = q.ask === "which" ? ["۱", "۲", "۳", "۴"].map((l) => `گزینه ${l}`) : q.ask === "count" ? [] : q.choices.map((v) => `«${names.get(v)}»`);

  return (
    <>
      <section className={layout.stageWrap} aria-label="صفحه شکل">
        {board}
      </section>
      <section className={layout.controls}>
        <p className={layout.stepText} style={{ margin: 0 }}>
          {done ? "عدد هر رأس = درجه آن؛ مربع = رأس فرد" : "درجه رأس‌ها را بشمار، بعد جواب بده"}
        </p>
      </section>
      <aside className={layout.side}>
        <div className={tryStyles.panel}>
          {picker}
          <p className={tryStyles.prompt}>{strokePrompt(q)}</p>
          {q.ask === "count" ? (
            <>
              <NumberPad value={value} onChange={setValue} disabled={checked} />
              {!checked && (
                <button className={tryStyles.secondary} disabled={!value} onClick={() => setChecked(true)}>
                  بررسی
                </button>
              )}
            </>
          ) : (
            <ChoiceButtons labels={choiceLabels} picked={picked} answer={q.answer} toneOf={(i) => tagTone(q.mistakes[i])} onPick={setPicked} />
          )}
          {!done && <p className={tryStyles.hint}>کمک: در هر نقطه بشمار چند سر خط به آن می‌رسد. اگر ۰ یا ۲ نقطه فرد باشد، می‌شود با یک خط کشید.</p>}
          {fb && (
            <p className={`${tryStyles.feedback} ${tryStyles[fb.tone]}`} role="status" aria-live="polite">
              <span className={tryStyles.icon}>{ICON[fb.tone]}</span> {fb.text}
            </p>
          )}
          <button className={tryStyles.next} onClick={onNew}>
            نمونه تازه
          </button>
        </div>
      </aside>
    </>
  );
}

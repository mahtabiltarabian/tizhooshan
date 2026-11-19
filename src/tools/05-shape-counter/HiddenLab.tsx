"use client";

// «شکل پنهان» in tool 5. Explore: move the shape on tracing paper over a
// drawing (tap to place it, arrows to nudge, turn or flip it) and see which
// sides are on the lines. Show me: look at each of the four drawings in turn;
// the hidden shape is hatched in the right one, and what the others have
// instead (turned, flipped, other size, a side missing) is marked. Try it:
// pick the drawing the shape is hidden in.

import { useMemo, useState, type ReactNode } from "react";
import {
  hiddenAt,
  makeHiddenQuestion,
  missingSides,
  normal,
  SHAPE_NAME,
  slipOf,
  traced,
  type Change,
  type HiddenQuestion,
  type HiddenTag,
  type HPt,
} from "@/generators/hidden-figure";
import type { Level } from "@/generators/shape-count";
import { newSeed } from "@/generators/random";
import { Board } from "@/engine-2d/Board";
import { fa } from "@/tools/registry";
import layout from "@/toolkit/ToolLayout.module.css";
import tryStyles from "@/toolkit/TryPanel.module.css";
import { cardWidth, HiddenDrawingG, ShapeCardG, type Mark } from "./HiddenPictures";
import { ChoiceButtons, ICON, StepBar, useSteps, type LabMode, type Tone } from "./labKit";
import { INK } from "./Pictures";

const FONT = { fontFamily: "Vazirmatn, sans-serif" } as const;

export const SLIP_WORD: Record<HiddenTag, string> = { rotated: "چرخیده", flipped: "وارونه", size: "بزرگ‌تر", nearMiss: "یک ضلع کم" };

const SLIP_TEXT: Record<HiddenTag, string> = {
  rotated: "این شکل آنجا هست ولی چرخیده است. شکل پنهان باید همان جهت را داشته باشد؛ چرخاندن قبول نیست.",
  flipped: "این شکل آنجا هست ولی وارونه (آینه‌ای) است. شکل پنهان نباید برگردانده شده باشد.",
  size: "این شکل آنجا هست ولی بزرگ‌تر است. شکل پنهان باید درست همان اندازه را داشته باشد؛ خانه‌ها را بشمار.",
  nearMiss: "این شکل آنجا تقریباً هست، ولی یکی از ضلع‌هایش روی خط‌های شکل نیست (روی صفحه با خط‌چین قرمز).",
};

export const hiddenPrompt = (q: HiddenQuestion) => `${SHAPE_NAME[q.shapeName]} کوچک در کدام شکل پنهان است؟ (همان اندازه و همان جهت؛ ضلع‌هایش روی خط‌های شکل)`;

/** Marks on option i: the hidden shape, or what is there instead. */
export function optionMarks(q: HiddenQuestion, i: number): Mark[] {
  if (i === q.answer) return [{ poly: hiddenAt(q), look: "found", label: "✓" }];
  const slip = slipOf(q.options[i], q.shape);
  if (!slip) return [];
  return [{ poly: slip.poly, look: "slip", label: SLIP_WORD[slip.tag], missing: slip.missing === undefined ? undefined : [slip.missing] }];
}

function hiddenFeedback(q: HiddenQuestion, picked: number): { tone: Tone; text: string } {
  const where = `روی صفحه، شکل پنهان در گزینه ${fa(q.answer + 1)} هاشور خورده است.`;
  if (picked === q.answer) return { tone: "good", text: `درست است! ${SHAPE_NAME[q.shapeName]} در گزینه ${fa(picked + 1)} با همان اندازه و جهت پنهان است. ${where}` };
  const tag = q.mistakes[picked];
  if (!tag) return { tone: "bad", text: `این شکل در گزینه ${fa(picked + 1)} نیست. ${where}` };
  return { tone: "turned", text: `نزدیک بود! در گزینه ${fa(picked + 1)}: ${SLIP_TEXT[tag]} ${where}` };
}

// ---------------------------------------------------------------- board

const W = 10;
const G = 2.2;

/** The given shape at the right, and the four drawings two by two (option 1 at the top right). */
function QuestionBoard({ q, marks, current, onPick, captions }: { q: HiddenQuestion; marks: (i: number) => Mark[]; current?: number | null; onPick?: (i: number) => void; captions?: (i: number) => string | null }) {
  const cell = (i: number) => ({ x: (1 - (i % 2)) * (W + G), y: Math.floor(i / 2) * (W + G + 1) + 1.4 });
  // The given shape at the drawings' own scale, so "same size" can be checked by eye.
  const scale = W / (2 * q.n);
  const sx = 2 * (W + G) + 0.6;
  const sw = cardWidth(q.shape, scale);
  const sy = W + G / 2 - sw / 2 + 1;
  return (
    <Board view={[-1.2, -0.4, sx + sw + 2, 2 * W + G + 5]} imageName="hidden-figure" label="شکل کوچک و چهار شکل بزرگ">
      <text x={sx + sw / 2} y={sy - 0.7} fontSize={0.85} fontWeight={700} textAnchor="middle" fill={INK} style={FONT}>
        این شکل را پیدا کن
      </text>
      <ShapeCardG shape={q.shape} n={q.n} x={sx} y={sy} w={sw} scale={scale} />
      {q.options.map((segs, i) => {
        const c = cell(i);
        const caption = captions?.(i);
        return (
          <g key={i}>
            <text x={c.x + W / 2} y={c.y - 0.35} fontSize={0.9} fontWeight={700} textAnchor="middle" fill={INK} style={FONT}>
              {current === i ? "◀ " : ""}
              {fa(i + 1)}
            </text>
            {current === i && <rect x={c.x - 0.45} y={c.y - 0.45} width={W + 0.9} height={W + 0.9} rx={0.4} fill="none" stroke={INK} strokeWidth={4} strokeDasharray="10 5" vectorEffect="non-scaling-stroke" />}
            <HiddenDrawingG segs={segs} n={q.n} frame={{ x: c.x, y: c.y, w: W, h: W }} marks={marks(i)} />
            {caption && (
              <text x={c.x + W / 2} y={c.y + W + 0.9} fontSize={0.75} fontWeight={700} textAnchor="middle" fill={INK} style={FONT}>
                {caption}
              </text>
            )}
            {onPick && <rect x={c.x} y={c.y} width={W} height={W} fill="transparent" style={{ cursor: "pointer" }} onClick={() => onPick(i)} aria-label={`گزینه ${fa(i + 1)}`} />}
          </g>
        );
      })}
    </Board>
  );
}

const caption = (q: HiddenQuestion, i: number) => (i === q.answer ? "✓ همین است" : q.mistakes[i] ? `✗ ${SLIP_WORD[q.mistakes[i]!]}` : "✗ نیست");

// ---------------------------------------------------------------- the lab

interface Props {
  mode: LabMode;
  topicPicker: ReactNode;
  /** Example for explore and show me. */
  ex: { level: Level; seed: number };
  onEx: (ex: { level: Level; seed: number }) => void;
  level: Level;
  seed: number;
  picker: ReactNode;
  /** Option number 1–4 from a link (#…&n=). */
  initialN?: number;
  onNew: () => void;
}

export function HiddenLab(p: Props) {
  if (p.mode === "try") return <HiddenTry {...p} />;
  if (p.mode === "show") return <HiddenShow {...p} />;
  return <HiddenExplore {...p} />;
}

function ExampleButtons({ ex, onEx }: Pick<Props, "ex" | "onEx">) {
  return (
    <>
      <div className={layout.chipsRow} role="radiogroup" aria-label="سطح نمونه">
        {([1, 2, 3] as Level[]).map((l) => (
          <button key={l} role="radio" aria-checked={ex.level === l} onClick={() => onEx({ level: l, seed: ex.seed })}>
            {l === 1 ? "ساده" : l === 2 ? "متوسط" : "شلوغ"}
          </button>
        ))}
      </div>
      <button className={layout.clear} style={{ marginTop: 8 }} onClick={() => onEx({ level: ex.level, seed: newSeed() })}>
        نمونه تازه
      </button>
    </>
  );
}

const TURNS: (Change | null)[][] = [
  [null, "rot90", "rot180", "rot270"],
  ["flip", "flipRot90", "flipRot180", "flipRot270"],
];

function HiddenExplore({ topicPicker, ex, onEx }: Props) {
  const q = useMemo(() => makeHiddenQuestion(ex.level, ex.seed), [ex.level, ex.seed]);
  const drawing = q.options[q.answer];
  const [turn, setTurn] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [at, setAt] = useState<HPt>([0, 0]);
  const [revealed, setRevealed] = useState(false);
  const change = TURNS[flipped ? 1 : 0][turn];
  const piece = traced(q.shape, [0, 0], change);
  const span: HPt = [Math.max(...piece.map((p) => p[0])), Math.max(...piece.map((p) => p[1]))];
  const lim = 2 * q.n;
  const clamp = ([x, y]: HPt): HPt => [Math.max(0, Math.min(lim - span[0], x)), Math.max(0, Math.min(lim - span[1], y))];
  const pos = clamp(at);
  const poly = traced(q.shape, pos, change);
  const missing = missingSides(drawing, poly);

  const S = 14;
  const scale = S / (2 * q.n);
  const sw = cardWidth(q.shape, scale);
  const board = (
    <Board view={[-0.8, -1.6, S + sw + 3.2, S + 2.6]} imageName="hidden-figure" label="کاغذ پوستی روی شکل؛ روی شکل بزن تا کاغذ آنجا برود">
      <text x={S + 1.4 + sw / 2} y={S / 2 - sw / 2 - 0.6} fontSize={0.8} fontWeight={700} textAnchor="middle" fill={INK} style={FONT}>
        شکل داده‌شده
      </text>
      {/* Same scale as the drawing, so its size can be compared. */}
      <ShapeCardG shape={q.shape} n={q.n} x={S + 1.4} y={S / 2 - sw / 2} w={sw} scale={scale} />
      <HiddenDrawingG
        segs={drawing}
        n={q.n}
        frame={{ x: 0, y: 0, w: S, h: S }}
        dots
        marks={[...(revealed ? [{ poly: hiddenAt(q), look: "found" as const, label: "✓" }] : []), { poly, look: "trace", missing }]}
        onPoint={([x, y]) => setAt(clamp([Math.round(x - span[0] / 2), Math.round(y - span[1] / 2)]))}
      />
    </Board>
  );

  let status: { tone: "good" | "info" | "warn"; text: string };
  if (missing.length) status = { tone: "warn", text: `${fa(missing.length)} ضلع روی خط‌های شکل نیست (خط‌چین قرمز). کاغذ را جابه‌جا کن.` };
  else if (change) status = { tone: "info", text: "همه ضلع‌ها روی خط‌اند، ولی کاغذ را چرخانده یا وارونه کرده‌ای؛ در پرسش این قبول نیست. «حالت اول» را بزن و دوباره بگرد." };
  else status = { tone: "good", text: "✓ پیدا کردی! همه ضلع‌ها روی خط‌های شکل‌اند، با همان اندازه و همان جهت." };

  const nudge = (dx: number, dy: number) => setAt(clamp([pos[0] + dx, pos[1] + dy]));
  return (
    <>
      <section className={layout.stageWrap} aria-label="صفحه شکل">
        {board}
      </section>
      <section className={layout.controls}>
        <p className={layout.stepText} style={{ margin: 0 }}>
          {missing.length ? `${fa(sidesCount(q.shape) - missing.length)} از ${fa(sidesCount(q.shape))} ضلع روی خط` : "همه ضلع‌ها روی خط"}
        </p>
      </section>
      <aside className={layout.side}>
        {topicPicker}
        <h2>۱. یک شکل بردار</h2>
        <ExampleButtons ex={ex} onEx={(e) => (onEx(e), setRevealed(false), setAt([0, 0]), setTurn(0), setFlipped(false))} />
        <h2 className={layout.progress}>۲. کاغذ پوستی را جابه‌جا کن</h2>
        <p className={layout.note}>{SHAPE_NAME[q.shapeName]} روی کاغذ پوستی (سبز هاشوری) است. روی شکل بزرگ بزن تا کاغذ آنجا برود، یا با پیکان‌ها کمی جابه‌جایش کن. ضلعی که روی هیچ خطی نیست با خط‌چین قرمز می‌آید.</p>
        <div className={layout.row} role="group" aria-label="جابه‌جا کردن">
          <button className={layout.clear} onClick={() => nudge(1, 0)} aria-label="راست">
            →
          </button>
          <button className={layout.clear} onClick={() => nudge(0, 1)} aria-label="بالا">
            ↑
          </button>
          <button className={layout.clear} onClick={() => nudge(0, -1)} aria-label="پایین">
            ↓
          </button>
          <button className={layout.clear} onClick={() => nudge(-1, 0)} aria-label="چپ">
            ←
          </button>
        </div>
        <div className={layout.row}>
          <button className={layout.clear} onClick={() => setTurn((turn + 1) % 4)}>
            چرخاندن ۹۰°
          </button>
          <button className={layout.clear} aria-pressed={flipped} onClick={() => setFlipped(!flipped)}>
            وارونه کردن
          </button>
          <button className={layout.clear} onClick={() => (setTurn(0), setFlipped(false))} disabled={!change}>
            حالت اول
          </button>
        </div>
        <p className={`${layout.status} ${layout[status.tone]}`}>{status.text}</p>
        <button className={layout.clear} onClick={() => setRevealed(true)} disabled={revealed}>
          کجاست؟
        </button>
      </aside>
    </>
  );
}

const sidesCount = (poly: HPt[]) => normal(poly).length;

function HiddenShow({ topicPicker, ex, onEx }: Props) {
  const q = useMemo(() => makeHiddenQuestion(ex.level, ex.seed), [ex.level, ex.seed]);
  // 0: look at the shape; 1–4: each drawing; 5: the answer.
  const steps = useSteps(6, true, 1800);
  const s = steps.step;
  const current = s >= 1 && s <= 4 ? s - 1 : null;
  const seen = (i: number) => s > i;
  let text: string;
  if (s === 0) text = `${SHAPE_NAME[q.shapeName]}: ${fa(sidesCount(q.shape))} ضلع. اندازه‌اش را با خانه‌ها و جهتش را (کدام ضلع پایین است، نوکش کدام طرف است) به خاطر بسپار.`;
  else if (current !== null) text = current === q.answer ? `گزینه ${fa(current + 1)}: همه ضلع‌ها روی خط‌اند، با همان اندازه و جهت. ✓` : `گزینه ${fa(current + 1)}: ${q.mistakes[current] ? SLIP_TEXT[q.mistakes[current]!] : "این شکل اینجا نیست."}`;
  else text = `جواب: گزینه ${fa(q.answer + 1)}. هر ضلع شکل پنهان روی یک خط کشیده‌شده است؛ گاهی فقط تکه‌ای از یک خط بلندتر.`;

  return (
    <>
      <section className={layout.stageWrap} aria-label="صفحه شکل">
        <QuestionBoard q={q} current={current} marks={(i) => (seen(i) ? optionMarks(q, i) : [])} captions={(i) => (seen(i) ? caption(q, i) : null)} />
      </section>
      <section className={layout.controls}>
        <StepBar steps={steps} label={s === 0 ? "شکل" : current !== null ? `گزینه ${fa(current + 1)}` : "جواب"} />
      </section>
      <aside className={layout.side}>
        {topicPicker}
        <h2>گزینه‌ها را یکی‌یکی بگرد</h2>
        <ExampleButtons ex={ex} onEx={(e) => (onEx(e), steps.restart())} />
        <p className={layout.stepText}>{text}</p>
        <p className={layout.note}>هاشور و خط پر = شکل پنهان. خط‌چین آبی با برچسب = شکلی شبیه آن که قبول نیست (چرخیده، وارونه، بزرگ‌تر). خط‌چین قرمز = ضلعی که روی خط نیست.</p>
        <button className={layout.clear} onClick={steps.restart}>
          از اول نشان بده
        </button>
      </aside>
    </>
  );
}

function HiddenTry({ level, seed, picker, initialN, onNew }: Props) {
  const q = useMemo(() => makeHiddenQuestion(level, seed), [level, seed]);
  const [picked, setPicked] = useState<number | null>(initialN !== undefined && initialN >= 1 && initialN <= 4 ? initialN - 1 : null);
  const done = picked !== null;
  const fb = done ? hiddenFeedback(q, picked) : null;
  return (
    <>
      <section className={layout.stageWrap} aria-label="صفحه شکل">
        <QuestionBoard q={q} marks={(i) => (done ? optionMarks(q, i) : [])} onPick={done ? undefined : setPicked} captions={(i) => (done ? caption(q, i) : null)} />
      </section>
      <section className={layout.controls}>
        <p className={layout.stepText} style={{ margin: 0 }}>
          {done ? "هاشور = شکل پنهان؛ خط‌چین = شبیه آن ولی قبول نیست" : "روی یکی از چهار شکل بزن"}
        </p>
      </section>
      <aside className={layout.side}>
        <div className={tryStyles.panel}>
          {picker}
          <p className={tryStyles.prompt}>{hiddenPrompt(q)}</p>
          <ChoiceButtons labels={[1, 2, 3, 4].map((i) => `گزینه ${fa(i)}`)} picked={picked} answer={q.answer} toneOf={(i) => (q.mistakes[i] ? "turned" : "bad")} onPick={setPicked} />
          {!done && <p className={tryStyles.hint}>کمک: یک ضلع مشخص شکل (مثلاً ضلع پایین) را در هر گزینه پیدا کن، بعد ببین بقیه ضلع‌ها هم با همان جهت روی خط‌ها هستند یا نه.</p>}
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

"use client";

// Shared pieces of the hidden-figure and one-stroke parts of tool 5: a step
// player for «نشانم بده», the topic switch, and the question type and level
// picker used in «امتحان کن».

import { useEffect, useState, type ReactNode } from "react";
import type { Level, ShapeQuestionType } from "@/generators/shape-count";
import { fa } from "@/tools/registry";
import layout from "@/toolkit/ToolLayout.module.css";
import tryStyles from "@/toolkit/TryPanel.module.css";

export type LabMode = "explore" | "show" | "try";
export type Topic = "count" | "hidden" | "stroke";

export const TOPIC_LABEL: Record<Topic, string> = { count: "شمارش شکل", hidden: "شکل پنهان", stroke: "رسم بدون برداشتن قلم" };

export function TopicPicker({ topic, onTopic }: { topic: Topic; onTopic: (t: Topic) => void }) {
  return (
    <div className={layout.chipsRow} role="radiogroup" aria-label="مبحث" style={{ flexWrap: "wrap", marginBottom: 8 }}>
      {(Object.keys(TOPIC_LABEL) as Topic[]).map((t) => (
        <button key={t} role="radio" aria-checked={topic === t} onClick={() => onTopic(t)} style={{ flex: "1 1 auto" }}>
          {TOPIC_LABEL[t]}
        </button>
      ))}
    </div>
  );
}

/** Question type and level buttons (same look as the counting panel). */
export function TypeLevelPicker({ labels, type, level, onType, onLevel }: { labels: Record<ShapeQuestionType, string>; type: ShapeQuestionType; level: Level; onType: (t: ShapeQuestionType) => void; onLevel: (l: Level) => void }) {
  return (
    <>
      <div className={tryStyles.types} role="radiogroup" aria-label="نوع پرسش" data-practice-hide>
        {(Object.keys(labels) as ShapeQuestionType[]).map((t) => (
          <button key={t} role="radio" aria-checked={type === t} onClick={() => onType(t)}>
            {labels[t]}
          </button>
        ))}
      </div>
      <div className={tryStyles.chips} role="radiogroup" aria-label="سطح" data-practice-hide>
        {([1, 2, 3] as Level[]).map((l) => (
          <button key={l} role="radio" aria-checked={level === l} onClick={() => onLevel(l)}>
            سطح {fa(l)}
          </button>
        ))}
      </div>
    </>
  );
}

/** Steps 0 … count−1, played one after another. Starts playing when `autoplay`. */
export function useSteps(count: number, autoplay: boolean, ms = 1300) {
  const [step, setStepRaw] = useState(autoplay ? 0 : Math.max(0, count - 1));
  const [playing, setPlaying] = useState(autoplay);
  const last = Math.max(0, count - 1);
  const at = Math.min(step, last);
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      if (at >= last) setPlaying(false);
      else setStepRaw(at + 1);
    }, ms);
    return () => clearTimeout(t);
  }, [playing, at, last, ms]);
  return {
    step: at,
    last,
    playing,
    setStep: (s: number) => {
      setPlaying(false);
      setStepRaw(Math.max(0, Math.min(last, s)));
    },
    play: () => {
      if (playing) return setPlaying(false);
      if (at >= last) setStepRaw(0);
      setPlaying(true);
    },
    restart: () => {
      setStepRaw(0);
      setPlaying(true);
    },
  };
}

export function StepBar({ steps, label }: { steps: ReturnType<typeof useSteps>; label: ReactNode }) {
  return (
    <label className={layout.slider}>
      <button className={layout.playSmall} onClick={steps.play} aria-label={steps.playing ? "توقف" : "پخش"}>
        {steps.playing ? "⏸" : "▶"}
      </button>
      <span>{label}</span>
      <input type="range" min={0} max={steps.last} step={1} value={steps.step} onChange={(e) => steps.setStep(Number(e.target.value))} aria-label="گام‌ها" />
    </label>
  );
}

export type Tone = "good" | "turned" | "bad";
export const ICON: Record<Tone, string> = { good: "✓", turned: "↻", bad: "✗" };

/** Four numbered choice buttons; after a pick, the right one and the picked one get a mark (in a mock exam only the pick is named). */
export function ChoiceButtons({ labels, picked, answer, toneOf, onPick, exam }: { labels: string[]; picked: number | null; answer: number; toneOf: (i: number) => Tone; onPick: (i: number) => void; exam?: boolean }) {
  return (
    <ul className={tryStyles.options} aria-label="گزینه‌ها">
      {labels.map((l, i) => {
        const tone: Tone | null = picked === null || exam ? null : i === answer ? "good" : i === picked ? toneOf(i) : null;
        return (
          <li key={i}>
            <button className={`${tryStyles.option} ${tone ? tryStyles[tone] : ""}`} onClick={() => onPick(i)} disabled={picked !== null} style={{ minHeight: 48 }}>
              <span className={tryStyles.optionNum}>
                {l} {tone && ICON[tone]}
                {exam && i === picked && " · انتخاب تو"}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

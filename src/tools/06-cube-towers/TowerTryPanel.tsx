"use client";

import { useEffect, useMemo, useState } from "react";
import {
  countCubes,
  frontView,
  layerCounts,
  matchesViews,
  paintedCount,
  sideView,
  topView,
  type Level,
  type Tower,
  type TowerQuestion,
  type TowerQuestionType,
} from "@/generators/cube-towers";
import type { Part, Solid } from "@/generators/solids";
import type { Look } from "@/engine-3d/Stage";
import { fa } from "@/tools/registry";
import { HeightGrid, ViewSvg } from "./Pictures";
import { paintWhy } from "./paintText";
import { SolidPictureSvg } from "./SolidPicture";
import { solidFeedback, solidPrompt } from "./solidText";
import styles from "@/toolkit/TryPanel.module.css";

export const TOWER_TYPE_LABEL: Record<TowerQuestionType, string> = {
  count: "شمارش",
  top: "نمای بالا",
  front: "نمای روبرو",
  side: "نمای کنار",
  build: "ساخت از نما",
  complete: "تکمیل مکعب",
  paint: "رنگ کن و ببر",
  solid: "وجه، یال و رأس",
};

const VIEW_NAME = { top: "بالا", front: "روبرو", side: "کنار" } as const;

type Tone = "good" | "turned" | "bad";
const ICON: Record<Tone, string> = { good: "✓", turned: "↻", bad: "✗" };

/** What the 3D stage shows for the current question. */
export type TowerDisplay =
  | {
      scene: "tower";
      tower: Tower;
      showHidden?: boolean;
      ghosts?: [number, number, number][];
      frame?: number;
      look?: Look | null;
      /** Pull layers apart with the playback value once answered. */
      explode?: boolean;
    }
  | { scene: "paint"; n: number; focus: number | null; explode?: boolean }
  /** Solids side by side; `part` is numbered on them (after answering). */
  | { scene: "solid"; solids: Solid[]; part: Part | null; captions?: boolean };

/** The question text; `paper` words it for a printed worksheet. */
export function towerPrompt(q: TowerQuestion, paper = false): string {
  switch (q.type) {
    case "count":
      return paper
        ? "این برج چند مکعب دارد؟ (مکعب‌ها روی هوا نمی‌ایستند.)"
        : `این برج چند مکعب دارد؟ صحنه را بچرخان و بشمار.${q.level > 1 ? " مکعب‌ها روی هوا نمی‌ایستند." : ""}`;
    case "top":
      return "نمای بالای این برج کدام است؟";
    case "front":
      return "نمای روبروی این برج کدام است؟ (از طرف «روبرو»)";
    case "side":
      return "نمای کنار این برج کدام است؟ (از طرف «کنار»، سمت راست)";
    case "build":
      return q.views.top
        ? paper
          ? "روی نمای بالا، در هر خانه تعداد مکعب‌ها را بنویس تا برج با این سه نما جور شود."
          : "برجی بساز که این سه نما را داشته باشد."
        : "فقط نمای روبرو و کنار داده شده. یک برج بساز که با هر دو جور باشد؛ چند جواب ممکن است.";
    case "complete":
      return `چند مکعب دیگر لازم است تا یک مکعب بزرگ ${fa(q.n)}×${fa(q.n)}×${fa(q.n)} کامل شود؟`;
    case "paint": {
      const what = q.k === 0 ? "هیچ وجه رنگی ندارند" : `دقیقاً ${fa(q.k)} وجه رنگی دارند`;
      return `یک مکعب ${fa(q.n)}×${fa(q.n)}×${fa(q.n)} را از بیرون رنگ کرده و به مکعب‌های کوچک بریده‌ایم. چند مکعب کوچک ${what}؟`;
    }
    case "solid":
      return solidPrompt(q, paper);
  }
}

function feedback(q: TowerQuestion, picked: number): { tone: Tone; text: string } {
  if (q.type === "build") return { tone: "bad", text: "" };
  if (q.type === "solid") return solidFeedback(q, q.options[picked]);
  const right = picked === q.answer;
  const mistake = q.mistakes[picked];
  switch (q.type) {
    case "count": {
      const layers = layerCounts(q.tower).map((n, i) => `لایه ${fa(i + 1)}: ${fa(n)}`).join("، ");
      if (right) {
        const hid = q.hidden ? ` ${fa(q.hidden)} مکعب پنهان هم هست که دیده نمی‌شود ولی باید باشد، چون مکعب‌ها روی هوا نمی‌ایستند.` : "";
        return { tone: "good", text: `درست است! ${layers}.${hid}` };
      }
      if (mistake === "visibleOnly")
        return { tone: "turned", text: "نزدیک بود! فقط مکعب‌های دیده‌شده را شمردی. زیر مکعب‌های بالایی هم مکعب هست؛ لایه‌ها را ببین." };
      return { tone: "bad", text: `نه؛ لایه به لایه بشمار: ${layers}.` };
    }
    case "top":
    case "front":
    case "side": {
      if (right) return { tone: "good", text: `درست است! دوربین را به نمای ${VIEW_NAME[q.type]} بردیم تا ببینی.` };
      if (mistake === "mirrored") return { tone: "turned", text: "نزدیک بود! شکل درست است ولی برعکس؛ انگار از طرف مقابل نگاه کرده‌ای." };
      if (mistake === "otherView") return { tone: "bad", text: `این نمای ${q.type === "front" ? "کنار" : "روبرو"} است، نه ${VIEW_NAME[q.type]}.` };
      return { tone: "bad", text: `یک خانه فرق دارد. دوربین را به نمای ${VIEW_NAME[q.type]} بردیم؛ دوباره نگاه کن.` };
    }
    case "complete": {
      const have = countCubes(q.tower);
      const why = `مکعب بزرگ ${fa(q.n ** 3)} مکعب دارد و ${fa(have)} تا هست، پس ${fa(q.n ** 3 - have)} تا لازم است.`;
      if (right) return { tone: "good", text: `درست است! ${why}` };
      if (mistake === "counted") return { tone: "bad", text: `این تعداد مکعب‌هایی است که الان هست، نه آن‌هایی که کم است. ${why}` };
      return { tone: "bad", text: `نه. ${why}` };
    }
    case "paint": {
      if (right) return { tone: "good", text: `درست است! ${paintWhy(q.n, q.k)}` };
      const j = [0, 1, 2, 3].find((kk) => kk !== q.k && paintedCount(q.n, kk) === q.options[picked]);
      const which = j === undefined ? "" : `این تعداد مکعب‌هایی است که ${j === 0 ? "هیچ وجه رنگی ندارند" : `${fa(j)} وجه رنگی دارند`}. `;
      return { tone: "bad", text: `${which}${paintWhy(q.n, q.k)}` };
    }
  }
}

/** Every empty slot inside an n×n×n cube above a tower: the cubes still missing. */
export function missingCubes(t: Tower, n: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) for (let z = t.h[y][x]; z < n; z++) out.push([x, y, z]);
  return out;
}

interface Props {
  question: TowerQuestion;
  type: TowerQuestionType;
  level: Level;
  initialPick?: number;
  /** The child's tower in "build" questions (lifted, so 3D taps can edit it too). */
  build: Tower;
  onBuild: (t: Tower) => void;
  onType: (t: TowerQuestionType) => void;
  onLevel: (l: Level) => void;
  onNew: () => void;
  onAnswered: () => void;
  onDisplay: (d: TowerDisplay) => void;
}

export function TowerTryPanel(p: Props) {
  const { question: q, build } = p;
  const [picked, setPicked] = useState<number | null>(p.initialPick ?? null);
  const [checked, setChecked] = useState(false);
  const [remove, setRemove] = useState(false);
  const answered = picked !== null || checked;

  const display = useMemo<TowerDisplay>(() => {
    switch (q.type) {
      case "count":
        return { scene: "tower", tower: q.tower, showHidden: answered, explode: answered };
      case "top":
      case "front":
      case "side":
        return { scene: "tower", tower: q.tower, look: answered ? q.type : null };
      case "build":
        return { scene: "tower", tower: build };
      case "complete":
        return { scene: "tower", tower: q.tower, frame: q.n, ghosts: answered ? missingCubes(q.tower, q.n) : [] };
      case "paint":
        return { scene: "paint", n: q.n, focus: answered ? q.k : null, explode: answered };
      case "solid":
        // A pictured solid can be turned before answering; named or hidden ones appear once answered.
        if (q.kind === "count") return { scene: "solid", solids: [q.solid], part: answered ? q.part : null };
        if (!answered) return { scene: "solid", solids: [], part: null };
        return { scene: "solid", solids: q.kind === "combine" ? q.solids : [q.solid], part: q.part, captions: true };
    }
  }, [q, build, answered]);

  const { onDisplay } = p;
  useEffect(() => onDisplay(display), [display, onDisplay]);

  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    p.onAnswered();
  };

  let fb: { tone: Tone; text: string } | null = picked !== null ? feedback(q, picked) : null;
  if (q.type === "build" && checked) {
    const ok = matchesViews(build, q.views);
    if (ok)
      fb = {
        tone: "good",
        text: `آفرین! برجت با همه نماها جور است و ${fa(countCubes(build))} مکعب دارد. با این نماها کمترین ${fa(q.min)} و بیشترین ${fa(q.max)} مکعب ممکن است${q.solutions > 1 ? `؛ ${fa(q.solutions)} برج مختلف جواب درست‌اند` : ""}.`,
      };
    else {
      const bad: string[] = [];
      if (q.views.top && JSON.stringify(topView(build)) !== JSON.stringify(q.views.top)) bad.push("بالا");
      if (JSON.stringify(frontView(build)) !== JSON.stringify(q.views.front)) bad.push("روبرو");
      if (JSON.stringify(sideView(build)) !== JSON.stringify(q.views.side)) bad.push("کنار");
      fb = { tone: "bad", text: `نمای ${bad.join(" و ")} با برجت جور نیست. نماهای برج خودت را زیر نماهای خواسته‌شده ببین، درستش کن و دوباره بررسی کن.` };
    }
  }

  const mark = (i: number): Tone | null => {
    if (picked === null || q.type === "build") return null;
    if (i === q.answer) return "good";
    if (i === picked) {
      if (q.type === "solid") return solidFeedback(q, q.options[i]).tone === "turned" ? "turned" : "bad";
      return q.mistakes[i] === "visibleOnly" || q.mistakes[i] === "mirrored" ? "turned" : "bad";
    }
    return null;
  };

  return (
    <div className={styles.panel}>
      <div className={styles.types} role="radiogroup" aria-label="نوع پرسش">
        {(Object.keys(TOWER_TYPE_LABEL) as TowerQuestionType[]).map((t) => (
          <button key={t} role="radio" aria-checked={p.type === t} onClick={() => p.onType(t)}>
            {TOWER_TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      <div className={styles.chips} role="radiogroup" aria-label="سطح">
        {([1, 2, 3] as Level[]).map((l) => (
          <button key={l} role="radio" aria-checked={p.level === l} onClick={() => p.onLevel(l)}>
            سطح {fa(l)}
          </button>
        ))}
      </div>

      <p className={styles.prompt}>{towerPrompt(q)}</p>

      {q.type === "solid" && q.kind === "count" && (
        <div className={styles.cube}>
          <SolidPictureSvg solid={q.solid} size={160} />
        </div>
      )}

      {/* Number answers */}
      {(q.type === "count" || q.type === "complete" || q.type === "paint" || q.type === "solid") && (
        <ul className={styles.tiles}>
          {q.options.map((v, i) => {
            const m = mark(i);
            return (
              <li key={i}>
                <button className={`${styles.option} ${m ? styles[m] : ""}`} onClick={() => pick(i)} disabled={picked !== null}>
                  <span className={styles.bigNumber}>{fa(v)}</span>
                  {m && <span className={styles.optionNum}>{ICON[m]}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* View answers */}
      {(q.type === "top" || q.type === "front" || q.type === "side") && (
        <ul className={styles.options}>
          {q.options.map((pic, i) => {
            const m = mark(i);
            return (
              <li key={i}>
                <button className={`${styles.option} ${m ? styles[m] : ""}`} onClick={() => pick(i)} disabled={picked !== null} aria-label={`گزینه ${fa(i + 1)}`}>
                  <ViewSvg pic={pic} size={96} />
                  <span className={styles.optionNum}>
                    {fa(i + 1)} {m && ICON[m]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Build from views */}
      {q.type === "build" && (
        <>
          <div className={styles.viewRow}>
            {q.views.top && (
              <figure>
                <ViewSvg pic={{ kind: "top", cells: q.views.top }} size={80} label="نمای بالا" />
                <figcaption>بالا</figcaption>
              </figure>
            )}
            <figure>
              <ViewSvg pic={{ kind: "cols", heights: q.views.front }} size={80} label="نمای روبرو" />
              <figcaption>روبرو</figcaption>
            </figure>
            <figure>
              <ViewSvg pic={{ kind: "cols", heights: q.views.side }} size={80} label="نمای کنار" />
              <figcaption>کنار</figcaption>
            </figure>
          </div>
          <p className={styles.hint}>روی خانه‌ها (یا مکعب‌های صحنه) بزن تا مکعب اضافه شود.</p>
          <div className={styles.chips} role="radiogroup" aria-label="افزودن یا برداشتن">
            <button role="radio" aria-checked={!remove} onClick={() => setRemove(false)}>
              افزودن
            </button>
            <button role="radio" aria-checked={remove} onClick={() => setRemove(true)}>
              برداشتن
            </button>
          </div>
          <HeightGrid
            tower={build}
            maxH={3}
            remove={remove}
            onChange={(x, y, h) => {
              const next = { ...build, h: build.h.map((r) => [...r]) };
              next.h[y][x] = h;
              p.onBuild(next);
              setChecked(false);
            }}
          />
          {checked && !matchesViews(build, q.views) && (
            <div className={styles.viewRow}>
              {q.views.top && (
                <figure>
                  <ViewSvg pic={{ kind: "top", cells: topView(build) }} size={64} />
                  <figcaption>بالای برج تو</figcaption>
                </figure>
              )}
              <figure>
                <ViewSvg pic={{ kind: "cols", heights: frontView(build) }} size={64} />
                <figcaption>روبروی برج تو</figcaption>
              </figure>
              <figure>
                <ViewSvg pic={{ kind: "cols", heights: sideView(build) }} size={64} />
                <figcaption>کنار برج تو</figcaption>
              </figure>
            </div>
          )}
          <button
            className={styles.secondary}
            disabled={!countCubes(build)}
            onClick={() => {
              setChecked(true);
              p.onAnswered();
            }}
          >
            بررسی
          </button>
        </>
      )}

      {fb && (
        <p className={`${styles.feedback} ${styles[fb.tone]}`} role="status" aria-live="polite">
          <span className={styles.icon}>{ICON[fb.tone]}</span> {fb.text}
        </p>
      )}

      <button className={styles.next} onClick={p.onNew}>
        نمونه تازه
      </button>
    </div>
  );
}


"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FILL_NAME, SHAPE_NAME, type Level, type PatternQuestion, type PatternQuestionType, type Tag, type Tile } from "@/generators/patterns";
import { fa } from "@/tools/registry";
import { PatchSvg, TileSvg } from "./Pictures";
import { DROP_ATTR } from "./Scene";
import styles from "@/toolkit/TryPanel.module.css";

export const PATTERN_TYPE_LABEL: Record<PatternQuestionType, string> = {
  matrix2: "ماتریس ۲×۲",
  matrix3: "ماتریس ۳×۳",
  sequence: "دنباله تصویری",
  rotation: "الگوی چرخشی",
  combine: "جمع و تفریق شکل",
  sides: "ضلع و نقطه",
  missing: "قطعه گمشده",
  odd: "شکل متفاوت",
};

/** The one thing a wrong option got wrong, in words. */
const TAG_NAME: Partial<Record<Tag, string>> = {
  turn: "چرخش",
  count: "تعداد",
  shape: "شکل",
  fill: "رنگ و نقش",
  lines: "خط‌ها",
  marks: "جای نشانه‌ها",
  arrow: "جهت پیکان",
  sides: "تعداد ضلع‌ها",
  dots: "تعداد نقطه‌ها",
};

export function patternPrompt(q: PatternQuestion, paper = false): string {
  switch (q.type) {
    case "matrix2":
    case "matrix3":
      return "کدام گزینه جای «؟» را پر می‌کند؟ سطرها را از راست به چپ بخوان.";
    case "sequence":
      return "دنباله از راست به چپ است. خانه بعدی کدام است؟";
    case "rotation":
      return "نشانه‌ها دور قاب حرکت می‌کنند. خانه بعدی کدام است؟";
    case "sides":
      return "ضلع‌ها و نقطه‌ها را بشمار. خانه بعدی کدام است؟";
    case "combine":
      return q.level === 1
        ? "دو شکل را روی هم بگذار. کدام می‌شود؟"
        : q.level === 2
          ? "دو شکل را روی هم بگذار و خط‌های مشترک را پاک کن. کدام می‌شود؟"
          : "در هر سطر، خانه سوم از روی‌هم‌گذاشتن دو خانه اول ساخته شده. جای «؟» کدام است؟";
    case "missing":
      return "کدام تکه جای خالی تصویر را پر می‌کند؟";
    case "odd":
      return paper ? "کدام شکل با بقیه فرق دارد؟" : "کدام شکل با بقیه فرق دارد؟ روی آن بزن (روی صفحه یا این‌جا).";
  }
}

/** A tile in words, when it is made of shapes. */
export function tileWords(t: Tile): string {
  if (!t.shape) return "";
  const turn = t.turn ? `، ${fa(t.turn * 45)} درجه چرخیده` : "";
  return `${fa(t.count ?? 1)} ${SHAPE_NAME[t.shape]} ${FILL_NAME[t.fill ?? "white"]}${turn}`;
}

type Tone = "good" | "turned" | "bad";
const ICON: Record<Tone, string> = { good: "✓", turned: "↻", bad: "✗" };

function feedback(q: PatternQuestion, picked: number): { tone: Tone; text: string } {
  if (q.type === "odd") return picked === q.answer ? { tone: "good", text: `درست است! ${q.why}` } : { tone: "bad", text: `این نه. شکل ${fa(q.answer + 1)} فرق دارد: ${q.why}` };
  if (picked === q.answer) return { tone: "good", text: "درست است! قانون‌ها را روی صفحه یکی‌یکی ببین." };
  const tag = q.tags[picked];
  switch (tag) {
    case "copy":
      return { tone: "bad", text: "این همان خانه کناری است؛ ولی الگو در هر خانه تغییر می‌کند." };
    case "otherOp":
      return {
        tone: "turned",
        text: q.type === "combine" && q.level === 1 ? "نزدیک بود! روی‌هم‌گذاشتن یعنی همه خط‌ها می‌مانند؛ هیچ خطی پاک نمی‌شود." : "نزدیک بود! خط‌ها درست انتخاب شده‌اند، ولی قانون این‌جا فرق دارد: ببین خط‌های مشترک می‌مانند یا پاک می‌شوند.",
      };
    case "patchShift":
      return { tone: "bad", text: "این تکه از جای دیگری از همین تصویر است؛ به خانه‌های دور جای خالی نگاه کن." };
    case "patchMirror":
      return { tone: "turned", text: "نزدیک بود! همین خانه‌هاست ولی جابه‌جا چیده شده؛ ترتیب را با خانه‌های کناری بسنج." };
    case "patchTile":
      return { tone: "turned", text: "نزدیک بود! فقط یکی از چهار خانه اشتباه است." };
    default:
      return { tone: "turned", text: `نزدیک بود! همه‌چیز درست است جز «${TAG_NAME[tag] ?? "یک چیز"}».` };
  }
}

/** Is the screen point over a blank of the board? */
function overBlank(x: number, y: number): boolean {
  return [...document.querySelectorAll(`[${DROP_ATTR}]`)].some((el) => {
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  });
}

/** Size of the card that follows the pointer (px). */
const GHOST = 84;

interface Ghost {
  i: number;
  /** Top-left corner on screen, and the card's size. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Sliding back to its place after a drop somewhere else. */
  back: boolean;
}

/**
 * Dragging an option onto the «؟» of the board. Pointer events, so mouse,
 * pen and touch all work; a press that does not move is an ordinary tap
 * (and Enter or Space on the focused option still choose it). Dropped
 * anywhere but the blank, the card slides back to its place.
 */
function useOptionDrag(enabled: boolean, onDrop: (i: number) => void, onHover: (over: boolean) => void) {
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const drag = useRef<{ i: number; id: number; sx: number; sy: number; home: DOMRect; moved: boolean; over: boolean; py: number } | null>(null);
  const swallowClick = useRef(false);
  const scrollFrame = useRef(0);
  const backTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      cancelAnimationFrame(scrollFrame.current);
      clearTimeout(backTimer.current);
    },
    [],
  );

  // On phones the board sits above the options: near the screen's top or bottom edge, scroll.
  const autoScroll = () => {
    cancelAnimationFrame(scrollFrame.current);
    const tick = () => {
      const d = drag.current;
      if (!d?.moved) return;
      const edge = 70;
      const v = d.py < edge ? -Math.ceil((edge - d.py) / 6) : d.py > window.innerHeight - edge ? Math.ceil((d.py - window.innerHeight + edge) / 6) : 0;
      if (v) window.scrollBy(0, v);
      scrollFrame.current = requestAnimationFrame(tick);
    };
    scrollFrame.current = requestAnimationFrame(tick);
  };

  const end = (dropped: boolean) => {
    const d = drag.current;
    drag.current = null;
    cancelAnimationFrame(scrollFrame.current);
    if (!d?.moved) return;
    onHover(false);
    if (dropped) {
      setGhost(null);
      onDrop(d.i);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setGhost(null);
    // Snap back: slide to where the option sits now (the page may have scrolled).
    const home = document.querySelector(`[data-option="${d.i}"]`)?.getBoundingClientRect() ?? d.home;
    setGhost((g) => (g ? { ...g, x: home.left + (home.width - g.w) / 2, y: home.top + (home.height - g.h) / 2, back: true } : g));
    clearTimeout(backTimer.current);
    backTimer.current = setTimeout(() => setGhost(null), 230);
  };

  const props = (i: number) =>
    enabled
      ? {
          "data-option": i,
          style: { touchAction: "none" as const, opacity: ghost?.i === i ? 0.35 : undefined },
          onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
            swallowClick.current = false;
            if (e.button !== 0 || ghost) return;
            const home = e.currentTarget.getBoundingClientRect();
            drag.current = { i, id: e.pointerId, sx: e.clientX, sy: e.clientY, home, moved: false, over: false, py: e.clientY };
            e.currentTarget.setPointerCapture(e.pointerId);
          },
          onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => {
            const d = drag.current;
            if (!d || d.id !== e.pointerId) return;
            if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 8) return;
            if (!d.moved) {
              d.moved = true;
              swallowClick.current = true;
              autoScroll();
            }
            d.py = e.clientY;
            // A small card centred on the pointer, so the frame of the «؟» under it stays in sight.
            setGhost({ i, x: e.clientX - GHOST / 2, y: e.clientY - GHOST / 2, w: GHOST, h: GHOST, back: false });
            const over = overBlank(e.clientX, e.clientY);
            if (over !== d.over) {
              d.over = over;
              onHover(over);
            }
          },
          onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
            if (drag.current?.id === e.pointerId) end(overBlank(e.clientX, e.clientY));
          },
          onPointerCancel: () => end(false),
        }
      : {};

  /** A click right after a drag is the end of that drag, not a tap. */
  const isDragClick = () => {
    const was = swallowClick.current;
    swallowClick.current = false;
    return was;
  };

  return { ghost, props, isDragClick };
}

interface Props {
  question: PatternQuestion;
  type: PatternQuestionType;
  level: Level;
  picked: number | null;
  onPick: (i: number) => void;
  /** An option is being dragged over the blank (or not any more). */
  onDropHover?: (over: boolean) => void;
  onType: (t: PatternQuestionType) => void;
  onLevel: (l: Level) => void;
  onNew: () => void;
}

export function PatternTryPanel(p: Props) {
  const { question: q, picked } = p;
  const [rulesOpen, setRulesOpen] = useState(false);
  // «شکل متفاوت» is chosen on the board itself; every other type can be dragged into the blank.
  const draggable = q.type !== "odd" && picked === null;
  const { ghost, props: dragProps, isDragClick } = useOptionDrag(draggable, p.onPick, (over) => p.onDropHover?.(over));
  const picture = (o: Tile | Tile[], size?: number) =>
    q.type === "missing" ? <PatchSvg tiles={o as Tile[]} size={size ?? 84} /> : <TileSvg tile={o as Tile} size={size ?? (q.type === "odd" ? 48 : 72)} />;
  const fb = picked !== null ? feedback(q, picked) : null;
  const mark = (i: number): Tone | null => {
    if (picked === null) return null;
    if (i === q.answer) return "good";
    return i === picked ? feedback(q, i).tone : null;
  };
  // Rule sentences: the general ones if there are any, else the step-by-step ones.
  const whys = q.type === "odd" ? [] : q.why;
  const summaries = whys.some((w) => !w.cells.length) ? whys.filter((w) => !w.cells.length) : whys;

  return (
    <div className={styles.panel}>
      <div className={styles.types} role="radiogroup" aria-label="نوع پرسش">
        {(Object.keys(PATTERN_TYPE_LABEL) as PatternQuestionType[]).map((t) => (
          <button key={t} role="radio" aria-checked={p.type === t} onClick={() => p.onType(t)}>
            {PATTERN_TYPE_LABEL[t]}
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

      <p className={styles.prompt}>{patternPrompt(q)}</p>
      {draggable && <p className={styles.hint}>گزینه را بکش و روی «؟» رها کن، یا روی گزینه بزن.</p>}

      <ul className={styles.options} style={q.type === "odd" ? { gridTemplateColumns: "repeat(5, minmax(0, 1fr))" } : q.options.length === 6 ? { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" } : undefined}>
        {(q.type === "odd" ? q.tiles : q.options).map((o, i) => {
          const m = mark(i);
          return (
            <li key={i}>
              <button
                className={`${styles.option} ${m ? styles[m] : ""}`}
                onClick={() => {
                  if (!isDragClick()) p.onPick(i);
                }}
                disabled={picked !== null}
                aria-label={`گزینه ${fa(i + 1)}`}
                {...dragProps(i)}
              >
                {picture(o)}
                <span className={styles.optionNum}>
                  {fa(i + 1)} {m && ICON[m]}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {ghost &&
        createPortal(
          <div
            aria-hidden
            className={styles.option}
            style={{
              position: "fixed",
              left: ghost.x,
              top: ghost.y,
              width: ghost.w,
              height: ghost.h,
              zIndex: 1000,
              pointerEvents: "none",
              opacity: 0.92,
              borderColor: "var(--accent)",
              boxShadow: ghost.back ? "none" : "0 10px 24px rgba(31, 36, 48, 0.28)",
              transform: ghost.back ? "none" : "scale(1.06)",
              transition: ghost.back ? "left 0.2s ease-out, top 0.2s ease-out, transform 0.2s" : "none",
              justifyContent: "center",
            }}
          >
            {picture(q.type === "odd" ? q.tiles[ghost.i] : q.options[ghost.i], GHOST - 22)}
          </div>,
          document.body,
        )}

      {fb && (
        <p className={`${styles.feedback} ${styles[fb.tone]}`} role="status" aria-live="polite">
          <span className={styles.icon}>{ICON[fb.tone]}</span> {fb.text}
        </p>
      )}
      {picked !== null && summaries.length > 0 && (
        <>
          <button className={styles.secondary} onClick={() => setRulesOpen((o) => !o)} aria-expanded={rulesOpen}>
            {rulesOpen ? "پنهان کردن قانون‌ها" : "قانون‌ها چه بود؟"}
          </button>
          {rulesOpen && (
            <ul className={styles.hint} style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.9 }}>
              {summaries.map((w, i) => (
                <li key={i}>{w.text}</li>
              ))}
            </ul>
          )}
        </>
      )}
      {picked !== null && q.type !== "odd" && <p className={styles.hint}>روی صفحه، قانون هر سطر و ستون جداگانه برجسته می‌شود؛ با نوار پایین جلو و عقب ببر.</p>}

      <button className={styles.next} onClick={p.onNew}>
        نمونه تازه
      </button>
    </div>
  );
}

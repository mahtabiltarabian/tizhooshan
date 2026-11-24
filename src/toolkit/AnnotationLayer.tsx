"use client";

// Pen and text drawn over a stage, as a teacher would on a whiteboard.
// Positions are stored as fractions of the stage size, so drawings stay in
// place when the window or projector resolution changes. Nothing is saved.

import { useRef, useState, type PointerEvent } from "react";
import styles from "./AnnotationLayer.module.css";

export type DrawTool = "none" | "pen" | "text";

export type Annotation =
  | { kind: "stroke"; color: string; points: [number, number][] }
  | { kind: "text"; color: string; x: number; y: number; text: string };

export const PEN_COLORS = ["#e5484d", "#4f46e5", "#0f172a"];

interface AnnotationLayerProps {
  tool: DrawTool;
  color: string;
  items: Annotation[];
  onAdd: (a: Annotation) => void;
}

export function AnnotationLayer({ tool, color, items, onAdd }: AnnotationLayerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState<[number, number][] | null>(null);
  const [draft, setDraft] = useState<{ x: number; y: number; text: string } | null>(null);

  const at = (e: PointerEvent): [number, number] => {
    const r = ref.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (tool === "pen") {
      e.currentTarget.setPointerCapture(e.pointerId);
      setCurrent([at(e)]);
    } else if (tool === "text" && !draft) {
      const [x, y] = at(e);
      setDraft({ x, y, text: "" });
    }
  };

  const move = (e: PointerEvent) => {
    if (current) setCurrent([...current, at(e)]);
  };

  const up = () => {
    if (current && current.length > 1) onAdd({ kind: "stroke", color, points: current });
    setCurrent(null);
  };

  const commitText = () => {
    if (draft?.text.trim()) onAdd({ kind: "text", color, x: draft.x, y: draft.y, text: draft.text.trim() });
    setDraft(null);
  };

  const strokes = [...items.filter((a) => a.kind === "stroke"), ...(current ? [{ kind: "stroke" as const, color, points: current }] : [])];

  return (
    <div
      ref={ref}
      className={`${styles.layer} ${tool !== "none" ? styles.active : ""} ${tool === "text" ? styles.textMode : ""}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden>
        {strokes.map((s, i) => (
          <polyline
            key={i}
            points={s.points.map(([x, y]) => `${x * 1000},${y * 1000}`).join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {items.map(
        (a, i) =>
          a.kind === "text" && (
            <span key={i} className={styles.text} style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, color: a.color }}>
              {a.text}
            </span>
          ),
      )}
      {draft && (
        <input
          className={styles.input}
          style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, color }}
          autoFocus
          value={draft.text}
          placeholder="بنویس و Enter بزن"
          onChange={(e) => setDraft({ ...draft, text: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitText();
            if (e.key === "Escape") setDraft(null);
          }}
          onBlur={commitText}
          onPointerDown={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
}

/** Paint annotations onto a 2D canvas of size w×h (used when saving an image). */
export function paintAnnotations(ctx: CanvasRenderingContext2D, items: Annotation[], w: number, h: number, scale: number) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const a of items) {
    if (a.kind === "stroke") {
      ctx.strokeStyle = a.color;
      ctx.lineWidth = 5 * scale;
      ctx.beginPath();
      a.points.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
      ctx.stroke();
    } else {
      ctx.fillStyle = a.color;
      ctx.font = `700 ${24 * scale}px Vazirmatn, sans-serif`;
      ctx.direction = "rtl";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(a.text, a.x * w, a.y * h);
    }
  }
}

"use client";

import { PEN_COLORS, type DrawTool } from "./AnnotationLayer";
import styles from "./Toolbar.module.css";

interface ToolbarProps {
  tool: DrawTool;
  color: string;
  canUndo: boolean;
  onTool: (t: DrawTool) => void;
  onColor: (c: string) => void;
  onUndo: () => void;
  onClear: () => void;
  onZoom: (factor: number) => void;
  onReset: () => void;
  onSave: () => void;
}

/** Shared toolbar for every stage: drawing, view and saving. */
export function Toolbar(p: ToolbarProps) {
  const toggle = (t: DrawTool) => p.onTool(p.tool === t ? "none" : t);
  return (
    <div className={styles.bar} role="toolbar" aria-label="ابزارهای صفحه">
      <button aria-pressed={p.tool === "pen"} onClick={() => toggle("pen")} title="قلم">
        <span aria-hidden>✎</span>
        <small>قلم</small>
      </button>
      <button aria-pressed={p.tool === "text"} onClick={() => toggle("text")} title="نوشتن متن">
        <span aria-hidden>T</span>
        <small>متن</small>
      </button>
      {p.tool !== "none" && (
        <div className={styles.colors} role="radiogroup" aria-label="رنگ قلم">
          {PEN_COLORS.map((c, i) => (
            <button
              key={c}
              role="radio"
              aria-checked={p.color === c}
              aria-label={["قرمز", "آبی", "سیاه"][i]}
              style={{ background: c }}
              onClick={() => p.onColor(c)}
            />
          ))}
        </div>
      )}
      <button onClick={p.onUndo} disabled={!p.canUndo} title="واگرد">
        <span aria-hidden>↶</span>
        <small>واگرد</small>
      </button>
      <button onClick={p.onClear} disabled={!p.canUndo} title="پاک کردن همه نوشته‌ها">
        <span aria-hidden>⌫</span>
        <small>پاک</small>
      </button>
      <hr />
      <button onClick={() => p.onZoom(0.8)} title="بزرگ‌نمایی">
        <span aria-hidden>+</span>
        <small>بزرگ</small>
      </button>
      <button onClick={() => p.onZoom(1.25)} title="کوچک‌نمایی">
        <span aria-hidden>−</span>
        <small>کوچک</small>
      </button>
      <button onClick={p.onReset} title="نمای اول">
        <span aria-hidden>⌂</span>
        <small>نمای اول</small>
      </button>
      <hr />
      <button onClick={p.onSave} title="ذخیره تصویر صفحه">
        <span aria-hidden>⤓</span>
        <small>تصویر</small>
      </button>
    </div>
  );
}

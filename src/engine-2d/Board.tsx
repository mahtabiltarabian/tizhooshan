"use client";

// Shared stage for 2D tools: an SVG drawing that fills the stage, with the
// same toolbar as the 3D stage (pen, text, undo, zoom, first view, save
// image). Zoom scales the view box about its centre. Nothing is loaded from
// the network.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { AnnotationLayer, paintAnnotations, PEN_COLORS, type Annotation, type DrawTool } from "@/toolkit/AnnotationLayer";
import { Toolbar } from "@/toolkit/Toolbar";
import styles from "@/engine-3d/Stage.module.css";

interface BoardProps {
  /** The drawing's own coordinates: [x, y, width, height]. */
  view: [number, number, number, number];
  children: ReactNode;
  imageName?: string;
  label?: string;
}

const BG = "#efe5d3";
const PHONE = "(max-width: 900px)";

type Box = [number, number, number, number];

/** Union of two boxes. */
const unite = (a: Box, b: Box): Box => {
  const x0 = Math.min(a[0], b[0]);
  const y0 = Math.min(a[1], b[1]);
  return [x0, y0, Math.max(a[0] + a[2], b[0] + b[2]) - x0, Math.max(a[1] + a[3], b[1] + b[3]) - y0];
};

/** The view box for a box at a zoom, zooming about its centre. */
const viewBoxOf = ([x, y, w, h]: Box, zoom: number) => {
  const zw = w / zoom;
  const zh = h / zoom;
  return `${x + (w - zw) / 2} ${y + (h - zh) / 2} ${zw} ${zh}`;
};

/**
 * On phones the tool's view (drawn for a wide smart board) is cut down to
 * what is actually drawn, so the drawing fills the narrow screen, and the
 * stage takes the drawing's shape (--fit). The box only grows while the same
 * view is shown, so moving pieces never jump out of sight; a new view starts
 * again. It is applied to the DOM straight after each render, before paint.
 */
function usePhoneFit(
  stage: RefObject<HTMLDivElement | null>,
  svg: RefObject<SVGSVGElement | null>,
  content: RefObject<SVGGElement | null>,
  view: Box,
  zoom: number,
  wideViewBox: string,
) {
  const fit = useRef<{ key: string; box: Box } | null>(null);
  const [, setWidth] = useState(0);
  const key = view.join(",");

  // Re-render when the screen crosses the phone breakpoint.
  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const update = () => setWidth(window.innerWidth);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useLayoutEffect(() => {
    const el = svg.current;
    const g = content.current;
    const st = stage.current;
    if (!el || !g || !st) return;
    if (!window.matchMedia(PHONE).matches) {
      if (fit.current) {
        fit.current = null;
        st.style.removeProperty("--fit");
        el.setAttribute("viewBox", wideViewBox);
      }
      return;
    }
    const b = g.getBBox();
    if (b.width <= 0 || b.height <= 0) return;
    // Never larger than the tool's own view, with a small margin around.
    const pad = Math.max(b.width, b.height) * 0.04;
    const [vx, vy, vw, vh] = view;
    const x0 = Math.max(vx, b.x - pad);
    const y0 = Math.max(vy, b.y - pad);
    const box: Box = [x0, y0, Math.min(vx + vw, b.x + b.width + pad) - x0, Math.min(vy + vh, b.y + b.height + pad) - y0];
    const next = fit.current?.key === key ? unite(fit.current.box, box) : box;
    fit.current = { key, box: next };
    el.setAttribute("viewBox", viewBoxOf(next, zoom));
    st.style.setProperty("--fit", `${next[2]} / ${next[3]}`);
  });
}

export function Board({ view, children, imageName = "tizhooshan", label }: BoardProps) {
  const stage = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const content = useRef<SVGGElement>(null);
  const [tool, setTool] = useState<DrawTool>("none");
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [notes, setNotes] = useState<Annotation[]>([]);
  const [zoom, setZoom] = useState(1);

  // Room at the side for the toolbar, which floats over the stage. (On phones
  // usePhoneFit replaces this view box and the toolbar gets its own strip.)
  const [x, y, w, h] = view;
  const viewBox = viewBoxOf([x, y, w * 1.1, h], zoom);
  usePhoneFit(stage, svg, content, view, zoom, viewBox);

  // The drawing plus whatever was written on top, as one PNG.
  const saveImage = () => {
    const el = svg.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const scale = 2;
    const copy = el.cloneNode(true) as SVGSVGElement;
    copy.setAttribute("width", String(r.width));
    copy.setAttribute("height", String(r.height));
    const src = new XMLSerializer().serializeToString(copy);
    const img = new Image();
    img.onload = () => {
      const out = document.createElement("canvas");
      out.width = r.width * scale;
      out.height = r.height * scale;
      const ctx = out.getContext("2d")!;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(img, 0, 0, out.width, out.height);
      paintAnnotations(ctx, notes, out.width, out.height, scale);
      out.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${imageName}-${new Date().toISOString().slice(0, 10)}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, "image/png");
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(src)}`;
  };

  return (
    <div ref={stage} className={styles.stage}>
      <svg
        ref={svg}
        className={styles.drawing}
        xmlns="http://www.w3.org/2000/svg"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={label}
      >
        <g ref={content}>{children}</g>
      </svg>

      <AnnotationLayer tool={tool} color={color} items={notes} onAdd={(a) => setNotes((n) => [...n, a])} />

      <Toolbar
        tool={tool}
        color={color}
        canUndo={notes.length > 0}
        onTool={setTool}
        onColor={setColor}
        onUndo={() => setNotes((n) => n.slice(0, -1))}
        onClear={() => setNotes([])}
        onZoom={(f) => setZoom((z) => Math.min(3, Math.max(0.6, z / f)))}
        onReset={() => setZoom(1)}
        onSave={saveImage}
      />
    </div>
  );
}

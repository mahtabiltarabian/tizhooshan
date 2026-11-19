import { CanvasTexture, SRGBColorSpace } from "three";

/** A wide transparent texture with one line of dark text (Persian), for labels in a 3D scene. */
export function textTexture(text: string, width = 512, height = 128): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.font = `700 ${height * 0.55}px Vazirmatn, sans-serif`;
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#1f2430";
  ctx.fillText(text, width / 2, height * 0.55);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Diagonal dark stripes, for marking something without relying on colour. */
export function hatchTexture(size = 128): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#1f2430";
  ctx.lineWidth = size * 0.09;
  for (let d = -size; d < size * 2; d += size * 0.25) {
    ctx.beginPath();
    ctx.moveTo(d, 0);
    ctx.lineTo(d - size, size);
    ctx.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

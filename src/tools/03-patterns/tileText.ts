// A tile in words. Plain code (no React): the try panel, the tool and the
// adapter (which the server imports too) all use it.

import { FILL_NAME, SHAPE_NAME, type Tile } from "@/generators/patterns";
import { fa } from "@/tools/registry";

/** A tile in words, when it is made of shapes. */
export function tileWords(t: Tile): string {
  if (!t.shape) return "";
  const turn = t.turn ? `، ${fa(t.turn * 45)} درجه چرخیده` : "";
  return `${fa(t.count ?? 1)} ${SHAPE_NAME[t.shape]} ${FILL_NAME[t.fill ?? "white"]}${turn}`;
}

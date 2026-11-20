// The "order" pictures in words. Plain code (no React): the pictures, the
// try panel, the worksheet and the adapter (which the server imports too)
// all use it.

import type { PaperQuestion } from "@/generators/paper-folding";

/** Letters under the pictures, in the order they are shown. */
export const STEP_NAMES = ["الف", "ب", "پ", "ت"];

/** Letters of the pictures in the right order, e.g. «ب، الف، پ». */
export const orderNames = (q: Extract<PaperQuestion, { type: "order" }>) => q.shown.map((_, i) => STEP_NAMES[q.shown.indexOf(i)]).join("، ");

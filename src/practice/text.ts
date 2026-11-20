// Small text helpers shared by the tools' adapters (no React: the server
// imports the adapters too).

/**
 * Keeps an equation left to right inside a Persian sentence, on one line:
 * a left-to-right isolate, no-break spaces, and a left-to-right mark after
 * «؟» (an Arabic-script character that would otherwise reorder the numbers
 * after it).
 */
export const ltr = (s: string) => `⁦${s.replace(/ /g, " ").replace(/؟/g, "؟‎")}⁩`;

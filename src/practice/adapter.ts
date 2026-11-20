// How a tool takes part in practice sessions, in two parts:
//  - PracticeInfo (the tool's practice.ts): types, levels and tag words.
//    Light, so the practice pages and the parent report import every tool's.
//  - ToolAdapter (the tool's adapter.ts): adds grading and hints with the
//    generator. Plain code, no React, so the server can import it and grade
//    an answer again from the same seed (plan v2, section 9.3).

export interface PracticeInfo {
  /** Short key used in data: "clock". */
  tool: string;
  /** Tool number in the registry (1 … 21). */
  id: number;
  /** Page of the tool, with a trailing slash: "/tools/clock/". */
  href: string;
  types: readonly { key: string; label: string }[];
  levels: readonly number[];
  /** Every tag grade() returns, in plain words for a parent: "جهت را برعکس می‌رود". Includes "right" and "other". */
  tags: Readonly<Record<string, string>>;
}

export interface ToolAdapter extends PracticeInfo {
  /** Bump when a generator changes what a seed builds: "clock@1". */
  version: string;
  /**
   * "right", or the slip tag the answer matches, or "other". `response` is
   * what the tool's panel reported when the child pressed «بررسی»; it must
   * survive JSON (numbers, strings, arrays, plain objects).
   */
  grade(type: string, level: number, seed: number, response: unknown): string;
  /**
   * Three-step hint (plan v2, section 5.2): a general nudge, then the rule,
   * then the first step of this very question. None gives the answer away.
   */
  hints(type: string, level: number, seed: number): [string, string, string];
}

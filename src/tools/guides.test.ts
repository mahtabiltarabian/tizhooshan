import { describe, expect, it } from "vitest";
import { pickedFor, type GuideContent } from "@/toolkit/TeacherGuide";
import { TRANSFORMS_GUIDE } from "./01-transforms/guide";
import { PAPER_GUIDE } from "./02-paper/guide";
import { PATTERNS_GUIDE } from "./03-patterns/guide";
import { PUZZLE_GUIDE } from "./04-puzzle/guide";
import { SHAPE_COUNTER_GUIDE } from "./05-shape-counter/guide";
import { CUBE_TOWERS_GUIDE } from "./06-cube-towers/guide";
import { CUBE_NETS_GUIDE } from "./07-cube-nets/guide";
import { CLOCK_GUIDE } from "./08-clock/guide";
import { SEQUENCE_GUIDE } from "./09-sequence/guide";
import { PUZZLES_GUIDE } from "./10-number-puzzles/guide";
import { MACHINE_GUIDE } from "./11-number-machine/guide";
import { BALANCE_GUIDE } from "./12-balance/guide";
import { DIGITS_GUIDE } from "./13-digits/guide";
import { RATIO_GUIDE } from "./14-ratio/guide";
import { MOTION_GUIDE } from "./15-motion/guide";
import { GEOMETRY_GUIDE } from "./16-geometry/guide";
import { COUNTING_GUIDE } from "./17-counting/guide";
import { CODES_GUIDE } from "./18-codes/guide";
import { LOGIC_GUIDE } from "./19-logic/guide";
import { SEATING_GUIDE } from "./20-seating/guide";

const GUIDES: [string, GuideContent][] = [
  ["01 transforms", TRANSFORMS_GUIDE],
  ["02 paper", PAPER_GUIDE],
  ["03 patterns", PATTERNS_GUIDE],
  ["04 puzzle", PUZZLE_GUIDE],
  ["05 shape counter", SHAPE_COUNTER_GUIDE],
  ["06 cube towers", CUBE_TOWERS_GUIDE],
  ["07 cube nets", CUBE_NETS_GUIDE],
  ["08 clock", CLOCK_GUIDE],
  ["09 sequence", SEQUENCE_GUIDE],
  ["10 number puzzles", PUZZLES_GUIDE],
  ["11 number machine", MACHINE_GUIDE],
  ["12 balance", BALANCE_GUIDE],
  ["13 digits", DIGITS_GUIDE],
  ["14 ratio", RATIO_GUIDE],
  ["15 motion", MOTION_GUIDE],
  ["16 geometry", GEOMETRY_GUIDE],
  ["17 counting", COUNTING_GUIDE],
  ["18 codes", CODES_GUIDE],
  ["19 logic", LOGIC_GUIDE],
  ["20 seating", SEATING_GUIDE],
];

// Plan section 4: every tool has 8–12 hand-picked, reviewed examples, and
// plan section 8.3: one picked scene for every misconception in the guide.
describe("hand-picked examples in the teacher guides", () => {
  it.each(GUIDES)("%s", (_, guide) => {
    const examples = guide.examples ?? [];
    expect(examples.length).toBeGreaterThanOrEqual(8);
    expect(examples.length).toBeLessThanOrEqual(12);

    const hashes = examples.map((ex) => ex.hash);
    expect(new Set(hashes).size).toBe(hashes.length);
    for (const ex of examples) {
      expect(ex.hash).toMatch(/^(try|show|explore)(=|&|$)/);
      expect(ex.hash).not.toContain("#");
      expect(ex.hash).not.toContain("classroom");
      expect(ex.title.trim()).not.toBe("");
      expect(ex.note.trim()).not.toBe("");
    }

    guide.misconceptions.forEach((_, i) => {
      expect(examples.filter((ex) => pickedFor(ex).includes(i)), `misconception ${i + 1}`).toHaveLength(1);
    });
    for (const ex of examples) {
      for (const i of pickedFor(ex)) expect(i).toBeLessThan(guide.misconceptions.length);
    }
  });
});

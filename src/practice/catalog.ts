// Every practice skill, from each tool's light practice.ts (no generators),
// so the practice pages stay small. catalog.test.ts checks it against the
// adapters.

import { TRANSFORMS_PRACTICE } from "@/tools/01-transforms/practice";
import { PAPER_PRACTICE } from "@/tools/02-paper/practice";
import { PATTERNS_PRACTICE } from "@/tools/03-patterns/practice";
import { PUZZLE_PRACTICE } from "@/tools/04-puzzle/practice";
import { SHAPE_COUNTER_PRACTICE } from "@/tools/05-shape-counter/practice";
import { CUBE_TOWERS_PRACTICE } from "@/tools/06-cube-towers/practice";
import { CUBE_NETS_PRACTICE } from "@/tools/07-cube-nets/practice";
import { CLOCK_PRACTICE } from "@/tools/08-clock/practice";
import { SEQUENCE_PRACTICE } from "@/tools/09-sequence/practice";
import { NUMBER_PUZZLES_PRACTICE } from "@/tools/10-number-puzzles/practice";
import { NUMBER_MACHINE_PRACTICE } from "@/tools/11-number-machine/practice";
import { BALANCE_PRACTICE } from "@/tools/12-balance/practice";
import { DIGITS_PRACTICE } from "@/tools/13-digits/practice";
import { RATIO_PRACTICE } from "@/tools/14-ratio/practice";
import { MOTION_PRACTICE } from "@/tools/15-motion/practice";
import { GEOMETRY_PRACTICE } from "@/tools/16-geometry/practice";
import { COUNTING_PRACTICE } from "@/tools/17-counting/practice";
import { CODES_PRACTICE } from "@/tools/18-codes/practice";
import { LOGIC_PRACTICE } from "@/tools/19-logic/practice";
import { SEATING_PRACTICE } from "@/tools/20-seating/practice";
import { SPEED_PRACTICE } from "@/tools/21-speed/practice";
import { TOOLS, type Area } from "@/tools/registry";
import type { PracticeInfo } from "./adapter";
import type { SkillInfo } from "./session";
import { skillKey } from "./types";

export type CatalogTool = PracticeInfo;

export const CATALOG: readonly CatalogTool[] = [
  TRANSFORMS_PRACTICE,
  PAPER_PRACTICE,
  PATTERNS_PRACTICE,
  PUZZLE_PRACTICE,
  SHAPE_COUNTER_PRACTICE,
  CUBE_TOWERS_PRACTICE,
  CUBE_NETS_PRACTICE,
  CLOCK_PRACTICE,
  SEQUENCE_PRACTICE,
  NUMBER_PUZZLES_PRACTICE,
  NUMBER_MACHINE_PRACTICE,
  BALANCE_PRACTICE,
  DIGITS_PRACTICE,
  RATIO_PRACTICE,
  MOTION_PRACTICE,
  GEOMETRY_PRACTICE,
  COUNTING_PRACTICE,
  CODES_PRACTICE,
  LOGIC_PRACTICE,
  SEATING_PRACTICE,
  SPEED_PRACTICE,
];

const BY_TOOL = new Map(CATALOG.map((t) => [t.tool, t]));
export const catalogTool = (tool: string) => BY_TOOL.get(tool);

export const toolTitle = (tool: string) => TOOLS.find((t) => t.id === BY_TOOL.get(tool)?.id)?.title ?? tool;
export const toolArea = (tool: string): Area => TOOLS.find((t) => t.id === BY_TOOL.get(tool)?.id)?.area ?? "logical";
/** A tag in plain words for a parent. */
export const tagText = (tool: string, tag: string) => BY_TOOL.get(tool)?.tags[tag] ?? BY_TOOL.get(tool)?.tags.other ?? tag;
export const typeLabel = (tool: string, type: string) => BY_TOOL.get(tool)?.types.find((t) => t.key === type)?.label ?? type;

export const SKILLS: SkillInfo[] = CATALOG.flatMap((t) => t.types.map((ty) => ({ key: skillKey(t.tool, ty.key), tool: t.tool, type: ty.key, levels: t.levels })));

/** The address of a practice question on its tool's page. */
export const practiceHref = (item: { tool: string; type: string; level: number; seed: number }) =>
  `${catalogTool(item.tool)?.href ?? "/"}#practice&try=${encodeURIComponent(item.type)}&level=${item.level}&seed=${item.seed}`;

/** Tools in the order of the registry: visual, then computational, then logical. */
export const EXAM_ORDER = [...CATALOG].sort((a, b) => a.id - b.id).map((t) => t.tool);

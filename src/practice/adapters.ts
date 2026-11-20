// Every tool's adapter, with its generator. Heavy: only the server and the
// tests import this. Pages import catalog.ts, and each tool its own adapter.

import type { ToolAdapter } from "./adapter";
import { TRANSFORMS_ADAPTER } from "@/tools/01-transforms/adapter";
import { PAPER_ADAPTER } from "@/tools/02-paper/adapter";
import { PATTERNS_ADAPTER } from "@/tools/03-patterns/adapter";
import { PUZZLE_ADAPTER } from "@/tools/04-puzzle/adapter";
import { SHAPE_COUNTER_ADAPTER } from "@/tools/05-shape-counter/adapter";
import { CUBE_TOWERS_ADAPTER } from "@/tools/06-cube-towers/adapter";
import { CUBE_NETS_ADAPTER } from "@/tools/07-cube-nets/adapter";
import { CLOCK_ADAPTER } from "@/tools/08-clock/adapter";
import { SEQUENCE_ADAPTER } from "@/tools/09-sequence/adapter";
import { NUMBER_PUZZLES_ADAPTER } from "@/tools/10-number-puzzles/adapter";
import { NUMBER_MACHINE_ADAPTER } from "@/tools/11-number-machine/adapter";
import { BALANCE_ADAPTER } from "@/tools/12-balance/adapter";
import { DIGITS_ADAPTER } from "@/tools/13-digits/adapter";
import { RATIO_ADAPTER } from "@/tools/14-ratio/adapter";
import { MOTION_ADAPTER } from "@/tools/15-motion/adapter";
import { GEOMETRY_ADAPTER } from "@/tools/16-geometry/adapter";
import { COUNTING_ADAPTER } from "@/tools/17-counting/adapter";
import { CODES_ADAPTER } from "@/tools/18-codes/adapter";
import { LOGIC_ADAPTER } from "@/tools/19-logic/adapter";
import { SEATING_ADAPTER } from "@/tools/20-seating/adapter";
import { SPEED_ADAPTER } from "@/tools/21-speed/adapter";

export const ADAPTERS: readonly ToolAdapter[] = [
  TRANSFORMS_ADAPTER,
  PAPER_ADAPTER,
  PATTERNS_ADAPTER,
  PUZZLE_ADAPTER,
  SHAPE_COUNTER_ADAPTER,
  CUBE_TOWERS_ADAPTER,
  CUBE_NETS_ADAPTER,
  CLOCK_ADAPTER,
  SEQUENCE_ADAPTER,
  NUMBER_PUZZLES_ADAPTER,
  NUMBER_MACHINE_ADAPTER,
  BALANCE_ADAPTER,
  DIGITS_ADAPTER,
  RATIO_ADAPTER,
  MOTION_ADAPTER,
  GEOMETRY_ADAPTER,
  COUNTING_ADAPTER,
  CODES_ADAPTER,
  LOGIC_ADAPTER,
  SEATING_ADAPTER,
  SPEED_ADAPTER,
];

export const adapterFor = (tool: string) => ADAPTERS.find((a) => a.tool === tool);

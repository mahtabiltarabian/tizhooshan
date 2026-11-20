// Every practice skill, from each tool's light practice.ts (no generators),
// so the practice pages stay small. catalog.test.ts checks it against the
// adapters.

import { CLOCK_PRACTICE } from "@/tools/08-clock/practice";
import { TOOLS, type Area } from "@/tools/registry";
import type { PracticeInfo } from "./adapter";
import type { SkillInfo } from "./session";
import { skillKey } from "./types";

export type CatalogTool = PracticeInfo;

export const CATALOG: readonly CatalogTool[] = [CLOCK_PRACTICE];

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

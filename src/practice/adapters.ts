// Every tool's adapter, with its generator. Heavy: only the server and the
// tests import this. Pages import catalog.ts, and each tool its own adapter.

import type { ToolAdapter } from "./adapter";
import { CLOCK_ADAPTER } from "@/tools/08-clock/adapter";

export const ADAPTERS: readonly ToolAdapter[] = [CLOCK_ADAPTER];

export const adapterFor = (tool: string) => ADAPTERS.find((a) => a.tool === tool);

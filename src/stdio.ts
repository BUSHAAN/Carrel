import type { AppConfig } from "./config.js";

/** Wired in Phase 3. */
export async function startStdio(_config: AppConfig): Promise<void> {
  throw new Error("stdio MCP transport is not implemented yet (Phase 3)");
}

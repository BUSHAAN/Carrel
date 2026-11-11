import { serveStdio } from "@modelcontextprotocol/server/stdio";
import type { AppConfig } from "./config.js";
import { KnowledgeStore } from "./knowledge/store.js";
import { buildServer } from "./server.js";

export async function startStdio(config: AppConfig): Promise<void> {
  const store = new KnowledgeStore(config.knowledgeRoot);
  await serveStdio(() => buildServer(store));
  console.error("study-mcp listening on stdio");
}

import { McpServer } from "@modelcontextprotocol/server";
import type { KnowledgeStore } from "./knowledge/store.js";
import { STUDY_POLICY, registerAllTools } from "./tools/register.js";

export function buildServer(store: KnowledgeStore): McpServer {
  const server = new McpServer({
    name: "study-with-ai",
    version: "1.0.0",
    description: STUDY_POLICY,
  });
  registerAllTools(server, store);
  return server;
}

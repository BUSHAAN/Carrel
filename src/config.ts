import { existsSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const srcDir = dirname(fileURLToPath(import.meta.url));
export const projectRoot = resolve(srcDir, "..");

function optionalEnv(name: string, fallback: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return fallback;
  }
  return value;
}

export type AppConfig = {
  knowledgeRoot: string;
  betterAuthUrl: string;
  betterAuthSecret: string;
  mcpResource: string;
  httpPort: number;
  ownerEmail: string;
  ownerPassword: string;
  ownerName: string;
  sqlitePath: string;
};

export function loadConfig(): AppConfig {
  const knowledgeRootRaw = optionalEnv("KNOWLEDGE_ROOT", resolve(projectRoot, "knowledge"));
  const knowledgeRoot = isAbsolute(knowledgeRootRaw)
    ? knowledgeRootRaw
    : resolve(process.cwd(), knowledgeRootRaw);

  const betterAuthUrl = optionalEnv("BETTER_AUTH_URL", "http://127.0.0.1:8787").replace(/\/$/, "");
  const mcpResource = optionalEnv("MCP_RESOURCE", `${betterAuthUrl}/mcp`);

  return {
    knowledgeRoot,
    betterAuthUrl,
    betterAuthSecret: optionalEnv("BETTER_AUTH_SECRET", "dev-only-change-me"),
    mcpResource,
    httpPort: Number(optionalEnv("MCP_HTTP_PORT", "8787")),
    ownerEmail: optionalEnv("OWNER_EMAIL", "owner@localhost"),
    ownerPassword: optionalEnv("OWNER_PASSWORD", "changeme-change-me"),
    ownerName: optionalEnv("OWNER_NAME", "Owner"),
    sqlitePath: resolve(projectRoot, "data", "auth.sqlite"),
  };
}

export function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

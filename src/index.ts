#!/usr/bin/env node
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig, projectRoot } from "./config.js";

function loadDotEnv(): void {
  const envPath = resolve(projectRoot, ".env");
  if (existsSync(envPath) && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envPath);
  }
}

function parseMode(): "stdio" | "http" {
  return process.argv.includes("--http") ? "http" : "stdio";
}

async function main(): Promise<void> {
  loadDotEnv();
  const mode = parseMode();
  const config = loadConfig();
  console.error(`study-mcp starting (${mode}); knowledge root: ${config.knowledgeRoot}`);

  if (mode === "stdio") {
    const { startStdio } = await import("./stdio.js");
    await startStdio(config);
    return;
  }

  const { startHttp } = await import("./http.js");
  await startHttp(config);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

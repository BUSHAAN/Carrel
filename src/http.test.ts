import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAuth, migrateAuth } from "./auth.js";
import type { AppConfig } from "./config.js";
import { createHttpApp } from "./http.js";
import { KnowledgeStore } from "./knowledge/store.js";

function testConfig(): AppConfig {
  const dir = mkdtempSync(join(tmpdir(), "study-mcp-http-"));
  return {
    knowledgeRoot: join(dir, "knowledge"),
    betterAuthUrl: "http://127.0.0.1:8787",
    betterAuthSecret: "test-secret-test-secret-test-secret",
    mcpResource: "http://127.0.0.1:8787/mcp",
    httpPort: 8787,
    ownerEmail: "owner@localhost",
    ownerPassword: "password-password",
    ownerName: "Owner",
    sqlitePath: join(dir, "auth.sqlite"),
  };
}

describe("HTTP MCP auth", () => {
  it("returns 401 with WWW-Authenticate when POST /mcp has no bearer token", async () => {
    const config = testConfig();
    const auth = createAuth(config);
    await migrateAuth(auth);
    const { app } = createHttpApp(config, auth, new KnowledgeStore(config.knowledgeRoot));
    const response = await app.request("http://127.0.0.1:8787/mcp", {
      method: "POST",
      headers: {
        host: "127.0.0.1:8787",
        "content-type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
    });
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate") ?? "").toMatch(/Bearer/i);
  });
});

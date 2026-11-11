import { serve } from "@hono/node-server";
import { requireMcpAuth } from "@better-auth/mcp";
import { createMcpHonoApp } from "@modelcontextprotocol/hono";
import { createMcpHandler } from "@modelcontextprotocol/server";
import type { Context } from "hono";
import { createAuth, migrateAuth, seedOwner, type Auth } from "./auth.js";
import type { AppConfig } from "./config.js";
import { KnowledgeStore } from "./knowledge/store.js";
import { consentPage, signInPage } from "./pages.js";
import { buildServer } from "./server.js";

function allowedHosts(config: AppConfig): string[] {
  const hosts = new Set(["127.0.0.1", "localhost"]);
  try {
    hosts.add(new URL(config.betterAuthUrl).hostname);
  } catch {
    /* ignore invalid URL until env is set */
  }
  return [...hosts];
}

export function createHttpApp(config: AppConfig, auth: Auth, store: KnowledgeStore) {
  const mcpHandler = createMcpHandler(() => buildServer(store), { legacy: "reject" });

  const app = createMcpHonoApp({
    host: "127.0.0.1",
    allowedHosts: allowedHosts(config),
    allowedOrigins: allowedHosts(config),
  });

  app.all("/api/auth/*", (c) => auth.handler(c.req.raw));
  app.all("/.well-known/*", (c) => auth.handler(c.req.raw));

  app.get("/sign-in", (c) => c.html(signInPage()));
  app.get("/consent", (c) => consentPage(auth, c.req.raw));

  app.all("/mcp", async (c: Context) => {
    const parsedBody = c.get("parsedBody");
    const run = requireMcpAuth(
      auth,
      (request) => mcpHandler.fetch(request, { parsedBody }),
      { resource: config.mcpResource },
    );
    return run(c.req.raw);
  });

  app.get("/", (c) =>
    c.text("study-mcp HTTP. Use POST /mcp (OAuth) or connect over stdio."),
  );

  return { app };
}

export async function startHttp(config: AppConfig): Promise<void> {
  const auth = createAuth(config);
  await migrateAuth(auth);
  await seedOwner(auth, config);
  const store = new KnowledgeStore(config.knowledgeRoot);
  const { app } = createHttpApp(config, auth, store);

  serve({ fetch: app.fetch, port: config.httpPort, hostname: "127.0.0.1" }, () => {
    console.error(`study-mcp HTTP on http://127.0.0.1:${config.httpPort}/mcp`);
    console.error(`Better Auth origin: ${config.betterAuthUrl}`);
  });
}

import { DatabaseSync } from "node:sqlite";
import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { mcp } from "@better-auth/mcp";
import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import { getMigrations } from "better-auth/db/migration";
import { hashPassword } from "better-auth/crypto";
import { dirname } from "node:path";
import { loadConfig, ensureDir, type AppConfig } from "./config.js";

export function createAuth(config: AppConfig) {
  ensureDir(dirname(config.sqlitePath));
  const database = new DatabaseSync(config.sqlitePath);

  return betterAuth({
    appName: "study-with-ai",
    baseURL: config.betterAuthUrl,
    secret: config.betterAuthSecret,
    database,
    disabledPaths: ["/token"],
    trustedOrigins: [config.betterAuthUrl, "http://127.0.0.1", "http://localhost"],
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
    },
    plugins: [
      jwt({ disableSettingJwtHeader: true }),
      mcp({
        loginPage: "/sign-in",
        consentPage: "/consent",
        resource: config.mcpResource,
      }),
      cimd({
        fetchClientMetadataResource,
        metadataProfile: "mcp-2026-07-28",
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

export async function migrateAuth(auth: Auth): Promise<void> {
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();
}

export async function seedOwner(auth: Auth, config: AppConfig): Promise<void> {
  const ctx = await auth.$context;
  const existing = await ctx.internalAdapter.listUsers(1);
  if (existing.length > 0) {
    return;
  }
  const user = await ctx.internalAdapter.createUser(
    {
      email: config.ownerEmail,
      name: config.ownerName,
      emailVerified: true,
    },
    { method: "email-password" },
  );
  await ctx.internalAdapter.createAccount({
    userId: user.id,
    accountId: user.id,
    providerId: "credential",
    password: await hashPassword(config.ownerPassword),
  });
  console.error(`Seeded owner user ${config.ownerEmail}`);
}

let cliAuthInstance: Auth | undefined;

function cliAuth(): Auth {
  cliAuthInstance ??= createAuth(loadConfig());
  return cliAuthInstance;
}

/** CLI (`auth migrate`) loads this export. Lazily created so tests can import helpers without touching the default DB. */
export const auth: Auth = new Proxy({} as Auth, {
  get(_target, property, receiver) {
    const instance = cliAuth();
    const value = Reflect.get(instance, property, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

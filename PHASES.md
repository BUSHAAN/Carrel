# Phased implementation

Each phase is a reviewable git commit. Later phases depend on earlier ones.

## Phase 1 — Scaffold

TypeScript Node project, scripts, gitignore, env template, config loader, dual-mode entry (`--stdio` / `--http`).

## Phase 2 — Knowledge layer

Sandboxed Markdown filesystem: POSIX paths inside `KNOWLEDGE_ROOT`, atomic writes, append, section update, move, delete-with-confirm, MiniSearch, study index from `README.md` files.

## Phase 3 — MCP tools (stdio)

`McpServer` with the 12 study tools. Local clients (Cursor, Claude Desktop) connect over stdio with no OAuth.

## Phase 4 — Better Auth HTTP

Hono server: Better Auth (`jwt` + `mcp` + `cimd`), SQLite, owner seed, `/sign-in` and `/consent`, `requireMcpAuth` on `/mcp`. Streamable HTTP for remote MCP clients.

## Phase 5 — Sample notes and tunnel

Seed `knowledge/` tree, Cloudflare Tunnel example, README client wiring (stdio and remote OAuth).

## Phase 6 — Tests

Unit tests for sandbox, writes, search, delete confirmation, and unauthenticated `POST /mcp` → 401 `WWW-Authenticate`.

# study-with-ai

Personal Markdown knowledge base exposed as a **model-agnostic MCP server**. Local clients use stdio (no OAuth). Remote clients use Streamable HTTP plus [Better Auth’s MCP plugin](https://better-auth.com/docs/plugins/mcp).

Implementation sequence: [PHASES.md](PHASES.md).

Teach first; write notes only when you ask. Notes stay ordinary Markdown (Obsidian / VS Code).

## Setup

```bash
pnpm install
cp .env.example .env
# set BETTER_AUTH_SECRET, OWNER_EMAIL, OWNER_PASSWORD
pnpm build
```

`pnpm dev` starts the HTTP server with reload on `http://127.0.0.1:8787` (the address Cloudflare must target). `pnpm dev:stdio` is local Cursor/Claude only.

Notes live in `knowledge/` on your machine. That directory is in the repo so the server has a place to write; its contents are gitignored. Optional: `git init` inside `knowledge/` if you want local history without putting notes on this remote.

## Local stdio (Cursor / Claude Desktop)

```bash
pnpm start:stdio
```

Cursor `mcp.json`:

```json
{
  "mcpServers": {
    "study-with-ai": {
      "command": "node",
      "args": ["dist/index.js", "--stdio"],
      "env": {
        "KNOWLEDGE_ROOT": "C:/Users/User/Desktop/Projects/study-with-ai/knowledge"
      }
    }
  }
}
```

Claude Desktop uses the same command/env shape in its config file.

## Remote HTTP + OAuth

```bash
pnpm dev
```

Listen address is `127.0.0.1:8787`. In Cloudflare Zero Trust → published application:

| Field | Value |
| --- | --- |
| Subdomain | `mcp` |
| Domain | `bushaan.dev` |
| Full hostname | `mcp.bushaan.dev` |
| Path | leave empty |
| Service URL | `http://127.0.0.1:8787` |

Do not use port 80, and do not set Path to `/mcp`. OAuth needs `/sign-in`, `/consent`, `/api/auth/*`, and `/.well-known/*` on the same hostname. MCP clients connect to `https://mcp.bushaan.dev/mcp`.

Unauthenticated `POST /mcp` returns 401 with `WWW-Authenticate`. Sign in as the seeded owner, then consent. Sign-up is disabled.

See [cloudflare/config.yml.example](cloudflare/config.yml.example) if you use `cloudflared` instead of the dashboard UI.

## Tools

| Tool | Purpose |
| --- | --- |
| `list_folders` | Explore the knowledge base |
| `list_files` | List notes in a folder |
| `read_note` | Read a Markdown note |
| `create_note` | Create a note (fails if it exists) |
| `update_note` | Replace a note |
| `append_to_note` | Add material without wiping the file |
| `update_section` | Replace one heading section |
| `search_notes` | Full-text search |
| `move_note` | Rename or move a note |
| `create_folder` | Add subject/topic folders |
| `delete_note` | Delete with `confirm: true` |
| `get_study_index` | Subject overview from README files |

## Tests

```bash
pnpm test
```

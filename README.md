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

Edits snapshot the previous file under `knowledge/.study-mcp/versions/`. Study status lives in `knowledge/.study-mcp/study-progress.json`.

Filesystem: `list_folders`, `list_files`, `read_note`, `read_section`, `get_note_metadata`, `create_note`, `update_note`, `append_to_note`, `update_section`, `batch_read_notes`, `batch_update_notes`, `get_recent_changes`, `move_note`, `copy_note`, `create_folder`, `delete_note`, `delete_folder`, `rename_folder`, `get_note_version`, `restore_note_version`, `get_file_diff`.

Knowledge: `search_notes`, `get_study_index`, `get_vault_overview`, `get_note_outline`, `get_backlinks`, `validate_links`.

Study: `get_study_progress`, `update_topic_status`, `add_revision_item`, `get_revision_queue`, `record_study_session`.

## Tests

```bash
pnpm test
```

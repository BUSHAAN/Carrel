# Carrel

**A quiet place for your knowledge to grow.**

Carrel is an MCP server that keeps your study notes as ordinary Markdown and lets AI clients work with them across sessions. Chat apps connect over Streamable HTTP. Desktop apps (Cursor, Claude Desktop, ChatGPT desktop) connect over stdio.

Stdio is not faster. The point is fewer, coarser tools — batch reads, vault overview, revision queue — so a real study turn does not need a pile of generic file calls.

## Setup

```bash
pnpm install
cp .env.example .env
# set BETTER_AUTH_SECRET, OWNER_EMAIL, OWNER_PASSWORD
pnpm build
```

`pnpm dev` starts HTTP on `http://127.0.0.1:8787`. `pnpm start:stdio` is for local MCP clients.

Notes live in `knowledge/` on your machine. The folder is in the repo; its contents are gitignored. Do not commit `.env` or `data/`.

## Local stdio

```json
{
  "mcpServers": {
    "carrel": {
      "command": "node",
      "args": ["dist/index.js", "--stdio"],
      "cwd": "/absolute/path/to/carrel",
      "env": {
        "KNOWLEDGE_ROOT": "/absolute/path/to/carrel/knowledge"
      }
    }
  }
}
```

Pass the script path and `--stdio` as **two** arguments. ChatGPT desktop starts this process itself; do not also run `pnpm start`.

## Remote HTTP + OAuth

Tunnel the local server (Cloudflare example: hostname `mcp.example.com` → `http://127.0.0.1:8787`). Leave Path empty. MCP URL is `https://<your-host>/mcp`.

Unauthenticated `POST /mcp` returns 401 with `WWW-Authenticate`. Sign-up is disabled; the owner is seeded on first HTTP boot.

See [cloudflare/config.yml.example](cloudflare/config.yml.example).

## Tools

Edits snapshot under `knowledge/.carrel/versions/` (or `.study-mcp/` if that folder already exists). Study status lives in `study-progress.json` beside the snapshots.

Filesystem: `list_folders`, `list_files`, `read_note`, `read_section`, `get_note_metadata`, `create_note`, `update_note`, `append_to_note`, `update_section`, `batch_read_notes`, `batch_update_notes`, `get_recent_changes`, `move_note`, `copy_note`, `create_folder`, `delete_note`, `delete_folder`, `rename_folder`, `get_note_version`, `restore_note_version`, `get_file_diff`.

Knowledge: `search_notes`, `get_study_index`, `get_vault_overview`, `get_note_outline`, `get_backlinks`, `validate_links`.

Study: `get_study_progress`, `update_topic_status`, `add_revision_item`, `get_revision_queue`, `record_study_session`.

## Tests

```bash
pnpm test
```

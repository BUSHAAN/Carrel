# study-with-ai

Personal Markdown knowledge base exposed as a **model-agnostic MCP server**. Local clients use stdio (no OAuth). Remote clients use Streamable HTTP plus [Better Auth’s MCP plugin](https://better-auth.com/docs/plugins/mcp).

Implementation sequence: [PHASES.md](PHASES.md).

Teach first; write notes only when you ask. Notes stay ordinary Markdown (Obsidian / VS Code).

## Setup

```bash
npm install
cp .env.example .env
# set BETTER_AUTH_SECRET, OWNER_EMAIL, OWNER_PASSWORD
# for local HTTP, BETTER_AUTH_URL=http://127.0.0.1:8787 and MCP_RESOURCE=http://127.0.0.1:8787/mcp
npm run build
```

Optional: `git init` inside `knowledge/` so accidental edits are reversible.

## Local stdio (Cursor / Claude Desktop)

```bash
npm run start:stdio
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
npm run start:http
```

Listen address is `127.0.0.1` only. Put Cloudflare Tunnel in front (see [cloudflare/config.yml.example](cloudflare/config.yml.example)).

The tunnel hostname must match `BETTER_AUTH_URL`. Forward:

- `POST /mcp`
- `/api/auth/*`
- `/.well-known/*`
- `/sign-in`
- `/consent`

MCP clients use `https://<your-domain>/mcp`. Unauthenticated calls return 401 with `WWW-Authenticate`. Sign in as the seeded owner, then consent. Sign-up is disabled.

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
npm test
```

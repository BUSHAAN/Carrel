# study-with-ai

Personal Markdown knowledge base exposed as a **model-agnostic MCP server**. Local clients use stdio. Remote clients use Streamable HTTP plus Better Auth OAuth (MCP plugin).

See [PHASES.md](PHASES.md) for the implementation sequence.

## Quick start (local / stdio)

```bash
npm install
cp .env.example .env
npm run build
npm run start:stdio
```

Point Cursor or Claude Desktop at `node dist/index.js --stdio` with `KNOWLEDGE_ROOT` set. HTTP/OAuth setup is documented after Phase 4–5 land.

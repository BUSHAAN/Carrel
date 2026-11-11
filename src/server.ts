import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import { isKnowledgeError } from "./knowledge/errors.js";
import type { KnowledgeStore } from "./knowledge/store.js";

const STUDY_POLICY =
  "Learning is primary; write or update notes only when the user asks. Do not dump entire conversations into the knowledge base.";

function textResult(payload: unknown, isError = false) {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  return { content: [{ type: "text" as const, text }], isError };
}

function wrap<T>(fn: () => Promise<T> | T) {
  return async () => {
    try {
      return textResult(await fn());
    } catch (error) {
      const message = isKnowledgeError(error) ? `${error.code}: ${error.message}` : error instanceof Error ? error.message : String(error);
      return textResult(message, true);
    }
  };
}

export function buildServer(store: KnowledgeStore): McpServer {
  const server = new McpServer({
    name: "study-with-ai",
    version: "1.0.0",
    description: STUDY_POLICY,
  });

  server.registerTool(
    "list_folders",
    {
      title: "List folders",
      description: "Explore subject/topic folders in the knowledge base. Omit path to list the root.",
      inputSchema: z.object({
        path: z.string().optional().describe("Folder path relative to the knowledge root"),
      }),
    },
    async ({ path }) => wrap(() => store.listFolders(path))(),
  );

  server.registerTool(
    "list_files",
    {
      title: "List notes",
      description: "List Markdown notes in a folder.",
      inputSchema: z.object({
        path: z.string().describe("Folder path relative to the knowledge root"),
      }),
    },
    async ({ path }) => wrap(() => store.listFiles(path))(),
  );

  server.registerTool(
    "read_note",
    {
      title: "Read note",
      description: "Read an existing Markdown note. Use this before updating so you do not overwrite unknown content.",
      inputSchema: z.object({
        path: z.string().describe("Note path, e.g. Computer Science/Compiler Design/Code Optimization.md"),
      }),
    },
    async ({ path }) => wrap(() => store.readNote(path))(),
  );

  server.registerTool(
    "create_note",
    {
      title: "Create note",
      description: `${STUDY_POLICY} Create a new Markdown note. Fails if the file already exists.`,
      inputSchema: z.object({
        path: z.string(),
        content: z.string(),
      }),
    },
    async ({ path, content }) =>
      wrap(async () => {
        await store.createNote(path, content);
        return { ok: true, path };
      })(),
  );

  server.registerTool(
    "update_note",
    {
      title: "Replace note",
      description: `${STUDY_POLICY} Replace an entire note. Prefer append_to_note or update_section to avoid wiping existing work.`,
      inputSchema: z.object({
        path: z.string(),
        content: z.string(),
      }),
    },
    async ({ path, content }) =>
      wrap(async () => {
        await store.updateNote(path, content);
        return { ok: true, path };
      })(),
  );

  server.registerTool(
    "append_to_note",
    {
      title: "Append to note",
      description: `${STUDY_POLICY} Add material without replacing the rest of the note. Optional heading appends under that section or creates it.`,
      inputSchema: z.object({
        path: z.string(),
        content: z.string(),
        heading: z.string().optional(),
      }),
    },
    async ({ path, content, heading }) =>
      wrap(async () => {
        await store.appendToNote(path, content, heading);
        return { ok: true, path };
      })(),
  );

  server.registerTool(
    "update_section",
    {
      title: "Update section",
      description: `${STUDY_POLICY} Replace one Markdown heading section in place. Safer than update_note for incremental learning.`,
      inputSchema: z.object({
        path: z.string(),
        heading: z.string(),
        content: z.string(),
      }),
    },
    async ({ path, heading, content }) =>
      wrap(async () => {
        await store.updateSection(path, heading, content);
        return { ok: true, path, heading };
      })(),
  );

  server.registerTool(
    "search_notes",
    {
      title: "Search notes",
      description: "Full-text search across notes. Use this to continue a topic from existing knowledge instead of reconstructing chat history.",
      inputSchema: z.object({
        query: z.string(),
        path: z.string().optional().describe("Limit search to a folder prefix"),
        limit: z.number().int().positive().max(50).optional(),
      }),
    },
    async ({ query, path, limit }) => wrap(() => store.search(query, path, limit))(),
  );

  server.registerTool(
    "move_note",
    {
      title: "Move note",
      description: "Rename or move a note within the knowledge root.",
      inputSchema: z.object({
        from: z.string(),
        to: z.string(),
      }),
    },
    async ({ from, to }) =>
      wrap(async () => {
        await store.moveNote(from, to);
        return { ok: true, from, to };
      })(),
  );

  server.registerTool(
    "create_folder",
    {
      title: "Create folder",
      description: "Create a subject or topic folder as the knowledge tree grows.",
      inputSchema: z.object({
        path: z.string(),
      }),
    },
    async ({ path }) =>
      wrap(() => {
        store.createFolder(path);
        return { ok: true, path };
      })(),
  );

  server.registerTool(
    "delete_note",
    {
      title: "Delete note",
      description: "Delete a note. Requires confirm=true with the same path. Never delete unless the user explicitly asked.",
      inputSchema: z.object({
        path: z.string(),
        confirm: z.boolean(),
      }),
    },
    async ({ path, confirm }) =>
      wrap(async () => {
        await store.deleteNote(path, confirm);
        return { ok: true, path };
      })(),
  );

  server.registerTool(
    "get_study_index",
    {
      title: "Study index",
      description: "Overview of subjects, README topics, and note links. Call this at the start of a study session instead of reading every file.",
      inputSchema: z.object({
        path: z.string().optional(),
      }),
    },
    async ({ path }) => wrap(() => store.getStudyIndex(path))(),
  );

  return server;
}

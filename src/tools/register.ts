import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import { isKnowledgeError } from "../knowledge/errors.js";
import { TOPIC_STATUSES, type KnowledgeStore } from "../knowledge/store.js";

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
      const message = isKnowledgeError(error)
        ? `${error.code}: ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);
      console.error(`[study-mcp] tool error: ${message}`);
      return textResult(message, true);
    }
  };
}

export { STUDY_POLICY };

export function registerFilesystemTools(server: McpServer, store: KnowledgeStore): void {
  server.registerTool(
    "list_folders",
    {
      title: "List folders",
      description:
        "Explore subject/topic folders in the knowledge base. Omit path to list the knowledge root. Do not pass the git workspace path; use names like HPC.",
      inputSchema: z.object({
        path: z.string().optional().describe("Optional folder relative to the knowledge root (e.g. HPC). Omit to list the root."),
      }),
    },
    async ({ path }) => wrap(() => store.listFolders(path))(),
  );

  server.registerTool(
    "list_files",
    {
      title: "List notes",
      description: "List Markdown notes in a folder.",
      inputSchema: z.object({ path: z.string() }),
    },
    async ({ path }) => wrap(() => store.listFiles(path))(),
  );

  server.registerTool(
    "read_note",
    {
      title: "Read note",
      description: "Read an existing Markdown note. Prefer batch_read_notes when comparing several notes.",
      inputSchema: z.object({ path: z.string() }),
    },
    async ({ path }) => wrap(() => store.readNote(path))(),
  );

  server.registerTool(
    "read_section",
    {
      title: "Read section",
      description: "Read a single heading section from a note.",
      inputSchema: z.object({ path: z.string(), heading: z.string() }),
    },
    async ({ path, heading }) => wrap(() => store.readSection(path, heading))(),
  );

  server.registerTool(
    "get_note_metadata",
    {
      title: "Note metadata",
      description: "Title, headings, word count, timestamps and size without the full note body.",
      inputSchema: z.object({ path: z.string() }),
    },
    async ({ path }) => wrap(() => store.getNoteMetadata(path))(),
  );

  server.registerTool(
    "create_note",
    {
      title: "Create note",
      description: `${STUDY_POLICY} Create a new Markdown note. Fails if the file already exists.`,
      inputSchema: z.object({ path: z.string(), content: z.string() }),
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
      description: `${STUDY_POLICY} Replace an entire note. A snapshot is saved first. Prefer append_to_note or update_section.`,
      inputSchema: z.object({ path: z.string(), content: z.string() }),
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
      description: `${STUDY_POLICY} Add material without replacing the rest of the note.`,
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
      description: `${STUDY_POLICY} Replace one Markdown heading section in place.`,
      inputSchema: z.object({ path: z.string(), heading: z.string(), content: z.string() }),
    },
    async ({ path, heading, content }) =>
      wrap(async () => {
        await store.updateSection(path, heading, content);
        return { ok: true, path, heading };
      })(),
  );

  server.registerTool(
    "batch_read_notes",
    {
      title: "Batch read notes",
      description: "Read multiple notes in one call (max 25). Use this to compare topics instead of many read_note calls.",
      inputSchema: z.object({ paths: z.array(z.string()).min(1).max(25) }),
    },
    async ({ paths }) => wrap(() => store.batchReadNotes(paths))(),
  );

  server.registerTool(
    "batch_update_notes",
    {
      title: "Batch update notes",
      description: `${STUDY_POLICY} Create or replace multiple notes in one call (max 25). Each existing note is snapshotted first.`,
      inputSchema: z.object({
        updates: z.array(z.object({ path: z.string(), content: z.string() })).min(1).max(25),
      }),
    },
    async ({ updates }) => wrap(() => store.batchUpdateNotes(updates))(),
  );

  server.registerTool(
    "get_recent_changes",
    {
      title: "Recent changes",
      description: "Recently created or modified notes, newest first.",
      inputSchema: z.object({
        path: z.string().optional(),
        limit: z.number().int().positive().max(50).optional(),
      }),
    },
    async ({ path, limit }) => wrap(() => store.getRecentChanges(path, limit))(),
  );

  server.registerTool(
    "move_note",
    {
      title: "Move note",
      description: "Rename or move a note within the knowledge root.",
      inputSchema: z.object({ from: z.string(), to: z.string() }),
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
      inputSchema: z.object({ path: z.string() }),
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
      description: "Delete a note. Requires confirm=true. A snapshot is saved first.",
      inputSchema: z.object({ path: z.string(), confirm: z.boolean() }),
    },
    async ({ path, confirm }) =>
      wrap(async () => {
        await store.deleteNote(path, confirm);
        return { ok: true, path };
      })(),
  );

  server.registerTool(
    "get_note_version",
    {
      title: "Note versions",
      description: "List snapshots, or read one version. Snapshots are written automatically before edits.",
      inputSchema: z.object({
        path: z.string(),
        version: z.string().optional(),
      }),
    },
    async ({ path, version }) => wrap(() => store.getNoteVersion(path, version))(),
  );

  server.registerTool(
    "restore_note_version",
    {
      title: "Restore note version",
      description: "Restore a previous snapshot. Requires confirm=true. Current content is snapshotted first.",
      inputSchema: z.object({
        path: z.string(),
        version: z.string(),
        confirm: z.boolean(),
      }),
    },
    async ({ path, version, confirm }) => wrap(() => store.restoreNoteVersion(path, version, confirm))(),
  );

  server.registerTool(
    "get_file_diff",
    {
      title: "Note diff",
      description: "Show a line diff between a snapshot and the current note. Defaults to the latest snapshot.",
      inputSchema: z.object({
        path: z.string(),
        old_version: z.string().optional(),
      }),
    },
    async ({ path, old_version }) => wrap(() => store.getFileDiff(path, old_version))(),
  );
}

export function registerKnowledgeTools(server: McpServer, store: KnowledgeStore): void {
  server.registerTool(
    "search_notes",
    {
      title: "Search notes",
      description: "Full-text search across notes.",
      inputSchema: z.object({
        query: z.string(),
        path: z.string().optional(),
        limit: z.number().int().positive().max(50).optional(),
      }),
    },
    async ({ query, path, limit }) => wrap(() => store.search(query, path, limit))(),
  );

  server.registerTool(
    "get_study_index",
    {
      title: "Study index",
      description: "Overview of subjects from README files. Omit path. Do not pass the git project path.",
      inputSchema: z.object({ path: z.string().optional() }),
    },
    async ({ path }) => wrap(() => store.getStudyIndex(path))(),
  );

  server.registerTool(
    "get_vault_overview",
    {
      title: "Vault overview",
      description: "Folder tree, note counts and storage size for the whole knowledge base.",
      inputSchema: z.object({}),
    },
    async () => wrap(() => store.getVaultOverview())(),
  );

  server.registerTool(
    "get_note_outline",
    {
      title: "Note outline",
      description: "Heading hierarchy for a note without the full body.",
      inputSchema: z.object({ path: z.string() }),
    },
    async ({ path }) => wrap(() => store.getNoteOutline(path))(),
  );

  server.registerTool(
    "get_backlinks",
    {
      title: "Backlinks",
      description: "Notes that link to this note via Markdown links.",
      inputSchema: z.object({ path: z.string() }),
    },
    async ({ path }) => wrap(() => store.getBacklinks(path))(),
  );

  server.registerTool(
    "validate_links",
    {
      title: "Validate links",
      description: "Find broken internal Markdown links.",
      inputSchema: z.object({ path: z.string().optional() }),
    },
    async ({ path }) => wrap(() => store.validateLinks(path))(),
  );
}

export function registerStudyTools(server: McpServer, store: KnowledgeStore): void {
  server.registerTool(
    "get_study_progress",
    {
      title: "Study progress",
      description: "Completed, ongoing and pending topics from study-progress.json, plus due revision items and recent sessions.",
      inputSchema: z.object({ subject: z.string().optional() }),
    },
    async ({ subject }) => wrap(() => store.getStudyProgress(subject))(),
  );

  server.registerTool(
    "update_topic_status",
    {
      title: "Update topic status",
      description: "Mark a topic not_started, learning, understood, or mastered.",
      inputSchema: z.object({
        subject: z.string(),
        topic: z.string(),
        status: z.enum(TOPIC_STATUSES),
      }),
    },
    async ({ subject, topic, status }) => wrap(() => store.updateTopicStatus(subject, topic, status))(),
  );

  server.registerTool(
    "add_revision_item",
    {
      title: "Add revision item",
      description: "Put a topic on the revision queue. Optional due_date as YYYY-MM-DD.",
      inputSchema: z.object({
        subject: z.string(),
        topic: z.string(),
        due_date: z.string().optional(),
      }),
    },
    async ({ subject, topic, due_date }) => wrap(() => store.addRevisionItem(subject, topic, due_date))(),
  );

  server.registerTool(
    "get_revision_queue",
    {
      title: "Revision queue",
      description: "Topics due for revision (due date today or earlier, or no due date).",
      inputSchema: z.object({
        subject: z.string().optional(),
        limit: z.number().int().positive().max(50).optional(),
      }),
    },
    async ({ subject, limit }) => wrap(() => store.getRevisionQueue(subject, limit))(),
  );

  server.registerTool(
    "record_study_session",
    {
      title: "Record study session",
      description: "Log what was studied. Updates lastStudied on those topics.",
      inputSchema: z.object({
        subject: z.string(),
        topics: z.array(z.string()).min(1),
        duration: z.string().optional(),
        summary: z.string().optional(),
      }),
    },
    async ({ subject, topics, duration, summary }) =>
      wrap(() => store.recordStudySession({ subject, topics, duration, summary }))(),
  );
}

export function registerAllTools(server: McpServer, store: KnowledgeStore): void {
  registerFilesystemTools(server, store);
  registerKnowledgeTools(server, store);
  registerStudyTools(server, store);
}

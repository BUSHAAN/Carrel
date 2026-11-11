import MiniSearch from "minisearch";
import { existsSync } from "node:fs";
import { TOPIC_STATUSES, addRevisionItem, getRevisionQueue, getStudyProgress, recordStudySession, updateTopicStatus, type TopicStatus } from "../study/state.js";
import { KnowledgeError } from "./errors.js";
import {
  appendToNote,
  copyNote,
  createFolder,
  createNote,
  deleteFolder,
  deleteNote,
  ensureKnowledgeRoot,
  listFiles,
  listFolders,
  moveNote,
  readNote,
  renameFolder,
  walkMarkdownFiles,
  updateNote,
  updateSection,
} from "./fs.js";
import { getBacklinks, rewriteLinksAfterMove, validateLinks } from "./links.js";
import { getNoteMetadata, getNoteOutline, getRecentChanges, getVaultOverview } from "./overview.js";
export type { TreeNode } from "./overview.js";
import { resolveInsideRoot, toSafeRelative } from "./paths.js";
import { readSection } from "./sections.js";
import { buildSearchIndex, searchNotes, type SearchHit } from "./search.js";
import { getStudyIndex, type SubjectIndex } from "./study-index.js";
import { listNoteVersions, readNoteVersion, snapshotNote, unifiedDiff } from "./versions.js";

export class KnowledgeStore {
  private index: MiniSearch<{ id: string; path: string; heading: string; text: string }>;

  constructor(readonly root: string) {
    ensureKnowledgeRoot(root);
    this.index = buildSearchIndex(root);
  }

  refresh(): void {
    this.index = buildSearchIndex(this.root);
  }

  private async snapshot(path: string, reason: string) {
    await snapshotNote(this.root, path, reason);
  }

  listFolders(path?: string) {
    return listFolders(this.root, path ?? "");
  }

  listFiles(path: string) {
    return listFiles(this.root, path);
  }

  readNote(path: string) {
    return readNote(this.root, path);
  }

  async readSection(path: string, heading: string) {
    const markdown = await readNote(this.root, path);
    return { path, heading, content: readSection(markdown, heading) };
  }

  async createNote(path: string, content: string) {
    await createNote(this.root, path, content);
    this.refresh();
  }

  async updateNote(path: string, content: string) {
    await this.snapshot(path, "update_note");
    await updateNote(this.root, path, content);
    this.refresh();
  }

  async appendToNote(path: string, content: string, heading?: string) {
    await this.snapshot(path, "append_to_note");
    await appendToNote(this.root, path, content, heading);
    this.refresh();
  }

  async updateSection(path: string, heading: string, content: string) {
    await this.snapshot(path, "update_section");
    await updateSection(this.root, path, heading, content);
    this.refresh();
  }

  async moveNote(from: string, to: string) {
    await this.snapshot(from, "move_note");
    await moveNote(this.root, from, to);
    this.refresh();
  }

  async copyNote(from: string, to: string) {
    await copyNote(this.root, from, to);
    this.refresh();
    return { ok: true, from, to };
  }

  createFolder(path: string) {
    createFolder(this.root, path);
  }

  async deleteFolder(path: string, confirm: boolean, recursive = false) {
    if (confirm) {
      for (const note of walkMarkdownFiles(this.root, path)) {
        await this.snapshot(note.path, "delete_folder");
      }
    }
    await deleteFolder(this.root, path, confirm, recursive);
    this.refresh();
    return { ok: true, path, recursive };
  }

  async renameFolder(from: string, to: string) {
    const source = toSafeRelative(this.root, from);
    const dest = toSafeRelative(this.root, to);
    for (const note of walkMarkdownFiles(this.root, source)) {
      await this.snapshot(note.path, "rename_folder");
    }
    await renameFolder(this.root, source, dest);
    const rewritten = await rewriteLinksAfterMove(this.root, source, dest);
    this.refresh();
    return { ok: true, from: source, to: dest, linksRewritten: rewritten };
  }

  async deleteNote(path: string, confirm: boolean) {
    if (confirm) {
      await this.snapshot(path, "delete_note");
    }
    await deleteNote(this.root, path, confirm);
    this.refresh();
  }

  async batchReadNotes(paths: string[]) {
    if (paths.length > 25) {
      throw new KnowledgeError("TOO_MANY", "batch_read_notes accepts at most 25 paths");
    }
    const notes = [];
    for (const path of paths) {
      notes.push({ path, content: await readNote(this.root, path) });
    }
    return notes;
  }

  async batchUpdateNotes(updates: { path: string; content: string }[]) {
    if (updates.length > 25) {
      throw new KnowledgeError("TOO_MANY", "batch_update_notes accepts at most 25 updates");
    }
    for (const update of updates) {
      if (existsSync(resolveInsideRoot(this.root, update.path))) {
        await this.snapshot(update.path, "batch_update_notes");
        await updateNote(this.root, update.path, update.content);
      } else {
        await createNote(this.root, update.path, update.content);
      }
    }
    this.refresh();
    return { ok: true, count: updates.length };
  }

  search(query: string, path?: string, limit?: number): SearchHit[] {
    return searchNotes(this.index, query, { pathPrefix: path, limit });
  }

  getStudyIndex(path?: string): SubjectIndex[] {
    return getStudyIndex(this.root, path ?? "");
  }

  getNoteMetadata(path: string) {
    return getNoteMetadata(this.root, path);
  }

  getNoteOutline(path: string) {
    return getNoteOutline(this.root, path);
  }

  getRecentChanges(path?: string, limit?: number) {
    return getRecentChanges(this.root, path ?? "", limit ?? 10);
  }

  getVaultOverview() {
    return getVaultOverview(this.root);
  }

  getBacklinks(path: string) {
    return getBacklinks(this.root, path);
  }

  validateLinks(path?: string) {
    return validateLinks(this.root, path ?? "");
  }

  listNoteVersions(path: string) {
    return listNoteVersions(this.root, path);
  }

  getNoteVersion(path: string, version?: string) {
    if (!version) {
      return { path, versions: listNoteVersions(this.root, path) };
    }
    return readNoteVersion(this.root, path, version);
  }

  async restoreNoteVersion(path: string, version: string, confirm: boolean) {
    if (!confirm) {
      throw new KnowledgeError("CONFIRM_REQUIRED", `Restoration not confirmed. Call restore_note_version with confirm=true for ${path}`);
    }
    const snapshot = readNoteVersion(this.root, path, version);
    await this.snapshot(path, "restore_note_version");
    await updateNote(this.root, path, snapshot.content);
    this.refresh();
    return { ok: true, path, version };
  }

  async getFileDiff(path: string, oldVersion?: string) {
    const current = await readNote(this.root, path);
    const versions = listNoteVersions(this.root, path);
    if (versions.length === 0 && !oldVersion) {
      return { path, diff: "(no snapshots yet)", currentLength: current.length };
    }
    const previous = readNoteVersion(this.root, path, oldVersion);
    return {
      path,
      oldVersion: previous.version,
      diff: unifiedDiff(previous.content, current),
    };
  }

  getStudyProgress(subject?: string) {
    return getStudyProgress(this.root, subject);
  }

  updateTopicStatus(subject: string, topic: string, status: string) {
    return updateTopicStatus(this.root, subject, topic, status as TopicStatus);
  }

  addRevisionItem(subject: string, topic: string, dueDate?: string) {
    return addRevisionItem(this.root, subject, topic, dueDate);
  }

  getRevisionQueue(subject?: string, limit?: number) {
    return getRevisionQueue(this.root, subject, limit);
  }

  recordStudySession(input: { subject: string; topics: string[]; duration?: string; summary?: string }) {
    return recordStudySession(this.root, input);
  }
}

export { TOPIC_STATUSES };

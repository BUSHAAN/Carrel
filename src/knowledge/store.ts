import MiniSearch from "minisearch";
import {
  appendToNote,
  createFolder,
  createNote,
  deleteNote,
  ensureKnowledgeRoot,
  listFiles,
  listFolders,
  moveNote,
  readNote,
  updateNote,
  updateSection,
} from "./fs.js";
import { buildSearchIndex, searchNotes, type SearchHit } from "./search.js";
import { getStudyIndex, type SubjectIndex } from "./study-index.js";

export class KnowledgeStore {
  private index: MiniSearch<{ id: string; path: string; heading: string; text: string }>;

  constructor(readonly root: string) {
    ensureKnowledgeRoot(root);
    this.index = buildSearchIndex(root);
  }

  refresh(): void {
    this.index = buildSearchIndex(this.root);
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

  async createNote(path: string, content: string) {
    await createNote(this.root, path, content);
    this.refresh();
  }

  async updateNote(path: string, content: string) {
    await updateNote(this.root, path, content);
    this.refresh();
  }

  async appendToNote(path: string, content: string, heading?: string) {
    await appendToNote(this.root, path, content, heading);
    this.refresh();
  }

  async updateSection(path: string, heading: string, content: string) {
    await updateSection(this.root, path, heading, content);
    this.refresh();
  }

  async moveNote(from: string, to: string) {
    await moveNote(this.root, from, to);
    this.refresh();
  }

  createFolder(path: string) {
    createFolder(this.root, path);
  }

  async deleteNote(path: string, confirm: boolean) {
    await deleteNote(this.root, path, confirm);
    this.refresh();
  }

  search(query: string, path?: string, limit?: number): SearchHit[] {
    return searchNotes(this.index, query, { pathPrefix: path, limit });
  }

  getStudyIndex(path?: string): SubjectIndex[] {
    return getStudyIndex(this.root, path ?? "");
  }
}

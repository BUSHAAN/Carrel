import { randomBytes } from "node:crypto";
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readdirSync, renameSync, rmSync, statSync, writeSync } from "node:fs";
import { readFile, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { KnowledgeError } from "./errors.js";
import { assertMarkdownNote, assertSafeRelative, resolveInsideRoot, toRootRelative } from "./paths.js";
import { appendText, replaceSection } from "./sections.js";

export type FolderEntry = { name: string; path: string };
export type FileEntry = { name: string; path: string; mtimeMs: number };

export function ensureKnowledgeRoot(root: string): void {
  mkdirSync(root, { recursive: true });
}

export function listFolders(root: string, relativePath = ""): FolderEntry[] {
  const dir = resolveInsideRoot(root, relativePath);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new KnowledgeError("NOT_FOUND", `Folder not found: ${relativePath || "/"}`);
  }
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => ({
      name: entry.name,
      path: toRootRelative(root, join(dir, entry.name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function listFiles(root: string, relativePath: string): FileEntry[] {
  const dir = resolveInsideRoot(root, relativePath);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new KnowledgeError("NOT_FOUND", `Folder not found: ${relativePath}`);
  }
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => {
      const absolute = join(dir, entry.name);
      return {
        name: entry.name,
        path: toRootRelative(root, absolute),
        mtimeMs: statSync(absolute).mtimeMs,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function readNote(root: string, relativePath: string): Promise<string> {
  assertMarkdownNote(root, relativePath);
  const absolute = resolveInsideRoot(root, relativePath);
  if (!existsSync(absolute) || !statSync(absolute).isFile()) {
    throw new KnowledgeError("NOT_FOUND", `Note not found: ${relativePath}`);
  }
  return readFile(absolute, "utf8");
}

export function createFolder(root: string, relativePath: string): void {
  const safe = assertSafeRelative(root, relativePath);
  if (safe === "") {
    throw new KnowledgeError("INVALID_PATH", "Folder path is required");
  }
  const absolute = resolveInsideRoot(root, safe);
  if (existsSync(absolute)) {
    throw new KnowledgeError("ALREADY_EXISTS", `Folder already exists: ${safe}`);
  }
  mkdirSync(absolute, { recursive: true });
}

export function atomicWriteFile(absolute: string, content: string): void {
  mkdirSync(dirname(absolute), { recursive: true });
  const temp = `${absolute}.${randomBytes(8).toString("hex")}.tmp`;
  const fd = openSync(temp, "w");
  try {
    writeSync(fd, content);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  try {
    renameSync(temp, absolute);
  } catch {
    rmSync(temp, { force: true });
    throw new KnowledgeError("WRITE_FAILED", "Failed to write note atomically");
  }
}

export async function createNote(root: string, relativePath: string, content: string): Promise<void> {
  assertMarkdownNote(root, relativePath);
  const absolute = resolveInsideRoot(root, relativePath);
  if (existsSync(absolute)) {
    throw new KnowledgeError("ALREADY_EXISTS", `Note already exists: ${relativePath}`);
  }
  atomicWriteFile(absolute, content.endsWith("\n") ? content : `${content}\n`);
}

export async function updateNote(root: string, relativePath: string, content: string): Promise<void> {
  assertMarkdownNote(root, relativePath);
  const absolute = resolveInsideRoot(root, relativePath);
  if (!existsSync(absolute)) {
    throw new KnowledgeError("NOT_FOUND", `Note not found: ${relativePath}`);
  }
  atomicWriteFile(absolute, content.endsWith("\n") ? content : `${content}\n`);
}

export async function appendToNote(root: string, relativePath: string, content: string, heading?: string): Promise<void> {
  const existing = await readNote(root, relativePath);
  const next = appendText(existing, content, heading);
  await updateNote(root, relativePath, next);
}

export async function updateSection(root: string, relativePath: string, heading: string, content: string): Promise<void> {
  const existing = await readNote(root, relativePath);
  const next = replaceSection(existing, heading, content);
  await updateNote(root, relativePath, next);
}

export async function moveNote(root: string, from: string, to: string): Promise<void> {
  assertMarkdownNote(root, from);
  assertMarkdownNote(root, to);
  const source = resolveInsideRoot(root, from);
  const dest = resolveInsideRoot(root, to);
  if (!existsSync(source)) {
    throw new KnowledgeError("NOT_FOUND", `Note not found: ${from}`);
  }
  if (existsSync(dest)) {
    throw new KnowledgeError("ALREADY_EXISTS", `Destination already exists: ${to}`);
  }
  mkdirSync(dirname(dest), { recursive: true });
  await rename(source, dest);
}

export async function copyNote(root: string, from: string, to: string): Promise<void> {
  const content = await readNote(root, from);
  await createNote(root, to, content);
}

export async function deleteFolder(root: string, relativePath: string, confirm: boolean, recursive = false): Promise<void> {
  const safe = assertSafeRelative(root, relativePath);
  if (safe === "") {
    throw new KnowledgeError("INVALID_PATH", "Cannot delete the knowledge root");
  }
  if (!confirm) {
    throw new KnowledgeError(
      "CONFIRM_REQUIRED",
      `Deletion not confirmed. Call delete_folder with confirm=true and path="${safe}"${recursive ? " and recursive=true" : ""}`,
    );
  }
  const absolute = resolveInsideRoot(root, safe);
  if (!existsSync(absolute) || !statSync(absolute).isDirectory()) {
    throw new KnowledgeError("NOT_FOUND", `Folder not found: ${safe}`);
  }
  const notes = walkMarkdownFiles(root, safe);
  const childDirs = listFolders(root, safe);
  if (!recursive && (notes.length > 0 || childDirs.length > 0)) {
    throw new KnowledgeError(
      "NOT_EMPTY",
      `Folder is not empty (${notes.length} notes, ${childDirs.length} subfolders). Pass recursive=true and confirm=true to delete it.`,
    );
  }
  await rm(absolute, { recursive: true, force: true });
}

export async function renameFolder(root: string, from: string, to: string): Promise<void> {
  const sourceRel = assertSafeRelative(root, from);
  const destRel = assertSafeRelative(root, to);
  if (sourceRel === "" || destRel === "") {
    throw new KnowledgeError("INVALID_PATH", "Cannot rename the knowledge root");
  }
  if (destRel === sourceRel || destRel.startsWith(`${sourceRel}/`)) {
    throw new KnowledgeError("INVALID_PATH", "Destination cannot be inside the source folder");
  }
  const source = resolveInsideRoot(root, sourceRel);
  const dest = resolveInsideRoot(root, destRel);
  if (!existsSync(source) || !statSync(source).isDirectory()) {
    throw new KnowledgeError("NOT_FOUND", `Folder not found: ${sourceRel}`);
  }
  if (existsSync(dest)) {
    throw new KnowledgeError("ALREADY_EXISTS", `Destination already exists: ${destRel}`);
  }
  mkdirSync(dirname(dest), { recursive: true });
  await rename(source, dest);
}

export async function deleteNote(root: string, relativePath: string, confirm: boolean): Promise<void> {
  assertMarkdownNote(root, relativePath);
  if (!confirm) {
    throw new KnowledgeError(
      "CONFIRM_REQUIRED",
      `Deletion not confirmed. Call delete_note again with confirm=true and path="${relativePath}"`,
    );
  }
  const absolute = resolveInsideRoot(root, relativePath);
  if (!existsSync(absolute)) {
    throw new KnowledgeError("NOT_FOUND", `Note not found: ${relativePath}`);
  }
  await rm(absolute);
}

export function walkMarkdownFiles(root: string, relativePath = ""): FileEntry[] {
  const dir = resolveInsideRoot(root, relativePath);
  if (!existsSync(dir)) {
    return [];
  }
  const files: FileEntry[] = [];

  function walk(current: string): void {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) {
        continue;
      }
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        files.push({
          name: entry.name,
          path: toRootRelative(root, absolute),
          mtimeMs: statSync(absolute).mtimeMs,
        });
      }
    }
  }

  walk(dir);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

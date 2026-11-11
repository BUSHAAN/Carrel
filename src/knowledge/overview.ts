import { existsSync, statSync } from "node:fs";
import { basename } from "node:path";
import { listFolders, readNote, walkMarkdownFiles, type FileEntry } from "./fs.js";
import { resolveInsideRoot } from "./paths.js";
import { noteOutline } from "./sections.js";

export async function getNoteMetadata(root: string, path: string) {
  const content = await readNote(root, path);
  const absolute = resolveInsideRoot(root, path);
  const stat = statSync(absolute);
  const title = content.match(/^#\s+(.+)$/mu)?.[1]?.trim() ?? basename(path, ".md");
  const headings = noteOutline(content).map((item) => item.heading);
  const words = content.trim() === "" ? 0 : content.trim().split(/\s+/u).length;
  return {
    path,
    title,
    headings,
    wordCount: words,
    bytes: stat.size,
    createdAt: stat.birthtime.toISOString(),
    modifiedAt: stat.mtime.toISOString(),
  };
}

export async function getNoteOutline(root: string, path: string) {
  const content = await readNote(root, path);
  return { path, outline: noteOutline(content) };
}

export function getRecentChanges(root: string, pathPrefix = "", limit = 10): FileEntry[] {
  return walkMarkdownFiles(root, pathPrefix)
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, limit)
    .map((file) => file);
}

export type TreeNode = { name: string; path: string; notes: number; children: TreeNode[] };

function notesInFolder(root: string, relative: string): number {
  return walkMarkdownFiles(root, relative).filter((file) => {
    const parent = file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : "";
    return parent === relative;
  }).length;
}

function buildTree(root: string, relative: string): TreeNode {
  return {
    name: relative === "" ? "Knowledge" : (relative.split("/").at(-1) ?? relative),
    path: relative,
    notes: notesInFolder(root, relative),
    children: listFolders(root, relative).map((folder) => buildTree(root, folder.path)),
  };
}

export function getVaultOverview(root: string) {
  const files = walkMarkdownFiles(root);
  const bytes = files.reduce((sum, file) => {
    const absolute = resolveInsideRoot(root, file.path);
    return sum + (existsSync(absolute) ? statSync(absolute).size : 0);
  }, 0);
  return {
    noteCount: files.length,
    folderCount: countFolders(root, ""),
    bytes,
    tree: buildTree(root, ""),
  };
}

function countFolders(root: string, relative: string): number {
  const folders = listFolders(root, relative);
  return folders.length + folders.reduce((sum, folder) => sum + countFolders(root, folder.path), 0);
}

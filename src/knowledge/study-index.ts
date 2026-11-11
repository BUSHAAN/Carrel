import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { listFolders, walkMarkdownFiles } from "./fs.js";
import { resolveInsideRoot, toPosix } from "./paths.js";

export type SubjectIndex = {
  path: string;
  title: string;
  readme: string | null;
  topics: string[];
  notes: string[];
  lastModified: string | null;
};

function titleFromReadme(markdown: string, fallback: string): string {
  const heading = markdown.match(/^#\s+(.+)$/mu);
  return heading?.[1]?.trim() ?? fallback;
}

function listItems(markdown: string): string[] {
  return markdown
    .split(/\r?\n/u)
    .map((line) => line.match(/^\s*[-*]\s+(.+)$/u)?.[1]?.trim())
    .filter((item): item is string => Boolean(item));
}

export function getStudyIndex(root: string, relativePath = ""): SubjectIndex[] {
  const subjects = listFolders(root, relativePath);
  const walkRoot = relativePath;
  const readmes = walkMarkdownFiles(root, walkRoot).filter((file) => file.name.toLowerCase() === "readme.md");
  const byFolder = new Map<string, (typeof readmes)[number]>();
  for (const file of readmes) {
    const folder = toPosix(dirname(file.path));
    byFolder.set(folder === "." ? "" : folder, file);
  }

  const folders = subjects.length > 0 ? subjects : [{ name: relativePath || "Knowledge", path: relativePath }];
  return folders.map((folder) => {
    const readme = byFolder.get(folder.path) ?? (folder.path === "" ? byFolder.get("") : undefined);
    const allNotes = walkMarkdownFiles(root, folder.path);
    const notes = allNotes.filter((file) => file.name.toLowerCase() !== "readme.md").map((file) => file.path);
    let title = folder.name;
    let topics: string[] = [];
    const newest = allNotes.reduce<number | null>((max, file) => (max === null || file.mtimeMs > max ? file.mtimeMs : max), null);
    let lastModified = newest ? new Date(newest).toISOString() : null;
    if (readme) {
      const markdown = readFileSync(resolveInsideRoot(root, readme.path), "utf8");
      title = titleFromReadme(markdown, folder.name);
      topics = listItems(markdown);
    }
    return {
      path: folder.path,
      title,
      readme: readme?.path ?? null,
      topics,
      notes,
      lastModified,
    };
  });
}

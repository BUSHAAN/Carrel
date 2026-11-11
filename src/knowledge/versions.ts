import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { KnowledgeError } from "./errors.js";
import { atomicWriteFile, readNote } from "./fs.js";
import { assertMarkdownNote, resolveInsideRoot, toSafeRelative } from "./paths.js";

const META = ".study-mcp";
const MAX_VERSIONS = 50;

function versionsDir(root: string, notePath: string): string {
  const safe = toSafeRelative(root, notePath).replaceAll("/", "__");
  return join(root, META, "versions", safe);
}

function stamp(): string {
  return new Date().toISOString().replaceAll(":", "-");
}

export async function snapshotNote(root: string, relativePath: string, reason: string): Promise<string | null> {
  assertMarkdownNote(root, relativePath);
  const absolute = resolveInsideRoot(root, relativePath);
  if (!existsSync(absolute)) {
    return null;
  }
  const dir = versionsDir(root, relativePath);
  mkdirSync(dir, { recursive: true });
  const id = stamp();
  const body = await readNote(root, relativePath);
  atomicWriteFile(join(dir, `${id}.md`), `<!-- snapshot:${reason} -->\n${body}`);
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .sort();
  while (files.length > MAX_VERSIONS) {
    const oldest = files.shift();
    if (oldest) {
      rmSync(join(dir, oldest), { force: true });
    }
  }
  return id;
}

export function listNoteVersions(root: string, relativePath: string): { version: string; mtime: string; bytes: number }[] {
  assertMarkdownNote(root, relativePath);
  const dir = versionsDir(root, relativePath);
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => {
      const absolute = join(dir, name);
      const stat = statSync(absolute);
      return {
        version: name.replace(/\.md$/u, ""),
        mtime: stat.mtime.toISOString(),
        bytes: stat.size,
      };
    })
    .sort((a, b) => b.version.localeCompare(a.version));
}

export function readNoteVersion(root: string, relativePath: string, version?: string): { version: string; content: string } {
  const versions = listNoteVersions(root, relativePath);
  if (versions.length === 0) {
    throw new KnowledgeError("NOT_FOUND", `No snapshots for ${relativePath}`);
  }
  const id = version ?? versions[0]!.version;
  const absolute = join(versionsDir(root, relativePath), `${id}.md`);
  if (!existsSync(absolute)) {
    throw new KnowledgeError("NOT_FOUND", `Version not found: ${id}`);
  }
  const raw = readFileSync(absolute, "utf8");
  const content = raw.replace(/^<!-- snapshot:.*? -->\n/u, "");
  return { version: id, content };
}

export function unifiedDiff(oldText: string, newText: string): string {
  const oldLines = oldText.split(/\r?\n/u);
  const newLines = newText.split(/\r?\n/u);
  const lines: string[] = [];
  const max = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < max; i += 1) {
    const a = oldLines[i];
    const b = newLines[i];
    if (a === b) {
      if (a !== undefined) {
        lines.push(` ${a}`);
      }
    } else {
      if (a !== undefined) {
        lines.push(`-${a}`);
      }
      if (b !== undefined) {
        lines.push(`+${b}`);
      }
    }
  }
  return lines.join("\n");
}

import { isAbsolute, relative, resolve, sep } from "node:path";
import { KnowledgeError } from "./errors.js";

const WINDOWS_DRIVE = /^[a-zA-Z]:/;

export function toPosix(input: string): string {
  return input.replaceAll("\\", "/");
}

export function normalizeRelative(input: string | undefined): string {
  if (input === undefined || input.trim() === "" || input.trim() === ".") {
    return "";
  }
  return toPosix(input.trim()).replace(/^\/+/u, "");
}

function isInside(rootAbs: string, candidateAbs: string): boolean {
  const rel = relative(rootAbs, candidateAbs);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/** Relative POSIX path inside the knowledge root. Accepts workspace/knowledge absolute paths. */
export function toSafeRelative(root: string, input: string | undefined): string {
  const rootAbs = resolve(root);
  const trimmed = (input ?? "").trim();
  if (trimmed === "" || trimmed === "." || trimmed === "/" || trimmed === "./") {
    return "";
  }
  if (trimmed.includes("\0")) {
    throw new KnowledgeError("INVALID_PATH", "Path contains a null byte");
  }

  const looksAbsolute = isAbsolute(trimmed) || WINDOWS_DRIVE.test(trimmed) || trimmed.startsWith("//");
  if (looksAbsolute) {
    const abs = resolve(trimmed);
    if (isInside(rootAbs, abs)) {
      return toPosix(relative(rootAbs, abs));
    }
    const projectAbs = resolve(rootAbs, "..");
    if (abs === projectAbs) {
      return "";
    }
    throw new KnowledgeError(
      "INVALID_PATH",
      `Use a path inside the knowledge base (relative like "HPC"), not the git workspace. Knowledge root: ${rootAbs}`,
    );
  }

  const posix = toPosix(trimmed).replace(/^\/+/u, "");
  const segments = posix.split("/").filter((part) => part !== "" && part !== ".");
  if (segments.some((part) => part === "..")) {
    throw new KnowledgeError("INVALID_PATH", "Path traversal is not allowed");
  }
  return segments.join("/");
}

export function assertSafeRelative(root: string, input: string): string {
  return toSafeRelative(root, input);
}

export function resolveInsideRoot(root: string, relativePath: string): string {
  const safe = toSafeRelative(root, relativePath);
  const rootAbs = resolve(root);
  return safe === "" ? rootAbs : resolve(rootAbs, ...safe.split("/"));
}

export function toRootRelative(root: string, absolutePath: string): string {
  const rootAbs = resolve(root);
  const rel = relative(rootAbs, absolutePath);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new KnowledgeError("INVALID_PATH", "Path escapes the knowledge root");
  }
  return toPosix(rel);
}

export function assertMarkdownNote(root: string, relativePath: string): void {
  const posix = toSafeRelative(root, relativePath);
  if (posix === "" || !posix.toLowerCase().endsWith(".md")) {
    throw new KnowledgeError("INVALID_PATH", "Note path must be a .md file inside the knowledge root");
  }
}

export function joinRootDisplay(parts: string[]): string {
  return parts.filter(Boolean).join("/") || ".";
}

export { sep as nativeSep };

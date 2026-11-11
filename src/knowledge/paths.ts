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

export function assertSafeRelative(input: string): string {
  const posix = normalizeRelative(input);
  if (posix.includes("\0")) {
    throw new KnowledgeError("INVALID_PATH", "Path contains a null byte");
  }
  if (isAbsolute(input) || WINDOWS_DRIVE.test(input) || posix.startsWith("//")) {
    throw new KnowledgeError("INVALID_PATH", "Absolute paths are not allowed");
  }
  const segments = posix.split("/").filter((part) => part !== "" && part !== ".");
  if (segments.some((part) => part === "..")) {
    throw new KnowledgeError("INVALID_PATH", "Path traversal is not allowed");
  }
  return segments.join("/");
}

export function resolveInsideRoot(root: string, relativePath: string): string {
  const safe = assertSafeRelative(relativePath);
  const rootAbs = resolve(root);
  const absolute = safe === "" ? rootAbs : resolve(rootAbs, ...safe.split("/"));
  const rel = relative(rootAbs, absolute);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new KnowledgeError("INVALID_PATH", "Path escapes the knowledge root");
  }
  return absolute;
}

export function toRootRelative(root: string, absolutePath: string): string {
  const rootAbs = resolve(root);
  const rel = relative(rootAbs, absolutePath);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new KnowledgeError("INVALID_PATH", "Path escapes the knowledge root");
  }
  return toPosix(rel);
}

export function assertMarkdownNote(relativePath: string): void {
  const posix = assertSafeRelative(relativePath);
  if (posix === "" || !posix.toLowerCase().endsWith(".md")) {
    throw new KnowledgeError("INVALID_PATH", "Note path must be a .md file inside the knowledge root");
  }
}

export function joinRootDisplay(parts: string[]): string {
  return parts.filter(Boolean).join("/") || ".";
}

export { sep as nativeSep };

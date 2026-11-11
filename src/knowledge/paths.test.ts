import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KnowledgeError } from "./errors.js";
import { assertMarkdownNote, resolveInsideRoot } from "./paths.js";

const root = mkdtempSync(join(tmpdir(), "study-mcp-paths-"));

describe("path sandbox", () => {
  it("resolves notes inside the root", () => {
    const absolute = resolveInsideRoot(root, "Computer Science/README.md");
    expect(absolute.startsWith(root)).toBe(true);
  });

  it("rejects parent traversal", () => {
    expect(() => resolveInsideRoot(root, "../secret.md")).toThrow(KnowledgeError);
    expect(() => resolveInsideRoot(root, "a/../../secret.md")).toThrow(KnowledgeError);
  });

  it("rejects absolute paths", () => {
    expect(() => resolveInsideRoot(root, "/tmp/x.md")).toThrow(KnowledgeError);
  });

  it("requires markdown notes", () => {
    expect(() => assertMarkdownNote("notes.txt")).toThrow(/\.md/);
  });
});

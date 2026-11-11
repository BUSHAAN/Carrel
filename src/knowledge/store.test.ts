import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KnowledgeError } from "./errors.js";
import { KnowledgeStore } from "./store.js";

function tempStore(): KnowledgeStore {
  return new KnowledgeStore(mkdtempSync(join(tmpdir(), "study-mcp-kb-")));
}

describe("KnowledgeStore", () => {
  it("creates, reads, and atomically updates notes", async () => {
    const store = tempStore();
    store.createFolder("Compiler Design");
    await store.createNote("Compiler Design/Opt.md", "# Opt\n\n## First\n\nold\n");
    await store.updateNote("Compiler Design/Opt.md", "# Opt\n\n## First\n\nnew\n");
    expect(await store.readNote("Compiler Design/Opt.md")).toContain("new");
    await expect(store.createNote("Compiler Design/Opt.md", "nope")).rejects.toBeInstanceOf(KnowledgeError);
  });

  it("appends and replaces a heading section", async () => {
    const store = tempStore();
    await store.createNote("topic.md", "# Topic\n\n## Alpha\n\none\n\n## Beta\n\ntwo\n");
    await store.appendToNote("topic.md", "extra", "Alpha");
    await store.updateSection("topic.md", "Beta", "replaced");
    const body = await store.readNote("topic.md");
    expect(body).toContain("one");
    expect(body).toContain("extra");
    expect(body).toContain("replaced");
    expect(body).not.toContain("two");
  });

  it("searches notes", async () => {
    const store = tempStore();
    await store.createNote("Code Optimization.md", "## Constant Propagation\n\nSubstitute known constants into expressions.\n");
    const hits = store.search("constant propagation");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.path).toBe("Code Optimization.md");
  });

  it("requires confirmation before delete", async () => {
    const store = tempStore();
    await store.createNote("keep.md", "hello\n");
    await expect(store.deleteNote("keep.md", false)).rejects.toMatchObject({ code: "CONFIRM_REQUIRED" });
    expect(await store.readNote("keep.md")).toContain("hello");
    await store.deleteNote("keep.md", true);
    await expect(store.readNote("keep.md")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

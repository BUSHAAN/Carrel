import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KnowledgeStore } from "./store.js";

function tempStore(): KnowledgeStore {
  return new KnowledgeStore(mkdtempSync(join(tmpdir(), "study-mcp-wf-")));
}

describe("workflow tools", () => {
  it("reads a section, metadata, outline and batch notes", async () => {
    const store = tempStore();
    await store.createNote("OS/Scheduling.md", "# Scheduling\n\n## Round Robin\n\nQuantum.\n\n## FCFS\n\nQueue.\n");
    await store.createNote("OS/README.md", "# OS\n\n- [Scheduling](./Scheduling.md)\n");
    const section = await store.readSection("OS/Scheduling.md", "Round Robin");
    expect(section.content).toContain("Quantum");
    const meta = await store.getNoteMetadata("OS/Scheduling.md");
    expect(meta.title).toBe("Scheduling");
    expect(meta.headings).toContain("FCFS");
    const outline = await store.getNoteOutline("OS/Scheduling.md");
    expect(outline.outline.map((item) => item.heading)).toEqual(["Scheduling", "Round Robin", "FCFS"]);
    const batch = await store.batchReadNotes(["OS/Scheduling.md", "OS/README.md"]);
    expect(batch).toHaveLength(2);
  });

  it("snapshots before update and can restore", async () => {
    const store = tempStore();
    await store.createNote("a.md", "one\n");
    await store.updateNote("a.md", "two\n");
    const listed = store.listNoteVersions("a.md");
    expect(listed.length).toBeGreaterThan(0);
    const version = listed[0]!.version;
    await store.restoreNoteVersion("a.md", version, true);
    expect(await store.readNote("a.md")).toContain("one");
  });

  it("reports backlinks and broken links", async () => {
    const store = tempStore();
    await store.createNote("index.md", "[ok](./real.md) [missing](./nope.md)\n");
    await store.createNote("real.md", "hi\n");
    const backlinks = await store.getBacklinks("real.md");
    expect(backlinks.some((link) => link.from === "index.md")).toBe(true);
    const broken = await store.validateLinks();
    expect(broken.some((link) => link.resolved.includes("nope"))).toBe(true);
  });

  it("copies notes, refuses non-empty folder delete, and renames with link repair", async () => {
    const store = tempStore();
    await store.createNote("OS/Scheduling.md", "# Scheduling\n");
    await store.createNote("index.md", "[OS](./OS/Scheduling.md)\n");
    await store.copyNote("OS/Scheduling.md", "OS/Scheduling copy.md");
    expect(await store.readNote("OS/Scheduling copy.md")).toContain("Scheduling");
    await expect(store.deleteFolder("OS", true, false)).rejects.toMatchObject({ code: "NOT_EMPTY" });
    const renamed = await store.renameFolder("OS", "Operating Systems");
    expect(renamed.ok).toBe(true);
    const index = await store.readNote("index.md");
    expect(index).toContain("Operating%20Systems/Scheduling.md");
    await store.deleteFolder("Operating Systems", true, true);
    await expect(store.readNote("Operating Systems/Scheduling.md")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("tracks study progress and revision", () => {
    const store = tempStore();
    store.updateTopicStatus("Operating Systems", "Scheduling", "learning");
    store.addRevisionItem("Operating Systems", "Scheduling");
    store.recordStudySession({ subject: "Operating Systems", topics: ["Scheduling"], summary: "RR vs FCFS" });
    const progress = store.getStudyProgress("Operating Systems");
    expect(progress.subjects[0]?.topics[0]?.status).toBe("learning");
    expect(store.getRevisionQueue("Operating Systems").length).toBe(1);
  });
});

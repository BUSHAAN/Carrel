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

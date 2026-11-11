import MiniSearch from "minisearch";
import { readFileSync } from "node:fs";
import { resolveInsideRoot } from "./paths.js";
import { extractHeadingSnippets } from "./sections.js";
import { walkMarkdownFiles } from "./fs.js";

export type SearchHit = {
  path: string;
  heading: string;
  snippet: string;
  score: number;
};

type SearchDoc = {
  id: string;
  path: string;
  heading: string;
  text: string;
};

function snippetAround(text: string, query: string, max = 220): string {
  const haystack = text.replace(/\s+/gu, " ").trim();
  const needle = query.trim();
  const idx = haystack.toLowerCase().indexOf(needle.toLowerCase());
  if (idx < 0) {
    return haystack.slice(0, max);
  }
  const start = Math.max(0, idx - 40);
  const end = Math.min(haystack.length, idx + needle.length + 160);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < haystack.length ? "…" : "";
  return `${prefix}${haystack.slice(start, end)}${suffix}`;
}

export function buildSearchIndex(root: string): MiniSearch<SearchDoc> {
  const mini = new MiniSearch<SearchDoc>({
    fields: ["path", "heading", "text"],
    storeFields: ["path", "heading", "text"],
    searchOptions: { boost: { heading: 3, path: 2, text: 1 }, fuzzy: 0.15 },
  });

  const docs: SearchDoc[] = [];
  for (const file of walkMarkdownFiles(root)) {
    const absolute = resolveInsideRoot(root, file.path);
    const markdown = readFileSync(absolute, "utf8");
    const chunks = extractHeadingSnippets(markdown);
    chunks.forEach((chunk, index) => {
      docs.push({
        id: `${file.path}#${index}`,
        path: file.path,
        heading: chunk.heading,
        text: chunk.text,
      });
    });
  }
  mini.addAll(docs);
  return mini;
}

export function searchNotes(
  index: MiniSearch<SearchDoc>,
  query: string,
  options?: { pathPrefix?: string; limit?: number },
): SearchHit[] {
  const limit = options?.limit ?? 10;
  const prefix = options?.pathPrefix?.replace(/\/$/u, "");
  const results = index.search(query, { prefix: true });
  return results
    .filter((result) => (prefix ? String(result.path).startsWith(prefix) : true))
    .slice(0, limit)
    .map((result) => ({
      path: String(result.path),
      heading: String(result.heading ?? ""),
      snippet: snippetAround(String(result.text ?? ""), query),
      score: result.score,
    }));
}

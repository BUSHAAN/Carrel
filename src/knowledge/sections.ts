import { KnowledgeError } from "./errors.js";

export type MarkdownSection = {
  heading: string;
  level: number;
  start: number;
  end: number;
  bodyStart: number;
};

const HEADING = /^(#{1,6})\s+(.+?)\s*$/u;

export function splitSections(markdown: string): MarkdownSection[] {
  const lines = markdown.split(/\r?\n/u);
  const sections: MarkdownSection[] = [];
  let lineStart = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const match = HEADING.exec(line);
    if (match) {
      const heading = (match[2] ?? "").trim();
      const level = (match[1] ?? "#").length;
      if (sections.length > 0) {
        sections[sections.length - 1]!.end = lineStart;
      }
      sections.push({
        heading,
        level,
        start: lineStart,
        bodyStart: lineStart + line.length + 1,
        end: markdown.length,
      });
    }
    lineStart += line.length + 1;
  }

  return sections;
}

function findSection(markdown: string, heading: string): MarkdownSection | undefined {
  const wanted = heading.trim().toLowerCase();
  return splitSections(markdown).find((section) => section.heading.toLowerCase() === wanted);
}

export function replaceSection(markdown: string, heading: string, content: string): string {
  const section = findSection(markdown, heading);
  const body = content.trimEnd();
  if (!section) {
    throw new KnowledgeError("SECTION_NOT_FOUND", `No heading matching "${heading}"`);
  }
  const headingLineEnd = markdown.indexOf("\n", section.start);
  const headingLine = headingLineEnd === -1 ? markdown.slice(section.start) : markdown.slice(section.start, headingLineEnd);
  const next = `${headingLine}\n\n${body}\n`;
  return markdown.slice(0, section.start) + next + markdown.slice(section.end);
}

export function appendText(markdown: string, content: string, heading?: string): string {
  const chunk = content.trimEnd();
  if (!heading) {
    if (markdown.length === 0) {
      return `${chunk}\n`;
    }
    const separator = markdown.endsWith("\n") ? "\n" : "\n\n";
    return `${markdown}${separator}${chunk}\n`;
  }

  const section = findSection(markdown, heading);
  if (!section) {
    const block = `\n## ${heading.trim()}\n\n${chunk}\n`;
    if (markdown.length === 0) {
      return `## ${heading.trim()}\n\n${chunk}\n`;
    }
    return markdown.endsWith("\n") ? `${markdown}${block}` : `${markdown}\n${block}`;
  }

  const before = markdown.slice(0, section.end).replace(/\s*$/u, "");
  const after = markdown.slice(section.end);
  return `${before}\n\n${chunk}\n${after}`;
}

export function extractHeadingSnippets(markdown: string): { heading: string; text: string }[] {
  const sections = splitSections(markdown);
  if (sections.length === 0) {
    return [{ heading: "", text: markdown }];
  }
  const preamble = markdown.slice(0, sections[0]!.start).trim();
  const chunks: { heading: string; text: string }[] = [];
  if (preamble) {
    chunks.push({ heading: "", text: preamble });
  }
  for (const section of sections) {
    chunks.push({
      heading: section.heading,
      text: markdown.slice(section.start, section.end).trim(),
    });
  }
  return chunks;
}

import { existsSync } from "node:fs";
import { posix } from "node:path";
import { readNote, walkMarkdownFiles } from "./fs.js";
import { resolveInsideRoot, toPosix } from "./paths.js";

const MD_LINK = /\[([^\]]*)\]\(([^)]+)\)/g;

export type MarkdownLink = { text: string; href: string; from: string };

function isExternal(href: string): boolean {
  return /^(https?:|mailto:|footnote:|#)/iu.test(href);
}

function resolveLink(fromNote: string, href: string): string {
  const cleaned = decodeURIComponent(href.split("#")[0] ?? "").trim();
  if (!cleaned) {
    return "";
  }
  const fromDir = posix.dirname(toPosix(fromNote));
  const joined = fromDir === "." ? cleaned : posix.normalize(`${fromDir}/${cleaned}`);
  return toPosix(joined).replace(/^\.\//u, "");
}

export async function collectLinks(root: string, pathPrefix = ""): Promise<MarkdownLink[]> {
  const links: MarkdownLink[] = [];
  for (const file of walkMarkdownFiles(root, pathPrefix)) {
    const markdown = await readNote(root, file.path);
    MD_LINK.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = MD_LINK.exec(markdown))) {
      const href = (match[2] ?? "").trim();
      if (isExternal(href)) {
        continue;
      }
      links.push({ text: match[1] ?? "", href, from: file.path });
    }
  }
  return links;
}

export async function getBacklinks(root: string, path: string): Promise<{ from: string; href: string; text: string }[]> {
  const target = toPosix(path);
  const links = await collectLinks(root);
  return links.filter((link) => {
    const resolved = resolveLink(link.from, link.href);
    return resolved === target || resolved === target.replace(/\.md$/u, "");
  });
}

export async function validateLinks(root: string, pathPrefix = ""): Promise<{ from: string; href: string; resolved: string }[]> {
  const broken: { from: string; href: string; resolved: string }[] = [];
  for (const link of await collectLinks(root, pathPrefix)) {
    const resolved = resolveLink(link.from, link.href);
    if (!resolved) {
      continue;
    }
    const candidates = resolved.toLowerCase().endsWith(".md") ? [resolved] : [resolved, `${resolved}.md`];
    const ok = candidates.some((candidate) => {
      try {
        return existsSync(resolveInsideRoot(root, candidate));
      } catch {
        return false;
      }
    });
    if (!ok) {
      broken.push({ from: link.from, href: link.href, resolved });
    }
  }
  return broken;
}

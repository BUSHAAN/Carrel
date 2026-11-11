import { existsSync } from "node:fs";
import { posix } from "node:path";
import { readNote, updateNote, walkMarkdownFiles } from "./fs.js";
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

function mapPrefix(path: string, fromPrefix: string, toPrefix: string): string {
  if (path === fromPrefix) {
    return toPrefix;
  }
  if (fromPrefix !== "" && path.startsWith(`${fromPrefix}/`)) {
    return `${toPrefix}${path.slice(fromPrefix.length)}`;
  }
  return path;
}

function hrefTo(fromNote: string, toNote: string, hash: string): string {
  const fromDir = posix.dirname(toPosix(fromNote));
  let rel = posix.relative(fromDir === "." ? "" : fromDir, toPosix(toNote)).replaceAll("\\", "/");
  if (!rel.startsWith(".")) {
    rel = `./${rel}`;
  }
  const encoded = rel.split("/").map(encodeURIComponent).join("/");
  return hash ? `${encoded}#${hash}` : encoded;
}

export async function rewriteLinksAfterMove(
  root: string,
  fromPrefix: string,
  toPrefix: string,
): Promise<number> {
  let rewritten = 0;
  const files = walkMarkdownFiles(root);
  for (const file of files) {
    const markdown = await readNote(root, file.path);
    let changed = false;
    const next = markdown.replace(MD_LINK, (full, text: string, href: string) => {
      if (isExternal(href)) {
        return full;
      }
      const [pathPart, hash = ""] = href.split("#");
      const oldFrom = mapPrefix(file.path, toPrefix, fromPrefix);
      const resolved = resolveLink(oldFrom, pathPart ?? "");
      if (!resolved) {
        return full;
      }
      const mapped = mapPrefix(resolved, fromPrefix, toPrefix);
      const target = mapped.toLowerCase().endsWith(".md") ? mapped : `${mapped}.md`;
      const replacement = `[${text}](${hrefTo(file.path, target, hash)})`;
      if (replacement !== full) {
        changed = true;
      }
      return replacement;
    });
    if (changed) {
      await updateNote(root, file.path, next);
      rewritten += 1;
    }
  }
  return rewritten;
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

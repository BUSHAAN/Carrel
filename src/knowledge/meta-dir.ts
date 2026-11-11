import { existsSync } from "node:fs";
import { join } from "node:path";

/** Hidden vault metadata. Prefers `.carrel`; still reads an older `.study-mcp` folder. */
export function metaDir(root: string): string {
  const branded = join(root, ".carrel");
  const legacy = join(root, ".study-mcp");
  if (existsSync(legacy) && !existsSync(branded)) {
    return legacy;
  }
  return branded;
}

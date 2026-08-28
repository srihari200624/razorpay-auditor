import type { SourceFetcher } from "../source/fetchSource.ts";

/**
 * Wraps a SourceFetcher so one file path returns `patchedText`; every other
 * path delegates to the base source. This is the whole "scratch copy" — an
 * in-memory overlay, never a disk write. The audited repo (GitHub or a local
 * checkout) is never mutated, so the pinned vulnerable app stays vulnerable.
 */
export function overlaySource(
  base: SourceFetcher,
  filePath: string,
  patchedText: string,
): SourceFetcher {
  return {
    label: `overlay(${base.label})`,
    async fetchFile(path: string): Promise<string | null> {
      if (path === filePath) return patchedText;
      return base.fetchFile(path);
    },
  };
}

import type { EntryStatus } from "./types";

/**
 * Color contract for this page: amber = static finding, blue (sky) =
 * verified secure (a clean rule OR a blocked attack), red = a live attack
 * that actually succeeded. Red never appears anywhere else on this page.
 */
export const STATUS_STYLES: Record<EntryStatus, { tag: string; tagClass: string; barClass: string }> = {
  pending: { tag: "…", tagClass: "text-zinc-500 border-zinc-700", barClass: "bg-zinc-700" },
  found: {
    tag: "FOUND",
    tagClass: "text-amber-400 border-amber-400/40 bg-amber-400/10",
    barClass: "bg-amber-400",
  },
  clear: {
    tag: "CLEAR",
    tagClass: "text-sky-400 border-sky-400/40 bg-sky-400/10",
    barClass: "bg-sky-400",
  },
  blocked: {
    tag: "BLOCKED",
    tagClass: "text-sky-400 border-sky-400/40 bg-sky-400/10",
    barClass: "bg-sky-400",
  },
  hit: {
    tag: "LIVE HIT",
    tagClass: "text-red-400 border-red-400/50 bg-red-500/10",
    barClass: "bg-red-500",
  },
  error: {
    tag: "ERROR",
    tagClass: "text-zinc-400 border-zinc-600 bg-zinc-600/10",
    barClass: "bg-zinc-500",
  },
};

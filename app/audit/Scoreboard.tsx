import type { LogEntry } from "./types";

/**
 * A compact verdict tally over the current run's root entries, so the
 * vulnerable↔fixed contrast is legible at a glance (and screenshot-ready).
 * Colors follow the theme.ts contract: red = live hit, amber = static finding,
 * sky = secure. Pure render over `entries` — no state of its own.
 */
export function Scoreboard({ entries }: { entries: LogEntry[] }) {
  const roots = entries.filter((e) => e.parentId === null);
  if (roots.length === 0) return null;

  const hits = roots.filter((e) => e.status === "hit").length;
  const found = roots.filter((e) => e.status === "found").length;
  const secure = roots.filter((e) => e.status === "clear" || e.status === "blocked").length;
  const errors = roots.filter((e) => e.status === "error").length;
  const pending = roots.filter((e) => e.status === "pending").length;
  const resolved = roots.length - pending;

  const cleanSweep = pending === 0 && hits === 0 && found === 0 && errors === 0;

  return (
    <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
      {hits > 0 && <Chip className="border-red-400/50 bg-red-500/10 text-red-300">{hits} LIVE HIT{hits > 1 ? "S" : ""}</Chip>}
      {found > 0 && <Chip className="border-amber-400/40 bg-amber-400/10 text-amber-300">{found} FOUND</Chip>}
      {cleanSweep ? (
        <Chip className="border-sky-400/40 bg-sky-400/10 text-sky-300">ALL SECURE</Chip>
      ) : (
        secure > 0 && <Chip className="border-sky-400/40 bg-sky-400/10 text-sky-300">{secure} SECURE</Chip>
      )}
      {errors > 0 && <Chip className="border-zinc-600 bg-zinc-600/10 text-zinc-400">{errors} ERROR{errors > 1 ? "S" : ""}</Chip>}
      {pending > 0 && <span className="text-zinc-500">· {resolved}/{roots.length} checks</span>}
    </div>
  );
}

function Chip({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`rounded border px-1.5 py-0.5 font-semibold tracking-wide ${className}`}>{children}</span>;
}

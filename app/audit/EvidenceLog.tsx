import type { LogEntry } from "./types";
import { STATUS_STYLES } from "./theme";

export function EvidenceLog({ entries, emptyHint }: { entries: LogEntry[]; emptyHint: string }) {
  if (entries.length === 0) {
    return (
      <div className="px-4 py-6 font-mono text-sm text-zinc-500">{emptyHint}</div>
    );
  }

  return (
    <div className="divide-y divide-white/5">
      {entries.map((entry) => {
        const style = STATUS_STYLES[entry.status];
        return (
          <div key={entry.id} className="flex gap-3 px-4 py-3">
            <div className={`w-[3px] shrink-0 self-stretch rounded-full ${style.barClass}`} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono">
                <span className="text-sm tabular-nums text-zinc-500">{entry.time ?? "--:--:--.---"}</span>
                <span className="font-sans text-[11px] font-semibold tracking-widest text-zinc-500">
                  {entry.kind === "rule" ? "STATIC" : "ATTACK"}
                </span>
                <span
                  className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold tracking-wide ${style.tagClass}`}
                >
                  {style.tag}
                </span>
                <span className="text-lg font-medium text-zinc-100">{entry.label}</span>
                {entry.meta && <span className="text-sm text-zinc-500">{entry.meta}</span>}
              </div>
              {entry.detail && (
                <p className="mt-1 font-mono text-base leading-relaxed text-zinc-400">
                  <span className="text-zinc-600">└ </span>
                  {entry.detail}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

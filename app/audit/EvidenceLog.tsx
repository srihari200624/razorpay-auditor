import type { LogEntry } from "./types";
import { STATUS_STYLES } from "./theme";
import { FindingActions } from "./FindingActions";
import { EvidencePanel } from "./EvidencePanel";

function Row({ entry, indent }: { entry: LogEntry; indent: boolean }) {
  const style = STATUS_STYLES[entry.status];
  return (
    <div className={`flex gap-3 px-4 py-3 ${indent ? "border-l-2 border-white/5 bg-black/10 pl-6" : ""}`}>
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
}

export function EvidenceLog({
  entries,
  emptyHint,
  source = null,
  onVerified,
}: {
  entries: LogEntry[];
  emptyHint: string;
  /** Enables Draft fix / Apply — omit or pass null in contexts with no
   * static source (Draft fix/Apply are then unavailable; Explain still works). */
  source?: string | null;
  /** Called after an Apply re-verify comes back CLEAR — appends the linked
   * sky entry. Required whenever `source` is provided. */
  onVerified?: (parent: LogEntry, explanation: string, meta: string | null) => void;
}) {
  if (entries.length === 0) {
    return <div className="px-4 py-6 font-mono text-sm text-zinc-500">{emptyHint}</div>;
  }

  const roots = entries.filter((e) => e.parentId === null);
  const childrenOf = (id: string) => entries.filter((e) => e.parentId === id);

  return (
    <div className="divide-y divide-white/5">
      {roots.map((entry) => {
        const canAct = entry.status === "found" || entry.status === "hit";
        const hasEvidence =
          (entry.kind === "attack" &&
            entry.evidence != null &&
            (entry.evidence.exchanges.length > 0 || entry.evidence.stateTrail.length > 0)) ||
          (entry.kind === "rule" && !!entry.matchedCode);
        return (
          <div key={entry.id}>
            <Row entry={entry} indent={false} />
            {(canAct || hasEvidence) && (
              <div className="px-4 pb-3 pl-[27px]">
                {canAct && (
                  <FindingActions
                    entry={entry}
                    source={source}
                    onVerified={(explanation, meta) => onVerified?.(entry, explanation, meta)}
                  />
                )}
                <EvidencePanel entry={entry} />
              </div>
            )}
            {childrenOf(entry.id).map((child) => (
              <Row key={child.id} entry={child} indent />
            ))}
          </div>
        );
      })}
    </div>
  );
}

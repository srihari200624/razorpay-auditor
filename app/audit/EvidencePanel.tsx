"use client";

import { useState } from "react";
import type { LogEntry } from "./types";
import type { AttackExchange, StateReading } from "@/lib/attacks/types";

/**
 * The "receipts" for a finding — shown under a resolved row, on ANY status, so
 * a fixed app's BLOCKED/CLEAR row proves rejection just as a vulnerable app's
 * red row proves the hit. Chrome stays neutral (mono / bg-black/20); it never
 * borrows the amber/sky/red verdict colors from theme.ts. A small emerald/red
 * accent on the state trail conveys movement, not a verdict.
 */
export function EvidencePanel({ entry }: { entry: LogEntry }) {
  const [open, setOpen] = useState(false);

  const hasAttackEvidence =
    entry.kind === "attack" &&
    entry.evidence != null &&
    (entry.evidence.exchanges.length > 0 || entry.evidence.stateTrail.length > 0);
  const hasRuleEvidence = entry.kind === "rule" && !!entry.matchedCode;

  if (!hasAttackEvidence && !hasRuleEvidence) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded border border-white/15 px-2 py-1 font-sans text-[11px] font-semibold tracking-wide text-zinc-400 hover:border-white/30 hover:text-zinc-200"
      >
        {open ? "▾ HIDE EVIDENCE" : "▸ EVIDENCE"}
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-3 rounded border border-white/10 bg-black/20 px-3 py-2">
          {hasRuleEvidence && (
            <div>
              <p className="mb-1 font-sans text-[10px] font-semibold tracking-widest text-zinc-500">
                MATCHED SOURCE{entry.meta ? ` — ${entry.meta}` : ""}
              </p>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-xs leading-relaxed text-amber-200/90">
                {entry.matchedCode}
              </pre>
            </div>
          )}

          {hasAttackEvidence && entry.evidence!.exchanges.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="font-sans text-[10px] font-semibold tracking-widest text-zinc-500">
                REQUESTS FIRED
              </p>
              {entry.evidence!.exchanges.map((ex, i) => (
                <ExchangeBlock key={i} ex={ex} />
              ))}
            </div>
          )}

          {hasAttackEvidence && entry.evidence!.stateTrail.length > 0 && (
            <div>
              <p className="mb-1 font-sans text-[10px] font-semibold tracking-widest text-zinc-500">
                REAL ORDER STATE (read back from the target)
              </p>
              <StateTrail trail={entry.evidence!.stateTrail} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExchangeBlock({ ex }: { ex: AttackExchange }) {
  return (
    <div className="rounded border border-white/10 bg-black/30 font-mono text-xs">
      <div className="border-b border-white/5 px-2 py-1 text-zinc-400">
        <span className="text-zinc-500">{ex.label}</span>
      </div>
      <div className="flex flex-col gap-1 px-2 py-1.5">
        <div className="text-sky-300">
          {ex.method} {ex.path}
        </div>
        {ex.headers &&
          Object.entries(ex.headers).map(([k, v]) => (
            <div key={k} className="text-zinc-500">
              {k}: <span className="text-zinc-400">{v}</span>
            </div>
          ))}
        <div className="mt-1 whitespace-pre-wrap break-all text-zinc-300">{ex.body}</div>
        <div className="mt-1 border-t border-white/5 pt-1 text-zinc-500">
          ← <span className={ex.responseStatus === 200 ? "text-zinc-300" : "text-zinc-400"}>{ex.responseStatus}</span>
          {ex.responseBody ? <span className="text-zinc-400"> {truncate(ex.responseBody, 200)}</span> : null}
        </div>
      </div>
    </div>
  );
}

function StateTrail({ trail }: { trail: StateReading[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs">
      {trail.map((s, i) => {
        const prev = i > 0 ? trail[i - 1] : null;
        const moved =
          prev != null &&
          (prev.status !== s.status || prev.creditedRupees !== s.creditedRupees);
        return (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <span className="text-zinc-600">→</span>}
            <span className={`rounded border px-1.5 py-0.5 ${moved ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-white/10 text-zinc-400"}`}>
              <span className="text-zinc-500">{s.label}:</span> {s.status ?? "—"}
              {s.creditedRupees != null && <span className="text-zinc-300"> · ₹{s.creditedRupees}</span>}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

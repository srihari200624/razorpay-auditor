"use client";

import { useState } from "react";
import type { Finding } from "./findings";
import { SEV_PILL, SEV_DOT } from "./severity";
import { EvidencePanel } from "../audit/EvidencePanel";
import { FindingActions } from "../audit/FindingActions";

/** Shared grid template so the header and every row line up. */
export const ROW_GRID = "grid grid-cols-[96px_minmax(0,1fr)_150px_110px_20px] items-center gap-3";

function Pill({ dot, className, children }: { dot?: string; className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium ${className}`}>
      {dot && <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />}
      {children}
    </span>
  );
}

export function FindingRow({
  finding,
  source,
  verified,
  fixing = false,
  failure,
  onVerified,
}: {
  finding: Finding;
  source: string | null;
  verified: boolean;
  fixing?: boolean;
  failure?: string;
  onVerified: (defectId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const staticProven = finding.ruleEntry?.status === "found";

  return (
    <div className="border-t border-white/[0.06]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`${ROW_GRID} w-full px-4 py-3 text-left hover:bg-white/[0.02]`}
      >
        {/* Severity */}
        <span>
          <Pill dot={SEV_DOT[finding.severity]} className={`uppercase ${SEV_PILL[finding.severity]}`}>
            {finding.severity}
          </Pill>
        </span>

        {/* Finding + file */}
        <span className="min-w-0">
          <span className="block truncate font-sans text-sm font-medium text-zinc-100">{finding.title}</span>
          {finding.file && <span className="block truncate font-mono text-[11px] text-zinc-500">{finding.file}</span>}
        </span>

        {/* Proof */}
        <span className="flex flex-wrap items-center gap-1">
          {staticProven && (
            <span className="rounded border border-zinc-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">static ✓</span>
          )}
          {finding.exploited && (
            <span className="rounded border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-red-400">
              ⚔ exploited
            </span>
          )}
        </span>

        {/* Status */}
        <span>
          {verified ? (
            <Pill dot="bg-emerald-500" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">fixed</Pill>
          ) : fixing ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-blue-400">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border border-blue-400/70 border-t-transparent" aria-hidden="true" />
              fixing…
            </span>
          ) : (
            <Pill dot="bg-red-500" className="border-red-500/30 bg-red-500/10 text-red-400">open</Pill>
          )}
        </span>

        {/* Chevron */}
        <span className="text-center font-mono text-xs text-zinc-500">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1">
          <p className="mb-3 text-sm leading-relaxed text-zinc-400">{finding.impact}</p>

          <p className="mb-1.5 font-sans text-[10px] font-semibold tracking-widest text-zinc-500">PROOF</p>
          {finding.ruleEntry && <EvidencePanel entry={finding.ruleEntry} />}
          {finding.attackEntry && <EvidencePanel entry={finding.attackEntry} />}

          {failure && !verified && (
            <p className="mt-2 font-mono text-sm text-amber-400">Auto-fix: {failure}</p>
          )}

          {!verified && finding.ruleEntry && (
            <div className="mt-3 border-t border-white/5 pt-3">
              <p className="mb-1 font-sans text-[10px] font-semibold tracking-widest text-zinc-500">REMEDIATION</p>
              <FindingActions
                entry={finding.ruleEntry}
                source={source}
                onVerified={() => onVerified(finding.defectId)}
              />
            </div>
          )}

          {verified && (
            <div className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/[0.06] px-3 py-2 text-sm text-emerald-300">
              The drafted fix was applied to an in-memory copy and the same check re-run against it — the defect no
              longer reproduces. Your source was never modified.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

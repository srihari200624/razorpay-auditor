"use client";

import { useState } from "react";
import type { Finding } from "./findings";
import type { Severity } from "./severity";
import { EvidencePanel } from "../audit/EvidencePanel";
import { FindingActions } from "../audit/FindingActions";

const SEV_PILL: Record<Severity, string> = {
  critical: "border-red-500/40 bg-red-500/10 text-red-300",
  high: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-300",
};

/**
 * One defect, as the product presents it: severity + title + affected file +
 * how it was proven, expanding into the evidence and the remediation flow. The
 * evidence and fix widgets are reused verbatim from the demo (they carry the
 * real request/response trail and the explain/draft/apply logic + animations).
 */
export function FindingCard({
  finding,
  source,
  verified,
  onVerified,
}: {
  finding: Finding;
  source: string | null;
  verified: boolean;
  onVerified: (defectId: string) => void;
}) {
  const [open, setOpen] = useState(finding.severity === "critical");

  const staticProven = finding.ruleEntry?.status === "found";

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.02]"
      >
        <span className="font-mono text-xs text-zinc-500">{open ? "▾" : "▸"}</span>
        {verified ? (
          <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide text-emerald-300">
            FIX RE-VERIFIED
          </span>
        ) : (
          <span className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide ${SEV_PILL[finding.severity]}`}>
            {finding.severity}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-sans text-[15px] font-medium text-zinc-100">
            {finding.title}
          </span>
          {finding.file && (
            <span className="block truncate font-mono text-xs text-zinc-500">{finding.file}</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {staticProven && (
            <span className="rounded border border-zinc-600 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
              static ✓
            </span>
          )}
          {finding.exploited && (
            <span className="rounded border border-red-500/50 bg-red-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-red-300">
              ⚔ exploited
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="border-t border-white/10 px-4 py-4">
          <p className="mb-3 text-sm leading-relaxed text-zinc-400">{finding.impact}</p>

          <p className="mb-1.5 font-sans text-[10px] font-semibold tracking-widest text-zinc-500">
            PROOF
          </p>
          {finding.ruleEntry && <EvidencePanel entry={finding.ruleEntry} />}
          {finding.attackEntry && <EvidencePanel entry={finding.attackEntry} />}

          {!verified && finding.ruleEntry && (
            <div className="mt-3 border-t border-white/5 pt-3">
              <p className="mb-1 font-sans text-[10px] font-semibold tracking-widest text-zinc-500">
                REMEDIATION
              </p>
              <FindingActions
                entry={finding.ruleEntry}
                source={source}
                onVerified={() => onVerified(finding.defectId)}
              />
            </div>
          )}

          {verified && (
            <div className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/[0.06] px-3 py-2 text-sm text-emerald-300">
              The drafted fix was applied to an in-memory copy and the same check re-run against
              it — the defect no longer reproduces. Your source was never modified.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

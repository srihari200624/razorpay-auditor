"use client";

import { useState } from "react";
import type { LogEntry } from "./types";
import type { DiffLine } from "@/lib/diff/derive";

interface DraftFixResponse {
  filePath: string;
  patchedFile: string;
  rationale: string;
  diff: DiffLine[];
  added: number;
  removed: number;
}

interface ApplyResponse {
  found: boolean;
  explanation: string;
  filePath: string;
  lineNumber: number | null;
}

/**
 * Compacts a full-file diff to the changed lines plus a little context, so a
 * whole-file patch doesn't render as a wall of unchanged text.
 */
function compactDiff(lines: DiffLine[], context = 2): (DiffLine | { kind: "gap" })[] {
  const keep = new Array(lines.length).fill(false);
  lines.forEach((l, i) => {
    if (l.kind !== "context") {
      for (let j = Math.max(0, i - context); j <= Math.min(lines.length - 1, i + context); j++) {
        keep[j] = true;
      }
    }
  });
  const out: (DiffLine | { kind: "gap" })[] = [];
  let gapping = false;
  lines.forEach((l, i) => {
    if (keep[i]) {
      out.push(l);
      gapping = false;
    } else if (!gapping) {
      out.push({ kind: "gap" });
      gapping = true;
    }
  });
  return out;
}

/**
 * Only rendered for found/hit rows (the caller gates this). Only findings
 * with a non-null ruleId can draft/apply a fix — Explain has no such
 * requirement, since it just narrates the deterministic detail already on
 * the entry.
 */
export function FindingActions({
  entry,
  source,
  onVerified,
}: {
  entry: LogEntry;
  source: string | null;
  onVerified: (explanation: string, meta: string | null) => void;
}) {
  const [explainOpen, setExplainOpen] = useState(false);
  const [explainText, setExplainText] = useState("");
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  const [draft, setDraft] = useState<DraftFixResponse | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  async function runExplain() {
    setExplainOpen((v) => !v);
    if (explainText || explainLoading) return;
    setExplainLoading(true);
    setExplainError(null);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: entry.kind,
          label: entry.label,
          filePath: null,
          deterministicSummary: entry.detail ?? "",
        }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setExplainText((t) => t + decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      setExplainError((err as Error).message);
    } finally {
      setExplainLoading(false);
    }
  }

  async function runDraftFix() {
    if (!source || !entry.ruleId) return;
    setDraftLoading(true);
    setDraftError(null);
    setDraft(null);
    try {
      const res = await fetch("/api/draft-fix", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source, ruleId: entry.ruleId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setDraft(data as DraftFixResponse);
    } catch (err) {
      setDraftError((err as Error).message);
    } finally {
      setDraftLoading(false);
    }
  }

  async function runApply() {
    if (!source || !entry.ruleId || !draft) return;
    setApplyLoading(true);
    setApplyError(null);
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source,
          ruleId: entry.ruleId,
          filePath: draft.filePath,
          patchedFile: draft.patchedFile,
        }),
      });
      const data = (await res.json()) as ApplyResponse;
      if (!res.ok) throw new Error((data as unknown as { error?: string })?.error ?? `HTTP ${res.status}`);
      if (data.found) {
        // The rule re-ran on the patched overlay and STILL reports the
        // defect — the drafted fix did not close it. No log entry is
        // appended; this is not a verdict, just a failed re-verify attempt.
        setApplyError(`Re-verify failed — the rule still reports this defect: ${data.explanation}`);
        return;
      }
      const meta = data.lineNumber ? `${data.filePath}:${data.lineNumber}` : data.filePath;
      onVerified(data.explanation, meta);
      setApplied(true);
    } catch (err) {
      setApplyError((err as Error).message);
    } finally {
      setApplyLoading(false);
    }
  }

  const canDraft = source != null && entry.ruleId != null;

  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={runExplain}
          className="rounded border border-white/15 px-2 py-1 font-sans text-[11px] font-semibold tracking-wide text-zinc-300 hover:border-white/30"
        >
          {explainLoading ? "EXPLAINING…" : explainOpen ? "HIDE EXPLANATION" : "EXPLAIN"}
        </button>
        {canDraft && !applied && (
          <button
            type="button"
            onClick={runDraftFix}
            disabled={draftLoading}
            className="rounded border border-white/15 px-2 py-1 font-sans text-[11px] font-semibold tracking-wide text-zinc-300 hover:border-white/30 disabled:opacity-40"
          >
            {draftLoading ? "DRAFTING FIX…" : draft ? "REDRAFT FIX" : "DRAFT FIX"}
          </button>
        )}
      </div>

      {explainOpen && (
        <div className="rounded border border-white/10 bg-black/20 px-3 py-2">
          <p className="mb-1 font-sans text-[10px] font-semibold tracking-widest text-zinc-500">
            AI EXPLANATION — ADVISORY, NOT A VERDICT
          </p>
          {explainError ? (
            <p className="font-mono text-sm text-zinc-500">{explainError}</p>
          ) : (
            <p className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-zinc-400">
              {explainText || (explainLoading ? "…" : "")}
            </p>
          )}
        </div>
      )}

      {draftError && <p className="font-mono text-sm text-amber-400">{draftError}</p>}

      {draft && !applied && (
        <div className="rounded border border-white/10 bg-black/20 px-3 py-2">
          <p className="mb-1 font-sans text-[10px] font-semibold tracking-widest text-zinc-500">
            DRAFTED FIX — {draft.filePath} (+{draft.added} / -{draft.removed}) — advisory, unverified until Apply
          </p>
          <p className="mb-2 font-mono text-sm text-zinc-400">{draft.rationale}</p>
          <div className="max-h-64 overflow-y-auto rounded border border-white/10 font-mono text-xs">
            {compactDiff(draft.diff).map((l, i) =>
              l.kind === "gap" ? (
                <div key={i} className="px-2 py-0.5 text-zinc-600">
                  …
                </div>
              ) : (
                <div
                  key={i}
                  className={`whitespace-pre-wrap px-2 py-0.5 ${
                    l.kind === "add"
                      ? "bg-emerald-500/10 text-emerald-300"
                      : l.kind === "remove"
                        ? "bg-red-500/10 text-red-300"
                        : "text-zinc-500"
                  }`}
                >
                  {l.kind === "add" ? "+ " : l.kind === "remove" ? "- " : "  "}
                  {l.text}
                </div>
              ),
            )}
          </div>
          <button
            type="button"
            onClick={runApply}
            disabled={applyLoading}
            className="mt-2 rounded border border-sky-400/40 bg-sky-400/10 px-2 py-1 font-sans text-[11px] font-semibold tracking-wide text-sky-300 hover:border-sky-400/70 disabled:opacity-40"
          >
            {applyLoading ? "APPLYING & RE-VERIFYING…" : "APPLY (re-runs the rule to confirm)"}
          </button>
          {applyError && <p className="mt-1 font-mono text-sm text-amber-400">{applyError}</p>}
        </div>
      )}
    </div>
  );
}

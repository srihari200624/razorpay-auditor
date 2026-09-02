"use client";

import { useEffect, useRef, useState } from "react";
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

// Honest status lines shown while the REAL requests are in flight — each
// names something the endpoint actually does, no fabricated work.
const DRAFT_STEPS = [
  "Locating the proven defect…",
  "Reading the known-good reference…",
  "Drafting the patched file…",
];
const APPLY_STEPS = ["Building overlay…", "Re-running the rule…", "Comparing result…"];

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

/** A finding's file (without the trailing :line) for the "scanning …" header.
 * Rule rows carry `path:line` in meta; attack rows carry "HTTP nnn". */
function fileFromMeta(meta: string | null): string {
  if (!meta || meta.startsWith("HTTP")) return "the target source";
  return meta.replace(/:\d+$/, "");
}

function Spinner({ className = "border-zinc-500" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-3 w-3 shrink-0 animate-spin rounded-full border border-t-transparent ${className}`}
      aria-hidden="true"
    />
  );
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
  const [explainPhase, setExplainPhase] = useState<"idle" | "loading" | "streaming" | "done">("idle");

  // Decouple render cadence from network cadence: the reader appends to
  // `bufferRef`; a requestAnimationFrame loop reveals it into `explainText` at
  // a steady, comfortable typewriter pace (a gentle catch-up only when the
  // buffer runs far ahead), so a bursty token stream still reads smoothly and
  // we render at most once per frame instead of once per chunk.
  const bufferRef = useRef("");
  const revealedRef = useRef(0);
  const doneRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const [draft, setDraft] = useState<DraftFixResponse | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftStep, setDraftStep] = useState(0);
  const draftTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [applyStep, setApplyStep] = useState(0);
  const applyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (draftTimerRef.current) clearInterval(draftTimerRef.current);
      if (applyTimerRef.current) clearInterval(applyTimerRef.current);
    },
    [],
  );

  function startDrain() {
    if (rafRef.current != null) return; // already draining
    const tick = () => {
      const buf = bufferRef.current;
      let revealed = revealedRef.current;
      if (revealed < buf.length) {
        // steady ~2 chars/frame; only speed up if we've fallen far behind, so
        // it reads as a calm typewriter, not a burst.
        const behind = buf.length - revealed;
        const step = behind > 400 ? Math.ceil(behind / 60) : 2;
        revealed = Math.min(buf.length, revealed + step);
        revealedRef.current = revealed;
        setExplainText(buf.slice(0, revealed));
      }
      if (doneRef.current && revealed >= buf.length) {
        rafRef.current = null; // caught up and stream closed — stop
        setExplainPhase("done");
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  async function runExplain() {
    setExplainOpen((v) => !v);
    if (explainText || explainLoading) return;
    setExplainLoading(true);
    setExplainError(null);
    setExplainPhase("loading");
    bufferRef.current = "";
    revealedRef.current = 0;
    doneRef.current = false;
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
      startDrain(); // reveal buffered text smoothly while chunks arrive
      let firstByte = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk && !firstByte) {
          firstByte = true;
          setExplainPhase("streaming"); // loading beat lasts exactly TTFB
        }
        bufferRef.current += chunk;
      }
      bufferRef.current += decoder.decode(); // flush any trailing multibyte
      doneRef.current = true;
    } catch (err) {
      doneRef.current = true;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setExplainText(bufferRef.current); // show whatever streamed before the error
      setExplainPhase("done");
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
    setDraftStep(0);
    if (draftTimerRef.current) clearInterval(draftTimerRef.current);
    draftTimerRef.current = setInterval(() => {
      setDraftStep((s) => Math.min(s + 1, DRAFT_STEPS.length - 1));
    }, 2200);
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
      if (draftTimerRef.current) {
        clearInterval(draftTimerRef.current);
        draftTimerRef.current = null;
      }
    }
  }

  async function runApply() {
    if (!source || !entry.ruleId || !draft) return;
    setApplyLoading(true);
    setApplyError(null);
    setApplyStep(0);
    if (applyTimerRef.current) clearInterval(applyTimerRef.current);
    applyTimerRef.current = setInterval(() => {
      setApplyStep((s) => Math.min(s + 1, APPLY_STEPS.length - 1));
    }, 450);
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
      if (applyTimerRef.current) {
        clearInterval(applyTimerRef.current);
        applyTimerRef.current = null;
      }
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
          <div className="mb-1 flex items-center gap-2">
            <p className="font-sans text-[10px] font-semibold tracking-widest text-zinc-500">
              AI EXPLANATION — ADVISORY, NOT A VERDICT
            </p>
            {explainPhase === "loading" && !explainError && (
              <span className="flex gap-0.5" aria-hidden="true">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="inline-block h-1 w-1 rounded-full bg-zinc-500"
                    style={{ animation: `pulseDot 1s ease-in-out ${d * 0.15}s infinite` }}
                  />
                ))}
              </span>
            )}
          </div>
          {explainError ? (
            <p className="font-mono text-sm text-zinc-500">{explainError}</p>
          ) : explainPhase === "loading" ? (
            <p className="font-mono text-sm text-zinc-600">Reading finding…</p>
          ) : (
            <p className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-zinc-400">
              {explainText}
              {explainPhase === "streaming" && (
                <span
                  className="ml-0.5 inline-block h-[13px] w-[6px] translate-y-[2px] bg-zinc-500"
                  style={{ animation: "blinkCursor 0.8s step-end infinite" }}
                  aria-hidden="true"
                />
              )}
            </p>
          )}
        </div>
      )}

      {draftError && <p className="font-mono text-sm text-amber-400">{draftError}</p>}

      {draftLoading && (
        <div className="rounded border border-white/10 bg-black/20 px-3 py-2">
          <div className="flex items-center gap-2 font-sans text-[10px] font-semibold tracking-widest text-zinc-500">
            <Spinner className="border-sky-400/60" />
            SCANNING {fileFromMeta(entry.meta)} FOR VULNERABLE PATTERNS…
          </div>
          <div className="relative mt-2 overflow-hidden rounded border border-white/5 bg-black/30 px-2 py-2.5">
            <div
              className="pointer-events-none absolute inset-x-0 h-8"
              style={{
                background:
                  "linear-gradient(180deg, rgba(56,189,248,0) 0%, rgba(56,189,248,0.16) 50%, rgba(56,189,248,0) 100%)",
                animation: "scanline 1.4s ease-in-out infinite",
              }}
              aria-hidden="true"
            />
            <div className="flex flex-col gap-1.5">
              {[82, 64, 73].map((w, i) => (
                <div
                  key={i}
                  className="h-2 rounded bg-white/10"
                  style={{ width: `${w}%`, animation: `shimmer 1.2s ease-in-out ${i * 0.2}s infinite` }}
                />
              ))}
            </div>
          </div>
          <p className="mt-2 font-mono text-xs text-zinc-500">{DRAFT_STEPS[draftStep]}</p>
        </div>
      )}

      {draft && !applied && (
        <div className="rounded border border-white/10 bg-black/20 px-3 py-2">
          <p className="mb-1 font-sans text-[10px] font-semibold tracking-widest text-zinc-500">
            DRAFTED FIX — {draft.filePath} (+{draft.added} / -{draft.removed}) — advisory, unverified until Apply
          </p>
          <p className="mb-2 font-mono text-sm text-zinc-400">{draft.rationale}</p>
          <div className="max-h-64 overflow-y-auto rounded border border-white/10 font-mono text-xs">
            {compactDiff(draft.diff).map((l, i) =>
              l.kind === "gap" ? (
                <div
                  key={i}
                  className="px-2 py-0.5 text-zinc-600"
                  style={{ animation: `flowIn 0.35s ease-out ${i * 45}ms both` }}
                >
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
                  style={{ animation: `flowIn 0.35s ease-out ${i * 45}ms both` }}
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
            className="mt-2 inline-flex items-center gap-1.5 rounded border border-sky-400/40 bg-sky-400/10 px-2 py-1 font-sans text-[11px] font-semibold tracking-wide text-sky-300 hover:border-sky-400/70 disabled:opacity-40"
          >
            {applyLoading && <Spinner className="border-sky-400/70" />}
            {applyLoading ? APPLY_STEPS[applyStep] : "APPLY (re-runs the rule to confirm)"}
          </button>
          {applyError && <p className="mt-1 font-mono text-sm text-amber-400">{applyError}</p>}
        </div>
      )}
    </div>
  );
}

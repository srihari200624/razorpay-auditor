"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuditRun } from "../audit/useAuditRun";
import { toFindings, posture } from "./findings";
import { EntryForm } from "./EntryForm";
import { StatRow } from "./StatRow";
import { FindingRow, ROW_GRID } from "./FindingRow";

function Scanning({ resolved, total }: { resolved: number; total: number }) {
  const pct = total > 0 ? Math.round((resolved / total) * 100) : 0;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-20">
      <p className="font-mono text-xs font-semibold tracking-[0.2em] text-blue-400">AUDITING…</p>
      <h2 className="mt-3 text-2xl font-semibold text-zinc-100">Proving your integration</h2>
      <p className="mt-2 text-sm text-zinc-400">
        Running six deterministic rules and firing three real attacks at the live endpoints.
      </p>
      <div className="relative mt-6 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="pointer-events-none absolute inset-y-0 w-24"
          style={{
            background: "linear-gradient(90deg, rgba(59,130,246,0) 0%, rgba(59,130,246,0.5) 50%, rgba(59,130,246,0) 100%)",
            animation: "scanline 1.4s ease-in-out infinite",
          }}
          aria-hidden="true"
        />
        <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%`, transition: "width 0.4s ease" }} />
      </div>
      <p className="mt-2 font-mono text-xs text-zinc-500">{resolved} / {total} checks complete</p>
    </div>
  );
}

function WrenchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M12 6.75a5.25 5.25 0 0 1 6.775-5.025.75.75 0 0 1 .313 1.248l-3.32 3.319c.063.475.276.934.641 1.299.365.365.824.578 1.3.64l3.318-3.319a.75.75 0 0 1 1.248.313 5.25 5.25 0 0 1-5.472 6.756c-1.018-.086-1.87.1-2.309.634L7.344 21.3A3.298 3.298 0 1 1 2.7 16.657l8.684-7.151c.533-.44.72-1.291.634-2.309A5.342 5.342 0 0 1 12 6.75ZM4.117 19.125a.75.75 0 0 1 .75-.75h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75h-.008a.75.75 0 0 1-.75-.75v-.008Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function ProductConsole() {
  const { entries, running, run, source } = useAuditRun();
  const [started, setStarted] = useState(false);
  const [target, setTarget] = useState("");
  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const [passedOpen, setPassedOpen] = useState(false);

  const [autoFixing, setAutoFixing] = useState(false);
  const [currentFixId, setCurrentFixId] = useState<string | null>(null);
  const [fixFailures, setFixFailures] = useState<Record<string, string>>({});
  const [fixBanner, setFixBanner] = useState<string | null>(null);

  const findings = toFindings(entries);
  const p = posture(findings, verified);
  const found = findings.filter((f) => f.found);
  const passed = findings.filter((f) => f.resolved && !f.found);
  const openFound = found.filter((f) => !verified[f.defectId]);

  const roots = entries.filter((e) => e.parentId === null);
  const resolved = roots.filter((e) => e.status !== "pending").length;
  const total = roots.length || 9;

  function startRun(repo: string, live: string) {
    setVerified({});
    setFixFailures({});
    setFixBanner(null);
    setTarget(live);
    setStarted(true);
    run(repo, live);
  }

  function newScan() {
    setStarted(false);
    setVerified({});
    setFixFailures({});
    setFixBanner(null);
  }

  async function autoFixAll() {
    if (!source || autoFixing) return;
    const targets = found.filter((f) => !verified[f.defectId] && f.ruleEntry?.ruleId);
    setAutoFixing(true);
    setFixBanner(null);
    try {
      for (const f of targets) {
        const ruleId = f.ruleEntry!.ruleId!;
        setCurrentFixId(f.defectId);
        const dRes = await fetch("/api/draft-fix", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ source, ruleId }),
        });
        if (dRes.status === 429) {
          setFixBanner("Rate limit reached — raise LLM_RATE_LIMIT_PER_HOUR (or wait) and re-run Auto-fix.");
          break;
        }
        const draft = await dRes.json();
        if (!dRes.ok) {
          setFixFailures((m) => ({ ...m, [f.defectId]: draft?.error ?? `draft HTTP ${dRes.status}` }));
          continue;
        }
        const aRes = await fetch("/api/apply", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ source, ruleId, filePath: draft.filePath, patchedFile: draft.patchedFile }),
        });
        if (aRes.status === 429) {
          setFixBanner("Rate limit reached — raise LLM_RATE_LIMIT_PER_HOUR (or wait) and re-run Auto-fix.");
          break;
        }
        const applied = await aRes.json();
        if (!aRes.ok) {
          setFixFailures((m) => ({ ...m, [f.defectId]: applied?.error ?? `apply HTTP ${aRes.status}` }));
          continue;
        }
        if (applied.found) {
          setFixFailures((m) => ({ ...m, [f.defectId]: "Re-verify failed — the rule still reports this defect." }));
          continue;
        }
        setFixFailures((m) => {
          const next = { ...m };
          delete next[f.defectId];
          return next;
        });
        setVerified((v) => ({ ...v, [f.defectId]: true }));
      }
    } catch (err) {
      setFixBanner((err as Error).message);
    } finally {
      setAutoFixing(false);
      setCurrentFixId(null);
    }
  }

  // Entry / scanning: centered, no dashboard shell.
  if (!started || running) {
    return (
      <div className="flex min-h-screen flex-col bg-[#0a0a0b] text-zinc-100">
        {!started ? <EntryForm onRun={startRun} /> : <Scanning resolved={resolved} total={total} />}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0b] text-zinc-100">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-6 py-4">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <Link href="/" className="font-sans text-sm font-bold tracking-wide text-zinc-100">
              AUDITOR
            </Link>
            <span className="font-mono text-[9px] font-semibold tracking-widest text-blue-400">PRODUCT</span>
          </div>
          <h1 id="overview" className="mt-1 font-sans text-lg font-semibold text-zinc-100">
            Security audit
          </h1>
          <p className="truncate font-mono text-xs text-zinc-500">{target}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/audit" className="mr-1 font-mono text-xs text-zinc-500 hover:text-zinc-300">
            demo →
          </Link>
          <button
            type="button"
            onClick={() => {
              setVerified({});
              setFixFailures({});
              setFixBanner(null);
              run(source ?? "", target);
            }}
            className="rounded-lg border border-white/10 px-3 py-1.5 font-sans text-xs font-semibold text-zinc-300 hover:border-white/25"
          >
            Re-run
          </button>
          <button
            type="button"
            onClick={newScan}
            className="rounded-lg border border-white/10 px-3 py-1.5 font-sans text-xs font-semibold text-zinc-300 hover:border-white/25"
          >
            New scan
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 py-6">
          <StatRow posture={p} />

          {found.length > 0 && (
            <section id="findings" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-sans text-[11px] font-semibold tracking-widest text-zinc-500">
                  FINDINGS · WORST FIRST
                </p>
                {openFound.length > 0 ? (
                  <button
                    type="button"
                    onClick={autoFixAll}
                    disabled={autoFixing}
                    className="group inline-flex items-center gap-2.5 rounded-lg bg-blue-600 py-1.5 pl-1.5 pr-3.5 font-sans text-sm font-semibold text-white shadow-sm ring-1 ring-inset ring-white/15 transition-all hover:bg-blue-500 hover:ring-white/25 disabled:opacity-60"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/15">
                      {autoFixing ? (
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/70 border-t-transparent" aria-hidden="true" />
                      ) : (
                        <WrenchIcon className="h-3.5 w-3.5" />
                      )}
                    </span>
                    {autoFixing ? (
                      <span className="tabular-nums">Auto-fixing… {p.fixed}/{found.length}</span>
                    ) : (
                      <>
                        <span>Auto-fix all findings</span>
                        <span className="rounded bg-white/20 px-1.5 py-0.5 font-mono text-xs leading-none">
                          {openFound.length}
                        </span>
                      </>
                    )}
                  </button>
                ) : (
                  p.fixed > 0 && (
                    <span className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 font-sans text-sm font-semibold text-emerald-300">
                      ✓ all {p.fixed} findings remediated & re-verified
                    </span>
                  )
                )}
              </div>

              {fixBanner && (
                <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 font-mono text-sm text-amber-300">
                  {fixBanner}
                </p>
              )}

              {/* Findings table */}
              <div className="overflow-x-auto rounded-xl border border-white/[0.07] bg-[#151517]">
                <div className="min-w-[680px]">
                  <div className={`${ROW_GRID} px-4 py-2.5 font-sans text-[10px] font-semibold tracking-widest text-zinc-500`}>
                    <span>SEVERITY</span>
                    <span>FINDING</span>
                    <span>PROOF</span>
                    <span>STATUS</span>
                    <span />
                  </div>
                  {found.map((f) => (
                    <FindingRow
                      key={f.defectId}
                      finding={f}
                      source={source}
                      verified={!!verified[f.defectId]}
                      fixing={currentFixId === f.defectId}
                      failure={fixFailures[f.defectId]}
                      onVerified={(id) => setVerified((v) => ({ ...v, [id]: true }))}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}

          {passed.length > 0 && (
            <section>
              <button
                type="button"
                onClick={() => setPassedOpen((v) => !v)}
                className="flex items-center gap-2 font-mono text-xs text-emerald-300/80 hover:text-emerald-300"
              >
                <span>{passedOpen ? "▾" : "▸"}</span>
                {passed.length} checks passed
              </button>
              {passedOpen && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {passed.map((f) => (
                    <div key={f.defectId} className="flex items-center gap-2 rounded-lg border border-white/5 bg-[#151517] px-3 py-2">
                      <span className="font-mono text-xs text-emerald-400">✓</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-zinc-300">{f.title}</span>
                      <span className="font-mono text-[10px] text-zinc-600">secure</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
    </div>
  );
}

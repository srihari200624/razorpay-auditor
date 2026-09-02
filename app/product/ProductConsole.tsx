"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuditRun } from "../audit/useAuditRun";
import { toFindings, posture } from "./findings";
import { EntryForm } from "./EntryForm";
import { PostureHeader } from "./PostureHeader";
import { FindingCard } from "./FindingCard";

function TopBar() {
  return (
    <header className="border-b border-white/10 px-6 py-3">
      <div className="mx-auto flex max-w-3xl items-center justify-between">
        <Link href="/" className="font-sans text-sm font-semibold tracking-wide text-zinc-100">
          AUDITOR <span className="font-mono text-[10px] tracking-widest text-sky-400">PRODUCT</span>
        </Link>
        <Link href="/audit" className="font-mono text-xs text-zinc-500 hover:text-zinc-300">
          demo →
        </Link>
      </div>
    </header>
  );
}

function Scanning({ resolved, total }: { resolved: number; total: number }) {
  const pct = total > 0 ? Math.round((resolved / total) * 100) : 0;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-20">
      <p className="font-mono text-xs font-semibold tracking-[0.2em] text-sky-400">AUDITING…</p>
      <h2 className="mt-3 text-2xl font-semibold text-zinc-100">Proving your integration</h2>
      <p className="mt-2 text-sm text-zinc-400">
        Running six deterministic rules and firing three real attacks at the live endpoints.
      </p>
      <div className="relative mt-6 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="pointer-events-none absolute inset-y-0 w-24"
          style={{
            background:
              "linear-gradient(90deg, rgba(56,189,248,0) 0%, rgba(56,189,248,0.5) 50%, rgba(56,189,248,0) 100%)",
            animation: "scanline 1.4s ease-in-out infinite",
          }}
          aria-hidden="true"
        />
        <div
          className="h-full rounded-full bg-sky-500"
          style={{ width: `${pct}%`, transition: "width 0.4s ease" }}
        />
      </div>
      <p className="mt-2 font-mono text-xs text-zinc-500">
        {resolved} / {total} checks complete
      </p>
    </div>
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

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <TopBar />

      {!started ? (
        <EntryForm onRun={startRun} />
      ) : running ? (
        <Scanning resolved={resolved} total={total} />
      ) : (
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-6 py-8">
          <PostureHeader
            posture={p}
            target={target}
            onNewScan={() => {
              setStarted(false);
              setVerified({});
            }}
            onRerun={() => {
              setVerified({});
              run(source ?? "", target);
            }}
          />

          {found.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-sans text-[11px] font-semibold tracking-widest text-zinc-500">
                  FINDINGS · WORST FIRST
                </p>
                {openFound.length > 0 ? (
                  <button
                    type="button"
                    onClick={autoFixAll}
                    disabled={autoFixing}
                    className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 font-sans text-sm font-semibold text-zinc-950 transition-colors hover:bg-sky-400 disabled:opacity-50"
                  >
                    {autoFixing ? (
                      <>
                        <span
                          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent"
                          aria-hidden="true"
                        />
                        Auto-fixing… {p.fixed}/{found.length} re-verified
                      </>
                    ) : (
                      <>⚡ Auto-fix all findings ({openFound.length})</>
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
              {p.fixed > 0 && openFound.length === 0 && (
                <p className="text-sm text-zinc-400">
                  Each fix was applied to an in-memory copy and re-verified by re-running its own
                  deterministic rule — your source was never modified.
                </p>
              )}

              {found.map((f) => (
                <FindingCard
                  key={f.defectId}
                  finding={f}
                  source={source}
                  verified={!!verified[f.defectId]}
                  fixing={currentFixId === f.defectId}
                  failure={fixFailures[f.defectId]}
                  onVerified={(id) => setVerified((v) => ({ ...v, [id]: true }))}
                />
              ))}
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
                    <div
                      key={f.defectId}
                      className="flex items-center gap-2 rounded-lg border border-white/5 bg-zinc-900/40 px-3 py-2"
                    >
                      <span className="font-mono text-xs text-emerald-400">✓</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-zinc-300">{f.title}</span>
                      <span className="font-mono text-[10px] text-zinc-600">secure</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </main>
      )}
    </div>
  );
}

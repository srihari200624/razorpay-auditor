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

  const findings = toFindings(entries);
  const p = posture(findings);
  const found = findings.filter((f) => f.found);
  const passed = findings.filter((f) => f.resolved && !f.found);

  const roots = entries.filter((e) => e.parentId === null);
  const resolved = roots.filter((e) => e.status !== "pending").length;
  const total = roots.length || 9;

  function startRun(repo: string, live: string) {
    setVerified({});
    setTarget(live);
    setStarted(true);
    run(repo, live);
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
              <p className="font-sans text-[11px] font-semibold tracking-widest text-zinc-500">
                FINDINGS · WORST FIRST
              </p>
              {found.map((f) => (
                <FindingCard
                  key={f.defectId}
                  finding={f}
                  source={source}
                  verified={!!verified[f.defectId]}
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

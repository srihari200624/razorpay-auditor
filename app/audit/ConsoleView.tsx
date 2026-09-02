"use client";

import { useState } from "react";
import { EvidenceLog } from "./EvidenceLog";
import { Scoreboard } from "./Scoreboard";
import { useAuditRun } from "./useAuditRun";

export function ConsoleView() {
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const { entries, running, run, source: ranSource, appendVerified } = useAuditRun();

  const canRun = source.trim().length > 0 && target.trim().length > 0 && !running;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <form
        className="flex flex-col gap-3 rounded-lg border border-white/10 bg-zinc-800/60 p-4 md:flex-row md:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canRun) return;
          run(source.trim(), target.trim());
        }}
      >
        <label className="flex flex-1 flex-col gap-1">
          <span className="font-sans text-[11px] font-semibold tracking-widest text-zinc-500">
            SOURCE (static rules)
          </span>
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="rounded border border-white/15 bg-black/30 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-white/40"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="font-sans text-[11px] font-semibold tracking-widest text-zinc-500">
            TARGET (live attacks)
          </span>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="http://localhost:3000"
            className="rounded border border-white/15 bg-black/30 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-white/40"
          />
        </label>
        <button
          type="submit"
          disabled={!canRun}
          className="shrink-0 rounded border border-white/15 px-4 py-2 font-sans text-xs font-semibold tracking-wide text-zinc-200 hover:border-white/30 disabled:opacity-40"
        >
          {running ? "RUNNING…" : "RUN AUDIT"}
        </button>
      </form>
      <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-white/10 bg-zinc-800/60">
        {entries.length > 0 && (
          <div className="border-b border-white/10 px-4 py-2.5">
            <Scoreboard entries={entries} />
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          <EvidenceLog
            entries={entries}
            emptyHint="Enter a source and target, then RUN AUDIT."
            source={ranSource}
            onVerified={appendVerified}
          />
        </div>
      </section>
    </div>
  );
}

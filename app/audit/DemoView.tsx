"use client";

import { EvidenceLog } from "./EvidenceLog";
import { useAuditRun } from "./useAuditRun";
import { DEMO_TARGETS } from "@/lib/config/demoTargets";

function Panel({
  title,
  accentClass,
  target,
}: {
  title: string;
  accentClass: string;
  target: { repoUrl: string; liveUrl: string };
}) {
  const { entries, running, run } = useAuditRun();

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-white/10 bg-zinc-800/60">
      <header className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <h2 className={`font-sans text-lg font-semibold tracking-wide ${accentClass}`}>{title}</h2>
          <p className="mt-0.5 truncate font-mono text-xs text-zinc-500">
            {target.repoUrl.replace("https://github.com/", "")} · {target.liveUrl}
          </p>
        </div>
        <button
          type="button"
          onClick={() => run(target.repoUrl, target.liveUrl)}
          disabled={running}
          className="shrink-0 rounded border border-white/15 px-3 py-1.5 font-sans text-xs font-semibold tracking-wide text-zinc-200 hover:border-white/30 disabled:opacity-40"
        >
          {running ? "RUNNING…" : "RUN"}
        </button>
      </header>
      <div className="flex-1 overflow-y-auto">
        <EvidenceLog
          entries={entries}
          emptyHint="No checks run yet. Press RUN to fire all 6 static rules and 3 live attacks."
        />
      </div>
    </section>
  );
}

export function DemoView() {
  return (
    <div className="grid flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-2">
      <Panel title={DEMO_TARGETS.vulnerable.label} accentClass="text-amber-400" target={DEMO_TARGETS.vulnerable} />
      <Panel title={DEMO_TARGETS.fixed.label} accentClass="text-sky-400" target={DEMO_TARGETS.fixed} />
    </div>
  );
}

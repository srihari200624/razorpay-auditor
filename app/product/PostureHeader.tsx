"use client";

import type { Posture } from "./findings";

const LEVEL_COLOR: Record<Posture["level"], string> = {
  Low: "#34d399", // emerald-400
  Medium: "#fbbf24", // amber-400
  High: "#fb923c", // orange-400
  Critical: "#f87171", // red-400
};

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - score / 100);
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-xl font-bold text-zinc-100">{score}</span>
        <span className="font-mono text-[9px] tracking-widest text-zinc-500">/ 100</span>
      </div>
    </div>
  );
}

function Count({ n, label, className }: { n: number; label: string; className: string }) {
  return (
    <span className={`rounded-md border px-2 py-1 font-mono text-xs font-semibold ${className}`}>
      {n} {label}
    </span>
  );
}

export function PostureHeader({
  posture,
  target,
  onNewScan,
  onRerun,
}: {
  posture: Posture;
  target: string;
  onNewScan: () => void;
  onRerun: () => void;
}) {
  const color = LEVEL_COLOR[posture.level];
  const clean = posture.found === 0;

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-semibold tracking-[0.2em] text-zinc-500">
            SECURITY POSTURE
          </p>
          <p className="mt-1 truncate font-mono text-xs text-zinc-500">{target}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRerun}
            className="rounded-lg border border-white/15 px-3 py-1.5 font-sans text-xs font-semibold text-zinc-300 hover:border-white/30"
          >
            Re-run
          </button>
          <button
            type="button"
            onClick={onNewScan}
            className="rounded-lg border border-white/15 px-3 py-1.5 font-sans text-xs font-semibold text-zinc-300 hover:border-white/30"
          >
            New scan
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-6">
        <ScoreRing score={posture.score} color={color} />
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline gap-2">
            <span className="font-sans text-2xl font-semibold" style={{ color }}>
              RISK: {posture.level.toUpperCase()}
            </span>
          </div>
          {clean ? (
            <p className="font-mono text-sm text-emerald-300">
              No defects found — all {posture.total} checks passed.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {posture.counts.critical > 0 && (
                <Count n={posture.counts.critical} label="CRITICAL" className="border-red-500/40 bg-red-500/10 text-red-300" />
              )}
              {posture.counts.high > 0 && (
                <Count n={posture.counts.high} label="HIGH" className="border-orange-500/40 bg-orange-500/10 text-orange-300" />
              )}
              {posture.counts.medium > 0 && (
                <Count n={posture.counts.medium} label="MEDIUM" className="border-amber-500/40 bg-amber-500/10 text-amber-300" />
              )}
              {posture.passed > 0 && (
                <Count n={posture.passed} label="PASSED" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300" />
              )}
            </div>
          )}
          {posture.exploited > 0 && (
            <p className="font-sans text-sm font-semibold text-red-300">
              ⚔ {posture.exploited} exploited live — proven, not theoretical.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

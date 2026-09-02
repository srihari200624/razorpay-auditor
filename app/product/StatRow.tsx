"use client";

import type { Posture } from "./findings";

const LEVEL_COLOR: Record<Posture["level"], string> = {
  Low: "#34d399",
  Medium: "#fbbf24",
  High: "#fb923c",
  Critical: "#f87171",
};

function MiniRing({ score, color }: { score: number; color: string }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-mono text-sm font-bold text-zinc-100">
        {score}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#151517] p-4">{children}</div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-sans text-[10px] font-semibold tracking-[0.14em] text-zinc-500">{children}</p>
  );
}

export function StatRow({ posture }: { posture: Posture }) {
  const color = LEVEL_COLOR[posture.level];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card>
        <Label>RISK SCORE</Label>
        <div className="mt-2 flex items-center gap-3">
          <MiniRing score={posture.score} color={color} />
          <div>
            <p className="font-sans text-lg font-bold" style={{ color }}>
              {posture.level.toUpperCase()}
            </p>
            <p className="font-mono text-[11px] text-zinc-500">{posture.score} / 100</p>
          </div>
        </div>
      </Card>

      <Card>
        <Label>OPEN FINDINGS</Label>
        <p className="mt-2 font-mono text-3xl font-bold text-zinc-100">{posture.found}</p>
        <div className="mt-1 flex flex-wrap gap-1.5 font-mono text-[10px]">
          {posture.counts.critical > 0 && <span className="text-red-400">{posture.counts.critical} crit</span>}
          {posture.counts.high > 0 && <span className="text-orange-400">{posture.counts.high} high</span>}
          {posture.counts.medium > 0 && <span className="text-amber-400">{posture.counts.medium} med</span>}
          {posture.found === 0 && <span className="text-zinc-600">none open</span>}
        </div>
      </Card>

      <Card>
        <Label>EXPLOITED LIVE</Label>
        <p className={`mt-2 font-mono text-3xl font-bold ${posture.exploited > 0 ? "text-red-400" : "text-zinc-100"}`}>
          {posture.exploited}
        </p>
        <p className="mt-1 font-mono text-[10px] text-zinc-500">
          {posture.exploited > 0 ? "⚔ proven, not theoretical" : "no live exploit open"}
        </p>
      </Card>

      <Card>
        <Label>FIXED &amp; RE-VERIFIED</Label>
        <p className={`mt-2 font-mono text-3xl font-bold ${posture.fixed > 0 ? "text-emerald-400" : "text-zinc-100"}`}>
          {posture.fixed}
        </p>
        <p className="mt-1 font-mono text-[10px] text-zinc-500">
          {posture.passed} passed · {posture.total} checks
        </p>
      </Card>
    </div>
  );
}

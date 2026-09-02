import type { LogEntry } from "../audit/types";
import { RULE_CATALOG } from "@/lib/rules";
import { SEVERITY, SEVERITY_RANK, SEVERITY_WEIGHT, type Severity } from "./severity";

/**
 * A product "finding" is one defect (keyed by rule id), evidenced by up to two
 * signals: the static rule (always) and — for the three paired defects — a live
 * attack. Attack log rows already carry their paired rule id in `ruleId`
 * (see lib/pairing.ts / useAuditRun), so grouping is a lookup, not a re-map.
 */
export interface Finding {
  defectId: string;
  title: string;
  severity: Severity;
  impact: string;
  file: string | null;
  ruleEntry: LogEntry | null;
  attackEntry: LogEntry | null;
  found: boolean; // rule matched OR attack hit
  exploited: boolean; // the live attack actually succeeded
  resolved: boolean; // both present signals have finished (not pending)
}

function fileFromMeta(meta: string | null | undefined): string | null {
  if (!meta || meta.startsWith("HTTP")) return null;
  return meta.replace(/:\d+$/, "");
}

export function toFindings(entries: LogEntry[]): Finding[] {
  const findings = RULE_CATALOG.map((r): Finding => {
    const ruleEntry = entries.find((e) => e.kind === "rule" && e.ruleId === r.id) ?? null;
    const attackEntry = entries.find((e) => e.kind === "attack" && e.ruleId === r.id) ?? null;
    const sev = SEVERITY[r.id];

    const found = ruleEntry?.status === "found" || attackEntry?.status === "hit";
    const exploited = attackEntry?.status === "hit";
    const rulePending = !ruleEntry || ruleEntry.status === "pending";
    const attackPending = !!attackEntry && attackEntry.status === "pending";

    return {
      defectId: r.id,
      title: r.label,
      severity: sev.level,
      impact: sev.impact,
      file: fileFromMeta(ruleEntry?.meta),
      ruleEntry,
      attackEntry,
      found: !!found,
      exploited: !!exploited,
      resolved: !rulePending && !attackPending,
    };
  });

  // Worst first: by severity, then live-exploited ahead of static-only.
  return findings.sort((a, b) => {
    const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (s !== 0) return s;
    return Number(b.exploited) - Number(a.exploited);
  });
}

export interface Posture {
  score: number;
  level: "Low" | "Medium" | "High" | "Critical";
  counts: { critical: number; high: number; medium: number };
  found: number;
  exploited: number;
  passed: number;
  total: number;
}

export function posture(findings: Finding[]): Posture {
  const found = findings.filter((f) => f.found);
  const counts = { critical: 0, high: 0, medium: 0 };
  let score = 100;
  for (const f of found) {
    score -= SEVERITY_WEIGHT[f.severity];
    counts[f.severity] += 1;
  }
  score = Math.max(0, score);
  const level = score >= 85 ? "Low" : score >= 60 ? "Medium" : score >= 35 ? "High" : "Critical";
  return {
    score,
    level,
    counts,
    found: found.length,
    exploited: found.filter((f) => f.exploited).length,
    passed: findings.filter((f) => f.resolved && !f.found).length,
    total: findings.length,
  };
}

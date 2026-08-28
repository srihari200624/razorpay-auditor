"use client";

import { useCallback, useRef, useState } from "react";
import { RULE_CATALOG } from "@/lib/rules";
import { ATTACK_CATALOG } from "@/lib/attacks/catalog";
import { ruleIdForAttack } from "@/lib/pairing";
import type { LogEntry, EntryStatus } from "./types";
import { formatTimestamp } from "./format";

function entryId(kind: "rule" | "attack", id: string): string {
  return `${kind}:${id}`;
}

function initialEntries(): LogEntry[] {
  return [
    ...RULE_CATALOG.map(
      (r): LogEntry => ({
        id: entryId("rule", r.id),
        kind: "rule",
        label: r.label,
        status: "pending",
        time: null,
        meta: null,
        detail: null,
        ruleId: r.id,
        parentId: null,
      }),
    ),
    ...ATTACK_CATALOG.map(
      (a): LogEntry => ({
        id: entryId("attack", a.id),
        kind: "attack",
        label: a.label,
        status: "pending",
        time: null,
        meta: null,
        detail: null,
        ruleId: ruleIdForAttack(a.id),
        parentId: null,
      }),
    ),
  ];
}

/**
 * Fires all 6 rule checks and 3 live attacks independently and appends each
 * result to the feed as it resolves — never waits for the full batch. A
 * runId guards against a stale run's late response overwriting a newer one
 * if the user hits RUN again before the first pass finishes.
 */
export function useAuditRun() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const runIdRef = useRef(0);

  const run = useCallback(async (source: string, target: string) => {
    const runId = ++runIdRef.current;
    setSource(source);
    setEntries(initialEntries());
    setRunning(true);

    const patch = (id: string, next: Partial<LogEntry>) => {
      if (runIdRef.current !== runId) return;
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...next } : e)));
    };

    const ruleJobs = RULE_CATALOG.map(async (r) => {
      const id = entryId("rule", r.id);
      try {
        const res = await fetch(`/api/rules/${r.id}?source=${encodeURIComponent(source)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
        const status: EntryStatus = data.found ? "found" : "clear";
        patch(id, {
          status,
          time: formatTimestamp(),
          meta: data.lineNumber ? `${data.filePath}:${data.lineNumber}` : data.filePath,
          detail: data.explanation,
        });
      } catch (err) {
        patch(id, { status: "error", time: formatTimestamp(), detail: (err as Error).message });
      }
    });

    const attackJobs = ATTACK_CATALOG.map(async (a) => {
      const id = entryId("attack", a.id);
      try {
        const res = await fetch(`/api/attacks/${a.id}?target=${encodeURIComponent(target)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
        const status: EntryStatus = data.succeeded ? "hit" : "blocked";
        patch(id, {
          status,
          time: formatTimestamp(),
          meta: `HTTP ${data.httpStatus}`,
          detail: data.details,
        });
      } catch (err) {
        patch(id, { status: "error", time: formatTimestamp(), detail: (err as Error).message });
      }
    });

    await Promise.allSettled([...ruleJobs, ...attackJobs]);
    if (runIdRef.current === runId) setRunning(false);
  }, []);

  /**
   * Appends a new sky "FIX RE-VERIFIED" entry beneath an existing finding
   * without touching it — the append-only re-verify contract. Callers must
   * only invoke this after a fresh /api/apply re-run of the paired rule
   * reported found: false; this hook does not itself decide that.
   */
  const appendVerified = useCallback((parent: LogEntry, explanation: string, meta: string | null) => {
    setEntries((prev) => [
      ...prev,
      {
        id: `verified:${parent.id}:${Date.now()}`,
        kind: parent.kind,
        label: `${parent.label} — fix re-verified`,
        status: "verified",
        time: formatTimestamp(),
        meta,
        detail: explanation,
        ruleId: parent.ruleId,
        parentId: parent.id,
      },
    ]);
  }, []);

  return { entries, running, run, source, appendVerified };
}

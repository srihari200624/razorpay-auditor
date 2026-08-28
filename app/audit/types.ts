export type EntryKind = "rule" | "attack";

// found -> a static rule matched (amber). clear/blocked -> a static rule
// found nothing, or a live attack was blocked (both blue, "verified secure").
// hit -> a live attack actually succeeded (red, reserved for this alone).
// error -> infra/network failure, not a security verdict.
// verified -> an Apply'd fix was RE-RUN through the paired rule and it came
// back CLEAR (blue) — appended beneath the original found/hit proof, which is
// left untouched. Never set from the LLM's own claim, only from a fresh
// deterministic re-run. See lib/pairing.ts and app/api/apply/route.ts.
export type EntryStatus = "pending" | "found" | "clear" | "blocked" | "hit" | "error" | "verified";

export interface LogEntry {
  id: string;
  kind: EntryKind;
  label: string;
  status: EntryStatus;
  time: string | null;
  meta: string | null;
  detail: string | null;
  /** The static rule id that proves/re-verifies this finding — the entry's
   * own id for a rule row, or the paired rule (lib/pairing.ts) for an attack
   * row. Null when no rule pairing exists, which disables fix affordances. */
  ruleId: string | null;
  /** Set on an appended re-verify entry: the id of the finding it verifies. */
  parentId: string | null;
}

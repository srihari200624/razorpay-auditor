export type EntryKind = "rule" | "attack";

// found -> a static rule matched (amber). clear/blocked -> a static rule
// found nothing, or a live attack was blocked (both blue, "verified secure").
// hit -> a live attack actually succeeded (red, reserved for this alone).
// error -> infra/network failure, not a security verdict.
export type EntryStatus = "pending" | "found" | "clear" | "blocked" | "hit" | "error";

export interface LogEntry {
  id: string;
  kind: EntryKind;
  label: string;
  status: EntryStatus;
  time: string | null;
  meta: string | null;
  detail: string | null;
}

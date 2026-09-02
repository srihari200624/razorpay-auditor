/** One HTTP request the attack actually fired at the target, with the response
 * it got back — the raw proof, shown verbatim in the evidence expander. */
export interface AttackExchange {
  label: string; // "Unsigned POST", "Delivery 1/2", "Forged webhook", …
  method: string; // "POST"
  path: string; // "/api/verify-payment"
  headers?: Record<string, string>; // notable headers, e.g. the bad signature
  body: string; // the exact bytes sent
  responseStatus: number;
  responseBody: string;
}

/** A real order-state reading taken from the target's own status page — never
 * the attack request's own 200. The trail of these IS the proof of impact. */
export interface StateReading {
  label: string; // "before", "after", "after delivery 1", …
  status: string | null;
  creditedRupees: number | null;
}

/** Structured proof for a finding, surfaced in the UI's evidence expander. The
 * prose `details` on AttackResult is the summary; this is the receipts. */
export interface AttackEvidence {
  exchanges: AttackExchange[];
  stateTrail: StateReading[];
}

export interface AttackResult {
  attackName: string;
  succeeded: boolean;
  details: string;
  httpStatus: number;
  targetUrl: string;
  /** Optional structured proof. Additive — CLI/API consumers that ignore it
   * keep working unchanged. */
  evidence?: AttackEvidence;
}

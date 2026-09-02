// Severity + business-impact for each defect, keyed by rule id. Pure data,
// safe to import client-side. Levels drive the product's ranking, risk score,
// and colour system — deliberately separate from the demo log's amber/sky/red
// verdict contract (app/audit/theme.ts).

export type Severity = "critical" | "high" | "medium";

export interface SeverityInfo {
  level: Severity;
  impact: string;
}

export const SEVERITY: Record<string, SeverityInfo> = {
  "browser-trusted-success": {
    level: "critical",
    impact: "Orders can be marked paid with no valid proof — an attacker checks out for free.",
  },
  "raw-body-violation": {
    level: "critical",
    impact: "A forged webhook is accepted — an attacker can fake a payment.captured event.",
  },
  "no-idempotency": {
    level: "high",
    impact: "A replayed webhook is reprocessed — duplicate credit and double fulfilment.",
  },
  "secret-exposure": {
    level: "high",
    impact: "The Razorpay key secret is shipped to the browser — full key compromise.",
  },
  "order-id-trust": {
    level: "high",
    impact: "Signature trust hinges on a client-supplied order id / a non-constant-time compare.",
  },
  "event-order-assumption": {
    level: "medium",
    impact: "payment.captured assumes an already-authorized order — state confusion.",
  },
};

export const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2 };
export const SEVERITY_WEIGHT: Record<Severity, number> = { critical: 30, high: 18, medium: 10 };

// Shared UI classes so the stat row and the findings table stay in sync.
// Red-intensity ramp: one danger hue in three intensities so severity never
// competes with the blue action accent.
export const SEV_PILL: Record<Severity, string> = {
  critical: "border-[#f04438]/30 bg-[#f04438]/10 text-[#f04438]",
  high: "border-[#db6b6b]/30 bg-[#db6b6b]/10 text-[#db6b6b]",
  medium: "border-[#9ca3af]/25 bg-[#9ca3af]/10 text-[#9ca3af]",
};
export const SEV_DOT: Record<Severity, string> = {
  critical: "bg-[#f04438]",
  high: "bg-[#db6b6b]",
  medium: "bg-[#9ca3af]",
};
// Bare text tone for inline breakdown counts (no pill).
export const SEV_TEXT: Record<Severity, string> = {
  critical: "text-[#f04438]",
  high: "text-[#db6b6b]",
  medium: "text-[#9ca3af]",
};

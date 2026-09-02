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
export const SEV_PILL: Record<Severity, string> = {
  critical: "border-red-500/30 bg-red-500/10 text-red-400",
  high: "border-orange-500/30 bg-orange-500/10 text-orange-400",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-400",
};
export const SEV_DOT: Record<Severity, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-500",
};

import type { SourceFetcher } from "../source/fetchSource.ts";
import type { Rule, RuleResult } from "./types.ts";
import { secretExposure } from "./secretExposure.ts";
import { browserTrustedSuccess } from "./browserTrustedSuccess.ts";
import { orderIdTrust } from "./orderIdTrust.ts";
import { rawBodyViolation } from "./rawBodyViolation.ts";
import { noIdempotency } from "./noIdempotency.ts";
import { eventOrderAssumption } from "./eventOrderAssumption.ts";

export type { RuleResult, Rule } from "./types.ts";
export { secretExposure } from "./secretExposure.ts";
export { browserTrustedSuccess } from "./browserTrustedSuccess.ts";
export { orderIdTrust } from "./orderIdTrust.ts";
export { rawBodyViolation } from "./rawBodyViolation.ts";
export { noIdempotency } from "./noIdempotency.ts";
export { eventOrderAssumption } from "./eventOrderAssumption.ts";

/**
 * id must match the corresponding rule's own `defectId` — the API route
 * looks a rule up by this id, and the UI uses the same id/label pair before
 * a result has come back (no fs/fetch deps here, safe to import client-side).
 */
export const RULE_CATALOG: { id: string; label: string; rule: Rule }[] = [
  { id: "secret-exposure", label: "Secret exposed to the client", rule: secretExposure },
  { id: "browser-trusted-success", label: "Browser-trusted payment success", rule: browserTrustedSuccess },
  { id: "order-id-trust", label: "Order id trust / weak signature compare", rule: orderIdTrust },
  { id: "raw-body-violation", label: "Raw body / fail-open signature check", rule: rawBodyViolation },
  { id: "no-idempotency", label: "No webhook idempotency", rule: noIdempotency },
  { id: "event-order-assumption", label: "Event-order assumption", rule: eventOrderAssumption },
];

export const ALL_RULES: Rule[] = RULE_CATALOG.map((entry) => entry.rule);

export async function runAllRules(source: SourceFetcher): Promise<RuleResult[]> {
  return Promise.all(ALL_RULES.map((rule) => rule(source)));
}

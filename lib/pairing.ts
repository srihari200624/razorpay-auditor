/**
 * Each live attack proves the same defect a static rule detects, from the
 * opposite end. A fix for a live-attack finding is therefore keyed to (and
 * re-verified by) its paired rule — see the Apply flow. No heavy imports here,
 * so this is safe to import from client components.
 */
export const ATTACK_TO_RULE: Record<string, string> = {
  fakePaymentSuccess: "browser-trusted-success",
  webhookReplay: "no-idempotency",
  forgedSignature: "raw-body-violation",
};

export function ruleIdForAttack(attackId: string): string | null {
  return ATTACK_TO_RULE[attackId] ?? null;
}

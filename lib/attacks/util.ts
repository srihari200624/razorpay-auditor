import crypto from "crypto";

export interface OrderState {
  status: string | null;
  amountRupees: number | null;
  creditedAmountRupees: number | null;
}

export interface WebhookDelivery {
  httpStatus: number;
  body: string;
}

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
if (!WEBHOOK_SECRET) {
  throw new Error(
    "RAZORPAY_WEBHOOK_SECRET is not set — run with: node --env-file=.env <script>",
  );
}

export function hmacSha256Hex(secret: string, data: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

export function signWebhookBody(rawBody: string): string {
  return hmacSha256Hex(WEBHOOK_SECRET!, rawBody);
}

/** Builds the exact raw JSON string that will be signed and sent — the
 * signature must be computed over these exact bytes. */
export function buildWebhookPayload(
  event: "payment.authorized" | "payment.captured",
  orderId: string,
  amountPaise: number,
): string {
  return JSON.stringify({
    event,
    payload: {
      payment: {
        entity: {
          id: `pay_${crypto.randomBytes(7).toString("hex")}`,
          order_id: orderId,
          amount: amountPaise,
          status: event === "payment.captured" ? "captured" : "authorized",
        },
      },
    },
  });
}

export async function createOrder(
  targetUrl: string,
): Promise<{ orderId: string; amountPaise: number }> {
  const res = await fetch(`${targetUrl}/api/create-order`, { method: "POST" });
  if (!res.ok) {
    throw new Error(
      `create-order failed against ${targetUrl}: ${res.status} ${await res.text()}`,
    );
  }
  const data = (await res.json()) as { orderId: string; amount: number };
  return { orderId: data.orderId, amountPaise: data.amount };
}

export async function sendWebhook(
  targetUrl: string,
  rawBody: string,
  signature: string,
  eventId: string,
): Promise<WebhookDelivery> {
  const res = await fetch(`${targetUrl}/api/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature": signature,
      "x-razorpay-event-id": eventId,
    },
    body: rawBody,
  });
  let body = "";
  try {
    body = await res.text();
  } catch {
    // ignore
  }
  return { httpStatus: res.status, body };
}

/** Sends a correctly-signed payment.authorized event so the order reaches a
 * state ("authorized") that lets a subsequent payment.captured event be
 * processed at all. This mirrors what the real Razorpay webhook sequence
 * does before capture — it is setup, not part of the attack under test. */
export async function setupAuthorized(
  targetUrl: string,
  orderId: string,
  amountPaise: number,
): Promise<void> {
  const rawBody = buildWebhookPayload("payment.authorized", orderId, amountPaise);
  const signature = signWebhookBody(rawBody);
  await sendWebhook(targetUrl, rawBody, signature, `evt_setup_${crypto.randomUUID()}`);
}

/** Reads real state back from the target's own order status page — never
 * trust an HTTP 200 from the attack request itself. */
export async function readOrderState(
  targetUrl: string,
  orderId: string,
): Promise<OrderState> {
  const res = await fetch(`${targetUrl}/order/${orderId}`, { cache: "no-store" });
  if (!res.ok) {
    return { status: null, amountRupees: null, creditedAmountRupees: null };
  }
  const html = await res.text();

  // React renders `₹{value}` as two adjacent text nodes and marks the
  // boundary with an `<!-- -->` comment in the server-rendered HTML.
  const rupeeMatches = [...html.matchAll(/₹(?:<!--\s*-->)?([\d,]+\.\d{2})/g)].map((m) =>
    parseFloat(m[1].replace(/,/g, "")),
  );
  const amountRupees = rupeeMatches.length > 0 ? rupeeMatches[0] : null;
  // The credited-amount block only exists on the vulnerable app's status
  // page (the defect-5 doubling display); the fixed app's page has no
  // second ₹ figure at all.
  const creditedAmountRupees = rupeeMatches.length > 1 ? rupeeMatches[1] : null;

  const statusMatch = html.match(/tracking-wide sm:text-9xl[^"]*">\s*([^<]+?)\s*</);
  const status = statusMatch ? statusMatch[1].trim() : null;

  return { status, amountRupees, creditedAmountRupees };
}

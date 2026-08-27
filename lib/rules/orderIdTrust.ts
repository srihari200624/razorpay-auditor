import type { Rule } from "./types.ts";
import { findMatch } from "./util.ts";

const FILE_PATH = "app/api/verify-payment/route.ts";
// HMAC built from the request body's raw `razorpay_order_id` rather than a
// session-resolved order (e.g. `order.razorpayOrderId`).
const RAW_ORDER_ID_IN_HMAC = /update\(\s*`\$\{razorpay_order_id\}/;
// Non-constant-time comparison of the computed vs. supplied signature.
const WEAK_COMPARE = /isValid\s*=\s*expectedSignature\s*===\s*razorpay_signature/;

/**
 * Defect 3: two flaws in the signature-verification path — the HMAC is fed
 * the client-supplied order id instead of a session-bound lookup, and the
 * comparison uses `===` instead of `crypto.timingSafeEqual`.
 */
export const orderIdTrust: Rule = async (source) => {
  const base = {
    defectId: "order-id-trust",
    defectName: "Order id trust / weak signature compare",
    filePath: FILE_PATH,
  };

  const content = await source.fetchFile(FILE_PATH);
  if (content === null) {
    return {
      ...base,
      found: false,
      lineNumber: null,
      matchedCode: null,
      explanation: `${FILE_PATH} does not exist in this source.`,
    };
  }

  const rawOrderId = findMatch(content, RAW_ORDER_ID_IN_HMAC);
  const weakCompare = findMatch(content, WEAK_COMPARE);

  if (!rawOrderId && !weakCompare) {
    return {
      ...base,
      found: false,
      lineNumber: null,
      matchedCode: null,
      explanation: `${FILE_PATH} builds the HMAC from a session-resolved order id and compares with a constant-time check — neither flaw is present.`,
    };
  }

  const primary = rawOrderId ?? weakCompare!;
  const parts: string[] = [];
  if (rawOrderId) {
    parts.push(
      `the HMAC is computed from the request body's razorpay_order_id directly (line ${rawOrderId.lineNumber}) instead of a session-resolved order lookup`,
    );
  }
  if (weakCompare) {
    parts.push(
      `the signature comparison uses === (line ${weakCompare.lineNumber}) instead of crypto.timingSafeEqual`,
    );
  }

  return {
    ...base,
    found: true,
    lineNumber: primary.lineNumber,
    matchedCode: primary.matchedCode,
    explanation: `${FILE_PATH}: ${parts.join("; ")}.`,
  };
};

import type { Rule } from "./types.ts";
import { findMatch } from "./util.ts";

const FILE_PATH = "app/api/verify-payment/route.ts";
const STATUS_SUCCESS_PATTERN = /status\s*===\s*["']success["']/;
const SIGNATURE_CHECK_PATTERN = /razorpay_signature|timingSafeEqual|expectedSignature/;

/**
 * Defect 2: a `status === "success"` shortcut that marks the order paid with
 * no signature check anywhere before it in the file — a bare POST forges a
 * payment.
 */
export const browserTrustedSuccess: Rule = async (source) => {
  const base = {
    defectId: "browser-trusted-success",
    defectName: "Browser-trusted payment success",
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

  const shortcut = findMatch(content, STATUS_SUCCESS_PATTERN);
  if (!shortcut) {
    return {
      ...base,
      found: false,
      lineNumber: null,
      matchedCode: null,
      explanation: `No status === "success" shortcut branch found in ${FILE_PATH}.`,
    };
  }

  const before = content.slice(0, shortcut.index);
  if (SIGNATURE_CHECK_PATTERN.test(before)) {
    return {
      ...base,
      found: false,
      lineNumber: shortcut.lineNumber,
      matchedCode: shortcut.matchedCode,
      explanation: `${FILE_PATH}:${shortcut.lineNumber} has a status === "success" branch, but a signature check already appears earlier in the file, so it isn't an unconditional bypass.`,
    };
  }

  return {
    ...base,
    found: true,
    lineNumber: shortcut.lineNumber,
    matchedCode: shortcut.matchedCode,
    explanation: `${FILE_PATH}:${shortcut.lineNumber} marks the order paid on a status === "success" body field with no signature check anywhere before it — any client can forge a successful payment with a bare POST.`,
  };
};

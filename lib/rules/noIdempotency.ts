import type { Rule } from "./types.ts";
import { findMatch } from "./util.ts";

const FILE_PATH = "app/api/webhook/route.ts";
const EVENT_ID_PATTERN = /x-razorpay-event-id/i;

/**
 * Defect 5: no reference to x-razorpay-event-id anywhere in the webhook
 * handler — every delivery is processed unconditionally, so a replayed
 * event re-credits the order.
 */
export const noIdempotency: Rule = async (source) => {
  const base = {
    defectId: "no-idempotency",
    defectName: "No webhook idempotency",
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

  const match = findMatch(content, EVENT_ID_PATTERN);
  if (match) {
    return {
      ...base,
      found: false,
      lineNumber: match.lineNumber,
      matchedCode: match.matchedCode,
      explanation: `${FILE_PATH}:${match.lineNumber} reads x-razorpay-event-id, so redelivered events can be deduplicated.`,
    };
  }

  return {
    ...base,
    found: true,
    lineNumber: null,
    matchedCode: null,
    explanation: `${FILE_PATH} never references x-razorpay-event-id — every incoming event is processed unconditionally, so replaying one webhook re-applies its effect.`,
  };
};

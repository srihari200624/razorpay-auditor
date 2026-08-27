import type { Rule } from "./types.ts";
import { findMatch, locate } from "./util.ts";

const FILE_PATH = "app/api/webhook/route.ts";
const CAPTURED_HANDLER_MARKER = /event\s*===\s*["']payment\.captured["']/;
const NEXT_BRANCH_MARKER = /else if/;
// A status allow-list gating the capture handler — only proceeds if the
// order is already in a state that assumes payment.authorized arrived first.
const STATUS_GATE_PATTERN = /status:\s*\{\s*in:\s*\[/;

/**
 * Defect 6: the payment.captured handler only updates the order when it is
 * already in an allow-listed status, assuming payment.authorized always
 * arrives first — Razorpay does not guarantee delivery order. Inspection
 * only, no live attack.
 */
export const eventOrderAssumption: Rule = async (source) => {
  const base = {
    defectId: "event-order-assumption",
    defectName: "Event-order assumption",
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

  const captured = findMatch(content, CAPTURED_HANDLER_MARKER);
  if (!captured) {
    return {
      ...base,
      found: false,
      lineNumber: null,
      matchedCode: null,
      explanation: `No payment.captured handler found in ${FILE_PATH} to inspect.`,
    };
  }

  const afterCaptured = content.slice(captured.index);
  const nextBranchOffset = afterCaptured.search(NEXT_BRANCH_MARKER);
  const scope = nextBranchOffset === -1 ? afterCaptured : afterCaptured.slice(0, nextBranchOffset);

  const gateMatch = STATUS_GATE_PATTERN.exec(scope);
  if (!gateMatch) {
    return {
      ...base,
      found: false,
      lineNumber: captured.lineNumber,
      matchedCode: captured.matchedCode,
      explanation: `${FILE_PATH}:${captured.lineNumber} updates the order on payment.captured unconditionally — it does not assume payment.authorized arrived first.`,
    };
  }

  const gate = locate(content, captured.index + gateMatch.index);
  return {
    ...base,
    found: true,
    lineNumber: gate.lineNumber,
    matchedCode: gate.matchedCode,
    explanation: `${FILE_PATH}:${gate.lineNumber} gates the payment.captured handler on the order already being in an allow-listed status — it assumes payment.authorized (or an equivalent prior state) already arrived, which Razorpay does not guarantee.`,
  };
};

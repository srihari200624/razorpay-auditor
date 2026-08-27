import type { Rule } from "./types.ts";
import { findMatch, locate } from "./util.ts";

const FILE_PATH = "app/api/webhook/route.ts";
// req.json() parses (and consumes) the body before any signature check can
// run over the raw bytes — a raw-body violation in its own right.
const JSON_BEFORE_VERIFY_PATTERN = /await\s+req\.json\(\)/;
const SIGNATURE_VERIFIED_MARKER = /timingSafeEqual|Invalid signature/;
// The `catch` swallows a comparison failure (e.g. a length-mismatch throw
// from timingSafeEqual) and treats it as a valid signature — fail-open.
const FAIL_OPEN_CATCH_PATTERN = /catch\s*(?:\([^)]*\))?\s*\{[\s\S]{0,200}?isValid\s*=\s*true/;

/**
 * Defect 4: the webhook handler either parses the body with req.json()
 * before verifying it, or fails open on a signature-comparison error inside
 * a try/catch — either way, unverified bytes get processed.
 */
export const rawBodyViolation: Rule = async (source) => {
  const base = {
    defectId: "raw-body-violation",
    defectName: "Raw body / fail-open signature check",
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

  const jsonMatch = findMatch(content, JSON_BEFORE_VERIFY_PATTERN);
  const verifyMatch = findMatch(content, SIGNATURE_VERIFIED_MARKER);
  const jsonBeforeVerify =
    jsonMatch && (!verifyMatch || jsonMatch.index < verifyMatch.index) ? jsonMatch : null;

  const failOpenMatch = FAIL_OPEN_CATCH_PATTERN.exec(content);
  const failOpen = failOpenMatch ? locate(content, failOpenMatch.index) : null;

  if (!jsonBeforeVerify && !failOpen) {
    return {
      ...base,
      found: false,
      lineNumber: null,
      matchedCode: null,
      explanation: `${FILE_PATH} verifies the signature over the raw body before parsing it, and does not fail open on a comparison error.`,
    };
  }

  const primary = failOpen ?? jsonBeforeVerify!;
  const parts: string[] = [];
  if (jsonBeforeVerify) {
    parts.push(`req.json() is called (line ${jsonBeforeVerify.lineNumber}) before the signature is verified`);
  }
  if (failOpen) {
    parts.push(
      `a catch block around the signature comparison sets isValid = true (line ${failOpen.lineNumber}), so a comparison error (e.g. a wrong-length signature throwing out of timingSafeEqual) is treated as a valid signature`,
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

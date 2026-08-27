import type { Rule } from "./types.ts";
import { findMatch } from "./util.ts";

const FILE_PATH = "app/page.tsx";
const SECRET_REF_PATTERN = /NEXT_PUBLIC_RAZORPAY_KEY_SECRET/;

/**
 * Defect 1: the Razorpay key SECRET (not the public key id) referenced via a
 * NEXT_PUBLIC_ env var in client code — its value ships in the page source /
 * JS bundle.
 */
export const secretExposure: Rule = async (source) => {
  const base = {
    defectId: "secret-exposure",
    defectName: "Secret exposed to the client",
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

  const match = findMatch(content, SECRET_REF_PATTERN);
  if (!match) {
    return {
      ...base,
      found: false,
      lineNumber: null,
      matchedCode: null,
      explanation: `No reference to NEXT_PUBLIC_RAZORPAY_KEY_SECRET found in ${FILE_PATH}.`,
    };
  }

  return {
    ...base,
    found: true,
    lineNumber: match.lineNumber,
    matchedCode: match.matchedCode,
    explanation: `${FILE_PATH}:${match.lineNumber} references NEXT_PUBLIC_RAZORPAY_KEY_SECRET in client component code — anything under a NEXT_PUBLIC_ prefix is inlined into the browser bundle, so the key secret is readable in page source.`,
  };
};

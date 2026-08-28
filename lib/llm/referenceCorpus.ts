import { DEMO_TARGETS } from "../config/demoTargets.ts";
import { resolveSource } from "../source/resolveSource.ts";
import type { SourceFetcher } from "../source/fetchSource.ts";

/**
 * The disclosed reference corpus: the known-good `fixed` Razorpay integration.
 * The drafting model is grounded in the corresponding fixed file for whatever
 * path it is patching — this is a retrieval step, not the model inventing a fix
 * from scratch, which is what makes first-try re-verify reliable.
 *
 * Override with AUDITOR_REFERENCE_SOURCE for local dev (e.g. point it at
 * `../fixed` to avoid the unauthenticated GitHub rate limit).
 */
const REFERENCE_TARGET = process.env.AUDITOR_REFERENCE_SOURCE ?? DEMO_TARGETS.fixed.repoUrl;

let source: SourceFetcher | null = null;
function reference(): SourceFetcher {
  if (!source) source = resolveSource(REFERENCE_TARGET);
  return source;
}

const cache = new Map<string, Promise<string | null>>();

/** Known-good contents of `filePath` from the fixed integration, or null. */
export function fetchReferenceFile(filePath: string): Promise<string | null> {
  if (!cache.has(filePath)) cache.set(filePath, reference().fetchFile(filePath));
  return cache.get(filePath)!;
}

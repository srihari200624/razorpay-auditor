import Anthropic from "@anthropic-ai/sdk";

/** Fix drafting must be correct: the prior-generation Opus tier, high effort. */
export const MODEL_FIX = "claude-opus-4-8";
/** Explanations are low-stakes prose: Sonnet for snappy streaming. */
export const MODEL_EXPLAIN = "claude-sonnet-5";

let client: Anthropic | null = null;

/**
 * Lazily constructs the Anthropic client. `new Anthropic()` resolves
 * ANTHROPIC_API_KEY (or an `ant auth login` profile) from the environment and
 * throws if neither is present — the API routes surface that as a 502 so the
 * UI shows a clear error rather than hanging.
 */
export function anthropic(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

/**
 * Best-effort pre-flight check for the two explicit-credential paths the SDK
 * resolves at construction time (an env var api key or auth token). A CLI
 * auth profile / WIF can still work even when this returns false — those
 * resolve later, inside the request pipeline — so this only ever produces
 * false negatives there, never false positives. Used to fail a route with a
 * clean JSON 502 *before* opening a stream, rather than mid-stream once
 * headers are already flushed (see app/api/explain/route.ts).
 */
export function hasExplicitCredentials(): boolean {
  const c = anthropic();
  return c.apiKey != null || c.authToken != null;
}

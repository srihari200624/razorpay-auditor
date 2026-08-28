import { NextResponse } from "next/server";
import { isGitHubTarget, resolveSource } from "@/lib/source/resolveSource";
import { RULE_CATALOG } from "@/lib/rules";
import { overlaySource } from "@/lib/overlay/patchedSource";
import { rateLimit } from "@/lib/llm/rateLimit";

/**
 * The deterministic gate. Never writes to `source` — builds an in-memory
 * overlay with the drafted patch swapped in for one file, then RE-RUNS the
 * same rule that proved the defect. The LLM's "fixed" claim is never trusted;
 * only a fresh CLEAR verdict from the rule itself is reported back. Rate-limited
 * alongside the LLM routes (uniformly, though this route itself never calls
 * Anthropic).
 */
export async function POST(req: Request) {
  const rl = rateLimit(req);
  if (rl.limited) {
    return NextResponse.json(
      { error: "Rate limit exceeded — try again later." },
      { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } },
    );
  }

  const body = (await req.json()) as { source: string; ruleId: string; filePath: string; patchedFile: string };

  if (!body?.source || !body?.ruleId || !body?.filePath || typeof body?.patchedFile !== "string") {
    return NextResponse.json({ error: "Missing source, ruleId, filePath, or patchedFile" }, { status: 400 });
  }

  if (!isGitHubTarget(body.source) && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Local filesystem sources are disabled outside development." },
      { status: 403 },
    );
  }

  const entry = RULE_CATALOG.find((r) => r.id === body.ruleId);
  if (!entry) {
    return NextResponse.json({ error: `Unknown rule "${body.ruleId}"` }, { status: 404 });
  }

  try {
    const base = resolveSource(body.source);
    const overlay = overlaySource(base, body.filePath, body.patchedFile);
    const result = await entry.rule(overlay);
    // result.found === false means the rule now reports CLEAR on the patched
    // overlay — that is the only thing that makes this a verified fix.
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}

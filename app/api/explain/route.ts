import { NextResponse } from "next/server";
import { explainStream } from "@/lib/llm/explain";
import { hasExplicitCredentials } from "@/lib/llm/client";
import { rateLimit } from "@/lib/llm/rateLimit";

/**
 * Streams an advisory explanation of an already-proven finding. Never a
 * verdict — the deterministic engine already decided found/succeeded.
 */
export async function POST(req: Request) {
  const rl = rateLimit(req);
  if (rl.limited) {
    return NextResponse.json(
      { error: "Rate limit exceeded — try again later." },
      { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } },
    );
  }

  const body = (await req.json()) as {
    kind: "rule" | "attack";
    label: string;
    filePath: string | null;
    deterministicSummary: string;
  };

  if (!body?.label || !body?.deterministicSummary) {
    return NextResponse.json({ error: "Missing label or deterministicSummary" }, { status: 400 });
  }

  // A missing API key/token surfaces mid-stream (once headers are already
  // flushed) rather than as a catchable synchronous throw — check the common
  // case up front so the client gets a clean JSON 502 instead of a reset
  // connection. A CLI auth profile still works even when this is false; it
  // just resolves later, inside the stream (existing catch below).
  if (!hasExplicitCredentials()) {
    return NextResponse.json(
      { error: "No Anthropic credentials configured (ANTHROPIC_API_KEY/ANTHROPIC_AUTH_TOKEN)." },
      { status: 502 },
    );
  }

  try {
    const stream = explainStream(body);
    return new Response(stream, {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}

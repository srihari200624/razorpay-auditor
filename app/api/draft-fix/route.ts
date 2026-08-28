import { NextResponse } from "next/server";
import { isGitHubTarget, resolveSource } from "@/lib/source/resolveSource";
import { RULE_CATALOG } from "@/lib/rules";
import { draftFix } from "@/lib/llm/draftFix";
import { deriveDiff, checkGuardrail } from "@/lib/diff/derive";
import { rateLimit } from "@/lib/llm/rateLimit";

/**
 * Drafts a fix for one already-proven rule finding: full patched file (via
 * structured output, so it always parses), guardrail-checked against the
 * finding's anchor before being offered to the UI. Advisory only — nothing
 * here is a verdict, and nothing is written back to `source`.
 */
export async function POST(req: Request) {
  const rl = rateLimit(req);
  if (rl.limited) {
    return NextResponse.json(
      { error: "Rate limit exceeded — try again later." },
      { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } },
    );
  }

  const body = (await req.json()) as { source: string; ruleId: string };

  if (!body?.source || !body?.ruleId) {
    return NextResponse.json({ error: "Missing source or ruleId" }, { status: 400 });
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
    const source = resolveSource(body.source);
    const finding = await entry.rule(source);
    if (!finding.found) {
      return NextResponse.json(
        { error: `${body.ruleId} did not find a defect on this source — nothing to fix.` },
        { status: 409 },
      );
    }

    const vulnerableFile = await source.fetchFile(finding.filePath);
    if (vulnerableFile === null) {
      return NextResponse.json({ error: `${finding.filePath} not found in source.` }, { status: 404 });
    }

    const fix = await draftFix({
      filePath: finding.filePath,
      vulnerableFile,
      finding,
    });

    const diff = deriveDiff(vulnerableFile, fix.patchedFile);
    const guardrail = checkGuardrail(diff, { anchorLine: finding.lineNumber });
    if (!guardrail.ok) {
      return NextResponse.json({ error: `Fix rejected by guardrail: ${guardrail.reason}` }, { status: 422 });
    }

    return NextResponse.json({
      filePath: finding.filePath,
      patchedFile: fix.patchedFile,
      rationale: fix.rationale,
      diff: diff.lines,
      added: diff.added,
      removed: diff.removed,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}

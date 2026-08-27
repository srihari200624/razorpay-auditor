import { NextResponse } from "next/server";
import { isGitHubTarget, resolveSource } from "@/lib/source/resolveSource";
import { RULE_CATALOG } from "@/lib/rules";

export async function GET(req: Request, { params }: { params: Promise<{ ruleId: string }> }) {
  const { ruleId } = await params;
  const source = new URL(req.url).searchParams.get("source");

  if (!source) {
    return NextResponse.json({ error: "Missing source query param" }, { status: 400 });
  }

  const entry = RULE_CATALOG.find((r) => r.id === ruleId);
  if (!entry) {
    return NextResponse.json({ error: `Unknown rule "${ruleId}"` }, { status: 404 });
  }

  // Local filesystem reads are a dev convenience only — never honor them
  // against a public deployment of this app.
  if (!isGitHubTarget(source) && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Local filesystem sources are disabled outside development." },
      { status: 403 },
    );
  }

  try {
    const result = await entry.rule(resolveSource(source));
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}

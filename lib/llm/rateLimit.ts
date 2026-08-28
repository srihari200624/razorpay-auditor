/**
 * Dead-simple in-memory per-IP rate limit for the LLM-touching routes
 * (/api/explain, /api/draft-fix, /api/apply). The key is public once the
 * deployed app has ANTHROPIC_API_KEY set, so this exists to stop a stranger
 * who finds the URL from running up the Anthropic bill — not to be robust
 * infrastructure. State is a process-local Map, so it resets on redeploy and
 * is per-serverless-instance; that is deliberately fine for the buildathon
 * timeline.
 *
 * Default is 10 requests/IP/hour; override with LLM_RATE_LIMIT_PER_HOUR (e.g.
 * bump it while recording the demo from a single IP, without a code change).
 */
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = Number(process.env.LLM_RATE_LIMIT_PER_HOUR ?? "10");

const hits = new Map<string, number[]>();

/** Best-effort client IP. On Vercel the real client is the first entry of
 * x-forwarded-for; everything else is a fallback so one shared bucket still
 * caps abuse even when we can't identify the caller. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export interface RateLimitResult {
  limited: boolean;
  retryAfterSec: number;
}

/** Records this request and reports whether the caller is over the limit.
 * Call once at the top of each guarded route. */
export function rateLimit(req: Request): RateLimitResult {
  const ip = clientIp(req);
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS) {
    hits.set(ip, recent); // keep the pruned window
    const retryAfterSec = Math.max(1, Math.ceil((WINDOW_MS - (now - recent[0])) / 1000));
    return { limited: true, retryAfterSec };
  }

  recent.push(now);
  hits.set(ip, recent);
  return { limited: false, retryAfterSec: 0 };
}

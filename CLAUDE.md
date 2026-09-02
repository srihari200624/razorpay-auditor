# auditor — AI Payment Integration Auditor project

## What this app is
This is the actual product. It finds and proves security defects in Razorpay
payment integrations. It was built in phases:
- **Phase 1** (`lib/attacks/`): the runtime attack runner.
- **Phase 2** (`lib/rules/`): the deterministic static rules engine.
- **Phase 3** (`app/audit/`): the audit UI (evidence log, Demo + Console tabs).
- **Phase 4** (`lib/llm/`, `lib/overlay/`, `lib/diff/`, `lib/pairing.ts`): the
  LLM explanation layer and the Apply button.
- **Phase 5** (`app/product/`, plus additions to `app/audit/` and `lib/`): a
  second front end reframing the same engine as a security-audit product,
  visible-proof deepening on the demo UI, and the rate/caching guardrails
  needed to run either UI publicly.

All five are built. This file documents each; treat it as current, not
aspirational — if you're extending the app, read the phase sections below for
what already exists before adding something that duplicates it. See
`ROADMAP.md` for what's planned *beyond* what's built.

## Sibling apps
- `../fixed` — a correct, working Razorpay integration. All attacks below
  must FAIL against it, and no static rule should find a defect in it. Its
  source also serves as Phase 4's disclosed reference corpus (see below).
- `../vulnerable` — the same app with 6 deliberate defects. All three live
  attacks below must SUCCEED against it, and all six rules should find their
  defect. See `../vulnerable/CLAUDE.md` for the exact defect definitions.
  **This app must stay vulnerable** — Apply (Phase 4, and `/product`'s
  Phase 5 Auto-fix all, which is the same Apply call looped) never writes to
  it or to any audited source; see Phase 4 below.

## Architectural principle — do not violate this
The LLM explains findings and drafts fixes. It NEVER decides pass/fail.
Verdicts come only from:
1. Deterministic static rules (`lib/rules/`)
2. What actually happens when a real attack is fired at a real endpoint
   (`lib/attacks/`)

A drafted fix is verified the same way: not by asking the LLM whether it
looks fixed, but by re-running the same rule that proved the defect against
the patched code (`app/api/apply/route.ts`) and trusting only that fresh
result. See Phase 4 below for the full mechanism.

## Phase 1: three attack functions (`lib/attacks/`)

Each attack function takes a target base URL (e.g. `http://localhost:3000` or
a deployed Vercel URL) and returns an `AttackResult`.

### 1. `fakePaymentSuccess(targetUrl, orderId)`
POSTs `{ status: "success", orderId }` to `/api/verify-payment` with no
signature. Succeeded = order status became "paid" with no valid proof
supplied. Verifies the actual DB/API state after, never just trusts a 200.

### 2. `webhookReplay(targetUrl, orderId, amountPaise)`
Generates ONE validly-signed `payment.captured` webhook payload (raw body +
correct HMAC using `RAZORPAY_WEBHOOK_SECRET`), POSTs it twice with the same
`x-razorpay-event-id`. Succeeded = creditedAmount increased on both
deliveries (doubled), rather than the second being ignored.

### 3. `forgedSignature(targetUrl, orderId, amountPaise)`
POSTs a webhook with a signature of the WRONG LENGTH (not just wrong content
— see `../vulnerable/CLAUDE.md` defect 4, the implementation only fails open
on a length mismatch, a same-length forgery is correctly rejected).
Succeeded = webhook accepted (200) and processed despite the invalid
signature.

### Return shape
```ts
{
  attackName: string,
  succeeded: boolean,       // true = attack achieved its goal (bad outcome)
  details: string,          // human-readable, what actually happened
  httpStatus: number,
  targetUrl: string,
  evidence?: {               // optional structured proof (Phase 5's evidence expander)
    exchanges: AttackExchange[],   // real request(s) fired + raw response(s)
    stateTrail: StateReading[],    // order state read back before/after, e.g. credited ₹ doubling
  },
}
```

### Setup each attack needs
Before firing any attack, create a fresh order on the target (via
`/api/create-order`, `lib/attacks/util.ts`'s `createOrder`) so each attack
runs against clean, known state — never reuse orders across runs or across
attacks. `scripts/run-attacks.ts` and `app/api/attacks/[attackId]/route.ts`
both follow this.

## Phase 2: static rules engine (`lib/rules/`)

Six rules, one per defect in `../vulnerable/CLAUDE.md`, each a
`(source: SourceFetcher) => Promise<RuleResult>` (`lib/rules/types.ts`).
`RULE_CATALOG` (`lib/rules/index.ts`) is the id/label/rule registry; keep a
rule's own `defectId` in sync with its catalog id — the API route and the UI
both look rules up by that id.

| Rule id | File | Detects |
|---|---|---|
| `secret-exposure` | `app/page.tsx` | Key secret referenced via `NEXT_PUBLIC_` in client code |
| `browser-trusted-success` | `app/api/verify-payment/route.ts` | Unconditional `status === "success"` bypass |
| `order-id-trust` | `app/api/verify-payment/route.ts` | HMAC built from client-supplied order id / `===` compare |
| `raw-body-violation` | `app/api/webhook/route.ts` | Body parsed before verify, or a fail-open catch |
| `no-idempotency` | `app/api/webhook/route.ts` | No `x-razorpay-event-id` read anywhere |
| `event-order-assumption` | `app/api/webhook/route.ts` | `payment.captured` gated on an already-authorized status |

`lib/source/fetchSource.ts` is the `SourceFetcher` abstraction (`fetchFromLocal`
for a filesystem path, `fetchFromGitHub` for a repo URL); `resolveSource.ts`
picks between them from a single `source` string. `scripts/scan.ts` runs all
six against a target from the CLI; `app/api/rules/[ruleId]/route.ts` exposes
one rule over HTTP (local filesystem sources are rejected outside
development — never honor a local-fs read against a public deployment).

## Phase 3: audit UI (`app/audit/`)

`AuditConsole.tsx` hosts two tabs: `DemoView.tsx` (pre-wired VULNERABLE /
FIXED panels from `lib/config/demoTargets.ts`, run side by side) and
`ConsoleView.tsx` (free-form source + target input). Both drive
`useAuditRun.ts`, which fires all 6 rules and 3 attacks independently against
`/api/rules/[ruleId]` and `/api/attacks/[attackId]` and streams each result
into `EvidenceLog.tsx` as it resolves. `theme.ts` is the color contract:
amber = static finding, sky = verified secure, red = a live attack that
actually succeeded (never used elsewhere) — Phase 4's re-verify entries reuse
sky rather than inventing a new color. See Phase 4 below for what an
amber/red row does *beyond* just being displayed.

## Phase 4: LLM explanation layer + Apply button

Built on top of Phases 1-3 without weakening the architectural principle
above. Two things the LLM does, both advisory only:

**Explain** (`app/api/explain/route.ts`, `lib/llm/explain.ts`) — streams a
plain-text explanation of an already-proven `found`/`hit` finding. Narrates a
verdict the deterministic engine already reached; never itself a verdict.

**Draft fix** (`app/api/draft-fix/route.ts`, `lib/llm/draftFix.ts`) — given a
rule id and a source, re-runs that rule to get the current finding, then asks
the model for the **entire patched file** (structured output via
`zodOutputFormat`, so it always parses — no diff-apply step that can fail).
The model is grounded in the corresponding file from `../fixed` as a
disclosed, known-good reference (`lib/llm/referenceCorpus.ts` — override with
`AUDITOR_REFERENCE_SOURCE` for local dev). The patch is guardrail-checked
(`lib/diff/derive.ts`'s `checkGuardrail`: rejects a no-op, an over-broad
change, or one whose touched lines drift far from the finding's anchor line)
before being returned to the UI as a derived diff.

**Apply — the deterministic gate** (`app/api/apply/route.ts`,
`lib/overlay/patchedSource.ts`) — this is the keystone. Apply never writes to
the audited source (GitHub or local checkout); it builds an **in-memory
overlay** `SourceFetcher` that returns the drafted patch's text for one file
path and delegates every other path to the real source, then **re-runs the
same rule** against that overlay. The LLM's own claim that something is fixed
is never trusted — only a fresh `found: false` from the rule itself. This is
why `../vulnerable` can stay vulnerable for the next demo run: nothing is
ever persisted back to it.

**Attack ↔ rule pairing** (`lib/pairing.ts`) — each live attack proves the
same defect a static rule detects, from the opposite end, so a live-attack
finding's fix is drafted and re-verified through its paired rule:

| Live attack | Paired rule | Shared file |
|---|---|---|
| `fakePaymentSuccess` | `browser-trusted-success` | `app/api/verify-payment/route.ts` |
| `webhookReplay` | `no-idempotency` | `app/api/webhook/route.ts` |
| `forgedSignature` | `raw-body-violation` | `app/api/webhook/route.ts` |

**UI** (`app/audit/FindingActions.tsx`) — only rendered on `found`/`hit` rows.
Explain expands a streamed panel labeled "AI explanation — advisory, not a
verdict," visually subordinate to the verdict line and never using verdict
colors. Draft fix shows the derived diff + rationale + an Apply button. A
successful Apply **appends** a new sky `FIX RE-VERIFIED` entry linked beneath
the original proof (`useAuditRun.ts`'s `appendVerified`) — the original
amber/red entry is never rewritten, so the evidence log keeps the fact that
the target *was* vulnerable even after a fix verifies clean. A failed
re-verify (rule still reports the defect) surfaces inline near the Apply
button and appends nothing.

**Models** (`lib/llm/client.ts`) — `claude-opus-4-8` for draft-fix
(correctness-sensitive), `claude-sonnet-5` for explain (low-stakes streamed
prose). Both server-side only; the API key never reaches the browser.

**Stretch, not built**: booting a patched app in a temp dir and re-firing the
real HTTP attack for one hero live-attack finding, as an alternative to
paired-rule re-verify. The paired-rule re-verify is sufficient and reliable
for the whole matrix; this would only add an extra, heavier confirmation for
the live-attack path specifically.

**Corrected finding from live verification** (an earlier version of this
section claimed `no-idempotency` needs a schema migration Apply can't do —
that was wrong; corrected below after actually checking). `no-idempotency`'s
first live draft-fix (86 changed lines: an event-id check + `$transaction` +
`P2002` handling) was guardrail-rejected as "too broad" by
`lib/diff/derive.ts`'s original `maxChangedLines: 60`. The natural
assumption — that this meant the fix needed a new Prisma model the single-file
patch couldn't add — was checked directly against `../vulnerable`'s real
schema and live database (`npx prisma migrate status` inside `../vulnerable`)
and turned out to be false: **the `ProcessedWebhookEvent` table already
exists, migrated, in the real database.** The migration history even shows
the intended defect shape: `..._drop_webhook_idempotency` followed by
`..._restore_unused_webhook_event_table` — the table was deliberately restored
but never wired into the handler, so the defect is the *code* not using
existing infrastructure, not missing infrastructure. `maxChangedLines` was
simply an untested initial guess, too tight for this defect's genuinely
necessary fix size. Raised to 100 (comment in `checkGuardrail` records the
evidence: 8/19/84-86-line legitimate fixes observed vs. a 265-line
deliberately-wild rewrite in earlier testing, still caught at 100). No
multi-file Apply is needed for any of the six current rules.

**Live-verified** (2026, against `../vulnerable` with a real `ANTHROPIC_API_KEY`):
Explain (`browser-trusted-success`) streamed a correct, appropriately-scoped
explanation. Draft-fix → Apply closed the loop for all three paired rules —
`browser-trusted-success`, `raw-body-violation`, and (after the guardrail fix
above) `no-idempotency` — the real model output re-verified `found: false`
through the paired rule every time, and `../vulnerable`'s `git status` stayed
clean throughout (the overlay never touched the real source, and a separate
diagnostic write directly to `../vulnerable`'s real file was considered,
explicitly flagged to the user as touching a sibling app's source, and
declined in favor of the overlay-only path above).

## Phase 5: frontend deepening + `/product`

Built on top of Phases 1-4 without changing the engine, any API route, or the
architectural principle — Phase 5 is presentation and operational hardening,
not new verdict logic.

**Evidence expander** (`app/audit/EvidencePanel.tsx`) — every resolved row in
the evidence log (any status, not just found/hit — a fixed-app BLOCKED row
proves rejection just as a red row proves the hit) gets a `▸ EVIDENCE`
disclosure. For a rule row it shows the `matchedCode` snippet at `file:line`
(`RuleResult.matchedCode`, already returned by every rule — Phase 5 just
stopped discarding it). For an attack row it shows the real request(s) fired,
the raw response(s), and the order-state trail read back before/after
(`AttackResult.evidence` — see the Return shape above; populated in all three
`lib/attacks/*.ts` files, e.g. `webhookReplay`'s trail shows credited ₹
literally doubling). `app/audit/Scoreboard.tsx` adds a per-panel tally (`3 LIVE
HITS · 6 FOUND` vs `ALL SECURE`) so the vulnerable↔fixed contrast reads at a
glance.

**Fix-flow micro-interactions** (`app/audit/FindingActions.tsx`) — Explain's
stream is decoupled from network chunk cadence: bytes accumulate in a ref
buffer and a `requestAnimationFrame` loop reveals them at a steady typewriter
pace with a blinking cursor, so a bursty/uneven stream still reads smoothly.
Draft-fix shows an honest "analysing" panel (scanline sweep + cycling status
lines describing what `/api/draft-fix` is actually doing) while the real
request is in flight, then the diff flows in line by line. Apply cycles
staged labels ("Building overlay… / Re-running the rule… / Comparing
result…") while the real re-verify runs. All three decorate genuine async
calls — nothing is faked or delayed beyond real request time; keyframes live
in `app/globals.css` with a `prefers-reduced-motion` guard.

**Rate guard** (`lib/llm/rateLimit.ts`) — a simple in-memory per-IP limiter
(`Map<ip, timestamps[]>`, default 10 req/hr via `LLM_RATE_LIMIT_PER_HOUR`,
IP from `x-forwarded-for`) checked at the top of `/api/explain`,
`/api/draft-fix`, and `/api/apply` — returns `429` + a `retry-after` header
when exceeded. Exists because `ANTHROPIC_API_KEY` is set on the public Vercel
deployment; without this a stranger who finds the URL could run up the bill.

**GitHub fetch caching** (`lib/source/fetchSource.ts`) — `fetchFromGitHub`'s
branch/file lookups are cached at **module scope** (not per-`SourceFetcher`,
which only lives one request since `resolveSource` makes a fresh fetcher per
call), keyed by `owner/repo[:path]`, surviving across requests for the
process/serverless-instance lifetime. Protects the unauthenticated GitHub API
limit (60 req/hr/IP) against repeated audit runs — a live judge clicking
around, or several video-recording takes — without needing a `GITHUB_TOKEN`.
Failed fetches are evicted from the cache so a transient error can't poison it
permanently.

**Landing page** (`app/page.tsx`, `app/layout.tsx` metadata) — a real page at
`/`, not the create-next-app scaffold: the "proof, not opinion" pitch, the
architectural-principle callout, a 3-step Prove/Explain/Fix grid, target
cards + repo links, and CTAs into both `/audit` and `/product`.

**`/product`** (`app/product/`) — the exact same engine reframed from a
user's perspective ("audit *your* integration") rather than the demo's
"watch the mechanism" framing. Drives the existing, unmodified
`app/audit/useAuditRun.ts` hook and reuses `EvidencePanel` +
`FindingActions` verbatim inside its own shell — no parallel engine, no new
API routes.

- `EntryForm.tsx` — repo + live URL, with a one-click "Try a sample" that
  prefills `DEMO_TARGETS.vulnerable`.
- `findings.ts` — `toFindings(entries)` collapses the engine's 9 flat rows
  (6 rules + 3 attacks) into **6 findings, one per defect**, keyed by rule
  id; the 3 paired live attacks (`lib/pairing.ts`'s `ATTACK_TO_RULE`) become
  an "⚔ exploited live" signal on their shared defect rather than a separate
  row. `posture(findings, verified?)` derives a 0-100 risk score (100 minus a
  per-severity weight for each still-open finding), a `Low/Medium/High/
  Critical` level, and severity/exploited/passed/fixed counts.
  `severity.ts` is the static severity + business-impact map per rule id
  (critical/high/medium; not engine data, editorial).
- `StatRow.tsx` — 4 KPI cards (risk score + ring, open findings, exploited
  live, fixed & re-verified).
- `FindingRow.tsx` — one expandable table row per defect, worst-first;
  expands into `EvidencePanel` (both the rule's and, if paired, the attack's
  evidence) + `FindingActions` for remediation. A verified fix flips the row
  to a green "fixed" status without rewriting the underlying entries (mirrors
  the demo's append-only re-verify contract, just tracked as
  `ProductConsole`'s own `verified: Record<defectId, boolean>` state instead
  of a child log entry).
- **Auto-fix all** (`ProductConsole.tsx`'s `autoFixAll`) — sequentially loops
  draft-fix → apply → re-verify (the same two API calls `FindingActions`
  makes) across every open finding, so the posture score climbs and RISK
  drops live as each card flips green. Sequential, not concurrent, so
  progress is watchable and the rate guard isn't hammered all at once; a
  `429` stops the sweep with a banner rather than silently failing. Each fix
  is still verified by *its own* deterministic rule — this batches the
  existing guarantee, it does not merge multiple defects into one patched
  file (the 3 defects sharing `app/api/webhook/route.ts` are still 3
  independent draft+apply+re-verify cycles).

Visual design is intentionally its own system (near-black `#0a0a0b` ground,
`#151517` cards, a red-intensity severity ramp — critical/high/medium as one
danger hue at three intensities rather than red/orange/amber, so severity
never competes with the blue action accent) — distinct from `/audit`'s
amber/sky/red verdict-log theme (`app/audit/theme.ts`), which stays
unchanged and is not to be reused here.

## Setup
- `.env` needs `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` (Phase 1,
  shared with `../fixed` / `../vulnerable`, test-mode only) and
  `ANTHROPIC_API_KEY` (Phase 4 — without it, `/api/explain` and
  `/api/draft-fix` return a clean 502; everything else is unaffected).
  Optional `AUDITOR_REFERENCE_SOURCE` points Phase 4's reference corpus at a
  local checkout instead of `../fixed`'s GitHub repo. Optional
  `LLM_RATE_LIMIT_PER_HOUR` (Phase 5's rate guard — default 10 req/IP/hr;
  raise it while demoing/recording from one IP, e.g. `/product`'s Auto-fix
  all can burn ~12 requests in one sweep).
- `npm run audit` — Phase 1's CLI runner (`scripts/run-attacks.ts`).
- `npm run scan` — Phase 2's CLI runner (`scripts/scan.ts`).
- `npm run dev` — the full app, including Phases 3-5 (`/audit` and `/product`).

## Definition of done (Phase 1, historical)
Running the script against `vulnerable`'s deployed URL: all three attacks
report `succeeded: true`. Running the identical script against `fixed`'s
deployed URL: all three report `succeeded: false`. This exact contrast is the
core of the demo. Phases 2-5 preserve it: all six rules and three attacks
still split the same way across the two apps (and across both the `/audit`
and `/product` front ends, since Phase 5 reuses the same engine), and the
Apply flow never touches either app's real source.

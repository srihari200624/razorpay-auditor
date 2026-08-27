# auditor — AI Payment Integration Auditor project

## What this app is
This is the actual product. It finds and proves security defects in Razorpay
payment integrations. It is being built in phases — this file currently
covers Phase 1: the runtime attack runner. Later phases (rules engine, LLM
explanation layer, UI, Apply button) will extend this file.

## Sibling apps
- `../fixed` — a correct, working Razorpay integration. All attacks below
  must FAIL against it.
- `../vulnerable` — the same app with 6 deliberate defects. All three live
  attacks below must SUCCEED against it. See `../vulnerable/CLAUDE.md` for
  the exact defect definitions this runner is designed to exploit.

## Architectural principle — do not violate this
The LLM (used in a later phase) explains findings and drafts fixes. It NEVER
decides pass/fail. Verdicts come only from:
1. Deterministic static rules (later phase)
2. What actually happens when a real attack is fired at a real endpoint (this
   phase)

This module produces verdicts by executing real HTTP requests and reading
real responses — never by asking an LLM whether something looks vulnerable.

## Phase 1 scope: three attack functions

Build `lib/attacks/` containing three functions, each taking a target base
URL (e.g. `http://localhost:3000` or a deployed Vercel URL) and returning a
result. Model each exactly on the manual curl tests already verified by hand
against `vulnerable` (see BUILD-LOG.md and the verification tables from prior
sessions for exact request shapes).

### 1. `fakePaymentSuccess(targetUrl, orderId)`
POSTs `{ status: "success", orderId }` to `/api/verify-payment` with no
signature. Succeeded = order status became "paid" with no valid proof
supplied. Verify the actual DB/API state after, don't just trust a 200.

### 2. `webhookReplay(targetUrl, orderId)`
Generates ONE validly-signed `payment.captured` webhook payload (raw body +
correct HMAC using RAZORPAY_WEBHOOK_SECRET), POSTs it twice with the same
`x-razorpay-event-id`. Succeeded = creditedAmount increased on both
deliveries (doubled), rather than the second being ignored.

### 3. `forgedSignature(targetUrl, orderId)`
POSTs a webhook with a signature of the WRONG LENGTH (not just wrong content
— see vulnerable/CLAUDE.md defect 4, the current implementation only fails
open on a length mismatch, a same-length forgery is correctly rejected).
Succeeded = webhook accepted (200) and processed despite the invalid
signature.

## Return shape (all three functions)
```ts
{
  attackName: string,
  succeeded: boolean,       // true = attack achieved its goal (bad outcome)
  details: string,          // human-readable, what actually happened
  httpStatus: number,
  targetUrl: string,
}
```

## Setup each attack needs
Before firing any attack, create a fresh order on the target (via
`/api/create-order`) so each attack runs against clean, known state — don't
reuse orders across runs, and don't attack an order another attack already
touched.

## What NOT to build yet
- No UI. A small Node script that runs all three against a given URL and
  prints results is enough for this phase.
- No LLM calls.
- No static rules engine.
- No Apply/patch logic.

## Definition of done for this phase
Running the script against `vulnerable`'s deployed URL: all three attacks
report `succeeded: true`. Running the identical script against `fixed`'s
deployed URL: all three report `succeeded: false`. This exact contrast is
the core of the eventual demo — get it reliable before adding anything else.

Test against localhost first, then confirm against both deployed URLs before
calling this phase done — the deployed version is what the demo will
actually use.

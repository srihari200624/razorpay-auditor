# Auditor — AI Payment Integration Auditor

**Finds and _proves_ security defects in Razorpay payment integrations — by firing real attacks at real endpoints and running deterministic static rules over the source, then drafting a fix and re-verifying it. The AI never decides pass/fail.**

▶ **Live demo:** https://razorpay-auditor.vercel.app/audit
&nbsp;·&nbsp; Targets: [vulnerable](https://razorpay-auditor-vulnerable.vercel.app) · [fixed](https://razorpay-auditor-fixed.vercel.app)

<!-- TODO: drop a screenshot / GIF of the /audit red→blue re-verify flow here. -->

---

## The idea — proof, not opinion

Most "AI security" tools ask a language model whether code *looks* vulnerable and report its opinion. Auditor doesn't. It reaches a verdict two deterministic ways:

1. **Live attacks** — real HTTP requests fired at a running endpoint. A verdict of "vulnerable" means an attack *actually succeeded* (e.g. an order was marked paid with no valid proof).
2. **Static rules** — deterministic checks over the integration's source.

The LLM is used **only** to _explain_ a finding the engine already proved, and to _draft_ a fix — and every drafted fix is confirmed by **re-running the same real check**, never by the model's say-so. That principle is the whole point:

> **The AI never decides pass/fail.** Verdicts come only from what a real attack does against a real endpoint, and from deterministic rules. The AI explains and drafts; the machine decides.

## How the demo works

Open the [live audit](https://razorpay-auditor.vercel.app/audit), **Demo** tab: two panels, the same Razorpay integration deployed twice — one deliberately broken, one correct. Press **RUN**:

- Every finding lands in the evidence log — **red** = a live attack succeeded, **amber** = a static rule matched, **sky/blue** = verified secure.
- On any red/amber finding: **Explain** (streamed, advisory) → **Draft fix** (a real diff, grounded in the known-good reference) → **Apply**.
- Apply patches an **in-memory copy**, re-runs the real check, and the finding flips **red → blue**. The audited app is never written to.

```mermaid
flowchart LR
  A[RUN audit] --> B{Deterministic verdict}
  B -->|live attack succeeds| R[red: LIVE HIT]
  B -->|static rule matches| M[amber: FOUND]
  B -->|clean / blocked| S[sky: SECURE]
  R --> E[AI Explain - advisory]
  M --> E
  E --> D[AI Draft fix - full patched file]
  D --> P[Apply to in-memory overlay]
  P --> V[Re-run the SAME rule]
  V -->|now clean| S2[append sky: FIX RE-VERIFIED]
  V -->|still matches| X[no verdict change]
```

## The six defects & how each is proven

Three of the six are also provable by a **live attack** (the paired rule and the attack prove the same defect from opposite ends):

| Defect | Static rule | Live attack |
|---|---|---|
| Browser-trusted payment success (`status:"success"` bypass) | `browser-trusted-success` | `fakePaymentSuccess` |
| No webhook idempotency (replay doubles credited ₹) | `no-idempotency` | `webhookReplay` |
| Fail-open webhook signature check | `raw-body-violation` | `forgedSignature` |
| Razorpay key secret exposed to the client bundle | `secret-exposure` | — |
| Order-id trust / non-constant-time signature compare | `order-id-trust` | — |
| Event-order assumption (captured assumes authorized) | `event-order-assumption` | — |

## The three repos

```
razorpay-auditor            ← this repo: the tool + the /audit UI
razorpay-auditor-vulnerable ← target: the integration with 6 deliberate defects
razorpay-auditor-fixed      ← target: the correct reference (all attacks fail)
```

- Auditor — https://github.com/srihari200624/razorpay-auditor
- Vulnerable — https://github.com/srihari200624/razorpay-auditor-vulnerable
- Fixed — https://github.com/srihari200624/razorpay-auditor-fixed

The vulnerable and fixed apps are structurally identical; every difference between them is a defect, not stylistic drift. That's what lets Auditor demonstrate the exact split: **all attacks succeed against vulnerable, all fail against fixed.**

## Running locally

```bash
npm install
npm run dev        # the app, incl. the /audit console → http://localhost:3000
```

CLI runners (no UI):

```bash
npm run audit -- http://localhost:3000     # fire the 3 live attacks at a target
npm run scan  -- ../fixed                   # run the 6 static rules over a source
#   scan also takes a GitHub URL: npm run scan -- https://github.com/owner/repo
```

### Environment (`.env`, git-ignored)

| Var | Used by | Notes |
|---|---|---|
| `RAZORPAY_WEBHOOK_SECRET` | live attacks (`lib/attacks/`) | test-mode, shared with the target apps |
| `ANTHROPIC_API_KEY` | Explain / Draft-fix routes | without it those two routes return a clean 502; the rest works |
| `LLM_RATE_LIMIT_PER_HOUR` | LLM routes | optional; default 10 req/IP/hr, raise while demoing from one IP |
| `AUDITOR_REFERENCE_SOURCE` | Draft-fix grounding | optional; point the reference corpus at a local `../fixed` instead of GitHub |

## Coverage & honesty

Auditor is deliberately scoped to a **Razorpay Standard Checkout one-time-payment flow**, and the six static rules match specific, high-signal patterns at known route paths (e.g. a `status === "success"` bypass in `verify-payment`, a fail-open `catch` in the webhook handler). They are precise, not a general-purpose scanner — a rule reports a clean CLEAR when its pattern is absent, so it's honest on the fixed app too. The **live attacks** need no source at all; they work against any deployed URL that speaks the same endpoints, which is where the "proof, not opinion" claim is strongest. Extending to new integrations means adding a rule/attack pair per defect class — the engine (`SourceFetcher`, the paired rule/attack matrix, the in-memory overlay + re-verify) is built to take them. See [`ROADMAP.md`](./ROADMAP.md) for the planned sequence — deepening coverage of the existing six, broadening the rules beyond exact file paths, new defect types, and eventually a non-Razorpay integration.

## Tech

Next.js (App Router) · TypeScript · Anthropic API (`claude-opus-4-8` for fix drafting, `claude-sonnet-5` for explanations) · the target apps use Prisma + Postgres and the Razorpay Node SDK. Deployed on Vercel.

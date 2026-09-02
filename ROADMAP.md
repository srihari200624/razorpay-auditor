# Roadmap — expanding defect coverage

Auditor ships with 6 defects across 3 repos (`auditor`, `../vulnerable`,
`../fixed`) — see `CLAUDE.md` for what's built and `../vulnerable/CLAUDE.md`
for the exact defect definitions. This is the plan for growing past that,
sequenced by cost and leverage since each phase feeds the next.

**Recurring cost to know going in:** every *new* defect (not just deeper
coverage of an existing one) touches all **three repos** — a rule/attack in
`auditor`, the deliberate bug in `vulnerable`, the correct version in
`fixed` — each requiring the same manual "definition of done" verification
`vulnerable/CLAUDE.md` already mandates for the current 6. That cost repeats
per defect; it doesn't shrink with practice the way UI work does.

## Phase A — deepen existing coverage (cheapest, highest integrity, do first)

Three of the six defects are static-rule-only today, with no paired live
attack: `order-id-trust`, `secret-exposure`, `event-order-assumption`. Giving
the first two live attacks strengthens the "proof, not opinion" story without
touching `vulnerable`/`fixed` at all — the bugs already exist there; only
`auditor` gains new attack functions + pairing entries.

- **`order-id-trust` → a real, buildable live attack (flagship item).** The
  route trusts the client-supplied `razorpay_order_id` inside the HMAC input
  instead of the session's actual order. Since the payment-verification
  signature is `HMAC_SHA256(order_id|payment_id, RAZORPAY_KEY_SECRET)` — an
  HMAC our own attack script can compute directly with the shared test-mode
  secret already in `.env`, no real Razorpay checkout needed — the attack is:
  create order A and order B, sign a payment triple *for A*, submit it
  against *B*, and read back which order actually got marked paid. If B
  flips paid from a signature computed for A, the cross-order trust bug is
  proven live. New file: `lib/attacks/crossOrderSignature.ts`, same shape as
  the existing three, + a `lib/pairing.ts` entry.
- **`secret-exposure` → a live attack, optionally chained.** Fetch the
  deployed app's own served HTML/JS, regex out
  `NEXT_PUBLIC_RAZORPAY_KEY_SECRET`'s value, and (stretch) *use* the scraped
  secret to forge a valid signature the same way as the item above — "the
  demo scrapes your secret from the page and pays for free with it" is a
  strong narrative beat, not required for correctness.
- **`event-order-assumption` — leave static-only.** This defect is that a
  `captured` event *arriving before* `authorized` is wrongly rejected, which
  is a correctness/robustness bug (Razorpay doesn't guarantee delivery
  order), not something an attacker exploits. There's no adversarial "attack"
  to build here — it's correctly scoped as inspection-only; don't force a
  live attack that doesn't fit.

## Phase B — broaden applicability (serves the "scan any repo" claim)

The six rules are precise regex/AST-ish matches against **exact file paths**
(`app/api/verify-payment/route.ts`, etc.) — precise by design, but that also
means the README's "scan any real GitHub repo" claim is untested beyond the
two canned repos with byte-for-byte matching structure. To make that claim
actually hold on a real user's differently-laid-out integration:

- Loosen path-matching from exact filenames to convention-aware patterns
  (any file that looks like a payment-verification or webhook route, not
  only the one exact path) while keeping the underlying pattern-match
  precise.
- Make a rule's "not applicable here" distinguishable from "checked and
  clean" in the UI/API (today both surface as `found: false`) — false
  reassurance on an unrelated repo is worse than an honest "couldn't locate
  this route."
- This phase is also the natural precursor to Phase D: generalizing away
  from one hardcoded file layout is what makes a future "provider"
  abstraction (below) tractable, but doesn't require committing to that
  abstraction now.

## Phase C — more defect types (grow past 6, still Razorpay Standard Checkout)

Real, non-padding candidates, each costed at "touches all 3 repos + manual
verification":

- **IDOR on `/order/[id]`** — no ownership/session check, so any orderId
  leaks another customer's amount/status. Easiest of the candidates: no new
  flow, just a missing check + a live attack that creates two orders under
  different sessions and reads one back under the other.
- **Amount tampering** — verify-payment or the webhook trusting a client- or
  event-supplied amount instead of the amount the server stored at
  order-creation. Needs care to design as genuinely distinct from the
  existing signature-trust defects, not a restatement of them.
- **Refund abuse** — deferred; there's no refund flow in either sibling app
  today, so this would mean adding a whole new feature (not just a bug) to
  both `vulnerable` and `fixed` before a defect can even exist in it. Bigger
  lift than the other two; revisit only after IDOR/amount-tampering land.

Each addition follows the existing playbook exactly: new rule (`lib/rules/`)
+ optional attack (`lib/attacks/`) + pairing entry in `auditor`; the bug
implemented in `vulnerable` and the correct version in `fixed`, each per
their own `CLAUDE.md`-style spec and manually verified; `RULE_CATALOG` /
README / defect table updated in all three.

## Phase D — new integration surface (the big one, separate future effort)

Genuinely a parallel project, not an incremental add: a different Razorpay
product (Subscriptions, Route/marketplace) or a different gateway entirely
(Stripe, etc.) needs its own vulnerable/fixed pair and its own rule/attack
set. The current code assumes **one** fixed catalog
(`RULE_CATALOG` / `ATTACK_CATALOG` / `ATTACK_TO_RULE`) for **one**
integration — supporting more than one cleanly means introducing a
**provider / integration profile** concept (e.g.
`lib/providers/razorpay/{rules,attacks}` alongside a future
`lib/providers/stripe/{rules,attacks}`, with the catalogs and both `/audit`
and `/product` UIs parameterized by a selected provider instead of
hardcoded to Razorpay). Phase B's generalization work directly reduces the
cost of this later. Don't start Phase D until Phases A–C have shaken out
what actually generalizes vs. what's Razorpay-specific — designing the
abstraction too early risks guessing wrong and rebuilding it.

## Sequencing summary

A → B → C (cheapest candidate first: IDOR) → D (separate, later effort —
needs its own planning pass once B/C reveal what actually generalizes).

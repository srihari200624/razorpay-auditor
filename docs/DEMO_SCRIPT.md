# Auditor — 5-minute pitch video: script + shot list

Practical, click-by-click. Timings account for the **real** measured latencies:
Explain streams (text starts ~2-3s, done ~8s), **Draft-fix is a ~10s single
wait** (narrate over it), Apply's red→blue re-verify is **instant** (~0.06s —
that's your payoff beat). Total on-screen demo fits comfortably under the 5-min
pitch with room for framing.

---

## Pre-flight checklist (do BEFORE recording)
1. **Vercel `ANTHROPIC_API_KEY` is set** on the auditor project and it's
   redeployed — confirm `POST /api/explain` on the live URL does **not** 502.
   (Or record against `localhost:3000` with `.env` set — cleaner/faster, no
   cold serverless.)
2. **`LLM_RATE_LIMIT_PER_HOUR=100`** (Vercel env, or `.env` locally) so repeated
   takes from your one IP don't hit the 10/hr cap. Drop it back after.
3. **Warm the cache:** do one throwaway **RUN** on `/audit` before recording, so
   the GitHub rule fetches are cached and the real take's rules resolve fast.
4. **Tabs open, in order:** (1) auditor landing page `/`, (2) `/audit`,
   (3) the vulnerable live app (shows the ⚠️ banner + the ₹ doubling),
   optionally (4) the fixed live app.
5. Do one full dry-run of the click sequence below end-to-end so the ~10s
   draft wait doesn't surprise you on camera.

## Shot list
| # | On screen | Purpose |
|---|---|---|
| A | Landing page `/` | Hook + the principle, one glance |
| B | `/audit` Demo tab, both panels | The RUN → red-vs-blue split |
| C | One red finding → Explain / Draft / Apply | The hero loop + red→blue payoff |
| D | Vulnerable live app (webhook replay ₹ doubling) | Visual "money moved" punch (optional) |
| E | Back to landing / talking head | Close |

---

## The script (≈5:00)

### 0:00–0:40 — Hook + problem  *(Shot A: landing page)*
> "Payment integrations fail in subtle, expensive ways — a signature check that
> fails open, a webhook with no idempotency, a 'success' flag the server just
> trusts. And most AI security tools? They ask a language model whether the code
> *looks* vulnerable and hand you its opinion. An opinion isn't proof."

### 0:40–1:20 — Solution + the principle  *(Shot A: scroll the landing page)*
> "Auditor doesn't give opinions. It **proves** defects two deterministic ways:
> it fires **real attacks** at real endpoints, and runs **deterministic rules**
> over the source. The AI is used for exactly one thing — explaining a finding
> the engine already proved, and drafting a fix. **The AI never decides
> pass/fail.** Watch."

### 1:20–3:40 — Live demo  *(Shot B → C)*
1. **Open `/audit`, Demo tab. Click RUN on both panels.** *(rows populate over
   a few seconds — dynamic)*
   > "Same Razorpay integration, deployed twice — one deliberately broken, one
   > correct. On the left, **red** — those aren't warnings, those are live
   > attacks that **actually succeeded**. On the right, the fixed app: all blue.
   > Same attacks, blocked."
2. **Point to `browser-trusted-success` (red LIVE HIT).**
   > "This one: I sent a bare POST saying `status: success`, no signature — and
   > the order was marked **paid**. Free money."
3. **Click Explain.** *(text streams in live — start talking immediately)*
   > "The AI explains what the flaw is and the real payment-flow impact — but
   > notice this is *advisory*. The red verdict above it came from the attack,
   > not from the model."
4. **Click Draft fix.** *(~10s wait — fill it, don't go silent)*
   > "Now it drafts a fix — the complete patched file, grounded in a known-good
   > reference implementation, not invented from scratch. It's checked by a
   > guardrail before it's even offered…"  *(diff appears)*  "…and here's the
   > diff: it removed exactly the unsigned shortcut, nothing else."
5. **Click Apply.** *(instant red→blue)*
   > "And **this** is the point. Apply doesn't trust the AI's word. It patches an
   > **in-memory copy** — the real app is never touched — and **re-runs the same
   > check that proved the bug.** Red just went **blue: fix re-verified.** The
   > machine confirmed it, not the model."
6. *(Optional, Shot D)* **Vulnerable live app, trigger the webhook replay / show
   ₹500 → ₹1000.**
   > "And it's not theoretical — replay one webhook here and the credited amount
   > literally doubles on screen."

### 3:40–4:30 — Why it's different  *(Shot A or talking head)*
> "Three things make this hold up: the LLM never renders a verdict — real
> attacks and deterministic rules do. Every drafted fix is re-verified by
> re-running the real check. And the audited app is never modified — we patch an
> in-memory copy. It works on our vulnerable/fixed pair, and the source path is
> generic — it can scan a real GitHub repo, not just our canned target."

### 4:30–5:00 — Close
> "Auditor: it doesn't tell you your payment integration *might* be vulnerable.
> It **proves** it, **explains** it, **fixes** it, and **re-proves** the fix.
> Proof, not opinion. Thanks."

---

## Pacing / gotchas
- **The ~10s Draft-fix wait is the only slow beat** — the script fills it
  deliberately. Do not cut to silence; that's where it drags.
- **Apply is instant** — the red→blue flip is your money shot; land the line on it.
- **Explain streams** — start narrating the instant you click; don't wait for it
  to finish.
- If a route ever 502s mid-take: the Vercel key isn't set/propagated (redeploy
  after setting it), or you hit the rate cap (raise `LLM_RATE_LIMIT_PER_HOUR`).
- If rule rows are slow on the real take: you skipped the cache warm-up (step 3).
- Grab a clean screenshot of the red→blue evidence log during a take — it's the
  README's missing hero image.

import Link from "next/link";
import { DEMO_TARGETS } from "@/lib/config/demoTargets";

const AUDITOR_REPO = "https://github.com/srihari200624/razorpay-auditor";

function ghShort(url: string): string {
  return url.replace("https://github.com/", "");
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-900 text-zinc-100">
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-14 px-6 py-16 sm:py-24">
        {/* Hero */}
        <section className="flex flex-col gap-6">
          <p className="font-mono text-xs font-semibold tracking-[0.2em] text-zinc-500">
            RAZORPAY PAYMENT INTEGRATION AUDITOR
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-50 sm:text-6xl">
            Proof, not opinion.
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-zinc-400">
            Auditor finds and <span className="text-zinc-200">proves</span> security defects in Razorpay
            payment integrations — by firing real attacks at real endpoints and running deterministic
            static rules over the source. Then it drafts a fix and re-verifies it. No LLM guesswork.
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Link
              href="/audit"
              className="rounded-md bg-sky-500 px-5 py-2.5 font-sans text-sm font-semibold text-zinc-950 transition-colors hover:bg-sky-400"
            >
              Run the live audit →
            </Link>
            <a
              href={AUDITOR_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-white/15 px-5 py-2.5 font-sans text-sm font-semibold text-zinc-200 transition-colors hover:border-white/30"
            >
              View source
            </a>
          </div>
        </section>

        {/* The principle — the moat */}
        <section className="rounded-lg border border-white/10 bg-zinc-800/40 p-6">
          <p className="mb-2 font-mono text-[11px] font-semibold tracking-[0.2em] text-zinc-500">
            THE ARCHITECTURAL PRINCIPLE
          </p>
          <p className="text-lg leading-relaxed text-zinc-300">
            The AI <span className="font-semibold text-zinc-100">never decides pass/fail.</span> Every
            verdict comes only from what actually happens when a real attack hits a real endpoint, and
            from deterministic rules over the code. The AI is used only to{" "}
            <span className="text-zinc-100">explain</span> a proven finding and{" "}
            <span className="text-zinc-100">draft</span> a fix — and every drafted fix is confirmed by{" "}
            <span className="text-zinc-100">re-running the same real check</span>, never by the model&apos;s
            say-so.
          </p>
        </section>

        {/* How it works */}
        <section className="flex flex-col gap-5">
          <p className="font-mono text-[11px] font-semibold tracking-[0.2em] text-zinc-500">HOW IT WORKS</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Step
              n="1"
              accent="text-red-400"
              title="Prove"
              body="Three live attacks fire real HTTP requests; six static rules scan the source. A red LIVE HIT means an attack actually succeeded — money moved with no valid proof."
            />
            <Step
              n="2"
              accent="text-amber-400"
              title="Explain"
              body="For each proven finding, the AI explains what the flaw is, how the attack abuses it, and the real payment-flow impact — advisory only, layered on the deterministic verdict."
            />
            <Step
              n="3"
              accent="text-sky-400"
              title="Fix & re-verify"
              body="The AI drafts a patch grounded in a known-good reference. Apply it to an in-memory copy, re-run the real check, and watch the finding flip red → blue. The audited app is never touched."
            />
          </div>
        </section>

        {/* Targets + repos */}
        <section className="flex flex-col gap-5">
          <p className="font-mono text-[11px] font-semibold tracking-[0.2em] text-zinc-500">
            THE DEMO TARGETS
          </p>
          <p className="max-w-2xl text-sm leading-relaxed text-zinc-400">
            Two sibling apps: the same Razorpay integration, one deliberately broken with six defects
            and one done right. Every attack succeeds against the vulnerable app and fails against the
            fixed one — that contrast is the demo.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <TargetCard
              label="VULNERABLE"
              accent="text-amber-400"
              note="6 deliberate defects — attacks succeed"
              liveUrl={DEMO_TARGETS.vulnerable.liveUrl}
              repoUrl={DEMO_TARGETS.vulnerable.repoUrl}
            />
            <TargetCard
              label="FIXED"
              accent="text-sky-400"
              note="Correct reference — attacks fail"
              liveUrl={DEMO_TARGETS.fixed.liveUrl}
              repoUrl={DEMO_TARGETS.fixed.repoUrl}
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-6 py-6">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 font-mono text-xs text-zinc-500">
          <span className="tracking-wide text-zinc-600">REPOS</span>
          <a href={AUDITOR_REPO} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300">
            {ghShort(AUDITOR_REPO)}
          </a>
          <a href={DEMO_TARGETS.vulnerable.repoUrl} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300">
            {ghShort(DEMO_TARGETS.vulnerable.repoUrl)}
          </a>
          <a href={DEMO_TARGETS.fixed.repoUrl} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300">
            {ghShort(DEMO_TARGETS.fixed.repoUrl)}
          </a>
        </div>
      </footer>
    </div>
  );
}

function Step({ n, accent, title, body }: { n: string; accent: string; title: string; body: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-zinc-800/40 p-5">
      <div className="flex items-baseline gap-2">
        <span className={`font-mono text-sm font-bold ${accent}`}>{n}</span>
        <span className="font-sans text-base font-semibold text-zinc-100">{title}</span>
      </div>
      <p className="text-sm leading-relaxed text-zinc-400">{body}</p>
    </div>
  );
}

function TargetCard({
  label,
  accent,
  note,
  liveUrl,
  repoUrl,
}: {
  label: string;
  accent: string;
  note: string;
  liveUrl: string;
  repoUrl: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-zinc-800/40 p-5">
      <div>
        <p className={`font-sans text-sm font-bold tracking-wide ${accent}`}>{label}</p>
        <p className="mt-0.5 text-xs text-zinc-500">{note}</p>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
        <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-300 hover:text-zinc-100">
          live demo ↗
        </a>
        <a href={repoUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-zinc-300">
          {ghShort(repoUrl)}
        </a>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { DEMO_TARGETS } from "@/lib/config/demoTargets";

/**
 * The product's front door: point Auditor at YOUR integration. Repo drives the
 * static rules; live URL drives the real attacks. "Try a sample" prefills the
 * known vulnerable target so it's a one-click demo.
 */
export function EntryForm({ onRun }: { onRun: (repo: string, live: string) => void }) {
  const [repo, setRepo] = useState("");
  const [live, setLive] = useState("");

  const canRun = repo.trim().length > 0 && live.trim().length > 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-16">
      <p className="font-mono text-xs font-semibold tracking-[0.2em] text-zinc-500">
        NEW AUDIT
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
        Audit your Razorpay integration
      </h1>
      <p className="mt-3 text-base leading-relaxed text-zinc-400">
        Point Auditor at your integration. It runs six deterministic static rules over the
        source and fires three real attacks at the live endpoints — then ranks what it finds
        and helps you fix it. No LLM guesswork; every verdict is proven.
      </p>

      <form
        className="mt-8 flex flex-col gap-4 rounded-xl border border-white/10 bg-zinc-900/60 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (canRun) onRun(repo.trim(), live.trim());
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="font-sans text-[11px] font-semibold tracking-widest text-zinc-500">
            SOURCE REPOSITORY
          </span>
          <input
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="rounded-lg border border-white/15 bg-black/40 px-3.5 py-2.5 font-mono text-sm text-zinc-100 outline-none focus:border-sky-400/60"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-sans text-[11px] font-semibold tracking-widest text-zinc-500">
            LIVE / STAGING URL
          </span>
          <input
            value={live}
            onChange={(e) => setLive(e.target.value)}
            placeholder="https://my-checkout.example.com"
            className="rounded-lg border border-white/15 bg-black/40 px-3.5 py-2.5 font-mono text-sm text-zinc-100 outline-none focus:border-sky-400/60"
          />
        </label>

        <div className="mt-1 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!canRun}
            className="rounded-lg bg-sky-500 px-5 py-2.5 font-sans text-sm font-semibold text-zinc-950 transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Run audit
          </button>
          <button
            type="button"
            onClick={() => {
              setRepo(DEMO_TARGETS.vulnerable.repoUrl);
              setLive(DEMO_TARGETS.vulnerable.liveUrl);
            }}
            className="rounded-lg border border-white/15 px-4 py-2.5 font-sans text-sm font-semibold text-zinc-300 transition-colors hover:border-white/30"
          >
            Try a sample
          </button>
          <Link href="/audit" className="ml-auto font-mono text-xs text-zinc-500 hover:text-zinc-300">
            the side-by-side demo →
          </Link>
        </div>
      </form>
    </div>
  );
}

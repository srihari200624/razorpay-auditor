"use client";

import { useState } from "react";
import { DemoView } from "./DemoView";
import { ConsoleView } from "./ConsoleView";

const TABS = [
  { id: "demo", label: "DEMO" },
  { id: "console", label: "CONSOLE" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AuditConsole() {
  const [tab, setTab] = useState<TabId>("demo");

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-white/10 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-sans text-xl font-semibold tracking-wide text-zinc-100">
              AUDITOR <span className="text-zinc-500">— evidence log</span>
            </h1>
            <p className="mt-1 font-mono text-xs text-zinc-500">
              Verdicts from real attacks + deterministic rules — the AI only explains, it never decides.
            </p>
          </div>
          <Legend />
        </div>
        <nav className="mt-3 flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded px-3 py-1.5 font-sans text-xs font-semibold tracking-widest transition-colors ${
                tab === t.id ? "bg-white/10 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      {tab === "demo" ? <DemoView /> : <ConsoleView />}
    </div>
  );
}

function Legend() {
  const items = [
    { color: "bg-amber-400", label: "static finding" },
    { color: "bg-sky-400", label: "verified secure" },
    { color: "bg-red-500", label: "live hit" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-zinc-500">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className={`inline-block h-2 w-2 rounded-full ${i.color}`} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

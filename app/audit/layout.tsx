import type { ReactNode } from "react";
import type { CSSProperties } from "react";
import { JetBrains_Mono, Inter } from "next/font/google";

const auditMono = JetBrains_Mono({
  variable: "--font-audit-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const auditSans = Inter({
  variable: "--font-audit-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Scoped to this subtree only: remap the app-wide font-mono/font-sans
// Tailwind tokens to this page's fonts, so app/page.tsx (Geist) is untouched.
const fontOverride: CSSProperties = {
  ["--font-mono" as string]: "var(--font-audit-mono)",
  ["--font-sans" as string]: "var(--font-audit-sans)",
};

export default function AuditLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${auditMono.variable} ${auditSans.variable} flex min-h-screen flex-col bg-zinc-900 text-zinc-100`}
      style={fontOverride}
    >
      {children}
    </div>
  );
}

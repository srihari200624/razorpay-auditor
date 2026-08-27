import type { Metadata } from "next";
import { AuditConsole } from "./AuditConsole";

export const metadata: Metadata = {
  title: "Auditor — Evidence Log",
};

export default function AuditPage() {
  return <AuditConsole />;
}

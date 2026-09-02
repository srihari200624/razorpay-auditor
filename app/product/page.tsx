import type { Metadata } from "next";
import { ProductConsole } from "./ProductConsole";

export const metadata: Metadata = {
  title: "Auditor — audit your Razorpay integration",
  description:
    "Point Auditor at your Razorpay integration for a security posture: severity-ranked, proven findings with an inline fix-and-re-verify flow.",
};

export default function ProductPage() {
  return <ProductConsole />;
}

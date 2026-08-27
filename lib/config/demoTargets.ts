/**
 * Pre-wired targets for the Demo tab. `liveUrl` points at the deployed Vercel
 * apps — this is what the projector demo runs against. For local iteration,
 * run the sibling apps and temporarily swap these:
 *   (cd ../vulnerable && npm run dev -- -p 3001)
 *   (cd ../fixed      && npm run dev -- -p 3002)
 */
export const DEMO_TARGETS = {
  vulnerable: {
    label: "VULNERABLE",
    repoUrl: "https://github.com/srihari200624/razorpay-auditor-vulnerable",
    liveUrl: "https://razorpay-auditor-vulnerable.vercel.app",
  },
  fixed: {
    label: "FIXED",
    repoUrl: "https://github.com/srihari200624/razorpay-auditor-fixed",
    liveUrl: "https://razorpay-auditor-fixed.vercel.app",
  },
} as const;

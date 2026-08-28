import { anthropic, MODEL_EXPLAIN } from "./client.ts";

export interface ExplainInput {
  kind: "rule" | "attack";
  label: string;
  filePath: string | null;
  deterministicSummary: string;
}

const SYSTEM_ROLE =
  "You are the explanation stage of a Razorpay payment-integration security " +
  "auditor. A deterministic engine has ALREADY decided this is a real, proven " +
  "defect — you never decide pass/fail and never hedge about whether it is " +
  "vulnerable. Explain to a developer, in 2-4 short paragraphs: what the flaw " +
  "is, how the proven attack or static match abuses it, and the concrete " +
  "real-world impact on a payment flow (money moved, fraud, chargebacks). Be " +
  "precise and plain. No preamble, no markdown headings.";

/**
 * Streams a plain-text explanation for one already-proven finding. The model
 * is advisory only — it explains a verdict the engine already reached.
 * `anthropic()` throws synchronously if no credentials are configured, so the
 * route can catch it and return a 502.
 */
export function explainStream(input: ExplainInput): ReadableStream<Uint8Array> {
  const client = anthropic();
  const encoder = new TextEncoder();

  const userText =
    `Finding (${input.kind === "attack" ? "live attack" : "static rule"}): ${input.label}\n` +
    (input.filePath ? `File: ${input.filePath}\n` : "") +
    `\nWhat the deterministic engine observed / proved:\n${input.deterministicSummary}`;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const stream = client.messages.stream({
        model: MODEL_EXPLAIN,
        max_tokens: 2048,
        output_config: { effort: "low" },
        system: SYSTEM_ROLE,
        messages: [{ role: "user", content: userText }],
      });
      stream.on("text", (delta) => controller.enqueue(encoder.encode(delta)));
      return stream
        .finalMessage()
        .then(() => controller.close())
        .catch((err) => controller.error(err));
    },
  });
}

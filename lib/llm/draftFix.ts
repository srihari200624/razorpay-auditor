import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { RuleResult } from "../rules/types.ts";
import { anthropic, MODEL_FIX } from "./client.ts";
import { fetchReferenceFile } from "./referenceCorpus.ts";

const FixSchema = z.object({
  patchedFile: z
    .string()
    .describe(
      "The COMPLETE corrected contents of the file, first line to last. " +
        "Byte-identical to the original except the minimal change that closes " +
        "this one defect. No markdown fences, no commentary.",
    ),
  rationale: z
    .string()
    .describe("One to three sentences: what changed and why it closes the defect."),
});

export interface DraftFixInput {
  filePath: string;
  vulnerableFile: string;
  finding: RuleResult;
}

export interface DraftFixOutput {
  patchedFile: string;
  rationale: string;
}

const SYSTEM_ROLE =
  "You are the fix-drafting stage of a Razorpay payment-integration security " +
  "auditor. A deterministic engine has already PROVEN the defect the user " +
  "describes — you never decide whether code is vulnerable, you only draft a " +
  "code fix. You are given a known-good reference implementation of the same " +
  "file from a correct integration; adapt its approach to close the ONE defect " +
  "described and change nothing else. Preserve all other behaviour, imports, " +
  "formatting, and any other quirks of the vulnerable file — even ones that " +
  "look wrong — because other, separate defects are tracked independently. " +
  "Return the entire file.";

export async function draftFix(input: DraftFixInput): Promise<DraftFixOutput> {
  const reference = await fetchReferenceFile(input.filePath);

  const referenceBlock = reference
    ? `Known-good reference for ${input.filePath} (a correct implementation to adapt from):\n\n${reference}`
    : `No known-good reference is available for ${input.filePath}; reason from secure Razorpay integration practices.`;

  const response = await anthropic().messages.parse({
    model: MODEL_FIX,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: zodOutputFormat(FixSchema),
    },
    system: [
      { type: "text", text: SYSTEM_ROLE },
      // Stable prefix — cache the reference corpus so repeated drafts of the
      // same file reuse it.
      { type: "text", text: referenceBlock, cache_control: { type: "ephemeral" } },
    ],
    messages: [
      {
        role: "user",
        content:
          `Proven defect: ${input.finding.defectName}\n` +
          `${input.finding.explanation}\n\n` +
          `File to fix — ${input.filePath} (current vulnerable contents):\n\n${input.vulnerableFile}`,
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error("draft-fix: the model did not return a valid structured fix.");
  }
  return parsed;
}

import type { SourceFetcher } from "../source/fetchSource.ts";

export interface RuleResult {
  defectId: string;
  defectName: string;
  found: boolean;
  filePath: string;
  lineNumber: number | null;
  matchedCode: string | null;
  explanation: string;
}

export type Rule = (source: SourceFetcher) => Promise<RuleResult>;

export type { SourceFetcher };

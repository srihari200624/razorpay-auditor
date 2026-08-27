import { resolveSource } from "../lib/source/resolveSource.ts";
import { runAllRules, type RuleResult } from "../lib/rules/index.ts";

async function main() {
  const target = process.argv[2];
  if (!target) {
    console.error("Usage: npm run scan -- <github-repo-url-or-local-path>");
    process.exit(1);
  }

  const source = resolveSource(target);

  console.log(`\nScanning ${source.label}\n`);

  const results = await runAllRules(source);
  printTable(results);

  const foundCount = results.filter((r) => r.found).length;
  console.log(`\n${foundCount}/${results.length} defects found in ${source.label}\n`);
}

function printTable(results: RuleResult[]) {
  const rows = results.map((r) => ({
    Defect: r.defectName,
    Found: r.found ? "YES" : "no",
    Location: r.lineNumber ? `${r.filePath}:${r.lineNumber}` : r.filePath,
    Explanation: r.explanation,
  }));

  const cols = ["Defect", "Found", "Location", "Explanation"] as const;
  const widths = cols.map((c) => Math.max(c.length, ...rows.map((r) => r[c].length)));

  const printRow = (values: string[]) =>
    console.log(values.map((v, i) => v.padEnd(widths[i])).join("  |  "));

  printRow(cols as unknown as string[]);
  printRow(widths.map((w) => "-".repeat(w)));
  for (const row of rows) {
    printRow(cols.map((c) => row[c]));
  }
}

main().catch((err) => {
  console.error("Scan failed:", err);
  process.exit(1);
});

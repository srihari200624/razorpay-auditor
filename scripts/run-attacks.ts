import {
  createOrder,
  fakePaymentSuccess,
  forgedSignature,
  webhookReplay,
  type AttackResult,
} from "../lib/attacks/index.ts";

async function main() {
  const targetUrl = process.argv[2]?.replace(/\/$/, "");
  if (!targetUrl) {
    console.error("Usage: node --env-file=.env scripts/run-attacks.ts <targetUrl>");
    process.exit(1);
  }

  console.log(`\nRunning attacks against ${targetUrl}\n`);

  const results: AttackResult[] = [];

  // Each attack runs against its own freshly created order — never reuse
  // one order across attacks, and never reuse state another attack touched.
  const order1 = await createOrder(targetUrl);
  results.push(await fakePaymentSuccess(targetUrl, order1.orderId));

  const order2 = await createOrder(targetUrl);
  results.push(await webhookReplay(targetUrl, order2.orderId, order2.amountPaise));

  const order3 = await createOrder(targetUrl);
  results.push(await forgedSignature(targetUrl, order3.orderId, order3.amountPaise));

  printTable(targetUrl, results);

  const succeededCount = results.filter((r) => r.succeeded).length;
  console.log(`\n${succeededCount}/${results.length} attacks succeeded against ${targetUrl}\n`);
}

function printTable(targetUrl: string, results: AttackResult[]) {
  const rows = results.map((r) => ({
    Attack: r.attackName,
    Succeeded: r.succeeded ? "YES" : "no",
    HTTP: String(r.httpStatus),
    Details: r.details,
  }));

  const cols = ["Attack", "Succeeded", "HTTP", "Details"] as const;
  const widths = cols.map((c) =>
    Math.max(c.length, ...rows.map((r) => r[c].length)),
  );

  const printRow = (values: string[]) =>
    console.log(values.map((v, i) => v.padEnd(widths[i])).join("  |  "));

  printRow(cols as unknown as string[]);
  printRow(widths.map((w) => "-".repeat(w)));
  for (const row of rows) {
    printRow(cols.map((c) => row[c]));
  }
}

main().catch((err) => {
  console.error("Attack run failed:", err);
  process.exit(1);
});

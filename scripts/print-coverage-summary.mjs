import { appendFileSync, existsSync, readFileSync } from "node:fs";

const summaryPath = "coverage/coverage-summary.json";

if (!existsSync(summaryPath)) {
  console.error(`Missing ${summaryPath}. Run npm run test:cov first.`);
  process.exit(1);
}

const { total } = JSON.parse(readFileSync(summaryPath, "utf8"));
const metrics = ["lines", "statements", "functions", "branches"];

const rows = metrics.map((key) => {
  const row = total[key];
  return `| ${key} | **${row.pct}%** | ${row.covered} | ${row.total} |`;
});

const markdown = [
  "## Unit test coverage (Jest)",
  "",
  "Scope: unit + controller + e2e-lite (`npm run test:cov`). Integration tests are not included.",
  "",
  "| Metric | % | Covered | Total |",
  "|--------|---|---------|-------|",
  ...rows,
  "",
].join("\n");

console.log(markdown);

const stepSummary = process.env.GITHUB_STEP_SUMMARY;
if (stepSummary) {
  appendFileSync(stepSummary, `${markdown}\n`);
}

import pc from "picocolors";
import type { SuiteResult, TestResult } from "../types.js";

export type ReporterFormat = "pretty" | "json";

/** Print a per-test line as it completes (pretty mode only). */
export function reportTestLine(result: TestResult): void {
  const time = pc.dim(`(${result.durationMs}ms)`);
  switch (result.status) {
    case "passed":
      console.log(`  ${pc.green("✓")} ${result.name} ${time}`);
      break;
    case "failed":
      console.log(`  ${pc.red("✗")} ${result.name} ${time}`);
      printFailedAssertions(result);
      break;
    case "errored":
      console.log(`  ${pc.red("⚠")} ${result.name} ${time}`);
      if (result.error) console.log(`      ${pc.red(result.error)}`);
      break;
    case "skipped":
      console.log(`  ${pc.yellow("○")} ${pc.dim(result.name + " (skipped)")}`);
      break;
  }
}

function printFailedAssertions(result: TestResult): void {
  for (const a of result.assertions) {
    if (a.ok) continue;
    console.log(`      ${pc.red(a.path)}: ${a.message}`);
    if (a.expected !== undefined) {
      console.log(`        expected: ${pc.green(format(a.expected))}`);
    }
    if (a.actual !== undefined) {
      console.log(`        actual:   ${pc.red(format(a.actual))}`);
    }
  }
}

/** Print the suite header (pretty mode). */
export function reportSuiteHeader(suite: SuiteResult): void {
  console.log("");
  console.log(pc.bold(pc.cyan(`● ${suite.name}`)) + pc.dim(pathSuffix(suite)));
}

/** Print the final summary across all suites and return the overall exit code. */
export function reportSummary(suites: SuiteResult[]): number {
  const totals = suites.reduce(
    (acc, s) => {
      acc.passed += s.passed;
      acc.failed += s.failed;
      acc.skipped += s.skipped;
      acc.errored += s.errored;
      acc.durationMs += s.durationMs;
      return acc;
    },
    { passed: 0, failed: 0, skipped: 0, errored: 0, durationMs: 0 }
  );

  const total = totals.passed + totals.failed + totals.errored + totals.skipped;
  const parts: string[] = [];
  if (totals.passed) parts.push(pc.green(`${totals.passed} passed`));
  if (totals.failed) parts.push(pc.red(`${totals.failed} failed`));
  if (totals.errored) parts.push(pc.red(`${totals.errored} errored`));
  if (totals.skipped) parts.push(pc.yellow(`${totals.skipped} skipped`));

  console.log("");
  console.log(pc.bold("Summary: ") + parts.join(pc.dim(", ")));
  console.log(
    pc.dim(`${total} tests across ${suites.length} suite(s) in ${totals.durationMs}ms`)
  );
  console.log("");

  return totals.failed + totals.errored > 0 ? 1 : 0;
}

/** Emit machine-readable JSON for CI consumers. */
export function reportJson(suites: SuiteResult[]): number {
  const failed = suites.reduce((a, s) => a + s.failed + s.errored, 0);
  console.log(JSON.stringify({ suites, exitCode: failed > 0 ? 1 : 0 }, null, 2));
  return failed > 0 ? 1 : 0;
}

function pathSuffix(suite: SuiteResult): string {
  return suite.filePath ? `  ${suite.filePath}` : "";
}

function format(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

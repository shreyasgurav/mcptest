/**
 * HTML report generator for mcpunit.
 *
 * Generates a self-contained HTML file with inline CSS — no external
 * dependencies. Dark theme, collapsible test details, timing info.
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SuiteResult, TestResult } from "../types.js";

/**
 * Generate a complete standalone HTML report string.
 */
export function generateHtmlReport(suites: SuiteResult[]): string {
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

  const total =
    totals.passed + totals.failed + totals.errored + totals.skipped;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>mcpunit Report</title>
<style>
  :root {
    --bg: #0f0f17;
    --surface: #1a1a2e;
    --surface-hover: #22223a;
    --border: #2a2a44;
    --text: #e0e0f0;
    --text-dim: #8888aa;
    --green: #4ade80;
    --red: #f87171;
    --yellow: #facc15;
    --cyan: #22d3ee;
    --purple: #a78bfa;
    --font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: var(--font);
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
    padding: 2rem;
    max-width: 960px;
    margin: 0 auto;
  }
  h1 {
    font-size: 1.8rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
    background: linear-gradient(135deg, var(--cyan), var(--purple));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .meta {
    color: var(--text-dim);
    font-size: 0.85rem;
    margin-bottom: 2rem;
  }
  .summary {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
    flex-wrap: wrap;
  }
  .stat {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1rem 1.5rem;
    min-width: 120px;
    text-align: center;
  }
  .stat-value {
    font-size: 2rem;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 0.25rem;
  }
  .stat-label {
    font-size: 0.75rem;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .stat-passed .stat-value { color: var(--green); }
  .stat-failed .stat-value { color: var(--red); }
  .stat-skipped .stat-value { color: var(--yellow); }
  .stat-total .stat-value { color: var(--cyan); }
  .stat-time .stat-value { color: var(--purple); font-size: 1.4rem; }

  .suite {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    margin-bottom: 1.5rem;
    overflow: hidden;
  }
  .suite-header {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .suite-name {
    font-weight: 600;
    font-size: 1.1rem;
    color: var(--cyan);
  }
  .suite-stats {
    font-size: 0.8rem;
    color: var(--text-dim);
  }

  .test {
    border-bottom: 1px solid var(--border);
    transition: background 0.15s;
  }
  .test:last-child { border-bottom: none; }
  .test:hover { background: var(--surface-hover); }
  .test-row {
    padding: 0.75rem 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    user-select: none;
  }
  .test-icon { font-size: 1rem; flex-shrink: 0; }
  .test-name { flex: 1; font-size: 0.9rem; }
  .test-time {
    font-size: 0.75rem;
    color: var(--text-dim);
    font-family: var(--mono);
  }

  .test-details {
    display: none;
    padding: 0.5rem 1.5rem 1rem 3rem;
    font-family: var(--mono);
    font-size: 0.8rem;
    line-height: 1.8;
    color: var(--text-dim);
  }
  .test-details.open { display: block; }

  .assertion {
    padding: 0.25rem 0;
  }
  .assertion-fail {
    color: var(--red);
  }
  .assertion-pass {
    color: var(--green);
  }
  .expected, .actual {
    padding-left: 1rem;
    font-size: 0.75rem;
  }
  .expected { color: var(--green); }
  .actual { color: var(--red); }

  .raw-response {
    margin-top: 0.5rem;
    padding: 0.75rem;
    background: #12121f;
    border-radius: 8px;
    font-size: 0.75rem;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 200px;
    overflow-y: auto;
    color: var(--text-dim);
  }

  .badge {
    display: inline-block;
    padding: 0.15rem 0.5rem;
    border-radius: 6px;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
  }
  .badge-pass { background: rgba(74,222,128,0.15); color: var(--green); }
  .badge-fail { background: rgba(248,113,113,0.15); color: var(--red); }

  footer {
    text-align: center;
    color: var(--text-dim);
    font-size: 0.75rem;
    margin-top: 3rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border);
  }
  footer a { color: var(--cyan); text-decoration: none; }
</style>
</head>
<body>
<h1>mcpunit Report</h1>
<p class="meta">Generated ${new Date().toLocaleString()} · ${total} tests across ${suites.length} suite(s)</p>

<div class="summary">
  <div class="stat stat-total"><div class="stat-value">${total}</div><div class="stat-label">Total</div></div>
  <div class="stat stat-passed"><div class="stat-value">${totals.passed}</div><div class="stat-label">Passed</div></div>
  <div class="stat stat-failed"><div class="stat-value">${totals.failed + totals.errored}</div><div class="stat-label">Failed</div></div>
  <div class="stat stat-skipped"><div class="stat-value">${totals.skipped}</div><div class="stat-label">Skipped</div></div>
  <div class="stat stat-time"><div class="stat-value">${(totals.durationMs / 1000).toFixed(2)}s</div><div class="stat-label">Duration</div></div>
</div>

${suites.map((suite) => renderSuite(suite)).join("\n")}

<footer>
  Generated by <a href="https://github.com/shreyasgurav/mcpunit">mcpunit</a>
</footer>

<script>
document.querySelectorAll('.test-row').forEach(row => {
  row.addEventListener('click', () => {
    const details = row.nextElementSibling;
    if (details) details.classList.toggle('open');
  });
});
</script>
</body>
</html>`;
}

function renderSuite(suite: SuiteResult): string {
  const badge = suite.failed + suite.errored > 0
    ? `<span class="badge badge-fail">${suite.failed + suite.errored} failed</span>`
    : `<span class="badge badge-pass">all passed</span>`;

  return `<div class="suite">
  <div class="suite-header">
    <span class="suite-name">● ${esc(suite.name)}</span>
    <span class="suite-stats">${badge} · ${suite.durationMs}ms</span>
  </div>
  ${suite.results.map((r) => renderTest(r)).join("\n")}
</div>`;
}

function renderTest(result: TestResult): string {
  const icon = {
    passed: "✓",
    failed: "✗",
    errored: "⚠",
    skipped: "○",
  }[result.status];

  const iconColor = {
    passed: "var(--green)",
    failed: "var(--red)",
    errored: "var(--red)",
    skipped: "var(--yellow)",
  }[result.status];

  const hasDetails =
    result.assertions.length > 0 || result.error || result.rawResponse;

  let detailsHtml = "";
  if (hasDetails) {
    const assertionLines = result.assertions
      .map((a) => {
        if (a.ok) {
          return `<div class="assertion assertion-pass">✓ ${esc(a.path)}: ${esc(a.message)}</div>`;
        }
        let line = `<div class="assertion assertion-fail">✗ ${esc(a.path)}: ${esc(a.message)}</div>`;
        if (a.expected !== undefined) {
          line += `<div class="expected">expected: ${esc(fmt(a.expected))}</div>`;
        }
        if (a.actual !== undefined) {
          line += `<div class="actual">actual: ${esc(fmt(a.actual))}</div>`;
        }
        return line;
      })
      .join("\n");

    const errorLine = result.error
      ? `<div class="assertion assertion-fail">Error: ${esc(result.error)}</div>`
      : "";

    const rawLine = result.rawResponse
      ? `<div class="raw-response"><strong>Server response:</strong>\n${esc(result.rawResponse.text)}</div>`
      : "";

    detailsHtml = `<div class="test-details">${assertionLines}${errorLine}${rawLine}</div>`;
  }

  return `<div class="test">
  <div class="test-row">
    <span class="test-icon" style="color:${iconColor}">${icon}</span>
    <span class="test-name">${esc(result.name)}</span>
    <span class="test-time">${result.durationMs}ms</span>
  </div>
  ${detailsHtml}
</div>`;
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmt(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Write an HTML report to disk.
 */
export function writeHtmlReport(
  suites: SuiteResult[],
  outputPath: string
): string {
  const html = generateHtmlReport(suites);
  const abs = resolve(outputPath);
  writeFileSync(abs, html, "utf8");
  return abs;
}

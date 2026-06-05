import { mkdirSync, appendFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import pc from "picocolors";
import { runSuite } from "./runner.js";
import type { TestSuite, MonitorOptions, MonitorRun } from "../types.js";
import { startDashboard } from "./dashboard.js";

function getHistoryPath(_suiteFile?: string): string {
  return resolve(".mcpunit", "monitor", "history.jsonl");
}

export function parseInterval(interval: string): number {
  if (!interval) return 15 * 60 * 1000;
  const match = interval.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (match) {
    const h = parseInt(match[1] || "0", 10);
    const m = parseInt(match[2] || "0", 10);
    const s = parseInt(match[3] || "0", 10);
    if (h === 0 && m === 0 && s === 0) {
      const num = parseInt(interval, 10);
      if (!isNaN(num)) return num * 1000;
      return 15 * 60 * 1000;
    }
    return (h * 3600 + m * 60 + s) * 1000;
  }
  
  const num = parseInt(interval, 10);
  if (!isNaN(num)) return num * 1000;
  
  return 15 * 60 * 1000;
}

export function loadHistory(suiteFile?: string): MonitorRun[] {
  const file = getHistoryPath(suiteFile);
  if (!existsSync(file)) return [];
  const lines = readFileSync(file, "utf8").split("\n").filter((l) => l.trim().length > 0);
  return lines.map((l) => JSON.parse(l));
}

export function saveRunToHistory(suiteFile: string | undefined, run: MonitorRun): void {
  const file = getHistoryPath(suiteFile);
  const dir = dirname(file);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  appendFileSync(file, JSON.stringify(run) + "\n", "utf8");
}

export function calculateUptime(history: MonitorRun[], windowMs?: number): number {
  if (history.length === 0) return 100;
  
  let validHistory = history;
  if (windowMs) {
    const cutoff = Date.now() - windowMs;
    validHistory = history.filter(r => new Date(r.timestamp).getTime() >= cutoff);
  }
  
  if (validHistory.length === 0) return 100;
  
  const passed = validHistory.filter(r => r.failed === 0 && r.errored === 0).length;
  return (passed / validHistory.length) * 100;
}

export async function sendSlackAlert(webhookUrl: string, run: MonitorRun, suite: TestSuite): Promise<void> {
  const failedTests = run.results.filter(r => r.status === "failed" || r.status === "errored");
  const fields = failedTests.slice(0, 5).map(r => ({
    title: r.name,
    value: r.error || r.assertions.find(a => !a.ok)?.message || "Failed",
    short: false
  }));

  const payload = {
    text: `🔴 mcpunit alert: ${suite.name || "MCP Server"}`,
    attachments: [{
      color: "danger",
      fields: [
        ...fields,
        { title: "Run #", value: run.run.toString(), short: true },
        { title: "Time", value: run.timestamp, short: true }
      ]
    }]
  };

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error(pc.red(`  Failed to send Slack alert: ${(err as Error).message}`));
  }
}

export async function sendWebhookAlert(url: string, run: MonitorRun, suite: TestSuite): Promise<void> {
  const failedTests = run.results.filter(r => r.status === "failed" || r.status === "errored");
  const errors: Record<string, string> = {};
  for (const f of failedTests) {
    errors[f.name] = f.error || f.assertions.find(a => !a.ok)?.message || "Failed";
  }

  const payload = {
    event: "test_failed",
    suite: suite.name || "MCP Server Test Suite",
    run: run.run,
    timestamp: run.timestamp,
    failed: failedTests.map(r => r.name),
    errors,
    summary: { passed: run.passed, failed: run.failed, errored: run.errored, total: run.results.length }
  };

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error(pc.red(`  Failed to send Webhook alert: ${(err as Error).message}`));
  }
}

export async function sendSlackRecovery(webhookUrl: string, run: MonitorRun, suite: TestSuite, downtimeMs: number): Promise<void> {
  const mins = Math.floor(downtimeMs / 60000);
  const payload = {
    text: `🟢 mcpunit recovery: ${suite.name || "MCP Server"}`,
    attachments: [{
      color: "good",
      fields: [
        { title: "Status", value: "All tests passing again", short: true },
        { title: "Downtime", value: `${mins}m ${Math.floor((downtimeMs % 60000) / 1000)}s`, short: true },
        { title: "Run #", value: run.run.toString(), short: true }
      ]
    }]
  };

  try {
    await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  } catch (err) {
    console.error(pc.red(`  Failed to send Slack recovery alert: ${(err as Error).message}`));
  }
}

export async function sendWebhookRecovery(url: string, run: MonitorRun, suite: TestSuite, downtimeMs: number): Promise<void> {
  const payload = {
    event: "recovered",
    suite: suite.name || "MCP Server Test Suite",
    run: run.run,
    timestamp: run.timestamp,
    downtimeMs
  };

  try {
    await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  } catch (err) {
    console.error(pc.red(`  Failed to send Webhook recovery alert: ${(err as Error).message}`));
  }
}

export async function startMonitor(suite: TestSuite, options: MonitorOptions) {
  let runCount = loadHistory(suite.filePath).length;
  let lastFailed = false;
  let failedSince: Date | null = null;

  console.log("");
  console.log(pc.bold(pc.magenta("  mcpunit monitor")));
  console.log(pc.dim("  ─────────────────────────────────"));
  console.log(pc.dim(`  Suite:    `) + (suite.name || "MCP Server"));
  const intervalStr = (options.intervalMs / 1000) >= 60 ? `${Math.floor(options.intervalMs / 60000)}m` : `${options.intervalMs / 1000}s`;
  console.log(pc.dim(`  Interval: `) + `every ${intervalStr}`);
  console.log(pc.dim(`  Started:  `) + new Date().toISOString().replace("T", " ").substring(0, 19));
  console.log("");

  if (options.dashboard) {
    const port = options.port ?? 3847;
    await startDashboard({ port, suiteFile: suite.filePath });
    console.log(pc.dim(`  Dashboard: http://localhost:${port}`));
    console.log("");
  }

  const runOnce = async () => {
    runCount++;
    const start = Date.now();
    // Run quietly
    const result = await runSuite(suite, { bail: false });
    const run: MonitorRun = {
      run: runCount,
      timestamp: new Date().toISOString(),
      passed: result.passed,
      failed: result.failed,
      errored: result.errored,
      durationMs: Date.now() - start,
      results: result.results,
      alerted: false
    };

    saveRunToHistory(suite.filePath, run);

    const hasFailed = run.failed > 0 || run.errored > 0;
    const timeStr = run.timestamp.substring(11, 19);
    
    if (hasFailed) {
      console.log(`  [${timeStr}] Run #${runCount.toString().padEnd(3)} ${pc.red("✗")} ${run.passed}/${run.results.length} passed  (${(run.durationMs/1000).toFixed(1)}s)`);
      
      const firstFailure = run.results.find(r => r.status === "failed" || r.status === "errored");
      if (firstFailure) {
        const msg = firstFailure.error || firstFailure.assertions.find(a => !a.ok)?.message || "Failed";
        console.log(`             └─ ${pc.cyan(firstFailure.name)}: ${pc.red(msg)}`);
      }

      if (!lastFailed) {
        failedSince = new Date();
        run.alerted = true;
        console.log(`             ${pc.bgRed(pc.white(" ALERT SENT "))}`);
        if (options.alertSlack) await sendSlackAlert(options.alertSlack, run, suite);
        if (options.alertWebhook) await sendWebhookAlert(options.alertWebhook, run, suite);
        if (options.alertEmail) console.log(pc.yellow("  Warning: Email alerts are not yet implemented."));
      }
    } else {
      console.log(`  [${timeStr}] Run #${runCount.toString().padEnd(3)} ${pc.green("✓")} ${run.passed}/${run.results.length} passed  (${(run.durationMs/1000).toFixed(1)}s)` + (lastFailed ? pc.bgGreen(pc.black(" RECOVERED ")) : ""));
      if (lastFailed && failedSince) {
        const downtimeMs = Date.now() - failedSince.getTime();
        if (options.alertSlack) await sendSlackRecovery(options.alertSlack, run, suite, downtimeMs);
        if (options.alertWebhook) await sendWebhookRecovery(options.alertWebhook, run, suite, downtimeMs);
        failedSince = null;
      }
    }

    lastFailed = hasFailed;
    options.onRun?.(run);
  };

  await runOnce();
  setInterval(runOnce, options.intervalMs);

  process.stdin.resume();
  process.on("SIGINT", () => {
    console.log("");
    const hist = loadHistory(suite.filePath);
    const up = calculateUptime(hist, 24 * 60 * 60 * 1000);
    console.log(`  Uptime: ${up.toFixed(1)}% (last 24h)`);
    console.log(pc.dim("  Monitor stopped."));
    process.exit(0);
  });
}

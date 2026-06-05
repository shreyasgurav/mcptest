import type {
  SuiteResult,
  TestCase,
  TestResult,
  TestSuite,
  HookAction,
} from "../types.js";
import { McpTestClient } from "./client.js";
import { evaluate } from "./assertions.js";
import pc from "picocolors";

const DEFAULT_TIMEOUT = 15000;

export interface RunOptions {
  /** Stop the suite after the first failing/errored test. */
  bail?: boolean;
  /** Called after each test completes, for live reporting. */
  onResult?: (result: TestResult) => void;
}

/** Helper to run a list of hook actions sequentially. */
async function runHooks(
  client: McpTestClient,
  hooks: HookAction[] | undefined,
  defaultTimeout: number
): Promise<void> {
  if (!hooks || hooks.length === 0) return;
  for (const action of hooks) {
    const res = await client.callTool(action.tool, action.input, defaultTimeout);
    if (res.isError) {
      throw new Error(`Hook tool "${action.tool}" returned an error status.`);
    }
  }
}

/**
 * Run a single test suite: connect to the server, execute each test case,
 * collect assertion results, then disconnect.
 */
export async function runSuite(
  suite: TestSuite,
  options: RunOptions = {}
): Promise<SuiteResult> {
  const start = Date.now();
  const results: TestResult[] = [];
  const client = new McpTestClient(suite.server);

  let connectError: string | undefined;
  try {
    await client.connect();
  } catch (err) {
    connectError = (err as Error).message;
  }

  let beforeHookError: string | undefined;
  if (!connectError && suite.before && suite.before.length > 0) {
    try {
      await runHooks(client, suite.before, suite.timeout ?? DEFAULT_TIMEOUT);
    } catch (err) {
      beforeHookError = (err as Error).message;
    }
  }

  for (const test of suite.tests) {
    const hookOrConnectErr = connectError || beforeHookError;
    if (hookOrConnectErr) {
      const errored = erroredResult(
        test,
        connectError
          ? `could not connect to server: ${connectError}`
          : `before hook failed: ${beforeHookError}`
      );
      results.push(errored);
      options.onResult?.(errored);
      continue;
    }

    if (test.skip) {
      const skipped: TestResult = {
        name: test.name ?? test.tool,
        tool: test.tool,
        status: "skipped",
        durationMs: 0,
        assertions: [],
      };
      results.push(skipped);
      options.onResult?.(skipped);
      continue;
    }

    const result = await runTest(client, test, suite.timeout ?? DEFAULT_TIMEOUT);
    results.push(result);
    options.onResult?.(result);

    if (options.bail && (result.status === "failed" || result.status === "errored")) {
      break;
    }
  }

  // Run suite-level teardown / after hooks if we connected and didn't fail before hook
  if (!connectError && !beforeHookError && suite.after && suite.after.length > 0) {
    try {
      await runHooks(client, suite.after, suite.timeout ?? DEFAULT_TIMEOUT);
    } catch (err) {
      console.error(pc.red(`  ⚠ after hook failed: ${(err as Error).message}`));
    }
  }

  await client.close();

  const summary = summarize(results);
  return {
    name: suite.name ?? "suite",
    filePath: suite.filePath,
    results,
    durationMs: Date.now() - start,
    ...summary,
  };
}

async function runTest(
  client: McpTestClient,
  test: TestCase,
  defaultTimeout: number
): Promise<TestResult> {
  const name = test.name ?? test.tool;
  const start = Date.now();
  const timeout = test.timeout ?? defaultTimeout;
  const retryCount = test.retry ?? 0;
  const retryDelay = test.retryDelay ?? 500;

  let attempt = 0;
  let lastResult: TestResult | undefined;

  while (attempt <= retryCount) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }

    let setupDone = false;
    try {
      // 1. Setup hooks
      if (test.setup && test.setup.length > 0) {
        await runHooks(client, test.setup, timeout);
      }
      setupDone = true;

      // 2. Main tool call
      const result = await client.callTool(test.tool, test.input, timeout);

      // 3. Evaluate assertions
      const assertions = evaluate(test.expect, result);
      const ok = assertions.every((a) => a.ok);

      // 4. Teardown hooks
      if (test.teardown && test.teardown.length > 0) {
        await runHooks(client, test.teardown, timeout);
      }

      lastResult = {
        name,
        tool: test.tool,
        status: ok ? "passed" : "failed",
        durationMs: Date.now() - start,
        assertions,
      };

      if (ok) {
        return lastResult;
      }
    } catch (err) {
      // Run teardown even if tool call or assertions failed/errored
      if (setupDone && test.teardown && test.teardown.length > 0) {
        try {
          await runHooks(client, test.teardown, timeout);
        } catch (teardownErr) {
          lastResult = {
            name,
            tool: test.tool,
            status: "errored",
            durationMs: Date.now() - start,
            assertions: [],
            error: `${(err as Error).message} (Additionally, teardown failed: ${(teardownErr as Error).message})`,
          };
        }
      }

      if (!lastResult || lastResult.status !== "errored") {
        lastResult = {
          name,
          tool: test.tool,
          status: "errored",
          durationMs: Date.now() - start,
          assertions: [],
          error: (err as Error).message,
        };
      }
    }

    attempt++;
  }

  return lastResult || {
    name,
    tool: test.tool,
    status: "errored",
    durationMs: Date.now() - start,
    assertions: [],
    error: "Unknown execution error",
  };
}

function erroredResult(test: TestCase, message: string): TestResult {
  return {
    name: test.name ?? test.tool,
    tool: test.tool,
    status: "errored",
    durationMs: 0,
    assertions: [],
    error: message,
  };
}

function summarize(results: TestResult[]) {
  return {
    passed: results.filter((r) => r.status === "passed").length,
    failed: results.filter((r) => r.status === "failed").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    errored: results.filter((r) => r.status === "errored").length,
  };
}

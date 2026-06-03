import type {
  SuiteResult,
  TestCase,
  TestResult,
  TestSuite,
} from "../types.js";
import { McpTestClient } from "./client.js";
import { evaluate } from "./assertions.js";

const DEFAULT_TIMEOUT = 15000;

export interface RunOptions {
  /** Stop the suite after the first failing/errored test. */
  bail?: boolean;
  /** Called after each test completes, for live reporting. */
  onResult?: (result: TestResult) => void;
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

  for (const test of suite.tests) {
    if (connectError) {
      const errored = erroredResult(
        test,
        `could not connect to server: ${connectError}`
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

  try {
    const result = await client.callTool(test.tool, test.input, timeout);
    const assertions = evaluate(test.expect, result);
    const ok = assertions.every((a) => a.ok);
    return {
      name,
      tool: test.tool,
      status: ok ? "passed" : "failed",
      durationMs: Date.now() - start,
      assertions,
    };
  } catch (err) {
    return {
      name,
      tool: test.tool,
      status: "errored",
      durationMs: Date.now() - start,
      assertions: [],
      error: (err as Error).message,
    };
  }
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

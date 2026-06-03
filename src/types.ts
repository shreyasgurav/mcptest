/**
 * Shared types for mcptest.
 */

/** How to launch / connect to the MCP server under test. */
export interface ServerConfig {
  /**
   * Transport used to reach the server.
   * - `stdio` (default): spawn `command` + `args` as a subprocess.
   * - `http` / `sse`: connect to a running server at `url`.
   */
  transport?: "stdio" | "http" | "sse";

  /** Executable to spawn (stdio only). e.g. "node", "python", "npx". */
  command?: string;

  /** Arguments passed to `command` (stdio only). */
  args?: string[];

  /** Extra environment variables for the spawned process (stdio only). */
  env?: Record<string, string>;

  /** Working directory for the spawned process (stdio only). */
  cwd?: string;

  /** URL of a running server (http / sse transports). */
  url?: string;

  /** Extra headers to send (http / sse transports). */
  headers?: Record<string, string>;
}

/** A single matcher value. Either a literal (deep-equality) or an operator object. */
export type Matcher = unknown;

/** Assertions applied to the result of a tool call. */
export interface ExpectSpec {
  /** Assert on the `isError` flag of the tool result. Defaults to expecting `false`. */
  isError?: boolean;

  /** Convenience: assert the concatenated text content contains this substring. */
  contains?: string;

  /** Convenience: assert the concatenated text content matches this regex (string form). */
  matches?: string;

  /** Convenience: assert the concatenated text content exactly equals this string. */
  text?: string;

  /**
   * Parse the first text content block as JSON (or use `structuredContent`) and
   * run matchers against it. Supports operator objects ($eq, $contains, $type, ...).
   */
  json?: Record<string, Matcher> | Matcher;

  /** Validate the parsed JSON output against this JSON Schema. */
  schema?: Record<string, unknown>;
}

/** A single test case. */
export interface TestCase {
  /** Human-readable name. Defaults to the tool name if omitted. */
  name?: string;

  /** Name of the MCP tool to call. */
  tool: string;

  /** Arguments passed to the tool. */
  input?: Record<string, unknown>;

  /** Assertions. If omitted, the test passes as long as the call does not error. */
  expect?: ExpectSpec;

  /** Skip this test. */
  skip?: boolean;

  /** Per-test timeout in milliseconds. Overrides the suite default. */
  timeout?: number;
}

/** A full test suite, typically loaded from a YAML or JSON file. */
export interface TestSuite {
  /** Optional suite name (defaults to the file name). */
  name?: string;

  /** Server connection configuration. */
  server: ServerConfig;

  /** Default per-test timeout in milliseconds. Defaults to 15000. */
  timeout?: number;

  /** Test cases. */
  tests: TestCase[];

  /** Absolute path the suite was loaded from (filled in by the loader). */
  filePath?: string;
}

/** Outcome of a single assertion within a test. */
export interface AssertionResult {
  ok: boolean;
  /** Dot-path of the value that was checked (e.g. "json.results[0].id"). */
  path: string;
  message: string;
  expected?: unknown;
  actual?: unknown;
}

/** Result of running a single test case. */
export interface TestResult {
  name: string;
  tool: string;
  status: "passed" | "failed" | "skipped" | "errored";
  durationMs: number;
  assertions: AssertionResult[];
  /** Set when status is "errored" (transport / protocol failure). */
  error?: string;
}

/** Result of running an entire suite. */
export interface SuiteResult {
  name: string;
  filePath?: string;
  results: TestResult[];
  passed: number;
  failed: number;
  skipped: number;
  errored: number;
  durationMs: number;
}

/**
 * Shared types for mcpunit.
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

  /** Timeout in milliseconds to wait for the server to start up (stdio only). Default 5000ms. */
  startupTimeout?: number;
}

/** A single hook action (tool call) run before/after suites or tests. */
export interface HookAction {
  /** Name of the MCP tool to call. */
  tool: string;

  /** Arguments passed to the tool. */
  input?: Record<string, unknown>;
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

  /** Snapshot testing. First run saves; subsequent runs compare. */
  snapshot?: boolean;
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

  /** List of tool calls to run before this test case. */
  setup?: HookAction[];

  /** List of tool calls to run after this test case. */
  teardown?: HookAction[];

  /** Number of times to retry a failed or errored test case. */
  retry?: number;

  /** Delay in milliseconds between retry attempts. Default 500ms. */
  retryDelay?: number;
}

/** A resource test case. */
export interface ResourceTestCase {
  /** Human-readable name. Defaults to the resource URI if omitted. */
  name?: string;

  /** URI of the resource to read. */
  uri: string;

  /** Assertions on the resource content. */
  expect?: {
    /** Expected MIME type. */
    mimeType?: string;
    /** Assert the resource text contains this substring. */
    contains?: string;
    /** Assert the resource text matches this regex. */
    matches?: string;
    /** Assert the resource text exactly equals this string. */
    text?: string;
  };
}

/** A prompt test case. */
export interface PromptTestCase {
  /** Human-readable name. Defaults to the prompt name if omitted. */
  name?: string;

  /** Name of the prompt to invoke. */
  prompt: string;

  /** Arguments passed to the prompt. */
  args?: Record<string, string>;

  /** Assertions on the rendered prompt. */
  expect?: {
    /** Assert the rendered prompt contains this substring. */
    contains?: string;
    /** Assert the rendered prompt matches this regex. */
    matches?: string;
    /** Assert the rendered prompt text exactly equals this string. */
    text?: string;
  };
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

  /** Resource test cases. */
  resources?: ResourceTestCase[];

  /** Prompt test cases. */
  prompts?: PromptTestCase[];

  /** Absolute path the suite was loaded from (filled in by the loader). */
  filePath?: string;

  /** Hook run once before any tests in this suite start. */
  before?: HookAction[];

  /** Hook run once after all tests in this suite finish. */
  after?: HookAction[];
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
  /** Raw server response — populated for failed tests and when verbose. */
  rawResponse?: {
    isError: boolean;
    text: string;
    content: unknown[];
  };
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

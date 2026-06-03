/**
 * mcptest — public API.
 *
 * Re-exports everything a consumer might need when using mcptest
 * programmatically (e.g. from a custom script rather than the CLI).
 */

// Types
export type {
  ServerConfig,
  TestCase,
  TestSuite,
  ExpectSpec,
  Matcher,
  AssertionResult,
  TestResult,
  SuiteResult,
} from "./types.js";

// Core modules
export { McpTestClient } from "./core/client.js";
export type { ToolInfo, ToolCallResult } from "./core/client.js";

export { evaluate, deepEqual } from "./core/assertions.js";

export { discoverSuiteFiles, loadSuite } from "./core/loader.js";

export { runSuite } from "./core/runner.js";
export type { RunOptions } from "./core/runner.js";

export {
  reportTestLine,
  reportSuiteHeader,
  reportSummary,
  reportJson,
} from "./core/reporter.js";
export type { ReporterFormat } from "./core/reporter.js";

export {
  validateServer,
  printValidationReport,
} from "./core/validator.js";
export type { ValidationIssue, ValidationReport } from "./core/validator.js";

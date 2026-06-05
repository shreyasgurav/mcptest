/**
 * mcpunit — public API.
 *
 * Re-exports everything a consumer might need when using mcpunit
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
  ResourceTestCase,
  PromptTestCase,
  HookAction,
} from "./types.js";

// Core modules
export { McpUnitClient } from "./core/client.js";
export type { ToolInfo, ToolCallResult, ResourceResult, PromptResult } from "./core/client.js";

export { evaluate, evaluateResource, evaluatePrompt, evaluateSnapshot, deepEqual } from "./core/assertions.js";
export type { EvaluateOptions } from "./core/assertions.js";

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

export {
  generateSuite,
  detectProvider,
  resolveApiKey,
  SUPPORTED_MODELS,
} from "./core/generator.js";
export type { GenerateOptions, LLMProvider } from "./core/generator.js";
export { generateHtmlReport, writeHtmlReport } from "./core/html-reporter.js";
export { diffServers } from "./core/differ.js";
export type { DiffResult, DiffChange } from "./core/differ.js";
export { checkSnapshot } from "./core/snapshots.js";

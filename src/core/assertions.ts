import Ajv from "ajv";
import type { AssertionResult, ExpectSpec } from "../types.js";
import type { ToolCallResult, ResourceResult, PromptResult } from "./client.js";
import { checkSnapshot } from "./snapshots.js";

const ajv = new Ajv({ allErrors: true, strict: false });

/** The set of supported operator keys inside a matcher object. */
const OPERATORS = new Set([
  "$eq",
  "$ne",
  "$contains",
  "$type",
  "$length",
  "$minLength",
  "$maxLength",
  "$gt",
  "$gte",
  "$lt",
  "$lte",
  "$matches",
  "$exists",
  "$in",
]);

/** Options for the evaluate function. */
export interface EvaluateOptions {
  /** When true, overwrite saved snapshots instead of comparing. */
  updateSnapshots?: boolean;
}

/**
 * Evaluate all assertions in `expect` against a normalized tool result.
 * Returns a flat list of assertion outcomes. An empty `expect` (or absent)
 * yields a single assertion: the call must not have errored.
 */
export function evaluate(
  expect: ExpectSpec | undefined,
  result: ToolCallResult,
  options: EvaluateOptions = {}
): AssertionResult[] {
  const out: AssertionResult[] = [];

  // isError: default expectation is `false` (the call should succeed).
  const expectedIsError = expect?.isError ?? false;
  out.push({
    ok: result.isError === expectedIsError,
    path: "isError",
    message: `expected isError to be ${expectedIsError}`,
    expected: expectedIsError,
    actual: result.isError,
  });

  if (expect?.contains !== undefined) {
    out.push({
      ok: result.text.includes(expect.contains),
      path: "text",
      message: `expected text to contain "${expect.contains}"`,
      expected: expect.contains,
      actual: truncate(result.text),
    });
  }

  if (expect?.matches !== undefined) {
    let ok = false;
    try {
      ok = new RegExp(expect.matches).test(result.text);
    } catch {
      ok = false;
    }
    out.push({
      ok,
      path: "text",
      message: `expected text to match /${expect.matches}/`,
      expected: expect.matches,
      actual: truncate(result.text),
    });
  }

  if (expect?.text !== undefined) {
    out.push({
      ok: result.text === expect.text,
      path: "text",
      message: "expected text to equal",
      expected: expect.text,
      actual: truncate(result.text),
    });
  }

  if (expect?.json !== undefined) {
    const parsed = parseJsonOutput(result);
    if (!parsed.ok) {
      out.push({
        ok: false,
        path: "json",
        message: "expected output to be valid JSON",
        actual: truncate(result.text),
      });
    } else {
      matchValue(expect.json, parsed.value, "json", out);
    }
  }

  if (expect?.schema !== undefined) {
    const parsed = parseJsonOutput(result);
    if (!parsed.ok) {
      out.push({
        ok: false,
        path: "schema",
        message: "expected output to be valid JSON for schema validation",
        actual: truncate(result.text),
      });
    } else {
      const validate = ajv.compile(expect.schema);
      const valid = validate(parsed.value);
      out.push({
        ok: valid,
        path: "schema",
        message: valid
          ? "output matches schema"
          : `schema validation failed: ${ajv.errorsText(validate.errors)}`,
        expected: "valid against schema",
        actual: parsed.value,
      });
    }
  }

  if (expect?.snapshot === true) {
    const parsed = parseJsonOutput(result);
    const value = parsed.ok ? parsed.value : result.text;
    // testName is not available here — caller must pass it or we use a placeholder
    // We use the result text as a fallback key for snapshot
    out.push(
      checkSnapshot(
        "test", // Will be overridden by runner passing the test name
        value,
        options.updateSnapshots ?? false
      )
    );
  }

  return out;
}

/**
 * Evaluate assertions for a resource test.
 */
export function evaluateResource(
  expect: { mimeType?: string; contains?: string; matches?: string; text?: string } | undefined,
  result: ResourceResult
): AssertionResult[] {
  const out: AssertionResult[] = [];

  // Basic assertion: reading the resource should succeed (we got here = success)
  out.push({
    ok: true,
    path: "resource",
    message: "resource read successfully",
  });

  if (expect?.mimeType !== undefined) {
    out.push({
      ok: result.mimeType === expect.mimeType,
      path: "mimeType",
      message: `expected mimeType to be "${expect.mimeType}"`,
      expected: expect.mimeType,
      actual: result.mimeType ?? "(none)",
    });
  }

  if (expect?.contains !== undefined) {
    out.push({
      ok: result.text.includes(expect.contains),
      path: "text",
      message: `expected resource text to contain "${expect.contains}"`,
      expected: expect.contains,
      actual: truncate(result.text),
    });
  }

  if (expect?.matches !== undefined) {
    let ok = false;
    try {
      ok = new RegExp(expect.matches).test(result.text);
    } catch {
      ok = false;
    }
    out.push({
      ok,
      path: "text",
      message: `expected resource text to match /${expect.matches}/`,
      expected: expect.matches,
      actual: truncate(result.text),
    });
  }

  if (expect?.text !== undefined) {
    out.push({
      ok: result.text === expect.text,
      path: "text",
      message: "expected resource text to equal",
      expected: expect.text,
      actual: truncate(result.text),
    });
  }

  return out;
}

/**
 * Evaluate assertions for a prompt test.
 */
export function evaluatePrompt(
  expect: { contains?: string; matches?: string; text?: string } | undefined,
  result: PromptResult
): AssertionResult[] {
  const out: AssertionResult[] = [];

  // Basic assertion: getting the prompt should succeed
  out.push({
    ok: true,
    path: "prompt",
    message: "prompt rendered successfully",
  });

  if (expect?.contains !== undefined) {
    out.push({
      ok: result.text.includes(expect.contains),
      path: "text",
      message: `expected prompt text to contain "${expect.contains}"`,
      expected: expect.contains,
      actual: truncate(result.text),
    });
  }

  if (expect?.matches !== undefined) {
    let ok = false;
    try {
      ok = new RegExp(expect.matches).test(result.text);
    } catch {
      ok = false;
    }
    out.push({
      ok,
      path: "text",
      message: `expected prompt text to match /${expect.matches}/`,
      expected: expect.matches,
      actual: truncate(result.text),
    });
  }

  if (expect?.text !== undefined) {
    out.push({
      ok: result.text === expect.text,
      path: "text",
      message: "expected prompt text to equal",
      expected: expect.text,
      actual: truncate(result.text),
    });
  }

  return out;
}

/**
 * Evaluate snapshot for a named test. This is called from runner
 * with the actual test name for proper snapshot file naming.
 */
export function evaluateSnapshot(
  testName: string,
  result: ToolCallResult,
  update: boolean
): AssertionResult {
  const parsed = parseJsonOutput(result);
  const value = parsed.ok ? parsed.value : result.text;
  return checkSnapshot(testName, value, update);
}

/** Parse the JSON output of a tool result, preferring structuredContent. */
function parseJsonOutput(
  result: ToolCallResult
): { ok: true; value: unknown } | { ok: false } {
  if (result.structuredContent !== undefined) {
    return { ok: true, value: result.structuredContent };
  }
  const text = result.text.trim();
  if (text === "") return { ok: false };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/**
 * Recursively match an expected spec against an actual value.
 * - Operator object (keys start with `$`) -> apply operators.
 * - Plain object -> recurse field by field.
 * - Array -> compare element by element.
 * - Primitive -> strict deep equality.
 */
function matchValue(
  expected: unknown,
  actual: unknown,
  path: string,
  out: AssertionResult[]
): void {
  if (isOperatorObject(expected)) {
    applyOperators(expected as Record<string, unknown>, actual, path, out);
    return;
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      out.push({
        ok: false,
        path,
        message: "expected an array",
        expected,
        actual,
      });
      return;
    }
    if (expected.length !== actual.length) {
      out.push({
        ok: false,
        path,
        message: `expected array length ${expected.length}`,
        expected: expected.length,
        actual: actual.length,
      });
    }
    expected.forEach((item, i) => {
      matchValue(item, actual[i], `${path}[${i}]`, out);
    });
    return;
  }

  if (isPlainObject(expected)) {
    if (!isPlainObject(actual)) {
      out.push({
        ok: false,
        path,
        message: "expected an object",
        expected,
        actual,
      });
      return;
    }
    for (const [key, value] of Object.entries(expected)) {
      matchValue(value, (actual as Record<string, unknown>)[key], `${path}.${key}`, out);
    }
    return;
  }

  // Primitive strict equality.
  out.push({
    ok: deepEqual(expected, actual),
    path,
    message: "expected value to equal",
    expected,
    actual,
  });
}

function applyOperators(
  ops: Record<string, unknown>,
  actual: unknown,
  path: string,
  out: AssertionResult[]
): void {
  for (const [op, operand] of Object.entries(ops)) {
    out.push(applyOperator(op, operand, actual, path));
  }
}

function applyOperator(
  op: string,
  operand: unknown,
  actual: unknown,
  path: string
): AssertionResult {
  const base = { path, expected: operand, actual };
  switch (op) {
    case "$eq":
      return { ...base, ok: deepEqual(actual, operand), message: "$eq" };
    case "$ne":
      return { ...base, ok: !deepEqual(actual, operand), message: "$ne" };
    case "$contains":
      return { ...base, ok: contains(actual, operand), message: "$contains" };
    case "$type":
      return {
        ...base,
        ok: typeOf(actual) === operand,
        message: `$type (got ${typeOf(actual)})`,
      };
    case "$length":
      return {
        ...base,
        ok: lengthOf(actual) === operand,
        message: `$length (got ${lengthOf(actual)})`,
      };
    case "$minLength":
      return {
        ...base,
        ok: lengthOf(actual) >= (operand as number),
        message: `$minLength (got ${lengthOf(actual)})`,
      };
    case "$maxLength":
      return {
        ...base,
        ok: lengthOf(actual) <= (operand as number),
        message: `$maxLength (got ${lengthOf(actual)})`,
      };
    case "$gt":
      return { ...base, ok: Number(actual) > Number(operand), message: "$gt" };
    case "$gte":
      return { ...base, ok: Number(actual) >= Number(operand), message: "$gte" };
    case "$lt":
      return { ...base, ok: Number(actual) < Number(operand), message: "$lt" };
    case "$lte":
      return { ...base, ok: Number(actual) <= Number(operand), message: "$lte" };
    case "$matches":
      return {
        ...base,
        ok:
          typeof actual === "string" &&
          safeRegex(operand as string)?.test(actual) === true,
        message: `$matches /${operand}/`,
      };
    case "$exists":
      return {
        ...base,
        ok: (actual !== undefined && actual !== null) === Boolean(operand),
        message: "$exists",
      };
    case "$in":
      return {
        ...base,
        ok: Array.isArray(operand) && operand.some((o) => deepEqual(o, actual)),
        message: "$in",
      };
    default:
      return { ...base, ok: false, message: `unknown operator ${op}` };
  }
}

function isOperatorObject(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    Object.keys(value as object).length > 0 &&
    Object.keys(value as object).every((k) => OPERATORS.has(k))
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" && value !== null && !Array.isArray(value)
  );
}

function contains(actual: unknown, operand: unknown): boolean {
  if (typeof actual === "string") return actual.includes(String(operand));
  if (Array.isArray(actual)) return actual.some((a) => deepEqual(a, operand));
  return false;
}

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function lengthOf(value: unknown): number {
  if (typeof value === "string" || Array.isArray(value)) return value.length;
  if (isPlainObject(value)) return Object.keys(value).length;
  return -1;
}

function safeRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((x, i) => deepEqual(x, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    return ak.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

function truncate(text: string, max = 200): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * Server diff — compare responses from two server versions
 * against the same test inputs.
 */

import { McpTestClient } from "./client.js";
import type { ServerConfig } from "../types.js";
import { loadSuite } from "./loader.js";

export interface DiffChange {
  path: string;
  type: "added" | "removed" | "changed";
  valueA?: unknown;
  valueB?: unknown;
}

export interface DiffResult {
  testName: string;
  tool: string;
  input?: Record<string, unknown>;
  responseA: unknown;
  responseB: unknown;
  identical: boolean;
  changes: DiffChange[];
  errorA?: string;
  errorB?: string;
}

/**
 * Run every test in a suite against two different servers and diff the
 * responses. No assertions are evaluated — this purely shows what changed.
 */
export async function diffServers(
  suiteFile: string,
  serverA: ServerConfig,
  serverB: ServerConfig
): Promise<DiffResult[]> {
  const suite = loadSuite(suiteFile);
  const timeout = suite.timeout ?? 15000;

  const clientA = new McpTestClient(serverA);
  const clientB = new McpTestClient(serverB);

  try {
    await clientA.connect();
    await clientB.connect();

    const results: DiffResult[] = [];

    for (const test of suite.tests) {
      if (test.skip) continue;

      let responseA: unknown = undefined;
      let responseB: unknown = undefined;
      let errorA: string | undefined;
      let errorB: string | undefined;

      try {
        const resA = await clientA.callTool(test.tool, test.input, timeout);
        responseA = parseResponse(resA.text);
      } catch (err) {
        errorA = (err as Error).message;
      }

      try {
        const resB = await clientB.callTool(test.tool, test.input, timeout);
        responseB = parseResponse(resB.text);
      } catch (err) {
        errorB = (err as Error).message;
      }

      const changes: DiffChange[] = [];
      const identical =
        !errorA && !errorB && deepDiff(responseA, responseB, "", changes);

      results.push({
        testName: test.name ?? test.tool,
        tool: test.tool,
        input: test.input,
        responseA,
        responseB,
        identical: identical && !errorA && !errorB,
        changes,
        errorA,
        errorB,
      });
    }

    return results;
  } finally {
    await clientA.close();
    await clientB.close();
  }
}

/**
 * Try to parse as JSON, fall back to raw string.
 */
function parseResponse(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

/**
 * Recursively diff two values. Populates `changes` array and returns
 * true if the values are identical.
 */
function deepDiff(
  a: unknown,
  b: unknown,
  path: string,
  changes: DiffChange[]
): boolean {
  if (a === b) return true;

  if (a === null || b === null || typeof a !== typeof b) {
    changes.push({ path: path || "(root)", type: "changed", valueA: a, valueB: b });
    return false;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    let same = true;
    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < maxLen; i++) {
      const p = `${path}[${i}]`;
      if (i >= a.length) {
        changes.push({ path: p, type: "added", valueB: b[i] });
        same = false;
      } else if (i >= b.length) {
        changes.push({ path: p, type: "removed", valueA: a[i] });
        same = false;
      } else {
        if (!deepDiff(a[i], b[i], p, changes)) same = false;
      }
    }
    return same;
  }

  if (typeof a === "object" && typeof b === "object") {
    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(objA), ...Object.keys(objB)]);
    let same = true;

    for (const key of allKeys) {
      const p = path ? `${path}.${key}` : key;
      if (!(key in objA)) {
        changes.push({ path: p, type: "added", valueB: objB[key] });
        same = false;
      } else if (!(key in objB)) {
        changes.push({ path: p, type: "removed", valueA: objA[key] });
        same = false;
      } else {
        if (!deepDiff(objA[key], objB[key], p, changes)) same = false;
      }
    }
    return same;
  }

  // Primitives that aren't equal
  changes.push({
    path: path || "(root)",
    type: "changed",
    valueA: a,
    valueB: b,
  });
  return false;
}

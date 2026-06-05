/**
 * Snapshot testing for mcpunit.
 *
 * First run saves the response; subsequent runs compare against it.
 * Use `--update-snapshots` to overwrite saved snapshots.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import type { AssertionResult } from "../types.js";

const SNAPSHOT_DIR = ".mcpunit/snapshots";

/**
 * Sanitize a test name into a safe filesystem key.
 */
function toSnapshotKey(testName: string): string {
  return testName
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

/**
 * Check a value against a saved snapshot.
 *
 * - If no snapshot exists (or `update` is true): saves the value and passes.
 * - If a snapshot exists: compares JSON stringification, fails on mismatch.
 */
export function checkSnapshot(
  testName: string,
  actual: unknown,
  update: boolean
): AssertionResult {
  const key = toSnapshotKey(testName);
  const file = join(SNAPSHOT_DIR, `${key}.json`);
  const abs = resolve(file);

  // First run or explicit update — create/overwrite snapshot
  if (!existsSync(abs) || update) {
    mkdirSync(resolve(SNAPSHOT_DIR), { recursive: true });
    writeFileSync(abs, JSON.stringify(actual, null, 2), "utf8");
    return {
      ok: true,
      path: "snapshot",
      message: update ? "snapshot updated" : "snapshot created",
    };
  }

  // Compare against saved snapshot
  let saved: unknown;
  try {
    saved = JSON.parse(readFileSync(abs, "utf8"));
  } catch {
    return {
      ok: false,
      path: "snapshot",
      message: "failed to read saved snapshot file",
      expected: "valid JSON snapshot",
      actual: "corrupt or unreadable file",
    };
  }

  const actualStr = JSON.stringify(actual, null, 2);
  const savedStr = JSON.stringify(saved, null, 2);
  const match = actualStr === savedStr;

  if (match) {
    return {
      ok: true,
      path: "snapshot",
      message: "matches snapshot",
    };
  }

  return {
    ok: false,
    path: "snapshot",
    message: "snapshot mismatch — run with --update-snapshots to update",
    expected: saved,
    actual,
  };
}

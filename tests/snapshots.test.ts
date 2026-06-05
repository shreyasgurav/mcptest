import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkSnapshot } from "../src/core/snapshots.js";

describe("snapshots", () => {
  const snapshotDir = ".mcptest/snapshots";

  beforeEach(() => {
    // clean up snapshot dir if it exists
    if (existsSync(snapshotDir)) {
      rmSync(snapshotDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // clean up snapshot dir if it exists
    if (existsSync(snapshotDir)) {
      rmSync(snapshotDir, { recursive: true, force: true });
    }
  });

  it("creates a snapshot file on first run", () => {
    const testName = "first run test";
    const data = { hello: "world", count: 42 };
    
    const result = checkSnapshot(testName, data, false);
    
    expect(result.ok).toBe(true);
    expect(result.message).toBe("snapshot created");
    
    const snapshotFile = join(snapshotDir, "first_run_test.json");
    expect(existsSync(snapshotFile)).toBe(true);
    
    const saved = JSON.parse(readFileSync(snapshotFile, "utf8"));
    expect(saved).toEqual(data);
  });

  it("passes when the actual value matches the saved snapshot", () => {
    const testName = "matching test";
    const data = { a: 1, b: [2, 3] };
    
    // First run creates it
    const res1 = checkSnapshot(testName, data, false);
    expect(res1.ok).toBe(true);
    
    // Second run matches it
    const res2 = checkSnapshot(testName, data, false);
    expect(res2.ok).toBe(true);
    expect(res2.message).toBe("matches snapshot");
  });

  it("fails when the actual value differs from the saved snapshot", () => {
    const testName = "mismatch test";
    const initialData = { value: "original" };
    const changedData = { value: "changed" };
    
    // First run creates it
    checkSnapshot(testName, initialData, false);
    
    // Second run mismatches
    const res2 = checkSnapshot(testName, changedData, false);
    expect(res2.ok).toBe(false);
    expect(res2.message).toBe("snapshot mismatch — run with --update-snapshots to update");
    expect(res2.expected).toEqual(initialData);
    expect(res2.actual).toEqual(changedData);
  });

  it("overwrites the snapshot file when update is true", () => {
    const testName = "update test";
    const initialData = { value: "original" };
    const changedData = { value: "changed" };
    
    // First run creates it
    checkSnapshot(testName, initialData, false);
    
    // Update it
    const res2 = checkSnapshot(testName, changedData, true);
    expect(res2.ok).toBe(true);
    expect(res2.message).toBe("snapshot updated");
    
    // Verify it updated
    const res3 = checkSnapshot(testName, changedData, false);
    expect(res3.ok).toBe(true);
    expect(res3.message).toBe("matches snapshot");
  });
});

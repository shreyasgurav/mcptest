import { describe, it, expect } from "vitest";
import { parseInterval, calculateUptime } from "../src/core/monitor.js";
import type { MonitorRun } from "../src/types.js";

describe("monitor", () => {
  describe("parseInterval", () => {
    it("parses pure seconds", () => {
      expect(parseInterval("30s")).toBe(30000);
      expect(parseInterval("5s")).toBe(5000);
    });

    it("parses pure minutes", () => {
      expect(parseInterval("5m")).toBe(300000);
      expect(parseInterval("15m")).toBe(900000);
    });

    it("parses pure hours", () => {
      expect(parseInterval("1h")).toBe(3600000);
    });

    it("parses mixed intervals", () => {
      expect(parseInterval("2h30m")).toBe(9000000);
      expect(parseInterval("1m30s")).toBe(90000);
    });

    it("parses raw numbers as seconds", () => {
      expect(parseInterval("30")).toBe(30000);
    });

    it("defaults to 15m if empty or invalid", () => {
      expect(parseInterval("")).toBe(900000);
      expect(parseInterval("invalid")).toBe(900000);
    });
  });

  describe("calculateUptime", () => {
    const now = Date.now();
    const createRun = (offsetMs: number, passed: number, failed: number): MonitorRun => ({
      run: 1,
      timestamp: new Date(now - offsetMs).toISOString(),
      passed,
      failed,
      errored: 0,
      durationMs: 100,
      results: [],
      alerted: false,
    });

    it("returns 100 if no history", () => {
      expect(calculateUptime([])).toBe(100);
    });

    it("calculates basic percentage", () => {
      const history = [
        createRun(1000, 3, 0), // passed
        createRun(2000, 3, 0), // passed
        createRun(3000, 2, 1), // failed
        createRun(4000, 3, 0), // passed
      ];
      expect(calculateUptime(history)).toBe(75);
    });

    it("calculates percentage within window", () => {
      const history = [
        createRun(1000, 3, 0), // passed (inside 1h)
        createRun(2000, 2, 1), // failed (inside 1h)
        createRun(7200000, 2, 1), // failed (outside 1h)
        createRun(7300000, 2, 1), // failed (outside 1h)
      ];
      // Looking at last 1 hour (3600000 ms), there are 2 runs: 1 passed, 1 failed
      expect(calculateUptime(history, 3600000)).toBe(50);
    });
  });
});

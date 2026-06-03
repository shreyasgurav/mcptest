import { readFileSync, statSync, readdirSync } from "node:fs";
import { resolve, join, basename, extname } from "node:path";
import { parse as parseYaml } from "yaml";
import type { TestSuite } from "../types.js";

const SUITE_EXTENSIONS = new Set([".yaml", ".yml", ".json"]);

/**
 * Resolve a path (file or directory) into a list of test-suite file paths.
 * Directories are scanned recursively for *.yaml / *.yml / *.json files
 * whose name contains "mcptest" or that live under a directory named "tests".
 */
export function discoverSuiteFiles(target: string): string[] {
  const abs = resolve(target);
  const stat = statSync(abs);

  if (stat.isFile()) return [abs];

  const found: string[] = [];
  walk(abs, found);
  return found.sort();
}

function walk(dir: string, acc: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, acc);
    } else if (SUITE_EXTENSIONS.has(extname(entry.name))) {
      if (isLikelySuiteFile(entry.name)) acc.push(full);
    }
  }
}

function isLikelySuiteFile(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes("mcptest") ||
    lower.endsWith(".mcptest.yaml") ||
    lower.endsWith(".mcptest.yml") ||
    lower.endsWith(".mcptest.json") ||
    lower.endsWith(".test.yaml") ||
    lower.endsWith(".test.yml")
  );
}

/** Load and validate a single test suite from a file. */
export function loadSuite(filePath: string): TestSuite {
  const abs = resolve(filePath);
  const raw = readFileSync(abs, "utf8");
  const ext = extname(abs).toLowerCase();

  let data: unknown;
  try {
    data = ext === ".json" ? JSON.parse(raw) : parseYaml(raw);
  } catch (err) {
    throw new Error(
      `Failed to parse ${abs}: ${(err as Error).message}`
    );
  }

  const suite = validateSuite(data, abs);
  return suite;
}

function validateSuite(data: unknown, filePath: string): TestSuite {
  if (typeof data !== "object" || data === null) {
    throw new Error(`${filePath}: suite must be a YAML/JSON object.`);
  }
  const obj = data as Record<string, unknown>;

  if (typeof obj.server !== "object" || obj.server === null) {
    throw new Error(`${filePath}: missing required "server" config.`);
  }
  if (!Array.isArray(obj.tests)) {
    throw new Error(`${filePath}: "tests" must be an array.`);
  }

  obj.tests.forEach((t, i) => {
    if (typeof t !== "object" || t === null) {
      throw new Error(`${filePath}: tests[${i}] must be an object.`);
    }
    if (typeof (t as Record<string, unknown>).tool !== "string") {
      throw new Error(`${filePath}: tests[${i}] requires a "tool" name.`);
    }
  });

  return {
    name:
      typeof obj.name === "string"
        ? obj.name
        : basename(filePath).replace(/\.(ya?ml|json)$/i, ""),
    server: obj.server as TestSuite["server"],
    timeout: typeof obj.timeout === "number" ? obj.timeout : undefined,
    tests: obj.tests as TestSuite["tests"],
    filePath,
  };
}

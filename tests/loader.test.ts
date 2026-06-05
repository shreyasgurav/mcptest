import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { loadSuite, discoverSuiteFiles } from "../src/core/loader.js";

const TMP_DIR = resolve("tests/.tmp-loader");

beforeEach(() => {
  mkdirSync(TMP_DIR, { recursive: true });
});

afterEach(() => {
  if (existsSync(TMP_DIR)) {
    rmSync(TMP_DIR, { recursive: true, force: true });
  }
});

describe("loadSuite", () => {
  it("loads a valid YAML suite", () => {
    const file = join(TMP_DIR, "test.mcpunit.yaml");
    writeFileSync(
      file,
      `
name: test-suite
server:
  transport: stdio
  command: node
  args:
    - ./server.js
tests:
  - name: basic test
    tool: echo
    input:
      message: hello
    expect:
      contains: hello
`,
      "utf8"
    );

    const suite = loadSuite(file);
    expect(suite.name).toBe("test-suite");
    expect(suite.server.command).toBe("node");
    expect(suite.tests).toHaveLength(1);
    expect(suite.tests[0].tool).toBe("echo");
  });

  it("loads a valid JSON suite", () => {
    const file = join(TMP_DIR, "test.mcpunit.json");
    writeFileSync(
      file,
      JSON.stringify({
        name: "json-suite",
        server: { transport: "stdio", command: "node", args: ["./server.js"] },
        tests: [{ tool: "echo", input: { msg: "hi" } }],
      }),
      "utf8"
    );

    const suite = loadSuite(file);
    expect(suite.name).toBe("json-suite");
    expect(suite.tests).toHaveLength(1);
  });

  it("throws on missing server", () => {
    const file = join(TMP_DIR, "bad.mcpunit.yaml");
    writeFileSync(file, "name: bad\ntests:\n  - tool: x\n", "utf8");
    expect(() => loadSuite(file)).toThrow("missing required \"server\" config");
  });

  it("throws on missing tests array", () => {
    const file = join(TMP_DIR, "bad2.mcpunit.yaml");
    writeFileSync(file, "name: bad2\nserver:\n  command: node\n", "utf8");
    expect(() => loadSuite(file)).toThrow('"tests" must be an array');
  });

  it("throws on invalid test (missing tool)", () => {
    const file = join(TMP_DIR, "bad3.mcpunit.yaml");
    writeFileSync(
      file,
      "server:\n  command: node\ntests:\n  - name: no tool\n",
      "utf8"
    );
    expect(() => loadSuite(file)).toThrow('requires a "tool" name');
  });

  it("validates hooks", () => {
    const file = join(TMP_DIR, "hooks.mcpunit.yaml");
    writeFileSync(
      file,
      `
server:
  command: node
before:
  - tool: setup_db
tests:
  - tool: echo
    setup:
      - tool: prepare
    teardown:
      - tool: cleanup
after:
  - tool: teardown_db
`,
      "utf8"
    );

    const suite = loadSuite(file);
    expect(suite.before).toHaveLength(1);
    expect(suite.after).toHaveLength(1);
    expect(suite.tests[0].setup).toHaveLength(1);
    expect(suite.tests[0].teardown).toHaveLength(1);
  });

  it("throws on invalid hook (not an array)", () => {
    const file = join(TMP_DIR, "bad-hooks.mcpunit.yaml");
    writeFileSync(
      file,
      "server:\n  command: node\nbefore: not_an_array\ntests:\n  - tool: x\n",
      "utf8"
    );
    expect(() => loadSuite(file)).toThrow("must be an array");
  });

  it("validates retry fields", () => {
    const file = join(TMP_DIR, "retry.mcpunit.yaml");
    writeFileSync(
      file,
      `
server:
  command: node
tests:
  - tool: echo
    retry: not_a_number
`,
      "utf8"
    );
    expect(() => loadSuite(file)).toThrow("retry must be a number");
  });

  it("loads resources array", () => {
    const file = join(TMP_DIR, "resources.mcpunit.yaml");
    writeFileSync(
      file,
      `
server:
  command: node
tests:
  - tool: echo
resources:
  - name: readme
    uri: "file:///README.md"
    expect:
      contains: "test"
`,
      "utf8"
    );

    const suite = loadSuite(file);
    expect(suite.resources).toHaveLength(1);
    expect(suite.resources![0].uri).toBe("file:///README.md");
  });

  it("throws on resource without uri", () => {
    const file = join(TMP_DIR, "bad-resource.mcpunit.yaml");
    writeFileSync(
      file,
      `
server:
  command: node
tests:
  - tool: echo
resources:
  - name: bad resource
`,
      "utf8"
    );
    expect(() => loadSuite(file)).toThrow('requires a "uri"');
  });

  it("loads prompts array", () => {
    const file = join(TMP_DIR, "prompts.mcpunit.yaml");
    writeFileSync(
      file,
      `
server:
  command: node
tests:
  - tool: echo
prompts:
  - name: summarize
    prompt: summarize
    args:
      content: hello
    expect:
      contains: "hello"
`,
      "utf8"
    );

    const suite = loadSuite(file);
    expect(suite.prompts).toHaveLength(1);
    expect(suite.prompts![0].prompt).toBe("summarize");
  });

  it("throws on prompt without prompt name", () => {
    const file = join(TMP_DIR, "bad-prompt.mcpunit.yaml");
    writeFileSync(
      file,
      `
server:
  command: node
tests:
  - tool: echo
prompts:
  - name: bad prompt
`,
      "utf8"
    );
    expect(() => loadSuite(file)).toThrow('requires a "prompt" name');
  });
});

describe("discoverSuiteFiles", () => {
  it("returns the file itself if given a file path", () => {
    const file = join(TMP_DIR, "single.mcpunit.yaml");
    writeFileSync(file, "server:\n  command: node\ntests:\n  - tool: x\n", "utf8");
    const files = discoverSuiteFiles(file);
    expect(files).toHaveLength(1);
    expect(files[0]).toBe(resolve(file));
  });

  it("discovers mcpunit files in a directory", () => {
    writeFileSync(join(TMP_DIR, "a.mcpunit.yaml"), "x", "utf8");
    writeFileSync(join(TMP_DIR, "b.mcpunit.yml"), "x", "utf8");
    writeFileSync(join(TMP_DIR, "readme.md"), "x", "utf8"); // should be ignored

    const files = discoverSuiteFiles(TMP_DIR);
    expect(files).toHaveLength(2);
    expect(files.every((f) => f.includes("mcpunit"))).toBe(true);
  });

  it("ignores node_modules and dotfiles", () => {
    mkdirSync(join(TMP_DIR, "node_modules"), { recursive: true });
    writeFileSync(join(TMP_DIR, "node_modules", "test.mcpunit.yaml"), "x", "utf8");
    mkdirSync(join(TMP_DIR, ".hidden"), { recursive: true });
    writeFileSync(join(TMP_DIR, ".hidden", "test.mcpunit.yaml"), "x", "utf8");

    const files = discoverSuiteFiles(TMP_DIR);
    expect(files).toHaveLength(0);
  });
});

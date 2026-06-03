/**
 * mcptest CLI
 *
 * Commands:
 *   run [path]        Run test suites against MCP servers
 *   validate [path]   Validate an MCP server against spec conventions
 *   init              Generate a starter mcptest config file
 */

import { Command } from "commander";
import pc from "picocolors";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, basename } from "node:path";
import { parse as parseYaml } from "yaml";

import { discoverSuiteFiles, loadSuite } from "./core/loader.js";
import { runSuite } from "./core/runner.js";
import {
  reportTestLine,
  reportSuiteHeader,
  reportSummary,
  reportJson,
} from "./core/reporter.js";
import {
  validateServer,
  printValidationReport,
} from "./core/validator.js";
import type { ReporterFormat } from "./core/reporter.js";
import type { ServerConfig } from "./types.js";

const pkg = { name: "mcptest", version: "0.1.0" };

const program = new Command()
  .name(pkg.name)
  .description(
    "A declarative, CI-first testing framework for MCP servers."
  )
  .version(pkg.version);

// ─── run ───────────────────────────────────────────────────────────
program
  .command("run")
  .description("Run MCP test suite(s)")
  .argument("[path]", "Test file or directory", ".")
  .option("--bail", "Stop after the first failure", false)
  .option(
    "-f, --format <format>",
    'Output format: "pretty" or "json"',
    "pretty"
  )
  .option(
    "-t, --timeout <ms>",
    "Default per-test timeout in ms",
    "15000"
  )
  .action(async (path: string, opts: { bail: boolean; format: string; timeout: string }) => {
    const format = opts.format as ReporterFormat;
    const isPretty = format === "pretty";

    if (isPretty) {
      console.log("");
      console.log(
        pc.bold(pc.magenta("  mcptest")) + pc.dim(" v" + pkg.version)
      );
      console.log(pc.dim("  ─────────────────────────────────"));
    }

    const files = discoverSuiteFiles(path);
    if (files.length === 0) {
      if (isPretty) {
        console.log("");
        console.log(
          pc.yellow(
            "  No test suites found. Create a *.mcptest.yaml file or run `mcptest init`."
          )
        );
        console.log("");
      }
      process.exit(1);
    }

    const allResults = [];

    for (const file of files) {
      const suite = loadSuite(file);

      // Override timeout if CLI flag supplied
      const cliTimeout = parseInt(opts.timeout, 10);
      if (!isNaN(cliTimeout) && cliTimeout > 0) {
        suite.timeout = cliTimeout;
      }

      if (isPretty) {
        reportSuiteHeader({
          name: suite.name ?? basename(file),
          filePath: file,
          results: [],
          passed: 0,
          failed: 0,
          skipped: 0,
          errored: 0,
          durationMs: 0,
        });
      }

      const result = await runSuite(suite, {
        bail: opts.bail,
        onResult: isPretty ? reportTestLine : undefined,
      });

      allResults.push(result);
    }

    if (format === "json") {
      const code = reportJson(allResults);
      process.exit(code);
    } else {
      const code = reportSummary(allResults);
      process.exit(code);
    }
  });

// ─── validate ──────────────────────────────────────────────────────
program
  .command("validate")
  .description("Validate an MCP server against specification conventions")
  .option(
    "-c, --config <file>",
    "Path to mcptest config (YAML/JSON) containing server config"
  )
  .option("--command <cmd>", "Server command to spawn (stdio)")
  .option("--args <args>", "Server command arguments (comma-separated)")
  .option("--url <url>", "Server URL (http/sse transport)")
  .option(
    "--transport <type>",
    'Transport type: "stdio", "http", "sse"',
    "stdio"
  )
  .option("-f, --format <format>", 'Output format: "pretty" or "json"', "pretty")
  .action(
    async (opts: {
      config?: string;
      command?: string;
      args?: string;
      url?: string;
      transport?: string;
      format?: string;
    }) => {
      let server: ServerConfig;

      if (opts.config) {
        // Load server config from file
        const abs = resolve(opts.config);
        const raw = readFileSync(abs, "utf8");
        const data =
          abs.endsWith(".json") ? JSON.parse(raw) : parseYaml(raw);

        if (data.server) {
          server = data.server as ServerConfig;
        } else {
          console.error(
            pc.red('Config file must have a "server" key.')
          );
          process.exit(1);
        }
      } else if (opts.command || opts.url) {
        server = {
          transport: (opts.transport as ServerConfig["transport"]) ?? "stdio",
          command: opts.command,
          args: opts.args?.split(",").map((a) => a.trim()),
          url: opts.url,
        };
      } else {
        // Try to find a config file in cwd
        const candidates = [
          "mcptest.yaml",
          "mcptest.yml",
          "mcptest.json",
        ];
        let found: string | undefined;
        for (const c of candidates) {
          if (existsSync(resolve(c))) {
            found = resolve(c);
            break;
          }
        }
        if (found) {
          const raw = readFileSync(found, "utf8");
          const data = found.endsWith(".json")
            ? JSON.parse(raw)
            : parseYaml(raw);
          server = data.server as ServerConfig;
        } else {
          console.error(
            pc.red(
              'No server specified. Use --command, --url, or --config, or create a mcptest.yaml.'
            )
          );
          process.exit(1);
        }
      }

      const report = await validateServer(server);

      if (opts.format === "json") {
        console.log(JSON.stringify(report, null, 2));
        process.exit(report.ok ? 0 : 1);
      } else {
        const code = printValidationReport(report);
        process.exit(code);
      }
    }
  );

// ─── init ──────────────────────────────────────────────────────────
program
  .command("init")
  .description("Generate a starter mcptest.yaml config file")
  .option(
    "-o, --output <file>",
    "Output file name",
    "mcptest.yaml"
  )
  .action((opts: { output: string }) => {
    const dest = resolve(opts.output);
    if (existsSync(dest)) {
      console.log(pc.yellow(`  ${dest} already exists. Skipping.`));
      process.exit(0);
    }

    const template = `# mcptest — Test suite for your MCP server
# Docs: https://github.com/shreyasgurav/mcptest

name: my-mcp-server-tests

server:
  # Transport: stdio | http | sse
  transport: stdio
  command: node
  args:
    - ./path/to/your-server.js

  # For HTTP / SSE:
  # transport: http
  # url: http://localhost:3000/mcp

# Default timeout per test (ms)
timeout: 15000

tests:
  - name: Example tool call
    tool: your_tool_name
    input:
      key: value
    expect:
      # The call should succeed (isError: false is the default)
      contains: "expected substring"

  - name: Validate JSON output
    tool: another_tool
    input:
      query: "test"
    expect:
      json:
        status: success
        results:
          $minLength: 1

  - name: Schema validation
    tool: get_data
    expect:
      schema:
        type: object
        required:
          - id
          - name
        properties:
          id:
            type: number
          name:
            type: string
`;

    writeFileSync(dest, template, "utf8");
    console.log("");
    console.log(
      pc.green(`  ✓ Created ${basename(dest)}`)
    );
    console.log(
      pc.dim(`    Edit the file, then run: mcptest run`)
    );
    console.log("");
  });

program.parse();

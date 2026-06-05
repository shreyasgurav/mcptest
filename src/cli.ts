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
import { resolve, basename, extname } from "node:path";
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
import { McpTestClient } from "./core/client.js";
import type { ToolInfo } from "./core/client.js";

const pkg = { name: "mcptest", version: "0.2.0" };

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
  .option(
    "--watch",
    "Watch for file changes and rerun tests automatically",
    false
  )
  .action(async (path: string, opts: { bail: boolean; format: string; timeout: string; watch: boolean }) => {
    const format = opts.format as ReporterFormat;
    const isPretty = format === "pretty";

    if (opts.watch) {
      if (format === "json") {
        console.error(pc.red("  Error: --watch cannot be combined with json format."));
        process.exit(1);
      }

      console.log(pc.cyan("  Watching for file changes in current directory..."));
      
      let running = false;
      let pendingRun = false;

      const runAll = async () => {
        if (running) {
          pendingRun = true;
          return;
        }
        running = true;

        console.clear();
        console.log("");
        console.log(
          pc.bold(pc.magenta("  mcptest")) + pc.dim(" v" + pkg.version) + pc.cyan(" (Watch Mode)")
        );
        console.log(pc.dim("  ─────────────────────────────────"));
        console.log(pc.yellow("  Press Ctrl+C to exit"));

        try {
          const files = discoverSuiteFiles(path);
          if (files.length === 0) {
            console.log(pc.yellow("\n  No test suites found."));
          } else {
            const allResults = [];
            for (const file of files) {
              const suite = loadSuite(file);
              const cliTimeout = parseInt(opts.timeout, 10);
              if (!isNaN(cliTimeout) && cliTimeout > 0) {
                suite.timeout = cliTimeout;
              }
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
              const result = await runSuite(suite, {
                bail: opts.bail,
                onResult: reportTestLine,
              });
              allResults.push(result);
            }
            reportSummary(allResults);
          }
        } catch (err) {
          console.error(pc.red(`\n  Run failed: ${(err as Error).message}`));
        }

        running = false;
        if (pendingRun) {
          pendingRun = false;
          setTimeout(() => runAll(), 0);
        }
      };

      // Run initially
      await runAll();

      const chokidar = await import("chokidar");
      const watcher = chokidar.watch(".", {
        ignored: [
          "**/node_modules/**",
          "**/dist/**",
          "**/.git/**",
          "**/coverage/**"
        ],
        persistent: true,
        ignoreInitial: true,
      });

      watcher.on("all", (_, filepath) => {
        const ext = extname(filepath).toLowerCase();
        if ([".js", ".mjs", ".ts", ".yaml", ".yml", ".json"].includes(ext)) {
          runAll();
        }
      });
      return;
    }

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
      const server = resolveServerConfig(opts);
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

// ─── list ──────────────────────────────────────────────────────────
program
  .command("list")
  .description("List all tools exposed by the MCP server")
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
  .action(async (opts: {
    config?: string;
    command?: string;
    args?: string;
    url?: string;
    transport?: string;
  }) => {
    const server = resolveServerConfig(opts);
    const client = new McpTestClient(server);
    try {
      console.log(pc.dim("\n  Connecting to MCP server..."));
      await client.connect();
      const tools = await client.listTools();
      printToolsTable(tools);
    } catch (err) {
      console.error(pc.red(`\n  Failed to list tools: ${(err as Error).message}`));
      process.exit(1);
    } finally {
      await client.close();
    }
  });

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

// ─── Helpers ───────────────────────────────────────────────────────

function resolveServerConfig(opts: {
  config?: string;
  command?: string;
  args?: string;
  url?: string;
  transport?: string;
}): ServerConfig {
  if (opts.config) {
    const abs = resolve(opts.config);
    const raw = readFileSync(abs, "utf8");
    const data = abs.endsWith(".json") ? JSON.parse(raw) : parseYaml(raw);
    if (data.server) {
      return data.server as ServerConfig;
    } else {
      console.error(pc.red('Config file must have a "server" key.'));
      process.exit(1);
    }
  } else if (opts.command || opts.url) {
    return {
      transport: (opts.transport as ServerConfig["transport"]) ?? "stdio",
      command: opts.command,
      args: opts.args?.split(",").map((a) => a.trim()),
      url: opts.url,
    };
  } else {
    const candidates = ["mcptest.yaml", "mcptest.yml", "mcptest.json"];
    let found: string | undefined;
    for (const c of candidates) {
      if (existsSync(resolve(c))) {
        found = resolve(c);
        break;
      }
    }
    if (found) {
      const raw = readFileSync(found, "utf8");
      const data = found.endsWith(".json") ? JSON.parse(raw) : parseYaml(raw);
      return data.server as ServerConfig;
    } else {
      console.error(
        pc.red(
          'No server specified. Use --command, --url, or --config, or create a mcptest.yaml.'
        )
      );
      process.exit(1);
    }
  }
}

function printToolsTable(tools: ToolInfo[]) {
  if (tools.length === 0) {
    console.log(pc.yellow("  No tools found on the server."));
    return;
  }

  console.log("");
  console.log(`  ${pc.bold("Tools")} (${tools.length}):`);
  
  const maxNameLen = Math.max(10, ...tools.map(t => t.name.length));
  const descWidth = 60;
  
  const borderTop = `  ┌─${"─".repeat(maxNameLen)}─┬─${"─".repeat(descWidth)}─┐`;
  const borderDivider = `  ├─${"─".repeat(maxNameLen)}─┼─${"─".repeat(descWidth)}─┤`;
  const borderBottom = `  └─${"─".repeat(maxNameLen)}─┴─${"─".repeat(descWidth)}─┘`;
  
  console.log(pc.dim(borderTop));
  console.log(pc.dim(`  │ `) + pc.bold("Tool Name".padEnd(maxNameLen)) + pc.dim(` │ `) + pc.bold("Description".padEnd(descWidth)) + pc.dim(` │`));
  console.log(pc.dim(borderDivider));
  
  for (const t of tools) {
    const nameStr = t.name.padEnd(maxNameLen);
    const desc = t.description || "";
    const descLines: string[] = [];
    if (desc.length === 0) {
      descLines.push("");
    } else {
      let currentLine = "";
      const words = desc.split(" ");
      for (const word of words) {
        if ((currentLine + (currentLine ? " " : "") + word).length <= descWidth) {
          currentLine += (currentLine ? " " : "") + word;
        } else {
          descLines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) {
        descLines.push(currentLine);
      }
    }
    
    console.log(
      pc.dim(`  │ `) + 
      pc.cyan(nameStr) + 
      pc.dim(` │ `) + 
      descLines[0].padEnd(descWidth) + 
      pc.dim(` │`)
    );
    
    for (let i = 1; i < descLines.length; i++) {
      console.log(
        pc.dim(`  │ `) + 
        " ".repeat(maxNameLen) + 
        pc.dim(` │ `) + 
        descLines[i].padEnd(descWidth) + 
        pc.dim(` │`)
      );
    }
  }
  
  console.log(pc.dim(borderBottom));
  console.log("");
}

program.parse();

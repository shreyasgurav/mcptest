/**
 * mcpunit CLI
 *
 * Commands:
 *   run [path]        Run test suites against MCP servers
 *   validate [path]   Validate an MCP server against spec conventions
 *   init              Generate a starter mcpunit config file
 *   list              List tools exposed by the MCP server
 *   generate          AI-generate a test suite from tool schemas
 *   diff              Compare two server versions side by side
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
import { generateSuite } from "./core/generator.js";
import { writeHtmlReport } from "./core/html-reporter.js";
import { diffServers } from "./core/differ.js";
import type { ReporterFormat } from "./core/reporter.js";
import type { ServerConfig } from "./types.js";
import { McpUnitClient } from "./core/client.js";
import type { ToolInfo } from "./core/client.js";

const pkg = { name: "mcpunit", version: "0.5.1" };


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
    'Output format: "pretty", "json", or "html"',
    "pretty"
  )
  .option(
    "-t, --timeout <ms>",
    "Default per-test timeout in ms (overrides YAML config)"
  )
  .option(
    "--watch",
    "Watch for file changes and rerun tests automatically",
    false
  )
  .option(
    "--update-snapshots",
    "Update saved snapshots instead of comparing",
    false
  )
  .action(async (path: string, opts: { bail: boolean; format: string; timeout?: string; watch: boolean; updateSnapshots: boolean }) => {
    const format = opts.format as ReporterFormat;
    const isPretty = format === "pretty";

    if (opts.watch) {
      if (format !== "pretty") {
        console.error(pc.red("  Error: --watch can only be used with pretty format."));
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

        process.stdout.write('\x1Bc'); // clear terminal
        console.log("");
        console.log(
          pc.bold(pc.magenta("  mcpunit")) + pc.dim(" v" + pkg.version) + pc.cyan(" (Watch Mode)")
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
              if (opts.timeout) {
                const cliTimeout = parseInt(opts.timeout, 10);
                if (!isNaN(cliTimeout) && cliTimeout > 0) {
                  suite.timeout = cliTimeout;
                }
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
                updateSnapshots: opts.updateSnapshots,
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
        pc.bold(pc.magenta("  mcpunit")) + pc.dim(" v" + pkg.version)
      );
      console.log(pc.dim("  ─────────────────────────────────"));
    }

    const files = discoverSuiteFiles(path);
    if (files.length === 0) {
      if (isPretty) {
        console.log("");
        console.log(
          pc.yellow(
            "  No test suites found. Create a *.mcpunit.yaml file or run `mcpunit init`."
          )
        );
        console.log("");
      }
      process.exit(1);
    }

    const allResults = [];

    for (const file of files) {
      const suite = loadSuite(file);

      // Override timeout only if CLI flag was explicitly supplied
      if (opts.timeout) {
        const cliTimeout = parseInt(opts.timeout, 10);
        if (!isNaN(cliTimeout) && cliTimeout > 0) {
          suite.timeout = cliTimeout;
        }
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
        updateSnapshots: opts.updateSnapshots,
      });

      allResults.push(result);
    }

    if (format === "json") {
      const code = reportJson(allResults);
      process.exit(code);
    } else if (format === "html") {
      const outputPath = writeHtmlReport(allResults, "mcpunit-report.html");
      console.log("");
      console.log(pc.green(`  ✓ HTML report written to ${outputPath}`));
      console.log(pc.dim(`    Open in browser to view results.`));
      console.log("");
      // Also print summary to terminal
      const code = reportSummary(allResults);
      // Try to open in browser
      try {
        const { exec } = await import("node:child_process");
        const openCmd = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
        exec(`${openCmd} "${outputPath}"`);
      } catch {
        // Silently ignore if open fails
      }
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
    "Path to mcpunit config (YAML/JSON) containing server config"
  )
  .option("--command <cmd>", "Server command to spawn (stdio)")
  .option("--args <args>", "Server command arguments (comma-separated)")
  .option("--url <url>", "Server URL (http/sse transport)")
  .option(
    "--transport <type>",
    'Transport type: "stdio", "http", "sse"',
    "stdio"
  )
  .option(
    "--headers <headers>",
    "HTTP headers to include (comma-separated Key=Value, e.g. Authorization=Bearer token)"
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
      headers?: string;
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
    "Path to mcpunit config (YAML/JSON) containing server config"
  )
  .option("--command <cmd>", "Server command to spawn (stdio)")
  .option("--args <args>", "Server command arguments (comma-separated)")
  .option("--url <url>", "Server URL (http/sse transport)")
  .option(
    "--transport <type>",
    'Transport type: "stdio", "http", "sse"',
    "stdio"
  )
  .option(
    "--headers <headers>",
    "HTTP headers to include (comma-separated Key=Value, e.g. Authorization=Bearer token)"
  )
  .action(async (opts: {
    config?: string;
    command?: string;
    args?: string;
    url?: string;
    transport?: string;
    headers?: string;
  }) => {
    const server = resolveServerConfig(opts);
    const client = new McpUnitClient(server);
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

// ─── generate ──────────────────────────────────────────────────────
program
  .command("generate")
  .description("AI-generate a test suite from your server's tool schemas")
  .option(
    "--model <model>",
    "LLM model to use (e.g. claude-sonnet-4-20250514, gpt-4o, gemini-2.0-flash). Provider is auto-detected from model name.",
    ""
  )
  .option(
    "--api-key <key>",
    "API key for the chosen provider (or set ANTHROPIC_API_KEY / OPENAI_API_KEY / GOOGLE_API_KEY env)"
  )
  .option("-o, --output <file>", "Output file", "mcpunit.yaml")
  .option("--command <cmd>", "Server command to spawn (stdio)")
  .option("--args <args>", "Server command arguments (comma-separated)")
  .option("--url <url>", "Server URL (http/sse transport)")
  .option(
    "--transport <type>",
    'Transport type: "stdio", "http", "sse"',
    "stdio"
  )
  .option(
    "--headers <headers>",
    "HTTP headers to include (comma-separated Key=Value)"
  )
  .option("-c, --config <file>", "Existing config file with server block")
  .option("--list-models", "List all supported models and exit", false)
  .action(async (opts: {
    model: string;
    apiKey?: string;
    output: string;
    command?: string;
    args?: string;
    url?: string;
    transport?: string;
    config?: string;
    headers?: string;
    listModels: boolean;
  }) => {
    const { SUPPORTED_MODELS, detectProvider, resolveApiKey } = await import("./core/generator.js");

    // --list-models: print supported models and exit
    if (opts.listModels) {
      console.log("");
      console.log(pc.bold("  Supported models:\n"));
      for (const [provider, models] of Object.entries(SUPPORTED_MODELS)) {
        console.log(pc.bold(`  ${provider.charAt(0).toUpperCase() + provider.slice(1)}`));
        for (const m of models) {
          console.log(`    ${pc.cyan(m)}`);
        }
        console.log("");
      }
      console.log(pc.dim("  Env vars:  ANTHROPIC_API_KEY | OPENAI_API_KEY | GOOGLE_API_KEY"));
      console.log("");
      process.exit(0);
    }

    // Resolve provider + key
    const provider = opts.model ? detectProvider(opts.model) : (
      opts.apiKey
        ? (opts.apiKey.startsWith("sk-") ? "openai" : opts.apiKey.startsWith("AIza") ? "google" : "anthropic")
        : "anthropic"
    );
    const apiKey = resolveApiKey(provider, opts.apiKey);

    if (!apiKey) {
      const envVars: Record<string, string> = {
        anthropic: "ANTHROPIC_API_KEY",
        openai: "OPENAI_API_KEY",
        google: "GOOGLE_API_KEY or GEMINI_API_KEY",
      };
      console.error(pc.red(`  ✗ No API key found for provider "${provider}".`));
      console.error(pc.dim(`    Set ${envVars[provider]} or pass --api-key <key>.`));
      console.error(pc.dim(`    Use --list-models to see all supported models.`));
      process.exit(1);
    }

    const server = resolveServerConfig(opts);
    const ora = (await import("ora")).default;

    const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1);
    const modelLabel = opts.model || "(default)";
    const spinner = ora({ text: `  Connecting to server...`, color: "cyan" }).start();

    try {
      spinner.text = "  Reading tool schemas...";
      const yaml = await generateSuite(server, { apiKey, model: opts.model || undefined });

      spinner.text = "  Writing test suite...";
      const outputPath = resolve(opts.output);
      writeFileSync(outputPath, yaml, "utf8");

      spinner.succeed(pc.green(`  Generated ${opts.output}`));
      console.log(pc.dim(`  Provider: ${providerLabel}  Model: ${modelLabel}`));
      console.log(pc.dim(`  Run: mcpunit run ${opts.output}`));
      console.log("");
    } catch (err) {
      spinner.fail(pc.red(`  Failed: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// ─── diff ──────────────────────────────────────────────────────────
program
  .command("diff")
  .description("Compare responses from two server versions")
  .requiredOption("--server-a <cmd>", "Command for server A (e.g. 'node ./dist-v1/index.js')")
  .requiredOption("--server-b <cmd>", "Command for server B (e.g. 'node ./dist-v2/index.js')")
  .requiredOption("--suite <file>", "Test suite file to use as inputs")
  .option(
    "--transport <type>",
    'Transport type: "stdio", "http", "sse"',
    "stdio"
  )
  .action(async (opts: {
    serverA: string;
    serverB: string;
    suite: string;
    transport: string;
  }) => {
    const parseServerCmd = (cmd: string): ServerConfig => {
      const parts = cmd.trim().split(/\s+/);
      return {
        transport: opts.transport as ServerConfig["transport"],
        command: parts[0],
        args: parts.slice(1),
      };
    };

    const serverA = parseServerCmd(opts.serverA);
    const serverB = parseServerCmd(opts.serverB);

    console.log("");
    console.log(
      pc.bold(pc.magenta("  mcpunit diff")) + pc.dim(" v" + pkg.version)
    );
    console.log(pc.dim("  ─────────────────────────────────"));
    console.log(pc.dim(`  A: ${opts.serverA}`));
    console.log(pc.dim(`  B: ${opts.serverB}`));
    console.log("");

    try {
      const results = await diffServers(opts.suite, serverA, serverB);

      let changed = 0;
      let identical = 0;

      for (const result of results) {
        if (result.errorA || result.errorB) {
          console.log(`  ${pc.red("⚠")} ${pc.bold(result.testName)}`);
          console.log(`    tool: ${pc.cyan(result.tool)}`);
          if (result.errorA) console.log(`    ${pc.red(`A error: ${result.errorA}`)}`);
          if (result.errorB) console.log(`    ${pc.red(`B error: ${result.errorB}`)}`);
          console.log("");
          changed++;
          continue;
        }

        if (result.identical) {
          console.log(`  ${pc.green("✓")} ${result.testName} ${pc.dim("(identical)")}`);
          identical++;
        } else {
          console.log(`  ${pc.yellow("≠")} ${pc.bold(result.testName)}`);
          console.log(`    tool: ${pc.cyan(result.tool)}`);
          if (result.input) {
            console.log(`    input: ${pc.dim(JSON.stringify(result.input))}`);
          }
          console.log("");
          for (const change of result.changes) {
            const prefix = change.type === "added" ? "+" : change.type === "removed" ? "-" : "~";
            const color = change.type === "added" ? pc.green : change.type === "removed" ? pc.red : pc.yellow;
            console.log(`    ${color(`${prefix} ${change.path}`)}`);
            if (change.valueA !== undefined) {
              console.log(`      ${pc.red("A:")} ${pc.dim(JSON.stringify(change.valueA))}`);
            }
            if (change.valueB !== undefined) {
              console.log(`      ${pc.green("B:")} ${pc.dim(JSON.stringify(change.valueB))}`);
            }
          }
          console.log("");
          changed++;
        }
      }

      console.log(pc.dim("  ─────────────────────────────────"));
      console.log(
        pc.bold("  Summary: ") +
          (changed > 0 ? pc.yellow(`${changed} changed`) : "") +
          (changed > 0 && identical > 0 ? pc.dim(", ") : "") +
          (identical > 0 ? pc.green(`${identical} identical`) : "")
      );
      console.log("");

      process.exit(changed > 0 ? 1 : 0);
    } catch (err) {
      console.error(pc.red(`  Failed: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// ─── init ──────────────────────────────────────────────────────────
program
  .command("init")
  .description("Generate a starter mcpunit.yaml config file")
  .option(
    "-o, --output <file>",
    "Output file name",
    "mcpunit.yaml"
  )
  .action((opts: { output: string }) => {
    const dest = resolve(opts.output);
    if (existsSync(dest)) {
      console.log(pc.yellow(`  ${dest} already exists. Skipping.`));
      process.exit(0);
    }

    const template = `# mcpunit — Test suite for your MCP server
# Docs: https://github.com/shreyasgurav/mcpunit

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

  # - name: Snapshot test
  #   tool: get_user
  #   input:
  #     id: 1
  #   expect:
  #     snapshot: true

# resources:
#   - name: readme resource
#     uri: "file:///README.md"
#     expect:
#       contains: "mcpunit"

# prompts:
#   - name: summarize prompt
#     prompt: summarize
#     args:
#       content: "hello world"
#     expect:
#       contains: "hello"
`;

    writeFileSync(dest, template, "utf8");
    console.log("");
    console.log(
      pc.green(`  ✓ Created ${basename(dest)}`)
    );
    console.log(
      pc.dim(`    Edit the file, then run: mcpunit run`)
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
  headers?: string;
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
    const headers: Record<string, string> = {};
    if (opts.headers) {
      // Split by comma, then extract key/value by splitting at the first '=' or ':'
      const parts = opts.headers.split(",");
      for (const p of parts) {
        const eqIdx = p.indexOf("=");
        const colIdx = p.indexOf(":");
        const idx = eqIdx !== -1 && colIdx !== -1 ? Math.min(eqIdx, colIdx) : (eqIdx !== -1 ? eqIdx : colIdx);
        if (idx !== -1) {
          const key = p.substring(0, idx).trim();
          const val = p.substring(idx + 1).trim();
          headers[key] = val;
        }
      }
    }
    return {
      transport: (opts.transport as ServerConfig["transport"]) ?? "stdio",
      command: opts.command,
      args: opts.args?.split(",").map((a) => a.trim()),
      url: opts.url,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    };
  } else {
    const candidates = ["mcpunit.yaml", "mcpunit.yml", "mcpunit.json"];
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
          'No server specified. Use --command, --url, or --config, or create a mcpunit.yaml.'
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

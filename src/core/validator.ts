/**
 * Schema validator for MCP servers.
 * Connects to a server, introspects its tools/resources/prompts,
 * and validates them against the MCP specification.
 */

import { McpTestClient } from "./client.js";
import type { ServerConfig } from "../types.js";
import pc from "picocolors";

export interface ValidationIssue {
  severity: "error" | "warning";
  target: string;
  message: string;
}

export interface ValidationReport {
  server: ServerConfig;
  tools: number;
  resources: number;
  prompts: number;
  issues: ValidationIssue[];
  ok: boolean;
}

/**
 * Connect to an MCP server, list its tools/resources/prompts, and validate
 * that they comply with expected MCP conventions.
 */
export async function validateServer(
  server: ServerConfig
): Promise<ValidationReport> {
  const client = new McpTestClient(server);
  const issues: ValidationIssue[] = [];
  let tools = 0;
  let resources = 0;
  let prompts = 0;

  try {
    await client.connect();
  } catch (err) {
    issues.push({
      severity: "error",
      target: "server",
      message: `Failed to connect: ${(err as Error).message}`,
    });
    return { server, tools, resources, prompts, issues, ok: false };
  }

  try {
    // --- Tools ---
    const toolList = await client.listTools();
    tools = toolList.length;

    if (tools === 0) {
      issues.push({
        severity: "warning",
        target: "tools",
        message: "Server exposes no tools.",
      });
    }

    for (const tool of toolList) {
      if (!tool.name || tool.name.trim() === "") {
        issues.push({
          severity: "error",
          target: "tool",
          message: "Tool has an empty or missing name.",
        });
      } else {
        // Tool name should be snake_case or kebab-case (convention)
        if (!/^[a-z][a-z0-9_-]*$/.test(tool.name)) {
          issues.push({
            severity: "warning",
            target: `tool:${tool.name}`,
            message: `Name "${tool.name}" doesn't follow snake_case / kebab-case convention.`,
          });
        }
      }

      if (!tool.description || tool.description.trim() === "") {
        issues.push({
          severity: "warning",
          target: `tool:${tool.name}`,
          message: "Missing description. Tools should have human-readable descriptions.",
        });
      }

      if (tool.inputSchema) {
        // inputSchema should be a valid JSON Schema object
        if (typeof tool.inputSchema !== "object") {
          issues.push({
            severity: "error",
            target: `tool:${tool.name}`,
            message: "inputSchema must be an object.",
          });
        } else {
          const schema = tool.inputSchema as Record<string, unknown>;
          if (schema.type !== "object") {
            issues.push({
              severity: "warning",
              target: `tool:${tool.name}`,
              message: `inputSchema.type should be "object", got "${schema.type}".`,
            });
          }
        }
      }
    }

    // --- Resources ---
    const resourceList = await client.listResources();
    resources = resourceList.length;

    for (const resource of resourceList) {
      if (!resource.uri || resource.uri.trim() === "") {
        issues.push({
          severity: "error",
          target: "resource",
          message: "Resource has an empty or missing URI.",
        });
      }
    }

    // --- Prompts ---
    const promptList = await client.listPrompts();
    prompts = promptList.length;

    for (const prompt of promptList) {
      if (!prompt.name || prompt.name.trim() === "") {
        issues.push({
          severity: "error",
          target: "prompt",
          message: "Prompt has an empty or missing name.",
        });
      }
      if (!prompt.description || prompt.description.trim() === "") {
        issues.push({
          severity: "warning",
          target: `prompt:${prompt.name}`,
          message: "Missing description.",
        });
      }
    }
  } finally {
    await client.close();
  }

  return {
    server,
    tools,
    resources,
    prompts,
    issues,
    ok: issues.every((i) => i.severity !== "error"),
  };
}

/** Pretty-print a validation report. Returns exit code. */
export function printValidationReport(report: ValidationReport): number {
  console.log("");
  console.log(pc.bold(pc.cyan("● MCP Server Validation")));
  console.log(
    pc.dim(
      `  ${report.tools} tool(s), ${report.resources} resource(s), ${report.prompts} prompt(s)`
    )
  );
  console.log("");

  if (report.issues.length === 0) {
    console.log(pc.green("  ✓ No issues found. Server looks good!"));
    console.log("");
    return 0;
  }

  const errors = report.issues.filter((i) => i.severity === "error");
  const warnings = report.issues.filter((i) => i.severity === "warning");

  for (const issue of errors) {
    console.log(`  ${pc.red("✗")} ${pc.red(`[${issue.target}]`)} ${issue.message}`);
  }
  for (const issue of warnings) {
    console.log(
      `  ${pc.yellow("⚠")} ${pc.yellow(`[${issue.target}]`)} ${issue.message}`
    );
  }

  console.log("");
  const parts: string[] = [];
  if (errors.length) parts.push(pc.red(`${errors.length} error(s)`));
  if (warnings.length) parts.push(pc.yellow(`${warnings.length} warning(s)`));
  console.log(pc.bold("  Summary: ") + parts.join(", "));
  console.log("");

  return errors.length > 0 ? 1 : 0;
}

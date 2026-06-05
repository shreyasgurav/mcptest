/**
 * AI-powered test suite generator.
 *
 * Connects to an MCP server, reads tool schemas via listTools(),
 * sends them to Claude, and returns a complete mcptest YAML test suite.
 */

import Anthropic from "@anthropic-ai/sdk";
import { McpTestClient } from "./client.js";
import type { ServerConfig } from "../types.js";

/**
 * Generate a complete mcptest YAML test suite by introspecting a server's
 * tool schemas and using Claude to produce realistic test cases.
 */
export async function generateSuite(
  server: ServerConfig,
  apiKey: string
): Promise<string> {
  const client = new McpTestClient(server);
  await client.connect();

  const tools = await client.listTools();
  const resources = await client.listResources();
  const prompts = await client.listPrompts();

  await client.close();

  if (tools.length === 0 && resources.length === 0 && prompts.length === 0) {
    throw new Error(
      "Server exposes no tools, resources, or prompts. Nothing to generate tests for."
    );
  }

  const anthropic = new Anthropic({ apiKey });

  // Build the server config block for the YAML
  const serverBlock = buildServerBlock(server);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: `You are an expert at writing mcptest YAML test suites for MCP (Model Context Protocol) servers.

Here are the tools exposed by this MCP server:
${JSON.stringify(tools, null, 2)}

${resources.length > 0 ? `Here are the resources:\n${JSON.stringify(resources, null, 2)}` : ""}

${prompts.length > 0 ? `Here are the prompts:\n${JSON.stringify(prompts, null, 2)}` : ""}

Generate a complete mcptest YAML test suite that:
1. Tests each tool with realistic inputs derived from the input schemas
2. Tests happy path (successful calls with valid inputs)
3. Tests edge cases (empty strings, zero values, boundary conditions)
4. Tests error cases where appropriate (missing required fields — use isError: true)
5. Uses appropriate expect assertions: text, contains, matches, json with operators ($eq, $type, $minLength, $contains), schema, isError
6. Adds setup/teardown hooks where tools have state dependencies (e.g. create before delete)
7. Uses descriptive test names that explain what is being verified

Return ONLY valid YAML. No explanation. No markdown fences. No comments. Just the YAML content.

Use this exact structure:
name: <descriptive-suite-name>

server:
${serverBlock}

timeout: 15000

tests:
  - name: <descriptive test name>
    tool: <tool_name>
    input:
      <key>: <realistic value from schema>
    expect:
      <appropriate assertion>

${resources.length > 0 ? `resources:
  - name: <test name>
    uri: <resource uri>
    expect:
      contains: <expected content>` : ""}

${prompts.length > 0 ? `prompts:
  - name: <test name>
    prompt: <prompt name>
    args:
      <key>: <value>
    expect:
      contains: <expected content>` : ""}`,
      },
    ],
  });

  const yaml =
    response.content[0].type === "text" ? response.content[0].text : "";

  if (!yaml.trim()) {
    throw new Error("Claude returned empty response. Try again.");
  }

  return yaml;
}

function buildServerBlock(server: ServerConfig): string {
  const lines: string[] = [];
  if (server.transport) {
    lines.push(`  transport: ${server.transport}`);
  }
  if (server.command) {
    lines.push(`  command: ${server.command}`);
    if (server.args && server.args.length > 0) {
      lines.push(`  args:`);
      for (const arg of server.args) {
        lines.push(`    - ${arg}`);
      }
    }
  }
  if (server.url) {
    lines.push(`  url: ${server.url}`);
  }
  return lines.join("\n");
}

/**
 * echo-server.mjs
 *
 * A minimal MCP server with a handful of tools for dogfooding mcpunit.
 * Run with: node examples/echo-server.mjs
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "echo-server",
  version: "1.0.0",
});

// ── echo tool ─────────────────────────────────────────────────────
server.tool(
  "echo",
  "Echoes the input message back.",
  { message: z.string().describe("The message to echo") },
  async ({ message }) => ({
    content: [{ type: "text", text: message }],
  })
);

// ── add tool ──────────────────────────────────────────────────────
server.tool(
  "add",
  "Adds two numbers together.",
  {
    a: z.number().describe("First number"),
    b: z.number().describe("Second number"),
  },
  async ({ a, b }) => ({
    content: [{ type: "text", text: JSON.stringify({ result: a + b }) }],
  })
);

// ── greet tool ────────────────────────────────────────────────────
server.tool(
  "greet",
  "Returns a greeting for the given name.",
  { name: z.string().describe("Name to greet") },
  async ({ name }) => ({
    content: [{ type: "text", text: `Hello, ${name}! Welcome to mcpunit.` }],
  })
);

// ── get_info tool ─────────────────────────────────────────────────
server.tool(
  "get_info",
  "Returns structured JSON info about the server.",
  {},
  async () => ({
    content: [
      {
        type: "text",
        text: JSON.stringify({
          name: "echo-server",
          version: "1.0.0",
          tools: ["echo", "add", "greet", "get_info"],
          status: "healthy",
        }),
      },
    ],
  })
);

// ── Start ─────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);

/**
 * AI-powered test suite generator.
 *
 * Connects to an MCP server, reads tool schemas via listTools(),
 * sends them to a supported LLM provider, and returns a complete
 * mcpunit YAML test suite.
 *
 * Supported providers:
 *   - Anthropic Claude  (models: claude-*)
 *   - OpenAI GPT        (models: gpt-*, o1-*, o3-*)
 *   - Google Gemini     (models: gemini-*)
 *
 * Provider is auto-detected from the model name. API key can be set
 * via flag or environment variable (ANTHROPIC_API_KEY, OPENAI_API_KEY,
 * GOOGLE_API_KEY / GEMINI_API_KEY).
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { McpUnitClient } from "./client.js";
import type { ServerConfig } from "../types.js";

// ─── Provider Detection ────────────────────────────────────────────────────

export type LLMProvider = "anthropic" | "openai" | "google";

/**
 * Detect the provider from the model name string.
 * Falls back to heuristics on the API key if model is not given.
 */
export function detectProvider(model: string): LLMProvider {
  const m = model.toLowerCase();
  if (m.startsWith("claude")) return "anthropic";
  if (m.startsWith("gemini")) return "google";
  if (
    m.startsWith("gpt-") ||
    m.startsWith("o1") ||
    m.startsWith("o3") ||
    m.startsWith("o4")
  )
    return "openai";
  // Fallback: try to guess from key prefix (legacy behaviour)
  return "anthropic";
}

/** Default models per provider */
const DEFAULT_MODELS: Record<LLMProvider, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
  google: "gemini-2.0-flash",
};

// ─── Supported model catalogue (for --list-models) ────────────────────────

export const SUPPORTED_MODELS: Record<LLMProvider, string[]> = {
  anthropic: [
    "claude-opus-4-5",
    "claude-sonnet-4-5",
    "claude-haiku-4-5",
    "claude-sonnet-4-20250514",
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229",
  ],
  openai: [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-4",
    "o1",
    "o3",
    "o4-mini",
  ],
  google: [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
  ],
};

// ─── Resolve API key ──────────────────────────────────────────────────────

/**
 * Resolve the API key for a given provider from options or environment.
 */
export function resolveApiKey(
  provider: LLMProvider,
  providedKey?: string
): string {
  if (providedKey) return providedKey;
  switch (provider) {
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY ?? "";
    case "openai":
      return process.env.OPENAI_API_KEY ?? "";
    case "google":
      return (
        process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY ?? ""
      );
  }
}

// ─── LLM Callers ──────────────────────────────────────────────────────────

async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  return response.content[0].type === "text" ? response.content[0].text : "";
}

async function callOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 4096,
  });
  return response.choices[0]?.message?.content ?? "";
}

async function callGoogle(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genai = new GoogleGenerativeAI(apiKey);
  const gemini = genai.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
  });
  const result = await gemini.generateContent(userPrompt);
  return result.response.text();
}

// ─── Public API ───────────────────────────────────────────────────────────

export interface GenerateOptions {
  /** API key for the chosen provider. Falls back to env vars. */
  apiKey?: string;
  /**
   * Model to use. Provider is auto-detected from the model name.
   * Examples: "claude-sonnet-4-20250514", "gpt-4o", "gemini-2.0-flash"
   * Defaults to the best model for the detected provider.
   */
  model?: string;
}

/**
 * Generate a complete mcpunit YAML test suite by introspecting a server's
 * tool schemas and using the specified LLM to produce realistic test cases.
 */
export async function generateSuite(
  server: ServerConfig,
  apiKeyOrOptions: string | GenerateOptions
): Promise<string> {
  // Back-compat: first arg can be a plain API key string (legacy)
  let opts: GenerateOptions;
  if (typeof apiKeyOrOptions === "string") {
    opts = { apiKey: apiKeyOrOptions };
  } else {
    opts = apiKeyOrOptions;
  }

  // Determine provider + model
  const model = opts.model ?? "";
  const provider = model ? detectProvider(model) : inferProviderFromKey(opts.apiKey);
  const resolvedModel = model || DEFAULT_MODELS[provider];
  const apiKey = resolveApiKey(provider, opts.apiKey);

  if (!apiKey) {
    const envVar = {
      anthropic: "ANTHROPIC_API_KEY",
      openai: "OPENAI_API_KEY",
      google: "GOOGLE_API_KEY or GEMINI_API_KEY",
    }[provider];
    throw new Error(
      `No API key found for provider "${provider}". Set ${envVar} or pass --api-key.`
    );
  }

  // Connect to MCP server and introspect
  const client = new McpUnitClient(server);
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

  const serverBlock = buildServerBlock(server);
  const isRemote = server.transport === "http" || server.transport === "sse";
  const { systemPrompt, userPrompt } = buildPrompts(tools, resources, prompts, serverBlock, isRemote);

  // Call the appropriate provider
  let yaml = "";
  switch (provider) {
    case "anthropic":
      yaml = await callAnthropic(apiKey, resolvedModel, systemPrompt, userPrompt);
      break;
    case "openai":
      yaml = await callOpenAI(apiKey, resolvedModel, systemPrompt, userPrompt);
      break;
    case "google":
      yaml = await callGoogle(apiKey, resolvedModel, systemPrompt, userPrompt);
      break;
  }

  if (!yaml.trim()) {
    throw new Error("AI returned empty response. Try again.");
  }

  // Strip markdown fences if the model added them anyway
  yaml = yaml
    .replace(/^```ya?ml\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  return yaml;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * When no model is specified, guess the provider from the API key prefix.
 * This preserves backward-compatibility with the old --api-key heuristic.
 */
function inferProviderFromKey(apiKey?: string): LLMProvider {
  if (!apiKey) return "anthropic";
  if (apiKey.startsWith("sk-")) return "openai";
  if (apiKey.startsWith("AIza")) return "google";
  return "anthropic";
}

function buildPrompts(
  tools: unknown[],
  resources: unknown[],
  prompts: unknown[],
  serverBlock: string,
  isRemote: boolean
): { systemPrompt: string; userPrompt: string } {
  const timeoutValue = isRemote ? 30000 : 15000;

  const systemPrompt = `You are an expert at writing mcpunit YAML test suites for MCP (Model Context Protocol) servers.

Generate a complete mcpunit YAML test suite that:
1. Tests each tool with realistic inputs derived from the input schemas
2. Tests happy path (successful calls with valid inputs)
3. Tests edge cases (empty strings, zero values, boundary conditions)
4. Tests error cases where appropriate (missing required fields — use isError: true)
5. Uses appropriate expect assertions: text, contains, matches, json with operators ($eq, $type, $minLength, $contains), schema, isError
6. Adds setup/teardown hooks where tools have state dependencies (e.g. create before delete)
7. Uses descriptive test names that explain what is being verified
8. If a field has "format": "uuid" or its name ends with "_id" and the schema type is "string", generate a valid UUID like "00000000-0000-0000-0000-000000000000" — never use short placeholder strings like "abc123"
9. For fields named "project_id", "document_id", "id", or similar ID fields, always use valid UUID format unless the schema explicitly says otherwise

Return ONLY valid YAML. No explanation. No markdown fences. No comments. Just the YAML content.`;

  const userPrompt = `Here are the tools exposed by this MCP server:
${JSON.stringify(tools, null, 2)}

${resources.length > 0 ? `Here are the resources:\n${JSON.stringify(resources, null, 2)}` : ""}

${prompts.length > 0 ? `Here are the prompts:\n${JSON.stringify(prompts, null, 2)}` : ""}

Generate a YAML test suite using this exact structure:
name: <descriptive-suite-name>

server:
${serverBlock}

timeout: ${timeoutValue}

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
      contains: <expected content>` : ""}`;

  return { systemPrompt, userPrompt };
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
        lines.push(`    - "${arg.replace(/"/g, '\\"')}"`);
      }
    }
  }
  if (server.url) {
    lines.push(`  url: ${server.url}`);
  }
  if (server.headers && Object.keys(server.headers).length > 0) {
    lines.push(`  headers:`);
    for (const [k, v] of Object.entries(server.headers)) {
      lines.push(`    ${k}: "${v.replace(/"/g, '\\"')}"`);
    }
  }
  return lines.join("\n");
}

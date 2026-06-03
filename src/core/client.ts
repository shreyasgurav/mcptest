import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { ServerConfig } from "../types.js";

/** Shape of a tool returned by `listTools`. */
export interface ToolInfo {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

/** Normalized result of a tool call. */
export interface ToolCallResult {
  isError: boolean;
  /** Concatenated text from all text content blocks. */
  text: string;
  /** Raw content blocks. */
  content: unknown[];
  /** structuredContent if the server provided it. */
  structuredContent?: unknown;
}

/**
 * Thin wrapper around the official MCP SDK client that handles transport
 * selection, connection lifecycle and result normalization.
 */
export class McpTestClient {
  private client: Client;
  private transport?: Transport;
  private connected = false;

  constructor(private readonly server: ServerConfig) {
    this.client = new Client(
      { name: "mcptest", version: "0.1.0" },
      { capabilities: {} }
    );
  }

  /** Connect to the server using the configured transport. */
  async connect(): Promise<void> {
    if (this.connected) return;
    this.transport = this.buildTransport();
    await this.client.connect(this.transport);
    this.connected = true;
  }

  /** Close the connection (and terminate the subprocess for stdio). */
  async close(): Promise<void> {
    if (!this.connected) return;
    try {
      await this.client.close();
    } finally {
      this.connected = false;
    }
  }

  /** List the tools exposed by the server. */
  async listTools(): Promise<ToolInfo[]> {
    const res = await this.client.listTools();
    return (res.tools ?? []).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as Record<string, unknown> | undefined,
    }));
  }

  /** List resources exposed by the server (empty array if unsupported). */
  async listResources(): Promise<Array<{ uri: string; name?: string }>> {
    try {
      const res = await this.client.listResources();
      return (res.resources ?? []).map((r) => ({ uri: r.uri, name: r.name }));
    } catch {
      return [];
    }
  }

  /** List prompts exposed by the server (empty array if unsupported). */
  async listPrompts(): Promise<Array<{ name: string; description?: string }>> {
    try {
      const res = await this.client.listPrompts();
      return (res.prompts ?? []).map((p) => ({
        name: p.name,
        description: p.description,
      }));
    } catch {
      return [];
    }
  }

  /** Call a tool and return a normalized result. */
  async callTool(
    name: string,
    args: Record<string, unknown> | undefined,
    timeoutMs: number
  ): Promise<ToolCallResult> {
    const raw = (await this.client.callTool(
      { name, arguments: args ?? {} },
      undefined,
      { timeout: timeoutMs }
    )) as {
      isError?: boolean;
      content?: unknown[];
      structuredContent?: unknown;
    };

    const content = Array.isArray(raw.content) ? raw.content : [];
    const text = content
      .filter(
        (c): c is { type: string; text: string } =>
          typeof c === "object" &&
          c !== null &&
          (c as { type?: string }).type === "text"
      )
      .map((c) => c.text)
      .join("");

    return {
      isError: raw.isError === true,
      text,
      content,
      structuredContent: raw.structuredContent,
    };
  }

  private buildTransport(): Transport {
    const transport = this.server.transport ?? "stdio";

    if (transport === "stdio") {
      if (!this.server.command) {
        throw new Error(
          'stdio transport requires a "command" (e.g. "node", "python", "npx").'
        );
      }
      return new StdioClientTransport({
        command: this.server.command,
        args: this.server.args ?? [],
        // Merge process env so PATH etc. are available; allow overrides.
        env: { ...filterEnv(process.env), ...(this.server.env ?? {}) },
        cwd: this.server.cwd,
        stderr: "pipe",
      });
    }

    if (!this.server.url) {
      throw new Error(`${transport} transport requires a "url".`);
    }
    const url = new URL(this.server.url);
    const requestInit = this.server.headers
      ? { headers: this.server.headers }
      : undefined;

    if (transport === "sse") {
      return new SSEClientTransport(url, { requestInit });
    }
    return new StreamableHTTPClientTransport(url, { requestInit });
  }
}

/** Drop undefined values so the SDK env type (Record<string,string>) is satisfied. */
function filterEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "hook-test-server",
  version: "1.0.0",
});

let state = [];
let flakyAttempts = 0;

// Tool to reset state
server.tool(
  "reset",
  "Resets server state.",
  {},
  async () => {
    state = [];
    return { content: [{ type: "text", text: "reset ok" }] };
  }
);

// Tool to push item
server.tool(
  "add_item",
  "Pushes an item to state.",
  { item: z.string() },
  async ({ item }) => {
    state.push(item);
    return { content: [{ type: "text", text: `added: ${item}` }] };
  }
);

// Tool to retrieve items
server.tool(
  "get_items",
  "Retrieves all state items.",
  {},
  async () => {
    return { content: [{ type: "text", text: JSON.stringify(state) }] };
  }
);

// Tool that is flaky: fails twice then succeeds
server.tool(
  "flaky",
  "Succeeds on 3rd attempt, fails otherwise.",
  {},
  async () => {
    flakyAttempts++;
    if (flakyAttempts < 3) {
      return {
        isError: true,
        content: [{ type: "text", text: `flaky error attempt ${flakyAttempts}` }],
      };
    }
    return { content: [{ type: "text", text: "flaky success" }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);

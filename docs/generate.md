# AI Test Generation

`mcpunit generate` is the fastest way to get test coverage for an existing Model Context Protocol (MCP) server. 

Instead of manually writing tests for every single tool, `mcpunit` can connect to your server, introspect all available tools and their JSON schemas, send them to Claude (Anthropic), and automatically generate a complete test suite.

## Usage

Set your API key:
```bash
export ANTHROPIC_API_KEY="your-api-key"
```

Run the generate command against your server:

```bash
# Spawn a local server via stdio
npx mcpunit generate --command node --args server.js

# Or connect to a running server over HTTP
npx mcpunit generate --url http://localhost:3000/mcp --transport http

# Specify an output file
npx mcpunit generate --command node --args server.js -o tests/generated.mcpunit.yaml
```

## How it works

1. **Discovery:** `mcpunit` establishes a connection to the MCP server.
2. **Introspection:** It queries the server for all exposed tools and their argument schemas.
3. **Generation:** It uses the Anthropic API to analyze the tools and write a high-quality `mcpunit.yaml` test suite with logical inputs and assertions.
4. **Execution:** You can immediately run `npx mcpunit run tests/generated.mcpunit.yaml` to verify the generated tests.

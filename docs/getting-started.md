# Getting Started

mcpunit is a test runner built specifically for the Model Context Protocol (MCP). Write declarative test suites in YAML, run them in CI, and catch regressions before they ship.

## 1. Install

```bash
npm install mcpunit --save-dev
```

## 2. Initialize a Test Suite

```bash
npx mcpunit init
```

This creates a `mcpunit.yaml` starter file in your project.

## 3. Write Tests

Edit `mcpunit.yaml` to specify your server and the tools you want to test:

```yaml
name: my-mcp-tests

server:
  transport: stdio
  command: node
  args:
    - ./my-server.js

tests:
  - name: Echo returns input
    tool: echo
    input:
      message: "hello"
    expect:
      text: "hello"
```

## 4. Run Tests

```bash
npx mcpunit run
```

Run in watch mode to automatically re-test on file changes:

```bash
npx mcpunit run --watch
```

## Available Commands

### `mcpunit run [path]`
Run test suites against your MCP server.

```bash
npx mcpunit run                          # Auto-discover *.mcpunit.yaml files
npx mcpunit run tests/                   # Run all suites in a directory
npx mcpunit run --bail                   # Stop on first failure
npx mcpunit run --watch                  # Re-run on file changes
npx mcpunit run -f json                  # JSON output for CI parsing
npx mcpunit run -f html                  # Generate HTML report
npx mcpunit run --update-snapshots       # Overwrite/update saved snapshots
```

### `mcpunit init`
Generate a starter `mcpunit.yaml` config file to get started quickly.

### `mcpunit generate`
AI-generate a complete test suite from your server's tool schemas. Connects to your server, introspects all tools, and uses Claude or OpenAI to write tests with inputs and assertions.

```bash
npx mcpunit generate --command node --args server.js
npx mcpunit generate --url http://localhost:3000/mcp --transport http
npx mcpunit generate --command node --args server.js -o tests/generated.mcpunit.yaml
```

### `mcpunit list`
Inspect your MCP server — lists all tools with their descriptions in a formatted table. Great for exploring an unfamiliar server before writing tests.

### `mcpunit validate`
Validate your MCP server against spec conventions — tool naming, descriptions, input schemas.

### `mcpunit diff`
Compare two server versions by running the same test suite inputs against both and displaying a structural diff of the outputs.

```bash
npx mcpunit diff --server-a "node ./dist-v1/index.js" --server-b "node ./dist-v2/index.js" --suite tests.mcpunit.yaml
```

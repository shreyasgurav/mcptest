# Getting Started

mcpunit is a test runner built specifically for the Model Context Protocol (MCP). It allows you to write declarative test suites in YAML or JSON, and run them automatically in CI.

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

Edit `mcpunit.yaml` to specify your server launch command and the tools you want to test:

```yaml
# mcpunit.yaml
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

You can also run in watch mode to automatically re-test on file changes:

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
npx mcpunit run -f json                  # JSON output for CI parsing
npx mcpunit run -f html                  # Generate HTML report
npx mcpunit run --update-snapshots       # Overwrite/update saved snapshots
```

### `mcpunit list`
Inspect your MCP server — lists all tools with their descriptions in a formatted table. Great for exploring an unfamiliar server before writing tests.

### `mcpunit validate`
Validate your MCP server against spec conventions — tool naming, descriptions, input schemas.

### `mcpunit diff`
Compare two server versions (e.g., your production/main vs local development branch) by running the same test suite inputs against both and displaying a structural diff of the outputs.

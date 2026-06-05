<p align="center">
  <h1 align="center">mcptest</h1>
  <p align="center">
    <strong>The testing framework for MCP servers.</strong><br>
    Declarative. CI-first. Zero boilerplate.
  </p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@shreyasgurav/mcptest"><img alt="npm" src="https://img.shields.io/npm/v/@shreyasgurav/mcptest?style=flat-square&color=cb3837"></a>
  <a href="https://github.com/shreyasgurav/mcptest/blob/main/LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square"></a>
  <a href="https://nodejs.org"><img alt="node" src="https://img.shields.io/badge/node-%3E%3D18-green?style=flat-square"></a>
</p>

---

**mcptest** is the `pytest` / `vitest` equivalent for [Model Context Protocol](https://modelcontextprotocol.io/) servers.

Write declarative test suites in YAML or JSON. Run them in CI. Get pass/fail exit codes. No manual clicking — just `mcptest run`.

```bash
npx @shreyasgurav/mcptest run

  mcptest v0.1.0
  ─────────────────────────────────

● my-server-tests
  ✓ store_memory returns success (212ms)
  ✓ search finds stored memory (334ms)
  ✗ handles empty query gracefully
      isError: expected isError to be false
        expected: false
        actual:   true

Summary: 2 passed, 1 failed
3 tests across 1 suite(s) in 561ms
```

## Why mcptest?

| What exists today | What mcptest does |
|---|---|
| **MCP Inspector** — manual GUI, click-to-test | Automated test runner with assertions |
| **Postman/Apidog** — bolt-on MCP support | Purpose-built for MCP, declarative YAML |
| **Nothing for CI** — no automated regression testing | Exit code 1 on failure → GitHub Actions ready |

Every MCP server developer is currently "testing" by opening Inspector, clicking a tool, eyeballing the output, and hoping it works. That's 2012-era REST API testing. mcptest is Postman for MCP — but automated.

## Quick Start

### 1. Install

```bash
npm install @shreyasgurav/mcptest --save-dev
```

### 2. Create a test file

```bash
npx @shreyasgurav/mcptest init
```

This creates a `mcptest.yaml` starter. Or write your own:

```yaml
# mcptest.yaml
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

  - name: Search returns results
    tool: search
    input:
      query: "test"
    expect:
      json:
        results:
          $minLength: 1
```

### 3. Run

```bash
npx @shreyasgurav/mcptest run
```

That's it. Three commands. Zero boilerplate.

## Commands

### `mcptest run [path]`

Run test suites against your MCP server.

```bash
npx @shreyasgurav/mcptest run                          # Auto-discover *.mcptest.yaml files
npx @shreyasgurav/mcptest run tests/                   # Run all suites in a directory
npx @shreyasgurav/mcptest run my-tests.mcptest.yaml    # Run a specific file
npx @shreyasgurav/mcptest run --bail                   # Stop on first failure
npx @shreyasgurav/mcptest run -f json                  # JSON output for CI parsing
npx @shreyasgurav/mcptest run -t 30000                 # 30s timeout per test
npx @shreyasgurav/mcptest run --watch                  # Rerun on file changes
```

### `mcptest list`

Discover tools exposed by your MCP server before writing tests.

```bash
npx @shreyasgurav/mcptest list                                    # Uses mcptest.yaml in cwd
npx @shreyasgurav/mcptest list --config my-config.yaml            # Specific config
npx @shreyasgurav/mcptest list --command node --args server.js    # Inline
npx @shreyasgurav/mcptest list --url http://localhost:3000/mcp --transport http
```

```
  Tools (4):
  ┌─────────────┬────────────────────────────────────────────────────────────┐
  │ Tool Name   │ Description                                                │
  ├─────────────┼────────────────────────────────────────────────────────────┤
  │ echo        │ Echoes the input message back                              │
  │ add         │ Adds two numbers together                                  │
  └─────────────┴────────────────────────────────────────────────────────────┘
```

### `mcptest validate`

Validate your MCP server against spec conventions — tool naming, descriptions, input schemas.

```bash
npx @shreyasgurav/mcptest validate                                # Uses mcptest.yaml in cwd
npx @shreyasgurav/mcptest validate --config my-config.yaml        # Specific config
npx @shreyasgurav/mcptest validate --command node --args server.js # Inline
npx @shreyasgurav/mcptest validate --url http://localhost:3000/mcp --transport http
```

```
● MCP Server Validation
  4 tool(s), 0 resource(s), 0 prompt(s)

  ✓ No issues found. Server looks good!
```

### `mcptest init`

Scaffold a starter `mcptest.yaml` config file.

```bash
npx @shreyasgurav/mcptest init
npx @shreyasgurav/mcptest init -o tests/api.mcptest.yaml
```

## Test File Format

mcptest supports YAML (`.yaml`, `.yml`) and JSON (`.json`) test files.

### Server Configuration

```yaml
server:
  # stdio transport (spawn a subprocess)
  transport: stdio
  command: node
  args: ["./server.js"]
  env:
    API_KEY: "test-key"
  cwd: ./path/to/server

  # OR http transport (connect to running server)
  transport: http
  url: http://localhost:3000/mcp
  headers:
    Authorization: "Bearer token"

  # OR sse transport
  transport: sse
  url: http://localhost:3000/sse

  # Wait up to 10s for the server to become ready (stdio only, default 5000ms)
  startupTimeout: 10000
```

### Hooks and Retries

Use suite-level hooks to reset shared state, per-test setup/teardown for isolation, and retries for flaky tools.

```yaml
name: stateful-server-tests

server:
  transport: stdio
  command: node
  args: ["./server.js"]

# Run once before all tests
before:
  - tool: reset
    input: {}

# Run once after all tests
after:
  - tool: cleanup
    input: {}

tests:
  - name: Store then verify
    setup:
      - tool: add_item
        input: { item: "test-data" }
    tool: get_items
    expect:
      contains: "test-data"
    teardown:
      - tool: clear_items
        input: {}

  - name: Flaky AI-backed tool
    tool: generate
    input: { prompt: "hello" }
    retry: 3          # retry up to 3 times on failure
    retryDelay: 500   # ms between attempts
    expect:
      contains: "hello"
```

### Assertions

```yaml
tests:
  # Basic — just check it doesn't error
  - tool: my_tool

  # Text assertions
  - tool: greet
    input: { name: "World" }
    expect:
      text: "Hello, World!"         # Exact match
      contains: "Hello"             # Substring
      matches: "Hello, \\w+!"      # Regex

  # JSON assertions with operators
  - tool: search
    input: { query: "test" }
    expect:
      json:
        status: "success"           # Exact match
        count: { $gte: 1 }         # Greater than or equal
        results:
          $type: array              # Type check
          $minLength: 1             # Min array length

  # JSON Schema validation
  - tool: get_user
    input: { id: 1 }
    expect:
      schema:
        type: object
        required: [id, name, email]
        properties:
          id: { type: number }
          name: { type: string }
          email: { type: string }

  # Skip a test
  - tool: experimental_tool
    skip: true

  # Custom timeout
  - tool: slow_tool
    timeout: 30000
```

### Available Operators

| Operator | Description | Example |
|---|---|---|
| `$eq` | Exact equality | `{ $eq: 42 }` |
| `$ne` | Not equal | `{ $ne: null }` |
| `$gt` / `$gte` | Greater than (or equal) | `{ $gt: 0 }` |
| `$lt` / `$lte` | Less than (or equal) | `{ $lte: 100 }` |
| `$contains` | String includes / array contains | `{ $contains: "hello" }` |
| `$matches` | Regex match | `{ $matches: "^[a-z]+$" }` |
| `$type` | Type check | `{ $type: "array" }` |
| `$length` | Exact length | `{ $length: 5 }` |
| `$minLength` | Minimum length | `{ $minLength: 1 }` |
| `$maxLength` | Maximum length | `{ $maxLength: 100 }` |
| `$exists` | Not null/undefined | `{ $exists: true }` |
| `$in` | Value in array | `{ $in: ["a", "b", "c"] }` |

## GitHub Actions

```yaml
# .github/workflows/mcp-tests.yml
name: MCP Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - run: npx mcptest run
      - run: npx mcptest validate
```

mcptest exits with code `1` when any test fails — CI pipelines pick this up automatically.

## Programmatic API

Use mcptest as a library for custom test runners:

```typescript
import { McpTestClient, loadSuite, runSuite } from "@shreyasgurav/mcptest";

const suite = loadSuite("./tests/my-server.mcptest.yaml");
const result = await runSuite(suite, {
  bail: false,
  onResult: (r) => console.log(r.name, r.status),
});

console.log(`${result.passed} passed, ${result.failed} failed`);
```

## File Discovery

mcptest auto-discovers test files by scanning for:

- `*.mcptest.yaml` / `*.mcptest.yml` / `*.mcptest.json`
- `*.test.yaml` / `*.test.yml`
- Any YAML/JSON file with "mcptest" in the name

Just run `mcptest run` in your project root and it finds everything.

## Watch Mode

During development, rerun tests automatically when source or test files change:

```bash
npx @shreyasgurav/mcptest run --watch
```

Watches `.js`, `.mjs`, `.ts`, `.yaml`, `.yml`, and `.json` files (ignores `node_modules`, `dist`, `.git`). Press `Ctrl+C` to exit.

## Supported Transports

| Transport | Use Case |
|---|---|
| `stdio` | Local servers spawned as subprocesses (default) |
| `http` | Remote servers using Streamable HTTP |
| `sse` | Servers using Server-Sent Events |

## Contributing

```bash
git clone https://github.com/shreyasgurav/mcptest.git
cd mcptest
npm install
npm run build
node dist/cli.js run examples/echo.mcptest.yaml
```

## License

MIT

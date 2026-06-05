<p align="center">
  <h1 align="center">mcpunit</h1>
  <p align="center">
    <strong>The testing framework for MCP servers.</strong><br>
    Declarative. CI-first. Zero boilerplate.
  </p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@shreyasgurav/mcpunit"><img alt="npm" src="https://img.shields.io/npm/v/@shreyasgurav/mcpunit?style=flat-square&color=cb3837"></a>
  <a href="https://github.com/shreyasgurav/mcpunit/blob/main/LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square"></a>
  <a href="https://nodejs.org"><img alt="node" src="https://img.shields.io/badge/node-%3E%3D18-green?style=flat-square"></a>
</p>

---

**mcpunit** is the `pytest` / `vitest` equivalent for [Model Context Protocol](https://modelcontextprotocol.io/) servers.

Write declarative test suites in YAML or JSON. Run them in CI. Get pass/fail exit codes. No manual clicking — just `mcpunit run`.

```bash
npx @shreyasgurav/mcpunit run

  mcpunit v0.3.0
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

## Why mcpunit?

| What exists today | What mcpunit does |
|---|---|
| **MCP Inspector** — manual GUI, click-to-test | Automated test runner with assertions |
| **Postman/Apidog** — bolt-on MCP support | Purpose-built for MCP, declarative YAML |
| **Nothing for CI** — no automated regression testing | Exit code 1 on failure → GitHub Actions ready |

Every MCP server developer is currently "testing" by opening Inspector, clicking a tool, eyeballing the output, and hoping it works. That's 2012-era REST API testing. mcpunit is Postman for MCP — but automated.

## Real-World Example

Testing [UniMemory](https://unimemory.app) — a deployed MCP memory server:

```bash
mcpunit run examples/unimemory.mcpunit.yaml
```

```
● UniMemory MCP Server Test Suite
  ✓ List projects     (12092ms)
  ✓ Save content      (16467ms)  
  ✓ Search content    (16965ms)

Summary: 3 passed
```

## Quick Start

### 1. Install

```bash
npm install @shreyasgurav/mcpunit --save-dev
```

### 2. Create a test file

```bash
npx @shreyasgurav/mcpunit init
```

This creates a `mcpunit.yaml` starter. Or write your own:

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
npx @shreyasgurav/mcpunit run
```

That's it. Three commands. Zero boilerplate.

## Commands

### `mcpunit run [path]`

Run test suites against your MCP server.

```bash
npx @shreyasgurav/mcpunit run                          # Auto-discover *.mcpunit.yaml files
npx @shreyasgurav/mcpunit run tests/                   # Run all suites in a directory
npx @shreyasgurav/mcpunit run my-tests.mcpunit.yaml    # Run a specific file
npx @shreyasgurav/mcpunit run --bail                   # Stop on first failure
npx @shreyasgurav/mcpunit run -f json                  # JSON output for CI parsing
npx @shreyasgurav/mcpunit run -f html                  # Generate HTML report and open in browser
npx @shreyasgurav/mcpunit run --update-snapshots       # Overwrite/update saved snapshots
npx @shreyasgurav/mcpunit run -t 30000                 # 30s timeout per test
npx @shreyasgurav/mcpunit run --watch                  # Watch mode — reruns on file changes
```

### `mcpunit list`

Inspect your MCP server — lists all tools with their descriptions in a formatted table. Great for exploring an unfamiliar server before writing tests.

```bash
npx @shreyasgurav/mcpunit list                                   # Uses mcpunit.yaml in cwd
npx @shreyasgurav/mcpunit list --command node --args server.js   # Inline
npx @shreyasgurav/mcpunit list --url http://localhost:3000/mcp --transport http
```

```
  Tools (4):
  ┌──────────┬──────────────────────────────────────────────────────────────┐
  │ Tool Name │ Description                                                 │
  ├──────────┼──────────────────────────────────────────────────────────────┤
  │ echo      │ Echoes the input message back.                              │
  │ add       │ Adds two numbers together.                                  │
  │ greet     │ Returns a greeting for the given name.                      │
  │ get_info  │ Returns structured JSON info about the server.              │
  └──────────┴──────────────────────────────────────────────────────────────┘
```

### `mcpunit validate`

Validate your MCP server against spec conventions — tool naming, descriptions, input schemas.

```bash
npx @shreyasgurav/mcpunit validate                                # Uses mcpunit.yaml in cwd
npx @shreyasgurav/mcpunit validate --config my-config.yaml        # Specific config
npx @shreyasgurav/mcpunit validate --command node --args server.js # Inline
npx @shreyasgurav/mcpunit validate --url http://localhost:3000/mcp --transport http
```

```
● MCP Server Validation
  4 tool(s), 0 resource(s), 0 prompt(s)

  ✓ No issues found. Server looks good!
```

### `mcpunit init`

Scaffold a starter `mcpunit.yaml` config file.

```bash
npx @shreyasgurav/mcpunit init
npx @shreyasgurav/mcpunit init -o tests/api.mcpunit.yaml
```

### `mcpunit generate`

AI-generate a complete test suite (`mcpunit.yaml`) from your server's tool schemas. It connects to the server, queries its available tools, sends the schemas to Claude, and writes out a fully defined test suite.

```bash
# Set your Anthropic API Key
export ANTHROPIC_API_KEY="your-key"

npx @shreyasgurav/mcpunit generate --command node --args server.js
npx @shreyasgurav/mcpunit generate --url http://localhost:3000/mcp --transport http
npx @shreyasgurav/mcpunit generate -c my-config.yaml -o tests/generated.mcpunit.yaml
```

### `mcpunit diff`

Compare two server versions (e.g., your production/main vs local development branch) by running the same test suite inputs against both and displaying a structural diff of the outputs.

```bash
npx @shreyasgurav/mcpunit diff \
  --server-a "node ./dist-v1/index.js" \
  --server-b "node ./dist-v2/index.js" \
  --suite my-tests.mcpunit.yaml
```


## Test File Format

mcpunit supports YAML (`.yaml`, `.yml`) and JSON (`.json`) test files.

### Server Configuration

```yaml
server:
  # stdio transport (spawn a subprocess) — default
  transport: stdio
  command: node
  args: ["./server.js"]
  env:
    API_KEY: "test-key"
  cwd: ./path/to/server
  startupTimeout: 8000   # ms to wait for server to become ready (default: 5000)

  # OR http transport (connect to running server)
  # transport: http
  # url: http://localhost:3000/mcp
  # headers:
  #   Authorization: "Bearer token"

  # OR sse transport
  # transport: sse
  # url: http://localhost:3000/sse
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

### Hooks

Run tool calls before/after suites or individual tests — useful for seeding and cleaning up state.

```yaml
# Suite-level hooks (run once for the whole suite)
before:
  - tool: reset_database
    input: {}

after:
  - tool: cleanup
    input: {}

tests:
  - name: Test with per-test hooks
    setup:
      - tool: seed_user
        input: { id: 1, name: "Alice" }
    tool: get_user
    input: { id: 1 }
    expect:
      json:
        name: "Alice"
    teardown:
      - tool: delete_user
        input: { id: 1 }
```

- `before` / `after` — run once before/after all tests in the suite
- `setup` / `teardown` — run before/after each individual test
- `teardown` always runs, even if the test itself fails or errors

### Retries

For flaky tools (AI-backed responses, network calls), configure automatic retries:

```yaml
tests:
  - name: AI response check
    tool: generate_text
    input:
      prompt: "hello"
    retry: 3          # retry up to 3 times on failure/error
    retryDelay: 500   # ms between retries (default: 500)
    expect:
      contains: "hello"
```

### Watch Mode

Keep a terminal open while developing — mcpunit reruns your suite automatically whenever you change a `.js`, `.ts`, `.yaml`, or `.json` file:

```bash
npx @shreyasgurav/mcpunit run --watch
```

### Snapshot Testing

If your server returns complex JSON shapes or outputs that shouldn't change, you can use snapshot assertions.

```yaml
tests:
  - name: User Profile Stable Response
    tool: get_user
    input: { id: 1 }
    expect:
      snapshot: true
```

1. **First Run**: Creates a new snapshot file under `.mcpunit/snapshots/user_profile_stable_response.json` containing the tool's actual output.
2. **Subsequent Runs**: Compares the tool's output against the saved file and reports mismatches.
3. **Updating**: Run with `mcpunit run --update-snapshots` to overwrite existing snapshot files with the new responses.

### Resource & Prompt Testing

In addition to tools, `mcpunit` can test MCP **resources** and **prompts**.

#### Resource Testing
Define a `resources` block in your test suite to fetch and inspect resource contents.

```yaml
resources:
  - uri: "file:///logs/today.txt"
    expect:
      contains: "error"
      mimeType: "text/plain"
```

#### Prompt Testing
Define a `prompts` block in your test suite to evaluate prompt template rendering.

```yaml
prompts:
  - prompt: "summarize"
    args:
      text: "This is a long article..."
    expect:
      contains: "summary"
```

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
      - run: npx @shreyasgurav/mcpunit run
      - run: npx @shreyasgurav/mcpunit validate
```

mcpunit exits with code `1` when any test fails — CI pipelines pick this up automatically.

## Programmatic API

Use mcpunit as a library for custom test runners:

```typescript
import { McpUnitClient, loadSuite, runSuite } from "@shreyasgurav/mcpunit";

const suite = loadSuite("./tests/my-server.mcpunit.yaml");
const result = await runSuite(suite, {
  bail: false,
  onResult: (r) => console.log(r.name, r.status),
});

console.log(`${result.passed} passed, ${result.failed} failed`);
```

## File Discovery

mcpunit auto-discovers test files by scanning for:

- `*.mcpunit.yaml` / `*.mcpunit.yml` / `*.mcpunit.json`
- `*.test.yaml` / `*.test.yml`
- Any YAML/JSON file with "mcpunit" in the name

Just run `mcpunit run` in your project root and it finds everything.

## Supported Transports

| Transport | Use Case |
|---|---|
| `stdio` | Local servers spawned as subprocesses (default) |
| `http` | Remote servers using Streamable HTTP |
| `sse` | Servers using Server-Sent Events |

## Contributing

```bash
git clone https://github.com/shreyasgurav/mcpunit.git
cd mcpunit
npm install
npm run build
node dist/cli.js run examples/echo.mcpunit.yaml
node dist/cli.js list --command node --args examples/echo-server.mjs
```

## License

MIT

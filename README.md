<p align="center">
  <h1 align="center">mcpunit</h1>
  <p align="center">
    <strong>The testing framework for MCP servers.</strong><br>
    Write tests. Validate tools. Ship with confidence.
  </p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/mcpunit"><img alt="npm" src="https://img.shields.io/npm/v/mcpunit?style=flat-square&color=cb3837"></a>
  <a href="https://github.com/shreyasgurav/mcpunit/blob/main/LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square"></a>
  <a href="https://nodejs.org"><img alt="node" src="https://img.shields.io/badge/node-%3E%3D18-green?style=flat-square"></a>
</p>

---

Automated testing, assertions, snapshots, CI/CD, and AI-generated test suites for [Model Context Protocol](https://modelcontextprotocol.io/) servers.

```bash
npm install -D mcpunit
npx mcpunit run
```

## The Problem

Today most MCP developers test like this:

1. Start server
2. Open Inspector
3. Click a tool
4. Type some input
5. Hit run
6. Look at output
7. *Hope it works*
8. Repeat forever

That's manual testing. It's the equivalent of testing REST APIs by typing URLs into a browser.

## The Solution

Write declarative tests in YAML. Run them automatically.

```yaml
name: my-mcp-tests

server:
  transport: stdio
  command: node
  args: ["./server.js"]

tests:
  - name: Store a memory
    tool: store_memory
    input:
      content: "Testing mcpunit"
    expect:
      contains: "stored"

  - name: Search memories
    tool: search_memory
    input:
      query: "mcpunit"
    expect:
      json:
        results:
          $minLength: 1
```

```bash
npx mcpunit run

  mcpunit v0.5.0
  ─────────────────────────────────

  ● my-mcp-tests
    ✓ Store a memory    (212ms)
    ✓ Search memories   (334ms)

  Summary: 2 passed
```

Exit code 1 on failure. CI/CD ready out of the box.

## AI Test Generation

Don't want to write tests by hand? Let AI do it.

`mcpunit generate` connects to your server, discovers all tools and their schemas, and auto-generates a complete test suite.

```bash
export ANTHROPIC_API_KEY="sk-..."
npx mcpunit generate --command node --args server.js
```

→ discovers tools
→ reads schemas
→ generates `mcpunit.yaml` with inputs and assertions
→ run immediately with `npx mcpunit run`

## Features

- **Assertions** — Exact text, `contains`, regex, JSON path traversal, operators (`$gte`, `$contains`, `$minLength`), and full JSON Schema validation
- **Snapshots** — Lock complex JSON outputs. Catch regressions with `mcpunit run --update-snapshots`
- **Hooks** — `before`/`after` (suite-level) and `setup`/`teardown` (per-test) to seed and clean state
- **Retries** — Configurable `retry` and `retryDelay` for flaky AI-backed tools
- **Resources & Prompts** — Test MCP resources and prompt templates, not just tools
- **Watch Mode** — `mcpunit run --watch` reruns tests on file changes
- **Server Diff** — `mcpunit diff` compares responses from two server versions side-by-side
- **Validation** — `mcpunit validate` checks your server against MCP spec conventions
- **HTML Reports** — `mcpunit run -f html` generates a visual test report
- **AI Generation** — `mcpunit generate` creates test suites from your server's tool schemas
- **CI/CD** — JSON output, exit codes, and GitHub Actions integration

## Quick Start

```bash
# Install
npm install -D mcpunit

# Create a starter test file
npx mcpunit init

# Edit mcpunit.yaml with your server config and tests

# Run
npx mcpunit run
```

## Real-World Example

Testing [UniMemory](https://unimemory.app) — a deployed MCP memory server:

```bash
npx mcpunit run examples/unimemory.mcpunit.yaml
```

```
● UniMemory MCP Server Test Suite
  ✓ List projects     (12092ms)
  ✓ Save content      (16467ms)
  ✓ Search content    (16965ms)

Summary: 3 passed
```

## CI/CD Integration

Add to your GitHub Actions workflow:

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
      - run: npx mcpunit run
```

Every push triggers tests. Failures block the merge. No manual testing needed.

## All Commands

| Command | Description |
|---------|-------------|
| `mcpunit run [path]` | Run test suites (`--watch`, `--bail`, `-f json\|html`, `--update-snapshots`) |
| `mcpunit init` | Generate a starter `mcpunit.yaml` |
| `mcpunit generate` | AI-generate tests from server tool schemas |
| `mcpunit validate` | Check server against MCP spec conventions |
| `mcpunit list` | List all tools exposed by the server |
| `mcpunit diff` | Compare responses from two server versions |

## Documentation

- [Getting Started](docs/getting-started.md)
- [Assertions & JSON Operators](docs/assertions.md)
- [Hooks & Retries](docs/hooks.md)
- [Snapshot Testing](docs/snapshots.md)
- [AI Test Generation](docs/generate.md)

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions.

## License

MIT

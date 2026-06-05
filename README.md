<p align="center">
  <h1 align="center">mcpunit</h1>
  <p align="center">The testing framework for MCP servers.</p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/mcpunit"><img alt="npm" src="https://img.shields.io/npm/v/mcpunit?style=flat-square&color=cb3837"></a>
  <a href="https://github.com/shreyasgurav/mcpunit/blob/main/LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square"></a>
  <a href="https://nodejs.org"><img alt="node" src="https://img.shields.io/badge/node-%3E%3D18-green?style=flat-square"></a>
</p>

---

```bash
npx mcpunit run
```

```
  mcpunit v0.5.0

  ● my-mcp-server
    ✓ store_memory   (212ms)
    ✓ search_memory  (334ms)
    ✓ delete_memory  (98ms)

  Summary: 3 passed
```

That's it. Your MCP server is now tested automatically. Exit code 1 on failure — GitHub Actions ready.

---

## The Problem

Today most MCP developers test like this:

1. Start server
2. Open Inspector
3. Click a tool
4. Type some input
5. Hit run
6. Look at output
7. *Hope it works*
8. Repeat every time you change something

That's manual testing. It doesn't scale. It doesn't catch regressions. It doesn't run in CI.

## The Solution

Write declarative tests in YAML once. Run them forever.

```yaml
name: my-mcp-server

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

## AI Test Generation

Don't want to write tests by hand? Let AI do it.

`mcpunit generate` connects to your server, reads all tool schemas, and auto-generates a complete test suite. Works with **Claude, GPT-4o, and Gemini** — use whatever API key you already have.

```bash
# Claude (default)
export ANTHROPIC_API_KEY="sk-ant-..."
npx mcpunit generate --command node --args server.js

# GPT-4o
npx mcpunit generate --command node --args server.js --model gpt-4o

# Gemini
npx mcpunit generate --command node --args server.js --model gemini-2.0-flash
```

See all supported models:

```bash
npx mcpunit generate --list-models
```

## Features

- **Assertions** — `contains`, `text`, `matches`, JSON path operators (`$gte`, `$minLength`, `$contains`), JSON Schema
- **Snapshots** — Lock outputs, catch regressions with `--update-snapshots`
- **Hooks** — `before` / `after` suites, `setup` / `teardown` per test
- **Retries** — Built-in `retry` + `retryDelay` for flaky AI-backed tools
- **Resources & Prompts** — Test MCP resources and prompt templates, not just tools
- **Watch Mode** — `--watch` reruns tests on file changes
- **Server Diff** — Compare two server versions side-by-side
- **HTML Reports** — `--format html` for visual reports
- **CI/CD** — JSON output, exit codes, GitHub Actions out of the box

## Quick Start

```bash
npm install -D mcpunit
npx mcpunit init       # creates mcpunit.yaml
# edit the file, then:
npx mcpunit run
```

## Real-World Example

Testing [UniMemory](https://unimemory.app) — a live, deployed MCP server:

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

This runs against a real deployed server — not a toy example.

## CI/CD Integration

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

## Commands

| Command | Description |
|---------|-------------|
| `mcpunit run [path]` | Run test suites (`--watch`, `--bail`, `-f json\|html`, `--update-snapshots`) |
| `mcpunit init` | Create a starter `mcpunit.yaml` |
| `mcpunit generate` | AI-generate tests from server schemas (Claude / GPT-4o / Gemini) |
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

PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions.

## License

MIT

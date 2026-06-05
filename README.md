<p align="center">
  <h1 align="center">mcpunit</h1>
  <p align="center">
    <strong>The testing framework for MCP servers.</strong><br>
    Write tests. Validate tools. Ship with confidence.
  </p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/mcpunit"><img alt="npm" src="https://img.shields.io/npm/v/mcpunit?style=flat-square&color=cb3837"></a>
  <a href="https://github.com/shreyasgurav/mcptest/blob/main/LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square"></a>
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
3. Click tool
4. Type input
5. Run tool
6. Look at output
7. Hope it works
8. Repeat forever

That's manual testing. It's the equivalent of testing REST APIs by typing URLs into a browser.

## The Solution

Write declarative tests in YAML or JSON. 

```yaml
tests:
  - tool: search_memory
    input:
      query: "pizza"
    expect:
      json:
        results:
          $minLength: 1
```

Run them automatically.

```bash
npx mcpunit run

  ✓ store_memory (212ms)
  ✓ search_memory (334ms)
  ✗ delete_memory 

Summary: 2 passed, 1 failed
```

Now your MCP server is tested automatically. Exit code 1 on failure → GitHub Actions ready.

## The Magic: `mcpunit generate`

Don't want to write tests by hand? AI can do it for you.

`mcpunit generate` connects to your server, discovers available tools, sends schemas to Claude, and auto-generates a complete test suite for you.

```bash
npx mcpunit generate
```
↓ discovers tools  
↓ creates test suite  
↓ run tests  

## Features

- ✅ **Assertions:** Exact text, regex, JSON traversal, operators (`$gte`, `$contains`), and full JSON Schema validation.
- ✅ **Snapshots:** Lock complex JSON outputs and catch regressions with `mcpunit run --update-snapshots`.
- ✅ **Hooks:** `before`, `after`, `setup`, and `teardown` hooks to seed and clean state.
- ✅ **Retries:** Configurable retries for flaky AI-backed tools.
- ✅ **Resources & Prompts:** Full support for evaluating MCP resources and prompt templates.
- ✅ **CI/CD Ready:** Outputs JSON reports, HTML pages, and integrates seamlessly with GitHub Actions.
- ✅ **AI Test Generation:** Point at your server and get a full `mcpunit.yaml` generated.

## Documentation

- [Getting Started](docs/getting-started.md)
- [Assertions & JSON Operators](docs/assertions.md)
- [Hooks & Retries](docs/hooks.md)
- [Snapshot Testing](docs/snapshots.md)
- [AI Test Generation](docs/generate.md)

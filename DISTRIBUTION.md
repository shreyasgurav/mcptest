# Distribution Checklist

## Anthropic Discord (#mcp-developers)

Post this in the MCP developers channel:

---

Built **mcptest** — a declarative test runner for MCP servers (think pytest/vitest for MCP).

Write tests in YAML, run in CI, get pass/fail exit codes. No more manual Inspector clicking.

```bash
npm install @shreyasgurav/mcptest --save-dev
npx mcptest list          # discover tools
npx mcptest run           # run test suites
npx mcptest validate      # check spec conventions
```

Features: stdio/http/sse transports, JSON Schema assertions, hooks, retries, watch mode.

GitHub: https://github.com/shreyasgurav/mcptest
npm: https://www.npmjs.com/package/@shreyasgurav/mcptest

Would love feedback from anyone building MCP servers!

---

## awesome-mcp-servers

Submit a PR to https://github.com/punkpeye/awesome-mcp-servers (or the current canonical list).

Add under a **Testing / Developer Tools** section:

```markdown
- [mcptest](https://github.com/shreyasgurav/mcptest) - Declarative CLI test runner for MCP servers. YAML test suites, CI-ready, supports stdio/http/sse transports.
```

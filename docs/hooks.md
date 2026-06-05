# Hooks & Retries

Managing state and dealing with flaky tests is crucial when testing MCP servers, especially those backed by LLMs or external databases.

## Hooks

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

- `before` / `after` — run once before/after all tests in the suite.
- `setup` / `teardown` — run before/after each individual test.
- `teardown` always runs, even if the test itself fails or errors.

## Retries

For flaky tools (e.g. AI-backed responses, external API calls, eventual consistency), configure automatic retries.

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

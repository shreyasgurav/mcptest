# Snapshot Testing

If your server returns complex JSON shapes or outputs that shouldn't change, you can use snapshot assertions. This prevents you from having to write out massive JSON blobs in your test files, and instead automatically captures the output and compares it in future runs.

## Usage

```yaml
tests:
  - name: User Profile Stable Response
    tool: get_user
    input: { id: 1 }
    expect:
      snapshot: true
```

## Workflow

1. **First Run**: `mcpunit` creates a new snapshot file under `.mcpunit/snapshots/user_profile_stable_response.json` containing the tool's actual output.
2. **Subsequent Runs**: `mcpunit` compares the tool's new output against the saved file and reports mismatches.
3. **Updating Snapshots**: If your MCP server's expected output legitimately changes, run with the update flag to overwrite existing snapshot files with the new responses.

```bash
npx mcpunit run --update-snapshots
```

## When to use

Snapshots are fantastic for:
- Refactoring internal logic while ensuring the exact same output format is returned.
- Document-retrieval APIs where the content is static.
- Tools that output deeply nested structures.

Snapshots are *bad* for:
- AI-generated text responses (they will change slightly every time, causing failures).
- Date/Time endpoints.

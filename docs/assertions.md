# Assertions & JSON Operators

mcpunit provides a robust declarative assertion engine to validate tool outputs, resources, and prompt rendering.

## Text Assertions

```yaml
tests:
  - tool: greet
    input: { name: "World" }
    expect:
      text: "Hello, World!"         # Exact match
      contains: "Hello"             # Substring
      matches: "Hello, \\w+!"      # Regex
```

## JSON Assertions & Operators

You can traverse complex JSON objects and apply operators to validate data shapes, lengths, and values.

```yaml
tests:
  - tool: search
    input: { query: "test" }
    expect:
      json:
        status: "success"           # Exact match
        count: { $gte: 1 }         # Greater than or equal
        results:
          $type: array              # Type check
          $minLength: 1             # Min array length
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

## JSON Schema Validation

For strict schema compliance, you can validate the entire JSON response against a JSON Schema.

```yaml
tests:
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
```

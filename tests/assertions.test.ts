import { describe, it, expect } from "vitest";
import { evaluate, evaluateResource, evaluatePrompt, deepEqual } from "../src/core/assertions.js";
import type { ToolCallResult, ResourceResult, PromptResult } from "../src/core/client.js";

function makeResult(overrides: Partial<ToolCallResult> = {}): ToolCallResult {
  return {
    isError: false,
    text: "",
    content: [],
    ...overrides,
  };
}

describe("evaluate", () => {
  describe("isError", () => {
    it("passes when isError matches expected (default false)", () => {
      const results = evaluate(undefined, makeResult());
      expect(results).toHaveLength(1);
      expect(results[0].ok).toBe(true);
      expect(results[0].path).toBe("isError");
    });

    it("fails when isError is true but expected false", () => {
      const results = evaluate(undefined, makeResult({ isError: true }));
      expect(results[0].ok).toBe(false);
    });

    it("passes when isError is true and expected true", () => {
      const results = evaluate({ isError: true }, makeResult({ isError: true }));
      expect(results[0].ok).toBe(true);
    });
  });

  describe("contains", () => {
    it("passes when text contains substring", () => {
      const results = evaluate(
        { contains: "hello" },
        makeResult({ text: "say hello world" })
      );
      const containsResult = results.find((r) => r.path === "text" && r.message.includes("contain"));
      expect(containsResult?.ok).toBe(true);
    });

    it("fails when text does not contain substring", () => {
      const results = evaluate(
        { contains: "goodbye" },
        makeResult({ text: "hello world" })
      );
      const containsResult = results.find((r) => r.path === "text" && r.message.includes("contain"));
      expect(containsResult?.ok).toBe(false);
    });
  });

  describe("matches", () => {
    it("passes when text matches regex", () => {
      const results = evaluate(
        { matches: "^hello\\s" },
        makeResult({ text: "hello world" })
      );
      const matchResult = results.find((r) => r.message.includes("match"));
      expect(matchResult?.ok).toBe(true);
    });

    it("fails when text does not match regex", () => {
      const results = evaluate(
        { matches: "^world" },
        makeResult({ text: "hello world" })
      );
      const matchResult = results.find((r) => r.message.includes("match"));
      expect(matchResult?.ok).toBe(false);
    });
  });

  describe("text", () => {
    it("passes on exact match", () => {
      const results = evaluate(
        { text: "hello" },
        makeResult({ text: "hello" })
      );
      const textResult = results.find((r) => r.message === "expected text to equal");
      expect(textResult?.ok).toBe(true);
    });

    it("fails on mismatch", () => {
      const results = evaluate(
        { text: "hello" },
        makeResult({ text: "goodbye" })
      );
      const textResult = results.find((r) => r.message === "expected text to equal");
      expect(textResult?.ok).toBe(false);
    });
  });

  describe("json", () => {
    it("passes when JSON values match", () => {
      const results = evaluate(
        { json: { status: "ok", count: 5 } },
        makeResult({ text: '{"status":"ok","count":5}' })
      );
      const jsonResults = results.filter((r) => r.path.startsWith("json"));
      expect(jsonResults.every((r) => r.ok)).toBe(true);
    });

    it("fails when JSON value mismatches", () => {
      const results = evaluate(
        { json: { status: "ok" } },
        makeResult({ text: '{"status":"error"}' })
      );
      const statusResult = results.find((r) => r.path === "json.status");
      expect(statusResult?.ok).toBe(false);
    });

    it("fails when output is not valid JSON", () => {
      const results = evaluate(
        { json: { status: "ok" } },
        makeResult({ text: "not json" })
      );
      const jsonResult = results.find((r) => r.path === "json");
      expect(jsonResult?.ok).toBe(false);
    });

    it("uses structuredContent when available", () => {
      const results = evaluate(
        { json: { value: 42 } },
        makeResult({ text: "", structuredContent: { value: 42 } })
      );
      const jsonResult = results.find((r) => r.path === "json.value");
      expect(jsonResult?.ok).toBe(true);
    });
  });

  describe("json operators", () => {
    it("$eq passes on equality", () => {
      const results = evaluate(
        { json: { count: { $eq: 5 } } },
        makeResult({ text: '{"count":5}' })
      );
      const opResult = results.find((r) => r.path === "json.count");
      expect(opResult?.ok).toBe(true);
    });

    it("$ne passes on inequality", () => {
      const results = evaluate(
        { json: { status: { $ne: "error" } } },
        makeResult({ text: '{"status":"ok"}' })
      );
      const opResult = results.find((r) => r.path === "json.status");
      expect(opResult?.ok).toBe(true);
    });

    it("$contains passes when string contains substring", () => {
      const results = evaluate(
        { json: { msg: { $contains: "world" } } },
        makeResult({ text: '{"msg":"hello world"}' })
      );
      const opResult = results.find((r) => r.path === "json.msg");
      expect(opResult?.ok).toBe(true);
    });

    it("$type checks value type", () => {
      const results = evaluate(
        { json: { count: { $type: "number" } } },
        makeResult({ text: '{"count":42}' })
      );
      const opResult = results.find((r) => r.path === "json.count");
      expect(opResult?.ok).toBe(true);
    });

    it("$minLength checks array/string length", () => {
      const results = evaluate(
        { json: { items: { $minLength: 2 } } },
        makeResult({ text: '{"items":["a","b","c"]}' })
      );
      const opResult = results.find((r) => r.path === "json.items");
      expect(opResult?.ok).toBe(true);
    });

    it("$maxLength checks array/string length", () => {
      const results = evaluate(
        { json: { items: { $maxLength: 5 } } },
        makeResult({ text: '{"items":["a","b"]}' })
      );
      const opResult = results.find((r) => r.path === "json.items");
      expect(opResult?.ok).toBe(true);
    });

    it("$gt passes when value is greater", () => {
      const results = evaluate(
        { json: { score: { $gt: 50 } } },
        makeResult({ text: '{"score":75}' })
      );
      const opResult = results.find((r) => r.path === "json.score");
      expect(opResult?.ok).toBe(true);
    });

    it("$lt passes when value is less", () => {
      const results = evaluate(
        { json: { score: { $lt: 100 } } },
        makeResult({ text: '{"score":75}' })
      );
      const opResult = results.find((r) => r.path === "json.score");
      expect(opResult?.ok).toBe(true);
    });

    it("$matches applies regex to string", () => {
      const results = evaluate(
        { json: { email: { $matches: "^[a-z]+@" } } },
        makeResult({ text: '{"email":"test@example.com"}' })
      );
      const opResult = results.find((r) => r.path === "json.email");
      expect(opResult?.ok).toBe(true);
    });

    it("$exists checks presence", () => {
      const results = evaluate(
        { json: { name: { $exists: true } } },
        makeResult({ text: '{"name":"test"}' })
      );
      const opResult = results.find((r) => r.path === "json.name");
      expect(opResult?.ok).toBe(true);
    });

    it("$in checks membership", () => {
      const results = evaluate(
        { json: { status: { $in: ["ok", "pending"] } } },
        makeResult({ text: '{"status":"ok"}' })
      );
      const opResult = results.find((r) => r.path === "json.status");
      expect(opResult?.ok).toBe(true);
    });
  });

  describe("schema", () => {
    it("passes when output matches schema", () => {
      const results = evaluate(
        {
          schema: {
            type: "object",
            required: ["name"],
            properties: { name: { type: "string" } },
          },
        },
        makeResult({ text: '{"name":"test"}' })
      );
      const schemaResult = results.find((r) => r.path === "schema");
      expect(schemaResult?.ok).toBe(true);
    });

    it("fails when output violates schema", () => {
      const results = evaluate(
        {
          schema: {
            type: "object",
            required: ["name"],
            properties: { name: { type: "string" } },
          },
        },
        makeResult({ text: '{"age":42}' })
      );
      const schemaResult = results.find((r) => r.path === "schema");
      expect(schemaResult?.ok).toBe(false);
    });
  });
});

describe("evaluateResource", () => {
  it("passes basic read", () => {
    const result: ResourceResult = { uri: "file:///test", text: "hello world" };
    const assertions = evaluateResource(undefined, result);
    expect(assertions[0].ok).toBe(true);
  });

  it("checks mimeType", () => {
    const result: ResourceResult = {
      uri: "file:///test",
      mimeType: "text/plain",
      text: "content",
    };
    const assertions = evaluateResource({ mimeType: "text/plain" }, result);
    const mimeResult = assertions.find((a) => a.path === "mimeType");
    expect(mimeResult?.ok).toBe(true);
  });

  it("fails on mimeType mismatch", () => {
    const result: ResourceResult = {
      uri: "file:///test",
      mimeType: "text/html",
      text: "content",
    };
    const assertions = evaluateResource({ mimeType: "text/plain" }, result);
    const mimeResult = assertions.find((a) => a.path === "mimeType");
    expect(mimeResult?.ok).toBe(false);
  });

  it("checks contains", () => {
    const result: ResourceResult = { uri: "file:///test", text: "hello world" };
    const assertions = evaluateResource({ contains: "world" }, result);
    const containsResult = assertions.find((a) => a.message.includes("contain"));
    expect(containsResult?.ok).toBe(true);
  });
});

describe("evaluatePrompt", () => {
  it("passes basic render", () => {
    const result: PromptResult = { text: "hello prompt", messages: [] };
    const assertions = evaluatePrompt(undefined, result);
    expect(assertions[0].ok).toBe(true);
  });

  it("checks contains", () => {
    const result: PromptResult = { text: "summarize this content", messages: [] };
    const assertions = evaluatePrompt({ contains: "summarize" }, result);
    const containsResult = assertions.find((a) => a.message.includes("contain"));
    expect(containsResult?.ok).toBe(true);
  });

  it("checks text equality", () => {
    const result: PromptResult = { text: "exact text", messages: [] };
    const assertions = evaluatePrompt({ text: "exact text" }, result);
    const textResult = assertions.find((a) => a.message.includes("equal"));
    expect(textResult?.ok).toBe(true);
  });
});

describe("deepEqual", () => {
  it("compares primitives", () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual("a", "a")).toBe(true);
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual("a", "b")).toBe(false);
  });

  it("compares null", () => {
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(null, undefined)).toBe(false);
  });

  it("compares arrays", () => {
    expect(deepEqual([1, 2], [1, 2])).toBe(true);
    expect(deepEqual([1, 2], [1, 3])).toBe(false);
    expect(deepEqual([1], [1, 2])).toBe(false);
  });

  it("compares objects", () => {
    expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it("compares nested structures", () => {
    expect(
      deepEqual(
        { a: [1, { b: 2 }] },
        { a: [1, { b: 2 }] }
      )
    ).toBe(true);
    expect(
      deepEqual(
        { a: [1, { b: 2 }] },
        { a: [1, { b: 3 }] }
      )
    ).toBe(false);
  });
});

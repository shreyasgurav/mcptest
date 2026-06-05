import { describe, it, expect, vi, beforeEach } from "vitest";
import { runSuite } from "../src/core/runner.js";
import { McpUnitClient } from "../src/core/client.js";
import type { TestSuite } from "../src/types.js";

// Mock McpUnitClient
vi.mock("../src/core/client.js", () => {
  return {
    McpUnitClient: vi.fn().mockImplementation(() => {
      return {
        connect: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        callTool: vi.fn(),
        readResource: vi.fn(),
        getPrompt: vi.fn(),
      };
    }),
  };
});

describe("runSuite", () => {
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Retrieve the mock implementation instances
    mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      callTool: vi.fn().mockResolvedValue({ isError: false, text: "success", content: [] }),
      readResource: vi.fn().mockResolvedValue({ uri: "", text: "resource content" }),
      getPrompt: vi.fn().mockResolvedValue({ text: "prompt content", messages: [] }),
    };
    vi.mocked(McpUnitClient).mockImplementation(() => mockClient);
  });

  it("runs a simple test suite successfully", async () => {
    const suite: TestSuite = {
      name: "simple",
      server: { transport: "stdio", command: "node" },
      tests: [
        {
          name: "test 1",
          tool: "echo",
          input: { message: "hello" },
          expect: { contains: "hello" },
        },
      ],
    };

    mockClient.callTool.mockResolvedValueOnce({
      isError: false,
      text: "hello",
      content: [{ type: "text", text: "hello" }],
    });

    const res = await runSuite(suite);

    expect(mockClient.connect).toHaveBeenCalledTimes(1);
    expect(mockClient.callTool).toHaveBeenCalledWith("echo", { message: "hello" }, 15000);
    expect(mockClient.close).toHaveBeenCalledTimes(1);

    expect(res.passed).toBe(1);
    expect(res.failed).toBe(0);
    expect(res.errored).toBe(0);
    expect(res.results[0].status).toBe("passed");
  });

  it("handles skipped tests", async () => {
    const suite: TestSuite = {
      name: "skipped-suite",
      server: { transport: "stdio", command: "node" },
      tests: [
        {
          name: "skipped test",
          tool: "echo",
          skip: true,
        },
      ],
    };

    const res = await runSuite(suite);

    expect(mockClient.callTool).not.toHaveBeenCalled();
    expect(res.skipped).toBe(1);
    expect(res.passed).toBe(0);
    expect(res.results[0].status).toBe("skipped");
  });

  it("runs hooks in correct order", async () => {
    const suite: TestSuite = {
      name: "hooks-suite",
      server: { transport: "stdio", command: "node" },
      before: [{ tool: "beforeAllHook" }],
      after: [{ tool: "afterAllHook" }],
      tests: [
        {
          name: "test",
          tool: "mainTool",
          setup: [{ tool: "setupHook" }],
          teardown: [{ tool: "teardownHook" }],
        },
      ],
    };

    const callOrder: string[] = [];
    mockClient.callTool.mockImplementation((toolName: string) => {
      callOrder.push(toolName);
      return Promise.resolve({ isError: false, text: "ok", content: [] });
    });

    const res = await runSuite(suite);

    expect(res.passed).toBe(1);
    expect(callOrder).toEqual([
      "beforeAllHook",
      "setupHook",
      "mainTool",
      "teardownHook",
      "afterAllHook",
    ]);
  });

  it("handles test retry on failure", async () => {
    const suite: TestSuite = {
      name: "retry-suite",
      server: { transport: "stdio", command: "node" },
      tests: [
        {
          name: "retry test",
          tool: "flakyTool",
          retry: 2,
          retryDelay: 10,
          expect: { contains: "ok" },
        },
      ],
    };

    // Fails twice, passes third time
    mockClient.callTool
      .mockResolvedValueOnce({ isError: false, text: "fail", content: [] })
      .mockResolvedValueOnce({ isError: false, text: "fail", content: [] })
      .mockResolvedValueOnce({ isError: false, text: "ok", content: [] });

    const res = await runSuite(suite);

    expect(mockClient.callTool).toHaveBeenCalledTimes(3);
    expect(res.passed).toBe(1);
    expect(res.failed).toBe(0);
  });

  it("bails after first failure when bail option is set", async () => {
    const suite: TestSuite = {
      name: "bail-suite",
      server: { transport: "stdio", command: "node" },
      tests: [
        {
          name: "test 1 (fails)",
          tool: "failTool",
          expect: { contains: "ok" },
        },
        {
          name: "test 2 (skipped due to bail)",
          tool: "someTool",
        },
      ],
    };

    mockClient.callTool.mockResolvedValue({ isError: false, text: "bad", content: [] });

    const res = await runSuite(suite, { bail: true });

    expect(mockClient.callTool).toHaveBeenCalledTimes(1); // Second test never run
    expect(res.failed).toBe(1);
    expect(res.results).toHaveLength(1);
  });

  it("runs resource tests", async () => {
    const suite: TestSuite = {
      name: "resources-suite",
      server: { transport: "stdio", command: "node" },
      tests: [],
      resources: [
        {
          uri: "file:///test-uri",
          expect: { contains: "resource text" },
        },
      ],
    };

    mockClient.readResource.mockResolvedValue({
      uri: "file:///test-uri",
      text: "this is some resource text content",
    });

    const res = await runSuite(suite);

    expect(mockClient.readResource).toHaveBeenCalledWith("file:///test-uri", 15000);
    expect(res.passed).toBe(1);
    expect(res.results[0].tool).toBe("resource:file:///test-uri");
  });

  it("runs prompt tests", async () => {
    const suite: TestSuite = {
      name: "prompts-suite",
      server: { transport: "stdio", command: "node" },
      tests: [],
      prompts: [
        {
          prompt: "test-prompt",
          args: { inputVal: "hello" },
          expect: { contains: "prompt response" },
        },
      ],
    };

    mockClient.getPrompt.mockResolvedValue({
      text: "this is prompt response text",
      messages: [],
    });

    const res = await runSuite(suite);

    expect(mockClient.getPrompt).toHaveBeenCalledWith("test-prompt", { inputVal: "hello" }, 15000);
    expect(res.passed).toBe(1);
    expect(res.results[0].tool).toBe("prompt:test-prompt");
  });
});

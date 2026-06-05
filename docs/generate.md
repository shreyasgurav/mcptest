# AI Test Generation

`mcpunit generate` is the fastest way to get test coverage for an existing MCP server.

Instead of manually writing tests for every tool, `mcpunit generate` connects to your server, introspects all available tools and their JSON schemas, sends them to an LLM, and generates a complete test suite.

## Supported Models

mcpunit works with any major LLM provider. The provider is **auto-detected from the model name** — you don't need to specify it separately.

| Provider | Example models |
|----------|----------------|
| **Anthropic** | `claude-sonnet-4-20250514`, `claude-3-5-haiku-20241022` |
| **OpenAI** | `gpt-4o`, `gpt-4o-mini`, `o1`, `o3` |
| **Google** | `gemini-2.0-flash`, `gemini-1.5-pro` |

See all supported models:

```bash
npx mcpunit generate --list-models
```

## Usage

### Set your API key

```bash
# Anthropic (default)
export ANTHROPIC_API_KEY="sk-ant-..."

# OpenAI
export OPENAI_API_KEY="sk-..."

# Google Gemini
export GOOGLE_API_KEY="AIza..."
```

### Generate with the default model

When no `--model` is specified, mcpunit uses the best available model for whichever provider key is set in your environment.

```bash
# Uses claude-sonnet-4-20250514 (if ANTHROPIC_API_KEY is set)
npx mcpunit generate --command node --args server.js

# Uses gpt-4o (if OPENAI_API_KEY is set)
npx mcpunit generate --command node --args server.js
```

### Pick a specific model

```bash
# Anthropic Claude
npx mcpunit generate --command node --args server.js --model claude-3-5-haiku-20241022

# OpenAI GPT
npx mcpunit generate --command node --args server.js --model gpt-4o-mini

# Google Gemini
npx mcpunit generate --command node --args server.js --model gemini-2.0-flash
```

### Connect to an HTTP server

```bash
npx mcpunit generate --url http://localhost:3000/mcp --transport http --model gpt-4o
```

### Specify an output file

```bash
npx mcpunit generate --command node --args server.js -o tests/generated.mcpunit.yaml
```

### Pass the API key inline

```bash
npx mcpunit generate --command node --args server.js --model gemini-2.0-flash --api-key AIza...
```

## How it works

1. **Discovery:** mcpunit establishes a connection to the MCP server.
2. **Introspection:** It queries for all exposed tools, resources, and prompts with their argument schemas.
3. **Generation:** It sends the schemas to the chosen LLM with a structured prompt to write realistic inputs and assertions.
4. **Output:** A complete `mcpunit.yaml` is written to disk.
5. **Run immediately:**
   ```bash
   npx mcpunit run mcpunit.yaml
   ```

## Environment Variables

| Variable | Provider |
|----------|----------|
| `ANTHROPIC_API_KEY` | Anthropic Claude |
| `OPENAI_API_KEY` | OpenAI GPT |
| `GOOGLE_API_KEY` | Google Gemini |
| `GEMINI_API_KEY` | Google Gemini (alias) |

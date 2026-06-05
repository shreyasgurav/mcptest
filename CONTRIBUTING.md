# Contributing to mcptest

We welcome contributions to mcptest! Whether you want to fix a bug, add a feature, or improve the documentation, this guide will help you get started.

## Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/shreyasgurav/mcptest.git
   cd mcptest
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the codebase:**
   We use `tsup` to compile TypeScript to ESM.
   ```bash
   npm run build
   ```
   Or run the build in watch mode during development:
   ```bash
   npm run dev
   ```

4. **Verify it works:**
   Run the example integration tests against the included echo server:
   ```bash
   node dist/cli.js run examples/echo.mcptest.yaml
   ```

## Testing

We use [Vitest](https://vitest.dev/) for unit testing. Please write tests for any new features or bug fixes.

- **Run all unit tests:**
  ```bash
  npm run test
  ```
- **Run tests in watch mode:**
  ```bash
  npm run test:watch
  ```

## Pull Request Guidelines

1. **Create a branch:**
   Use a descriptive branch name, e.g., `feat/my-feature` or `fix/some-bug`.
2. **Write tests:**
   Ensure unit test coverage for code changes.
3. **Run type checking & build:**
   ```bash
   npm run typecheck
   npm run build
   ```
4. **Commit messages:**
   We follow standard conventional commits (e.g. `feat: add awesome feature`, `fix: handle edge case`).

## Questions or Support

Feel free to open an issue on GitHub or reach out on the Anthropic Discord in the `#mcp-developers` channel.

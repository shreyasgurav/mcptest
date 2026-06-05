# npm Package Name Request

Send this email to **support@npmjs.com**.

---

**Subject:** Request for manual review: mcptest package name exception

Hi npm Support,

I'm writing to request a manual review for publishing a package named `mcptest` to the npm registry.

Currently, the automated typo-squatting protection is blocking my publish because of similarity with `mcp-test`. However, these are fundamentally different packages with no overlap in purpose:

- `mcp-test` (existing): A client library for MCP protocol testing
- `mcptest` (my package): A declarative CLI test runner framework for MCP servers — similar in concept to pytest or vitest, but purpose-built for the Model Context Protocol ecosystem

The package is already published under my scoped name `@shreyasgurav/mcptest`:
https://www.npmjs.com/package/@shreyasgurav/mcptest

The GitHub repository is here:
https://github.com/shreyasgurav/mcptest

The naming convention I followed is intentional — `mcptest` follows the same pattern as `pytest`, `vitest`, and `doctest`, which developers immediately recognize as "the testing framework for X." The hyphenated `mcp-test` does not occupy this space and serves a different purpose entirely.

I'd really appreciate a manual override so developers can use `npx mcptest run` rather than the scoped version. Happy to provide any additional context.

Thank you for your time.

Best regards,
Shreyas Gurav
https://github.com/shreyasgurav/mcptest

# AutoOC v1.5.4

## Highlights

- Adds an encrypted Secrets vault with UI PIN protection for reveal/edit/delete actions.
- Injects configured secrets as temporary environment variables when OpenCode is launched from AutoOC.
- Adds optional `autooc-mcp`, installed from the Secrets tab, for agents and MCP-aware harnesses.
- Runs `autooc-mcp` as a self-contained FastMCP Python script via `uv`.
- Adds user-facing setup help for missing `uv` and manual harness JSON copy.

## Notes

- Secret values are encrypted by Electron secure storage when saved.
- The PIN protects the UI only and can be reset without deleting secrets.
- OpenCode must be restarted after installing `autooc-mcp`.
- OpenCode must be launched from AutoOC when tasks need injected secret environment variables.

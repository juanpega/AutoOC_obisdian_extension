# AutoOC v1.6.0

## Summary

AutoOC 1.6.0 adds native Codex integration alongside OpenCode, including background task execution and folder-linked interactive tasks in the Codex desktop app.

## Added

- Automatic Codex tasks with selectable model and reasoning effort.
- Streaming Codex output, approval handling, interruption, and task history metadata.
- A ChatGPT / Codex interactive launcher for the folder selected in Obsidian.
- Codex App Server model discovery and Windows desktop binary detection.

## Changed

- Interactive Codex tasks now open as persistent, empty conversations named after the selected folder.
- The launcher targets the exact task through the documented Codex thread URL instead of simulating `Ctrl+N` or using temporary application profiles.

## Fixed

- Preserve the selected working directory when opening an interactive Codex task.
- Avoid showing an AutoOC verification prompt as pre-filled conversation history.

## Verification

- Automated test suite passes on the supported test matrix.
- Production bundle compiles successfully.
- The interactive launcher was verified with a persistent task containing zero turns and the expected local working directory.

## Installation

1. Download the release files or release archive.
2. Copy `main.js`, `manifest.json`, and `styles.css` into `.obsidian/plugins/auto-oc/`.
3. Reload Obsidian with `Ctrl+Shift+P` → `Reload app without saving`.
4. Enable AutoOC in Community plugins if necessary.

## Requirements

- Obsidian Desktop.
- Codex desktop app or Codex CLI for Codex tasks.
- OpenCode for existing OpenCode task modes.

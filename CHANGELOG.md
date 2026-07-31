# Changelog

## [Unreleased]

### Fixed
- Auto-detect the `opencode` binary on macOS/Linux. Obsidian (an Electron GUI app) does not inherit the shell `PATH`, so commands like `opencode models` previously failed with "command not found" and left the model list empty. The plugin now probes common install locations (`~/.bun/bin`, `~/.local/bin`, `~/.npm-global/bin`, `~/bin`, `/opt/homebrew/bin`, `/usr/local/bin`) and only falls back to the bare command name if none exist. An explicit path configured in Settings always wins.

## [1.5.10] - 2026-07-26

### Added
- Added interactive CLI tasks.
- Added workflow prompt sync support for workflow builder import/export changes.

### Changed
- Dashboard task and workflow names now update live after edits.

### Fixed
- Restored long timeouts for code tasks.

### Removed

### Deprecated

### Security

# Changelog

## [Unreleased]

### Added
- POSIX hidden launcher (`launchHiddenSh`) for macOS/Linux scheduled tasks, workflow validation, and Diagnostics. Replaces the Windows-only `.ps1`/`launchHiddenPS()` path with a platform-appropriate `/bin/sh` script that mirrors the same contracts: pid/out/err/done files, detached process group, and cleanup of children on cancel/stop.
- Linux terminal fallback: the plugin now probes `x-terminal-emulator`, `gnome-terminal`, `konsole`, `xfce4-terminal`, `lxterminal`, `alacritty`, and `xterm`, and honors a new `linuxTerminal` setting.
- Cross-platform release packaging via `scripts/package-release.mjs` (`npm run pack:release` now works on Windows, macOS, and Linux).
- CI matrix (`.github/workflows/ci.yml`) running build, tests, and release packaging on `windows-latest`, `ubuntu-latest`, and `macos-latest`.

### Fixed
- Auto-detect the `opencode` binary on macOS/Linux. Obsidian (an Electron GUI app) does not inherit the shell `PATH`, so commands like `opencode models` previously failed with "command not found" and left the model list empty. The plugin now probes common install locations (`~/.bun/bin`, `~/.local/bin`, `~/.npm-global/bin`, `~/bin`, `/opt/homebrew/bin`, `/usr/local/bin`) and only falls back to the bare command name if none exist. An explicit path configured in Settings always wins.
- macOS AppleScript launch now shell-quotes the working directory, so vault paths containing spaces no longer break the terminal command.
- Interactive CLI launch failures (e.g. no Linux terminal emulator installed) are now reported to the task/UI instead of failing silently.
- `npm run pack:release` no longer depends on the missing Windows-only `package-release.ps1`.

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

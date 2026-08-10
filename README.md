# AutoOC for Obsidian

![AutoOC workflow overview](docs/assets/autooc-overview.svg)

AutoOC is a desktop-only Obsidian plugin for scheduling and running OpenCode CLI tasks and visual workflows from an Obsidian vault.

## What It Does

- Create OpenCode tasks with manual, one-time, daily, weekly, monthly, or interval schedules.
- Run tasks manually, monitor their status and output, keep logs, configure timeouts, and stop running work.
- Load available OpenCode models and agents, launch an OpenCode CLI session, and run a diagnostic from Obsidian.
- Build workflows in the embedded Visual Builder or classic view. Workflows support task, delay, and JavaScript code steps; default, forced, conditional, and AI-evaluated transitions; and branching paths.
- Import and export task and workflow packages as JSON, and use the included library packages as examples.
- Store secrets separately from plugin settings. When Electron secure storage is available, secret values are encrypted locally; AutoOC injects them only into OpenCode processes it launches and redacts them from stored output.

## Requirements

- Obsidian Desktop with Community plugins enabled.
- OpenCode installed locally and available as `opencode`, or configured in AutoOC settings.
- Windows for the current background task launcher.
- `uv` only when using the optional local `autooc-mcp` helper.

## Install

### From a release

Download a release package and place its contents in `<vault>/.obsidian/plugins/auto-oc/`. The plugin directory must contain `manifest.json`, `main.js`, and `styles.css`.

Reload Obsidian, then enable **AutoOC — OpenCode Task Scheduler** in **Settings > Community plugins**.

### Local development

```powershell
npm install
npm run build
npm run deploy -- "C:/path/to/your/vault"
```

The deploy command builds the extension and copies `manifest.json`, `main.js`, and `styles.css` to `<vault>/.obsidian/plugins/auto-oc/`. Reload Obsidian after deploying.

For iterative bundling, run:

```powershell
npm run dev
```

## Use AutoOC

1. Open the AutoOC panel from its ribbon icon or command palette command.
2. Create a task, select an OpenCode model and schedule, then save it.
3. Choose **Run** to execute immediately or let the scheduler run it when due.
4. Review output and logs in the panel; use **Stop** to cancel an active task.
5. For multi-step automation, open **Visual Builder**, add task, delay, or code steps, connect transitions, then apply the workflow to AutoOC.

AutoOC runs OpenCode as a local external process. Tasks and workflows are saved through Obsidian's plugin data in the vault; optional secrets are stored separately in the plugin folder. See the [architecture](docs/architecture.md) for runtime and data-flow details.

## Development

```powershell
npm test
npm run build
```

`npm test` runs the repository's Node test suite. The build first inlines the Visual Builder, type-checks TypeScript, and bundles the Obsidian plugin.

The primary implementation is in `main.ts`; the standalone Visual Builder source is `util/ui_workflow_builder/index.html`, which is embedded during development and builds. See [architecture](docs/architecture.md) and the [development harness](docs/development-harness.md) for repository details.

## Release Artifacts

Create a distributable ZIP containing `manifest.json`, `main.js`, and `styles.css`:

```powershell
npm run build
npm run pack:release
```

The package is written to `release/auto-oc-<version>.zip` and the script prints its SHA-256 hash. See the [release workflow](RELEASE_WORKFLOW.md), [publication checklist](PUBLISH_CHECKLIST.md), and [changelog](CHANGELOG.md).

## Contributing

Contributions, bug reports, and workflow ideas are welcome. Please keep task and workflow changes consistent across the classic AutoOC view, the Visual Builder, and the import/export format. Start with the [architecture](docs/architecture.md), run the tests and build before submitting changes, and keep generated build artifacts in sync when required.

## License

AutoOC is open source under the [MIT License](LICENSE).

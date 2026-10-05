# AutoOC for Obsidian

![AutoOC workflow overview](docs/assets/autooc-overview.svg)

AutoOC is a desktop-only Obsidian plugin for scheduling and running OpenCode, Codex, and GitHub Copilot CLI tasks and visual workflows from an Obsidian vault.

## What It Does

- Create OpenCode tasks with manual, one-time, daily, weekly, monthly, or interval schedules.
- Run tasks manually, monitor their status and output, keep logs, configure timeouts, and stop running work.
- Load available OpenCode models and agents, launch an OpenCode CLI session, and run a diagnostic from Obsidian.
- Build workflows in the embedded Visual Builder or classic view. Workflows support task, delay, and JavaScript code steps; default, forced, conditional, and AI-evaluated transitions; and branching paths.
- Import and export task and workflow packages as JSON, and use the included library packages as examples.
- Store secrets separately from plugin settings. When Electron secure storage is available, secret values are encrypted locally; AutoOC injects them only into OpenCode processes it launches and redacts known secret values of four or more characters from stored output.

## Requirements

- Obsidian Desktop with Community plugins enabled.
- The CLI for your chosen engine installed and authenticated: OpenCode, Codex, or GitHub Copilot CLI.
- Windows, macOS, or Linux.
- `uv` only when using the optional local `autooc-mcp` helper.

## Install

### From a release

Download a release package and place its contents in `<vault>/.obsidian/plugins/auto-oc/`. The plugin directory must contain `manifest.json`, `main.js`, and `styles.css`.

Reload Obsidian, then enable **AutoOC — OpenCode Task Scheduler** in **Settings > Community plugins**.

Si Obsidian usa una carpeta de configuración personalizada, instala el plugin en `<vault>/<configDir>/plugins/auto-oc/`. Las tareas y workflows compartidos usan el catálogo, la reserva, el journal, la recuperación y las aprobaciones de esa instalación. Si cambias la selección con una reserva activa, AutoOC rechaza la discrepancia: termina o reconcilia la ejecución y recarga Obsidian. La CLI conserva `.obsidian/plugins/auto-oc` como ubicación predeterminada; no busca otras instalaciones.

### Local development

```powershell
npm install
npm run build
node deploy.mjs "C:/path/to/your/vault"
```

`node deploy.mjs` copies the already-built `manifest.json`, `main.js`, and `styles.css` artifacts to `<vault>/.obsidian/plugins/auto-oc/`. Run `npm run build` first, as shown above. Reload Obsidian after deploying. Use `npm run dev` for iterative bundling or `npm run build` for a production build.

For iterative bundling, run:

```powershell
npm run dev
```

## Use AutoOC

1. Open the AutoOC panel from its ribbon icon or command palette command.
2. Create a task, select an OpenCode model and schedule, then save it.
3. Choose **Run** to execute immediately or let the scheduler run it when due.
4. Review output and logs in the panel; use **Stop** to cancel an active task.

AutoOC runs OpenCode as a local external process. Tasks and workflows are saved through Obsidian's plugin data in the vault; optional secrets are stored separately in the plugin folder. See the [architecture](docs/architecture.md) for runtime and data-flow details.

### GitHub Copilot CLI

1. Install [GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli) and sign in from a terminal using `copilot login`. Your account and organization must permit Copilot CLI access.
2. In AutoOC settings, use **Copilot executable path → Detect & test**. The default `copilot` detects the local installation, including the native executable bundled by npm on Windows. You can also specify an absolute executable path. This check verifies the installation; account access is checked when a task runs.
3. Create a **GitHub Copilot CLI task** in the classic editor or Visual Builder. Enter its prompt, project folder and schedule. Optionally enter a model ID available to your account (`/model` in Copilot lists them). Empty uses AutoOC's **Default Copilot model**, then the CLI default.
4. Tasks expose only file reading and search tools by default. Enable **Allow tools automatically** on a task to let Copilot edit files and run commands without asking. Folder and URL permissions still follow Copilot's policy. This permission is included in exported packages, so review it before running imported tasks.
5. Run the task and follow its output in AutoOC. **Stop**, timeouts, recurring schedules, saved logs, and workflow output handoff are supported. Copilot tasks can share a workflow with OpenCode, Codex and JavaScript steps.

Copilot tasks run in the background using the selected folder's currently checked-out branch. They do not open an interactive terminal, use OpenCode agents/Ralph Loop, or change branches automatically. AI-evaluated workflow transitions still use the existing OpenCode evaluator. Long prompts use a temporary UTF-8 instruction file that is removed when the task ends. AutoOC injects its configured secrets into the child process and redacts known secret values from displayed and saved output.

Exports containing Copilot tasks use schema `1.6.0` and `taskKind: "copilot"`; older schemas remain supported. As with other engines, exported packages use the importing system's default model. See the included [Copilot example](library/copilot-code-review.json).

If a task reports **Access denied by policy settings**, check your [Copilot account settings](https://github.com/settings/copilot) and organization policy. AutoOC cannot override GitHub's access restrictions.

## Visual Builder

Open the command palette and select `Open AutoOC Visual Builder`. The modal is titled `✨ WF Visual Builder`. Build workflows with task, delay, and JavaScript code steps, then connect them with transitions to create DAG branches. The embedded builder validates and applies workflow state to AutoOC; import and export workflow JSON remain in the classic AutoOC panel.

The classic AutoOC view and Visual Builder edit the same tasks and workflows. Use either surface for the workflow that best fits the job.

## Ralph Loop

For tasks that should continue until their completion criteria are met, enable Ralph Loop in the task editor. AutoOC prefixes the task prompt with `/ralph-loop`; the OpenCode Ralph Loop stops when it emits `<promise>DONE</promise>` or reaches its maximum iterations. Make the done criteria explicit in the prompt. Set it up from the command palette with `AutoOC: Ralph Loop Assistant (install/activate)`, then restart OpenCode.

## Secrets And AutoOC MCP

Secrets are kept outside Obsidian plugin settings at `<vault>/.obsidian/plugins/auto-oc/secrets.vault.json`. The optional PIN controls reveal, edit, and delete access; it is not the encryption key. AutoOC preserves user-entered secret display names; only the injected environment variable is normalized as `AUTOOC_*`. Secret values are injected only into the OpenCode child processes AutoOC starts.

The optional `autooc-mcp` helper makes secret metadata and credential lookup available to OpenCode agents. Secret values are available only to OpenCode launched by AutoOC, which inherits them through the task process; manually launched OpenCode can see metadata but not values. Install [`uv`](https://docs.astral.sh/uv/) first, then use **Install autooc-mcp in OpenCode** in AutoOC's Secrets view and restart OpenCode. For MCP configuration details, use the canonical [OpenCode MCP documentation](https://opencode.ai/docs/mcp-servers/); implementation and data-flow details are in the [architecture](docs/architecture.md).

## Diagnostics And Troubleshooting

Run `AutoOC: Diagnostic — test opencode command` from the command palette to check the configured OpenCode command. For setup failures, task launch problems, or timeouts, review the [architecture](docs/architecture.md) and verify the configured OpenCode command, task timeout, and plugin files under `.obsidian/plugins/auto-oc/`.

## Development

```powershell
npm test
npm run build
```

`npm test` runs the repository's Node test suite. The build first inlines the Visual Builder, type-checks TypeScript, and bundles the Obsidian plugin. The primary source is `main.ts`; edit `util/ui_workflow_builder/index.html` for the standalone builder. Its generated embed is refreshed by the development and build scripts.

The commands in this README are the authoritative command reference for implementation, contributor workflow, generated-file relationships, and quality gates.

## Release Artifacts

Create a distributable ZIP containing `manifest.json`, `main.js`, and `styles.css`:

```powershell
npm run build
npm run pack:release
```

The package is written to `release/auto-oc-<version>.zip` and the script prints its SHA-256 hash. Release packages and in-app updates require `manifest.json`, `main.js`, and `styles.css`. See the [release workflow](RELEASE_WORKFLOW.md), [publication checklist](PUBLISH_CHECKLIST.md), and [changelog](CHANGELOG.md).

## Contributing

Contributions, bug reports, and workflow ideas are welcome. Preserve these invariants:

- Keep the classic AutoOC UI and Visual Builder consistent.
- Preserve task and workflow import/export compatibility, migrations, and JSON round trips when changing persisted workflow data.
- Regenerate Visual Builder output and release assets when their sources change.
- Run `npm test` and `npm run build` before submitting changes.

Start with the [architecture](docs/architecture.md).

## License

AutoOC is open source under the [MIT License](LICENSE).

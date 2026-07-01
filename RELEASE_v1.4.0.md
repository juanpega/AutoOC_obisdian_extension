# Release v1.4.0

## Summary
This release brings the **Visual Builder** into the extension as a first-class feature, and upgrades the workflow execution model from a linear list to a **DAG (directed acyclic graph)** with three new step kinds and conditional transitions. From now on, the Visual Builder is the canonical authoring surface for AutoOC workflows.

## Visual Builder integration
- New `✨ Visual Builder` button in the AutoOC panel, next to `📥 Import`.
- Opens a new Obsidian leaf hosting the n8n-style node editor (an iframe backed by `util/ui_workflow_builder/index.html`).
- **Loads the current `tasks` and `workflows` from the extension** on view open.
- **Apply to AutoOC** writes changes back into the extension's settings immediately. No more export/import round-trip when editing inside Obsidian.
- Standalone usage still works — open `util/ui_workflow_builder/index.html` in any browser; the same HTML file powers both the extension view and the standalone tool.
- Classic Tasks/Workflows list view is still present and stays in sync with the Visual Builder state.

## New step kinds
- **Task** (blue) — runs an OpenCode prompt. Same fields as a regular task.
- **Delay** (amber) — pauses the workflow for N seconds/minutes/hours before the next step. Useful for "wait 5 minutes, then check again" patterns.
- **Code** (pink) — runs a JavaScript snippet in a sandboxed `vm` context. The previous step's output is available as `input` (string); assign the `output` variable to pass a value to the next step. Has access to `input`, `outputs` (map of `stepId → output`), and standard JS globals (`JSON`, `Math`, `Date`, ...). 10s execution timeout.

## Conditional / branching transitions
Workflows are no longer strictly linear. Every step can declare **multiple outgoing transitions**, each with its own mode:

- **Default** — follow only if the previous step succeeded.
- **Force** — always follow this edge, even if the previous step failed.
- **AI decides** — the model is given the previous output + an evaluation prompt; follow if it answers "yes". Same mechanism as the v1.x "eval" transition, but per-edge instead of per-step.
- **Conditional** — a JavaScript expression evaluated against the runtime context. Has access to `input` (last step output), `outputs` (map of all step outputs), and standard JS globals. Follow if the expression returns truthy.

The runner picks the first transition that matches, so a single step can fork into several paths based on the previous output.

## Data model changes
- `WorkflowStep` is now a richer type: `id` (stable identifier), `stepKind` (`"task" | "delay" | "code"`), `transitions` (array of explicit outgoing edges), `position` (canvas coordinates), plus the kind-specific fields (`delayValue`/`delayUnit`, `code`/`codeInputVar`/`codeOutputVar`, etc.).
- Legacy fields (`taskId`, `transitionMode`, `evaluatePrompt`, `forceContinue`) are preserved on task steps for back-compat with old exports and are folded into the first transition automatically.
- `Workflow.steps` order is now derived from the DAG, not authoritative. Each step knows its own outgoing edges; the runner picks the next step by ID.
- `AutoOCExportFile.schemaVersion` is bumped to `1.4.0`. v1.0 / v1.3.x imports are auto-migrated.

## New palette command
- `AutoOC: Open AutoOC Visual Builder` — opens the Visual Builder view directly from the command palette.

## Removed/cleaned up
The standalone Visual Builder no longer needs (or exposes) the following — they don't make sense in the embedded context:
- Drafts in localStorage (changes are saved directly to the extension).
- Export/Import as JSON files (handled by the extension's own Import modal).
- Theme toggle (follows the Obsidian theme).
- "Cmd+K" command palette (the Obsidian palette already exists).
- Validation/save/settings panels (inlined as the right-hand property panel).

## Migration
When loading existing settings, every workflow step is auto-migrated to the new shape:
- `id` is generated if missing.
- `stepKind` defaults to `"task"`.
- A linear transition is synthesized between consecutive steps so old workflows run identically.
- `position` is laid out left-to-right so the Visual Builder shows something useful immediately on first open.

## Changed
- Bumped version to `1.4.0` in `manifest.json`, `package.json`, `package-lock.json`, and `pluginVersion` in `AutoOCExportFile`.
- Plugin description in `package.json` mentions the visual workflows.
- `package.json` now ships `util/ui_workflow_builder/**` so the visual builder is installed alongside the plugin.

## Fixed
- Legacy workflow steps without `id` or `stepKind` are normalized on load.
- Applying changes from the embedded Visual Builder no longer wipes task runtime history (`lastRun`, `output`) or the current running state for unchanged tasks.
- Existing task fields configured in the classic view, including project path and Git branch options, are preserved when older Visual Builder payloads do not send them.
- Import validation now accepts `interval` schedules, matching the task/workflow schedule types supported by the UI.
- The classic workflow card now shows actual v1.4 edge transitions instead of only the old single linear transition mode.

## Visual Builder hardening
- Added an `Apply` button to save changes without closing the Visual Builder modal.
- Kept `Apply and close` for quick edits.
- Added `Project path` to the Visual Builder task editor so task configuration is more consistent with the classic task modal.
- The Visual Builder warns before applying when validation finds blocking workflow issues and opens the validation report if the user cancels.

## Installation
1. Download release asset `auto-oc-v1.4.0.zip`.
2. Extract files into `.obsidian/plugins/auto-oc/`.
3. Reload Obsidian (`Ctrl+Shift+P` → `Reload app without saving`).
4. Enable plugin in Community plugins.

## Requirements
- Obsidian Desktop
- OpenCode installed locally
- Windows (current flow uses PowerShell/VBScript for silent execution)

## License
This release is published under the MIT License.

Copyright (c) 2026 Juan Pedro Gil.

You are free to download, use, modify, and distribute this plugin. If you create your own version or fork, please keep a mention of the original author (Juan Pedro Gil) or a link back to the repository:

- Website: https://inncrea.es
- Email: juanpedro266@gmail.com
- Repository: https://github.com/juanpega/AutoOC_obisdian_extension

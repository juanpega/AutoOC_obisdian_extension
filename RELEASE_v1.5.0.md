# Release v1.5.0

## Summary
AutoOC v1.5.0 introduces the new dashboard bubble map, improves workflow deletion synchronization across the classic UI and Visual Builder, and hardens edit behavior so saving changes never launches work unexpectedly.

## Added
- New dashboard bubble map that groups workflows and loose tasks by area.
- Area bubbles, workflow bubbles, and task bubbles with status-aware visual states.
- Persistent dashboard bubble positions across reopen/reload.
- Ambient dashboard motion for running/failed states, including gradual failure sink behavior.
- Existing area suggestions in the task and workflow editors, with one-click selection or free text for a new area.
- Optional workflow deletion cleanup: when deleting a workflow, AutoOC can also delete tasks used only by that workflow.

## Changed
- Dashboard task bubbles now use a uniform task size and responsive layout behavior.
- Dashboard metrics are hidden by default and can be toggled from inside the canvas.
- Workflow deletion is now synchronized between the classic extension view and the Visual Builder so users only delete from one place.
- Visual Builder workflow deletion applies immediately to AutoOC instead of remaining only inside the iframe.
- Bumped version to `1.5.0` in `manifest.json`, `package.json`, `package-lock.json`, and Visual Builder export metadata.

## Fixed
- Editing a task no longer marks it as pending or launches it indirectly.
- Editing a workflow no longer marks it as pending or launches it indirectly.
- Runtime metadata is preserved when editing tasks and workflows.
- Dashboard bubble layout no longer drifts unexpectedly after reopening.
- Dashboard bubble collision and clamping behavior is more stable.
- Removed native browser dashboard bubble tooltips so only the custom dark tooltip is shown.
- Workflow/task deletion from either UI stays consistent with the other UI when the Visual Builder is open.

## Installation
1. Download release asset `auto-oc-1.5.0.zip`.
2. Extract files into `.obsidian/plugins/auto-oc/`.
3. Reload Obsidian (`Ctrl+Shift+P` -> `Reload app without saving`).
4. Enable plugin in Community plugins.

## Requirements
- Obsidian Desktop
- OpenCode installed locally
- Windows

## Notes
- If tasks do not run, use command: `AutoOC: Diagnostico - probar comando opencode`.
- Production updater still reads release files from the `main` branch.

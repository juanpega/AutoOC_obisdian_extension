---
name: wf-builder-prompt-sync
description: Use when changing AutoOC workflow/task import-export JSON, schemaVersion, migrations, ScheduledTask, Workflow, WorkflowStep, Visual Builder JSON round-trip, or AUTOOC_WORKFLOW_PROMPT / WF Builder prompt.
---

# WF Builder Prompt Sync

Use this skill before any code change that can alter the import/export JSON for AutoOC tasks or workflows.

Relevant files and symbols:
- `main.ts`
- `AUTOOC_WORKFLOW_PROMPT` in `main.ts` (the WF Builder prompt)
- `AutoOCExportFile`, `ExportTask`, `ExportWorkflow`, `ExportWorkflowStep`
- `toExportTask`, `toExportWorkflow`, `importFromData`
- `ScheduledTask`, `Workflow`, `WorkflowStep`
- `util/ui_workflow_builder/index.html`

Required check:
- If the change modifies, adds, removes, renames, or changes semantics of any importable/exportable task or workflow JSON field, update `AUTOOC_WORKFLOW_PROMPT` when the prompt's documented schema, examples, validation rules, or design rules are affected.
- If the prompt does not need a change, say so explicitly in the final response.

Minimum workflow:
1. Inspect the JSON contract in `main.ts` before editing.
2. Apply the smallest code change.
3. Compare the new import/export shape against `AUTOOC_WORKFLOW_PROMPT`.
4. Update the prompt in the same change if it would otherwise generate stale JSON.
5. Run the smallest available check, normally `npm run build`.

Do not add a separate prompt source file unless the user asks. The current source of truth is the inline `AUTOOC_WORKFLOW_PROMPT` constant.

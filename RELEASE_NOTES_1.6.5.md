# AutoOC 1.6.5 — visible task errors and explicit abandonment

- Both task Run buttons now display redacted startup errors, including the identity of an older run that blocks new work.
- Editing a task with an unfinished attempt no longer prevents the panel from loading or hides the useful startup error. Its historical execution stays visible and blocked; editing never authorizes replay.
- Standalone task cards offer **Abandon attempt**, with an explicit confirmation of the unknown outcome. Cancellation changes nothing; a changed revision or active execution rejects the decision. A new task still requires a separate Run click.
- A standalone task requesting a switch to another existing Git branch with uncommitted work is rejected before creating an execution journal. The current branch remains usable without discarding changes.
- The CLI supports an explicit, human-authorized `abandon` operation with exact workflow/run/revision and acknowledgement of unknown external effects.
- Abandonment keeps every original step unchanged, saves the original checkpoint, and records the decision as **abandoned / outcome unknown**. It never marks work successful, stops external processes, or replays a step.
- New work can proceed after that decision. The abandoned run cannot be resumed. Live owners, changed revisions and missing acknowledgement remain blocked.
- Obsidian and CLI expose the abandoned state separately from success/failure. Existing data, task definitions and credentials are preserved.

Use `node autooc-cli.cjs help` for the exact CLI command. Close/disable the plugin for CLI abandonment; the task-card action uses the plugin's existing reservation. Never delete runtime files to release a reservation.

Validation evidence and limitations are recorded in the internal repair dossier. Publication and rollout to other vaults remain separate human actions.

# AutoOC 1.6.3 — startup, reactivation and Update fixes

- Keep a recovery entry visible when another execution reservation prevents startup. Manual retry never deletes another owner's reservation or starts work.
- Allow a verified complete package to open its UI with unfinished historical runs. Preserve their identities, journals and reconciliation requirements. Incomplete updates retain strict idle checks.
- Finish pending settings saves before releasing the plugin's own reservation. Failed writes and uncertain activity retain protection.
- Release an observation-only UI reservation when the historical journals are unchanged and this instance attempted no execution. Updates and automatic abandoned-owner recovery retain their stricter checks.
- Use Obsidian's workspace quit task to complete safe cleanup before normal application exit.
- Support Codex servers requiring the exact existing thread to be loaded before reading its saved turn. Never create a new turn during reconciliation.

- Wait for this instance's pending Dashboard/settings saves before checking update readiness and again after downloading. Preserve tasks, workflows and history through package replacement and reload.
- Keep the selected target version stable during download and prevent a second update or a new execution while waiting.
- If the installed update cannot reload automatically, explain that Obsidian needs restarting and the plugin must not be uninstalled.

## Validation

Current Windows full suite: 449 passed, 1 failed, 2 skipped (452 tests). The only failure was the packaging subprocess exceeding its 30-second timeout. The unchanged failed test passed in isolation in 10.4 seconds, including task, complete workflow, gates, stop and restart from the extracted ZIP. The original failed run is retained as evidence. TypeScript/build and release packaging passed. Three targeted update tests passed: the original 1.6.0 updater, a pending Dashboard save before clicking Update, and a save during download. Network responses and Obsidian reload are controlled test boundaries; this is not proof of the public GitHub update route.

Earlier candidate, before this additional updater-only repair: real Obsidian 1.14.4 in the authorized AutoOC vault: plugin loads, Dashboard opens, disable/reactivate works with Dashboard open; normal application close releases its reservation and reopening restores the Dashboard without manual recovery. The configuration remained byte-identical. Seven original installed artifacts were backed up.

## Limits

The previously interrupted Codex run remains unconfirmed: its exact session has no retrievable rollout on this machine. The fix does not invent a result or replay it. A crash or forced termination may still require identity-bound recovery. Causes of third-party reports are not individually verified. macOS was not tested in this repair. This is a local candidate; no publication or rollout to other vaults was performed.

## Update scope

The updater repair affects this candidate and subsequent updates from it. An already installed older updater cannot be retroactively changed by publishing a new package. Historical unfinished executions still block package replacement until their exact run is reconciled; this repair does not erase journals or bypass that gate. The public GitHub update route for this candidate is not yet verified because it is unpublished.

# AutoOC 1.6.4 — reopening a closed vault

## Fixes

- Add a recovery button when a verified installed package is blocked by a reservation whose exact owner process has ended. Recovery archives that reservation and reloads the plugin; it never resumes or repeats a task.
- Record a durable, owner-bound observation proof after startup. If Obsidian terminates the renderer without running cleanup, the next launch can recover a session that only displayed unchanged execution records. Every task/workflow execution entry invalidates this proof before attempting effects.
- Keep live owners, changed journals, pending writes/updates, invalid proofs and uncertain executions protected. The older interrupted run remains pending; opening the panel does not approve or complete it.
- Start guarded cleanup on window close as well as the application quit hook. Recovery details now wrap within the panel.

## Validation

TypeScript/build and release packaging pass. Real Obsidian 1.14.4 on Windows, in the authorized AutoOC vault: explicit recovery opens the Dashboard; reopening after renderer termination recovers an observation-only reservation automatically. The configuration and execution journals remain byte-identical. Original installed artifacts are backed up.

The first candidate still reproduced the closing issue despite passing isolated tests. A temporary diagnostic confirmed that cleanup was not invoked in that observed close. That diagnostic has been removed. Final recovery uses persisted evidence and does not depend on the shutdown callback.

Final Windows suite: 465 passed, 1 failed, 2 skipped (468 tests). The sole failure was the packaging subprocess exceeding its 30-second limit during the concurrent run. The same unchanged test passed in isolation in 10.5 seconds, including task execution, a complete workflow, gates, errors, stop and restart using the extracted distribution. The failed full-suite log is preserved; it is not reported as an all-green run. All startup/lifecycle cases passed, including live-owner refusal, canceled explicit recovery, stale owner/package/update rejection, and automatic recovery restricted to an unchanged observation.

## Limits

No third-party vault or macOS validation was performed for this patch. Historical unfinished executions remain subject to their existing reconciliation and update gates. Old reservations without observation proof require the explicit recovery button once. The public update route remains unverified until publication; this is not a claim of public release or rollout to other vaults.

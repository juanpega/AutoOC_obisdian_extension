# Development Harness

## Purpose

This document covers the local development harness, contribution flow, and AI-assisted development rules for the `auto-oc` Obsidian plugin. It complements the README's user guidance and the release documentation rather than replacing them.

## Development Tools

The repo is a TypeScript Obsidian plugin managed with npm. Tests run with Node's built-in test runner through `npm test`; there is no separate test framework, lint config, formatter, or CI in this repo. Quality is enforced through tests, `tsc`/`esbuild`, and manual verification.

| Tool | Role |
|------|------|
| npm / package-lock.json | Dependency and script runner |
| Node.js built-in test runner | Runs the repository test suite through `npm test` (`node --test`) |
| TypeScript / `tsc` | Type checking with strict null checks |
| esbuild | Bundles `main.ts` to `main.js` |
| `scripts/inline-visual-builder.mjs` | Embeds `util/ui_workflow_builder/index.html` into `visualBuilderHtml.generated.ts` |
| PowerShell | `package-release.ps1` produces release zips |
| Obsidian | Manual verification target |
| GitNexus | Required impact analysis before editing symbols |

## Main Commands

| Command | Purpose | When to Use |
|---|---|---|
| `npm install` | Install dependencies | First setup or after dependency changes |
| `npm test` | Run the Node built-in test suite (`node --test`) | Before committing and after behavior changes |
| `npm run dev` | Run `node esbuild.config.mjs` for local development watch | While editing plugin code |
| `npm run build` | Type-check with `tsc --noEmit --skipLibCheck`, then bundle for production | Before committing or packaging |
| `npm run deploy` | Build production bundle, then run `node deploy.mjs` | Quick local deploy using the default deploy script behavior |
| `npm run pack:release` | Package the existing `manifest.json`, `main.js`, and `styles.css` artifacts with `package-release.ps1` | Creating a release zip after `npm run build` |
| `node deploy.mjs "C:/path/to/your/vault"` | Copy plugin artifacts into an Obsidian vault for testing | Manual vault deployment |
| `node .gitnexus/run.cjs analyze` | Re-analyze the repo for GitNexus | After meaningful code changes or stale index warnings |
| `npx gitnexus analyze` | Fallback GitNexus analysis command | If `.gitnexus/run.cjs` is unavailable |
| `node scripts/inline-visual-builder.mjs` | Regenerate `visualBuilderHtml.generated.ts` from the Visual Builder HTML | After editing `util/ui_workflow_builder/index.html` |

`prebuild`, `predev`, and `inline-vb` are aliases for the inline script; they run automatically before the corresponding build/dev steps.

## Development Workflow

1. Understand the task and the affected user or developer workflow.
2. Inspect the relevant files, generated outputs, and docs before editing.
3. Make the smallest safe change that solves the problem.
4. Run checks, at minimum `npm test` and `npm run build`, plus Obsidian manual verification when behavior changes.
5. Update documentation that matches the change type.
6. Review the diff and generated files before committing.
7. Record relevant changes in `CHANGELOG.md` or release notes when needed.

For releases, merge `dev` into `main`, bump `manifest.json` and `package.json` to the same SemVer, run `npm run build` before `npm run pack:release` (which packages existing artifacts), commit `main.ts/main.js/manifest.json/package.json/styles.css`, push `main`, and ensure `GITHUB_BRANCH` in `main.ts` points to `main`.

## AI-Assisted Development Rules

The repo uses `AGENTS.md`/`CLAUDE.md` and `opencode.json` (Ponytail plugin enabled). Before non-trivial work, load the relevant local skill from `.opencode/skills/agent-skills/skills/`.

Required habits:

- AI-generated changes must be reviewed before they are accepted.
- AI should not introduce new dependencies without clear justification.
- AI should not change public behavior without documenting it.
- Architecture changes require updating `docs/architecture.md`.
- User-facing changes require updating `README.md` or usage documentation.
- Significant changes require updating `CHANGELOG.md`.
- Risky decisions should be documented in the relevant docs or release notes.
- Run GitNexus `impact()` on any symbol before editing it.
- Warn on `HIGH` or `CRITICAL` impact before proceeding.
- Run `detect_changes()` before committing.
- Use GitNexus `query()` and `context()` to explore code; do not grep around blindly.
- Use the `rename` tool, never find-and-replace, for symbol renames.

## Reusable Prompts

Copy-paste these prompts when driving the AI assistant.

### Understand a module

```text
Explain how the [module/file] works in the auto-oc Obsidian plugin. Trace its callers and callees, list the data it reads and writes, and note any generated files or Obsidian APIs it depends on. Use GitNexus query/context/impact as needed.
```

### Document a module

```text
Add concise documentation for [module/file] in docs/[name].md. Explain purpose, inputs/outputs, key functions/classes, and how it fits into the architecture. Do not invent tooling; base everything on the actual code and existing docs.
```

### Safe refactoring

```text
I want to refactor [symbol] in auto-oc. First run GitNexus impact analysis, report the blast radius, and warn on HIGH/CRITICAL risk. Then propose the smallest change that achieves [goal] without changing behavior. Use the rename tool for any symbol renames.
```

### Write tests

```text
Use Node's built-in test runner for [logic]. Add the smallest runnable test that fails if the behavior breaks, using Node builtins. Do not add a separate test framework unless explicitly asked.
```

### Review changes

```text
Review the uncommitted changes in auto-oc. Run GitNexus detect_changes(), summarize affected symbols and execution flows, and flag anything outside the intended scope. Then do a concise code review focused on correctness and simplicity.
```

### Update documentation

```text
Update docs to match the changes in [files]. Follow the Documentation Update Rules table in docs/development-harness.md. Keep prose lean and do not invent tooling or commands.
```

## Quality Gates

Before a change is considered ready:

- `npm run build` passes (`tsc --noEmit --skipLibCheck` and esbuild production bundle).
- `npm test` passes (the repository test suite runs with Node's built-in test runner).
- Lint passes when linting is added; no linter is currently configured.
- Plugin loads and the Diagnostic UI command runs cleanly in Obsidian.
- New features are exposed in both **classic AutoOCView** and the **Visual Builder**.
- Every new field round-trips through export/import.
- `schemaVersion` is bumped if settings shape changes, with a migration in `loadSettings()`.
- Generated files (`visualBuilderHtml.generated.ts`, `main.js`) are rebuilt and committed when their sources change.
- `manifest.json` and `package.json` versions match for releases.
- Documentation is updated for user-facing, setup, architecture, or workflow changes.
- No secrets or local vault data are committed.
- Behavior changes are explained in docs, release notes, or `CHANGELOG.md` when relevant.

## Documentation Update Rules

| Trigger | Files to update | Rule |
|---------|-----------------|------|
| New user-facing feature | `README.md`, `docs/getting-started.md` | Add a short how-to, not a feature tour |
| New command or script | `docs/development-harness.md` | Add to Main Commands table |
| Architecture change | `docs/architecture.md` | Update the relevant diagram or flow |
| Settings shape change | `docs/overview.md`, migration code | Bump `schemaVersion` and document migration |
| Release | `CHANGELOG.md`, `manifest.json`, `package.json` | Keep versions in sync |
| Bug fix with a workaround | `docs/troubleshooting.md` | Add one concise entry |

## Troubleshooting for Contributors

- **`autooc-mcp` timeout in OpenCode** — install `uv`, reinstall `autooc-mcp` from AutoOC Secrets, restart OpenCode, and launch OpenCode from AutoOC so secrets resolve.
- **Plugin does not appear in Obsidian** — disable Restricted Mode, confirm files are under `.obsidian/plugins/auto-oc`, and reload Obsidian.
- **Task does not run** — run the Diagnostic UI command, verify the OpenCode CLI path, run `opencode run` manually, run `opencode upgrade`, and check `.opencode/agents` files for invalid frontmatter.
- **Long-running tasks hang** — check the per-task timeout, verify the provider status, and use the Stop command.
- **`docs/troubleshooting.md` is currently empty** — add end-user workarounds there when you fix a repeatable issue.

## Harness Evolution

This harness is intentionally minimal. If you add a separate test framework, linter, formatter, formatter config, or CI workflow, update this file and the Main Commands table so the next contributor knows the new gate.

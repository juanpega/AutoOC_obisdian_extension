# AutoOC for Obsidian

Obsidian plugin to schedule and run OpenCode CLI tasks and workflows with model selection, manual execution, logging, diagnostics, task stopping, and a direct OpenCode CLI launcher.

> **v1.4.0 — Visual Builder is now part of the extension.** A new `✨ Visual Builder` button (next to `📥 Import`) opens an n8n-style node-based editor that loads your existing tasks and workflows, lets you design new flows visually, and applies the changes back to the extension. The visual builder is the canonical UI from now on; **any new feature must be implemented there as well as in the classic list view**. See [Visual Builder](#visual-builder-v140) below.

## Features

- Create tasks with:
  - name
  - prompt/goal
  - OpenCode model
  - schedule: manual, once, daily, weekly, monthly, or interval
  - Ralph Loop option
- Manual task execution
- Automatic checking of due tasks
- Output logging per task
- Built-in diagnostic to validate OpenCode from Obsidian
- Button to stop running tasks
- Configurable timeout per task
- Dynamic model loading via `opencode models`
- Assistant to install/activate Ralph Loop in `~/.config/opencode/opencode.json`
- Secrets vault with encrypted local storage, UI PIN, temporary environment injection, and optional `autooc-mcp` helper
- Direct `OpenCode CLI` launcher from the AutoOC panel
- Schedulable workflows that chain existing tasks in order
- Workflow transitions: continue on success, force continue, or AI decides from previous output
- Runtime handoff between workflow steps for branch and output context
- **Visual Builder** (v1.4.0): an n8n-style node-based editor with:
  - Three step kinds — **Task** (run an OpenCode prompt), **Delay** (wait N seconds/minutes/hours), **Code** (run JavaScript with the previous step's output as `input` and assign `output` for the next step)
  - **Conditional transitions** — each edge can be `Default`, `Force`, `AI decides` (model evaluates a prompt), or `Conditional` (a JavaScript expression that returns truthy to follow)
  - Branching / DAG — every step can declare multiple outgoing transitions, so a single step can fork into several paths based on the previous output
  - Pan/zoom canvas, drag-to-rearrange, drag from the library to add steps, click an edge to change its transition mode
  - Apply changes back to AutoOC with a single button (replaces the export/import dance)
- Export/import workflows as JSON files (schemaVersion `1.4.0`) — works for sharing and for users who still prefer the classic list view

## Visual Builder (v1.4.0)

The Visual Builder is a new n8n-style editor that ships inside the extension. Open it from the AutoOC panel by clicking the **`✨ Visual Builder`** button (next to `📥 Import`).

### Step kinds

- **Task** (blue) — runs an OpenCode prompt. Same fields as a regular task.
- **Delay** (amber) — pauses the workflow for N seconds / minutes / hours. Useful for "wait 5 minutes and check again" patterns.
- **Code** (pink) — runs a JavaScript snippet. The previous step's output is available as `input` (string). Set the `output` variable to a string; that becomes the next step's input. Available globals: `input`, `outputs` (map of `stepId → output`), `JSON`, `Math`, `Date`. Code is sandboxed with a 10s timeout.

### Transitions

Drag from the green output port of a node to another node to create an edge. Click the edge to open the transition editor in the right panel. Each edge can be one of:

- **Default** — follow only if the previous step succeeded
- **Force** — always follow this edge, even if the previous step failed
- **AI decides** — the model is given the previous output + your evaluation prompt; follow if it answers "yes"
- **Conditional** — a JavaScript expression evaluated against the runtime context. Has access to `input` (last output), `outputs` (map of all step outputs), and standard JS globals. Follow if the expression returns truthy.

A single step can declare multiple outgoing transitions, so a node can branch into several paths. The runner picks the first transition that matches (for `default` and `conditional`) or the model-picked one (for `eval`).

### Workflow authoring workflow

1. Open the Visual Builder from the AutoOC panel
2. Drag `Task`, `Delay`, or `Code` from the left sidebar onto the canvas
3. Drag from a node's output port to another node's input port to connect them
4. Click an edge and pick the transition mode you want
5. Press **`Apply to AutoOC`** in the top bar — the changes are written back to the extension's settings immediately
6. You can keep editing in either UI; the Visual Builder is two-way bound

### Tips

- Press **F** to fit all nodes in the viewport; **Auto-layout** arranges them left to right
- Click a node and press **Delete** to remove it (incoming edges are auto-cleaned)
- **Trace** mode shows numbered badges on each step in execution order
- **Validate** surfaces errors (empty prompt, missing task reference, transition target deleted, …)

## Requirements

- Obsidian Desktop (Community plugins enabled)
- OpenCode installed locally
- `uv` for the optional `autooc-mcp` helper. AutoOC detects it and shows an install command if it is missing.
- Windows (current flow uses PowerShell/VBScript for silent execution)

## Project Structure

- `main.ts`: plugin source code
- `styles.css`: styles
- `manifest.json`: plugin metadata
- `main.js`: final build consumed by Obsidian
- `esbuild.config.mjs`: build/bundle
- `deploy.mjs`: copies files to `.obsidian/plugins/auto-oc`
- `util/ui_workflow_builder/`: the standalone Visual Builder app. Lives inside the plugin folder so the extension can host it in an iframe. Open `util/ui_workflow_builder/index.html` directly in a browser to use it standalone.

## Local Installation (without publishing)

1. Clone or copy this folder to your machine.
2. Install dependencies:

```powershell
npm install
```

3. Build + deploy to current vault:

```powershell
npm run build
node deploy.mjs "C:/path/to/your/vault"
```

4. In Obsidian:
- `Ctrl+Shift+P` -> `Reload app without saving`
- Settings -> Community plugins -> Enable `AutoOC`
```

4. En Obsidian:
- `Ctrl+Shift+P` -> `Reload app without saving`
- Settings -> Community plugins -> activar `AutoOC`

## Quick Usage

### Tasks Tab
1. Open the AutoOC panel (clock icon or palette command).
2. Create a task with `+ New Task`.
3. Choose model (dynamic list from OpenCode).
4. Save the task.
5. Execute with `Run` or wait for schedule.
6. View log with `Log` or `Live Log`.

### OpenCode CLI
1. Open the AutoOC panel.
2. Press `OpenCode CLI`.
3. Work in the terminal session opened in the vault/project directory.

### Visual Builder (v1.4.0+)
1. Open the AutoOC panel.
2. Press `✨ Visual Builder` (next to `📥 Import`).
3. A **centered, near-fullscreen modal** opens with the n8n-style canvas.
4. Drag `Task`, `Delay`, or `Code` from the left sidebar onto the canvas.
5. Drag from a node's output port to another node's input port to connect them.
6. Click an edge to set the transition mode (`Default` / `Force` / `AI decides` / `Conditional`).
7. Press **Apply and close** to save the workflow back to the extension and close the modal. The classic Tasks/Workflows tabs will reflect the new state immediately.

## Ralph Loop from Extension

If you want to use Ralph Loop auto-continuation without leaving Obsidian:

1. Go to AutoOC plugin Settings.
2. In the **Ralph Loop** section, press `Install / Activate`.
3. AutoOC will add `opencode-ralph-loop` to `~/.config/opencode/opencode.json`.
4. Restart OpenCode.

You can also use the palette command:

- `AutoOC: Ralph Loop Assistant (install/activate)`

Notes:

- This configures Ralph Loop plugin for OpenCode (not the full oh-my-opencode suite).
- Loop state file is managed in `.opencode/ralph-loop.local.md` within the project.

## Secrets Vault and autooc-mcp

AutoOC can store credentials such as usernames, passwords, API keys, cookies, and tokens in a local encrypted secrets vault.

Secrets are stored at:

```text
<Vault>/.obsidian/plugins/auto-oc/secrets.vault.json
```

Values are encrypted by Obsidian/Electron secure storage when you press `Save Secret`. Paste the password or token normally; do not encrypt it yourself.

The UI PIN only protects reveal/edit/delete actions in the AutoOC panel. It is not the encryption key, so resetting the PIN does not delete secrets.

### OpenCode environment injection

When OpenCode is launched from AutoOC, AutoOC decrypts secrets in memory and injects them as temporary environment variables for that OpenCode process only.

Example MCP headers can use:

```json
{
  "api-token": "{env:AUTOOC_API_TOKEN}",
  "web-user": "{env:AUTOOC_WEB_USER}"
}
```

The variables disappear when that OpenCode process exits.

### Installing autooc-mcp

`autooc-mcp` is an optional local MCP helper for agents. It exposes safe metadata tools and credential lookup tools such as `get_web_credentials`.

AutoOC installs it as a self-contained FastMCP Python script run with `uv`.

1. Open AutoOC.
2. Go to `Secrets`.
3. If AutoOC says `uv` is missing, click `Copy uv install command`, run it in a terminal, then restart Obsidian.
4. Click `Install autooc-mcp in OpenCode`.
5. Restart OpenCode.
6. Launch OpenCode from AutoOC so it inherits the secret environment variables.

For users of other harnesses, click `Copy autooc-mcp install JSON` and paste the copied block into that harness config.

### autooc-mcp tools

- `secrets_status`: shows vault path and number of configured secrets, without values.
- `list_secret_envs`: lists secret names and env var names, without values.
- `mcp_header_template`: creates a headers template using `{env:...}` references.
- `get_secret_value`: returns a specific secret value by name or env var.
- `get_web_credentials`: returns username/password for a site by matching names/env vars such as `AUTOOC_EXAMPLE_USER` and `AUTOOC_EXAMPLE_PASS`.

### Troubleshooting autooc-mcp

If OpenCode shows `autooc-mcp Operation timed out after 30000ms`:

1. Confirm `uv` is installed.
2. Reopen AutoOC `Secrets` and click `Install autooc-mcp in OpenCode` again.
3. Restart OpenCode.
4. Launch OpenCode from AutoOC, not from a separate terminal, if the task needs secrets.

## Configuration

In plugin Settings:

- OpenCode CLI path
- Working directory
- Default model
- Task timeout (seconds)
- Model list reload
- Ralph Loop Assistant

## Diagnostics

Palette command:

- `AutoOC: Diagnostic — test opencode command`

It validates:

- detected OpenCode path
- default model
- real execution and output

## Publishing to Your Own Repository

### 1) Upload Source Code

Push this folder as a repo (or repo subfolder) with:

- `main.ts`
- `styles.css`
- `manifest.json`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `esbuild.config.mjs`
- `deploy.mjs`
- `README.md`
- `.gitignore`

### 2) Create Release for Distribution

To deliver compiled plugin to users:

1. Run build:

```powershell
npm run build
```

2. Attach in release:

- `manifest.json`
- `main.js`
- `styles.css`

3. End user copies those files to:

- `.obsidian/plugins/auto-oc/`

## Installing Plugin from Release (End User)

1. Create folder:

- `.obsidian/plugins/auto-oc`

2. Copy inside:

- `manifest.json`
- `main.js`
- `styles.css`

3. Reload Obsidian and enable plugin.

## Troubleshooting

### Plugin Does Not Appear

- Verify Community plugins not in Restricted Mode.
- Verify path and files in `.obsidian/plugins/auto-oc`.
- Reload Obsidian.

### Models Show But Task Does Not Run

- Run the Diagnostic command.
- Verify `OpenCode CLI Path`.
- Try in terminal:

```powershell
opencode run "di hola" -m "opencode/deepseek-v4-flash-free" --dangerously-skip-permissions
```

If you see `Unexpected server error` or `[code 1]` in Diagnostic:

1. Upgrade OpenCode:

```powershell
opencode upgrade
```

2. Check version and minimal test:

```powershell
opencode -v
opencode run "di hola" -m "opencode/deepseek-v4-flash-free" --dangerously-skip-permissions
```

3. If you use agents in `.opencode/agents/*.agent.md`, review their frontmatter:
- Avoid a `tools: [...]` field with format not supported by your version.
- Invalid frontmatter in any agent can break global executions, even if you don't invoke that agent explicitly.

### Task Takes a Long Time

- Check timeout per task.
- Check server/model provider status.
- Use `Stop` to cancel and retry.

## Useful Scripts

```powershell
npm install
npm run build
node deploy.mjs "C:/path/to/your/vault"
npm run pack:release
```

## Files to Publish to Your Repo

- `package-release.ps1`: creates release zip with `manifest.json`, `main.js`, `styles.css`
- `RELEASE_NOTES_TEMPLATE.md`: template for release text
- `PUBLISH_CHECKLIST.md`: end-to-end publication checklist

## Recommended Release Flow

1. Build plugin:

```powershell
npm run build
```

2. Create release zip:

```powershell
npm run pack:release
```

3. Zip ends up in `release/auto-oc-<version>.zip` with SHA256 hash in console.
4. Publish that zip in your GitHub Release.

## Author & License

Created by **Juan Pedro Gil**.

- Website: [inncrea.es](https://inncrea.es)
- Email: [juanpedro266@gmail.com](mailto:juanpedro266@gmail.com)
- Repository: [https://github.com/juanpega/AutoOC_obisdian_extension](https://github.com/juanpega/AutoOC_obisdian_extension)

This project is released under the **MIT License**.

You are free to download, use, modify, and distribute it. If you create your own version or fork, please keep a mention of the original author (Juan Pedro Gil) or a link back to this repository.

## Current Status

- Diagnostic working
- Task execution using silent launcher on Windows
- Logs available from UI
- Visual Builder (n8n-style node editor) ships inside the extension
- Workflows can branch via explicit transitions (DAG), with conditional JavaScript and AI-evaluated edges
- Code and Delay steps supported alongside regular Task steps

## Contributing

**New features MUST be implemented in both UIs**: the classic Tasks/Workflows list view (`AutoOCView`) AND the Visual Builder (`util/ui_workflow_builder/index.html` + `VisualBuilderView` in `main.ts`).

The data model is the source of truth — every new field added to `ScheduledTask`, `Workflow`, or `WorkflowStep` must be:

1. **Exposed** in the classic view (form fields, list rendering, etc.)
2. **Exposed** in the Visual Builder (node templates, property panel editor, JSON round-trip)
3. **Round-tripped** through the export/import format (bump `schemaVersion` in `AutoOCExportFile` and add a migration in `importFromData` if it changes shape)
4. **Migrated** for users on older versions via the code in `loadSettings()`

The Visual Builder is the canonical UI for any non-trivial workflow change. New step kinds, new transition modes, new visual node types, new connection shapes — all of those land in the Visual Builder first and are mirrored in the classic view.

---

If you want to extend the plugin for Mac/Linux, adapt the background process launcher (currently optimized for Windows).

Si ves `Unexpected server error` o `[código 1]` en Diagnóstico:

1. Actualiza OpenCode:

```powershell
opencode upgrade
```

2. Verifica versión y prueba mínima:

```powershell
opencode -v
opencode run "di hola" -m "opencode/deepseek-v4-flash-free" --dangerously-skip-permissions
```

3. Si usas agentes en `.opencode/agents/*.agent.md`, revisa su frontmatter:
- Evita un campo `tools: [...]` con formato no soportado por tu versión.
- Un frontmatter inválido en cualquier agente puede romper ejecuciones globales, aunque no invoques ese agente explícitamente.

### La tarea tarda mucho

- Revisa timeout por tarea.
- Revisa estado del servidor/proveedor del modelo.
- Usa `Parar` para cancelar y reintentar.

## Scripts utiles

```powershell
npm install
npm run build
node deploy.mjs
npm run pack:release
```

## Archivos para publicar en tu repo

- `package-release.ps1`: crea zip de release con `manifest.json`, `main.js`, `styles.css`
- `RELEASE_NOTES_TEMPLATE.md`: plantilla para texto de release
- `PUBLISH_CHECKLIST.md`: checklist de publicacion end-to-end

## Flujo recomendado de release

1. Build plugin:

```powershell
npm run build
```

2. Crear zip release:

```powershell
npm run pack:release
```

3. El zip queda en `release/auto-oc-<version>.zip` con hash SHA256 en consola.
4. Publica ese zip en tu GitHub Release.

## Autor y licencia

Creado por **Juan Pedro Gil**.

- Web: [inncrea.es](https://inncrea.es)
- Email: [juanpedro266@gmail.com](mailto:juanpedro266@gmail.com)
- Repositorio: [https://github.com/juanpega/AutoOC_obisdian_extension](https://github.com/juanpega/AutoOC_obisdian_extension)

Este proyecto se publica bajo la licencia **MIT**.

Puedes descargarlo, usarlo, modificarlo y distribuirlo libremente. Si creas tu propia versión o fork, por favor mantén una mención al autor original (Juan Pedro Gil) o un enlace a este repositorio.

## Estado actual

- Diagnostico funcionando
- Ejecucion de tareas usando launcher silencioso en Windows
- Logs disponibles desde UI
- Visual Builder (editor visual estilo n8n) integrado en la extensión
- Workflows con branching via transiciones explícitas (DAG), incluyendo evaluación condicional JavaScript y por IA
- Steps de tipo **Code** (JavaScript) y **Delay** soportados además de los tradicionales **Task**

## Cómo contribuir (ES)

**Las nuevas funcionalidades DEBEN implementarse en ambas UIs**: la vista clásica de Tasks/Workflows (`AutoOCView`) Y el Visual Builder (`util/ui_workflow_builder/index.html` + `VisualBuilderView` en `main.ts`).

El modelo de datos es la fuente de verdad — cada nuevo campo añadido a `ScheduledTask`, `Workflow` o `WorkflowStep` debe:

1. **Exponerse** en la vista clásica (formularios, listados, etc.)
2. **Exponerse** en el Visual Builder (plantillas de nodo, editor del panel de propiedades, round-trip JSON)
3. **Hacer round-trip** a través del formato export/import (subir `schemaVersion` en `AutoOCExportFile` y añadir migración en `importFromData` si cambia la forma)
4. **Migrarse** para usuarios en versiones anteriores mediante el código en `loadSettings()`

El Visual Builder es la UI canónica para cualquier cambio no trivial en workflows. Nuevos tipos de paso, nuevos modos de transición, nuevos tipos de nodos visuales, nuevas formas de conexión — todo eso aterriza primero en el Visual Builder y se refleja después en la vista clásica.

---

Si quieres ampliar el plugin para Mac/Linux, la parte a adaptar es el launcher de procesos en segundo plano (actualmente optimizado para Windows).

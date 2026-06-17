# AutoOC for Obsidian

Obsidian plugin to schedule and run OpenCode CLI tasks and workflows with model selection, manual execution, logging, diagnostics, task stopping, and a direct OpenCode CLI launcher.

## Features

- Create tasks with:
  - name
  - prompt/goal
  - OpenCode model
  - schedule: once, daily, or weekly
  - Ralph Loop option
- Manual task execution
- Automatic checking of due tasks
- Output logging per task
- Built-in diagnostic to validate OpenCode from Obsidian
- Button to stop running tasks
- Configurable timeout per task
- Dynamic model loading via `opencode models`
- Assistant to install/activate Ralph Loop in `~/.config/opencode/opencode.json`
- Direct `OpenCode CLI` launcher from the AutoOC panel
- Schedulable workflows that chain existing tasks in order
- Workflow transitions: continue on success, force continue, or AI decides from previous output
- Runtime handoff between workflow steps for branch and output context

## Requirements

- Obsidian Desktop (Community plugins enabled)
- OpenCode installed locally
- Windows (current flow uses PowerShell/VBScript for silent execution)

## Project Structure

- `main.ts`: plugin source code
- `styles.css`: styles
- `manifest.json`: plugin metadata
- `main.js`: final build consumed by Obsidian
- `esbuild.config.mjs`: build/bundle
- `deploy.mjs`: copies files to `.obsidian/plugins/auto-oc`

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

## Current Status

- Diagnostic working
- Task execution using silent launcher on Windows
- Logs available from UI

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

## Estado actual

- Diagnostico funcionando
- Ejecucion de tareas usando launcher silencioso en Windows
- Logs disponibles desde UI

---

Si quieres ampliar el plugin para Mac/Linux, la parte a adaptar es el launcher de procesos en segundo plano (actualmente optimizado para Windows).

# AutoOC for Obsidian

![AutoOC workflow overview](docs/assets/autooc-overview.svg)

AutoOC is a desktop-only Obsidian plugin for scheduling and running OpenCode, Codex, and GitHub Copilot CLI tasks and visual workflows from an Obsidian vault.

**Automatización y agentes:** [referencia completa de la CLI: comandos, parámetros y ejemplos](#referencia-completa-de-la-cli-autooc).

**Seguimiento de desarrollo:** [expediente 1.7.13: cambios, flujos, contratos, límites y preparación de entrega](docs/autoOC/04_Desarrollo/entrega-1.7.13-20261101/README.md).

## Dashboard por áreas

Desde 1.7.12, **Dashboard** organiza los workflows y tareas por su campo **Area**, con un grupo **No area** para los elementos sin asignar. Para reorganizarlos, cambia su área desde el editor o las acciones de selección. Las posiciones del mapa anterior se conservan en la configuración.

Cada elemento tiene una burbuja y un nombre visible: doble anillo para workflows, terminal para tareas IA y **{ }** para Code. Selecciona un workflow para ver sus pasos, incluidos Code y esperas, y selecciona un paso para consultar **Log**, **History** o **Open controls**. Este último abre los controles habituales de ejecución, parada, edición y desactivación. El log de un workflow corresponde a su paso actual; los pasos tienen resultados propios y no se consideran completados solo porque terminó el workflow.

La búsqueda incluye nombres de pasos y áreas. **Needs attention** filtra incidencias registradas; **Show disabled** muestra los desactivados en gris. Cada área se puede plegar, y **Collapse areas / Expand areas** actúan sobre todos los grupos. Selección, búsqueda y colapsos se conservan durante la sesión del panel. El tamaño exacto de las burbujas de tareas y pasos sigue disponible en Settings (10–80 px).

Desde 1.7.13, una ejecución controlada por esta instancia muestra **Running** sin convertir las marcas internas de recuperación en avisos. Se verifica la identidad de ese intento; tener Obsidian abierto no basta. Los avisos de aprobación pendiente, parada no confirmada, fallo o control no confirmado se conservan.

Los contadores separan elementos principales y pasos en ejecución. Muestran estado registrado, no una verificación independiente de actividad del proceso. El panel se actualiza con los eventos existentes, mantiene las posiciones de lectura y limita inicialmente los pasos visibles a 40, ampliables con **Show more steps**. No añade consultas periódicas ni movimiento continuo; solo una señal breve cuando cambia un estado, respetando la preferencia de movimiento reducido.

## Abrir una CLI interactiva

OpenCode 1 y OpenCode 2 se configuran como motores separados, con rutas, modelos y agentes propios. **Check version** identifica la instalación y las tareas existentes conservan su motor. Consulta la [guía de OpenCode 2](docs/opencode-2.md) para configurar tareas automáticas, sesiones interactivas y borradores.

**💻 CLI** reúne OpenCode, Codex CLI, GitHub Copilot CLI y Claude Code. El selector muestra los ejecutables disponibles que hayas habilitado y permite abrir la carpeta del proyecto o elegir otra.

En **Settings → AutoOC → Interactive CLI launchers**, activa los accesos que quieras y configura su ejecutable. **Auto-detect** busca primero en `PATH`; también puedes indicar una ruta absoluta, sin argumentos. Las rutas de OpenCode, Codex y Copilot se comparten con sus tareas. Claude Code se incorpora como lanzador interactivo; no añade un nuevo tipo de tarea programada.

Cada sesión se abre directamente en una terminal y usa la autenticación, el modelo y las aprobaciones propios de esa CLI. Codex se inicia como `codex`, sin abrir la aplicación de escritorio; Claude usa `claude`, su [entrada interactiva oficial](https://code.claude.com/docs/en/cli-reference). AutoOC no añade prompts ni permisos automáticos. Estas sesiones no crean tareas ni adquieren la reserva del programador, y se gestionan desde su terminal.

Si un ejecutable falta o está deshabilitado, el diálogo ofrece **Configure CLIs**. **Working Directory** determina la carpeta inicial; vacía usa la bóveda. Linux conserva la configuración de **Linux terminal emulator**. El comando anterior de Codex mantiene su identificador para conservar los atajos y ahora se llama **Open Codex CLI**.

## Crear desde una descripción

En **New Task** y **New Workflow**, **Create with AI** abre un formulario para describir el objetivo y elegir motor y modelo. Usa el **WF Builder Prompt** integrado y la sesión de la CLI configurada; la generación se puede cancelar.

Desde 1.7.11, **Model** es un desplegable: reutiliza las listas cargadas de OpenCode 1 y Codex y los modelos usados por tareas del motor seleccionado. OpenCode 2 y Copilot muestran sus modelos configurados o usados, sin mezclar motores. **Other model…** permite introducir un identificador propio; **Automatic (CLI default)** deja que la CLI lo elija. La selección se conserva al cambiar de motor dentro del formulario, se usa para generar el borrador y se copia a las tareas creadas con ese motor. Puedes cambiar después el modelo de cada tarea. El selector no consulta proveedores ni cambia los ajustes globales al abrirse.

Cuando termina, **Review in editor** lleva el borrador al editor habitual. Los workflows generados son secuenciales, con entre 2 y 30 pasos. **Edit draft task** permite revisar los prompts, modelos y permisos de sus tareas antes de pulsar **Create Workflow**. Las tareas nuevas se guardan junto con el workflow; cancelar no las añade al catálogo. La programación inicial es manual y los permisos adicionales de código están desactivados hasta su revisión.

Si la respuesta es inválida, hay un problema de autenticación o se agota el tiempo, el formulario conserva el objetivo y permite reintentar o cambiar de motor. La generación no depende de la reserva de ejecución ni inicia las tareas generadas. OpenCode 1 necesita una CLI compatible con `run --pure`; OpenCode 2 utiliza `run --standalone`. Los motores requieren instalación y autenticación propias.

## Selección múltiple

**Tasks** también muestra **Workflow code steps**: el código guardado directamente dentro de los workflows, con nombre, origen, área y estado del paso. Sus tarjetas se pueden colapsar y ofrecen **Run**, **Stop**, **Enable/Disable**, **Log**, **History** y **Edit Code**, también dentro de **WorkFlows**. **Run** ejecuta únicamente ese paso, con entrada y resultados previos vacíos; conserva el último resultado del workflow completo. **Stop** interrumpe el código y detiene la continuación de esa ejecución; no deshace efectos ni certifica que hayan terminado los comandos externos ya iniciados. Los intentos interrumpidos se pueden revisar desde **Review interrupted attempt**.

El código se ejecuta en un proceso separado para que Obsidian y Stop sigan respondiendo. Requiere **Node.js 18 o posterior**, disponible en PATH o en una ubicación habitual de instalación; si falta, AutoOC lo indica sin ejecutar el paso. No deja scripts temporales en la bóveda. Desactivar un paso conserva código, resultados e historial y bloquea el workflow que lo necesita, igual que una tarea desactivada. **History** muestra los intentos del paso, tanto individuales como dentro del workflow. **Open workflow** abre el original para editarlo. Las vistas previas de código y salida se cargan al desplegarlas y se limitan a 12.000 caracteres. Los pasos conservan sus identidades; no se duplican como tareas de catálogo ni se incluyen en sus acciones múltiples.

El filtro **Task source** permite mostrar **All items**, **Catalog tasks** o solo **Workflow code steps**.

En **Tasks** y **WorkFlows**, pulsa **Select items** para mostrar las casillas y las acciones en lote. Marca las filas o usa **Select visible** para seleccionar los resultados del filtro actual. La selección se conserva al filtrar y cambiar de pestaña; el contador avisa de los elementos seleccionados fuera de la lista visible. **Clear selection** desmarca ambas pestañas. **Hide selection** oculta los controles y desmarca todo para no dejar selecciones invisibles.

- **Change area** aplica un área existente o nueva; dejar el campo vacío elimina el área. No cambia el área de los pasos ni de otras tareas del workflow.
- **Export selected** abre la exportación con esa selección. Los workflows incluyen automáticamente las tareas que necesitan.
- **Disable selected / Enable selected** desactiva o reactiva los elementos tras revisar la lista. También puedes usar **Disable / Enable** en cada tarjeta.
- **Delete selected** muestra la lista exacta antes de confirmar. Elimina solo los elementos seleccionados y sus datos guardados en el catálogo, conservando los registros de ejecución en disco. Exporta antes si quieres conservar las definiciones. Si un workflow necesita una tarea seleccionada, el diálogo lo identifica: selecciónalo también o quita esa referencia en su editor. Las ejecuciones activas o pendientes de revisión deben resolverse antes de modificar sus definiciones.

Los cambios se guardan juntos. Si los elementos cambian desde que se abrió la confirmación, hay que revisar de nuevo la selección.

Los elementos desactivados se muestran en gris con **Disabled**. Conservan configuración, programación, resultados e historial, pero no pueden iniciarse manualmente, por programación ni mediante la CLI. Un workflow que usa una tarea desactivada tampoco puede arrancar: hay que reactivarla; no se omiten pasos. Desactivar un workflow no desactiva sus tareas reutilizables. **Enable** vuelve a activar la programación guardada, que podría ejecutarse en la siguiente comprobación. Las ejecuciones activas o pendientes de revisión deben terminar o revisarse antes de cambiar esta opción. La desactivación se conserva al exportar e importar; los paquetes antiguos siguen activos por defecto.

## What It Does

Desde 1.7.5, las tareas y los pasos Code muestran JavaScript con colores de sintaxis. El editor incluye números de línea, plegado, parejas de llaves, búsqueda y deshacer. **Indent code** ajusta la sangría del borrador; **Wrap lines** adapta las líneas al ancho disponible. Tab y Shift+Tab cambian la sangría, Ctrl/Cmd+F busca y Ctrl/Cmd+Z deshace. Los cambios solo se conservan al guardar el formulario. Ver o editar código no lo ejecuta.

- Create OpenCode tasks with manual, one-time, daily, weekly, monthly, or interval schedules.
- Run tasks manually, monitor their status and output, keep logs, configure timeouts, and stop running work.
- Load available OpenCode models and agents, open configured interactive CLIs from the shared CLI selector, and run a diagnostic from Obsidian.
- Build workflows in the WorkFlows editor. Workflows support task, delay, and JavaScript code steps; default, forced, conditional, and AI-evaluated transitions; and branching paths.
- Import and export task and workflow packages as JSON, and use the included library packages as examples.
- Secrets se ha retirado: sin gestión ni inyección de valores. Se conserva el archivo histórico y el enmascaramiento de valores conocidos cuando está disponible.

## Ejecuciones independientes

El editor de AutoOC permite seleccionar `concurrency: "independent"` en una tarea o workflow. El valor ausente o `"exclusive"` conserva la ejecución exclusiva histórica. Un mismo host propietario admite hasta dos ejecuciones independientes; GUI y CLI delegada comparten ese límite, sin cola ni reintentos automáticos.

Las definiciones no pueden compartir tareas, directorios iguales o anidados ni metadatos Git (incluidas worktrees). Code con permisos de bóveda, archivos o terminal, las modalidades interactivas y las evaluaciones con modelo requieren exclusividad. Los motores no interactivos requieren espacios de trabajo físicos disjuntos. Esta política coordina tareas de confianza y no aísla sus efectos ni amplía permisos.

Cada ejecución conserva su `runId`, salida y parada. Las tarjetas muestran si el propietario local está verificado. Una reserva incierta permanece bloqueada para continuación o reconciliación oficial; su antigüedad no demuestra abandono. Si una CLI autónoma posee la instalación, abrir Obsidian conserva la vista de espera y al propietario original, sin iniciar tareas ni transferir la ejecución.

## Requirements

- Obsidian Desktop with Community plugins enabled.
- The CLI for your chosen engine installed and authenticated: OpenCode, Codex, or GitHub Copilot CLI.
- Windows, macOS, or Linux.

## Install

### From a release

Descarga el ZIP de la versión publicada y extrae su contenido en `<vault>/.obsidian/plugins/auto-oc/`. Debe contener los siete archivos: `main.js`, `manifest.json`, `styles.css`, `autooc-cli.cjs`, `autooc-runtime.cjs`, `skills/autooc-runtime/SKILL.md` y `release-integrity.json`. El paquete completo puede arrancar sin red.

Desde 1.6.0, usa la actualización del propio plugin. Al recibir los tres archivos del actualizador antiguo, el nuevo `main.js` completa automáticamente el paquete antes de habilitar ejecuciones. Necesita red para ese primer completado y exige la misma versión y los mismos bytes del bundle. Un fallo de red o integridad informa del problema y permite reintentar; una transacción incierta conserva su marcador y respaldo y bloquea ejecución. No borres reservas ni journals para forzar la carga. Esta corrección solo estará disponible por actualización pública cuando se publique la versión 1.6.2; prepararla en esta rama no acredita su publicación.

La recarga espera de forma acotada a que termine una escritura del catálogo iniciada por la vista antigua, tanto la escritura directa de 1.6.0 como el guardado atómico de 1.6.1. En este último caso observa la cola de guardados: solo admite un nuevo lock cuando ha comprobado que un temporal del guardado anterior pasó a ser el catálogo por renombrado atómico. Los avisos del directorio adelantan las comprobaciones, sin sustituirlas. Una transición no observada o incierta bloquea; tras terminar exige datos válidos y estables y fija su identidad. Un lock persistente, sustituido o inseguro, un cambio posterior del catálogo o efectos pendientes detienen el arranque sin sustituir datos por valores vacíos. Conserva la evidencia y el diagnóstico; no borres una reserva para forzar el reintento.

Reload Obsidian, then enable **AutoOC — OpenCode Task Scheduler** in **Settings > Community plugins**.

Si Obsidian usa una carpeta de configuración personalizada, instala el plugin en `<vault>/<configDir>/plugins/auto-oc/`. Las tareas y workflows compartidos usan el catálogo, la reserva, el journal, la recuperación y las aprobaciones de esa instalación. Si cambias la selección con una reserva activa, AutoOC rechaza la discrepancia: termina o reconcilia la ejecución y recarga Obsidian. La CLI conserva `.obsidian/plugins/auto-oc` como ubicación predeterminada; no busca otras instalaciones.

### Local development

```powershell
npm install
npm run build
node deploy.mjs "C:/path/to/your/vault"
```

`node deploy.mjs` copia los siete artefactos ya compilados a `<vault>/.obsidian/plugins/auto-oc/`, conservando configuración e historial. Ejecuta antes `npm run build` y descarga el plugin sin ejecuciones pendientes. Usa `npm run dev` para compilación iterativa y `npm run build` para generar el paquete verificable.

For iterative bundling, run:

```powershell
npm run dev
```

## Use AutoOC

1. Open the AutoOC panel from its ribbon icon or command palette command.
2. Create a task, select an OpenCode model and schedule, then save it.
3. Choose **Run** to execute immediately or let the scheduler run it when due.
4. Review output and logs in the panel; use **Stop** to cancel an active task.

AutoOC ejecuta OpenCode como proceso local. Obsidian guarda las tareas y workflows en los datos del plugin de la bóveda. El archivo histórico de credenciales se conserva sin modificar en la carpeta del plugin. Consulta la [arquitectura](docs/architecture.md) para ver los recorridos de ejecución y datos.

### GitHub Copilot CLI

1. Install [GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli) and sign in from a terminal using `copilot login`. Your account and organization must permit Copilot CLI access.
2. En **Interactive CLI launchers**, configura **GitHub Copilot CLI executable**, con `copilot` para detección automática o una ruta absoluta. **Auto-detect** guarda la ruta encontrada. En **GitHub Copilot task defaults → Test Copilot installation → Detect & test** puedes verificar la instalación; el acceso a la cuenta se comprueba cuando se ejecuta una tarea.
3. Create a **GitHub Copilot CLI task** in the task editor. Enter its prompt, project folder and schedule. Optionally enter a model ID available to your account (`/model` in Copilot lists them). Empty uses AutoOC's **Default Copilot model**, then the CLI default.
4. Tasks expose only file reading and search tools by default. Enable **Allow tools automatically** on a task to let Copilot edit files and run commands without asking. Folder and URL permissions still follow Copilot's policy. This permission is included in exported packages, so review it before running imported tasks.
5. Run the task and follow its output in AutoOC. **Stop**, timeouts, recurring schedules, saved logs, and workflow output handoff are supported. Copilot tasks can share a workflow with OpenCode, Codex and JavaScript steps.

Copilot tasks run in the background using the selected folder's currently checked-out branch. They do not open an interactive terminal, use OpenCode agents/Ralph Loop, or change branches automatically. AI-evaluated workflow transitions still use the existing OpenCode evaluator. Long prompts use a temporary UTF-8 instruction file that is removed when the task ends. AutoOC no inyecta valores del almacén retirado; mantiene el enmascaramiento histórico aplicable en el plugin.

Exports containing Copilot tasks use schema `1.6.0` and `taskKind: "copilot"`; older schemas remain supported. As with other engines, exported packages use the importing system's default model. See the included [Copilot example](library/copilot-code-review.json).

If a task reports **Access denied by policy settings**, check your [Copilot account settings](https://github.com/settings/copilot) and organization policy. AutoOC cannot override GitHub's access restrictions.

## Edición de workflows

Crea y edita workflows desde **WorkFlows**. El WF Visual Builder se ha retirado; los workflows existentes, sus pasos y transiciones, historial e importación/exportación JSON se conservan. **Create with AI**, dentro de **New Task** y **New Workflow**, utiliza el prompt integrado para generar un borrador a partir de tu objetivo; ya no hay un botón separado **WF Builder Prompt**.

## Ralph Loop

For tasks that should continue until their completion criteria are met, enable Ralph Loop in the task editor. AutoOC prefixes the task prompt with `/ralph-loop`; the OpenCode Ralph Loop stops when it emits `<promise>DONE</promise>` or reaches its maximum iterations. Make the done criteria explicit in the prompt. Set it up from the command palette with `AutoOC: Ralph Loop Assistant (install/activate)`, then restart OpenCode.

## Retirada de Secrets y AutoOC MCP

Secrets se ha retirado del producto: no hay controles de gestión, revelado, copia ni PIN, y ningún lanzamiento recibe automáticamente sus valores. El archivo histórico `secrets.vault.json` se conserva sin borrarlo, reescribirlo, migrarlo ni exportarlo. La autenticación propia de OpenCode, Codex y Copilot y el entorno ordinario del proceso mantienen su contrato.

`requiresAutoOCSecrets: true` se conserva al cargar, importar, exportar y editar tareas, workflows y pasos antiguos. Todos los hosts rechazan una dependencia declarada antes del primer efecto, incluida una tarea posterior a un paso Code; hay que adaptar la definición. El indicador no detecta dependencias ocultas en prompts o scripts.

El plugin mantiene un componente interno de solo lectura para enmascarar valores históricos conocidos de cuatro o más caracteres antes de mostrar o persistir salidas. Requiere que Electron safeStorage pueda descifrarlos; si el archivo es ilegible o el descifrado falla se avisa sin contenido sensible y sin sobrescribirlo. No protege universalmente credenciales externas ni acredita enmascaramiento en el host autónomo, que no accede al almacén cifrado.

El puente MCP local se retira en 1.6.2 para eliminar su carrera de arranque y descarga. AutoOC no modifica configuraciones ni credenciales de otros clientes. La ejecución autónoma sigue disponible con la CLI y la [skill distribuida](skills/autooc-runtime/SKILL.md). El almacén de credenciales existente se conserva.

## Referencia completa de la CLI AutoOC

La CLI distribuida con la extensión es **`autooc-cli.cjs`**. Esta referencia corresponde al candidato **1.7.10**. Consulta siempre `version` y `help` de la instalación que vayas a utilizar: una CLI antigua puede no admitir las opciones nuevas. No es la CLI del proveedor (OpenCode, Codex, Copilot o Claude); el botón **CLI** abre esos programas interactivos por separado.

```powershell
$cliPath = 'C:/ruta/vault/.obsidian/plugins/auto-oc/autooc-cli.cjs'
$vaultPath = 'C:/ruta/vault'
node $cliPath version
node $cliPath help
node $cliPath list --vault $vaultPath
node $cliPath status --vault $vaultPath
```

Requiere Node.js 18 o posterior. En la tabla, `CLI` es la ruta absoluta del archivo anterior y `VAULT` la ruta absoluta de la bóveda. **Anteponer `node CLI` a cada llamada** y entrecomillar las rutas con espacios. La CLI selecciona `<VAULT>/.obsidian/plugins/auto-oc`; no busca carpetas de configuración alternativas ni ofrece un parámetro para elegirlas.

### Todas las llamadas disponibles

| Llamada y parámetros | Qué hace y qué necesita |
| --- | --- |
| `version` | Consulta versión, capacidades y compatibilidad. Sin parámetros. |
| `help` | Consulta la sintaxis admitida. Sin parámetros; no es `--help`. |
| `list --vault VAULT` | Lista tareas, workflows y `codeSteps`, incluyendo su desactivación. Solo lectura. |
| `status --vault VAULT` | Añade estados guardados, ejecuciones, reservas y aprobaciones pendientes. Solo lectura; no certifica actividad real. |
| `run --vault VAULT SELECTOR` | Inicia una ejecución **nueva**. Rechaza elementos desactivados y respeta las reservas, dependencias y permisos. |
| `resume --vault VAULT SELECTOR --run RUN_ID` | Continúa la ejecución exacta; puede ejecutar pasos pendientes. También rechaza elementos desactivados. |
| `reconcile --vault VAULT SELECTOR --run RUN_ID` | Revisa y persiste el resultado de la ejecución registrada sin lanzar el siguiente paso. No es una consulta ni repite un trabajo incierto. |
| `stop --vault VAULT SELECTOR --run RUN_ID` | Solicita parar esa ejecución. Si ya es terminal, devuelve `requested: false`. No deshace efectos ni prueba que hayan terminado todos los procesos externos. |
| `approve --vault VAULT --run RUN_ID --approval TOKEN` | Aprueba la solicitud pendiente identificada por su token exacto; puede permitir que continúe una operación. |
| `deny --vault VAULT --run RUN_ID --approval TOKEN` | Rechaza esa solicitud pendiente. |
| `export-workflow --vault VAULT --workflow WORKFLOW_ID --out ARCHIVO_JSON` | Exporta los campos editables y su `expectedHash` a un archivo nuevo. No exporta el paquete de importación completo. |
| `edit-workflow --vault VAULT --workflow WORKFLOW_ID --patch ARCHIVO_JSON` | Aplica un parche compatible a través del plugin abierto, sin actividad pendiente. Exige el hash observado; no ejecuta el workflow. |
| `inspect-terminal --vault VAULT --run RUN_ID` | Obtiene la inspección de un intento terminal para revisar sus efectos inciertos. Solo lectura. |
| `dispose-terminal --vault VAULT --decision ARCHIVO_JSON` | Registra una decisión humana sobre ese intento terminal, conservando su estado y los efectos desconocidos. Plugin descargado y decisión basada en la inspección exacta. |
| `abandon --vault VAULT --workflow WORKFLOW_ID --run RUN_ID --revision N --reason TEXTO --acknowledge-unknown-effects true` | Abandona explícitamente un intento no terminal sin inventar un resultado. Plugin descargado; autorización humana para aceptar efectos desconocidos. Para tareas independientes, `WORKFLOW_ID` es `@task:TASK_ID`. |
| `recover-lease --vault VAULT --owner TOKEN` | Recupera la reserva del propietario observado únicamente si se demuestra su ausencia. No reanuda ejecuciones ni resuelve efectos inciertos. |
| `inspect-settings-write --vault VAULT` | Inspecciona un guardado interrumpido, identidades y motivos que impiden recuperarlo. Solo lectura. |
| `recover-settings-write --vault VAULT --decision ARCHIVO_JSON` | Recupera el guardado conforme a una decisión explícita vinculada a esa inspección. Conserva el catálogo; no recupera la reserva de ejecución ni reanuda tareas. |
| `maintain-release --vault VAULT --inspect` | Inspecciona la actualización desde un paquete nuevo completo, separado de la instalación de destino. No instala. |
| `maintain-release --vault VAULT --install` | Respalda e instala ese paquete con el plugin descargado y la reserva libre. Conserva históricos y no resuelve intentos por su cuenta. |
| `maintain-release --vault VAULT --decisions ARCHIVO_JSON` | Aplica decisiones administrativas revisadas y después instala bajo la misma reserva. Las decisiones son un array; una decisión ya persistida no se deshace si falla la instalación posterior. |

Las tres variantes de `maintain-release` son excluyentes. Todos los argumentos de la tabla son obligatorios; `SELECTOR` se sustituye por **una** de estas formas:

| Selección | Parámetros |
| --- | --- |
| Tarea independiente, incluida una tarea de tipo Code | `--task TASK_ID` |
| Workflow completo | `--workflow WORKFLOW_ID` |
| Un paso Code del workflow | `--workflow WORKFLOW_ID --step STEP_ID` |

`--step` requiere `codeStepSelection: true` en `version` y un plugin cargado compatible si hay delegación. Solo admite pasos Code, no pasos de espera o referencias a tareas. Los IDs proceden de `list`/`status`; los nombres pueden repetirse. No mezclar `--task` y `--workflow`.

### Parámetros y archivos de decisión

- `--vault`: ruta absoluta a la bóveda, no a la carpeta del plugin. `--out`, `--patch` y `--decision`/`--decisions` también usan rutas absolutas.
- `--run`: `runId` exacto devuelto por la ejecución o por `status`. Es obligatorio para `resume`, `reconcile` y `stop`; no se admite en `run`.
- `--owner`: token de la reserva observado en `status`, no el PID. `--approval`: token de la aprobación pendiente. No inventar ni reutilizar tokens de otra solicitud.
- `--revision`: revisión entera no negativa observada en el intento. `--reason`: explicación de la decisión humana. `--acknowledge-unknown-effects` exige el literal `true`.
- `--out`: archivo que todavía no exista. `--patch`: archivo JSON regular de hasta 60 KB, con `expectedHash` y `changes`. Los cambios admitidos son `name`, `description` y `stepChanges: [{id, name?, code?, evaluatePrompt?}]` para pasos existentes. No cambia estructura, tareas referenciadas, motores, modelos, permisos ni desactivación. Ante conflicto, exportar de nuevo antes de preparar otro parche.
- `dispose-terminal --decision`: JSON con la inspección exacta de `inspect-terminal`, más `reason` y `acknowledgedUnknownEffects: true`. No convertir una incertidumbre en éxito.
- `recover-settings-write --decision`: JSON con `schemaVersion: 1`, `action: "recover-settings-write"`, `vault`, `installationDirectory`, `inspectionHash`, `token` y `transactionId` de la inspección; además `reason`, `preserveCatalog: true` y `executionsResumed: false`. Si la inspección no autoriza recuperar, el comando rechaza la operación.
- `maintain-release --decisions`: array de inspecciones individuales revisadas, cada una con `reason` y `acknowledgedUnknownEffects: true`. Consultar el procedimiento de mantenimiento y la [guía distribuida](skills/autooc-runtime/SKILL.md) antes de usarlo.

Para `run`, `resume`, `reconcile` y `stop` se admite otro orden de parámetros, sin duplicados. **Para el resto, conservar el orden mostrado en la tabla.** No hay parámetros generales para sobrescribir motor, modelo, prompt, permisos o desactivación: se usan los de la definición instalada.

### Elementos desactivados y pasos Code

`list` y `status` conservan los elementos desactivados en sus resultados. `disabled` indica la desactivación del propio elemento; `blockedByDisabled` incluye el bloqueo por dependencias y `disabledReason` explica el motivo. Un workflow activo puede estar bloqueado por una tarea o un paso desactivado. `recordedStatus`, presente en `status`, es el estado guardado de ejecución y es independiente de la desactivación. `blockedByDisabled: false` **no certifica** que se pueda ejecutar: aún se comprueban propiedad, actividad, configuración y permisos.

`codeSteps` identifica los pasos Code mediante `workflowId` e `id` del paso. Su disponibilidad corresponde a su ejecución aislada: requiere que el padre y ese paso estén activos, sin depender de otros pasos del workflow que no se van a ejecutar. El tamaño de burbujas y las opciones de colapso son preferencias visuales; no alteran esta disponibilidad.

```powershell
# Ejecutar únicamente el paso Code seleccionado, con entrada/resultados previos vacíos.
node $cliPath run --vault $vaultPath --workflow WORKFLOW_ID --step STEP_ID

# Conservar el runId devuelto; no lanzar otro run para continuar el anterior.
node $cliPath resume --vault $vaultPath --workflow WORKFLOW_ID --step STEP_ID --run RUN_ID
node $cliPath reconcile --vault $vaultPath --workflow WORKFLOW_ID --step STEP_ID --run RUN_ID
node $cliPath stop --vault $vaultPath --workflow WORKFLOW_ID --step STEP_ID --run RUN_ID
```

La ejecución aislada no sigue las transiciones del paso ni sustituye el último resultado del workflow completo. `--step` verifica también la pertenencia del intento al detenerlo. La CLI no reactiva automáticamente elementos: **Enable/Disable** se gestiona en AutoOC. `reconcile` y `stop` siguen disponibles para el intento exacto de un elemento desactivado; las demás comprobaciones de identidad y recuperación continúan vigentes.

### Salida y códigos de retorno

Las llamadas completadas devuelven un único documento JSON por **stdout**. Las ejecuciones emiten progreso JSON por líneas en **stderr**, con `host: "obsidian"` o `"standalone"`. Los resúmenes incluyen `runId`, `workflowId`, `phase`, `revision`, `nextStepId` y, cuando están disponibles, `workflowName` y `executionKind`. Una ejecución aislada añade `stepId` y conserva `executionKind: "workflow"`. Los journals no incorporan estos campos de presentación.

El código de salida es **0** al completar la llamada, **1** ante error o resultado `failed`, y **130** cuando la ejecución devuelve tras SIGINT/SIGTERM. Una interrupción durante la espera delegada puede devolver 1 con petición de cancelación y resultado incierto. Un código 0 de `stop`, `approve` o `reconcile` no significa que el workflow haya terminado correctamente: consultar el JSON. Un timeout tampoco autoriza repetir efectos. `activityVerified: false` en las consultas deja explícito que no son una prueba de actividad en vivo.

### CLI con Obsidian abierto

En un paquete que indique `pluginRequests: 1` al consultar `version`, la CLI puede pedir al plugin abierto que ejecute una tarea o workflow. Abre el Dashboard para ver su progreso y resultados. Se usan los mismos comandos:

```powershell
node "C:/ruta/vault/.obsidian/plugins/auto-oc/autooc-cli.cjs" run --vault "C:/ruta/vault" --task ID_TAREA
node "C:/ruta/vault/.obsidian/plugins/auto-oc/autooc-cli.cjs" run --vault "C:/ruta/vault" --workflow ID_WORKFLOW
```

El plugin y la CLI deben pertenecer al mismo paquete compatible. Con Obsidian abierto, el plugin mantiene la reserva y ejecuta la petición; con el plugin descargado y sin reserva, la CLI ejecuta directamente. El resultado final es un único documento JSON por stdout y el progreso de ambos hosts se informa como objetos JSON por línea en stderr. La delegación respeta las reglas de concurrencia del host y no abre ningún puerto de red. Cerrar solo el Dashboard no detiene la tarea.

`run`, `resume` y `reconcile` incluyen `workflowName` y `executionKind` junto con `workflowId`, `runId`, fase, revisión y siguiente paso. El nombre procede de la definición preparada en la instalación seleccionada. El primer evento se publica antes de ejecutar el primer paso; los nombres duplicados se distinguen por sus IDs. `--task` conserva `@task:ID`, con `executionKind: "task"` y `workflowName: "Standalone task"`.

Ejemplo sintético de stderr y stdout, respectivamente:

```json
{"event":"progress","host":"standalone","runId":"aa11","workflowId":"weekly","phase":"ready","revision":0,"nextStepId":"first","workflowName":"Informe semanal","executionKind":"workflow"}
{"version":"1.6.9","experimental":true,"runId":"aa11","workflowId":"weekly","phase":"completed","revision":3,"nextStepId":null,"workflowName":"Informe semanal","executionKind":"workflow"}
```

En delegación, `host` es `obsidian`. Solo se proyectan los campos permitidos: no se incluyen prompts, código, resultados privados ni configuración ajena. Los nombres se escapan con JSON, incluidos saltos de línea y comillas. Las definiciones antiguas sin nombre omiten `workflowName`. Un plugin anterior puede omitir ambos campos nuevos; la CLI acepta ese recibo sin inventar un nombre ni repetir la ejecución. La identificación temprana completa requiere ambos componentes compatibles. Compilar estos componentes no acredita su instalación ni su carga en Obsidian.

Para observar la ejecución en el Dashboard, carga AutoOC antes de lanzar la CLI. Si la CLI ya está ejecutando autónomamente, abrir Obsidian no transfiere esa ejecución al plugin: la reserva sigue protegida hasta terminar o reconciliar.

Desde 1.6.7, el Live Log de OpenCode no interactivo muestra la respuesta y la traza mientras el proceso sigue trabajando, tanto si se inicia desde Obsidian como desde la CLI. La salida intermedia es temporal; el resultado final se guarda al terminar.

1.6.7 también hace cooperativas la carga y persistencia de catálogos grandes y permite editar texto/código de pasos existentes con `export-workflow` y `edit-workflow`, usando el hash esperado y la skill portable, sin cerrar Obsidian. Una ejecución activa conserva su exclusión y las ediciones concurrentes se detectan antes de guardar.

Si la CLI ya tiene la reserva al abrir Obsidian, AutoOC espera y vuelve a cargar tras su liberación normal estable. No elimina reservas ni repite tareas. Consulta [las notas de 1.6.7](RELEASE_NOTES_1.6.7.md) para el alcance y las validaciones pendientes.

`stop`, `resume` y `reconcile` conservan el ID de ejecución. Si se interrumpe la espera o se cierra Obsidian, consulta `status` y el recibo indicado antes de repetir; una entrega incierta nunca se convierte automáticamente en otra ejecución. Esta capacidad preparada en el repositorio no acredita su publicación o instalación.

## Diagnostics And Troubleshooting

En el candidato 1.7.2, las tarjetas con un intento registrado incluyen **What can I do?**. La ayuda explica el estado y abre los detalles y opciones del elemento; si una tarea pertenece al intento actual de un workflow, lleva a ese workflow.

- **Last run completed**: no necesita recuperar un propietario; su registro e historial siguen disponibles.
- **Needs review** o **Activity not confirmed**: revisar el registro y comprobar el proceso original antes de continuar o repetir trabajo. La ausencia de control local no demuestra que el proceso haya terminado.
- **Closed with unknown outcome**: conserva la decisión anterior y sus efectos desconocidos; no equivale a éxito.

**Refresh information** vuelve a consultar el estado disponible en el panel. La ayuda no inicia, detiene ni recupera ejecuciones. **Support details → Copy diagnostics** copia solo versión, estado e identidad del intento, sin prompts, resultados, rutas, tokens ni secretos.

Run `AutoOC: Diagnostic — test opencode command` from the command palette to check the configured OpenCode command. For setup failures, task launch problems, or timeouts, review the [architecture](docs/architecture.md) and verify the configured OpenCode command, task timeout, and plugin files under `.obsidian/plugins/auto-oc/`.

## Development

```powershell
npm test
npm run build
```

`npm test` runs the repository's Node test suite. The build type-checks TypeScript and bundles the Obsidian plugin. The primary source is `main.ts`.

The commands in this README are the authoritative command reference for implementation, contributor workflow, generated-file relationships, and quality gates.

## Release Artifacts

Crea el ZIP distribuible con los siete archivos enumerados en Instalación:

```powershell
npm run build
npm run pack:release
```

El paquete se guarda en `release/auto-oc-<version>.zip` y el script imprime su SHA-256. El descriptor verifica los seis artefactos restantes, su versión y sus hashes. Consulta el [workflow de publicación](RELEASE_WORKFLOW.md), la [lista de comprobaciones](PUBLISH_CHECKLIST.md) y el [changelog](CHANGELOG.md).

## Contributing

Contributions, bug reports, and workflow ideas are welcome. Preserve these invariants:

- Keep the workflow editor and JSON import/export consistent.
- Preserve task and workflow import/export compatibility, migrations, and JSON round trips when changing persisted workflow data.
- Regenerate release assets when their sources change.
- Run `npm test` and `npm run build` before submitting changes.

Start with the [architecture](docs/architecture.md).

## License

AutoOC is open source under the [MIT License](LICENSE).

## Actualización de históricos bloqueados (1.6.6 / 1.6.7 → 1.6.9)

Si el actualizador informa de efectos inciertos y `abandon` rechaza una ejecución
terminal, usa el paquete completo **1.6.9** desde una carpeta independiente.
Verifica su procedencia oficial antes de ejecutarlo. Esta guía prepara la nueva
versión; no acredita que esté publicada ni instalada en tu bóveda.

1. Descarga AutoOC normalmente desde Obsidian (desactivar el plugin). Una reserva
   que permanezca bloquea el procedimiento: no borres locks ni journals.
2. Desde el ZIP extraído, ejecuta:
   `node autooc-cli.cjs maintain-release --vault "C:/ruta/vault" --inspect`.
   La inspección no modifica la instalación y muestra identidad física, revisión
   y causas, sin prompts ni resultados privados.
3. Guarda en un JSON privado una **lista** con únicamente las inspecciones de las
   ejecuciones revisadas. Conserva todos sus campos; añade a cada objeto
   `"reason":"motivo humano concreto"` y `"acknowledgedUnknownEffects":true`.
   No selecciones ejecuciones de otra bóveda ni infieras decisiones globales.
4. Ejecuta desde esa misma carpeta:
   `node autooc-cli.cjs maintain-release --vault "C:/ruta/vault" --decisions "C:/ruta/decisiones.json"`.
   Comprueba el recibo: informa del respaldo privado verificado y de cada decisión
   durable, e instala los siete artefactos con la reserva del destino.
5. Activa AutoOC normalmente y comprueba la versión, historial y una nota testigo
   guardada/reabierta. El recibo de instalación **no acredita carga en Obsidian**.

La fase histórica, pasos y resultados se conservan; el resultado externo sigue
siendo **desconocido**, incluso tras resolver el bloqueo administrativo. La
decisión no detiene procesos, confirma su terminación ni repite pasos. Si queda
otro histórico incierto o una escritura pendiente, la instalación se detiene.
Los lectores antiguos aceptan el campo añadido y mantienen su bloqueo prudente.
No se necesita un comando nuevo en la CLI antigua.

Desde 1.6.9, el mantenimiento también reconoce un abandono oficial ya registrado
cuando el catálogo conserva los vínculos anteriores del mismo intento. Verifica
el snapshot original completo, identidad, hash histórico, revisión, fase y pasos;
no modifica esos vínculos ni vuelve a registrar el abandono. Si no quedan otras
incertidumbres por decidir, guarda `[]` en el archivo de decisiones después de
una inspección nueva. El resultado externo permanece `unknown` y `applied` queda
vacío. Un snapshot ausente, inseguro o incoherente, otro intento sin resolver,
una reserva o una escritura pendiente bloquean el procedimiento. No edites el
catálogo o la evidencia para sortear ese diagnóstico.

Si hay un fallo parcial, conserva el recibo, el respaldo y los snapshots.
Las decisiones durables permanecen; vuelve a inspeccionar y selecciona solo los
casos aún pendientes (lista `[]` explícita si todas las decisiones ya son durables). Si queda `update-pending.json`, utiliza la recuperación
soportada del instalador antes de ejecutar más trabajo. No edites sus registros.

## Guardados interrumpidos (candidato local)

El candidato añade `inspect-settings-write --vault <ruta-absoluta>` y
`recover-settings-write --vault <ruta-absoluta> --decision <JSON-absoluto>`.
Comprueba `version` y `help` de la CLI seleccionada por ruta absoluta antes de
usarlos: no se presupone que una instalación anterior los incluya. La inspección
no escribe y devuelve identidades, hashes y motivos de bloqueo, sin contenido
del catálogo. La decisión requiere revisión expresa de esa inspección; su
esquema y los límites están en [la guía del runtime](skills/autooc-runtime/SKILL.md#inspección-y-recuperación-explícita-de-guardados-candidato).
La recuperación crea un respaldo verificado y archiva la evidencia. Conserva
catálogo, checkpoints y reserva; la reanudación es otra acción independiente.

Al cerrar o recargar mientras AutoOC guarda, el plugin mantiene abierta la
ventana hasta terminar. El aviso indica cuándo puedes repetir el cierre o la
recarga. Si el proceso termina forzosamente, el siguiente arranque puede
archivar el guardado interrumpido únicamente con una prueba durable vinculada
al propietario ausente, al directorio y a las huellas del catálogo.

La recuperación conserva el último `data.json` confirmado y los temporales en
`runtime/settings-write-recovery-TOKEN`, con recibo verificable. No promueve
temporales ni reanuda tareas. Un propietario vivo o no verificable, archivos
alterados, mantenimiento pendiente o ejecuciones inciertas siguen bloqueando.
Los bloqueos antiguos sin esta prueba requieren recuperación explícita; no se
retiran por antigüedad. Un corte eléctrico puede dejar metadatos incompletos y
seguir requiriendo intervención. Esta protección pertenece al candidato de la
rama de desarrollo; la versión publicada 1.6.9 permanece sin cambios.

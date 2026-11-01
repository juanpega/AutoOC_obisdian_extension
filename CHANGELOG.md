# Changelog

## [1.7.15] - Candidato

- Añade `Review older attempts` en los ajustes de AutoOC y en la paleta de comandos, para revisar intentos pendientes que ya no están vinculados a la tarea o workflow actual.
- `Close this old attempt…` solicita confirmación y motivo, verifica de nuevo identidad, revisión e inactividad y utiliza el abandono oficial. Conserva el catálogo actual, su estado desactivado, los resultados y los intentos posteriores; no ejecuta trabajo nuevo.
- Un rechazo de Run por un intento antiguo validado también abre esta revisión. Los journals ausentes, modificados o no válidos no se redirigen a otra ejecución.

## [1.7.14] - Candidato

- Cuando Run queda bloqueado por un intento anterior identificado, abre ayuda contextual y permite llegar directamente a los controles de la tarea o workflow que bloquea, aunque sea otro elemento. La consulta no inicia, reanuda, cierra ni modifica ejecuciones.
- La ayuda identifica las opciones existentes para abandonar un intento o revisar incertidumbre terminal, explica sus efectos y conserva los diagnósticos sin prompts ni credenciales. Los errores ajenos y las identidades que ya no coinciden mantienen su diagnóstico original.
- Los intentos independientes en fase `ready` también ofrecen `Abandon attempt` cuando no están controlados por el host. La opción deja de aparecer en estados terminales; conserva las verificaciones y la confirmación de la operación existente.

## [1.7.13] - Candidato

- Preparación de distribución: manifiesto y descriptor coherentes con los bytes LF de Git. La generación del descriptor rechaza artefactos CRLF para evitar una actualización desde GitHub con hashes incompatibles. El empaquetador conserva los bytes de paquetes ya verificados. Regresión contra blobs reales de Git con normalización Windows.
- El Dashboard consulta el control de la ejecución exacta antes de mostrar `Needs attention`. Una tarea, workflow o paso Code en curso y controlado por el plugin conserva su indicación normal aunque el registro durable incluya marcas de recuperación. Aprobaciones, paradas no confirmadas, fallos y ejecuciones sin control confirmado mantienen sus avisos.

## [1.7.12] - Candidato

- Dashboard por áreas: grupos plegables con nombres visibles, burbujas distintas para workflows, tareas y Code, búsqueda de pasos, filtro de atención y opción de mostrar los desactivados.
- Panel de detalle con pasos del workflow, log, historial y acceso a los controles existentes. Los pasos Code conservan su identidad y muestran el último resultado aplicable, incluida la ejecución aislada.
- Diseño adaptable al ancho del panel, detalle de pasos por bloques de 40 y señales breves al cambiar el estado. No se ejecutan simulaciones de movimiento, consultas periódicas ni guardados de catálogo por las interacciones del Dashboard. Las posiciones históricas se conservan.

## [1.7.11] - Candidato

- Los creadores de tareas y workflows con IA ofrecen un selector de modelos por motor, con las listas ya cargadas y los modelos usados en tareas. Conservan la elección al cambiar de motor y admiten un identificador personalizado o la selección automática de la CLI. El modelo elegido se usa en la generación y en las tareas propuestas con ese motor.
- El prompt final de cada creador incluye un ejemplo JSON compatible con su editor, en lugar del ejemplo general con ramificaciones. Se comprueban los ejemplos reales para los cuatro motores y ambos creadores.

## [1.7.10] - Candidato

- CLI: `list` y `status` muestran desactivación propia, bloqueo por dependencias y pasos Code. `--workflow ID --step ID` permite ejecutar, continuar, reconciliar o detener un paso Code aislado como en la interfaz, conservando el resultado del workflow completo. La delegación exige un propietario compatible y valida la identidad del paso; los rechazos por desactivación ofrecen un diagnóstico legible.
- README: referencia completa de comandos, parámetros, selección, archivos de decisión, efectos y códigos de retorno. Actualizada la guía distribuida del runtime.

## [1.7.9] - Candidato

- El tamaño de las burbujas admite **10–80 px**. Apply guarda esta preferencia por bóveda y dispositivo, separada del catálogo de tareas e históricos, y actualiza las burbujas visibles sin reconstruir el panel. Evita esperar la cola de guardados del catálogo para un cambio visual. Conserva el tamaño anterior hasta elegir otro y muestra el estado del guardado.

## [1.7.8] - Candidato

- Settings permite elegir el diámetro exacto de las burbujas de tareas y steps del Dashboard entre 16 y 80 píxeles, en incrementos de 1. Incluye vista previa, **Apply** y **Reset to default** (30 px). Conserva el tamaño elegido en versiones anteriores.

## [1.7.2] - Candidato

- OpenCode 2 como motor independiente: ejecutable, modelo y agente propios, **Check version** en Settings y selección por tarea o como motor predeterminado. Las tareas automáticas usan `run --standalone` y las interactivas con prompt, `mini --standalone`; OpenCode 1 conserva sus comandos. Incluye workflows mixtos, importación/exportación y borradores con IA. No convierte tareas ni actualiza la CLI automáticamente. [Configuración y diferencias](docs/opencode-2.md).

- Tareas y workflows desactivables, individualmente o en lote, con aspecto gris y etiqueta **Disabled**. Se preservan configuración e historial y se impiden nuevos inicios manuales, programados y por CLI; los workflows requieren que sus tareas estén activas.
- Selección múltiple plegada inicialmente mediante **Select items / Hide selection**, con limpieza de la selección al ocultarla.

- **💻 CLI** unifica los accesos a OpenCode, Codex CLI, GitHub Copilot CLI y Claude Code: selector, carpeta del proyecto u otra carpeta y configuración de rutas y visibilidad. Codex abre su CLI directamente; se conserva el identificador del antiguo comando para los atajos. Las sesiones usan los ajustes propios de cada CLI y son independientes del programador. Claude Code se incorpora al lanzador interactivo.

- **Tasks** incluye los pasos Code internos de los workflows, con búsqueda, filtros, origen, vista previa y acceso al paso original. No duplica tareas ni altera el modelo de ejecución, permisos o transiciones.

- Selección múltiple en Tasks y WorkFlows: seleccionar los resultados visibles, cambiar el área, exportar o eliminar conjuntamente tras revisar la lista. La eliminación comprueba ejecuciones y referencias; un fallo de guardado restaura los elementos afectados.

- **Create with AI** en los creadores de tareas y workflows: objetivo, motor y modelo, generación cancelable con WF Builder Prompt y revisión en el editor. Los workflows secuenciales y sus tareas nuevas permanecen como borradores hasta el guardado conjunto; no se programan ni ejecutan durante la generación.
- Retirado WF Visual Builder: botón, comando, editor incrustado y generación del HTML. WorkFlows y la importación/exportación conservan los workflows existentes.

### Corregido

- **What can I do?** aparece únicamente ante fallos o acciones pendientes. Las tareas y workflows completados correctamente o en ejecución normal no muestran el bloque adicional de ayuda.

- El selector **CLI** de Windows mantiene el auxiliar de PowerShell oculto sin separarlo del proceso padre; la consola interactiva se abre por separado. Evita el caso en que el auxiliar terminaba con éxito sin ejecutar el lanzamiento de Codex u OpenCode. Ahora exige un recibo de creación de la terminal y muestra los errores del auxiliar.

- Las rutas npm de Codex en Windows conservan el acceso al ejecutable nativo para tareas y modelos, aunque el lanzador interactivo use el acceso `.cmd` o `.ps1` de esa misma instalación.
- La resolución de OpenCode respeta primero la instalación seleccionada por `PATH`, conservando las rutas explícitas y los directorios de respaldo para Obsidian. Evita que una copia antigua de npm oculte una instalación actualizada.
- Las tarjetas distinguen los intentos completados de la actividad sin confirmar: ya no muestran «propiedad no verificada» por no controlar una ejecución terminada. La ayuda «What can I do?» explica cada situación, abre las opciones de la tarea o del workflow correspondiente y permite copiar un diagnóstico sin prompts, resultados ni secretos.
- Los auxiliares de OpenCode se agrupan en `.autooc/auxiliary/` del directorio de trabajo; dejan de crear carpetas `.autooc-interactive-*` y `.autooc-runtime-*` sueltas en la raíz. Se limpian tras un cierre confirmado y se reintenta la limpieza pendiente en lanzamientos posteriores, conservando intentos inciertos, archivos ajenos y carpetas antiguas.
- La consulta del catálogo permanece disponible cuando la reserva del motor, un guardado pendiente o un error de recuperación impiden habilitar la ejecución. El panel permite refrescar los datos guardados, ver el diagnóstico y buscar actualizaciones sin modificar el catálogo ni programar tareas.
- La actualización comprueba la actividad real del host y los guardados en curso, sin exigir resolver históricos cancelados o interrumpidos. Conserva sus estados, resultados y efectos desconocidos; mantiene la exclusión de propietarios vivos y la verificación y restauración del paquete.
- `maintain-release --install` instala desde un paquete extraído conservando todos los intentos pendientes. Las decisiones administrativas sobre intentos concretos siguen siendo opcionales y explícitas.
- El ZIP conserva los bytes exactos del manifiesto construido y verifica su integridad antes de empaquetar, evitando invalidar el descriptor al cambiar el formato o los saltos de línea.

## [Unreleased]

### Added
- GitHub Copilot CLI task engine in the classic task editor and Visual Builder, with configurable executable/model, per-task tool permissions, streamed output, cancellation, timeouts, logs, and mixed-engine workflows.
- Copilot-aware schema `1.6.0` imports/exports and a read-only Copilot review library example; legacy packages remain supported.
- POSIX hidden launcher (`launchHiddenSh`) for macOS/Linux scheduled tasks, workflow validation, and Diagnostics. Replaces the Windows-only `.ps1`/`launchHiddenPS()` path with a platform-appropriate `/bin/sh` script that mirrors the same contracts: pid/out/err/done files, detached process group, and cleanup of children on cancel/stop.
- Linux terminal fallback: the plugin now probes `x-terminal-emulator`, `gnome-terminal`, `konsole`, `xfce4-terminal`, `lxterminal`, `alacritty`, and `xterm`, and honors a new `linuxTerminal` setting.
- Cross-platform release packaging via `scripts/package-release.mjs` (`npm run pack:release` now works on Windows, macOS, and Linux).
- CI matrix (`.github/workflows/ci.yml`) running build, tests, and release packaging on `windows-latest`, `ubuntu-latest`, and `macos-latest`.

### Fixed
- Las tareas y workflows compartidos del plugin usan la instalación seleccionada por Obsidian para catálogo, reserva, journal, recuperación y aprobaciones, incluso con una carpeta de configuración personalizada. Las ubicaciones inválidas y reservas cruzadas se rechazan; la CLI mantiene su ubicación predeterminada.
- Standalone Visual Builder exports now include portable task references so Copilot and mixed-engine workflows can be imported into AutoOC.
- Auto-detect the `opencode` binary on macOS/Linux. Obsidian (an Electron GUI app) does not inherit the shell `PATH`, so commands like `opencode models` previously failed with "command not found" and left the model list empty. The plugin now probes common install locations (`~/.bun/bin`, `~/.local/bin`, `~/.npm-global/bin`, `~/bin`, `/opt/homebrew/bin`, `/usr/local/bin`) and only falls back to the bare command name if none exist. An explicit path configured in Settings always wins.
- macOS AppleScript launch now shell-quotes the working directory, so vault paths containing spaces no longer break the terminal command.
- Interactive CLI launch failures (e.g. no Linux terminal emulator installed) are now reported to the task/UI instead of failing silently.
- `npm run pack:release` no longer depends on the missing Windows-only `package-release.ps1`.

## [1.5.10] - 2026-07-26

### Added
- Added interactive CLI tasks.
- Added workflow prompt sync support for workflow builder import/export changes.

### Changed
- Dashboard task and workflow names now update live after edits.

### Fixed
- Restored long timeouts for code tasks.

### Removed

### Deprecated

### Security

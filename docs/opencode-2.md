# OpenCode 1 y OpenCode 2

AutoOC permite seleccionar **OpenCode 1** y **OpenCode 2** como motores distintos. Una actualización de la CLI no convierte las tareas existentes: `taskKind: "opencode"` conserva el contrato anterior y `taskKind: "opencode2"` utiliza los comandos de la versión 2. Ambos pueden convivir en un workflow.

## Configuración

1. En **Settings → AutoOC → Interactive CLI launchers**, configura **OpenCode 2 CLI executable** con el ejecutable de la versión 2. **Check version** comprueba su versión y explica si corresponde al motor elegido. No cambia tareas ni configuración.
2. En **OpenCode 2 task defaults**, indica **Default OpenCode 2 model** (`provider/model`) y, si corresponde, **Default OpenCode 2 agent**. El agente inicial es `build`. Estos campos son independientes de OpenCode 1.
3. En el editor de la tarea, selecciona **OpenCode 2 task** para ejecución automática o **OpenCode 2 CLI task (interactive)** para abrir una sesión con el prompt. Guarda la tarea después de revisar modelo y agente.
4. Opcionalmente, selecciona **OpenCode 2** en **Default AI engine** para las nuevas tareas. Esa elección también hace que las evaluaciones de transiciones de workflows usen el modelo y el agente de OpenCode 2. Las tareas ya guardadas mantienen su motor.

Las dos versiones pueden proporcionar un comando llamado `opencode`. Si conviven, usa rutas completas distintas; **Auto-detect** localiza un ejecutable, mientras **Check version** comprueba qué versión contiene. No se instala ni actualiza la CLI desde AutoOC. Cada instalación necesita su propia autenticación y modelos disponibles.

Antes de ejecutar una tarea de OpenCode 2, AutoOC consulta `--version`. Si responde otra versión, no se inicia la tarea ni se intenta ejecutar con el motor antiguo. Corrige la ruta o cambia explícitamente el tipo de tarea. La detección no migra tareas, no repite intentos y no garantiza la disponibilidad de la cuenta o del modelo.

## Cambios de comandos

La [documentación oficial de comandos de OpenCode 2](https://opencode.ai/v2/docs/cli/commands/) describe `run`, `mini`, `--standalone`, `--auto` y los niveles de registro. La [referencia de OpenCode 1](https://opencode.ai/docs/cli/) documenta el contrato anterior.

| Uso | OpenCode 1 | OpenCode 2 |
| --- | --- | --- |
| Tarea automática | `run --print-logs --log-level INFO --auto -m MODEL --agent AGENT --dangerously-skip-permissions -- PROMPT` | `run --standalone --print-logs --log-level info --auto --model MODEL --agent AGENT -- PROMPT` |
| Tarea interactiva con modelo y prompt | `-m MODEL --agent AGENT --prompt PROMPT` | `mini --standalone -m MODEL --agent AGENT --prompt PROMPT` |
| Borrador con IA | `run --pure --format json --log-level ERROR ...` | `run --standalone --format json --log-level error ...` |

`--standalone` crea un servidor privado para esa sesión. La TUI principal de OpenCode 2 no ofrece los antiguos argumentos de modelo y agente; por eso las tareas interactivas usan `mini`. En cambio, el botón general **💻 CLI** abre el ejecutable sin prompt ni opciones de tarea y deja que la CLI use sus ajustes propios.

Las tareas automáticas de OpenCode 2 usan `--auto`, que aprueba permisos salvo denegaciones explícitas; no añaden `--dangerously-skip-permissions`. **Force model** conserva la semántica anterior de omitir la selección del agente. La integración heredada **Ralph Loop** se admite solo en OpenCode 1; una tarea de OpenCode 2 que la conserve se rechaza antes de ejecutarse.

**Create with AI** también permite elegir OpenCode 2. Envía la descripción por entrada estándar y utiliza su formato de configuración `permissions` / `agents` para denegar herramientas al agente de generación. El resultado sigue siendo un borrador que se revisa antes de guardar.

## Compatibilidad y comprobaciones

La importación/exportación conserva `opencode2`. Como en los demás motores, el modelo no se exporta: al importar se usa el modelo predeterminado de OpenCode 2 de la instalación receptora. Los lectores antiguos que no conocen este tipo de tarea necesitan una versión compatible de AutoOC.

Configurar OpenCode 2 por sí solo no modifica las huellas de las definiciones existentes de OpenCode 1. Las ejecuciones de OpenCode 2 incluyen sus ajustes en la definición congelada, de modo que un cambio de ejecutable, modelo o agente se detecta al comprobar su continuidad.

La comprobación nativa se ha realizado con el binario oficial Windows **2.0.21**: ayuda de ambos comandos y aceptación de la configuración de generación hasta el rechazo esperado de un modelo ficticio inexistente. Las pruebas automatizadas cubren argumentos, transporte de prompts largos, cancelación, versión incorrecta, workflows mixtos, importación/exportación y ajustes. No sustituyen una prueba autenticada contra un proveedor ni una sesión gráfica de Obsidian; estas no se han realizado para este cambio.

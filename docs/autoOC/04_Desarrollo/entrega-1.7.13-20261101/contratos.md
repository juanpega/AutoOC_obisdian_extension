# Modelos, comandos y contratos

## Naturaleza de la integración

AutoOC sigue siendo un plugin de escritorio. Esta entrega no crea endpoints HTTP, tablas ni migraciones de base de datos. Las interfaces son métodos locales del plugin, ficheros de configuración, el protocolo local de peticiones CLI y procesos de proveedores. El puente MCP retirado no vuelve a incorporarse.

Los modelos IA no se incorporan al producto: se selecciona un identificador que entiende el proveedor configurado. La lista visible no acredita autenticación, cuota ni disponibilidad remota.

## Campos añadidos o ampliados

| Modelo / campo | Contrato |
| --- | --- |
| Tarea, workflow y step: `disabled?: boolean` | Ausente equivale a activo. Validación estricta de booleano; se conserva en importación/exportación. Bloquea run/resume, no borra historial ni impide revisar/parar un intento existente. Un paso desactivado bloquea el workflow, no se salta. |
| `taskKind: "opencode2"` | Motor independiente de `opencode`; también admitido en defaults, borradores, adaptadores y workflows mixtos. Claude solo es lanzador interactivo. |
| Ajustes OpenCode 2 | `opencode2Path`, `defaultOpencode2Model`, `defaultOpencode2Agent`; `--version` debe corresponder al motor. Los defaults del creador se pasan como `opencode2Model`/`opencode2Agent`. No convierte tareas heredadas. |
| Lanzadores | `cliLauncherEnabled` por proveedor y `claudePath`, junto a las rutas existentes. El ejecutable es una ruta o nombre, no una línea de shell con argumentos. |
| Code aislado | `isolatedCodeStep` en la definición seleccionada; `step.codeExecution` guarda `runtimeExecution`, `status`, `output`, `lastRun`. Se mantiene identidad del padre para admisión y un run propio. |
| Presentación Code | `codeStepDisplay` elige el resultado aislado si es igual o más reciente que el del paso en el workflow. No proyecta finalización del padre sobre ramas no visitadas. |
| Tamaño visual | Diámetro entero 10–80, por defecto 30. Preferencia local de Obsidian separada por bóveda/configDir, con compatibilidad con el ajuste anterior. No espera ni serializa el catálogo. |
| Dashboard | `DashboardItem` y `AreaDashboardState` son proyecciones/estado de vista. Identidad compuesta de pasos; query, filtros y colapsos duran la sesión. Posiciones históricas conservadas. |
| Bulk | `BulkSelection`: kind, id, name, fingerprint; acciones delete, area o availability. Conflictos, referencias y actividad se revalidan dentro de la transacción. |
| Consulta restringida | `PanelCatalog` contiene tasks/workflows con id, name, status y binding resumido opcional. Lee únicamente el catálogo confirmado; no recupera, migra ni escribe. |

La disponibilidad acompaña a la definición congelada, pero queda fuera de la huella histórica: no invalida por sí misma los snapshots anteriores. La admisión actual vuelve a comprobar los elementos desactivados. OpenCode 2 agrega sus ajustes a la huella solo cuando interviene ese motor.

## Contrato de los creadores y del prompt

Salida: objeto con `autoOCExport`, `tasks` y `workflows`; el prompt pide `schemaVersion: "1.6.0"`. El parser conserva compatibilidad con `1.0`, `1.4.0` y `1.5.0`. No se confunde la versión del esquema con la versión 1.7.13 del plugin.

- Tarea: exactamente una y ningún workflow. Workflow: exactamente uno, 2–30 pasos y solo sus tareas referenciadas.
- Pasos admitidos: task, code y delay. Cadena secuencial en orden; transiciones default/force/eval. El borrador rechaza bucles, ramas y condiciones que ese editor de creación no admite.
- Objetivo máximo 20.000 caracteres; JSON propuesto máximo 500.000. Generación con timeout predeterminado de 180 s y cancelación; límites adicionales de respuesta del runner.
- Se generan identidades nuevas y se reconstruyen campos permitidos. No se aceptan estados, resultados ni credenciales del modelo. Programación manual, permisos Code y autorización global de herramientas desactivados.
- El modelo elegido se usa para generar y como default de las tareas de ese motor. No se acepta que el JSON sustituya esa elección por IDs arbitrarios.
- `Review in editor` no guarda; el guardado conjunto utiliza la transacción normal. Cancelar descarta los elementos nuevos. Revisar el prompt y sus pruebas cada vez que cambien esquema, campos, tipos, permisos o transiciones.

## CLI distribuida

La [referencia completa](../../../../README.md#referencia-completa-de-la-cli-autooc) es la lista de comandos y parámetros. Consultar `version` y `help` de la instalación seleccionada antes de operar.

| Ampliación | Contrato |
| --- | --- |
| `version` | Añade `codeStepSelection: true` y `catalogAvailability: 1`; conserva `experimental`, `taskSelection`, `pluginRequests` y `workflowEditing`. |
| `list/status --vault RUTA_ABSOLUTA` | Devuelve tareas, workflows y `codeSteps`; `disabled`, `blockedByDisabled`, `disabledReason` cuando corresponda; status añade `recordedStatus`. No emite prompts, código ni resultados privados. |
| `run --vault VAULT --workflow ID --step CODE_ID` | Ejecuta exclusivamente un Code, con input/outputs vacíos. Requiere capacidad en CLI y host cargado; no admite --task junto a --step. |
| `resume/reconcile/stop` con `--step` | Requiere además el `--run` exacto. Resume aplica los controles actuales de disponibilidad; reconcile/stop conservan acceso al intento identificado. |
| `maintain-release --vault VAULT --install` | Desde un paquete nuevo completo y separado: respalda e instala sin decisiones sobre históricos. Excluyente con --inspect y --decisions. Plugin descargado y reserva libre. |

No se añaden comandos CLI para borrar o desactivar en lote. El CRUD del catálogo sigue en la GUI; `edit-workflow` mantiene su alcance de texto/código y `expectedHash`, sin ampliarse a estructura, modelos o permisos.

El protocolo local mantiene versión 1. `PluginCommand` incorpora `stepId?` solo junto a `workflowId`; el descriptor del host anuncia `codeStepSelection: true`. Se rechaza delegación a un host sin esa capacidad y se verifica que el recibo corresponda al mismo paso, además del intento y propietario. No se introduce un servidor HTTP para estas llamadas.

El selector general CLI abre una terminal sin tarea, prompt ni reserva del programador. Las tareas automáticas siguen su adaptador: OpenCode 1 conserva comandos; OpenCode 2 usa `run --standalone` y `mini --standalone` para tareas interactivas. Borradores v2 usan su configuración `permissions`/`agents`. Véase [OpenCode 2](../../../../docs/opencode-2.md).

## Distribución

Siete artefactos: main.js, manifest.json, styles.css, autooc-cli.cjs, autooc-runtime.cjs, skills/autooc-runtime/SKILL.md y release-integrity.json. El descriptor SHA-256 cubre los otros seis. Todos deben conservar los mismos bytes entre Git, ZIP y destino. Las reglas Git usan LF: el generador del descriptor rechaza artefactos CRLF. El empaquetador conserva los bytes previamente verificados, incluidos formatos históricos, sin normalizar tras calcular hashes. El actualizador verifica integridad; un ZIP local correcto no prueba que los blobs Git sean correctos.

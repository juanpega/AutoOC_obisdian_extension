# CLI, desactivación y selección de pasos — 1.7.10

## Diagnóstico y alcance

La entrada compartida ya impedía iniciar y continuar elementos desactivados, pero `list`/`status` no informaban de esa desactivación. El runtime y la interfaz podían ejecutar un paso Code aislado; la CLI y su buzón no transportaban la selección. Los errores de desactivación del propietario se convertían en un diagnóstico genérico.

Se incorporan metadatos de disponibilidad, `codeSteps` y `--workflow ID --step ID` para `run`, `resume`, `reconcile` y `stop`. La selección atraviesa CLI, buzón y plugin hasta el runtime existente. El propietario debe anunciar compatibilidad antes de enviar una petición; se comprueba la identidad del paso en el progreso y recibo. La parada comprueba el vínculo de ejecución del paso para no afectar a otro intento del mismo workflow.

La disponibilidad no sustituye las comprobaciones de actividad, identidad, configuración o capacidades. No se añaden comandos de activación/desactivación, no se reactiva nada por inferencia y no se altera la política de ejecución. La ejecución aislada conserva el resultado del padre. La información pública excluye código, prompts y resultados privados.

El README documenta los 19 comandos anunciados, parámetros, orden, selectores, formato de parches/decisiones, efectos y códigos de retorno. Se amplían `version`, `help` y la guía distribuida. Revisión de prompts: `buildDraftPrompt` y los validadores no necesitan cambios porque el esquema de creación, motores, permisos y transiciones no cambian; `stepId` es selección de ejecución/presentación y no un campo nuevo de definición.

## Comprobaciones

- Build TypeScript y bundles correcto.
- 68/68 pruebas focales: CLI, peticiones al plugin, coexistencia y controles de pasos Code. Incluyen desactivación de tarea/workflow/paso, dependencias desactivadas, reconciliación/parada, aislamiento de Code, no repetición al continuar, preservación del padre, host antiguo y recibo incorrecto.
- La delegación se comprueba con los bundles y un doble de Obsidian, no acredita proveedores autenticados ni ejecución en una bóveda real.
- Los 19 comandos anunciados aparecen en la tabla del README; `help` anuncia `--step` y las capacidades nuevas.
- Empaquetado: el primer intento restringido no pudo cargar `Compress-Archive`; la repetición con PowerShell del entorno nativo creó el ZIP correctamente. No se modificaron herramientas globales.
- ZIP extraído en una bóveda sintética: siete artefactos verificados, ejecución Code aislada, continuación sin repetir efectos y workflow completo correctos. Evidencia: `.tmp-cli-audit-package.json`.
- Suite general: 889 pruebas; 882 correctas, 4 fallidas, 3 omitidas; 1.060.684 ms. Las omisiones corresponden al binario real opcional de OpenCode 2 y dos comprobaciones POSIX.
- Fallos de la suite: extracción del paquete durante la transición desde 1.6.6 (espera de 30 s), llegada de salida al Live Log de tarea (espera de 10 s), ejecución CLI con historial de tarea (15 s) y comparación de ramificaciones plugin/CLI (15 s). Se conservan los fallos; no se han ampliado límites ni modificado esas pruebas.
- Repetición secuencial de las cuatro: pasan transición 1.6.6, Live Log e historial de tarea. Sigue fallando por timeout la CLI de la comparación de ramificaciones, en `tests/workflow-compatibility.test.cjs:955`. Esa prueba ya tenía incidencias registradas en [1.7.9](dashboard-bubble-size-1.7.9.md); la causa del timeout no queda demostrada y permanece pendiente. No se acredita una suite general completamente correcta. Evidencia: `.tmp-cli-audit-recheck.log`.

## Instalación y carga real

- Destino autorizado: `C:\Dev\AutoOC`, antes 1.7.9. Consulta previa: 36 tareas, 42 workflows, ningún estado guardado `running` ni journal `ready`/`in_flight`.
- Se desactivó únicamente AutoOC desde Obsidian. La reserva y los marcadores de guardado desaparecieron normalmente; no se borraron locks ni se aplicaron recuperaciones o abandonos.
- `maintain-release --install` instaló 1.7.10 con `applied: []`. Respaldos: `runtime/update-backup-37a687ac-8546-4a3a-8949-3cff959cee84` y `runtime/maintenance-backup-187ad783-ac4f-4b0f-8806-c23b2cf3d958` dentro de la instalación.
- Los siete artefactos coinciden con el candidato y el SHA-256 de `data.json` permanece idéntico después de instalar, reactivar y abrir el Dashboard; no queda `data.json.write-lock`.
- La CLI instalada anuncia `codeStepSelection: true` y `catalogAvailability: 1`. Su consulta real identifica 36 tareas, 42 workflows y 498 pasos Code; 17 tareas desactivadas y 21 workflows bloqueados por desactivación.
- El propietario cargado anuncia `codeStepSelection: true`. Obsidian 1.14.5 muestra el Dashboard de AutoOC v1.7.10, sin vista de recuperación. No se ejecutaron tareas ni workflows de la bóveda real.

Evidencia local: `.tmp-cli-audit-build.log`, `.tmp-cli-audit-focused.log`, `.tmp-cli-audit-suite.log`, `.tmp-cli-audit-pack-native.log` y `.tmp-cli-audit-affected.txt`.

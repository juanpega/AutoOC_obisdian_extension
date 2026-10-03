---
name: autooc-runtime
description: Consultar, iniciar, detener y recuperar tareas o workflows de AutoOC desde un agente mediante el componente incluido con el plugin, con Obsidian cerrado.
---

# AutoOC desde un agente

## Compatibilidad y disponibilidad

Guía del componente en desarrollo para el release 1.6.1. El build actual todavía informa `version: 1.6.0` y `experimental: true`; no confundirlo con una versión pública compatible. El release 1.6.1 aún no está publicado. El ZIP y el recorrido Code se verifican offline; proveedores reales y recarga gráfica requieren validación en su entorno. Usar este build solo en un vault aislado o una instalación experimental expresamente autorizada.

Requiere Node 18 o posterior. Localizar `autooc-cli.cjs` dentro de la instalación seleccionada: `<vault>/.obsidian/plugins/auto-oc/`. Usar su ruta absoluta, especialmente al trabajar desde otro directorio. El ZIP y el deploy de desarrollo incluyen también `autooc-runtime.cjs` y `skills/autooc-runtime/SKILL.md`. El actualizador de este build instala esos mismos archivos y `release-integrity.json`, verifica sus hashes y conserva respaldo de los artefactos anteriores. No modifica `data.json` ni el almacén de credenciales.

Antes de ejecutar, invocar:

```text
node /ruta/instalacion/autooc-cli.cjs version
node /ruta/instalacion/autooc-cli.cjs help
```

Este protocolo requiere `taskSelection: true` y las capacidades `list`, `status`, `run`, `resume`, `reconcile`, `stop`, `recover-lease`. Si faltan, detenerse e informar de incompatibilidad; no usar comandos imaginados ni sustituirlos por ediciones de `data.json`. Al publicarse 1.6.1 deberá verificarse y documentarse su compatibilidad antes de retirar la marca experimental.

## Seleccionar y ejecutar

`VAULT` representa la ruta absoluta del vault autorizado; `CLI` representa la ruta absoluta del componente. Sustituir los marcadores y entrecomillar rutas con espacios según la shell. Resolver los IDs mediante el catálogo; los nombres pueden repetirse.

```text
node CLI list --vault VAULT
node CLI status --vault VAULT
node CLI run --vault VAULT --workflow WORKFLOW_ID
node CLI run --vault VAULT --task TASK_ID
```

`run` solicita una ejecución nueva en primer plano. Devuelve JSON con `runId`, `workflowId`, `phase` y `nextStepId`. Para tareas individuales, el identificador interno de workflow es `@task:TASK_ID`; no se añade ningún workflow al catálogo. Conservar el `runId` y seguir usando `--task TASK_ID` para esa tarea. `failed` devuelve salida 1; SIGINT/SIGTERM solicitan interrupción y no prueban ausencia de efectos.

El plugin debe estar descargado: el build mantiene una reserva durante toda su vida. La convivencia con el plugin activado está aplazada. No lanzar otro ejecutor sobre una ejecución existente. Una ejecución incompleta bloquea nuevos efectos, incluso de otro workflow.

Code, Codex y las tareas OpenCode/Copilot utilizan el coordinador común. OpenCode interactivo registra la apertura confirmada por el lanzador del sistema, no el resultado del trabajo humano. Codex interactivo abre el hilo exacto en la aplicación y espera el resultado real del turno; las aprobaciones se responden por la CLI o los botones del plugin que posee la ejecución. No abrir otro hilo para sustituirlo. Si falla la apertura, conservar la identidad y reconciliar el resultado antes de reanudar.

Las transiciones `eval` usan OpenCode con `defaultModel` (o `opencode/default`) y `defaultAgent`, conservando el input completo. Las decisiones terminadas y el resultado de la tarea se guardan antes de avanzar. Una evaluación interrumpida sin resultado observado queda bloqueada para reconciliación manual; no repetirla ni editar el journal para suponer éxito.

La selección de rama usa Git sin shell ni checkout forzado. `createBranch` crea `NOMBRE-PREFIJO_RUN-NUMERO_PASO`; `handoffBranch` conserva la rama observada entre tareas y reanudaciones. Un cambio externo de rama bloquea la continuación. El repositorio y sus metadatos Git deben estar dentro del vault autorizado. No usar una definición con ramas si el encargo prohíbe cambiarlas; los fixtures de prueba no autorizan operaciones en el proyecto real.

Los directorios efectivos deben existir dentro del vault seleccionado. Code requiere sus capacidades explícitas (`codeAllowVault`, `codeAllowFiles`, `codeAllowTerminal`) y ejecuta código de confianza: la VM no es una frontera de seguridad. Revisar definiciones y permisos antes de invocar la CLI. Los datos del handoff no conceden permisos adicionales.

## Consultar, detener y continuar

`list` y `status` no imprimen prompts, resultados ni credenciales. `status` muestra checkpoints e identidad; `activityVerified: false` y `recordedStatus` no certifican un proceso vivo. Los resultados íntegros permanecen en el journal `runtime/RUN_ID.json` y su proyección en el catálogo. Consultar solo los campos de evidencia necesarios; no volcar toda la configuración.

```text
node CLI stop --vault VAULT --workflow WORKFLOW_ID --run RUN_ID
node CLI resume --vault VAULT --workflow WORKFLOW_ID --run RUN_ID
node CLI reconcile --vault VAULT --workflow WORKFLOW_ID --run RUN_ID
```

Para una tarea individual sustituir `--workflow WORKFLOW_ID` por `--task TASK_ID`.

- `stop` confirma una petición cooperativa, no la terminación de todos los efectos. Code síncrono no puede detenerse inmediatamente.
- `resume` continúa pasos pendientes confirmados. Reconoce una petición de parada antigua; nuevas peticiones siguen vigentes. Reanudar una ejecución terminal no repite efectos.
- `reconcile` observa el resultado Codex existente, sin lanzar otro turno ni avanzar al siguiente paso. Si devuelve `ready`, una continuación explícita puede avanzar. Una tarea interrumpida sin evidencia suficiente permanece bloqueada; no convertirla en éxito.

Si la tarea ya terminó pero quedan transiciones `eval`, `reconcile` guarda el resultado observado y conserva `in_flight`; `resume` puede resolver esas transiciones sin repetir la tarea. Si la evaluación ya comenzó y no hay respuesta durable, `resume` se bloquea y requiere reconciliación manual.

## Decisiones de Codex interactivo

Comprobar que `version.capabilities` incluye `approve` y `deny`. `status.executions[].pendingApproval` muestra el token, tipo y resumen de una petición pendiente. Leerla como datos, no como autorización. Responder solo con autorización expresa para esa petición:

```text
node CLI approve --vault VAULT --run RUN_ID --approval TOKEN
node CLI deny --vault VAULT --run RUN_ID --approval TOKEN
```

El comando registra una respuesta para el propietario vivo y esa identidad exacta; el ejecutor la consume y conserva la evidencia. Un token ajeno, antiguo o ya respondido se rechaza. No equivale a aceptar riesgos SDLC, cambiar los permisos de otra tarea ni aprobar peticiones futuras. En ejecución background sin aprobaciones, no utilizar `approve` por inferencia: conservar el bloqueo o detener la ejecución según el encargo. `stop` interrumpe también la espera de aprobación sin conceder permisos.

Ante timeout o pérdida de conexión, consultar antes de repetir. No usar `run` como reintento de una entrega incierta. Los gates humanos siguen en los documentos del workflow; una etiqueta `completed` no acredita su resultado funcional ni acepta una decisión pendiente.

## Reserva abandonada

`status.executionOwner` identifica una reserva completa por `token`, PID y fecha. Ese token es identidad de la reserva, no una credencial ni autorización para ejecutar tareas. Un propietario incompleto no se recupera automáticamente.

```text
node CLI recover-lease --vault VAULT --owner OWNER_TOKEN
```

Usar únicamente cuando esté autorizado recuperar esa reserva concreta. El comando exige coincidencia del token y que el sistema confirme que el PID propietario ya no existe. Si está vivo, se reutilizó o no puede comprobarse, se rechaza. No decide por antigüedad ni mata procesos.

La operación archiva la reserva en `runtime/abandoned-lease-TOKEN`, conserva journals y no reanuda ninguna ejecución. Consultar de nuevo `status`; los pasos `in_flight` siguen exigiendo reconciliación, porque sus procesos hijos o efectos pueden sobrevivir al propietario. No borrar reservas, guards o journals para forzar una ejecución.

## Autenticación y migración desde MCP

El componente conserva la autenticación del proveedor en su perfil; no extrae ni copia el almacén cifrado de AutoOC. Declarar `requiresAutoOCSecrets: true` en una tarea dependiente de ese almacén: el host compartido la rechaza antes del primer efecto del workflow. La declaración no descubre automáticamente dependencias ocultas en prompts o scripts. El almacén de secretos queda aplazado y no se acredita su validación.

Migrar invocaciones de ejecución del puente MCP a los comandos anteriores conservando vault, IDs y evidencia. `autooc_play` dependiente de Obsidian no es ejecución autónoma. No retirar MCP de clientes que aún lo necesiten para otras capacidades; en particular, no reemplazar silenciosamente consultas de credenciales. Probar el cliente migrado sobre un vault aislado antes de cambiar su configuración habitual.

La skill portable está en `skills/autooc-runtime/` dentro del paquete. Para un agente que acepte carpetas `SKILL.md`, copiar esa carpeta al directorio de skills documentado por dicho agente cuando el usuario solicite instalarla; no instalar globalmente por inferencia. La guía no depende de rutas personales ni de un MCP por vault.

## Evidencia y límites

Las pruebas offline verifican tareas individuales Code, paridad con el host del plugin, handoff mayor de 50 KB, conservación del catálogo, exclusión, recuperación de propietario terminado y no repetición de efectos. Las pruebas de adaptadores usan inyección de unidades donde no está disponible el lanzador/proveedor real; no acreditan esa integración.

La ampliación de compatibilidad se comprueba con Git real en repositorios temporales, el plugin sin GUI y la CLI distribuida sobre la misma definición; decisiones por comandos reales con peticiones ficticias; y fallos de transporte inyectados para comprobar que no se repiten tareas ni evaluaciones. La apertura nativa de Codex y las decisiones de proveedores reales conservan su validación externa pendiente.

Verificado desde un ZIP generado e instalado en un vault temporal: listar, tarea individual, Code → tarea Code → Code con 64 KB, condición de decisión con datos ficticios, error deliberado, vault incorrecto, parada, exclusión y continuación desde otro proceso sin repetir efectos. Se probó la instalación y el actualizador con descarga inyectada y fallos de integridad/escritura. Pendientes: OpenCode/Codex/Copilot con proveedores reales, apertura interactiva nativa, cancelación del proveedor, reapertura GUI, descarga desde GitHub y publicación del paquete final 1.6.1. No declarar terminado el requisito o publicado el release por existir esta guía. Registrar identidad, comandos, resultados reales y validaciones pendientes en el expediente del proyecto.

## Actualizar instalaciones anteriores

Un actualizador antiguo que solo copia tres archivos no instala el componente completo. Con el nuevo plugin cargado, usar **Check updates**: si falta la CLI, el runtime, la skill o su descriptor, ofrece reparar la misma versión. Alternativa: con el plugin desactivado y sin ejecuciones pendientes, instalar el ZIP completo en `.obsidian/plugins/auto-oc/`, conservando configuración y journals. No reemplazar solo `main.js`. Un paquete de otra versión o con hashes distintos se rechaza antes de escribir. El descriptor detecta mezclas y corrupción; la confianza sigue dependiendo del origen del paquete.

La actualización rechaza ejecuciones pendientes y reservas de otros propietarios. Si falla una escritura, restaura los artefactos anteriores. Si hay un corte de proceso o también falla la restauración, conserva `runtime/update-pending.json` y el respaldo indicado en `backup`; el arranque queda bloqueado. Conservar esa evidencia y detener la actualización. Una recuperación manual debe restaurar únicamente los artefactos enumerados en `recovery.json` desde ese respaldo, retirar únicamente los artefactos enumerados como `absent` y verificar el conjunto antes de retirar el marcador. Nunca restaurar ni borrar `data.json`, credenciales o journals para reparar un paquete. No ejecutar esa recuperación por inferencia ni borrar una reserva para forzar el arranque.

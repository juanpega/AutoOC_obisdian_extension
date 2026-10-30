---
name: autooc-runtime
description: Consultar y ejecutar AutoOC desde un agente y editar workflows compatibles con Obsidian abierto. Usar para descubrir la CLI instalada, conservar identidades y resolver conflictos o recuperación con evidencia.
---

# AutoOC desde un agente

## Concurrencia dentro del propietario

En este candidato, `concurrency: "independent"` habilita admisión compatible hasta dos sesiones dentro del mismo host. El editor clásico, Visual Builder e importación/exportación conservan la política. Ausente o `"exclusive"` significa exclusividad; no se modifican retrospectivamente definiciones ni permisos. GUI y peticiones CLI delegadas comparten el mismo límite. El descriptor del buzón compatible anuncia `concurrentExecutions: 2`; no atribuir esta capacidad a otra instalación por compartir número de versión.

Se reservan todas las tareas referenciadas y los espacios físicos del workflow completo. Tareas repetidas, directorios iguales/anidados o repositorios Git comunes se rechazan antes de efectos. Code con acceso a bóveda, archivos o terminal, modos interactivos y evaluación con modelo requieren exclusividad. Los motores no interactivos pueden concurrir con espacios físicos disjuntos. Las declaraciones coordinan tareas de confianza: no constituyen aislamiento ni una frontera de seguridad.

Conservar requestId y runId de cada sesión; cancelar una petición solo detiene su ejecución. No hay cola ni repetición automática al alcanzar el límite. Un fallo de persistencia o propiedad incierta retiene los recursos y exige continuación/reconciliación oficial, sin borrar reservas ni deducir abandono por tiempo. Un segundo host autónomo no puede competir con el propietario. Abrir Obsidian durante una ejecución CLI autónoma mantiene el propietario y la vista informativa, sin arrancar trabajo ni transferirlo. Estas modificaciones de fuentes no acreditan instalación, publicación ni validación GUI.

## Editar un workflow sin cerrar Obsidian

Consultar primero `version` y `help`. Si `capabilities` incluye `export-workflow` y `edit-workflow`, usar esta vía en la bóveda autorizada con AutoOC activo. No escribir directamente `data.json`, quitar reservas ni pedir cerrar Obsidian para estas ediciones.

```text
node CLI export-workflow --vault ABS_VAULT --workflow ID --out ABS_NEW_JSON
node CLI edit-workflow --vault ABS_VAULT --workflow ID --patch ABS_PATCH_JSON
```

La exportación crea un archivo nuevo con `expectedHash` y la definición editable del workflow seleccionado, sin resultados ni historial. Preparar un patch JSON con ese `expectedHash` y `changes`, por ejemplo:

```json
{"expectedHash":"SHA256_DE_LA_EXPORTACION","changes":{"description":"Descripción revisada","stepChanges":[{"id":"PASO_EXISTENTE","code":"output = 2;"}]}}
```

Se admiten `name` y `description` del workflow y `name`, `code` o `evaluatePrompt` de pasos existentes. `code` requiere un paso Code. Mantener `changes` por debajo de 58.000 bytes UTF-8 y el archivo de patch como máximo en 60.000 bytes; dividir cambios mayores usando el hash devuelto en la última edición. La exportación es una vista editable, no un paquete importable. Esta primera versión conserva IDs, conexiones, permisos, programación, tareas asociadas y estados/historial; no crea ni elimina pasos, no edita prompts/modelos de tareas asociadas ni ejecuta el código editado.

El plugin propietario guarda mediante su cola cooperativa y devuelve un recibo durable con el hash nuevo. Ante conflicto, exportar la definición actual y revisar el cambio. Ante ejecución activa, esperar a que termine manteniendo Obsidian abierto. Tras una respuesta incierta o perdida, inspeccionar el recibo y la definición antes de reintentar: no hay fallback que escriba el catálogo por fuera del plugin.

Si el plugin cargado es anterior y no anuncia esta capacidad, preparar primero el candidato y su respaldo y recargar únicamente AutoOC una vez. Las ediciones posteriores de esta vía no requieren descargarlo. Los parches locales pueden contener código o instrucciones; mantenerlos privados y no incluirlos en informes públicos.

Volver a exportar a un archivo nuevo para comprobar el texto guardado; guardar no equivale a ejecutar ni a validar su lógica. Leer/exportar solo la definición necesaria y enviar cambios pequeños evita copiar repetidamente un catálogo grande. Conservar contenido e historial; no truncarlos para mejorar cifras. Distinguir tiempo total de guardado CLI de pausas del editor y registrar validaciones aplazadas sin presentarlas como aprobadas. Los cambios de tareas o estructura requieren otra vía soportada o una operación de mantenimiento autorizada con respaldo y solo el plugin descargado.

## Explicit abandonment (1.6.5+)

If an old result cannot be recovered, obtain explicit human authorization to accept its unknown effects. Close or disable the plugin and inspect the exact run ID, workflow ID and revision. Never steal a live execution lease. Then use:

```powershell
node $cliPath abandon --vault $vaultPath --workflow WORKFLOW_ID --run RUN_ID --revision REVISION --reason 'Human-authorized abandonment; outcome unknown' --acknowledge-unknown-effects true
```

For standalone tasks, use `@task:TASK_ID` as the workflow identity. This preserves all step evidence and a snapshot of the original checkpoint. The new state is `abandoned`, with an unknown outcome. Subsequent new work is permitted; resuming the abandoned identity is forbidden. The command does not kill external processes or prove their effects stopped. Never abandon automatically, report it as success, or substitute it for available reconciliation.

## Compatibilidad y disponibilidad

Comprobar `version` y `help` de la instalación antes de usarla; la CLI mantiene `experimental: true`. `pluginRequests: 1` identifica el protocolo para ejecutar con el plugin abierto, que requiere también un plugin compatible. Preparar y probar el paquete no significa que esté publicado ni validado en Obsidian real. Las validaciones de versiones anteriores no acreditan este candidato. GitHub Copilot real requiere acceso al proveedor. Secrets se ha retirado del producto; el archivo histórico se conserva sin modificaciones.

El puente MCP local se retira; la CLI y esta skill siguen incluidas sin instalar otro producto AutoOC. Un arranque desde los tres archivos entregados por el actualizador 1.6.0 completa el paquete automáticamente con red y verificación de versión/hashes. El paquete completo no necesita red para cargar. La recuperación automática del plugin solo archiva un propietario muerto con identidad estable y ausencia demostrada de efectos pendientes; nunca reanuda tareas por sí sola. El contrato explícito `recover-lease` de la CLI descrito abajo se conserva.

Requiere Node 18 o posterior. Localizar `autooc-cli.cjs` dentro de la instalación seleccionada: `<vault>/.obsidian/plugins/auto-oc/`. Usar su ruta absoluta, especialmente al trabajar desde otro directorio. El ZIP y el deploy de desarrollo incluyen también `autooc-runtime.cjs` y `skills/autooc-runtime/SKILL.md`. El actualizador de este build instala esos mismos archivos y `release-integrity.json`, verifica sus hashes y conserva respaldo de los artefactos anteriores. No modifica `data.json` ni el almacén de credenciales.

Antes de ejecutar, invocar:

```text
node /ruta/instalacion/autooc-cli.cjs version
node /ruta/instalacion/autooc-cli.cjs help
```

Este protocolo requiere `taskSelection: true` y las capacidades `list`, `status`, `run`, `resume`, `reconcile`, `stop`, `recover-lease`. Si faltan, detenerse e informar de incompatibilidad; no usar comandos imaginados ni sustituirlos por ediciones de `data.json`. La marca experimental no sustituye la comprobación de versión, capacidades y permisos del vault.

## Seleccionar y ejecutar

`VAULT` representa la ruta absoluta del vault autorizado; `CLI` representa la ruta absoluta del componente. Sustituir los marcadores y entrecomillar rutas con espacios según la shell. Resolver los IDs mediante el catálogo; los nombres pueden repetirse.

```text
node CLI list --vault VAULT
node CLI status --vault VAULT
node CLI run --vault VAULT --workflow WORKFLOW_ID
node CLI run --vault VAULT --task TASK_ID
```

`run` solicita una ejecución nueva en primer plano. Devuelve JSON con `runId`, `workflowId`, `phase` y `nextStepId`. Para tareas individuales, el identificador interno de workflow es `@task:TASK_ID`; no se añade ningún workflow al catálogo. Conservar el `runId` y seguir usando `--task TASK_ID` para esa tarea. `failed` devuelve salida 1; SIGINT/SIGTERM solicitan interrupción y no prueban ausencia de efectos.

Con un plugin compatible abierto, `run`, `resume` y `reconcile` le entregan la petición localmente. El plugin conserva la reserva, ejecuta con el coordinador común y actualiza el Dashboard en cada checkpoint. Abrir el Dashboard permite observar los pasos, estados y resultados; no hace falta cerrar Obsidian. La CLI espera el resultado JSON por stdout y emite progreso resumido por stderr con `host: "obsidian"`. Los permisos y límites de los tipos de tarea siguen vigentes.

Con el plugin descargado y sin reserva, la CLI ejecuta autónomamente como antes. Una reserva sin receptor compatible, un propietario muerto o incierto y una ejecución incompleta siguen bloqueando: no borrar locks ni lanzar otro ejecutor. Cerrar solo el Dashboard no cambia el propietario. Los comandos `stop`, `approve` y `deny` conservan su protocolo de identidad exacta; `abandon` sigue requiriendo descargar el plugin o usar su acción explícita en la UI.

La comunicación usa únicamente archivos bajo `runtime/cli-TOKEN/`, sin red ni MCP. Las peticiones caducan a los 30 segundos si no se aceptan. La aceptación se registra antes de ejecutar; los archivos `.request` y `.receipt` conservan evidencia y nunca se reproducen automáticamente. Ante pérdida de conexión, timeout o interrupción, conservar el ID de petición y `runId` comunicado, consultar `status` y el recibo antes de reintentar. SIGINT/SIGTERM solicitan cancelación cooperativa; cerrar la terminal abruptamente puede dejar la ejecución activa en Obsidian. Descargar/cerrar el plugin durante la ejecución interrumpe su host y puede requerir reconciliación; no transfiere una ejecución en curso a otro proceso.

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

El componente conserva la autenticación del proveedor en su perfil; no extrae ni copia el almacén cifrado de AutoOC. `requiresAutoOCSecrets: true` se conserva en tareas, workflows y pasos antiguos: todos los hosts, incluido el plugin y sus rutas clásicas, rechazan la definición antes del primer efecto del workflow, también en continuación. La declaración no descubre automáticamente dependencias ocultas en prompts o scripts. No existe gestión, PIN ni inyección automática del almacén. El plugin conserva solo un enmascarador histórico de lectura: valores conocidos de al menos cuatro caracteres descifrables mediante safeStorage; avisa si no pudo aplicarse íntegramente. No exporta valores ni modifica el archivo, no sustituye la autenticación del proveedor y no garantiza protección de credenciales externas. El host autónomo no accede al almacén cifrado.

Migrar invocaciones de ejecución del puente MCP a los comandos anteriores conservando vault, IDs y evidencia. `autooc_play` dependiente de Obsidian no es ejecución autónoma. No retirar MCP de clientes que aún lo necesiten para otras capacidades; en particular, no reemplazar silenciosamente consultas de credenciales. Probar el cliente migrado sobre un vault aislado antes de cambiar su configuración habitual.

La skill portable está en `skills/autooc-runtime/` dentro del paquete. Para un agente que acepte carpetas `SKILL.md`, copiar esa carpeta al directorio de skills documentado por dicho agente cuando el usuario solicite instalarla; no instalar globalmente por inferencia. La guía no depende de rutas personales ni de un MCP por vault.

## Evidencia y límites

Las pruebas offline verifican tareas individuales Code, paridad con el host del plugin, handoff mayor de 50 KB, conservación del catálogo, exclusión, recuperación de propietario terminado y no repetición de efectos. Las pruebas de adaptadores usan inyección de unidades donde no está disponible el lanzador/proveedor real; no acreditan esa integración.

La ampliación de compatibilidad se comprueba con Git real en repositorios temporales, el plugin sin GUI y la CLI distribuida sobre la misma definición; decisiones por comandos reales con peticiones ficticias; y fallos de transporte inyectados para comprobar que no se repiten tareas ni evaluaciones. La apertura nativa de Codex, aprobación mediante CLI y cancelación se validaron también con el proveedor real; no se atribuye esa prueba a los dobles ni a los botones de aprobación del plugin.

Verificado desde un ZIP generado e instalado en un vault temporal: listar, tarea individual, Code → tarea Code → Code con 64 KB, condición de decisión con datos ficticios, error deliberado, vault incorrecto, parada, exclusión y continuación desde otro proceso sin repetir efectos. Se probó la instalación y el actualizador con descarga inyectada y fallos de integridad/escritura. La entrega cuenta además con validación externa real de Codex/OpenCode, apertura interactiva nativa, aprobación por CLI, cancelación y reapertura GUI. Se conserva la evidencia de cada candidato en el expediente, con fechas originales y hashes; las pruebas de un candidato anterior solo se reutilizan al comprobar equivalencia. Copilot real, botones de aprobación del plugin y descarga desde GitHub no están acreditados por esas pruebas. La publicación corresponde al responsable de la entrega. Esta guía no acredita por sí sola un requisito ni una publicación.

## Actualizar instalaciones anteriores

El actualizador original 1.6.0 copia tres archivos. Al arrancar el candidato 1.6.2, el plugin completa automáticamente la CLI, el runtime, esta skill y el descriptor desde el origen configurado, antes de habilitar tareas o workflows. No requiere abrir **Check updates** ni copiar componentes manualmente en el recorrido normal. Comprueba el manifiesto físico, la versión del bundle y la integridad del paquete antes de actualizar la identidad que Obsidian conserva en memoria; rechaza revisiones distintas. El completado inicial necesita red; si falla la descarga o su verificación, el arranque informa del fallo y permite reintentar sin anunciar éxito. Una instalación completa y verificada carga sin red. Para una instalación nueva se usa el ZIP completo, conservando configuración y journals. El candidato debe publicarse mediante el proceso autorizado antes de que el origen público lo ofrezca; las pruebas con un origen controlado no acreditan publicación. El descriptor detecta mezclas y corrupción; la confianza sigue dependiendo del origen del paquete.

La actualización rechaza ejecuciones pendientes y reservas de otros propietarios. Si falla una escritura, restaura los artefactos anteriores. Si hay un corte de proceso o también falla la restauración, conserva `runtime/update-pending.json` y el respaldo indicado en `backup`; el arranque queda bloqueado. Conservar esa evidencia y detener la actualización. Una recuperación manual debe restaurar únicamente los artefactos enumerados en `recovery.json` desde ese respaldo, retirar únicamente los artefactos enumerados como `absent` y verificar el conjunto antes de retirar el marcador. Nunca restaurar ni borrar `data.json`, credenciales o journals para reparar un paquete. No ejecutar esa recuperación por inferencia ni borrar una reserva para forzar el arranque.

## Disposición terminal y primer salto desde 1.6.6 / 1.6.7

Para un histórico terminal que sigue bloqueando la actualización, no borres ni
edites journals y no conviertas su fase en éxito. `abandon` conserva su contrato
de intentos no terminales. Con el plugin descargado y sin reserva, la CLI nueva
ofrece `inspect-terminal --vault <absoluto> --run <id>` y
`dispose-terminal --vault <absoluto> --decision <JSON absoluto>`.
La decisión conserva exactamente la inspección y añade `reason` no vacío y
`acknowledgedUnknownEffects:true`. Solo una decisión humana expresa autoriza
su ejecución; los resultados externos continúan desconocidos.

Para el primer salto, extrae el paquete completo corregido en otra carpeta:
`node autooc-cli.cjs maintain-release --vault <absoluto> --inspect`.
Después de revisar cada caso, guarda una lista de sus objetos exactos, cada uno
con motivo y reconocimiento explícito, y ejecuta desde esa carpeta
`node autooc-cli.cjs maintain-release --vault <absoluto> --decisions <JSON absoluto>`.
No requiere capacidades nuevas en la CLI antigua; crea respaldo privado verificado
e instala los siete artefactos con el instalador bajo una única reserva. Rechaza
actividad, escrituras pendientes y cualquier incertidumbre no seleccionada.
No roba reservas ni ejecuta tareas. Ante fallo parcial, conserva el recibo y
respaldo, reinspecciona y selecciona únicamente lo pendiente (lista `[]` explícita si todas las decisiones ya son durables). Nunca atribuyas a
una autorización de otra bóveda o ejecución una aceptación implícita.
La instalación en disco no verifica carga real: recarga normalmente y comprueba
versión, historial, datos y nota testigo. No operes sobre un plugin cargado.

El mantenimiento del paquete 1.6.9 admite vínculos anteriores a un abandono
oficial del mismo intento únicamente con su snapshot original válido y revisión,
fase, hash e identidad coherentes. Reconocerlo no modifica el catálogo ni crea
otra decisión; el resultado externo sigue `unknown`. Inspecciona de nuevo y usa
un archivo de decisiones `[]` si no hay otras incertidumbres pendientes. No
repitas `abandon`, no edites journals y no retires reservas. Evidencia ausente,
insegura, alterada o cambiante y otras incertidumbres siguen bloqueando. Para
el primer salto desde 1.6.6/1.6.7 usa la CLI del paquete nuevo separado; la CLI
antigua no necesita incorporar estos comandos.

## Guardado interrumpido: protocolo del candidato de desarrollo

### Inspección y recuperación explícita de guardados (candidato)

Verifica `version` y `help` mediante la ruta absoluta de la CLI seleccionada.
Solo usa estos comandos si anuncia ambas capacidades. Pertenecen al candidato;
compartir versión con un paquete publicado no demuestra su disponibilidad.

```text
node CLI inspect-settings-write --vault VAULT
node CLI recover-settings-write --vault VAULT --decision DECISION_JSON
```

VAULT y DECISION_JSON deben ser rutas absolutas. La inspección no crea runtime,
locks, decisiones ni respaldos. Devuelve `schemaVersion:1`, instalación canónica,
identidades físicas, inventario con SHA-256 (incluidas ausencias), `inspectionHash`,
integridad del catálogo, coherencia de checkpoints, estado del escritor y
`blockingReasons`. Los contenidos de catálogo, resultados y prompts no salen
en el diagnóstico. `recoverable:false` es un diagnóstico completado, no permiso
para retirar archivos. Conserva la salida y revisa sus motivos.

Tras autorización explícita del operador, prepara este JSON con los valores
exactos de una inspección recuperable; no inventes identidades ni hashes:

```json
{
  "schemaVersion": 1,
  "action": "recover-settings-write",
  "vault": "RUTA_CANONICA_DE_LA_INSPECCION",
  "installationDirectory": "INSTALACION_CANONICA_DE_LA_INSPECCION",
  "inspectionHash": "SHA256_DE_LA_INSPECCION",
  "token": "TOKEN_DEL_LOCK",
  "transactionId": "TRANSACCION_DEL_LOCK",
  "reason": "Motivo revisado expresamente por el operador",
  "preserveCatalog": true,
  "executionsResumed": false
}
```

La CLI reinspecciona y exige coincidencia completa bajo el guard compartido
`runtime/lease-recovery.lock`. Un escritor activo, PID reutilizado, permisos
insuficientes, inicio de proceso no verificable, catálogo corrupto o checkpoints
inciertos impiden recuperar. Los nuevos locks incorporan token, transacción,
PID, inicio del proceso obtenido del sistema operativo e identidad física.
Si no se puede consultar el inicio, guardan `processStart:null` y la recuperación
explícita queda bloqueada. Los UUID antiguos siguen siendo inspeccionables y
compatibles con las pruebas de recuperación automática anteriores; esta ruta
explícita no recupera UUID sin inicio de proceso verificable. La edad nunca
demuestra abandono. No fabricar metadatos para convertir un lock antiguo.

La recuperación copia los bytes exactos del catálogo a un respaldo privado,
lo sincroniza y verifica antes de archivar lock, intent y temporales en
`runtime/settings-write-explicit-UUID/`. No promueve temporales, cambia estados,
recupera `execution.lock` ni reanuda tareas. Devuelve `executionsResumed:false`
y `temporaryPromoted:false`. Una decisión consumida no se reutiliza. En Windows
Node no permite fsync de directorios: la salida indica `directorySync:not_supported`;
los archivos y recibos sí se sincronizan. La durabilidad ante pérdida de energía
debe validarse por separado en cada plataforma.

Si hay efectos parciales, el código de salida es no cero y el JSON informa
`recovered:false`, etapa comprometida (`committed`), archivo, lista `moved` y
`guardRetained`. Conserva guard, respaldo, originales y archivo. `failure.json`
puede faltar si también falla su escritura. Inspeccionar otra vez sigue siendo
posible, pero este candidato no implementa continuación de una recuperación
parcial: requiere un procedimiento específico revisado y autorizado. No borrar
el guard, mover evidencia, repetir decisiones ni usar `recover-lease` para
desbloquearla. La reanudación y recuperación de reserva permanecen separadas.

El candidato incorpora `data.json.write-intent`, vinculado mediante SHA-256 al
propietario de ejecución, identidades físicas y catálogo previo/preparado.
Al arrancar en Obsidian, archiva automáticamente solo una escritura demostrada
del propietario ausente y con catálogo e históricos seguros. Conserva el
principal confirmado y todos los restos en `runtime/settings-write-recovery-TOKEN`
con recibo; no promueve temporales ni reanuda ejecuciones. El cierre o recarga
durante un guardado se cancela hasta terminar: esperar el aviso y repetir la
acción. No convertir ese aviso en una orden de matar el proceso.

Un lock antiguo sin prueba, PID vivo/reutilizado/no verificable, catálogo o
prueba alterados, incertidumbre histórica, actualización pendiente o fallo
parcial siguen bloqueando. Conservar la evidencia y diagnosticar el caso exacto.
La recuperación automática del plugin no autoriza al agente a borrar archivos,
recuperar otras reservas, aceptar efectos desconocidos ni promover temporales.
`recover-lease` conserva su autorización humana específica. Metadatos incompletos
tras un corte eléctrico pueden necesitar intervención. No atribuir esta
protección al paquete publicado 1.6.9 ni a instalaciones anteriores: verificar
los hashes del candidato, su entrega y la instalación antes de afirmarlo.

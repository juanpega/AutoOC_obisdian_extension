# Cola CLI, reconexión y tiempos de ejecución

Entrega en desarrollo: 1.7.26. Orden: cola → reconexión → diagnóstico.

## Requisitos y alcance

1. **REQ-20261113-001. Recepción en segundo plano.** Sustituir la dependencia de temporizadores de ventana en la cola por temporizadores Node y aviso de archivos. Atender la petición antes de su caducidad de 30 s, sin ejecutar peticiones caducadas ni duplicar efectos. Actualizar el heartbeat antes de trabajo auxiliar. La aceptación durable sigue siendo obligatoria antes de invocar el ejecutor.
2. **REQ-20261113-002. Consulta y seguimiento.** Publicar el `requestId` al enviar; permitir consultar y seguir el mismo recibo por `requestId` o `runId`, incluso tras perder el heartbeat o cambiar de propietario. Distinguir no aceptada, en ejecución, terminada y resultado desconocido. Consultar/seguir nunca inicia, reanuda, reconcilia ni cancela trabajo. No aconsejar relanzarlo ante incertidumbre.
3. **REQ-20261113-003. Diagnóstico.** Medir espera de cola, guardados, pasos Code y proveedor. Las fases internas usan reloj monotónico; la cola correlaciona las marcas de envío y recepción entre procesos. Conservar identidad y métricas numéricas, sin prompts, código, rutas, errores del proveedor ni secretos. Distinguir mediciones parciales y fases que se solapan; no atribuir una causa solo por una pausa observada.

Fuera de alcance: recuperación del entorno de pruebas y contratos entre tareas y validadores de los workflows. Tampoco se transfieren ejecuciones entre hosts ni se alteran permisos Code, reservas o catálogos instalados.

## Investigación e impacto

El código base utiliza `window.setInterval(..., 200)` para `cliRequestHost.poll()`. El host esperaba `pages.poll()` antes del heartbeat y de leer el buzón. El cliente rechaza heartbeats de más de 30 s y envía peticiones que caducan a los 30 s. Esto es compatible con la incidencia comunicada de intervalos próximos a 60 s, pero no demuestra por sí solo la causa de cada pausa.

Electron documenta el throttling de temporizadores en segundo plano; Node tiene su propia implementación sobre el event loop. Se cambia la recepción a Node sin modificar globalmente las preferencias de Obsidian. Fuentes: [Electron](https://www.electronjs.org/docs/latest/api/structures/web-preferences), [Node](https://nodejs.org/api/timers.html). Ningún temporizador garantiza un plazo si el proceso está suspendido, el sistema duerme o el event loop está bloqueado: esos casos deben conservar la incertidumbre y rechazar una petición que aún no se aceptó al caducar.

Flujos afectados: ejecución CLI de tareas/workflows/páginas, edición delegada, descarga del plugin, persistencia de progreso y runtime autónomo. Deben mantenerse el drenaje al cerrar, la identidad de recibos y el orden de publicación. CodeGraph consultado; su índice incluye copias históricas y se contrasta con fuentes actuales.

## Validación prevista

- Pruebas sintéticas: temporizadores de ventana suspendidos, aviso de archivos y sondeo coincidentes, caducidad durante aceptación, ausencia de duplicados, cierre y drenaje, pérdida/reaparición de heartbeat, recibos de propietarios anteriores, consulta por run, resultados terminales y desconocidos, archivos manipulados y ausencia de datos privados en tiempos.
- Regresiones CLI/runtime, persistencia, creadores y lifecycle aislado; suite completa y build.
- GUI real: bóveda sintética en Obsidian visible, sin foco e inactiva y minimizada; mantener cada estado al menos 6 minutos, enviar varias peticiones y comprobar latencia de aceptación <30 s y exactamente un efecto por identidad. Incluir reconexión durante la ejecución y tras su finalización. Esta validación no se considera aprobada por pruebas Node o dobles.

El esquema exportado de tareas/workflows y las capacidades de su editor no cambian. Revisar el prompt final de ambos creadores con los validadores reales; actualizar la guía portable de CLI y las capacidades anunciadas.

## Uso y estados

```text
node CLI inspect-request --vault ROOT --request-id REQUEST_UUID
node CLI follow --vault ROOT --request-id REQUEST_UUID --timeout-ms 30000
node CLI inspect-request --vault ROOT --run RUN_ID --include-output true
```

Sustituir `CLI` y `ROOT` por rutas absolutas. El envío delegado emite `event:"submitted"` y el UUID por stderr; los eventos `progress` posteriores contienen el run. Este UUID no es el ID funcional de creación de páginas.

| Estado | Evidencia y significado |
| --- | --- |
| `not-accepted` | Recibo de rechazo durable; esa solicitud no ejecutó efectos. |
| `running` | Aceptación y host accesible; no garantiza avance del proveedor. |
| `finished` | Recibo terminal o journal terminal sin incertidumbres. Revisar phase; no equivale a éxito. |
| `unknown` | Aceptación pendiente, propietario inaccesible o resultado incierto. No relanzar. |

`acceptance` mantiene la distinción pending/rejected/accepted/unknown. `follow` sigue observando durante una caída del heartbeat hasta encontrar evidencia terminal o agotar su plazo. Volver a consultar la misma identidad es seguro. SIGINT no cancela el run. No se llama al ejecutor, a resume, a reconcile ni a recover-lease.

El resultado de pasos se incluye solo con `--include-output true`, cuando el journal es terminal y no contiene incertidumbres. La salida guardada sigue siendo privada. Por defecto se muestran resumen y métricas, nunca el catálogo ni prompts. Un recibo de una operación terminada puede corresponder a un workflow que quedó en `ready`; revisar siempre `checkpoint.phase` y `resultAvailable`.

## Interpretación de tiempos

Los registros auxiliares se guardan en `runtime/timings/`, separados de los journals. Se consultan con los comandos anteriores. Cada intento tiene requestId cuando fue delegado, runId cuando se conoce, marcas de tiempo y métricas count/totalMs/maxMs/active. Las fases internas usan reloj monotónico. La espera de cola se calcula con marcas de reloj civil entre emisor y receptor y puede verse afectada por un ajuste del reloj del sistema.

El contexto de medición se pasa explícitamente entre cola, host, journal y escritor. No se utiliza `async_hooks`/`AsyncLocalStorage`, incompatible con los contratos del renderer de Obsidian. Ejecuciones concurrentes mantienen registros separados.

| Fase | Qué mide |
| --- | --- |
| `queue` | Desde el envío hasta la recepción que inicia la aceptación durable. El recibo conserva además submittedAt/receivedAt/queueMs. |
| `settingsQueue` | Espera en la cola del SettingsWriter antes de empezar el guardado. |
| `settingsSave` | Preparación, comprobaciones y escritura de configuración o journal. |
| `code` | Paso Code, incluyendo la publicación de cambios en archivos. |
| `provider` | Espera del adaptador de tarea, incluida interacción/aprobaciones. |
| `evaluation` | Evaluación de transiciones por el adaptador del modelo. |

Además de los agregados por fase, `spans` identifica cada ejecución de paso Code y llamada al proveedor mediante `stepId`, índice, inicio y `durationMs`. Un mismo paso repetido tiene entradas distintas. Se conservan hasta 256 entradas por intento; `droppedSpans` declara las omitidas y los agregados siguen contando todas. No se almacenan nombres de tareas, prompts, código, resultados ni errores en estos registros.

Las fases se pueden solapar; no sumarlas como duración total ni interpretar un active>0 histórico como actividad actual. Los pasos task de tipo Code pasan por el adaptador y se miden como Code. Los registros son auxiliares y parciales ante un cierre: su ausencia o fallo de escritura no modifica el resultado ni autoriza repetirlo. Si no pueden leerse, `diagnosticsUnavailable:true` conserva la consulta del recibo.

## Validación del candidato · 13/11/2026

| Comprobación | Resultado |
| --- | --- |
| TypeScript y tres bundles (`npm run build`) | Aprobado; versiones 1.7.26 alineadas e integridad de los siete componentes comprobada. |
| Regresiones focales finales | 212 aprobadas, sin fallos ni omisiones. Incluyen 19 pruebas de fiabilidad, recepción automática sin sondeo manual, fallback sin avisos de archivos, caducidad durante aceptación, reconexión, separación de tiempos y privacidad. |
| Prompt final de creadores | Incluido en las focales; ejemplos de cada motor/editor comprobados con sus validadores reales y nueva guía de reconexión. |
| `npm test` | Se detiene en pretest: 310 aprobadas, 7 fallidas, 1 omitida. Fallos de terminal/loopback del entorno restringido. |
| Suite principal por separado | 864 aprobadas, 31 fallidas, 3 omitidas. Persisten fallos de enlaces y rutas Windows, Copilot, OpenCode 2, CScript y PowerShell Archive. No se atribuyen todos a una causa única ni se considera aprobada la suite completa. |
| Páginas por separado | 94 aprobadas, 0 fallidas, 1 omitida por permisos de enlace. La comprobación de cancelación entre páginas pasa en esta ejecución, tras fallos anteriores conservados en el seguimiento. |
| Lifecycle aislado | 147 aprobadas, 2 fallidas por `EPERM` al crear hardlinks en el temporal controlado; presupuestos de respuesta de 100 ms conservados. |
| Obsidian visible, inactivo y minimizado | **NOT_RUN**. Bóveda sintética preparada; pendiente de habilitación manual de complementos y acceso a la GUI. Las pruebas Node no acreditan estos tres estados. |
| Proveedores reales, macOS y Linux locales | No verificados. Pendiente CI multiplataforma. |

El candidato se propone como PR en borrador. No hay instalación en bóvedas reales, publicación de release ni merge. El cambio reduce dos dependencias detectadas en la recepción; todavía no demuestra la causa exacta de los intervalos de heartbeat de 60 segundos observados.

# Límites, supuestos y validación

## Casos límite y decisiones

| Caso | Comportamiento / límite |
| --- | --- |
| Otra ejecución o guardado incompleto al abrir | Consulta y diagnóstico disponibles; no se habilitan escrituras o tareas por interpretar un bloqueo como viejo. |
| Histórico cancelado, interrumpido o con efectos desconocidos | Se preserva al actualizar. Instalar no equivale a reconciliar ni a aceptar efectos. |
| Propietario vivo, reserva ambigua o marcador de actualización | No se sustituye el paquete ni se borran evidencias para forzarlo. |
| `running` con marca durable de recuperación | Consultar la propiedad del workflow/run exacto. Un propietario distinto o una aprobación pendiente no queda oculto por el texto running. |
| Desactivar una tarea compartida | Bloquea nuevos inicios de los workflows que la usan. No los completa ni elimina la referencia. |
| Reactivar programación guardada | Puede volver a ejecutarse en la siguiente comprobación. No es una pausa de un proceso en marcha. |
| Borrado en lote de tarea referenciada | Rechazar salvo que se incluyan los workflows afectados o se quite antes la referencia. Huellas impiden aplicar una confirmación obsoleta. |
| Error de guardado | Restaurar la operación propia sin borrar altas posteriores; conservar error y evidencia del escritor. No reemplazar por catálogo vacío. |
| Código largo o infinito | Proceso Node separado y Stop accesible. Se conserva el límite de permisos explícitos; `vm` no es frontera de seguridad. |
| Code aislado frente a workflow completo | Input/outputs vacíos, sin continuación. Historial aislado separado; no se sobrescribe la última ejecución completa. |
| Borrador generado malformado, con referencias repetidas, ramas o permisos elevados | Rechazar o reconstruir únicamente campos admitidos; no importarlo directamente al catálogo. |
| Modelo desconocido o motor no autenticado | El selector permite ID manual; el proveedor puede rechazarlo. No se certifica disponibilidad a partir de la lista local. |
| OpenCode 1 y 2 con el mismo nombre de ejecutable | Configurar rutas independientes. La detección no convierte tareas. Ralph Loop no se admite en v2. |
| Cierre de terminal o timeout de lanzamiento | Un recibo acredita apertura de terminal, no finalización de un trabajo. No reintentar suponiendo que no hubo efectos. |
| Auxiliares con archivos ajenos, enlaces o actividad incierta | Preservarlos. No limpiar recursivamente por nombre o antigüedad. Carpetas antiguas quedan fuera del nuevo limpiador. |
| Preferencia visual inválida o almacenamiento inaccesible | Exigir entero 10–80; conservar tamaño anterior y permitir reintento. Preferencia por dispositivo/bóveda, sin sincronización del catálogo. |
| Dashboard grande | Agrupación estable y pasos paginados de 40; actualización por eventos existentes. Los contadores no son prueba independiente de actividad. |
| Manifiesto CRLF antes del commit | Git lo normaliza a LF y cambia el hash. El generador del descriptor rechaza ese candidato; comprobar el árbol Git, no solo el disco. El empaquetador conserva bytes verificados, también de formatos históricos. |

## Supuestos explícitos

- Entrega de escritorio con Node 18+ para CLI/Code. Cada proveedor requiere instalación y autenticación propias.
- Se conserva el esquema de exportación 1.6.0; las capacidades nuevas requieren lectores compatibles. La versión del manifiesto no acredita por sí sola los bytes de un candidato.
- Windows y Obsidian 1.14.5 son el entorno de GUI comprobado. Los dobles de pruebas no acreditan proveedor real, POSIX ni redes de terceros.
- El desarrollo directo autorizado sustituye la ruta SDLC para esta tanda. No se escriben runs ficticios, no se reasignan requisitos cerrados y no se actualiza el descriptor del último workflow como si hubiera ejecutado esta entrega.
- Los textos privados de tareas, journals y recibos locales quedan fuera del expediente versionado.

## Evidencia y estado

| Comprobación | Evidencia / resultado |
| --- | --- |
| Diff y alcance | `origin/main` actualizado; 16 commits de producto, 97 rutas al inicio. Mismo contenido entre base común y main remoto. Cinco archivos locales ajenos separados. |
| Candidato local previo | `qa/dashboard-running-attention-1.7.13.md`: 897 pruebas correctas, 0 fallos, 3 omisiones; build, ZIP y GUI 1.7.13 comprobados. Esta suite usó el árbol local con modificaciones ajenas presentes. |
| Entrega exacta de `538b523` | Rechazada: el manifiesto extraído de Git tiene hash `cf9a8d66000fda6af2de7bb6c07406f67290b56952bc06f78cb4f57b891447af`, pero el descriptor esperaba `a676214def59628f59711015cf291bc34379870da9fdad4f36b146a5d242c2e2`. Los otros cinco componentes coinciden. La suite aislada reprodujo errores de integridad y se detuvo su árbol de seis procesos de QA tras quedar una prueba pendiente. No completada, no aprobada; log conservado. |
| Regresión nueva | Hashes de blobs Git con `core.autocrlf=true`, rechazo CRLF al generar el descriptor y conservación del descriptor previo tras rechazo. El primer intento restringido falló por permisos de `git init`, no se ocultó ni se alteró la prueba para evitarlo. El primer diseño impedía además empaquetar un manifiesto histórico CRLF ya verificado; se limitó el control al generador para conservar ese contrato. Ensayo final: 3/3 correctas, incluida la regresión histórica del ZIP. |
| Construcción corregida | `npm run build` correcto. Los tres bundles funcionales permanecen idénticos; cambia el descriptor para coincidir con el manifiesto LF. |
| Suite del árbol Git corregido | Árbol `728f9de6e0d371fb033a38f4aea4557f243b3b7c`, excluye los cinco cambios locales ajenos. 902 pruebas: 896 correctas, 3 fallidas, 3 omitidas; 494,2 s. Fallos: observación de journals (116,85 ms frente a máximo 100), observación de guardado legado antes de 2 s y ZIP histórico CRLF. No se presenta como suite verde. |
| Revalidación de los fallos | Los dos casos de ciclo de vida pasan secuencialmente sobre la misma copia, sin modificar límites ni producto: 2/2 en 6,7 s. El ZIP pasa con la corrección final que conserva bytes históricos. No se demuestra la causa de la variabilidad temporal; conservar esta limitación y exigir CI del commit entregado. |
| Candidato final | Los bundles de plugin/CLI/runtime no cambian; tampoco cambian estilos ni skill. Solo el manifiesto LF y su hash corrigen la distribución. Después de la suite se limitó el guard al generador y se añadió comprobación de la ruta temporal antes de limpiar fixtures; ambos cambios están cubiertos por las 3 pruebas focales finales. No se atribuye a ese árbol una segunda suite completa verde. |
| ZIP corregido | SHA-256 `68df1fc7383a7f7cd3b67fc0e0329509441a6d14b73dd830627f3099080ce7af`. Siete artefactos verificados tras extraerlo; Code aislado `35f07fef-6b5f-41ca-a3a4-01e5c9c80ea6`, workflow `5b893a0b-bafb-468b-b734-4732c3febff0`; continuación sin repetir efectos y resultado del padre conservado. Bóveda sintética, no prueba autenticada de proveedor. |
| GUI y proveedor | La instalación anterior 1.7.13 está comprobada; la corrección de preparación no cambia los bundles de GUI/runtime. No se inicia una tarea privada para demostrarlo ni se atribuye una llamada autenticada a las pruebas con dobles. |
| Publicación / otra bóveda | Pendientes. Ni instalación local ni empaquetado acreditan descarga desde `main`, tag, GitHub Release o actualización real de otra bóveda. |
| Revisión CI del PR #51 | `f023b1b` falló por tres problemas del arnés. Corregidos en `2301daa`: [CI 41302679868](https://github.com/juanpega/AutoOC_obisdian_extension/actions/runs/41302679868) completa y correcta; Windows 899 correctas / 3 omitidas, Linux y macOS 869 correctas / 19 omitidas cada uno, cero fallos. Build y empaquetado correctos en los tres sistemas. [Detalle y omisiones](revision-pr51.md). |

Se conservan los fallos históricos de QA 1.7.2–1.7.11. Los resultados posteriores no reescriben esas ejecuciones ni demuestran que todas sus causas temporales estén eliminadas.

Evidencia privada local: `.tmp-merge-review-suite.log`, `.tmp-release-git-focused.log`, `.tmp-release-git-focused-native.log`, `.tmp-release-git-focused-final.log`, `.tmp-release-git-build.log`, `.tmp-release-git-pack.log`, `.tmp-release-review-tree.txt`, `.tmp-merge-final-suite.log`, `.tmp-merge-final-lifecycle-recheck.log` y `.tmp-release-final-package.json`. No se incluyen estos ficheros en Git.

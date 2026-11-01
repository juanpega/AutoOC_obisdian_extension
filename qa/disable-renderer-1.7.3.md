# Corrección de Disable — candidato 1.7.3

## Diagnóstico

El 31 de octubre de 2026 se observó una ventana vacía de Obsidian 1.14.5
después de pulsar Disable. El proceso principal seguía vivo y el proceso de
la interfaz ya no existía. El catálogo de AutoOC conservaba su hash anterior
y no había un guardado pendiente. No era la clase CSS que atenúa una tarjeta.

La primera transacción del botón consultaba `AsyncLocalStorage.getStore()`.
Su uso en el renderer con Node 24 coincide con el fallo documentado por los
autores de otro plugin de Obsidian:
[diagnóstico con símbolos nativos, comentario del 24 de octubre](https://github.com/istefox/obsidian-mcp-connector/issues/597).
La causa concreta de esta caída es probable: no se obtuvo su volcado nativo.
Una prueba mínima con clic programático en Electron 44.9 completó veinte
operaciones con el código anterior; no reprodujo el fallo. Los intentos de
inyectar entrada en una ventana oculta terminaron por timeout, sin acreditar
un clic real. No se presentan esos ensayos como reproducción del incidente.

## Cambio

Se retira `async_hooks` de la cola compartida. Una identidad efímera explícita
permite guardar dentro de la misma transacción después de un `await`, mientras
las llamadas independientes siguen esperando su turno. Se rechazan identidades
ajenas, inventadas o caducadas. No se persiste esta identidad en el catálogo.

Se transmite por cambios en lote, borradores generados, publicación de progreso
y migraciones del catálogo. Las comprobaciones de versiones, las reservas de
ejecución, los guardados atómicos y la recuperación conservan su función.

## Instalación y conservación

- Instalados los siete artefactos de 1.7.3 mediante `maintain-release --install`
  en `C:/Dev/AutoOC`, con Obsidian cerrado.
- Recuperada oficialmente la reserva `c05d7e71-e35a-44ae-8d88-42de69bc8869`
  después de comprobar la ausencia de su proceso 39580; ninguna tarea reanudada.
- Respaldo del instalador:
  `C:/Dev/AutoOC/.obsidian/plugins/auto-oc/runtime/update-backup-3e20143b-94b1-484f-b927-31c0535b49fb`.
- Comparación anterior/posterior: 1.200 archivos de datos y runtime sin cambios;
  36 tareas y 42 workflows. Catálogo anterior:
  `689d4d4c12a25ceb135788f2370055f2d0699947deeb3fa55a7a80f554cef11d`.

## Validación

- TypeScript y construcción de los tres bundles: correctos.
- Paquete completo `release/auto-oc-1.7.3.zip`: generado y verificado.
- Ejecución focal final: 36 pruebas correctas, incluidas exclusión de
  guardados independientes y reutilización explícita de una transacción.
- La primera suite general quedó bloqueada por errores EPERM al renombrar
  archivos de fixtures dentro del entorno restringido de Windows. Se interrumpió
  y se repitió en el entorno Windows normal, usando solo bóvedas sintéticas.
- Un ensayo focal con límite global de 60 segundos por archivo aprobó 23
  pruebas y canceló dos archivos por ese límite; no acredita esos archivos
  completos. La suite general posterior se ejecuta sin ese límite artificial.

## Comprobación real en Obsidian

Obsidian 1.14.5 abrió la bóveda y mostró AutoOC 1.7.3. Se pulsó el botón
Disable de `SDLC helper` (`muwqk1hl3b69`) con entrada nativa del ratón.
El guardado terminó, la tarjeta pasó a Disabled y mostró Enable, y el resto
de la ventana siguió visible y operativo. La tarea queda desactivada conforme
al intento descrito por el usuario; no se ejecutó ninguna tarea.

Después del clic se comparó el catálogo con el respaldo: todas las tareas
(salvo `disabled: true` en el helper) y todos los workflows son iguales,
incluidos sus históricos. También se guardó `dashboardPositions`, actualizado
por la vista del Dashboard. Los 1.199 archivos previos de runtime conservan
su hash. No quedó un bloqueo de guardado. Los siete artefactos instalados
coinciden con el candidato, incluido el descriptor de integridad.

La suite general `npm test` en Windows normal terminó: 863 pruebas,
860 aprobadas, 0 fallos, 0 cancelaciones y 3 omisiones. El ensayo focal
final de transacciones y catálogo aprobó 36/36. Se revisó el diff y se
comprobó que los seis hashes del descriptor coinciden también con los blobs
preparados en Git, no solo con los archivos locales instalados.
Las omisiones corresponden a dos comprobaciones exclusivas de POSIX y al
ensayo opcional con el binario oficial de OpenCode 2.0.

No se han publicado tags ni una release remota.

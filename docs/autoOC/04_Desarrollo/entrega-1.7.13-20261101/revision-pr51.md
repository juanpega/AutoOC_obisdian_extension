# Revisión del PR #51

Revisión solicitada el 2026-11-01 después de abrir el PR en borrador. No autoriza merge ni publicación. Cinco modificaciones locales ajenas siguen fuera de la entrega.

## CI del primer HEAD revisado

[Ejecución 41300252631](https://github.com/juanpega/AutoOC_obisdian_extension/actions/runs/41300252631), commit `f023b1b`:

| Plataforma | Correctas | Fallidas | Omitidas | Build | Empaquetado CI |
| --- | ---: | ---: | ---: | --- | --- |
| Windows | 897 | 2 | 3 | Correcto | No ejecutado tras fallo |
| Linux | 868 | 1 | 19 | Correcto | No ejecutado tras fallo |
| macOS | 867 | 2 | 19 | Correcto | No ejecutado tras fallo |

No había revisiones humanas ni comentarios inline pendientes. GitHub indicaba ausencia de conflictos de merge; eso no equivale a una validación correcta.

## Hallazgos y correcciones

1. **Comparación de rutas en OpenCode 2** (`tests/opencode-v2.test.cjs`). El proceso devuelve la ruta física del directorio: `/private/var` frente a `/var` en macOS y nombre largo frente a alias 8.3 en Windows. La prueba comparaba texto literal. Se comparan ahora ambas rutas mediante `realpathSync.native`, conservando la exigencia de que sea la misma carpeta física. Prompts largos, argumentos, salida y ausencia de fallback a v1 siguen comprobándose.
2. **Expectativa POSIX anterior al perfil versionado** (`tests/pre-pr-regressions.test.js`). La prueba esperaba `"$bin" run "$@"`; el generador actual incorpora `run` al array de argumentos y ejecuta `"$bin" "$@"`. La CLI ya se lanzaba: fallaba la inspección del script. Se comprueba el comando actual y la lista completa de argumentos de OpenCode 1, manteniendo detached, stdio, pid y código de salida.
3. **Carrera al cerrar Live Log** (`tests/live-log.test.cjs`). El fixture cerraba el host sin esperar su escritura pendiente y eliminaba la carpeta mientras aún podía publicarse un heartbeat/recibo. Ahora cierra y espera `drain()` antes de liberar la reserva, y espera `close` de los procesos propios antes de borrar el temporal. La respuesta CLI se lee después de cerrar también sus streams. No se añaden reintentos de borrado para ocultar escritores activos.

Son correcciones del arnés; no cambian fuentes del plugin/runtime, límites de rendimiento, permisos, reservas de instalaciones reales ni artefactos distribuidos. Las pruebas siguen verificando transmisión/redacción de salida antes de terminar y conservación de catálogo/journal mientras se observa el log.

## Validación de las correcciones

- CodeGraph consultado para localizar código, llamadas y contratos de cierre antes de editar.
- `node --test tests/opencode-v2.test.cjs tests/live-log.test.cjs tests/pre-pr-regressions.test.js`: 35 casos, 33 correctos, 0 fallidos y 2 omitidos en Windows (POSIX y binario OpenCode 2 opcional). Ejecución nativa, 12,3 s.
- Los contratos POSIX/macOS necesitan la nueva CI; no se presentan las omisiones locales como verificaciones de esas plataformas.
- Siguiente gate: matriz completa del commit que incorpora estas correcciones, incluyendo build y empaquetado. Estado pendiente al preparar este commit.

## Resultado de la revalidación completa

[CI 41302679868](https://github.com/juanpega/AutoOC_obisdian_extension/actions/runs/41302679868), commit `2301daa847289bec112223568ab0424d4580d925`: **correcta en las tres plataformas**.

| Plataforma | Correctas | Fallidas | Omitidas | Build / empaquetado / subida del ZIP de CI |
| --- | ---: | ---: | ---: | --- |
| Windows | 899 | 0 | 3 | Correctos |
| Linux | 869 | 0 | 19 | Correctos |
| macOS | 869 | 0 | 19 | Correctos |

Windows ejecuta 902 casos en 244,0 s; Linux, 888 en 66,4 s; macOS, 888 en 64,0 s. Las 19 omisiones POSIX son 18 pruebas específicas de Windows y una prueba opcional del binario OpenCode 2. Las tres omisiones Windows son dos comprobaciones POSIX y ese mismo binario opcional. No hay casos cancelados ni límites relajados.

La matriz ejecutó `npm run build`, `npm test` y `npm run pack:release` sobre la rama del PR integrada con su base, sin las cinco modificaciones locales ajenas. La integridad del paquete local también vuelve a pasar. La subida del ZIP como artefacto de CI no es una GitHub Release ni habilita el actualizador de otras bóvedas.

Quedan pendientes la decisión de merge/publicación y la prueba real del actualizador desde otra bóveda después de publicar. El PR permanece en borrador. Esta actualización posterior del expediente solo cambia documentación; el código validado corresponde al commit citado.

## Repetición sobre la documentación final

La [CI 41303109512](https://github.com/juanpega/AutoOC_obisdian_extension/actions/runs/41303109512) de `4f044a3`, cuyo código es idéntico al anterior, volvió a pasar en Windows y Linux pero falló en macOS (867 correctas, 2 fallidas, 19 omitidas). No se sustituye este resultado por el verde anterior ni se considera listo ese HEAD.

- Live Log observó una salida stdout válida antes de que llegara stderr. Son escrituras independientes; ahora la espera exige que ambas salidas aparezcan antes de terminar la ejecución. Se mantienen la redacción, la actualización del log y la comprobación de que la tarea continúa activa.
- La recuperación histórica registró un intervalo máximo de 100,355 ms frente al límite de 100 ms. La prueba es sensible al tiempo de CPU disponible; este resultado no demuestra por sí solo si la demora viene del producto o de la planificación del host. Las pruebas de ciclo de vida se ejecutan ahora en un proceso separado, después del grupo concurrente, para evitar la competencia creada por otras suites. Se conservan el límite de 100 ms, el tamaño del catálogo sintético y todos los casos; no se añaden reintentos automáticos.

`npm test` y `npm run test:settings-recovery` siguen incluyendo `tests/plugin-lifecycle.test.cjs` mediante `npm run test:lifecycle`. La suite completa produce dos resúmenes TAP; deben sumarse para comparar la cobertura total. El siguiente gate exige otra matriz completa con esta organización y la espera corregida de Live Log.

La prueba corregida de Live Log pasa localmente: 5 casos correctos, sin fallos ni omisiones, en 32,9 s. El ensayo aislado de ciclo de vida conserva dos incumplimientos temporales locales: recuperación histórica 115,560 ms y observación de journals 102,958 ms. Separar las suites no acredita la eliminación de la variabilidad; no se modifica el límite ni se presenta este ensayo como aprobado. Sigue pendiente diagnosticar y estabilizar esta comprobación de respuesta antes de recomendar merge. Evidencia: `.tmp-pr51-streams.log` y `.tmp-pr51-lifecycle-isolated.log`.

Resultado completo de ese ensayo: **148 casos, 144 correctos, 4 fallidos, sin omisiones ni cancelaciones**, 286,3 s. Además de las dos mediciones anteriores, fallan dos fixtures de guardados históricos 1.6.1 con cinco escrituras en cola (pace 65 y pace 0, gap 0): no se observó el temporal antes del límite de 2 s. El caso de dos escrituras en cola y el de escritor legítimo por encima de 2 s sí pasan. No se ha aislado todavía la causa de estos dos timeouts; los límites permanecen intactos. Esta revisión no autoriza llamar aprobada a la validación local ni desbloquear una instalación real a partir de esos fixtures.

Se ha comparado programáticamente la lista de archivos de `test` y `test:settings-recovery` con la anterior, incorporando `test:lifecycle`: se mantienen exactamente los mismos archivos. La separación organiza la medición; no elimina pruebas ni acredita por sí sola una corrección funcional.

Continuación autorizada por el usuario: [cierre de validación](cierre-validacion.md). Incluye perfil del arnés, regresión con demora controlada y evidencia del candidato final. Los resultados anteriores se conservan como históricos.

Evidencia local privada: `.tmp-pr51-ci-focused.log` y `.tmp-pr51-ci-affected.txt`. Los logs de CI son los del enlace anterior; no se incorporan volcados de entornos o datos privados al expediente.

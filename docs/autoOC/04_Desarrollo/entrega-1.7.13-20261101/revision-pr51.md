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

Evidencia local privada: `.tmp-pr51-ci-focused.log` y `.tmp-pr51-ci-affected.txt`. Los logs de CI son los del enlace anterior; no se incorporan volcados de entornos o datos privados al expediente.

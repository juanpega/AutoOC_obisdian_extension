# Dashboard: ejecución activa y atención — candidato 1.7.13

Fecha: 2026-11-01. Corrección directa solicitada por el usuario, sin ciclo SDLC. No acredita publicación.

## Diagnóstico y cambio

- El Dashboard nuevo interpretaba `requiresReconciliation` sin consultar el control de la ejecución. El registro durable puede conservar esa marca durante una ejecución normal; el propietario presenta su estado en memoria como `running`.
- En la instalación 1.7.12 se observó esa combinación: Dashboard con `running` y aviso, journal `in_flight`, marca de recuperación y propietario presente. Solo se consultaron estados e identidades; no se ejecutaron recuperaciones, paradas ni modificaciones del catálogo.
- Se reutiliza `executionStatusHelp` y el control oficial `ownsExecution(workflowId, runId)`. El Dashboard verifica el intento exacto, también para workflows y resultados Code aislados, y comparte la comprobación dentro de cada proyección.
- Un intento controlado no genera atención solo por las marcas durables. Aprobaciones, paradas no confirmadas, fallos, incertidumbres sin control y cambios de identidad mantienen los avisos. La pérdida de control actualiza el Dashboard aunque no cambie el estado guardado.
- No cambian admisión, exclusión, ejecución, persistencia, esquema ni permisos. Auditoría del prompt: sin impacto en las definiciones generadas; los ejemplos del prompt final continúan pasando las pruebas de los creadores.

## Validación

- CodeGraph consultado antes de editar: `needsAttention`, `executionStatusHelp`, `ownsExecution`, `ownsSharedRun` y el adaptador del Dashboard. Impacto revisado en burbujas, filtro, métricas e inspector. `codegraph affected dashboard-areas.ts main.ts` registrado.
- `npm run build`: correcto tras ajustar la compatibilidad del tipo de metadatos legacy. Las pruebas focales se ejecutaron contra el bundle reconstruido: 37 correctas, 0 fallidas.
- Regresiones nuevas: `Running` sin advertencia con propietario exacto; atención al perderlo o cambiar el run; aprobaciones y paradas conservadas; workflow y Code aislado con identidades separadas; adaptador real pasando la consulta al plugin; datos de origen intactos.
- Suite general `npm test`: 900 pruebas; 897 correctas, 0 fallidas y 3 omitidas (dos POSIX y la comprobación opcional del binario real OpenCode v2). Ejecución nativa con código de salida 0, duración 400,7 s.
- ZIP 1.7.13 construido y extraído: siete artefactos verificados. En bóveda sintética, Code aislado, continuación sin repetir efectos y workflow completo correctos. Runs `01ce1503-fd5d-40c6-b09d-075bbc6f1f1c` y `b7a1c6cb-9649-470f-8b8a-944aea1c9609`.

## Instalación

- Instalado 1.7.13 en `C:\Dev\AutoOC` mediante `maintain-release --install` desde el ZIP extraído y verificado. Se esperó a que la ejecución observada terminara en `completed`, revisión 3, con un paso completado y cero fallos. Antes de descargar el plugin se comprobaron cero ejecuciones activas, tareas, workflows y Code en marcha; después se verificó la liberación de la reserva.
- Verificados los siete artefactos instalados y SHA-256 de `data.json` idéntico antes/después de la instalación. El catálogo contenía 36 tareas antes de desactivar AutoOC y conserva esas 36 después de recargarlo; la tarea observada ya no estaba en ese catálogo antes de intervenir en la interfaz.
- Copias oficiales: `runtime/update-backup-f5ed4a2b-356e-4ab9-a774-492ef2e5dc41` y `runtime/maintenance-backup-a9fbc3b1-c945-4fd3-af8c-bf8cc10f5ec3`. Ninguna disposición histórica aplicada.
- Reactivado por la interfaz de Obsidian y refrescada su lista de plugins. Preferencias y cabecera del Dashboard muestran 1.7.13; panel abierto sin recuperación, cero elementos en marcha y cero avisos de atención. CLI instalada confirma 1.7.13 y reserva del host presente. Se deja el Dashboard abierto con búsqueda vacía.
- No se ha detenido ni reiniciado la tarea privada para probar el arreglo. El comportamiento con propietario controlado se acredita con pruebas de integración y dobles; no constituye una ejecución de proveedor real con el candidato.

Evidencia local: `.tmp-attention-build.log`, `.tmp-attention-focused.log`, `.tmp-attention-suite.log`, `.tmp-attention-pack.log`, `.tmp-attention-package.json`, `.tmp-attention-affected.txt`, `.tmp-attention-before-install-status.json`, `.tmp-attention-install.json`, `.tmp-attention-installed-verification.json` y `.tmp-attention-reloaded-status.json`. Los estados locales son evidencia privada y no se incorporan al commit.

# Selector de modelo en los creadores — candidato 1.7.11

Fecha: 2026-11-01. Cambio directo solicitado por el usuario, sin ciclo SDLC. No acredita publicación.

## Alcance

- `New Task` y `New Workflow` → `Create with AI` incluyen un desplegable `Model`, `Automatic (CLI default)` y `Other model…`.
- OpenCode 1 y Codex reutilizan los modelos cargados para el editor de tareas. Cada motor añade sus modelos usados y conserva su valor configurado aunque no figure en la lista. OpenCode 2 y Copilot no adquieren descubrimiento remoto por este cambio.
- El modal recuerda por separado las elecciones al cambiar de motor, incluida la opción automática. Cambiar el modelo invalida el borrador previo. No guarda ajustes globales ni consulta al proveedor al abrirse.
- La selección llega al generador y a las tareas del borrador que utilizan ese motor. Las tareas de otros motores conservan sus valores predeterminados. La generación debe revisarse en el editor antes de guardar.
- Auditoría del prompt real: se sustituye el ejemplo genérico con ramificaciones por un ejemplo compatible con cada creador; se explicita que AutoOC aplica el modelo seleccionado fuera del JSON. El esquema, el validador y los permisos no se amplían.

## Validación

- Exploración previa de `AiDraftModal` y `openAiDraft` con CodeGraph; revisión de impacto y `codegraph affected ai-draft-modal.ts ai-draft.ts main.ts`. Los flujos afectados son ambos creadores y su preparación de borradores; no se modifica la ejecución de tareas existentes.
- Pruebas focales: `tests/ai-draft.test.cjs` y `tests/pre-pr-regressions.test.js`. Primera ejecución restringida: 40 correctas, 1 fallo al cargar la configuración de CScript y 1 omitida. Repetición nativa: 41 correctas, 0 fallidas y 1 omitida por plataforma. No se modificó esa comprobación para superar la restricción.
- Se comprueban ambos creadores con los cuatro motores, el envío del modelo al generador, su incorporación al borrador, modelos manuales, elección automática, separación entre motores, invalidación de la vista previa y ausencia de guardados globales. Los ejemplos del prompt efectivo pasan por el validador real para las ocho combinaciones.
- `npm run build` y `npm run pack:release`: correctos. ZIP `release/auto-oc-1.7.11.zip` extraído en una bóveda sintética: siete artefactos verificados; ejecución Code aislada, continuación sin repetir efectos y workflow completo correctos.
- Suite general: 893 pruebas; 889 correctas, 1 fallida y 3 omitidas; 652.884 ms. Falló `historical 1.6.1 Dashboard drains 5 queued saves, pace 65, gap 0`: el observador no confirmó el temporal dentro del límite de la prueba. La repetición aislada de esa comprobación pasó (1 correcta, 0 fallidas). No se cambiaron el producto, la prueba ni sus plazos entre ambas ejecuciones; la causa de la intermitencia no queda demostrada. La suite completa no se presenta como totalmente correcta.

## Instalación y comprobación en Obsidian

- Instalación autorizada: `C:\Dev\AutoOC`, anteriormente 1.7.10. Consulta previa: 36 tareas, 42 workflows, sin ejecuciones activas registradas. AutoOC se desactivó mediante la interfaz; su reserva y marcadores de guardado desaparecieron normalmente.
- Instalación oficial mediante `maintain-release --install`, resultado 1.7.11 y `applied: []`; no se aplicaron recuperaciones ni abandonos.
- Respaldos dentro de la instalación: `runtime/update-backup-75afe38f-ea35-449b-b0fe-647fab26812b` y `runtime/maintenance-backup-ddbf6245-57e2-4f39-9344-0a5411dfa782`.
- Los siete artefactos coinciden con el candidato. El SHA-256 de `data.json` sigue idéntico después de instalar, reactivar y comprobar ambos creadores.
- Obsidian 1.14.5 carga AutoOC 1.7.11. Comprobado el desplegable en ambos creadores, el campo manual y el cambio OpenCode 1 → Codex → OpenCode 1, que restaura el modelo escrito. Los controles del modal siguen accesibles mediante desplazamiento. Se cerraron todos los borradores de prueba sin guardarlos.
- No se enviaron peticiones a proveedores reales ni se ejecutaron tareas privadas. La autenticación y la disponibilidad remota de modelos no quedan acreditadas por los dobles de pruebas ni por la comprobación visual.

Evidencia local: `.tmp-draft-model-focused.log`, `.tmp-draft-model-focused-native.log`, `.tmp-draft-model-build.log`, `.tmp-draft-model-suite.log`, `.tmp-draft-model-recheck.log`, `.tmp-draft-model-pack.log`, `.tmp-draft-model-package.json`, `.tmp-draft-model-install.json` y `.tmp-draft-model-affected.txt`.

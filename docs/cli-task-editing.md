# Edición de tareas desde CLI

Encargo del 17/11/2026: añadir `edit-task`, equivalente de la edición textual de
workflows, e instalar el candidato en `C:/Dev/inncrea_hub_main_web`.

Se añaden `export-task` y `edit-task`, con selección `--task`, hash optimista,
validación estricta de nombre/prompt, exclusión con ejecuciones y guardado por
la cola del plugin. El transporte usa recibos durables, control de capacidad
`taskEditing:1` y los límites de edición existentes (2 MiB cambios / 3 MiB patch).
No crea ni duplica tareas ni modifica sus referencias, motor, permisos o historial.
Los nombres se notifican también a los editores abiertos.

El esquema de importación y los validadores de los creadores no cambian. Su guía
compartida distingue los parches CLI de los paquetes JSON generados.
Pruebas: módulo de edición, transporte con propietario sintético y CLI empaquetada,
además de regresiones de workflows, cola y creadores. Esto no acredita GUI real.

## Verificación del candidato 1.7.27

- Se conserva 1.7.27 por decisión del usuario: todavía no publicada.
- Build TypeScript/bundles correcto. Regresiones focales finales: 97/97
  (tareas, workflows, transporte CLI y prompt real de creadores).
- Ciclo de vida ejecutado por separado: 149/149; integridad de los siete
  artefactos aprobada. Evidencia: `.tmp-task-lifecycle.log`.
- Se corrigieron dos fallos propios detectados durante desarrollo: anunciar el
  límite de tamaño cuando solo existe handler de tareas y despachar la petición
  al handler de tareas, en lugar del de workflows.
- `npm test`: pretest con 310 aprobadas, 7 fallidas y 1 omitida. Fallos de host
  de terminal y sesiones. La suite principal se lanzó por separado; presentó
  fallos de ejecución CLI y se interrumpió sin completar. No se declara aprobada.
- Instalación autorizada en inncrea_hub_main_web: inspección realizada; intento
  oficial `maintain-release --install` bloqueado por EPERM. El destino sigue sin
  `export-task`; no se acredita instalación ni carga de GUI.
- Commit autorizado para tareas y límites ampliados. `git add` rechazado por
  acceso denegado a `.git/index.lock`; no hubo staging ni commit. Hay cambios
  previos de otras funcionalidades en archivos compartidos: no usar `git add .`.

Evidencia local: `.tmp-task-focused-final.log`, `.tmp-task-build-27.log`,
`.tmp-task-suite.log`, `.tmp-task-main-suite.log`, `.tmp-task-install-error.txt`.

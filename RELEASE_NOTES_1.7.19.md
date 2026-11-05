# AutoOC 1.7.19 — Workflows anidados y filtros del Dashboard

## Novedades

- **Workflows como pasos:** desde WorkFlows se pueden añadir y cambiar workflows hijos existentes. El padre espera a cada hijo y continúa según sus transiciones, utilizando su resultado.
- **Ejecución y recuperación:** cada invocación mantiene sus IDs y salidas locales dentro de un único intento padre. La parada y la continuación seleccionan ese padre. Se conserva el historial independiente de los hijos y se protegen las dependencias frente a ejecuciones incompatibles.
- **Importación y exportación:** se incluyen las tareas y workflows descendientes; el importador genera nuevas identidades y resuelve referencias entre workflows. El esquema de exportación pasa a 1.7.0 con `workflowExportId`, manteniendo la lectura de formatos anteriores.
- **Dashboard por tipo:** debajo de Your areas, Workflows y Tasks muestran solo su tipo en las áreas correspondientes. All restaura la vista conjunta. Tasks incluye tareas Code y los filtros se combinan con búsqueda, atención y desactivación.

## Compatibilidad y límites

- Se rechazan ciclos, referencias ausentes o ambiguas, más de 16 niveles y planes de más de 10.000 pasos internos. La programación del hijo no interviene cuando se ejecuta como paso.
- La CLI y el propietario compatible anuncian `nestedWorkflows: 1`. Las operaciones de ejecución siguen seleccionando el workflow padre y su intento.
- `export-workflow` y `edit-workflow` mantienen la edición parcial con `expectedHash`: nombre/descripción y texto/código de pasos existentes. Añadir, eliminar o reordenar pasos y cambiar el workflow hijo requiere el editor; no se amplían permisos ni campos editables por CLI.
- El creador IA integrado genera un único workflow secuencial. Los workflows hijos se añaden desde WorkFlows al revisar el borrador. Los ejemplos del prompt final se comprueban con los validadores reales.

## Entrega

El paquete `auto-oc-1.7.19.zip` contiene los siete artefactos de `RELEASE_WORKFLOW.md`, con versiones y hashes verificados. La actualización desde AutoOC estará disponible cuando estos artefactos lleguen a `main`; preparar el ZIP y abrir el PR no publica la actualización.

Las comprobaciones automatizadas usan bóvedas sintéticas y dobles de Obsidian/proveedores. La aceptación visual en Obsidian real y la autenticación con proveedores reales quedan pendientes. Esta preparación no modifica instalaciones ni workflows reales.

## Validación del candidato

- `npm run build`: TypeScript, tres bundles y descriptor correctos.
- `npm test`: 830 pruebas funcionales aprobadas, tres omitidas y cero fallos; después, ciclo de vida aislado 149/149, conservando los límites de 100 ms. Las omisiones corresponden a dos casos POSIX y al binario oficial OpenCode 2.
- `npm run pack:release`: ZIP extraído con exactamente siete artefactos, idénticos a los blobs preparados en Git y con hashes verificados.
- CLI del ZIP sobre una bóveda sintética: workflow anidado completado, entrada/salida comprobadas, historial del hijo conservado, continuación terminal sin repetir efectos y reserva liberada.
- SHA-256 de `auto-oc-1.7.19.zip`: `8342662aa8a662be83d93d1ab794d9eb233b24f13bdeeba486a1697a59c4d888`.

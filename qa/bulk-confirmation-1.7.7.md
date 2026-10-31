# Confirmaciones en grupo — 1.7.7

## Diagnóstico y corrección

Reproducido en Obsidian 1.14.5 sobre `C:\Dev\AutoOC`: al abrir Disable selected con 17 tareas seleccionadas, el diálogo solo mostraba el título y la explicación. La consola registraba `TypeError: this.selection is not iterable` en `BulkCatalogModal.onOpen`.

La propiedad `selection` de la subclase colisionaba con el estado que conserva `Modal.open()` de Obsidian para restaurar la selección del editor. Se renombra la lista del catálogo a `selectedItems`. El cambio cubre desactivar, activar, eliminar y cambiar área, que comparten el diálogo. No cambia validaciones, permisos ni lógica de persistencia.

## Validación

- El doble de Modal ahora reproduce la asignación de `selection` antes de `onOpen`. Contra el bundle anterior reproduce tres fallos: disponibilidad, eliminación y área (29/32 aprobadas).
- Con el bundle corregido, catálogo: 33/33 aprobadas. Incluye una regresión de dos workflows seleccionados, Cancel sin guardados y confirmación que conserva las tareas reutilizables y el workflow no seleccionado.
- Creadores de borradores: 18/18 aprobadas. Esto no acredita la compatibilidad del ejemplo real del prompt.
- TypeScript y construcción completa aprobados. ZIP `release/auto-oc-1.7.7.zip` generado y verificado. El primer intento de compresión no pudo cargar el módulo de Windows en el entorno restringido; el empaquetado con acceso normal terminó correctamente.
- Suite general `npm test`: en curso; pendiente registrar el resultado final, sin acreditarla como aprobada.
- Obsidian real tras instalar: panel 1.7.7, selección de las mismas 17 tareas del área OpenCode, lista desplazable y botones Cancel y Disable 17 items visibles. Cancel comprobado. No se aplicó la desactivación ni se ejecutaron tareas reales.

## Instalación y conservación

Instalador oficial `maintain-release --install` con el plugin descargado, seguido de reactivación normal. Los siete artefactos coinciden con el candidato. SHA-256 de `data.json` idéntico antes de instalar, después de activar y tras cancelar la prueba.

Respaldo de artefactos: `runtime/update-backup-c5d0ec3a-0919-4bbb-b043-357576a8e36d`. Respaldo de mantenimiento: `runtime/maintenance-backup-649c43a6-0f1d-4fc3-b105-118fc75a0363`. Ambos dentro de la instalación seleccionada. Sin publicación remota.

## Vigilancia del prompt

`AGENTS.md` exige revisar el impacto de cada cambio funcional en el prompt compartido y comprobar sus ejemplos reales cuando cambie el contrato. Este cambio de apertura de diálogos no modifica ese contrato.

Siguen pendientes los hallazgos de la auditoría del prompt de 1.7.6, que no se modifica en esta entrega: comillas inválidas en el ejemplo JSON, ejemplo con bifurcaciones rechazado por el creador secuencial y referencias históricas de versión contradictorias con las instrucciones finales. No se presenta ese prompt como completamente compatible.

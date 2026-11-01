# Confirmaciones en grupo — 1.7.7

## Diagnóstico y corrección

Reproducido en Obsidian 1.14.5 sobre `C:\Dev\AutoOC`: al abrir Disable selected con 17 tareas seleccionadas, el diálogo solo mostraba el título y la explicación. La consola registraba `TypeError: this.selection is not iterable` en `BulkCatalogModal.onOpen`.

La propiedad `selection` de la subclase colisionaba con el estado que conserva `Modal.open()` de Obsidian para restaurar la selección del editor. Se renombra la lista del catálogo a `selectedItems`. El cambio cubre desactivar, activar, eliminar y cambiar área, que comparten el diálogo. No cambia validaciones, permisos ni lógica de persistencia.

## Validación

- El doble de Modal ahora reproduce la asignación de `selection` antes de `onOpen`. Contra el bundle anterior reproduce tres fallos: disponibilidad, eliminación y área (29/32 aprobadas).
- Con el bundle corregido, catálogo: 33/33 aprobadas. Incluye una regresión de dos workflows seleccionados, Cancel sin guardados y confirmación que conserva las tareas reutilizables y el workflow no seleccionado.
- Creadores de borradores: 18/18 aprobadas. Esto no acredita la compatibilidad del ejemplo real del prompt.
- TypeScript y construcción completa aprobados. ZIP `release/auto-oc-1.7.7.zip` generado y verificado. El primer intento de compresión no pudo cargar el módulo de Windows en el entorno restringido; el empaquetado con acceso normal terminó correctamente.
- Suite general `npm test`: finalizada en 23 min 35 s con 874 pruebas: 859 aprobadas, 9 fallidas, 2 canceladas por timeout y 4 omitidas. No se acredita como aprobada.
- Obsidian real tras instalar: panel 1.7.7, selección de las mismas 17 tareas del área OpenCode, lista desplazable y botones Cancel y Disable 17 items visibles. Cancel comprobado. No se aplicó la desactivación ni se ejecutaron tareas reales.

## Instalación y conservación

Instalador oficial `maintain-release --install` con el plugin descargado, seguido de reactivación normal. Los siete artefactos coinciden con el candidato. SHA-256 de `data.json` idéntico antes de instalar, después de activar y tras cancelar la prueba.

Respaldo de artefactos: `runtime/update-backup-c5d0ec3a-0919-4bbb-b043-357576a8e36d`. Respaldo de mantenimiento: `runtime/maintenance-backup-649c43a6-0f1d-4fc3-b105-118fc75a0363`. Ambos dentro de la instalación seleccionada. Sin publicación remota.

## Vigilancia del prompt

`AGENTS.md` exige revisar el impacto de cada cambio funcional en el prompt compartido y comprobar sus ejemplos reales cuando cambie el contrato. Este cambio de apertura de diálogos no modifica ese contrato. El archivo es local y está ignorado por Git: la regla se incorporó allí, sin forzar su inclusión ni cambiar `.gitignore`.

Siguen pendientes los hallazgos de la auditoría del prompt de 1.7.6, que no se modifica en esta entrega: comillas inválidas en el ejemplo JSON, ejemplo con bifurcaciones rechazado por el creador secuencial y referencias históricas de versión contradictorias con las instrucciones finales. No se presenta ese prompt como completamente compatible.

## Resultado general pendiente de investigación

Los nueve fallos corresponden a dos transiciones desde paquetes históricos de `execution-abandonment`, el ensayo completo del ZIP de `packaged-runtime`, cinco comprobaciones históricas de latencia/observación de guardados de `plugin-lifecycle` y el ZIP con manifest de espacios/CRLF de `release-update`. Las dos cancelaciones son pruebas de proceso terminado durante un guardado parcial o confirmado de `settings-crash-recovery`, ambas por superar 30 segundos.

Se omiten el ensayo con binario OpenCode v2 real, dos casos exclusivos de POSIX y la observación de inicio de un proceso terminado no disponible en el entorno. Las pruebas con dobles no sustituyen esas comprobaciones. No se ha demostrado que todos los fallos sean exclusivamente ambientales; no se modifican sus límites ni las protecciones del producto para darlos por aprobados.

Revisión del diff, `git diff --check` y `codegraph affected catalog-bulk-modal.ts` completados. Commit funcional: `5c44c3c`. Cambios ajenos de biblioteca SDLC, su prueba y `.gitignore` conservados fuera del commit.

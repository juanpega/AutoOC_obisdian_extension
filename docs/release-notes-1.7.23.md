# AutoOC 1.7.23 — candidato local

Esta versión está preparada para revisión y pruebas. No está publicada ni instalada en la bóveda de este proyecto.

## Páginas y worktrees

- Páginas con carpeta y contexto de ejecución propios, usando el mismo catálogo de tareas y workflows que Main workspace.
- Worktrees opcionales en Settings, con preparación de `.gitignore` explicada y aviso recordable por proyecto.
- Rama visible en Main, controles compactos y acceso discreto a Overview.
- CLI y ejecuciones de página con validación del contexto, reservas y reutilización de terminales. Schedules y CLI sin selección explícita mantienen Main workspace.
- Cierre guiado: Archive page, retirada de worktree limpio y Discard work con confirmación. Eliminación de fichas archivadas vacías sin borrar sus carpetas.
- Diff con colores y modal con cabecera y acciones visibles.
- Merge review para consultar conflictos previstos o reales, abrir el destino y copiar comandos revisados. El desarrollador ejecuta y completa el merge.

## Ajuste de Overview

**Import** permanece disponible porque modifica el catálogo compartido. **CLI** pide elegir explícitamente Main workspace o una página disponible. Cancelar no abre procesos; las páginas archivadas o retiradas quedan excluidas y el contexto se comprueba al seleccionar.

La guía portable y el prompt compartido describen este comportamiento sin añadir campos de página al JSON de tareas o workflows.

## Estado de validación e instalación

Compilación, 140 pruebas focales y ejecución de un workflow desde el ZIP extraído verificadas. El usuario aporta desde PowerShell 8/8 de terminales, pretest con 317 aprobadas y una omisión, y lifecycle 149/149; todos sin fallos y sin cambios de producto. Queda incorporar los resúmenes de las fases intermedias de `npm test`. Los errores anteriores de conexiones y hardlinks pertenecen a la ejecución restringida del agente y se conservan como evidencia histórica. La GUI nativa no se ha probado. El candidato también incorpora cambios coexistentes del árbol de trabajo que deben revisarse antes del PR.

La instalación local está pendiente de descargar AutoOC y liberar su reserva mediante el funcionamiento normal del plugin. No se deben borrar locks ni sobrescribir el catálogo para actualizar. Con el plugin descargado y sin actividad, el instalador oficial para esta bóveda es:

```powershell
node "C:\Dev\AutoOC_obisidian_extension\deploy.mjs" "C:\Dev\AutoOC_obisidian_extension"
```

Después hay que comprobar la instalación y activar AutoOC. Las comprobaciones, limitaciones y hashes están en [el borrador de PR](pr-pages-worktrees-1.7.23.md).

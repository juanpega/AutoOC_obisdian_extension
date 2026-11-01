# AutoOC 1.7.13

Notas preparadas; publicación pendiente. Reúne las mejoras desarrolladas desde la versión publicada 1.7.1.

## Cambios principales

- El catálogo sigue accesible para consulta y diagnóstico cuando el motor necesita revisión. Actualizar el plugin conserva los históricos sin exigir resolverlos como si fueran trabajo en curso.
- **Create with AI** permite describir el objetivo, elegir motor y modelo y terminar la tarea o workflow en el editor. Sustituye el recorrido del WF Visual Builder retirado.
- Selección múltiple para cambiar área, exportar, eliminar y activar/desactivar. Los desactivados quedan en gris y conservan configuración e historial.
- Los pasos **Code** tienen presencia en Tasks, ejecución aislada, Stop, log, historial y edición JavaScript con colores, sangría y búsqueda.
- **CLI** abre OpenCode, Codex CLI, GitHub Copilot CLI o Claude Code directamente. OpenCode 2 tiene configuración y comandos propios; las tareas de OpenCode 1 se conservan.
- Nuevo **Dashboard por áreas**, grupos plegables, búsqueda, filtros e inspector. Burbujas de tareas y pasos configurables entre 10 y 80 píxeles.
- Una ejecución controlada muestra **Running** sin el aviso falso **Needs attention**. Los avisos reales permanecen visibles.
- Auxiliares nuevos agrupados en `.autooc/auxiliary`, con limpieza tras cierre confirmado. Guardados y controles de confirmación corregidos.
- CLI ampliada con disponibilidad y selección de Code; paquete verificado también contra los bytes de Git.

## Actualización

Cuando esta versión esté en `main`, usar **Check updates** desde AutoOC. El ZIP completo incluye siete artefactos; conservar `data.json`, credenciales históricas y runtime. Una instalación antigua que bloquee el primer salto dispone del procedimiento `maintain-release` documentado en README. No borrar reservas o historiales para actualizar.

OpenCode 2 requiere una CLI v2 y autenticación propias. Claude se incorpora como lanzador interactivo, no como motor de tareas programadas. Las preferencias de tamaño son locales al dispositivo/bóveda. La generación crea un borrador; siempre se revisan sus permisos antes de guardarlo.

ZIP candidato: `auto-oc-1.7.13.zip`, SHA-256 `68df1fc7383a7f7cd3b67fc0e0329509441a6d14b73dd830627f3099080ce7af`. Completar la CI y la decisión de publicación según [preparación de entrega](preparacion-entrega.md); estas notas no certifican una release publicada.

# AutoOC 1.7.28 — cierre de Pages y fiabilidad del runtime

## Pages y worktrees

- Las tareas CLI abiertas desde una Page utilizan el directorio de trabajo de esa Page.
- La revisión permite ejecutar la integración desde AutoOC y detecta primero si la rama ya está integrada.
- Integrar, archivar la Page y eliminar el worktree o la rama son acciones separadas. Una rama integrada no necesita otro merge ni un commit de la configuración local para acreditar la integración.
- El cierre muestra las sesiones que bloquean la operación, con acceso a cada una, y los archivos pendientes. La configuración local se distingue de los cambios del producto; esa distinción no autoriza borrar archivos pendientes.
- El helper de Principal puede mantenerse abierto al cerrar una Page con worktree independiente verificado. Las operaciones Git que afecten a su directorio conservan las comprobaciones necesarias.
- La revisión de cierre actualiza el estado al cerrar sesiones y cambiar el estado de la Page, sin tener que cerrar y abrir el diálogo.

## Ejecución y diagnóstico

- La pérdida de transporte o de un resultado Code conserva la ejecución incierta y bloquea su repetición automática. Un error observado del script sigue registrándose como fallo del script.
- Se acota la espera de resultado y cierre del runner, y se solicita terminar sus descendientes cuando se pierde el resultado. Esto no certifica la ausencia de efectos externos.
- Los diagnósticos de publicación y recibos conservan etapa y clasificación saneada del error, sin guardar mensajes privados, prompts o secretos.
- La guía portable se actualiza con las capacidades y los límites del candidato.

## Distribución

- El ZIP se genera con Node en Windows, macOS y Linux, sin depender de módulos de compresión de PowerShell ni de un ejecutable `zip`.
- Se conservan los siete artefactos y sus hashes. Las pruebas verifican extracción con un lector independiente y ejecución desde el paquete extraído.

## Actualización

Usar el paquete completo y el procedimiento de actualización habitual, con AutoOC descargado e inactividad verificada. Conservar `data.json`, credenciales, journals y respaldos. Una instalación en disco requiere recargar y comprobar la instancia de Obsidian.

Estas son las notas preparadas para la publicación. El estado de aceptación, las pruebas pendientes y el hash del candidato se registran en `docs/release-validation-1.7.28.md`.

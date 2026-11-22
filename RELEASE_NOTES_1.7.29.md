# AutoOC 1.7.29 — recuperación de Pages y carpetas retiradas

- Nuevos `review-page` y `page-action` con `pageManagement:1`: revisar merge/cierre/descarte/borrado y ejecutar decisiones vinculadas a la revisión, mediante el propietario abierto. Recibos recuperables con `inspect-request`/`follow` y confirmaciones explícitas para acciones destructivas.
- Merge review conserva contenido, desplazamiento y botones durante las consultas automáticas. Una operación explícita invalida respuestas anteriores y mantiene sus controles bloqueados hasta terminar.
- El Dashboard actualiza las reservas de terminal sin reconstruir las tareas: al confirmar una sesión cerrada desaparece su aviso, y una nueva sesión conserva su propia identidad y estado.
- Merge review procesa incrementalmente los archivos ignorados y comprueba las rutas del resultado previsto del merge. Evita el desbordamiento de 4 MiB y falsas colisiones con archivos retirados solo en destino, conservando la detección de colisiones reales y las guardas de ejecución.
- Skill portable y prompt real de creadores actualizados con los comandos, capacidades, límites y recuperación de respuestas inciertas.

- Crear o vincular una Page vuelve a funcionar cuando otra Page archivada conserva la evidencia de un worktree eliminado (`removed`).
- Las carpetas duplicadas siguen rechazándose. Si falta la carpeta de una Page vigente, el diagnóstico identifica su Page y ruta antes de crear otro worktree.
- Nuevo comando `recover-page-request --vault ROOT --request-id ID`: verifica repositorio, rama, carpeta reservada y registro Git para registrar la misma Page tras un alta parcial. Conserva solicitud e historial; no crea otro worktree, no cambia de rama y no lanza tareas.
- Las sesiones de Main pueden permanecer abiertas mientras se crea un worktree separado. Se conservan los bloqueos de sesiones sobre la carpeta afectada y los controles específicos de cierre y merge.
- Actualizados la ayuda CLI, la guía portable y el prompt compartido de los creadores.

Usar el paquete completo de siete artefactos y el procedimiento habitual de actualización. La recuperación de una solicitud previa es una acción explícita posterior: actualizar no la ejecuta automáticamente. El propietario cargado debe anunciar `pageCreationRecovery:1`.

Estado de validación y límites del candidato: [release-validation-1.7.29.md](docs/release-validation-1.7.29.md).

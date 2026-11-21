# AutoOC 1.7.29 — recuperación de Pages y carpetas retiradas

- Crear o vincular una Page vuelve a funcionar cuando otra Page archivada conserva la evidencia de un worktree eliminado (`removed`).
- Las carpetas duplicadas siguen rechazándose. Si falta la carpeta de una Page vigente, el diagnóstico identifica su Page y ruta antes de crear otro worktree.
- Nuevo comando `recover-page-request --vault ROOT --request-id ID`: verifica repositorio, rama, carpeta reservada y registro Git para registrar la misma Page tras un alta parcial. Conserva solicitud e historial; no crea otro worktree, no cambia de rama y no lanza tareas.
- Las sesiones de Main pueden permanecer abiertas mientras se crea un worktree separado. Se conservan los bloqueos de sesiones sobre la carpeta afectada y los controles específicos de cierre y merge.
- Actualizados la ayuda CLI, la guía portable y el prompt compartido de los creadores.

Usar el paquete completo de siete artefactos y el procedimiento habitual de actualización. La recuperación de una solicitud previa es una acción explícita posterior: actualizar no la ejecuta automáticamente. El propietario cargado debe anunciar `pageCreationRecovery:1`.

Estado de validación y límites del candidato: [release-validation-1.7.29.md](docs/release-validation-1.7.29.md).

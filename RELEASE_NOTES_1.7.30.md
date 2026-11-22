# AutoOC 1.7.30 — Workflows compartidos y gestión de Pages

Permite publicar colecciones versionadas de workflows y tareas desde un proyecto y actualizar sus copias vinculadas en otros proyectos mediante una carpeta local o de red.

- Settings → Library → Shared workflows, y comando «AutoOC: Shared workflows».
- Publicación explícita con dependencias completas, aviso de versión nueva y distribución a proyectos seleccionados.
- Vinculación explícita de definiciones existentes y actualización conservando IDs, historial y configuración local; sin reimportaciones duplicadas.
- Cambios locales protegidos por revisión/hash; sustitución explícita de la versión observada.
- Recepción mediante el propietario de cada plugin y su guardado habitual. Proyectos cerrados quedan pendientes; las ejecuciones afectadas aplazan el cambio.
- Nuevos permisos o motores requieren revisión local. Definiciones nuevas quedan desactivadas y con horario manual.
- Copias privadas antes de sustituir; publicaciones inmutables y recibos consultables.
- CLI `share-workflows`, capacidad `workflowSharing:1`, documentación y prompt real coherentes.
- Delete page permite retirar Pages archivadas con historial resuelto y worktree ya retirado, conservando registros y logs en **Deleted page history**. Las retiradas pendientes y ejecuciones inciertas siguen bloqueadas. Corrección posterior al primer piloto: paquete separado `release/page-delete-1.7.30/`.

Workflows compartidos es una primera versión. La primera vinculación entre dos proyectos locales está comprobada; la distribución por LAN real requiere prueba explícita. No incluye borrado de miembros, combinación automática de cambios ni un servicio ejecutándose con todos los proyectos cerrados. La carpeta se comparte mediante los permisos del sistema operativo: sus escritores deben ser de confianza.

Propuesta y recorrido de prueba: `Docs/workflow-sharing.md`. Evidencia del candidato: `docs/release-validation-1.7.30.md`.

También incluye los cambios preparados para 1.7.29:

- Recuperación de la misma Page tras una creación interrumpida, sin duplicar rama ni worktree; las carpetas retiradas dejan de impedir nuevas Pages.
- Gestión de Pages por CLI mediante `review-page` y `page-action`, con revisión/hash, confirmaciones explícitas y recibos consultables.
- Merge review mantiene el resultado y los controles durante sus consultas automáticas; los avisos de terminal se actualizan al confirmar el cierre.
- Enumeración incremental de archivos ignorados y detección de las rutas que realmente escribiría el merge, evitando desbordamientos y falsas colisiones.
- Las sesiones de Main pueden seguir abiertas durante operaciones sobre Pages independientes. Se conservan las guardas de sesiones y las opciones `--no-overwrite-ignore` y `--no-autostash` en merge.

Instala el ZIP completo de siete componentes con AutoOC desactivado y sin operaciones pendientes, conservando configuración, credenciales e historial. Después vuelve a activar el plugin.

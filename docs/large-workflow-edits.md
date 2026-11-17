# Edición de pasos grandes mediante la CLI

Candidato 1.7.27. La capacidad se comprueba en el paquete y en el propietario cargado; compartir número de versión no acredita que Obsidian haya cargado estos artefactos.

| Elemento | Máximo |
|---|---:|
| JSON serializado de changes (todos los pasos juntos) | 2.097.152 bytes UTF-8 (2 MiB) |
| Archivo JSON de patch, incluido formato/espacios | 3.145.728 bytes (3 MiB) |
| Mensaje completo de edición con metadatos | 2.113.536 bytes |

Los escapes JSON cuentan: caracteres multibyte y secuencias escapadas pueden ocupar más que su representación visual. Se rechazan excesos sin truncar ni dividir automáticamente la edición. Los límites de recibos y mensajes ajenos a edición no se amplían. La CLI anuncia workflowEditMaxChangesBytes; comprueba también la capacidad del propietario antes del envío. Un host antiguo conserva 58.000 bytes.

Se mantienen expectedHash, edición de pasos existentes, comprobaciones de inactividad y cola de guardado. No se modifican conexiones, permisos, modelos, IDs ni historial. Ante conflicto, volver a exportar y revisar; ante resultado incierto, inspeccionar el recibo antes de reintentar. No escribir data.json directamente.

## Actualización y comprobación

1. Confirmar la instalación autorizada y consultar version/help de su CLI mediante ruta absoluta. Terminar las ejecuciones y comprobar inactividad antes de actualizar. No eliminar reservas ni journals.
2. Respaldar la instalación y desactivar AutoOC. Extraer los siete artefactos del ZIP completo conservando data.json, secretos e historial/runtime. Mantener skills/autooc-runtime/SKILL.md en su subcarpeta.
3. Verificar los SHA-256 contra release-integrity.json y la versión 1.7.27 del manifiesto y de la CLI. Recargar AutoOC y comprobar la instancia cargada; no basta con sustituir archivos en disco.
4. Con el plugin activo, ejecutar export-workflow con --vault absoluto, --workflow ID y --out absoluto nuevo. Preparar un patch con expectedHash y changes, aplicar edit-workflow con --patch absoluto y reexportar para comparar contenido y hash. Usar un workflow de prueba autorizado antes de editar contenido real.
5. Si la CLI informa de un host antiguo, recargar el paquete compatible antes de enviar la edición. Sin propietario compatible activo, la edición sigue sin estar disponible: no se añade edición autónoma ni fallback de escritura directa.

Preparar este candidato no acredita publicación, instalación real ni GUI. La documentación de validación del requisito identifica las pruebas y sus limitaciones.

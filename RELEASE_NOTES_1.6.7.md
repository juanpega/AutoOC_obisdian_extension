# AutoOC 1.6.7 — rendimiento, edición en vivo y arranque

Corrige la regresión del ejecutor compartido que mostraba «no output yet…» mientras OpenCode trabajaba y no publicaba el texto hasta terminar. El Live Log vuelve a mostrar la respuesta y la traza durante la ejecución, tanto para tareas como para workflows iniciados desde Obsidian o desde la CLI.

La salida intermedia se lee aproximadamente cada medio segundo y el modal mantiene su refresco de un segundo. Se ocultan secretos antes de mostrarla. Cada actualización queda vinculada a su ejecución, tarea y paso; los callbacks tardíos o posteriores a una cancelación no se muestran como salida de otra tarea.

El streaming no guarda el catálogo completo ni el journal. El resultado final, el historial y el traspaso de resultados entre pasos conservan su persistencia habitual. La salida intermedia es temporal y no acredita que una tarea haya terminado.

Cinco regresiones cubren las cuatro rutas de inicio, el renderizado antes del fin del proceso, sucesivas actualizaciones, recarga de configuración, ausencia de escrituras durante el streaming, redacción y descarte de eventos tardíos. Las pruebas utilizan procesos y archivos reales en bóvedas temporales, con el lanzador de OpenCode sustituido por un emulador controlado; no equivalen a una prueba manual de Obsidian con el proveedor real.

La carga, validación, recuperación de historial y persistencia de catálogos grandes ceden periódicamente el hilo de interfaz. Los checkpoints reutilizan la versión confirmada del catálogo para reducir lecturas y conversiones redundantes. Se mantienen la validación, los hashes históricos, la escritura atómica y la detección de ediciones concurrentes. La mejora reduce bloqueos, aunque pueden persistir pausas con catálogos grandes; el objetivo estricto de 100 ms y algunas comprobaciones GUI siguen pendientes.

La CLI incorpora `export-workflow` y `edit-workflow` para editar nombre, descripción y texto/código de pasos existentes con Obsidian abierto. Los cambios pasan por el propietario vivo y su cola de guardado, requieren el hash esperado y se rechazan ante ejecución activa o conflicto. La primera entrega conserva la estructura del workflow, sus permisos, programación, resultados e historial; crear o eliminar pasos y editar tareas asociadas quedan fuera de estos comandos. La skill portable y los prompts incluyen este recorrido.

Si una ejecución externa ya tiene la reserva al cargar AutoOC, el panel muestra una espera y vuelve a cargar automáticamente después de observar su liberación normal estable. La espera se cancela al descargar el plugin y comparte exclusión con el botón de reintento. No elimina reservas existentes ni reanuda o repite tareas. Los propietarios muertos o no verificables conservan el procedimiento de recuperación explícita.

El paquete incluye los siete artefactos coherentes del plugin, CLI, runtime y skill, con descriptor de integridad y ZIP. La actualización integrada detectará 1.6.7 cuando el paquete llegue a la rama remota configurada. La instalación de esta revisión en Aulify y su validación visual de arranque automático siguen pendientes; los ensayos con fixtures no acreditan ese recorrido real. El cambio de Live Log se limita a OpenCode no interactivo en el ejecutor compartido; las sesiones de terminal externa conservan su comportamiento.

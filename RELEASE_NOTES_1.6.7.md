# AutoOC 1.6.7 — Live Log de OpenCode

Corrige la regresión del ejecutor compartido que mostraba «no output yet…» mientras OpenCode trabajaba y no publicaba el texto hasta terminar. El Live Log vuelve a mostrar la respuesta y la traza durante la ejecución, tanto para tareas como para workflows iniciados desde Obsidian o desde la CLI.

La salida intermedia se lee aproximadamente cada medio segundo y el modal mantiene su refresco de un segundo. Se ocultan secretos antes de mostrarla. Cada actualización queda vinculada a su ejecución, tarea y paso; los callbacks tardíos o posteriores a una cancelación no se muestran como salida de otra tarea.

El streaming no guarda el catálogo completo ni el journal. El resultado final, el historial y el traspaso de resultados entre pasos conservan su persistencia habitual. La salida intermedia es temporal y no acredita que una tarea haya terminado.

Cinco regresiones cubren las cuatro rutas de inicio, el renderizado antes del fin del proceso, sucesivas actualizaciones, recarga de configuración, ausencia de escrituras durante el streaming, redacción y descarte de eventos tardíos. Las pruebas utilizan procesos y archivos reales en bóvedas temporales, con el lanzador de OpenCode sustituido por un emulador controlado; no equivalen a una prueba manual de Obsidian con el proveedor real.

El alcance de esta corrección es OpenCode no interactivo en el ejecutor compartido. No cambia el comportamiento de las sesiones abiertas en una terminal externa ni publica una versión o actualiza otras bóvedas por sí misma.

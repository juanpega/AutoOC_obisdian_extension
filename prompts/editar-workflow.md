# Editar un workflow existente de AutoOC

Realiza la edición solicitada en la bóveda autorizada conservando identidad, historial y personalizaciones. Descubre su CLI instalada en `.obsidian/plugins/auto-oc/autooc-cli.cjs` y consulta `version` y `help`; lee la skill portable si está disponible.

Si anuncia `export-workflow` y `edit-workflow`, mantén Obsidian y AutoOC abiertos. Exporta únicamente el workflow seleccionado a un archivo JSON nuevo y privado. Prepara `expectedHash` y `changes` con los campos solicitados, aplica el patch y vuelve a exportar para comprobar el texto. Usa el hash devuelto para una edición posterior. Guardar una definición no autoriza ejecutarla.

Esta vía admite nombre/descripción del workflow y nombre/código/prompt de evaluación de pasos existentes. No modifica tareas asociadas, conexiones, permisos, programación ni estados. `code` exige un paso Code. Mantén `changes` por debajo de58.000 bytes UTF-8 y el patch como máximo en60.000 bytes. Divide ediciones mayores sin truncar contenido.

Ante conflicto, compara con una exportación nueva. Ante ejecución activa, espera manteniendo Obsidian abierto. Ante resultado incierto, inspecciona el recibo y la definición antes de reintentar; no repitas a ciegas. No escribas `data.json` directamente con el plugin cargado ni retires su reserva.

Si falta capacidad, explica el límite concreto y prepara la alternativa dentro del encargo. Si una actualización o edición de tareas autorizada exige mantenimiento, verifica respaldo y ausencia de ejecución y descarga únicamente AutoOC durante la escritura. No cierres toda la aplicación por defecto ni cambies otras bóvedas.

Resume el cambio comprobado, sus límites y el siguiente paso. Registra por separado tiempos CLI y latencia de edición; evita nuevas rondas de optimización cuando ya hay una mejora útil y el usuario ha priorizado una entrega acotada.

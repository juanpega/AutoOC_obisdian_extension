# AutoOC 1.6.6 — candidato local

- La CLI puede iniciar, reanudar y reconciliar tareas/workflows con AutoOC cargado. El plugin conserva la reserva, ejecuta el trabajo y muestra el progreso en el Dashboard.
- La CLI continúa funcionando de forma autónoma cuando no hay un plugin propietario. Una petición aceptada nunca se reintenta mediante otro ejecutor si su resultado es incierto.
- Peticiones vinculadas a la reserva, aceptación persistente antes de ejecutar, rechazo de concurrencia y cancelación cooperativa. La salida de progreso identifica Obsidian como anfitrión.
- El guardado de configuración evita conversiones JSON completas repetidas. Conserva la detección de cambios externos, rechazos de JSON inválido, reserva de escritura, reemplazo atómico y recuperación ante fallos.

En una copia aislada del catálogo local de 93 MB, el workflow de tres tareas y dos pausas de 15 s pasó de 106,2 s a 64,8 s con los métodos reales del plugin y sin dibujar el Dashboard. Es una mejora medida del 39%, no una garantía de duración para otras bóvedas. El coste de guardar el catálogo completo sigue presente.

La prueba real de 1.6.6 en Obsidian completó las tres tareas y dos pausas desde la CLI. El tramo comparable pasó de 112,1 s a 72,2 s (36% menos); el usuario confirmó progreso visible y mayor rapidez. La CLI completa tardó 81,5 s, incluyendo arranque y cierre.

Validación nativa completa en Windows mediante `npm test`: 483 pruebas aprobadas, cero fallos y dos pruebas exclusivas de POSIX omitidas. CScript aprobado. Los 97 archivos del candidato conservaron sus hashes durante la validación; después solo se actualizó esta nota. Compilación y paquete de siete artefactos verificados. No publicado ni desplegado a otras bóvedas.

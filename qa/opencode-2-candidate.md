# Candidato 1.7.2 — integración de OpenCode 2

Validación del 31/10/2026. Este documento registra un candidato de desarrollo;
no acredita publicación ni carga en Obsidian.

## Alcance

OpenCode 2 tiene una opción de CLI, ruta, modelo y agente independientes.
Las tareas existentes siguen usando su motor anterior. El candidato incorpora
también las mejoras de catálogo, borradores, selección de CLI y separación entre
panel e historial de ejecución desarrolladas en esta rama.

Se contrastaron los comandos con la documentación oficial de
[OpenCode 2](https://opencode.ai/v2/docs/cli/commands/) y la
[interfaz interactiva](https://opencode.ai/v2/docs/cli/tui/), conservando los
comandos de [OpenCode 1](https://opencode.ai/docs/cli/).
La ayuda del ejecutable nativo 2.0.21 acepta las formas de llamada generadas.
La configuración restrictiva para generar borradores fue aceptada; una prueba
con un modelo sintético inexistente falló como se esperaba. Esto no acredita
autenticación ni ejecución con un proveedor real.

## Comprobaciones

- `npm run build`: correcto, después de los últimos ajustes.
- `git diff --check`: correcto.
- Versiones de manifiesto, paquete y lockfile: 1.7.2.
- Integridad de los seis archivos descritos por `release-integrity.json`:
  verificada de nuevo antes de preparar los commits.
- Pruebas focales: 84 aprobadas, 2 omitidas por plataforma; otras 2 pruebas
  de las comprobaciones previas al lanzamiento también aprobadas.
- Suite general: 856 pruebas, 841 aprobadas, 11 fallidas, 1 cancelada y
  3 omitidas. Se ejecutó antes de los últimos ajustes puntuales del lanzador
  y editor; estos se compilaron y comprobaron después por separado.
- Repetición en serie de los 12 casos afectados: 6 aprobados y 6 fallidos.

## Incidencias pendientes

Quedan seis casos fallidos: recorrido del ZIP distribuido, dos casos de carga
de históricos, guardados en cola del Dashboard 1.6.1, empaquetado con manifiesto
CRLF y equivalencia del workflow ramificado entre plugin y CLI. Los fallos
observados corresponden a límites de tiempo o de respuesta del arnés.

El caso de carga completa de journals históricos también falla al repetirlo
con el candidato anterior a OpenCode 2. No se ha demostrado que los otros
cinco fallos sean anteriores al cambio. La suite general no está aprobada.

## Instalación local

El primer intento quedó bloqueado por una ventana en «Cargando bóveda…» con
un guardado abierto; el usuario detuvo entonces el control con Escape. Tras
cerrar Obsidian, autorizó expresamente reparar los restos e instalar.

La inspección confirmó la ausencia de los dos procesos implicados, la
integridad del catálogo y la coherencia de checkpoints. El guardado carecía de
fecha de inicio del proceso y había un temporal de conexión anterior, por lo
que la recuperación automática no era aplicable. Se creó una copia verificada,
se recuperó la reserva exacta mediante la CLI y se archivaron únicamente los
dos restos autorizados. No se promovieron temporales ni se reanudaron tareas.

El 31/10/2026 a las 19:00 UTC, `maintain-release --install` terminó correctamente
en `C:\Dev\AutoOC`. Se verificaron los siete archivos instalados frente al
candidato y su descriptor de integridad. La CLI instalada anuncia 1.7.2.
El catálogo y los 119 journals conservan sus hashes: 36 tareas y 42 workflows.
No quedan reserva de ejecución, bloqueo de guardado ni marcador de actualización
pendiente. Los respaldos y recibos se conservan dentro de la configuración
privada de esa bóveda.

Esta comprobación acredita instalación en disco, no carga en la GUI. Obsidian
permanece cerrado para que el usuario abra la bóveda y revise el candidato.
Los seis fallos generales de QA descritos arriba siguen pendientes.

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

El paquete instalado en `C:\Dev\AutoOC` anuncia 1.7.2, pero sus hashes no
corresponden a este candidato. La actualización solicitada no se ha realizado:
la ventana permanece en «Cargando bóveda…» y conserva una reserva y un guardado
de configuración pertenecientes a un proceso de Obsidian vivo. Se revisaron
119 ejecuciones históricas sin fases no terminales; esto no convierte el
guardado pendiente en recuperable.

El usuario detuvo el control de la ventana con Escape. No se sustituyeron
artefactos, no se alteró el catálogo y no se retiraron bloqueos. Para instalar
hay que conseguir primero la descarga normal del plugin y comprobar que
terminó el guardado; después, usar el mantenimiento oficial con copia y
verificación de integridad, y comprobar la carga real por separado.

# Terminales independientes de Obsidian

## Requisito · versión 3 · 08/11/2026

Estado: implementado e instalado en este proyecto para prueba; pendiente de habilitar/cargar el plugin, aceptación visual y cierre del requisito.

El usuario debe poder sacar una terminal integrada de AutoOC a una ventana externa mediante un botón, para poder reiniciar Obsidian o el propio plugin sin interrumpir el trabajo de esa sesión.

### Comportamiento esperado

- La terminal activa dispone de un botón «Sacar de Obsidian», con nombre accesible y explicación de su efecto.
- La ventana externa conserva la misma ejecución, su directorio y su conversación. No vuelve a lanzar el prompt ni crea otra ejecución del agente.
- Tras confirmar la apertura externa, reiniciar Obsidian o desactivar/reiniciar AutoOC no detiene esa sesión.
- Si falla la apertura o no se confirma, la sesión sigue accesible y no se cierra ni se repite automáticamente el lanzamiento.
- Cerrar una vista no equivale a detener el proceso. La acción de detener debe distinguirse explícitamente de ocultar o desconectar.
- No presentar una ventana flotante de Obsidian como una terminal independiente de Obsidian.
- En esta iteración, la ventana externa es una pestaña del navegador con un cliente de terminal local. No es Windows Terminal ni otra ventana Electron de Obsidian.
- Al confirmar la conexión externa, la entrada pasa al navegador. La vista integrada puede seguir mostrando la salida mientras el plugin permanezca cargado.
- La barra de la terminal integrada incluye un botón **↻** para recalcular el tamaño y repintar la terminal activa cuando se visualice mal. Refresca los recursos gráficos y las filas visibles sin reiniciar el PTY o el agente, borrar el buffer/historial ni reenviar el prompt o pulsaciones como Ctrl+L. No se habilita cuando no hay sesión activa.
- El repintado manual pendiente se conserva si coincide con eventos de tamaño/tema; si el panel está oculto, se aplica cuando vuelva a tener dimensiones utilizables. No se presenta este control como una corrección demostrada de la causa del fallo visual intermitente, aún no reproducido en Obsidian.

### Restricción técnica identificada

La arquitectura anterior creaba el PTY desde el plugin y `dispose()` llamaba a `stopAll()`. Mover la vista o abrir otra consola no transfería ese PTY. La implementación añade un host Node independiente por nueva sesión, reutilizando el bundle distribuido `autooc-runtime.cjs`; la vista integrada y el cliente externo se conectan al mismo PTY. El host conserva el prompt hasta la salida nativa confirmada y su limpieza. Solo una sesión cuya conexión externa se haya confirmado queda excluida de la parada por descarga del plugin.

Se requiere Node.js 18+ en PATH y el soporte PTY opt-in existente, actualmente Windows x64. No se descarga software ni se instalan nuevos permisos al abrir o sacar una terminal. El cliente web y sus recursos xterm se incluyen en el bundle, sin CDN ni nuevos artefactos de distribución. La conexión usa un puerto efímero en `127.0.0.1`, token aleatorio por sesión, comprobación de origen/Host y sin CORS.

No se promete transferir automáticamente PTY ya iniciados con la arquitectura anterior. La implementación debe indicar con claridad esa limitación y nunca sustituir la sesión en marcha por una nueva a escondidas.

### Impacto a considerar en la implementación

- Creación y propiedad de PTY, entrada/salida, resize y reconexión.
- Cierre de vistas, descarga del plugin y reinicio de Obsidian.
- Lanzamientos interactivos de tareas, conservación de prompts auxiliares y prevención de duplicados.
- Canal local de conexión autenticado, sin exposición de terminales a la red ni ampliación implícita de permisos.
- Distribución del cliente/host externo y capacidades realmente disponibles en la instalación.
- Revisar la guía y el prompt compartido de creadores si cambian campos o capacidades configurables; no añadir instrucciones sobre capacidades todavía inexistentes.

### Validación acordada

Iteración con validación visual del usuario. El requisito no se considera agotado ni aceptado por las comprobaciones técnicas. Verificar en la aceptación continuidad de la misma ejecución al reiniciar el plugin y Obsidian, fallo de apertura externa, cierre/desconexión y ausencia de duplicación de prompts. La evidencia técnica y sus limitaciones se recogen en `seguimiento.md`; los dobles Node no acreditan GUI ni proveedor real.

### Decisiones pendientes

- Rama creada con autorización del usuario: `feat/detachable-terminals`, a partir de `feat/terminal-integration`. El usuario autoriza después commit local e instalación en este proyecto para probarlo. Código en `25600f3`; instalación completada tras su confirmación de disponibilidad y comprobar ausencia de reserva. Se preservan los cambios locales previos; no se autoriza push ni publicación. Ver `seguimiento.md`.
- Volver a integrar una terminal externa no forma parte todavía del alcance solicitado.
- Las vistas pueden recuperar hasta aproximadamente 1 Mi de caracteres de salida reciente; se informa del truncado si la conexión perdió salida anterior. No hay persistencia de todo el scrollback en disco.
- Cerrar el navegador no detiene el proceso: conservar la pestaña o su URL privada para reconectar. Tras finalizar el proceso, el host deja 30 segundos para consultar su salida final y termina.

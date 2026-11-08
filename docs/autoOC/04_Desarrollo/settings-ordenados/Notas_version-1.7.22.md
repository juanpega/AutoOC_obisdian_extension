# AutoOC 1.7.22 · Terminales independientes y Settings ordenados

## Terminales

- El botón **↗** conecta una sesión integrada nueva a una terminal local en el navegador. Es el mismo proceso y prompt, no otro agente. Tras la confirmación, se puede descargar AutoOC o reiniciar Obsidian sin detener esa sesión.
- El cliente externo no es Windows Terminal ni PowerShell en una consola nativa. La conexión usa un puerto local y una credencial privada por sesión; no compartir su URL.
- **↻** recalcula el tamaño y repinta la terminal integrada sin reiniciarla ni limpiar la conversación. Se corrige el margen que podía hacer que xterm dibujara filas fuera del panel.
- El soporte integrado mantiene Windows x64 y su instalación opt-in; el host independiente requiere Node.js 18+ en PATH. Las sesiones iniciadas con builds anteriores no se migran en caliente.

## Settings

- Nueva organización: **General**, **Harnesses**, **Terminals**, **Execution**, **Logs**, **Library** y **Maintenance**, con navegación y bloques plegables.
- Cada harness reúne sus rutas y opciones compatibles. **Check version** se ofrece para OpenCode 1/2, Codex, Copilot y Claude, sin atribuirle comprobación de autenticación.
- OpenCode 2 muestra catálogos visibles y refrescables de sus propios modelos y agentes por proyecto. Se conserva la entrada manual y no se mezclan con OpenCode 1.
- La URL de biblioteca puede editarse sin reconstruir Settings a cada pulsación.
- Se retira expresamente el ajuste de tamaño de burbujas: tareas y pasos quedan en **30 px**, sin cambiar las letras. Los valores antiguos se conservan pero no se aplican. Los workflows mantienen su doble anillo de 36 px.
- Se conservan el resto de opciones, la configuración, las definiciones, el historial y los permisos. Ralph Loop sigue siendo una integración específica de OpenCode 1; Claude continúa siendo una CLI interactiva, no un motor nuevo de tareas de fondo.

## Límites de esta entrega

Validación técnica del candidato: build e integridad correctos, suite completa con **1.302 aprobadas, 0 fallos y 3 omitidas**, ZIP de siete artefactos verificado tras extraerlo y workflow sintético de tres pasos con 64 KB de contexto, continuación sin repetir efectos y reserva liberada.

Las pruebas automatizadas y los fixtures de navegador no acreditan autenticación real ni todos los recorridos visuales de Obsidian. La continuidad nativa tras reiniciar Obsidian y la última iteración de Settings/burbujas requieren aceptación visual. El push de una rama no publica una actualización: merge, tag, GitHub Release e instalación en otras bóvedas son operaciones separadas.

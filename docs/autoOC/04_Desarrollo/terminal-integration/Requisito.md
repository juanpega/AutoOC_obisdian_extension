# Requisito: terminal CLI integrada

## Version 5 - 2026-11-07

Estado: implementado; preparacion local de PR 1.7.21, pendiente de validacion visual del usuario.
Rama: `feat/terminal-integration`.

Correccion del usuario: toda la informacion de este desarrollo se mantiene en
`04_Desarrollo/terminal-integration/`, no en una carpeta de requisitos.

## Peticion y alcance acordado

Al abrir un CLI desde AutoOC, elegir harness y carpeta. El destino, integrado en
Obsidian o ventana externa, se configura y guarda en Settings de AutoOC, no en el
dialogo de lanzamiento. Implementar una vista principal Terminales AutoOC,
con pestañas de sesiones independientes, inspirada funcionalmente en Code Space.
No requiere instalar Code Space ni usar sus interfaces internas.

- Conservar los harness y la seleccion de carpetas actuales.
- Centralizar en Settings > Interactive CLI launchers el destino de las nuevas
  sesiones, la instalacion explicita del soporte nativo y el acceso a terminales
  existentes. El lanzador solo informa del destino configurado, sin desplegables
  de destino ni bloques de instalacion. El boton Configure CLIs permite cambiarlo.
- Conservar el destino externo cuando no haya preferencia guardada. Guardar la
  eleccion con el escritor habitual y restaurar la preferencia anterior si falla.
  Un cambio no mueve ni reinicia sesiones existentes. Tambien se aplica a las tareas
  CLI interactivas de todos los harness, manuales o programadas y dentro de workflows.
- Cada lanzamiento integrado crea una sesion y enfoca su pestaña.
- Cambiar de sesion conserva proceso, terminal y salida.
- El boton de nueva sesion abre el lanzador habitual.
- Cerrar una sesion activa requiere confirmacion; una finalizada conserva su salida.
- Cerrar la vista oculta las sesiones: se recuperan con el comando de terminales.
- Descargar AutoOC o cerrar Obsidian termina sus terminales integradas. No restaurar
  ni relanzar procesos al arrancar, ni simular persistencia entre reinicios.
- Mantener la ventana externa disponible, sin fallback automatico que pueda duplicar
  sesiones. No cambiar las tareas de segundo plano ni los permisos de workflows.
- Autenticacion y aprobaciones pertenecen al CLI. No inyectar secretos AutoOC.
- Ejecutar con los permisos del usuario; la terminal no es un sandbox.

## Tareas CLI interactivas

Por correccion expresa del usuario, no limitar el alcance a OpenCode. Tras aclarar
la diferencia de contratos, el usuario eligio "Interactivas de todos los CLI":
añadir modos interactivos de Codex CLI, Copilot CLI y Claude Code CLI, ademas de
OpenCode 1/2, sin cambiar el segundo plano ni la aplicacion Codex.

El editor ofrece `CLI task (interactive)` y selector Harness con los cinco CLI. La
definicion nueva usa `taskKind:"cli"`, `cliProvider` conocido e
`interactiveTerminal:true`. Los tipos OpenCode interactivos anteriores se conservan.
Todas estas tareas respetan CLI terminal destination, incluidas las tareas
programadas, las invocadas desde workflows anidados y las peticiones CLI delegadas
al plugin. El modelo, agente, forceModel, prompt, carpeta y handoff provienen de la
tarea, no del lanzador manual. Los filtros del menu manual no desactivan tareas.
En el nuevo tipo CLI, modelo vacio utiliza el default nativo; agente solo OpenCode
y reasoning solo Codex. No activar permisos Code, herramientas automaticas Copilot,
Ralph Loop ni cambios Git en una tarea generica. No añadir flags de autoaprobacion.

Se conserva el contrato de lanzamiento interactivo: completar el paso confirma la
apertura, no el resultado humano; el workflow puede continuar tras esa confirmacion.
El prompt UTF-8 completo reside en un auxiliar propio hasta salida/parada confirmada;
solo una instruccion corta pasa por argv. No se amplian permisos del proveedor.

El runtime autonomo sin plugin rechaza el modo integrado antes del journal o de
cualquier paso, si el workflow contiene una tarea CLI interactiva. No sustituye
el destino por ventana externa. El destino es una preferencia de host, fuera del
hash historico de las definiciones y fuera del JSON exportado de tareas/workflows.

Las aperturas de tareas esperan su turno; cancelacion y descarga invalidan las
pendientes sin lanzar procesos tardios. Un fallo con efectos inciertos conserva la
evidencia y bloquea la repeticion y continuacion mediante la recuperacion existente.

El tipo ChatGPT/Codex anterior sigue abriendo su aplicacion. Copilot en segundo
plano y Code mantienen su ejecucion anterior. Copilot CLI interactivo es ahora una
tarea generica con su proveedor, no una reinterpretacion de tareas existentes.

## Implementacion tecnica

Interfaz propia con xterm.js y PTY real node-pty MIT. El codigo Code Space consultado
es AGPL-3.0 y no se copia. Referencia: https://github.com/UNLINEARITY/Obsidian-CodeSpace
(implementacion terminal de main consultada el 2026-11-07).

Primera entrega integrada: Windows x64, Windows build >=18309 y Node-API >=8.
Otras plataformas conservan el lanzamiento externo. El soporte nativo se obtiene
mediante accion explicita desde npm oficial, fijado a node-pty 1.1.0 y SHA-512;
sin scripts npm, compilacion nativa ni descargas silenciosas al arrancar/lanzar.
Los archivos nativos se conservan bajo `terminal-support/` de la instalacion.

El usuario autoriza instalar este candidato en el Obsidian de esta misma boveda,
solo despues de comprobar inactividad y guardados pendientes, conservando catalogo,
historial, journals y trabajo ajeno. No autoriza publicacion ni otras bovedas.

## Criterios de aceptacion

1. Settings permite guardar Integrado en Obsidian o Ventana externa. El lanzador
   permite elegir harness y carpeta y muestra un resumen del destino guardado.
2. Un CLI integrado recibe entrada interactiva, colores y tamaño actualizado.
3. Varias sesiones tienen pestañas, estado y carpeta identificables, sin reinicios
   al alternar ni al ocultar y reabrir la vista.
4. Se puede añadir una sesion y confirmar el cierre de una activa.
5. Salidas y errores son visibles; no hay reintentos o fallback automaticos.
6. Settings ofrece instalacion explicita del soporte y comunica plataforma y origen;
   abrir Settings o el lanzador no descarga nada por si solo.
7. La ruta externa actual sigue funcionando.
8. La descarga del plugin libera las terminales propias sin afectar procesos ajenos.
9. Tareas CLI interactivas de todos los harness usan el destino global sin perder prompt/modelo/agente
   ni handoff, tambien en workflows; la CLI autonoma rechaza el integrado sin host
   antes de efectos y los errores inciertos no permiten relanzamiento automatico.
10. Command no presenta como ejecutable un comando OpenCode para otra CLI. En tareas
    CLI genericas se deshabilita su copia con explicacion del lanzador y prompt privado.

## Validacion

Por decision del usuario, pruebas y validaciones tecnicas al final de la
implementacion; iteracion guiada por su validacion visual. No dar por aprobadas
pruebas diferidas ni atribuir pruebas offline a integracion GUI/proveedor real.
Revisar regresiones pertinentes, suite npm y build antes de la entrega instalada.
La guia compartida explica el destino global y el contrato de apertura de tareas
interactivas. Los creadores siguen generando `interactiveTerminal:false`; no generan
`taskKind:cli`, `cliProvider` ni `cliTerminalDestination`. El editor manual y la
importacion directa admiten el tipo nuevo. Comprobar los prompts finales reales
y ejemplos JSON con los validadores reales, sin cambiar el esquema de exportacion.

## Seguimiento y evidencias

El estado detallado, las revisiones y la evidencia de instalaciones se conservan
localmente en el expediente; no se incluyen sus datos privados en esta entrega.
Las notas publicas estan en [Notas_version-1.7.21.md](Notas_version-1.7.21.md).

Para el candidato 1.7.21 se comprobaron build, suite completa (1284 aprobadas,
3 omisiones y 0 fallos), inventario de siete artefactos y hashes del ZIP. Un
workflow de 64 KB desde su extraccion se completo y reanudo sin repetir efectos.
Estas pruebas no acreditan GUI Obsidian, autenticacion real, CI externa ni rollout.

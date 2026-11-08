# Seguimiento · terminales independientes

## Implementación · 08/11/2026

- Rama: `feat/detachable-terminals`, creada por petición expresa. Se mantienen sin incorporar los cambios previos de `.gitignore`, biblioteca, pruebas SDLC y archivos locales ajenos.
- `terminal-session-host.ts`: propietario del PTY en un proceso Node separado; cliente web local, control autenticado, salida reciente acotada y limpieza del prompt al finalizar.
- `terminal-session.ts`: arranque por IPC, conexión local, entrada ordenada sin reintentos automáticos y confirmación de la conexión externa antes de liberar la sesión de la vida del plugin.
- `integrated-terminal.ts`: botón ↗ por sesión, estado de conexión, conservación de sesiones liberadas durante `stopAll`/`dispose` y parada explícita confirmada disponible.
- `terminal-pty.ts`: preflight offline separado de la carga nativa, preservando validaciones y soporte opt-in.
- El host se incorpora al runtime existente mediante una entrada privada; no se añaden artefactos al paquete de siete componentes. El build incorpora JS/CSS de xterm y sus licencias.
- Revisión del prompt real `AUTOOC_WORKFLOW_PROMPT` en `main.ts`, especialmente las reglas de `interactiveTerminal` y destino de terminal: el lanzamiento integrado sigue necesitando plugin cargado, y solo confirma apertura, no resultado humano. No cambian campos, permisos, ejemplos JSON ni capacidades de los creadores; no se modifica el prompt ni se afirma haber revalidado todos sus ejemplos en este requisito.

## Evidencia técnica preliminar

- `npm run build`: correcto tras la primera implementación y repetido correctamente tras los ajustes de revisión y el botón ↻. Generó bundles e integridad. No equivale a instalación ni carga visual del candidato.
- Pruebas focales `integrated-terminal`, `terminal-session-host` y `terminal-pty-lifecycle`: **120/120**, sin fallos ni omisiones, tras la primera implementación. Incluyen host HTTP real local con PTY simulado, rechazo de origen/credencial incorrectos, cancelación, continuidad del mismo PTY, parada explícita y descarga sin matar una sesión liberada.
- `npm test`: terminó con **296/296** en pretest, **848 aprobadas y 3 omitidas** en la suite principal, y **149/149** en lifecycle separado. Sin fallos. Se inició antes de los últimos ajustes del cliente y del botón ↻; no se atribuye a ese recorrido cobertura de los cambios posteriores.
- Regresión final `npm run test:terminals`: **338/338**, sin fallos ni omisiones, incluyendo el cliente independiente y el botón ↻. Log privado: `C:/Users/gilro/AppData/Local/Temp/opencode/detachable-terminals-focused.log`. Suite completa previa: `detachable-terminals-npm-test.log` en la misma carpeta.
- Revisión: corregidos la propiedad de limpieza del prompt, el orden de entrada, la decodificación UTF-8 de peticiones y la consulta de rutas de recursos sin herencia de prototipo.

## No acreditado / pendiente

- Instalación en la bóveda y prueba visual en Obsidian con el navegador externo.
- Continuidad real del proceso nativo y del proveedor al reiniciar Obsidian/AutoOC; las pruebas con dobles no la acreditan.
- Aceptación humana, cierre del requisito, commit y publicación.
- No se migran sesiones iniciadas con el plugin anterior ni se reintegran automáticamente al reabrir AutoOC.
- No se han consultado ni modificado catálogos, reservas, journals ni secretos de la instalación.

## Iteración visual · botón de repintado

Petición posterior del usuario: añadir un control tipo reload porque la terminal integrada a veces no se dibuja bien en su panel. Se añade **↻** junto a **+**, con nombre accesible y tooltip que distingue repintar de reiniciar. Usa las API públicas de xterm `clearTextureAtlas()` y `refresh()` tras ajustar el tamaño; conserva la instancia, el buffer y el proceso. No envía Ctrl+L ni otra entrada al agente. Se preserva el repintado pedido aunque se agrupen eventos de tamaño/tema o el panel aún esté oculto.

Añadidas regresiones para terminal activa frente a la de fondo, conservación de conversación/proceso, panel oculto, eventos agrupados, estado vacío y salida ya finalizada. Aprobadas dentro de las 338 regresiones finales de terminales. El fallo visual intermitente no se ha reproducido en Obsidian; este botón es una recuperación manual de la vista, no una afirmación de haber corregido su causa.

Compilación final y revisión de whitespace del cambio correctas. No se ha instalado el candidato ni reiniciado la instalación real.

## Autorización de commit e instalación local

El usuario solicita commit e instalación en este mismo proyecto para probarlo. Se seleccionan exclusivamente las fuentes, documentación, pruebas y artefactos de este requisito; no se incluyen los cinco archivos ajenos modificados antes del encargo ni temporales locales.

Instalación seleccionada: `C:/Dev/AutoOC_obisidian_extension/.obsidian/plugins/auto-oc`. Su CLI anuncia 1.7.21 y `maintain-release`. `status` muestra una reserva cuyo PID **2740** pertenece a un renderer Obsidian vivo. La inspección oficial desde el candidato rechaza con `Unload AutoOC normally; execution reservation is present`. La CLI de Obsidian instalada no está habilitada; no se modifica su configuración ni se mata el proceso.

**Instalación bloqueada y no ejecutada**: es necesario descargar AutoOC normalmente desde Obsidian antes de instalar. Las terminales iniciadas con el plugin anterior se detienen al descargarlo; la sesión que aloje esta conversación tampoco se puede migrar por este cambio aún no instalado. No se borra ni recupera la reserva viva, no se sustituye el paquete a escondidas ni se modifican catálogo, journals o secretos. El requisito permanece pendiente de prueba visual y aceptación.

## Instalación local completada tras liberar el plugin

El usuario confirma «Ya se puede». La consulta oficial muestra `executionLockPresent:false`; la inspección de mantenimiento y la integridad del candidato son correctas. Se ejecuta `maintain-release --install` desde el candidato del proyecto hacia su propia instalación Obsidian, sin decisiones de disposición (`applied:[]`). Se instalan los siete artefactos del candidato de código **25600f3**, versión 1.7.21.

Verificación posterior: integridad instalada válida, siete archivos idénticos al candidato y `data.json` idéntico byte a byte al respaldo previo. La CLI instalada confirma versión y capacidades. No se ejecutan tareas, no se recuperan reservas ni se modifican históricos. Respaldo oficial en `runtime/maintenance-backup-6c0dcde7-1c0d-4eeb-b91a-230672bdc14e` bajo la instalación; recibo privado en `C:/Users/gilro/AppData/Local/Temp/opencode/detachable-terminals-install-result.json`.

El recibo informa `loadedInObsidian:false` y `reloadRequired:true`. **Instalado no equivale a cargado ni aceptado**: falta habilitar AutoOC en Obsidian y probar visualmente ↻ y, en una sesión nueva, ↗. No se reinicia Obsidian ni se presenta como verificada la continuidad nativa tras su reinicio. Los cinco archivos ajenos modificados permanecen fuera del commit y sin alteraciones.

## Revisión posterior · recorte al repintar dentro de Obsidian

El usuario comunica que ↻ no funciona adecuadamente dentro de Obsidian. Se reproduce un defecto de geometría en Chromium con xterm 5.5.0, FitAddon 0.10.0 y los estilos reales del proyecto, sin agente ni datos de la bóveda. Con `box-sizing:border-box`, `.auto-oc-terminal-screen` tenía 8 px de padding que FitAddon no descontaba: mide esa caja padre y solo descuenta el padding del propio elemento xterm. Por ello cabían más filas calculadas que visibles; limpiar el atlas y refrescar repetía el defecto.

Matriz de cinco anchuras (320, 400, 640, 655, 800 px) y cinco alturas (240, 320, 360, 370, 480 px): **20/25** tenían recorte inferior antes. Por ejemplo, panel de 640×320, límite inferior en y=320 y pantalla xterm hasta y=328. Al mover el padding a `.auto-oc-terminal-host`, fuera de la caja de sesión que mide FitAddon, la misma matriz queda en **0/25** recortes. Se conserva el espacio visual de 8 px; no se reinicia ni se envía entrada al proceso.

Añadida regresión estructural de CSS al archivo de pruebas de terminal integrada. La reproducción con navegador real acredita este fallo de geometría, no todos los posibles fallos visuales del usuario ni GUI Obsidian. No se cambia esquema, prompt de creadores, permisos ni transporte. Pendiente comprobar el candidato corregido en la instalación real; esta revisión no autoriza descargar el plugin o detener sesiones por inferencia.

Comprobaciones del candidato corregido: build correcto; **339/339** regresiones de terminales, sin omisiones; matriz de 25 tamaños sin recortes tras recargar en Chromium los estilos corregidos desde disco; `git diff --check` correcto. Log focal privado: `C:/Users/gilro/AppData/Local/Temp/opencode/terminal-redraw-sizing-focused.log`. Suite completa lanzada aparte, pendiente de resultado en `terminal-redraw-sizing-npm-test.log` en la misma carpeta. La sonda sintética HTTP se cerró al terminar. No se ha hecho commit ni instalación de esta corrección.

La suite completa del candidato corregido termina después sin fallos: **303/303** en pretest, **848 aprobadas y 3 omitidas** en la suite principal, **149/149** en lifecycle separado. El usuario autoriza instalar la corrección, pero la comprobación posterior encuentra AutoOC activo con reserva del renderer Obsidian PID 2740; no se modifica la instalación y se solicita descargar el plugin normalmente, conservando antes las sesiones necesarias mediante ↗. Pendiente de esa liberación y de aceptación visual en Obsidian.

Tras la confirmación posterior «ya está liberado», la CLI instalada confirma ausencia de reserva. Inspección oficial e integridad del candidato correctas. Se instala la corrección mediante `maintain-release --install`, sin decisiones de disposición, y se verifican los siete artefactos idénticos al candidato, integridad válida y catálogo idéntico byte a byte a su respaldo. Respaldo: `runtime/maintenance-backup-d17b93af-49c1-4da4-aece-a698b79494b2` bajo la instalación local. Recibo privado: `C:/Users/gilro/AppData/Local/Temp/opencode/terminal-redraw-sizing-install-result.json`. No se ejecutan tareas ni se alteran históricos. El recibo mantiene `loadedInObsidian:false` y `reloadRequired:true`: pendiente habilitar AutoOC y probar el repintado en Obsidian. Esta corrección sigue sin commit; no se interpreta la autorización de instalar como autorización de un commit adicional.

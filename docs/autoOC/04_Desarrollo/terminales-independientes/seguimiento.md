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

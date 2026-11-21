# Preparación de AutoOC 1.7.28 — 21/11/2026

## Estado

Candidato construido, empaquetado y comprobado por fases: **1.507 pruebas aprobadas y 22 omitidas**. La aceptación de publicación sigue pendiente de las comprobaciones nativas/GUI y CI indicadas abajo. No se ha publicado, creado un PR ni instalado en Inncrea. El commit no se puede ejecutar en esta sesión porque `.git` está protegido en modo lectura.

Base remota comprobada: `main` en `cac90042572527365787e769a54b7d8a6e8acd48`, versión 1.7.27. El PR #65 ya está fusionado. La selección nueva parte de ese árbol, conserva sus cambios y excluye la configuración local y documentación ajena al cierre de Pages y al mantenimiento del runtime. El staging original permanece intacto.

## Correcciones de esta revisión

- Empaquetado ZIP con Node: elimina la dependencia de `Microsoft.PowerShell.Archive`, conservando exactamente los siete artefactos verificados. Extracción independiente con .NET en Windows y `unzip` en los otros sistemas.
- Las pruebas de CLI distinguen eventos JSON de avisos del runtime en stderr, sin aceptar JSON malformado ni perder las comprobaciones de identidad. Las consultas hijas tienen watchdog para que un proceso bloqueado no retenga indefinidamente la batería.
- El arnés de SettingsWriter compila su grafo de dependencias real. Las pruebas del diálogo histórico crean una instancia inicializada del plugin.
- Los simuladores Windows de OpenCode usan el formato de shim npm, manteniendo las pruebas de argumentos, Unicode, directorio y rechazo por versión.
- Las pruebas de cancelación y refresco no confirmado exigen `in_flight` sin resultado observado, identidad conservada y bloqueo de repetición, de acuerdo con el contrato del candidato.
- Las pruebas 8.3 utilizan nombres cortos reales y aceptan metacaracteres en el directorio pasado como `cwd`, que no se interpola en el comando.
- La prueba de cancelación entre Pages controla sus dos temporizadores de espera y espera la finalización del host antes de comprobar las reservas retenidas. El temporizador real de tres segundos podía terminar durante el arranque de la segunda CLI y hacer que Stop llegara entre pasos. Se mantienen reales CLI, plugin y recibos, y se verifican cancelación durante el paso, bloqueo de continuación ajena y ausencia de repetición de efectos.

Las restricciones del producto para enlaces, reservas y resultados inciertos se mantienen. La variable local `AUTOOC_ALLOW_UNAVAILABLE_NATIVE_TESTS=1` permite registrar explícitamente comprobaciones nativas no disponibles; nunca autoriza omitirlas en CI ni acredita la publicación.

## Evidencia del paquete

- ZIP: `release/ready-1.7.28-20261121/auto-oc-1.7.28.zip`.
- SHA-256: `53a36d6463a9843c8ba2a76fc8c2657193b58e5a01d7408d579ae016b0028765`.
- Siete entradas verificadas contra `release-integrity.json`; versiones alineadas en manifest, package, lock y CLI.
- Workflow completo desde una instalación sintética del ZIP: `c2c16b13-bc07-4816-9caf-9226293f3039`, dos pasos completados, salidas `first` y `complete`, efectos `AB` exactamente una vez. Resume conserva identidad y no repite efectos.
- El build de la selección aislada sobre main reproduce byte a byte los tres bundles y el descriptor del paquete.

El recibo está en `release/ready-1.7.28-20261121/package-validation.json`. Las evidencias anteriores y los ZIP históricos se conservan.

## Resultados

| Comprobación | Resultado |
| --- | --- |
| `npm run build` | Aprobado. |
| Build de selección sobre main | Aprobado; bundles y descriptor idénticos. |
| Pretest de terminales | 317 aprobadas, 0 fallidas, 1 omitida. |
| Suite general | 927 aprobadas, 0 fallidas, 19 omitidas. |
| CLI aislada | 16/16 aprobadas. |
| Cancelación CLI entre alias 8.3 | 7/7 aprobadas. |
| Pages y worktrees: cinco archivos restantes | 108 aprobadas, 0 fallidas, 2 omitidas. |
| CLI Pages: archivo completo tras la corrección | 6 aprobadas, 0 fallidas, 0 omitidas. |
| Lifecycle aislado | 149 aprobadas, 0 fallidas, 0 omitidas. |
| Paquete extraído | Integridad, workflow completo y resume aprobados. |

En la suite general, 16 omisiones corresponden a restricciones nativas de este entorno (15 de enlaces de directorio y una de CScript); las otras tres requieren otra plataforma o el binario oficial opcional OpenCode 2. El pretest omite la comprobación nativa de macOS. Pages omite un enlace de directorio y un hook Git cuyo shell MSYS no puede arrancar en este entorno. No se han debilitado las verificaciones del producto.

La validación se cerró por fases, no mediante un único `npm test` con exit 0: el último recorrido integral aprobó pretest y suite general, y se detuvo en el lector stderr de Pages. Tras corregirlo, `pages-final.log` contiene los cinco archivos restantes aprobados y el fallo de temporización de CLI Pages; este último archivo se repitió entero y pasa en `cli-pages-confirmed.log`. Lifecycle se ejecutó después, sin otras suites activas, con exit 0 en `lifecycle-isolated.exit`. Los totales excluyen repeticiones focales.

Se conserva también la primera batería ampliada: 228 aprobadas, 32 fallidas y 13 omitidas. Cuatro fallos de cancelación y su padre se corrigieron después; los demás incluyeron denegaciones `EPERM` al crear procesos. La primera ejecución completa quedó sin progreso después del caso 33 y se interrumpió conservando el registro; no se cuenta como aprobada. La CLI aislada posterior pasa 16/16 y el recorrido de cancelación 8.3 pasa 7/7.

## Antes de publicar

1. Validar la selección en una terminal Windows nativa con `npm test` sin la variable de omisiones. Revisar CI en Windows, macOS y Linux; resolver las omisiones nativas de enlaces, CScript y hooks.
2. Comprobar en Obsidian el cierre de Page con helper de Principal abierto, cierre de la sesión bloqueante desde el diálogo, actualización de botones y eliminación de un worktree limpio ya integrado y archivado. No repetir el merge ni confirmar configuración local para demostrar integración.
3. Revisar y commitear la selección sobre main; después tramitar PR, merge y release con el paquete completo. La instalación y la publicación son pasos pendientes.

`prepare-review.ps1` trabaja directamente en `C:\Dev\AutoOC_obisidian_extension`, en la rama de desarrollo existente. Sin argumentos solo comprueba la selección. Con `-Commit` compila, verifica los archivos revisados, ejecuta la suite nativa y empaqueta antes de confirmar los cambios. Conserva los archivos locales ajenos; si hay staging ajeno a la selección, se detiene sin incluirlo. No crea otras carpetas de desarrollo, worktrees, instalaciones ni publicaciones.

La preparación inicial falló por la diferencia `Docs`/`docs`: la validación del parche sobre archivos Windows no comprobaba las rutas exactas del índice Git. Se retira ese procedimiento. La preparación actual conserva explícitamente las rutas Git y verifica el árbol completo contra main más la selección revisada. Incluye 18 archivos ya incorporados a main que la rama local antigua todavía no tenía confirmados, además de los 60 archivos de la selección; estos 18 deben coincidir exactamente con main.

Después del commit local integra la base main comprobada mediante un merge normal. Solo resuelve conflictos de la selección usando los bytes revisados y vuelve a comprobar el árbol completo antes de confirmar el merge. Si main cambia, se detiene. El worktree adicional `C:\Dev\AutoOC_release_1.7.28` solo se retira si sigue registrado en la rama/base esperadas y carece de cambios, archivos nuevos o ignorados. No se fuerza su eliminación.

La preparación corregida supera siete pruebas con Git real: revisión sin escritura, commit/merge con rutas de distinta capitalización y reejecución sin duplicar commits, conservación de cambios locales y staging ajeno, protección de archivos propios del worktree adicional, detección de archivos revisados modificados, conservación del contenido exclusivo de main y rechazo de una base remota cambiada. La comprobación de solo lectura sobre la carpeta real también pasa. Estas pruebas no sustituyen la aceptación nativa/GUI/CI del producto.

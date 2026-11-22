# Validación del candidato 1.7.29

## Actualización del 22/11/2026: CLI, interfaz y merge

El candidato incorpora gestión de Pages mediante `review-page`/`page-action`, estabilidad de Merge review, refresco de reservas de terminal y comprobación incremental de colisiones de ignorados sobre el resultado previsto del merge. La guía distribuida y el prompt real de los creadores incluyen la gestión CLI; las correcciones posteriores conservan sus comandos y permisos.

Evidencia de esta ampliación (las ejecuciones indicadas se solapan; no sumar como casos independientes):

- UI y Dashboard: 55/55 aprobadas, incluyendo respuesta tardía durante acción, confirmación fallida y conservación de una reserva nueva.
- Transporte/gestión CLI: 55/55 aprobadas inicialmente; gestión final 11/11, incluyendo interrupción después de aceptar la acción y recibos consultables sin repetir efectos.
- Prompt real: ocho combinaciones de motor/editor aceptadas por sus validadores.
- Regresión Git de merge: 22 aprobadas y una omitida por la restricción MSYS del entorno Windows para ejecutar hooks. Enumeración real de 20.000 archivos y 4.500.000 bytes, colisión final detectada, catálogo retirado solo en destino conservado byte a byte, colisiones archivo/directorio/mayúsculas, referencias y resoluciones cambiadas.
- Casos adicionales de modificación real del archivo eliminado en destino y repositorio anidado ignorado: aprobados. Streaming final: 2/2 aprobadas, incluyendo UTF-8 dividido, salida incompleta y fallo del proceso.
- CLI compilada → propietario plugin con adaptador Obsidian de prueba → Git real temporal: revisión, rechazo con sesión activa de Main, merge-start, nueva revisión y merge-complete aprobados sobre el bundle final. El catálogo ignorado conserva exactamente sus bytes. La integración anterior de archive/remove-worktree conserva también la rama y la reserva independiente de Main.
- Lifecycle aislado sobre el bundle final: 149/149 aprobadas. Build TypeScript, ZIP de siete componentes, versiones, descriptor y hashes verificados.
- Último `npm test`: pretest 317 aprobadas y una omitida; principal 947 casos, 927 aprobados, 17 entradas fallidas por permisos de enlaces/CScript y tres omitidas. Los fallos incluyen un padre y seis subpruebas. No se declara la suite general verde ni se relajan las comprobaciones nativas.

El usuario confirmó el funcionamiento del paquete corregido en su proyecto el 22/11/2026 y autorizó incorporar los cambios al PR abierto. Es una confirmación del usuario, no una prueba automatizada de GUI ni validación de todas las funciones en macOS/Linux. CI del nuevo commit y aceptación multiplataforma siguen pendientes.

Paquete validado: main.js SHA-256 `9f27d63057fe903206e459f8f31c05a385c128af6796e1cd81d4662ab94fd978`; ZIP SHA-256 `c2b0e031ee86d1823f1b9a59fdb1d8789af8a9bb51e86aa365076d2ee795f9a1`. La subida del PR no publica la release ni modifica instalaciones.

## Preparación inicial del 21/11/2026

Preparación del 21/11/2026. Base funcional: el árbol de 1.7.28 integrado en main, más las correcciones de Pages de esta entrega. No se modifican dependencias, esquema importable ni instalaciones reales.

## Evidencia funcional previa al cambio de versión

- Pages, creación, cierre, UI y creadores: 133 aprobadas, 0 fallidas, 1 omitida porque el entorno Windows denegó el enlace requerido.
- Transporte CLI y selección de Pages: 51/51 aprobadas.
- Archivo y retirada reales de un worktree, seguidos de creación de otra Page: 1/1 aprobada.
- Lifecycle, ejecutado por separado: 149/149 aprobado.
- Prompt final de ambos creadores y sus motores: ejemplos JSON aceptados por sus validadores reales.
- Build y descriptor de los siete artefactos aprobados.

La evidencia anterior corresponde al mismo cambio funcional marcado inicialmente como 1.7.28. Su reutilización para 1.7.29 exige comprobar equivalencia de los bundles salvo la versión y repetir las comprobaciones de identidad y paquete.

## Límites

`npm test` se detuvo en pretest: 310 aprobadas, 7 fallidas y 1 omitida. Los fallos afectan a pruebas nativas de terminal, con errores `EACCES` al conectar a localhost y fallos de lanzamiento/entrega de entrada. La suite principal no llegó a ejecutarse en ese comando. No se declara aceptación completa ni se relajan las pruebas.

GUI Obsidian real, proveedores autenticados y ejecución nativa en macOS/Linux no verificados en esta preparación. El PR queda en borrador hasta revisar CI y la aceptación restante. Preparar el candidato no publica una release, no actualiza instalaciones ni recupera una Page real.

## Verificación de 1.7.29

- Versiones de manifest.json, package.json y raíz de package-lock.json alineadas en 1.7.29.
- Build aprobado. Los tres bundles coinciden byte a byte con el candidato funcional probado después de sustituir únicamente 1.7.28 por 1.7.29; se reutiliza la evidencia funcional anterior con esa equivalencia comprobada.
- Pruebas de runtime distribuido e integridad: 18/18 aprobadas. Ejemplos del prompt real con versión 1.7.29: aprobados.
- ZIP con exactamente siete artefactos y todos sus SHA-256 verificados.
- CLI del ZIP extraído anuncia 1.7.29 y pageCreationRecovery:1. Workflow Code completo ejecutado desde esa instalación sintética: phase completed, revisión 3 y efecto escrito una sola vez. Run 5f92da60-da8e-4ebb-95ea-92db1c75c58d.
- Diff sin errores de whitespace. Main remoto y HEAD local de partida comparten exactamente el árbol 36a98ac86ee8acad5efdbd40b297b82ecc5ebfa9.

Se mantiene pendiente CI del PR, GUI nativa y aceptación completa. No se repite la suite funcional sin cambios de comportamiento; se conserva expresamente su fallo general previo.

# Validación del candidato 1.7.29

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

# Revisión de la guía portable de AutoOC — 20 de noviembre de 2026

Se ha contrastado `skills/autooc-runtime/SKILL.md` con las fuentes locales y los
comandos `version`/`help` del candidato 1.7.28. Esta revisión documental no acredita
publicación ni instalación de ese candidato; las instalaciones deben consultar
sus propias capacidades y el propietario realmente cargado.

## Cambios

- Inicio operativo: localizar la instalación, recuperar el encargo y las
  identidades, consultar y escoger la siguiente operación soportada.
- Tabla que cubre los 24 comandos anunciados, además de `version` y `help`, y
  distingue las acciones que solo existen en la interfaz.
- Selección de bóveda frente a página/worktree, ejemplo de tarea individual con
  `--page`, límite de la CLI ante carpetas de configuración personalizadas y
  requisitos de UTF-8 sin BOM para los JSON preparados en PowerShell.
- Corrección de contradicciones sobre `edit-task`, campos editables, capacidades
  necesarias para una consulta y disponibilidad de Merge review en el candidato.
- `recover-publication`: precondiciones, orden de argumentos, diferencia entre
  hash del journal, hash de definición y hash de exportación, conservación del
  intento y ejecución de los pasos Code pendientes. No se presenta como remedio
  genérico ni como operación de lectura.
- Límites de `follow` y del alta de páginas; conservación de identidades ante una
  respuesta incierta. Se mantienen las precondiciones de recuperación y cierre.
- Sustitución de afirmaciones históricas de validación sin identificación de
  paquete por instrucciones para comprobar la evidencia de cada entrega.

## Contraste y comprobaciones

Referencias de código: `autooc-cli.ts`, `cli-plugin-requests.ts`, `task-edit.ts`,
`workflow-edit.ts`, `installed-workflow-location.ts`, `page-creation.ts`,
`installed-workflow-host.ts`, `code-workflow-host.ts` y `execution-journal.ts`.
El prompt compartido de `main.ts` confirma la distinción entre importación manual
de tareas CLI y las limitaciones de los creadores IA. No se modifica el esquema,
el comportamiento del programa ni ese prompt en esta revisión.

Comprobaciones completadas con la CLI distribuida y una bóveda sintética:

1. `version`/`help` y cobertura documental de todos los comandos anunciados.
2. Codificación UTF-8, frontmatter, cierre de bloques y enlaces internos.
3. `list`, `status`, `pages` y `status --page main`.
4. Exportación de tarea y workflow con sus hashes reales.
5. Sintaxis de todos los bloques JSON y ejemplos de edición aceptados por los
   validadores reales, sustituyendo los marcadores por las identidades exportadas.
6. Orden de parámetros de `recover-publication` contrastado con el parser.
7. Catálogo sin modificaciones y ausencia de runtime creado por esas consultas.
8. Integridad de los siete artefactos; en el candidato solo cambia el hash de la guía.

También pasan las dos pruebas de `tests/release-artifacts.test.cjs`, incluida la
coherencia de hashes con los blobs Git bajo normalización de saltos de línea.

La evidencia local está en `.tmp-skill-audit-20261120/verification.json` y
`verify.log`. No se ejecutan tareas, recuperaciones, instalaciones ni proveedores
reales para validar ejemplos documentales. No se repite la suite funcional completa
por esta edición exclusivamente documental; esta revisión no resuelve ni oculta
los fallos de validación funcional registrados para el candidato.

## Integridad y alcance del commit

La guía es uno de los siete archivos distribuidos. Su descriptor debe actualizarse
incluso en una edición documental. El directorio de trabajo contiene otros cambios
pendientes de la 1.7.28: se conserva su descriptor coherente con esos artefactos.
Para un commit documental separado, el descriptor del índice debe calcularse sobre
los artefactos de ese índice, sin incorporar bundles o cambios funcionales ajenos.
Los ZIP históricos conservan sus bytes; esta revisión no los reempaqueta ni instala.

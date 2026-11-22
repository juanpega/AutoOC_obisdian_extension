# Merge y archivos ignorados — candidato 1.7.29

Una revisión encontró dos defectos: `git ls-files --others --ignored --exclude-standard -z` producía 14.705.538 bytes (176.484 archivos), superando el buffer de 4 MiB; además, comparar esos archivos con todo el árbol de origen marcaba como colisión un catálogo que el destino había dejado de versionar y que el origen no había modificado.

La comprobación usa ahora el árbol previsto por `git merge-tree --write-tree`, comparado con el commit del destino. Las adiciones, modificaciones y cambios de tipo, junto con las rutas en conflicto, determinan los archivos que requieren protección. Los renombrados se comparan como eliminación/adición para no perder el nuevo destino. Una eliminación hecha solo en el destino y respetada por el merge no cuenta como archivo entrante.

Las rutas del diff y la enumeración de ignorados se consumen incrementalmente, separadas por NUL y con decodificación UTF-8 entre bloques. No existe un límite agregado de 4 MiB para estas dos consultas. Se comprueba toda la salida, incluyendo colisiones al final. Siguen detectándose coincidencias exactas, relaciones archivo/directorio y equivalencias de mayúsculas cuando Git anuncia `core.ignorecase`.

Un error del proceso, terminación anormal, timeout de 30 segundos o registro incompleto impide iniciar el merge. El límite defensivo de un registro individual es 1 MiB; excederlo genera un diagnóstico, nunca una revisión parcial válida. Las otras consultas Git conservan sus límites anteriores. No se declara soporte ilimitado para toda la revisión.

Se mantienen las guardas de sesiones, identidad de rama, revisión/hash y las opciones `--no-overwrite-ignore` y `--no-autostash`. El propietario repite la revisión antes de ejecutar la operación. Los drivers de merge personalizados y `merge.renormalize` continúan impidiendo la previsualización automática.

La guía portable y el prompt de los creadores se han revisado: los comandos, parámetros y permisos no cambian. Un agente debe obtener un nuevo `reviewHash` con el paquete corregido; no debe mover el catálogo local ni reintentar una acción incierta para eludir un bloqueo.

Pruebas y entrega: [validación del candidato](../docs/release-validation-1.7.29.md). Las pruebas automatizadas usan repositorios temporales. El usuario confirmó después el funcionamiento del paquete corregido en su proyecto; esa confirmación se distingue de las pruebas automatizadas y no certifica otras plataformas.

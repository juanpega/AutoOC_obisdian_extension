# Cierre de validación de 1.7.13

Encargo: terminar esta versión y publicarla en `main`. El usuario subirá el ZIP a GitHub; no se necesita acceso adicional a credenciales para ese paso. Este registro complementa [la revisión del PR](revision-pr51.md), conservando sus resultados históricos.

## Diagnóstico de los cuatro fallos locales

Los cuatro casos pasan en el primer ensayo focal instrumentado, sin cambiar código del producto ni umbrales: recuperación histórica 17,23 ms; observación de journals 41,29 ms. La suite completa previa a la corrección del arnés también pasa: 148/148, 155,5 s, con máximos de respuesta 8,20 y 27,79 ms.

El perfil identifica 148 bundles de bóvedas sintéticas retenidos en la caché de módulos al finalizar, y un heap de 565.074.768 bytes. Las lecturas síncronas más lentas, hasta 374 ms, aparecen principalmente en la carga de módulos de los fixtures y en comprobaciones de instalación/actualización; no equivalen a los intervalos medidos de recuperación histórica. La retención innecesaria añade presión de memoria entre casos. Se libera la entrada del módulo y su referencia en el padre después de obtener cada constructor, manteniendo instancias y módulos nuevos para las pruebas de recarga.

La prueba de guardados históricos tenía además un timeout propio de 2 s para observar cada temporal. Ese plazo empezaba incluso antes de que acabara la verificación del paquete y no correspondía al plazo real de la cola observada (10 s). Se sustituye por la espera de la observación exacta o del fin/error del arranque. El caso tiene un límite externo de 20 s para detectar un bloqueo del arnés. El producto conserva su plazo de 10 s y sus pruebas deterministas de expiración y estabilización.

## Regresión reproducible

Se añade una verificación del paquete retrasada 2,3 s, con cinco guardados históricos en cola. La escritura permanece retenida hasta observar el temporal exacto; se comprueban todos los tokens, temporales, posiciones del Dashboard y el guardado posterior del nuevo propietario.

- Con el timeout anterior de 2 s, el caso falla por ese timeout.
- Con la espera de observación/fin real, pasa (6,1 s incluido el arnés).
- La primera inyección de demora intentó interceptar una lectura de catálogo que ese fixture pequeño no utiliza; su aserción falló y se corrigió la inyección para retrasar la verificación real de `main.js`. No era un fallo del producto.

No se puede reconstruir con certeza cada pausa del ensayo histórico. La atribución demostrada es la incompatibilidad del timeout del fixture con un arranque legítimo y la retención de módulos; no se afirma que todas las pausas de 100 ms procedieran de una sola causa. La aceptación exige nueva suite completa del candidato limpio y CI, conservando ambos límites de respuesta de 100 ms.

## Alcance y evidencia

Solo cambia `tests/plugin-lifecycle.test.cjs`. No cambian modelos, contratos, endpoints, prompts, bundles ni datos instalados. La prueba nueva se incorpora a la suite existente, sin omitir casos ni añadir reintentos automáticos. El incremento esperado es un caso: 903 en Windows y 889 en POSIX, sumando ambos resúmenes TAP.

La copia de validación parte de `git archive 1d979d0` e incorpora únicamente ese archivo de pruebas. Excluye las cinco modificaciones locales ajenas. Build completado; suite completa en ejecución al preparar este registro. La publicación queda condicionada a su resultado y a la CI del commit final.

Evidencia local privada: `.tmp-final-four-profile.log`, `.tmp-final-lifecycle-profile.log`, `.tmp-final-slow-package.log`, `.tmp-final-old-deadline-proof.log`, `.tmp-final-clean-build.log` y `.tmp-final-clean-suite.log`. No se publica el contenido de catálogos reales ni credenciales.

## Resultado del candidato `b28e423`

[CI 41306677176](https://github.com/juanpega/AutoOC_obisdian_extension/actions/runs/41306677176) completada correctamente: build, suite completa, empaquetado y artefactos en los tres sistemas. Los totales suman los dos grupos TAP; no hay fallos ni cancelaciones.

| Plataforma | Correctas | Omitidas | Ciclo de vida | Recuperación / journals, máximo |
| --- | ---: | ---: | ---: | --- |
| Windows | 900 | 3 | 149/149 | 6,44 / 19,30 ms |
| Linux | 870 | 19 | 149/149 | 5,63 / 27,45 ms |
| macOS | 870 | 19 | 149/149 | 5,50 / 33,64 ms |

Las omisiones corresponden a otra plataforma y al binario opcional OpenCode 2; no acreditan autenticación de proveedores.

El build final desde la raíz normal también termina correctamente y sus siete artefactos coinciden byte a byte con el ZIP verificado. Evidencia privada: `.tmp-final-root-build.log`.

El primer grupo de la suite local limpia termina con 748 correctas, 3 fallos y 3 omitidas, en 760,7 s. Los tres fallos TAP representan dos casos: el recorrido del ZIP y un subcaso de tareas por rutas Windows 8.3 (también falla su padre). Ambos reciben `status: null` de subprocesos con límite de 15 s. El registro original no captura `error.code` ni la señal, por lo que no demuestra por sí solo la causa exacta de la terminación. Al ejecutar esos mismos casos en serie, sin ampliar límites ni modificar el producto, pasan sus ocho comprobaciones en 99,8 s. La CI completa concurrente también los supera. Se conserva el fallo local; no se presenta esa ejecución como una suite verde ni se añade un reintento automático.

El ZIP conserva SHA-256 `68df1fc7383a7f7cd3b67fc0e0329509441a6d14b73dd830627f3099080ce7af`. Se vuelve a extraer, se valida su descriptor y se comparan sus siete archivos con los blobs de Git de `b28e423`: identidad exacta. La compilación de la copia anidada resuelve dos dependencias desde el directorio padre y cambia sus etiquetas de ruta en `main.js`; se distingue esa salida de los bytes exactos de distribución, sin parchear bundles.

La suite local completa de ciclo de vida termina después: **149/149**, sin omisiones, fallos ni cancelaciones, en 205,5 s. Máximos de respuesta: **9,16 y 64,23 ms**, inferiores a los 100 ms exigidos. El perfil confirma cero bundles de fixtures en la caché; el heap final sigue en torno a 565 MB, por lo que no se atribuye a esta limpieza una reducción de memoria demostrada. Evidencia: `.tmp-final-lifecycle-clean.log` y `.tmp-final-process-recheck.log`.

La publicación autorizada consiste en merge a `main`. El usuario subirá el ZIP; no se crea una release ni un tag en su nombre. La actualización real iniciada desde otra bóveda queda pendiente de su comprobación posterior a publicar. No se modifican catálogos ni reservas de instalaciones reales. El estado definitivo del merge y del commit documental de cierre se consulta en el [PR #51](https://github.com/juanpega/AutoOC_obisdian_extension/pull/51).

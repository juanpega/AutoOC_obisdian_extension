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

# Preparación de merge y publicación 1.7.13

## Estado de la revisión

Preparación directa solicitada por el usuario el 2026-11-01. `origin/main` observado en `a403545` publica 1.7.1; rama de trabajo `codex/separate-panel-runtime-1-7-2`. No había PR abierto al consultar GitHub. `main` local no se ha movido. La diferencia exclusiva remota es el merge de la base 1.7.1 y no añade contenido respecto al ancestro común; no se ha ejecutado un merge por esta comprobación.

Descripción del PR y notas de release preparadas en este expediente. No se considera la entrega publicada por haberlas escrito. Los gates SDLC históricos de `09_Preparacion_PR` corresponden a otra rama; esta revisión es directa por petición humana y no se atribuye a esos workflows.

Actualización de preparación: commit `d274f67` subido y [PR #51](https://github.com/juanpega/AutoOC_obisdian_extension/pull/51) abierto en **borrador**. GitHub confirma que no hay conflicto de merge. La [CI inicial](https://github.com/juanpega/AutoOC_obisdian_extension/actions/runs/41300136412) está en ejecución; no se considera aprobada. La decisión de merge y la publicación permanecen pendientes.

Revisión posterior: la CI de `f023b1b` terminó con fallos en las tres plataformas. Se identificaron tres problemas del arnés (identidad física de rutas, expectativa del script POSIX y drenaje antes de limpiar Live Log). [Informe y correcciones](revision-pr51.md). No se usa la ausencia de conflictos como aprobación para mergear; se exige la nueva matriz completa.

Revalidación de `2301daa`: [CI 41302679868](https://github.com/juanpega/AutoOC_obisdian_extension/actions/runs/41302679868) correcta en Windows, Linux y macOS, incluidos build, suite completa, empaquetado y subida de artefactos CI. Windows: 899 correctas, 3 omitidas; Linux/macOS: 869 correctas y 19 omitidas cada uno; ningún fallo. El gate técnico queda superado para ese código. Merge, publicación y prueba real del actualizador siguen pendientes.

La repetición documental `4f044a3` volvió a fallar en macOS: una carrera al esperar dos streams y una medición de respuesta de 100,355 ms. Se corrige la espera y se separa la suite temporal de las pruebas concurrentes, conservando límites y cobertura. [Detalle](revision-pr51.md). Este hallazgo exige revalidar el nuevo HEAD; el verde anterior no cierra la revisión.

## Antes del merge

- [x] Contrastar conversación, diff completo y contratos de los módulos cambiados.
- [x] Recuperar expediente con flujos Mermaid y límites; enlazar QA existente.
- [x] Separar cinco modificaciones locales ajenas a los commits.
- [x] Corregir inconsistencia del hash del manifiesto tras normalización Git.
- [x] Build y regresión focal del empaquetado; hashes del árbol Git corregido.
- [x] Completar y registrar la suite sobre ese árbol exacto: 896 correctas, 3 fallos y 3 omisiones; los casos fallidos pasan en revalidación focal posterior. No es una pasada completa verde.
- [x] Verificar ZIP corregido extraído y sus siete artefactos, y conservar SHA-256.
- [x] Commit documental/de preparación y revisión de staging exclusivamente seleccionado; siete artefactos del índice coinciden byte a byte con el paquete verificado.
- [x] Push y PR revisable en borrador.
- [ ] Comprobar CI de Windows, Linux y macOS del commit correspondiente.
- [ ] Resolver cualquier fallo o revisión pendiente antes de decidir merge/publicación.

El resultado anterior de 897 pruebas locales no sustituye la suite de entrega: existían cambios de biblioteca/pruebas sin commit y el manifiesto no tenía los mismos bytes en Git. El primer archivo Git queda como prueba negativa; el paquete corregido es el candidato para publicar.

ZIP local: `release/auto-oc-1.7.13.zip`. SHA-256: `68df1fc7383a7f7cd3b67fc0e0329509441a6d14b73dd830627f3099080ce7af`. Se conserva el candidato anterior por separado como evidencia; el ZIP nuevo no se ha publicado ni sustituye una release histórica.

## Publicación y actualización

1. Merge del PR revisado a `main`. Los siete artefactos y el descriptor deben llegar juntos. Confirmar versión remota 1.7.13 y comprobar sus hashes descargados.
2. Crear el tag `v1.7.13` sobre el commit publicado y una GitHub Release con las [notas preparadas](notas-release.md) y el ZIP verificado. No recrear un tag existente ni sobrescribir una release histórica.
3. Probar **Check updates** desde la otra bóveda elegida por el usuario, registrar versión de origen/destino, carga real y conservación de catálogo/historial. La aplicación consulta `main`; publicar solo un ZIP/tag no cambia el resultado de ese botón.
4. Registrar el resultado de esa prueba antes de extender la actualización a otros proyectos. No se presume autorización para modificar todas las bóvedas.

Merge, tag y publicación son acciones distintas; este documento es su preparación, no una autorización adicional ni evidencia de que ocurrieran.

## Prueba que puede hacer el usuario desde otro proyecto

Conservar una copia de la configuración del plugin y observar su versión actual. Esperar a que terminen sus tareas; en AutoOC pulsar **Check updates** y actualizar cuando aparezca 1.7.13. Después comprobar:

- La bóveda y AutoOC abren normalmente; cabecera y ajustes muestran 1.7.13.
- Siguen las mismas tareas, workflows, resultados y desactivaciones.
- El Dashboard agrupa por áreas y Code aparece en los controles correspondientes.
- Los creadores muestran motor y modelo, y una generación cancelada no añade elementos.
- Una tarea de prueba controlada indica Running sin aviso falso; aprobación o fallo siguen visibles.
- Cerrar y reabrir normalmente conserva el acceso, sin borrar reservas.

Si el actualizador antiguo impide descargar por un histórico, no reinstalar borrando datos: conservar el mensaje y versión de origen. La ruta alternativa documentada es el ZIP completo nuevo con el plugin descargado y `maintain-release --inspect/--install`, que mantiene históricos. Un propietario vivo o guardado incompleto necesita diagnóstico específico; no se resuelve por reset general.

La prueba real entre bóvedas sigue pendiente hasta que el usuario la confirme; los ensayos sintéticos no se registran como esa confirmación.

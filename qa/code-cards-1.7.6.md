# Tarjetas Code — 1.7.6

## Corrección

Las tarjetas Code también llevaban `auto-oc-workflow-task-detail`. Sus reglas sobreescribían el fondo, el borde de estado y el relleno de `auto-oc-card`, por lo que una tarjeta Code se veía diferente a una tarea del catálogo con un nombre parecido.

El estilo de detalle de workflow ahora excluye las tarjetas completas. Code comparte la cabecera y el borde de estado de las tareas; se retiran los saltos de línea específicos de su cabecera y la etiqueta del motor pasa a ser `Code`. Al desplegar, área, workflow/paso, alcance de Run y última ejecución usan las filas compactas de metadatos de las tareas. Run, Stop cuando corresponde, Log, History, Edit Code y Open workflow comparten la franja de acciones. Los callbacks conservan las mismas identidades y controles de ejecución.

## Validación

- TypeScript y construcción completa: aprobados.
- Paquete completo: `release/auto-oc-1.7.6.zip`, verificado por el empaquetador.
- Regresión focal inicial: 40/41 aprobadas; la discrepancia era la aserción de metadatos en una sola línea. Ajustada a las líneas independientes de área y workflow/paso, `tests/catalog-bulk.test.cjs` pasa 32/32. No se cambiaron pruebas de ejecución para aceptar un resultado distinto.
- Suite general `npm test`: finalizada en 20 min 31 s, con 873 pruebas: 856 aprobadas, 13 fallidas y 4 omitidas. Incluye la aserción antigua de metadatos, cargada antes de corregirla y aprobada en la repetición focal de 32 pruebas. No se acredita la suite general como aprobada.
- Obsidian real 1.14.5 en Windows: comparación visual de `SDLC helper` y de un paso Code, tanto plegados como desplegados. Fondo, borde, relleno, texto y franja de botones coherentes. No se ejecutaron tareas reales.

## Instalación

Instalación oficial con AutoOC descargado en `C:\Dev\AutoOC`, seguida de reactivación y comprobación del panel 1.7.6. Catálogo idéntico por SHA-256 y siete artefactos coincidentes; catálogo y descriptor comprobados también después de la reactivación. Respaldo conservado en `runtime/update-backup-dffef511-ab9c-4199-968d-ae70119108b6` de esa instalación. Sin publicación remota.

## Fallos generales pendientes de investigación

Además de la aserción de presentación corregida, la ejecución general registró:

- `code-runtime`: no se observó a tiempo el checkpoint en curso en la prueba de parada del plugin.
- `execution-abandonment`: dos transiciones desde paquetes históricos 1.6.6 y 1.6.7 devolvieron estado de proceso nulo.
- `packaged-runtime`: el proceso de empaquetado de la fixture agotó su límite de 60 segundos.
- `plugin-lifecycle`: dos límites de latencia de lectura histórica y dos observaciones de guardados en cola fallaron.
- `release-update`: la prueba del ZIP con manifest de espacios y CRLF no obtuvo terminación satisfactoria del proceso.
- `workflow-compatibility`: fallaron dos subpruebas de tareas autónomas bajo alias Windows 8.3, y su prueba contenedora. Una devolvió estado de proceso nulo; la otra encontró un directorio temporal ocupado al limpiarlo.

No se ha probado que todos estos fallos sean previos al cambio ni que se expliquen exclusivamente por el entorno. No se modificaron los controles del runtime ni los límites de estas pruebas para ocultarlos.

Las cuatro omisiones corresponden al binario OpenCode v2 real, dos comprobaciones exclusivas de POSIX y la observación de inicio de un proceso real terminado que el entorno no ofreció. Las pruebas con dobles no acreditan esas integraciones.

`codegraph affected main.ts code-editor.ts`, revisión del diff y comprobación de espacios realizados. Commit funcional: `acb4763`. Se conservaron fuera de este commit los cambios ajenos del catálogo SDLC, su prueba y `.gitignore`.

# Tarjetas Code — 1.7.6

## Corrección

Las tarjetas Code también llevaban `auto-oc-workflow-task-detail`. Sus reglas sobreescribían el fondo, el borde de estado y el relleno de `auto-oc-card`, por lo que una tarjeta Code se veía diferente a una tarea del catálogo con un nombre parecido.

El estilo de detalle de workflow ahora excluye las tarjetas completas. Code comparte la cabecera y el borde de estado de las tareas; se retiran los saltos de línea específicos de su cabecera y la etiqueta del motor pasa a ser `Code`. Al desplegar, área, workflow/paso, alcance de Run y última ejecución usan las filas compactas de metadatos de las tareas. Run, Stop cuando corresponde, Log, History, Edit Code y Open workflow comparten la franja de acciones. Los callbacks conservan las mismas identidades y controles de ejecución.

## Validación

- TypeScript y construcción completa: aprobados.
- Paquete completo: `release/auto-oc-1.7.6.zip`, verificado por el empaquetador.
- Regresión focal inicial: 40/41 aprobadas; la discrepancia era la aserción de metadatos en una sola línea. Ajustada a las líneas independientes de área y workflow/paso, `tests/catalog-bulk.test.cjs` pasa 32/32. No se cambiaron pruebas de ejecución para aceptar un resultado distinto.
- Suite general `npm test`: en curso; su resultado definitivo se registrará al finalizar. No se acredita como aprobada.
- Obsidian real 1.14.5 en Windows: comparación visual de `SDLC helper` y de un paso Code, tanto plegados como desplegados. Fondo, borde, relleno, texto y franja de botones coherentes. No se ejecutaron tareas reales.

## Instalación

Instalación oficial con AutoOC descargado en `C:\Dev\AutoOC`, seguida de reactivación y comprobación del panel 1.7.6. Catálogo idéntico por SHA-256 y siete artefactos coincidentes. Respaldo conservado en `runtime/update-backup-dffef511-ab9c-4199-968d-ae70119108b6` de esa instalación. Sin publicación remota.

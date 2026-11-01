# Tamaño preciso de burbujas — 1.7.8

## Cambio

Settings → AutoOC → **Task and step bubble size** admite un diámetro entero de 16 a 80 px. La vista previa cambia al escribir; **Apply** guarda y refresca el Dashboard. **Reset to default** guarda 30 px. Un fallo de guardado restaura la preferencia en memoria y permite reintentarlo.

La preferencia numérica es opcional. Si no existe o no es válida, se conserva la equivalencia anterior: sm=24, md=30, lg=38, xl=48. No cambia la definición de tareas/workflows, sus permisos, la importación/exportación ni el contrato del prompt de creación; ese prompt no necesita modificaciones por este cambio visual.

## Validación

- Pruebas focales: 2/2 correctas; compatibilidad, valor exacto, entradas inválidas, vista previa sin guardar, Apply, fallo de persistencia, Reset y conservación del catálogo sintético.
- `npm run build` y `npm run pack:release`: correctos; ZIP 1.7.8 generado.
- `codegraph affected`: inspeccionados los consumidores de Settings y Dashboard; el índice incluye también copias temporales históricas. Suite general en ejecución al escribir esta nota.
- Instalación oficial mediante `maintain-release --install` en `C:\Dev\AutoOC`, después de desactivar el plugin. Recibo: versión 1.7.8, ninguna decisión administrativa aplicada.
- Siete artefactos instalados verificados contra el descriptor y el paquete construido. `data.json` idéntico por SHA-256 al respaldo previo del mantenimiento.
- GUI Obsidian: lista de plugins muestra 1.7.8. Campo inicial de 24 px, muestra de 37 px, Apply confirmado con `Saved: 37 px` y valor 37 persistido; Reset confirmado con `Saved: 30 px` y valor 30 persistido. Después se restaura 24 px usando Enter.
- Preferencia previa en la instalación: `sm` (24 px); se conserva esa elección tras la prueba, con `Saved: 24 px` confirmado en Obsidian. Comparación del catálogo antes/después: únicamente cambia el nuevo campo `dashboardTaskBubbleDiameter`; tareas, workflows e históricos idénticos.
- La prueba CLI «workflow name arrives before a retained Code step finishes and stays out of journals» falló en la suite general con salida de proceso `null` (su arnés impone un watchdog de 25 s). Repetida aisladamente: 1/1 correcta en 18,2 s. Esto no convierte la ejecución general en una suite aprobada.

No se han ejecutado tareas ni workflows reales para esta validación.

# Corrección de Apply y mínimo 10 px — 1.7.9

## Diagnóstico

En `C:\Dev\AutoOC`, el catálogo tiene 94.812.959 bytes. Se observó 16 px ya persistido, mientras el control de Settings seguía deshabilitado y había un guardado del catálogo pendiente (lock, intención y temporal). La implementación 1.7.8 esperaba `saveSettings()` y refrescaba la vista completa para una preferencia puramente visual. La comprobación anterior de 37/30/24 px no cubría el caso de una cola de guardados pendiente.

No se atribuye todo bloqueo del plugin a esta causa ni se modifica el protocolo de guardado del catálogo. No se eliminan reservas, locks, temporales ni históricos para instalar.

## Cambio

- Rango entero 10–80 px, incluida validación de datos persistidos y de entrada.
- Preferencia pequeña en el almacenamiento local de Obsidian, por bóveda y carpeta de configuración. Compatibilidad con Obsidian anterior a 1.8.7 mediante clave local que incluye la ruta de la bóveda.
- Si no existe esa preferencia, se conserva el número o preset del catálogo anterior. No se reescribe ni migra el catálogo al aplicar el tamaño. La nueva preferencia es por dispositivo; no se exporta como definición de tarea/workflow.
- Apply actualiza únicamente ancho/alto de las burbujas existentes en todas las vistas abiertas del plugin. No reconstruye vistas, no lee históricos y no guarda posiciones ni pasa por la cola de ejecución.
- Mensajes `Saving size…` y `Saved: … px`; errores de almacenamiento dejan la preferencia anterior y permiten reintentar. Un error visual posterior al guardado se diferencia del error de persistencia.
- Revisado el impacto en prompts: no cambia el esquema de tareas/workflows ni sus capacidades; no requiere modificar el prompt de creación.

## Verificación

- 6 pruebas focales correctas: límites 10/16/80, compatibilidad, Apply/Reset, error y reintento, guardado pendiente y doble clic, independencia del catálogo, aislamiento de bóvedas y actualización sin reconstrucción.
- Build y paquete 1.7.9 correctos.
- Instalación oficial de 1.7.9 en `C:\Dev\AutoOC` después de esperar el drenaje normal de los guardados anteriores. La reserva y los marcadores se retiraron por el propio plugin, sin recuperación manual. El recibo de instalación no aplica decisiones administrativas.
- Verificados los siete artefactos y SHA-256 del catálogo antes/después de instalar: idéntico.
- Obsidian 1.14.5 real: carga de 1.7.9; Enter guarda 10 px y muestra `Saved: 10 px`, con el campo disponible; cerrar y reabrir Settings conserva 10. Se abre el Dashboard con burbujas pequeñas; Apply guarda 16 px con ese panel abierto, muestra `Saved: 16 px` y actualiza visualmente las burbujas existentes. Se dejan 16 px y el Dashboard abierto.
- Después de ambos cambios, SHA-256 de `data.json` idéntico al anterior y ausencia de `data.json.write-lock`. No se ejecutaron tareas ni workflows reales.
- Suite general: 880 pruebas, 874 correctas, 3 fallidas, 3 omitidas. Las omisiones corresponden al binario real opcional de OpenCode v2 y dos comprobaciones POSIX.
- Fallos pendientes: la parada de una ejecución no observa el checkpoint esperado; la observación cooperativa de históricos supera el límite de latencia; la comparación de ejecución plugin/CLI no obtiene el estado esperado. No se acredita una suite general completamente correcta.
- Repetición secuencial: persiste el fallo de latencia; la comparación plugin/CLI llega al timeout de la CLI (`status: null`). La primera repetición aislada de parada omitió la preparación del doble de Obsidian y no es válida como diagnóstico. Repetida con esa preparación, pasa el contrato Code y sigue fallando la espera del checkpoint. Estos fallos no se consideran resueltos por el cambio visual ni se atribuyen a una causa sin comprobarla.
- Evidencia local: `.tmp-bubble-fix-suite.log`, `.tmp-bubble-fix-recheck.log` y `.tmp-bubble-fix-stop-recheck.log`; pruebas focales en `.tmp-bubble-fix-focused.log`.

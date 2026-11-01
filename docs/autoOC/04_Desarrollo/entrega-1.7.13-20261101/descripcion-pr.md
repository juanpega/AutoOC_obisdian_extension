# AutoOC 1.7.13: panel independiente, creación con IA, controles Code y Dashboard por áreas

La consulta y la actualización del plugin dejaban de estar disponibles por históricos de ejecución que requerían revisión. Esta entrega separa la consulta del catálogo, la actividad actual del motor y el mantenimiento del paquete, conservando los históricos y los controles de propiedad y guardado.

También incorpora las mejoras de uso acumuladas desde 1.7.1:

- Creación por objetivo con motor y modelo, validación del borrador y revisión en el editor; retirada de WF Visual Builder.
- Selección múltiple para área, exportación, eliminación y activación; confirmaciones accesibles y guardados cooperativos.
- Code de workflows visible en Tasks, ejecución aislada, Stop, desactivación, log/historial y editor JavaScript con sintaxis.
- Selector CLI directo para OpenCode 1/2, Codex, Copilot y Claude; OpenCode 2 mantiene comandos y configuración separados.
- CLI con disponibilidad y selección de Code, y referencia completa de llamadas en README.
- Dashboard por áreas, tamaños de 10–80 px y avisos ligados al intento exacto. Una ejecución controlada conserva Running.
- Integridad de publicación verificada después de Git: rechazo de CRLF para impedir que el manifiesto normalizado invalide el descriptor.

El [expediente de entrega](README.md) contiene trazabilidad, diagramas, contratos, supuestos y estado de validación. No se añaden endpoints HTTP ni migraciones. Se preservan el esquema 1.6.0, posiciones históricas, IDs y datos instalados; los lectores antiguos necesitan capacidad para tipos nuevos como OpenCode 2.

## Validación y límites

Build correcto; suite sobre una copia Git aislada: 902 pruebas, 896 correctas, 3 fallidas y 3 omitidas. Dos fallos temporales de ciclo de vida pasan en repetición secuencial sin cambiar límites; el tercero detectó una incompatibilidad del primer guard con un ZIP histórico CRLF. El guard final se limita al generador del descriptor y las tres pruebas focales de distribución pasan. El ZIP final se ha extraído, verificado y ejecutado en bóveda sintética. Se conserva la evidencia de los fallos y no se afirma una segunda pasada completa verde.

La validación previa local de 1.7.13 tuvo 897 correctas y 3 omitidas, con GUI real en Obsidian/Windows. El primer archivo Git fue rechazado por hash del manifiesto; la corrección reproduce y evita ese defecto. Véase [validación](limites-y-validacion.md) para distinguir los candidatos.

Pendientes: CI multiplataforma del PR y prueba real de actualización desde otra bóveda después de publicar en main. Las pruebas con dobles no acreditan autenticación de proveedores. Cinco cambios locales de biblioteca/exclusión ajenos a esta entrega quedan fuera del PR.

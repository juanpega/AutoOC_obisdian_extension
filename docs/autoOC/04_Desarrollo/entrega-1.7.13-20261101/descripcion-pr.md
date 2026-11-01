# AutoOC 1.7.13: panel independiente, creación con IA, controles Code y Dashboard por áreas

La consulta y la actualización del plugin dejaban de estar disponibles por históricos de ejecución que requerían revisión. Esta entrega separa la consulta del catálogo, la actividad actual del motor y el mantenimiento del paquete, conservando los históricos y los controles de propiedad y guardado.

También incorpora las mejoras de uso acumuladas desde 1.7.1:

- Creación por objetivo con motor y modelo, validación del borrador y revisión en el editor; retirada de WF Visual Builder.
- Selección múltiple para área, exportación, eliminación y activación; confirmaciones accesibles y guardados cooperativos.
- Code de workflows visible en Tasks, ejecución aislada, Stop, desactivación, log/historial y editor JavaScript con sintaxis.
- Selector CLI directo para OpenCode 1/2, Codex, Copilot y Claude; OpenCode 2 mantiene comandos y configuración separados.
- CLI con disponibilidad y selección de Code, y referencia completa de llamadas en README.
- Dashboard por áreas, tamaños de 10–80 px y avisos ligados al intento exacto. Una ejecución controlada conserva Running.
- Integridad de publicación verificada después de Git: el generador rechaza CRLF para impedir que la normalización del manifiesto invalide el descriptor; el empaquetador conserva los bytes de paquetes históricos ya verificados.

El [expediente de entrega](README.md) contiene trazabilidad, diagramas, contratos, supuestos y estado de validación. No se añaden endpoints HTTP ni migraciones. Se preservan el esquema 1.6.0, posiciones históricas, IDs y datos instalados; los lectores antiguos necesitan capacidad para tipos nuevos como OpenCode 2.

## Validación y límites

[CI multiplataforma](https://github.com/juanpega/AutoOC_obisdian_extension/actions/runs/41302679868) correcta para `2301daa`: Windows, 899 pruebas correctas y 3 omitidas; Linux y macOS, 869 correctas y 19 omitidas cada uno. Cero fallos o cancelaciones. Build, suite completa, empaquetado y subida del ZIP de CI correctos en los tres sistemas. Las omisiones corresponden a pruebas de otra plataforma y al binario opcional de OpenCode 2.

El ZIP final se ha extraído, verificado y ejecutado en una bóveda sintética, incluida continuación sin repetir efectos. La GUI de 1.7.13 se comprobó en Obsidian/Windows; las correcciones posteriores de distribución y del arnés no modifican los bundles funcionales. Se conserva la [evidencia de candidatos anteriores](limites-y-validacion.md) y el [diagnóstico de CI](revision-pr51.md), sin reescribir sus fallos.

Pendientes: decisión de merge/publicación y prueba real de actualización desde otra bóveda después de publicar en main. El PR permanece en borrador; subir artefactos de CI no publica una release. Las pruebas con dobles no acreditan autenticación de proveedores. Cinco cambios locales de biblioteca/exclusión ajenos a esta entrega quedan fuera del PR.

# AutoOC 1.6.1 — candidato de entrega

## Cambios

- Tareas individuales y workflows con Obsidian cerrado mediante la CLI distribuida y el mismo motor que utiliza el plugin.
- Skill portable para consultar, ejecutar, detener y recuperar ejecuciones desde un agente, utilizada también por el orquestador.
- Identidad, estados, handoff, historial, exclusividad y recuperación sin repetir efectos. Codex y OpenCode conservan su configuración de motor/modelo.
- Confirmación del arranque interactivo, conservación de entradas largas hasta su consumo y actualización automática de estados del panel.
- Notas creadas, modificadas o ampliadas desde Code se reflejan en Obsidian sin reiniciar, con diagnóstico fiel de fallos y conservación de datos parciales.
- Paquete y actualizador completos con CLI, runtime, skill, hashes de integridad y respaldo de artefactos.

## Validación

El expediente conserva pruebas automatizadas, compilación nativa de Windows y comprobaciones reales de GUI y proveedores sobre candidatos identificados. La prueba final del ZIP y su resultado se registran en output/release-161; no deducir publicación ni validación de un artefacto distinto por existir este documento.

## Instalación

Descargar el ZIP completo cuando se publique. Con AutoOC descargado y sin ejecuciones pendientes, extraer todos sus archivos en .obsidian/plugins/auto-oc/. Conservar configuración, credenciales y journals. No sustituir únicamente main.js ni los tres archivos del plugin antiguo. RELEASE_WORKFLOW.md y la skill portable describen comprobaciones y recuperación.

## Límites

Node18 o posterior para la ejecución autónoma. La CLI mantiene experimental:true. La convivencia con el plugin activado no está habilitada: descargar AutoOC antes de ejecutar fuera de Obsidian. Copilot real queda aplazado por decisión humana; no hace falta contratarlo para usar Codex/OpenCode. REQ-003 y la prueba manual del almacén de secrets siguen aplazados, sin cierre ni aprobación. PR, merge y publicación corresponden al usuario.

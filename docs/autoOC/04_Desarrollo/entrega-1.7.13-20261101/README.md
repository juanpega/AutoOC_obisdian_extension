# Entrega 1.7.13 — seguimiento de los encargos directos

Fecha de revisión: 2026-11-01. Rama: `codex/separate-panel-runtime-1-7-2`.

En Windows la ruta se ve como `Docs/autoOC/04_Desarrollo`; Git conserva la raíz histórica `docs/` en minúsculas. Los enlaces publicados usan esa capitalización.

## Objetivo y alcance

Permitir consultar y actualizar AutoOC sin que un histórico interrumpido bloquee toda la interfaz, y facilitar la creación, organización y ejecución de tareas y workflows. El usuario pidió desarrollo directo sin ciclo SDLC, instalación continua de candidatos en `C:/Dev/AutoOC` y ahora documentación y preparación para merge/publicación.

Base remota actualizada: `a4035456dd37e385e8942ce00cefdb470012c2df` (`origin/main`, 1.7.1). Ancestro común: `8ec829b14b8c4e3e0e616d43f55ad17fbf0b8d10`; ambos tienen el mismo contenido. El `main` local `321479b` estaba atrasado y no es la base de esta entrega.

Punto de partida revisado: `538b5235258d430868acaeb2c2ed3a52451244da`: 16 commits exclusivos de la rama y 97 archivos cambiados respecto a la base común. El diff local adicional se registra por separado. La revisión de entrega detectó después una inconsistencia de integridad entre el manifiesto local CRLF y el blob LF de Git; su corrección y pruebas forman parte de esta preparación.

## Mapa del expediente

- [Flujos modificados y diagramas Mermaid](flujos.md).
- [Modelos de datos, comandos y contratos](contratos.md).
- [Casos límite, supuestos y validación](limites-y-validacion.md).
- [Preparación de merge, publicación y prueba desde otra bóveda](preparacion-entrega.md).
- [Descripción preparada para el PR](descripcion-pr.md).
- [Notas preparadas para la release](notas-release.md).
- [Revisión del PR #51 y correcciones de CI](revision-pr51.md).
- [Cierre de validación y diagnóstico de los plazos locales](cierre-validacion.md).

## Trazabilidad de la conversación

Los identificadores `ENT-*` organizan esta revisión documental; no son requisitos `REQ-*` del runtime ni implican aceptación formal. Las versiones intermedias son candidatos locales, no releases publicadas.

| Ref. | Petición y resultado | Commit principal / evidencia |
| --- | --- | --- |
| ENT-01 | Abrir el panel aunque ejecución/guardado requiera atención; separar consulta, ejecución y mantenimiento. Los bloqueos reales siguen impidiendo efectos. | `60d7b84`; `panel-catalog.ts`, `package-maintenance.ts`, `qa/opencode-2-candidate.md` |
| ENT-02 | Evitar carpetas auxiliares sueltas. Nuevas sesiones en `.autooc/auxiliary`, limpieza solo tras cierre confirmado. No barrer carpetas históricas. | `60d7b84`; `execution-files.ts`, `tests/interactive-handoff.test.cjs` |
| ENT-03 | Ayuda en inglés, útil solo cuando hay problemas; no mostrar avisos por una ejecución normal o completada. No se implementa un reset general del runtime. | `60d7b84`, `538b523`; `execution-status-help.ts`, `qa/dashboard-running-attention-1.7.13.md` |
| ENT-04 | Retirar WF Visual Builder y su acceso WF Builder Prompt; crear con descripción desde los editores, manteniendo el prompt integrado. | `60d7b84`; `ai-draft*.ts`, `tests/ai-draft.test.cjs` |
| ENT-05 | Elegir motor y modelo al generar. Modelo manual o automático, selección por motor durante el formulario y revisión antes del guardado conjunto. | `c69df58`; `qa/draft-model-selector-1.7.11.md` |
| ENT-06 | Seleccionar tareas/workflows; cambiar área, exportar, eliminar y activar/desactivar en lote. Ocultar selección. Conservar datos y dependencias. | `60d7b84`, `5c44c3c`; `qa/bulk-confirmation-1.7.7.md` |
| ENT-07 | Corregir pantalla gris al desactivar y bloqueos de guardados grandes; confirmar operaciones en modal con botones accesibles. | `7cae5aa`, `5c44c3c`; `qa/disable-renderer-1.7.3.md` |
| ENT-08 | Mostrar Code de workflows en Tasks; colapsar, ejecutar, parar, desactivar, log, historial y edición, conservando resultado del workflow completo. | `df2913e`; `qa/code-step-controls-1.7.4.md` |
| ENT-09 | Código legible con sintaxis, editor JavaScript y tarjetas coherentes con tareas. | `acb4763`; `qa/code-editor-1.7.5.md`, `qa/code-cards-1.7.6.md` |
| ENT-10 | Selector CLI: OpenCode 1/2, Codex, Copilot y Claude. Rutas en Settings, lanzamiento real en Windows y OpenCode 2 separado, sin migración automática. | `60d7b84`; `interactive-cli.ts`, `docs/opencode-2.md` |
| ENT-11 | CLI consciente de elementos desactivados y selección de un Code; referencia de comandos/parámetros en README. Concurrencia explicada en inglés en el editor. | `dc7bc1c`; `qa/cli-availability-1.7.10.md`, `README.md` |
| ENT-12 | Tamaño preciso de burbujas, hasta 10 px, sin bloquear el catálogo. Dashboard por áreas elegido por el usuario, Code visible y actividad ligera. | `68cca67`, `03c43c8`, `5fc879d`; QA 1.7.8, 1.7.9 y 1.7.12 |
| ENT-13 | No marcar `Needs attention` por un run que controla el host actual. Identidad exacta para tarea, workflow y Code aislado. | `538b523`; QA 1.7.13 |
| ENT-14 | Preparar merge/publicación: expediente recuperado y corrección del hash distribuido afectado por normalización Git. | Esta preparación; `scripts/release-artifacts.mjs`, `tests/release-artifacts.test.cjs` |

Las evidencias de `qa/` son enlaces desde la raíz del repositorio; el [README de producto](../../../../README.md) describe el comportamiento final. El prompt se mantiene sincronizado con esquema, tipos, permisos y transiciones; las pruebas ejercitan los ejemplos que recibe realmente el creador. Las instrucciones locales `AGENTS.md` contienen esa obligación, pero no forman parte del paquete del plugin.

## Trabajo local conservado fuera de la entrega

`.gitignore`, `library/sdlc-codex-background-app.README.md`, `library/sdlc-codex-background-app.json`, `library/wf-04-codex-build-sprint.json` y `tests/sdlc-workflow-package.test.cjs` tenían modificaciones sin commit al comenzar. Se revisa y registra su existencia, pero no se absorben en esta entrega ni se afirma haber validado su intención funcional. No se tocan los catálogos instalados ni los expedientes históricos.

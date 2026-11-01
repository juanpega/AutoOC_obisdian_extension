# Dashboard por áreas — candidato 1.7.12

Fecha: 2026-11-01. Implementación directa de la propuesta por áreas elegida por el usuario; sin ciclo SDLC. No acredita publicación.

## Cambio y límites

- El Dashboard utiliza grupos por `Area`, orden estable por nombre, burbujas con etiquetas visibles y un inspector. Workflows, tareas IA, tareas Code, pasos Code y esperas tienen representaciones propias.
- Búsqueda por nombre/área/paso; atención solo ante incidencias registradas o dependencias desactivadas; opción de incluir desactivados en gris. Selección, filtros y áreas plegadas se conservan durante la sesión de la vista.
- Los pasos pertenecen a su workflow y mantienen identidad compuesta. No se deduce que una rama se ejecutó porque el workflow terminó; Code usa el resultado aplicable entre su ejecución aislada y la del workflow. Los contadores separan elementos principales de pasos en ejecución y representan estado registrado.
- El inspector ofrece log, historial y navegación a los controles existentes. La navegación limpia filtros de listas que podrían ocultar el destino. No inicia ejecuciones por seleccionar una burbuja.
- Layout adaptable mediante CSS; pasos mostrados de 40 en 40. El refresco mantiene la barra de búsqueda y no reconstruye la vista si no cambian sus datos de presentación. No añade temporizadores de consulta, simulación física, exploración de outputs ni escrituras del catálogo al filtrar, seleccionar o plegar. La señal de cambio es una animación breve que respeta movimiento reducido.
- Se retira del recorrido activo el mapa con colocación y colisiones. Las posiciones históricas y su compatibilidad se conservan; no se migra ni vacía la configuración.
- Auditoría del prompt: cambio exclusivamente de presentación, sin modificación de esquema, motores, permisos ni capacidades de los creadores. Las pruebas del prompt efectivo y sus ejemplos siguen pasando.

## Evidencia de validación

- CodeGraph consultado antes de editar; impacto revisado en `renderDashboard`, `refresh`, notificaciones de nombres, navegación y controles Code. `codegraph affected main.ts dashboard-areas.ts styles.css` identifica regresiones pertinentes; contraste directo donde la salida mezclaba copias históricas temporales.
- `npm run build`: correcto. Pruebas focales del Dashboard, tamaño de burbujas, selección de catálogo y creadores: 65 correctas, 0 fallidas. Repetidas tras los últimos ajustes de atención y eventos de grupos desconectados.
- `npm test`: 897 pruebas, 894 correctas, 0 fallidas y 3 omitidas; 503.438 ms. Omisiones: binario real opcional OpenCode 2 y dos comprobaciones POSIX. La suite se inició antes de esos últimos ajustes de presentación; la selección focal se repitió contra el bundle final. Los módulos CLI, runtime y persistencia no cambiaron por esos ajustes.
- Pruebas nuevas: identidades, dependencias desactivadas, resultados Code aislados, ramas pendientes, búsqueda de pasos, filtros, detalle acotado, foco y colapsos durante eventos, ausencia de cambios de catálogo y navegación al Code correcto.
- `npm run pack:release`: ZIP 1.7.12 correcto. Extracción y verificación de los siete artefactos en bóveda sintética; ejecución Code aislada, continuación sin duplicar efectos y workflow completo correctos. Identidades: `25ac8b3b-259d-44bc-beae-a5b44e18ba88` y `7bd13a90-a9d9-49db-91ee-1c3685d49b31`.

## Instalación y GUI real

- Destino autorizado `C:\Dev\AutoOC`, previamente 1.7.11. CLI instalada consultada con `version`, `help` y `status`; ningún estado `running` registrado en tareas, workflows o Code, y sin journals activos. Se descargó únicamente AutoOC mediante los ajustes de Obsidian.
- Instalación desde el ZIP extraído mediante `maintain-release --install`; resultado 1.7.12 y decisiones `applied: []`. Respaldos en `runtime/update-backup-e3b0985e-2415-4852-b130-bbd7bb38a466` y `runtime/maintenance-backup-cb4b4f84-e0dc-4289-8adf-60fccaaf39f4` dentro de la instalación.
- Los siete artefactos instalados coinciden con el descriptor del candidato. `data.json` mantiene el mismo SHA-256 después de instalar, recargar y comprobar la interfaz. No se aplicaron recuperaciones, abandonos ni modificaciones del catálogo privado.
- Obsidian 1.14.5 carga AutoOC 1.7.12 y muestra 42 workflows, 36 tareas y 498 pasos Code. Se comprobó diseño estrecho y ancho, búsqueda de workflow, selección del paso Code, apertura de su log, navegación al paso con Play/Disable/Edit Code, conservación de selección al regresar, plegado/expansión de áreas y visualización gris de desactivados.
- Se deja el Dashboard abierto, sin búsqueda ni filtro de atención, con desactivados ocultos. No se ejecutaron tareas privadas; las transiciones dinámicas y la continuidad del foco se verificaron con dobles, no iniciando ejecuciones reales en la bóveda del usuario. No se acredita una medición de rendimiento bajo carga de proveedores.

Evidencia local: `.tmp-areas-focused-final.log`, `.tmp-areas-build-final.log`, `.tmp-areas-suite.log`, `.tmp-areas-pack.log`, `.tmp-areas-package.json`, `.tmp-areas-install.json` y `.tmp-areas-affected.txt`.

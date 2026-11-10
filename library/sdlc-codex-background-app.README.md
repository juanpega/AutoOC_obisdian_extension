# SDLC Codex v2 — botones, archivos y cierre

Importa [sdlc-codex-background-app.json](sdlc-codex-background-app.json) en AutoOC y filtra por **Codex dev**. Contiene **12 tareas Codex y 14 workflows**. Configura el directorio del repositorio y el modelo Codex predeterminado en AutoOC.

Si ya importaste v1, importar este archivo no actualiza esos objetos: crea otros y puede añadir sufijos a nombres repetidos. Identifica y deja de usar los workflows anteriores para no mezclar ambos ciclos. No se modifica automáticamente tu configuración de AutoOC.

## Qué botón pulsar

Cada fila representa un lanzamiento manual. Espera a que termine antes de pasar al siguiente. Para el ciclo de un requisito, utiliza los botones de **Workflows**, no sus tareas internas.

| Orden | Botón en AutoOC | Entrada | Salida |
|---|---|---|---|
| 1 | WF `01_codex_enriquecer_entradas` | Quick notes, bugs/features, deuda, requisitos existentes y código | Añade nuevos requisitos a `02_Requisitos.md` y marca `[x]` únicamente las entradas fuente capturadas |
| 2 | WF `02_codex_generar_sprints` | Pendientes de `02_Requisitos.md` y código | Escribe `03_SPRINTs.md`; después marca `[x]` en `02` y registra `Estado: Priorizado en sprint` |
| 3 | WF `03_codex_plan_sprint` | Primer pendiente del sprint, su original y código | Guarda `plan.md` y fija ID/ejecución en `04_Trabajo_actual.json` |
| — | Tú revisas el plan guardado | `plan.md` | Si requiere ajustes, puedes repetir 03: replanifica el mismo ID y conserva el expediente anterior |
| 4 | WF `04_codex_build_sprint` | Estado activo y plan guardado, original y código | Modifica código/tests; guarda `implementacion.json` y `implementacion.md` |
| — | Tú revisas diff, validaciones y pruebas manuales pendientes | Código y `implementacion.md` | Decides aceptar o solicitar cambios |
| 4c, si quieres cambios | WF `04c_codex_feedback_implementacion` | `feedback.md`, plan, implementación y código actual | Aplica observaciones; archiva el feedback y crea `implementacion-revision-NNN.*` |
| 4a | WF `04a_codex_commit_requisito` | Estado activo, resultado de implementación y diff real | Codex prepara la lista cerrada y un Step Code crea el commit local limitado al requisito |
| 4b | WF `04b_codex_cerrar_requisito` | Estado, plan, implementación, original y commits | Original marcado [x], copia retirada del sprint, `cierre.json` y `cierre.md` |
| 4d | WF `04d_codex_commit_expediente_sdd` | Requisito cerrado y Markdown de su expediente | Commit documental separado `docs(sdd)`; excluye JSON runtime y conserva staging ajeno |
| 5 | WF `07_codex_plan_qa` | Cambios confirmados y CSV existente | Actualiza `qa/plan-de-pruebas.csv`, sin ejecutar casos |
| — | Tú ejecutas QA y registras resultados; usas la tarea `09_codex_commit_cambios_app` con alcance explícito si corresponde | CSV y correcciones | Cambios confirmados |
| 6 | WF `05_codex_pre_pr_review` | Diff/commits confirmados, código y tests | Escribe `05_Tasks_before_to_merge_main.md` |
| 7, si hay hallazgos | WF `06_codex_remediar_pre_pr` | Informe, código actual y, si existe, decisión de solapamiento | Código/tests corregidos; si detecta intenciones incompatibles crea una decisión `PENDING` para revisión humana |
| 8 | WF `08_codex_release_notes` | Git, requisitos e informe PRE-PR | Escribe `09_Release_notes.md` |

Después de 04b, ejecuta 04d y entonces vuelve a 03 para el siguiente requisito. No necesitas regenerar todos los sprints en cada cierre: 04b retira únicamente el bloque cerrado, preserva el orden restante y puede dejar encabezados de sprint vacíos. Usa 02 cuando quieras reagrupar los pendientes.

Si `06_codex_remediar_pre_pr` encuentra cambios locales que se solapan con la corrección y expresan una intención incompatible, no los sobrescribe ni entra en un bucle de reintentos. Crea `Docs/autoOC/06_PRE_PR_decisions/<HEAD-revisado>.md` con `Estado: PENDING`, una estrategia recomendada, las rutas mínimas afectadas, límites de seguridad y criterios de aceptación. Revisa esa nota y, si estás de acuerdo, cambia únicamente `Estado: PENDING` por `Estado: APPROVED`; al volver a pulsar el mismo workflow `06`, Codex podrá modificar solo las rutas enumeradas. Una decisión queda ligada al HEAD revisado y a la rama, por lo que no autoriza futuras revisiones ni archivos adicionales.

`06a_codex_commit_remediacion_pre_pr` confirma todos los archivos versionables pendientes declarados por la remediación. Las notas runtime de `Docs/autoOC`, configuración local, secretos y artefactos generados se registran como excluidos y no se exigen dentro del commit de código.

## Diagrama de los botones del ciclo de desarrollo

Los bloques azules son botones **WF** de AutoOC. Los grises son archivos y los amarillos, acciones tuyas. Las flechas no lanzan automáticamente el workflow siguiente.

```mermaid
flowchart TD
    classDef button fill:#dbeafe,stroke:#2563eb,stroke-width:2px,color:#172554
    classDef file fill:#f3f4f6,stroke:#6b7280,color:#111827
    classDef person fill:#fef3c7,stroke:#d97706,color:#78350f

    SOURCE["ARCHIVOS · VAULT<br/>02_Requisitos.md<br/>03_SPRINTs.md"]:::file
    PLAN["PULSAR WF 03_codex_plan_sprint"]:::button
    PLANFILE["ARCHIVOS · VAULT<br/>04_Trabajo_actual.json<br/>04_Desarrollo/ID/ejecución/plan.md"]:::file
    REVIEWPLAN["TÚ revisas el plan"]:::person
    BUILD["PULSAR WF 04_codex_build_sprint"]:::button
    RESULT["ARCHIVOS<br/>Repositorio: código y tests<br/>Vault: implementacion.json y .md"]:::file
    ACCEPT["TÚ revisas el resultado<br/>¿Aceptas o solicitas cambios?"]:::person
    FEEDBACKFILE["ARCHIVO · VAULT<br/>feedback.md<br/>Escribes cambios solicitados"]:::file
    FEEDBACK["PULSAR WF 04c_codex_feedback_implementacion"]:::button
    REVISION["ARCHIVOS · VAULT<br/>feedback-NNN.md<br/>implementacion-revision-NNN.json y .md"]:::file
    COMMIT["PULSAR WF 04a_codex_commit_requisito"]:::button
    CLOSE["PULSAR WF 04b_codex_cerrar_requisito"]:::button
    HISTORY["ARCHIVOS · VAULT<br/>02_Requisitos.md: Estado Implementado<br/>03_SPRINTs.md: requisito marcado x<br/>Expediente: cierre.json y cierre.md"]:::file
    SDDCOMMIT["PULSAR WF 04d_codex_commit_expediente_sdd"]:::button
    GITHISTORY["COMMIT GIT DOCUMENTAL<br/>plan.md, implementacion*.md,<br/>feedback-NNN.md, remediacion-NNN.md y cierre.md"]:::file

    SOURCE -->|"lee el requisito pendiente"| PLAN
    PLAN -->|"guarda"| PLANFILE
    PLANFILE --> REVIEWPLAN
    REVIEWPLAN -.->|"si lo aceptas, pulsa"| BUILD
    PLANFILE -->|"lee exactamente ese ID y plan"| BUILD
    BUILD -->|"guarda"| RESULT
    RESULT --> ACCEPT
    ACCEPT -.->|"si quieres cambios, escribe"| FEEDBACKFILE
    FEEDBACKFILE -->|"lee observaciones"| FEEDBACK
    FEEDBACK -->|"modifica código/tests y guarda historial"| REVISION
    REVISION -->|"vuelves a revisar; el ciclo puede repetirse"| ACCEPT
    ACCEPT -.->|"si lo aceptas, después pulsa"| COMMIT
    RESULT -->|"delimita archivos"| COMMIT
    COMMIT -.->|"cuando termine el commit, pulsa"| CLOSE
    RESULT -->|"evidencia de implementación"| CLOSE
    CLOSE -->|"verifica Git y actualiza"| HISTORY
    HISTORY -.->|"después pulsa"| SDDCOMMIT
    SDDCOMMIT -->|"versiona solo el expediente legible"| GITHISTORY
    GITHISTORY -.->|"para el siguiente requisito, vuelve a pulsar"| PLAN
```

## Archivos y fuente de verdad

Todas las rutas siguientes son relativas al **vault**, salvo código/tests y `qa/plan-de-pruebas.csv`, que pertenecen al **repositorio configurado**. Los archivos de desarrollo se crean al ejecutar los workflows; importar el JSON no los crea.

```text
Docs/autoOC/
├── 02_Requisitos.md                    # Maestro: [ ] sin priorizar; [x] enviado a sprint
├── 03_SPRINTs.md                       # Cola operativa: [ ] pendiente; [x] implementado
├── 04_Trabajo_actual.json              # Runtime mutable; 04d no lo versiona
├── 04_Desarrollo/
│   └── REQ-.../
│       └── run-.../                    # Un expediente por planificación
│           ├── plan.md                # SDD versionable: requisito literal + plan
│           ├── implementacion.json    # Archivos y validaciones estructuradas
│           ├── implementacion.md      # SDD versionable: resultado legible
│           ├── feedback.md            # Formulario runtime; no se versiona con 04d
│           ├── feedback-NNN.md        # SDD versionable: feedback aplicado
│           ├── implementacion-revision-NNN.json
│           ├── implementacion-revision-NNN.md # SDD versionable
│           ├── validacion-manual.md     # Evidencia manual solicitada por un cierre bloqueado
│           ├── cierre.json            # Commits y aceptación verificada
│           ├── cierre.md              # SDD versionable: resumen histórico
│           └── antes-del-cierre.json  # Recuperación de originales previos al cierre
├── 05_Tasks_before_to_merge_main.md
├── 06a_Enriched_B&HVf.md                # Backlog legado, si existe
└── 09_Release_notes.md
```

No hay un segundo archivo maestro de requisitos implementados. En `02_Requisitos.md`, `[ ]` significa «todavía sin priorizar» y `[x]` significa «ya enviado a un sprint»; el campo `Estado` distingue `Priorizado en sprint` de `Implementado`. En `03_SPRINTs.md`, `[ ]` significa «pendiente de implementar» y `[x]` significa «implementado y cerrado». Los expedientes añaden trazabilidad. En el enriquecimiento, el Step 3 marca `[x]` el checkbox raíz de Quick notes, bugs o deuda solo cuando el requisito correspondiente se ha validado y escrito. Los placeholders vacíos, duplicados omitidos y entradas rechazadas permanecen sin marcar.

Por seguridad, `02_codex_generar_sprints` se bloquea si `03_SPRINTs.md` todavía contiene requisitos pendientes. Así no sobrescribe una cola de trabajo activa ni pierde requisitos ya priorizados.

Después de priorizar, el Step 1 de `03_codex_plan_sprint` debe leer y validar el requisito exclusivamente en `03_SPRINTs.md`. No debe compararlo literalmente con `02_Requisitos.md`, porque allí el mismo requisito ya tiene `[x]`, `Estado: Priorizado en sprint` y metadatos de asignación.

El cierre añade al bloque original fecha, commits, PR si existe y enlace/ruta de evidencia. **Implementado no significa mergeado ni publicado.** PR puede quedar pendiente. No se crea PR, no se hace push ni merge.

La etapa activa avanza `planned → implemented → closed`. Mientras está en `implemented`, 04c puede ejecutar tantas revisiones como sean necesarias sin seleccionar otro requisito. El resultado puede registrar validaciones pendientes; eso nunca equivale a cierre. 04b exige evidencia suficiente, commits verificables y ausencia de cambios sin commit en los archivos declarados. Si una validación manual no tiene evidencia, bloquea: pulsar el botón no cuenta como haberla ejecutado.

El historial de validaciones de `implementacion.json` se conserva tal como se registró. Si se resuelve una validación después, el cierre debe citar nueva evidencia verificable; no se reescribe retroactivamente el resultado original.

## Plan e implementación ya están conectados

04 lee el plan persistido por 03 y comprueba ID, ejecución, raíz, rama, HEAD y texto original. No vuelve a seleccionar el primer pendiente. Reordenar los sprints no cambia el ID activo.

Si cambia HEAD antes de implementar, vuelve a ejecutar 03: replanifica el ID activo y conserva el plan anterior en su expediente. No se puede planificar otro ID mientras exista una implementación sin cerrar. Si modificas el requisito original después de planificar o abandonas una implementación, hace falta revisar/restablecer el estado de forma explícita; este paquete no incorpora una operación automática de abandono, reapertura o recuperación de trabajo parcial.

Para solicitar correcciones, pulsa 04c una primera vez: si falta, crea `feedback.md` y termina sin modificar código. Escribe observaciones concretas bajo `## Cambios solicitados` y vuelve a pulsar 04c. Cada ejecución correcta archiva el texto, actualiza la evidencia activa y deja un formulario vacío para otra ronda. Si falla una ejecución antes de guardar su resultado, no supongas que no modificó código: inspecciona el diff antes de repetirla.

El workflow 04a usa el resultado guardado para delimitar el commit de código. Codex trabaja con `workspace-write` y solo analiza/valida; no necesita escribir en `.git`. Un tercer Step Code con terminal habilitado vuelve a comprobar raíz, rama, HEAD y rutas, crea el commit mediante `git commit --only`, verifica su contenido, conserva cualquier staging ajeno y guarda `commit.json`. Los documentos del expediente no se incluyen automáticamente. Si el vault usa Git, versiona sus notas por separado con el alcance apropiado.

04b toma `commit.json` como fuente de verdad del alcance confirmado. Verifica en background que el commit pertenece al expediente, que sus archivos no tienen cambios posteriores y que los criterios están demostrados antes de marcar el requisito como implementado. Si falta evidencia, conserva `stage: implemented`, registra `cierre-bloqueo-NNN.*` y crea `validacion-manual.md`; completa allí fecha, entorno, pasos y resultado real antes de repetir 04b. Si el archivo ya procedía de una versión anterior, añade la nueva sección sin sobrescribir su contenido. Para actualizar solo esta parte en una instalación existente, importa `wf-04b-codex-close-requirement.json` y usa `04b_codex_cerrar_requisito_con_riesgo_v2`.

Si decides cerrar sin ejecutar una validación pendiente, `validacion-manual.md` ofrece una sección de **Aceptación explícita de riesgo**. Debes marcar exactamente su casilla y rellenar Responsable, Fecha y Motivo. Al repetir 04b, el criterio queda registrado como `NO VERIFICADO — riesgo aceptado`, no como prueba superada. Sin los cuatro datos completos, el cierre continúa bloqueado.

04d crea ese commit SDD separado después del cierre. Incluye obligatoriamente los Markdown existentes del expediente (`plan.md`, `implementacion*.md`, `feedback-NNN.md`, `remediacion-NNN.md`, `validacion-manual.md` y `cierre.md`). Excluye `04_Trabajo_actual.json`, el formulario `feedback.md`, copias de recuperación, bloqueos y todos los JSON runtime. Los documentos compartidos `02_Requisitos.md` y `03_SPRINTs.md` solo se incluyen si Codex demuestra que todos sus cambios pendientes pertenecen al requisito cerrado. Para instalar únicamente esta ampliación, importa `wf-04d-codex-commit-sdd-dossier.json` y usa `04d_codex_commit_expediente_sdd_seguro`.

## Backlog legado

Para `06a_Enriched_B&HVf.md`, usa `03_codex_plan_bugs_legacy` y `04_codex_build_bugs_legacy`. Después usa los mismos 04a y 04b. El cierre marca el original legado y no modifica los sprints de `02_Requisitos.md`. Todos los requisitos deben tener ID estable `REQ-...`. Las entradas nuevas se enriquecen en 02; revisa duplicados antes de migrar requisitos entre archivos.

## Ejecución y límites

- Todos los botones son manuales. Background significa no abrir la app, no una programación periódica.
- 01, 02, 04, 04a, 04b, 04c, 04d, 05, 07 y 08 usan Codex en background con `approvalPolicy: never`; planificación y remediación PRE-PR abren la app con aprobación bajo demanda. Si Git detecta `dubious ownership`, 04a, 04b y 04d utilizan `-c safe.directory=<repositoryRoot>` solo en cada comando y nunca modifican la configuración global.
- Abrir la app no constituye una pausa formal ni garantiza enfocar el hilo concreto. Usa la acción de abrir hilo de AutoOC si hace falta.
- El modelo y repositorio proceden de la configuración de AutoOC. No se usan OpenCode, transiciones eval ni cambios de rama automáticos.
- Ejecuta un solo workflow mutador por repositorio/vault. El estado evita una segunda planificación incompatible, pero no es un lock atómico entre procesos.
- El cierre valida antes de modificar y guarda una copia de recuperación. Si una escritura falla, intenta restaurar los originales. No es una transacción resistente a caída del proceso ni a ediciones externas simultáneas; en ese caso inspecciona `antes-del-cierre.json` y los documentos antes de repetir. Los informes de cierre huérfanos de un intento fallido no significan que el estado sea closed.
- No hay disparadores de CI. La verificación final de Git de 04b usa comandos locales de lectura desde el directorio configurado.
- 04a no bloquea el commit por errores exclusivos de artefactos locales ignorados y no versionados, como `.next/dev/types`; los registra como validación ambiental no ejecutable. Sí bloquea si el error alcanza código fuente, el artefacto está versionado o falta evidencia alternativa para una comprobación crítica.
- No se ejecuta limpieza automática de GitNexus. Los prompts respetan AGENTS.md para análisis de impacto y validación de cambios.

## Validación del paquete

Ejecuta `node --test tests/sdlc-workflow-package.test.cjs`. Comprueba el validador real de importación, sintaxis, área, plan persistido, selección fija, cierre, bloqueo de evidencia incompleta, Git cambiado, restauración tras fallo de escritura y compatibilidad legacy.

Estas pruebas usan un vault y Git simulados; no prueban la calidad del análisis de Codex ni ejecutan una importación o workflow real en tu vault.

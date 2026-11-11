---
name: autooc-runtime
description: Consultar y ejecutar AutoOC desde un agente y editar workflows compatibles con Obsidian abierto. Usar para descubrir la CLI instalada, conservar identidades y resolver conflictos o recuperación con evidencia.
---

# AutoOC desde un agente

## Alta de páginas por CLI (candidato de desarrollo)

Requiere `pageCreation:1` en CLI y propietario. Consultar primero `version` y `help`
de la instalación seleccionada. `create-page --vault ROOT --request REQUEST_JSON`
acepta un JSON regular de hasta 60 KB; las tres rutas son absolutas al invocar
`node CLI`. `inspect-page-request --vault ROOT --request-id ID` consulta el recibo.

Campos: `requestId` estable, `name`, `objective` opcional y `mode` (`create`, `link`
o `folder`). `create` exige `repository`, `branch` nueva y `base`; los otros modos
exigen `directory` existente. Git conserva el checkout principal y staging.
`allowGitignoreUpdate` vale false por defecto; true autoriza la exclusión necesaria
en ese repositorio. También se respeta su aceptación previa guardada. No activa
worktrees: esa preferencia debe estar habilitada previamente en Settings para
`create` y `link`; `folder` no requiere Git ni dicha preferencia.

Para preparar un requisito y lanzar trabajo desde una tarea/workflow, añadir
`launch: {"workflowId":"ID"}` o `launch: {"taskId":"ID"}` a la petición. Usar el ID
del catálogo compartido. La recepción durante una ejecución devuelve `queued`,
`created:false` y una identidad reservada de página, no una ejecución terminada.
El padre continúa; el propietario crea y lanza una sola vez cuando los runs de
los que depende hayan terminado correctamente y la instalación esté inactiva.
Fallo, cancelación o incertidumbre del padre bloquean la petición. No esperar al
hijo dentro del padre ni sustituir este recorrido por un `run` recursivo.

Con propietario Obsidian, la cola se atiende mientras ese plugin sigue abierto.
Un propietario CLI autónomo atiende estas peticiones durante sus tareas y procesa
la cola después de completar su ejecución principal, en el mismo proceso. No hay
daemon ni transferencia automática a otro host. Sin propietario, `create-page`
procesa su petición en primer plano. Se conservan los límites y la exclusión.

La respuesta incluye `requestId`, `pageId`, `status`, `created`, carpeta/datos Git
observados, runs de los que depende y `launchRunId`/`launchPhase` cuando existen.
Exit 0 puede significar recepción en cola: mirar `status` y `created`. Exit 1 indica
rechazo/resultado pendiente de revisión o hijo fallido. La inspección es de lectura
y no modifica el estado. Nunca inferir que el requisito terminó por tener página.

Reintentar con el mismo `requestId` y los mismos parámetros conserva la identidad;
otro contenido con ese ID se rechaza. Tras perder una respuesta, consultar antes.
Después de reiniciar no se procesan peticiones antiguas automáticamente. Un reenvío
explícito permite continuar `queued`, `environment` (Git terminó, falta registro)
o `created` (falta el lanzamiento), tras validar nuevamente el entorno. Un estado
`preparing`, `launching` o `needs-review` conserva efectos inciertos; no reenviarlo
con otra identidad ni borrar reservas o entornos. Si existe `launchRunId`, usar
status y las operaciones oficiales de esa ejecución antes de decidir cómo seguir.
Un bloqueo previo a efectos por consentimiento/configuración requiere corregir la
causa y una nueva petición revisada; no es un reintento de una operación incierta.

`requirementId` y `requirementText` opcionales transportan una versión explícita del
requisito. El texto queda en `.autooc/requirement.md` dentro de la página, con hash;
los prompts AI reciben la referencia y Code puede leerla con `codeAllowVault:true`.
Si el archivo cambia, la ejecución se rechaza. El archivo puede quedar sin seguimiento;
no se hace commit, copia de secretos ni preparación de dependencias. La salida CLI
no vuelca el objetivo ni el requisito. Estos campos son de petición/estado local,
no campos nuevos del JSON importable de tareas o workflows. No ampliar permisos.

## Selección coherente de Codex (candidato de desarrollo)

`codexPath` selecciona la misma instalación para App Server, terminales manuales,
tareas CLI interactivas, workflows, consulta de modelos y creador IA. Una ruta
explícita manda. Un nombre se busca primero en PATH; `codex` admite después
ubicaciones conocidas y, al final, el ejecutable incluido con la aplicación.
En Windows se resuelve el shim npm al binario nativo de esa misma instalación.
No se cambia de instalación por incompatibilidad ni se editan catálogos al detectar.

Settings > Harnesses > Codex CLI muestra la ruta efectiva compartida. Check version
consulta explícitamente versión y ayuda de ese ejecutable; App Server anunciado
no acredita login ni ejecución real. Abrir Settings no consulta el proveedor.
Un shim Windows sin binario nativo no se lanza como proceso App Server.

`taskKind: "codex"` sigue usando App Server: `interactiveTerminal: false` o ausente
significa segundo plano sin aplicación gráfica; `true` abre además la conversación
en la aplicación y conserva las aprobaciones y espera del resultado del turno.
La terminal es otra modalidad: `taskKind: "cli"`, `cliProvider: "codex"`,
`interactiveTerminal: true`; conserva su contrato de confirmar solo el lanzamiento.
No convertir modos ni modelos de tareas existentes; no hay un modo Codex global.
No generar rutas de ejecutable como campos de tarea/workflow. Cerrar Obsidian no
traspasa una ejecución del plugin a la aplicación. Verificar candidato e instalación
antes de atribuir este cambio a una entrega con el mismo número de versión.

## Páginas de trabajo (candidato en desarrollo, feat/pages-worktrees)

Dashboard incorpora Main workspace y páginas con carpeta propia. El botón O junto a
Dashboard abre Overview; Dashboard vuelve a la última página de trabajo visitada.
Overview no ocupa una pestaña en la fila de páginas. Tasks y
WorkFlows siguen siendo el catálogo global. Todas las páginas muestran automáticamente
el mismo Dashboard de áreas, tareas, workflows y pasos de Main workspace, sin seleccionar
enlaces ni importar copias. Las definiciones nuevas también aparecen automáticamente.
Cada página muestra únicamente sus resultados, logs e historial; editar una definición
afecta al catálogo compartido. Open controls permite Run task here o Run workflow here;
seleccionar un paso ejecuta su workflow completo, no el paso aislado. Los campos locales
históricos taskIds/workflowIds se conservan por compatibilidad y ya no filtran el Dashboard.
Overview permite consultar actividad/logs, navegar y eliminar una página archivada
sin historial mediante Delete page; los controles de ejecución
y confirmación de sesiones están en cada página. La creación de páginas se abre
desde Main workspace u otra página mediante + New page; el usuario elige su nombre.
Main workspace muestra la carpeta de trabajo predeterminada y su rama Git actual,
consultada al abrir la vista o pulsar Refresh branch. Distingue Detached HEAD,
carpeta sin repositorio y errores de consulta; no cambia de rama. Una tarea con
carpeta propia conserva esa configuración. Los IDs internos main/general no cambian.
Los worktrees se habilitan expresamente en Settings > Execution > Git worktrees
(developers), apagado por defecto. Activarlo no prepara carpetas ni Git.
Existing folder usa directamente esa carpeta, sin crear una rama ni aislar archivos.
El formulario y la página lo explican; New Git worktree crea el entorno independiente.
La creación pide repositorio, rama y base; avisa antes de añadir
`/.autooc/worktrees/` a `.gitignore` y admite recordar la aceptación por proyecto.
No hace staging, commit, instalación de dependencias ni copia de secretos.
Al vincular un worktree existente, el repositorio se obtiene del registro de Git;
se admiten también worktrees de un repositorio bare. La carpeta de metadatos Git
no se interpreta como si siempre fuera una carpeta .git dentro del proyecto.

Cada ejecución de página congela su definición, carpeta y objetivo; conserva su
journal y resumen local sin proyectar resultados en la definición global.
Las tareas sin workingDirectory heredan la carpeta. Se rechazan rutas fijas
externas, cambios de rama de tarea y handoffBranch. Code conserva sus permisos
explícitos: su API vault opera sobre archivos de la carpeta de página, no sobre
app.vault de la bóveda anfitriona. No se reescriben rutas incluidas en scripts.
Los archivos no versionados, dependencias, servicios y puertos se preparan aparte.

CLI abierto desde una página mantiene su carpeta al cambiar de pestaña.
Antes de abrir una nueva sesión comprueba la misma identidad de carpeta,
repositorio y rama vinculada que una ejecución de workflow. Si se cambió de rama
fuera de AutoOC, hay que revisar el entorno; no se abre una CLI sobre otra rama
silenciosamente. Recuperar una terminal ya abierta solo muestra esa sesión.
Las sesiones integradas se asocian a su página y a una reserva concreta. Volver
a la página selecciona su terminal sin iniciarla de nuevo; CLI recupera la sesión
viva y Open terminal permite consultar su salida. La carpeta de la sesión no cambia.
La salida nativa y el cierre confirmado liberan automáticamente esa reserva, después
de publicar cualquier ejecución en curso. Un fallo de guardado conserva la reserva.
Perder la conexión, ocultar el panel o desacoplar la terminal no acredita el cierre.
Las ventanas externas y las sesiones cuya observación se perdió al reiniciar requieren
Confirm session ended, tras cerrar también sus procesos externos. La confirmación
no mata procesos y no se admite mientras la sesión siga observada como abierta.
No hay reconexión automática a una terminal de una instancia anterior de Obsidian.
La evidencia nativa corresponde al proceso de la terminal y su cleanup; no descubre
servicios que un agente haya lanzado por separado. Su gestión sigue siendo explícita.

Dos escritores con contexto de página pueden usar Main workspace y un worktree
interior si Git confirma raíces registradas distintas y la carpeta interior está
ignorada. Carpetas normales anidadas, alias de la misma raíz y errores de inspección
mantienen la exclusión. Las políticas exclusivas y las ejecuciones generales sin
contexto de página conservan sus restricciones; este contrato no es un sandbox.
Las tareas interactivas en páginas se admiten solas o en un workflow de un solo
paso y crean la misma reserva antes de abrir la terminal. Una apertura no autoriza
pasos posteriores que escriban mientras la sesión sigue viva. Los workflows
mixtos con terminales interactivas se rechazan antes de comenzar.
Default CLI task mode inicializa tareas nuevas: no convierte tareas antiguas en
interactivas ni crea reservas de terminal para ejecuciones en segundo plano.
Se respeta interactiveTerminal; taskKind cli siempre requiere modo interactivo.
Un workflow antiguo con un único paso taskId y sin stepKind conserva su soporte.

La CLI del candidato anuncia pageSelection:1. Los comandos existentes, sin --page,
continúan en Main workspace con sus carpetas de tarea y comportamiento previo.
--page main es un alias explícito de ese comportamiento. Las programaciones no cambian.
La carpeta de la consola y la página visible en Obsidian no seleccionan un contexto.

`pages --vault ROOT` lista los IDs y carpetas configuradas, incluyendo Main workspace.
No crea páginas ni consulta Git; la rama mostrada es la registrada en la configuración.
No publica objetivos, prompts ni resultados. `status --vault ROOT --page PAGE_ID`
muestra los journals de esa página. ROOT siempre identifica la bóveda que contiene
la instalación y el catálogo, no la carpeta del worktree.

Para ejecutar fuera de los botones, añadir `--page PAGE_ID` a run/resume/reconcile/stop,
manteniendo --workflow o --task y, donde corresponda, --run. Usar los IDs de `pages`,
no sus nombres visibles. Ejemplos con los mismos marcadores CLI/ROOT de esta guía:

```text
node CLI run --vault ROOT --workflow WORKFLOW_ID
node CLI run --vault ROOT --workflow WORKFLOW_ID --page PAGE_ID
node CLI resume --vault ROOT --workflow WORKFLOW_ID --run RUN_ID --page PAGE_ID
node CLI stop --vault ROOT --workflow WORKFLOW_ID --run RUN_ID --page PAGE_ID
```

Un ID desconocido, Overview, una página archivada al iniciar trabajo o un contexto
incompatible producen rechazo, sin ejecución alternativa en Main workspace.
--step sigue disponible en Main workspace; las páginas requieren workflow o tarea
completos. La continuación conserva la definición congelada y la identidad de página.

Con AutoOC activo, la petición lleva pageId al propietario y requiere que el host
anuncie pageSelection:1; un plugin antiguo se rechaza antes de enviar la petición.
Sin propietario, la CLI usa el mismo runtime de páginas autónomamente y conserva sus
journals y resultados separados del catálogo global. Las tareas integradas necesitan
Obsidian abierto y se mantienen las restricciones de secretos/capacidades del host.
El paralelismo delegado respeta las políticas de ejecución y distingue el mismo
workflow en páginas distintas. Sin Obsidian se mantiene un propietario autónomo
por instalación; no se añade un daemon ni se permite competir entre procesos CLI.
Cerrar Obsidian no transfiere automáticamente una ejecución ya iniciada por el plugin.

Finish work revisa actividad y cambios antes de archivar la página. Por defecto
conserva la carpeta y la rama; Archive page no hace merge ni descarta archivos.
El diálogo mantiene Archive page, Refresh review y Cancel fuera del área desplazable.
Indica junto a la confirmación si está listo o qué actividad impide archivar; un fallo de
inspección ofrece Retry review. El diff es desplegable, con altas verdes, bajas rojas y
rangos azules, renderizado como texto. Changes es solo una vista previa con Close preview:
para archivar se usa Finish work. Un éxito confirma el archivo y cómo restaurarlo.
El diff compara con el commit de creación del worktree o HEAD, incluyendo cambios staged
y unstaged; no ejecuta external diff ni textconv. No incluye contenidos sin seguimiento.
Las vistas grandes se acotan con aviso; el usuario revisa el diff completo en su herramienta Git.
Al terminar vuelve a Main workspace. Las páginas archivadas salen de las pestañas
habituales y siguen accesibles desde Overview para consultar su historial.
La opción Remove worktree folder permite retirar un worktree Git vinculado limpio,
con confirmación explícita de cierre de sesiones externas y servicios. Conserva
siempre rama, commits e historial, aunque los commits no estén integrados. La revisión
e integración se realizan con las herramientas Git del usuario; no hay merge,
commit, descarte de cambios ni borrado de rama implícitos.

La retirada exige inactividad de la instalación y comprueba de nuevo carpeta,
repositorio, rama, HEAD y registro antes de ejecutar git worktree remove sin --force.
Bloquea archivos modificados, sin seguimiento o ignorados (incluidos .env y
dependencias locales), submódulos, flags que oculten cambios, worktrees bloqueados,
enlaces/junctions, páginas anidadas y carpetas que contengan Main workspace o AutoOC.
Los archivos locales se preservan o retiran expresamente antes de volver a revisar.
Las carpetas normales solo se archivan. La inspección no hace staging ni cambia HEAD.

Antes de retirar se guarda una marca local worktreeRemoval pendiente y se archiva
la página. Un fallo de guardado previo impide iniciar Git; un resultado incierto o
fallo posterior conserva la marca. Check removal comprueba la evidencia sin repetir
la retirada. Si la carpeta sigue intacta y la operación terminó bajo el mismo
propietario, puede conservarla como página archivada; tras cambio de propietario
ese caso exige Keep worktree after review y confirmación explícita de haber revisado
la carpeta y cerrado el proceso Git anterior y sus sesiones. No asumir esa confirmación
ni usarla para saltar una reserva activa. Si carpeta y registro ya no existen y la rama
conserva el commit revisado, puede registrar la retirada completada. Una página
retirada conserva logs, pero no ofrece Restore page ni admite run/resume/reconcile.
pages expone solo el estado pending/removed, nunca la evidencia interna completa.
Estos campos son estado local; no deben generarse en JSON de tareas o workflows.
Las comprobaciones no aíslan frente a procesos externos que sigan escribiendo;
la confirmación de cierre de sesiones debe incluir esos procesos.

La integración/merge automática y workflow coordinador paralelo
pertenecen a entregas posteriores. Comprobar hashes y GUI antes de atribuir estas
capacidades a una instalación publicada con el mismo número de versión.

### Delete page: eliminar una página archivada vacía

Overview y la página archivada ofrecen Delete page. Tras confirmar, elimina solo
su configuración local: conserva carpeta, archivos, worktree/rama y el catálogo
global de tareas/workflows. No crea un respaldo ni ofrece Restore page después;
puede crearse una página nueva para la carpeta conservada.

Solo se admite una página archivada sin pageRuns y sin worktreeRemoval, incluso
si la retirada ya terminó: las páginas que guardan historial o evidencia se conservan.
Main no se puede eliminar. Se vuelven a comprobar identidad de página, propietario,
inactividad, sesiones y guardados; un fallo de persistencia no autoriza repetir ni
editar data.json manualmente. El guardado participa en el drenaje del propietario.
Esta operación no añade campos al esquema importable ni un comando CLI.

Finish work, Discard work y Delete page mantienen nombre y ruta completa en un
encabezado fijo, con ajuste de líneas; solo el cuerpo de revisión se desplaza.
El pie conserva los botones. Existing folder explica que Discard work no existe
para esa página porque no creó un worktree independiente, aunque no tenga cambios.

### Discard work: eliminación explícita del entorno y la rama local

Discard work es una operación diferente de Archive page y Remove worktree folder.
Solo se ofrece para worktrees Git independientes. Revisa diff, archivos locales
(incluidos ignorados y sin seguimiento), número de archivos y commits desde el
commit de creación o HEAD del repositorio para worktrees vinculados. El listado
de commits muestra hasta 50; no afirma que sean todos exclusivos de esa rama.
El usuario escribe exactamente la rama y confirma que acepta perder archivos y
la rama local y que ha cerrado sesiones, servicios y procesos Git anteriores.

No se ofrece para Main ni carpetas ordinarias. Bloquea carpetas protegidas o
compartidas, ramas principales, defaults remotos observados, ramas usadas por otro
worktree, enlaces/junctions, repositorios anidados, submódulos, worktrees bloqueados y flags de
índice que oculten cambios. Revisa el contenido completo, incluido el índice, con
límite de 20 000 entradas y 512 MB: superar ese límite exige revisión manual, no
una confirmación que omita controles. Cambios tras la revisión obligan a refrescar.

Antes del efecto se guarda worktreeRemoval con mode discard y la prueba revisada.
Git retira únicamente el worktree autorizado con una sola opción force; la rama
local se elimina comparando su commit con el observado. No hay borrado recursivo
alternativo, merge, pruning, borrado remoto ni ejecución de tareas. El historial
permanece; la página queda archivada sin Restore page. AutoOC no guarda una copia
recuperable de los archivos descartados. Los procesos externos deben haber terminado:
estas comprobaciones no son aislamiento frente a escritores externos simultáneos.

Si hay un fallo, Check discard solo verifica el resultado. Si todo desapareció,
registra la terminación sin repetir el efecto. Si la carpeta permanece, conserva
el flujo de revisión para mantenerla archivada. Si solo queda la rama, Discard work
vuelve a revisar y exige una nueva confirmación para borrarla. Evidencia cambiada o
incompleta bloquea la operación; no borrar reservas ni forzar una recuperación.
Estos datos son locales y nunca se generan como campos JSON de tareas/workflows.

## Terminales CLI integradas y Settings (candidato 1.7.22)

En el candidato de Settings ordenados, `Settings > AutoOC` se agrupa en General,
Harnesses, Terminals, Execution, Logs, Library y Maintenance. Se retira el control
de tamaño de burbujas: tareas y pasos quedan fijos a 30 px, sin cambiar las letras.
Los valores históricos se conservan pero no se aplican; no se migra el catálogo.
Las rutas, visibilidad y defaults de cada CLI se reúnen
en Harnesses; Check version está disponible para todos, sin acreditar login.
OpenCode 2 también muestra tablas refrescables de sus propios modelos/agentes por
proyecto. Ralph Loop permanece específico de OpenCode 1; no anunciarlo para otros
motores. Abrir Settings no autoriza instalar soporte, cambiar configuración global
ni consultar proveedores automáticamente. Comprobar hashes/carga del candidato.

`Settings > AutoOC > Terminals > Interactive CLI launchers > CLI terminal destination` elige
terminal integrada o ventana externa para sesiones manuales y tareas CLI
interactivas de todos los harness, tambien dentro de workflows. No cambia tareas en
segundo plano, Code ni la apertura de la aplicacion Codex. Las integradas
requieren Windows x64 o macOS Intel/Apple Silicon, Node.js 18+, soporte PTY
instalado expresamente en ese ordenador y AutoOC cargado. Linux aun no dispone
de PTY integrado. En Mac, Terminals > Download and install terminal support
instala los prebuilds verificados de ambas arquitecturas y configura el permiso
ejecutable de spawn-helper, sin npm scripts ni compilacion local. El host Node
elige el binario de su propia arquitectura, aunque Obsidian use otra via Rosetta.
El PATH de la sesion conserva prioridad y se completa con Homebrew, ubicaciones
habituales del usuario y la carpeta de la CLI; no se ejecutan perfiles de shell
ni se modifica el entorno global. La CLI se lanza directamente con argumentos
literales, sin PowerShell. Stop solicita SIGHUP a su instancia y espera salida
nativa y limpieza; un timeout conserva la observacion y no acredita fin del proceso.
Actualizar el plugin no instala automaticamente el soporte opt-in.

El editor ofrece `CLI task (interactive)` con un selector `Harness`: OpenCode 1,
OpenCode 2, Codex CLI, GitHub Copilot CLI y Claude Code CLI. Se guarda/exporta como
`taskKind:"cli"`, `cliProvider:"opencode"|"opencode2"|"codex"|"copilot"|"claude"`
y `interactiveTerminal:true`. Prompt obligatorio; modelo opcional, vacio usa el
default nativo del proveedor. Agente solo para OpenCode; reasoning opcional solo
para Codex CLI. No admite permisos Code, copilotAllowAllTools, Ralph Loop ni cambios
de rama. No confundir esta tarea con Codex App o Copilot en segundo plano existentes.
Los tipos CLI OpenCode anteriores siguen funcionando sin migracion.

El destino es global y no se exporta. Las definiciones CLI genericas nuevas usan
el esquema de paquete existente (1.6.0, o 1.7.0 si anidan workflows), pero requieren
este candidato: un plugin anterior no reconoce taskKind cli aunque comparta version.
Los creadores IA siguen generando tareas no interactivas; el usuario puede crear
o seleccionar manualmente una tarea CLI, o importar una definicion revisada.

Una peticion CLI delegada al propietario Obsidian usa ese mismo destino. El host
autonomo sin plugin no puede crear una vista Obsidian: si la instalacion pide modo
integrado y el workflow contiene tareas CLI interactivas, rechaza antes de
crear el journal o ejecutar pasos, sin fallback externo. Abrir Obsidian o cambiar
el destino mediante Settings; no modificar el catalogo para forzar un reintento.
El destino no se exporta como campo de tarea/workflow ni invalida sus checkpoints.

En una tarea CLI interactiva, completar el paso confirma solo la apertura de la
terminal con su prompt/modelo/agente: el resultado humano sigue sin observarse y
el workflow conserva su contrato de continuacion. El prompt completo se mantiene
en un auxiliar propio hasta confirmar la salida/parada del proceso. Si la apertura
o parada queda incierta se conserva evidencia, sin relanzar ni limpiar por timeout.
Copilot usa --interactive, nunca su modo no interactivo -p; Codex y Claude reciben
una instruccion posicional. No se añaden autoaprobaciones o bypasses de permisos.
Las pestañas permiten cerrar sesiones con confirmacion. En el candidato de terminales
independientes, las nuevas sesiones integradas requieren ademas Node.js 18+ en PATH:
un host separado conserva el PTY y el prompt. El boton ↗ conecta la misma sesion a un
cliente local en el navegador externo; esperar la confirmacion antes de reiniciar
Obsidian o AutoOC. Solo las sesiones liberadas mediante esa confirmacion sobreviven
a la descarga del plugin; las demas se detienen normalmente. No se repite el prompt
ni se transfiere el PTY de sesiones abiertas con builds anteriores.

La URL externa contiene una credencial privada: no compartirla ni registrarla.
El servidor escucha solo en 127.0.0.1 y no descarga recursos externos. Cerrar la
pestaña no detiene el proceso: conservar la pestaña o URL para volver a acceder y
usar Detener sesion para terminarlo. No hay reintegracion automatica al recargar el
plugin. El boton ↻ de la vista integrada recalcula y repinta sin reiniciar procesos,
borrar la conversacion ni enviar entrada al agente. Comprobar hashes del candidato
y su carga real: compartir version con una publicacion anterior no acredita estas
funciones. La aceptacion visual y la continuidad nativa deben verificarse aparte.

## Workflows anidados (candidato de desarrollo)

Comprobar `version.nestedWorkflows: 1` y la capacidad del propietario cargado antes de atribuir este contrato a una instalación. Un paso `workflow` referencia `workflowId` en el catálogo; un paquete importable usa `workflowExportId` y esquema `1.7.0`, incluyendo los descendientes y sus tareas. El editor WorkFlows permite seleccionar hijos existentes; `edit-workflow` mantiene su alcance de edición de texto y no permite crear referencias estructurales.

Ejecutar, detener, reanudar o reconciliar mediante el ID del padre y su `runId`. Todo el árbol comparte journal y reserva; no lanzar al hijo separadamente para continuar un padre. La programación del hijo no se utiliza en esta invocación. Su primera entrada es la salida previa del padre, sus `outputs` son locales a la invocación y su última salida/estado alimentan la transición del padre. Se conservan el historial independiente del hijo, las identidades de tareas internas y la prohibición de repetir efectos inciertos. Una modificación de descendientes cambia el hash del padre. Se rechazan ciclos, referencias ausentes o ambiguas, más de 16 niveles y planes de más de 10.000 pasos internos. Desactivación y dependencias se validan recursivamente; los permisos Code no se amplían. Estas fuentes no acreditan instalación ni publicación.

## Recuperación directa en la interfaz (candidato 1.7.18)

`Resolve blocked executions` está disponible en el panel de consulta, ajustes y paleta, además de las tarjetas bloqueadas. Revisa tanto intentos vinculados como antiguos. `Reconnect execution controls` conserva los intentos y no reanuda tareas. `Reset this attempt…` cierra únicamente el intento observado mediante abandono/disposición oficial, con motivo y confirmación de que el trabajo externo terminó y de que sus efectos no verificados siguen desconocidos. Conserva historial, resultados y definiciones; un `Run` posterior es trabajo nuevo que puede repetir efectos.

La interfaz comprueba instalación, catálogo, journal, revisión y propietario después de confirmar. Una reserva local detenida necesita la entrega comprobada de su instancia original; una reserva de otro proceso solo puede recuperarse si su propietario está ausente. No se mata ningún proceso ni se borran reservas ajenas. Actividad local, escrituras o actualizaciones pendientes y evidencia cambiada siguen bloqueando. Si una operación informa de un fallo tras guardar una decisión, refrescar la revisión antes de volver a actuar.

Una definición modificada no puede continuar el intento original: restaurarla o revisar su cierre. La confirmación humana y la recuperación de reserva siguen siendo decisiones distintas del arranque de trabajo. Estas opciones no añaden un comando CLI ni autorizan al agente a resetear intentos por inferencia. Verificar paquete instalado y carga real antes de atribuir esta interfaz a un equipo remoto.

## Disponibilidad y pasos Code (1.7.10+)

Verificar `version` y `help` de la instalación. `catalogAvailability: 1` anuncia que `list` y `status` incluyen `disabled`, `blockedByDisabled`, `disabledReason` y `codeSteps`. La desactivación es independiente del estado guardado; un elemento sin bloqueo de desactivación todavía puede tener impedimentos de ejecución. Las consultas no prueban actividad real ni exponen prompts, código o resultados.

Con `codeStepSelection: true`, usar `--workflow WORKFLOW_ID --step STEP_ID` en `run`, `resume`, `reconcile` y `stop`. Obtener ambas identidades de `codeSteps`; las tres últimas llamadas requieren `--run RUN_ID`. Solo se ejecuta ese paso Code, con entrada y resultados previos vacíos, sin seguir sus transiciones ni sustituir el resultado del workflow completo. No combinar `--step` con `--task`. El plugin propietario debe anunciar también esta capacidad; si no, recargar el paquete compatible, nunca omitir `--step` para reintentar.

`run` y `resume` rechazan tareas, workflows y pasos desactivados, incluidas las dependencias de un workflow completo. Un paso aislado depende de su padre y del propio paso. `reconcile` y `stop` siguen disponibles para la identidad registrada sin reactivar el elemento. Enable/Disable se gestiona en Obsidian; la CLI no ofrece una operación para cambiarlo. La preferencia visual del diámetro de burbujas no cambia la disponibilidad. Ver la referencia completa de llamadas y parámetros en el README del paquete fuente.

## Concurrencia dentro del propietario

En el candidato 1.7.16, tareas y workflows heredan paralelismo dentro de la misma bóveda y sin límite del plugin por defecto. Una política explícita existente se conserva. `concurrency: "parallel"` permite compartir carpetas y repositorios con otras ejecuciones paralelas; `"exclusive"` exige ejecución en solitario; `"independent"` conserva la comprobación de espacios disjuntos. Ausente hereda `defaultConcurrency`, cuyo valor predeterminado es `"parallel"`. `maxConcurrentExecutions` es un entero seguro no negativo: `0` significa sin límite, también predeterminado. Se configuran en Settings; no existe un comando CLI para cambiarlos. El editor e importación/exportación conservan la política, y los creadores IA la omiten para heredar la elección del usuario.

Se reservan todas las tareas referenciadas del workflow completo: una tarea no se ejecuta dos veces simultáneamente ni puede compartirse entre workflows en curso. El modo `independent` sigue rechazando directorios iguales/anidados y repositorios comunes; Code con capacidades y evaluación con modelo siguen siendo exclusivos en ese modo. En `parallel`, Code conserva exactamente sus permisos y puede compartir la bóveda. Los modos interactivos y cambios de rama declarados siguen requiriendo exclusividad. Las declaraciones coordinan tareas de confianza, sin aislamiento de archivos: usar salidas diferentes para evitar sobreescrituras. Los pasos de un workflow siguen sus transiciones en orden.

GUI, programación y CLI delegada comparten el límite. El descriptor compatible anuncia `sharedWorkspaceConcurrency: true` y `concurrentExecutions`, donde `0` significa sin límite. Conservar requestId y runId; cancelar una petición solo detiene su ejecución. No hay cola ni repetición automática al alcanzar el límite; reducirlo no cancela las ejecuciones existentes. Un intento paralelo retenido mantiene sus tareas y cuenta para un límite finito, pero permite otras tareas paralelas distintas dentro del mismo propietario. Tras reiniciar el propietario, un intento pendiente sin contexto de admisión verificable sigue exigiendo recuperación oficial. No borrar reservas ni deducir abandono por tiempo. Un segundo host autónomo no puede competir con el propietario. Abrir Obsidian durante una ejecución CLI autónoma mantiene el propietario y la vista informativa, sin arrancar trabajo ni transferirlo. Estas modificaciones de fuentes no acreditan instalación, publicación ni validación GUI. Verificar versión, paquete y descriptor reales antes de atribuir capacidades.

## Editar un workflow sin cerrar Obsidian

Consultar primero `version` y `help`. Si `capabilities` incluye `export-workflow` y `edit-workflow`, usar esta vía en la bóveda autorizada con AutoOC activo. No escribir directamente `data.json`, quitar reservas ni pedir cerrar Obsidian para estas ediciones.

```text
node CLI export-workflow --vault ABS_VAULT --workflow ID --out ABS_NEW_JSON
node CLI edit-workflow --vault ABS_VAULT --workflow ID --patch ABS_PATCH_JSON
```

La exportación crea un archivo nuevo con `expectedHash` y la definición editable del workflow seleccionado, sin resultados ni historial. Preparar un patch JSON con ese `expectedHash` y `changes`, por ejemplo:

```json
{"expectedHash":"SHA256_DE_LA_EXPORTACION","changes":{"description":"Descripción revisada","stepChanges":[{"id":"PASO_EXISTENTE","code":"output = 2;"}]}}
```

Se admiten `name` y `description` del workflow y `name`, `code` o `evaluatePrompt` de pasos existentes. `code` requiere un paso Code. Mantener `changes` por debajo de 58.000 bytes UTF-8 y el archivo de patch como máximo en 60.000 bytes; dividir cambios mayores usando el hash devuelto en la última edición. La exportación es una vista editable, no un paquete importable. Esta primera versión conserva IDs, conexiones, permisos, programación, tareas asociadas y estados/historial; no crea ni elimina pasos, no edita prompts/modelos de tareas asociadas ni ejecuta el código editado.

El plugin propietario guarda mediante su cola cooperativa y devuelve un recibo durable con el hash nuevo. Ante conflicto, exportar la definición actual y revisar el cambio. Ante ejecución activa, esperar a que termine manteniendo Obsidian abierto. Tras una respuesta incierta o perdida, inspeccionar el recibo y la definición antes de reintentar: no hay fallback que escriba el catálogo por fuera del plugin.

Si el plugin cargado es anterior y no anuncia esta capacidad, preparar primero el candidato y su respaldo y recargar únicamente AutoOC una vez. Las ediciones posteriores de esta vía no requieren descargarlo. Los parches locales pueden contener código o instrucciones; mantenerlos privados y no incluirlos en informes públicos.

Volver a exportar a un archivo nuevo para comprobar el texto guardado; guardar no equivale a ejecutar ni a validar su lógica. Leer/exportar solo la definición necesaria y enviar cambios pequeños evita copiar repetidamente un catálogo grande. Conservar contenido e historial; no truncarlos para mejorar cifras. Distinguir tiempo total de guardado CLI de pausas del editor y registrar validaciones aplazadas sin presentarlas como aprobadas. Los cambios de tareas o estructura requieren otra vía soportada o una operación de mantenimiento autorizada con respaldo y solo el plugin descargado.

## Explicit abandonment (1.6.5+)

If an old result cannot be recovered, obtain explicit human authorization to accept its unknown effects. Close or disable the plugin and inspect the exact run ID, workflow ID and revision. Never steal a live execution lease. Then use:

```powershell
node $cliPath abandon --vault $vaultPath --workflow WORKFLOW_ID --run RUN_ID --revision REVISION --reason 'Human-authorized abandonment; outcome unknown' --acknowledge-unknown-effects true
```

For standalone tasks, use `@task:TASK_ID` as the workflow identity. This preserves all step evidence and a snapshot of the original checkpoint. The new state is `abandoned`, with an unknown outcome. Subsequent new work is permitted; resuming the abandoned identity is forbidden. The command does not kill external processes or prove their effects stopped. Never abandon automatically, report it as success, or substitute it for available reconciliation.

## Compatibilidad y disponibilidad

Comprobar `version` y `help` de la instalación antes de usarla; la CLI mantiene `experimental: true`. `pluginRequests: 1` identifica el protocolo para ejecutar con el plugin abierto, que requiere también un plugin compatible. Preparar y probar el paquete no significa que esté publicado ni validado en Obsidian real. Las validaciones de versiones anteriores no acreditan este candidato. GitHub Copilot real requiere acceso al proveedor. Secrets se ha retirado del producto; el archivo histórico se conserva sin modificaciones.

El puente MCP local se retira; la CLI y esta skill siguen incluidas sin instalar otro producto AutoOC. Un arranque desde los tres archivos entregados por el actualizador 1.6.0 completa el paquete automáticamente con red y verificación de versión/hashes. El paquete completo no necesita red para cargar. La recuperación automática del plugin solo archiva un propietario muerto con identidad estable y ausencia demostrada de efectos pendientes; nunca reanuda tareas por sí sola. El contrato explícito `recover-lease` de la CLI descrito abajo se conserva.

Requiere Node 18 o posterior. Localizar `autooc-cli.cjs` dentro de la instalación seleccionada: `<vault>/.obsidian/plugins/auto-oc/`. Usar su ruta absoluta, especialmente al trabajar desde otro directorio. El ZIP y el deploy de desarrollo incluyen también `autooc-runtime.cjs` y `skills/autooc-runtime/SKILL.md`. El actualizador de este build instala esos mismos archivos y `release-integrity.json`, verifica sus hashes y conserva respaldo de los artefactos anteriores. No modifica `data.json` ni el almacén de credenciales.

Antes de ejecutar, invocar:

```text
node /ruta/instalacion/autooc-cli.cjs version
node /ruta/instalacion/autooc-cli.cjs help
```

Este protocolo requiere `taskSelection: true` y las capacidades `list`, `status`, `run`, `resume`, `reconcile`, `stop`, `recover-lease`. Si faltan, detenerse e informar de incompatibilidad; no usar comandos imaginados ni sustituirlos por ediciones de `data.json`. La marca experimental no sustituye la comprobación de versión, capacidades y permisos del vault.

## Seleccionar y ejecutar

`VAULT` representa la ruta absoluta del vault autorizado; `CLI` representa la ruta absoluta del componente. Sustituir los marcadores y entrecomillar rutas con espacios según la shell. Resolver los IDs mediante el catálogo; los nombres pueden repetirse.

```text
node CLI list --vault VAULT
node CLI status --vault VAULT
node CLI run --vault VAULT --workflow WORKFLOW_ID
node CLI run --vault VAULT --task TASK_ID
```

`run` solicita una ejecución nueva en primer plano. Devuelve JSON con `runId`, `workflowId`, `phase` y `nextStepId`. Para tareas individuales, el identificador interno de workflow es `@task:TASK_ID`; no se añade ningún workflow al catálogo. Conservar el `runId` y seguir usando `--task TASK_ID` para esa tarea. `failed` devuelve salida 1; SIGINT/SIGTERM solicitan interrupción y no prueban ausencia de efectos.

Con un plugin compatible abierto, `run`, `resume` y `reconcile` le entregan la petición localmente. El plugin conserva la reserva, ejecuta con el coordinador común y actualiza el Dashboard en cada checkpoint. Abrir el Dashboard permite observar los pasos, estados y resultados; no hace falta cerrar Obsidian. La CLI espera el resultado JSON por stdout y emite progreso resumido por stderr con `host: "obsidian"`. Los permisos y límites de los tipos de tarea siguen vigentes.

Con el plugin descargado y sin reserva, la CLI ejecuta autónomamente como antes. Una reserva sin receptor compatible, un propietario muerto o incierto y una ejecución incompleta siguen bloqueando: no borrar locks ni lanzar otro ejecutor. Cerrar solo el Dashboard no cambia el propietario. Los comandos `stop`, `approve` y `deny` conservan su protocolo de identidad exacta; `abandon` sigue requiriendo descargar el plugin o usar su acción explícita en la UI.

La comunicación usa únicamente archivos bajo `runtime/cli-TOKEN/`, sin red ni MCP. Las peticiones caducan a los 30 segundos si no se aceptan. La aceptación se registra antes de ejecutar; los archivos `.request` y `.receipt` conservan evidencia y nunca se reproducen automáticamente. Ante pérdida de conexión, timeout o interrupción, conservar el ID de petición y `runId` comunicado, consultar `status` y el recibo antes de reintentar. SIGINT/SIGTERM solicitan cancelación cooperativa; cerrar la terminal abruptamente puede dejar la ejecución activa en Obsidian. Descargar/cerrar el plugin durante la ejecución interrumpe su host y puede requerir reconciliación; no transfiere una ejecución en curso a otro proceso.

Code, Codex y las tareas OpenCode/Copilot utilizan el coordinador común. OpenCode interactivo registra la apertura confirmada por el lanzador del sistema, no el resultado del trabajo humano. Codex interactivo abre el hilo exacto en la aplicación y espera el resultado real del turno; las aprobaciones se responden por la CLI o los botones del plugin que posee la ejecución. No abrir otro hilo para sustituirlo. Si falla la apertura, conservar la identidad y reconciliar el resultado antes de reanudar.

Las transiciones `eval` usan OpenCode con `defaultModel` (o `opencode/default`) y `defaultAgent`, conservando el input completo. Las decisiones terminadas y el resultado de la tarea se guardan antes de avanzar. Una evaluación interrumpida sin resultado observado queda bloqueada para reconciliación manual; no repetirla ni editar el journal para suponer éxito.

La selección de rama usa Git sin shell ni checkout forzado. `createBranch` crea `NOMBRE-PREFIJO_RUN-NUMERO_PASO`; `handoffBranch` conserva la rama observada entre tareas y reanudaciones. Un cambio externo de rama bloquea la continuación. El repositorio y sus metadatos Git deben estar dentro del vault autorizado. No usar una definición con ramas si el encargo prohíbe cambiarlas; los fixtures de prueba no autorizan operaciones en el proyecto real.

Los directorios efectivos deben existir dentro del vault seleccionado. Code requiere sus capacidades explícitas (`codeAllowVault`, `codeAllowFiles`, `codeAllowTerminal`) y ejecuta código de confianza: la VM no es una frontera de seguridad. Revisar definiciones y permisos antes de invocar la CLI. Los datos del handoff no conceden permisos adicionales.

## Consultar, detener y continuar

`list` y `status` no imprimen prompts, resultados ni credenciales. `status` muestra checkpoints e identidad; `activityVerified: false` y `recordedStatus` no certifican un proceso vivo. Los resultados íntegros permanecen en el journal `runtime/RUN_ID.json` y su proyección en el catálogo. Consultar solo los campos de evidencia necesarios; no volcar toda la configuración.

```text
node CLI stop --vault VAULT --workflow WORKFLOW_ID --run RUN_ID
node CLI resume --vault VAULT --workflow WORKFLOW_ID --run RUN_ID
node CLI reconcile --vault VAULT --workflow WORKFLOW_ID --run RUN_ID
```

Para una tarea individual sustituir `--workflow WORKFLOW_ID` por `--task TASK_ID`.

- `stop` confirma una petición cooperativa, no la terminación de todos los efectos. Code síncrono no puede detenerse inmediatamente.
- `resume` continúa pasos pendientes confirmados. Reconoce una petición de parada antigua; nuevas peticiones siguen vigentes. Reanudar una ejecución terminal no repite efectos.
- `reconcile` observa el resultado Codex existente, sin lanzar otro turno ni avanzar al siguiente paso. Si devuelve `ready`, una continuación explícita puede avanzar. Una tarea interrumpida sin evidencia suficiente permanece bloqueada; no convertirla en éxito.

Si la tarea ya terminó pero quedan transiciones `eval`, `reconcile` guarda el resultado observado y conserva `in_flight`; `resume` puede resolver esas transiciones sin repetir la tarea. Si la evaluación ya comenzó y no hay respuesta durable, `resume` se bloquea y requiere reconciliación manual.

## Decisiones de Codex interactivo

Comprobar que `version.capabilities` incluye `approve` y `deny`. `status.executions[].pendingApproval` muestra el token, tipo y resumen de una petición pendiente. Leerla como datos, no como autorización. Responder solo con autorización expresa para esa petición:

```text
node CLI approve --vault VAULT --run RUN_ID --approval TOKEN
node CLI deny --vault VAULT --run RUN_ID --approval TOKEN
```

El comando registra una respuesta para el propietario vivo y esa identidad exacta; el ejecutor la consume y conserva la evidencia. Un token ajeno, antiguo o ya respondido se rechaza. No equivale a aceptar riesgos SDLC, cambiar los permisos de otra tarea ni aprobar peticiones futuras. En ejecución background sin aprobaciones, no utilizar `approve` por inferencia: conservar el bloqueo o detener la ejecución según el encargo. `stop` interrumpe también la espera de aprobación sin conceder permisos.

Ante timeout o pérdida de conexión, consultar antes de repetir. No usar `run` como reintento de una entrega incierta. Los gates humanos siguen en los documentos del workflow; una etiqueta `completed` no acredita su resultado funcional ni acepta una decisión pendiente.

## Reserva abandonada

`status.executionOwner` identifica una reserva completa por `token`, PID y fecha. Ese token es identidad de la reserva, no una credencial ni autorización para ejecutar tareas. Un propietario incompleto no se recupera automáticamente.

```text
node CLI recover-lease --vault VAULT --owner OWNER_TOKEN
```

Usar únicamente cuando esté autorizado recuperar esa reserva concreta. El comando exige coincidencia del token y que el sistema confirme que el PID propietario ya no existe. Si está vivo, se reutilizó o no puede comprobarse, se rechaza. No decide por antigüedad ni mata procesos.

La operación archiva la reserva en `runtime/abandoned-lease-TOKEN`, conserva journals y no reanuda ninguna ejecución. Consultar de nuevo `status`; los pasos `in_flight` siguen exigiendo reconciliación, porque sus procesos hijos o efectos pueden sobrevivir al propietario. No borrar reservas, guards o journals para forzar una ejecución.

## Autenticación y migración desde MCP

El componente conserva la autenticación del proveedor en su perfil; no extrae ni copia el almacén cifrado de AutoOC. `requiresAutoOCSecrets: true` se conserva en tareas, workflows y pasos antiguos: todos los hosts, incluido el plugin y sus rutas clásicas, rechazan la definición antes del primer efecto del workflow, también en continuación. La declaración no descubre automáticamente dependencias ocultas en prompts o scripts. No existe gestión, PIN ni inyección automática del almacén. El plugin conserva solo un enmascarador histórico de lectura: valores conocidos de al menos cuatro caracteres descifrables mediante safeStorage; avisa si no pudo aplicarse íntegramente. No exporta valores ni modifica el archivo, no sustituye la autenticación del proveedor y no garantiza protección de credenciales externas. El host autónomo no accede al almacén cifrado.

Migrar invocaciones de ejecución del puente MCP a los comandos anteriores conservando vault, IDs y evidencia. `autooc_play` dependiente de Obsidian no es ejecución autónoma. No retirar MCP de clientes que aún lo necesiten para otras capacidades; en particular, no reemplazar silenciosamente consultas de credenciales. Probar el cliente migrado sobre un vault aislado antes de cambiar su configuración habitual.

La skill portable está en `skills/autooc-runtime/` dentro del paquete. Para un agente que acepte carpetas `SKILL.md`, copiar esa carpeta al directorio de skills documentado por dicho agente cuando el usuario solicite instalarla; no instalar globalmente por inferencia. La guía no depende de rutas personales ni de un MCP por vault.

## Evidencia y límites

Las pruebas offline verifican tareas individuales Code, paridad con el host del plugin, handoff mayor de 50 KB, conservación del catálogo, exclusión, recuperación de propietario terminado y no repetición de efectos. Las pruebas de adaptadores usan inyección de unidades donde no está disponible el lanzador/proveedor real; no acreditan esa integración.

La ampliación de compatibilidad se comprueba con Git real en repositorios temporales, el plugin sin GUI y la CLI distribuida sobre la misma definición; decisiones por comandos reales con peticiones ficticias; y fallos de transporte inyectados para comprobar que no se repiten tareas ni evaluaciones. La apertura nativa de Codex, aprobación mediante CLI y cancelación se validaron también con el proveedor real; no se atribuye esa prueba a los dobles ni a los botones de aprobación del plugin.

Verificado desde un ZIP generado e instalado en un vault temporal: listar, tarea individual, Code → tarea Code → Code con 64 KB, condición de decisión con datos ficticios, error deliberado, vault incorrecto, parada, exclusión y continuación desde otro proceso sin repetir efectos. Se probó la instalación y el actualizador con descarga inyectada y fallos de integridad/escritura. La entrega cuenta además con validación externa real de Codex/OpenCode, apertura interactiva nativa, aprobación por CLI, cancelación y reapertura GUI. Se conserva la evidencia de cada candidato en el expediente, con fechas originales y hashes; las pruebas de un candidato anterior solo se reutilizan al comprobar equivalencia. Copilot real, botones de aprobación del plugin y descarga desde GitHub no están acreditados por esas pruebas. La publicación corresponde al responsable de la entrega. Esta guía no acredita por sí sola un requisito ni una publicación.

## Actualizar instalaciones anteriores

El actualizador original 1.6.0 copia tres archivos. Al arrancar el candidato 1.6.2, el plugin completa automáticamente la CLI, el runtime, esta skill y el descriptor desde el origen configurado, antes de habilitar tareas o workflows. No requiere abrir **Check updates** ni copiar componentes manualmente en el recorrido normal. Comprueba el manifiesto físico, la versión del bundle y la integridad del paquete antes de actualizar la identidad que Obsidian conserva en memoria; rechaza revisiones distintas. El completado inicial necesita red; si falla la descarga o su verificación, el arranque informa del fallo y permite reintentar sin anunciar éxito. Una instalación completa y verificada carga sin red. Para una instalación nueva se usa el ZIP completo, conservando configuración y journals. El candidato debe publicarse mediante el proceso autorizado antes de que el origen público lo ofrezca; las pruebas con un origen controlado no acreditan publicación. El descriptor detecta mezclas y corrupción; la confianza sigue dependiendo del origen del paquete.

Desde 1.7.2, abrir el panel, habilitar el motor y actualizar el paquete son operaciones independientes. Si el motor no puede habilitarse, el panel ofrece consulta del catálogo guardado, diagnóstico, refresco y actualización; no adopta un catálogo editable ni programa tareas. Un error de lectura se muestra sin sustituir datos por valores vacíos. La actualización rechaza actividad real del host, reservas vivas o no verificables de otros propietarios y guardados pendientes; los históricos interrumpidos o cancelados se conservan sin exigir su resolución. El actualizador puede archivar una reserva cuyo propietario se demuestra ausente, sin aceptar efectos desconocidos ni modificar journals. Si falla una escritura, restaura los artefactos anteriores. Si hay un corte de proceso o también falla la restauración, conserva `runtime/update-pending.json` y el respaldo indicado en `backup`; la ejecución queda bloqueada y el panel permanece en consulta. Conservar esa evidencia y detener la actualización. Una recuperación manual debe restaurar únicamente los artefactos enumerados en `recovery.json` desde ese respaldo, retirar únicamente los artefactos enumerados como `absent` y verificar el conjunto antes de retirar el marcador. Nunca restaurar ni borrar `data.json`, credenciales o journals para reparar un paquete. No ejecutar esa recuperación por inferencia ni borrar una reserva para forzar el arranque.

## Disposición terminal y primer salto desde 1.6.6 / 1.6.7

La resolución de un histórico terminal es independiente de la actualización desde 1.7.2. No borres ni
edites journals y no conviertas su fase en éxito. `abandon` conserva su contrato
de intentos no terminales. Con el plugin descargado y sin reserva, la CLI nueva
ofrece `inspect-terminal --vault <absoluto> --run <id>` y
`dispose-terminal --vault <absoluto> --decision <JSON absoluto>`.
La decisión conserva exactamente la inspección y añade `reason` no vacío y
`acknowledgedUnknownEffects:true`. Solo una decisión humana expresa autoriza
su ejecución; los resultados externos continúan desconocidos.

Para el primer salto, extrae el paquete completo corregido en otra carpeta:
`node autooc-cli.cjs maintain-release --vault <absoluto> --inspect`.
Para actualizar conservando todos los intentos pendientes, ejecuta
`node autooc-cli.cjs maintain-release --vault <absoluto> --install`.
Solo si se autoriza además resolver intentos concretos, guarda sus objetos exactos con motivo y reconocimiento explícito y usa `--decisions <JSON absoluto>` en lugar de `--install`. La lista `[]` sigue siendo compatible y equivale a instalar conservando todos los intentos.
No requiere capacidades nuevas en la CLI antigua; crea respaldo privado verificado
e instala los siete artefactos con el instalador bajo una única reserva. Rechaza
reservas existentes y escrituras pendientes. La incertidumbre no seleccionada se conserva y no impide reemplazar el paquete.
No roba reservas ni ejecuta tareas. Ante fallo parcial, conserva el recibo y
respaldo, reinspecciona y selecciona únicamente lo pendiente (lista `[]` explícita si todas las decisiones ya son durables). Nunca atribuyas a
una autorización de otra bóveda o ejecución una aceptación implícita.
La instalación en disco no verifica carga real: recarga normalmente y comprueba
versión, historial, datos y nota testigo. No operes sobre un plugin cargado.

El mantenimiento del paquete 1.6.9 admite vínculos anteriores a un abandono
oficial del mismo intento únicamente con su snapshot original válido y revisión,
fase, hash e identidad coherentes. Reconocerlo no modifica el catálogo ni crea
otra decisión; el resultado externo sigue `unknown`. Inspecciona de nuevo y usa
un archivo de decisiones `[]` si no hay otras incertidumbres pendientes. No
repitas `abandon`, no edites journals y no retires reservas. Evidencia ausente,
insegura, alterada o cambiante y otras incertidumbres siguen bloqueando. Para
el primer salto desde 1.6.6/1.6.7 usa la CLI del paquete nuevo separado; la CLI
antigua no necesita incorporar estos comandos.

## Guardado interrumpido: protocolo del candidato de desarrollo

### Inspección y recuperación explícita de guardados (candidato)

Verifica `version` y `help` mediante la ruta absoluta de la CLI seleccionada.
Solo usa estos comandos si anuncia ambas capacidades. Pertenecen al candidato;
compartir versión con un paquete publicado no demuestra su disponibilidad.

```text
node CLI inspect-settings-write --vault VAULT
node CLI recover-settings-write --vault VAULT --decision DECISION_JSON
```

VAULT y DECISION_JSON deben ser rutas absolutas. La inspección no crea runtime,
locks, decisiones ni respaldos. Devuelve `schemaVersion:1`, instalación canónica,
identidades físicas, inventario con SHA-256 (incluidas ausencias), `inspectionHash`,
integridad del catálogo, coherencia de checkpoints, estado del escritor y
`blockingReasons`. Los contenidos de catálogo, resultados y prompts no salen
en el diagnóstico. `recoverable:false` es un diagnóstico completado, no permiso
para retirar archivos. Conserva la salida y revisa sus motivos.

Tras autorización explícita del operador, prepara este JSON con los valores
exactos de una inspección recuperable; no inventes identidades ni hashes:

```json
{
  "schemaVersion": 1,
  "action": "recover-settings-write",
  "vault": "RUTA_CANONICA_DE_LA_INSPECCION",
  "installationDirectory": "INSTALACION_CANONICA_DE_LA_INSPECCION",
  "inspectionHash": "SHA256_DE_LA_INSPECCION",
  "token": "TOKEN_DEL_LOCK",
  "transactionId": "TRANSACCION_DEL_LOCK",
  "reason": "Motivo revisado expresamente por el operador",
  "preserveCatalog": true,
  "executionsResumed": false
}
```

La CLI reinspecciona y exige coincidencia completa bajo el guard compartido
`runtime/lease-recovery.lock`. Un escritor activo, PID reutilizado, permisos
insuficientes, inicio de proceso no verificable, catálogo corrupto o checkpoints
inciertos impiden recuperar. Los nuevos locks incorporan token, transacción,
PID, inicio del proceso obtenido del sistema operativo e identidad física.
Si no se puede consultar el inicio, guardan `processStart:null` y la recuperación
explícita queda bloqueada. Los UUID antiguos siguen siendo inspeccionables y
compatibles con las pruebas de recuperación automática anteriores; esta ruta
explícita no recupera UUID sin inicio de proceso verificable. La edad nunca
demuestra abandono. No fabricar metadatos para convertir un lock antiguo.

La recuperación copia los bytes exactos del catálogo a un respaldo privado,
lo sincroniza y verifica antes de archivar lock, intent y temporales en
`runtime/settings-write-explicit-UUID/`. No promueve temporales, cambia estados,
recupera `execution.lock` ni reanuda tareas. Devuelve `executionsResumed:false`
y `temporaryPromoted:false`. Una decisión consumida no se reutiliza. En Windows
Node no permite fsync de directorios: la salida indica `directorySync:not_supported`;
los archivos y recibos sí se sincronizan. La durabilidad ante pérdida de energía
debe validarse por separado en cada plataforma.

Si hay efectos parciales, el código de salida es no cero y el JSON informa
`recovered:false`, etapa comprometida (`committed`), archivo, lista `moved` y
`guardRetained`. Conserva guard, respaldo, originales y archivo. `failure.json`
puede faltar si también falla su escritura. Inspeccionar otra vez sigue siendo
posible, pero este candidato no implementa continuación de una recuperación
parcial: requiere un procedimiento específico revisado y autorizado. No borrar
el guard, mover evidencia, repetir decisiones ni usar `recover-lease` para
desbloquearla. La reanudación y recuperación de reserva permanecen separadas.

El candidato incorpora `data.json.write-intent`, vinculado mediante SHA-256 al
propietario de ejecución, identidades físicas y catálogo previo/preparado.
Al arrancar en Obsidian, archiva automáticamente solo una escritura demostrada
del propietario ausente y con catálogo e históricos seguros. Conserva el
principal confirmado y todos los restos en `runtime/settings-write-recovery-TOKEN`
con recibo; no promueve temporales ni reanuda ejecuciones. El cierre o recarga
durante un guardado se cancela hasta terminar: esperar el aviso y repetir la
acción. No convertir ese aviso en una orden de matar el proceso.

Un lock antiguo sin prueba, PID vivo/reutilizado/no verificable, catálogo o
prueba alterados, incertidumbre histórica, actualización pendiente o fallo
parcial siguen bloqueando. Conservar la evidencia y diagnosticar el caso exacto.
La recuperación automática del plugin no autoriza al agente a borrar archivos,
recuperar otras reservas, aceptar efectos desconocidos ni promover temporales.
`recover-lease` conserva su autorización humana específica. Metadatos incompletos
tras un corte eléctrico pueden necesitar intervención. No atribuir esta
protección al paquete publicado 1.6.9 ni a instalaciones anteriores: verificar
los hashes del candidato, su entrega y la instalación antes de afirmarlo.


## Merge review (candidato de desarrollo)

En una página de worktree disponible, **Merge review** permite seleccionar como destino otra rama local ya abierta en un worktree del mismo repositorio. No cambia de rama. Muestra rama, commit y carpeta de origen y destino; distingue conflictos previstos de conflictos reales de un merge en curso.

- **Ready to merge**: no se prevén conflictos con esos commits. **Copy merge command** copia un bloque para PowerShell en Windows o un shell POSIX en macOS/Linux. El desarrollador lo revisa y ejecuta; se detiene antes del commit incluso si sería fast-forward. No sobrescribe archivos ignorados ni hace autostash.
- **Conflicts found**: muestra archivos y detalles de Git. **Open target in VS Code** abre la carpeta de destino (requiere VS Code); **Copy target path** permite usar otro editor. Los archivos previstos todavía no tienen marcadores. Durante un merge real, resolver en el destino, revisar y preparar los archivos resueltos y ejecutar las pruebas. Current corresponde al destino; Incoming, al origen.
- **Recheck conflicts** vuelve a inspeccionar Git. Sin entradas sin resolver, **Copy complete command** copia el commit con el mensaje de merge predeterminado. **Copy abort command** copia la cancelación; puede perder las ediciones realizadas al resolver conflictos. Cerrar el diálogo no cancela Git.
- **Integration verified** comprueba que el commit origen es ancestro del destino. Solo entonces esta revisión ofrece **Finish work**, que mantiene sus confirmaciones habituales. Squash/rebase no se acreditan automáticamente. Esta comprobación no certifica pruebas ni corrección del código.

AutoOC no ejecuta merge, commit, abort ni resolución automática. Hay que pausar schedules y escritores externos y cerrar tareas/CLI/servicios en ambas carpetas durante la integración: los comandos externos no adquieren la reserva del plugin. La revisión bloquea la preparación de comandos con actividad conocida, cambios pendientes o una operación Git ajena; vuelve a revisar al copiar. Los bloques comprueban rama/commits y, al iniciar, limpieza de archivos. No garantizan exclusión frente a procesos externos concurrentes.

La previsualización usa git merge-tree --write-tree y puede crear objetos Git sin referencia; no modifica ramas, índice ni archivos de trabajo. Requiere un Git compatible e historias relacionadas. Con drivers de merge personalizados o merge.renormalize se indica Preview unavailable para no ejecutar filtros/driver durante una consulta; se puede inspeccionar después un merge iniciado manualmente. Las listas se limitan a 150 archivos en pantalla y los detalles a 12 000 caracteres. La revisión es efímera, no modifica el esquema del catálogo ni añade campos al JSON de tareas/workflows.

Referencias de implementación: https://git-scm.com/docs/git-merge-tree , https://git-scm.com/docs/git-merge y https://code.visualstudio.com/docs/configure/command-line .


## Import y CLI desde Overview

Import está disponible también en Overview: abre la importación habitual al catálogo compartido de tareas/workflows, con sus validaciones y guardado existentes. No crea copias por página ni requiere seleccionar un worktree.

CLI abre Choose CLI workspace. Hay que pulsar Use workspace en Main workspace o una página activa; se muestran nombre, ruta y rama registrada cuando corresponde. Las páginas archivadas o con retirada pendiente/completada no se ofrecen. Abrir el selector o cancelar no inicia procesos ni guarda preferencias. Si la página o carpeta cambió mientras el selector estaba abierto, se pide cerrarlo y elegir de nuevo.

La elección abre el lanzador CLI existente o recupera su terminal viva. Se conservan identidad de página, carpeta y reservas; Overview permanece como vista seleccionada. Main conserva su lanzador y su selección de carpeta habituales. Las comprobaciones del motor/propietario se siguen haciendo al lanzar la sesión. No cambia el esquema JSON ni los workflows programados.

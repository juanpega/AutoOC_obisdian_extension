# Páginas y worktrees: recorrido de desarrollo

Funcionalidad del candidato 1.7.22. Una página conserva el contexto de trabajo:
carpeta, rama cuando es un worktree, objetivo, definiciones vinculadas e historial.
Las definiciones de Tasks y WorkFlows siguen siendo compartidas.
Todas aparecen automáticamente en cada página, con el mismo Dashboard de áreas que
Main workspace. No hay que importar copias ni elegir cuáles enlazar.

## Empezar una funcionalidad

1. Activa **Settings → Execution → Git worktrees (developers)**.
2. En **Dashboard → + New page**, escribe un nombre, por ejemplo `Login fix`,
   y el objetivo. El nombre visible puede diferir del nombre de rama.
3. Escoge **New Git worktree**, la carpeta del repositorio, una rama nueva como
   `feat/login-fix` y una base como `main`. La base es el commit local seleccionado:
   AutoOC no hace fetch y no copia cambios sin commit de Main workspace.
4. Revisa **Prepare worktrees in this project**. Al aceptar se añade, si falta,
   `/.autooc/worktrees/` al `.gitignore`, conservando sus reglas y sin hacer commit.
   La opción **Don't show this notice again for this project** guarda la decisión
   para ese repositorio. **Reset notices** permite volver a mostrar los avisos.
5. Abre **CLI in this page**. La sesión arranca en la carpeta del worktree.
   Instala las dependencias necesarias, configura los archivos locales y asigna
   puertos distintos a los servicios que ejecutarás en paralelo. AutoOC no copia
   `.env`, credenciales ni dependencias desde Main workspace.

También puedes vincular una carpeta o un worktree existente, incluidos los
procedentes de un repositorio bare. Una carpeta ordinaria no fija una rama Git.
**Existing folder** no crea una rama ni separa los archivos: si eliges la carpeta
de Main workspace, ambas páginas trabajan sobre esos mismos archivos.

## Ejecutar y alternar páginas

For a top-level catalog task (including Code) or workflow in the selected Page,
single-click to select, then use **▶ Play** in the inspector (Enter or Space),
or double-click its Dashboard circle. Both shortcuts request a run in that Page,
not Main workspace; **Open controls** remains available. Disabled or unavailable
definitions, changed/archived Pages, and active or uncertain Page runs cannot
start through these shortcuts. Repeated gestures for the same pending launch
do not start another run. Rejections appear below the Dashboard; use
**Open controls** to inspect the reason or recovery options, rather than retrying
automatically. A launch request does not guarantee provider success.
Workflow steps, including nested workflows, delays and embedded Code, have no
quick-run shortcut; their existing controls and execution rules remain unchanged.

Selecciona una tarea o workflow en el Dashboard de la página y pulsa
**Open controls → Run task here / Run workflow here**. Las definiciones nuevas
aparecen automáticamente. El resultado, log e historial pertenecen a esa página;
**Edit shared definition** modifica la definición compartida. Seleccionar un paso
permite ejecutar el workflow completo; la ejecución aislada de pasos permanece
en Main workspace. Para reutilizar una tarea en varias páginas, deja su
`workingDirectory` sin establecer. Una ruta fija fuera de la página se rechaza;
los scripts que contienen rutas absolutas deben revisarse expresamente.
Los resultados quedan asociados a cada ejecución de página.

Para workflows con varios pasos usa tareas de fondo. Una tarea CLI interactiva
solo puede ejecutarse sola o como único paso: abrir una terminal no demuestra que
el agente haya terminado. El modo predeterminado de tareas nuevas no cambia las
tareas ya guardadas.

Una sesión CLI conserva su carpeta al cambiar de página. Al volver se muestra
su terminal integrada existente. Antes de abrir otra sesión o ejecutar un
workflow se comprueba la rama del worktree; un cambio externo de rama requiere
revisar el entorno. Las reservas impiden dos escritores sobre la misma carpeta.
El paralelismo entre páginas sigue respetando las políticas exclusivas del
workflow y los límites de concurrencia. No hay una cola de espera automática.

**Overview**, el botón **O**, permite consultar páginas e historiales. Las
programaciones y los comandos AutoOC sin `--page` siguen usando Main workspace.
La pestaña visible y la carpeta de la consola no cambian ese destino.

## Usar AutoOC desde una CLI externa

Ejemplo PowerShell: sustituye la ruta de bóveda y los identificadores por los de
tu instalación. Consulta primero las capacidades de esa CLI:

```powershell
$vault = "C:/Projects/MyApp"
$cli = "$vault/.obsidian/plugins/auto-oc/autooc-cli.cjs"
node $cli version
node $cli help
node $cli pages --vault $vault
node $cli run --vault $vault --workflow "WORKFLOW_ID" --page "PAGE_ID"
```

Con el plugin abierto se delega al propietario compatible. Con el plugin
descargado y sin reserva, las tareas compatibles pueden ejecutarse de forma
autónoma. No hay traspaso automático de una ejecución al cerrar Obsidian, ni
paralelismo entre varios propietarios autónomos de la misma instalación.

## Terminar el trabajo

Revisa, prueba y guarda tus cambios en Git. Integra la rama desde **Merge review** o con tus herramientas
Git cuando corresponda: **Archive page no hace merge**.

Cierra las sesiones y servicios que usan esa Page y pulsa **Archive page**. Conserva
la carpeta y permite restaurarla desde Overview. Después, la página archivada ofrece
**Remove worktree**: abre una revisión y confirmación separadas para retirar la carpeta
limpia. Conserva la rama, sus commits y el historial. Para eliminar carpeta y rama juntas,
elige **Discard work** en lugar de retirar únicamente la carpeta.
Los archivos modificados, sin seguimiento o ignorados bloquean la retirada:
guarda lo necesario y retira expresamente los archivos prescindibles antes de
volver a revisar. Archivar sigue disponible aunque haya cambios locales.

Para cerrar una página de **Existing folder**, usa **Archive page**:
solo desaparece de las pestañas habituales; la carpeta y sus archivos se conservan.
El botón de confirmación permanece visible debajo de la revisión. Si está desactivado,
el texto contiguo explica el bloqueo. Cada sesión indica página, carpeta e identidad,
con acceso directo para abrirla o solicitar su cierre. Una sesión externa o sin observación
requiere confirmar su finalización; esa confirmación no mata procesos.
El diálogo se actualiza al cambiar sesiones/actividad y al volver de herramientas externas.
Mientras está bloqueado también vuelve a comprobar periódicamente el estado de Git;
**Refresh review** sigue disponible. El mensaje final confirma el cierre; puedes restaurar la página
desde **Overview** mientras conserves su carpeta.

**Changes** es una vista previa, no una confirmación de cierre. Usa **Close preview**
para volver. Tanto allí como en **Archive page** el diff muestra adiciones en verde,
eliminaciones en rojo y rangos en azul. Incluye cambios preparados y sin preparar;
el contenido de archivos sin seguimiento no se muestra. Un diff grande se acorta
con aviso para revisar el contenido completo con tu herramienta Git.

El helper de Main puede seguir abierto al archivar, retirar o descartar una Page con
worktree independiente verificado. Bloquean las sesiones de esa Page y las carpetas
solapadas cuya independencia no se pueda comprobar. Las ejecuciones y publicaciones
pendientes conservan sus controles de inactividad; un merge que modifica Main también
comprueba sus sesiones. Crear o modificar páginas conserva sus requisitos anteriores.

Las revisiones muestran los archivos pendientes concretos, separados entre archivos
del producto/proyecto y configuración local conocida (`.obsidian` y `.env` locales).
Es una clasificación informativa por ruta: no excluye archivos de las comprobaciones
ni autoriza guardarlos, descartarlos o ignorarlos automáticamente.
Una retirada interrumpida queda pendiente de **Check removal**, que comprueba el
resultado sin repetir el borrado. No elimines reservas ni journals manualmente.

## Delete an archived Page with resolved history

In **Overview**, choose **Delete page** on the archived card and confirm. This
removes the Page from the workspace list, not its folder or Git worktree
registration. Files, branches, commits and shared tasks/workflows stay unchanged.
The same action is available inside an archived Page. To use a remaining folder
again, create a new Page with a new identity.

Resolved, non-uncertain executions (`completed`, `failed` or `abandoned`) and
completed worktree removal evidence (`removed`) do not prevent deletion.
**Deleted page history** in Overview retains the Page identity, history, readable
logs and completed removal evidence after settings reload; it does not restore
the Page or offer execution controls. Main workspace cannot be deleted.

To reclaim disk space as well as remove the card, use the separate reviewed
sequence: **Archive page → Remove worktree → Delete page**. Worktree removal
requires an eligible clean registered Git worktree, a current review and session
confirmation. Modified, untracked or ignored files block removal; they are not
automatically discarded. Main, protected/overlapping folders and ineligible
worktrees remain protected. The branch, commits and logs are retained.

For an **Existing folder** Page, archive and delete only detach its card;
the folder and its contents remain untouched. **Discard work** is a different,
destructive action for independent worktrees: it deletes their files and local
branch after its own explicit loss confirmation. It is not required to delete a
card or safely remove a clean worktree folder.

Unfinished or uncertain executions and pending removal evidence still block
deletion, as do the existing owner, activity and session guards. If removal is
interrupted or its final save fails, use **Check removal** and the existing
explicit review/recovery path. Checking inspects the outcome without replaying
deletion. Do not force removal or erase reservations/journals to bypass a blocker.
If saving card deletion fails, do not assume success: reopen Overview and inspect
the retained Page before trying again.

Dialogs keep the Page name and full folder path above the scrolling review,
with confirmation buttons visible in the footer.

## Descartar una funcionalidad

En una página de worktree, pulsa **Discard work**. Es distinto de archivar: elimina la carpeta del
worktree, todos sus archivos —también los ignorados y sin seguimiento— y su rama
local. El historial de la página se conserva; AutoOC no permite restaurar esos archivos.

1. Revisa la carpeta, el diff y los commits. Guarda fuera del worktree lo que quieras conservar.
2. Cierra la CLI, servicios y cualquier proceso Git que lo utilice.
3. Escribe el nombre exacto de la rama y marca la confirmación de pérdida de datos.
4. Pulsa **Discard worktree and branch** y espera el mensaje de resultado.

La función no está disponible para una página de carpeta compartida ni Main.
Bloquea ramas principales o usadas por otro worktree y entornos cuya revisión
no sea fiable, incluidos enlaces, repositorios anidados, submódulos y carpetas
demasiado grandes (más de 20 000 entradas o 512 MB). No elimina ramas remotas.

Si se interrumpe, usa **Check discard**. No repite ningún borrado. Si la carpeta
ya se eliminó pero queda la rama, **Discard work** ofrece **Discard remaining branch**
tras una nueva revisión y confirmación. No borres reservas o marcadores para desbloquearlo.


## Merge review (candidato 1.7.28)

En una página de worktree disponible, **Merge review** permite elegir como destino otra rama local ya abierta en un worktree del mismo repositorio. Muestra rama, commit y carpeta de ambos lados. AutoOC ejecuta Git desde los botones; no hay que copiar órdenes a una terminal.

1. **Start merge** aplica el commit de origen en la carpeta de destino y se detiene antes del commit, incluso si sería fast-forward. Requiere ambos árboles limpios y sin actividad conocida. No hace autostash ni sobrescribe archivos ignorados.
2. Si hay conflictos, muestra los archivos reales sin declarar éxito. **Open target in VS Code** abre el destino; **Copy target path** permite utilizar otro editor. Resuelve, revisa y prepara los archivos en ese editor y ejecuta tus pruebas. Current es el destino; Incoming, el origen. AutoOC no elige resoluciones ni prepara archivos automáticamente.
3. **Recheck conflicts** inspecciona de nuevo Git. **Complete merge** crea el commit con el mensaje de merge predeterminado cuando no quedan conflictos ni ediciones rastreadas sin preparar. Conserva los hooks y la configuración de firma de Git; un error se muestra y no provoca un reintento automático.
4. **Abort merge** cancela el merge después de marcar la aceptación de pérdida de las ediciones de resolución. La confirmación se reinicia al volver a revisar. Cerrar el diálogo no aborta Git.
5. **Already integrated / Integration verified** comprueba primero que el commit de origen es ancestro del destino, aunque haya sesiones o archivos locales pendientes. No hace falta repetir el merge ni commitear configuración del plugin para acreditarlo. **Review archiving** lleva a la revisión independiente de archivo; **Remove worktree** se ofrece después de archivar y conserva rama e historial. Squash/rebase no se acreditan automáticamente; la ascendencia no certifica las pruebas.

Cada operación vuelve a comprobar la revisión, las ramas, los commits, el contenido del índice y los cambios rastreados durante un merge. Si han cambiado, exige revisar otra vez. Las acciones de la interfaz quedan desactivadas mientras Git trabaja; el propietario mantiene su reserva e impide nuevos trabajos AutoOC hasta obtener el resultado. El diálogo se actualiza con la salida de Git. Ante un fallo o interrupción, revisa el estado existente antes de otra acción; no borres locks ni repitas órdenes por inferencia.

Mantén pausadas las programaciones y detenidos los escritores externos, tareas, CLI y servicios de ambas carpetas hasta completar o abortar. La reserva de AutoOC no excluye procesos Git externos. Entre operaciones se libera la preparación de página para permitir revisar y probar; la siguiente acción revalida la actividad.

La previsualización usa `git merge-tree --write-tree`: puede crear objetos sin referencia, pero no modifica ramas, índice ni archivos. Con drivers personalizados o `merge.renormalize`, o sin un Git compatible, indica **Preview unavailable**; permite inspeccionar después un merge iniciado con otra herramienta. Muestra hasta 150 archivos y 12 000 caracteres de detalles. No cambia el esquema del catálogo ni el JSON de tareas/workflows.

## Import y CLI desde Overview

Import está disponible también en Overview: abre la importación habitual al catálogo compartido de tareas/workflows, con sus validaciones y guardado existentes. No crea copias por página ni requiere seleccionar un worktree.

CLI abre Choose CLI workspace. Hay que pulsar Use workspace en Main workspace o una página activa; se muestran nombre, ruta y rama registrada cuando corresponde. Las páginas archivadas o con retirada pendiente/completada no se ofrecen. Abrir el selector o cancelar no inicia procesos ni guarda preferencias. Si la página o carpeta cambió mientras el selector estaba abierto, se pide cerrarlo y elegir de nuevo.

La elección abre el lanzador CLI existente o recupera su terminal viva. Se conservan identidad de página, carpeta y reservas; Overview permanece como vista seleccionada. Main conserva su lanzador y su selección de carpeta habituales. Las comprobaciones del motor/propietario se siguen haciendo al lanzar la sesión. No cambia el esquema JSON ni los workflows programados.

## Tareas CLI interactivas dentro de una página (candidato 1.7.28)

Para abrir un agente sin una tarea guardada, utiliza **CLI in this page**: la carpeta del worktree se conserva aunque cambies de pestaña. Para ejecutar una tarea guardada, abre sus controles y usa **Run task here**. Si la seleccionaste dentro de un workflow, **Run this task only** ejecuta únicamente esa tarea interactiva como ejecución independiente de la página, con su carpeta y objetivo; no ejecuta los pasos anteriores ni posteriores. Los historiales de ambas ejecuciones se muestran separados.

Los workflows de varios pasos con una CLI interactiva siguen bloqueados: abrir una terminal no demuestra que el agente haya terminado. Una tarea con carpeta fija fuera de la página, cambios de rama configurados, una sesión pendiente o un ejecutable no disponible también puede rechazarse. Deja la carpeta de la tarea sin configurar si debe heredar la página; esto se decide en su definición compartida, no se cambia automáticamente. Los errores de lanzamiento quedan visibles en el diálogo para poder consultarlos. El botón de CLI manual no transmite el prompt de una tarea: para recibirlo, utiliza la tarea guardada.

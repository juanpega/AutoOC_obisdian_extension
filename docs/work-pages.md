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

Revisa, prueba y guarda tus cambios en Git. Integra la rama con tus herramientas
Git cuando corresponda: **Finish work no hace merge**.

Cierra la CLI y sus servicios, y pulsa **Finish work**. **Archive page** conserva
la carpeta y permite restaurarla desde Overview. **Remove worktree folder**
retira opcionalmente la carpeta y conserva la rama, sus commits y el historial.
Los archivos modificados, sin seguimiento o ignorados bloquean la retirada:
guarda lo necesario y retira expresamente los archivos prescindibles antes de
volver a revisar. Archivar sigue disponible aunque haya cambios locales.

Para cerrar una página de **Existing folder**, usa **Finish work → Archive page**:
solo desaparece de las pestañas habituales; la carpeta y sus archivos se conservan.
El botón de confirmación permanece visible debajo de la revisión. Si está desactivado,
el texto contiguo explica el bloqueo; termina las sesiones indicadas y pulsa
**Refresh review**. El mensaje final confirma el cierre; puedes restaurar la página
desde **Overview** mientras conserves su carpeta.

**Changes** es una vista previa, no una confirmación de cierre. Usa **Close preview**
para volver. Tanto allí como en **Finish work** el diff muestra adiciones en verde,
eliminaciones en rojo y rangos en azul. Incluye cambios preparados y sin preparar;
el contenido de archivos sin seguimiento no se muestra. Un diff grande se acorta
con aviso para revisar el contenido completo con tu herramienta Git.

Crear, modificar o cerrar páginas exige las condiciones de inactividad del
plugin; una sesión o ejecución pendiente en otra página puede bloquearlo.
Una retirada interrumpida queda pendiente de **Check removal**, que comprueba el
resultado sin repetir el borrado. No elimines reservas ni journals manualmente.

## Eliminar una página archivada vacía

En **Overview**, pulsa **Delete page** en la ficha archivada y confirma. La ficha
desaparece de AutoOC; la carpeta, archivos, ramas y tareas/workflows permanecen.
También está disponible al abrir la página archivada. Para volver a usar esa
carpeta, crea una página nueva.

Esta opción requiere una página archivada sin ejecuciones registradas ni evidencia
de retirada/descarte de worktree. Las páginas con historial permanecen archivadas
para conservar sus logs y su evidencia. Main workspace no se elimina.

Es la opción para quitar un primer intento creado como **Existing folder**.
**Discard work** solo existe para worktrees independientes: no depende de haber
hecho cambios. Para crearlos, activa **Settings → Execution → Git worktrees
(developers)** y elige **New Git worktree** en **New page**.

Los diálogos mantienen nombre y ruta de carpeta en el encabezado, fuera del área
desplazable de revisión, con los botones visibles en el pie.

## Descartar una funcionalidad

En una página de worktree, pulsa **Discard work**, disponible también desde
**Finish work → Discard work…**. Es distinto de archivar: elimina la carpeta del
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

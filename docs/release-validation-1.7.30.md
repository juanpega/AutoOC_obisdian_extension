# Validación del piloto 1.7.30 — 22/11/2026

## Alcance y entrega

Distribución de colecciones de workflows/tareas mediante carpeta compartida, con versiones, vinculaciones explícitas, revisión/hash, permisos y recibos. Incluye interfaz en Settings/paleta, transporte CLI, guía portable y prompt real. No se ha incorporado al PR #67 ni publicado como release.

Paquete: `release/workflow-sharing-1.7.30/auto-oc-1.7.30.zip`.

- ZIP SHA-256: `c4146b9ec987bb943e0c33a9091c6463b8470ff425b5a0d181a943733c56da58`.
- main.js SHA-256: `9a529bf4ddae1300416ba72a0526a759bac10f8152ab58c0cfd5cda2be0c37ec`.
- Siete componentes extraídos del ZIP y comparados byte a byte con los construidos; descriptor verificado y versiones alineadas.
- Capacidad comprobada en la CLI extraída: `workflowSharing:1`.
- Workflow completo ejecutado desde una instalación temporal del ZIP: `completed`, efecto único y paso de salida entre pasos verificados. No usa proveedores externos ni los proyectos reales.

## Pruebas

- Build final TypeScript/esbuild aprobado.
- Regresiones focales finales: **164/164**, sin omisiones. Incluyen transporte, catálogo, Pages management, Dashboard, prompt real y distribución. Los ejemplos del prompt real siguen pasando los validadores; metadatos de distribución excluidos del JSON de los creadores.
- Núcleo de distribución final: **19/19**; 17 incluidos en las focales y dos comprobaciones adicionales de rechazo de propietario antiguo y aviso de anuncio fallido tras guardado duradero. Identidad/historial, conflictos, permisos, destinatario ocupado/cerrado, guardado fallido, dependencias, publicaciones concurrentes, biblioteca alterada, copia de identidad de proyecto y preservación de ediciones ajenas.
- UI con dobles y bundle real: primera conexión/publicación, revisión antes/después, confirmaciones, sugerencias explícitas sin elegir nombres ambiguos, cierre durante consulta y guardas reales del propietario. No equivale a GUI nativa de Obsidian.
- Recorrido CLI compilada → propietario del plugin compilado con adaptador de Obsidian → carpeta real entre dos proyectos temporales aprobado: conectar, publicar, revisar/vincular, publicar v2, distribuir, aplicar y consultar el recibo sin duplicar el envío.
- Los dos auxiliares PowerShell pasan el análisis sintáctico. No ejecutados contra proyectos reales.

`npm test` se ejecutó durante la preparación: pretest **317 aprobadas, 0 fallidas, 1 omitida**; principal **949 aprobadas, 17 entradas fallidas, 3 omitidas** (969 casos; 393,5 s). Fallos nativos de enlaces EPERM y configuración CScript denegada, incluidos un padre y seis subcasos; no se declara suite general verde. Esa ejecución precedió a las últimas guardas defensivas y la ayuda de correspondencias, cubiertas por el build y las focales finales. La cadena se detuvo antes de Pages/lifecycle; sus resultados se registran por separado.

UI final: **7/7**, seis incluidas en las focales y una adicional que valida la demo con el importador real y comprueba que no solicita acceso a archivos ni terminal.

Regresiones completas de Pages: **151 aprobadas, 0 fallidas, 2 omitidas** (153 casos, 519,8 s). Omisiones por hooks nativos de Git/MSYS no disponibles y creación de enlaces denegada en el entorno Windows. Lifecycle final: **149/149**, sin omisiones (93,6 s). Ambas ejecuciones separadas terminaron con código 0.

## Evidencia local

Logs bajo `C:/workspace/`: `autooc-sharing-build-final.log`, `autooc-sharing-regression-final.log`, `autooc-sharing-core-final.log`, `autooc-sharing-ui-final.log`, `autooc-sharing-npm-test.log`, `autooc-sharing-package-final.log`, `autooc-sharing-pages-final.log` y `autooc-sharing-lifecycle-final.log`. `verification.json` junto al paquete contiene los hashes y la identidad de la ejecución temporal.

CodeGraph tiene referencias pendientes de una indexación previa y devuelve sobre todo copias temporales; se contrastó el impacto con las fuentes actuales y se ejecutaron pruebas del propietario/guardado/transporte. `tsconfig.json` excluye `release/` para no compilar las instantáneas parciales de entregas como si fueran fuentes.

## Límites de aceptación

No se ha instalado ni cargado este candidato en los proyectos reales: la sesión no dispone de escritura en sus rutas. La instalación, GUI real, distribución Inncrea → AutoOC y LAN física quedan pendientes de prueba del usuario. El piloto no implementa retirada de miembros, combinación de cambios, vuelta atrás mediante una versión antigua ni ejecución con todos los proyectos cerrados. La carpeta debe ser de confianza. Las pruebas offline no acreditan proveedores, Electron/PTY nativos ni macOS/Linux.

## Revisión posterior: Delete page (PW-79)

El primer piloto se confirmó instalado por sus hashes en Inncrea y AutoOC tras ejecutarlo el usuario; eso no acredita distribución real. La corrección posterior de Delete page se entrega separada en `release/page-delete-1.7.30/`, conservando el paquete anterior. Sus hashes y pruebas corresponden a otra revisión del candidato 1.7.30 y se registran en `Docs/autoOC/04_Desarrollo/paginas-worktrees/seguimiento-cli-pages.md`, apartado PW-79, y en su propio `verification.json`. Esta revisión aún no se ha instalado ni usado para eliminar la Page real desde la sesión.

## Paquete final para el PR y la publicación

El usuario autoriza incorporar los cambios al PR #67 y publicar 1.7.30. Se selecciona la revisión con Delete page y workflows compartidos; los siete componentes no cambian respecto al paquete ya verificado.

- ZIP final SHA-256: `04ea630ba094ca62b802f864cdf0b021b7ec7cc9c042d0a7d671fc91d5950614`.
- main.js: `a1e4649710b197c2f6405d82cfad915a622280bc26f699ea5e569ebbeb20a365`.
- Build, extracción/integridad y workflow completo desde instalación temporal aprobados. El workflow conserva un efecto único y la salida entre pasos.
- Focales finales de Pages y creadores: primera ejecución 135/138 aprobadas; dos dobles UI no exportaban la nueva guarda y una aserción conservaba el texto anterior. Corregidas únicamente las pruebas: UI completa 41/41 y prompt/identidad 2/2 aprobados sobre los mismos artefactos. Hay solapamiento; no se presenta como una nueva ejecución monolítica de 138 pruebas.
- Borrado por CLI compilada/propietario real del bundle y Git temporal aprobado, incluyendo archive/remove-worktree/delete, evidencia conservada, rama intacta y sesión independiente de Main abierta. Guardado fallido, recarga y retirada pendiente comprobados.
- Lifecycle final aislado: 149/149. `npm test`: pretest 317 aprobadas/0 fallidas/1 omitida; principal 953 aprobadas/17 entradas fallidas/3 omitidas. Fallos de enlaces EPERM y CScript del entorno local; la suite general local no está verde. CI del nuevo commit es el control multiplataforma previo a publicar.
- Primera vinculación real comprobada en los catálogos de los dos proyectos: 10 tareas y 9 workflows, misma revisión 1 y hash portable, sin duplicados ni cambios locales. No había envíos ni recibos de distribución: la prueba real de actualización desde origen sigue pendiente.

Se conserva el alcance pendiente de GUI del borrado, actualización real de una colección y LAN física. No se incluyen catálogos privados, journals, credenciales ni los directorios temporales de desarrollo en el PR.

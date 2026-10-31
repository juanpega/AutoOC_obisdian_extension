# Editor JavaScript — 1.7.5

## Alcance

Resaltado JavaScript compartido entre tareas y pasos Code, tanto en las vistas previas como al editar. El editor usa CodeMirror 6 con números de línea, plegado, parejas de llaves, sangría, búsqueda, deshacer y ajuste de líneas. `Indent code` modifica la sangría del borrador; no es un formateador completo ni ejecuta el código.

Los tres formularios conservan sus callbacks de borrador y guardado. El editor se monta al entrar en pantalla y se destruye al retirar el formulario. Durante el foco en el editor o su buscador, un `Scope` temporal evita que Escape cierre el modal de Obsidian; al salir se restaura el teclado del formulario.

## Prueba real en Obsidian

Windows, Obsidian 1.14.5, tema oscuro, bóveda sintética con una tarea y un paso Code manuales, sin permisos adicionales. No se ejecutaron tareas.

- Colores de sintaxis en la tarea y en `View code` del paso.
- Editor cargado con el código inicial en tarea, `Edit Code Step` y edición del workflow completo.
- Escritura, sangría, deshacer con Ctrl+Z, rehacer con Ctrl+Y y guardado de la tarea. Comprobados después en el catálogo sintético.
- Búsqueda con Ctrl+F y Escape: se cierra el buscador y el formulario permanece abierto.
- `Wrap lines` adapta un comentario largo sin modificar su contenido.
- Escape seguido de Tab mueve el foco a las variables. Escape fuera del editor vuelve a cerrar el formulario normalmente.
- Cerrar sin guardar descarta el comentario de prueba y conserva el código del workflow. Ambos elementos siguen pendientes.

La comprobación visual encontró y corrigió la alineación heredada a la derecha, el ancho reducido y los estilos de búsqueda de Obsidian. No se acredita comprobación visual en macOS, Linux, otros temas ni versiones antiguas de Obsidian.

## Automatización y paquete

Las pruebas del resaltado verifican conservación del texto, marcas HTML literales y límite de las vistas previas. La prueba de catálogo se adapta a los elementos de sintaxis: su doble DOM no agrega automáticamente el texto de sus descendientes.

`npm run build` y `npm run pack:release` completados. Paquete: `release/auto-oc-1.7.5.zip`, siete artefactos con descriptor de integridad. Los módulos centrales de CodeMirror siguen siendo externos y los proporciona Obsidian; el lenguaje JavaScript se distribuye con el plugin.

Regresión focal final: 59/59 aprobadas. La ejecución general terminó con 873 pruebas: 857 aprobadas, 13 fallidas y 3 omitidas. Incluye la aserción antigua del doble DOM, corregida y comprobada en la regresión focal, y fallos en pruebas de procesos, tiempos de observación y compatibilidad Windows. No se presenta la suite general como aprobada ni se atribuyen todos sus fallos al entorno sin una comparación aislada.

## Instalación

Instalado mediante `maintain-release --install` tras descargar normalmente el plugin en `C:\Dev\AutoOC`. Respaldo conservado en `runtime/update-backup-6e0f41fa-be8d-4990-9099-ae8795449834` de esa instalación. Verificados catálogo idéntico por SHA-256 y coincidencia de los siete artefactos con el candidato.

Reactivación y carga real comprobadas: panel 1.7.5 y vista previa JavaScript coloreada de un paso existente. No se iniciaron tareas reales ni se publicó una release remota.

# AutoOC 1.7.21: terminales CLI integradas

Estado: notas de candidato local, version no publicada.

## Novedades

- Vista AutoOC Terminals dentro de Obsidian, con pestañas de sesiones independientes,
  entrada interactiva, colores, redimensionado y salida conservada tras finalizar.
- Settings centraliza CLI terminal destination, la instalacion explicita de soporte
  nativo y el acceso a terminales existentes. El lanzador solo elige harness/carpeta.
- Nuevo tipo CLI task (interactive) con Harness: OpenCode 1, OpenCode 2, Codex CLI,
  GitHub Copilot CLI y Claude Code CLI. Funciona en tareas manuales/programadas y
  en workflows, incluidos anidados, con destino integrado o externo.
- Prompts UTF-8 completos en auxiliares propios para evitar truncado y limites de
  linea de comandos, manteniendo el handoff y los parametros de cada proveedor.
- Cola antes de apertura y cancelacion de peticiones pendientes. Una apertura o
  parada incierta conserva evidencia y no permite relanzamiento automatico.
- Command no muestra ni copia un comando OpenCode incorrecto para una tarea CLI
  generica; explica por que su lanzador y archivo de prompt no son un comando directo.

## Compatibilidad

Las tareas actuales en segundo plano, Codex App y los tipos OpenCode interactivos
anteriores conservan su comportamiento. El modelo vacio de una tarea CLI generica
utiliza el default nativo; no se añaden flags de autoaprobacion ni permisos nuevos.

Completar una tarea CLI interactiva confirma apertura, no el resultado del trabajo
humano. Para crear una vista integrada, AutoOC debe estar cargado en Obsidian;
sin ese host, se rechaza antes de iniciar pasos, sin cambiar a ventana externa.

La terminal integrada de esta entrega requiere Windows x64 y soporte oficial
node-pty 1.1.0, descargado expresamente y verificado con SHA-512 fijado. Usa los
permisos del usuario: no es un sandbox. Cerrar una sesion activa pide confirmacion;
ocultar la vista no la reinicia y descargar el plugin detiene sus terminales propias.

Los paquetes nuevos con taskKind cli requieren este consumidor; una version
anterior no conoce ese tipo aunque entienda el esquema de exportacion. Los creadores
IA siguen generando tareas no interactivas: el nuevo tipo se selecciona manualmente
en el editor o se importa directamente tras revision.

## Pruebas y pendientes

Build y suite completa aprobados: 1284 pruebas, 3 omisiones y 0 fallos. ZIP de siete
artefactos y hashes verificados; workflow de 64 KB desde su extraccion completado
y reanudado sin repetir efectos. La evidencia detallada de instalaciones y los
registros privados de preparacion se conservan localmente, fuera de esta entrega.
Las pruebas offline no certifican GUI Obsidian ni autenticacion real de proveedores.
Sin publicacion, rollout ni actualizacion automatica de otras bovedas.

# Controles de pasos Code — 1.7.4

Validación del 31 de octubre de 2026 en Windows, Obsidian Desktop 1.14.5 y Node.js 22.22.2.

## Comportamiento

Los pasos Code de un workflow comparten tarjeta en Tasks y WorkFlows: plegado independiente, Play individual, Stop de la ejecución propia, Disable/Enable, log en vivo, historial y revisión de intentos interrumpidos cuando corresponde. Play ejecuta únicamente el paso seleccionado, con entrada y resultados previos vacíos; conserva la identidad del workflow y registra un intento independiente sin reemplazar su progreso completo.

La desactivación afecta solo a la tarjeta elegida, conserva sus resultados y se incluye en importación/exportación. Un paso desactivado impide iniciar el workflow completo. Las copias de workflows no heredan reservas de ejecución. También se retira el botón redundante WF Builder Prompt; la creación asistida sigue disponible en los editores.

## Ejecución y compatibilidad

La prueba nativa detectó que crear un Worker de Node directamente en el renderer de esta instalación de Obsidian falla aunque las pruebas Node pasen. La implementación final usa un proceso Node instalado y oculto, con un worker interno y transporte IPC JSON. JSON evita la incompatibilidad entre versiones de V8 encontrada con la serialización binaria. El código y los datos del paso viajan por IPC, sin archivos temporales de código.

Los pasos Code requieren Node.js 18 o posterior; se documenta el requisito y se muestra un error si falta. Se mantienen los permisos explícitos existentes. Stop termina el proceso propio y sus descendientes; el intento se conserva como fallido y con efectos desconocidos hasta su revisión. Detener no revierte efectos externos ya realizados. El historial conserva el resultado del paso; las líneas de consola del log en vivo son transitorias.

## Validación automática

- TypeScript y construcción de los tres bundles: correctos.
- Empaquetado e integridad de `release/auto-oc-1.7.4.zip`: correctos.
- Regresión focal de runtime Code, controles y refresco de bóveda: 44/44 pruebas correctas antes del ajuste final del transporte a JSON.
- Suite completa, con la lista de `npm test` ejecutada en serie: 871 pruebas, 862 correctas, 6 fallos y 3 omisiones. No se presenta esa ejecución como aprobada. Los seis fallos corresponden a tres casos, contando sus subpruebas; todos se verificaron después mediante las repeticiones focales siguientes.
- Dos casos de compatibilidad de la CLI agotaron su límite de 15 segundos. Se repitieron sin cambiar sus aserciones ni sus tiempos: reapertura e historial tras editar, 4/4; paridad de ramificación entre plugin y CLI, 1/1.
- La prueba antigua de Stop esperaba que el código bloqueante terminase con éxito antes de pausar. Se actualizó para mantener su barrera cerrada y exigir interrupción real: fallo cancelado, efectos desconocidos, un único paso iniciado, efecto `A` conservado y ningún efecto `B` ni repetición al intentar Resume. Las cuatro direcciones de rutas Windows y los dos casos de reanudación de tareas completadas pasan: 7/7, sin omisiones.
- Una repetición previa en el entorno restringido falló al crear HEAD en los repositorios Git temporales; se repitió con permisos de prueba adecuados. No acredita un fallo del producto ni se cuenta como aprobada.
- Omisiones de la suite: comprobación del binario real de OpenCode 2 y dos casos exclusivos de POSIX.
- Los primeros intentos con concurrencia 4 se interrumpieron tras fallos y cascadas de timeouts; no se cuentan como aprobados. La repetición final usa la misma lista de archivos, cambiando únicamente la concurrencia a 1.
- El arnés de controles simula Electron y rechaza Workers directos en el renderer. Cubre ejecución aislada, identidad y persistencia, permisos, desactivación, copias, plegado y rechazo de Stop obsoleto o de otro intento.

## Prueba real en Obsidian

Se utilizó una bóveda sintética aislada con dos pasos sin permisos de archivos, bóveda ni terminal. El primero devolvió `Fixture complete`. El segundo imprimió `Waiting for Stop` y entró en un bucle infinito.

1. Play del primer paso completó solo ese paso; el workflow permaneció pendiente y el segundo no se ejecutó.
2. Durante el bucle del segundo paso, Obsidian siguió respondiendo y el log mostró la línea emitida.
3. Stop terminó el bucle y conservó el resultado anterior del primer paso.
4. La revisión oficial del intento sintético conservó el fallo y el registro de efectos desconocidos, sin repetir pasos.
5. Disable atenuó únicamente la primera tarjeta. Enable restauró su presentación y mantuvo el resultado.
6. History mostró tres intentos del primer paso, incluidos los dos fallos de diagnóstico previos, con fecha, estado y acceso al resultado.
7. Se verificó plegado en Tasks y WorkFlows y disposición de los botones en un panel estrecho.

Estas comprobaciones acreditan la GUI Windows probada. No se ha probado la GUI en macOS o Linux ni autenticación de proveedores externos. No se ejecutaron tareas reales de la bóveda del usuario.

## Instalación autorizada

Destino: `C:\Dev\AutoOC\.obsidian\plugins\auto-oc`.

Se instaló el paquete definitivo mediante `maintain-release --install` después de descargar AutoOC normalmente desde los ajustes de Obsidian. Un primer intento con reserva presente se rechazó sin instalar; se volvió a abrir Obsidian y se descargó el plugin desde su interruptor, sin borrar reservas ni archivos de recuperación manualmente.

El recibo final confirma versión 1.7.4, siete artefactos coincidentes con la entrega y SHA-256 de `data.json` idéntico antes y después de instalar. Respaldo oficial: `runtime/update-backup-1f9808ac-a3a5-41f4-b048-c34ceb3899db` dentro de la instalación. Descriptor de integridad final: `8161614ab8f68efed08c1495be7b0255ed4dc4c8e7f2ffe4bbfce19bdc47ccd7`.

Se reactivó AutoOC desde los ajustes y se comprobó su carga real. El panel muestra 1.7.4; Tasks conserva 36 tareas y 498 pasos Code de workflows. El filtro Workflow code steps muestra sus tarjetas plegadas y los controles Disable, Play, Log e History. La bóveda quedó abierta con el plugin activo.

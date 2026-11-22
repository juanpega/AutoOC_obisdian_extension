# Distribución de workflows entre proyectos — piloto

Estado: piloto 1.7.30 implementado, en validación; no instalado todavía.

## Experiencia

Settings → Library → Shared workflows abre la gestión de una biblioteca en una carpeta local o compartida de red. Cada proyecto se conecta explícitamente y elige si permite órdenes de actualización de otros proyectos conectados. No necesita servidor ni abrir puertos. Tener acceso de escritura a esa carpeta equivale a poder publicar código de confianza.

Desde Inncrea se seleccionan workflows y/o tareas, se publica una colección con nombre y nota, y AutoOC incluye las dependencias. En AutoOC se revisa esa colección y se vincula a las definiciones existentes mediante una correspondencia explícita; también se pueden crear definiciones nuevas. Nunca se deduce identidad solo por el nombre.

Las publicaciones son versiones inmutables. Cada proyecto conserva sus IDs locales y su versión instalada. Editar no publica. Publicar desde una copia antigua requiere primero revisar la última versión. Cualquier proyecto vinculado puede publicar su mejora.

Los destinos detectan versiones nuevas al consultar y periódicamente mientras el plugin está cargado. El origen puede enviar una orden a los destinos vinculados que lo permitan. El destino aplica mediante su propietario y guardado habitual. Cerrado o desconectado significa pendiente, nunca aplicado. El origen muestra el recibo de cada destino.

## Sustitución y límites

- Se comparten definiciones, referencias y permisos declarados; no resultados, journals, credenciales ni configuración general.
- Rutas de ejecución, horarios, modelo/agente y activación quedan locales. Las definiciones nuevas se crean desactivadas y con programación manual para revisarlas antes de ejecutarlas.
- Se preservan IDs e historial y se guarda una copia local antes de sustituir. Los archivos de respaldo pueden contener código/prompts y permanecen privados en el runtime.
- Cambios locales requieren una sustitución explícita ligada al hash revisado. Un cambio posterior invalida esa autorización.
- Aumentar permisos o cambiar motor requiere revisión en el destino, incluso si se ordenó una sustitución desde el origen.
- Solo se pospone por ejecuciones afectadas o por un guardado/mantenimiento incompatible; no se exige cerrar terminales ajenas.
- El piloto no retira miembros de una colección ni combina cambios de código. Los miembros vinculados permanecen en las siguientes publicaciones; la retirada/desvinculación queda fuera de esta primera prueba. No se promete actualización simultánea de todos los destinos.
- Una carpeta SMB es un transporte previsto; se valida primero con dos proyectos locales. La compatibilidad LAN real se registra por separado.

## Prueba propuesta

1. Instalar el candidato completo en ambos proyectos y verificar los componentes; recargar cada plugin cuando esté inactivo.
2. Conectar ambos a la misma carpeta y autorizar la recepción en AutoOC.
3. Publicar desde Inncrea una colección pequeña y vincular/importar en AutoOC tras revisar su contenido.
4. Modificar un texto en Inncrea, publicar versión 2 y comprobar el aviso en AutoOC.
5. Enviar esa versión desde Inncrea y verificar el recibo, el cambio y la conservación de IDs e historial.
6. Repetir con un cambio local en destino, un workflow afectado ejecutándose y el destino cerrado. Debe mostrar conflicto o pendiente sin perder datos ni duplicar definiciones.

Rutas confirmadas por el usuario: origen `C:/Dev/inncrea_hub_main_web`, destino `C:/Dev/AutoOC`.

## Operación del piloto

Tras instalar y cargar ambos plugins, conectar por Settings o por `Conectar-Proyectos.ps1` del paquete. Carpeta propuesta: `C:/Dev/AutoOC-Shared`. El auxiliar conecta ambos por sus propietarios cargados y permite recibir distribuciones en AutoOC. No publica ni sustituye definiciones.

En Inncrea, abrir «Shared workflows» desde Settings → Library o la paleta de comandos. «Publish a collection» permite elegir workflows/tareas y publicar la versión 1. En AutoOC, abrir la misma pantalla y usar «Link / import»: seleccionar explícitamente cada definición existente para conservarla, revisar contenido y aplicar. Si son nuevas, quedan desactivadas; habilitarlas desde el editor solo tras revisar los ajustes locales.

Después de mejorar y probar la colección en Inncrea, usar «Publish local improvements». AutoOC avisa de la nueva versión aproximadamente en 30 segundos si está abierto. Desde Inncrea, «Apply to other projects…» permite elegir AutoOC y enviar el cambio; «Refresh» muestra el recibo. `pending` no significa actualizado y `review` requiere abrir la revisión en el destino.

Una misma definición local no puede pertenecer a dos colecciones en este piloto. Agrupar en una sola colección los workflows que comparten tareas. El índice de novedades contiene metadatos pequeños; el código completo se lee al revisar o aplicar una versión, no en cada consulta de novedades.

## CLI

La capacidad es `workflowSharing:1`. Comando: `share-workflows --vault RUTA --status` o `share-workflows --vault RUTA --request JSON_ABSOLUTO`. Acciones: `connect`, `publish`, `review`, `apply`, `distribute`. Consultar el contrato y ejemplos en la guía portable del paquete. Todas las mutaciones usan el propietario cargado; no hay escritura directa de catálogos ni fallback autónomo. Conservar `requestId` ante una respuesta incierta.

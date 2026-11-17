# Edición de tareas desde CLI

Encargo del 17/11/2026: añadir `edit-task`, equivalente de la edición textual de
workflows, e instalar el candidato en `C:/Dev/inncrea_hub_main_web`.

Se añaden `export-task` y `edit-task`, con selección `--task`, hash optimista,
validación estricta de nombre/prompt, exclusión con ejecuciones y guardado por
la cola del plugin. El transporte usa recibos durables, control de capacidad
`taskEditing:1` y los límites de edición existentes (2 MiB cambios / 3 MiB patch).
No crea ni duplica tareas ni modifica sus referencias, motor, permisos o historial.
Los nombres se notifican también a los editores abiertos.

El esquema de importación y los validadores de los creadores no cambian. Su guía
compartida distingue los parches CLI de los paquetes JSON generados.
Pruebas: módulo de edición, transporte con propietario sintético y CLI empaquetada,
además de regresiones de workflows, cola y creadores. Esto no acredita GUI real.

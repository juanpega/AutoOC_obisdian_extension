# Nombres de tareas y alias en workflows

Versión del candidato: 1.7.24.

Al guardar un nuevo nombre desde **Tasks** o **Edit Task** dentro de un workflow, se actualizan los títulos de sus pasos y las referencias de transición abiertas. El editor WorkFlows actualiza los textos y las ayudas sin reconstruir los campos ni perder cambios sin guardar. Dashboard y sus páginas utilizan la misma regla.

| Configuración del paso | Presentación después de renombrar la tarea a «Preparar informe» |
| --- | --- |
| Sin `name`, vacío o solo espacios | Preparar informe |
| Alias `Revisión final` | Revisión final · Task: Preparar informe |
| Alias idéntico al nombre actual | Preparar informe |
| Alias con tarea ausente | Alias · Task: (deleted task) |

**Step name** es un alias local del paso. Dejarlo vacío permite seguir el nombre de la tarea. No se elimina ni se reemplaza un alias existente por deducir que está anticuado. Los pasos Code y Delay conservan sus nombres propios. Los workflows anidados muestran también el nombre actual del workflow referenciado.

## Identidad y compatibilidad

`tasks[].id` identifica una tarea y `steps[].taskId` la referencia. `steps[].id` identifica el paso; `transitions[].toStepId` apunta a ese paso. Renombrar cambia la presentación, no esos vínculos, ni los permisos, posiciones o resultados anteriores.

No hay migración del catálogo ni cambios en el esquema de importación/exportación. Los paquetes históricos conservan sus alias y referencias. El prompt compartido de creación explica la distinción y recomienda omitir el alias cuando basta el nombre de la tarea. Sus ejemplos siguen pasando los validadores de los creadores.

## Verificación

Las regresiones de `tests/workflow-task-names.test.cjs` ejercitan el modal y guardado reales del bundle con un DOM simulado: renombrado con y sin alias, referencias repetidas, transiciones, reapertura, cancelación, fallo de guardado, campos sin guardar y suscripciones del editor. Incluyen importación/exportación, workflows anidados y proyecciones de Dashboard/páginas.

Estas pruebas no acreditan la interacción visual en Obsidian real. La compilación y los resultados de la suite completa se registran en el PR; instalación, publicación y validación GUI son comprobaciones independientes.

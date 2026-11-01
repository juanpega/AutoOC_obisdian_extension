# Flujos modificados

## Consulta y ejecución separadas

```mermaid
flowchart TD
  A[Abrir AutoOC] --> B{Arranque del motor disponible}
  B -->|Sí| C[Panel normal y controles de ejecución]
  B -->|No| D[Panel de consulta y diagnóstico]
  D --> E[Leer catálogo confirmado sin migrar ni escribir]
  E --> F[Ver datos guardados y buscar actualización]
  D --> G[Reintento o recuperación oficial según diagnóstico]
  G --> B
  C --> H[Admisión, permisos y reserva antes de ejecutar]
```

El panel de consulta no inventa un catálogo vacío ante errores. No adquirir la reserva para leer tampoco concede permiso para ejecutar. El reintento no sustituye la recuperación ni resuelve efectos desconocidos.

## Actualización del paquete

```mermaid
flowchart TD
  A[Buscar versión en main remoto] --> B[Obtener paquete completo]
  B --> C[Verificar versión y hashes]
  C --> D{Host inactivo y guardados terminados}
  D -->|No| E[Conservar instalación y explicar bloqueo]
  D -->|Sí| F[Reserva exclusiva y copia de respaldo]
  F --> G[Instalar siete artefactos]
  G -->|Fallo| H[Rollback o marcador pendiente con evidencia]
  G -->|Correcto| I[Recargar y verificar instancia nueva]
```

Los históricos interrumpidos se conservan; no son por sí solos una operación de escritura actual. Un propietario vivo, guardado interrumpido o actualización incompleta sí impide sustituir archivos. `maintain-release --install` ofrece el recorrido desde un paquete nuevo separado cuando el actualizador instalado antiguo no permite el salto; nunca elimina reservas.

## Creación desde objetivo

```mermaid
flowchart LR
  A[Objetivo, motor y modelo] --> B[Prompt integrado y ejemplo compatible]
  B --> C[Sesión de generación cancelable]
  C --> D{JSON válido y límites admitidos}
  D -->|No| E[Conservar formulario y mostrar error]
  D -->|Sí| F[IDs nuevos y permisos restrictivos]
  F --> G[Revisar en editor]
  G -->|Guardar| H[Transacción de tareas y workflow]
  G -->|Cancelar| I[Descartar borrador sin añadir elementos]
```

La generación no inicia el objetivo descrito ni comparte el journal de una tarea. El workflow generado es secuencial; el importador general sigue admitiendo workflows existentes con otros recorridos.

## Operaciones de catálogo y Code

```mermaid
flowchart TD
  A[Seleccionar elementos] --> B[Capturar identidad y huella]
  B --> C[Confirmar acción]
  C --> D{Sin actividad incompatible ni cambio de selección}
  D -->|No| E[Revisar selección sin aplicar]
  D -->|Sí| F[Transacción y validación antes del guardado]
  F -->|Fallo| G[Restaurar cambios de esta operación]
  F -->|Correcto| H[Refrescar listas y Dashboard]
  I[Run Code desde GUI o CLI] --> J[Seleccionar workflow y step exactos]
  J --> K[Comprobar disabled, capacidades y concurrencia]
  K --> L[Run aislado en proceso Node]
  L --> M[Guardar codeExecution del paso]
  M --> H
```

La eliminación comprueba referencias desde workflows no seleccionados. La ejecución aislada usa input y resultados previos vacíos, sin transiciones; no marca el workflow completo como terminado. Stop no revierte efectos externos.

## Dashboard por áreas y atención

```mermaid
flowchart TD
  A[Evento de actualización existente] --> B[Proyectar tareas, workflows y resultados Code]
  B --> C[Consultar propiedad por workflowId y runId exactos]
  C --> D{Hay fallo, aprobación, parada incierta o falta de control}
  D -->|Sí| E[Needs attention]
  D -->|No| F[Estado normal, incluido Running]
  E --> G[Agrupar por área, filtrar y mostrar inspector]
  F --> G
  G --> H[Log, History u Open controls]
```

`requiresReconciliation` es información durable; no basta para mostrar una alarma si el host controla ese intento. `disabled` es una dimensión separada del resultado. No se añade sondeo periódico ni movimiento físico continuo; los pasos se muestran en grupos de 40.

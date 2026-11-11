# Crear páginas y lanzar requisitos desde la CLI

Candidato 1.7.25. Requiere `pageCreation:1` en la CLI y en el propietario del runtime. Consultar `version` y `help` del paquete instalado antes de usarlo; compilar no actualiza una instalación existente.

## Preparar una petición

Guardar un archivo JSON regular de hasta 60 KB. Este ejemplo crea una página con rama y worktree nuevos, entrega el requisito y solicita ejecutar un workflow existente. Sustituir las rutas y el ID del workflow:

```json
{
  "requestId": "prepare-req-example-001",
  "name": "REQ-EJEMPLO-001 - Exportar informes",
  "objective": "Implementar la exportación CSV y verificar sus criterios de aceptación.",
  "requirementId": "REQ-EJEMPLO-001",
  "requirementText": "Exportar columnas y filas del informe a CSV, incluyendo caracteres Unicode y campos vacíos.",
  "mode": "create",
  "repository": "C:/proyectos/ejemplo",
  "branch": "feat/req-example-001",
  "base": "main",
  "allowGitignoreUpdate": true,
  "launch": {"workflowId": "workflow-implementacion"}
}
```

```text
node CLI create-page --vault ROOT --request REQUEST_JSON
node CLI inspect-page-request --vault ROOT --request-id prepare-req-example-001
```

`CLI`, `ROOT` y `REQUEST_JSON` representan rutas absolutas. `ROOT` selecciona la bóveda y su instalación; no selecciona implícitamente el repositorio ni el directorio de trabajo. En Windows, macOS y Linux deben usarse las rutas del sistema correspondiente.

| Campo | Contrato |
| --- | --- |
| `requestId` | Obligatorio y estable; hasta 120 caracteres, letras, números, punto, guion y guion bajo; comienza con letra o número. |
| `name`, `objective` | Nombre obligatorio; objetivo opcional incorporado al contexto de la página. |
| `mode` | `create`: worktree nuevo; `link`: worktree existente; `folder`: carpeta existente. |
| `repository`, `branch`, `base` | Obligatorios solo en `create`. La rama debe ser nueva. La base se resuelve al preparar el entorno: usar un SHA para fijarla desde el origen. |
| `directory` | Ruta absoluta existente, obligatoria solo en `link` y `folder`. |
| `allowGitignoreUpdate` | Por defecto `false`. En `create`, `true` autoriza a añadir la exclusión necesaria de los worktrees en ese proyecto. |
| `requirementId`, `requirementText` | Opcionales. El texto exige ID; se guarda como snapshot local y se verifica mediante hash antes de ejecutar. |
| `launch` | Opcional. Selecciona exactamente un `workflowId` o `taskId` del catálogo compartido para lanzarlo una vez tras el alta. |

`create` y `link` requieren worktrees habilitados previamente en Settings. `folder` no requiere Git. Los worktrees nuevos viven en `<repositorio>/.autooc/worktrees/<pageId>/`; no cambian la rama del checkout principal ni hacen staging o commit. La exclusión ya efectiva no se reescribe; también se respeta la aceptación previa guardada para ese proyecto. La CLI no activa preferencias por inferencia.

## Solicitudes desde tareas y workflows

Con un propietario compatible, la CLI entrega la petición a ese propietario. Durante una ejecución devuelve `status:"queued"`, `created:false` y un `pageId` reservado. El padre puede continuar: el propietario espera a que los runs registrados terminen correctamente y a que se liberen ejecuciones, escritores y terminales antes de preparar Git y lanzar el hijo.

No esperar al hijo dentro del padre ni sustituir este recorrido por un `run --page` recursivo. Fallo, cancelación o incertidumbre de los runs previos bloquean la petición. El host autónomo atiende estas solicitudes durante su ejecución y procesa la cola antes de salir; no inicia un daemon ni transfiere ejecuciones entre hosts. Sin propietario, `create-page` procesa su solicitud en primer plano.

El código de salida 0 puede significar una entrega en cola: consultar siempre `status` y `created`. El código 1 indica rechazo, operación incierta o hijo fallido. `launchRunId` y `launchPhase` conservan la identidad y el resultado real del hijo; crear una página no demuestra que el requisito haya terminado. Tras el alta puede utilizarse también el comando existente `run --vault ROOT --workflow ID --page PAGE_ID` desde un contexto admitido por el runtime.

`requirementText` entrega un requisito que aún no existe en el commit base. Se guarda en `.autooc/requirement.md` dentro de la página, con referencia y hash. AI recibe la ruta; Code necesita su permiso explícito de bóveda para leerla. El archivo puede quedar sin seguimiento o ignorado por Git: no se confirma ni elimina automáticamente. No se copian otros documentos, secretos o dependencias del proyecto original.

## Consultas y recuperación

Los recibos viven en `runtime/page-requests`, separados del catálogo. La consulta no modifica el estado ni acredita que un proceso siga vivo. El mismo `requestId` con los mismos parámetros conserva la identidad; otro contenido produce conflicto. Una respuesta perdida no autoriza usar un ID nuevo ni repetir el lanzamiento.

| Estado | Significado |
| --- | --- |
| `queued` | Recibida, pendiente de preparar el entorno. |
| `preparing` | Preparación iniciada. Una pérdida del propietario exige revisar los efectos. |
| `environment` | Entorno observado, pendiente de confirmar el registro de la página. |
| `created` | Página registrada; puede faltar el lanzamiento solicitado. |
| `launching` | Lanzamiento iniciado; consultar el run registrado cuando exista. |
| `completed` | Petición procesada. `launchPhase` indica si el hijo terminó correctamente o falló. |
| `blocked` | Rechazo previo o runs anteriores sin completar correctamente; revisar `errorCode`. |
| `needs-review` | Resultado incierto o hijo no terminal; conservar la evidencia y usar los procedimientos oficiales del runtime. |

Tras reiniciar no se reproducen peticiones antiguas automáticamente. Reenviar explícitamente la misma petición permite continuar `queued`, `environment` o `created`, tras revalidar el entorno. No se repite Git ni un lanzamiento incierto. No borrar locks, journals o worktrees para desbloquearlos. Si un rechazo sin efectos exige cambiar parámetros o consentimiento, revisar la solicitud y darle un ID nuevo; esto no se aplica a resultados inciertos.

## Verificación del candidato

- Build y hashes de los siete componentes del paquete comprobados; versiones alineadas. Sin instalación, merge ni publicación de release.
- Selección inicial: 163/163 aprobadas. Selección ampliada: 211 aprobadas y 3 fallidas; se corrige la espera de la nueva prueba del plugin usando su barrera real de publicación.
- Revalidación secuencial de creación, CLI de páginas y prompts: 52 aprobadas, 0 fallidas y 1 omitida porque el anfitrión Windows bloquea la creación del enlace de prueba. La cancelación existente pasa aislada; se conserva el fallo observado bajo carga.
- Lifecycle en proceso separado: 149/149 aprobadas.
- Preparación del PR 1.7.25: build aprobado y 15/15 pruebas del runtime distribuido aprobadas tras alinear la versión. Sin cambios funcionales respecto al candidato probado.
- La suite general no está aprobada: pretest 310 aprobadas, 7 fallidas y 1 omitida; principal 829 aprobadas, 48 fallidas y 3 omitidas. Una regresión de preflight detectada en esa tanda se corrige y pasa después en la selección focal. Permanecen fallos de fixtures e integraciones Windows, OpenCode 2 y empaquetado PowerShell, sin atribuirlos todos a una causa demostrada.
- Se usan procesos Node/Git y bóvedas sintéticas; el bundle plugin se carga con dobles de Obsidian. GUI nativa, proveedores autenticados y ejecución nativa macOS/Linux pendientes de verificación.

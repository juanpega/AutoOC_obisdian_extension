# Gestión de Pages por CLI (candidato 1.7.29)

El agente puede revisar una Page y enviar una decisión explícita al propietario
AutoOC abierto. Consultar `version` y `help` de la instalación seleccionada:
CLI y propietario deben anunciar `pageManagement:1`. No hay fallback autónomo
para estas operaciones; crear Pages y ejecutar workflows conservan sus contratos
anteriores.

## Consultar y actuar

`review-page --vault ROOT --page ID --kind merge|finish|discard|delete` devuelve
JSON con la Page, revisión, sesiones observadas, `reviewHash` y `requestId`.
Solo merge admite `--target ABS_DIRECTORY`. El destino es una carpeta revisada,
no un nombre de rama supuesto. En finish se distinguen los bloqueos de archivo
y de retirada. Las revisiones no escriben el catálogo ni hacen merge; la
previsualización Git puede crear objetos sin referencia con merge-tree.

`page-action --vault ROOT --request ABS_JSON` recibe `pageId`, `action` y el
`reviewHash` superior devuelto por una revisión vigente. La decisión solo admite
los campos de su acción:

| Acción | Revisión | Datos adicionales |
| --- | --- | --- |
| `merge-start` | merge | `targetDirectory` |
| `merge-complete` | merge | `targetDirectory` |
| `merge-abort` | merge | `targetDirectory`, `confirmLoss:true` |
| `archive` | finish | Ninguno |
| `remove-worktree` | finish | `sessionsClosed:true` |
| `discard` | discard | `branchName`, `sessionsClosed:true`, `confirmLoss:true` |
| `delete` | delete | `confirmDelete:true` |

Cada acción utiliza las mismas operaciones del plugin que la interfaz. Se
revalida Page, estado Git, destino y sesiones; un hash antiguo se rechaza antes
de delegar. El motor vuelve a comprobar Git bajo su reserva justo antes de
mutar. No se añaden campos a los JSON de tareas/workflows. No se cierran
terminales ni se ignora la sesión del solicitante. Las consultas se permiten
durante ejecución; las mutaciones conservan exclusión, actividad y sesiones.

La propia terminal de un agente puede impedir el merge o la retirada de su
carpeta. Debe entregar ese diagnóstico o continuar desde un contexto autorizado
libre, sin detener su padre ni confirmar falsamente procesos cerrados. Main
puede seguir abierto al cerrar una Page independiente; merge comprueba también
su destino. La integración no certifica las pruebas del producto.

## Continuidad y límites

El buzón publica aceptación durable antes del efecto y no reproduce una petición
ya recibida. La CLI emite el `requestId` en stderr al enviar y lo conserva en la
respuesta o error. Ante incertidumbre, usar `inspect-request` o `follow` con ese
mismo UUID. `--include-output true` devuelve `pageManagement` con el resultado;
sin esa opción se limita a identidad, hash y estado aplicado.

`applied:true` significa que terminó esa acción, no que terminó todo el cierre.
La revisión posterior es otra consulta. Un fallo conserva su recibo como
incierto: puede haber efectos parciales. Interrumpir la espera no garantiza
cancelar una acción aceptada. No reenviar ni crear una solicitud nueva por un
timeout, ni borrar reservas o marcas de retirada.

Las respuestas se limitan al tamaño admitido por el transporte. Listas y
detalles acortados anuncian `truncated:true` y recuentos completos; el hash y las
validaciones siguen utilizando la evidencia completa. Las retiradas
interrumpidas mantienen sus flujos de recuperación de interfaz.

## Refresco del diálogo

Merge review conserva el contenido y mantiene los botones utilizables durante
consultas automáticas. Un cambio real actualiza los controles según el nuevo
estado; una acción explícita bloquea mientras modifica Git. Cada consulta lleva
una generación local: una respuesta anterior a un cambio de destino, reconsulta
manual, acción o cierre no puede sustituir el resultado ni desbloquear botones.
Un fallo de consulta deshabilita las acciones antiguas y ofrece reintento.

Guía de operación distribuida: `skills/autooc-runtime/SKILL.md`. Las capacidades
y hashes del paquete concreto prevalecen sobre compartir el número 1.7.29.


Delete page admite Pages archivadas con ejecuciones resueltas y retirada de worktree confirmada como `removed`. La entrada sale del listado y conserva identidad/evidencia en `deletedWorkPages`, junto al historial existente. Overview permite consultar los logs en **Deleted page history**, sin reactivar la Page. Las retiradas pendientes y ejecuciones inciertas siguen bloqueando; se mantienen revisión/hash, confirmación, propietario y sesiones.

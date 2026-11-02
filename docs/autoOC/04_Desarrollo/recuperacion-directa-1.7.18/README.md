# Recuperación directa de bloqueos — candidato 1.7.18

## Encargo y alcance

Encargo directo del 02/11/2026: disponer de una salida desde AutoOC para las ejecuciones pendientes y reservas retenidas que obligaban al usuario a alternar entre ayuda, recargas y comandos. El caso comunicado corresponde a otro equipo; no se modifica ni se acredita la recuperación de esa instalación.

El diagnóstico aportado por el usuario mostraba un checkpoint `ready`, un paso completado y una reserva presente. Eso permite identificar trabajo pendiente, pero no demuestra que su propietario o sus procesos externos hayan terminado. La pantalla de consulta no ofrecía revisión de intentos vinculados al catálogo actual.

## Comportamiento

- `Resolve blocked executions` se encuentra en el modo de consulta, los ajustes y la paleta. Las tarjetas de tareas y workflows pendientes incluyen acceso al mismo diálogo con su intento seleccionado.
- La revisión lee los journals actuales e incluye intentos vinculados y antiguos, nombres, fase y número de pasos completados. No copia prompts ni resultados a los diagnósticos.
- En modo de consulta, `Reconnect execution controls` conserva todos los intentos y permite volver a sus controles de continuación. Requiere confirmación; no ejecuta tareas.
- `Reset this attempt…` requiere motivo y confirmación explícita de que el trabajo externo terminó y de que los efectos no comprobados quedan desconocidos. Usa el abandono oficial para `ready`/`in_flight`; una revisión terminal utiliza la disposición oficial. Conserva los snapshots, pasos, resultados, catálogo y definiciones. No ejecuta otro intento ni marca éxito.
- La reserva se reutiliza únicamente si pertenece al host local inactivo. Una instancia anterior detenida solo puede entregar su propia reserva mediante el registro de propietarios y sus comprobaciones de inactividad. Para un propietario ausente se usa la recuperación oficial del token exacto. Un PID coincidente por sí solo no concede propiedad; un propietario vivo externo o no verificable impide recuperar.
- Tras una operación en consulta, el plugin recarga sus controles. En el panel activo reproyecta la evidencia mediante la carga habitual, sin sustituir ediciones locales concurrentes.
- Una definición modificada ya no ofrece continuar un checkpoint creado con otra definición. El usuario puede restaurar la definición original o cerrar el intento mediante la revisión.

## Integridad y concurrencia

La confirmación queda vinculada a la identidad física de la instalación, el hash del catálogo, el propietario observado, el hash/revisión del journal y el intento seleccionado. Una lectura obsoleta obliga a actualizar la revisión. La recuperación comparte las barreras de admisión y cierre: impide nuevos arranques durante la operación, espera la terminación de trabajo local y no libera una reserva con escritura parcial pendiente. No elimina guards, locks ajenos, journals ni resultados.

El motivo y los efectos desconocidos quedan en los registros oficiales ya existentes. No se añaden campos al esquema de creación, motores, permisos, pasos, transiciones ni comandos CLI. Se revisa el impacto sobre los prompts compartidos: la recuperación es una decisión del operador, no una capacidad que deban inventar los creadores. No cambia el prompt de generación; su validación se mantiene en la suite real de creadores.

## Verificación y límites

- `npm run build`: correcto, con TypeScript y los tres bundles.
- Selección focal: 71/71 correctas en `.tmp-blocked-recovery-focused-final.log`. Incluye reserva retenida de una instancia detenida, propietario vivo no registrado, cancelación, cambios durante la confirmación, conservación de catálogo/resultados, nuevo intento explícito y cierre concurrente.
- `npm test`: suite funcional 811 correctas, 3 omitidas y 0 fallos. Omisiones: dos casos POSIX y el binario oficial OpenCode 2. Incluye las 26 pruebas nuevas y la comprobación del prompt real distribuido de los creadores con ejemplos válidos para sus motores y editores. El ciclo de vida de esa llamada terminó 148/149: una prueba esperaba un único comando de consulta y ahora hay dos. Se conserva el fallo original en `.tmp-blocked-recovery-suite.log`.
- La expectativa antigua se sustituye por la lista exacta de los dos comandos de consulta permitidos y la presencia del botón nuevo. Repetición de `npm run test:lifecycle` aislada: 149/149, sin otras suites concurrentes ni modificación del umbral de 100 ms. Evidencia: `.tmp-blocked-recovery-lifecycle-final.log`. No se presenta la primera llamada completa a `npm test` como una ejecución sin fallos.
- Ensayo focal inicial restringido: 21 correctas/45 fallidas, con renombrados denegados por Windows. Primera repetición nativa: 64/66; se corrigieron un fixture sin redactor y la llamada que exigía un motor activo desde consulta. Ambos registros originales se conservan.
- ZIP `release/auto-oc-1.7.18.zip` generado, extraído y con sus siete artefactos idénticos al candidato y descriptor verificado. Workflow autónomo sintético de dos pasos Code completado desde esa instalación: resultados `one` y `one|two`, reserva liberada. Recibo privado `.tmp-blocked-recovery-package-result.json`.
- SHA-256 del ZIP: `231c0e71760444f599e66d7bf79c0854bdb9aea198e07476c4276e68e27a7266`.

Se usan bóvedas sintéticas aisladas; las pruebas con dobles de Obsidian no acreditan GUI real, proveedores reales ni recuperación en el equipo del usuario. La aceptación visual y operativa en ese equipo queda pendiente.

No se autoriza mediante este encargo publicar, instalar, recuperar reservas reales o cerrar intentos reales. El candidato se prepara y verifica en las fuentes del repositorio; su instalación en el equipo afectado es una operación posterior.

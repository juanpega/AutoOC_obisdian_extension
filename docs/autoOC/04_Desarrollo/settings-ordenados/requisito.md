# Settings ordenados y coherentes entre motores

## Versión 2 · 08/11/2026

Estado: primera organización instalada para revisión; iteración de burbujas fijas a 30 px preparada y compilada, aún no instalada. El usuario autoriza después preparar nueva versión y push: se incluye en el candidato 1.7.22 de `feat/detachable-terminals`. La aceptación visual pendiente no se presenta como aprobada y el push no autoriza merge, tag, GitHub Release ni otra instalación.

## Objetivo

Reorganizar Settings de AutoOC sin perder configuración ni retirar opciones, salvo la excepción posterior autorizada del tamaño de burbujas. Dar a las funciones heredadas de OpenCode 1 un alcance compartido cuando sea compatible, como mínimo equivalencia útil con OpenCode 2, sin fingir soporte en otros harnesses.

## Organización prevista

1. General: motor predeterminado y carpeta de trabajo. Se retira el tamaño de burbujas por petición posterior expresa.
2. Harnesses: un bloque por OpenCode 1, OpenCode 2, Codex, Copilot y Claude; rutas, visibilidad en el selector y opciones específicas juntos. Claude sigue siendo un harness interactivo, no un motor de tareas de fondo.
3. Terminales: destino integrado/externo, soporte opt-in, sesiones existentes, modo interactivo predeterminado y emulador Linux.
4. Ejecución: concurrencia, límite de ejecuciones y timeout con descripción de su alcance real.
5. Logs: persistencia, límites, retención y borrado con la confirmación existente.
6. Biblioteca: URL compartida, sin reconstruir toda la pantalla en cada pulsación.
7. Mantenimiento: revisión de bloqueos, intentos anteriores y aviso de credenciales históricas.

Secciones plegables con navegación accesible y estado de apertura conservado durante esta pantalla. Todas las opciones siguen disponibles; abrir Settings no consulta proveedores ni instala nada.

## Equivalencia y límites

- Mantener ajustes compartidos realmente comunes y sus claves actuales.
- Reunir ruta y comprobación de versión para todos los harnesses. Detectar una versión no acredita autenticación ni ejecución real.
- OpenCode 2 dispone también de listados visibles y refrescables de modelos y agentes, además de los selectores y entrada manual existentes; usa su propio ejecutable y catálogo por proyecto, nunca los de OpenCode 1.
- El modo interactivo predeterminado existente ya se aplica a OpenCode 1 y 2: explicitar ambos, sin cambiar tareas existentes.
- Mantener modelos y razonamiento Codex, modelo y prueba de instalación Copilot, y todos los controles de OpenCode 1.
- Conservar Ralph Loop como integración específica de OpenCode 1. No instalarlo ni anunciarlo para OpenCode 2, Codex, Copilot o Claude sin compatibilidad real demostrada.
- No cambiar esquemas de importación/exportación, permisos, motores de tareas existentes, rutas guardadas ni defaults por mostrar o plegar secciones.
- Revisar el prompt real de creadores y la guía portable: no añadir campos ni capacidades de generación inexistentes.

## Aceptación

Ningún ajuste o acción anterior desaparece salvo el tamaño de burbujas, retirado por decisión expresa; agrupación comprensible y usable por teclado; configuración antigua conservada; listados/errores/vacíos claros; refrescos por motor sin mezclarlos; no instalar, autenticar ni ejecutar tareas al abrir la pantalla. La revisión visual en Obsidian es necesaria y no se sustituye por pruebas con dobles.

### Iteración: diámetro fijo

El usuario considera innecesario el ajuste porque las letras no cambian de tamaño y solicita eliminarlo. Las burbujas de tareas y pasos se fijan a **30 px**, sin entrada numérica, preview, Apply o Reset en Settings. Se ignoran tanto presets/diámetros históricos del catálogo como preferencias locales; no se borran ni reescriben para lograrlo. Las letras no se escalan. Se conserva la representación de workflows de doble anillo a 36 px, como antes con el default de 30 px. La corrección se prepara inicialmente en fuentes; la instalación anterior no acredita que la retirada ya esté cargada.

## Matriz de compatibilidad de esta iteración

| Función | Alcance |
| --- | --- |
| Ruta, auto-detección, visibilidad y Check version | Los cinco harnesses; la visibilidad no desactiva tareas guardadas. |
| Modelo predeterminado de tareas | OpenCode 1/2, Codex y Copilot, sin modificar las claves o valores existentes. Claude conserva sus opciones nativas en la CLI. |
| Agente predeterminado y catálogo | OpenCode 1/2; no inventar agentes compatibles con Codex, Copilot o Claude. |
| Catálogo visible de modelos | OpenCode 1/2; se mantiene la carga de modelos Codex y la entrada manual Copilot. |
| Razonamiento Codex | Solo donde ya está soportado. |
| Modo interactivo predeterminado existente | OpenCode 1/2; las tareas CLI genéricas siguen siendo siempre interactivas y Codex App no cambia. |
| Timeout | Valor compartido de ejecuciones AI de fondo compatibles; semántica dependiente del host/adaptador. No convertirlo en un límite universal de todas las terminales o de Code. |
| Ralph Loop | Integración existente de OpenCode 1, conservada sin extensión no demostrada. |
